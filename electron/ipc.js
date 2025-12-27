import pkg from 'electron';
const { ipcMain, dialog } = pkg;
import { readFile, writeFile } from 'fs/promises';
import { getMainWindow } from './window.js';

/**
 * Setup IPC handlers for file operations
 */
export function setupIpcHandlers() {
	// Save file dialog
	ipcMain.handle('electron:save-file', async (event, options) => {
		const { defaultPath, filters } = options;
		
		const result = await dialog.showSaveDialog(getMainWindow(), {
			defaultPath,
			filters: filters || [
				{ name: 'All Files', extensions: ['*'] }
			],
			properties: ['createDirectory']
		});

		if (result.canceled) {
			return { canceled: true };
		}

		return { canceled: false, filePath: result.filePath };
	});

	// Write file
	ipcMain.handle('electron:write-file', async (event, filePath, content) => {
		try {
			await writeFile(filePath, content, 'utf8');
			return { success: true };
		} catch (error) {
			return { success: false, error: error.message };
		}
	});

	// Open file dialog
	ipcMain.handle('electron:open-file', async (event, options) => {
		const { filters } = options;
		
		const result = await dialog.showOpenDialog(getMainWindow(), {
			filters: filters || [
				{ name: 'All Files', extensions: ['*'] }
			],
			properties: ['openFile']
		});

		if (result.canceled || result.filePaths.length === 0) {
			return { canceled: true };
		}

		try {
			const filePath = result.filePaths[0];
			const content = await readFile(filePath, 'utf8');
			return { canceled: false, filePath, content };
		} catch (error) {
			return { canceled: false, error: error.message };
		}
	});
}

