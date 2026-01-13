<script>
	import { onDestroy } from 'svelte';
	import { hasUnsavedChanges, currentNote, masterKey, saveStatus } from '../stores/notesStore.js';
	import { setLoadingNote } from '../stores/loadingStore.js';
	import { get } from 'svelte/store';
	import TextEditor from './editor/TextEditor.svelte';
	import WhiteboardLayout from './editor/WhiteboardLayout.svelte';

	// Props
	export let note;

	// Internal state
	let currentEditor = 'text';
	let editorReady = false;
	let autoSaveTimer = null;

	// Track current note and mode to detect changes
	let currentNoteId = null;
	let currentMode = 'text';
	let previousNoteData = null; // Keep latest data (whiteboardData/content) for the CURRENT note

	// Content change handler - unified for both editors
	function handleContentChange(content) {
		if (!note) return;

		// CRITICAL: Don't process content changes if we're processing a note change
		// This prevents data from being written to the wrong note during rapid note switching
		if (isProcessingNoteChange) {
			console.log('[EditorContainer] Ignoring content change during note change processing');
			return;
		}

		// CRITICAL: Only process content changes if note.id matches currentNoteId
		// This prevents data from being written to the wrong note during rapid note switching
		if (note.id !== currentNoteId) {
			console.log('[EditorContainer] Ignoring content change for note', note.id, 'current note is', currentNoteId);
			return;
		}

		// If content is whiteboardData (stringified JSON), update note.whiteboardData
		// Otherwise, update note.content for text editor
		if (typeof content === 'string' && (content.startsWith('{"paths":') || content.trim() === '{"paths":[]}')) {
			// This is whiteboard data - already updated by WhiteboardLayout
			// Just ensure note.whiteboardData is set (it should already be)
			if (note.whiteboardData !== content) {
				note.whiteboardData = content;
			}
		} else {
			// This is text content
			note.content = content;
		}

		// Update previousNoteData with latest data for the CURRENT note
		// Only update if note.id matches currentNoteId to avoid updating with wrong note's data
		if (note.id === currentNoteId) {
			previousNoteData = {
				whiteboardData: note.whiteboardData,
				content: note.content
			};
		}

		// Mark as having unsaved changes and start auto-save timer only if editor is ready
		if (editorReady && note.id === currentNoteId) {
			hasUnsavedChanges.set(true);

			// Clear existing timer
			if (autoSaveTimer) {
				clearTimeout(autoSaveTimer);
			}

			// Set new timer for auto-save (2 seconds after last change)
			autoSaveTimer = setTimeout(async () => {
				if (note && editorReady && note.id === currentNoteId) {
					try {
						const { saveCurrentNote } = await import('../stores/notesStore.js');
						await saveCurrentNote();
						hasUnsavedChanges.set(false);
					} catch (error) {
						console.error('[EditorContainer] Error auto-saving:', error);
					}
				}
			}, 2000);
		}
	}

	// Selection update handler (currently unused but kept for future use)
	function handleSelectionUpdate() {
		// Handle selection updates if needed
	}

	// Editor ready handler - sync previousNoteData with current note's data
	function handleEditorReady() {
		editorReady = true;
		// Sync previousNoteData when editor is ready to ensure we have valid data for saving
		if (note && note.id === currentNoteId) {
			previousNoteData = {
				whiteboardData: note.whiteboardData,
				content: note.content
			};
		}
		// Clear loading state when editor is ready
		setLoadingNote(false);
	}

	// Save pending changes before switching notes/modes
	async function savePendingChanges(previousNoteId, latestData) {
		// Clear the timer first to prevent duplicate saves
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
			autoSaveTimer = null;
		}
		
		if (!previousNoteId) {
			console.warn('[EditorContainer] No previousNoteId provided for saving');
			return;
		}
		
		// Note: we don't check editorReady here because we want to save even during mode/note changes
		// when editorReady might be temporarily false
		
		try {
			const { loadNoteById, loadNotes } = await import('../stores/notesStore.js');
			
			// Load the previous note from storage
			const previousNote = await loadNoteById(previousNoteId);
			if (!previousNote) {
				console.warn('[EditorContainer] Could not load previous note for saving');
				return;
			}
			
			// Update the loaded note with latest data from memory
			// This ensures we save the most recent data even if auto-save hasn't fired yet
			if (latestData) {
				if (latestData.whiteboardData !== undefined && latestData.whiteboardData !== null) {
					previousNote.whiteboardData = latestData.whiteboardData;
				}
				if (latestData.content !== undefined && latestData.content !== null) {
					previousNote.content = latestData.content;
				}
			}
			
			// Get master key and encryption function (same pattern as notesStore.js)
			const $masterKey = get(masterKey);
			let encryptNote = undefined;
			if ($masterKey) {
				try {
					const cryptoModule = await import('../crypto/encryption.js');
					encryptNote = cryptoModule.encryptNote;
				} catch (error) {
					console.warn('[EditorContainer] Could not load crypto module:', error);
				}
			}
			
			// Save the note directly using Note.save()
			await previousNote.save($masterKey || undefined, encryptNote);
			
			// Reload notes list to update metadata
			await loadNotes();
			
			hasUnsavedChanges.set(false);
		} catch (error) {
			console.error('[EditorContainer] Error saving pending changes:', error);
			throw error;
		}
	}

	// Track if we're currently saving to prevent race conditions
	let isSaving = false;
	let savePromise = null;
	
	// Track pending note changes to handle rapid note switching
	let pendingNoteChange = null;
	let isProcessingNoteChange = false;

	// Helper function to normalize whiteboard data
	function normalizeWhiteboardData(whiteboardData) {
		if (!whiteboardData) return null;
		if (typeof whiteboardData !== 'string') return null;
		const trimmed = whiteboardData.trim();
		if (trimmed === '' || trimmed === '{}' || trimmed === '{"paths":[]}' || trimmed === '{"paths": []}') {
			return null;
		}
		return whiteboardData;
	}

	// Async function to handle note/mode changes
	async function handleNoteChange(newNoteId, newMode, noteChanged, modeChanged) {
		// If we're already processing a note change, queue this one
		if (isProcessingNoteChange) {
			pendingNoteChange = { newNoteId, newMode, noteChanged, modeChanged };
			console.log('[EditorContainer] Note change already in progress, queuing:', newNoteId);
			return;
		}

		isProcessingNoteChange = true;

		try {
			// Wait for any save in progress to complete
			if (savePromise) {
				try {
					await savePromise;
				} catch (error) {
					console.error('[EditorContainer] Error waiting for previous save:', error);
				}
			}

			// Save any pending changes before switching notes
			// NOTE: For mode changes, MainContent.handleModeToggle handles saving before mode change
			// So we only save here when the note itself changes, not when just the mode changes
			if (noteChanged && currentNoteId && previousNoteData) {
				// CRITICAL: Create a snapshot of previousNoteData BEFORE updating it
				// This prevents data from being overwritten if the user changes notes rapidly
				const snapshotToSave = {
					whiteboardData: previousNoteData.whiteboardData,
					content: previousNoteData.content
				};
				
				// Show loading state during save
				setLoadingNote(true, '', 'saving');
				
				isSaving = true;
				savePromise = (async () => {
					try {
						saveStatus.set('saving');
						await savePendingChanges(currentNoteId, snapshotToSave);
						
						saveStatus.set('saved');
						setTimeout(() => saveStatus.set('idle'), 1500);
					} catch (error) {
						console.error('[EditorContainer] Error saving previous note:', error);
						saveStatus.set('error');
						setTimeout(() => saveStatus.set('idle'), 3000);
						throw error;
					} finally {
						isSaving = false;
						savePromise = null;
					}
				})();
				
				await savePromise;
			}

			// Check if note changed while we were saving (user selected another note)
			// In that case, skip this change and process the pending one
			if (pendingNoteChange && pendingNoteChange.newNoteId !== newNoteId) {
				console.log('[EditorContainer] Note changed during save, processing pending:', pendingNoteChange.newNoteId);
				const pending = pendingNoteChange;
				pendingNoteChange = null;
				isProcessingNoteChange = false;
				// Process the pending change
				handleNoteChange(pending.newNoteId, pending.newMode, pending.noteChanged, pending.modeChanged);
				return;
			}

			// Show loading state while initializing new note
			setLoadingNote(true, '', 'loading');

			// Force re-initialization
			editorReady = false;
			
			// Update tracking variables
			currentNoteId = newNoteId;
			currentMode = newMode;
			
			// Initialize previousNoteData with NEW note's data
			// IMPORTANT: Don't normalize here - use note.whiteboardData as-is to preserve data
			// Normalization should only happen when saving, not when loading
			previousNoteData = {
				whiteboardData: note.whiteboardData || null,
				content: note.content || ''
			};

			currentEditor = newMode;
			
			// Clear loading state after a brief delay to allow editor to initialize
			// The loading will be cleared when editor is ready (handleEditorReady)
		} finally {
			isProcessingNoteChange = false;
			
			// Process any pending note change
			if (pendingNoteChange) {
				const pending = pendingNoteChange;
				pendingNoteChange = null;
				handleNoteChange(pending.newNoteId, pending.newMode, pending.noteChanged, pending.modeChanged);
			}
		}
	}

	// Reactive statement to handle note/mode changes
	$: if (note) {
		const newNoteId = note.id;
		const newMode = note.mode || 'text';

		// Check if note changed or mode changed
		const noteChanged = currentNoteId !== null && currentNoteId !== newNoteId;
		const modeChanged = currentMode !== newMode;

		if (noteChanged || modeChanged) {
			// Trigger async handling - this will await the save before proceeding
			handleNoteChange(newNoteId, newMode, noteChanged, modeChanged);
		} else if (currentNoteId === null) {
			// First initialization
			currentNoteId = newNoteId;
			currentMode = newMode;
			// IMPORTANT: Don't normalize here - use note.whiteboardData as-is to preserve data
			previousNoteData = {
				whiteboardData: note.whiteboardData || null,
				content: note.content || ''
			};

			currentEditor = newMode;
		}
	}

	// Cleanup - save before destroying
	onDestroy(() => {
		// Save synchronously if possible, or fire async save
		if (autoSaveTimer && note && editorReady) {
			clearTimeout(autoSaveTimer);
			autoSaveTimer = null;
			// Fire async save (can't await in onDestroy)
			savePendingChanges();
		} else if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
		}
	});
</script>

	{#if note}
	{#if currentEditor === 'text'}
		<TextEditor
			{note}
			onContentChange={handleContentChange}
			onSelectionUpdate={handleSelectionUpdate}
			onReady={handleEditorReady}
		/>
	{:else if currentEditor === 'whiteboard'}
		<WhiteboardLayout
			{note}
			onContentChange={handleContentChange}
			onSelectionUpdate={handleSelectionUpdate}
			onReady={handleEditorReady}
		/>
	{/if}
{/if}
