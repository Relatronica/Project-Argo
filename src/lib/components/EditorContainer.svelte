<script>
	import { onMount, onDestroy } from 'svelte';
	import { hasUnsavedChanges, currentNote, masterKey } from '../stores/notesStore.js';
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

		// ALWAYS update previousNoteData with latest data for the CURRENT note
		// IMPORTANT: Only update if note.id matches currentNoteId to avoid updating with wrong note's data
		// This ensures we have the latest data when note changes
		if (note.id === currentNoteId) {
			previousNoteData = {
				whiteboardData: note.whiteboardData,
				content: note.content
			};
			console.log('[EditorContainer] Updated previousNoteData for note:', note.id, {
				whiteboardDataLength: previousNoteData.whiteboardData?.length || 0,
				contentLength: previousNoteData.content?.length || 0
			});
		} else {
			console.warn('[EditorContainer] handleContentChange called for note:', note.id, 'but currentNoteId is:', currentNoteId, '- ignoring update');
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

	// Selection update handler
	function handleSelectionUpdate() {
		// Handle selection updates if needed
	}

	// Editor ready handler - when editor is ready, sync previousNoteData with current note's data
	function handleEditorReady() {
		editorReady = true;
		// When editor is ready, sync previousNoteData with current note's data
		// This ensures we have valid data for saving when note changes
		// The editor has loaded all data (including whiteboard) at this point
		// IMPORTANT: Update previousNoteData to reflect the loaded data
		if (note && note.id === currentNoteId) {
			previousNoteData = {
				whiteboardData: note.whiteboardData,
				content: note.content
			};
			console.log('[EditorContainer] Editor ready, synced previousNoteData for note:', note.id, {
				hasWhiteboardData: !!previousNoteData.whiteboardData,
				hasContent: !!previousNoteData.content
			});
		}
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
			
			console.log('[EditorContainer] Saving pending changes for note:', previousNoteId);
			
			// Load the previous note from storage
			const previousNote = await loadNoteById(previousNoteId);
			if (!previousNote) {
				console.warn('[EditorContainer] Could not load previous note for saving');
				return;
			}
			
			// Update the loaded note with latest data from memory (whiteboardData/content)
			// This ensures we save the most recent data even if auto-save hasn't fired yet
			if (latestData) {
				if (latestData.whiteboardData !== undefined && latestData.whiteboardData !== null) {
					previousNote.whiteboardData = latestData.whiteboardData;
					console.log('[EditorContainer] Updating note with latest whiteboardData');
				}
				if (latestData.content !== undefined && latestData.content !== null) {
					previousNote.content = latestData.content;
					console.log('[EditorContainer] Updating note with latest content');
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
			console.log('[EditorContainer] Pending changes saved successfully');
		} catch (error) {
			console.error('[EditorContainer] Error saving pending changes:', error);
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
			console.log('[EditorContainer] Change detected:', {
				noteChanged: noteChanged ? `${currentNoteId} → ${newNoteId}` : false,
				modeChanged: modeChanged ? `${currentMode} → ${newMode}` : false
			});

			// Save any pending changes before switching
			// IMPORTANT: Save the previous note using previousNoteData
			// previousNoteData contains the latest whiteboardData/content for the CURRENT note (before it becomes previous)
			if (noteChanged && currentNoteId) {
				// Always try to save - use previousNoteData if available, otherwise log warning
				if (previousNoteData) {
					const whiteboardPreview = typeof previousNoteData.whiteboardData === 'string' 
						? previousNoteData.whiteboardData.substring(0, 50) 
						: previousNoteData.whiteboardData 
							? JSON.stringify(previousNoteData.whiteboardData).substring(0, 50)
							: 'null';
					console.log('[EditorContainer] Saving previous note before switch:', currentNoteId, {
						hasWhiteboardData: !!previousNoteData.whiteboardData,
						hasContent: !!previousNoteData.content,
						whiteboardDataPreview: whiteboardPreview
					});
					savePendingChanges(currentNoteId, previousNoteData);
				} else {
					console.warn('[EditorContainer] No previousNoteData to save for note:', currentNoteId, '- data may be lost!');
				}
			}
			// For mode changes: MainContent.handleModeToggle() already saves before and after mode change
			// So we skip saving here to avoid duplicate saves

			// Force re-initialization
			editorReady = false;
			
			// Update tracking variables FIRST (before initializing previousNoteData)
			const previousNoteIdForSave = currentNoteId; // Save reference before updating
			currentNoteId = newNoteId;
			currentMode = newMode;
			
			// Initialize previousNoteData with NEW note's data immediately
			// This will be updated by handleContentChange/handleEditorReady when data changes/loads
			previousNoteData = {
				whiteboardData: note.whiteboardData,
				content: note.content
			};
		} else if (currentNoteId === null) {
			// First initialization
			currentNoteId = newNoteId;
			currentMode = newMode;
			// Initialize previousNoteData with current note's data
			previousNoteData = {
				whiteboardData: note.whiteboardData,
				content: note.content
			};
		}

		currentEditor = newMode;
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
