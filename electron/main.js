import pkg from 'electron';
const { app, BrowserWindow } = pkg;
import { registerProtocolSchemes, setupProtocolHandler } from './protocol.js';
import { createWindow } from './window.js';
import { createMenu } from './menu.js';
import { setupIpcHandlers } from './ipc.js';

// Register protocol schemes (must be called before app.whenReady)
registerProtocolSchemes();

// Setup protocol handler and initialize app
app.whenReady().then(() => {
	setupProtocolHandler();
	createWindow();
	createMenu();
	setupIpcHandlers();

	app.on('activate', () => {
		// On macOS, re-create window when dock icon is clicked
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

// On macOS, keep app running even when all windows are closed
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

// Note: External link handling is now done in window.js using setWindowOpenHandler
// This is the modern API and provides better security control
