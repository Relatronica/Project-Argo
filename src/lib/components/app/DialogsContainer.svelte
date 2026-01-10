<script>
	import { createEventDispatcher } from 'svelte';
	import { currentNote, allTags, toggleNoteFavorite, moveNoteToFolder, deleteNoteById } from '../../stores/notesStore.js';
	import { allFolders } from '../../stores/folderStore.js';
	import { saveFileDialog } from '../../utils/electronFileAPI.js';
	import Icon from '../Icon.svelte';
	import CalendarView from '../CalendarView.svelte';
	import MoveMenu from '../MoveMenu.svelte';
	import { generateBackupHMAC } from '../../utils/backupIntegrity.js';
	import { logger } from '../../utils/logger.js';

	const dispatch = createEventDispatcher();

	// Export function for parent component to call
	export function handleMainContentEvent(event) {
		const eventDetail = event.detail;
		if (eventDetail === 'exportNote') {
			handleExport();
		} else if (eventDetail === 'deleteNote') {
			showDeleteConfirmDialog = true;
		}
	}

	// Dialog states
	let togglingFavoriteId = null;
	let deletingNoteId = null;
	let showMoveMenu = false;
	let moveMenuPosition = { x: 0, y: 0 };
	let moveButtonRef = null;
	let showDeleteConfirmDialog = false;

	// Export dialog states
	let showExportPasswordDialog = false;
	let exportPassword = '';
	let exportPasswordError = '';
	let showExportResultDialog = false;
	let exportResultMessage = '';
	let exportResultType = 'success'; // 'success' or 'error'

	// Calendar state
	let showCalendar = false;
	let selectedCalendarDate = null;

	// Handle favorite toggle
	async function handleToggleFavorite(noteId) {
		togglingFavoriteId = noteId;
		try {
			await toggleNoteFavorite(noteId);
		} finally {
			togglingFavoriteId = null;
		}
	}

	// Handle note deletion confirmation
	function confirmDeleteNote() {
		if ($currentNote) {
			handleDeleteNote($currentNote.id);
		}
		showDeleteConfirmDialog = false;
	}

	function cancelDeleteNote() {
		showDeleteConfirmDialog = false;
	}

	// Handle note deletion
	async function handleDeleteNote(noteId) {
		deletingNoteId = noteId;
		try {
			await deleteNoteById(noteId);
		} finally {
			deletingNoteId = null;
		}
	}

	// Handle move note
	function handleMoveNote(noteId, folderPath, buttonRef) {
		showMoveMenu = true;
		moveMenuPosition = {
			x: buttonRef.getBoundingClientRect().left,
			y: buttonRef.getBoundingClientRect().bottom + 5
		};
		moveButtonRef = buttonRef;

		// Store note ID for later use
		showMoveMenu = true; // This will be used in the move menu logic
		dispatch('moveNote', { noteId, folderPath });
	}

	async function confirmMoveNote(noteId, folderPath) {
		showMoveMenu = false;
		try {
			await moveNoteToFolder(noteId, folderPath);
		} catch (error) {
			console.error('Error moving note:', error);
		}
	}

	// Export functionality
	function handleExport() {
		showExportPasswordDialog = true;
	}

	async function confirmExport() {
		if (!$currentNote) {
			exportResultMessage = 'No note selected to export';
			exportResultType = 'error';
			showExportPasswordDialog = false;
			showExportResultDialog = true;
			return;
		}

		if (!exportPassword.trim()) {
			exportPasswordError = 'Password is required for encrypted export';
			return;
		}

		try {
			// Create export data for the current note
			const exportData = {
				version: '1.0',
				type: 'protected-note',
				title: $currentNote.title || 'Untitled Note',
				exportedAt: new Date().toISOString(),
				note: {
					id: $currentNote.id,
					title: $currentNote.title,
					content: $currentNote.content,
					tags: $currentNote.tags || [],
					created: $currentNote.created,
					updated: $currentNote.updated,
					mode: $currentNote.mode || 'text',
					whiteboardData: $currentNote.whiteboardData || null,
					encrypted: false, // Will be encrypted below
					ciphertext: undefined,
					nonce: undefined,
					whiteboardCiphertext: undefined,
					whiteboardNonce: undefined
				}
			};

			// Generate random salt for this export
			const { encryptForStorage, deriveMasterKey, generateSalt } = await import('../../crypto/encryption.js');
			const exportSalt = generateSalt();

			// Derive export key from password (trim to match import logic)
			const exportKey = await deriveMasterKey(exportPassword.trim(), exportSalt);

			// Encrypt only the note data (matches what import expects for protected-note)
			const dataToEncrypt = { note: exportData.note };
			const encryptedNoteData = await encryptForStorage(dataToEncrypt, exportKey);

			// Create the final protected note format
			const protectedNoteData = {
				version: '1.0',
				type: 'protected-note',
				title: $currentNote.title || 'Untitled Note',
				exportedAt: new Date().toISOString(),
				salt: exportSalt,
				encryptedData: encryptedNoteData
			};

			// Add HMAC signature for integrity verification
			const hmac = await generateBackupHMAC(protectedNoteData, exportKey);
			const finalData = {
				...protectedNoteData,
				hmac
			};

			const jsonString = JSON.stringify(finalData);
			const filename = `${$currentNote.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'untitled_note'}.pnote`;

			const result = await saveFileDialog(jsonString, filename, [
				{ name: 'Protected Note files', extensions: ['.pnote'] },
				{ name: 'JSON files', extensions: ['.json'] },
				{ name: 'All Files', extensions: ['*'] }
			]);

			if (!result.success && !result.canceled) {
				throw new Error(result.error || 'Export failed');
			}

			exportResultMessage = 'Note exported successfully!';
			exportResultType = 'success';
			showExportPasswordDialog = false;
			showExportResultDialog = true;
			exportPassword = '';
			exportPasswordError = '';

		} catch (error) {
			logger.error('Export failed:', error);
			exportResultMessage = `Export failed: ${error.message}`;
			exportResultType = 'error';
			showExportPasswordDialog = false;
			showExportResultDialog = true;
		}
	}

	function cancelExport() {
		showExportPasswordDialog = false;
		exportPassword = '';
		exportPasswordError = '';
	}

	// Calendar functionality
	function toggleCalendar() {
		showCalendar = !showCalendar;
	}

	function handleCalendarDateSelect(date) {
		selectedCalendarDate = date;
		showCalendar = false;
		dispatch('calendarDateSelected', { date });
	}

	// Close dialogs
	function closeMoveMenu() {
		showMoveMenu = false;
	}

	function closeExportResult() {
		showExportResultDialog = false;
		exportResultMessage = '';
	}
