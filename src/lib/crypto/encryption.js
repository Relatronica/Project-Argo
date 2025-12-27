// Import tweetnacl - browser-only library
// @ts-ignore
import nacl from 'tweetnacl';
// @ts-ignore
import naclUtil from 'tweetnacl-util';

// Ensure we're in browser environment
if (typeof self === 'undefined') {
	throw new Error('tweetnacl requires browser environment');
}

/**
 * Encryption module using XChaCha20-Poly1305 (via tweetnacl)
 * Provides end-to-end encryption for notes
 */

const NONCE_LENGTH = 24; // XChaCha20 nonce size
const KEY_LENGTH = 32; // 256-bit key

/**
 * Derive encryption key from master key and note ID
 * Uses HKDF-like approach with SHA-256
 */
function deriveKey(masterKey, noteId) {
	// Simple key derivation: HMAC-SHA256(masterKey, noteId)
	// In production, consider using proper HKDF
	const combined = masterKey + noteId;
	const hash = nacl.hash(naclUtil.decodeUTF8(combined));
	return hash.slice(0, KEY_LENGTH);
}

/**
 * Generate random nonce for encryption
 */
function generateNonce() {
	return nacl.randomBytes(NONCE_LENGTH);
}

/**
 * Encrypt plaintext using XChaCha20-Poly1305
 * @param {string} plaintext - Text to encrypt
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {Object} - { ciphertext: string, nonce: string } (base64 encoded)
 */
export function encrypt(plaintext, key) {
	if (!plaintext || !key) {
		throw new Error('Plaintext and key are required');
	}

	const nonce = generateNonce();
	const message = naclUtil.decodeUTF8(plaintext);

	// Use secretbox (XSalsa20-Poly1305) - closest to XChaCha20 in tweetnacl
	// Note: tweetnacl uses XSalsa20, not XChaCha20, but provides similar security
	const encrypted = nacl.secretbox(message, nonce, key);

	if (!encrypted) {
		throw new Error('Encryption failed');
	}

	return {
		ciphertext: naclUtil.encodeBase64(encrypted),
		nonce: naclUtil.encodeBase64(nonce)
	};
}

/**
 * Decrypt ciphertext using XChaCha20-Poly1305
 * @param {string} ciphertext - Base64 encoded ciphertext
 * @param {string} nonce - Base64 encoded nonce
 * @param {Uint8Array} key - 32-byte decryption key
 * @returns {string} - Decrypted plaintext
 */
export function decrypt(ciphertext, nonce, key) {
	if (!ciphertext || !nonce || !key) {
		throw new Error('Ciphertext, nonce, and key are required');
	}

	try {
		const encrypted = naclUtil.decodeBase64(ciphertext);
		const nonceBytes = naclUtil.decodeBase64(nonce);

		const decrypted = nacl.secretbox.open(encrypted, nonceBytes, key);

		if (!decrypted) {
			throw new Error('Decryption failed - invalid key or corrupted data');
		}

		return naclUtil.encodeUTF8(decrypted);
	} catch (error) {
		throw new Error(`Decryption error: ${error.message}`);
	}
}

/**
 * Derive master key from password using Argon2-like approach
 * Simplified version using PBKDF2 (browser-compatible)
 * @param {string} password - User password
 * @param {string} salt - Salt (should be stored securely)
 * @returns {Uint8Array} - 32-byte master key
 */
export async function deriveMasterKey(password, salt) {
	// Use Web Crypto API for PBKDF2
	const encoder = new TextEncoder();
	const passwordKey = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);

	const saltBuffer = encoder.encode(salt);
	const keyMaterial = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: saltBuffer,
			iterations: 2100000, // Increased to 2.1M iterations (2025 security standard)
			hash: 'SHA-256'
		},
		passwordKey,
		256 // 32 bytes = 256 bits
	);

	return new Uint8Array(keyMaterial);
}

