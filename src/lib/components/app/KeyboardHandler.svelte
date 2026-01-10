<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { isUnlocked } from '../../stores/keyStore.js';
	import { currentNote, createNewNote, saveCurrentNote, deleteNoteById } from '../../stores/notesStore.js';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let keydownHandler = null;

	// Keyboard shortcuts
	function handleKeydown(event) {
		// Only handle shortcuts if app is unlocked
		if (!$isUnlocked) return;

		// Ignore shortcuts when typing in inputs/textareas
		const target = event.target;
		const isInput = target.tagName === 'INPUT' ||
		               target.tagName === 'TEXTAREA' ||
		               target.contentEditable === 'true' ||
		               target.classList.contains('ProseMirror');

		// Cmd/Ctrl + N: New note
		if ((event.metaKey || event.ctrlKey) && event.key === 'n' && !isInput) {
			event.preventDefault();
			createNewNote();
			return;
		}

		// Cmd/Ctrl + S: Save note
		if ((event.metaKey || event.ctrlKey) && event.key === 's' && !isInput) {
			event.preventDefault();
			saveCurrentNote();
			return;
		}

		// Cmd/Ctrl + Delete/Backspace: Delete current note
		if ((event.metaKey || event.ctrlKey) && (event.key === 'Delete' || event.key === 'Backspace') && !isInput) {
			event.preventDefault();
			if ($currentNote) {
				if (confirm('Are you sure you want to delete this note?')) {
					deleteNoteById($currentNote.id);
				}
			}
			return;
		}

		// Escape: Close dialogs/menus
		if (event.key === 'Escape') {
			dispatch('escapePressed');
			return;
		}

		// Cmd/Ctrl + K: Focus search
		if ((event.metaKey || event.ctrlKey) && event.key === 'k' && !isInput) {
			event.preventDefault();
			dispatch('focusSearch');
			return;
		}

		// Cmd/Ctrl + B: Toggle sidebar
		if ((event.metaKey || event.ctrlKey) && event.key === 'b' && !isInput) {
			event.preventDefault();
			dispatch('toggleSidebar');
			return;
		}

		// Cmd/Ctrl + Shift + E: Export
		if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'E' && !isInput) {
			event.preventDefault();
			dispatch('exportNotes');
			return;
		}
	}

	onMount(() => {
		if (browser) {
			keydownHandler = handleKeydown;
			document.addEventListener('keydown', keydownHandler);
		}
	});

	onDestroy(() => {
		if (browser && keydownHandler) {
			document.removeEventListener('keydown', keydownHandler);
		}
	});
</script>

<!-- This component doesn't render anything, it just handles keyboard events -->
