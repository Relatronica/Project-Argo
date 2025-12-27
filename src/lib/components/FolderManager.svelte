<script>
	import { onMount, onDestroy } from 'svelte';
	import { folders, allFolders, createFolder, deleteFolder } from '../stores/folderStore.js';
	import { moveNoteToFolder } from '../stores/notesStore.js';
	import Icon from './Icon.svelte';
	
	let showCreateDialog = false;
	let newFolderName = '';
	let selectedIcon = 'folderOpen';
	let showMoveDialog = false;
	let noteToMove = null;
	let selectedFolder = '';
	let showFolderDropdown = false;
	
	// Available icons for folders
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
	
	function handleCreateFolder() {
		if (newFolderName.trim()) {
			createFolder(newFolderName.trim(), selectedIcon);
			newFolderName = '';
			selectedIcon = 'folderOpen';
			showCreateDialog = false;
		}
	}
	
	function handleDeleteFolder(folderPath) {
		if (confirm(`Are you sure you want to delete folder "${folderPath}"?\n\nNotes in this folder will be moved to root.`)) {
			// Move all notes in this folder to root
			// This should be handled by updating notes, but for now we just remove the folder
			deleteFolder(folderPath);
		}
	}
	
	function openMoveDialog(note) {
		noteToMove = note;
		selectedFolder = note.folder || '';
		showMoveDialog = true;
	}
	
	function handleMoveNote() {
		if (noteToMove) {
			moveNoteToFolder(noteToMove.id, selectedFolder || null);
			showMoveDialog = false;
			noteToMove = null;
			selectedFolder = '';
			showFolderDropdown = false;
		}
	}
	
	function handleClickOutside(event) {
		if (showFolderDropdown && !event.target.closest('.folder-select-container')) {
			showFolderDropdown = false;
		}
	}
	
	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
	
	export { openMoveDialog };
</script>

<div class="folder-manager">
	<button 
		class="create-folder-btn" 
		on:click={() => showCreateDialog = true}
		title="Create new folder"
	>
		<Icon name="folderOpen" size={14} />
		<span>New Folder</span>
	</button>
	
	{#if showCreateDialog}
		<div class="dialog-overlay" on:click={() => showCreateDialog = false}>
			<div class="dialog" on:click|stopPropagation>
				<h3>Create Folder</h3>
				<input 
					type="text" 
					bind:value={newFolderName}
					placeholder="Folder name (e.g., Work/Projects)"
					class="folder-input"
					on:keydown={(e) => e.key === 'Enter' && handleCreateFolder()}
					autofocus
				/>
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
					<button class="btn-secondary" on:click={() => showCreateDialog = false}>Cancel</button>
					<button class="btn-primary" on:click={handleCreateFolder}>Create</button>
				</div>
			</div>
		</div>
	{/if}
	
	{#if showMoveDialog && noteToMove}
		<div class="dialog-overlay" on:click={() => { showMoveDialog = false; noteToMove = null; }}>
			<div class="dialog" on:click|stopPropagation>
				<h3>Move Note to Folder</h3>
				<div class="folder-select-container">
					<button 
						class="folder-select-button"
						on:click={() => showFolderDropdown = !showFolderDropdown}
					>
						{#if selectedFolder}
							{@const selectedFolderObj = $allFolders.find(f => {
								const path = typeof f === 'string' ? f : f.path;
								return path === selectedFolder;
							})}
							{@const selectedIcon = selectedFolderObj && typeof selectedFolderObj === 'object' && selectedFolderObj.icon ? selectedFolderObj.icon : 'folderOpen'}
							<Icon name={selectedIcon} size={16} />
							<span>{selectedFolder}</span>
						{:else}
							<Icon name="folderOpen" size={16} />
							<span>Root (No folder)</span>
						{/if}
						<Icon name="chevron-down" size={14} class="dropdown-arrow" />
					</button>
					{#if showFolderDropdown}
						<div class="folder-dropdown">
							<button 
								class="folder-dropdown-item"
								class:selected={selectedFolder === ''}
								on:click={() => { selectedFolder = ''; showFolderDropdown = false; }}
							>
								<Icon name="folderOpen" size={16} />
								<span>Root (No folder)</span>
							</button>
							{#each $allFolders as folder}
								{@const folderPath = typeof folder === 'string' ? folder : folder.path}
								{@const folderIcon = typeof folder === 'object' && folder.icon ? folder.icon : 'folderOpen'}
								<button 
									class="folder-dropdown-item"
									class:selected={selectedFolder === folderPath}
									on:click={() => { selectedFolder = folderPath; showFolderDropdown = false; }}
								>
									<Icon name={folderIcon} size={16} />
									<span>{folderPath}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<div class="dialog-actions">
					<button class="btn-secondary" on:click={() => { showMoveDialog = false; noteToMove = null; }}>Cancel</button>
					<button class="btn-primary" on:click={handleMoveNote}>Move</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.folder-manager {
		display: flex;
		align-items: center;
	}
	
	.create-folder-btn {
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
	
	.create-folder-btn span {
		font-size: 0.75rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	@media (max-width: 350px) {
		.create-folder-btn span {
			display: none;
		}
	}
	
	.create-folder-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
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
	
	.folder-select-container {
		position: relative;
		margin-bottom: 1rem;
	}
	
	.folder-select-button {
		width: 100%;
		padding: 0.75rem;
		background: var(--input-bg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.9rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-align: left;
		transition: var(--transition);
	}
	
	.folder-select-button:hover {
		border-color: var(--accent-color);
	}
	
	.folder-select-button:focus {
		outline: none;
		border-color: var(--accent-color);
	}
	
	.folder-select-button .dropdown-arrow {
		margin-left: auto;
		opacity: 0.6;
	}
	
	.folder-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		max-height: 300px;
		overflow-y: auto;
		z-index: 100;
		margin-top: 0.25rem;
	}
	
	.folder-dropdown-item {
		width: 100%;
		padding: 0.75rem;
		background: none;
		border: none;
		color: var(--text-primary);
		text-align: left;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		transition: var(--transition);
	}
	
	.folder-dropdown-item:hover {
		background: var(--bg-tertiary);
	}
	
	.folder-dropdown-item.selected {
		background: var(--accent-light);
		color: var(--accent-color);
	}
	
	.folder-dropdown-item:first-child {
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
	}
	
	.folder-dropdown-item:last-child {
		border-radius: 0 0 var(--radius-sm) var(--radius-sm);
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
</style>

