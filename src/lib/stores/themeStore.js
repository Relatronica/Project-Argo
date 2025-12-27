import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Theme store - simple boolean for dark mode
export const isDarkTheme = writable(true);

// Initialize theme from localStorage or system preference
if (browser) {
	const savedTheme = localStorage.getItem('theme');
	if (savedTheme) {
		isDarkTheme.set(savedTheme === 'dark');
	} else {
		// Check system preference
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		isDarkTheme.set(prefersDark);
	}
}

// Function to toggle theme
export function toggleTheme() {
	isDarkTheme.update(current => {
		const newTheme = !current;
		if (browser) {
			localStorage.setItem('theme', newTheme ? 'dark' : 'light');
		}
		return newTheme;
	});
}

// Function to update body class
export function updateBodyClass(isDark) {
	if (!browser) return;

	const body = document.body;
	if (isDark) {
		body.classList.remove('light');
		body.classList.add('dark');
	} else {
		body.classList.remove('dark');
		body.classList.add('light');
	}
}
