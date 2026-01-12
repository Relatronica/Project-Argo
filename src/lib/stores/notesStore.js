import { writable, derived, get } from 'svelte/store';
import { getAllNotesMetadata, searchNotes, deleteNoteMetadata, forceDeleteNoteMetadata } from '../storage/localStorage.js';
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

// Store for tracking unsaved changes (dirty state)
export const hasUnsavedChanges = writable(false);

// Helper function to check if a note matches search query
function noteMatchesSearch(note, query) {
	if (!query.trim()) return true;
	const lowerQuery = query.toLowerCase();
	const searchable = [
		note.title || '',
		note.tags?.join(' ') || '',
		note.id || ''
	].join(' ').toLowerCase();
	return searchable.includes(lowerQuery);
}

// Derived store for filtered notes based on search
export const filteredNotes = derived(
	[notesMetadata, searchQuery],
	([$notesMetadata, $searchQuery]) => {
		if (!$searchQuery.trim()) {
			return $notesMetadata;
		}
		// Simple client-side filtering
		const query = $searchQuery.toLowerCase();
		return $notesMetadata.filter((note) => noteMatchesSearch(note, query));
	}
);

// Derived store to check if a note matches the search (for highlighting)
export const isNoteSearchMatch = derived(
	[searchQuery],
	([$searchQuery]) => {
		return (note) => noteMatchesSearch(note, $searchQuery);
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
 * Saves the note immediately to ensure it has persistent state and prevent data inheritance issues
 */
export async function createNewNote() {
	const note = new Note();
	// Ensure the new note has empty content and no whiteboard data
	note.content = '';
	note.title = '';
	note.whiteboardData = null; // Explicitly set to null to prevent inheriting data from previous note
	currentNote.set(note);
	
	// Save immediately to ensure the note has persistent state and prevent whiteboard data inheritance
	// This also ensures the note appears in the sidebar
	try {
		const $masterKey = get(masterKey);
		let encryptNote = null;
		if ($masterKey) {
			const cryptoModule = await loadCrypto();
			encryptNote = cryptoModule.encryptNote;
		}
		await note.save($masterKey || undefined, encryptNote);
		// Reload notes list to update metadata
		await loadNotes();
		// Update current note with the saved version to ensure it has all metadata
		currentNote.set(note);
	} catch (error) {
		// Log error but don't fail - the note is still created in memory
		// User can still work with it and save it later
		logger.warn('Error saving new note immediately:', error);
	}
	
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
		// Don't automatically set currentNote here - let the caller decide
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

		// Reload the current note to ensure it has the latest data
		const reloadedNote = await loadNoteById($currentNote.id);
		if (reloadedNote) {
			currentNote.set(reloadedNote);
		}

		// Reset dirty state since changes have been saved
		hasUnsavedChanges.set(false);

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
				color: $currentNote.color,
				icon: $currentNote.icon
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
		
		// Load the full note if not already loaded
		let note = null;
		if ($currentNote && $currentNote.id === noteId) {
			// Use current note if it's the one being updated
			note = $currentNote;
		} else {
			// Try to load from storage
			note = await loadNoteById(noteId);
		}
		
		// If note doesn't exist in storage but is the current note, use it
		// This handles the case of newly created notes that haven't been saved yet
		if (!note && $currentNote && $currentNote.id === noteId) {
			note = $currentNote;
		}
		
		if (!note) {
			logger.warn(`Note ${noteId} not found for title update`);
			return false;
		}
		
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
		
		// Reload notes list to ensure metadata is up to date
		await loadNotes();
		
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
		const existingMetadata = $notesMetadata.find(n => n.id === noteId);
		if (!existingMetadata) {
			logger.error('Note not found in metadata:', noteId);
			return false;
		}
		
		// Load the full note if not already loaded
		let note = null;
		if ($currentNote && $currentNote.id === noteId) {
			note = $currentNote;
		} else {
			note = await loadNoteById(noteId);
		}
		
		if (!note) {
			logger.error('Failed to load note:', noteId);
			return false;
		}
		
		// Update color
		note.color = color;
		note.updated = new Date().toISOString();
		
		// Save the note
		const $masterKey = get(masterKey);
		let encryptNote = null;
		if ($masterKey) {
			try {
				// Verify masterKey is a Uint8Array
				if (!($masterKey instanceof Uint8Array)) {
					logger.warn('masterKey is not a Uint8Array, saving note unencrypted');
					encryptNote = null;
				} else {
					const cryptoModule = await loadCrypto();
					encryptNote = cryptoModule?.encryptNote;
					if (!encryptNote || typeof encryptNote !== 'function') {
						logger.warn('encryptNote is not available or not a function, saving note unencrypted');
						encryptNote = null;
					}
				}
			} catch (cryptoError) {
				logger.warn('Failed to load crypto module, saving note unencrypted:', cryptoError);
				encryptNote = null;
			}
		}
		
		try {
			await note.save($masterKey, encryptNote);
		} catch (saveError) {
			logger.error('Failed to save note:', saveError);
			throw saveError;
		}
		
		// Update metadata in store - build manually to ensure color is correct
		const updatedMetadata = $notesMetadata.map(n => {
			if (n.id === noteId) {
				// Build metadata manually with updated color
				return {
					id: note.id,
					title: note.title || note.extractTitle(),
					content: note.content,
					tags: note.tags,
					folder: note.folder,
					created: note.created,
					updated: note.updated,
					scheduledFor: note.scheduledFor,
					dueDate: note.dueDate,
					encrypted: note.encrypted,
					favorite: note.favorite,
					color: color, // Use the new color directly
					icon: note.icon,
					mode: note.mode,
					whiteboardData: note.encrypted ? null : note.whiteboardData,
					whiteboardCiphertext: note.encrypted ? note.whiteboardCiphertext : undefined,
					whiteboardNonce: note.encrypted ? note.whiteboardNonce : undefined,
					contentLength: note.content.length,
					lastModified: note.updated
				};
			}
			return n;
		});
		
		notesMetadata.set(updatedMetadata);

		// Update current note if it's the one being updated
		if ($currentNote && $currentNote.id === noteId) {
			// Update the existing note instance to preserve methods
			Object.assign($currentNote, note);
			// Trigger reactivity by setting the store
			currentNote.set($currentNote);
			// Note: updateCurrentNoteMetadata() is not needed here since metadata is already updated above
		}

		return true;
	} catch (error) {
		// Log error with full details before sanitization
		const errorDetails = {
			message: error?.message || 'Unknown error',
			stack: error?.stack || 'No stack trace',
			name: error?.name || 'Error',
			toString: String(error)
		};
		console.error('[ERROR] Error updating note color - raw error:', error);
		console.error('[ERROR] Error updating note color - details:', errorDetails);
		logger.error('Error updating note color:', error);
		logger.error('Error details:', errorDetails);
		return false;
	}
}

/**
 * Update note icon
 */
export async function updateNoteIcon(noteId, icon) {
	try {
		const $currentNote = get(currentNote);
		const $notesMetadata = get(notesMetadata);
		
		// Find the note
		const existingMetadata = $notesMetadata.find(n => n.id === noteId);
		if (!existingMetadata) {
			logger.error('Note not found in metadata:', noteId);
			return false;
		}
		
		// Load the full note if not already loaded
		let note = null;
		if ($currentNote && $currentNote.id === noteId) {
			note = $currentNote;
		} else {
			note = await loadNoteById(noteId);
		}
		
		if (!note) {
			logger.error('Failed to load note:', noteId);
			return false;
		}
		
		// Update icon
		note.icon = icon;
		note.updated = new Date().toISOString();
		
		// Save the note
		const $masterKey = get(masterKey);
		let encryptNote = null;
		if ($masterKey) {
			try {
				// Verify masterKey is a Uint8Array
				if (!($masterKey instanceof Uint8Array)) {
					logger.warn('masterKey is not a Uint8Array, saving note unencrypted');
					encryptNote = null;
				} else {
					const cryptoModule = await loadCrypto();
					encryptNote = cryptoModule?.encryptNote;
					if (!encryptNote || typeof encryptNote !== 'function') {
						logger.warn('encryptNote is not available or not a function, saving note unencrypted');
						encryptNote = null;
					}
				}
			} catch (cryptoError) {
				logger.warn('Failed to load crypto module, saving note unencrypted:', cryptoError);
				encryptNote = null;
			}
		}
		
		try {
			await note.save($masterKey, encryptNote);
		} catch (saveError) {
			logger.error('Failed to save note:', saveError);
			throw saveError;
		}
		
		// Update metadata in store
		const updatedMetadata = $notesMetadata.map(n => {
			if (n.id === noteId) {
				return {
					...n,
					icon: icon,
					updated: note.updated,
					lastModified: note.updated
				};
			}
			return n;
		});
		
		notesMetadata.set(updatedMetadata);

		// Update current note if it's the one being updated
		if ($currentNote && $currentNote.id === noteId) {
			Object.assign($currentNote, note);
			currentNote.set($currentNote);
		}

		return true;
	} catch (error) {
		logger.error('Error updating note icon:', error);
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
		logger.debug(`Attempting to delete note ${noteId}`);
		
		// Try normal deletion first
		try {
			await deleteNoteMetadata(noteId);
		} catch (error) {
			logger.warn(`Normal deletion failed for note ${noteId}, trying force delete:`, error);
			// If normal deletion fails, try force delete
			await forceDeleteNoteMetadata(noteId);
		}
		
		// Wait a bit to ensure transaction is committed
		await new Promise(resolve => setTimeout(resolve, 150));
		
		// Reload notes list to update UI
		await loadNotes();
		
		// Verify deletion by checking if note still exists
		const $notesMetadata = get(notesMetadata);
		const noteStillExists = $notesMetadata.some(note => note.id === noteId);
		
		if (noteStillExists) {
			logger.warn(`Note ${noteId} still exists after deletion attempt, using force delete`);
			// Use force delete as last resort
			await forceDeleteNoteMetadata(noteId);
			await new Promise(resolve => setTimeout(resolve, 150));
			await loadNotes();
			
			// Final check
			const $notesMetadataAfterForce = get(notesMetadata);
			const stillExists = $notesMetadataAfterForce.some(note => note.id === noteId);
			if (stillExists) {
				logger.error(`Note ${noteId} could not be deleted even with force delete`);
				return false;
			}
		}
		
		// Clear current note if it was deleted
		const $currentNote = get(currentNote);
		if ($currentNote && $currentNote.id === noteId) {
			currentNote.set(null);
		}
		
		logger.debug(`Note ${noteId} deletion completed`);
		return true;
	} catch (error) {
		logger.error('Error deleting note:', error);
		return false;
	}
}

