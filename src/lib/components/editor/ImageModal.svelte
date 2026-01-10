<script>
	import { createEventDispatcher } from 'svelte';
	import Icon from '../Icon.svelte';

	const dispatch = createEventDispatcher();

	export let showModal = false;
	export let url = '';
	export let file = null;

	let inputElement;

	function close() {
		showModal = false;
		url = '';
		file = null;
		dispatch('close');
	}

	function confirm() {
		if (url?.trim()) {
			dispatch('confirm', { url: url.trim() });
			close();
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Enter' && url?.trim()) {
			confirm();
		} else if (event.key === 'Escape') {
			close();
		}
	}

	function handleFileSelect(event) {
		const selectedFile = event.target.files[0];
		if (selectedFile && selectedFile.type.startsWith('image/')) {
			file = selectedFile;
			dispatch('fileSelected', { file: selectedFile });
		}
	}
</script>

{#if showModal}
	<div class="modal-overlay" on:click={close}>
		<div class="modal-content modal-content-wide" on:click|stopPropagation>
			<h3>Insert Image</h3>

			<!-- URL Input -->
			<div class="modal-section">
				<label class="modal-label">From URL</label>
				<input
					type="text"
					class="modal-input"
					placeholder="https://example.com/image.jpg"
					bind:value={url}
					on:input={() => { file = null; }}
					on:keydown={handleKeydown}
					autofocus
				/>
			</div>

			<!-- OR Divider -->
			<div class="modal-divider">
				<span>OR</span>
			</div>

			<!-- File Upload -->
			<div class="modal-section">
				<label class="modal-label">Upload Image</label>
				<input
					type="file"
					accept="image/*"
					class="modal-file-input"
					bind:this={inputElement}
					on:change={handleFileSelect}
				/>
				<button
					class="modal-btn-secondary"
					on:click={() => inputElement?.click()}
				>
					<Icon name="upload" size={16} />
					Choose File
				</button>
				{#if file}
					<p class="file-selected">✓ {file.name}</p>
				{/if}
			</div>

			<!-- Preview -->
			{#if url}
				<div class="image-preview">
					<img src={url} alt="Preview" />
				</div>
			{/if}

			<div class="modal-actions">
				<button class="modal-btn cancel" on:click={close}>Cancel</button>
				<button
					class="modal-btn confirm"
					on:click={confirm}
					disabled={!url?.trim()}
				>
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

	.modal-content-wide {
		min-width: 500px;
	}

	.modal-content h3 {
		margin: 0 0 1.5rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.modal-section {
		margin-bottom: 1.25rem;
	}

	.modal-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.modal-divider {
		display: flex;
		align-items: center;
		text-align: center;
		margin: 1.5rem 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.modal-divider::before,
	.modal-divider::after {
		content: '';
		flex: 1;
		border-bottom: 1px solid var(--border-color);
	}

	.modal-divider span {
		padding: 0 1rem;
	}

	.modal-file-input {
		display: none;
	}

	.modal-btn-secondary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: var(--transition);
		width: 100%;
		justify-content: center;
	}

	.modal-btn-secondary:hover {
		background: var(--bg-secondary);
		border-color: var(--accent-color);
	}

	.file-selected {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: var(--accent-color);
		font-weight: 500;
	}

	.image-preview {
		margin: 1rem 0;
		padding: 1rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		text-align: center;
	}

	.image-preview img {
		max-width: 100%;
		max-height: 200px;
		border-radius: var(--radius-sm);
		object-fit: contain;
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
