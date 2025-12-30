# Analisi: Collaborazione Multi-Utente Privacy-First

## 🎯 Obiettivo

Implementare collaborazione multi-utente su note condivise mantenendo:
- ✅ **Zero-Knowledge**: Server non può leggere contenuti
- ✅ **End-to-End Encryption**: Dati crittografati prima di lasciare dispositivo
- ✅ **Local-First**: Funziona offline, sync opzionale
- ✅ **Privacy**: Nessun metadata esposto non necessario

---

## 🔐 Sfide Critiche

### 1. **Key Management Condiviso**

**Problema**: Ogni utente ha la propria master key (derivata da password). Come condividere una nota senza condividere la password?

**Soluzioni**:

#### A. **Shared Note Keys** (Raccomandato)
```
1. Nota collaborativa ha chiave dedicata (sharedKey)
2. SharedKey crittografata con master key di ogni collaboratore
3. Ogni utente può decriptare sharedKey con la propria master key
4. Nota crittografata con sharedKey (non master key)
```

**Vantaggi**:
- ✅ Revoca accesso facile (rimuovi encrypted sharedKey)
- ✅ Ogni utente mantiene privacy (master key mai condivisa)
- ✅ Forward secrecy (se cambia sharedKey, vecchi accessi non funzionano)

**Implementazione**:
```javascript
// Creazione nota collaborativa
const sharedKey = generateRandomKey(); // 32 bytes
const noteEncrypted = encryptNote(noteContent, sharedKey);

// Condividi con utente B
const userBPublicKey = await getUserPublicKey(userBId);
const encryptedSharedKey = await encrypt(sharedKey, userBPublicKey);

// Salva nel database condiviso
await saveSharedNote({
  noteId: noteId,
  encryptedContent: noteEncrypted,
  sharedKeys: [
    { userId: currentUserId, encryptedKey: encryptedWithMyKey },
    { userId: userBId, encryptedKey: encryptedSharedKey }
  ]
});
```

#### B. **Password Condivisa** (Semplice ma Meno Sicuro)
```
1. Utente A crea nota con password condivisa
2. Condivide password via canale sicuro (Signal, etc.)
3. Utente B importa nota con stessa password
```

**Svantaggi**:
- ❌ Password condivisa = vulnerabilità
- ❌ Revoca accesso difficile
- ❌ Non scalabile

---

### 2. **Sincronizzazione in Tempo Reale**

**Problema**: Come sincronizzare modifiche tra più utenti senza server che vede contenuti?

**Soluzioni**:

#### A. **Operational Transform (OT) / CRDT** (Raccomandato)
```
1. Modifiche come operazioni (insert, delete, format)
2. Operazioni crittografate prima di invio
3. Server vede solo operazioni cifrate
4. Client decripta e applica operazioni localmente
5. Conflict resolution automatica (CRDT) o manuale (OT)
```

**Vantaggi**:
- ✅ Zero-knowledge (operazioni cifrate)
- ✅ Sincronizzazione real-time
- ✅ Conflict resolution automatica (CRDT)

**Implementazione**:
```javascript
// Modifica locale
const operation = {
  type: 'insert',
  position: 10,
  text: 'new text',
  timestamp: Date.now(),
  userId: currentUserId
};

// Crittografa operazione
const encryptedOp = await encryptOperation(operation, sharedKey);

// Invia a server (solo blob cifrato)
await syncService.sendOperation(noteId, encryptedOp);

// Server distribuisce a altri client
// Client riceve → decripta → applica localmente
```

#### B. **Merge su Save** (Più Semplice)
```
1. Utente A modifica → salva → upload blob cifrato
2. Utente B modifica → salva → upload blob cifrato
3. Conflict detection: timestamp/version
4. Merge manuale o automatico lato client
```

**Svantaggi**:
- ⚠️ Non real-time (solo su save)
- ⚠️ Conflict resolution più complessa
- ⚠️ Possibili perdite di modifiche

---

### 3. **Autenticazione e Autorizzazione**

**Problema**: Come autenticare utenti senza server che conosce identità?

**Soluzioni**:

#### A. **Public Key Cryptography** (Raccomandato)
```
1. Ogni utente ha coppia chiavi (privata/pubblica)
2. Chiave privata derivata da password (mai condivisa)
3. Chiave pubblica condivisa per identificazione
4. Firma digitale per autenticazione
```

**Implementazione**:
```javascript
// Generazione chiavi utente
const keyPair = await generateKeyPair(); // Ed25519
const privateKey = await encrypt(keyPair.privateKey, masterKey);
const publicKey = keyPair.publicKey; // Pubblica, può essere condivisa

// Autenticazione
const signature = await sign(message, privateKey);
const isValid = await verify(signature, message, publicKey);
```

#### B. **Token-Based con Zero-Knowledge**
```
1. Server genera token opaco (non sa chi è utente)
2. Token crittografato con chiave utente
3. Server vede solo token, non identità
```

---

## 🏗️ Architetture Proposte

### Architettura 1: **P2P WebRTC con Signaling Manuale** (Massima Privacy)

