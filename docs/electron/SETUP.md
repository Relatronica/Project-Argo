# Setup Electron - Guida Completa

## Installazione Dipendenze

```bash
npm install
```

Questo installerà automaticamente:
- `electron` (v28.0.0)
- `electron-builder` (v24.9.1)
- `@sveltejs/adapter-static` (v3.0.0)

## Sviluppo

### Modalità Sviluppo Base

```bash
# Build dell'app SvelteKit
npm run build

# Avvia Electron in modalità sviluppo
npm run electron:dev
```

**Nota**: In sviluppo, Electron caricherà l'app da `http://localhost:5173` se il dev server è in esecuzione, altrimenti da `build/index.html`.

### Modalità Sviluppo con Hot-Reload

Per avere hot-reload durante lo sviluppo:

**Terminale 1** (SvelteKit dev server):
```bash
npm run dev
```

**Terminale 2** (Electron):
```bash
npm run electron:dev
```

Oppure usa il comando combinato:
```bash
npm run dev:electron
```

## Build per Produzione

### Build per tutte le piattaforme
```bash
npm run electron:build
```

### Build per piattaforma specifica

**macOS**:
```bash
npm run electron:build:mac
```

**Windows**:
```bash
npm run electron:build:win
```

**Linux**:
```bash
npm run electron:build:linux
```

I file distribuiti saranno in `dist/`.

## Struttura File

```
Project Argo/
├── electron/
│   ├── main.js          # Main process Electron
│   ├── preload.cjs      # Preload script (bridge sicuro)
│   ├── window.js        # Window management
│   ├── protocol.js      # Custom protocol handler
│   ├── menu.js          # Menu bar
│   ├── ipc.js           # IPC handlers
│   └── config.js        # Configuration
├── scripts/
│   └── fix-electron-paths.js  # Script per fix path in build
├── build/               # Output SvelteKit build
├── dist/                # Output Electron distributables
└── electron-builder.yml # Configurazione electron-builder
```

## Funzionalità Implementate

- ✅ Menu bar nativo (File, Edit, View, Help)
- ✅ Keyboard shortcuts globali
- ✅ File dialogs nativi (save/open)
- ✅ Window management
- ✅ Context isolation per sicurezza
- ✅ Preload script per API sicure
- ✅ Custom protocol handler (`app://`)
- ✅ Content Security Policy configurata

## Icone App

Per creare le icone, aggiungi nella cartella `electron/icons/`:
- `icon.icns` (macOS, 512x512 o più grande)
- `icon.ico` (Windows)
- `icon.png` (Linux, 512x512)

Puoi usare tool come:
- [electron-icon-maker](https://www.npmjs.com/package/electron-icon-maker)
- [IconGenerator](https://iconverticons.com/online/)

## Troubleshooting

### Errore: "Cannot find module 'electron'"
Assicurati di aver eseguito `npm install`.

### L'app non si apre / schermata grigia
1. Verifica che la build SvelteKit sia stata creata: `npm run build`
2. Controlla i log nella console di Electron (DevTools)
3. Verifica che lo script `fix-electron-paths.js` sia stato eseguito
4. Controlla la console per errori CSP o di caricamento moduli

### File operations non funzionano
Verifica che il preload script sia correttamente configurato in `electron/window.js` e che `contextIsolation` sia `true`.

### Build fallisce
1. Verifica che tutte le dipendenze siano installate
2. Controlla che `electron-builder.yml` sia presente
3. Assicurati di avere spazio su disco sufficiente
4. Pulisci le build precedenti: `npm run clean`

### Errori CSP (Content Security Policy)
Se vedi errori CSP nella console, verifica che lo script `fix-electron-paths.js` abbia aggiunto correttamente `app://*` alle direttive CSP.

## Testing

1. Testa export/import di note
2. Verifica che i menu funzionino
3. Controlla keyboard shortcuts
4. Testa su diverse piattaforme
5. Verifica che l'app funzioni senza connessione internet

## Prossimi Passi (Opzionali)

- [ ] Aggiungere icone app personalizzate
- [ ] Configurare auto-updater
- [ ] Aggiungere tray icon
- [ ] Code signing per distribuzione pubblica
- [ ] Test su tutte le piattaforme
- [ ] Configurare notarization per macOS

