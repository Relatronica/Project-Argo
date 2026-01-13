<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { currentNote, updateNoteTitle, updateNoteColor, updateNoteIcon, saveStatus, hasUnsavedChanges, allTags, saveCurrentNote } from '../../stores/notesStore.js';
	import TiptapEditor from '../TiptapEditor.svelte';
	import Icon from '../Icon.svelte';
	import TagManager from '../TagManager.svelte';
	import LoadingOverlay from '../LoadingOverlay.svelte';

	// Title editing state
	let editingTitle = false;
	let titleInput = '';

	const dispatch = createEventDispatcher();

	export let sidebarOpen = true;

	let showColorDialog = false;
	let selectedColor = null;
	let selectedIcon = null;

	$: if ($currentNote && !editingTitle) {
		titleInput = $currentNote.title || 'Untitled Note';
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
	
	// Available icons for notes (consistent with Icon component)
	const noteIcons = [
		null, // No icon option
		'fileText', 'lightbulb', 'star', 'calendar', 'tag', 'briefcase', 'home', 'book',
		'heart', 'music', 'camera', 'video', 'gamepad', 'shopping', 'school', 'health',
		'car', 'travel', 'food', 'coffee', 'project', 'goals', 'team', 'mail', 'phone', 'location'
	];

	// Metadata dropdown state
	let showMetadata = false;
	let scheduledForDate = '';
	let dueDateValue = '';
	let detailsDropdownRef;

	// Close dropdown when clicking outside
	function handleClickOutside(event) {
		if (detailsDropdownRef && !detailsDropdownRef.contains(event.target)) {
			showMetadata = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

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

	// Update selectedColor and selectedIcon when note changes
	$: if ($currentNote && !showColorDialog) {
		selectedColor = $currentNote.color || null;
		selectedIcon = $currentNote.icon || null;
	}

	async function handleColorSelect(color) {
		if ($currentNote) {
			await updateNoteColor($currentNote.id, color);
			selectedColor = color;
		}
	}

	async function handleIconSelect(icon) {
		if ($currentNote) {
			await updateNoteIcon($currentNote.id, icon);
			selectedIcon = icon;
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

	// Date handling functions
	function formatDateForInput(isoString) {
		if (!isoString) return '';
		return isoString.split('T')[0]; // Get YYYY-MM-DD part
	}

	async function handleScheduledDateChange(event) {
		const newDate = event.target.value;
		if ($currentNote) {
			$currentNote.scheduledFor = newDate ? `${newDate}T00:00:00.000Z` : null;
			scheduledForDate = newDate;
			await saveCurrentNote();
		}
	}

	async function handleDueDateChange(event) {
		const newDate = event.target.value;
		if ($currentNote) {
			$currentNote.dueDate = newDate ? `${newDate}T00:00:00.000Z` : null;
			dueDateValue = newDate;
			await saveCurrentNote();
		}
	}

	async function handleTagsChange(event) {
		if ($currentNote) {
			$currentNote.tags = event.detail.tags || [];
			await saveCurrentNote();
		}
	}

	function toggleMetadata() {
		showMetadata = !showMetadata;
	}

	// Update date inputs when note changes
	$: if ($currentNote) {
		scheduledForDate = formatDateForInput($currentNote.scheduledFor);
		dueDateValue = formatDateForInput($currentNote.dueDate);
	}
</script>

<main class="main-content" class:sidebar-collapsed={!sidebarOpen}>
	{#if $currentNote}
		<header class="note-header">
			<!-- Color and Icon picker + Details (left side) -->
			<div class="note-indicator-container">
				<div class="left-actions">
					<div class="color-icon-picker-container">
						<button
							class="color-icon-btn"
							on:click={toggleColorDialog}
							title="Change note color and icon"
						>
							{#if selectedIcon}
								<div
									class="color-icon-indicator"
									style="background-color: {selectedColor || 'var(--bg-tertiary)'};"
								>
									<Icon name={selectedIcon} size={18} />
								</div>
							{:else}
								<div
									class="color-icon-indicator"
									style="background-color: {selectedColor || 'var(--text-secondary)'};"
								></div>
							{/if}
						</button>

						{#if showColorDialog}
							<div class="color-icon-palette">
								<!-- Color Section -->
								<div class="palette-section">
									<div class="palette-section-title">Color</div>
									<div class="color-palette-grid">
										{#each noteColors as color}
											<button
												class="color-option-square"
												style="background-color: {color.hex}"
												on:click={() => handleColorSelect(color.value)}
												title={color.label}
												class:selected={selectedColor === color.value}
											></button>
										{/each}
									</div>
								</div>

								<!-- Icon Section -->
								<div class="palette-section">
									<div class="palette-section-title">Icon</div>
									<div class="icon-palette-grid">
										<button
											class="icon-option"
											class:selected={selectedIcon === null}
											on:click={() => handleIconSelect(null)}
											title="No icon"
										>
											<Icon name="x" size={14} />
										</button>
										{#each noteIcons.filter(i => i !== null) as iconName}
											<button
												class="icon-option"
												class:selected={selectedIcon === iconName}
												on:click={() => handleIconSelect(iconName)}
												title={iconName}
											>
												<Icon name={iconName} size={14} />
											</button>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>

					<!-- Details dropdown -->
					<div class="details-dropdown-container" bind:this={detailsDropdownRef}>
						<button
							class="details-btn"
							class:active={showMetadata}
							on:click|stopPropagation={toggleMetadata}
							title="Show details"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 20h9"></path>
								<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
							</svg>
							{#if $currentNote && (($currentNote.scheduledFor || $currentNote.dueDate) || ($currentNote.tags && $currentNote.tags.length > 0))}
								<span class="details-badge"></span>
							{/if}
						</button>

						{#if showMetadata}
							<div class="details-dropdown" on:click|stopPropagation>
								<!-- Dates Section -->
								<div class="details-subsection">
									<div class="details-subsection-header">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
											<line x1="16" y1="2" x2="16" y2="6"></line>
											<line x1="8" y1="2" x2="8" y2="6"></line>
											<line x1="3" y1="10" x2="21" y2="10"></line>
										</svg>
										<span class="details-subsection-title">Dates</span>
									</div>
									<div class="details-date-inputs">
										<div class="details-date-group">
											<label for="scheduled-date-header">
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<circle cx="12" cy="12" r="10"></circle>
													<polyline points="12 6 12 12 16 14"></polyline>
												</svg>
												Scheduled
											</label>
											<input
												id="scheduled-date-header"
												type="date"
												value={scheduledForDate}
												on:change={handleScheduledDateChange}
												class="details-date-input"
											/>
											{#if scheduledForDate}
												<button
													class="details-clear-btn"
													on:click={async () => {
														scheduledForDate = '';
														if ($currentNote) {
															$currentNote.scheduledFor = null;
															await saveCurrentNote();
														}
													}}
													title="Clear scheduled date"
												>
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<line x1="18" y1="6" x2="6" y2="18"></line>
														<line x1="6" y1="6" x2="18" y2="18"></line>
													</svg>
												</button>
											{/if}
										</div>

										<div class="details-date-group">
											<label for="due-date-header">
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<circle cx="12" cy="12" r="10"></circle>
													<line x1="12" y1="8" x2="12" y2="12"></line>
													<line x1="12" y1="16" x2="12.01" y2="16"></line>
												</svg>
												Due Date
											</label>
											<input
												id="due-date-header"
												type="date"
												value={dueDateValue}
												on:change={handleDueDateChange}
												class="details-date-input"
											/>
											{#if dueDateValue}
												<button
													class="details-clear-btn"
													on:click={async () => {
														dueDateValue = '';
														if ($currentNote) {
															$currentNote.dueDate = null;
															await saveCurrentNote();
														}
													}}
													title="Clear due date"
												>
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<line x1="18" y1="6" x2="6" y2="18"></line>
														<line x1="6" y1="6" x2="18" y2="18"></line>
													</svg>
												</button>
											{/if}
										</div>
									</div>
								</div>

								<!-- Tags Section -->
								<div class="details-subsection">
									<div class="details-subsection-header">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
											<line x1="7" y1="7" x2="7.01" y2="7"></line>
										</svg>
										<span class="details-subsection-title">Tags</span>
									</div>
									<div class="details-tags-wrapper">
										<TagManager
											tags={$currentNote?.tags || []}
											availableTags={$allTags || []}
											on:change={handleTagsChange}
										/>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Title Section (center) -->
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
				<!-- Save Status Indicator -->
				<div class="save-status-indicator" 
					class:saving={$saveStatus === 'saving'} 
					class:saved={($saveStatus === 'saved' || $saveStatus === 'idle') && !$hasUnsavedChanges} 
					class:error={$saveStatus === 'error'} 
					class:unsaved={$hasUnsavedChanges && $saveStatus !== 'saving'}
					title={$saveStatus === 'saving' ? 'Saving...' : $saveStatus === 'error' ? 'Save failed' : $hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
				>
					{#if $saveStatus === 'saving' || $hasUnsavedChanges}
						<svg class="saving-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path opacity="0.25" d="M12 2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							<path opacity="0.75" d="M12 18V22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							<path opacity="0.5" d="M4.93 4.93L7.76 7.76" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							<path d="M16.24 16.24L19.07 19.07" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							<path opacity="0.75" d="M2 12H6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							<path opacity="0.25" d="M18 12H22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							<path d="M4.93 19.07L7.76 16.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							<path opacity="0.5" d="M16.24 7.76L19.07 4.93" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
						</svg>
						<span>{$saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}</span>
					{:else if $saveStatus === 'error'}
						<Icon name="alertTriangle" size={14} />
						<span>Error</span>
					{:else}
						<Icon name="check-circle" size={14} />
						<span>Saved</span>
					{/if}
				</div>

				<!-- Export Button -->
				<button
					class="header-btn export-btn"
					on:click={handleExportNote}
					title="Export note"
				>
					<Icon name="upload" size={16} />
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

				<!-- Delete Button (all the way to the right) -->
				<button
					class="header-btn delete-btn"
					on:click={handleDeleteNote}
					title="Delete note"
				>
					<Icon name="trash" size={16} />
				</button>
			</div>
		</header>
	{/if}

	<div class="editor-container">
		<TiptapEditor />
		<LoadingOverlay />
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
		gap: 1rem;
	}

	.note-indicator-container {
		flex-shrink: 0;
	}

	.left-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.title-section {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		padding: 0 2rem;
	}

	.note-title {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--text-primary);
		cursor: pointer;
		transition: color 0.2s ease;
		word-break: break-word;
		text-align: left;
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
		text-align: left;
	}

	.note-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-shrink: 0;
		margin-left: auto;
	}

	.color-icon-picker-container {
		position: relative;
	}

	.color-icon-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.color-icon-btn:hover {
		transform: scale(1.05);
	}

	.color-icon-indicator {
		width: 36px;
		height: 36px;
		min-width: 36px;
		border-radius: 4px;
		border: 1px solid var(--border-color);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		color: var(--text-primary);
	}

	.color-icon-indicator:hover {
		transform: scale(1.1);
		box-shadow: 0 0 0 2px var(--accent-color);
		z-index: 1;
	}

	.color-icon-palette {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 1rem;
		box-shadow: var(--shadow-lg);
		z-index: 1000;
		min-width: 280px;
		max-width: 320px;
	}

	.palette-section {
		margin-bottom: 1rem;
	}

	.palette-section:last-child {
		margin-bottom: 0;
	}

	.palette-section-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.color-palette-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.5rem;
	}

	.color-option-square {
		aspect-ratio: 1;
		border: 2px solid var(--border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: var(--transition);
		opacity: 0.8;
	}

	.color-option-square:hover {
		transform: scale(1.1);
		opacity: 1;
		border-color: var(--accent-color);
	}

	.color-option-square.selected {
		border-color: var(--accent-color);
		border-width: 3px;
		box-shadow: 0 0 0 2px var(--accent-light);
		opacity: 1;
	}

	.icon-palette-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.5rem;
	}

	.icon-option {
		aspect-ratio: 1;
		border: 2px solid var(--border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		padding: 0;
	}

	.icon-option:hover {
		transform: scale(1.1);
		border-color: var(--accent-color);
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.icon-option.selected {
		border-color: var(--accent-color);
		border-width: 3px;
		box-shadow: 0 0 0 2px var(--accent-light);
		background: var(--accent-light);
		color: var(--accent-color);
	}

	.editor-container {
		flex: 1;
		overflow: hidden;
		position: relative;
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

	/* Save Status Indicator */
	.save-status-indicator {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-secondary);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		transition: var(--transition);
		margin-right: 0.5rem;
		white-space: nowrap;
	}

	.save-status-indicator.saving {
		color: var(--accent-color);
		border-color: var(--accent-color);
		background: var(--accent-light, rgba(var(--accent-color-rgb, 59, 130, 246), 0.1));
	}

	.save-status-indicator.saved {
		color: var(--success-color, #10b981);
		border-color: var(--success-color, #10b981);
		background: rgba(16, 185, 129, 0.1);
	}

	.save-status-indicator.error {
		color: var(--error-color, #ef4444);
		border-color: var(--error-color, #ef4444);
		background: rgba(239, 68, 68, 0.1);
	}

	.save-status-indicator.unsaved {
		color: var(--accent-color);
		border-color: var(--accent-color);
		background: var(--accent-light, rgba(var(--accent-color-rgb, 59, 130, 246), 0.1));
	}

	.saving-spinner {
		animation: spin 1s linear infinite;
		color: var(--accent-color);
		flex-shrink: 0;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.save-status-indicator span {
		font-size: 0.8rem;
	}

	/* Details dropdown */
	.details-dropdown-container {
		position: relative;
	}

	.details-btn {
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
		position: relative;
	}

	.details-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border-color: var(--border-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow-xs);
	}

	.details-btn.active {
		background: var(--accent-light);
		color: var(--accent-color);
		border-color: var(--accent-color);
	}

	.details-badge {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 6px;
		height: 6px;
		background: var(--accent-color);
		border-radius: 50%;
		border: 1.5px solid var(--bg-tertiary);
	}

	.details-btn.active .details-badge {
		border-color: var(--accent-light);
	}

	.details-dropdown {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 1rem;
		box-shadow: var(--shadow-lg);
		z-index: 1000;
		min-width: 320px;
		max-width: 400px;
		max-height: 80vh;
		overflow-y: auto;
		animation: slideDown 0.2s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.details-subsection {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.details-subsection:last-child {
		margin-bottom: 0;
	}

	.details-subsection-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-bottom: 0.5rem;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.details-subsection-header svg {
		color: var(--text-muted);
		opacity: 0.7;
	}

	.details-subsection-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.details-date-inputs {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.details-date-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--bg-tertiary);
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius);
		border: 1px solid var(--border-color);
		position: relative;
		transition: var(--transition);
	}

	.details-date-group:hover {
		border-color: var(--border-hover);
		background: var(--bg-primary);
	}

	.details-date-group label {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
		font-weight: 500;
		white-space: nowrap;
	}

	.details-date-group label svg {
		color: var(--text-muted);
		opacity: 0.7;
	}

	.details-date-input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--text-primary);
		font-size: 0.875rem;
		padding: 0.25rem;
		cursor: pointer;
		font-family: inherit;
	}

	.details-date-input:focus {
		outline: none;
	}

	.details-date-input::-webkit-calendar-picker-indicator {
		cursor: pointer;
		opacity: 0.6;
		transition: var(--transition);
	}

	.details-date-input::-webkit-calendar-picker-indicator:hover {
		opacity: 1;
	}

	.details-clear-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.6;
	}

	.details-clear-btn:hover {
		background: var(--bg-secondary);
		color: var(--error-color);
		opacity: 1;
	}

	.details-tags-wrapper {
		width: 100%;
		padding: 0.25rem 0;
	}

	.details-tags-wrapper :global(.tag-manager) {
		width: 100%;
	}

	.details-tags-wrapper :global(.tags-list) {
		width: 100%;
		align-items: flex-start;
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
