<script>
	import { onMount, onDestroy } from 'svelte';
	import Icon from './Icon.svelte';
	import NoteItem from './NoteItem.svelte';
	import { updateFolderIcon, allFolders, deleteFolder, renameFolder } from '../stores/folderStore.js';
	import { moveNoteToFolder, isNoteSearchMatch } from '../stores/notesStore.js';
	
	let dragOverCount = 0;
	let isDragOver = false;

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
	export let isNoteSearchMatchFn = null;
	
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
	let showMenu = false;
	let showRenameDialog = false;
	let newFolderName = '';
	let menuElement;
	let menuButtonElement;
	
	// Update selectedIcon when dialog opens
	$: if (showIconDialog) {
		selectedIcon = currentFolderIcon;
	}
	
	// Update newFolderName when rename dialog opens
	$: if (showRenameDialog) {
		newFolderName = getFolderDisplayName(folderPath);
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
	
	function handleMenuClick(event) {
		event.stopPropagation();
		showMenu = !showMenu;
	}
	
	function handleClickOutside(event) {
		if (showMenu && menuElement && menuButtonElement && 
		    !menuElement.contains(event.target) && 
		    !menuButtonElement.contains(event.target)) {
			showMenu = false;
		}
	}
	
	async function handleDeleteFolder() {
		if (!confirm(`Are you sure you want to delete folder "${getFolderDisplayName(folderPath)}"?\n\nNotes in this folder will be moved to root.`)) {
			return;
		}
		
		// Move all notes in this folder to root
		for (const note of folderNotes) {
			await moveNoteToFolder(note.id, null);
		}
		
		// Delete the folder
		deleteFolder(folderPath);
		showMenu = false;
	}
	
	function handleRenameFolder() {
		showMenu = false;
		showRenameDialog = true;
	}
	
	function handleSaveRename() {
		if (!newFolderName.trim()) {
			alert('Folder name cannot be empty');
			return;
		}
		
		const parentPath = getParentPath(folderPath);
		const newPath = parentPath ? `${parentPath}/${newFolderName.trim()}` : newFolderName.trim();
		
		if (newPath !== folderPath) {
			// Update all notes in this folder to use the new path
			folderNotes.forEach(note => {
				moveNoteToFolder(note.id, newPath);
			});
			
			// Rename the folder
			renameFolder(folderPath, newPath);
		}
		
		showRenameDialog = false;
		newFolderName = '';
	}
	
	function handleDragOver(event) {
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = 'move';
		if (!isDragOver) {
			isDragOver = true;
			dragOverCount = 1;
		}
	}
	
	function handleDragLeave(event) {
		event.preventDefault();
		event.stopPropagation();
		dragOverCount--;
		if (dragOverCount <= 0) {
			isDragOver = false;
			dragOverCount = 0;
		}
	}
	
	async function handleDrop(event) {
		event.preventDefault();
		event.stopPropagation();
		isDragOver = false;
		dragOverCount = 0;
		
		try {
			const data = JSON.parse(event.dataTransfer.getData('application/json'));
			if (data.type === 'note' && data.id) {
				// Don't move if already in this folder
				if (data.folder !== folderPath) {
					await moveNoteToFolder(data.id, folderPath);
				}
			}
		} catch (error) {
			console.error('Error handling drop:', error);
		}
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
	
	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
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
		
		<div class="group-header-wrapper">
			<button 
				class="group-header"
				class:collapsed={!isExpanded}
				class:has-parent={folderDepth > 0}
				class:root={folderDepth === 0}
				class:drag-over={isDragOver}
				on:click={() => onToggleFolder(folderPath)}
				on:dragover={handleDragOver}
				on:dragleave={handleDragLeave}
				on:drop={handleDrop}
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
			</button>
			<button
				class="folder-menu-btn"
				bind:this={menuButtonElement}
				on:click={handleMenuClick}
				title="Folder options"
			>
				<span class="menu-dots">⋯</span>
			</button>
			{#if showMenu}
				<div class="folder-menu" bind:this={menuElement}>
					<button class="menu-item" on:click={handleRenameFolder}>
						<Icon name="edit" size={14} />
						<span>Rename</span>
					</button>
					<button class="menu-item delete" on:click={handleDeleteFolder}>
						<Icon name="trash" size={14} />
						<span>Delete</span>
					</button>
				</div>
			{/if}
		</div>
		
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
		
		{#if showRenameDialog}
			<div class="dialog-overlay" on:click={() => showRenameDialog = false}>
				<div class="dialog" on:click|stopPropagation>
					<h3>Rename Folder</h3>
					<input 
						type="text" 
						bind:value={newFolderName}
						placeholder="Folder name"
						class="folder-input"
						on:keydown={(e) => {
							if (e.key === 'Enter') {
								handleSaveRename();
							} else if (e.key === 'Escape') {
								showRenameDialog = false;
								newFolderName = '';
							}
						}}
						autofocus
					/>
					<div class="dialog-actions">
						<button class="btn-secondary" on:click={() => {
							showRenameDialog = false;
							newFolderName = '';
						}}>Cancel</button>
						<button class="btn-primary" on:click={handleSaveRename}>Save</button>
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
						isSearchMatch={isNoteSearchMatchFn ? isNoteSearchMatchFn(note) : false}
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
		min-width: 0;
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
	
	.group-header.drag-over {
		background: var(--accent-light);
		border: 2px dashed var(--accent-color);
		border-radius: var(--radius-sm);
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
	
	.folder-input {
		width: 100%;
		padding: 0.75rem;
		background: var(--input-bg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}
	
	.folder-input:focus {
		outline: none;
		border-color: var(--accent-color);
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
	
	.group-header-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
	}
	
	.group-header-wrapper:hover .folder-menu-btn {
		opacity: 1;
	}
	
	.folder-menu-btn {
		opacity: 0;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-left: auto;
		margin-right: 0.25rem;
		flex-shrink: 0;
		line-height: 1;
	}
	
	.menu-dots {
		font-size: 1.2rem;
		line-height: 1;
		letter-spacing: -0.1em;
		transform: rotate(90deg);
		display: inline-block;
	}
	
	.folder-menu-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}
	
	.folder-menu {
		position: absolute;
		top: 100%;
		right: 0.25rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		min-width: 150px;
		z-index: 1000;
		margin-top: 0.25rem;
		padding: 0.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	
	.menu-item {
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
	
	.menu-item:hover {
		background: var(--bg-tertiary);
	}
	
	.menu-item.delete {
		color: var(--error-color);
	}
	
	.menu-item.delete:hover {
		background: rgba(239, 68, 68, 0.1);
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

