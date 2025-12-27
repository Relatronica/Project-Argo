<script>
	import Icon from './Icon.svelte';
	import NoteItem from './NoteItem.svelte';
	import { updateFolderIcon, allFolders } from '../stores/folderStore.js';

	export let folderPath;
	export let folderNotes = [];
	export let isExpanded = false;
	export let folderIcon = 'folderOpen'; // Fallback, but we'll use reactive value
	export let compactView = false;
	export let selectedId = null;
	export let togglingFavoriteId = null;
	export let deletingNoteId = null;
	export let onToggleFolder;
	export let onSelectNote;
	export let onToggleFavorite;
	export let onMoveNote;
	export let onDeleteNote;
	
	// Make folderIcon reactive to store changes
	$: currentFolderIcon = (() => {
		if (!folderPath) return 'folderOpen';
		const folder = $allFolders.find(f => {
			const path = typeof f === 'string' ? f : f.path;
			return path === folderPath;
		});
		if (folder && typeof folder === 'object' && folder.icon) {
			return folder.icon;
		}
		return folderIcon; // Fallback to prop
	})();
	
	let showIconDialog = false;
	let selectedIcon = currentFolderIcon;
	
	// Update selectedIcon when dialog opens
	$: if (showIconDialog) {
		selectedIcon = currentFolderIcon;
	}
	
	// Available icons for folders (same as FolderManager)
	const folderIcons = [
		{ name: 'folderOpen', label: 'Folder' },
		{ name: 'folder', label: 'Folder Closed' },
		{ name: 'briefcase', label: 'Work' },
		{ name: 'home', label: 'Home' },
		{ name: 'book', label: 'Books' },
		{ name: 'heart', label: 'Personal' },
		{ name: 'star', label: 'Favorites' },
		{ name: 'calendar', label: 'Events' },
		{ name: 'music', label: 'Music' },
		{ name: 'camera', label: 'Photos' },
		{ name: 'video', label: 'Videos' },
		{ name: 'gamepad', label: 'Games' },
		{ name: 'shopping', label: 'Shopping' },
		{ name: 'school', label: 'Education' },
		{ name: 'health', label: 'Health' },
		{ name: 'car', label: 'Transport' },
		{ name: 'travel', label: 'Travel' },
		{ name: 'food', label: 'Food' },
		{ name: 'coffee', label: 'Coffee' },
		{ name: 'project', label: 'Projects' },
		{ name: 'goals', label: 'Goals' },
		{ name: 'team', label: 'Team' },
		{ name: 'mail', label: 'Mail' },
		{ name: 'phone', label: 'Contacts' },
		{ name: 'location', label: 'Places' },
		{ name: 'tag', label: 'Tags' },
		{ name: 'lightbulb', label: 'Ideas' }
	];
	
	function handleChangeIcon(event) {
		event.stopPropagation();
		selectedIcon = currentFolderIcon;
		showIconDialog = true;
	}
	
	function handleSaveIcon() {
		updateFolderIcon(folderPath, selectedIcon);
		showIconDialog = false;
	}

	function getFolderDisplayName(path) {
		if (!path) return 'Root';
		const parts = path.split('/');
		return parts[parts.length - 1];
	}
	
	function getFolderDepth(path) {
		if (!path) return 0;
		return path.split('/').length;
	}
	
	function getParentPath(path) {
		if (!path) return null;
		const parts = path.split('/');
		parts.pop();
		return parts.length > 0 ? parts.join('/') : null;
	}
	
	$: folderDepth = getFolderDepth(folderPath);
	$: parentPath = getParentPath(folderPath);
	$: indentLevel = folderDepth > 0 ? folderDepth - 1 : 0;
</script>

