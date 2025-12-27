import { writable, derived, get } from 'svelte/store';
import { getAllNotesMetadata, searchNotes } from '../storage/localStorage.js';
import { Note } from '../models/note.js';
import { browser } from '$app/environment';
import { logger } from '../utils/logger.js';

let cryptoModule = null;

async function loadCrypto() {
	if (!cryptoModule) {
		cryptoModule = await import('../crypto/encryption.js');
	}
	return cryptoModule;
}

/**
 * Svelte stores for managing notes state
 */

// Store for all notes metadata
export const notesMetadata = writable([]);

// Store for currently selected note
export const currentNote = writable(null);

// Store for master key (in memory only, never persisted)
export const masterKey = writable(null);

// Store for search query
export const searchQuery = writable('');

// Store for save status: 'idle' | 'saving' | 'saved' | 'error'
export const saveStatus = writable('idle');

// Derived store for filtered notes based on search
export const filteredNotes = derived(
	[notesMetadata, searchQuery],
	([$notesMetadata, $searchQuery]) => {
		if (!$searchQuery.trim()) {
			return $notesMetadata;
		}
		// Simple client-side filtering
		const query = $searchQuery.toLowerCase();
		return $notesMetadata.filter((note) => {
			const searchable = [
				note.title || '',
				note.tags?.join(' ') || '',
				note.id || ''
			].join(' ').toLowerCase();
			return searchable.includes(query);
		});
	}
);

// Derived store for all available tags
export const allTags = derived(
	[notesMetadata],
	([$notesMetadata]) => {
		const tagSet = new Set();
		$notesMetadata.forEach(note => {
			if (note.tags && Array.isArray(note.tags)) {
				note.tags.forEach(tag => tagSet.add(tag));
			}
		});
		return Array.from(tagSet).sort();
	}
);

/**
 * Load all notes metadata
 */
export async function loadNotes() {
	try {
		const notes = await getAllNotesMetadata();
		notesMetadata.set(notes);
		return notes;
	} catch (error) {
		logger.error('Error loading notes:', error);
		return [];
	}
}

/**
 * Create new note
 */
export function createNewNote() {
	const note = new Note();
	currentNote.set(note);
	return note;
}

/**
 * Load note by ID and decrypt if needed
 */
export async function loadNoteById(noteId) {
	try {
		const $masterKey = get(masterKey);
		let decryptNote = null;

		if ($masterKey) {
			const cryptoModule = await loadCrypto();
			decryptNote = cryptoModule.decryptNote;
		}

		const note = await Note.load(noteId, $masterKey, decryptNote);
		if (note) {
			currentNote.set(note);
		}
		return note;
	} catch (error) {
		logger.error('Error loading note:', error);
		return null;
	}
}

/**
 * Save current note
 */
export async function saveCurrentNote() {
	const $currentNote = get(currentNote);
	const $masterKey = get(masterKey);

	if (!$currentNote) {
		return;
	}

	// Set status to saving
	saveStatus.set('saving');
	
	// Wait a bit to ensure UI updates (allow rendering of "Saving..." state)
	await new Promise(resolve => setTimeout(resolve, 50));

	try {
		let encryptNote = null;
		if ($masterKey) {
			const cryptoModule = await loadCrypto();
			encryptNote = cryptoModule.encryptNote;
		}
		// save() method now handles encryption automatically based on available key

		await $currentNote.save($masterKey, encryptNote);
		// Reload notes list
		await loadNotes();
		
		// Set status to saved
		saveStatus.set('saved');
		
		// Reset to idle after 2 seconds
		setTimeout(() => {
			saveStatus.set('idle');
		}, 2000);
		
		return true;
	} catch (error) {
		logger.error('Error saving note:', error);
		
		// Set status to error
		saveStatus.set('error');
		
		// Reset to idle after 3 seconds
		setTimeout(() => {
			saveStatus.set('idle');
		}, 3000);
		
		return false;
	}
}

/**
 * Update current note metadata in the list (for real-time title updates)
 */
export function updateCurrentNoteMetadata() {
	const $currentNote = get(currentNote);
	const $notesMetadata = get(notesMetadata);

	if (!$currentNote) return;

	// Find and update the metadata for current note
	const updatedMetadata = $notesMetadata.map(note => {
		if (note.id === $currentNote.id) {
			return {
				...note,
				title: $currentNote.title || $currentNote.extractTitle(),
				contentLength: $currentNote.content.length,
				updated: $currentNote.updated,
				favorite: $currentNote.favorite,
				color: $currentNote.color
			};
		}
		return note;
	});

	notesMetadata.set(updatedMetadata);
}

/**
 * Update note title
 */
