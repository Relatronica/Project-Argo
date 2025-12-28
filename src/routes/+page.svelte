<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { isUnlocked } from '../lib/stores/keyStore.js';
	import { initializeAutoLock, recordActivity } from '../lib/utils/autoLock.js';
	import { masterKey, currentNote, saveCurrentNote, createNewNote, saveStatus, updateNoteTitle, updateNoteColor, toggleNoteFavorite, moveNoteToFolder, deleteNoteById, allTags } from '../lib/stores/notesStore.js';
	import { allFolders } from '../lib/stores/folderStore.js';
	import UnlockScreen from '../lib/components/UnlockScreen.svelte';
	import NoteList from '../lib/components/NoteList.svelte';
	import SearchBar from '../lib/components/SearchBar.svelte';
	import TiptapEditor from '../lib/components/TiptapEditor.svelte';
	import MoveMenu from '../lib/components/MoveMenu.svelte';
	import Icon from '../lib/components/Icon.svelte';
	import { extractNoteTitle } from '../lib/utils/noteHelpers.js';
	import { saveFileDialog } from '../lib/utils/electronFileAPI.js';

	let sidebarOpen = true;
	let editingTitle = false;
	let titleInput = '';
	let showColorDialog = false;
	let selectedColor = null;
	let togglingFavoriteId = null;
	let deletingNoteId = null;
	let showMoveMenu = false;
	let moveMenuPosition = { x: 0, y: 0 };
	let moveButtonRef = null;
	let autoLockCleanup = null;
	let showExportPasswordDialog = false;
	let exportPassword = '';
	let exportPasswordError = '';
	let showExportResultDialog = false;
	let exportResultMessage = '';
	let exportResultType = 'success'; // 'success' or 'error'
	
	// Initialize auto-lock when app unlocks
	$: if ($isUnlocked && browser) {
		if (!autoLockCleanup) {
			autoLockCleanup = initializeAutoLock();
		}
	} else if (!$isUnlocked && autoLockCleanup) {
		autoLockCleanup();
		autoLockCleanup = null;
	}
	
	// Record activity on user interactions
	function handleUserActivity() {
		if ($isUnlocked) {
			recordActivity();
		}
	}
	
	// Available colors for notes
	const noteColors = [
		{ value: null, label: 'No color', hex: 'transparent' },
		{ value: '#ef4444', label: 'Red', hex: '#ef4444' },
		{ value: '#f97316', label: 'Orange', hex: '#f97316' },
		{ value: '#eab308', label: 'Yellow', hex: '#eab308' },
		{ value: '#22c55e', label: 'Green', hex: '#22c55e' },
		{ value: '#06b6d4', label: 'Cyan', hex: '#06b6d4' },
		{ value: '#3b82f6', label: 'Blue', hex: '#3b82f6' },
		{ value: '#6366f1', label: 'Indigo', hex: '#6366f1' },
		{ value: '#a855f7', label: 'Purple', hex: '#a855f7' },
		{ value: '#ec4899', label: 'Pink', hex: '#ec4899' },
		{ value: '#f43f5e', label: 'Rose', hex: '#f43f5e' },
		{ value: '#8b5cf6', label: 'Violet', hex: '#8b5cf6' }
	];
	
	$: if ($currentNote && !editingTitle) {
		titleInput = $currentNote.title || $currentNote.extractTitle();
		selectedColor = $currentNote.color || null;
	}
	
	async function handleTitleBlur() {
		if ($currentNote && titleInput.trim() !== ($currentNote.title || $currentNote.extractTitle())) {
			await updateNoteTitle($currentNote.id, titleInput.trim());
			// Update titleInput with the saved value to ensure sync
			if ($currentNote) {
				titleInput = $currentNote.title || $currentNote.extractTitle();
			}
		}
		editingTitle = false;
	}
	
	function handleTitleKeydown(event) {
		if (event.key === 'Enter') {
			event.target.blur();
		} else if (event.key === 'Escape') {
			titleInput = $currentNote.title || $currentNote.extractTitle();
			editingTitle = false;
		}
	}
	
	function handleChangeColor(event) {
		event.stopPropagation();
		selectedColor = $currentNote?.color || null;
		showColorDialog = true;
	}
	
	async function handleSaveColor() {
		if ($currentNote) {
			await updateNoteColor($currentNote.id, selectedColor);
		}
		showColorDialog = false;
	}
	
	async function handleToggleFavorite(event) {
		event.stopPropagation();
		if (!$currentNote) return;
		
		togglingFavoriteId = $currentNote.id;
		try {
			await toggleNoteFavorite($currentNote.id);
		} catch (error) {
			console.error('Error toggling favorite:', error);
		} finally {
			togglingFavoriteId = null;
		}
	}
	
	async function handleDeleteNote(event) {
		event.stopPropagation();
		if (!$currentNote) return;
		
		const confirmed = confirm(`Are you sure you want to delete "${extractNoteTitle($currentNote)}"? This action cannot be undone.`);
		if (!confirmed) return;
		
		deletingNoteId = $currentNote.id;
		try {
			const success = await deleteNoteById($currentNote.id);
			if (!success) {
				alert('Failed to delete note. Please try again.');
			}
		} catch (error) {
			console.error('Error deleting note:', error);
			alert('An error occurred while deleting the note.');
		} finally {
			deletingNoteId = null;
		}
	}
	
	function handleMoveNote(event) {
		event.stopPropagation();
		if (!$currentNote) return;
		if (moveButtonRef) {
			const rect = moveButtonRef.getBoundingClientRect();
			moveMenuPosition = { 
				x: rect.left, 
				y: 0,
				bottom: typeof window !== 'undefined' ? window.innerHeight - rect.top + 8 : 0
			};
		}
		showMoveMenu = true;
	}
	
	function handleMoveToFolder(folderPath) {
		if ($currentNote) {
			moveNoteToFolder($currentNote.id, folderPath || null);
		}
		showMoveMenu = false;
	}

	// Reset save status when note changes
	$: if ($currentNote) {
		saveStatus.set('idle');
	}

	// Auto-save is now handled in TiptapEditor component

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	onMount(() => {
		if (browser) {
			// Keyboard shortcuts
			document.addEventListener('keydown', handleKeydown);
			// Record activity on mount if unlocked
			if ($isUnlocked) {
				recordActivity();
			}

			// Listen for Electron menu actions
			if (window.electronAPI?.onMenuAction) {
				window.electronAPI.onMenuAction((action) => {
					switch (action) {
						case 'new-note':
							createNewNote();
							break;
						case 'toggle-sidebar':
							toggleSidebar();
							break;
						case 'export':
							// Trigger export from ExportImport component
							// This would need to be handled via a store or event
							break;
						case 'import':
							// Trigger import from ExportImport component
							break;
					}
				});
			}
		}

		return () => {
			if (browser) {
				document.removeEventListener('keydown', handleKeydown);
			}
			if (autoLockCleanup) {
				autoLockCleanup();
			}
		};
	});

	function handleKeydown(event) {
		// Only handle shortcuts when unlocked and not typing in inputs
		if (!$isUnlocked || event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
			return;
		}

		// Cmd/Ctrl + N: New note
		if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
			event.preventDefault();
			createNewNote();
		}

		// Cmd/Ctrl + B: Toggle sidebar
		if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
			event.preventDefault();
			toggleSidebar();
		}

		// Cmd/Ctrl + S: Save (already auto-saves, but explicit save)
		if ((event.metaKey || event.ctrlKey) && event.key === 's') {
			event.preventDefault();
			if ($currentNote) {
				saveCurrentNote();
			}
		}
	}

	function openExportPasswordDialog() {
		exportPassword = '';
		exportPasswordError = '';
		showExportPasswordDialog = true;
	}

	function closeExportPasswordDialog() {
		showExportPasswordDialog = false;
		exportPassword = '';
		exportPasswordError = '';
	}

	function showExportResult(message, type = 'success') {
		exportResultMessage = message;
		exportResultType = type;
		showExportResultDialog = true;
	}

	function closeExportResultDialog() {
		showExportResultDialog = false;
		exportResultMessage = '';
	}

	async function handleExportProtectedNote() {
		if (!$currentNote) return;

		if (!exportPassword.trim()) {
			exportPasswordError = 'Password is required';
			return;
		}

		if (exportPassword.length < 6) {
			exportPasswordError = 'Password must be at least 6 characters long';
			return;
		}

		// IMPORTANT: Save password BEFORE closing dialog (which clears it)
		const actualPassword = exportPassword.trim();
		
		closeExportPasswordDialog();

		try {
			const { encryptForStorage, deriveMasterKey, generateSalt } = await import('../lib/crypto/encryption.js');

			// Generate random salt per export (SECURITY: prevents rainbow table attacks)
			const exportSalt = generateSalt();
			const exportKey = await deriveMasterKey(actualPassword, exportSalt);

			// Create export data with metadata
			const exportData = {
				version: '1.0',
				exportedAt: new Date().toISOString(),
				type: 'single-note',
				format: 'password-protected',
				title: $currentNote.extractTitle(),
				note: $currentNote.toJSON()
			};

			// Encrypt the entire export
			const encryptedData = await encryptForStorage(exportData, exportKey);

			const finalData = {
				version: '1.0',
				type: 'protected-note',
				exportedAt: new Date().toISOString(),
				salt: exportSalt, // Store salt in backup file (secure - salt can be public)
				encryptedData: encryptedData
			};

			const jsonString = JSON.stringify(finalData, null, 2);
			const safeTitle = $currentNote.extractTitle()
				.replace(/[^a-z0-9]/gi, '_')
				.substring(0, 30);
			const filename = `${safeTitle}.pnote`;

			await exportFile(jsonString, filename);
			
			// Clear password from memory
			exportPassword = '';
			
			showExportResult(
				`Note exported successfully!\n\nFile: ${filename}\n\nRemember your password - you'll need it to open this file.`,
				'success'
			);

		} catch (error) {
			console.error('Protected export failed:', error);
			exportPassword = '';
			showExportResult('Export failed: ' + error.message, 'error');
		}
	}

	async function exportProtectedNote() {
		if (!$currentNote) return;
		openExportPasswordDialog();
	}

	async function exportFile(content, filename) {
		const isPnote = filename.endsWith('.pnote');
		
		const result = await saveFileDialog(content, filename, [
			{
				name: isPnote ? 'Secure Notes' : 'JSON files',
				extensions: isPnote ? ['.pnote'] : ['.json']
			},
			{ name: 'All Files', extensions: ['*'] }
		]);

		if (!result.success && !result.canceled) {
			console.error('Export failed:', result.error);
		}
	}
