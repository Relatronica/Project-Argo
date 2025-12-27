# Development Guide

## Setup Iniziale

```bash
# Installa dipendenze
npm install

# Avvia dev server (http://localhost:5173)
npm run dev

# Build per produzione
npm run build

# Preview build produzione
npm run preview
```

## Struttura Progetto

```
src/
├── lib/
│   ├── components/       # Componenti Svelte riutilizzabili
│   │   ├── MarkdownEditor.svelte
│   │   ├── NoteList.svelte
│   │   ├── SearchBar.svelte
│   │   └── UnlockScreen.svelte
│   ├── crypto/           # Modulo crittografia
│   │   └── encryption.js
│   ├── models/           # Modelli dati
│   │   └── note.js
│   ├── storage/          # Storage locale
│   │   └── localStorage.js
│   └── stores/           # Svelte stores
│       ├── keyStore.js
│       └── notesStore.js
└── routes/               # Route SvelteKit
    ├── +layout.svelte
    └── +page.svelte
```

## Architettura

### Crittografia
- **Master Key**: Derivata da password con PBKDF2 (100k iterazioni)
- **Note Keys**: Derivate da master key + note ID
- **Algoritmo**: XSalsa20-Poly1305 (via tweetnacl)
- **Storage**: Chiavi mai persistite, solo in memoria

### Storage
- **IndexedDB**: Metadata note (titolo, tags, date)
- **File System API**: File markdown (Chrome/Edge)
- **Fallback**: Download automatico (Firefox/Safari)

### Flusso Dati
1. User inserisce password → Deriva master key
2. User crea/modifica nota → Cifra con master key
3. Salva → IndexedDB (metadata) + File System (markdown)
4. Carica → Decifra con master key → Mostra in editor

## Prossimi Step

### Fase 1: Miglioramenti MVP
- [ ] Migliorare gestione errori crittografia
- [ ] Aggiungere indicatore salvataggio
- [ ] Migliorare UI/UX
- [ ] Aggiungere export/import note

### Fase 2: Sync Server
- [ ] Backend Go/Node.js minimalista
- [ ] API REST per blob cifrati
- [ ] Conflict resolution
- [ ] Multi-device support

### Fase 3: P2P Sync
- [ ] WebRTC per sync diretto
- [ ] WebTorrent per backup distribuito
- [ ] Nessun server necessario

## Testing

```bash
# Type checking
npm run check

# Linting (se configurato)
npm run lint
```

## Browser Support

- ✅ **Chrome/Edge**: Full support (File System API)
- ⚠️ **Firefox/Safari**: Limited (fallback download)

## Note di Sicurezza

- Password mai loggata o inviata
- Master key solo in memoria (non localStorage)
- Salt generato randomicamente al primo uso
- Tutti i dati cifrati prima di qualsiasi storage

