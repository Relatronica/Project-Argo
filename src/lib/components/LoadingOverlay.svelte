<script>
	import { isLoadingNote, loadingMessage } from '../stores/loadingStore.js';
</script>

{#if $isLoadingNote}
	<div class="loading-overlay">
		<div class="loading-content">
			<div class="loading-spinner">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-opacity="0.25"/>
					<path d="M12 2C6.477 2 2 6.477 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
				</svg>
			</div>
			{#if $loadingMessage}
				<p class="loading-message">{$loadingMessage}</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(var(--bg-primary-rgb, 26, 26, 26), 0.7);
		backdrop-filter: blur(2px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.loading-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
	}

	.loading-spinner {
		color: var(--accent-color);
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.loading-message {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		font-weight: var(--font-weight-medium);
		text-align: center;
	}
</style>
