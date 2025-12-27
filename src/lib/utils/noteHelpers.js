/**
 * Utility functions for note processing and display
 * Centralizes note-related helper functions for reusability
 */

/**
 * Extract plain text from content (handles both HTML and markdown)
 * @param {string} content - Note content (HTML or markdown)
 * @returns {string} - Plain text preview (max 100 chars)
 */
export function extractPreviewText(content) {
	if (!content) return '';

	let text = content;

	// If content is HTML, extract text content safely
	if (content.trim().startsWith('<')) {
		// SECURITY: Use regex to strip HTML tags instead of innerHTML for safety
		// Content should already be sanitized, but this is an extra safety layer
		text = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
	}

	// Remove markdown formatting characters and clean up
	text = text.replace(/[#*`]/g, '').replace(/\s+/g, ' ').trim();

	// Limit length and add ellipsis if needed
	if (text.length > 100) {
		return text.substring(0, 100) + '...';
	}

	return text;
}

/**
 * Extract title from note metadata content (handles both HTML and markdown)
 * @param {Object} note - Note object with content and/or title
 * @returns {string} - Note title or 'Untitled'
 */
export function extractNoteTitle(note) {
	// If we have a title property and it's not HTML, use it
	if (note.title && !note.title.includes('<')) {
		return note.title;
	}

	// Otherwise extract from content
	if (!note.content) return 'Untitled';

	// Check if content is HTML (starts with <)
	if (note.content.trim().startsWith('<')) {
		// Extract text from HTML safely (SECURITY: use regex instead of innerHTML)
		// Content should already be sanitized, but this is an extra safety layer
		const textContent = note.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();

		// Use first non-empty line from HTML text
		const lines = textContent.split('\n');
		for (const line of lines) {
			if (line.trim()) {
				return line.trim().substring(0, 50);
			}
		}
	} else {
		// Handle markdown content (legacy)
		const lines = note.content.split('\n');
		for (const line of lines) {
			// Check for markdown heading
			const headingMatch = line.match(/^#+\s+(.+)$/);
			if (headingMatch) {
				return headingMatch[1].trim();
			}
			// Use first non-empty line
			if (line.trim()) {
				return line.trim().substring(0, 50);
			}
		}
	}
	return 'Untitled';
}

/**
 * Group notes by folder path
 * @param {Array} notes - Array of note objects
 * @returns {Object} - Object with folder paths as keys and note arrays as values
 */
export function groupNotesByFolder(notes) {
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
	
	return groups;
}

/**
 * Get display name for folder path
 * @param {string} folderPath - Full folder path
 * @returns {string} - Display name (last segment or 'Root')
 */
export function getFolderDisplayName(folderPath) {
	if (!folderPath) return 'Root';
	const parts = folderPath.split('/');
	return parts[parts.length - 1];
}

/**
 * Get parent folder path
 * @param {string} folderPath - Full folder path
 * @returns {string|null} - Parent folder path or null if root
 */
export function getParentFolder(folderPath) {
	if (!folderPath) return null;
	const parts = folderPath.split('/');
	parts.pop();
	return parts.length > 0 ? parts.join('/') : null;
}

/**
 * Format note date for display
 * @param {string|Date} date - Date string or Date object
 * @returns {string} - Formatted date string
 */
export function formatNoteDate(date) {
	return new Date(date).toLocaleDateString();
}

/**
 * Prepare note item data for rendering
 * @param {Object} note - Note object
 * @param {string} selectedId - Currently selected note ID
 * @returns {Object} - Prepared note item data
 */
export function prepareNoteItem(note, selectedId) {
	return {
		note,
		selected: selectedId === note.id,
		title: extractNoteTitle(note),
		preview: extractPreviewText(note.content),
		date: formatNoteDate(note.updated)
	};
}

