<script>
	import { createEventDispatcher } from 'svelte';
	import { currentNote, updateNoteTitle, updateNoteColor } from '../../stores/notesStore.js';
	import TiptapEditor from '../TiptapEditor.svelte';
	import Icon from '../Icon.svelte';

	const dispatch = createEventDispatcher();

	export let sidebarOpen = true;

	// Title editing state
	let editingTitle = false;
	let titleInput = '';
	let showColorDialog = false;
	let selectedColor = null;

	// Available colors for notes
	const noteColors = [
		{ value: null, label: 'No color', hex: 'transparent' },
		{ value: '#ef4444', label: 'Red', hex: '#ef4444' },
		{ value: '#f97316', label: 'Orange', hex: '#f97316' },
		{ value: '#eab308', label: 'Yellow', hex: '#eab308' },
		{ value: '#22c55e', label: 'Green', hex: '#22c55e' },
		{ value: '#06b6d4', label: 'Cyan', hex: '#06b6d4' },
		{ value: '#3b82f6', label: 'Blue', hex: '#3b82f6' },
		{ value: '#6366f1', label: 'Indigo', hex: '#6366f1' },
		{ value: '#a855f7', label: 'Purple', hex: '#a855f7' },
		{ value: '#ec4899', label: 'Pink', hex: '#ec4899' },
		{ value: '#f43f5e', label: 'Rose', hex: '#f43f5e' },
		{ value: '#8b5cf6', label: 'Violet', hex: '#8b5cf6' }
	];

	$: if ($currentNote && !editingTitle) {
		titleInput = $currentNote.title || 'Untitled Note';
	}

	// Update selectedColor when note color changes
	$: if ($currentNote && !showColorDialog) {
		selectedColor = $currentNote.color || null;
	}

	async function handleTitleBlur() {
		if ($currentNote && titleInput.trim() !== ($currentNote.title || 'Untitled Note')) {
			await updateNoteTitle($currentNote.id, titleInput.trim());
		}
		editingTitle = false;
	}

	function handleTitleKeydown(event) {
		if (event.key === 'Enter') {
			event.target.blur();
		} else if (event.key === 'Escape') {
			titleInput = $currentNote?.title || 'Untitled Note';
			editingTitle = false;
		}
	}

	async function handleColorSelect(color) {
		if ($currentNote) {
			await updateNoteColor($currentNote.id, color);
			selectedColor = color;
			showColorDialog = false;
		}
	}

	// Update selectedColor when note changes
	$: if ($currentNote) {
		selectedColor = $currentNote.color || null;
	}

	async function handleModeToggle() {
		if ($currentNote) {
			// IMPORTANT: Save current note BEFORE changing mode
			// This ensures whiteboard data is saved if switching from whiteboard mode
			// (note.whiteboardData is already updated immediately when drawing, but we ensure it's persisted)
			console.log('[MainContent] Saving note before mode toggle');
			const { saveCurrentNote } = await import('../../stores/notesStore.js');
			await saveCurrentNote();
			
			// Change mode - note.whiteboardData is already saved above
			const newMode = $currentNote.mode === 'text' ? 'whiteboard' : 'text';
			$currentNote.mode = newMode;
			
			// Save again to persist the mode change
			await saveCurrentNote();
			console.log('[MainContent] Mode toggled to:', newMode);
		}
	}

	function handleExportNote() {
		dispatch('mainContentEvent', 'exportNote');
	}

	function handleDeleteNote() {
		dispatch('mainContentEvent', 'deleteNote');
	}

	function toggleColorDialog() {
		showColorDialog = !showColorDialog;
	}
</script>

