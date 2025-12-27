# Troubleshooting Electron App

## Problema: L'app non si apre dopo il build

### Soluzione 1: Test in modalità sviluppo

Prima di fare il build, testa l'app in modalità sviluppo:

```bash
npm run build
npm run electron:dev
```

Se funziona qui ma non nel build, il problema è nella configurazione del packaging.

### Soluzione 2: Verifica i log

Apri l'app e controlla i log nella console:

**macOS:**
```bash
open "dist/mac/Privacy Notes.app"
# Poi apri Console.app e cerca "Privacy Notes"
```

Oppure avvia da terminale per vedere gli errori:
```bash
./dist/mac/Privacy\ Notes.app/Contents/MacOS/Privacy\ Notes
```

### Soluzione 3: Verifica struttura file

Controlla che i file siano inclusi correttamente:

```bash
# Verifica che build/index.html esista
ls -la build/index.html

# Verifica che electron/main.js e preload.js siano inclusi
npx asar list "dist/mac/Privacy Notes.app/Contents/Resources/app.asar" | grep -E "(build|electron)"
```

### Soluzione 4: Path corretti

Se vedi errori di path, verifica:

1. **main.js** usa `app.getAppPath()` per il path del file HTML
2. **preload.js** è accessibile da `__dirname`

### Soluzione 5: Rebuild completo

A volte un rebuild completo risolve:

```bash
# Pulisci tutto
rm -rf build dist node_modules/.vite

# Reinstalla e rebuild
npm install
npm run build
npm run electron:build
```

## Errori Comuni

### "Cannot find module 'electron'"
- Assicurati di aver eseguito `npm install`
- Verifica che electron sia in `devDependencies`

### "Failed to load resource"
- Verifica che `build/index.html` esista
- Controlla il path in `main.js` (usa `app.getAppPath()`)

### "Preload script failed"
- Verifica che `electron/preload.js` esista
- Controlla che il path in `main.js` sia corretto

### App si apre ma è vuota
- Controlla la console per errori JavaScript
- Verifica che tutti gli asset siano inclusi nel build
- Controlla che SvelteKit abbia generato correttamente i file

## Debug Mode

Per vedere i log in produzione, modifica temporaneamente `main.js`:

```javascript
// Aggiungi dopo createWindow()
if (!isDev) {
  mainWindow.webContents.openDevTools();
}
```

Poi ricostruisci:
```bash
npm run build
npm run electron:build
```

## Test Rapido

Il modo più veloce per testare:

```bash
# 1. Build SvelteKit
npm run build

# 2. Test Electron (non packaged)
npm run electron:dev

# Se funziona qui, il problema è nel packaging
# Se non funziona, il problema è nella configurazione base
```

