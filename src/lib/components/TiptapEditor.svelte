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
	import { currentNote, allTags } from '../stores/notesStore.js';
	import { isDarkTheme, toggleTheme } from '../stores/themeStore.js';
import { marked } from 'marked';
import TurndownService from 'turndown';
	import TagManager from './TagManager.svelte';
	import Icon from './Icon.svelte';

	let editorElement;
	let lastNoteId = null;
	let editor;

	// Color picker state
	let showColorPicker = false;
	let colorPickerElement;
	let customColor = '#000000';

	// Table detection state
	let isInTableState = false;

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
			},
			editorProps: {
				attributes: {
					class: `editor-content ${$isDarkTheme ? 'dark' : 'light'}`,
				},
			},
		});

		// Initial table state check
		checkTableState();
	}

	$: if ($currentNote && editorElement) {
		// Note changed - update editor
		if (lastNoteId !== $currentNote.id) {
			lastNoteId = $currentNote.id;
			if (editor) {
				const preparedContent = prepareContentForEditor($currentNote.content);
				const currentContent = editor.getHTML();
				if (currentContent !== preparedContent) {
					editor.commands.setContent(preparedContent);
				}
			} else {
				initEditor();
			}
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

	$: if (editor) {
		// Theme changed - recreate editor
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

	function handleToggleTheme() {
		toggleTheme();
	}

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
		const url = window.prompt('Enter URL:');
		if (url) {
			editor?.chain().focus().setLink({ href: url }).run();
		}
	}

	function unsetLink() {
		editor?.chain().focus().unsetLink().run();
	}

	function addImage() {
		const url = window.prompt('Enter image URL:');
		if (url) {
			editor?.chain().focus().setImage({ src: url }).run();
		}
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
		if (showColorPicker && colorPickerElement && !colorPickerElement.contains(event.target) &&
		    !event.target.closest('.color-picker-btn')) {
			showColorPicker = false;
		}
	}

	// Helper functions
	function isActive(type, options = {}) {
		return editor?.isActive(type, options) || false;
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
	<div class="editor-toolbar">
		<div class="toolbar-left">
			<button class="theme-toggle" on:click={handleToggleTheme}>
				<Icon name={$isDarkTheme ? 'sun' : 'moon'} size={16} />
			</button>
		</div>

		{#if $currentNote}
			<div class="toolbar-center">
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

				<!-- Links and Images -->
				<button
					class="toolbar-btn"
					class:active={isActive('link')}
					on:click={isActive('link') ? unsetLink : setLink}
					title="Link"
				>
					<Icon name="link" size={16} />
				</button>
				<button
					class="toolbar-btn"
					on:click={addImage}
					title="Insert Image"
				>
					<Icon name="image" size={16} />
				</button>
				<button
					class="toolbar-btn"
					on:click={addTable}
					title="Insert Table"
				>
					<Icon name="table" size={16} />
				</button>

				{#if isInTableState}
					<button
						class="toolbar-btn color-reset-btn"
						on:click={deleteTable}
						title="Delete Table"
					>
						<Icon name="trash" size={16} />
					</button>
				{/if}

				<div class="toolbar-separator"></div>

				<!-- Text alignment -->
				<button
					class="toolbar-btn"
					class:active={isActive({ textAlign: 'left' })}
					on:click={() => setTextAlign('left')}
					title="Align Left"
				>
					<Icon name="align-left" size={16} />
				</button>
				<button
					class="toolbar-btn"
					class:active={isActive({ textAlign: 'center' })}
					on:click={() => setTextAlign('center')}
					title="Align Center"
				>
					<Icon name="align-center" size={16} />
				</button>
				<button
					class="toolbar-btn"
					class:active={isActive({ textAlign: 'right' })}
					on:click={() => setTextAlign('right')}
					title="Align Right"
				>
					<Icon name="align-right" size={16} />
				</button>

				<div class="toolbar-separator"></div>

				<!-- Text Color -->
				<div class="color-picker-container">
					<button
						class="toolbar-btn color-picker-btn"
						on:click={toggleColorPicker}
						title="Text Color"
					>
						<div class="color-indicator" style="background-color: {getCurrentColor() || '#000000'}"></div>
						<Icon name="palette" size={16} />
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
									on:input={applyCustomColor}
									class="custom-color-input"
									title="Custom Color"
								/>
								<button
									class="color-reset-btn"
									on:click={resetColor}
									title="Reset to default"
								>
									<Icon name="x" size={14} />
								</button>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if $currentNote}
			<div class="toolbar-right">
				<TagManager
					tags={$currentNote.tags}
					availableTags={$allTags}
					on:change={(e) => {
						if ($currentNote) {
							$currentNote.tags = e.detail.tags;
						}
					}}
				/>
			</div>
		{/if}
	</div>
	<div class="editor-wrapper">
		<div bind:this={editorElement} class="editor"></div>
	</div>
</div>

<style>
	.editor-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
	}

	.editor-toolbar {
		padding: 0.5rem;
		border-bottom: 1px solid var(--border-color, #333);
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
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
		top: 100%;
		right: 0;
		margin-top: 0.25rem;
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
		overflow: auto;
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
