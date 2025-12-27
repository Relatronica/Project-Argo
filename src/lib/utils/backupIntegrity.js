/**
 * Backup integrity verification using HMAC
 * Ensures backup files haven't been tampered with
 */

/**
 * Generate HMAC for backup data
 * @param {string|Object} data - Data to sign
 * @param {Uint8Array} key - HMAC key (derived from export password or device key)
 * @returns {Promise<string>} - Base64-encoded HMAC
 */
export async function generateBackupHMAC(data, key) {
	try {
		// Convert data to string if needed
		const dataString = typeof data === 'string' ? data : JSON.stringify(data);
		
		// Convert key to CryptoKey
		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			key,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		
		// Create HMAC
		const encoder = new TextEncoder();
		const dataBuffer = encoder.encode(dataString);
		const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
		
		// Convert to base64
		const hashArray = Array.from(new Uint8Array(signature));
		const hashBase64 = btoa(String.fromCharCode(...hashArray));
		
		return hashBase64;
	} catch (error) {
		throw new Error(`Failed to generate HMAC: ${error.message}`);
	}
}

/**
 * Verify HMAC for backup data
 * @param {string|Object} data - Data to verify
 * @param {string} hmac - HMAC to verify against (base64-encoded)
 * @param {Uint8Array} key - HMAC key
 * @returns {Promise<boolean>} - True if HMAC is valid
 */
export async function verifyBackupHMAC(data, hmac, key) {
	try {
		// Generate expected HMAC
		const expectedHMAC = await generateBackupHMAC(data, key);
		
		// Constant-time comparison to prevent timing attacks
		if (expectedHMAC.length !== hmac.length) {
			return false;
		}
		
		let result = 0;
		for (let i = 0; i < expectedHMAC.length; i++) {
			result |= expectedHMAC.charCodeAt(i) ^ hmac.charCodeAt(i);
		}
		
		return result === 0;
	} catch (error) {
		return false;
	}
}

/**
 * Add HMAC to backup data
 * @param {Object} backupData - Backup data object
 * @param {Uint8Array} key - HMAC key
 * @returns {Promise<Object>} - Backup data with HMAC added
 */
export async function signBackup(backupData, key) {
	// Create a copy without the HMAC field (if it exists) for signing
	const dataToSign = { ...backupData };
	delete dataToSign.hmac;
	delete dataToSign.signature; // Legacy field name
	
	const hmac = await generateBackupHMAC(dataToSign, key);
	
	return {
		...backupData,
		hmac,
		version: backupData.version || '1.0',
		signedAt: new Date().toISOString()
	};
}

/**
 * Verify backup integrity
 * @param {Object} backupData - Backup data with HMAC
 * @param {Uint8Array} key - HMAC key
 * @returns {Promise<{valid: boolean, error?: string}>} - Verification result
 */
export async function verifyBackup(backupData, key) {
	if (!backupData.hmac) {
		return {
			valid: false,
			error: 'Backup file missing integrity signature (HMAC). File may be corrupted or from an older version.'
		};
	}
	
	const hmac = backupData.hmac;
	const dataToVerify = { ...backupData };
	delete dataToVerify.hmac;
	delete dataToVerify.signature; // Legacy field name
	
	const isValid = await verifyBackupHMAC(dataToVerify, hmac, key);
	
	if (!isValid) {
		return {
			valid: false,
			error: 'Backup file integrity check failed. File may have been tampered with or corrupted.'
		};
	}
	
	return { valid: true };
}

