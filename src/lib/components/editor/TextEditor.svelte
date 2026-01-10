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
	import Icon from '../Icon.svelte';
	import LinkModal from './LinkModal.svelte';
	import ImageModal from './ImageModal.svelte';

	// Props
	export let note;
	export let onContentChange;
	export let onSelectionUpdate;
	export let onReady;
	export let onEditorRef = null;

	// Element refs
	let editorElement;
	let editor;

	// State
	let isInTableState = false;
	let showBubbleMenu = false;
	let bubbleMenuPosition = { top: 0, left: 0 };
	let bubbleMenuElement;

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




	// Toolbar functions
	function toggleBold() { editor?.chain().focus().toggleBold().run(); }
	function toggleItalic() { editor?.chain().focus().toggleItalic().run(); }
	function toggleStrike() { editor?.chain().focus().toggleStrike().run(); }
	function toggleCode() { editor?.chain().focus().toggleCode().run(); }
	function setHeading(level) { editor?.chain().focus().toggleHeading({ level }).run(); }
	function toggleBulletList() { editor?.chain().focus().toggleBulletList().run(); }
	function toggleOrderedList() { editor?.chain().focus().toggleOrderedList().run(); }
	function toggleBlockquote() { editor?.chain().focus().toggleBlockquote().run(); }
	function setLink() {
		const isActive = editor?.isActive('link');
		if (isActive) {
			editor?.chain().focus().unsetLink().run();
		} else {
			linkUrl = editor?.getAttributes('link')?.href || '';
			showLinkModal = true;
			showBubbleMenu = false; // Chiudi il bubble menu quando apri il modale
		}
	}

	function handleLinkConfirm(event) {
		const { url } = event.detail;
		if (url) {
			editor?.chain().focus().setLink({ href: url }).run();
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
		showBubbleMenu = false; // Chiudi il bubble menu quando apri il modale
	}

	async function handleImageConfirm(event) {
		const { url } = event.detail;
		if (url) {
			try {
				editor?.chain().focus().setImage({ src: url }).run();
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
	function addTable() { editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }
	function deleteTable() { editor?.chain().focus().deleteTable().run(); }
	function setTextAlign(alignment) { editor?.chain().focus().setTextAlign(alignment).run(); }
	function setColor(color) { editor?.chain().focus().setColor(color).run(); }
	function toggleColorPicker() {
		showColorPicker = !showColorPicker;
		if (showColorPicker) {
			showBubbleMenu = false; // Chiudi il bubble menu quando apri il color picker
		}
	}
	function applyColor(color) { setColor(color); customColor = color; showColorPicker = false; }
	function applyCustomColor() { setColor(customColor); }
	function resetColor() { editor?.chain().focus().unsetColor().run(); showColorPicker = false; }

	function getCurrentColor() {
		if (!editor) return null;
		for (const color of colorPalette) {
			if (editor.isActive('textStyle', { color })) return color;
		}
		return editor.getAttributes('textStyle')?.color || null;
	}

	function isActive(type, options = {}) {
		return editor?.isActive(type, options) || false;
	}

	// Bubble menu
	function updateBubbleMenu() {
		if (!editor || !editorElement) {
			showBubbleMenu = false;
			return;
		}

		const { state } = editor;
		const { selection } = state;
		const { from, to } = selection;

		if (from !== to && !selection.empty) {
			const { view } = editor;
			const start = view.coordsAtPos(from);
			const end = view.coordsAtPos(to);

			const rect = editorElement.getBoundingClientRect();
			const middleX = (start.left + end.left) / 2;

			const spacing = 8;
			let menuHeight = bubbleMenuElement?.offsetHeight || 50;
			let menuWidth = bubbleMenuElement?.offsetWidth || 400;

			let left = middleX - rect.left;
			let top = start.top - rect.top - menuHeight - spacing;

			const halfMenuWidth = menuWidth / 2;
			const padding = 10;
			const minLeft = halfMenuWidth + padding;
			const maxLeft = rect.width - halfMenuWidth - padding;

			left = Math.max(minLeft, Math.min(maxLeft, left));

			if (top < padding) {
				top = start.top - rect.top + 24 + spacing;
			}

			bubbleMenuPosition = { top, left };
			showBubbleMenu = true;
		} else {
			showBubbleMenu = false;
		}
	}

	function checkTableState() {
		if (!editor) {
			isInTableState = false;
			return;
		}

		const { state } = editor;
		const { selection } = state;
		const { $from } = selection;

		let inTable = false;
		for (let depth = $from.depth; depth > 0; depth--) {
			const node = $from.node(depth);
			if (node.type.name === 'table') {
				inTable = true;
				break;
			}
		}

		isInTableState = inTable;
	}

	// Initialize editor
	function initEditor() {
		if (!editorElement) return;

		if (editor) {
			editor.destroy();
		}

		editor = new Editor({
			element: editorElement,
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
				const html = editor.getHTML();
				note.content = html;
				onContentChange?.(html);
				checkTableState();
			},
			onSelectionUpdate: () => {
				checkTableState();
				updateBubbleMenu();
				onSelectionUpdate?.();
			},
			editorProps: {
				attributes: {
					class: `editor-content ${$isDarkTheme ? 'dark' : 'light'}`,
				},
			},
		});

		checkTableState();
		updateBubbleMenu();
		onReady?.();
		onEditorRef?.(editor);
	}

	// Reactive statements
	$: if (editorElement && note && !editor) {
		initEditor();
	}

	// Update editor content when note changes externally
	let lastNoteId = note?.id;
	$: if (editor && note && lastNoteId !== note.id) {
		editor.commands.setContent(note.content || '');
		lastNoteId = note.id;
	}

	$: if (editor && !$isDarkTheme !== (editor.getAttributes('editorProps')?.attributes?.class?.includes('dark'))) {
		// Theme changed - update editor
		const attrs = editor.getAttributes('editorProps');
		if (attrs?.attributes) {
			attrs.attributes.class = `editor-content ${$isDarkTheme ? 'dark' : 'light'}`;
		}
	}

	// Cleanup
	function handleClickOutside(event) {
		if (showColorPicker && colorPickerElement && !colorPickerElement.contains(event.target) &&
		    !event.target.closest('.color-picker-btn') && !event.target.closest('.color-picker-container')) {
			showColorPicker = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		// Save editor content immediately before destruction
		if (editor && note) {
			const html = editor.getHTML();
			note.content = html;
			// Force immediate save
			import('../../stores/notesStore.js').then(({ saveCurrentNote }) => {
				saveCurrentNote();
			});
		}

		if (editor) {
			editor.destroy();
		}
		document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="text-editor-container">
	<!-- Editor -->
	<div bind:this={editorElement} class="editor"></div>

	<!-- Bubble Menu -->
	{#if showBubbleMenu}
		<div
			class="bubble-menu"
			bind:this={bubbleMenuElement}
			style="top: {bubbleMenuPosition.top}px; left: {bubbleMenuPosition.left}px; transform: translateX(-50%);"
		>
			<div class="toolbar-content">
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
					<button class="toolbar-btn color-picker-btn" on:click={toggleColorPicker} title="Text Color">
						<div class="color-indicator" style="background-color: {getCurrentColor() || '#000000'}"></div>
					</button>

					{#if showColorPicker}
						<div class="color-picker-dropdown" bind:this={colorPickerElement}>
							<div class="color-palette">
								{#each colorPalette as color}
									<button
										class="color-option"
										style="background-color: {color}"
										on:click={() => applyColor(color)}
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
								<button class="color-reset-btn" on:click={resetColor} title="Reset color">×</button>
								<button class="toolbar-btn" on:click={applyCustomColor} title="Apply custom color">
									<Icon name="check" size={14} />
								</button>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Link Modal -->
<LinkModal
	bind:showModal={showLinkModal}
	bind:url={linkUrl}
	on:confirm={handleLinkConfirm}
	on:close={handleLinkClose}
/>

<!-- Image Modal -->
<ImageModal
	bind:showModal={showImageModal}
	bind:url={imageUrl}
	bind:file={imageFile}
	on:confirm={handleImageConfirm}
	on:fileSelected={handleImageFileSelected}
	on:close={handleImageClose}
/>

<style>
	.text-editor-container {
		display: flex;
		flex-direction: column;
		height: 100%;
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

	.color-picker-container {
		position: relative;
		display: inline-block;
	}

	.color-picker-btn {
		position: relative;
		padding: 0.375rem 0.5rem !important;
		gap: 0.375rem !important;
	}

	.color-indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.color-picker-dropdown {
		position: absolute;
		bottom: calc(100% + 0.5rem);
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		padding: 0.75rem;
		min-width: 200px;
		z-index: 1000;
	}

	.color-palette {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.375rem;
		margin-bottom: 0.75rem;
	}

	.color-option {
		width: 24px;
		height: 24px;
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: var(--transition);
	}

	.color-option:hover {
		border-color: var(--text-primary);
		transform: scale(1.1);
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
		background: var(--bg-primary);
		cursor: pointer;
		flex-shrink: 0;
	}

	.custom-color-input::-webkit-color-swatch-wrapper {
		padding: 2px;
	}

	.custom-color-input::-webkit-color-swatch {
		border: none;
		border-radius: var(--radius-sm);
	}

	.color-reset-btn {
		background: var(--error-color);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		width: 32px;
		height: 32px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: var(--transition);
		flex-shrink: 0;
	}

	.color-reset-btn:hover {
		background: #dc2626;
		transform: scale(1.05);
	}

	.editor {
		flex: 1;
		font-size: 16px;
		line-height: 1.6;
		padding-bottom: 4rem;
		position: relative;
	}

	.bubble-menu {
		position: absolute;
		z-index: 1000;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		padding: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		pointer-events: auto;
		animation: fadeInSlideUp 0.15s ease-out;
	}

	.bubble-menu .toolbar-content {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-wrap: nowrap;
	}

	@keyframes fadeInSlideUp {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	/* Editor content styles */
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

	:global(.editor-content h1),
	:global(.editor-content h2),
	:global(.editor-content h3),
	:global(.editor-content h4),
	:global(.editor-content h5),
	:global(.editor-content h6) {
		margin: 1.5rem 0 0.5rem 0;
		font-weight: 600;
		line-height: 1.2;
	}

	:global(.editor-content p) {
		margin: 0 0 1rem 0;
	}

	:global(.editor-content ul),
	:global(.editor-content ol) {
		margin: 0 0 1rem 0;
		padding-left: 2rem;
	}

	:global(.editor-content blockquote) {
		border-left: 4px solid var(--accent-color);
		padding-left: 1rem;
		margin: 1rem 0;
		font-style: italic;
		background: var(--accent-light);
		color: var(--text-primary);
	}

	:global(.editor-content code) {
		background: var(--bg-tertiary);
		padding: 0.125rem 0.25rem;
		border-radius: 3px;
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
		font-size: 0.9em;
	}

	:global(.editor-content pre) {
		background: var(--bg-tertiary);
		padding: 1rem;
		border-radius: var(--radius);
		overflow-x: auto;
		border: 1px solid var(--border-color);
		margin: 1rem 0;
	}

	:global(.editor-image) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-sm);
		margin: 1rem 0;
		border: 1px solid var(--border-color);
	}

	:global(.editor-link) {
		color: var(--accent-color);
		text-decoration: none;
	}

	:global(.editor-link:hover) {
		text-decoration: underline;
	}

	/* Table styles */
	:global(.editor-content table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1rem 0;
		font-size: 0.9rem;
		border: 1px solid var(--border-color);
	}

	:global(.editor-content th),
	:global(.editor-content td) {
		border: 1px solid var(--border-color);
		padding: 0.5rem 0.75rem;
		text-align: left;
		min-width: 80px;
	}

	:global(.editor-content th) {
		background: var(--bg-tertiary);
		font-weight: 600;
	}

	:global(.editor-content tr:nth-child(even)) {
		background: var(--bg-secondary);
	}

	:global(.editor-content tr:hover) {
		background: var(--bg-tertiary);
	}

	/* Selection styles */
	:global(.editor-content ::selection) {
		background: var(--accent-light);
	}

	:global(.ProseMirror) {
		outline: none;
	}

	:global(.ProseMirror-focused) {
		outline: none;
	}

	/* Table controls */
	:global(.ProseMirror .tableWrapper) {
		overflow-x: auto;
	}

	:global(.ProseMirror table) {
		margin: 0;
	}

	:global(.ProseMirror th),
	:global(.ProseMirror td) {
		position: relative;
	}

	:global(.ProseMirror .column-resize-handle) {
		position: absolute;
		right: -2px;
		top: 0;
		bottom: 0;
		width: 4px;
		background: var(--accent-color);
		cursor: col-resize;
		opacity: 0;
		transition: opacity 0.1s;
	}

	:global(.ProseMirror .column-resize-handle:hover),
	:global(.ProseMirror .column-resize-handle.active) {
		opacity: 1;
	}
</style>
