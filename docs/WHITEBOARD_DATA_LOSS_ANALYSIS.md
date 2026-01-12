# Analisi: Perdita Dati Whiteboard durante Cambio Modalità/Nota

## Problema Identificato

Quando si passa da una nota all'altra o si apre/chiude il pannello whiteboard, i disegni vengono persi. Dai log si vede che i `paths` passano da valori positivi (es. 2, 3) a 0.

## Analisi del Flusso

### Flusso Attuale

1. **Disegno sulla whiteboard**:
   - L'utente disegna → `Whiteboard` componente chiama `onPathAdd`
   - `WhiteboardLayout.handlePathAdd` aggiorna `whiteboardPaths` e chiama `saveWhiteboardData()`
   - `saveWhiteboardData()` aggiorna `note.whiteboardData` immediatamente e chiama `onContentChange`
   - `EditorContainer.handleContentChange` aggiorna `previousNoteData` e programma auto-save

2. **Cambio modalità (whiteboard → text)**:
   - `MainContent.handleModeToggle` chiama `saveCurrentNote()` PRIMA di cambiare modalità
   - `saveCurrentNote()` salva la nota e poi RICARICA la nota da storage (`reloadedNote`)
   - Se i dati della whiteboard non erano stati salvati correttamente in storage, vengono persi
   - La modalità viene cambiata
   - `EditorContainer.handleNoteChange` viene chiamato (perché la modalità è cambiata)

3. **Riapertura whiteboard (text → whiteboard)**:
   - `WhiteboardLayout.loadWhiteboardData()` viene chiamato
   - Se `note.whiteboardData` è null o vuoto, non carica nulla
   - I path rimangono vuoti

## Problemi Identificati

### 1. Normalizzazione Eccessiva
**Problema**: `EditorContainer.normalizeWhiteboardData()` veniva chiamato quando si caricava la nota, convertendo dati vuoti in `null`. Questo poteva sovrascrivere dati validi se c'era un timing issue.

**Correzione**: Rimossa la normalizzazione quando si carica la nota. La normalizzazione dovrebbe avvenire solo quando si salva, non quando si carica.

### 2. Doppio Salvataggio durante Cambio Modalità
**Problema**: Quando cambiava solo la modalità (non la nota), `EditorContainer.handleNoteChange` salvava i dati. Ma `MainContent.handleModeToggle` salva già la nota prima di cambiare modalità, causando potenziali conflitti.

**Correzione**: Rimosso il salvataggio in `EditorContainer.handleNoteChange` per i cambi di modalità, lasciando solo il salvataggio quando cambia la nota. `MainContent.handleModeToggle` gestisce già il salvataggio per i cambi di modalità.

### 3. Mancanza di Logging
**Problema**: Non c'era abbastanza logging per capire quando i dati vengono caricati/salvati.

**Correzione**: Aggiunto logging dettagliato in `WhiteboardLayout.loadWhiteboardData()` per tracciare il flusso di caricamento.

## Correzioni Applicate

### 1. EditorContainer.svelte

- **Rimossa normalizzazione durante il caricamento**: Non viene più chiamata `normalizeWhiteboardData()` quando si inizializza `previousNoteData`, preservando i dati come sono nella nota
- **Rimosso salvataggio per cambi di modalità**: Il salvataggio avviene solo quando cambia la nota, non quando cambia solo la modalità (perché `MainContent.handleModeToggle` gestisce già il salvataggio)

### 2. WhiteboardLayout.svelte

- **Aggiunto logging dettagliato**: Aggiunto logging in `loadWhiteboardData()` per tracciare quando i dati vengono caricati, quanti path vengono trovati, ecc.

## Possibili Problemi Residui

### 1. Timing del Salvataggio

Il problema principale potrebbe essere che quando `MainContent.handleModeToggle` salva la nota, i dati della whiteboard potrebbero non essere ancora stati sincronizzati correttamente. Anche se `WhiteboardLayout.saveWhiteboardData()` aggiorna immediatamente `note.whiteboardData`, potrebbe esserci un problema di timing.

**Possibile soluzione**: Assicurarsi che quando si cambia modalità, `WhiteboardLayout.onDestroy()` abbia il tempo di salvare i dati prima che `MainContent.handleModeToggle` salvi la nota. Ma `onDestroy` non può essere asincrono, quindi potrebbe non essere sufficiente.

### 2. Ricaricamento della Nota

Quando `saveCurrentNote()` ricarica la nota da storage, se i dati della whiteboard non erano stati salvati correttamente, vengono persi. Questo potrebbe essere un problema nella logica di salvataggio/caricamento della nota stessa.

**Verificare**: Come viene salvato `whiteboardData` in `Note.save()` e come viene caricato in `Note.load()`.

### 3. Reactive Statement in WhiteboardLayout

Il reactive statement in `WhiteboardLayout` controlla solo se `note.id` cambia, non se `note.whiteboardData` cambia. Quando si cambia modalità (stessa nota), il componente viene distrutto e ricreato, quindi dovrebbe ricaricare i dati. Ma se i dati non sono stati salvati correttamente, non vengono caricati.

## Raccomandazioni Future

1. **Verificare la logica di salvataggio/caricamento della nota**: Assicurarsi che `whiteboardData` venga salvato e caricato correttamente in `Note.save()` e `Note.load()`

2. **Aggiungere più logging**: Aggiungere logging anche in `Note.save()` e `Note.load()` per vedere se i dati vengono salvati/caricati correttamente

3. **Considerare un meccanismo di flush**: Prima di cambiare modalità, potrebbe essere necessario "flushare" tutti i cambiamenti pendenti per assicurarsi che i dati siano sincronizzati

4. **Test approfonditi**: Testare il flusso completo: disegnare sulla whiteboard, cambiare modalità, cambiare nota, e verificare che i dati vengano preservati

## Note

Il problema potrebbe anche essere legato a come Svelte gestisce i reactive statements e il ciclo di vita dei componenti. Quando si cambia modalità, il componente `WhiteboardLayout` viene distrutto e ricreato, quindi dovrebbe ricaricare i dati dalla nota. Ma se i dati non sono stati salvati correttamente prima della distruzione, vengono persi.
