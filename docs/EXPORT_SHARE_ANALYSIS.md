# Analisi: Funzionalità di Esportazione e Condivisione

## 📋 Stato Attuale

### Funzionalità Esistenti

#### 1. **Export/Import Bulk** (`ExportImport.svelte`)
- ✅ **Formati supportati**:
  - Password-protected (più sicuro) - crittografia completa con salt random
  - Encrypted (con chiave app) - usa device key
  - Plaintext (meno sicuro) - leggibile senza password
- ✅ **Sicurezza**:
  - HMAC per integrità (previene manomissioni)
  - Salt random per export (previene rainbow table attacks)
  - Validazione struttura backup
  - Supporto retrocompatibilità
- ✅ **Formato file**: JSON con metadata completo

#### 2. **Export Note Singola** (`+page.svelte`)
- ✅ **Formato**: `.pnote` (Privacy Note)
- ✅ **Sicurezza**: Password-protected con salt random
- ✅ **Contenuto**: Note completa con metadata (tags, date, whiteboard data)

#### 3. **Infrastruttura**
- ✅ API Electron per file dialogs
- ✅ File System Access API (browser fallback)
- ✅ Sistema di crittografia robusto (XChaCha20-Poly1305)
- ✅ Validazione e integrità backup

---

## 🎯 Obiettivi: Coerenza e Sicurezza

### Principi Fondamentali

1. **Coerenza del Contenuto**
   - Mantenere formato e struttura consistenti
   - Preservare metadata (tags, date, folder, color)
   - Supportare tutti i tipi di note (text, whiteboard)
   - Versioning chiaro dei formati

2. **Sicurezza**
   - Zero-knowledge: contenuto mai esposto senza crittografia
   - Integrità verificabile (HMAC)
   - Password strength enforcement
   - Clear memory dopo uso password
   - Salt unici per ogni export

3. **Usabilità**
   - Formati standard e compatibili
   - Opzioni chiare per ogni scenario d'uso
   - Feedback utente chiaro
   - Gestione errori robusta

---

## 🚀 Proposte di Miglioramento

### 1. **Formati di Esportazione Aggiuntivi**

#### A. **Markdown Export** (Priorità: Alta)
**Caso d'uso**: Condivisione con editor esterni, versioning Git, documentazione

**Implementazione**:
```javascript
// Formato Markdown con frontmatter
---
id: uuid
created: ISO-date
updated: ISO-date
tags: [tag1, tag2]
folder: path/to/folder
encrypted: false
---

# Titolo Note

Contenuto in Markdown...
```

**Sicurezza**:
- Opzione password-protected (crittografa tutto il file)
- Opzione plaintext (per note non sensibili)
- Preserva metadata in frontmatter

**Vantaggi**:
- Compatibilità universale
- Versioning-friendly
- Leggibile da umani
- Supporto editor esterni

#### B. **HTML Export** (Priorità: Media)
**Caso d'uso**: Visualizzazione web, email, documentazione formattata

**Implementazione**:
- HTML standalone con CSS embedded
- Preserva formattazione Tiptap
- Include metadata come commenti HTML
- Opzione password-protected (crittografa HTML)

**Sicurezza**:
- Sanitizzazione HTML (previene XSS)
- Opzione crittografia completa
- Metadata opzionale (privacy)

#### C. **PDF Export** (Priorità: Bassa)
**Caso d'uso**: Stampa, archiviazione formale, condivisione professionale

**Implementazione**:
- Usare libreria come `jsPDF` o `pdfkit`
- Preserva formattazione
- Include metadata opzionale
- Opzione password-protected PDF (standard PDF encryption)

**Considerazioni**:
- Aumenta bundle size
- Richiede libreria esterna
- Limitazioni formattazione complessa

#### D. **Plain Text Export** (Priorità: Alta)
**Caso d'uso**: Compatibilità massima, editing esterno, script processing

**Implementazione**:
- Testo semplice senza formattazione
- Metadata come commenti o header
- Encoding UTF-8
- Opzione password-protected (crittografa testo)

---

