/**
 * Backup file validation utility
 * Validates backup file structure and content to prevent injection attacks
 */

/**
 * Validate backup file structure
 * @param {Object} backupData - Parsed backup data
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validateBackupStructure(backupData) {
	// Must be an object
	if (!backupData || typeof backupData !== 'object') {
		return { valid: false, error: 'Invalid backup format: must be a JSON object' };
	}

	// Must have version
	if (!backupData.version || typeof backupData.version !== 'string') {
		return { valid: false, error: 'Invalid backup format: missing or invalid version' };
	}

	// Must have exportedAt
	if (!backupData.exportedAt || typeof backupData.exportedAt !== 'string') {
		return { valid: false, error: 'Invalid backup format: missing or invalid exportedAt timestamp' };
	}

	// Validate exportedAt is a valid ISO date
	try {
		const date = new Date(backupData.exportedAt);
		if (isNaN(date.getTime())) {
			return { valid: false, error: 'Invalid backup format: exportedAt is not a valid date' };
		}
	} catch {
		return { valid: false, error: 'Invalid backup format: exportedAt is not a valid date' };
	}

	// Check format/type field
	const hasFormat = backupData.format && typeof backupData.format === 'string';
	const hasType = backupData.type && typeof backupData.type === 'string';

	if (!hasFormat && !hasType) {
		return { valid: false, error: 'Invalid backup format: missing format or type field' };
	}

	// Validate format values
	if (hasFormat) {
		const validFormats = ['password-protected', 'encrypted', 'plaintext'];
		if (!validFormats.includes(backupData.format)) {
			return { valid: false, error: `Invalid backup format: unknown format "${backupData.format}"` };
		}
	}

	// Validate type values
	if (hasType) {
		const validTypes = ['protected-note', 'single-note'];
		if (!validTypes.includes(backupData.type)) {
			return { valid: false, error: `Invalid backup format: unknown type "${backupData.type}"` };
		}
	}

	// If password-protected, must have encryptedData
	if (backupData.format === 'password-protected' || backupData.type === 'protected-note') {
		if (!backupData.encryptedData || typeof backupData.encryptedData !== 'object') {
			return { valid: false, error: 'Invalid backup format: password-protected backup missing encryptedData' };
		}

		// Validate encryptedData structure
		if (!backupData.encryptedData.ciphertext || typeof backupData.encryptedData.ciphertext !== 'string') {
			return { valid: false, error: 'Invalid backup format: encryptedData missing ciphertext' };
		}

		if (!backupData.encryptedData.nonce || typeof backupData.encryptedData.nonce !== 'string') {
			return { valid: false, error: 'Invalid backup format: encryptedData missing nonce' };
		}
	}

	// If plaintext, must have notes array
	if (backupData.format === 'plaintext' || (!backupData.format && !backupData.type)) {
		if (!backupData.notes || !Array.isArray(backupData.notes)) {
			return { valid: false, error: 'Invalid backup format: plaintext backup missing notes array' };
		}

		// Validate notes array
		for (let i = 0; i < backupData.notes.length; i++) {
			const note = backupData.notes[i];
			if (!note || typeof note !== 'object') {
				return { valid: false, error: `Invalid backup format: note at index ${i} is not an object` };
			}

			if (!note.id || typeof note.id !== 'string') {
				return { valid: false, error: `Invalid backup format: note at index ${i} missing or invalid id` };
			}

			if (note.content === undefined || typeof note.content !== 'string') {
				return { valid: false, error: `Invalid backup format: note at index ${i} missing or invalid content` };
			}
		}
	}

	// Validate salt if present (should be base64 string)
	if (backupData.salt) {
		if (typeof backupData.salt !== 'string') {
			return { valid: false, error: 'Invalid backup format: salt must be a string' };
		}

		// Try to decode base64 (basic validation)
		try {
			atob(backupData.salt);
		} catch {
			return { valid: false, error: 'Invalid backup format: salt is not valid base64' };
		}
	}

	// Validate HMAC if present (should be base64 string)
	if (backupData.hmac) {
		if (typeof backupData.hmac !== 'string') {
			return { valid: false, error: 'Invalid backup format: HMAC must be a string' };
		}

		// Try to decode base64 (basic validation)
		try {
			atob(backupData.hmac);
		} catch {
			return { valid: false, error: 'Invalid backup format: HMAC is not valid base64' };
		}
	}

	return { valid: true };
}

/**
 * Validate decrypted backup data structure
 * @param {Object} decryptedData - Decrypted backup data
 * @param {string} expectedType - Expected type ('single-note' or 'bulk')
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validateDecryptedBackup(decryptedData, expectedType = null) {
	if (!decryptedData || typeof decryptedData !== 'object') {
		return { valid: false, error: 'Invalid decrypted data: must be an object' };
	}

	// Single note validation
	if (decryptedData.type === 'single-note' || expectedType === 'single-note') {
		if (!decryptedData.note || typeof decryptedData.note !== 'object') {
			return { valid: false, error: 'Invalid decrypted data: missing note object' };
		}

		if (!decryptedData.note.id || typeof decryptedData.note.id !== 'string') {
			return { valid: false, error: 'Invalid decrypted data: note missing or invalid id' };
		}

		if (decryptedData.note.content === undefined || typeof decryptedData.note.content !== 'string') {
			return { valid: false, error: 'Invalid decrypted data: note missing or invalid content' };
		}

		return { valid: true };
	}

	// Bulk backup validation
	if (decryptedData.notes || expectedType === 'bulk') {
		if (!decryptedData.notes || !Array.isArray(decryptedData.notes)) {
			return { valid: false, error: 'Invalid decrypted data: missing notes array' };
		}

		for (let i = 0; i < decryptedData.notes.length; i++) {
			const note = decryptedData.notes[i];
			if (!note || typeof note !== 'object') {
				return { valid: false, error: `Invalid decrypted data: note at index ${i} is not an object` };
			}

			if (!note.id || typeof note.id !== 'string') {
				return { valid: false, error: `Invalid decrypted data: note at index ${i} missing or invalid id` };
			}

			if (note.content === undefined || typeof note.content !== 'string') {
				return { valid: false, error: `Invalid decrypted data: note at index ${i} missing or invalid content` };
			}
		}

		return { valid: true };
	}

	return { valid: false, error: 'Invalid decrypted data: unknown format' };
}