<main class="main-content" class:sidebar-collapsed={!sidebarOpen}>
	{#if $currentNote}
		<header class="note-header">
			<div class="title-section">
				{#if editingTitle}
					<input
						type="text"
						class="title-input"
						bind:value={titleInput}
						on:blur={handleTitleBlur}
						on:keydown={handleTitleKeydown}
						autofocus
						placeholder="Untitled Note"
					/>
				{:else}
					<h1
						class="note-title"
						class:empty={!$currentNote.title}
						on:dblclick={() => editingTitle = true}
						title="Double-click to edit title"
					>
						{$currentNote.title || 'Untitled Note'}
					</h1>
				{/if}
			</div>

			<div class="note-actions">
				<!-- Export Button -->
				<button
					class="header-btn export-btn"
					on:click={handleExportNote}
					title="Export note"
				>
					<Icon name="upload" size={16} />
				</button>

				<!-- Delete Button -->
				<button
					class="header-btn delete-btn"
					on:click={handleDeleteNote}
					title="Delete note"
				>
					<Icon name="trash" size={16} />
				</button>

				<!-- Mode toggle -->
				<button
					class="mode-toggle-btn"
					class:active={$currentNote?.mode === 'whiteboard'}
					on:click={handleModeToggle}
					title={$currentNote?.mode === 'text' ? 'Switch to Whiteboard' : 'Switch to Text'}
				>
					{#if $currentNote?.mode === 'text'}
						<!-- Whiteboard icon -->
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
							<line x1="9" y1="3" x2="9" y2="21"></line>
							<line x1="3" y1="9" x2="21" y2="9"></line>
						</svg>
					{:else}
						<!-- Text icon -->
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="4,6 4,22 20,22"></polyline>
							<line x1="4" y1="11" x2="20" y2="11"></line>
							<line x1="4" y1="16" x2="14" y2="16"></line>
						</svg>
					{/if}
				</button>

				<!-- Color picker -->
				<div class="color-picker-container">
					<button
						class="color-btn"
						on:click={toggleColorDialog}
						title="Change note color"
					>
						<div
							class="color-indicator"
							style="background-color: {selectedColor || 'var(--text-secondary)'}"
						></div>
					</button>

					{#if showColorDialog}
						<div class="color-palette">
							{#each noteColors as color}
								<button
									class="color-option"
									style="background-color: {color.hex}"
									on:click={() => handleColorSelect(color.value)}
									title={color.label}
									class:selected={selectedColor === color.value}
								></button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Mode toggle will be handled by TiptapEditor -->
			</div>
		</header>
	{/if}

	<div class="editor-container">
		<TiptapEditor />
	</div>
</main>

<style>
	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
		transition: margin-left 0.2s ease;
	}

	.note-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-secondary);
		min-height: 80px;
	}

	.title-section {
		flex: 1;
		min-width: 0;
	}

	.note-title {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--text-primary);
		cursor: pointer;
		transition: color 0.2s ease;
		word-break: break-word;
	}

	.note-title:hover {
		color: var(--accent-color);
	}

	.note-title.empty {
		color: var(--text-secondary);
		font-style: italic;
	}

	.title-input {
		width: 100%;
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--text-primary);
		background: transparent;
		border: 2px solid var(--accent-color);
		border-radius: var(--radius);
		padding: 0.5rem 1rem;
		outline: none;
		font-family: inherit;
	}

	.note-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-left: 2rem;
		flex-shrink: 0;
	}

	.color-picker-container {
		position: relative;
	}

	.color-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.color-btn:hover {
		background: var(--bg-tertiary);
	}

	.color-indicator {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid var(--border-color);
		transition: var(--transition);
	}

	.color-palette {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 0.75rem;
		box-shadow: var(--shadow-lg);
		z-index: 1000;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		min-width: 160px;
	}

	.color-option {
		width: 32px;
		height: 32px;
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

	.color-option.selected {
		border-color: var(--text-primary);
		box-shadow: 0 0 0 2px var(--accent-color);
		opacity: 1;
	}

	.editor-container {
		flex: 1;
		overflow: hidden;
	}

	/* Mode toggle button */
	.mode-toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: var(--transition);
		min-width: 36px;
		height: 36px;
	}

	.mode-toggle-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border-color: var(--border-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow-xs);
	}

	.mode-toggle-btn:active {
		transform: translateY(0);
	}

	.mode-toggle-btn.active {
		background: var(--accent-light);
		color: var(--accent-color);
		border-color: var(--accent-color);
	}

	.mode-toggle-btn svg {
		flex-shrink: 0;
	}

	/* Header buttons (export, delete) */
	.header-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: var(--transition);
		min-width: 36px;
		height: 36px;
		margin-right: 0.5rem;
	}

	.header-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border-color: var(--border-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow-xs);
	}

	.header-btn:active {
		transform: translateY(0);
	}

	.header-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.header-btn.delete-btn {
		color: var(--error-color, #ef4444);
		border-color: var(--error-color, #ef4444);
	}

	.header-btn.delete-btn:hover {
		background: var(--error-color, #ef4444);
		color: white;
		border-color: var(--error-color, #ef4444);
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.note-header {
			padding: 1rem;
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.note-actions {
			margin-left: 0;
			align-self: flex-end;
		}
	}
</style>
