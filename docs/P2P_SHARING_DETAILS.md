# Link Temporanei P2P: Architettura Local-First

## 🔍 Come Funziona WebRTC P2P

### Il Problema: NAT e Firewall

Quando due dispositivi vogliono comunicare direttamente (P2P), spesso sono dietro NAT/firewall che impediscono connessioni dirette. WebRTC risolve questo con:

1. **Signaling Server** (minimo, solo per coordinamento)
2. **STUN Server** (per scoprire IP pubblico)
3. **TURN Server** (fallback se P2P diretto fallisce)

### ⚠️ Ma Serve un Server?

**Dipende dall'approccio:**

#### Opzione 1: WebRTC Puro (Richiede Signaling Server)
- **Signaling**: Serve un server minimale SOLO per scambiare "offer/answer" (coordinate connessione)
- **Dati**: Passano direttamente P2P (zero-knowledge)
- **Problema**: Serve comunque un server per signaling

#### Opzione 2: WebRTC con Signaling P2P (Local-First!)
- **Signaling via QR Code**: Offer/answer scambiati manualmente (QR code)
- **Dati**: P2P diretto
- **Vantaggio**: Zero server necessario
- **Svantaggio**: Richiede presenza fisica o canale alternativo

#### Opzione 3: Link Temporanei con Storage Locale (Completamente Local-First!)
- **Nessun server**: Tutto locale
- **Link = File locale**: Il "link" è un riferimento a file temporaneo locale
- **Condivisione**: Via file system, email, o servizi esterni (utente sceglie)

---

## 🎯 Soluzioni Local-First per Link Temporanei

### Soluzione 1: **QR Code con Dati Embedded** (Raccomandato)

**Come funziona:**
```
1. Utente esporta nota → Genera file .pnote crittografato
2. Genera QR code contenente:
   - File .pnote completo (se piccolo < 2KB)
   - OPPURE link a file condiviso via altro canale
3. Destinatario scansiona QR → Riceve file direttamente
4. Destinatario apre file → Richiede password → Decripta
```

**Vantaggi:**
- ✅ Zero server necessario
- ✅ Funziona offline
- ✅ Completamente local-first
- ✅ Privacy totale (dati nel QR, non su server)

**Limitazioni:**
- ⚠️ QR code limitato a ~2-3KB (note piccole)
- ⚠️ Per note grandi: QR contiene solo link/metadata

**Implementazione:**
```javascript
// QR code con file embedded (note piccole)
const noteData = {
  type: 'privacy-note',
  version: '1.0',
  encrypted: true,
  data: encryptedNoteData // Base64 encoded .pnote file
};

const qrData = JSON.stringify(noteData);
const qrCode = await generateQRCode(qrData);

// QR code con link (note grandi)
const shareId = generateShareId(); // UUID locale
const shareData = {
  type: 'privacy-note-link',
  shareId: shareId,
  passwordHash: hashPassword(password), // Per verifica, non decriptazione
  expiresAt: Date.now() + 24*60*60*1000 // 24h
};

// Salva file temporaneo localmente
await saveTemporaryShare(shareId, encryptedNoteFile, 24*60*60*1000);

// QR contiene solo metadata
const qrData = JSON.stringify(shareData);
```

---

### Soluzione 2: **WebRTC con Signaling Manuale** (P2P Puro)

**Come funziona:**
```
1. Utente A vuole condividere → Genera "offer" WebRTC
2. Offer convertito in QR code
3. Utente B scansiona QR → Riceve offer
4. Utente B genera "answer" → Converte in QR
5. Utente A scansiona answer → Connessione P2P stabilita
6. Utente A invia file crittografato via WebRTC
7. Utente B riceve → Salva localmente → Decripta
```

**Vantaggi:**
- ✅ Zero server necessario
- ✅ Dati passano direttamente P2P
- ✅ Funziona per file grandi
- ✅ Completamente decentralizzato

**Svantaggi:**
- ⚠️ Richiede entrambi online simultaneamente
- ⚠️ Richiede scambio QR code bidirezionale
- ⚠️ Più complesso da usare

**Implementazione:**
```javascript
// Utente A (sender)
const peer = new SimplePeer({ initiator: true });
const offer = await peer.generateOffer();

// Converti offer in QR
const qrOffer = await generateQRCode(JSON.stringify({
  type: 'webrtc-offer',
  offer: offer
}));

// Utente B scansiona → riceve offer
// Utente B genera answer
const peerB = new SimplePeer();
await peerB.signal(offer);
const answer = peerB.generateAnswer();

// Converti answer in QR
const qrAnswer = await generateQRCode(JSON.stringify({
  type: 'webrtc-answer',
  answer: answer
}));

// Utente A scansiona answer → connessione stabilita
await peer.signal(answer);

// Trasferisci file
peer.send(encryptedNoteFile);
```