</script>

{#if !$isUnlocked}
	<UnlockScreen />
{:else}
	<div class="app-container">
		{#if sidebarOpen}
			<div class="sidebar-overlay" on:click={toggleSidebar} role="button" aria-label="Close sidebar"></div>
		{/if}
		<div class="sidebar" class:collapsed={!sidebarOpen}>
			<div class="sidebar-header">
				<div class="app-header-content">
					<Icon name="lock" size={16} class="app-icon" />
					<div class="app-title">
						<h1>Privacy Notes</h1>
					</div>
				</div>
				<button 
					class="sidebar-close-btn" 
					on:click={toggleSidebar} 
					title="Close sidebar"
				>
					<Icon name="x" size={16} />
				</button>
			</div>
			<SearchBar />
			<NoteList />
		</div>

		<div class="main-content">
			{#if !sidebarOpen || $currentNote}
			<div class="toolbar">
			<div class="toolbar-left">
				{#if !sidebarOpen}
					<button
						class="sidebar-open-btn"
						on:click={toggleSidebar}
						title="Open sidebar"
					>
						<Icon name="menu" size={18} />
					</button>
				{/if}
				{#if $currentNote}
					{#if $currentNote.color}
						<div 
							class="header-color-indicator" 
							style="background-color: {$currentNote.color};"
							on:click={handleChangeColor}
							title="Change note color"
						></div>
					{:else}
						<div 
							class="header-color-indicator no-color" 
							on:click={handleChangeColor}
							title="Add note color"
						></div>
					{/if}
					{#if editingTitle}
						<input
							type="text"
							class="note-title-input"
							bind:value={titleInput}
							on:blur={handleTitleBlur}
							on:keydown={handleTitleKeydown}
							autofocus
						/>
					{:else}
						<h1 
							class="note-title" 
							on:click={() => editingTitle = true}
							title="Click to edit title"
						>
							{$currentNote.title || $currentNote.extractTitle()}
						</h1>
					{/if}
				{/if}
			</div>

			<div class="toolbar-right">
				{#if $currentNote}
					<!-- Status Info -->
					<div class="header-status">
						<div class="header-info save-status" class:saving={$saveStatus === 'saving'} class:saved={$saveStatus === 'saved' || $saveStatus === 'idle'} class:error={$saveStatus === 'error'}>
							{#if $saveStatus === 'saving'}
								<Icon name="loader" size={14} class="spinning" />
								<span>Saving...</span>
							{:else if $saveStatus === 'error'}
								<Icon name="alertTriangle" size={14} />
								<span>Save failed</span>
							{:else}
								<Icon name="check-circle" size={14} />
								<span>Saved</span>
							{/if}
						</div>
					</div>
					
					<button
						class="mode-toggle-btn"
						class:active={$currentNote.mode === 'whiteboard'}
						on:click={async () => {
							if ($currentNote) {
								$currentNote.mode = $currentNote.mode === 'text' ? 'whiteboard' : 'text';
								const { saveCurrentNote } = await import('../lib/stores/notesStore.js');
								await saveCurrentNote();
							}
						}}
						title={$currentNote.mode === 'text' ? 'Switch to Whiteboard' : 'Switch to Text'}
					>
						{#if $currentNote.mode === 'text'}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
								<line x1="9" y1="3" x2="9" y2="21"></line>
								<line x1="3" y1="9" x2="21" y2="9"></line>
							</svg>
						{:else}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
								<polyline points="14 2 14 8 20 8"></polyline>
								<line x1="16" y1="13" x2="8" y2="13"></line>
								<line x1="16" y1="17" x2="8" y2="17"></line>
								<polyline points="10 9 9 9 8 9"></polyline>
							</svg>
						{/if}
					</button>
					
					<!-- Delete Button -->
					<button
						class="header-btn delete-btn"
						on:click={handleDeleteNote}
						disabled={deletingNoteId === $currentNote.id}
						title="Delete note"
					>
						<Icon name="trash" size={16} />
					</button>
				{/if}
			</div>
			</div>
			{/if}
			<div class="editor-area">
				{#if $currentNote}
					<TiptapEditor />
				{:else}
					<div class="empty-editor">
						<p>Select a note or create a new one</p>
					</div>
				{/if}
				
			</div>
		</div>
		
		<MoveMenu
			show={showMoveMenu}
			position={moveMenuPosition}
			onClose={() => showMoveMenu = false}
			onMoveToFolder={handleMoveToFolder}
		/>
	</div>
{/if}

{#if showColorDialog}
	<div class="dialog-overlay" on:click={() => showColorDialog = false}>
		<div class="dialog" on:click|stopPropagation>
			<h3>Change Note Color</h3>
			<div class="color-selector-section">
				<label class="color-selector-label">Choose color:</label>
				<div class="color-selector">
					{#each noteColors as colorOption}
						<button
							class="color-option"
							class:selected={selectedColor === colorOption.value}
							on:click={() => selectedColor = colorOption.value}
							title={colorOption.label}
							style="background-color: {colorOption.hex};"
						>
							{#if selectedColor === colorOption.value}
								<Icon name="check" size={14} />
							{/if}
						</button>
					{/each}
				</div>
			</div>
			<div class="dialog-actions">
				<button class="btn-secondary" on:click={() => showColorDialog = false}>Cancel</button>
				<button class="btn-primary" on:click={handleSaveColor}>Save</button>
			</div>
		</div>
	</div>
{/if}

{#if showExportPasswordDialog}
	<div class="dialog-overlay" on:click={closeExportPasswordDialog}>
		<div class="dialog export-password-dialog" on:click|stopPropagation>
			<div class="dialog-header">
				<h3><Icon name="shield" size={20} /> Export Secure Note</h3>
				<button class="close-btn" on:click={closeExportPasswordDialog}>×</button>
			</div>
			<div class="dialog-body">
				<p class="dialog-description">
					Enter a password to protect this note:
				</p>
				<ul class="dialog-hints">
					<li>Minimum 6 characters</li>
					<li>Use a strong, memorable password</li>
					<li>You'll need this password to open the file later</li>
				</ul>
				<div class="password-input-wrapper">
					<input
						type="password"
						bind:value={exportPassword}
						placeholder="Enter export password"
						class="password-input"
						class:error={exportPasswordError}
						on:keydown={(e) => {
							if (e.key === 'Enter') {
								handleExportProtectedNote();
							} else if (e.key === 'Escape') {
								closeExportPasswordDialog();
							}
						}}
						autofocus
					/>
					{#if exportPasswordError}
						<div class="error-text">{exportPasswordError}</div>
					{/if}
				</div>
			</div>
			<div class="dialog-actions">
				<button class="btn-secondary" on:click={closeExportPasswordDialog}>Cancel</button>
				<button class="btn-primary" on:click={handleExportProtectedNote}>Export</button>
			</div>
		</div>
	</div>
{/if}

{#if showExportResultDialog}
	<div class="dialog-overlay" on:click={closeExportResultDialog}>
		<div class="dialog" on:click|stopPropagation>
			<div class="dialog-header">
				<h3>
					{#if exportResultType === 'success'}
						<Icon name="check-circle" size={20} />
					{:else}
						<Icon name="alertTriangle" size={20} />
					{/if}
					{exportResultType === 'success' ? 'Export Successful' : 'Export Failed'}
				</h3>
				<button class="close-btn" on:click={closeExportResultDialog}>×</button>
			</div>
			<div class="dialog-body">
				<div class="result-message" class:error={exportResultType === 'error'}>
					{@html exportResultMessage.split('\n').join('<br />')}
				</div>
			</div>
			<div class="dialog-actions">
				<button class="btn-primary" on:click={closeExportResultDialog}>OK</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.app-container {
		display: flex;
		height: 100vh;
		overflow: hidden;
		background: var(--bg-primary);
		color: var(--text-primary);
		/* Spazio aggiuntivo per barra titolo macOS */
		padding-top: env(titlebar-area-height, 0px);
	}

	.sidebar {
		width: 320px;
		min-width: 0;
		max-width: 100%;
		display: flex;
		flex-direction: column;
		transition: width var(--transition), transform var(--transition);
		border-right: 1px solid var(--sidebar-border);
		background: var(--sidebar-bg);
		overflow: hidden;
		flex-shrink: 0;
		position: relative;
	}
	
	.sidebar-header {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--sidebar-border);
		background: var(--sidebar-bg);
		flex-shrink: 0;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	
	.app-header-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.875rem;
		flex: 1;
		min-width: 0;
	}
	
	.app-icon {
		font-size: 16px;
		color: var(--accent-color);
		opacity: 0.9;
		flex-shrink: 0;
	}
	
	.app-title {
		flex: 1;
		min-width: 0;
	}
	
	.app-title h1 {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-secondary);
		letter-spacing: normal;
		line-height: 1.4;
		text-transform: none;
	}
	
	.sidebar-close-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-right: 0.5rem;
		opacity: 0.7;
	}
	
	.sidebar-close-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		opacity: 1;
	}

	.sidebar.collapsed {
		width: 0;
		min-width: 0;
		border-right: none;
		overflow: hidden;
	}

	.sidebar.collapsed > * {
		opacity: 0;
		pointer-events: none;
	}

	.main-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--bg-primary);
		transition: margin-left var(--transition);
	}

	.toolbar {
		padding: var(--spacing-md) var(--spacing-xl);
		border-bottom: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--bg-secondary);
		box-shadow: var(--shadow-sm);
		backdrop-filter: blur(8px);
		position: relative;
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	
	.sidebar-open-btn {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
		cursor: pointer;
		padding: var(--spacing-sm);
		border-radius: var(--radius);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
	}
	
	.sidebar-open-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
		transform: translateY(-1px);
		box-shadow: var(--shadow-xs);
	}
	
	.sidebar-open-btn:active {
		transform: translateY(0);
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	
	.header-status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-right: 0.5rem;
		padding-right: 0.75rem;
		border-right: 1px solid var(--border-color);
	}
	
	.header-info {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
		white-space: nowrap;
	}
	
	.header-info.save-status {
		font-weight: 500;
	}
	
	.header-info.save-status.saving {
		color: var(--accent-color);
	}
	
	.header-info.save-status.saving :global(.icon) {
		color: var(--accent-color);
	}
	
	.header-info.save-status.saved {
		color: var(--success-color, #10b981);
	}
	
	.header-info.save-status.saved :global(.icon) {
		color: var(--success-color, #10b981);
	}
	
	.header-info.save-status.error {
		color: var(--error-color, #ef4444);
	}
	
	.header-info.save-status.error :global(.icon) {
		color: var(--error-color, #ef4444);
	}
	
	.header-info.save-status :global(.spinning) {
		animation: spin 1s linear infinite;
	}
	
	.header-info.encrypted {
		color: var(--success-color, #10b981);
		font-weight: 500;
	}
	
	.header-info.encrypted :global(.icon) {
		color: var(--success-color, #10b981);
	}
	
	.header-btn {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 0.5rem;
		cursor: pointer;
		color: var(--text-secondary);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 36px;
		height: 36px;
		font-size: var(--font-size-base);
	}
	
	.header-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
		transform: translateY(-1px);
		box-shadow: var(--shadow-xs);
	}
	
	.header-btn:active {
		transform: translateY(0);
	}
	
	.header-btn.delete-btn {
		color: var(--error-color, #ef4444);
		border-color: var(--error-color, #ef4444);
	}
	
	.header-btn.delete-btn:hover {
		background: var(--error-color, #ef4444);
		color: white;
		border-color: var(--error-color, #ef4444);
	}
	
	.header-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.sidebar-toggle {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: var(--font-size-base);
		cursor: pointer;
		padding: var(--spacing-sm);
		border-radius: var(--radius);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		position: relative;
		overflow: visible;
	}

	.icon-wrapper {
		position: relative;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sidebar-icon {
		position: absolute;
		transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), 
		            opacity 0.25s ease,
		            color 0.2s ease;
		color: var(--text-secondary);
		transform: rotate(0deg) scale(1);
	}

	.sidebar-toggle:hover .sidebar-icon {
		color: var(--text-primary);
	}

	.sidebar-toggle:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
		transform: translateY(-1px);
		box-shadow: var(--shadow-xs);
	}

	.sidebar-toggle:hover .icon-wrapper {
		transform: scale(1.1);
	}

	.sidebar-toggle:active {
		transform: translateY(0);
	}

	.sidebar-toggle:active .icon-wrapper {
		transform: scale(0.95);
	}

	/* Animazione quando la sidebar si apre - icona menu diventa X */
	.sidebar-toggle.open .sidebar-icon {
		transform: rotate(180deg) scale(1);
		animation: iconSpin 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes iconSpin {
		0% {
			transform: rotate(0deg) scale(1);
		}
		50% {
			transform: rotate(90deg) scale(0.85);
		}
		100% {
			transform: rotate(180deg) scale(1);
		}
	}

	/* Animazione quando la sidebar si chiude - icona X diventa menu */
	.sidebar-toggle:not(.open) .sidebar-icon {
		animation: iconSpinReverse 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes iconSpinReverse {
		0% {
			transform: rotate(180deg) scale(1);
		}
		50% {
			transform: rotate(90deg) scale(0.85);
		}
		100% {
			transform: rotate(0deg) scale(1);
		}
	}

	.theme-toggle-btn {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 0.5rem;
		cursor: pointer;
		color: var(--text-secondary);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 36px;
		height: 36px;
		font-size: var(--font-size-base);
	}

	.theme-toggle-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
		transform: translateY(-1px);
		box-shadow: var(--shadow-xs);
	}

	.theme-toggle-btn:active {
		transform: translateY(0);
	}

	.header-color-indicator {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 4px;
		cursor: pointer;
		transition: var(--transition);
		flex-shrink: 0;
		border: 1px solid var(--border-color);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.header-color-indicator.no-color {
		border: 1px solid var(--border-color);
		background: white;
		width: 1.25rem;
		height: 1.25rem;
	}

	.header-color-indicator:hover {
		transform: scale(1.1);
		box-shadow: 0 0 0 2px var(--accent-color);
		z-index: 1;
	}

	.header-color-indicator.no-color:hover {
		background: var(--bg-secondary);
		border-color: var(--accent-color);
	}

	.note-title {
		font-weight: var(--font-weight-bold);
		color: var(--text-primary);
		font-size: var(--font-size-lg);
		flex: 1;
		margin: 0;
		letter-spacing: var(--letter-spacing-tight);
		cursor: pointer;
		user-select: none;
		transition: var(--transition);
	}
	
	.note-title:hover {
		color: var(--accent-color);
	}
	
	.mode-toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: var(--transition);
		min-width: 36px;
		height: 36px;
	}
	
	.mode-toggle-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border-color: var(--border-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow-xs);
	}
	
	.mode-toggle-btn:active {
		transform: translateY(0);
	}
	
	.mode-toggle-btn.active {
		background: var(--accent-light);
		color: var(--accent-color);
		border-color: var(--accent-color);
	}
	
	.mode-toggle-btn svg {
		flex-shrink: 0;
	}
	
	.note-title-input {
		background: var(--bg-tertiary);
		border: 1px solid var(--accent-color);
		border-radius: var(--radius);
		color: var(--text-primary);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		padding: var(--spacing-xs) var(--spacing-sm);
		width: 100%;
		max-width: 600px;
		font-family: inherit;
		letter-spacing: var(--letter-spacing-tight);
		transition: var(--transition);
	}
	
	.note-title-input:focus {
		outline: none;
		border-color: var(--accent-hover);
		box-shadow: 0 0 0 3px var(--accent-light);
		background: var(--bg-secondary);
	}

	.note-status {
		display: flex;
		gap: 1rem;
		align-items: center;
		font-size: 0.85rem;
		color: var(--text-muted);
	}
	
	.save-status {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-weight: 500;
		opacity: 1;
	}
	
	.save-status.saving {
		color: var(--accent-color);
	}
	
	.save-status.saving :global(.icon) {
		color: var(--accent-color);
	}
	
	.save-status.saved {
		color: var(--success-color);
	}
	
	.save-status.saved :global(.icon) {
		color: var(--success-color);
	}
	
	.save-status.error {
		color: var(--error-color);
	}
	
	.save-status.error :global(.icon) {
		color: var(--error-color);
	}
	
	.save-status :global(.spinning) {
		animation: spin 1s linear infinite;
	}
	
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	
	.status-encrypted,
	.status-updated {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.status-encrypted {
		color: var(--success-color);
		font-weight: 500;
	}
	
	.status-encrypted :global(.icon) {
		color: var(--success-color);
	}

	.status-updated {
		color: var(--text-secondary);
	}
	
	.status-updated :global(.icon) {
		color: var(--text-muted);
		opacity: 0.8;
	}

	.editor-area {
		flex: 1;
		overflow: hidden;
		background: var(--bg-primary);
		position: relative;
	}

	.empty-editor {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-secondary);
		text-align: center;
		padding: var(--spacing-2xl);
	}

	.empty-editor p {
		margin: 0 0 var(--spacing-lg) 0;
		font-size: var(--font-size-lg);
	}

	.empty-editor p:first-child {
		color: var(--text-primary);
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--spacing-sm);
	}

	.sidebar-overlay {
		display: none;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.sidebar-overlay {
			display: block;
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.5);
			z-index: 999;
			animation: fadeIn 0.2s ease;
		}

		@keyframes fadeIn {
			from {
				opacity: 0;
			}
			to {
				opacity: 1;
			}
		}

		.sidebar {
			position: fixed;
			left: 0;
			top: 0;
			height: 100vh;
			z-index: 1000;
			width: 320px;
			box-shadow: var(--shadow-lg);
		}

		.sidebar.collapsed {
			transform: translateX(-100%);
			width: 320px;
		}

		.sidebar.collapsed > * {
			opacity: 1;
			pointer-events: auto;
		}

		.main-content {
			width: 100%;
		}

		.toolbar {
			padding: var(--spacing-md) var(--spacing-lg);
		}

		.toolbar-right {
			gap: var(--spacing-sm);
		}

		.note-status {
			gap: var(--spacing-sm);
			font-size: var(--font-size-xs);
		}

		.status-updated span {
			display: none;
		}

		.note-title {
			font-size: var(--font-size-base);
		}
	}

	@media (max-width: 480px) {
		.sidebar {
			width: 100%;
			max-width: 320px;
		}

		.toolbar {
			padding: var(--spacing-sm) var(--spacing-md);
		}

		.toolbar-left,
		.toolbar-right {
			gap: var(--spacing-sm);
		}

		.note-status {
			display: none;
		}
	}

	.dialog-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.2s ease;
	}

	.dialog {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 0;
		min-width: 300px;
		max-width: 90vw;
		box-shadow: var(--shadow-xl);
		display: flex;
		flex-direction: column;
		max-height: 90vh;
		animation: slideUpScale 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	@keyframes slideUpScale {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(1rem);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.export-password-dialog {
		min-width: 400px;
		max-width: 500px;
	}

	.dialog-header {
		padding: var(--spacing-xl) var(--spacing-2xl);
		border-bottom: 1px solid var(--border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.dialog-header h3 {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-weight: var(--font-weight-semibold);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 1.5rem;
		cursor: pointer;
		padding: var(--spacing-xs);
		border-radius: var(--radius);
		transition: var(--transition);
		line-height: 1;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		transform: scale(1.1);
	}

	.close-btn:active {
		transform: scale(0.95);
	}

	.dialog-body {
		padding: var(--spacing-2xl);
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	.dialog-description {
		margin: 0 0 var(--spacing-lg) 0;
		color: var(--text-secondary);
		font-size: var(--font-size-sm);
		line-height: 1.6;
	}

	.dialog-hints {
		margin: 0 0 var(--spacing-2xl) 0;
		padding-left: var(--spacing-xl);
		color: var(--text-secondary);
		font-size: var(--font-size-sm);
		line-height: 1.7;
	}

	.dialog-hints li {
		margin-bottom: var(--spacing-xs);
	}

	.password-input-wrapper {
		margin-top: var(--spacing-lg);
	}

	.password-input {
		width: 100%;
		padding: var(--spacing-md);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		background: var(--input-bg);
		color: var(--text-primary);
		font-size: var(--font-size-sm);
		transition: var(--transition);
		font-family: inherit;
	}

	.password-input:focus {
		outline: none;
		border-color: var(--accent-color);
		box-shadow: 0 0 0 3px var(--accent-light);
		background: var(--bg-tertiary);
	}

	.password-input.error {
		border-color: var(--error-color);
	}

	.password-input.error:focus {
		border-color: var(--error-color);
		box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
	}

	.error-text {
		margin-top: var(--spacing-sm);
		color: var(--error-color);
		font-size: var(--font-size-sm);
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		font-weight: var(--font-weight-medium);
	}

	.result-message {
		color: var(--text-primary);
		font-size: var(--font-size-sm);
		line-height: 1.7;
		white-space: pre-line;
		padding: var(--spacing-lg);
		background: var(--bg-tertiary);
		border-radius: var(--radius);
		border: 1px solid var(--border-color);
	}

	.result-message.error {
		color: var(--error-color);
		background: rgba(239, 68, 68, 0.1);
		border-color: rgba(239, 68, 68, 0.3);
	}

	.color-selector-section {
		margin-bottom: var(--spacing-lg);
	}

	.color-selector-label {
		display: block;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		color: var(--text-secondary);
		margin-bottom: var(--spacing-sm);
	}

	.color-selector {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		background: var(--bg-tertiary);
		border-radius: var(--radius);
		border: 1px solid var(--border-color);
	}

	.color-option {
		aspect-ratio: 1;
		border: 2px solid var(--border-color);
		border-radius: var(--radius);
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		position: relative;
	}

	.color-option:hover {
		transform: scale(1.1);
		border-color: var(--accent-color);
		box-shadow: var(--shadow-sm);
	}

	.color-option.selected {
		border-color: var(--accent-color);
		border-width: 3px;
		box-shadow: 0 0 0 3px var(--accent-light), var(--shadow-sm);
		transform: scale(1.05);
	}

	.color-option:first-child {
		background: var(--bg-secondary) !important;
		border-style: dashed;
	}

	.dialog-actions {
		display: flex;
		gap: var(--spacing-sm);
		justify-content: flex-end;
		padding: var(--spacing-lg) var(--spacing-2xl);
		border-top: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.btn-primary,
	.btn-secondary {
		padding: var(--spacing-sm) var(--spacing-lg);
		border-radius: var(--radius);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		cursor: pointer;
		border: 1px solid var(--border-color);
		transition: var(--transition);
		position: relative;
		overflow: hidden;
	}

	.btn-primary {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
		box-shadow: var(--shadow-xs);
	}

	.btn-primary:hover {
		background: var(--accent-hover);
		box-shadow: var(--shadow-sm);
		transform: translateY(-1px);
	}

	.btn-primary:active {
		transform: translateY(0);
		box-shadow: var(--shadow-xs);
	}

	.btn-secondary {
		background: var(--bg-tertiary);
		color: var(--text-secondary);
	}

	.btn-secondary:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
		border-color: var(--border-hover);
		transform: translateY(-1px);
	}

	.btn-secondary:active {
		transform: translateY(0);
	}

	.floating-toolbar {
		position: absolute;
		bottom: var(--spacing-2xl);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: var(--spacing-lg);
		background: var(--glass-bg);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-md) var(--spacing-xl);
		box-shadow: var(--shadow-lg);
		z-index: 1000;
		align-items: center;
		min-width: 400px;
		justify-content: space-between;
		overflow: visible;
		transition: var(--transition);
		animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(1rem);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.toolbar-left {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex: 1;
	}

	.toolbar-center {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.toolbar-right-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex: 1;
		justify-content: flex-end;
	}

	.toolbar-info {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.05);
		font-weight: var(--font-weight-medium);
		backdrop-filter: blur(4px);
	}

	.toolbar-info.encrypted {
		color: var(--accent-color);
		background: rgba(91, 141, 239, 0.15);
		border-color: rgba(91, 141, 239, 0.2);
	}

	.toolbar-info.save-status {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		font-size: var(--font-size-sm);
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.05);
		font-weight: var(--font-weight-medium);
		backdrop-filter: blur(4px);
	}

	.toolbar-info.save-status.saving {
		color: var(--accent-color);
	}

	.toolbar-info.save-status.saved {
		color: var(--success-color);
		background: rgba(74, 222, 128, 0.15);
		border-color: rgba(74, 222, 128, 0.2);
	}

	.toolbar-info.save-status.error {
		color: var(--error-color);
		background: rgba(239, 68, 68, 0.15);
		border-color: rgba(239, 68, 68, 0.2);
	}

	.toolbar-info span {
		white-space: nowrap;
	}

	.toolbar-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: var(--spacing-sm);
		border-radius: var(--radius);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		position: relative;
	}

	.toolbar-btn::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: var(--radius);
		background: var(--bg-tertiary);
		opacity: 0;
		transition: var(--transition-fast);
	}

	.toolbar-btn:hover:not(:disabled)::before {
		opacity: 1;
	}

	.toolbar-btn:hover:not(:disabled) {
		color: var(--text-primary);
		transform: translateY(-2px);
	}

	.toolbar-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.toolbar-btn.active {
		color: var(--accent-color);
	}

	.toolbar-btn.active::before {
		background: var(--accent-light);
		opacity: 1;
	}

	.toolbar-btn.delete:hover:not(:disabled)::before {
		background: var(--error-color);
	}

	.toolbar-btn.delete:hover:not(:disabled) {
		color: white;
	}

	.toolbar-btn :global(.icon) {
		position: relative;
		z-index: 1;
	}

	.toolbar-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		transform: none;
	}

</style>

