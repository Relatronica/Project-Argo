<script>
	import { v4 as uuidv4 } from 'uuid';
	import Icon from '../Icon.svelte';

	export let comments = [];
	export let onCommentAdd;
	export let onCommentUpdate;
	export let onCommentDelete;
	export let onCommentClick;
	export let selectedCommentId = null;

	let newCommentText = '';
	let editingCommentId = null;
	let editingText = '';

	function handleAddComment() {
		if (!newCommentText.trim()) return;
		
		const comment = {
			id: uuidv4(),
			text: newCommentText.trim(),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			resolved: false
		};
		
		onCommentAdd?.(comment);
		newCommentText = '';
	}

	function handleEditComment(comment) {
		editingCommentId = comment.id;
		editingText = comment.text;
	}

	function handleSaveEdit(comment) {
		if (!editingText.trim()) {
			handleCancelEdit();
			return;
		}
		
		onCommentUpdate?.(comment.id, {
			...comment,
			text: editingText.trim(),
			updatedAt: new Date().toISOString()
		});
		
		editingCommentId = null;
		editingText = '';
	}

	function handleCancelEdit() {
		editingCommentId = null;
		editingText = '';
	}

	function handleDeleteComment(commentId) {
		if (confirm('Sei sicuro di voler eliminare questo commento?')) {
			onCommentDelete?.(commentId);
		}
	}

	function handleToggleResolve(comment) {
		onCommentUpdate?.(comment.id, {
			...comment,
			resolved: !comment.resolved,
			updatedAt: new Date().toISOString()
		});
	}

	function formatDate(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('it-IT', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Filter comments: show unresolved first, then resolved
	$: sortedComments = [...comments].sort((a, b) => {
		if (a.resolved !== b.resolved) {
			return a.resolved ? 1 : -1;
		}
		return new Date(b.createdAt) - new Date(a.createdAt);
	});
</script>

<div class="comment-panel">
	<div class="comment-panel-header">
		<h3>Commenti</h3>
		<div class="comment-header-actions">
			<span class="comment-count">{comments.length}</span>
		</div>
	</div>

	<div class="comment-input-section">
		<textarea
			class="comment-input"
			bind:value={newCommentText}
			placeholder="Aggiungi un commento..."
			on:keydown={(e) => {
				if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
					handleAddComment();
				}
			}}
		></textarea>
		<button 
			class="comment-add-btn" 
			on:click={handleAddComment}
			disabled={!newCommentText.trim()}
		>
			<Icon name="plus" size={16} />
			<span>Aggiungi</span>
		</button>
	</div>

	<div class="comment-list">
		{#each sortedComments as comment (comment.id)}
			<div 
				class="comment-item" 
				class:selected={selectedCommentId === comment.id}
				class:resolved={comment.resolved}
				on:click={() => onCommentClick?.(comment.id)}
			>
				<div class="comment-header">
					<div class="comment-meta">
						<span class="comment-date">{formatDate(comment.createdAt)}</span>
						{#if comment.updatedAt !== comment.createdAt}
							<span class="comment-edited">(modificato)</span>
						{/if}
					</div>
					<div class="comment-actions">
						{#if editingCommentId === comment.id}
							<button 
								class="comment-action-btn" 
								on:click|stopPropagation={() => handleSaveEdit(comment)}
								title="Salva"
							>
								<Icon name="check" size={14} />
							</button>
							<button 
								class="comment-action-btn" 
								on:click|stopPropagation={handleCancelEdit}
								title="Annulla"
							>
								<Icon name="x" size={14} />
							</button>
						{:else}
							<button 
								class="comment-action-btn" 
								on:click|stopPropagation={() => onCommentClick?.(comment.id)}
								title="Vai al testo commentato"
							>
								<Icon name="arrow-right" size={14} />
							</button>
							<button 
								class="comment-action-btn" 
								on:click|stopPropagation={() => handleToggleResolve(comment)}
								title={comment.resolved ? 'Riapri' : 'Risolvi'}
							>
								<Icon name={comment.resolved ? "refresh-cw" : "check-circle"} size={14} />
							</button>
							<button 
								class="comment-action-btn" 
								on:click|stopPropagation={() => handleEditComment(comment)}
								title="Modifica"
							>
								<Icon name="edit" size={14} />
							</button>
							<button 
								class="comment-action-btn delete" 
								on:click|stopPropagation={() => handleDeleteComment(comment.id)}
								title="Elimina"
							>
								<Icon name="trash" size={14} />
							</button>
						{/if}
					</div>
				</div>
				
				{#if editingCommentId === comment.id}
					<textarea
						class="comment-edit-input"
						bind:value={editingText}
						on:keydown={(e) => {
							if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
								handleSaveEdit(comment);
							} else if (e.key === 'Escape') {
								handleCancelEdit();
							}
						}}
						autofocus
					></textarea>
				{:else}
					<div class="comment-text">{comment.text}</div>
				{/if}
			</div>
		{:else}
			<div class="comment-empty">
				<p>Nessun commento</p>
				<span class="comment-empty-hint">Seleziona del testo e aggiungi un commento</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.comment-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-secondary);
		border-left: 1px solid var(--border-color);
	}

	.comment-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.comment-panel-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.comment-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.comment-count {
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
	}

	.comment-close-btn {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: var(--transition);
		opacity: 0.7;
	}

	.comment-close-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		opacity: 1;
	}

	.comment-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.comment-item {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 0.75rem;
		margin-bottom: 0.5rem;
		cursor: pointer;
		transition: var(--transition);
	}

	.comment-item:hover {
		border-color: var(--border-hover);
		background: var(--bg-tertiary);
	}

	.comment-item.selected {
		border-color: var(--accent-color);
		background: var(--accent-light);
	}

	.comment-item.resolved {
		opacity: 0.6;
	}

	.comment-item.resolved .comment-text {
		text-decoration: line-through;
	}

	.comment-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.comment-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.comment-date {
		font-weight: 500;
	}

	.comment-edited {
		font-style: italic;
		opacity: 0.7;
	}

	.comment-actions {
		display: flex;
		gap: 0.25rem;
	}

	.comment-action-btn {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: var(--transition);
		opacity: 0.7;
	}

	.comment-action-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
		opacity: 1;
	}

	.comment-action-btn.delete:hover {
		background: var(--error-color);
		color: white;
	}

	.comment-text {
		color: var(--text-primary);
		font-size: 0.875rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.comment-edit-input {
		width: 100%;
		min-height: 60px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 0.5rem;
		color: var(--text-primary);
		font-size: 0.875rem;
		font-family: inherit;
		resize: vertical;
		outline: none;
	}

	.comment-edit-input:focus {
		border-color: var(--accent-color);
	}

	.comment-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
		color: var(--text-secondary);
	}

	.comment-empty p {
		margin: 0 0 0.5rem 0;
		font-weight: 500;
	}

	.comment-empty-hint {
		font-size: 0.75rem;
		opacity: 0.7;
	}

	.comment-input-section {
		padding: 1rem;
		border-top: 1px solid var(--border-color);
		background: var(--bg-primary);
	}

	.comment-input {
		width: 100%;
		min-height: 80px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 0.75rem;
		color: var(--text-primary);
		font-size: 0.875rem;
		font-family: inherit;
		resize: vertical;
		outline: none;
		margin-bottom: 0.75rem;
	}

	.comment-input:focus {
		border-color: var(--accent-color);
	}

	.comment-input::placeholder {
		color: var(--text-secondary);
	}

	.comment-add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: var(--radius);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: var(--transition);
	}

	.comment-add-btn:hover:not(:disabled) {
		background: var(--accent-hover, var(--accent-color));
		transform: translateY(-1px);
		box-shadow: var(--shadow-sm);
	}

	.comment-add-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
