import pkg from 'electron';
const { app } = pkg;

/**
 * Check if running in development mode
 */
export function isDev() {
	return process.env.NODE_ENV === 'development' || !app.isPackaged;
}

export const APP_CONFIG = {
	appId: 'com.privacy-notes.app',
	productName: 'Privacy Notes',
	version: '0.1.0',
	devServerUrl: 'http://localhost:5173',
	window: {
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		backgroundColor: '#1a1a1a'
	}
};

export const PROTOCOL_CONFIG = {
	scheme: 'app',
	privileges: {
		secure: true,
		standard: true,
		corsEnabled: true,
		supportFetchAPI: true,
		stream: true,
		allowServiceWorkers: true
	}
};

