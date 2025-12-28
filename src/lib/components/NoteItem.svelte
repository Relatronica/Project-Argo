<script>
	import Icon from './Icon.svelte';
	import { prepareNoteItem } from '../utils/noteHelpers.js';
	import { updateNoteColor } from '../stores/notesStore.js';

	export let note;
	export let selectedId = null;
	export let togglingFavoriteId = null;
	export let deletingNoteId = null;
	export let compactView = false;
	export let isSearchMatch = false;
	export let onSelectNote;
	export let onToggleFavorite;
	export let onMoveNote;
	export let onDeleteNote;
	
	let showColorDialog = false;
	let selectedColor = note.color || null;
	let isDragging = false;
	
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
	
	function handleChangeColor(event) {
		event.stopPropagation();
		selectedColor = note.color || null;
		showColorDialog = true;
	}
	
	async function handleSaveColor() {
		await updateNoteColor(note.id, selectedColor);
		showColorDialog = false;
	}

	$: item = prepareNoteItem(note, selectedId);
	
	function handleDragStart(event) {
		isDragging = true;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('application/json', JSON.stringify({
			type: 'note',
			id: note.id,
			folder: note.folder || ''
		}));
		// Create a custom drag image
		const dragImage = event.target.cloneNode(true);
		dragImage.style.opacity = '0.5';
		dragImage.style.position = 'absolute';
		dragImage.style.top = '-1000px';
		document.body.appendChild(dragImage);
		event.dataTransfer.setDragImage(dragImage, 0, 0);
		setTimeout(() => document.body.removeChild(dragImage), 0);
	}
	
	function handleDragEnd(event) {
		isDragging = false;
	}
</script>

<button
	class="note-item"
	class:active={item.selected}
	class:favorite={note.favorite}
	class:compact={compactView}
	class:search-match={isSearchMatch}
	class:dragging={isDragging}
	draggable="true"
	on:dragstart={handleDragStart}
	on:dragend={handleDragEnd}
	on:click={() => !isDragging && onSelectNote(note)}
