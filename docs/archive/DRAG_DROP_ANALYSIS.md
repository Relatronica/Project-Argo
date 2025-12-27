# Analisi: Drag and Drop nella Sidebar

## 📋 Stato Attuale

### Struttura della Sidebar
La sidebar (`NoteList.svelte`) attualmente supporta:
- **Visualizzazione organizzata**: Note raggruppate per cartelle, date, tag o nessun raggruppamento
- **Gestione cartelle**: Creazione, eliminazione, espansione/collasso
- **Spostamento note**: Tramite menu contestuale (`MoveMenu`) che permette di selezionare una cartella di destinazione
- **Interazioni**: Click per selezionare, menu azioni per spostare/eliminare/favorire

### Componenti Coinvolti
1. **NoteList.svelte** - Container principale della sidebar
2. **FolderGroup.svelte** - Visualizza cartelle con note annidate
3. **NoteItem.svelte** - Singolo elemento nota
4. **notesStore.js** - Store con funzione `moveNoteToFolder(noteId, folderPath)`
5. **folderStore.js** - Gestione cartelle e gerarchie

### Funzionalità Mancanti
- ❌ Drag and drop per spostare note tra cartelle
- ❌ Drag and drop per riordinare note all'interno di una cartella
- ❌ Drag and drop per riordinare cartelle
- ❌ Feedback visivo durante il drag
- ❌ Drop zones visibili per cartelle

---

## 🎯 Obiettivi del Drag and Drop

### 1. Spostamento Note tra Cartelle
**Caso d'uso**: Trascinare una nota su una cartella per spostarla
- Drag: Iniziare il drag da `NoteItem`
- Drop: Rilasciare su `FolderGroup` (header della cartella)
- Azione: Chiamare `moveNoteToFolder(noteId, folderPath)`

### 2. Riordinamento Note
**Caso d'uso**: Riordinare note all'interno della stessa cartella
- Drag: Iniziare il drag da `NoteItem`
- Drop: Rilasciare su un altro `NoteItem` nella stessa cartella
- Azione: Aggiornare l'ordine delle note (richiede campo `order` o `position` nel modello Note)

### 3. Spostamento Note nella Root
**Caso d'uso**: Rimuovere una nota da una cartella trascinandola fuori
- Drag: Iniziare il drag da `NoteItem` in una cartella
- Drop: Rilasciare su area "Root" o fuori da qualsiasi cartella
- Azione: Chiamare `moveNoteToFolder(noteId, null)`

### 4. Riordinamento Cartelle (Opzionale)
**Caso d'uso**: Riordinare le cartelle stesse
- Drag: Iniziare il drag da `FolderGroup` header
- Drop: Rilasciare su un altro `FolderGroup` header
- Azione: Aggiornare l'ordine delle cartelle (richiede campo `order` nel folderStore)

---

## 🛠️ Opzioni di Implementazione

### Opzione 1: HTML5 Drag and Drop API (Nativa)
**Vantaggi**:
- ✅ Zero dipendenze
- ✅ Supporto nativo del browser
- ✅ Leggero e performante
- ✅ Compatibile con Svelte

**Svantaggi**:
- ❌ API verbosa e complessa
- ❌ Limitato controllo su feedback visivo
- ❌ Gestione eventi più manuale

**Implementazione**:
```javascript
// Esempio base
function handleDragStart(event, note) {
  event.dataTransfer.setData('application/json', JSON.stringify({ type: 'note', id: note.id }));
  event.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function handleDrop(event, targetFolder) {
  event.preventDefault();
  const data = JSON.parse(event.dataTransfer.getData('application/json'));
  if (data.type === 'note') {
    moveNoteToFolder(data.id, targetFolder);
  }
}
```

### Opzione 2: Libreria `svelte-dnd-action`
**Vantaggi**:
- ✅ API semplice e dichiarativa
- ✅ Gestione automatica dello stato
- ✅ Feedback visivo built-in
- ✅ Ottimizzato per Svelte

**Svantaggi**:
- ❌ Dipendenza esterna
- ❌ Meno controllo fine-grained

**Installazione**:
```bash
npm install svelte-dnd-action
```

**Implementazione**:
```svelte
<script>
  import { dndzone } from 'svelte-dnd-action';
  
  let items = $folderNotes;
  
  function handleDndConsider(e) {
    // Logica per gestire il riordinamento
  }
</script>

<div use:dndzone={{items, flipDurationMs: 150}} on:consider={handleDndConsider}>
  {#each items as item (item.id)}
    <NoteItem {item} />
  {/each}
</div>
```

### Opzione 3: Libreria `@shopify/draggable`
**Vantaggi**:
- ✅ Molto potente e flessibile
- ✅ Supporta drag complessi (multi-select, constraints, etc.)
- ✅ Buona documentazione

**Svantaggi**:
- ❌ Più pesante
- ❌ Overkill per questo caso d'uso
- ❌ Richiede integrazione manuale con Svelte

---

## 💡 Raccomandazione: Approccio Ibrido

### Fase 1: HTML5 Drag and Drop per Spostamento Note
Implementare drag and drop nativo per:
- Spostare note tra cartelle (drag su cartella)
- Spostare note nella root (drag fuori dalle cartelle)

**Motivazione**: 
- Funzionalità principale richiesta
- Zero dipendenze
- Implementazione relativamente semplice

### Fase 2: Riordinamento Note (Opzionale)
Se necessario, aggiungere:
- Campo `order` o `position` nel modello Note
- Riordinamento drag and drop all'interno della stessa cartella
- Salvataggio dell'ordine personalizzato

**Nota**: Richiede modifiche al modello dati e logica di ordinamento.

---

## 📐 Architettura Proposta