### 2. **Sistema di Condivisione Sicura**

#### A. **Link Temporanei Local-First** (Priorità: Alta)
**Caso d'uso**: Condivisione rapida con controllo accesso

**⚠️ IMPORTANTE: Zero Server Necessario!**

**Architettura Local-First**:
```
1. Utente esporta nota → Genera file .pnote crittografato
2. Crea "link" locale (QR code o identificatore)
3. Condivisione via canale scelto dall'utente:
   - QR code con dati embedded (note piccole)
   - QR code + file locale (note medie)
   - WebRTC P2P con signaling manuale (note grandi)
```

**Opzioni Implementazione (Tutte Local-First)**:

1. **QR Code con Dati Embedded** (Raccomandato per note < 2KB)
   - Dati crittografati direttamente nel QR code
   - Zero server, zero canale esterno necessario
   - Funziona completamente offline
   - Massima privacy

2. **QR Code + File Locale** (Per note 2KB - 100KB)
   - QR contiene metadata + checksum
   - File condiviso via canale utente (email, cloud, USB, etc.)
   - Verifica integrità con checksum
   - Utente controlla completamente il canale

3. **WebRTC P2P con Signaling Manuale** (Per note > 100KB)
   - Connessione diretta P2P tra dispositivi
   - Signaling via QR code (offer/answer)
   - Zero server necessario
   - Funziona per file di qualsiasi dimensione

**Sicurezza**:
- Crittografia end-to-end (nota cifrata prima di condivisione)
- Password sempre separata (mai nel QR/link)
- Checksum per verifica integrità
- Zero metadata esposto
- Rate limiting locale (opzionale)

**Formato QR Code**:
```json
// Per note piccole (embedded)
{
  "type": "privacy-note-embedded",
  "version": "1.0",
  "data": "base64-encoded-encrypted-pnote-file"
}

// Per note medie (file locale)
{
  "type": "privacy-note-file",
  "shareId": "uuid-locale",
  "checksum": "sha256-hash",
  "filename": "note-title.pnote"
}
```

**Vedi**: `docs/P2P_SHARING_DETAILS.md` per dettagli tecnici completi

#### B. **QR Code per Condivisione** (Priorità: Alta - Integrato in Link Temporanei)
**Caso d'uso**: Condivisione offline, presentazioni, stampa

**Implementazione Local-First**:
- **Note piccole (< 2KB)**: QR code con dati crittografati embedded
- **Note medie (2KB-100KB)**: QR code con metadata + file locale
- **Note grandi (> 100KB)**: QR code con offer WebRTC per P2P

**Libreria**: `qrcode.js` o `qrcode-generator`

**Sicurezza**:
- Dati sempre crittografati (password-protected)
- Password mai nel QR (solo metadata/checksum)
- Verifica integrità con checksum
- Zero server necessario

**Vantaggi**:
- ✅ Funziona completamente offline
- ✅ Zero dipendenze server
- ✅ Privacy totale
- ✅ Facile da usare (scansiona e ricevi)

#### C. **Email Sharing** (Priorità: Bassa)
**Caso d'uso**: Condivisione professionale, archiviazione

**Implementazione**:
- Usa `mailto:` link con attachment
- OPPURE API email (Gmail, Outlook) via Electron
- Note crittografate come attachment `.pnote`
- Password comunicata separatamente (best practice)

**Sicurezza**:
- Attachment sempre crittografato
- Password mai nel body email
- Metadata minimale

---

### 3. **Miglioramenti Sicurezza Esistenti**

#### A. **Password Strength Meter** (Priorità: Alta)
**Stato**: Parzialmente implementato (`passwordStrength.js`)

**Miglioramenti**:
- Visual feedback in tempo reale
- Suggerimenti per password più forte
- Enforce minimo per export protetti
- Opzione generatore password

#### B. **Export Audit Log** (Priorità: Media)
**Caso d'uso**: Tracciamento export per sicurezza

**Implementazione**:
- Log locale (IndexedDB) di tutti gli export
- Timestamp, formato, note count
- Hash del file export (per verificare integrità)
- Opzione export log stesso

