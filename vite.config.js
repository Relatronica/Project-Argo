import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ['tweetnacl', 'tweetnacl-util'],
		esbuildOptions: {
			// Ensure CommonJS modules are properly handled
			mainFields: ['module', 'main']
		}
	},
	ssr: {
		// Disable SSR for modules that use browser-only APIs
		noExternal: ['tweetnacl', 'tweetnacl-util']
	},
	build: {
		outDir: 'build',
		emptyOutDir: true
	},
	server: {
		port: 5173
	}
});

