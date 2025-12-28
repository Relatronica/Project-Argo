<script>
	import { onMount } from 'svelte';
	import { notesMetadata, loadNotes } from '../stores/notesStore.js';
	import { exportMarkdownFile } from '../storage/localStorage.js';
	import { logger } from '../utils/logger.js';
	import { signBackup, verifyBackup } from '../utils/backupIntegrity.js';
	import { saveFileDialog } from '../utils/electronFileAPI.js';
	import Icon from './Icon.svelte';
	import { browser } from '$app/environment';

	export let showButton = true; // Allow hiding the trigger button when used in settings
	export let inline = false; // If true, show content inline instead of in a modal

	let showModal = false;
	let exportFormat = 'password'; // 'password', 'encrypted', or 'plaintext'
	let exportPassword = '';
	let confirmPassword = '';
	let passwordError = '';
	let isExporting = false;
	let isImporting = false;
	let importData = '';
	let importPassword = '';
	let importError = '';
	let exportSuccess = '';
	let cleanupResult = null;

	$: importFileType = (() => {
		if (!importData.trim()) return null;
		try {
			const parsed = JSON.parse(importData);
			if (parsed.type === 'protected-note') return 'single-protected';
			if (parsed.format === 'password-protected') return 'bulk-protected';
			if (parsed.notes) return 'bulk-plain';
			return 'unknown';
		} catch {
			return 'invalid';
		}
	})();

	$: isPasswordProtectedBackup = importFileType === 'bulk-protected' || importFileType === 'single-protected';

	// File input reference
	let fileInput;

	function openModal() {
		showModal = true;
		importError = '';
		exportSuccess = '';
	}

	function closeModal() {
		showModal = false;
		importData = '';
	}

	// Portal action to append modal to body
	function portal(node) {
		if (!browser) return;
		
		document.body.appendChild(node);
		
		return {
			destroy() {
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			}
		};
	}

	async function exportAllNotes() {
		if ($notesMetadata.length === 0) {
			exportSuccess = 'No notes to export';
			return;
		}

		// Validate password for password-protected format
		if (exportFormat === 'password') {
			if (!exportPassword.trim()) {
				exportSuccess = 'Password required for password-protected export';
				return;
			}
			if (exportPassword !== confirmPassword) {
				exportSuccess = 'Passwords do not match';
				return;
			}
			
			// Enforce password strength requirements
			const { validatePasswordStrength } = await import('../utils/passwordStrength.js');
			const validation = validatePasswordStrength(exportPassword, { minScore: 40, minLength: 8 });
			
			if (!validation.valid) {
				exportSuccess = validation.error || 'Password does not meet strength requirements';
				return;
			}
		}

		isExporting = true;
		try {
			const exportData = {
				version: '1.0',
				exportedAt: new Date().toISOString(),
				format: exportFormat,
				notes: $notesMetadata.map(note => ({
					id: note.id,
					title: note.title,
					content: note.content,
					tags: note.tags,
					created: note.created,
					updated: note.updated,
					encrypted: exportFormat === 'encrypted' ? note.encrypted : false,
					ciphertext: exportFormat === 'encrypted' ? note.ciphertext : undefined,
					nonce: exportFormat === 'encrypted' ? note.nonce : undefined
				}))
			};

			let finalData = exportData;
			let filename = `privacy-notes-backup-${new Date().toISOString().split('T')[0]}.json`;

			// Encrypt entire export if password-protected
			let hmacKey = null;
			if (exportFormat === 'password') {
				const { encryptForStorage, deriveMasterKey, generateSalt } = await import('../crypto/encryption.js');

				// Generate random salt per export (SECURITY: prevents rainbow table attacks)
				const exportSalt = generateSalt();

				// Derive export key from password with random salt
				const exportKey = await deriveMasterKey(exportPassword, exportSalt);
				hmacKey = exportKey; // Use export key for HMAC

				// Encrypt the entire export data
				const encryptedData = await encryptForStorage(exportData, exportKey);

				finalData = {
					version: '1.0',
					format: 'password-protected',
					exportedAt: new Date().toISOString(),
					salt: exportSalt, // Store salt in backup file (secure - salt can be public)
					encryptedData: encryptedData
				};

				filename = `privacy-notes-encrypted-${new Date().toISOString().split('T')[0]}.json`;

				// Clear passwords from memory
				exportPassword = '';
				confirmPassword = '';
			} else {
				// For non-password exports, use device key for HMAC
				const { deriveDeviceKey } = await import('../crypto/encryption.js');
				hmacKey = await deriveDeviceKey();
			}

			// Add HMAC signature for integrity verification
			finalData = await signBackup(finalData, hmacKey);

			const jsonString = JSON.stringify(finalData, null, 2);
			await exportFile(jsonString, filename);
			exportSuccess = `Successfully exported ${$notesMetadata.length} notes in ${exportFormat} format`;

		} catch (error) {
			logger.error('Export failed:', error);
			exportSuccess = 'Export failed: ' + error.message;
		} finally {
			isExporting = false;
		}
	}

	async function exportFile(content, filename) {
		const result = await saveFileDialog(content, filename, [
			{ name: 'JSON files', extensions: ['.json'] },
			{ name: 'All Files', extensions: ['*'] }
		]);

		if (!result.success && !result.canceled) {
			throw new Error(result.error || 'Export failed');
		}
	}

	function handleFileSelect(event) {
		const file = event.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				importData = e.target.result;
				importError = '';
			} catch (error) {
				importError = 'Failed to read file';
			}
		};
		reader.readAsText(file);
	}

	async function importNotes() {
		if (!importData.trim()) {
			importError = 'No data to import';
			return;
		}

		isImporting = true;
		let hasDecryptedProtectedFile = false;
		try {
			let importObj;
			try {
				importObj = JSON.parse(importData);
			} catch (parseError) {
				throw new Error('Invalid file format: not valid JSON');
			}

			// Validate backup structure using schema validation
			const { validateBackupStructure } = await import('../utils/backupValidator.js');
			const structureValidation = validateBackupStructure(importObj);
			if (!structureValidation.valid) {
				throw new Error(structureValidation.error || 'Invalid backup file format');
			}

			logger.debug('Import debug:', {
				type: importObj.type,
				hasEncryptedData: !!importObj.encryptedData,
				hasNote: !!importObj.note,
				hasSalt: !!importObj.salt,
				hasHmac: !!importObj.hmac,
				encryptedDataStructure: importObj.encryptedData ? {
					hasCiphertext: !!importObj.encryptedData.ciphertext,
					hasNonce: !!importObj.encryptedData.nonce,
					ciphertextLength: importObj.encryptedData.ciphertext?.length,
					nonceLength: importObj.encryptedData.nonce?.length
				} : null
			});

			// Handle password-protected imports (both bulk and single note)
			if ((importObj.format === 'password-protected' || importObj.type === 'protected-note') && importObj.encryptedData) {
				if (!importPassword.trim()) {
					importError = 'Password required to decrypt this file';
					isImporting = false;
					return;
				}

				try {
					const { decryptFromStorage, deriveMasterKey } = await import('../crypto/encryption.js');

					// Get salt from file (new format) or use legacy hardcoded salt
					// IMPORTANT: Salt must be exactly as stored in the file
					let salt = importObj.salt;
					if (!salt) {
						// Legacy format: hardcoded salt
						salt = importObj.type === 'protected-note' ? 'secure-note-export-2024' : 'export-salt-2024';
					}
					
					// Ensure salt is a string (should be base64 encoded)
					if (typeof salt !== 'string') {
						throw new Error('Invalid salt format in file');
					}
					
					// Derive key using the same method as export
					// Export: deriveMasterKey(exportPassword.trim(), exportSalt)
					// Import: deriveMasterKey(importPassword.trim(), salt)
					// Both use trimmed password to ensure consistency
					const actualPassword = importPassword.trim();
					const exportKey = await deriveMasterKey(actualPassword, salt);
					
					// Verify backup integrity if HMAC is present
					if (importObj.hmac) {
						const verification = await verifyBackup(importObj, exportKey);
						if (!verification.valid) {
							throw new Error(verification.error || 'Backup integrity check failed');
						}
					}

					// Decrypt the data
					// encryptForStorage returns {ciphertext, nonce}
					// decryptFromStorage expects {ciphertext, nonce} and the key
					// Ensure encryptedData has the correct structure
					if (!importObj.encryptedData || typeof importObj.encryptedData !== 'object') {
						throw new Error('Invalid encryptedData structure');
					}
					if (!importObj.encryptedData.ciphertext || !importObj.encryptedData.nonce) {
						throw new Error('Missing ciphertext or nonce in encryptedData');
					}
					
					const decryptedData = await decryptFromStorage(importObj.encryptedData, exportKey);

					// Validate decrypted data
					if (!decryptedData || typeof decryptedData !== 'object') {
						throw new Error('Decrypted data is invalid or corrupted');
					}

					// For single protected notes, ensure type is correct
					if (importObj.type === 'protected-note') {
						if (!decryptedData.note || !decryptedData.note.id || !decryptedData.note.content) {
							throw new Error('Decrypted file does not contain a valid note');
						}
						// Ensure type is 'single-note' after decryption
						decryptedData.type = 'single-note';
					}

					// Replace importObj with decrypted data
					importObj = decryptedData;
					importPassword = ''; // Clear password from memory
					hasDecryptedProtectedFile = true;

				} catch (error) {
					logger.error('Import decryption error:', error);
					logger.debug('Error details:', {
						message: error.message,
						name: error.name,
						stack: error.stack
					});
					
					let errorMessage = 'Failed to decrypt file.\n\n';
					if (error.message && (error.message.includes('invalid key') || error.message.includes('decryption failed'))) {
						errorMessage += '⚠️ Most likely cause: Wrong password\n\n';
						errorMessage += 'Please verify:\n';
						errorMessage += '• The password matches exactly (case-sensitive)\n';
						errorMessage += '• No extra spaces before or after\n';
						errorMessage += '• Special characters are typed correctly\n';
						errorMessage += '• You\'re using the same password from export';
					} else {
						errorMessage += 'Possible causes:\n';
						errorMessage += '• Wrong password\n';
						errorMessage += '• File is corrupted or damaged\n';
						errorMessage += '• File was not created by this app';
						if (error.message) {
							errorMessage += `\n\nError: ${error.message}`;
						}
					}

					importError = errorMessage;
					isImporting = false;
					return;
				}
			}

			// Verify backup integrity for non-password protected files
			if (!hasDecryptedProtectedFile && importObj.hmac) {
				try {
					const { deriveDeviceKey } = await import('../crypto/encryption.js');
					const deviceKey = await deriveDeviceKey();
					const verification = await verifyBackup(importObj, deviceKey);
					if (!verification.valid) {
						logger.warn('Backup integrity check failed:', verification.error);
						// Continue anyway but warn user
						importError = 'Warning: Backup integrity check failed. File may have been tampered with.';
					}
				} catch (error) {
					logger.warn('Could not verify backup integrity:', error);
					// Continue anyway for backward compatibility
				}
			}

			// Basic format validation (before decryption)
			// Skip if we already decrypted a protected file
			if (!hasDecryptedProtectedFile) {
				if (importObj.type === 'protected-note') {
				// Single protected note - full validation happens after decryption
				if (!importObj.encryptedData) {
					throw new Error('Invalid protected note format - missing encrypted data');
				}
			} else if (importObj.format === 'password-protected') {
				// Bulk protected backup - validation after decryption
				if (!importObj.encryptedData) {
					throw new Error('Invalid protected backup format - missing encrypted data');
				}
			} else if (!importObj.notes || !Array.isArray(importObj.notes)) {
				throw new Error('Invalid backup format - missing notes array');
			} else {
				// Validate notes for unencrypted bulk imports
				for (const note of importObj.notes) {
					if (!note.id || !note.content) {
						throw new Error('Invalid note data in backup');
					}
				}
			}
			} // End skip validation for already decrypted files

			// Import notes (handle both bulk backups and single protected notes)
			let importedCount = 0;
			let skippedCount = 0;

			let notesToImport = [];
			let originalFileType = 'unknown';

			// Determine what type of data we have after potential decryption
			if (importObj.type === 'single-note' && importObj.note) {
				// Single protected note (after decryption)
				notesToImport = [importObj.note];
				originalFileType = 'single-decrypted';
			} else if (importObj.notes && Array.isArray(importObj.notes)) {
				// Bulk backup
				notesToImport = importObj.notes;
				originalFileType = 'bulk';
			} else {
				logger.error('Unexpected import structure');
				throw new Error('No valid notes found to import. This file may be corrupted or not created by this app.');
			}

			logger.debug('Importing notes:', { count: notesToImport.length, type: originalFileType });

			for (const noteData of notesToImport) {
				try {
					// Check if note already exists
					const existingNote = await getNoteMetadata(noteData.id);
					const noteTitle = noteData.title || importObj.title || `Note ${noteData.id}`;

					if (existingNote && typeof window !== 'undefined' && !confirm(`Note "${noteTitle}" already exists. Overwrite?`)) {
						skippedCount++;
						continue;
					}

					// Save to IndexedDB
					await saveNoteMetadata(noteData);
					importedCount++;

					logger.debug(`Imported note: ${noteTitle}`);
				} catch (error) {
					logger.warn(`Failed to import note ${noteData.id}:`, error);
					skippedCount++;
				}
			}

			// Reload notes
			await loadNotes();

			let message = `Successfully imported ${importedCount} notes`;
			if (skippedCount > 0) {
				message += `, skipped ${skippedCount}`;
			}
			importError = message;
			importData = '';

		} catch (error) {
			logger.error('Import failed:', error);
			importError = 'Import failed: ' + error.message;
		} finally {
			isImporting = false;
		}
	}

	async function cleanupDatabase() {
		if (!cleanupAndMigrate) return;

		try {
			cleanupResult = null;
			const result = await cleanupAndMigrate();
			cleanupResult = result;

			// Reload notes to reflect changes
			await loadNotes();

			logger.info('Database cleanup completed:', result);
		} catch (error) {
			logger.error('Database cleanup failed:', error);
			cleanupResult = { error: error.message };
		}
	}

	// Import storage functions
	let getNoteMetadata;
	let cleanupAndMigrate;
	onMount(async () => {
		const storage = await import('../storage/localStorage.js');
		saveNoteMetadata = storage.saveNoteMetadata;
		getNoteMetadata = storage.getNoteMetadata;
		cleanupAndMigrate = storage.cleanupAndMigrate;
	});

	// Import storage functions
	let saveNoteMetadata;
	onMount(async () => {
		const storage = await import('../storage/localStorage.js');
		saveNoteMetadata = storage.saveNoteMetadata;
	});
