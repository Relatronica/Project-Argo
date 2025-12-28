<script>
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, keymap } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { markdown } from '@codemirror/lang-markdown';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
	import { currentNote, allTags } from '../stores/notesStore.js';
	import { isDarkTheme } from '../stores/themeStore.js';
	import TagManager from './TagManager.svelte';
	import MarkdownViewer from './MarkdownViewer.svelte';
	import Icon from './Icon.svelte';

	let editorView;
	let editorElement;
	let showPreview = false;
	let lastNoteId = null;

	// Auto-save timer
	let autoSaveTimer = null;

	function initEditor() {
		if (!editorElement) return;

		// Destroy existing editor
		if (editorView) {
			editorView.destroy();
		}

		// Create new editor with minimal setup
		const extensions = [
			history(),
			markdown(),
			keymap.of([...defaultKeymap, ...historyKeymap]),
			$isDarkTheme ? oneDark : [],
			EditorView.updateListener.of((update) => {
				if (update.docChanged && $currentNote) {
					// Update note content on change
					const content = update.state.doc.toString();
					$currentNote.content = content;
				}
			}),
			EditorView.lineWrapping
		];

		editorView = new EditorView({
			state: EditorState.create({
				doc: $currentNote?.content || '',
				extensions
			}),
			parent: editorElement
		});
	}

	$: if ($currentNote && editorElement) {
		// Note changed - update editor
		if (lastNoteId !== $currentNote.id) {
			lastNoteId = $currentNote.id;
			if (editorView) {
				const currentContent = editorView.state.doc.toString();
				if (currentContent !== ($currentNote.content || '')) {
					editorView.dispatch({
						changes: {
							from: 0,
							to: editorView.state.doc.length,
							insert: $currentNote.content || ''
						}
					});
				}
			} else {
				initEditor();
			}
		}
	}

	// Auto-save when content changes
	$: if ($currentNote && editorView) {
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

	$: if ($isDarkTheme !== undefined && editorView) {
		// Theme changed - recreate editor
		initEditor();
	}

	onMount(() => {
		if (editorElement) {
			initEditor();
		}
	});

	onDestroy(() => {
		if (editorView) {
			editorView.destroy();
		}
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
		}
	});

</script>

<div class="editor-container">
	<div class="editor-toolbar">
		<div class="toolbar-left">
			{#if $currentNote}
				<button
					class="preview-toggle"
					on:click={() => showPreview = !showPreview}
					class:active={showPreview}
				>
					{#if showPreview}
						<Icon name="edit" size={16} />
						Edit
					{:else}
						<Icon name="eye" size={16} />
						Preview
					{/if}
				</button>
			{/if}
		</div>

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
		{#if showPreview && $currentNote}
			<MarkdownViewer content={$currentNote.content} />
		{:else}
			<div bind:this={editorElement} class="editor"></div>
		{/if}
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
		justify-content: flex-end;
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

	:global(.cm-editor) {
		height: 100%;
	}

	:global(.cm-scroller) {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
	}

	:global(.cm-content) {
		padding: 1.5rem;
		max-width: 800px;
		margin: 0 auto;
	}

	.preview-toggle {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0.5rem 0.875rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.preview-toggle:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	.preview-toggle.active {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}
</style>

