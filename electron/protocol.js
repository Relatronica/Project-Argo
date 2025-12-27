import pkg from 'electron';
const { app, protocol } = pkg;
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import { isDev, PROTOCOL_CONFIG } from './config.js';

/**
 * MIME type lookup function
 */
function getMimeType(filePath) {
	const ext = extname(filePath).toLowerCase();
	
	const mimeTypes = {
		'.js': 'application/javascript',
		'.mjs': 'application/javascript',
		'.json': 'application/json',
		'.css': 'text/css',
		'.html': 'text/html',
		'.htm': 'text/html',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.gif': 'image/gif',
		'.svg': 'image/svg+xml',
		'.webp': 'image/webp',
		'.ico': 'image/x-icon',
		'.woff': 'font/woff',
		'.woff2': 'font/woff2',
		'.ttf': 'font/ttf',
		'.eot': 'application/vnd.ms-fontobject',
		'.otf': 'font/otf',
		'.xml': 'application/xml',
		'.txt': 'text/plain',
		'.pdf': 'application/pdf',
		'.zip': 'application/zip'
	};
	
	return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Register protocol schemes (must be called before app.whenReady)
 */
export function registerProtocolSchemes() {
	protocol.registerSchemesAsPrivileged([PROTOCOL_CONFIG]);
}

/**
 * Setup protocol handler for production builds and dev fallback
 */
export function setupProtocolHandler() {
	protocol.registerBufferProtocol(PROTOCOL_CONFIG.scheme, async (request, callback) => {
		try {
			// Parse URL and extract path
			let url = request.url;
			
			// Remove protocol and normalize - handle both app:// and app:///
			url = url.replace(/^app:\/\/+/, '');
			
			// Remove query string and hash
			url = url.split('?')[0].split('#')[0];
			
			// Handle cases where path contains index.html/ (from relative path resolution)
			// e.g., app://index.html/_app/... should become _app/...
			// This can happen when browser resolves relative paths incorrectly
			url = url.replace(/^index\.html\/?/, '');
			
			// Remove all leading slashes
			url = url.replace(/^\/+/, '');
			
			// Remove all trailing slashes
			url = url.replace(/\/+$/, '');
			
			// If empty, serve index.html
			let requestedFile = url || 'index.html';
			
			// Final cleanup - remove any remaining slashes
			requestedFile = requestedFile.replace(/\/+$/, '');
			
			// If it ends up empty, serve index.html
			if (!requestedFile || requestedFile === '/') {
				requestedFile = 'index.html';
			}
			
			const appPath = app.getAppPath();
			let filePath;
			
			if (app.isPackaged) {
				// In packaged app, files are in app.asar
				filePath = join(appPath, 'build', requestedFile);
			} else {
				// In development build, files are in build/
				filePath = join(process.cwd(), 'build', requestedFile);
			}

			// Check if file exists
			if (!existsSync(filePath)) {
				if (isDev()) {
					console.error('[Protocol] File not found:', filePath, 'requested:', request.url);
				}
				callback({ error: -6 }); // FILE_NOT_FOUND
				return;
			}

			// Read file content
			const fileContent = readFileSync(filePath);
			
			// Determine MIME type based on file extension
			const mimeType = getMimeType(filePath);

			// Return with proper headers for CORS and ES modules
			callback({
				data: fileContent,
				mimeType: mimeType,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Content-Type': mimeType
				}
			});
		} catch (error) {
			console.error('[Protocol] Error:', error.message, 'URL:', request.url);
			callback({ error: -2 }); // FAILED
		}
	});
}

