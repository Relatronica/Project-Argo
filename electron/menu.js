import pkg from 'electron';
const { app, Menu, dialog } = pkg;
import { getMainWindow } from './window.js';
import { APP_CONFIG } from './config.js';

/**
 * Create application menu
 */
export function createMenu() {
	const template = [
		{
			label: 'File',
			submenu: [
				{
					label: 'New Note',
					accelerator: 'CmdOrCtrl+N',
					click: () => {
						getMainWindow()?.webContents.send('menu-action', 'new-note');
					}
				},
				{ type: 'separator' },
				{
					label: 'Export',
					click: () => {
						getMainWindow()?.webContents.send('menu-action', 'export');
					}
				},
				{
					label: 'Import',
					click: () => {
						getMainWindow()?.webContents.send('menu-action', 'import');
					}
				},
				{ type: 'separator' },
				{
					role: 'quit',
					label: process.platform === 'darwin' ? `Quit ${APP_CONFIG.productName}` : 'Exit'
				}
			]
		},
		{
			label: 'Edit',
			submenu: [
				{ role: 'undo', label: 'Undo' },
				{ role: 'redo', label: 'Redo' },
				{ type: 'separator' },
				{ role: 'cut', label: 'Cut' },
				{ role: 'copy', label: 'Copy' },
				{ role: 'paste', label: 'Paste' },
				{ role: 'selectAll', label: 'Select All' }
			]
		},
		{
			label: 'View',
			submenu: [
				{
					label: 'Toggle Sidebar',
					accelerator: 'CmdOrCtrl+B',
					click: () => {
						getMainWindow()?.webContents.send('menu-action', 'toggle-sidebar');
					}
				},
				{ type: 'separator' },
				{ role: 'reload', label: 'Reload' },
				{ role: 'forceReload', label: 'Force Reload' },
				{ role: 'toggleDevTools', label: 'Toggle Developer Tools' },
				{ type: 'separator' },
				{ role: 'resetZoom', label: 'Actual Size' },
				{ role: 'zoomIn', label: 'Zoom In' },
				{ role: 'zoomOut', label: 'Zoom Out' },
				{ type: 'separator' },
				{ role: 'togglefullscreen', label: 'Toggle Full Screen' }
			]
		},
		{
			label: 'Help',
			submenu: [
				{
					label: `About ${APP_CONFIG.productName}`,
					click: () => {
						dialog.showMessageBox(getMainWindow(), {
							type: 'info',
							title: `About ${APP_CONFIG.productName}`,
							message: APP_CONFIG.productName,
							detail: `Privacy-first note-taking app with end-to-end encryption.\nVersion ${APP_CONFIG.version}`
						});
					}
				}
			]
		}
	];

	// macOS specific menu adjustments
	if (process.platform === 'darwin') {
		template.unshift({
			label: app.getName(),
			submenu: [
				{ role: 'about', label: `About ${APP_CONFIG.productName}` },
				{ type: 'separator' },
				{ role: 'services', label: 'Services' },
				{ type: 'separator' },
				{ role: 'hide', label: `Hide ${APP_CONFIG.productName}` },
				{ role: 'hideOthers', label: 'Hide Others' },
				{ role: 'unhide', label: 'Show All' },
				{ type: 'separator' },
				{ role: 'quit', label: `Quit ${APP_CONFIG.productName}` }
			]
		});
	}

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

