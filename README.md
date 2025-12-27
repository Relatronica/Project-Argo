# Privacy Notes

Privacy-first note-taking app for journalists with end-to-end encryption.

**Desktop application built with SvelteKit and Electron.**

## Features

- 🔒 **End-to-End Encryption**: All notes encrypted locally with XChaCha20-Poly1305
- 💾 **Local-First**: All data stored on your device, works offline
- 🔑 **Zero-Knowledge**: Your content never leaves your device
- 📝 **Rich Text Editor**: Tiptap-based editor with markdown support
- 🎨 **Minimalist UI**: Dark theme, simple interface
- 🔍 **Full-Text Search**: Search through all your notes locally
- 📁 **Folder Organization**: Organize notes in folders with custom icons
- 🏷️ **Tags**: Tag your notes for better organization
- 💻 **Desktop App**: Native desktop application (macOS, Windows, Linux)

## Tech Stack

- **Frontend**: SvelteKit + Tiptap
- **Desktop**: Electron
- **Encryption**: tweetnacl (XChaCha20-Poly1305)
- **Storage**: IndexedDB (local)
- **Build**: Vite + electron-builder

## Quick Start

```bash
# Install dependencies
npm install

# Start development (web)
npm run dev

# Start development (Electron desktop app)
npm run dev:electron

# Build for production (Electron)
npm run electron:build:mac    # macOS
npm run electron:build:win    # Windows
npm run electron:build:linux  # Linux
```

## Documentation

- **[Development Guide](./docs/development/DEVELOPMENT.md)** - Guide for developers
- **[Electron Setup](./docs/electron/SETUP.md)** - Complete Electron setup and development guide
- **[Testing Guide](./docs/development/TEST_APP.md)** - How to test the application
- **[Troubleshooting](./docs/development/TROUBLESHOOTING.md)** - Common issues and solutions

## Security

- Master key derived from password using PBKDF2 (100,000 iterations)
- Each note encrypted with unique key derived from master key + note ID
- Keys never leave your device
- Salt stored in localStorage (generated on first use)
- Context isolation enabled in Electron
- Custom protocol handler with Content Security Policy

## License

AGPL v3 - See LICENSE file