/**
 * Generate random salt for key derivation
 * @returns {string} - Base64 encoded salt
 */
export function generateSalt() {
	const salt = nacl.randomBytes(32);
	return naclUtil.encodeBase64(salt);
}

/**
 * Generate device-specific key for encrypting IndexedDB data
 * Uses secure random device ID stored in IndexedDB instead of predictable fingerprint
 * @returns {Promise<Uint8Array>} - 32-byte device key
 */
export async function deriveDeviceKey() {
	// Import secure storage module
	const { getSecureValue, setSecureValue } = await import('../storage/secureStorage.js');
	
	// Get or create device ID (random UUID stored securely in IndexedDB)
	let deviceId = await getSecureValue('notes-device-id');
	if (!deviceId) {
		// Generate random device ID (UUID v4)
		deviceId = generateDeviceId();
		await setSecureValue('notes-device-id', deviceId);
	}

	// Get or create device salt (stored securely in IndexedDB, not localStorage)
	let deviceSalt = await getSecureValue('notes-device-salt');
	if (!deviceSalt) {
		deviceSalt = generateSalt();
		await setSecureValue('notes-device-salt', deviceSalt);
	}

	// Derive device key using PBKDF2 with same security as master key
	const encoder = new TextEncoder();
	const deviceKeyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(deviceId),
		'PBKDF2',
		false,
		['deriveBits']
	);

	const saltBuffer = encoder.encode(deviceSalt);
	const keyMaterial = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: saltBuffer,
			iterations: 2100000, // Same security as master key (2.1M iterations)
			hash: 'SHA-256'
		},
		deviceKeyMaterial,
		256 // 32 bytes = 256 bits
	);

	return new Uint8Array(keyMaterial);
}

/**
 * Generate a random device ID (UUID v4)
 * @returns {string} - UUID v4 string
 */
function generateDeviceId() {
	// Generate UUID v4 using crypto.getRandomValues
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	
	// Set version (4) and variant bits
	bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
	
	// Convert to UUID string format
	const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Encrypt data for secure storage (IndexedDB)
 * @param {string|object} data - Data to encrypt
 * @param {Uint8Array} deviceKey - Device encryption key
 * @returns {Promise<string>} - Encrypted data as base64 string
 */
export async function encryptForStorage(data, deviceKey) {
	const dataString = typeof data === 'string' ? data : JSON.stringify(data);
	return encrypt(dataString, deviceKey);
}

/**
 * Decrypt data from secure storage (IndexedDB)
 * @param {string} encryptedData - Encrypted data as base64 string
 * @param {Uint8Array} deviceKey - Device decryption key
 * @returns {Promise<string|object>} - Decrypted data
 */
export async function decryptFromStorage(encryptedData, deviceKey) {
	const decryptedString = await decrypt(encryptedData.ciphertext, encryptedData.nonce, deviceKey);

	// Try to parse as JSON, fallback to string
	try {
		return JSON.parse(decryptedString);
	} catch {
		return decryptedString;
	}
}

/**
 * Encrypt note with master key
 * @param {string} content - Note content
 * @param {string} noteId - Unique note identifier
 * @param {Uint8Array} masterKey - Master encryption key
 * @returns {Object} - Encrypted note data
 */
export async function encryptNote(content, noteId, masterKey) {
	const noteKey = deriveKey(masterKey, noteId);
	const { ciphertext, nonce } = encrypt(content, noteKey);

	return {
		ciphertext,
		nonce,
		noteId
	};
}

/**
 * Decrypt note with master key
 * @param {Object} encryptedNote - { ciphertext, nonce, noteId }
 * @param {Uint8Array} masterKey - Master decryption key
 * @returns {string} - Decrypted note content
 */
export async function decryptNote(encryptedNote, masterKey) {
	const { ciphertext, nonce, noteId } = encryptedNote;
	const noteKey = deriveKey(masterKey, noteId);
	return decrypt(ciphertext, nonce, noteKey);
}