>
	{#if compactView}
		<div class="note-title-compact">
			{#if note.color}
				<div 
					class="note-color-indicator" 
					style="background-color: {note.color};"
					on:click|stopPropagation={handleChangeColor}
					title="Change note color"
				></div>
			{:else}
				<div 
					class="note-color-indicator no-color" 
					on:click|stopPropagation={handleChangeColor}
					title="Add note color"
				></div>
			{/if}
			{#if note.favorite}
				<Icon name="star" size={14} class="favorite-icon" />
			{/if}
			<span class="title-text">{item.title}</span>
		</div>
	{:else}
		<div class="note-header">
			<div class="note-title">
				{#if note.color}
					<div 
						class="note-color-indicator" 
						style="background-color: {note.color};"
						on:click|stopPropagation={handleChangeColor}
						title="Change note color"
					></div>
				{:else}
					<div 
						class="note-color-indicator no-color" 
						on:click|stopPropagation={handleChangeColor}
						title="Add note color"
					></div>
				{/if}
				{#if note.favorite}
					<Icon name="star" size={14} class="favorite-icon" />
				{/if}
				<span class="title-text">{item.title}</span>
			</div>
		</div>
		{#if item.preview}
			<div class="note-preview">
				{item.preview}
			</div>
		{/if}
		{#if note.tags && note.tags.length > 0 || item.date}
			<div class="note-meta">
				<span class="note-date">{item.date}</span>
				{#if note.tags && note.tags.length > 0}
					<div class="note-tags">
						{#each note.tags as tag}
							<span class="tag">#{tag}</span>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}

</button>

{#if showColorDialog}
	<div class="dialog-overlay" on:click={() => showColorDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Change Note Color</h3>
			<div class="color-selector-section">
				<label class="color-selector-label">Choose color:</label>
				<div class="color-selector">
					{#each noteColors as colorOption}
						<button
							class="color-option"
							class:selected={selectedColor === colorOption.value}
							on:click={() => selectedColor = colorOption.value}
							title={colorOption.label}
							style="background-color: {colorOption.hex};"
						>
							{#if selectedColor === colorOption.value}
								<Icon name="check" size={14} />
							{/if}
						</button>
					{/each}
				</div>
			</div>
			<div class="dialog-actions">
				<button class="btn-secondary" on:click={() => showColorDialog = false}>Cancel</button>
				<button class="btn-primary" on:click={handleSaveColor}>Save</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.note-item {
		width: 100%;
		padding: 0.875rem 1rem;
		margin-bottom: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		text-align: left;
		transition: var(--transition);
		position: relative;
		margin-left: 0.5rem;
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	
	.note-item.compact {
		padding: 0.625rem 1rem;
	}

	.note-item:hover {
		background: var(--note-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow);
	}

	.note-title-compact {
		display: flex;
		align-items: center;
		font-weight: 500;
		color: var(--text-primary);
		font-size: 0.85rem;
		line-height: 1.4;
		width: 100%;
		gap: 0.5rem;
	}

	.note-title-compact .title-text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}


	.note-item.active {
		background: var(--accent-light);
	}
	
	.note-item.search-match {
		background: var(--accent-light);
		opacity: 1;
	}
	
	.note-item.search-match:not(.active) {
		background: var(--accent-light);
		opacity: 0.6;
	}
	
	.note-item.dragging {
		opacity: 0.5;
		cursor: grabbing;
	}
	
	.note-item[draggable="true"] {
		cursor: grab;
	}
	
	.note-item[draggable="true"]:active {
		cursor: grabbing;
	}
	
	.note-item.favorite {
		border-left: 3px solid var(--accent-color);
	}
	
	.favorite-icon {
		color: var(--accent-color);
		margin-right: 0.25rem;
	}

	.note-header {
		margin-bottom: 0.5rem;
	}

	.note-title {
		font-weight: 600;
		color: var(--text-primary);
		font-size: 0.95rem;
		line-height: 1.3;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.note-title .title-text {
		flex: 1;
		min-width: 0;
	}

	.note-preview {
		color: var(--text-secondary);
		font-size: 0.85rem;
		line-height: 1.4;
		margin-bottom: 0.75rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.note-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-bottom: 0.5rem;
	}

	.note-item.active .note-title,
	.note-item.active .note-meta {
		color: var(--text-primary);
	}

	.note-item.active .note-preview {
		color: var(--text-secondary);
	}


	.note-tags {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.tag {
		background: var(--bg-tertiary);
		color: var(--accent-color);
		padding: 0.15rem 0.4rem;
		border-radius: var(--radius-sm);
		font-size: 0.7rem;
		font-weight: 500;
		border: 1px solid var(--border-color);
	}

	.note-item.active .tag {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.note-color-indicator {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 4px;
		cursor: pointer;
		transition: var(--transition);
		border: 1px solid var(--border-color);
		flex-shrink: 0;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.note-color-indicator:hover {
		transform: scale(1.1);
		box-shadow: 0 0 0 2px var(--accent-color);
		z-index: 1;
	}

	.note-color-indicator.no-color {
		background: white;
		border: 1px solid var(--border-color);
	}

	.note-color-indicator.no-color:hover {
		background: var(--bg-secondary);
		border-color: var(--accent-color);
	}

	.note-item.compact .note-color-indicator {
		width: 1rem;
		height: 1rem;
	}

	.dialog-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.dialog {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 1.5rem;
		min-width: 300px;
		max-width: 90vw;
		box-shadow: var(--shadow-lg);
	}

	.dialog h3 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.color-selector-section {
		margin-bottom: 1rem;
	}

	.color-selector-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.color-selector {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-color);
	}

	.color-option {
		aspect-ratio: 1;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		position: relative;
	}

	.color-option:hover {
		transform: scale(1.1);
		border-color: var(--accent-color);
	}

	.color-option.selected {
		border-color: var(--accent-color);
		border-width: 3px;
		box-shadow: 0 0 0 2px var(--accent-light);
	}

	.color-option:first-child {
		background: var(--bg-secondary) !important;
		border-style: dashed;
	}

	.dialog-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.5rem 1rem;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		cursor: pointer;
		border: 1px solid var(--border-color);
		transition: var(--transition);
	}

	.btn-primary {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.btn-primary:hover {
		background: var(--accent-hover);
	}

	.btn-secondary {
		background: var(--bg-tertiary);
		color: var(--text-secondary);
	}

	.btn-secondary:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}
</style>

