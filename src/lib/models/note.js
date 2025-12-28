import { v4 as uuidv4 } from 'uuid';
import { saveNoteMetadata, getNoteMetadata, deleteNoteMetadata } from '../storage/localStorage.js';
import { exportMarkdownFile, loadMarkdownFile } from '../storage/localStorage.js';

/**
 * Note model - represents a single note with encryption support
 */

export class Note {
	constructor(data = {}) {
		this.id = data.id || uuidv4();
		this.title = data.title || '';
		this.content = data.content || '';
		this.tags = data.tags || [];
		this.folder = data.folder || null; // Folder path (e.g., "Work/Projects" or null for root)
		this.created = data.created || new Date().toISOString();
		this.updated = data.updated || new Date().toISOString();
		this.encrypted = data.encrypted !== undefined ? data.encrypted : false; // Default to false for new notes
		this.favorite = data.favorite !== undefined ? data.favorite : false; // Default to false for new notes
		this.color = data.color || null; // Color for note (hex color code or null)
		this.mode = data.mode || 'text'; // Note mode: 'text' or 'whiteboard'
		this.whiteboardData = data.whiteboardData || null; // Whiteboard data (JSON string or object)
		this.fileHandle = data.fileHandle || null;
		this.ciphertext = data.ciphertext || null;
		this.nonce = data.nonce || null;
	}

