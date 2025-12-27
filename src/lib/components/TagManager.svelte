<script>
	import { createEventDispatcher } from 'svelte';

	export let tags = [];
	export let availableTags = [];

	const dispatch = createEventDispatcher();

	let newTag = '';
	let showSuggestions = false;

	// Get all unique tags from all notes
	$: allTags = [...new Set(availableTags.flat())];

	function addTag(tag) {
		if (tag && !tags.includes(tag)) {
			tags = [...tags, tag];
			dispatch('change', { tags });
		}
		newTag = '';
		showSuggestions = false;
	}

	function removeTag(tagToRemove) {
		tags = tags.filter(tag => tag !== tagToRemove);
		dispatch('change', { tags });
	}

	function handleInput(event) {
		newTag = event.target.value;
		showSuggestions = newTag.length > 0;
	}

	function handleKeydown(event) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addTag(newTag.trim());
		} else if (event.key === 'Escape') {
			showSuggestions = false;
			newTag = '';
		}
	}

	$: filteredSuggestions = showSuggestions
		? allTags.filter(tag =>
			tag.toLowerCase().includes(newTag.toLowerCase()) &&
			!tags.includes(tag)
		).slice(0, 5)
		: [];
</script>

<div class="tag-manager">
	<div class="tags-list">
		{#each tags as tag (tag)}
			<span class="tag">
				#{tag}
				<button
					class="tag-remove"
					on:click={() => removeTag(tag)}
					aria-label="Remove tag {tag}"
				>
					×
				</button>
			</span>
		{/each}
	</div>

	<div class="tag-input-container">
		<input
			type="text"
			placeholder="Add tag..."
			bind:value={newTag}
			on:input={handleInput}
			on:keydown={handleKeydown}
			class="tag-input"
		/>

		{#if filteredSuggestions.length > 0}
			<div class="suggestions">
				{#each filteredSuggestions as suggestion}
					<button
						class="suggestion"
						on:click={() => addTag(suggestion)}
					>
						#{suggestion}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.tag-manager {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tags-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: var(--accent-light);
		color: var(--accent-color);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		font-weight: 500;
		border: 1px solid var(--accent-color);
	}

	.tag-remove {
		background: none;
		border: none;
		color: var(--accent-color);
		cursor: pointer;
		font-size: 1.2em;
		line-height: 1;
		padding: 0;
		width: 1em;
		height: 1em;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: var(--transition);
	}

	.tag-remove:hover {
		background: var(--accent-color);
		color: white;
	}

	.tag-input-container {
		position: relative;
	}

	.tag-input {
		width: 100%;
		padding: 0.5rem;
		background: var(--input-bg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.9rem;
		transition: var(--transition);
	}

	.tag-input:focus {
		outline: none;
		border-color: var(--accent-color);
		box-shadow: 0 0 0 2px var(--accent-light);
	}

	.suggestions {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		z-index: 100;
		max-height: 200px;
		overflow-y: auto;
	}

	.suggestion {
		width: 100%;
		padding: 0.5rem;
		background: none;
		border: none;
		color: var(--text-primary);
		text-align: left;
		cursor: pointer;
		font-size: 0.9rem;
		transition: var(--transition);
	}

	.suggestion:hover {
		background: var(--accent-light);
		color: var(--accent-color);
	}

	.suggestion:first-child {
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
	}

	.suggestion:last-child {
		border-radius: 0 0 var(--radius-sm) var(--radius-sm);
	}
</style>
