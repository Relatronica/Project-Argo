# Test dell'App Electron

## Step 1: Test in Modalità Sviluppo

Prima di fare il build, testa che l'app funzioni:

```bash
# Assicurati che la build SvelteKit sia aggiornata
npm run build

# Avvia Electron in modalità dev (carica da build/)
npm run electron:dev
```

**Se funziona qui**, il problema è nel packaging.  
**Se non funziona**, c'è un problema nella configurazione base.

## Step 2: Test App Buildata

Dopo il build, testa l'app:

### Opzione A: Apri direttamente
```bash
open "dist/mac/Privacy Notes.app"
```

### Opzione B: Avvia da terminale (vedi errori)
```bash
./dist/mac/Privacy\ Notes.app/Contents/MacOS/Privacy\ Notes
```

Questo mostrerà eventuali errori nella console.

## Step 3: Verifica Log

Se l'app non si apre, controlla i log:

1. Apri **Console.app** (applicazione macOS)
2. Cerca "Privacy Notes" nei log
3. Cerca errori relativi a:
   - "Failed to load"
   - "Cannot find module"
   - "Preload script"

## Problemi Comuni e Soluzioni

### L'app si apre ma è bianca/vuota

**Causa**: Path del file HTML non corretto o file non inclusi.

**Soluzione**:
1. Verifica che `build/index.html` esista
2. Controlla i log nella console
3. Verifica che tutti gli asset siano nel build

### Errore "Cannot find preload.js"

**Causa**: Path del preload non corretto quando packaged.

**Soluzione**: Il preload dovrebbe essere accessibile da `__dirname` anche quando packaged.

### L'app crasha all'avvio

**Causa**: Errore nel main process.

**Soluzione**: 
1. Avvia da terminale per vedere l'errore
2. Controlla `electron/main.js` per errori di sintassi
3. Verifica che tutte le dipendenze siano installate

## Debug Avanzato

Per vedere cosa sta succedendo, modifica temporaneamente `electron/main.js`:

Aggiungi dopo `createWindow()`:
```javascript
// Apri DevTools anche in produzione (temporaneo)
mainWindow.webContents.openDevTools();
```

Poi ricostruisci e testa.

## Prossimi Passi

1. ✅ Testa in modalità dev (`npm run electron:dev`)
2. ✅ Se funziona, fai il build (`npm run electron:build`)
3. ✅ Testa l'app buildata
4. ✅ Controlla i log se ci sono problemi

