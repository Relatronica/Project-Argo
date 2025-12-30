<script>
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { Table } from '@tiptap/extension-table';
	import { TableRow } from '@tiptap/extension-table-row';
	import { TableHeader } from '@tiptap/extension-table-header';
	import { TableCell } from '@tiptap/extension-table-cell';
	import { Image } from '@tiptap/extension-image';
	import { Link } from '@tiptap/extension-link';
	import { TextAlign } from '@tiptap/extension-text-align';
	import { TextStyle } from '@tiptap/extension-text-style';
	import { Color } from '@tiptap/extension-color';
	import { currentNote, saveCurrentNote, saveStatus, updateNoteTitle } from '../stores/notesStore.js';
	import { isDarkTheme } from '../stores/themeStore.js';
import { marked } from 'marked';
import TurndownService from 'turndown';
	import Icon from './Icon.svelte';
	import Whiteboard from './Whiteboard.svelte';
	
	// Whiteboard state
	let whiteboardComponent;
	let whiteboardTool = 'pen';
	let whiteboardColor = '#000000';
	let whiteboardLineWidth = 2;

	let editorElement;
	let editorWrapperElement;
	let lastNoteId = null;
	let lastMode = null;
	let editor;

	// Color picker state
	let showColorPicker = false;
	let colorPickerElement;
	let customColor = '#000000';

	// Link/Image modal state
	let showLinkModal = false;
	let showImageModal = false;
	let linkUrl = '';
	let imageUrl = '';
	let linkModalElement;
	let imageModalElement;

	// Table detection state
	let isInTableState = false;

	// Bubble menu state
	let showBubbleMenu = false;
	let bubbleMenuPosition = { top: 0, left: 0 };
	let bubbleMenuElement;

	// Title editing state
	let editingTitle = false;
	let titleInput = '';
	let titleInputElement;

	// Color palette
	const colorPalette = [
		'#000000', // Black
		'#374151', // Gray-700
		'#DC2626', // Red-600
		'#EA580C', // Orange-600
		'#CA8A04', // Yellow-600
		'#16A34A', // Green-600
		'#0891B2', // Cyan-600
		'#2563EB', // Blue-600
		'#7C3AED', // Violet-600
		'#BE185D', // Pink-600
		'#92400E', // Amber-700
		'#365314', // Lime-700
	];

	// Auto-save timer
	let autoSaveTimer = null;

	function initEditor() {
		if (!editorElement) return;

		// Destroy existing editor
		if (editor) {
			editor.destroy();
		}

		// Create new editor with Tiptap
		editor = new Editor({
			element: editorElement,
			extensions: [
				StarterKit,
				Table.configure({
					resizable: true,
				}),
				TableRow,
				TableHeader,
				TableCell,
				Image.configure({
					HTMLAttributes: {
						class: 'editor-image',
					},
				}),
				Link.configure({
					openOnClick: false,
					HTMLAttributes: {
						class: 'editor-link',
					},
				}),
				TextAlign.configure({
					types: ['heading', 'paragraph'],
				}),
				TextStyle,
				Color,
			],
			content: prepareContentForEditor($currentNote?.content),
			onUpdate: ({ editor }) => {
				// Update note content on change
				if ($currentNote) {
					const html = editor.getHTML();
					$currentNote.content = html;
					// Update metadata for real-time title updates in the list
					import('../stores/notesStore.js').then(({ updateCurrentNoteMetadata }) => {
						updateCurrentNoteMetadata();
					});
				}
				// Check table state after update
				checkTableState();
			},
			onSelectionUpdate: () => {
				// Update table state when selection changes
				checkTableState();
				// Update bubble menu visibility based on selection
				updateBubbleMenu();
			},
			editorProps: {
				attributes: {
					class: `editor-content ${$isDarkTheme ? 'dark' : 'light'}`,
				},
			},
		});

		// Initial table state check
		checkTableState();
		// Initial bubble menu update
		updateBubbleMenu();
	}

	// Title editing functions
	$: if ($currentNote && !editingTitle) {
		titleInput = $currentNote.title || '';
	}

	async function handleTitleBlur() {
		if ($currentNote && titleInput.trim() !== ($currentNote.title || '')) {
			await updateNoteTitle($currentNote.id, titleInput.trim());
			if ($currentNote) {
				titleInput = $currentNote.title || '';
			}
		}
		editingTitle = false;
	}

	function handleTitleKeydown(event) {
		if (event.key === 'Enter') {
			event.target.blur();
		} else if (event.key === 'Escape') {
			titleInput = $currentNote.title || '';
			editingTitle = false;
		}
	}

	$: if ($currentNote && editorElement) {
		// Ensure mode is set
		if (!$currentNote.mode) {
			$currentNote.mode = 'text';
		}
		
		const currentMode = $currentNote.mode;
		const noteChanged = lastNoteId !== $currentNote.id;
		const modeChanged = lastMode !== currentMode;
		
		// If note or mode changed, we need to reinitialize the editor
		if (noteChanged || modeChanged) {
			lastNoteId = $currentNote.id;
			lastMode = currentMode;
			
			if (editor) {
				// Destroy existing editor before creating new one
				editor.destroy();
				editor = null;
			}
			
			// Small delay to ensure DOM is ready
			setTimeout(() => {
				if (editorElement && $currentNote) {
					initEditor();
				}
			}, 0);
		} else if (editor) {
			// Just update content if note changed but mode didn't
			const preparedContent = prepareContentForEditor($currentNote.content);
			const currentContent = editor.getHTML();
			if (currentContent !== preparedContent) {
				editor.commands.setContent(preparedContent);
			}
		} else {
			// Initialize editor if it doesn't exist
			initEditor();
		}
	}

	// Auto-save when content changes
	$: if ($currentNote && editor) {
		// Clear existing timer
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
		}

		// Set new timer for auto-save (2 seconds after last change)
		autoSaveTimer = setTimeout(async () => {
			if ($currentNote) {
				const { saveCurrentNote } = await import('../stores/notesStore.js');
				await saveCurrentNote();
			}
		}, 2000);
	}

	let lastTheme = $isDarkTheme;
	$: if (editor && lastTheme !== $isDarkTheme) {
		// Theme changed - recreate editor
		lastTheme = $isDarkTheme;
		initEditor();
	}

	onMount(() => {
		if (editorElement) {
			initEditor();
		}
		// Add click outside listener for color picker
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
		}
		// Remove click outside listener
		document.removeEventListener('click', handleClickOutside);
	});

	// Toolbar functions
	function toggleBold() {
		editor?.chain().focus().toggleBold().run();
	}

	function toggleItalic() {
		editor?.chain().focus().toggleItalic().run();
	}

	function toggleStrike() {
		editor?.chain().focus().toggleStrike().run();
	}

	function toggleCode() {
		editor?.chain().focus().toggleCode().run();
	}

	function setHeading(level) {
		editor?.chain().focus().toggleHeading({ level }).run();
	}

	function toggleBulletList() {
		editor?.chain().focus().toggleBulletList().run();
	}

	function toggleOrderedList() {
		editor?.chain().focus().toggleOrderedList().run();
	}

	function toggleBlockquote() {
		editor?.chain().focus().toggleBlockquote().run();
	}

	function setLink() {
		if (isActive('link')) {
			unsetLink();
		} else {
			linkUrl = '';
			showLinkModal = true;
		}
	}

	function unsetLink() {
		if (!editor) return;
		editor.chain().focus().unsetLink().run();
	}

	function confirmLink() {
		if (linkUrl && linkUrl.trim()) {
			if (editor) {
				editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
			}
		}
		showLinkModal = false;
		linkUrl = '';
	}

	function cancelLink() {
		showLinkModal = false;
		linkUrl = '';
	}

	function addImage() {
		imageUrl = '';
		showImageModal = true;
	}

	function confirmImage() {
		if (imageUrl && imageUrl.trim()) {
			if (editor) {
				editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
			}
		}
		showImageModal = false;
		imageUrl = '';
	}

	function cancelImage() {
		showImageModal = false;
		imageUrl = '';
	}

	function addTable() {
		editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
	}

	function deleteTable() {
		editor?.chain().focus().deleteTable().run();
	}

	function setTextAlign(alignment) {
		editor?.chain().focus().setTextAlign(alignment).run();
	}

	function setColor(color) {
		editor?.chain().focus().setColor(color).run();
	}

	// Color picker functions
	function toggleColorPicker() {
		showColorPicker = !showColorPicker;
	}

	function applyColor(color) {
		setColor(color);
		customColor = color;
		showColorPicker = false;
	}

	function applyCustomColor() {
		setColor(customColor);
	}

	function resetColor() {
		editor?.chain().focus().unsetColor().run();
		showColorPicker = false;
	}

	function getCurrentColor() {
		if (!editor) return null;

		// Check if text color is active
		for (const color of colorPalette) {
			if (editor.isActive('textStyle', { color })) {
				return color;
			}
		}

		// Check for custom color
		const attrs = editor.getAttributes('textStyle');
		return attrs.color || null;
	}

	// Close color picker when clicking outside
	function handleClickOutside(event) {
		// Don't close if clicking on toolbar buttons
		if (event.target.closest('.toolbar-btn')) {
			return;
		}
		
		if (showColorPicker && colorPickerElement && 
		    !colorPickerElement.contains(event.target) &&
		    !event.target.closest('.color-picker-btn') &&
		    !event.target.closest('.color-picker-container')) {
			showColorPicker = false;
		}
		if (showLinkModal && linkModalElement && !linkModalElement.contains(event.target)) {
			cancelLink();
		}
		if (showImageModal && imageModalElement && !imageModalElement.contains(event.target)) {
			cancelImage();
		}
	}

	// Helper functions
	function isActive(type, options = {}) {
		return editor?.isActive(type, options) || false;
	}

	// Update bubble menu visibility and position
	function updateBubbleMenu() {
		if (!editor || !editorWrapperElement) {
			showBubbleMenu = false;
			return;
		}

		const { state } = editor;
		const { selection } = state;
		const { from, to } = selection;

		// Show bubble menu only if there's a text selection (not just a cursor)
		if (from !== to && !selection.empty) {
			// Get the DOM coordinates of the selection
			const { view } = editor;
			const start = view.coordsAtPos(from);
			const end = view.coordsAtPos(to);
			
			// Position the bubble menu above the selection
			const wrapperRect = editorWrapperElement.getBoundingClientRect();
			const middleX = (start.left + end.left) / 2;
			
			// Calculate position above the text line (approximately 50px above to account for menu height)
			const menuHeight = 50; // Approximate height of the bubble menu
			const spacing = 8; // Space between menu and text
			
			bubbleMenuPosition = {
				top: start.top - wrapperRect.top - menuHeight - spacing,
				left: middleX - wrapperRect.left
			};
			
			showBubbleMenu = true;
		} else {
			showBubbleMenu = false;
		}
	}

	// Check if cursor is inside a table and update state
	function checkTableState() {
		if (!editor) {
			isInTableState = false;
			return;
		}

		const { state } = editor;
		const { selection } = state;
		const { $from } = selection;

		// Check if any ancestor is a table
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

	// Content conversion functions
	function markdownToHtml(markdown) {
		try {
			// Configure marked for basic conversion
			marked.setOptions({
				breaks: true,
				gfm: true,
				headerIds: false,
				mangle: false
			});
			return marked.parse(markdown || '');
		} catch (error) {
			console.error('Markdown to HTML conversion error:', error);
			return markdown || '';
		}
	}

	function htmlToMarkdown(html) {
		try {
			const turndownService = new TurndownService({
				headingStyle: 'atx',
				codeBlockStyle: 'fenced',
				emDelimiter: '*',
				bulletListMarker: '-'
			});
			return turndownService.turndown(html || '');
		} catch (error) {
			console.error('HTML to Markdown conversion error:', error);
			return html || '';
		}
	}

	// Determine if content is HTML or markdown
	function isHtmlContent(content) {
		return content && typeof content === 'string' && content.trim().startsWith('<');
	}

	// Convert content to HTML for editor
	function prepareContentForEditor(content) {
		if (!content) return '';

		// If already HTML, return as is
		if (isHtmlContent(content)) {
			return content;
		}

		// Otherwise, convert markdown to HTML
		return markdownToHtml(content);
	}
</script>

<div class="editor-container">
	{#if $currentNote?.mode !== 'whiteboard'}
		<div class="editor-wrapper" bind:this={editorWrapperElement}>
			<!-- Note Title Field -->
			{#if $currentNote}
				<div class="editor-title-section">
					{#if editingTitle}
						<input
							type="text"
							class="editor-title-input"
							bind:this={titleInputElement}
							bind:value={titleInput}
							on:blur={handleTitleBlur}
							on:keydown={handleTitleKeydown}
							placeholder="Note title..."
							autofocus
						/>
					{:else}
						<h1 
							class="editor-title" 
							class:empty={!$currentNote.title}
							on:click={() => {
								editingTitle = true;
								titleInput = $currentNote.title || '';
							}}
							title="Click to edit title"
						>
							{$currentNote.title || 'Untitled Note'}
						</h1>
					{/if}
				</div>
			{/if}
			<div bind:this={editorElement} class="editor"></div>
			{#if $currentNote && editor && showBubbleMenu}
				<div 
					class="bubble-menu" 
					bind:this={bubbleMenuElement}
					style="top: {bubbleMenuPosition.top}px; left: {bubbleMenuPosition.left}px; transform: translateX(-50%);"
				>
					<div class="toolbar-content">
					<!-- Text formatting -->
					<button
						class="toolbar-btn"
						class:active={isActive('bold')}
						on:click={toggleBold}
						title="Bold"
					>
						<Icon name="bold" size={16} />
					</button>
					<button
						class="toolbar-btn"
						class:active={isActive('italic')}
						on:click={toggleItalic}
						title="Italic"
					>
						<Icon name="italic" size={16} />
					</button>
					<button
						class="toolbar-btn"
						class:active={isActive('strike')}
						on:click={toggleStrike}
						title="Strikethrough"
					>
						<Icon name="strikethrough" size={16} />
					</button>
					<button
						class="toolbar-btn"
						class:active={isActive('code')}
						on:click={toggleCode}
						title="Code"
					>
						<Icon name="code" size={16} />
					</button>

					<div class="toolbar-separator"></div>

					<!-- Headings -->
					<button
						class="toolbar-btn"
						class:active={isActive('heading', { level: 1 })}
						on:click={() => setHeading(1)}
						title="Heading 1"
					>
						H1
					</button>
					<button
						class="toolbar-btn"
						class:active={isActive('heading', { level: 2 })}
						on:click={() => setHeading(2)}
						title="Heading 2"
					>
						H2
					</button>
					<button
						class="toolbar-btn"
						class:active={isActive('heading', { level: 3 })}
						on:click={() => setHeading(3)}
						title="Heading 3"
					>
						H3
					</button>

					<div class="toolbar-separator"></div>

					<!-- Lists -->
					<button
						class="toolbar-btn"
						class:active={isActive('bulletList')}
						on:click={toggleBulletList}
						title="Bullet List"
					>
						<Icon name="list" size={16} />
					</button>
					<button
						class="toolbar-btn"
						class:active={isActive('orderedList')}
						on:click={toggleOrderedList}
						title="Numbered List"
					>
						<Icon name="list-ordered" size={16} />
					</button>
					<button
						class="toolbar-btn"
						class:active={isActive('blockquote')}
						on:click={toggleBlockquote}
						title="Quote"
					>
						<Icon name="quote" size={16} />
					</button>

					<div class="toolbar-separator"></div>

					<!-- Links -->
					<button
						class="toolbar-btn"
						class:active={isActive('link')}
						on:click|stopPropagation={setLink}
						title={isActive('link') ? 'Remove Link' : 'Insert Link'}
					>
						<Icon name="link" size={16} />
					</button>
				</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if $currentNote?.mode === 'whiteboard'}
		<div class="whiteboard-layout">
			<div class="editor-section">
				<div class="editor-wrapper">
					<!-- Note Title Field -->
					{#if $currentNote}
						<div class="editor-title-section">
							{#if editingTitle}
								<input
									type="text"
									class="editor-title-input"
									bind:this={titleInputElement}
									bind:value={titleInput}
									on:blur={handleTitleBlur}
									on:keydown={handleTitleKeydown}
									placeholder="Note title..."
									autofocus
								/>
							{:else}
								<h1 
									class="editor-title" 
									class:empty={!$currentNote.title}
									on:click={() => {
										editingTitle = true;
										titleInput = $currentNote.title || '';
									}}
									title="Click to edit title"
								>
									{$currentNote.title || 'Untitled Note'}
								</h1>
							{/if}
						</div>
					{/if}
					<div bind:this={editorElement} class="editor"></div>
				</div>
			</div>
			<div class="whiteboard-section">
				{#if $currentNote}
					<div class="whiteboard-toolbar-container">
						<div class="whiteboard-toolbar-content">
							<!-- Whiteboard Tools -->
							<button
								class="toolbar-btn"
								class:active={whiteboardTool === 'pen'}
								on:click={() => {
									whiteboardTool = 'pen';
									if (whiteboardComponent) whiteboardComponent.setTool('pen');
								}}
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
								on:click={() => {
									whiteboardTool = 'eraser';
									if (whiteboardComponent) whiteboardComponent.setTool('eraser');
								}}
								title="Eraser"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
									<path d="M18 8l-6 6"></path>
									<path d="M12 8l-6 6"></path>
								</svg>
							</button>
							
							<div class="toolbar-separator"></div>
							
							<!-- Whiteboard Color -->
							<input 
								type="color" 
								bind:value={whiteboardColor}
								on:change={() => {
									if (whiteboardComponent) whiteboardComponent.setColor(whiteboardColor);
								}}
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
									on:input={() => {
										if (whiteboardComponent) whiteboardComponent.setLineWidth(whiteboardLineWidth);
									}}
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
				{/if}
				<Whiteboard 
					bind:this={whiteboardComponent}
					bind:currentTool={whiteboardTool}
					bind:currentColor={whiteboardColor}
					bind:lineWidth={whiteboardLineWidth}
				/>
			</div>
		</div>
	{/if}
</div>

<!-- Link Modal -->
{#if showLinkModal}
	<div class="modal-overlay" on:click={cancelLink}>
		<div class="modal-content" bind:this={linkModalElement} on:click|stopPropagation>
			<h3>Insert Link</h3>
			<input
				type="text"
				class="modal-input"
				placeholder="Enter URL..."
				bind:value={linkUrl}
				on:keydown={(e) => {
					if (e.key === 'Enter') {
						confirmLink();
					} else if (e.key === 'Escape') {
						cancelLink();
					}
				}}
				autofocus
			/>
			<div class="modal-actions">
				<button class="modal-btn cancel" on:click={cancelLink}>Cancel</button>
				<button class="modal-btn confirm" on:click={confirmLink}>Insert</button>
			</div>
		</div>
	</div>
{/if}

<!-- Image Modal -->
{#if showImageModal}
	<div class="modal-overlay" on:click={cancelImage}>
		<div class="modal-content" bind:this={imageModalElement} on:click|stopPropagation>
			<h3>Insert Image</h3>
			<input
				type="text"
				class="modal-input"
				placeholder="Enter image URL..."
				bind:value={imageUrl}
				on:keydown={(e) => {
					if (e.key === 'Enter') {
						confirmImage();
					} else if (e.key === 'Escape') {
						cancelImage();
					}
				}}
				autofocus
			/>
			<div class="modal-actions">
				<button class="modal-btn cancel" on:click={cancelImage}>Cancel</button>
				<button class="modal-btn confirm" on:click={confirmImage}>Insert</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.editor-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		overflow: hidden;
		position: relative;
	}

	.bubble-menu {
		position: absolute;
		z-index: 100;
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

	.floating-toolbar .toolbar-content {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-wrap: nowrap;
	}
	
	.whiteboard-toolbar-content .whiteboard-color-input {
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
	
	.whiteboard-toolbar-content .whiteboard-color-input::-webkit-color-swatch-wrapper {
		padding: 0;
		border: none;
		border-radius: var(--radius-sm);
	}
	
	.whiteboard-toolbar-content .whiteboard-color-input::-webkit-color-swatch {
		border: none;
		border-radius: var(--radius-sm);
	}
	
	.whiteboard-toolbar-content .whiteboard-width-control {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
	}
	
	.whiteboard-toolbar-content .whiteboard-width-input {
		width: 80px;
	}
	
	.whiteboard-toolbar-content .whiteboard-width-label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		text-align: center;
	}

	.toolbar-left {
		display: flex;
		gap: 0.5rem;
	}

	.toolbar-center {
		display: flex;
		gap: 0.25rem;
		flex: 1;
		justify-content: center;
		flex-wrap: wrap;
	}

	.toolbar-right {
		display: flex;
		gap: 0.5rem;
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

	/* Color Picker Styles */
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

	/* Dark mode specific styles */
	:global(.dark) .color-picker-dropdown {
		background: var(--bg-secondary);
		border-color: var(--border-color);
	}

	:global(.light) .color-picker-dropdown {
		background: #ffffff;
		border-color: #e5e7eb;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
	}

	.theme-toggle {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.2rem;
		padding: 0.25rem 0.5rem;
	}

	.editor-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: auto;
		padding-bottom: 4rem;
		position: relative;
	}

	.editor-title-section {
		padding: 1.5rem 1.5rem 0.5rem 1.5rem;
		max-width: 800px;
		margin: 0 auto;
		width: 100%;
		border-bottom: 1px solid var(--border-color);
		margin-bottom: 1rem;
	}

	.editor-title {
		font-size: 2rem;
		font-weight: var(--font-weight-bold);
		color: var(--text-primary);
		margin: 0;
		padding: 0.5rem 0;
		cursor: text;
		transition: var(--transition);
		line-height: 1.2;
	}

	.editor-title:hover {
		color: var(--accent-color);
	}

	.editor-title-input {
		width: 100%;
		background: transparent;
		border: none;
		border-bottom: 2px solid var(--accent-color);
		color: var(--text-primary);
		font-size: 2rem;
		font-weight: var(--font-weight-bold);
		padding: 0.5rem 0;
		font-family: inherit;
		outline: none;
		line-height: 1.2;
	}

	.editor-title-input::placeholder {
		color: var(--text-secondary);
		opacity: 0.5;
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
	
	.mode-toggle-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: var(--transition);
		font-size: 0.85rem;
		font-weight: 500;
	}
	
	.mode-toggle-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border-color: var(--border-hover);
	}
	
	.mode-toggle-btn.active {
		background: var(--accent-light);
		color: var(--accent-color);
		border-color: var(--accent-color);
	}
	
	.mode-toggle-btn svg {
		flex-shrink: 0;
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
	}

	:global(.editor-link) {
		color: var(--accent-color);
		text-decoration: none;
	}

	:global(.editor-link:hover) {
		text-decoration: underline;
	}

	/* Table styles for editor */
	:global(.editor-content table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1rem 0;
		font-size: 0.9rem;
		border: 1px solid var(--border-color);
	}

	:global(.editor-content.dark table) {
		border-color: var(--border-color);
	}

	:global(.editor-content.light table) {
		border-color: #e5e7eb;
	}

	:global(.editor-content th),
	:global(.editor-content td) {
		border: 1px solid var(--border-color);
		padding: 0.5rem 0.75rem;
		text-align: left;
		min-width: 80px;
	}

	:global(.editor-content.dark th),
	:global(.editor-content.dark td) {
		border-color: var(--border-color);
	}

	:global(.editor-content.light th),
	:global(.editor-content.light td) {
		border-color: #e5e7eb;
	}

	:global(.editor-content th) {
		background: var(--bg-tertiary);
		font-weight: 600;
	}

	:global(.editor-content.dark th) {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	:global(.editor-content.light th) {
		background: #f9fafb;
		color: #111827;
	}

	:global(.editor-content tr:nth-child(even)) {
		background: var(--bg-secondary);
	}

	:global(.editor-content.dark tr:nth-child(even)) {
		background: var(--bg-secondary);
	}

	:global(.editor-content.light tr:nth-child(even)) {
		background: #f9fafb;
	}

	:global(.editor-content tr:hover) {
		background: var(--bg-tertiary);
	}

	:global(.editor-content.dark tr:hover) {
		background: var(--bg-tertiary);
	}

	:global(.editor-content.light tr:hover) {
		background: #f3f4f6;
	}

	/* Blockquote improvements */
	:global(.editor-content.dark blockquote) {
		background: var(--accent-light);
		border-left-color: var(--accent-color);
		color: var(--text-primary);
	}

	:global(.editor-content.light blockquote) {
		background: #fef3c7;
		border-left-color: #f59e0b;
		color: #92400e;
	}

	/* Code improvements */
	:global(.editor-content.dark code) {
		background: var(--bg-tertiary);
		color: var(--accent-color);
	}

	:global(.editor-content.light code) {
		background: #f3f4f6;
		color: #dc2626;
	}

	:global(.editor-content.dark pre) {
		background: var(--bg-tertiary);
		border-color: var(--border-color);
		color: var(--text-primary);
	}

	:global(.editor-content.light pre) {
		background: #f9fafb;
		border-color: #e5e7eb;
		color: #111827;
	}

	:global(.editor-content.dark pre code) {
		background: none;
		color: var(--text-primary);
	}

	:global(.editor-content.light pre code) {
		background: none;
		color: #111827;
	}

	/* Heading improvements */
	:global(.editor-content.dark h1),
	:global(.editor-content.dark h2),
	:global(.editor-content.dark h3),
	:global(.editor-content.dark h4),
	:global(.editor-content.dark h5),
	:global(.editor-content.dark h6) {
		color: var(--text-primary);
		border-bottom: none;
	}

	:global(.editor-content.light h1),
	:global(.editor-content.light h2),
	:global(.editor-content.light h3),
	:global(.editor-content.light h4),
	:global(.editor-content.light h5),
	:global(.editor-content.light h6) {
		color: #111827;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		backdrop-filter: blur(2px);
	}

	.modal-content {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		min-width: 400px;
		max-width: 90vw;
		box-shadow: var(--shadow-lg);
	}

	.modal-content h3 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.modal-input {
		width: 100%;
		padding: 0.75rem;
		background: var(--input-bg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		color: var(--text-primary);
		font-size: 0.9375rem;
		margin-bottom: 1rem;
		transition: var(--transition);
		box-sizing: border-box;
	}

	.modal-input:focus {
		outline: none;
		border-color: var(--accent-color);
		box-shadow: 0 0 0 2px var(--accent-light);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.modal-btn {
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: var(--transition);
		border: 1px solid var(--border-color);
	}

	.modal-btn.cancel {
		background: var(--bg-tertiary);
		color: var(--text-secondary);
	}

	.modal-btn.cancel:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.modal-btn.confirm {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.modal-btn.confirm:hover {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	/* List improvements */
	:global(.editor-content.dark ul),
	:global(.editor-content.dark ol) {
		color: var(--text-primary);
	}

	:global(.editor-content.light ul),
	:global(.editor-content.light ol) {
		color: #111827;
	}

	/* Link improvements */
	:global(.editor-content.dark .editor-link) {
		color: var(--accent-color);
	}

	:global(.editor-content.light .editor-link) {
		color: #2563eb;
	}

	/* Image improvements */
	:global(.editor-content.dark .editor-image) {
		border: 1px solid var(--border-color);
	}

	:global(.editor-content.light .editor-image) {
		border: 1px solid #e5e7eb;
	}

	/* Selection and focus styles */
	:global(.editor-content ::selection) {
		background: var(--accent-light);
	}

	:global(.editor-content.dark ::selection) {
		background: rgba(59, 130, 246, 0.3);
	}

	:global(.editor-content.light ::selection) {
		background: rgba(59, 130, 246, 0.2);
	}

	/* ProseMirror specific styles */
	:global(.ProseMirror) {
		outline: none;
	}

	:global(.ProseMirror-focused) {
		outline: none;
	}

	/* Table controls (resize handles, etc.) */
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

	/* Table resize handles */
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
