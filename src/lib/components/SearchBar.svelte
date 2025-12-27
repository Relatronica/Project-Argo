<script>
	import { searchQuery, allTags } from '../stores/notesStore.js';

	let query = '';
	let selectedTag = '';

	function handleInput() {
		updateSearch();
	}

	function handleTagSelect(tag) {
		selectedTag = tag;
		updateSearch();
	}

	function clearTag() {
		selectedTag = '';
		updateSearch();
	}

	function clearSearch() {
		query = '';
		selectedTag = '';
		searchQuery.set('');
	}

	function updateSearch() {
		let searchString = query.trim();
		if (selectedTag) {
			searchString = searchString ? `${searchString} #${selectedTag}` : `#${selectedTag}`;
		}
		searchQuery.set(searchString);
	}
</script>

<div class="search-bar">
	<div class="search-input-container">
		<input
			type="text"
			placeholder="Search notes..."
			bind:value={query}
			on:input={handleInput}
			class="search-input"
		/>
		{#if query}
			<button class="clear-btn" on:click={clearSearch}>×</button>
		{/if}
	</div>

	{#if $allTags.length > 0}
		<div class="tag-filters">
			{#each $allTags.slice(0, 10) as tag}
				<button
					class="tag-filter"
					class:active={selectedTag === tag}
					on:click={() => handleTagSelect(selectedTag === tag ? '' : tag)}
				>
					#{tag}
				</button>
			{/each}
			{#if selectedTag}
				<button class="clear-tag-btn" on:click={clearTag}>
					Clear filter
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.search-bar {
		position: relative;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-color, #333);
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		flex-shrink: 0;
	}

	.search-input-container {
		flex: 1;
		position: relative;
	}

	.search-input {
		width: 100%;
		padding: 0.5rem 2rem 0.5rem 0.75rem;
		background: var(--input-bg, #2a2a2a);
		border: 1px solid var(--border-color, #333);
		border-radius: 4px;
		color: var(--text-primary, #fff);
		font-size: 0.9rem;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-color, #4a9eff);
	}

	.clear-btn {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--text-secondary, #999);
		cursor: pointer;
		font-size: 1.5rem;
		line-height: 1;
		padding: 0;
		width: 1.5rem;
		height: 1.5rem;
	}

	.clear-btn:hover {
		color: var(--text-primary, #fff);
	}
</style>

