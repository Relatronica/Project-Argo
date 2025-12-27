import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const indexPath = join(process.cwd(), 'build', 'index.html');

console.log('Fixing paths in index.html for Electron...');

let html = readFileSync(indexPath, 'utf8');

// Remove base tag if present (we'll add it back correctly)
html = html.replace(/<base[^>]*>/gi, '');

// Ensure all href attributes in link tags have proper absolute paths
// Fix modulepreload and other link tags
html = html.replace(/<link([^>]*)\shref=["']([^"']*)["']([^>]*)>/gi, (match, before, href, after) => {
	// Skip if href is already absolute with protocol or starts with #
	if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('data:') || href.startsWith('#')) {
		return match;
	}
	
	// Convert relative paths to absolute paths
	let newHref = href;
	if (!href.startsWith('/')) {
		if (href.startsWith('./')) {
			newHref = href.substring(1); // Remove leading ./
		} else if (!href.startsWith('/')) {
			newHref = '/' + href; // Add leading /
		}
	}
	
	return `<link${before} href="${newHref}"${after}>`;
});

// Fix import() statements to use full URLs with app:// protocol
// Use direct app:// URLs since base tag is always app:///
html = html.replace(/import\("([^"]*)"\)/g, (match, path) => {
	// Skip if path already has protocol
	if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('app://')) {
		return match;
	}
	
	// Convert to absolute path (ensure it starts with /)
	let newPath = path;
	if (!newPath.startsWith('/')) {
		if (newPath.startsWith('./')) {
			newPath = newPath.substring(1); // Remove leading ./
		} else {
			newPath = '/' + newPath; // Add leading /
		}
	}
	
	// Build full app:// URL directly (base tag is app:///)
	return `import("app://${newPath}")`;
});

// Remove frame-ancestors from CSP meta tag (not supported in meta tags)
html = html.replace(/frame-ancestors[^;]*;?\s*/gi, '');

// Fix CSP to allow app:// protocol for Electron
// Replace 'self' with 'self app://*' in script-src, default-src, style-src, font-src, img-src, and connect-src
html = html.replace(/script-src\s+['"]self['"]/gi, "script-src 'self' app://*");
html = html.replace(/default-src\s+['"]self['"]/gi, "default-src 'self' app://*");
html = html.replace(/style-src\s+['"]self['"]/gi, "style-src 'self' app://*");
html = html.replace(/font-src\s+['"]self['"]/gi, "font-src 'self' app://*");
html = html.replace(/img-src\s+['"]self['"]/gi, "img-src 'self' app://*");
html = html.replace(/connect-src\s+['"]self['"]/gi, "connect-src 'self' app://*");

// Add base tag pointing to app:// root (must end with /)
// Place it as the FIRST element in <head> to ensure it's processed before other resources
if (!html.includes('<base')) {
	html = html.replace(/(<head[^>]*>)/i, '$1\n\t\t<base href="app:///" />');
} else {
	// Update existing base tag and move it to the beginning
	html = html.replace(/<base[^>]*>/gi, '');
	html = html.replace(/(<head[^>]*>)/i, '$1\n\t\t<base href="app:///" />');
}

writeFileSync(indexPath, html, 'utf8');

console.log('✅ Paths fixed for Electron!');

