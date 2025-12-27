import { writable } from 'svelte/store';
import { browser } from '$app/environment';

let cryptoModule = null;

async function loadCrypto() {
	if (!cryptoModule) {
		cryptoModule = await import('../crypto/encryption.js');
	}
	return cryptoModule;
}

/**
 * Store for managing encryption keys
 * Keys are NEVER persisted - only in memory
 */

export const isUnlocked = writable(false);
export const keyError = writable(null);

/**
 * Unlock app with password
 * Derives master key from password
 * @param {string} password - User password
 * @param {string} salt - Salt (stored securely in IndexedDB, generated on first use)
 */
export async function unlockWithPassword(password) {
	try {
		keyError.set(null);

		// Load crypto module (browser only)
		const { deriveMasterKey, generateSalt } = await loadCrypto();

		// Import secure storage module
		const { getSecureValue, setSecureValue } = await import('../storage/secureStorage.js');

		// Get or create salt (stored securely in IndexedDB, not localStorage)
		let salt = await getSecureValue('notes-app-salt');
		if (!salt) {
			salt = generateSalt();
			await setSecureValue('notes-app-salt', salt);
		}

		// Derive master key
		const masterKey = await deriveMasterKey(password, salt);

		// Store master key in store (will be imported in notesStore)
		return masterKey;
	} catch (error) {
		keyError.set(error.message);
		throw error;
	}
}

/**
 * Lock app (clear master key from memory)
 */
export function lock() {
	isUnlocked.set(false);
	// Master key will be cleared when store is reset
}

// Helper
function get(store) {
	let value;
	store.subscribe((v) => (value = v))();
	return value;
}