---

### Soluzione 3: **File Temporanei Locali con Link Simbolico** (Più Semplice)

**Come funziona:**
```
1. Utente esporta nota → Salva come file .pnote
2. Genera "link" locale (path file o UUID)
3. Link convertito in QR code o testo
4. Destinatario riceve link → Apre file direttamente
   (via file system, email attachment, cloud storage, etc.)
```

**Vantaggi:**
- ✅ Zero server necessario
- ✅ Massima semplicità
- ✅ Utente controlla completamente il canale di condivisione
- ✅ Funziona offline

**Svantaggi:**
- ⚠️ Richiede canale esterno per trasferimento file (email, USB, cloud, etc.)
- ⚠️ Non "link" nel senso tradizionale (non cliccabile)

**Implementazione:**
```javascript
// Esporta nota
const noteFile = await exportNoteAsPnote(note, password);

// Genera "link" (in realtà è un identificatore)
const shareToken = {
  type: 'file-share',
  filename: noteFile.filename,
  checksum: await calculateChecksum(noteFile.data),
  passwordHint: null, // Opzionale, non la password!
  expiresAt: null // File locale, non ha scadenza server-side
};

// QR code con metadata
const qrData = JSON.stringify(shareToken);
const qrCode = await generateQRCode(qrData);

// Utente condivide file via canale preferito:
// - Email attachment
// - Cloud storage (Dropbox, Google Drive, etc.)
// - USB drive
// - Messaging app
// - etc.
```

---

### Soluzione 4: **IPFS Locale (Opzionale, Avanzato)**

**Come funziona:**
```
1. Utente esporta nota → Carica su IPFS locale (js-ipfs)
2. IPFS genera hash (CID) del file
3. Hash convertito in link IPFS: ipfs://<CID>
4. Link convertito in QR code
5. Destinatario ha IPFS → Scarica direttamente da rete P2P
6. Se destinatario non ha IPFS → Usa gateway pubblico (opzionale)
```

**Vantaggi:**
- ✅ Decentralizzato (rete IPFS)
- ✅ Link permanenti (hash-based)
- ✅ Funziona P2P

**Svantaggi:**
- ⚠️ Richiede nodo IPFS (può essere embedded)
- ⚠️ Gateway pubblico può loggare accessi (privacy concern)
- ⚠️ Più complesso

**Implementazione:**
```javascript
// Inizializza IPFS locale (embedded)
const ipfs = await IPFS.create({
  repo: './ipfs-repo',
  config: {
    Addresses: {
      Swarm: ['/ip4/0.0.0.0/tcp/4002']
    }
  }
});

// Carica file
const file = await ipfs.add(encryptedNoteFile);
const cid = file.cid.toString();

// Link IPFS
const ipfsLink = `ipfs://${cid}`;

// QR code
const qrCode = await generateQRCode(ipfsLink);

// Destinatario scarica
const fileData = await ipfs.cat(cid);
```

---

## 🏆 Raccomandazione: Approccio Ibrido

### Per Note Piccole (< 2KB)
**QR Code con Dati Embedded**
- Dati direttamente nel QR
- Zero server, zero canale esterno
- Massima privacy

### Per Note Medie (2KB - 100KB)
**QR Code con File Locale + Canale Utente**
- QR contiene metadata + checksum
- File condiviso via canale scelto dall'utente (email, cloud, etc.)
- Verifica integrità con checksum

### Per Note Grandi (> 100KB)
**WebRTC P2P con Signaling Manuale**
- Connessione diretta P2P
- Zero server
- Funziona per file di qualsiasi dimensione

---

## 📋 Implementazione Pratica

### Architettura Componenti

```javascript
// src/lib/services/shareService.js

/**
 * Servizio di condivisione local-first
 * Zero server necessario
 */
export class ShareService {
  
  /**
   * Genera QR code per condivisione
   * @param {Note} note - Nota da condividere
   * @param {string} password - Password per crittografia
   * @param {string} method - 'embedded' | 'file' | 'webrtc'
   */
  async generateShareQR(note, password, method = 'auto') {
    // Determina metodo automaticamente
    if (method === 'auto') {
      const noteSize = this.calculateNoteSize(note);
      if (noteSize < 2000) method = 'embedded';
      else if (noteSize < 100000) method = 'file';
      else method = 'webrtc';
    }
    
    switch (method) {
      case 'embedded':
        return await this.generateEmbeddedQR(note, password);
      case 'file':
        return await this.generateFileShareQR(note, password);
      case 'webrtc':
        return await this.generateWebRTCShare(note, password);
    }
  }
  