**Come funziona**:
```
1. Utente A crea "room" collaborativa → Genera QR code
2. Utente B scansiona QR → Connessione P2P stabilita
3. Modifiche sincronizzate direttamente P2P
4. Zero server necessario
```

**Vantaggi**:
- ✅ Zero server (massima privacy)
- ✅ Dati passano direttamente tra utenti
- ✅ Funziona offline (dopo connessione iniziale)

**Svantaggi**:
- ⚠️ Richiede entrambi online simultaneamente
- ⚠️ Signaling manuale (QR code)
- ⚠️ NAT traversal può fallire (serve TURN server opzionale)

**Implementazione**:
```javascript
// Utente A (host)
const room = new CollaborationRoom({
  noteId: noteId,
  sharedKey: sharedKey
});

const qrCode = await room.generateInviteQR();
// QR contiene: offer WebRTC + noteId + encrypted sharedKey

// Utente B (guest)
const room = await CollaborationRoom.joinFromQR(qrCode);
// Decripta sharedKey con propria master key
// Connessione P2P stabilita
// Sync operazioni in tempo reale
```

---

### Architettura 2: **Server Zero-Knowledge con Self-Hosting** (Bilanciata)

**Come funziona**:
```
1. Server self-hosted (utente controlla)
2. Server = "dumb storage" (solo blob cifrati)
3. Client crittografa tutto prima di upload
4. Sync real-time via WebSocket (dati cifrati)
```

**Vantaggi**:
- ✅ Funziona anche se utenti non online simultaneamente
- ✅ Self-hosted (utente controlla server)
- ✅ Zero-knowledge (server non può leggere)
- ✅ Scalabile

**Svantaggi**:
- ⚠️ Richiede server (anche se self-hosted)
- ⚠️ Setup più complesso

**Implementazione**:
```javascript
// Client
const syncService = new ZeroKnowledgeSync({
  serverUrl: 'https://my-server.com',
  userId: currentUserId,
  masterKey: masterKey
});

// Modifica nota
const operation = createOperation('insert', position, text);
const encryptedOp = await encryptOperation(operation, sharedKey);

// Upload (server vede solo blob cifrato)
await syncService.sendOperation(noteId, encryptedOp);

// Server distribuisce ad altri client
// Altri client ricevono → decriptano → applicano
```

**Server (minimale)**:
```go
// Solo storage, zero logica business
type Server struct {
    db *sql.DB // Solo blob cifrati
}

func (s *Server) HandleOperation(noteId, encryptedOp []byte) {
    // Salva blob cifrato
    s.db.Save(noteId, encryptedOp)
    
    // Notifica altri client (via WebSocket)
    s.broadcast(noteId, encryptedOp) // Blob cifrato
}
```

---

### Architettura 3: **IPFS P2P** (Decentralizzata)

**Come funziona**:
```
1. Note pubblicate su IPFS (rete P2P)
2. Accesso controllato via chiavi crittografiche
3. Modifiche come "commit" su IPFS
4. Client sincronizza da IPFS
```

**Vantaggi**:
- ✅ Completamente decentralizzato
- ✅ Nessun server centrale
- ✅ Resiliente (rete distribuita)

**Svantaggi**:
- ⚠️ IPFS pubblico può loggare accessi (privacy concern)
- ⚠️ Più complesso da implementare
- ⚠️ Performance variabile

---

## 🔑 Key Management per Collaborazione

### Modello: **Shared Note Keys con Encrypted Key Exchange**

```javascript
/**
 * Gestione chiavi per note collaborative
 */

class CollaborativeNote {
  constructor(noteId, sharedKey) {
    this.noteId = noteId;
    this.sharedKey = sharedKey; // Chiave condivisa per nota
    this.participants = new Map(); // userId -> encryptedSharedKey
  }
  
  /**
   * Aggiungi collaboratore
   */
  async addParticipant(userId, userPublicKey) {
    // Crittografa sharedKey con chiave pubblica utente
    const encryptedKey = await encrypt(this.sharedKey, userPublicKey);
    
    this.participants.set(userId, {
      publicKey: userPublicKey,
      encryptedSharedKey: encryptedKey,
      addedAt: Date.now()
    });
  }
  
  /**
   * Rimuovi collaboratore (revoca accesso)
   */
  async removeParticipant(userId) {
    // Rimuovi encrypted key
    this.participants.delete(userId);
    
    // Opzionale: Rigenera sharedKey (forward secrecy)
    await this.rotateSharedKey();
  }
  
  /**
   * Rotazione chiave (forward secrecy)
   */
  async rotateSharedKey() {
    const newSharedKey = generateRandomKey();
    
    // Ricripta nota con nuova chiave
    const oldContent = await this.decrypt();
    const newEncrypted = await encrypt(oldContent, newSharedKey);
    
    // Ricripta nuova chiave per tutti i partecipanti
    for (const [userId, data] of this.participants) {
      const encryptedKey = await encrypt(newSharedKey, data.publicKey);
      this.participants.set(userId, {
        ...data,
        encryptedSharedKey: encryptedKey
      });
    }
    
    this.sharedKey = newSharedKey;
  }
  
  /**
   * Ottieni sharedKey (per utente corrente)
   */
  async getSharedKeyForUser(userId, userPrivateKey) {
    const participant = this.participants.get(userId);
    if (!participant) throw new Error('Not a participant');
    
    // Decripta sharedKey con chiave privata
    return await decrypt(participant.encryptedSharedKey, userPrivateKey);
  }
}
```

