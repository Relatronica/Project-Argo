import pkg from 'electron';
const { BrowserWindow, dialog, app, shell } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { isDev, APP_CONFIG } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow = null;

/**
 * Get the main window instance
 */
export function getMainWindow() {
	return mainWindow;
}

/**
 * Create the main application window
 */
export async function createWindow() {
	// Create the browser window
	mainWindow = new BrowserWindow({
		width: APP_CONFIG.window.width,
		height: APP_CONFIG.window.height,
		minWidth: APP_CONFIG.window.minWidth,
		minHeight: APP_CONFIG.window.minHeight,
		backgroundColor: APP_CONFIG.window.backgroundColor,
		webPreferences: {
			preload: isDev()
				? join(process.cwd(), 'electron', 'preload.cjs')
				: join(__dirname, 'preload.cjs'),
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: false,
			// webSecurity enabled for better security - custom protocol works with it
			webSecurity: true
		},
		titleBarStyle: 'default',
		show: false // Don't show until ready
	});

	// Load the app
	let startUrl;
	if (isDev()) {
		// In dev mode, try dev server first, fallback to build if not available
		startUrl = APP_CONFIG.devServerUrl;
		console.log('[Window] Attempting to load from dev server:', startUrl);
	} else {
		// In production, use custom protocol handler
		startUrl = 'app:///index.html';
	}

	// Function to load the URL with fallback
	const loadApp = async () => {
		try {
			await mainWindow.loadURL(startUrl);
		} catch (error) {
			console.error('[Window] Failed to load URL:', startUrl, error.message);
			
			// In dev mode, if dev server is not available, fallback to build
			if (isDev() && startUrl.startsWith('http://')) {
				console.log('[Window] Dev server not available, falling back to build...');
				const fallbackUrl = 'app:///index.html';
				try {
					await mainWindow.loadURL(fallbackUrl);
					if (isDev()) {
						console.log('[Window] Successfully loaded from build:', fallbackUrl);
					}
				} catch (fallbackError) {
					console.error('[Window] Failed to load from build:', fallbackError.message);
					// Show error dialog
					dialog.showErrorBox(
						'Failed to Load App',
						'Could not connect to dev server (http://localhost:5173) and build files are not available.\n\n' +
						'Please either:\n' +
						'1. Start the dev server: npm run dev\n' +
						'2. Build the app first: npm run build'
					);
				}
			} else {
				// In production, quit on error
				app.quit();
			}
		}
	};

	// Handle failed loads (for dev server connection errors)
	mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
		if (isDev() && validatedURL === `${APP_CONFIG.devServerUrl}/` && errorCode === -102) {
			console.log('[Window] Dev server connection refused, trying build fallback...');
			const fallbackUrl = 'app:///index.html';
			mainWindow.loadURL(fallbackUrl).catch((fallbackError) => {
				if (isDev()) {
					console.error('[Window] Failed to load from build:', fallbackError.message);
				}
				dialog.showErrorBox(
					'Dev Server Not Running',
					'Could not connect to dev server at http://localhost:5173\n\n' +
					'Please start the dev server in another terminal:\n' +
					'npm run dev\n\n' +
					'Or build the app first:\n' +
					'npm run build'
				);
			});
		} else if (!isDev()) {
			console.error('[Window] Failed to load page:', errorCode, errorDescription);
		}
	});

	// Load the app
	loadApp();

	// Show window when ready to prevent visual flash
	mainWindow.once('ready-to-show', () => {
		// Maximize window to fill screen (but not fullscreen mode)
		mainWindow.maximize();
		mainWindow.show();

		// Open DevTools in development
		if (isDev()) {
			mainWindow.webContents.openDevTools();
		}
	});

	// Handle window closed
	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	// Handle console messages in development
	if (isDev()) {
		mainWindow.webContents.on('console-message', (event, level, message) => {
			console.log('[Renderer]', message);
		});
	}

	// Prevent navigation to external URLs - only allow app:// protocol and localhost in dev
	mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
		try {
			const parsedUrl = new URL(navigationUrl);
			
			// Allow app:// protocol (production)
			if (parsedUrl.protocol === 'app:') {
				return;
			}
			
			// Allow localhost in development mode only
			if (isDev() && (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')) {
				return;
			}
		} catch (error) {
			// If URL parsing fails, it's likely not a valid URL - block it
			console.warn('[Window] Invalid URL format, blocking:', navigationUrl);
		}
		
		// Block all other navigation
		console.warn('[Window] Blocked navigation to external URL:', navigationUrl);
		event.preventDefault();
	});

	// Handle external links - open in system browser instead of Electron window
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		try {
			const parsedUrl = new URL(url);
			
			// Allow app:// protocol (internal navigation)
			if (parsedUrl.protocol === 'app:') {
				return { action: 'allow' };
			}
			
			// Open external links in system browser
			if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
				shell.openExternal(url).catch(err => {
					if (isDev()) {
						console.error('[Window] Failed to open external URL:', err);
					}
				});
				return { action: 'deny' };
			}
		} catch (error) {
			// If URL parsing fails, deny the request (silent in production)
			if (isDev()) {
				console.warn('[Window] Invalid URL in setWindowOpenHandler, denying:', url);
			}
		}
		
		// Deny all other protocols
		return { action: 'deny' };
	});

	return mainWindow;
}

