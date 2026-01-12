<script>
	import { onMount, onDestroy } from 'svelte';
	import { currentNote } from '../stores/notesStore.js';
	import EditorContainer from './EditorContainer.svelte';

	// Format date for display
	function formatDate(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('it-IT', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
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
				<!-- Note Date Field -->
				<div class="editor-date-section">
					<div class="editor-date">
						{#if $currentNote.updated}
							{formatDate($currentNote.updated)}
						{:else if $currentNote.created}
							{formatDate($currentNote.created)}
						{/if}
					</div>
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

	.editor-date-section {
		padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-md) var(--spacing-xl);
		max-width: 800px;
		margin: 0 auto;
		width: 100%;
		border-bottom: 1px solid var(--border-color);
		margin-bottom: 0;
	}

	.editor-date {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-secondary);
		margin: 0;
		padding: 0.5rem 0;
		text-align: center;
	}
</style>
