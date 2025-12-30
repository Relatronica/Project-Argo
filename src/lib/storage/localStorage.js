/**
 * Local storage module for notes
 * Uses IndexedDB for encrypted metadata and File System Access API for markdown files
 * ALL data is encrypted before storage for security
 */
import { logger } from '../utils/logger.js';
import { exportMarkdownFile as electronExportMarkdown, openMarkdownFile as electronOpenMarkdown } from '../utils/electronFileAPI.js';

const DB_NAME = 'notes-app';
const DB_VERSION = 2; // Incremented for encryption schema change
const STORE_NAME = 'notes';

let db = null;
let deviceKey = null;

/**
 * Initialize IndexedDB with encryption support
 */
export async function initDB() {
	// Initialize device key for encryption
	if (!deviceKey) {
		const { deriveDeviceKey } = await import('../crypto/encryption.js');
		deviceKey = await deriveDeviceKey();
	}

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			db = request.result;
			resolve(db);
		};

		request.onupgradeneeded = (event) => {
			const database = event.target.result;
			const oldVersion = event.oldVersion;

			// Create object store if it doesn't exist
			if (!database.objectStoreNames.contains(STORE_NAME)) {
				const objectStore = database.createObjectStore(STORE_NAME, {
					keyPath: 'id'
				});

				// Create indexes for searching (on encrypted data)
				// Note: We can't index encrypted fields, so we'll search in memory after decryption
				objectStore.createIndex('created', 'created', { unique: false });
				objectStore.createIndex('encrypted', 'encrypted', { unique: false });
			}

			// Handle migration from unencrypted to encrypted storage (v1 → v2)
			if (oldVersion < 2) {
				logger.debug('Migrating from unencrypted storage to encrypted storage...');
				// Note: Actual migration happens in getAllNotesMetadata and getNoteMetadata
				// to handle existing data gracefully
			}
		};
	});
}

/**
 * Get database instance (initialize if needed)
 */
async function getDB() {
	if (!db) {
		await initDB();
	}
	return db;
}

/**
 * Save note metadata to IndexedDB (encrypted)
 * @param {Object} noteMetadata - Note metadata (id, created, updated, tags, etc.)
 */
