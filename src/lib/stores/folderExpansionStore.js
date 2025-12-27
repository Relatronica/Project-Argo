import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { logger } from '../utils/logger.js';

/**
 * Store for managing folder expansion state
 */

const STORAGE_KEY = 'notes-folders-expanded';

// Load expanded folders from localStorage
function loadExpandedFolders() {
	if (!browser) return [];
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (error) {
		logger.error('Error loading expanded folders:', error);
	}
	
	return [];
}

// Create writable store with initial value
export const expandedFolders = writable(loadExpandedFolders());

// Save expanded folders to localStorage whenever they change
if (browser) {
	expandedFolders.subscribe((folders) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
		} catch (error) {
			logger.error('Error saving expanded folders:', error);
		}
	});
}

/**
 * Toggle folder expansion state
 */
export function toggleFolder(folderPath) {
	expandedFolders.update((folders) => {
		const index = folders.indexOf(folderPath);
		if (index !== -1) {
			// Remove folder from array
			return folders.filter(f => f !== folderPath);
		} else {
			// Add folder to array
			return [...folders, folderPath];
		}
	});
}

/**
 * Check if folder is expanded
 */
export function isFolderExpanded(folderPath, folders) {
	return folders.includes(folderPath);
}

/**
 * Initialize folders as expanded
 */
export function initializeFolders(folderPaths) {
	expandedFolders.update((current) => {
		// Only add folders that aren't already in the array
		const newFolders = folderPaths.filter(f => !current.includes(f));
		if (newFolders.length > 0) {
			return [...current, ...newFolders];
		}
		return current;
	});
}