export async function updateNoteTitle(noteId, title) {
	try {
		const $currentNote = get(currentNote);
		const $notesMetadata = get(notesMetadata);
		
		// Find the note
		const noteMetadata = $notesMetadata.find(n => n.id === noteId);
		if (!noteMetadata) return false;
		
		// Load the full note if not already loaded
		let note = null;
		if ($currentNote && $currentNote.id === noteId) {
			note = $currentNote;
		} else {
			note = await loadNoteById(noteId);
		}
		
		if (!note) return false;
		
		// Update title
		note.title = title || '';
		note.updated = new Date().toISOString();
		
		// Save the note
		const $masterKey = get(masterKey);
		let encryptNote = null;
		if ($masterKey) {
			const cryptoModule = await loadCrypto();
			encryptNote = cryptoModule.encryptNote;
		}
		
		await note.save($masterKey, encryptNote);
		
		// Update metadata in store
		const updatedMetadata = $notesMetadata.map(n => {
			if (n.id === noteId) {
				return {
					...n,
					title: title || note.extractTitle(),
					updated: note.updated
				};
			}
			return n;
		});
		
		notesMetadata.set(updatedMetadata);
		
		// Update current note if it's the one being updated
		if ($currentNote && $currentNote.id === noteId) {
			currentNote.set(note);
		}
		
		return true;
	} catch (error) {
		logger.error('Error updating note title:', error);
		return false;
	}
}

/**
 * Update note color
 */
export async function updateNoteColor(noteId, color) {
	try {
		const $currentNote = get(currentNote);
		const $notesMetadata = get(notesMetadata);
		
		// Find the note
		const noteMetadata = $notesMetadata.find(n => n.id === noteId);
		if (!noteMetadata) return false;
		
		// Load the full note if not already loaded
		let note = null;
		if ($currentNote && $currentNote.id === noteId) {
			note = $currentNote;
		} else {
			note = await loadNoteById(noteId);
		}
		
		if (!note) return false;
		
		// Update color
		note.color = color;
		note.updated = new Date().toISOString();
		
		// Save the note
		const $masterKey = get(masterKey);
		let encryptNote = null;
		if ($masterKey) {
			const cryptoModule = await loadCrypto();
			encryptNote = cryptoModule.encryptNote;
		}
		
		await note.save($masterKey, encryptNote);
		
		// Update metadata in store
		const updatedMetadata = $notesMetadata.map(n => {
			if (n.id === noteId) {
				return {
					...n,
					color: color,
					updated: note.updated
				};
			}
			return n;
		});
		
		notesMetadata.set(updatedMetadata);
		
		// Update current note if it's the one being updated
		if ($currentNote && $currentNote.id === noteId) {
			currentNote.set(note);
		}
		
		return true;
	} catch (error) {
		logger.error('Error updating note color:', error);
		return false;
	}
}

/**
 * Toggle favorite status of a note
 */
export async function toggleNoteFavorite(noteId) {
	try {
		const $currentNote = get(currentNote);
		const $notesMetadata = get(notesMetadata);
		
		// Find the note
		const noteMetadata = $notesMetadata.find(n => n.id === noteId);
		if (!noteMetadata) return false;
		
		// Load the full note if not already loaded
		let note = null;
		if ($currentNote && $currentNote.id === noteId) {
			note = $currentNote;
		} else {
			note = await loadNoteById(noteId);
		}
		
		if (!note) return false;
		
		// Toggle favorite
		note.favorite = !note.favorite;
		
		// Save the note
		const $masterKey = get(masterKey);
		let encryptNote = null;
		if ($masterKey) {
			const cryptoModule = await loadCrypto();
			encryptNote = cryptoModule.encryptNote;
		}
		
		await note.save($masterKey, encryptNote);
		
		// Reload notes list
		await loadNotes();
		
		// Update current note if it's the one we modified
		if ($currentNote && $currentNote.id === noteId) {
			currentNote.set(note);
		}
		
		return true;
	} catch (error) {
		logger.error('Error toggling favorite:', error);
		return false;
	}
}

/**
 * Move note to a folder
 */
export async function moveNoteToFolder(noteId, folderPath) {
	try {
		const $currentNote = get(currentNote);
		const $notesMetadata = get(notesMetadata);
		
		// Find the note
		const noteMetadata = $notesMetadata.find(n => n.id === noteId);
		if (!noteMetadata) return false;
		
		// Load the full note if not already loaded
		let note = null;
		if ($currentNote && $currentNote.id === noteId) {
			note = $currentNote;
		} else {
			note = await loadNoteById(noteId);
		}
		
		if (!note) return false;
		
		// Update folder (null or empty string means root)
		note.folder = folderPath && folderPath.trim() ? folderPath.trim() : null;
		
		// Save the note
		const $masterKey = get(masterKey);
		let encryptNote = null;
		if ($masterKey) {
			const cryptoModule = await loadCrypto();
			encryptNote = cryptoModule.encryptNote;
		}
		
		await note.save($masterKey, encryptNote);
		
		// Reload notes list
		await loadNotes();
		
		// Update current note if it's the one we modified
		if ($currentNote && $currentNote.id === noteId) {
			currentNote.set(note);
		}
		
		return true;
	} catch (error) {
		logger.error('Error moving note to folder:', error);
		return false;
	}
}

/**
 * Delete note
 */
export async function deleteNoteById(noteId) {
	try {
		const note = await Note.load(noteId);
		if (note) {
			await note.delete();
			await loadNotes();
			// Clear current note if it was deleted
			const $currentNote = get(currentNote);
			if ($currentNote && $currentNote.id === noteId) {
				currentNote.set(null);
			}
		}
		return true;
	} catch (error) {
		logger.error('Error deleting note:', error);
		return false;
	}
}

