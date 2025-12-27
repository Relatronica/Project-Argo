const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
	// File operations
	saveFile: (options) => ipcRenderer.invoke('electron:save-file', options),
	writeFile: (filePath, content) => ipcRenderer.invoke('electron:write-file', filePath, content),
	openFile: (options) => ipcRenderer.invoke('electron:open-file', options),

	// Menu actions
	onMenuAction: (callback) => {
		ipcRenderer.on('menu-action', (event, action) => callback(action));
	},

	// Platform info
	platform: process.platform,
	isElectron: true
});

