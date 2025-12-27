/**
 * Auto-lock utility
 * Automatically locks the app after a period of inactivity
 */

import { isUnlocked } from '../stores/keyStore.js';
import { masterKey } from '../stores/notesStore.js';
import { get } from 'svelte/store';

const DEFAULT_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = 'notes-auto-lock-timeout';
const STORAGE_KEY_ENABLED = 'notes-auto-lock-enabled';

let inactivityTimer = null;
let lastActivityTime = Date.now();

/**
 * Get auto-lock timeout from settings (in milliseconds)
 * @returns {number} - Timeout in milliseconds
 */
export function getAutoLockTimeout() {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return parseInt(stored, 10);
		}
	} catch {
		// If localStorage fails, use default
	}
	return DEFAULT_TIMEOUT;
}

/**
 * Set auto-lock timeout
 * @param {number} timeout - Timeout in milliseconds
 */
export function setAutoLockTimeout(timeout) {
	try {
		localStorage.setItem(STORAGE_KEY, timeout.toString());
	} catch {
		// If localStorage fails, ignore
	}
}

/**
 * Check if auto-lock is enabled
 * @returns {boolean}
 */
export function isAutoLockEnabled() {
	try {
		const stored = localStorage.getItem(STORAGE_KEY_ENABLED);
		return stored !== 'false'; // Default to enabled
	} catch {
		return true; // Default to enabled
	}
}

/**
 * Enable or disable auto-lock
 * @param {boolean} enabled
 */
export function setAutoLockEnabled(enabled) {
	try {
		localStorage.setItem(STORAGE_KEY_ENABLED, enabled.toString());
		if (!enabled) {
			clearInactivityTimer();
		} else {
			resetInactivityTimer();
		}
	} catch {
		// If localStorage fails, ignore
	}
}

/**
 * Lock the app (clear master key and set unlocked to false)
 */
function lockApp() {
	const $isUnlocked = get(isUnlocked);
	if ($isUnlocked) {
		// Clear master key
		masterKey.set(null);
		isUnlocked.set(false);
		
		// Clear password from any input fields (if accessible)
		// Note: This is handled by the component clearing its own state
	}
}

/**
 * Clear the inactivity timer
 */
export function clearInactivityTimer() {
	if (inactivityTimer) {
		clearTimeout(inactivityTimer);
		inactivityTimer = null;
	}
}

/**
 * Reset the inactivity timer
 */
export function resetInactivityTimer() {
	clearInactivityTimer();
	
	if (!isAutoLockEnabled()) {
		return;
	}
	
	const $isUnlocked = get(isUnlocked);
	if (!$isUnlocked) {
		return; // Already locked
	}
	
	const timeout = getAutoLockTimeout();
	lastActivityTime = Date.now();
	
	inactivityTimer = setTimeout(() => {
		const timeSinceActivity = Date.now() - lastActivityTime;
		if (timeSinceActivity >= timeout) {
			lockApp();
		}
	}, timeout);
}

/**
 * Record user activity (call this on user interactions)
 */
export function recordActivity() {
	if (!isAutoLockEnabled()) {
		return;
	}
	
	const $isUnlocked = get(isUnlocked);
	if ($isUnlocked) {
		resetInactivityTimer();
	}
}

/**
 * Initialize auto-lock listeners
 * Call this when the app unlocks
 */
export function initializeAutoLock() {
	if (!isAutoLockEnabled()) {
		return;
	}
	
	// Reset timer on app unlock
	resetInactivityTimer();
	
	// Listen for user activity events
	const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
	
	const activityHandler = () => {
		recordActivity();
	};
	
	events.forEach(event => {
		document.addEventListener(event, activityHandler, { passive: true });
	});
	
	// Return cleanup function
	return () => {
		events.forEach(event => {
			document.removeEventListener(event, activityHandler);
		});
		clearInactivityTimer();
	};
}

/**
 * Get time until auto-lock (in milliseconds)
 * @returns {number} - Milliseconds until lock, or 0 if disabled/locked
 */
export function getTimeUntilLock() {
	if (!isAutoLockEnabled()) {
		return 0;
	}
	
	const $isUnlocked = get(isUnlocked);
	if (!$isUnlocked) {
		return 0;
	}
	
	const timeout = getAutoLockTimeout();
	const timeSinceActivity = Date.now() - lastActivityTime;
	const timeRemaining = timeout - timeSinceActivity;
	
	return Math.max(0, timeRemaining);
}