**Privacy**:
- Log locale solo (non inviato a server)
- Opzione disabilitare logging
- Clear log automatico dopo X giorni

#### C. **Watermarking Opzionale** (Priorità: Bassa)
**Caso d'uso**: Tracciamento leak, forensics

**Implementazione**:
- Watermark invisibile (steganography)
- OPPURE watermark visibile (metadata)
- ID utente univoco (opzionale)
- Solo per export plaintext/encrypted (non password-protected)

**Privacy**:
- Opzione disabilitare
- Solo con consenso esplicito
- Documentato chiaramente

#### D. **Export Encryption Options** (Priorità: Alta)
**Miglioramenti formati esistenti**:

1. **Opzione "Encrypt with Master Key"**:
   - Export con chiave master app (richiede password app per import)
   - Utile per backup personali
   - Non per condivisione

2. **Opzione "Encrypt with Custom Password"**:
   - Già implementato
   - Migliorare UI/UX

3. **Opzione "No Encryption"**:
   - Solo per note non sensibili
   - Warning esplicito
   - Richiede conferma utente

---

### 4. **Coerenza e Standardizzazione**

#### A. **Formato Metadata Standardizzato**
**Problema attuale**: Metadata diversi tra formati

**Soluzione**: Schema unificato
```json
{
  "version": "1.0",
  "format": "privacy-notes-export",
  "exportedAt": "ISO-8601",
  "appVersion": "x.y.z",
  "metadata": {
    "noteCount": 1,
    "encrypted": true,
    "format": "password-protected"
  },
  "content": { ... }
}
```

#### B. **Validazione Schema**
**Implementazione**:
- JSON Schema per validazione
- Versioning schema (backward compatible)
- Validazione automatica all'import
- Errori chiari per utente

#### C. **Preservazione Struttura**
**Garantire**:
- Folder hierarchy preservata
- Tags completi
- Whiteboard data (se presente)
- Note colors
- Favorites
- Dates (created/updated)

---

### 5. **Funzionalità Condivisione Avanzate**

#### A. **Selective Export** (Priorità: Alta)
**Caso d'uso**: Esportare solo note selezionate, non tutto

**Implementazione**:
- Checkbox per selezione note
- Filtri (per tag, folder, date range)
- Export selettivo con stesso formato bulk

#### B. **Scheduled Exports** (Priorità: Bassa)
**Caso d'uso**: Backup automatici periodici

**Implementazione**:
- Scheduler locale (Electron)
- Export automatico settimanale/mensile
- Notifica utente
- Storage in cartella dedicata

**Sicurezza**:
- Solo export password-protected
- Password richiesta una volta, salvata in keychain (macOS) / credential manager (Windows)
- Opzione disabilitare

#### C. **Export Templates** (Priorità: Media)
**Caso d'uso**: Export personalizzati per diversi scenari

**Implementazione**:
- Template predefiniti:
  - "Backup completo" (tutto, password-protected)
  - "Condivisione pubblica" (solo note non sensibili, plaintext)
  - "Archivio" (tutto, formato specifico)
- Template personalizzabili:
  - Filtri
  - Formato
  - Opzioni crittografia
  - Metadata inclusi/esclusi

---

## 📊 Priorità Implementazione

### Fase 1: Miglioramenti Essenziali (1-2 settimane)
1. ✅ **Markdown Export** - Formato universale
2. ✅ **Plain Text Export** - Compatibilità massima
3. ✅ **Selective Export** - Esportare note selezionate
4. ✅ **Password Strength UI** - Feedback visivo
5. ✅ **Schema Standardizzato** - Coerenza formati

### Fase 2: Condivisione Base (2-3 settimane)
1. ✅ **QR Code Generation** - Condivisione offline (embedded + file locale)
2. ✅ **WebRTC P2P (Opzionale)** - Per note grandi, signaling manuale
3. ✅ **HTML Export** - Visualizzazione web
4. ✅ **Export Audit Log** - Tracciamento locale

