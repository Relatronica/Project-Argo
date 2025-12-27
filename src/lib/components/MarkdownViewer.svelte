<script>
	import { onMount } from 'svelte';
	import DOMPurify from 'dompurify';
	import { logger } from '../utils/logger.js';

	export let content = '';
	export let className = '';

	let container;
	let renderedHtml = '';

	/**
	 * Robust HTML sanitization using DOMPurify
	 * Prevents XSS attacks through proper HTML parsing and sanitization
	 */
	function sanitizeHtml(html) {
		if (!html) return '';

		// Use DOMPurify for robust sanitization
		return DOMPurify.sanitize(html, {
			ALLOWED_TAGS: [
				'p', 'br', 'strong', 'em', 'u', 's', 'del', 'mark',
				'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
				'ul', 'ol', 'li',
				'blockquote', 'code', 'pre',
				'a', 'img',
				'table', 'thead', 'tbody', 'tr', 'th', 'td',
				'hr', 'sub', 'sup'
			],
			ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style'],
			ALLOW_DATA_ATTR: false,
			FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'style'],
			FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmouseenter', 'onmouseleave', 'onsubmit'],
			ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
			KEEP_CONTENT: true,
			RETURN_DOM: false,
			RETURN_DOM_FRAGMENT: false,
			RETURN_TRUSTED_TYPE: false
		});
	}

	async function renderContent(text) {
		try {
			// If content is HTML (starts with <), sanitize it directly
			if (text && text.trim().startsWith('<')) {
				return sanitizeHtml(text);
			}

			// Otherwise, try to render as markdown (fallback for backward compatibility)
			const { marked } = await import('marked');

			// Configure marked for security
			marked.setOptions({
				breaks: false, // Don't allow line breaks
				gfm: true, // GitHub Flavored Markdown
				headerIds: false, // Don't generate header IDs
				mangle: false // Don't mangle emails
			});

			const html = marked.parse(text || '');
			return sanitizeHtml(html);
		} catch (error) {
			logger.error('Content rendering error:', error);
			return '<p>Error rendering content</p>';
		}
	}

	$: if (content !== undefined) {
		renderContent(content).then(html => {
			renderedHtml = html;
		}).catch(error => {
			logger.error('Error rendering content:', error);
			renderedHtml = '<p>Error rendering content</p>';
		});
	}

	// Update container when HTML changes
	$: if (container && renderedHtml) {
		container.innerHTML = renderedHtml;
	}
</script>

<div
	bind:this={container}
	class="markdown-viewer {className}"
	role="document"
	aria-label="Rendered markdown content"
></div>

<style>
	.markdown-viewer {
		line-height: 1.6;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
		font-size: 16px;
		color: var(--text-primary);
	}

	.markdown-viewer :global(p) {
		margin: 0 0 1rem 0;
	}

	.markdown-viewer :global(h1),
	.markdown-viewer :global(h2),
	.markdown-viewer :global(h3),
	.markdown-viewer :global(h4),
	.markdown-viewer :global(h5),
	.markdown-viewer :global(h6) {
		margin: 1.5rem 0 0.5rem 0;
		font-weight: 600;
		line-height: 1.2;
		color: var(--text-primary);
	}

	.markdown-viewer :global(h1) { font-size: 2rem; border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem; }
	.markdown-viewer :global(h2) { font-size: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; }
	.markdown-viewer :global(h3) { font-size: 1.25rem; }
	.markdown-viewer :global(h4) { font-size: 1.1rem; }
	.markdown-viewer :global(h5) { font-size: 1rem; }
	.markdown-viewer :global(h6) { font-size: 0.9rem; }

	.markdown-viewer :global(ul),
	.markdown-viewer :global(ol) {
		margin: 0 0 1rem 0;
		padding-left: 2rem;
	}

	.markdown-viewer :global(li) {
		margin: 0.25rem 0;
	}

	.markdown-viewer :global(blockquote) {
		border-left: 4px solid var(--accent-color);
		padding-left: 1rem;
		margin: 1rem 0;
		color: var(--text-secondary);
		font-style: italic;
		background: var(--accent-light);
		padding: 1rem;
		border-radius: var(--radius-sm);
	}

	.markdown-viewer :global(code) {
		background: var(--bg-tertiary);
		padding: 0.125rem 0.25rem;
		border-radius: 3px;
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
		font-size: 0.9em;
		color: var(--accent-color);
	}

	.markdown-viewer :global(pre) {
		background: var(--bg-tertiary);
		padding: 1rem;
		border-radius: var(--radius);
		overflow-x: auto;
		border: 1px solid var(--border-color);
		margin: 1rem 0;
	}

	.markdown-viewer :global(pre code) {
		background: none;
		padding: 0;
		color: var(--text-primary);
	}

	.markdown-viewer :global(hr) {
		border: none;
		border-top: 1px solid var(--border-color);
		margin: 2rem 0;
	}

	.markdown-viewer :global(a) {
		color: var(--accent-color);
		text-decoration: none;
		transition: var(--transition);
	}

	.markdown-viewer :global(a:hover) {
		text-decoration: underline;
	}

	.markdown-viewer :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-sm);
		margin: 1rem 0;
	}

	.markdown-viewer :global(strong) {
		font-weight: 600;
	}

	.markdown-viewer :global(em) {
		font-style: italic;
	}

	/* Table styles */
	.markdown-viewer :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1rem 0;
		font-size: 0.9rem;
	}

	.markdown-viewer :global(th),
	.markdown-viewer :global(td) {
		border: 1px solid var(--border-color);
		padding: 0.5rem 0.75rem;
		text-align: left;
	}

	.markdown-viewer :global(th) {
		background: var(--bg-tertiary);
		font-weight: 600;
		color: var(--text-primary);
	}

	.markdown-viewer :global(tr:nth-child(even)) {
		background: var(--bg-secondary);
	}

	.markdown-viewer :global(tr:hover) {
		background: var(--bg-tertiary);
	}

	/* Text alignment */
	.markdown-viewer :global(.text-left) {
		text-align: left;
	}

	.markdown-viewer :global(.text-center) {
		text-align: center;
	}

	.markdown-viewer :global(.text-right) {
		text-align: right;
	}

	/* Color styles */
	.markdown-viewer :global([style*="color"]) {
		/* Preserve inline color styles */
	}

	/* Additional HTML elements */
	.markdown-viewer :global(del) {
		text-decoration: line-through;
		color: var(--text-secondary);
	}

	.markdown-viewer :global(mark) {
		background: var(--accent-light);
		color: var(--text-primary);
		padding: 0.125rem 0.25rem;
		border-radius: 2px;
	}

	.markdown-viewer :global(sub),
	.markdown-viewer :global(sup) {
		font-size: 0.75em;
		line-height: 1;
	}

	.markdown-viewer :global(sub) {
		vertical-align: sub;
	}

	.markdown-viewer :global(sup) {
		vertical-align: super;
	}
</style>
