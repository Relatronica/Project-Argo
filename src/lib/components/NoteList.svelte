<script>
	import { filteredNotes, currentNote, loadNoteById, createNewNote, deleteNoteById, toggleNoteFavorite, moveNoteToFolder, notesMetadata, searchQuery, isNoteSearchMatch } from '../stores/notesStore.js';
	import { organizationPreferences } from '../stores/organizationStore.js';
	import { foldersFromNotes, allFolders, getFolderHierarchy, getFolderIcon } from '../stores/folderStore.js';
	import { expandedFolders, toggleFolder, initializeFolders } from '../stores/folderExpansionStore.js';
	import { organizeNotes, sortNotes } from '../utils/noteOrganization.js';
	import { extractNoteTitle, groupNotesByFolder } from '../utils/noteHelpers.js';
	import { isLoadingNote, setLoadingNote } from '../stores/loadingStore.js';
	import { get } from 'svelte/store';
	import NoteItem from './NoteItem.svelte';
	import FolderGroup from './FolderGroup.svelte';
	import MoveMenu from './MoveMenu.svelte';
	import FolderManager from './FolderManager.svelte';
	import SettingsModal from './SettingsModal.svelte';
	import Icon from './Icon.svelte';

	let selectedId = null;
	let deletingNoteId = null;
	let togglingFavoriteId = null;
	let showMoveMenu = null; // noteId of note to move
	let moveMenuPosition = { x: 0, y: 0 };
	let dragOverRoot = false;
	let draggedNoteId = null;
	let draggedNoteFolder = null;
	
	// Initialize all folders as expanded by default (only once)
	let foldersInitialized = false;
	$: if ($allFolders.length > 0 && !foldersInitialized) {
		const allFolderPaths = $allFolders.map(f => typeof f === 'string' ? f : f.path);
		allFolderPaths.push(''); // Include root
		initializeFolders(allFolderPaths);
		foldersInitialized = true;
	}
	
	// Auto-expand folders containing search matches
	let lastSearchQuery = '';
	$: if ($searchQuery.trim() && $searchQuery !== lastSearchQuery) {
		lastSearchQuery = $searchQuery;
		const matchingNotes = $notesMetadata.filter(note => $isNoteSearchMatch(note));
		const foldersToExpand = new Set();
		matchingNotes.forEach(note => {
			if (note.folder) {
				// Add folder and all parent folders
				const parts = note.folder.split('/');
				let currentPath = '';
				parts.forEach(part => {
					currentPath = currentPath ? `${currentPath}/${part}` : part;
					foldersToExpand.add(currentPath);
				});
			}
		});
		// Expand all folders containing matches (only if not already expanded)
		if (foldersToExpand.size > 0) {
			const foldersArray = Array.from(foldersToExpand);
			const newFolders = foldersArray.filter(folderPath => !$expandedFolders.includes(folderPath));
			if (newFolders.length > 0) {
				expandedFolders.update(folders => [...folders, ...newFolders]);
			}
		}
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
	
	// When searching, show all notes but highlight matches. Otherwise, use filtered notes
	$: notesToDisplay = $searchQuery.trim() ? $notesMetadata : $filteredNotes;
	
	// Organize notes based on preferences
	$: organizedNotes = organizeNotes($filteredNotes, $organizationPreferences, $allFolders);
	
	// Group notes by folder if grouping is enabled
	// First sort notes according to preferences, then group them
	$: notesForFolderGroup = (() => {
		let notes = [...notesToDisplay];
		
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
	$: folderGroups = (() => {
		// First group notes by folder
		const groups = groupNotesByFolder(notesForFolderGroup);
		
		// Add all folders from $allFolders (including empty ones)
		$allFolders.forEach(folder => {
			const folderPath = typeof folder === 'string' ? folder : folder.path;
			if (!groups[folderPath]) {
				groups[folderPath] = [];
			}
		});
		
		return groups;
	})();
	
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

	// Track loading state to prevent race conditions when switching notes rapidly
	let isLoadingNoteLocal = false;
	let pendingNoteId = null;

	async function selectNote(note) {
		// If the same note is already selected, do nothing
		const $currentNote = get(currentNote);
		if ($currentNote && $currentNote.id === note.id) {
			return;
		}

		// If we're already loading, prevent click (loading state will handle it)
		const $isLoadingNote = get(isLoadingNote);
		if ($isLoadingNote || isLoadingNoteLocal) {
			console.log('[NoteList] Note selection in progress, ignoring click');
			return;
		}

		const noteIdToLoad = note.id;
		
		// Start loading - update both local and shared store
		isLoadingNoteLocal = true;
		pendingNoteId = noteIdToLoad;
		setLoadingNote(true, '', 'loading');
		
		try {
			const loadedNote = await loadNoteById(noteIdToLoad);
			
			// Check if user selected a different note while we were loading
			if (pendingNoteId !== noteIdToLoad && pendingNoteId) {
				console.log('[NoteList] Note changed during load, processing pending:', pendingNoteId);
				// Load the pending note instead (we need to find it in the metadata)
				const $notesMetadata = get(notesMetadata);
				const pendingNote = $notesMetadata.find(n => n.id === pendingNoteId);
				if (pendingNote) {
					// Reset state and load the pending note
					isLoadingNoteLocal = false;
					const pendingId = pendingNoteId;
					pendingNoteId = null;
					// Load the pending note
					try {
						setLoadingNote(true, '', 'loading');
						const pendingLoadedNote = await loadNoteById(pendingId);
						if (pendingLoadedNote) {
							currentNote.set(pendingLoadedNote);
						}
					} catch (error) {
						console.error('[NoteList] Error loading pending note:', error);
					} finally {
						setLoadingNote(false);
					}
				}
				return;
			}
			
			// Load completed successfully, set the note
			if (loadedNote) {
				currentNote.set(loadedNote);
				// Don't clear loading here - EditorContainer will clear it when editor is ready
				// Add a safety timeout to clear loading if editor doesn't respond (5 seconds)
				setTimeout(() => {
					const $isLoading = get(isLoadingNote);
					if ($isLoading) {
						console.warn('[NoteList] Loading timeout - clearing loading state');
						setLoadingNote(false);
					}
				}, 5000);
			} else {
				// No note loaded, clear loading immediately
				isLoadingNoteLocal = false;
				pendingNoteId = null;
				setLoadingNote(false);
			}
		} catch (error) {
			console.error('[NoteList] Error loading note:', error);
			// Always clear loading on error
			isLoadingNoteLocal = false;
			pendingNoteId = null;
			setLoadingNote(false);
		} finally {
			// Only clear loading state if this is still the current request
			if (pendingNoteId === noteIdToLoad) {
				isLoadingNoteLocal = false;
				pendingNoteId = null;
				// Don't clear loading here - EditorContainer will clear it when editor is ready
				// This ensures smooth transition from loading to editor ready
			}
		}
	}

	async function handleNewNote() {
		await createNewNote();
		selectedId = null;
	}
	
	function handleRootDragOver(event) {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		dragOverRoot = true;
	}
	
	function handleRootDragLeave(event) {
		event.preventDefault();
		dragOverRoot = false;
	}
	
	async function handleRootDrop(event) {
		event.preventDefault();
		dragOverRoot = false;
		
		try {
			const data = JSON.parse(event.dataTransfer.getData('application/json'));
			if (data.type === 'note' && data.id) {
				// Move to root (null folder)
				if (data.folder !== '') {
					await moveNoteToFolder(data.id, null);
				}
			}
		} catch (error) {
			console.error('Error handling root drop:', error);
		}
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
			<FolderManager />
			<button 
				class="new-note-btn"
				on:click={handleNewNote}
				title="Create new note"
			>
				<Icon name="plus" size={16} />
				<span>New</span>
			</button>
			<SettingsModal />
		</div>
	</div>

	<div class="notes" class:loading={$isLoadingNote}>
		{#if organizedNotes.type === 'none'}
			{@const rootNotes = folderGroups[''] || []}
			{@const nonRootFolders = sortedFolderEntries.filter(([path]) => path !== '')}
			{@const hasFolders = nonRootFolders.length > 0}
			
			<!-- Show root notes directly (not in a folder) -->
			{#if rootNotes.length > 0}
				<div 
					class="root-notes"
					class:drag-over={dragOverRoot}
					on:dragover={handleRootDragOver}
					on:dragleave={handleRootDragLeave}
					on:drop={handleRootDrop}
				>
					{#each rootNotes as note (`${note.id}-${note.color || 'none'}`)}
						<NoteItem
							{note}
							{selectedId}
							{togglingFavoriteId}
							{deletingNoteId}
							compactView={$organizationPreferences.compactView}
							isSearchMatch={$searchQuery.trim() ? $isNoteSearchMatch(note) : false}
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
					<FolderGroup
						folderPath={folderPath}
						folderNotes={folderNotes}
						isExpanded={$expandedFolders.includes(folderPath)}
						folderIcon={getFolderIconName(folderPath)}
						compactView={$organizationPreferences.compactView}
						{selectedId}
						{togglingFavoriteId}
						{deletingNoteId}
						isNoteSearchMatchFn={$searchQuery.trim() ? $isNoteSearchMatch : null}
						onToggleFolder={handleToggleFolder}
						onSelectNote={selectNote}
						onToggleFavorite={handleToggleFavorite}
						onMoveNote={handleMoveNote}
						onDeleteNote={handleDeleteNote}
					/>
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
								isSearchMatch={$searchQuery.trim() ? $isNoteSearchMatch(note) : false}
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
								isSearchMatch={$searchQuery.trim() ? $isNoteSearchMatch(note) : false}
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
					{#each rootNotes as note (`${note.id}-${note.color || 'none'}`)}
						<NoteItem
							{note}
							{selectedId}
							{togglingFavoriteId}
							{deletingNoteId}
							compactView={$organizationPreferences.compactView}
							isSearchMatch={$searchQuery.trim() ? $isNoteSearchMatch(note) : false}
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
				<FolderGroup
					folderPath={folderPath}
					folderNotes={folderNotes}
					isExpanded={$expandedFolders.includes(folderPath)}
					folderIcon={getFolderIconName(folderPath)}
					compactView={$organizationPreferences.compactView}
					{selectedId}
					{togglingFavoriteId}
					{deletingNoteId}
					isNoteSearchMatchFn={$searchQuery.trim() ? $isNoteSearchMatch : null}
					onToggleFolder={handleToggleFolder}
					onSelectNote={selectNote}
					onToggleFavorite={handleToggleFavorite}
					onMoveNote={handleMoveNote}
					onDeleteNote={handleDeleteNote}
				/>
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
		flex-direction: column;
		background: var(--sidebar-bg);
		position: sticky;
		top: 0;
		z-index: 10;
		gap: 0.5rem;
		min-width: 0;
		overflow: visible;
	}
	
	.header-actions {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 100%;
	}
	
	.new-note-btn {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-secondary);
		padding: 0.5rem 0.875rem;
		background: transparent;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		border: none;
		cursor: pointer;
		transition: var(--transition);
		text-align: left;
		width: 100%;
	}
	
	.new-note-btn :global(.icon) {
		font-size: 16px;
		color: var(--accent-color);
		opacity: 0.9;
		flex-shrink: 0;
	}
	
	.new-note-btn span {
		flex: 1;
		text-transform: none;
		letter-spacing: normal;
		font-weight: 500;
	}
	
	.new-note-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
		transform: translateX(2px);
	}
	
	.new-note-btn:active {
		transform: translateX(0);
	}
	
	.notes {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 0.5rem;
		scroll-behavior: smooth;
		transition: opacity 0.2s ease;
	}

	.notes.loading {
		pointer-events: none;
		opacity: 0.6;
		position: relative;
	}

	.notes.loading::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.02);
		z-index: 1;
		cursor: wait;
	}

	/* Custom scrollbar styling for better UX */
	.notes::-webkit-scrollbar {
		width: 8px;
	}

	.notes::-webkit-scrollbar-track {
		background: transparent;
	}

	.notes::-webkit-scrollbar-thumb {
		background: var(--border-color, rgba(255, 255, 255, 0.1));
		border-radius: 4px;
	}

	.notes::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted, rgba(255, 255, 255, 0.2));
	}
	
	.root-notes {
		margin-bottom: 0.75rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
	}
	
	.root-notes.drag-over {
		background: var(--accent-light);
		border: 2px dashed var(--accent-color);
		padding: 0.5rem;
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
