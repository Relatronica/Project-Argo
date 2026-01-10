/**
 * Utility functions for organizing and sorting notes
 */

/**
 * Sort notes based on preferences
 */
export function sortNotes(notes, sortBy, sortOrder) {
	const sorted = [...notes];
	
	switch (sortBy) {
		case 'alphabetical':
			sorted.sort((a, b) => {
				const titleA = (a.title || 'Untitled').toLowerCase();
				const titleB = (b.title || 'Untitled').toLowerCase();
				return titleA.localeCompare(titleB);
			});
			break;
			
		case 'favorites':
			sorted.sort((a, b) => {
				// Favorites first, then by creation date
				if (a.favorite && !b.favorite) return -1;
				if (!a.favorite && b.favorite) return 1;
				// Use 'created' instead of 'updated' to maintain order when saving notes
				return new Date(b.created) - new Date(a.created);
			});
			break;
			
		case 'date':
		default:
			// Use 'created' instead of 'updated' to maintain order when saving notes
			// This prevents notes from jumping to the top when saved
			sorted.sort((a, b) => {
				return new Date(b.created) - new Date(a.created);
			});
			break;
	}
	
	// Apply sort order
	if (sortOrder === 'asc') {
		sorted.reverse();
	}
	
	return sorted;
}

/**
 * Group notes by date
 */
export function groupByDate(notes) {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const weekAgo = new Date(today);
	weekAgo.setDate(weekAgo.getDate() - 7);
	const monthAgo = new Date(today);
	monthAgo.setMonth(monthAgo.getMonth() - 1);
	
	const groups = {
		'Today': [],
		'This Week': [],
		'This Month': [],
		'Older': []
	};
	
	notes.forEach(note => {
		const noteDate = new Date(note.updated);
		
		if (noteDate >= today) {
			groups['Today'].push(note);
		} else if (noteDate >= weekAgo) {
			groups['This Week'].push(note);
		} else if (noteDate >= monthAgo) {
			groups['This Month'].push(note);
		} else {
			groups['Older'].push(note);
		}
	});
	
	return groups;
}

/**
 * Group notes by tags
 */
export function groupByTags(notes) {
	const groups = {};
	const untagged = [];
	
	notes.forEach(note => {
		if (!note.tags || note.tags.length === 0) {
			untagged.push(note);
		} else {
			note.tags.forEach(tag => {
				if (!groups[tag]) {
					groups[tag] = [];
				}
				groups[tag].push(note);
			});
		}
	});
	
	// Sort tags alphabetically
	const sortedGroups = {};
	Object.keys(groups).sort().forEach(tag => {
		sortedGroups[tag] = groups[tag];
	});
	
	if (untagged.length > 0) {
		sortedGroups['Untagged'] = untagged;
	}
	
	return sortedGroups;
}

/**
 * Group notes by folders
 * @param {Array} notes - Array of notes to group
 * @param {Array} allFolders - Optional array of all folders (including empty ones)
 */
export function groupByFolders(notes, allFolders = []) {
	const groups = {
		'': [] // Root folder
	};
	
	notes.forEach(note => {
		const folder = note.folder || '';
		if (!groups[folder]) {
			groups[folder] = [];
		}
		groups[folder].push(note);
	});
	
	// Add all folders from allFolders (including empty ones)
	allFolders.forEach(folder => {
		const folderPath = typeof folder === 'string' ? folder : folder.path;
		if (!groups[folderPath]) {
			groups[folderPath] = [];
		}
	});
	
	// Sort folders alphabetically, with root first
	const sortedGroups = {};
	if (groups['']) {
		sortedGroups[''] = groups[''];
	}
	Object.keys(groups)
		.filter(f => f !== '')
		.sort()
		.forEach(folder => {
			sortedGroups[folder] = groups[folder];
		});
	
	return sortedGroups;
}

/**
 * Organize notes based on preferences
 * @param {Array} notes - Array of notes to organize
 * @param {Object} preferences - Organization preferences
 * @param {Array} allFolders - Optional array of all folders (including empty ones)
 */
export function organizeNotes(notes, preferences, allFolders = []) {
	let organized = [...notes];
	
	// Show favorites first if enabled
	if (preferences.showFavoritesFirst && preferences.sortBy !== 'favorites') {
		const favorites = organized.filter(n => n.favorite);
		const nonFavorites = organized.filter(n => !n.favorite);
		organized = [...favorites, ...nonFavorites];
	}
	
	// Sort notes
	organized = sortNotes(organized, preferences.sortBy, preferences.sortOrder);
	
	// Group notes if needed
	if (preferences.groupBy === 'date') {
		return { type: 'date', groups: groupByDate(organized) };
	} else if (preferences.groupBy === 'tags') {
		return { type: 'tags', groups: groupByTags(organized) };
	} else if (preferences.groupBy === 'folders') {
		return { type: 'folders', groups: groupByFolders(organized, allFolders) };
	}
	
	return { type: 'none', notes: organized };
}

