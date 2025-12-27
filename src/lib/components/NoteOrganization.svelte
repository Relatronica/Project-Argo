<script>
	import { onMount, onDestroy } from 'svelte';
	import { organizationPreferences, setSortBy, setSortOrder, setGroupBy, toggleShowFavoritesFirst } from '../stores/organizationStore.js';
	import Icon from './Icon.svelte';
	
	let showMenu = false;
	let menuElement;
	let buttonElement;
	
	function handleClickOutside(event) {
		if (showMenu && menuElement && buttonElement && 
		    !menuElement.contains(event.target) && 
		    !buttonElement.contains(event.target)) {
			showMenu = false;
		}
	}
	
	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="organization-controls">
	<button 
		class="organization-btn"
		bind:this={buttonElement}
		on:click={() => showMenu = !showMenu}
		title="Organize notes"
	>
		<Icon name="settings" size={16} />
		<span>Organize</span>
	</button>
	
	{#if showMenu}
		<div class="organization-menu" bind:this={menuElement}>
			<div class="menu-section">
				<label class="menu-label">Sort by</label>
				<div class="menu-options">
					<button 
						class="menu-option"
						class:active={$organizationPreferences.sortBy === 'date'}
						on:click={() => setSortBy('date')}
					>
						<Icon name="calendar" size={14} />
						Date
					</button>
					<button 
						class="menu-option"
						class:active={$organizationPreferences.sortBy === 'alphabetical'}
						on:click={() => setSortBy('alphabetical')}
					>
						<Icon name="text" size={14} />
						Alphabetical
					</button>
					<button 
						class="menu-option"
						class:active={$organizationPreferences.sortBy === 'favorites'}
						on:click={() => setSortBy('favorites')}
					>
						<Icon name="star" size={14} />
						Favorites
					</button>
				</div>
			</div>
			
			<div class="menu-section">
				<label class="menu-label">Order</label>
				<div class="menu-options">
					<button 
						class="menu-option"
						class:active={$organizationPreferences.sortOrder === 'desc'}
						on:click={() => setSortOrder('desc')}
					>
						<Icon name="arrow-down" size={14} />
						Newest First
					</button>
					<button 
						class="menu-option"
						class:active={$organizationPreferences.sortOrder === 'asc'}
						on:click={() => setSortOrder('asc')}
					>
						<Icon name="arrow-up" size={14} />
						Oldest First
					</button>
				</div>
			</div>
			
			<div class="menu-section">
				<label class="menu-label">Group by</label>
				<div class="menu-options">
					<button 
						class="menu-option"
						class:active={$organizationPreferences.groupBy === 'none'}
						on:click={() => setGroupBy('none')}
					>
						None
					</button>
					<button 
						class="menu-option"
						class:active={$organizationPreferences.groupBy === 'date'}
						on:click={() => setGroupBy('date')}
					>
						<Icon name="calendar" size={14} />
						Date
					</button>
					<button 
						class="menu-option"
						class:active={$organizationPreferences.groupBy === 'tags'}
						on:click={() => setGroupBy('tags')}
					>
						<Icon name="tag" size={14} />
						Tags
					</button>
					<button 
						class="menu-option"
						class:active={$organizationPreferences.groupBy === 'folders'}
						on:click={() => setGroupBy('folders')}
					>
						<Icon name="folderOpen" size={14} />
						Folders
					</button>
				</div>
			</div>
			
			<div class="menu-section">
				<label class="menu-toggle">
					<input 
						type="checkbox" 
						checked={$organizationPreferences.showFavoritesFirst}
						on:change={toggleShowFavoritesFirst}
					/>
					<span>Show favorites first</span>
				</label>
			</div>
		</div>
	{/if}
</div>

<style>
	.organization-controls {
		position: relative;
	}
	
	.organization-btn {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		white-space: nowrap;
		max-width: 100%;
	}
	
	.organization-btn span {
		font-size: 0.75rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	@media (max-width: 350px) {
		.organization-btn span {
			display: none;
		}
	}
	
	.organization-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}
	
	.organization-menu {
		position: absolute;
		top: 100%;
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		min-width: 200px;
		z-index: 1000;
		margin-top: 0.25rem;
		padding: 0.75rem;
	}
	
	.menu-section {
		margin-bottom: 1rem;
	}
	
	.menu-section:last-child {
		margin-bottom: 0;
	}
	
	.menu-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}
	
	.menu-options {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.menu-option {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: none;
		border: 1px solid transparent;
		color: var(--text-primary);
		text-align: left;
		cursor: pointer;
		transition: var(--transition);
		font-size: 0.85rem;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	
	.menu-option:hover {
		background: var(--bg-tertiary);
		border-color: var(--border-color);
	}
	
	.menu-option.active {
		background: var(--accent-light);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}
	
	.menu-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--text-primary);
	}
	
	.menu-toggle input[type="checkbox"] {
		cursor: pointer;
	}
</style>

