<script>
	import Icon from './Icon.svelte';
	import { allFolders } from '../stores/folderStore.js';
	import { browser } from '$app/environment';

	export let show = false;
	export let position = { x: 0, y: 0, bottom: 0 };
	export let onClose;
	export let onMoveToFolder;
</script>

{#if show}
	<div class="move-menu-overlay" on:click={onClose}>
		<div 
			class="move-menu" 
			style="left: {position.x}px; {position.bottom ? 'bottom: ' + position.bottom + 'px; top: auto;' : 'top: ' + position.y + 'px;'}" 
			on:click|stopPropagation
		>
			<div class="move-menu-header">Move to folder</div>
			<button 
				class="move-menu-item"
				on:click={() => onMoveToFolder(null)}
			>
				Root (No folder)
			</button>
			{#each $allFolders as folder}
				{@const folderPath = typeof folder === 'string' ? folder : folder.path}
				{@const folderIcon = typeof folder === 'object' && folder.icon ? folder.icon : 'folderOpen'}
				<button 
					class="move-menu-item"
					on:click={() => onMoveToFolder(folderPath)}
				>
					<Icon name={folderIcon} size={14} />
					{folderPath}
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.move-menu-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1001;
	}
	
	.move-menu {
		position: fixed;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		min-width: 200px;
		max-width: 300px;
		max-height: 400px;
		overflow-y: auto;
		padding: 0.5rem;
		z-index: 1002;
	}
	
	.move-menu-header {
		padding: 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--border-color);
		margin-bottom: 0.5rem;
	}
	
	.move-menu-item {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: none;
		border: none;
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
	
	.move-menu-item:hover {
		background: var(--accent-light);
		color: var(--accent-color);
	}
</style>