---

## 📊 Confronto Architetture

| Architettura | Privacy | Server | Real-Time | Offline | Complessità |
|--------------|---------|--------|-----------|---------|-------------|
| **P2P WebRTC** | 🟢 Massima | ❌ No | ✅ Sì | ⚠️ Parziale | 🟡 Media |
| **Server Zero-Knowledge** | 🟢 Alta | ✅ Self-hosted | ✅ Sì | ✅ Sì | 🟡 Media |
| **IPFS P2P** | 🟡 Media | ❌ No | ⚠️ Quasi | ✅ Sì | 🔴 Alta |
| **Password Condivisa** | 🔴 Bassa | ❌ No | ❌ No | ✅ Sì | 🟢 Bassa |

---

## 🏆 Raccomandazione: Architettura Ibrida

### Per Collaborazione Occasionale (2-3 persone)
**P2P WebRTC con Signaling Manuale**
- Massima privacy
- Zero server
- Facile da usare (QR code)

### Per Collaborazione Regolare (Team)
**Server Zero-Knowledge Self-Hosted**
- Funziona anche offline
- Scalabile
- Self-hosted (controllo utente)

### Implementazione Graduale

**Fase 1: P2P Base**
1. Shared note keys
2. WebRTC P2P con signaling manuale
3. Sync operazioni base

**Fase 2: Server Opzionale**
1. Server zero-knowledge self-hosted
2. Sync real-time via WebSocket
3. Conflict resolution (CRDT)

**Fase 3: Avanzato**
1. IPFS opzionale
2. Multi-device sync
3. Versioning e history

---

## 🔒 Sicurezza e Privacy

### Best Practices

1. **Forward Secrecy**
   - Rotazione chiavi periodica
   - Vecchi accessi non funzionano dopo revoca

2. **Zero-Knowledge Server**
   - Server vede solo blob cifrati
   - Nessun metadata esposto
   - Autenticazione via chiavi pubbliche

3. **Operational Security**
   - Operazioni crittografate individualmente
   - Timestamp e firma per integrità
   - Rate limiting locale

4. **Access Control**
   - Revoca accesso immediata
   - Permessi granulari (read/write)
   - Audit log locale (opzionale)

---

## 🛠️ Implementazione Tecnica

### Componenti Necessari

1. **`collaborationService.js`**
   - Gestione room collaborative
   - WebRTC P2P
   - Sync operazioni

2. **`sharedKeyManager.js`**
   - Gestione chiavi condivise
   - Key exchange
   - Rotazione chiavi

3. **`operationSync.js`**
   - Operational Transform / CRDT
   - Conflict resolution
   - Versioning

4. **`crypto/collaboration.js`**
   - Public key cryptography (Ed25519)
   - Encrypted key exchange
   - Firma digitale

### Dipendenze

```json
{
  "simple-peer": "^9.11.1",      // WebRTC P2P
  "yjs": "^13.5.0",              // CRDT per sync (opzionale)
  "libsodium-wrappers": "^0.7.11" // Ed25519 per chiavi pubbliche
}
```

---

## 📝 Esempio Flusso Completo

### Scenario: Utente A condivide nota con Utente B

```
1. Utente A crea nota collaborativa
   → Genera sharedKey
   → Crittografa nota con sharedKey
   → Salva localmente

2. Utente A invita Utente B
   → Ottiene publicKey di B (via canale sicuro o QR)
   → Crittografa sharedKey con publicKey di B
   → Crea "invite" con encrypted sharedKey

3. Utente B accetta invito
   → Decripta sharedKey con propria privateKey
   → Ora può leggere/scrivere nota

4. Modifiche sincronizzate
   → Utente A modifica → operazione crittografata → inviata
   → Utente B riceve → decripta → applica localmente
   → Viceversa per modifiche di B

5. Revoca accesso (se necessario)
   → Utente A rimuove B
   → Rotazione sharedKey (opzionale)
   → B non può più accedere
```

---

## 🎯 Conclusione

**Per Privacy Notes, raccomando:**

1. **Default**: P2P WebRTC per collaborazione occasionale
2. **Opzionale**: Server zero-knowledge self-hosted per team
3. **Key Management**: Shared note keys con encrypted key exchange
4. **Sync**: CRDT per conflict resolution automatica
5. **Privacy**: Zero-knowledge sempre, anche in collaborazione

**Principi fondamentali:**
- ✅ Zero-knowledge: server non può leggere
- ✅ End-to-end: crittografia prima di lasciare dispositivo
- ✅ Local-first: funziona offline
- ✅ Self-hosted: utente controlla server (se usato)

---

*Documento creato: 2025-01-XX*
*Versione: 1.0*
*Focus: Collaborazione multi-utente privacy-first*

