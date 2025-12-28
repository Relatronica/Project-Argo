<script>
	import { searchQuery, allTags } from '../stores/notesStore.js';
	import Icon from './Icon.svelte';

	let query = '';
	let selectedTag = '';
	let isFocused = false;

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
	<div class="search-wrapper">
		<Icon name="search" size={16} class="search-icon" />
		<div class="search-input-container">
			<input
				type="text"
				placeholder="Search notes..."
				bind:value={query}
				on:input={handleInput}
				on:focus={() => isFocused = true}
				on:blur={() => isFocused = false}
				class="search-input"
				class:focused={isFocused}
			/>
			{#if query}
				<button class="clear-btn" on:click={clearSearch} title="Clear search">
					<Icon name="x" size={14} />
				</button>
			{/if}
		</div>
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
		border-bottom: 1px solid var(--sidebar-border);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		flex-shrink: 0;
		background: var(--sidebar-bg);
	}

	.search-wrapper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.875rem;
	}

	.search-icon {
		font-size: 16px;
		color: var(--accent-color);
		opacity: 0.9;
		flex-shrink: 0;
	}

	.search-input-container {
		flex: 1;
		position: relative;
		min-width: 0;
	}

	.search-input {
		width: 100%;
		padding: 0;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: 600;
		transition: var(--transition);
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted);
		font-weight: 600;
	}

	.search-input.focused {
		color: var(--text-primary);
	}

	.clear-btn {
		position: absolute;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: var(--spacing-xs);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		transition: var(--transition-fast);
		width: 1.25rem;
		height: 1.25rem;
	}

	.clear-btn:hover {
		color: var(--text-primary);
		background: var(--bg-tertiary);
	}

	.clear-btn:active {
		transform: translateY(-50%) scale(0.95);
	}

	.tag-filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		margin-top: var(--spacing-sm);
		width: 100%;
	}

	.tag-filter {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: var(--font-size-xs);
		color: var(--text-secondary);
		cursor: pointer;
		transition: var(--transition-fast);
		font-weight: var(--font-weight-medium);
		white-space: nowrap;
	}

	.tag-filter:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
		transform: translateY(-1px);
	}

	.tag-filter.active {
		background: var(--accent-color);
		border-color: var(--accent-color);
		color: white;
		box-shadow: var(--shadow-xs);
	}

	.tag-filter.active:hover {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow-sm);
	}

	.clear-tag-btn {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: var(--font-size-xs);
		color: var(--text-secondary);
		cursor: pointer;
		transition: var(--transition-fast);
		font-weight: var(--font-weight-medium);
	}

	.clear-tag-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}
</style>

