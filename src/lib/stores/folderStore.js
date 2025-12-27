import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { notesMetadata } from './notesStore.js';
import { logger } from '../utils/logger.js';

/**
 * Store for folder management
 * Handles folder creation, deletion, and organization
 */

const STORAGE_KEY = 'notes-folders';

// Load folders from localStorage
function loadFolders() {
	if (!browser) return [];
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			// Handle migration from old format (array of strings) to new format (array of objects)
			if (parsed.length > 0 && typeof parsed[0] === 'string') {
				// Old format - convert to new format
				return parsed.map(path => ({ path, icon: 'folderOpen' }));
			}
			return parsed;
		}
	} catch (error) {
		logger.error('Error loading folders:', error);
	}
	
	return [];
}

// Create writable store with initial value
export const folders = writable(loadFolders());

// Save folders to localStorage whenever they change
if (browser) {
	folders.subscribe((foldersList) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(foldersList));
		} catch (error) {
			logger.error('Error saving folders:', error);
		}
	});
}

/**
 * Get all unique folders from notes
 */
export const foldersFromNotes = derived(
	[notesMetadata],
	([$notesMetadata]) => {
		const folderSet = new Set();
		$notesMetadata.forEach(note => {
			if (note.folder) {
				// Support nested folders (e.g., "Work/Projects")
				const parts = note.folder.split('/');
				let currentPath = '';
				parts.forEach(part => {
					currentPath = currentPath ? `${currentPath}/${part}` : part;
					folderSet.add(currentPath);
				});
			}
		});
		return Array.from(folderSet).sort();
	}
);

/**
 * Get all folders (combines manually created folders with folders from notes)
 */
export const allFolders = derived(
	[folders, foldersFromNotes],
	([$folders, $foldersFromNotes]) => {
		const folderMap = new Map();
		
		// Add manually created folders (with icons)
		$folders.forEach(folder => {
			if (typeof folder === 'string') {
				folderMap.set(folder, { path: folder, icon: 'folderOpen' });
			} else {
				folderMap.set(folder.path, folder);
			}
		});
		
		// Add folders from notes (default icon)
		$foldersFromNotes.forEach(path => {
			if (!folderMap.has(path)) {
				folderMap.set(path, { path, icon: 'folderOpen' });
			}
		});
		
		return Array.from(folderMap.values()).sort((a, b) => a.path.localeCompare(b.path));
	}
);

/**
 * Get folder icon by path
 */
export function getFolderIcon(folderPath) {
	const $folders = get(folders);
	const folder = $folders.find(f => {
		if (typeof f === 'string') return f === folderPath;
		return f.path === folderPath;
	});
	
	if (folder && typeof folder === 'object' && folder.icon) {
		return folder.icon;
	}
	return 'folderOpen'; // Default icon
}

// Helper to get store value
function get(store) {
	let value;
	store.subscribe((v) => (value = v))();
	return value;
}

/**
 * Create a new folder
 */
export function createFolder(folderPath, icon = 'folderOpen') {
	if (!folderPath || !folderPath.trim()) return false;
	
	folders.update((foldersList) => {
		const trimmedPath = folderPath.trim();
		// Check if folder already exists
		const exists = foldersList.some(f => {
			const path = typeof f === 'string' ? f : f.path;
			return path === trimmedPath;
		});
		
		if (!exists) {
			const newFolder = { path: trimmedPath, icon };
			return [...foldersList, newFolder].sort((a, b) => {
				const pathA = typeof a === 'string' ? a : a.path;
				const pathB = typeof b === 'string' ? b : b.path;
				return pathA.localeCompare(pathB);
			});
		}
		return foldersList;
	});
	
	return true;
}

/**
 * Delete a folder (and optionally move notes to parent or root)
 * Note: This only removes the folder from the list. 
 * Notes should be moved to root separately using moveNoteToFolder
 */
export function deleteFolder(folderPath) {
	folders.update((foldersList) => {
		return foldersList.filter(f => {
			const path = typeof f === 'string' ? f : f.path;
			return path !== folderPath;
		});
	});
	
	return true;
}

/**
 * Rename a folder
 */
export function renameFolder(oldPath, newPath) {
	if (!newPath || !newPath.trim()) return false;
	
	const trimmedNewPath = newPath.trim();
	
	folders.update((foldersList) => {
		const index = foldersList.findIndex(f => {
			const path = typeof f === 'string' ? f : f.path;
			return path === oldPath;
		});
		
		if (index !== -1) {
			const updated = [...foldersList];
			const oldFolder = updated[index];
			updated[index] = typeof oldFolder === 'string' 
				? { path: trimmedNewPath, icon: 'folderOpen' }
				: { ...oldFolder, path: trimmedNewPath };
			return updated.sort((a, b) => {
				const pathA = typeof a === 'string' ? a : a.path;
				const pathB = typeof b === 'string' ? b : b.path;
				return pathA.localeCompare(pathB);
			});
		}
		return foldersList;
	});
	
	return true;
}

/**
 * Update folder icon
 * If folder doesn't exist in the list, create it with the specified icon
 */
export function updateFolderIcon(folderPath, icon) {
	folders.update((foldersList) => {
		const index = foldersList.findIndex(f => {
			const path = typeof f === 'string' ? f : f.path;
			return path === folderPath;
		});
		
		if (index !== -1) {
			// Update existing folder
			const updated = [...foldersList];
			const oldFolder = updated[index];
			updated[index] = typeof oldFolder === 'string' 
				? { path: folderPath, icon } 
				: { ...oldFolder, icon };
			return updated;
		} else {
			// Create new folder entry if it doesn't exist
			const newFolder = { path: folderPath, icon };
			return [...foldersList, newFolder].sort((a, b) => {
				const pathA = typeof a === 'string' ? a : a.path;
				const pathB = typeof b === 'string' ? b : b.path;
				return pathA.localeCompare(pathB);
			});
		}
	});
	
	return true;
}

/**
 * Get folder hierarchy structure
 */
export function getFolderHierarchy(folderList) {
	const hierarchy = {};
	
	folderList.forEach(folder => {
		// Handle both string and object formats
		const folderPath = typeof folder === 'string' ? folder : folder.path;
		const parts = folderPath.split('/');
		let current = hierarchy;
		
		parts.forEach((part, index) => {
			if (!current[part]) {
				current[part] = {
					name: part,
					path: parts.slice(0, index + 1).join('/'),
					children: {}
				};
			}
			current = current[part].children;
		});
	});
	
	return hierarchy;
}

