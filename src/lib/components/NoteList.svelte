<script>
	import { filteredNotes, currentNote, loadNoteById, createNewNote, deleteNoteById, toggleNoteFavorite, moveNoteToFolder } from '../stores/notesStore.js';
	import { organizationPreferences, toggleCompactView } from '../stores/organizationStore.js';
	import { foldersFromNotes, allFolders, getFolderHierarchy, getFolderIcon } from '../stores/folderStore.js';
	import { expandedFolders, toggleFolder, initializeFolders } from '../stores/folderExpansionStore.js';
	import { organizeNotes, sortNotes } from '../utils/noteOrganization.js';
	import { extractNoteTitle, groupNotesByFolder } from '../utils/noteHelpers.js';
	import NoteItem from './NoteItem.svelte';
	import FolderGroup from './FolderGroup.svelte';
	import MoveMenu from './MoveMenu.svelte';
	import NoteOrganization from './NoteOrganization.svelte';
	import FolderManager from './FolderManager.svelte';
	import Icon from './Icon.svelte';

	let selectedId = null;
	let deletingNoteId = null;
	let togglingFavoriteId = null;
	let showMoveMenu = null; // noteId of note to move
	let moveMenuPosition = { x: 0, y: 0 };
	
	// Initialize all folders as expanded by default (only once)
	let foldersInitialized = false;
	$: if ($allFolders.length > 0 && !foldersInitialized) {
		const allFolderPaths = $allFolders.map(f => typeof f === 'string' ? f : f.path);
		allFolderPaths.push(''); // Include root
		initializeFolders(allFolderPaths);
		foldersInitialized = true;
	}
	
	// Get sorted folder entries to maintain consistent order
	$: sortedFolderEntries = folderGroups 
		? Object.entries(folderGroups).sort(([pathA], [pathB]) => {
			// Sort: root first, then alphabetically
			if (pathA === '') return -1;
			if (pathB === '') return 1;
			return pathA.localeCompare(pathB);
		})
		: [];

	$: if ($currentNote) {
		selectedId = $currentNote.id;
	}
	
	// Organize notes based on preferences
	$: organizedNotes = organizeNotes($filteredNotes, $organizationPreferences);
	
	// Group notes by folder if grouping is enabled
	// First sort notes according to preferences, then group them
	$: notesForFolderGroup = (() => {
		let notes = [...$filteredNotes];
		
		// Show favorites first if enabled
		if ($organizationPreferences.showFavoritesFirst && $organizationPreferences.sortBy !== 'favorites') {
			const favorites = notes.filter(n => n.favorite);
			const nonFavorites = notes.filter(n => !n.favorite);
			notes = [...favorites, ...nonFavorites];
		}
		
		// Sort notes according to preferences
		return sortNotes(
			notes, 
			$organizationPreferences.sortBy, 
			$organizationPreferences.sortOrder
		);
	})();
	$: folderGroups = groupNotesByFolder(notesForFolderGroup);
	
	// Get folder hierarchy (use allFolders to include manually created folders)
	$: folderHierarchy = getFolderHierarchy($allFolders.map(f => typeof f === 'string' ? f : f.path));
	
	// Helper to get folder icon
	function getFolderIconName(folderPath) {
		if (!folderPath) return 'folderOpen';
		const folder = $allFolders.find(f => {
			const path = typeof f === 'string' ? f : f.path;
			return path === folderPath;
		});
		if (folder && typeof folder === 'object' && folder.icon) {
			return folder.icon;
		}
		return 'folderOpen';
	}
	
	function handleToggleFolder(folderPath) {
		toggleFolder(folderPath);
	}
	
	function handleMoveNote(note, event) {
		event.stopPropagation();
		showMoveMenu = note.id;
		moveMenuPosition = { x: event.clientX, y: event.clientY };
	}
	
	function handleMoveToFolder(folderPath) {
		if (showMoveMenu) {
			moveNoteToFolder(showMoveMenu, folderPath || null);
			showMoveMenu = null;
		}
	}

	async function selectNote(note) {
		await loadNoteById(note.id);
	}

	function handleNewNote() {
		createNewNote();
		selectedId = null;
	}

	async function handleDeleteNote(note, event) {
		event.stopPropagation(); // Prevent note selection

		const confirmed = confirm(`Are you sure you want to delete "${extractNoteTitle(note)}"? This action cannot be undone.`);
		if (!confirmed) return;

		deletingNoteId = note.id;
		try {
			const success = await deleteNoteById(note.id);
			if (!success) {
				alert('Failed to delete note. Please try again.');
			}
		} catch (error) {
			console.error('Error deleting note:', error);
			alert('An error occurred while deleting the note.');
		} finally {
			deletingNoteId = null;
		}
	}
	
	async function handleToggleFavorite(note, event) {
		event.stopPropagation(); // Prevent note selection
		
		togglingFavoriteId = note.id;
		try {
			await toggleNoteFavorite(note.id);
		} catch (error) {
			console.error('Error toggling favorite:', error);
		} finally {
			togglingFavoriteId = null;
		}
	}