	/**
	 * Get title - use stored title if available, otherwise extract from content
	 */
	extractTitle() {
		// Use stored title if available
		if (this.title && this.title.trim()) {
			return this.title.trim();
		}
		
		// Fallback: extract from content if no title is set
		if (this.content && this.content.trim().startsWith('<')) {
			// Extract text from HTML using safe method (SECURITY: regex instead of innerHTML)
			// Content should already be sanitized when saved, but this is an extra safety layer
			try {
				// Use regex to strip HTML tags safely (safer than innerHTML)
				const textContent = this.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();

				// Use first non-empty line from HTML text
				const lines = textContent.split('\n');
				for (const line of lines) {
					if (line.trim()) {
						return line.trim().substring(0, 50);
					}
				}
				return '';
			} catch {
				// Fallback if parsing fails
				return '';
			}
		} else if (this.content) {
			// Handle markdown content (legacy)
			const lines = this.content.split('\n');
			for (const line of lines) {
				// Check for markdown heading
				const headingMatch = line.match(/^#+\s+(.+)$/);
				if (headingMatch) {
					return headingMatch[1].trim();
				}
				// Use first non-empty line
				if (line.trim()) {
					return line.trim().substring(0, 50);
				}
			}
		}
		return 'Untitled Note';
	}

	/**
	 * Get metadata object (for IndexedDB storage)
	 */
	getMetadata() {
		return {
			id: this.id,
			title: this.title || this.extractTitle(), // Store explicit title or fallback
			content: this.content, // Store actual content
			tags: this.tags,
			folder: this.folder,
			created: this.created,
			updated: this.updated,
			encrypted: this.encrypted,
			favorite: this.favorite,
			color: this.color, // Store note color
			mode: this.mode, // Store note mode
			whiteboardData: this.whiteboardData, // Store whiteboard data
			ciphertext: this.ciphertext, // Store encrypted content
			nonce: this.nonce, // Store encryption nonce
			contentLength: this.content.length
		};
	}

	/**
	 * Encrypt note content
	 * @param {Uint8Array} masterKey - Master encryption key
	 * @param {Function} encryptNote - Encryption function (loaded dynamically)
	 */
	async encrypt(masterKey, encryptNote) {
		if (!this.encrypted || !masterKey) {
			return;
		}

		const encrypted = await encryptNote(this.content, this.id, masterKey);
		this.ciphertext = encrypted.ciphertext;
		this.nonce = encrypted.nonce;
	}

	/**
	 * Decrypt note content
	 * @param {Uint8Array} masterKey - Master decryption key
	 * @param {Function} decryptNote - Decryption function (loaded dynamically)
	 */
	async decrypt(masterKey, decryptNote) {
		if (!this.encrypted || !masterKey) {
			return;
		}

		// If note is marked as encrypted but has no ciphertext/nonce,
		// it means it was saved without encryption (fallback to plaintext)
		if (!this.ciphertext || !this.nonce) {
			console.warn('Note is marked as encrypted but has no ciphertext/nonce - treating as plaintext');
			this.encrypted = false; // Mark as not encrypted
			return;
		}

		try {
			this.content = await decryptNote(
				{
					ciphertext: this.ciphertext,
					nonce: this.nonce,
					noteId: this.id
				},
				masterKey
			);
		} catch (error) {
			console.error('Failed to decrypt note:', error);
			// If decryption fails, treat as plaintext
			this.encrypted = false;
			throw new Error('Failed to decrypt note - it may be corrupted');
		}
	}

	/**
	 * Save note to local storage (IndexedDB only)
	 * @param {Uint8Array} masterKey - Master encryption key (if encrypted)
	 * @param {Function} encryptNote - Encryption function (loaded dynamically)
	 */
	async save(masterKey = null, encryptNote = null) {
		this.updated = new Date().toISOString();

		// Encrypt if master key is available (always encrypt when possible)
		if (masterKey && encryptNote) {
			this.encrypted = true;
			await this.encrypt(masterKey, encryptNote);
		} else {
			this.encrypted = false;
		}

		// Save full data to IndexedDB
		await saveNoteMetadata(this.getMetadata());
	}

	/**
	 * Export note as markdown file to disk
	 */
	async export() {
		const markdown = this.toMarkdown();
		await exportMarkdownFile(`${this.id}.md`, markdown);
	}

	/**
	 * Export note as JSON data (for backup purposes)
	 */
	toJSON() {
		return {
			id: this.id,
			title: this.extractTitle(),
			content: this.content,
			tags: this.tags,
			folder: this.folder,
			created: this.created,
			updated: this.updated,
			encrypted: this.encrypted,
			favorite: this.favorite,
			ciphertext: this.ciphertext,
			nonce: this.nonce
		};
	}

	/**
	 * Load note from metadata and decrypt
	 * @param {string} noteId - Note identifier
	 * @param {Uint8Array} masterKey - Master decryption key
	 * @param {Function} decryptNote - Decryption function (loaded dynamically)
	 */
	static async load(noteId, masterKey = null, decryptNote = null) {
		const metadata = await getNoteMetadata(noteId);
		if (!metadata) {
			return null;
		}

		const note = new Note(metadata);

		// Content is already loaded from metadata
		// Decrypt if needed
		if (note.encrypted && masterKey && decryptNote) {
			await note.decrypt(masterKey, decryptNote);
		}

		return note;
	}

	/**
	 * Delete note
	 */
	async delete() {
		await deleteNoteMetadata(this.id);
		// Note: File handle deletion would require additional API calls
	}

	/**
	 * Convert note to markdown format
	 */
	toMarkdown() {
		const frontmatter = `---
id: ${this.id}
created: ${this.created}
updated: ${this.updated}
encrypted: ${this.encrypted}
tags: [${this.tags.map((t) => `"${t}"`).join(', ')}]
---

${this.content}`;

		return frontmatter;
	}

	/**
	 * Create note from markdown
	 * @param {string} markdown - Markdown content with frontmatter
	 */
	static fromMarkdown(markdown) {
		const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
		const match = markdown.match(frontmatterRegex);

		if (match) {
			const frontmatter = match[1];
			const content = match[2];

			// Parse frontmatter (simple YAML parsing)
			const data = {};
			frontmatter.split('\n').forEach((line) => {
				const [key, ...valueParts] = line.split(':');
				if (key && valueParts.length) {
					const value = valueParts.join(':').trim();
					if (key === 'tags') {
						data.tags = value
							.replace(/[\[\]]/g, '')
							.split(',')
							.map((t) => t.trim().replace(/"/g, ''));
					} else if (key === 'encrypted') {
						data.encrypted = value === 'true';
					} else {
						data[key.trim()] = value;
					}
				}
			});

			return new Note({ ...data, content });
		}

		// No frontmatter, treat as plain markdown
		return new Note({ content: markdown });
	}
}