</script>

<!-- Trigger button (can be placed anywhere) -->
{#if showButton && !inline}
	<button class="export-import-btn" on:click={openModal}>
		<Icon name="package" size={16} />
		<span>Backup</span>
	</button>
{/if}

<!-- Inline Content -->
{#if inline}
	<div class="export-import-inline">
		<div class="modal-body">
			<!-- Export Section -->
			<div class="section">
					<h4><Icon name="upload" size={18} /> Export Notes</h4>
					<p>Export all your notes as a backup file</p>

					<div class="export-options">
						<label class="radio-option">
							<input
								type="radio"
								bind:group={exportFormat}
								value="password"
							/>
							<span class="radio-label">
								<strong><Icon name="shield" size={16} /> Password-protected</strong> - Encrypt entire backup with custom password (most secure)
							</span>
						</label>

						<label class="radio-option">
							<input
								type="radio"
								bind:group={exportFormat}
								value="encrypted"
							/>
							<span class="radio-label">
								<strong>Encrypted</strong> - Export with app encryption (medium security)
							</span>
						</label>

						<label class="radio-option">
							<input
								type="radio"
								bind:group={exportFormat}
								value="plaintext"
							/>
							<span class="radio-label">
								<strong>Plain text</strong> - Export readable text (least secure)
							</span>
						</label>
					</div>

					{#if exportFormat === 'password'}
						<div class="password-section">
							<div class="password-inputs">
								<input
									type="password"
									placeholder="Enter export password"
									bind:value={exportPassword}
									class="password-field"
								/>
								<input
									type="password"
									placeholder="Confirm export password"
									bind:value={confirmPassword}
									class="password-field"
								/>
							</div>
							{#if passwordError}
								<div class="error-message">{passwordError}</div>
							{/if}
							<p class="password-hint">
								This password protects your exported backup. Choose a strong password different from your app password.
							</p>
						</div>
					{/if}

					<button
						class="action-btn primary"
						on:click={exportAllNotes}
						disabled={isExporting || $notesMetadata.length === 0}
					>
						{#if isExporting}
							<Icon name="upload" size={16} />
							Exporting...
						{:else}
							<Icon name="upload" size={16} />
							Export {$notesMetadata.length} Notes
						{/if}
					</button>

					{#if exportSuccess}
						<div class="success-message">{exportSuccess}</div>
					{/if}

					<div class="backup-info">
						<p><strong><Icon name="lightbulb" size={16} /> Security Tips:</strong></p>
						<ul>
							<li><strong><Icon name="shield" size={14} /> Password-protected backups:</strong> Most secure, entire file encrypted</li>
							<li><strong><Icon name="lock" size={14} /> Encrypted app backups:</strong> Uses app encryption, medium security</li>
							<li><strong><Icon name="fileText" size={14} /> Plain text backups:</strong> Readable but vulnerable to interception</li>
							<li><strong><Icon name="fileText" size={14} /> .pnote files:</strong> Secure single notes with custom password</li>
							<li>Store sensitive files only in encrypted cloud storage</li>
							<li>Test restoration with small backups before relying on them</li>
							<li>Use strong, unique passwords for protected exports</li>
							<li>.pnote files are completely unreadable without password</li>
						</ul>
					</div>
				</div>

				<div class="divider"></div>

				<!-- Maintenance Section -->
				<div class="section">
					<h4><Icon name="settings" size={18} /> Database Maintenance</h4>
					<p>Fix issues with corrupted or legacy notes</p>

					<button
						class="action-btn warning"
						on:click={cleanupDatabase}
						disabled={isImporting}
					>
						<Icon name="settings" size={16} />
						Clean & Migrate Database
					</button>

					{#if cleanupResult}
						<div class="success-message">
							Cleanup complete: {cleanupResult.migrated} migrated, {cleanupResult.cleaned} cleaned
						</div>
					{/if}
				</div>

				<div class="divider"></div>

				<!-- Import Section -->
				<div class="section">
					<h4><Icon name="download" size={18} /> Import Notes</h4>
					<p>Import notes from backup files (supports encrypted and plain backups)</p>

					<div class="import-controls">
						<input
							type="file"
							accept=".json,.pnote"
							on:change={handleFileSelect}
							bind:this={fileInput}
							style="display: none"
						/>

						<button
							class="action-btn secondary"
							on:click={() => fileInput.click()}
						>
							<Icon name="folderOpen" size={16} />
							Choose File (.json or .pnote)
						</button>

						{#if importData}
							<div class="file-info">
								{#if importFileType === 'bulk-protected'}
									<Icon name="package" size={16} /> Bulk backup (encrypted) - ({importData.length} characters)
									<span class="encrypted-badge"><Icon name="shield" size={12} /> Password-protected</span>
								{:else if importFileType === 'single-protected'}
									<Icon name="fileText" size={16} /> Secure note (.pnote file) - ({importData.length} characters)
									<span class="encrypted-badge"><Icon name="shield" size={12} /> Password-protected</span>
								{:else if importFileType === 'bulk-plain'}
									<Icon name="package" size={16} /> Bulk backup (unencrypted) - ({importData.length} characters)
									<span class="warning-badge"><Icon name="alertTriangle" size={12} /> Unencrypted</span>
								{:else if importFileType === 'invalid'}
									<Icon name="x" size={16} /> Invalid or corrupted file
								{:else}
									<Icon name="fileText" size={16} /> Unknown file type - ({importData.length} characters)
								{/if}
							</div>

							{#if isPasswordProtectedBackup}
								<div class="password-section">
									<input
										type="password"
										placeholder="Enter backup password"
										bind:value={importPassword}
										class="password-field"
									/>
								</div>
							{/if}

							<button
								class="action-btn primary"
								on:click={importNotes}
								disabled={isImporting}
							>
								{#if isImporting}
									<Icon name="download" size={16} />
									Importing...
								{:else}
									<Icon name="download" size={16} />
									Import Notes
								{/if}
							</button>
						{/if}
					</div>

					{#if importError}
						<div class="error-message">{importError}</div>
					{/if}
				</div>
		</div>
	</div>
{/if}

<!-- Modal Content -->
{#if showModal && !inline}
	<div class="modal-overlay" use:portal on:click={closeModal}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h3>Backup & Import</h3>
				<button class="close-btn" on:click={closeModal}>×</button>
			</div>

			<div class="modal-body">
				<!-- Export Section -->
				<div class="section">
					<h4><Icon name="upload" size={18} /> Export Notes</h4>
					<p>Export all your notes as a backup file</p>

					<div class="export-options">
						<label class="radio-option">
							<input
								type="radio"
								bind:group={exportFormat}
								value="password"
							/>
							<span class="radio-label">
								<strong><Icon name="shield" size={16} /> Password-protected</strong> - Encrypt entire backup with custom password (most secure)
							</span>
						</label>

						<label class="radio-option">
							<input
								type="radio"
								bind:group={exportFormat}
								value="encrypted"
							/>
							<span class="radio-label">
								<strong>Encrypted</strong> - Export with app encryption (medium security)
							</span>
						</label>

						<label class="radio-option">
							<input
								type="radio"
								bind:group={exportFormat}
								value="plaintext"
							/>
							<span class="radio-label">
								<strong>Plain text</strong> - Export readable text (least secure)
							</span>
						</label>
					</div>

					{#if exportFormat === 'password'}
						<div class="password-section">
							<div class="password-inputs">
								<input
									type="password"
									placeholder="Enter export password"
									bind:value={exportPassword}
									class="password-field"
								/>
								<input
									type="password"
									placeholder="Confirm export password"
									bind:value={confirmPassword}
									class="password-field"
								/>
							</div>
							{#if passwordError}
								<div class="error-message">{passwordError}</div>
							{/if}
							<p class="password-hint">
								This password protects your exported backup. Choose a strong password different from your app password.
							</p>
						</div>
					{/if}

					<button
						class="action-btn primary"
						on:click={exportAllNotes}
						disabled={isExporting || $notesMetadata.length === 0}
					>
						{#if isExporting}
							<Icon name="upload" size={16} />
							Exporting...
						{:else}
							<Icon name="upload" size={16} />
							Export {$notesMetadata.length} Notes
						{/if}
					</button>

					{#if exportSuccess}
						<div class="success-message">{exportSuccess}</div>
					{/if}

					<div class="backup-info">
						<p><strong><Icon name="lightbulb" size={16} /> Security Tips:</strong></p>
						<ul>
							<li><strong><Icon name="shield" size={14} /> Password-protected backups:</strong> Most secure, entire file encrypted</li>
							<li><strong><Icon name="lock" size={14} /> Encrypted app backups:</strong> Uses app encryption, medium security</li>
							<li><strong><Icon name="fileText" size={14} /> Plain text backups:</strong> Readable but vulnerable to interception</li>
							<li><strong><Icon name="fileText" size={14} /> .pnote files:</strong> Secure single notes with custom password</li>
							<li>Store sensitive files only in encrypted cloud storage</li>
							<li>Test restoration with small backups before relying on them</li>
							<li>Use strong, unique passwords for protected exports</li>
							<li>.pnote files are completely unreadable without password</li>
						</ul>
					</div>
				</div>

				<div class="divider"></div>

				<!-- Maintenance Section -->
				<div class="section">
					<h4><Icon name="settings" size={18} /> Database Maintenance</h4>
					<p>Fix issues with corrupted or legacy notes</p>

					<button
						class="action-btn warning"
						on:click={cleanupDatabase}
						disabled={isImporting}
					>
						<Icon name="settings" size={16} />
						Clean & Migrate Database
					</button>

					{#if cleanupResult}
						<div class="success-message">
							Cleanup complete: {cleanupResult.migrated} migrated, {cleanupResult.cleaned} cleaned
						</div>
					{/if}
				</div>

				<div class="divider"></div>

				<!-- Import Section -->
				<div class="section">
					<h4><Icon name="download" size={18} /> Import Notes</h4>
					<p>Import notes from backup files (supports encrypted and plain backups)</p>

					<div class="import-controls">
						<input
							type="file"
							accept=".json,.pnote"
							on:change={handleFileSelect}
							bind:this={fileInput}
							style="display: none"
						/>

						<button
							class="action-btn secondary"
							on:click={() => fileInput.click()}
						>
							<Icon name="folderOpen" size={16} />
							Choose File (.json or .pnote)
						</button>

						{#if importData}
							<div class="file-info">
								{#if importFileType === 'bulk-protected'}
									<Icon name="package" size={16} /> Bulk backup (encrypted) - ({importData.length} characters)
									<span class="encrypted-badge"><Icon name="shield" size={12} /> Password-protected</span>
								{:else if importFileType === 'single-protected'}
									<Icon name="fileText" size={16} /> Secure note (.pnote file) - ({importData.length} characters)
									<span class="encrypted-badge"><Icon name="shield" size={12} /> Password-protected</span>
								{:else if importFileType === 'bulk-plain'}
									<Icon name="package" size={16} /> Bulk backup (unencrypted) - ({importData.length} characters)
									<span class="warning-badge"><Icon name="alertTriangle" size={12} /> Unencrypted</span>
								{:else if importFileType === 'invalid'}
									<Icon name="x" size={16} /> Invalid or corrupted file
								{:else}
									<Icon name="fileText" size={16} /> Unknown file type - ({importData.length} characters)
								{/if}
							</div>

							{#if isPasswordProtectedBackup}
								<div class="password-section">
									<input
										type="password"
										placeholder="Enter backup password"
										bind:value={importPassword}
										class="password-field"
									/>
								</div>
							{/if}

							<button
								class="action-btn primary"
								on:click={importNotes}
								disabled={isImporting}
							>
								{#if isImporting}
									<Icon name="download" size={16} />
									Importing...
								{:else}
									<Icon name="download" size={16} />
									Import Notes
								{/if}
							</button>
						{/if}
					</div>

					{#if importError}
						<div class="error-message">{importError}</div>
					{/if}
				</div>
			</div>

			<div class="modal-footer">
				<button class="action-btn secondary" on:click={closeModal}>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.export-import-btn {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
		padding: 0.5rem 0.875rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.85rem;
		transition: var(--transition);
	}

	.export-import-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

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
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: var(--bg-secondary);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		width: 100%;
		max-width: 500px;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h3 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.25rem;
		font-weight: 700;
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
	}

	.close-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 1.5rem;
	}

	.export-import-inline {
		width: 100%;
	}

	.export-import-inline .modal-body {
		padding: 0;
	}

	.section {
		margin-bottom: 1.5rem;
	}

	.section h4 {
		margin: 0 0 0.5rem 0;
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 600;
	}

	.section p {
		margin: 0 0 1rem 0;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.export-options {
		margin-bottom: 1rem;
	}

	.radio-option {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		cursor: pointer;
	}

	.radio-option input[type="radio"] {
		margin-top: 0.125rem;
	}

	.radio-label {
		flex: 1;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.action-btn {
		padding: 0.75rem 1rem;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: var(--transition);
		width: 100%;
		margin-bottom: 0.5rem;
	}

	.action-btn.primary {
		background: var(--accent-color);
		color: white;
	}

	.action-btn.primary:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow);
	}

	.action-btn.secondary {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.action-btn.secondary:hover {
		background: var(--bg-secondary);
		border-color: var(--border-hover);
	}

	.action-btn.warning {
		background: var(--warning-color);
		color: white;
		border-color: var(--warning-color);
	}

	.action-btn.warning:hover:not(:disabled) {
		background: #d97706;
		border-color: #d97706;
	}

	.action-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none !important;
		box-shadow: none !important;
	}

	.divider {
		height: 1px;
		background: var(--border-color);
		margin: 1.5rem 0;
	}

	.import-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.password-section {
		margin-top: 1rem;
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: var(--radius);
		border: 1px solid var(--border-color);
	}

	.password-inputs {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.password-field {
		padding: 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		background: var(--input-bg);
		color: var(--text-primary);
		font-size: 0.9rem;
		transition: var(--transition);
	}

	.password-field:focus {
		outline: none;
		border-color: var(--accent-color);
		box-shadow: 0 0 0 2px var(--accent-light);
	}

	.password-hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.encrypted-badge {
		margin-left: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: var(--success-color);
		color: white;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.warning-badge {
		margin-left: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: var(--warning-color);
		color: white;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.file-info {
		padding: 0.75rem;
		background: var(--accent-light);
		border: 1px solid var(--accent-color);
		border-radius: var(--radius-sm);
		color: var(--accent-color);
		font-size: 0.85rem;
		font-weight: 500;
	}

	.success-message {
		padding: 0.75rem;
		background: var(--success-color);
		color: white;
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
		font-weight: 500;
		margin-top: 0.5rem;
	}

	.error-message {
		padding: 0.75rem;
		background: var(--error-color);
		color: white;
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
		font-weight: 500;
		margin-top: 0.5rem;
	}

	.backup-info {
		margin-top: 1rem;
		padding: 1rem;
		background: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-color);
	}

	.backup-info p {
		margin: 0 0 0.5rem 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.backup-info ul {
		margin: 0;
		padding-left: 1.2rem;
	}

	.backup-info li {
		margin-bottom: 0.25rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.modal-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--border-color);
		display: flex;
		justify-content: flex-end;
	}
</style>
