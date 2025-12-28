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
				<span class="tag-text">#{tag}</span>
				<button
					class="tag-remove"
					on:click={() => removeTag(tag)}
					aria-label="Remove tag {tag}"
					title="Remove tag"
				>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</span>
		{/each}
		<div class="tag-input-container">
			<input
				type="text"
				placeholder="Add tag..."
				bind:value={newTag}
				on:input={handleInput}
				on:keydown={handleKeydown}
				on:focus={() => showSuggestions = newTag.length > 0}
				on:blur={() => setTimeout(() => showSuggestions = false, 200)}
				class="tag-input"
			/>

			{#if filteredSuggestions.length > 0}
				<div class="suggestions">
					{#each filteredSuggestions as suggestion}
						<button
							class="suggestion"
							on:click={() => addTag(suggestion)}
							on:mousedown|preventDefault
						>
							<span class="suggestion-prefix">#</span>
							{suggestion}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.tag-manager {
		display: flex;
		align-items: center;
	}

	.tags-list {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		background: var(--accent-light);
		color: var(--accent-color);
		padding: 0.375rem 0.625rem;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		font-weight: 500;
		border: 1px solid var(--accent-color);
		transition: var(--transition);
	}

	.tag:hover {
		background: var(--accent-color);
		color: white;
	}

	.tag-text {
		display: inline-block;
	}

	.tag-remove {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0;
		width: 14px;
		height: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: var(--transition);
		opacity: 0.7;
		flex-shrink: 0;
	}

	.tag:hover .tag-remove {
		opacity: 1;
		background: rgba(255, 255, 255, 0.2);
	}

	.tag-remove:hover {
		background: rgba(255, 255, 255, 0.3) !important;
		opacity: 1;
	}

	.tag-input-container {
		position: relative;
		display: inline-block;
	}

	.tag-input {
		min-width: 120px;
		padding: 0.375rem 0.625rem;
		background: var(--input-bg, var(--bg-secondary));
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.8rem;
		transition: var(--transition);
		height: 28px;
	}

	.tag-input::placeholder {
		color: var(--text-secondary);
	}

	.tag-input:focus {
		outline: none;
		border-color: var(--accent-color);
		box-shadow: 0 0 0 2px var(--accent-light);
		background: var(--bg-primary);
	}

	.suggestions {
		position: absolute;
		top: calc(100% + 0.25rem);
		left: 0;
		min-width: 200px;
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
		padding: 0.5rem 0.75rem;
		background: none;
		border: none;
		color: var(--text-primary);
		text-align: left;
		cursor: pointer;
		font-size: 0.85rem;
		transition: var(--transition);
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.suggestion:hover {
		background: var(--accent-light);
		color: var(--accent-color);
	}

	.suggestion-prefix {
		color: var(--accent-color);
		font-weight: 600;
	}

	.suggestion:first-child {
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
	}

	.suggestion:last-child {
		border-radius: 0 0 var(--radius-sm) var(--radius-sm);
	}
</style>
