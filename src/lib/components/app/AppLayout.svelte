<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { isUnlocked } from '../../stores/keyStore.js';
	import { initializeAutoLock, recordActivity } from '../../utils/autoLock.js';
	import { notesMetadata, currentNote } from '../../stores/notesStore.js';
	import { initializeNotificationSystem } from '../../utils/notifications.js';
	import UnlockScreen from '../UnlockScreen.svelte';
	import Sidebar from './Sidebar.svelte';
	import MainContent from './MainContent.svelte';
	import DialogsContainer from './DialogsContainer.svelte';
	import KeyboardHandler from './KeyboardHandler.svelte';
	import CalendarView from '../CalendarView.svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// Global app state
	let sidebarOpen = true;
	let autoLockCleanup = null;
	let notificationCleanup = null;
	let dialogsContainer = null;

	// Calendar state
	let showCalendar = false;
	let selectedCalendarDate = null;

	// Initialize auto-lock when app unlocks
	$: if ($isUnlocked && browser) {
		if (!autoLockCleanup) {
			autoLockCleanup = initializeAutoLock();
		}
	} else if (!$isUnlocked && autoLockCleanup) {
		autoLockCleanup();
		autoLockCleanup = null;
	}

	// Initialize notification system when unlocked and notes are loaded
	$: if ($isUnlocked && browser && $notesMetadata.length > 0) {
		if (!notificationCleanup) {
			notificationCleanup = initializeNotificationSystem($notesMetadata, 60); // Check every 60 minutes
		}
	} else if (!$isUnlocked && notificationCleanup) {
		notificationCleanup();
		notificationCleanup = null;
	}

	// Update notification system when notes change
	$: if (notificationCleanup && $notesMetadata) {
		// Restart notification system with updated notes
		notificationCleanup();
		notificationCleanup = initializeNotificationSystem($notesMetadata, 60);
	}

	// Record activity on user interactions
	function handleUserActivity() {
		if ($isUnlocked) {
			recordActivity();
		}
	}

	// Handle events from child components
	function handleKeyboardShortcut(event) {
		const { type, payload } = event.detail || event;

		switch (type) {
			case 'focusSearch':
				// Focus search bar logic would go here
				break;
			case 'toggleSidebar':
				sidebarOpen = !sidebarOpen;
				break;
			case 'exportNotes':
				// Export logic would go here
				break;
			case 'escapePressed':
				// Close any open dialogs/menus
				break;
		}
	}

	// Handle events from MainContent and forward to DialogsContainer
	function handleMainContentEvent(event) {
		if (dialogsContainer && dialogsContainer.handleMainContentEvent) {
			dialogsContainer.handleMainContentEvent(event);
		}
	}

	// Calendar functions
	function toggleCalendar() {
		showCalendar = !showCalendar;
		if (!showCalendar) {
			selectedCalendarDate = null;
		}
	}

	function handleDateSelect(event) {
		const { date, notes: dayNotes } = event.detail;
		selectedCalendarDate = date;
	}

	async function handleCreateNoteFromCalendar(event) {
		const { date } = event.detail;
		// Create a new note (this now saves automatically)
		const { createNewNote, saveCurrentNote, currentNote } = await import('../../stores/notesStore.js');
		const newNote = await createNewNote();
		
		// Set the scheduled date immediately
		newNote.scheduledFor = `${date}T00:00:00.000Z`;
		
		// Save again to persist the scheduled date (createNewNote already saved, but we need to save the scheduled date)
		await saveCurrentNote();
	}

	async function handleNoteClickFromCalendar(event) {
		const { note } = event.detail;
		// Set the clicked note as current
		const { currentNote } = await import('../../stores/notesStore.js');
		currentNote.set(note);
	}

	onDestroy(() => {
		if (autoLockCleanup) {
			autoLockCleanup();
		}
		if (notificationCleanup) {
			notificationCleanup();
		}
	});
</script>

{#if !$isUnlocked}
	<UnlockScreen />
{:else}
	<div class="app-layout" on:mousedown={handleUserActivity} on:keypress={handleUserActivity}>
		<KeyboardHandler />
		<div class="app-container">
			<Sidebar bind:sidebarOpen {showCalendar} {toggleCalendar} {selectedCalendarDate} {handleDateSelect} {handleCreateNoteFromCalendar} {handleNoteClickFromCalendar} />
			<MainContent {sidebarOpen} on:mainContentEvent={handleMainContentEvent} />
		</div>
		<DialogsContainer bind:this={dialogsContainer} />

		<!-- Event handlers for child components -->
		<div style="display: none;">
			<KeyboardHandler on:keyboardShortcut={handleKeyboardShortcut} />
		</div>
	</div>
{/if}

<style>
	.app-layout {
		height: 100vh;
		overflow: hidden;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.app-container {
		display: flex;
		height: 100vh;
		position: relative;
	}

	/* Ensure proper focus handling */
	.app-layout:focus {
		outline: none;
	}
</style>
