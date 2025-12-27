/**
 * Structured logging utility
 * Prevents sensitive data leakage in production
 * Only logs in development mode
 */

const isDev = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

/**
 * Sanitize data before logging to prevent sensitive information leakage
 * @param {any} data - Data to sanitize
 * @returns {any} - Sanitized data
 */
function sanitizeForLogging(data) {
	if (data === null || data === undefined) return data;
	
	if (typeof data === 'string') {
		// Don't log passwords or keys (even partial)
		if (data.length > 0 && data.length < 100) {
			const lower = data.toLowerCase();
			if (lower.includes('password') || lower.includes('key') || lower.includes('secret')) {
				// Don't redact decryption errors as they contain important debugging info
				if (!lower.includes('decryption failed') && !lower.includes('decryption error')) {
					return '[REDACTED]';
				}
			}
		}
		return data;
	}
	
		if (typeof data === 'object') {
			if (Array.isArray(data)) {
				return data.map(sanitizeForLogging);
			}
			
			const sanitized = {};
			for (const [key, value] of Object.entries(data)) {
				const keyLower = key.toLowerCase();
				// Redact sensitive fields, but allow debugging info
				if (keyLower.includes('password') && !keyLower.includes('length') && !keyLower.includes('has')) {
					sanitized[key] = '[REDACTED]';
				} else if (keyLower === 'key' && typeof value !== 'number' && !keyLower.includes('length') && !keyLower.includes('first')) {
					sanitized[key] = '[REDACTED]';
				} else if (keyLower.includes('secret') || keyLower.includes('token')) {
					sanitized[key] = '[REDACTED]';
				} else if (keyLower.includes('ciphertext') && typeof value !== 'boolean' && !keyLower.includes('has') && !keyLower.includes('length')) {
					sanitized[key] = '[REDACTED]';
				} else if (keyLower.includes('nonce') && typeof value !== 'boolean' && !keyLower.includes('has') && !keyLower.includes('length')) {
					sanitized[key] = '[REDACTED]';
				} else {
					sanitized[key] = sanitizeForLogging(value);
				}
			}
			return sanitized;
		}
	
	return data;
}

/**
 * Logger with different log levels
 */
export const logger = {
	/**
	 * Debug logs - only in development
	 */
	debug: (...args) => {
		if (isDev) {
			const sanitized = args.map(sanitizeForLogging);
			console.log('[DEBUG]', ...sanitized);
		}
	},
	
	/**
	 * Info logs - only in development
	 */
	info: (...args) => {
		if (isDev) {
			const sanitized = args.map(sanitizeForLogging);
			console.info('[INFO]', ...sanitized);
		}
	},
	
	/**
	 * Warning logs - always shown
	 */
	warn: (...args) => {
		const sanitized = args.map(sanitizeForLogging);
		console.warn('[WARN]', ...sanitized);
	},
	
	/**
	 * Error logs - always shown (errors are important)
	 */
	error: (...args) => {
		const sanitized = args.map(sanitizeForLogging);
		console.error('[ERROR]', ...sanitized);
	},
	
	/**
	 * Check if logging is enabled
	 */
	isEnabled: () => isDev
};

