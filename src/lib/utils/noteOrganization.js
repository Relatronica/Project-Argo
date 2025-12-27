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
				// Favorites first, then by date
				if (a.favorite && !b.favorite) return -1;
				if (!a.favorite && b.favorite) return 1;
				return new Date(b.updated) - new Date(a.updated);
			});
			break;
			
		case 'date':
		default:
			sorted.sort((a, b) => {
				return new Date(b.updated) - new Date(a.updated);
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
 */
export function groupByFolders(notes) {
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
 */
export function organizeNotes(notes, preferences) {
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
		return { type: 'folders', groups: groupByFolders(organized) };
	}
	
	return { type: 'none', notes: organized };
}

