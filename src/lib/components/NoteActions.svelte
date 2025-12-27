<script>
	import Icon from './Icon.svelte';

	export let note;
	export let togglingFavoriteId = null;
	export let deletingNoteId = null;
	export let onToggleFavorite;
	export let onMoveNote;
	export let onDeleteNote;
</script>

<div class="note-actions">
	<button
		class="favorite-btn"
		class:active={note.favorite}
		on:click={(event) => onToggleFavorite(note, event)}
		disabled={togglingFavoriteId === note.id}
		title={note.favorite ? "Remove from favorites" : "Add to favorites"}
	>
		<Icon name="star" size={14} />
	</button>
	{#if note.encrypted}
		<div class="encryption-indicator" title="Encrypted">
			<Icon name="lock" size={12} />
		</div>
	{/if}
	<button
		class="move-btn"
		on:click={(event) => onMoveNote(note, event)}
		title="Move to folder"
	>
		<Icon name="folderOpen" size={14} />
	</button>
	<button
		class="delete-btn"
		on:click={(event) => onDeleteNote(note, event)}
		disabled={deletingNoteId === note.id}
		title="Delete note"
	>
		<Icon name="trash" size={14} />
	</button>
</div>

<style>
	.note-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		opacity: 0;
		transform: translateY(4px);
		transition: opacity var(--transition), transform var(--transition);
	}
	
	/* Show actions on parent hover */
	:global(.note-item:hover .note-actions) {
		opacity: 1;
		transform: translateY(0);
	}
	
	/* Always show if favorite is active */
	:global(.note-item.favorite .note-actions .favorite-btn.active) {
		opacity: 1;
	}
	
	
	.favorite-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.favorite-btn:hover:not(:disabled) {
		background: var(--accent-light);
		color: var(--accent-color);
		transform: scale(1.1);
	}
	
	.favorite-btn.active {
		color: var(--accent-color);
		opacity: 1;
	}
	
	.favorite-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.encryption-indicator {
		font-size: 0.8rem;
		flex-shrink: 0;
		color: var(--text-primary, #fff);
	}
	
	.encryption-indicator :global(.icon) {
		color: var(--text-primary, #fff);
	}

	.delete-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		flex-shrink: 0;
	}

	.delete-btn:hover:not(:disabled) {
		background: var(--error-color);
		color: white;
		transform: scale(1.1);
	}

	.delete-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}
	
	.move-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.move-btn:hover {
		background: var(--accent-light);
		color: var(--accent-color);
		transform: scale(1.1);
	}
</style>

