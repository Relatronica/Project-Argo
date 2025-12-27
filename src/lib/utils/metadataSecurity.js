/**
 * Security utilities for metadata handling
 * Provides hashing functions for searchable metadata to protect privacy
 */

/**
 * Hash a string using HMAC-SHA256 for searchable metadata
 * Returns full hash for better security (prevents collision attacks)
 * @param {string} value - Value to hash
 * @param {Uint8Array} key - Device key for HMAC
 * @param {number} length - Length of hash to return (default: 64 = full 32-byte hash as hex)
 * @returns {Promise<string>} - Hex-encoded hash
 */
export async function hashMetadata(value, key, length = 64) {
	if (!value || !key) {
		return '';
	}
	
	try {
		// Convert key to CryptoKey for Web Crypto API
		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			key,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		
		// Create HMAC
		const encoder = new TextEncoder();
		const data = encoder.encode(value);
		const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
		
		// Convert to hex - use full hash for security (64 chars = 32 bytes)
		const hashArray = Array.from(new Uint8Array(signature));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		
		// Return full hash (or truncate if length specified, but default is full)
		return length < 64 ? hashHex.substring(0, length) : hashHex;
	} catch (error) {
		console.error('Error hashing metadata:', error);
		return '';
	}
}

/**
 * Hash multiple metadata values (e.g., tags)
 * @param {Array<string>} values - Array of values to hash
 * @param {Uint8Array} key - Device key for HMAC
 * @param {number} length - Length of each hash (default: 64 = full 32-byte hash as hex)
 * @returns {Promise<Array<string>>} - Array of hashed values
 */
export async function hashMetadataArray(values, key, length = 64) {
	if (!values || !Array.isArray(values) || values.length === 0) {
		return [];
	}
	
	const hashed = await Promise.all(
		values.map(value => hashMetadata(value, key, length))
	);
	
	return hashed.filter(h => h.length > 0);
}

/**
 * Search in hashed metadata
 * Hashes the search query and compares with stored hashes
 * @param {string} query - Search query
 * @param {string|Array<string>} hashedMetadata - Hashed metadata to search in
 * @param {Uint8Array} key - Device key for HMAC
 * @returns {Promise<boolean>} - True if match found
 */
export async function searchHashedMetadata(query, hashedMetadata, key) {
	if (!query || !hashedMetadata || !key) {
		return false;
	}
	
	const queryHash = await hashMetadata(query.toLowerCase(), key);
	if (!queryHash) {
		return false;
	}
	
	if (Array.isArray(hashedMetadata)) {
		return hashedMetadata.some(hash => hash === queryHash);
	}
	
	return hashedMetadata === queryHash;
}

