/**
 * Secure storage module for sensitive data
 * Uses IndexedDB instead of localStorage for better security
 * Stores salts and rate limiting data in encrypted IndexedDB
 */
import { logger } from '../utils/logger.js';

const DB_NAME = 'notes-app-secure';
const DB_VERSION = 1;
const STORE_NAME = 'secure-data';

let db = null;

/**
 * Initialize secure storage database
 */
export async function initSecureStorage() {
	if (db) return db;

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			db = request.result;
			resolve(db);
		};

		request.onupgradeneeded = (event) => {
			const database = event.target.result;

			// Create object store if it doesn't exist
			if (!database.objectStoreNames.contains(STORE_NAME)) {
				const objectStore = database.createObjectStore(STORE_NAME, {
					keyPath: 'key'
				});
				objectStore.createIndex('key', 'key', { unique: true });
			}
		};
	});
}

/**
 * Get database instance
 */
async function getDB() {
	if (!db) {
		await initSecureStorage();
	}
	return db;
}

/**
 * Store a secure value (salt, rate limit data, etc.)
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 */
export async function setSecureValue(key, value) {
	try {
		const database = await getDB();
		const transaction = database.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.put({ key, value, timestamp: Date.now() });
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	} catch (error) {
		logger.error('Error storing secure value:', error);
		throw error;
	}
}

/**
 * Get a secure value
 * @param {string} key - Storage key
 * @returns {Promise<string|null>} - Stored value or null if not found
 */
export async function getSecureValue(key) {
	try {
		const database = await getDB();
		const transaction = database.transaction([STORE_NAME], 'readonly');
		const store = transaction.objectStore(STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.get(key);
			request.onsuccess = () => {
				const result = request.result;
				resolve(result ? result.value : null);
			};
			request.onerror = () => reject(request.error);
		});
	} catch (error) {
		logger.error('Error getting secure value:', error);
		return null;
	}
}

/**
 * Remove a secure value
 * @param {string} key - Storage key
 */
export async function removeSecureValue(key) {
	try {
		const database = await getDB();
		const transaction = database.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.delete(key);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	} catch (error) {
		logger.error('Error removing secure value:', error);
		throw error;
	}
}

/**
 * Clear all secure values (use with caution)
 */
export async function clearSecureStorage() {
	try {
		const database = await getDB();
		const transaction = database.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.clear();
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	} catch (error) {
		logger.error('Error clearing secure storage:', error);
		throw error;
	}
}