</script>

<div class="note-list">
	<div class="note-list-header">
		<div class="header-actions">
			<button 
				class="view-toggle-btn"
				class:compact={$organizationPreferences.compactView}
				on:click={toggleCompactView}
				title={$organizationPreferences.compactView ? "Switch to expanded view" : "Switch to compact view"}
			>
				<Icon name={$organizationPreferences.compactView ? "grid" : "list"} size={14} />
			</button>
			<FolderManager />
			<NoteOrganization />
			<button 
				class="new-note-btn"
				on:click={handleNewNote}
				title="Create new note"
			>
				<Icon name="plus" size={16} />
				<span>New</span>
			</button>
		</div>
	</div>

	<div class="notes">
		{#if organizedNotes.type === 'none'}
			{@const rootNotes = folderGroups[''] || []}
			{@const nonRootFolders = sortedFolderEntries.filter(([path]) => path !== '')}
			{@const hasFolders = nonRootFolders.length > 0}
			
			<!-- Show root notes directly (not in a folder) -->
			{#if rootNotes.length > 0}
				<div class="root-notes">
					{#each rootNotes as note (note.id)}
						<NoteItem
							{note}
							{selectedId}
							{togglingFavoriteId}
							{deletingNoteId}
							compactView={$organizationPreferences.compactView}
							onSelectNote={selectNote}
							onToggleFavorite={handleToggleFavorite}
							onMoveNote={handleMoveNote}
							onDeleteNote={handleDeleteNote}
						/>
					{/each}
				</div>
			{/if}
			
			<!-- Show folders (excluding root) -->
			{#if hasFolders}
				{#each nonRootFolders as [folderPath, folderNotes]}
					{#if folderNotes.length > 0}
						<FolderGroup
							folderPath={folderPath}
							folderNotes={folderNotes}
							isExpanded={$expandedFolders.includes(folderPath)}
							folderIcon={getFolderIconName(folderPath)}
							compactView={$organizationPreferences.compactView}
							{selectedId}
							{togglingFavoriteId}
							{deletingNoteId}
							onToggleFolder={handleToggleFolder}
							onSelectNote={selectNote}
							onToggleFavorite={handleToggleFavorite}
							onMoveNote={handleMoveNote}
							onDeleteNote={handleDeleteNote}
						/>
					{/if}
				{/each}
			{/if}
			
			<!-- Empty state -->
			{#if rootNotes.length === 0 && !hasFolders}
				<div class="empty-state">
					<p>No notes yet</p>
					<button on:click={handleNewNote}>Create your first note</button>
				</div>
			{/if}
		{:else if organizedNotes.type === 'date'}
			{#each Object.entries(organizedNotes.groups) as [groupName, groupNotes]}
				{#if groupNotes.length > 0}
					<div class="note-group">
						<div class="group-header">{groupName}</div>
						{#each groupNotes as note (note.id)}
							<NoteItem
								{note}
								{selectedId}
								{togglingFavoriteId}
								{deletingNoteId}
								onSelectNote={selectNote}
								onToggleFavorite={handleToggleFavorite}
								onMoveNote={handleMoveNote}
								onDeleteNote={handleDeleteNote}
							/>
						{/each}
					</div>
				{/if}
			{/each}
		{:else if organizedNotes.type === 'tags'}
			{#each Object.entries(organizedNotes.groups) as [tagName, tagNotes]}
				{#if tagNotes.length > 0}
					<div class="note-group">
						<div class="group-header">#{tagName}</div>
						{#each tagNotes as note (note.id)}
							<NoteItem
								{note}
								{selectedId}
								{togglingFavoriteId}
								{deletingNoteId}
								onSelectNote={selectNote}
								onToggleFavorite={handleToggleFavorite}
								onMoveNote={handleMoveNote}
								onDeleteNote={handleDeleteNote}
							/>
						{/each}
					</div>
				{/if}
			{/each}
		{:else if organizedNotes.type === 'folders'}
			{@const rootNotes = organizedNotes.groups[''] || []}
			{@const sortedFolderGroupEntries = Object.entries(organizedNotes.groups)
				.filter(([path]) => path !== '')
				.sort(([pathA], [pathB]) => pathA.localeCompare(pathB))}
			
			<!-- Show root notes directly (not in a folder) -->
			{#if rootNotes.length > 0}
				<div class="root-notes">
					{#each rootNotes as note (note.id)}
						<NoteItem
							{note}
							{selectedId}
							{togglingFavoriteId}
							{deletingNoteId}
							compactView={$organizationPreferences.compactView}
							onSelectNote={selectNote}
							onToggleFavorite={handleToggleFavorite}
							onMoveNote={handleMoveNote}
							onDeleteNote={handleDeleteNote}
						/>
					{/each}
				</div>
			{/if}
			
			<!-- Show folders (excluding root) -->
			{#each sortedFolderGroupEntries as [folderPath, folderNotes]}
				{#if folderNotes.length > 0}
					<FolderGroup
						folderPath={folderPath}
						folderNotes={folderNotes}
						isExpanded={$expandedFolders.includes(folderPath)}
						folderIcon={getFolderIconName(folderPath)}
						compactView={$organizationPreferences.compactView}
						{selectedId}
						{togglingFavoriteId}
						{deletingNoteId}
						onToggleFolder={handleToggleFolder}
						onSelectNote={selectNote}
						onToggleFavorite={handleToggleFavorite}
						onMoveNote={handleMoveNote}
						onDeleteNote={handleDeleteNote}
					/>
				{/if}
			{/each}
		{/if}
		
		<MoveMenu
			show={showMoveMenu !== null}
			position={moveMenuPosition}
			onClose={() => showMoveMenu = null}
			onMoveToFolder={handleMoveToFolder}
		/>
	</div>
</div>

<style>
	.note-list {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		background: var(--sidebar-bg, #1a1a1a);
		border-right: 1px solid var(--border-color, #333);
	}

	.note-list-header {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--sidebar-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--sidebar-bg);
		position: sticky;
		top: 0;
		z-index: 10;
		gap: 0.75rem;
		min-width: 0;
		overflow: visible;
	}
	
	.header-actions {
		display: flex;
		gap: 0.375rem;
		align-items: center;
		flex-shrink: 0;
		min-width: 0;
		overflow: visible;
	}
	
	.new-note-btn {
		background: var(--accent-color);
		border: 1px solid var(--accent-color);
		color: white;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0.5rem 0.8rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		white-space: nowrap;
		max-width: 100%;
		font-weight: 500;
	}
	
	.new-note-btn span {
		font-size: 0.75rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	@media (max-width: 350px) {
		.new-note-btn span {
			display: none;
		}
	}
	
	.new-note-btn:hover {
		background: var(--accent-hover, var(--accent-color));
		border-color: var(--accent-hover, var(--accent-color));
		color: white;
		transform: translateY(-1px);
		box-shadow: var(--shadow);
	}
	
	.view-toggle-btn {
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
		justify-content: center;
		flex-shrink: 0;
	}
	
	.view-toggle-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}
	
	.view-toggle-btn.compact {
		background: var(--accent-light);
		border-color: var(--accent-color);
		color: var(--accent-color);
	}


	.notes {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}
	
	.root-notes {
		margin-bottom: 0.75rem;
	}
	
	.root-notes :global(.note-item) {
		margin-bottom: 0.75rem;
		margin-left: 0;
	}
	
	.root-notes :global(.note-item.compact) {
		margin-bottom: 0.25rem;
	}
	
	.root-notes :global(.note-item:last-child) {
		margin-bottom: 0;
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
		color: var(--text-secondary, #999);
	}

	.empty-state button {
		margin-top: 1rem;
		background: var(--accent-color, #4a9eff);
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		cursor: pointer;
	}
	
	.note-group {
		margin-bottom: 1.5rem;
	}
	
	.group-header {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.5rem 1rem;
		margin-bottom: 0.5rem;
		background: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}
</style>