</script>

<div class="dialogs-container">
	<!-- Move Menu -->
	{#if showMoveMenu}
	<MoveMenu
		folders={$allFolders}
		position={moveMenuPosition}
		on:select={({ detail: folderPath }) => confirmMoveNote($currentNote?.id, folderPath)}
		on:close={closeMoveMenu}
	/>
{/if}

<!-- Calendar View -->
{#if showCalendar}
	<div class="calendar-overlay" on:click={() => showCalendar = false}>
		<div class="calendar-container" on:click|stopPropagation>
			<CalendarView
				selectedDate={selectedCalendarDate}
				on:dateSelected={({ detail: date }) => handleCalendarDateSelect(date)}
			/>
		</div>
	</div>
{/if}

<!-- Export Password Dialog -->
{#if showExportPasswordDialog}
	<div class="modal-overlay" on:click={cancelExport}>
		<div class="modal-content" on:click|stopPropagation>
			<h3>Export Notes</h3>
			<p>Enter a password to encrypt your exported notes:</p>

			<div class="form-group">
				<label for="export-password">Password:</label>
				<input
					id="export-password"
					type="password"
					bind:value={exportPassword}
					class="modal-input"
					placeholder="Enter encryption password"
					on:keydown={(e) => {
						if (e.key === 'Enter') confirmExport();
						else if (e.key === 'Escape') cancelExport();
					}}
					autofocus
				/>
				{#if exportPasswordError}
					<div class="error-message">{exportPasswordError}</div>
				{/if}
			</div>

			<div class="modal-actions">
				<button class="modal-btn cancel" on:click={cancelExport}>Cancel</button>
				<button class="modal-btn confirm" on:click={confirmExport} disabled={!exportPassword.trim()}>
					Export
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Export Result Dialog -->
{#if showExportResultDialog}
	<div class="modal-overlay" on:click={closeExportResult}>
		<div class="modal-content" on:click|stopPropagation>
			<h3 class="result-{exportResultType}">
				<Icon name={exportResultType === 'success' ? 'check-circle' : 'x-circle'} size={20} />
				{exportResultType === 'success' ? 'Export Successful' : 'Export Failed'}
			</h3>

			<p>{exportResultMessage}</p>

			<div class="modal-actions">
				<button class="modal-btn confirm" on:click={closeExportResult}>
					OK
				</button>
			</div>
		</div>
	</div>
	{/if}

	<!-- Delete Confirmation Dialog -->
	{#if showDeleteConfirmDialog}
		<div class="modal-overlay" on:click={cancelDeleteNote}>
			<div class="modal-content delete-modal" on:click|stopPropagation>
				<h3>
					<Icon name="alert-triangle" size={20} />
					Delete Note
				</h3>

				<p>Are you sure you want to delete "<strong>{$currentNote?.title || 'Untitled Note'}</strong>"? This action cannot be undone.</p>

				<div class="modal-actions">
					<button class="modal-btn cancel" on:click={cancelDeleteNote}>
						Cancel
					</button>
					<button class="modal-btn delete-confirm" on:click={confirmDeleteNote} disabled={deletingNoteId === $currentNote?.id}>
						{#if deletingNoteId === $currentNote?.id}
							Deleting...
						{:else}
							Delete Note
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Calendar overlay */
	.calendar-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.calendar-container {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-xl);
		padding: 1rem;
		max-width: 90vw;
		max-height: 90vh;
		overflow: auto;
	}

	/* Modal styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		backdrop-filter: blur(2px);
	}

	.modal-content {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		min-width: 400px;
		max-width: 90vw;
		box-shadow: var(--shadow-lg);
	}

	.modal-content h3 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.modal-content h3.result-success {
		color: var(--success-color, #22c55e);
	}

	.modal-content h3.result-error {
		color: var(--error-color, #ef4444);
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.modal-input {
		width: 100%;
		padding: 0.75rem;
		background: var(--input-bg, var(--bg-primary));
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		color: var(--text-primary);
		font-size: 0.9375rem;
		transition: var(--transition);
		box-sizing: border-box;
	}

	.modal-input:focus {
		outline: none;
		border-color: var(--accent-color);
		box-shadow: 0 0 0 2px var(--accent-light, rgba(59, 130, 246, 0.2));
	}

	.error-message {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: var(--error-color, #ef4444);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.modal-btn {
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: var(--transition);
		border: 1px solid var(--border-color);
	}

	.modal-btn.cancel {
		background: var(--bg-tertiary);
		color: var(--text-secondary);
	}

	.modal-btn.cancel:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.modal-btn.confirm {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.modal-btn.confirm:hover:not(:disabled) {
		background: var(--accent-hover, #2563eb);
		border-color: var(--accent-hover, #2563eb);
	}

	.modal-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Delete confirmation modal */
	.delete-modal {
		border-color: var(--error-color, #ef4444);
	}

	.delete-modal h3 {
		color: var(--error-color, #ef4444);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.modal-btn.delete-confirm {
		background: var(--error-color, #ef4444);
		color: white;
		border-color: var(--error-color, #ef4444);
	}

	.modal-btn.delete-confirm:hover:not(:disabled) {
		background: #dc2626;
		border-color: #dc2626;
	}
</style>
