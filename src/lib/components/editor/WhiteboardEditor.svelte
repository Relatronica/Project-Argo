<script>
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { Table } from '@tiptap/extension-table';
	import { TableRow } from '@tiptap/extension-table-row';
	import { TableHeader } from '@tiptap/extension-table-header';
	import { TableCell } from '@tiptap/extension-table-cell';
	import { Image } from '@tiptap/extension-image';
	import { TextAlign } from '@tiptap/extension-text-align';
	import { TextStyle } from '@tiptap/extension-text-style';
	import { Color } from '@tiptap/extension-color';
	import { isDarkTheme } from '../../stores/themeStore.js';
	import Whiteboard from '../Whiteboard.svelte';
	import Icon from '../Icon.svelte';
	import LinkModal from './LinkModal.svelte';
	import ImageModal from './ImageModal.svelte';

	// Props
	export let note;
	export let onContentChange;
	export let onSelectionUpdate;
	export let onReady;
	export let onEditorRef;

	// Whiteboard state
	let whiteboardComponent;
	let whiteboardTool = 'pen';
	let whiteboardColor = '#000000';
	let whiteboardLineWidth = 2;

	// Text editor state
	let textEditorElement;
	let textEditor;

	// Whiteboard data
	let paths = [];
	let autoSaveTimer = null;

	// Table state
	let isInTableState = false;

	// Color picker state
	let showColorPicker = false;
	let colorPickerElement;
	let customColor = '#000000';

	// Link/Image modal state
	let showLinkModal = false;
	let showImageModal = false;
	let linkUrl = '';
	let imageUrl = '';
	let imageFile = null;

	// Color palette
	const colorPalette = [
		'#000000', '#374151', '#DC2626', '#EA580C', '#CA8A04',
		'#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#BE185D',
		'#92400E', '#365314'
	];

	// Logging counters to reduce console spam
	let updateCount = 0;
	let selectionCount = 0;

	// Compress image function
	async function compressImage(file) {
		return new Promise((resolve, reject) => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			if (!ctx) {
				reject(new Error('Canvas context not available'));
				return;
			}

			// Use global Image constructor or create image element
			const img = document.createElement('img');

			img.addEventListener('load', () => {
				try {
					const maxSize = 800;
					let { width, height } = img;

					if (width > height && width > maxSize) {
						height = (height * maxSize) / width;
						width = maxSize;
					} else if (height > maxSize) {
						width = (width * maxSize) / height;
						height = maxSize;
					}

					canvas.width = width;
					canvas.height = height;
					ctx.drawImage(img, 0, 0, width, height);

					canvas.toBlob((blob) => {
						blob ? resolve(blob) : reject(new Error('Compression failed'));
					}, file.type, 0.7);
				} catch (error) {
					reject(error);
				}
			});

			img.addEventListener('error', () => reject(new Error('Image load failed')));

			// Set src after adding event listeners
			img.src = URL.createObjectURL(file);
		});
	}

	// Callback for when a new path is added to the whiteboard
	function handlePathAdd(newPath) {
		console.log('[WhiteboardEditor] Adding new path:', newPath.points?.length || 0, 'points');
		paths = [...paths, newPath];
		saveWhiteboardData();
	}

	// Toolbar functions
	function toggleBold() { textEditor?.chain().focus().toggleBold().run(); }
	function toggleItalic() { textEditor?.chain().focus().toggleItalic().run(); }
	function toggleStrike() { textEditor?.chain().focus().toggleStrike().run(); }
	function toggleCode() { textEditor?.chain().focus().toggleCode().run(); }
	function setHeading(level) { textEditor?.chain().focus().toggleHeading({ level }).run(); }
	function toggleBulletList() { textEditor?.chain().focus().toggleBulletList().run(); }
	function toggleOrderedList() { textEditor?.chain().focus().toggleOrderedList().run(); }
	function toggleBlockquote() { textEditor?.chain().focus().toggleBlockquote().run(); }
	function setLink() {
		const isActive = textEditor?.isActive('link');
		if (isActive) {
			textEditor?.chain().focus().unsetLink().run();
		} else {
			linkUrl = textEditor?.getAttributes('link')?.href || '';
			showLinkModal = true;
		}
	}

	function handleLinkConfirm(event) {
		const { url } = event.detail;
		if (url) {
			textEditor?.chain().focus().setLink({ href: url }).run();
		}
		showLinkModal = false;
		linkUrl = '';
	}

	function handleLinkClose() {
		showLinkModal = false;
		linkUrl = '';
	}
	function addImage() {
		imageUrl = '';
		imageFile = null;
		showImageModal = true;
	}

	async function handleImageConfirm(event) {
		const { url } = event.detail;
		if (url) {
			try {
				textEditor?.chain().focus().setImage({ src: url }).run();
			} catch (error) {
				console.error('Error inserting image:', error);
				alert('Failed to insert image. Please try again.');
			}
		}
		showImageModal = false;
		imageUrl = '';
		imageFile = null;
	}

	async function handleImageFileSelected(event) {
		const { file } = event.detail;
		if (file) {
			try {
				// Validate file size (max 10MB)
				if (file.size > 10 * 1024 * 1024) {
					alert('Image file is too large. Please select an image smaller than 10MB.');
					return;
				}

				// Compress image before converting to data URL
				const compressedFile = await compressImage(file);
				// Convert to data URL
				const reader = new FileReader();
				reader.onload = (e) => {
					imageUrl = e.target?.result;
				};
				reader.readAsDataURL(compressedFile);
			} catch (error) {
				console.error('Error processing image:', error);
				alert('Failed to process image. Please try a different image.');
			}
		}
	}

	function handleImageClose() {
		showImageModal = false;
		imageUrl = '';
		imageFile = null;
	}
	function addTable() { textEditor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }
	function deleteTable() { textEditor?.chain().focus().deleteTable().run(); }
	function setTextAlign(alignment) { textEditor?.chain().focus().setTextAlign(alignment).run(); }
	function setColor(color) { textEditor?.chain().focus().setColor(color).run(); }
	function toggleColorPicker() {
		showColorPicker = !showColorPicker;
	}
	function applyColor(color, event) {
		if (event) {
			event.stopPropagation();
			event.preventDefault();
		}
		setColor(color);
		customColor = color;
		showColorPicker = false;
	}
	function applyCustomColor(event) {
		if (event) {
			event.stopPropagation();
			event.preventDefault();
		}
		setColor(customColor);
		showColorPicker = false;
	}
	function resetColor(event) {
		if (event) {
			event.stopPropagation();
			event.preventDefault();
		}
		textEditor?.chain().focus().unsetColor().run();
		showColorPicker = false;
	}

	function getCurrentColor() {
		if (!textEditor) return null;
		for (const color of colorPalette) {
			if (textEditor.isActive('textStyle', { color })) return color;
		}
		return textEditor.getAttributes('textStyle')?.color || null;
	}

	function isActive(type, options = {}) {
		return textEditor?.isActive(type, options) || false;
	}


	// Check table state - same implementation as working TextEditor
	function checkTableState() {
		console.log('[WhiteboardEditor] checkTableState called');

		if (!textEditor) {
			console.log('[WhiteboardEditor] checkTableState: no editor');
			isInTableState = false;
			return;
		}

		const { state } = textEditor;
		const { selection } = state;
		const { $from } = selection;

		console.log('[WhiteboardEditor] checkTableState: checking at position', $from.pos, 'depth', $from.depth);

		let inTable = false;
		for (let depth = $from.depth; depth > 0; depth--) {
			const node = $from.node(depth);
			console.log('[WhiteboardEditor] checkTableState: checking node at depth', depth, 'type:', node.type.name);
			if (node.type.name === 'table') {
				inTable = true;
				console.log('[WhiteboardEditor] checkTableState: found table at depth', depth);
				break;
			}
		}

		const wasInTable = isInTableState;
		isInTableState = inTable;
		console.log('[WhiteboardEditor] checkTableState: table state changed from', wasInTable, 'to', inTable);
	}

	// Initialize text editor for whiteboard mode
	function initTextEditor() {
		console.log('[WhiteboardEditor] initTextEditor called');

		if (!textEditorElement) {
			console.log('[WhiteboardEditor] initTextEditor: no textEditorElement');
			return;
		}

		if (textEditor) {
			console.log('[WhiteboardEditor] initTextEditor: destroying existing editor');
			textEditor.destroy();
		}

		console.log('[WhiteboardEditor] initTextEditor: creating new TipTap editor');

		textEditor = new Editor({
			element: textEditorElement,
			editable: true,
			extensions: [
				StarterKit,
				Table.configure({ resizable: true }),
				TableRow, TableHeader, TableCell,
				Image.configure({
					HTMLAttributes: { class: 'editor-image' },
					inline: true,
					allowBase64: true,
				}),
				TextAlign.configure({ types: ['heading', 'paragraph'] }),
				TextStyle, Color,
			],
			content: note?.content || '',
			onUpdate: ({ editor }) => {
				// Only log occasionally to reduce console spam
				updateCount++;
				if (updateCount % 10 === 0) console.log('[WhiteboardEditor] onUpdate triggered (sample)');

				const html = editor.getHTML();
				note.content = html;
				onContentChange?.(html);
				checkTableState();
			},
			onSelectionUpdate: () => {
				// Only log occasionally to reduce console spam
				selectionCount++;
				if (selectionCount % 5 === 0) console.log('[WhiteboardEditor] onSelectionUpdate triggered (sample)');

				checkTableState();
				onSelectionUpdate?.();
			},
			editorProps: {
				attributes: {
					class: `editor-content ${$isDarkTheme ? 'dark' : 'light'}`,
				},
			},
		});

		checkTableState();
		console.log('[WhiteboardEditor] initTextEditor: editor initialized successfully');
		onReady?.();
		// Provide reference to parent for data access during mode switches
		onEditorRef?.({ paths });
	}

	// Whiteboard data management
	function loadWhiteboardData() {
		// Check if this note should have empty whiteboard
		const hasValidData = note?.whiteboardData && (
			(typeof note.whiteboardData === 'string' && note.whiteboardData.trim()) ||
			(typeof note.whiteboardData === 'object' && note.whiteboardData.paths && note.whiteboardData.paths.length > 0)
		);

		console.log('[WhiteboardEditor] Loading data:', {
			noteId: note?.id,
			hasValidData,
			dataType: typeof note?.whiteboardData,
			created: note?.created
		});

		// In managed mode, we control the whiteboard state via props
		// No need to call resetCanvas - just set paths and let reactive props handle it

		// If no valid whiteboard data, use empty whiteboard
		if (!hasValidData) {
			console.log('[WhiteboardEditor] Using empty whiteboard - no valid data');
			paths = [];
			// Don't call updatePaths - let reactive props handle the update
			return;
		}

		try {
			const data = typeof note.whiteboardData === 'string'
				? JSON.parse(note.whiteboardData)
				: note.whiteboardData;
			paths = data.paths || [];
			console.log('[WhiteboardEditor] Loaded existing data, paths:', paths.length);
			// Don't call updatePaths - let reactive props handle the update
		} catch (error) {
			console.error('[WhiteboardEditor] Error loading whiteboard data:', error);
			paths = [];
			// Don't call updatePaths - let reactive props handle the update
		}
	}

	function saveWhiteboardData() {
		if (!note) return;

		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
		}

		autoSaveTimer = setTimeout(async () => {
			if (note) {
				note.whiteboardData = JSON.stringify({ paths });
				onContentChange?.(note.whiteboardData);
			}
		}, 2000);
	}

	// Reactive statements - stabilized to prevent re-initialization during typing
	let editorInitialized = false;
	$: if (textEditorElement && note && !editorInitialized) {
		console.log('[WhiteboardEditor] reactive: initializing editor once');
		initTextEditor();
		editorInitialized = true;
	}

	// Reset initialization flag when note changes
	let lastNoteId = note?.id;
	$: if (note?.id !== lastNoteId) {
		console.log('[WhiteboardEditor] reactive: note changed, resetting initialization flag');
		editorInitialized = false;
		lastNoteId = note?.id;
	}

	// Load whiteboard data when note changes - handled by reactive statement above

	// Load whiteboard data when note changes
	$: if (note && lastNoteId !== note.id) {
		console.log('[WhiteboardEditor] Note changed, loading whiteboard data for note:', note.id);
		loadWhiteboardData();
		lastNoteId = note.id;
	}

	$: if (whiteboardComponent && whiteboardTool) {
		whiteboardComponent.setTool(whiteboardTool);
	}

	$: if (whiteboardComponent && whiteboardColor) {
		whiteboardComponent.setColor(whiteboardColor);
	}

	$: if (whiteboardComponent && whiteboardLineWidth) {
		whiteboardComponent.setLineWidth(whiteboardLineWidth);
	}

	// Update editor theme when it changes
	$: if (textEditor && textEditor.view && textEditorElement) {
		// Get the ProseMirror editor DOM element
		const editorDOM = textEditor.view.dom;
		if (editorDOM) {
			// Remove old theme classes
			editorDOM.classList.remove('dark', 'light');
			// Add new theme class
			editorDOM.classList.add($isDarkTheme ? 'dark' : 'light');
			
			// Also update any nested .editor-content elements as fallback
			const editorContent = textEditorElement.querySelector('.editor-content');
			if (editorContent && editorContent !== editorDOM) {
				editorContent.classList.remove('dark', 'light');
				editorContent.classList.add($isDarkTheme ? 'dark' : 'light');
			}
		}
	}

	// Cleanup
	function handleClickOutside(event) {
		// Chiudi il color picker se si clicca fuori
		if (showColorPicker && colorPickerElement && 
		    !colorPickerElement.contains(event.target) &&
		    !event.target.closest('.color-picker-btn') && 
		    !event.target.closest('.color-picker-container')) {
			showColorPicker = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		if (textEditor) {
			textEditor.destroy();
		}
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
		}
		document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="whiteboard-editor-container">
	<div class="whiteboard-layout">
		<!-- Text Editor Section -->
		<div class="editor-section">
			<div class="editor-wrapper">
				<div bind:this={textEditorElement} class="editor whiteboard-text-area"></div>
			</div>

			<!-- Fixed Bottom Toolbar -->
			<div class="text-editor-toolbar-container">
				<div class="text-editor-toolbar-content">
					<!-- Text formatting -->
					<button class="toolbar-btn" class:active={isActive('bold')} on:click={toggleBold} title="Bold">
						<Icon name="bold" size={16} />
					</button>
					<button class="toolbar-btn" class:active={isActive('italic')} on:click={toggleItalic} title="Italic">
						<Icon name="italic" size={16} />
					</button>
					<button class="toolbar-btn" class:active={isActive('strike')} on:click={toggleStrike} title="Strikethrough">
						<Icon name="strikethrough" size={16} />
					</button>
					<button class="toolbar-btn" class:active={isActive('code')} on:click={toggleCode} title="Code">
						<Icon name="code" size={16} />
					</button>

					<div class="toolbar-separator"></div>

					<!-- Headings -->
					<button class="toolbar-btn" class:active={isActive('heading', { level: 1 })} on:click={() => setHeading(1)} title="Heading 1">H1</button>
					<button class="toolbar-btn" class:active={isActive('heading', { level: 2 })} on:click={() => setHeading(2)} title="Heading 2">H2</button>
					<button class="toolbar-btn" class:active={isActive('heading', { level: 3 })} on:click={() => setHeading(3)} title="Heading 3">H3</button>

					<div class="toolbar-separator"></div>

					<!-- Lists -->
					<button class="toolbar-btn" class:active={isActive('bulletList')} on:click={toggleBulletList} title="Bullet List">
						<Icon name="list" size={16} />
					</button>
					<button class="toolbar-btn" class:active={isActive('orderedList')} on:click={toggleOrderedList} title="Numbered List">
						<Icon name="list-ordered" size={16} />
					</button>
					<button class="toolbar-btn" class:active={isActive('blockquote')} on:click={toggleBlockquote} title="Quote">
						<Icon name="quote" size={16} />
					</button>

					<div class="toolbar-separator"></div>

					<!-- Links and Images -->
					<button class="toolbar-btn" class:active={isActive('link')} on:click={setLink} title="Insert Link">
						<Icon name="link" size={16} />
					</button>
					<button class="toolbar-btn" on:click={addImage} title="Insert Image">
						<Icon name="image" size={16} />
					</button>

					<div class="toolbar-separator"></div>

					<!-- Tables -->
					<button class="toolbar-btn" on:click={addTable} title="Insert Table">
						<Icon name="table" size={16} />
					</button>
					{#if isInTableState}
						<button class="toolbar-btn" on:click={deleteTable} title="Delete Table">
							<Icon name="trash" size={16} />
						</button>
					{/if}

					<div class="toolbar-separator"></div>

					<!-- Text alignment -->
					<button class="toolbar-btn" class:active={isActive({ textAlign: 'left' })} on:click={() => setTextAlign('left')} title="Align Left">
						<Icon name="align-left" size={16} />
					</button>
					<button class="toolbar-btn" class:active={isActive({ textAlign: 'center' })} on:click={() => setTextAlign('center')} title="Align Center">
						<Icon name="align-center" size={16} />
					</button>
					<button class="toolbar-btn" class:active={isActive({ textAlign: 'right' })} on:click={() => setTextAlign('right')} title="Align Right">
						<Icon name="align-right" size={16} />
					</button>

					<div class="toolbar-separator"></div>

					<!-- Colors -->
					<div class="color-picker-container">
						<button class="toolbar-btn color-picker-btn" on:click={toggleColorPicker} on:mousedown|stopPropagation title="Text Color">
							<div class="color-indicator" style="background-color: {getCurrentColor() || '#000000'}"></div>
						</button>

						{#if showColorPicker}
							<div class="color-picker-dropdown color-picker-dropdown-bottom" bind:this={colorPickerElement} on:mousedown|stopPropagation>
								<div class="color-palette">
									{#each colorPalette as color}
										<button
											class="color-option"
											style="background-color: {color}"
											on:click={(e) => applyColor(color, e)}
											on:mousedown|stopPropagation
											title={color}
										></button>
									{/each}
								</div>
								<div class="color-controls">
									<input
										type="color"
										bind:value={customColor}
										class="custom-color-input"
										title="Custom color"
									/>
									<button class="color-reset-btn" on:click={resetColor} on:mousedown|stopPropagation title="Reset color">×</button>
									<button class="toolbar-btn" on:click={applyCustomColor} on:mousedown|stopPropagation title="Apply custom color">
										<Icon name="check" size={14} />
									</button>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Whiteboard Section -->
		<div class="whiteboard-section">
			<div class="whiteboard-toolbar-container">
				<div class="whiteboard-toolbar-content">
					<!-- Whiteboard Tools -->
					<button
						class="toolbar-btn"
						class:active={whiteboardTool === 'pen'}
						on:click={() => { whiteboardTool = 'pen'; }}
						title="Pen"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 19l7-7 3 3-7 7-3-3z"></path>
							<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
							<path d="M2 2l7.586 7.586"></path>
							<circle cx="11" cy="11" r="2"></circle>
						</svg>
					</button>
					<button
						class="toolbar-btn"
						class:active={whiteboardTool === 'eraser'}
						on:click={() => { whiteboardTool = 'eraser'; }}
						title="Eraser"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
							<path d="M18 8l-6 6"></path>
							<path d="M12 8l-6 6"></path>
						</svg>
					</button>
					<button
						class="toolbar-btn"
						class:active={whiteboardTool === 'pan'}
						on:click={() => { whiteboardTool = 'pan'; }}
						title="Pan (or hold Space)"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M5.5 8.5 9 12l-3.5 3.5L2 12l3.5-3.5Z"></path>
							<path d="m12 2 3.5 3.5L12 9 8.5 5.5 12 2Z"></path>
							<path d="M18.5 8.5 22 12l-3.5 3.5L15 12l3.5-3.5Z"></path>
							<path d="m12 15 3.5 3.5L12 22l-3.5-3.5L12 15Z"></path>
						</svg>
					</button>

					<div class="toolbar-separator"></div>

					<!-- Zoom Controls -->
					<button
						class="toolbar-btn"
						on:click={() => { whiteboardComponent?.zoomIn(); }}
						title="Zoom In"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="11" cy="11" r="8"></circle>
							<path d="m21 21-4.35-4.35"></path>
							<line x1="11" y1="8" x2="11" y2="14"></line>
							<line x1="8" y1="11" x2="14" y2="11"></line>
						</svg>
					</button>
					<button
						class="toolbar-btn"
						on:click={() => { whiteboardComponent?.zoomOut(); }}
						title="Zoom Out"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="11" cy="11" r="8"></circle>
							<path d="m21 21-4.35-4.35"></path>
							<line x1="8" y1="11" x2="14" y2="11"></line>
						</svg>
					</button>
					<button
						class="toolbar-btn"
						on:click={() => { whiteboardComponent?.resetView(); }}
						title="Reset View"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
							<path d="M21 3v5h-5"></path>
							<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
							<path d="M3 21v-5h5"></path>
						</svg>
					</button>

					<div class="toolbar-separator"></div>

					<!-- Whiteboard Color -->
					<input
						type="color"
						bind:value={whiteboardColor}
						class="whiteboard-color-input"
						title="Whiteboard Color"
					/>

					<!-- Whiteboard Line Width -->
					<div class="whiteboard-width-control">
						<input
							type="range"
							min="1"
							max="20"
							bind:value={whiteboardLineWidth}
							class="whiteboard-width-input"
							title="Line Width"
						/>
						<span class="whiteboard-width-label">{whiteboardLineWidth}px</span>
					</div>

					<div class="toolbar-separator"></div>

					<!-- Clear Whiteboard -->
					<button
						class="toolbar-btn"
						on:click={() => {
							if (whiteboardComponent && confirm('Clear the entire whiteboard?')) {
								whiteboardComponent.clearCanvas();
							}
						}}
						title="Clear Whiteboard"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 6h18"></path>
							<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
							<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
						</svg>
					</button>
				</div>
			</div>

			<Whiteboard
				bind:this={whiteboardComponent}
				bind:currentTool={whiteboardTool}
				bind:currentColor={whiteboardColor}
				bind:lineWidth={whiteboardLineWidth}
				isActive={true}
				paths={paths}
				onPathAdd={handlePathAdd}
			/>
		</div>
	</div>

	<!-- Link Modal -->
	{#if showLinkModal}
		<LinkModal
			url={linkUrl}
			on:confirm={handleLinkConfirm}
			on:close={handleLinkClose}
		/>
	{/if}

	<!-- Image Modal -->
	{#if showImageModal}
		<ImageModal
			url={imageUrl}
			file={imageFile}
			on:confirm={handleImageConfirm}
			on:fileSelected={handleImageFileSelected}
			on:close={handleImageClose}
		/>
	{/if}
</div>

<style>
	.whiteboard-editor-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		overflow: hidden;
		position: relative;
	}

	.whiteboard-layout {
		display: flex;
		flex-direction: row;
		height: 100%;
		width: 100%;
		gap: 1px;
		background: var(--border-color);
		flex: 1;
		overflow: hidden;
	}

	.editor-section {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
		overflow: hidden;
		min-height: 0;
		position: relative;
	}

	.editor-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: auto;
		padding-bottom: 5rem;
		position: relative;
	}

	/* Fixed Bottom Toolbar */
	.text-editor-toolbar-container {
		position: absolute;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 100;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		padding: 0.5rem;
	}

	.text-editor-toolbar-content {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.25rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.whiteboard-text-area {
		height: 100%;
		font-size: 16px;
		line-height: 1.6;
	}

	.whiteboard-section {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
		overflow: hidden;
		position: relative;
	}

	.whiteboard-toolbar-container {
		position: absolute;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		padding: 0.5rem;
	}

	.whiteboard-toolbar-content {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}

	.whiteboard-color-input {
		width: 32px;
		height: 32px;
		min-width: 32px;
		min-height: 32px;
		max-width: 32px;
		max-height: 32px;
		aspect-ratio: 1;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		cursor: pointer;
		padding: 0;
		margin: 0;
		background: transparent;
		box-sizing: border-box;
		flex-shrink: 0;
		-webkit-appearance: none;
		appearance: none;
	}

	.whiteboard-color-input::-webkit-color-swatch-wrapper {
		padding: 0;
		border: none;
		border-radius: var(--radius-sm);
	}

	.whiteboard-color-input::-webkit-color-swatch {
		border: none;
		border-radius: var(--radius-sm);
	}

	.whiteboard-width-control {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
	}

	.whiteboard-width-input {
		width: 80px;
	}

	.whiteboard-width-label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		text-align: center;
	}

	.toolbar-btn {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.375rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		height: 32px;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.toolbar-btn:hover {
		background: var(--bg-tertiary);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	.toolbar-btn.active {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.toolbar-separator {
		width: 1px;
		height: 24px;
		background: var(--border-color);
		margin: 0 0.25rem;
	}

	.editor {
		height: 100%;
		font-size: 16px;
		line-height: 1.6;
	}

	:global(.editor-content) {
		padding: 1.5rem;
		max-width: 800px;
		margin: 0 auto;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
		line-height: 1.6;
		outline: none;
	}

	:global(.editor-content.dark) {
		color: var(--text-primary);
		background: var(--bg-primary);
	}

	:global(.editor-content.light) {
		color: #000;
		background: #fff;
	}


	.toolbar-btn {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.375rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		height: 32px;
		font-size: 0.85rem;
		font-weight: 500;
		flex-shrink: 0;
	}

	.toolbar-btn:hover {
		background: var(--bg-tertiary);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	.toolbar-btn:active {
		transform: scale(0.95);
	}

	.toolbar-btn.active {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.toolbar-separator {
		width: 1px;
		height: 24px;
		background: var(--border-color);
		margin: 0 0.25rem;
		flex-shrink: 0;
	}

	/* Color Picker Styles */
	.color-picker-container {
		position: relative;
	}

	.color-picker-btn {
		padding: 0.25rem;
		min-width: 32px;
		height: 32px;
	}

	.color-indicator {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid var(--border-color);
		transition: var(--transition);
	}

	.	.color-picker-dropdown {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 0.75rem;
		box-shadow: var(--shadow-lg);
		z-index: 200;
		min-width: 200px;
	}

	.color-picker-dropdown-bottom {
		top: auto;
		bottom: calc(100% + 0.5rem);
	}

	.color-palette {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.color-option {
		width: 28px;
		height: 28px;
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: var(--transition);
		opacity: 0.8;
	}

	.color-option:hover {
		transform: scale(1.1);
		opacity: 1;
		border-color: var(--text-primary);
	}

	.color-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.custom-color-input {
		width: 40px;
		height: 32px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		cursor: pointer;
		background: transparent;
		flex-shrink: 0;
	}

	.custom-color-input::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	.custom-color-input::-webkit-color-swatch {
		border: none;
		border-radius: var(--radius-sm);
	}

	.color-reset-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		font-size: 1.2rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		height: 24px;
	}

	.color-reset-btn:hover {
		background: var(--bg-tertiary);
		color: var(--error-color);
	}

	/* Modal Styles */
	:global(.modal-overlay) {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	:global(.modal-content) {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		box-shadow: var(--shadow-xl);
		max-width: 500px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}

	:global(.modal-header) {
		padding: 1.5rem 1.5rem 1rem 1.5rem;
		border-bottom: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	:global(.modal-title) {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	:global(.modal-close-btn) {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.modal-close-btn:hover) {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	:global(.modal-body) {
		padding: 1.5rem;
	}

	:global(.modal-footer) {
		padding: 1rem 1.5rem 1.5rem 1.5rem;
		border-top: 1px solid var(--border-color);
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	:global(.modal-input) {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 1rem;
		font-family: inherit;
		outline: none;
		transition: var(--transition);
	}

	:global(.modal-input:focus) {
		border-color: var(--accent-color);
		box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb), 0.2);
	}

	:global(.modal-btn) {
		padding: 0.75rem 1.5rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		background: var(--bg-secondary);
		color: var(--text-primary);
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: var(--transition);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	:global(.modal-btn:hover) {
		background: var(--bg-tertiary);
		border-color: var(--border-hover);
	}

	:global(.modal-btn.primary) {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	:global(.modal-btn.primary:hover) {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	:global(.modal-btn:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(.file-input-container) {
		margin-top: 1rem;
	}

	:global(.file-input) {
		display: none;
	}

	:global(.file-input-btn) {
		padding: 0.75rem 1.5rem;
		border: 2px dashed var(--border-color);
		border-radius: var(--radius);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		cursor: pointer;
		transition: var(--transition);
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		width: 100%;
		justify-content: center;
	}

	:global(.file-input-btn:hover) {
		border-color: var(--accent-color);
		color: var(--accent-color);
		background: var(--bg-tertiary);
	}

	:global(.image-preview) {
		margin-top: 1rem;
		text-align: center;
	}

	:global(.image-preview img) {
		max-width: 100%;
		max-height: 200px;
		border-radius: var(--radius);
		box-shadow: var(--shadow);
	}
</style>