  /**
   * QR code con dati embedded (note piccole)
   */
  async generateEmbeddedQR(note, password) {
    // Esporta nota crittografata
    const encryptedNote = await this.exportEncryptedNote(note, password);
    
    // Crea payload QR
    const payload = {
      type: 'privacy-note-embedded',
      version: '1.0',
      data: encryptedNote // Base64 encoded .pnote
    };
    
    // Genera QR
    const qrData = JSON.stringify(payload);
    return await this.generateQRCode(qrData);
  }
  
  /**
   * QR code con link a file (note medie)
   */
  async generateFileShareQR(note, password) {
    // Esporta nota
    const noteFile = await this.exportEncryptedNote(note, password);
    
    // Salva localmente (temporaneo)
    const shareId = this.generateShareId();
    await this.saveTemporaryShare(shareId, noteFile);
    
    // Crea payload QR
    const payload = {
      type: 'privacy-note-file',
      shareId: shareId,
      checksum: await this.calculateChecksum(noteFile),
      filename: `${note.extractTitle()}.pnote`,
      // Password hint opzionale (NON la password!)
      passwordHint: null
    };
    
    // Genera QR
    const qrData = JSON.stringify(payload);
    return await this.generateQRCode(qrData);
  }
  
  /**
   * WebRTC P2P sharing (note grandi)
   */
  async generateWebRTCShare(note, password) {
    // Implementazione WebRTC con signaling manuale
    // (vedi esempio sopra)
  }
}

/**
 * Servizio per gestire share temporanei locali
 */
export class LocalShareStorage {
  /**
   * Salva share temporaneo
   */
  async saveShare(shareId, data, ttl = 24*60*60*1000) {
    // Salva in IndexedDB con TTL
    await this.db.shares.put({
      id: shareId,
      data: data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl
    });
    
    // Cleanup automatico dopo TTL
    setTimeout(() => this.deleteShare(shareId), ttl);
  }
  
  /**
   * Recupera share
   */
  async getShare(shareId) {
    const share = await this.db.shares.get(shareId);
    if (!share) return null;
    
    if (Date.now() > share.expiresAt) {
      await this.deleteShare(shareId);
      return null;
    }
    
    return share.data;
  }
}
```

---

## 🔒 Sicurezza e Privacy

### Zero-Knowledge Garantito
- ✅ Dati sempre crittografati prima di qualsiasi condivisione
- ✅ Password mai nel QR code o link
- ✅ Server (se usato) vede solo blob cifrati
- ✅ Metadata minimale (solo necessario per funzionamento)

### Best Practices
1. **Password sempre separata**: Mai nel QR/link, comunicata via canale sicuro
2. **Checksum per integrità**: Verifica file non modificato
3. **TTL per share temporanei**: Auto-cleanup dopo scadenza
4. **Rate limiting locale**: Previene spam di share
5. **Audit log locale**: Traccia share generati (opzionale, privacy-preserving)

---

## 📊 Confronto Soluzioni

| Soluzione | Server Necessario? | Offline? | File Grandi? | Complessità |
|-----------|-------------------|----------|--------------|-------------|
| QR Embedded | ❌ No | ✅ Sì | ❌ No (<2KB) | 🟢 Bassa |
| QR + File Locale | ❌ No | ✅ Sì | ⚠️ Limitato | 🟢 Bassa |
| WebRTC Manuale | ❌ No | ⚠️ Parziale | ✅ Sì | 🟡 Media |
| IPFS Locale | ❌ No | ⚠️ Parziale | ✅ Sì | 🔴 Alta |

---

## 🎯 Conclusione

**Per un'app local-first come Privacy Notes, raccomando:**

1. **Default**: QR Code con dati embedded (note piccole) o file locale (note medie)
2. **Avanzato**: WebRTC P2P con signaling manuale (note grandi, utenti tecnici)
3. **Nessun server necessario**: Tutto funziona localmente
4. **Utente controlla canale**: Email, cloud, USB, etc. - scelta dell'utente

**Il "link temporaneo" diventa:**
- QR code con dati embedded (per note piccole)
- QR code con metadata + file condiviso via canale utente (per note medie)
- WebRTC P2P con signaling manuale (per note grandi)

**Zero server, massima privacy, completamente local-first!** 🎉