<div class="note-group" style="--folder-depth: {indentLevel};">
	<div class="folder-wrapper">
		<!-- Connection lines for nested folders -->
		{#if indentLevel > 0}
			<div class="connection-lines">
				{#each Array(indentLevel) as _, i}
					<div class="connection-line" class:last={i === indentLevel - 1}></div>
				{/each}
			</div>
		{/if}
		
		<button 
			class="group-header"
			class:collapsed={!isExpanded}
			class:has-parent={folderDepth > 0}
			class:root={folderDepth === 0}
			on:click={() => onToggleFolder(folderPath)}
			title={isExpanded ? "Collapse folder" : "Expand folder"}
		>
			<Icon 
				name={isExpanded ? "chevron-down" : "chevron-right"} 
				size={12} 
				class="folder-chevron"
			/>
			<div class="folder-icon-wrapper" on:click|stopPropagation={handleChangeIcon} title="Change folder icon">
				<Icon 
					name={currentFolderIcon} 
					size={16}
					class="folder-icon"
				/>
			</div>
			<span class="folder-name">{getFolderDisplayName(folderPath)}</span>
			<span class="folder-count">({folderNotes.length})</span>
		</button>
		
		{#if showIconDialog}
			<div class="dialog-overlay" on:click={() => showIconDialog = false}>
				<div class="dialog" on:click|stopPropagation>
					<h3>Change Folder Icon</h3>
					<div class="icon-selector-section">
						<label class="icon-selector-label">Choose icon:</label>
						<div class="icon-selector">
							{#each folderIcons as icon}
								<button
									class="icon-option"
									class:selected={selectedIcon === icon.name}
									on:click={() => selectedIcon = icon.name}
									title={icon.label}
								>
									<Icon name={icon.name} size={20} />
								</button>
							{/each}
						</div>
					</div>
					<div class="dialog-actions">
						<button class="btn-secondary" on:click={() => showIconDialog = false}>Cancel</button>
						<button class="btn-primary" on:click={handleSaveIcon}>Save</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
	
	{#if isExpanded}
		<div class="folder-notes" style="--folder-depth: {folderDepth};">
			{#each folderNotes as note, index (note.id)}
				<div class="note-wrapper" class:last={index === folderNotes.length - 1}>
					{#if folderDepth > 0}
						<div class="note-connection-lines">
							{#each Array(folderDepth) as _, i}
								<div class="note-connection-line" class:last={i === folderDepth - 1}></div>
							{/each}
						</div>
					{/if}
					<NoteItem
						{note}
						{selectedId}
						{togglingFavoriteId}
						{deletingNoteId}
						{compactView}
						{onSelectNote}
						{onToggleFavorite}
						{onMoveNote}
						{onDeleteNote}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.note-group {
		margin-bottom: 0.25rem;
		position: relative;
	}
	
	.folder-wrapper {
		display: flex;
		align-items: stretch;
		position: relative;
	}
	
	.connection-lines {
		display: flex;
		flex-direction: row;
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		width: calc(var(--folder-depth, 0) * 1.5rem);
		pointer-events: none;
		z-index: 1;
	}
	
	.connection-line {
		width: 1.5rem;
		position: relative;
		height: 100%;
		opacity: 0.4;
	}
	
	.connection-line:not(.last) {
		border-left: 1px solid var(--border-color);
	}
	
	.connection-line.last {
		position: relative;
	}
	
	.connection-line.last::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 1px;
		border-left: 1px solid var(--border-color);
	}
	
	.connection-line.last::after {
		content: '';
		position: absolute;
		left: 0;
		bottom: 0.75rem;
		width: 0.75rem;
		height: 1px;
		border-bottom: 1px solid var(--border-color);
	}
	
	.group-header {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-secondary);
		padding: 0.5rem 0.875rem;
		margin-bottom: 0;
		background: transparent;
		border-radius: var(--radius-sm);
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		border: none;
		cursor: pointer;
		transition: var(--transition);
		text-align: left;
		margin-left: calc(var(--folder-depth, 0) * 1.5rem);
	}
	
	.group-header:not(.collapsed) {
		margin-bottom: 0.25rem;
	}
	
	.group-header.root {
		margin-left: 0;
		background: transparent;
	}
	
	.group-header.has-parent {
		padding-left: 0.875rem;
	}
	
	.group-header:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
		transform: translateX(2px);
	}
	
	.group-header.has-parent:hover {
		background: var(--bg-secondary);
	}
	
	.group-header.collapsed {
		opacity: 0.75;
	}
	
	.group-header.collapsed:hover {
		opacity: 1;
	}
	
	.folder-chevron {
		transition: transform 0.2s ease;
		flex-shrink: 0;
		color: var(--text-muted);
	}
	
	.group-header:hover .folder-chevron {
		color: var(--accent-color);
	}
	
	.folder-icon-wrapper {
		position: relative;
		flex-shrink: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
	}
	
	.folder-icon-wrapper:hover {
		background: var(--bg-primary);
		transform: scale(1.1);
	}
	
	.folder-icon {
		flex-shrink: 0;
		color: var(--accent-color);
		opacity: 0.9;
	}
	
	.group-header.collapsed .folder-icon {
		opacity: 0.6;
	}
	
	.dialog-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}
	
	.dialog {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 1.5rem;
		min-width: 300px;
		max-width: 90vw;
		box-shadow: var(--shadow-lg);
	}
	
	.dialog h3 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
		color: var(--text-primary);
	}
	
	.icon-selector-section {
		margin-bottom: 1rem;
	}
	
	.icon-selector-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}
	
	.icon-selector {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 0.5rem;
		max-height: 200px;
		overflow-y: auto;
		padding: 0.5rem;
		background: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-color);
	}
	
	.icon-option {
		background: var(--bg-secondary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 0.5rem;
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-secondary);
	}
	
	.icon-option:hover {
		background: var(--bg-primary);
		border-color: var(--accent-color);
		color: var(--accent-color);
		transform: scale(1.1);
	}
	
	.icon-option.selected {
		background: var(--accent-light);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}
	
	.dialog-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
	
	.btn-primary,
	.btn-secondary {
		padding: 0.5rem 1rem;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		cursor: pointer;
		border: 1px solid var(--border-color);
		transition: var(--transition);
	}
	
	.btn-primary {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}
	
	.btn-primary:hover {
		background: var(--accent-hover);
	}
	
	.btn-secondary {
		background: var(--bg-tertiary);
		color: var(--text-secondary);
	}
	
	.btn-secondary:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}
	
	.folder-name {
		flex: 1;
		text-transform: none;
		letter-spacing: normal;
		font-weight: 500;
	}
	
	.folder-count {
		font-size: 0.7rem;
		opacity: 0.6;
		font-weight: 500;
		color: var(--text-muted);
		background: var(--bg-primary);
		padding: 0.15rem 0.4rem;
		border-radius: var(--radius-sm);
	}
	
	.folder-notes {
		position: relative;
		margin-left: calc(var(--folder-depth, 0) * 1.5rem);
		padding-left: 0.5rem;
	}
	
	.note-wrapper {
		display: flex;
		align-items: flex-start;
		position: relative;
		margin-bottom: 0.25rem;
	}
	
	.note-connection-lines {
		display: flex;
		flex-direction: row;
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: calc(var(--folder-depth, 0) * 1.5rem);
		pointer-events: none;
		z-index: 1;
	}
	
	.note-connection-line {
		width: 1.5rem;
		position: relative;
		height: 100%;
		opacity: 0.35;
	}
	
	.note-connection-line:not(.last) {
		border-left: 1px solid var(--border-color);
	}
	
	.note-connection-line.last {
		position: relative;
	}
	
	.note-connection-line.last::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 1px;
		border-left: 1px solid var(--border-color);
	}
	
	.note-connection-line.last::after {
		content: '';
		position: absolute;
		left: 0;
		top: 0.5rem;
		width: 0.75rem;
		height: 1px;
		border-bottom: 1px solid var(--border-color);
	}
	
	.note-wrapper.last .note-connection-line:not(.last) {
		border-left: none;
	}
	
	.note-wrapper.last .note-connection-line.last::before {
		bottom: auto;
		height: 0.5rem;
	}
</style>