### 1. Modulo Utilità: `dragDrop.js`
Centralizzare la logica drag and drop in un modulo dedicato (seguendo la preferenza dell'utente per moduli centralizzati).

**Funzionalità**:
- Gestione eventi drag (start, over, leave, drop)
- Validazione drop targets
- Feedback visivo (classi CSS)
- Integrazione con `moveNoteToFolder`

### 2. Modifiche ai Componenti

#### `NoteItem.svelte`
- Aggiungere attributi `draggable="true"`
- Gestire eventi `dragstart`, `dragend`
- Aggiungere classe CSS per feedback visivo durante drag

#### `FolderGroup.svelte`
- Aggiungere eventi `dragover`, `dragleave`, `drop` sull'header
- Feedback visivo quando una nota viene trascinata sopra
- Chiamare `moveNoteToFolder` al drop

#### `NoteList.svelte`
- Gestire drop zone per root (area fuori dalle cartelle)
- Coordinare lo stato drag tra componenti

### 3. Stili CSS
- Classe `.dragging` per elemento in drag
- Classe `.drag-over` per drop target valido
- Classe `.drag-invalid` per drop target non valido
- Transizioni smooth per feedback visivo

---

## 🔄 Flusso di Lavoro Proposto

### Scenario: Spostare una nota in una cartella

1. **Utente inizia drag** su `NoteItem`
   - `dragstart` event → Salva `noteId` in `dataTransfer`
   - Aggiunge classe `.dragging` all'elemento
   - Mostra cursore "move"

2. **Utente trascina sopra `FolderGroup`**
   - `dragover` event → `preventDefault()`, mostra feedback visivo
   - Aggiunge classe `.drag-over` al `FolderGroup`
   - Valida che il drop sia permesso (non stessa cartella)

3. **Utente rilascia**
   - `drop` event → `preventDefault()`
   - Estrae `noteId` da `dataTransfer`
   - Chiama `moveNoteToFolder(noteId, folderPath)`
   - Rimuove classi di feedback
   - Aggiorna UI (reactive store)

4. **Cleanup**
   - `dragend` event → Rimuove tutte le classi di feedback
   - Reset stato drag

---

## ⚠️ Considerazioni e Sfide

### 1. Compatibilità con Organizzazione Esistente
- Il drag and drop deve funzionare con tutti i modi di organizzazione (folders, date, tags, none)
- Quando l'organizzazione è per date/tags, il drag potrebbe non avere senso
- **Soluzione**: Abilitare drag solo quando `groupBy === 'folders'` o `groupBy === 'none'`

### 2. Gestione Stato Drag
- Evitare conflitti tra drag di note e interazioni esistenti (click, menu)
- **Soluzione**: Usare flag `isDragging` per disabilitare temporaneamente click durante drag

### 3. Feedback Visivo
- Rendere chiaro dove si può rilasciare
- Evitare feedback confusi o eccessivi
- **Soluzione**: Highlight sottile ma chiaro, con transizioni smooth

### 4. Performance
- Evitare re-render eccessivi durante drag
- **Soluzione**: Usare classi CSS invece di aggiornamenti reattivi durante drag

### 5. Accessibilità
- Supportare navigazione da tastiera
- **Soluzione**: Mantenere menu contestuale come alternativa accessibile

---

## 📦 Dipendenze Necessarie

**Nessuna** se si usa HTML5 Drag and Drop API nativa.

**Opzionale**: Se si vuole riordinamento avanzato:
```json
{
  "svelte-dnd-action": "^0.9.0"
}
```

---

## 🎨 Design UI/UX

### Stati Visivi

1. **Elemento in Drag**
   - Opacità ridotta (0.5)
   - Cursore "grabbing" o "move"
   - Bordo tratteggiato o shadow

2. **Drop Target Valido**
   - Bordo evidenziato (colore accent)
   - Background leggermente più scuro
   - Icona o indicatore visivo

3. **Drop Target Non Valido**
   - Cursore "not-allowed"
   - Nessun highlight (o highlight rosso)

4. **Durante il Drag**
   - Ghost image personalizzato (opzionale)
   - Tooltip con info cartella di destinazione

---

## ✅ Checklist Implementazione

### Fase 1: Spostamento Note tra Cartelle
- [ ] Creare modulo `dragDrop.js` con utilità
- [ ] Aggiungere `draggable="true"` a `NoteItem.svelte`
- [ ] Implementare `dragstart` handler in `NoteItem`
- [ ] Implementare `dragover`, `dragleave`, `drop` in `FolderGroup`
- [ ] Aggiungere stili CSS per feedback visivo
- [ ] Testare spostamento tra cartelle diverse
- [ ] Testare spostamento nella root

### Fase 2: Miglioramenti UX
- [ ] Aggiungere animazioni smooth
- [ ] Migliorare feedback visivo
- [ ] Aggiungere tooltip durante drag
- [ ] Gestire edge cases (stessa cartella, cartelle vuote)

### Fase 3: Riordinamento (Opzionale)
- [ ] Aggiungere campo `order` al modello Note
- [ ] Implementare riordinamento drag and drop
- [ ] Salvare ordine personalizzato
- [ ] Integrare con logica di ordinamento esistente

---

## 🚀 Prossimi Passi

1. **Confermare approccio**: HTML5 nativo vs libreria
2. **Definire priorità**: Solo spostamento cartelle o anche riordinamento?
3. **Implementare Fase 1**: Spostamento note tra cartelle
4. **Testare e iterare**: Feedback utente e miglioramenti UX

---

## 📚 Risorse

- [MDN: HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [Svelte Drag and Drop Tutorial](https://svelte.dev/tutorial/actions)
- [svelte-dnd-action Documentation](https://github.com/isaac-haggard/svelte-dnd-action)

