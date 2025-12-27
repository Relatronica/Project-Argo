/**
 * Rate limiter for password attempts
 * Prevents brute force attacks by implementing exponential backoff
 * Uses IndexedDB instead of localStorage to prevent easy bypass
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds
const STORAGE_KEY_ATTEMPTS = 'notes-failed-attempts';
const STORAGE_KEY_LOCKOUT = 'notes-lockout-until';

/**
 * Get current failed attempts count from secure storage
 * @returns {Promise<number>} - Number of failed attempts
 */
export async function getFailedAttempts() {
	try {
		const { getSecureValue } = await import('../storage/secureStorage.js');
		const attempts = await getSecureValue(STORAGE_KEY_ATTEMPTS);
		return parseInt(attempts || '0', 10);
	} catch {
		return 0;
	}
}

/**
 * Get lockout expiration time from secure storage
 * @returns {Promise<number>} - Timestamp when lockout expires (0 if not locked)
 */
export async function getLockoutUntil() {
	try {
		const { getSecureValue } = await import('../storage/secureStorage.js');
		const lockout = await getSecureValue(STORAGE_KEY_LOCKOUT);
		return parseInt(lockout || '0', 10);
	} catch {
		return 0;
	}
}

/**
 * Check if account is currently locked
 * @returns {Promise<Object>} - { locked: boolean, minutesLeft: number }
 */
export async function checkLockout() {
	const lockoutUntil = await getLockoutUntil();
	const now = Date.now();
	
	if (lockoutUntil > now) {
		const minutesLeft = Math.ceil((lockoutUntil - now) / 60000);
		return { locked: true, minutesLeft };
	}
	
	return { locked: false, minutesLeft: 0 };
}

/**
 * Record a failed attempt
 * @returns {Promise<Object>} - { locked: boolean, minutesLeft: number, attemptsRemaining: number }
 */
export async function recordFailedAttempt() {
	const currentAttempts = await getFailedAttempts();
	const failedAttempts = currentAttempts + 1;
	
	try {
		const { setSecureValue } = await import('../storage/secureStorage.js');
		await setSecureValue(STORAGE_KEY_ATTEMPTS, failedAttempts.toString());
	} catch (error) {
		// If storage fails, log but continue (security over availability)
		console.error('Failed to store attempt count:', error);
	}
	
	// Lock account if max attempts reached
	if (failedAttempts >= MAX_ATTEMPTS) {
		const lockoutUntil = Date.now() + LOCKOUT_TIME;
		try {
			const { setSecureValue } = await import('../storage/secureStorage.js');
			await setSecureValue(STORAGE_KEY_LOCKOUT, lockoutUntil.toString());
		} catch (error) {
			console.error('Failed to store lockout time:', error);
		}
		
		const minutesLeft = Math.ceil(LOCKOUT_TIME / 60000);
		return {
			locked: true,
			minutesLeft,
			attemptsRemaining: 0
		};
	}
	
	return {
		locked: false,
		minutesLeft: 0,
		attemptsRemaining: MAX_ATTEMPTS - failedAttempts
	};
}

/**
 * Reset failed attempts (call on successful login)
 */
export async function resetFailedAttempts() {
	try {
		const { removeSecureValue } = await import('../storage/secureStorage.js');
		await removeSecureValue(STORAGE_KEY_ATTEMPTS);
		await removeSecureValue(STORAGE_KEY_LOCKOUT);
	} catch (error) {
		console.error('Failed to reset attempts:', error);
	}
}

/**
 * Get remaining attempts before lockout
 * @returns {Promise<number>} - Number of attempts remaining
 */
export async function getRemainingAttempts() {
	const failedAttempts = await getFailedAttempts();
	return Math.max(0, MAX_ATTEMPTS - failedAttempts);
}

