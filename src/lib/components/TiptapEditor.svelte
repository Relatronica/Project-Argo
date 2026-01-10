<script>
	import { onMount, onDestroy } from 'svelte';
	import { currentNote, updateNoteTitle, allTags, saveCurrentNote } from '../stores/notesStore.js';
	import EditorContainer from './EditorContainer.svelte';
	import TagManager from './TagManager.svelte';

	// Title editing state
	let editingTitle = false;
	let titleInput = '';
	let titleInputElement;

	// Metadata accordion state (dates & tags)
	let showMetadata = false;
	let scheduledForDate = '';
	let dueDateValue = '';

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

	onMount(() => {
		// Component is now much simpler
	});

	onDestroy(() => {
		// Cleanup handled by EditorContainer
	});
</script>

<div class="editor-container">
	{#if $currentNote}
		<div class="editor-wrapper">
			<!-- Note Title Field -->
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

			<!-- Metadata Accordion (Dates & Tags) -->
			<div class="metadata-section">
				<button
					class="metadata-toggle-btn"
					class:active={showMetadata}
					on:click={toggleMetadata}
					title={showMetadata ? 'Hide metadata' : 'Show metadata'}
				>
					<span class="metadata-btn-content">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 20h9"></path>
							<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
						</svg>
						<span>Details</span>
						{#if $currentNote && (($currentNote.scheduledFor || $currentNote.dueDate) || ($currentNote.tags && $currentNote.tags.length > 0))}
							<span class="metadata-badge"></span>
						{/if}
					</span>
					<svg 
						width="12" 
						height="12" 
						viewBox="0 0 24 24" 
						fill="none" 
						stroke="currentColor" 
						stroke-width="2"
						class="accordion-arrow"
						class:rotated={showMetadata}
					>
						<polyline points="6 9 12 15 18 9"></polyline>
					</svg>
				</button>

				{#if showMetadata}
					<div class="metadata-content">
						<!-- Dates Section -->
						<div class="metadata-subsection">
							<div class="subsection-header">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
									<line x1="16" y1="2" x2="16" y2="6"></line>
									<line x1="8" y1="2" x2="8" y2="6"></line>
									<line x1="3" y1="10" x2="21" y2="10"></line>
								</svg>
								<span class="subsection-title">Dates</span>
							</div>
							<div class="date-inputs-container">
								<div class="date-input-group">
									<label for="scheduled-date">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<circle cx="12" cy="12" r="10"></circle>
											<polyline points="12 6 12 12 16 14"></polyline>
										</svg>
										Scheduled
									</label>
									<input
										id="scheduled-date"
										type="date"
										value={scheduledForDate}
										on:change={handleScheduledDateChange}
										class="date-input"
									/>
									{#if scheduledForDate}
										<button
											class="clear-date-btn"
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

								<div class="date-input-group">
									<label for="due-date">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<circle cx="12" cy="12" r="10"></circle>
											<line x1="12" y1="8" x2="12" y2="12"></line>
											<line x1="12" y1="16" x2="12.01" y2="16"></line>
										</svg>
										Due Date
									</label>
									<input
										id="due-date"
										type="date"
										value={dueDateValue}
										on:change={handleDueDateChange}
										class="date-input"
									/>
									{#if dueDateValue}
										<button
											class="clear-date-btn"
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
						<div class="metadata-subsection">
							<div class="subsection-header">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
									<line x1="7" y1="7" x2="7.01" y2="7"></line>
								</svg>
								<span class="subsection-title">Tags</span>
							</div>
							<div class="tags-wrapper">
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

			<!-- Editor Content -->
			<EditorContainer note={$currentNote} />
		</div>
	{/if}
</div>

<style>
	.editor-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		overflow: hidden;
		position: relative;
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
		padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-md) var(--spacing-xl);
		max-width: 800px;
		margin: 0 auto;
		width: 100%;
		border-bottom: 1px solid var(--border-color);
		margin-bottom: 0;
	}

	.metadata-section {
		padding: 0 var(--spacing-xl) var(--spacing-lg) var(--spacing-xl);
		max-width: 800px;
		margin: 0 auto;
		width: 100%;
		margin-bottom: var(--spacing-lg);
	}

	.metadata-toggle-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-md) 0;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		cursor: pointer;
		transition: var(--transition);
		position: relative;
		width: 100%;
		justify-content: space-between;
		border-radius: 0;
		margin-bottom: 0;
	}

	.metadata-toggle-btn:hover {
		background: transparent;
		color: var(--text-primary);
		border-bottom-color: var(--border-hover);
	}

	.metadata-toggle-btn.active {
		background: transparent;
		color: var(--text-primary);
		border-bottom-color: var(--accent-color);
	}

	.metadata-btn-content {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		position: relative;
	}

	.accordion-arrow {
		transition: transform var(--transition);
		opacity: 0.5;
		flex-shrink: 0;
		margin-left: auto;
		color: var(--text-secondary);
	}

	.accordion-arrow.rotated {
		transform: rotate(180deg);
		opacity: 0.7;
	}

	.metadata-badge {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 6px;
		height: 6px;
		background: var(--accent-color);
		border-radius: 50%;
		border: 1.5px solid var(--bg-primary);
	}

	.metadata-content {
		margin-top: var(--spacing-md);
		padding: var(--spacing-lg) 0;
		background: transparent;
		border: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xl);
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

	.metadata-subsection {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.subsection-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding-bottom: var(--spacing-sm);
		margin-bottom: var(--spacing-sm);
		border-bottom: 1px solid var(--border-color);
	}

	.subsection-header svg {
		color: var(--text-muted);
		opacity: 0.7;
	}

	.subsection-title {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.tags-wrapper {
		width: 100%;
		padding: var(--spacing-xs) 0;
	}

	/* TagManager styles override for better integration */
	.tags-wrapper :global(.tag-manager) {
		width: 100%;
	}

	.tags-wrapper :global(.tags-list) {
		width: 100%;
		align-items: flex-start;
	}

	.date-inputs-container {
		display: flex;
		gap: var(--spacing-md);
		flex-wrap: wrap;
	}

	.date-input-group {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		flex: 1;
		min-width: 200px;
		background: var(--bg-secondary);
		padding: var(--spacing-md) var(--spacing-lg);
		border-radius: var(--radius);
		border: 1px solid var(--border-color);
		position: relative;
		transition: var(--transition);
	}

	.date-input-group:hover {
		border-color: var(--border-hover);
		background: var(--bg-tertiary);
	}

	.date-input-group label {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		font-weight: var(--font-weight-medium);
		white-space: nowrap;
	}

	.date-input-group label svg {
		color: var(--text-muted);
		opacity: 0.7;
	}

	.date-input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--text-primary);
		font-size: var(--font-size-sm);
		padding: var(--spacing-xs);
		cursor: pointer;
		font-family: inherit;
	}

	.date-input:focus {
		outline: none;
	}

	.date-input::-webkit-calendar-picker-indicator {
		cursor: pointer;
		opacity: 0.6;
		transition: var(--transition);
	}

	.date-input::-webkit-calendar-picker-indicator:hover {
		opacity: 1;
	}

	.clear-date-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: var(--spacing-xs);
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.6;
	}

	.clear-date-btn:hover {
		background: var(--bg-tertiary);
		color: var(--error-color);
		opacity: 1;
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

	.editor-title.empty {
		color: var(--text-secondary);
		opacity: 0.7;
	}
</style>
