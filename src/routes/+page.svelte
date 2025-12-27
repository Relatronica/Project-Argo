<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { isUnlocked } from '../lib/stores/keyStore.js';
	import { initializeAutoLock, recordActivity } from '../lib/utils/autoLock.js';
	import { masterKey, currentNote, saveCurrentNote, createNewNote, saveStatus, updateNoteTitle, updateNoteColor, toggleNoteFavorite, moveNoteToFolder, deleteNoteById } from '../lib/stores/notesStore.js';
	import { allFolders } from '../lib/stores/folderStore.js';
	import UnlockScreen from '../lib/components/UnlockScreen.svelte';
	import NoteList from '../lib/components/NoteList.svelte';
	import SearchBar from '../lib/components/SearchBar.svelte';
	import TiptapEditor from '../lib/components/TiptapEditor.svelte';
	import ExportImport from '../lib/components/ExportImport.svelte';
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
				<div class="app-logo">
					<svg width="32" height="32" viewBox="0 0 64 64" fill="none">
						<rect width="64" height="64" rx="12" fill="var(--accent-color)"/>
						<path d="M20 20h24v24H20z" fill="white" opacity="0.2"/>
						<path d="M32 16v32M16 32h32" stroke="white" stroke-width="3" stroke-linecap="round"/>
					</svg>
				</div>
				<div class="app-title">
					<h1>Privacy Notes</h1>
					<p class="app-subtitle">Encrypted & Local</p>
				</div>
			</div>
			<SearchBar />
			<NoteList />
		</div>

		<div class="main-content">
			<div class="toolbar">
				<div class="toolbar-left">
					<button class="sidebar-toggle" on:click={toggleSidebar} title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}>
						<Icon name="menu" size={18} />
					</button>
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
					<ExportImport />
				</div>
			</div>
			<div class="editor-area">
				{#if $currentNote}
					<TiptapEditor />
				{:else}
					<div class="empty-editor">
						<p>Select a note or create a new one</p>
					</div>
				{/if}
				
				{#if $currentNote}
					<div class="floating-toolbar">
						<div class="toolbar-left">
							<div class="toolbar-info save-status" class:saving={$saveStatus === 'saving'} class:saved={$saveStatus === 'saved' || $saveStatus === 'idle'} class:error={$saveStatus === 'error'}>
								{#if $saveStatus === 'saving'}
									<Icon name="loader" size={16} class="spinning" />
									<span>Saving...</span>
								{:else if $saveStatus === 'error'}
									<Icon name="alertTriangle" size={16} />
									<span>Save failed</span>
								{:else}
									<Icon name="check-circle" size={16} />
									<span>Saved</span>
								{/if}
							</div>
							{#if $currentNote.encrypted}
								<div class="toolbar-info encrypted">
									<Icon name="lock" size={16} />
									<span>Encrypted</span>
								</div>
							{/if}
							<div class="toolbar-info">
								<Icon name="calendar" size={16} />
								<span>{new Date($currentNote.updated).toLocaleDateString()}</span>
							</div>
						</div>
						
						<div class="toolbar-center">
							<button
								class="toolbar-btn"
								class:active={$currentNote.favorite}
								on:click={handleToggleFavorite}
								disabled={togglingFavoriteId === $currentNote.id}
								title={$currentNote.favorite ? "Remove from favorites" : "Add to favorites"}
							>
								<Icon name="star" size={18} />
							</button>
							<button
								class="toolbar-btn"
								on:click={handleMoveNote}
								title="Move to folder"
								bind:this={moveButtonRef}
							>
								<Icon name="folderOpen" size={18} />
							</button>
							<button
								class="toolbar-btn delete"
								on:click={handleDeleteNote}
								disabled={deletingNoteId === $currentNote.id}
								title="Delete note"
							>
								<Icon name="trash" size={18} />
							</button>
						</div>
						
						<div class="toolbar-right-actions">
							<button 
								class="toolbar-btn" 
								on:click={exportProtectedNote} 
								title="Export as Secure Note (.pnote)"
							>
								<Icon name="download" size={18} />
							</button>
						</div>
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
		background: var(--bg-primary, #1a1a1a);
		color: var(--text-primary, #fff);
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
	}
	
	.sidebar-header {
		padding: 1.25rem 1rem;
		border-bottom: 1px solid var(--sidebar-border);
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: var(--sidebar-bg);
		flex-shrink: 0;
	}
	
	.app-logo {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.app-title {
		flex: 1;
		min-width: 0;
	}
	
	.app-title h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.02em;
		line-height: 1.2;
	}
	
	.app-subtitle {
		margin: 0.125rem 0 0 0;
		font-size: 0.75rem;
		color: var(--text-muted);
		font-weight: 500;
		letter-spacing: 0.01em;
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
		padding: 0.875rem 1.25rem;
		border-bottom: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--bg-secondary);
		box-shadow: var(--shadow);
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.sidebar-toggle {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
		font-size: 1rem;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
	}
	
	.sidebar-toggle :global(.icon) {
		color: var(--text-secondary);
	}

	.sidebar-toggle:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}


	.note-title {
		font-weight: 700;
		color: var(--text-primary);
		font-size: 1.1rem;
		flex: 1;
		margin: 0;
		letter-spacing: -0.025em;
		cursor: pointer;
		user-select: none;
		transition: color 0.2s ease;
	}
	
	.note-title:hover {
		color: var(--accent-color);
	}
	
	.note-title-input {
		background: var(--bg-tertiary);
		border: 1px solid var(--accent-color);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 1.1rem;
		font-weight: 700;
		padding: 0.25rem 0.5rem;
		width: 100%;
		max-width: 600px;
		font-family: inherit;
		letter-spacing: -0.025em;
	}
	
	.note-title-input:focus {
		outline: none;
		border-color: var(--accent-hover);
		box-shadow: 0 0 0 2px var(--accent-light);
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
		padding: 2rem;
	}

	.empty-editor p {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
	}

	.empty-editor p:first-child {
		color: var(--text-primary);
		font-weight: 600;
		margin-bottom: 0.5rem;
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
			padding: 0.75rem 1rem;
		}

		.toolbar-right {
			gap: 0.5rem;
		}

		.note-status {
			gap: 0.5rem;
			font-size: 0.75rem;
		}

		.status-updated span {
			display: none;
		}

		.note-title {
			font-size: 1rem;
		}
	}

	@media (max-width: 480px) {
		.sidebar {
			width: 100%;
			max-width: 320px;
		}

		.toolbar {
			padding: 0.625rem 0.75rem;
		}

		.toolbar-left,
		.toolbar-right {
			gap: 0.5rem;
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
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.dialog {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 0;
		min-width: 300px;
		max-width: 90vw;
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
		max-height: 90vh;
	}

	.export-password-dialog {
		min-width: 400px;
		max-width: 500px;
	}

	.dialog-header {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.dialog-header h3 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
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
	}

	.dialog-body {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	.dialog-description {
		margin: 0 0 1rem 0;
		color: var(--text-secondary);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.dialog-hints {
		margin: 0 0 1.5rem 0;
		padding-left: 1.25rem;
		color: var(--text-secondary);
		font-size: 0.85rem;
		line-height: 1.6;
	}

	.dialog-hints li {
		margin-bottom: 0.25rem;
	}

	.password-input-wrapper {
		margin-top: 1rem;
	}

	.password-input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		background: var(--input-bg);
		color: var(--text-primary);
		font-size: 0.9rem;
		transition: var(--transition);
		font-family: inherit;
	}

	.password-input:focus {
		outline: none;
		border-color: var(--accent-color);
		box-shadow: 0 0 0 2px var(--accent-light);
	}

	.password-input.error {
		border-color: var(--error-color);
	}

	.password-input.error:focus {
		border-color: var(--error-color);
		box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
	}

	.error-text {
		margin-top: 0.5rem;
		color: var(--error-color);
		font-size: 0.85rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.result-message {
		color: var(--text-primary);
		font-size: 0.9rem;
		line-height: 1.6;
		white-space: pre-line;
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-color);
	}

	.result-message.error {
		color: var(--error-color);
		background: rgba(239, 68, 68, 0.1);
		border-color: var(--error-color);
	}

	.color-selector-section {
		margin-bottom: 1rem;
	}

	.color-selector-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.color-selector {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-color);
	}

	.color-option {
		aspect-ratio: 1;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-sm);
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
	}

	.color-option.selected {
		border-color: var(--accent-color);
		border-width: 3px;
		box-shadow: 0 0 0 2px var(--accent-light);
	}

	.color-option:first-child {
		background: var(--bg-secondary) !important;
		border-style: dashed;
	}

	.dialog-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.5rem 1rem;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		cursor: pointer;
		border: 1px solid var(--border-color);
		transition: var(--transition);
	}

	.btn-primary {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.btn-primary:hover {
		background: var(--accent-hover);
	}

	.btn-secondary {
		background: var(--bg-tertiary);
		color: var(--text-secondary);
	}

	.btn-secondary:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.floating-toolbar {
		position: absolute;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 1rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		box-shadow: var(--shadow-lg);
		z-index: 1000;
		align-items: center;
		min-width: 400px;
		justify-content: space-between;
		overflow: visible;
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
		gap: 0.375rem;
		font-size: 0.85rem;
		color: var(--text-muted);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		background: var(--bg-tertiary);
	}

	.toolbar-info.encrypted {
		color: var(--accent-color);
	}

	.toolbar-info.save-status {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.85rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		background: var(--bg-tertiary);
	}

	.toolbar-info.save-status.saving {
		color: var(--accent-color);
	}

	.toolbar-info.save-status.saved {
		color: var(--success-color);
	}

	.toolbar-info.save-status.error {
		color: var(--error-color);
	}

	.toolbar-info span {
		white-space: nowrap;
	}

	.toolbar-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
	}

	.toolbar-btn:hover:not(:disabled) {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		transform: scale(1.1);
	}

	.toolbar-btn.active {
		color: var(--accent-color);
		background: var(--accent-light);
	}

	.toolbar-btn.delete:hover:not(:disabled) {
		background: var(--error-color);
		color: white;
	}

	.toolbar-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

</style>

