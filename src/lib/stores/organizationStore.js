import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { logger } from '../utils/logger.js';

/**
 * Store for note organization preferences
 * Handles sorting and grouping preferences
 */

const STORAGE_KEY = 'notes-organization-preferences';

// Default preferences
const defaultPreferences = {
	sortBy: 'date', // 'date', 'alphabetical', 'favorites'
	sortOrder: 'desc', // 'asc', 'desc'
	groupBy: 'none', // 'none', 'date', 'tags', 'folders'
	showFavoritesFirst: true,
	compactView: false // 'false' = expanded view (show preview and metadata), 'true' = compact view (title only)
};

// Load preferences from localStorage
function loadPreferences() {
	if (!browser) return defaultPreferences;
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return { ...defaultPreferences, ...JSON.parse(stored) };
		}
	} catch (error) {
		logger.error('Error loading organization preferences:', error);
	}
	
	return defaultPreferences;
}

// Create writable store with initial value
export const organizationPreferences = writable(loadPreferences());

// Save preferences to localStorage whenever they change
if (browser) {
	organizationPreferences.subscribe((prefs) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
		} catch (error) {
			logger.error('Error saving organization preferences:', error);
		}
	});
}

/**
 * Update sort preference
 */
export function setSortBy(sortBy) {
	organizationPreferences.update((prefs) => ({
		...prefs,
		sortBy
	}));
}

/**
 * Update sort order
 */
export function setSortOrder(sortOrder) {
	organizationPreferences.update((prefs) => ({
		...prefs,
		sortOrder
	}));
}

/**
 * Update group by preference
 */
export function setGroupBy(groupBy) {
	organizationPreferences.update((prefs) => ({
		...prefs,
		groupBy
	}));
}

/**
 * Toggle show favorites first
 */
export function toggleShowFavoritesFirst() {
	organizationPreferences.update((prefs) => ({
		...prefs,
		showFavoritesFirst: !prefs.showFavoritesFirst
	}));
}

/**
 * Toggle compact view
 */
export function toggleCompactView() {
	organizationPreferences.update((prefs) => ({
		...prefs,
		compactView: !prefs.compactView
	}));
}