export async function saveNoteMetadata(noteMetadata) {
	const database = await getDB();

	// Encrypt the metadata before storage
	const { encryptForStorage } = await import('../crypto/encryption.js');
	const encryptedData = await encryptForStorage(noteMetadata, deviceKey);

	// Hash metadata for searchable fields (privacy protection)
	// Using full hash length (64 chars = 32 bytes) for better security
	const { hashMetadata, hashMetadataArray } = await import('../utils/metadataSecurity.js');
	const titleHash = await hashMetadata(noteMetadata.title || '', deviceKey, 64);
	const tagsHash = await hashMetadataArray(noteMetadata.tags || [], deviceKey, 64);

	const transaction = database.transaction([STORE_NAME], 'readwrite');
	const store = transaction.objectStore(STORE_NAME);

	return new Promise((resolve, reject) => {
		const request = store.put({
			id: noteMetadata.id,
			encryptedData: encryptedData,
			encrypted: true,
			updated: new Date().toISOString(),
			// Store hashed metadata for search (privacy-preserving)
			// Hashes are one-way, original values cannot be recovered
			searchableTagsHash: tagsHash,
			searchableTitleHash: titleHash,
			contentLength: noteMetadata.contentLength || 0
		});

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * Get note metadata by ID (decrypted)
 * @param {string} noteId - Note identifier
 * @returns {Object|null} - Note metadata or null if not found
 */
export async function getNoteMetadata(noteId) {
	const database = await getDB();
	const transaction = database.transaction([STORE_NAME], 'readonly');
	const store = transaction.objectStore(STORE_NAME);

	return new Promise(async (resolve, reject) => {
		const request = store.get(noteId);

		request.onsuccess = async () => {
			const record = request.result;
			if (!record) {
				resolve(null);
				return;
			}

			// Handle migration: check if this is encrypted (v2) or legacy (v1) data
			if (record.encryptedData && record.encrypted) {
				// This is v2 encrypted data
				try {
					const { decryptFromStorage } = await import('../crypto/encryption.js');
					const decryptedData = await decryptFromStorage(record.encryptedData, deviceKey);

					// Return decrypted data (searchable fields are now hashed, not included)
					const metadata = {
						...decryptedData,
						contentLength: record.contentLength || 0
					};

					resolve(metadata);
				} catch (error) {
					logger.error(`Failed to decrypt note ${noteId}:`, error);
					// For encrypted notes that fail decryption, return null to hide them
					resolve(null);
				}
			} else if (record.content) {
				// This is legacy v1 data (unencrypted)
				logger.debug(`Migrating legacy note ${noteId} to encrypted format`);

				try {
					// Migrate legacy data to encrypted format
					const legacyData = {
						id: record.id,
						title: record.title || '',
						content: record.content,
						tags: record.tags || [],
						created: record.created,
						updated: record.updated,
						encrypted: false // Mark as migrated legacy data
					};

					// Re-save in encrypted format
					await saveNoteMetadata(legacyData);

					resolve(legacyData);
				} catch (migrationError) {
					logger.error(`Failed to migrate legacy note ${noteId}:`, migrationError);
					// Return legacy data as-is if migration fails
					resolve({
						...record,
						encrypted: false,
						legacy: true
					});
				}
			} else {
				logger.warn(`Invalid note record ${noteId}:`, record);
				resolve(null);
			}
		};

		request.onerror = () => reject(request.error);
	});
}

/**
 * Get all notes metadata (decrypted)
 * @returns {Array} - Array of note metadata
 */
export async function getAllNotesMetadata() {
	const database = await getDB();
	const transaction = database.transaction([STORE_NAME], 'readonly');
	const store = transaction.objectStore(STORE_NAME);

	return new Promise(async (resolve, reject) => {
		const request = store.getAll();

		request.onsuccess = async () => {
			const records = request.result || [];
			const processedNotes = [];

			for (const record of records) {
				try {
					let processedNote = null;

					if (record.encryptedData && record.encrypted) {
						// v2 encrypted data
						const { decryptFromStorage } = await import('../crypto/encryption.js');
						const decryptedData = await decryptFromStorage(record.encryptedData, deviceKey);

						processedNote = {
							...decryptedData,
							contentLength: record.contentLength || 0
						};
					} else if (record.content) {
						// Legacy v1 data - migrate on the fly
						logger.debug(`Migrating legacy note ${record.id} during bulk load`);

						const legacyData = {
							id: record.id,
							title: record.title || '',
							content: record.content,
							tags: record.tags || [],
							created: record.created,
							updated: record.updated,
							encrypted: false
						};

						// Re-save in new format (this will encrypt it)
						await saveNoteMetadata(legacyData);

						processedNote = legacyData;
					} else {
						logger.warn(`Skipping invalid note record:`, record);
						continue;
					}

					if (processedNote) {
						processedNotes.push(processedNote);
					}
				} catch (error) {
					logger.error(`Failed to process note ${record.id}:`, error);
					// Skip problematic notes
				}
			}

			// Sort by updated date (newest first)
			processedNotes.sort((a, b) => new Date(b.updated) - new Date(a.updated));
			resolve(processedNotes);
		};

		request.onerror = () => reject(request.error);
	});
}

/**
 * Delete note metadata
 * @param {string} noteId - Note identifier
 */
export async function deleteNoteMetadata(noteId) {
	const database = await getDB();
	
	return new Promise((resolve, reject) => {
		const transaction = database.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		// Handle transaction errors
		transaction.onerror = () => {
			logger.error('Transaction error while deleting note:', transaction.error);
			reject(transaction.error);
		};

		// Handle transaction completion
		transaction.oncomplete = () => {
			logger.debug(`Note ${noteId} deleted successfully`);
			resolve();
		};

		// Handle delete request
		const request = store.delete(noteId);

		request.onsuccess = () => {
			// Request succeeded, but wait for transaction to complete
			logger.debug(`Delete request successful for note ${noteId}`);
		};

		request.onerror = () => {
			logger.error(`Error deleting note ${noteId}:`, request.error);
			reject(request.error);
		};
	});
}

/**
 * Force delete note metadata (bypasses normal checks)
 * This is a more aggressive deletion that ensures the note is removed
 * @param {string} noteId - Note identifier
 */
export async function forceDeleteNoteMetadata(noteId) {
	const database = await getDB();
	
	// Try multiple times to ensure deletion
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			await deleteNoteMetadata(noteId);
			
			// Verify deletion
			const metadata = await getNoteMetadata(noteId);
			if (!metadata) {
				logger.debug(`Note ${noteId} successfully deleted on attempt ${attempt + 1}`);
				return;
			}
			
			if (attempt < 2) {
				logger.warn(`Note ${noteId} still exists after deletion, retrying...`);
				await new Promise(resolve => setTimeout(resolve, 200));
			}
		} catch (error) {
			if (attempt === 2) {
				logger.error(`Failed to delete note ${noteId} after 3 attempts:`, error);
				throw error;
			}
			await new Promise(resolve => setTimeout(resolve, 200));
		}
	}
	
	// Final verification
	const metadata = await getNoteMetadata(noteId);
	if (metadata) {
		logger.error(`Note ${noteId} still exists after force deletion`);
		throw new Error(`Failed to delete note ${noteId}`);
	}
}

/**
 * Search notes by query (simple text search on metadata)
 * @param {string} query - Search query
 * @returns {Array} - Matching notes
 */
export async function searchNotes(query) {
	const allNotes = await getAllNotesMetadata();
	const lowerQuery = query.toLowerCase();

	return allNotes.filter((note) => {
		// Search in title, tags, and other searchable fields
		const searchableText = [
			note.title || '',
			note.tags?.join(' ') || '',
			note.id || ''
		].join(' ').toLowerCase();

		return searchableText.includes(lowerQuery);
	});
}

/**
 * Clean up corrupted notes and force migration of legacy data
 * This is a maintenance function that can be called when needed
 */
export async function cleanupAndMigrate() {
	logger.info('Starting database cleanup and migration...');

	try {
		const database = await getDB();
		const transaction = database.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		const request = store.getAll();
		const records = await new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result || []);
			request.onerror = () => reject(request.error);
		});

		let migrated = 0;
		let cleaned = 0;

		for (const record of records) {
			try {
				if (record.content && !record.encryptedData) {
					// Legacy unencrypted data - migrate
					logger.debug(`Migrating legacy note ${record.id}`);

					const legacyData = {
						id: record.id,
						title: record.title || '',
						content: record.content,
						tags: record.tags || [],
						created: record.created,
						updated: record.updated,
						encrypted: false
					};

					// Re-save in new format (this will encrypt with current settings)
					await saveNoteMetadata(legacyData);
					migrated++;
				} else if (!record.content && !record.encryptedData) {
					// Corrupted record - remove
					logger.debug(`Removing corrupted note ${record.id}`);
					await new Promise((resolve, reject) => {
						const deleteRequest = store.delete(record.id);
						deleteRequest.onsuccess = () => resolve();
						deleteRequest.onerror = () => reject(deleteRequest.error);
					});
					cleaned++;
				}
			} catch (error) {
				logger.error(`Error processing note ${record.id}:`, error);
			}
		}

		logger.info(`Cleanup complete: ${migrated} migrated, ${cleaned} cleaned`);
		return { migrated, cleaned };

	} catch (error) {
		logger.error('Cleanup failed:', error);
		throw error;
	}
}

/**
 * Export markdown file using Electron or File System Access API
 * Falls back to download if API not available
 * @param {string} filename - File name
 * @param {string} content - File content
 * @returns {Promise} - File handle or null
 */
export async function exportMarkdownFile(filename, content) {
	const result = await electronExportMarkdown(filename, content);
	return result || null;
}

/**
 * Load markdown file using File System Access API
 * @param {FileSystemFileHandle} fileHandle - File handle from previous save
 * @returns {Promise<string>} - File content
 */
export async function loadMarkdownFile(fileHandle) {
	if (fileHandle) {
		const file = await fileHandle.getFile();
		return await file.text();
	}
	return null;
}

/**
 * Open markdown file using Electron or File System Access API
 * @returns {Promise<{fileHandle: FileSystemFileHandle|null, content: string|null}>}
 */
export async function openMarkdownFile() {
	const result = await electronOpenMarkdown();
	if (result && result.content) {
		return { fileHandle: result.fileHandle || null, content: result.content };
	}
	return null;
}

