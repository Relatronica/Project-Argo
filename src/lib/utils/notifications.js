/**
 * Notification System for Due Date Reminders
 * Uses browser Notification API for desktop notifications
 */

import { browser } from '$app/environment';

// Notification settings key for localStorage
const NOTIF_SETTINGS_KEY = 'notification_settings';

// Default notification settings
const DEFAULT_SETTINGS = {
	enabled: false,
	dueDateReminder: true, // Notify on due date
	beforeDueDate: true, // Notify 1 day before
	scheduledReminder: true, // Notify on scheduled date
	permissions: 'default' // 'granted', 'denied', or 'default'
};

/**
 * Get notification settings from localStorage
 */
export function getNotificationSettings() {
	if (!browser) return DEFAULT_SETTINGS;
	
	try {
		const stored = localStorage.getItem(NOTIF_SETTINGS_KEY);
		if (stored) {
			const settings = JSON.parse(stored);
			return { ...DEFAULT_SETTINGS, ...settings };
		}
	} catch (error) {
		console.error('Error loading notification settings:', error);
	}
	
	return DEFAULT_SETTINGS;
}

/**
 * Save notification settings to localStorage
 */
export function saveNotificationSettings(settings) {
	if (!browser) return;
	
	try {
		localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
	} catch (error) {
		console.error('Error saving notification settings:', error);
	}
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission() {
	if (!browser || !('Notification' in window)) {
		return 'unsupported';
	}
	
	if (Notification.permission === 'granted') {
		return 'granted';
	}
	
	if (Notification.permission === 'denied') {
		return 'denied';
	}
	
	try {
		const permission = await Notification.requestPermission();
		
		// Update settings with permission status
		const settings = getNotificationSettings();
		settings.permissions = permission;
		settings.enabled = permission === 'granted';
		saveNotificationSettings(settings);
		
		return permission;
	} catch (error) {
		console.error('Error requesting notification permission:', error);
		return 'denied';
	}
}

/**
 * Check if notifications are supported and permitted
 */
export function canShowNotifications() {
	if (!browser || !('Notification' in window)) {
		return false;
	}
	
	const settings = getNotificationSettings();
	return settings.enabled && Notification.permission === 'granted';
}

/**
 * Show a browser notification
 */
export function showNotification(title, options = {}) {
	if (!canShowNotifications()) {
		return null;
	}
	
	try {
		const notification = new Notification(title, {
			icon: '/favicon.png', // Your app icon
			badge: '/favicon.png',
			tag: options.tag || 'privacy-notes',
			renotify: options.renotify || false,
			requireInteraction: options.requireInteraction || false,
			...options
		});
		
		// Auto close after 10 seconds if not require interaction
		if (!options.requireInteraction) {
			setTimeout(() => notification.close(), 10000);
		}
		
		return notification;
	} catch (error) {
		console.error('Error showing notification:', error);
		return null;
	}
}

/**
 * Check notes and send reminders for due dates and scheduled dates
 */
export function checkAndNotifyDueDates(notes) {
	if (!canShowNotifications()) {
		return [];
	}
	
	const settings = getNotificationSettings();
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);
	
	const notifications = [];
	
	notes.forEach(note => {
		const noteTitle = note.title || 'Untitled Note';
		
		// Check due date
		if (note.dueDate && settings.dueDateReminder) {
			const dueDate = new Date(note.dueDate);
			const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
			
			// Due today
			if (dueDateOnly.getTime() === today.getTime()) {
				const notif = showNotification('📌 Due Today!', {
					body: `"${noteTitle}" is due today`,
					tag: `due-today-${note.id}`,
					data: { noteId: note.id, type: 'due-today' }
				});
				if (notif) notifications.push(notif);
			}
			
			// Due tomorrow (if beforeDueDate is enabled)
			if (settings.beforeDueDate && dueDateOnly.getTime() === tomorrow.getTime()) {
				const notif = showNotification('⏰ Due Tomorrow', {
					body: `"${noteTitle}" is due tomorrow`,
					tag: `due-tomorrow-${note.id}`,
					data: { noteId: note.id, type: 'due-tomorrow' }
				});
				if (notif) notifications.push(notif);
			}
			
			// Overdue
			if (dueDateOnly.getTime() < today.getTime()) {
				const daysOverdue = Math.floor((today.getTime() - dueDateOnly.getTime()) / (1000 * 60 * 60 * 24));
				const notif = showNotification('⚠️ Overdue!', {
					body: `"${noteTitle}" was due ${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} ago`,
					tag: `overdue-${note.id}`,
					requireInteraction: true,
					data: { noteId: note.id, type: 'overdue' }
				});
				if (notif) notifications.push(notif);
			}
		}
		
		// Check scheduled date
		if (note.scheduledFor && settings.scheduledReminder) {
			const scheduledDate = new Date(note.scheduledFor);
			const scheduledDateOnly = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate());
			
			// Scheduled for today
			if (scheduledDateOnly.getTime() === today.getTime()) {
				const notif = showNotification('📅 Scheduled for Today', {
					body: `You planned to work on "${noteTitle}" today`,
					tag: `scheduled-${note.id}`,
					data: { noteId: note.id, type: 'scheduled' }
				});
				if (notif) notifications.push(notif);
			}
		}
	});
	
	return notifications;
}

/**
 * Get last notification check timestamp
 */
export function getLastNotificationCheck() {
	if (!browser) return null;
	
	try {
		const timestamp = localStorage.getItem('last_notification_check');
		return timestamp ? parseInt(timestamp, 10) : null;
	} catch (error) {
		return null;
	}
}

/**
 * Save notification check timestamp
 */
export function saveNotificationCheck() {
	if (!browser) return;
	
	try {
		localStorage.setItem('last_notification_check', Date.now().toString());
	} catch (error) {
		console.error('Error saving notification check:', error);
	}
}

/**
 * Check if enough time has passed since last check (avoid spam)
 * Returns true if we should check again
 */
export function shouldCheckNotifications(intervalMinutes = 60) {
	const lastCheck = getLastNotificationCheck();
	if (!lastCheck) return true;
	
	const now = Date.now();
	const elapsed = now - lastCheck;
	const interval = intervalMinutes * 60 * 1000;
	
	return elapsed >= interval;
}

/**
 * Initialize notification system and start periodic checks
 * Returns cleanup function
 */
export function initializeNotificationSystem(notes, intervalMinutes = 60) {
	if (!browser) return () => {};
	
	// Initial check
	if (shouldCheckNotifications(intervalMinutes)) {
		checkAndNotifyDueDates(notes);
		saveNotificationCheck();
	}
	
	// Set up periodic check
	const intervalId = setInterval(() => {
		if (shouldCheckNotifications(intervalMinutes)) {
			checkAndNotifyDueDates(notes);
			saveNotificationCheck();
		}
	}, intervalMinutes * 60 * 1000); // Check every intervalMinutes
	
	// Return cleanup function
	return () => {
		clearInterval(intervalId);
	};
}

