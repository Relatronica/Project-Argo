<script>
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let showModal = false;
	export let url = '';

	function close() {
		showModal = false;
		url = '';
		dispatch('close');
	}

	function confirm() {
		if (url?.trim()) {
			dispatch('confirm', { url: url.trim() });
			close();
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Enter') {
			confirm();
		} else if (event.key === 'Escape') {
			close();
		}
	}
</script>

{#if showModal}
	<div class="modal-overlay" on:click={close}>
		<div class="modal-content" on:click|stopPropagation>
			<h3>Insert Link</h3>
			<input
				type="text"
				class="modal-input"
				placeholder="Enter URL..."
				bind:value={url}
				on:keydown={handleKeydown}
				autofocus
			/>
			<div class="modal-actions">
				<button class="modal-btn cancel" on:click={close}>Cancel</button>
				<button class="modal-btn confirm" on:click={confirm} disabled={!url?.trim()}>
					Insert
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
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
		margin: 0 0 1.5rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.modal-input {
		width: 100%;
		padding: 0.75rem;
		background: var(--input-bg, var(--bg-primary));
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
		box-shadow: 0 0 0 2px var(--accent-light, rgba(59, 130, 246, 0.2));
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

	.modal-btn.confirm:hover:not(:disabled) {
		background: var(--accent-hover, #2563eb);
		border-color: var(--accent-hover, #2563eb);
	}

	.modal-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-btn.confirm:disabled:hover {
		background: var(--accent-color);
		border-color: var(--accent-color);
	}
</style>
