/**
 * Electron File API utilities
 * Provides a unified interface for file operations that works in both
 * browser (File System Access API) and Electron (native dialogs)
 */

/**
 * Check if running in Electron
 */
export function isElectron() {
	return typeof window !== 'undefined' && window.electronAPI?.isElectron === true;
}

/**
 * Save file with dialog
 * @param {string} content - File content
 * @param {string} defaultFilename - Default filename
 * @param {Array} filters - File type filters
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
export async function saveFileDialog(content, defaultFilename, filters = null) {
	if (isElectron()) {
		try {
			// Use Electron dialog
			const result = await window.electronAPI.saveFile({
				defaultPath: defaultFilename,
				filters: filters || [
					{ name: 'All Files', extensions: ['*'] }
				]
			});

			if (result.canceled) {
				return { success: false, canceled: true };
			}

			// Write file
			const writeResult = await window.electronAPI.writeFile(result.filePath, content);
			
			if (writeResult.success) {
				return { success: true, filePath: result.filePath };
			} else {
				return { success: false, error: writeResult.error };
			}
		} catch (error) {
			return { success: false, error: error.message };
		}
	} else {
		// Fallback to browser File System Access API or download
		if ('showSaveFilePicker' in window) {
			try {
				const fileHandle = await window.showSaveFilePicker({
					suggestedName: defaultFilename,
					types: filters ? filters.map(f => ({
						description: f.name,
						accept: Object.fromEntries(
							f.extensions.map(ext => [ext === '*' ? 'application/octet-stream' : `text/${ext.replace('.', '')}`, [ext]])
						)
					})) : undefined
				});

				const writable = await fileHandle.createWritable();
				await writable.write(content);
				await writable.close();

				return { success: true, fileHandle };
			} catch (error) {
				if (error.name === 'AbortError') {
					return { success: false, canceled: true };
				}
				return { success: false, error: error.message };
			}
		} else {
			// Fallback: trigger download
			const blob = new Blob([content], { type: 'text/plain' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = defaultFilename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			return { success: true };
		}
	}
}

/**
 * Open file with dialog
 * @param {Array} filters - File type filters
 * @returns {Promise<{success: boolean, filePath?: string, content?: string, fileHandle?: FileSystemFileHandle, error?: string}>}
 */
export async function openFileDialog(filters = null) {
	if (isElectron()) {
		try {
			const result = await window.electronAPI.openFile({
				filters: filters || [
					{ name: 'All Files', extensions: ['*'] }
				]
			});

			if (result.canceled) {
				return { success: false, canceled: true };
			}

			if (result.error) {
				return { success: false, error: result.error };
			}

			return {
				success: true,
				filePath: result.filePath,
				content: result.content
			};
		} catch (error) {
			return { success: false, error: error.message };
		}
	} else {
		// Fallback to browser File System Access API
		if ('showOpenFilePicker' in window) {
			try {
				const [fileHandle] = await window.showOpenFilePicker({
					types: filters ? filters.map(f => ({
						description: f.name,
						accept: Object.fromEntries(
							f.extensions.map(ext => [ext === '*' ? 'application/octet-stream' : `text/${ext.replace('.', '')}`, [ext]])
						)
					})) : undefined
				});

				const file = await fileHandle.getFile();
				const content = await file.text();

				return {
					success: true,
					fileHandle,
					content
				};
			} catch (error) {
				if (error.name === 'AbortError') {
					return { success: false, canceled: true };
				}
				return { success: false, error: error.message };
			}
		} else {
			// Fallback: use file input (would need to be handled by caller)
			return { success: false, error: 'File picker not available' };
		}
	}
}

/**
 * Export markdown file
 * @param {string} filename - Filename
 * @param {string} content - File content
 * @returns {Promise<FileSystemFileHandle|null>}
 */
export async function exportMarkdownFile(filename, content) {
	const result = await saveFileDialog(content, filename, [
		{ name: 'Markdown files', extensions: ['.md'] },
		{ name: 'All Files', extensions: ['*'] }
	]);

	if (result.success && result.fileHandle) {
		return result.fileHandle;
	}
	return null;
}

/**
 * Open markdown file
 * @returns {Promise<{fileHandle: FileSystemFileHandle|null, content: string|null}>}
 */
export async function openMarkdownFile() {
	const result = await openFileDialog([
		{ name: 'Markdown files', extensions: ['.md'] },
		{ name: 'All Files', extensions: ['*'] }
	]);

	if (result.success) {
		return {
			fileHandle: result.fileHandle || null,
			content: result.content || null
		};
	}
	return { fileHandle: null, content: null };
}