### Fase 3: Funzionalità Avanzate (3-4 settimane)
1. ✅ **PDF Export** - Formato professionale
2. ✅ **Scheduled Exports** - Backup automatici
3. ✅ **Export Templates** - Personalizzazione
4. ✅ **Server Condivisione (opzionale)** - Storage temporaneo

---

## 🔒 Considerazioni Sicurezza

### Best Practices da Implementare

1. **Password Handling**:
   - ✅ Clear memory dopo uso (già implementato)
   - ✅ Password strength enforcement (già implementato)
   - ⚠️ Keychain integration per scheduled exports
   - ⚠️ Password generator opzionale

2. **Export Security**:
   - ✅ Salt random per export (già implementato)
   - ✅ HMAC per integrità (già implementato)
   - ⚠️ Warning esplicito per export plaintext
   - ⚠️ Opzione "solo note non sensibili" per export non crittografati

3. **Condivisione Security**:
   - ⚠️ Rate limiting per link temporanei
   - ⚠️ Scadenza obbligatoria
   - ⚠️ Access logging minimale (opzionale)
   - ⚠️ Zero-knowledge: server non può leggere contenuto

4. **Privacy**:
   - ⚠️ Metadata opzionale (utente sceglie cosa esportare)
   - ⚠️ Watermarking solo con consenso
   - ⚠️ Audit log locale solo (non inviato a server)

---

## 🛠️ Implementazione Tecnica

### Nuovi Componenti Necessari

1. **`ExportFormats.svelte`**
   - UI per selezione formato
   - Opzioni crittografia
   - Preview formato

2. **`ShareDialog.svelte`**
   - Generazione link temporaneo
   - QR code display
   - Opzioni condivisione

3. **`SelectiveExport.svelte`**
   - Lista note con checkbox
   - Filtri avanzati
   - Preview selezione

4. **`ExportTemplates.svelte`**
   - Gestione template
   - Creazione/modifica template

### Nuove Utility

1. **`exportFormats.js`**
   - Funzioni export per ogni formato
   - Conversione metadata
   - Validazione output

2. **`shareService.js`** (Local-First!)
   - Generazione QR code (embedded o file-based)
   - WebRTC P2P con signaling manuale
   - Gestione share temporanei locali (IndexedDB)
   - Zero server necessario

3. **`exportAudit.js`**
   - Logging export locale
   - Query log
   - Export log stesso

### Dipendenze Aggiuntive

```json
{
  "qrcode": "^1.5.3",           // QR code generation (essenziale)
  "marked": "^11.0.0",          // Markdown parsing (se necessario)
  "jsPDF": "^2.5.1",            // PDF export (opzionale)
  "simple-peer": "^9.11.1"      // WebRTC P2P (opzionale, solo per note grandi)
}
```

**Nota**: `simple-peer` è opzionale - solo necessario per WebRTC P2P. La maggior parte delle condivisioni funzionerà con solo `qrcode`.

---

## 📝 Note Finali

### Coerenza
- Tutti i formati devono preservare stessa struttura metadata
- Versioning chiaro per backward compatibility
- Validazione robusta all'import

### Sicurezza
- Zero-knowledge sempre (server non può leggere)
- Password strength enforcement
- Integrità verificabile (HMAC)
- Clear memory best practices

### Usabilità
- UI chiara per ogni scenario
- Feedback utente immediato
- Gestione errori user-friendly
- Documentazione inline

### Privacy
- Opzioni configurabili per ogni livello privacy
- Metadata opzionale
- Audit log locale solo
- Watermarking solo con consenso

---

## 🎯 Raccomandazioni Immediate

1. **Implementare Markdown Export** - Formato più richiesto e universale
2. **Migliorare Selective Export** - Utilità immediata per utenti
3. **Aggiungere QR Code** - Condivisione semplice e offline-friendly
4. **Standardizzare Schema** - Base solida per future estensioni
5. **Migliorare Password UI** - Sicurezza più user-friendly

---

*Documento creato: 2025-01-XX*
*Versione: 1.0*
*Autore: Analisi sistema esportazione/condivisione*

