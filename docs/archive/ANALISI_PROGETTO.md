# Analisi Progetto: Privacy-First Note-Taking per Giornalisti

## 🎯 Visione del Prodotto

Una piattaforma di note-taking **radicalmente privacy-first** che combina:
- La semplicità di un editor markdown
- La sicurezza crittografica di Signal
- La filosofia local-first di Obsidian
- L'usabilità di Notion (senza il bloat)

**Target primario**: Giornalisti, investigatori, attivisti che necessitano di protezione delle fonti e dati sensibili.

---

## 🔒 Requisiti Core: Privacy-First

### 1. Crittografia End-to-End Vera
**Sfida**: Implementare E2EE senza compromessi

**Soluzione tecnica**:
- **Libreria**: `libsodium` (NaCl) o `tweetnacl-js` per browser
- **Algoritmi**: 
  - XChaCha20-Poly1305 per cifratura simmetrica
  - Argon2id per derivazione chiavi
  - Ed25519 per firme digitali
- **Key Management**:
  - Chiave master derivata da password (PBKDF2/Argon2)
  - Chiavi per documento generate da master + salt
  - Zero accesso server alle chiavi

**Implementazione**:
```javascript
// Tutti i dati cifrati lato client PRIMA del sync
- Note: cifrate con chiave documento
- Metadati: cifrati separatamente
- Indici: solo hash (non plaintext)
```

### 2. Zero-Knowledge Sync
**Sfida**: Server non deve mai vedere contenuti in chiaro

**Architettura**:
- Server = "dumb storage" (solo blob cifrati)
- Client = tutta la logica di cifratura/decifratura
- Zero plaintext in transit o at rest sul server
- Verifica: server può essere open source e auditabile

**Stack suggerito**:
- **Backend**: Go/Rust (performance + sicurezza) o Node.js (velocità sviluppo)
- **Storage**: SQLite locale + sync opzionale a S3-compatible o self-hosted
- **Protocollo sync**: Custom con autenticazione basata su chiavi

### 3. Self-Hosting Facile
**Sfida**: Rendere self-hosting accessibile a non-tecnici

**Soluzione**:
- **Docker Compose** one-click deploy
- **Script di setup** automatizzato
- **Documentazione** step-by-step
- **Alternative**: Sync P2P (WebRTC) per evitare server

**Componenti**:
```
docker-compose.yml
├── app (webapp)
├── sync-server (opzionale, solo storage cifrato)
└── nginx (reverse proxy)
```

### 4. Open Source Verificabile
**Sfida**: Garantire che il codice pubblico = codice in produzione

**Strategia**:
- Build riproducibili (reproducible builds)
- Audit regolari da community
- Transparency log per releases
- Licenza: AGPL v3 (forza open source per modifiche)

---

## 💾 Local-First Architecture

### Filosofia
1. **Default**: Tutto salvato localmente (IndexedDB/File System API)
2. **Sync**: Opzionale, asincrono, non-blocking
3. **Offline-first**: App funziona senza connessione
4. **Nessun lock-in**: Esporta tutto in markdown plain text

### Stack Tecnologico

#### Frontend
- **Framework**: 
  - **SvelteKit** (leggero, veloce, minimalista) OPPURE
  - **Vanilla JS + Web Components** (zero dependencies)
- **Editor**: 
  - **CodeMirror 6** (markdown editing avanzato) OPPURE
  - **ProseMirror** (più potente, più pesante)
- **Storage locale**: 
  - **IndexedDB** (browser) per metadata
  - **File System Access API** (Chrome/Edge) per file markdown
  - **Fallback**: Download automatico file .md

#### Backend (opzionale, solo per sync)
- **Minimal server**: Solo API REST per upload/download blob cifrati
- **Nessuna logica business**: Tutto lato client
- **Stack**: 
  - Go + Gin (leggero, veloce)
  - OPPURE Node.js + Express (più semplice)

#### Sync P2P (alternativa)
- **WebRTC** per connessione diretta tra dispositivi
- **WebTorrent** per distribuzione peer-to-peer
- **Nessun server centrale**: Completamente decentralizzato

### Struttura Dati Locale

```
~/.notes-app/
├── notes/
│   ├── 2024-01-15-intervista.md
│   ├── 2024-01-20-fonte-anonima.md
│   └── ...
├── .encrypted/
│   ├── sync-blobs/ (solo se sync abilitato)
│   └── keys/ (chiavi cifrate)
└── .index.db (SQLite locale per ricerca)
```

**Formato Note**:
```markdown
---
id: uuid-v4
created: 2024-01-15T10:30:00Z
encrypted: true
tags: [giornalismo, fonte-protetta]
---

# Intervista con Fonte

Contenuto della nota...
```

---

## 🎨 Minimalismo Ossessivo

### Principi di Design

1. **Zero Bloat**
   - Nessuna feature "nice-to-have"
   - Solo: scrivere, linkare, cercare
   - No templates, no widgets, no integrations

2. **Performance**
   - Caricamento < 100ms
   - Zero lag durante digitazione
   - Bundle size < 100KB (gzipped)

3. **UI Minimalista**
   - Editor a schermo intero (distraction-free)
   - Sidebar opzionale (nascondibile)
   - Dark mode by default (per giornalisti notturni)
   - Tema chiaro opzionale

### Feature Set Minimale

**✅ Include**:
- Editor markdown con preview
- Ricerca full-text locale
- Link tra note (wiki-style)
- Tag semplici
- Esportazione markdown
- Cifratura automatica

**❌ Esclude**:
- Rich text editor (solo markdown)
- Collaborazione real-time (troppo complesso, privacy risk)
- Plugin/estensioni (almeno v1)
- Calendari, tabelle complesse
- Media embedding (solo link)
- Versioning UI (backup automatico silenzioso)

---

## 🏗️ Architettura Proposta

### Componenti Principali

```
┌─────────────────────────────────────┐
│         Web App (Browser)           │
│  ┌───────────────────────────────┐ │
│  │   Editor (CodeMirror)          │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │   Crypto Engine (libsodium)    │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │   Local Storage (IndexedDB)    │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │   File System (FS Access API)  │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
           │ (opzionale)
           ▼
┌─────────────────────────────────────┐
│      Sync Server (Self-hosted)      │
│  ┌───────────────────────────────┐ │
│  │   Storage (S3/SQLite)          │ │
│  │   Solo blob cifrati            │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Flusso Dati

1. **Scrittura**:
   ```
   User digita → Salva locale (IndexedDB) → Cifra → Salva file .md
   ```

2. **Sync (se abilitato)**:
   ```
   Cifra nota → Upload blob → Server salva (zero access)
   ```

3. **Lettura**:
   ```
   Carica da locale → Decifra → Mostra in editor
   ```

4. **Ricerca**:
   ```
   Indice locale (hash di keywords) → Match → Decifra risultati
   ```

---

## 🔐 Modello di Sicurezza

### Threat Model

**Protezione da**:
- ✅ Server compromesso (zero-knowledge)
- ✅ Man-in-the-middle (TLS + E2EE)
- ✅ Accesso fisico dispositivo (chiave master protetta)
- ✅ Backup cloud non autorizzati (tutto cifrato)

**Non protegge da**:
- ❌ Keylogger (mitigazione: password manager)
- ❌ Dispositivo compromesso (OS-level)
- ❌ Attacchi timing (ricerca può leak metadata)

### Implementazione Crittografica

**Chiave Master**:
```javascript
masterKey = Argon2id(password, salt, {
  memoryCost: 65536,  // 64 MB
  timeCost: 3,
  parallelism: 4
})
```

**Cifratura Nota**:
```javascript
nonce = randomBytes(24)
ciphertext = XChaCha20Poly1305.encrypt(
  plaintext,
  key = deriveKey(masterKey, noteId),
  nonce
)
```

**Metadati Minimi**:
- Solo: ID, timestamp, size (in bytes)
- NO: titolo, tags, contenuto (tutto cifrato)

---

## 📊 Confronto con Competitors

| Feature | Notion | Obsidian | **Questo Progetto** |
|---------|--------|----------|---------------------|
| Privacy | ❌ Cloud, no E2EE | ⚠️ Sync opzionale | ✅ E2EE, zero-knowledge |
| Local-first | ❌ | ✅ | ✅ |
| Self-hosting | ❌ | ⚠️ Plugin | ✅ Nativo |
| Open source | ❌ | ⚠️ Core closed | ✅ 100% |
| Minimalismo | ❌ Bloat | ⚠️ Plugin ecosystem | ✅ Zero bloat |
| Usabilità | ✅ | ⚠️ Geeky | ✅ Semplice |
| Performance | ❌ Lento | ✅ Veloce | ✅ Velocissimo |
| Offline | ❌ | ✅ | ✅ |

---

## 🚀 Roadmap Sviluppo

### Fase 1: MVP (2-3 mesi)
- [ ] Editor markdown locale
- [ ] Salvataggio file .md su disco
- [ ] Cifratura base (XChaCha20)
- [ ] Ricerca locale
- [ ] UI minimalista

### Fase 2: Sync (1-2 mesi)
- [ ] Server sync self-hosted
- [ ] Zero-knowledge sync
- [ ] Multi-device support
- [ ] Conflict resolution

### Fase 3: P2P (opzionale, 2-3 mesi)
- [ ] WebRTC sync
- [ ] WebTorrent backup
- [ ] Nessun server necessario

### Fase 4: Polish (1 mese)
- [ ] Audit sicurezza
- [ ] Documentazione
- [ ] Docker setup
- [ ] Release v1.0

---

## 🛠️ Stack Tecnologico Raccomandato

### Frontend
- **SvelteKit** (framework minimalista)
- **CodeMirror 6** (editor)
- **tweetnacl-js** (crittografia)
- **Vite** (build tool)

### Backend (opzionale)
- **Go + Gin** (server leggero)
- **SQLite** (storage semplice)
- **Docker** (containerizzazione)

### DevOps
- **Docker Compose** (deploy facile)
- **GitHub Actions** (CI/CD)
- **Semantic Versioning** (releases)

---

## 💡 Considerazioni Aggiuntive

### Giornalismo-Specific Features

1. **Source Protection**:
   - Note cifrate per default
   - Possibilità di "note super-protette" (chiave separata)
   - Auto-delete opzionale dopo X giorni

2. **Verificabilità**:
   - Timestamp verificabili (blockchain opzionale?)
   - Firma digitale per integrità
   - Export per archivio permanente

3. **Workflow**:
   - Template rapidi per interviste
   - Tag sistema per fonti
   - Link tra note per storie

### Sfide Tecniche

1. **Ricerca su dati cifrati**:
   - Soluzione: Indice locale con hash
   - Trade-off: Server non può cercare (by design)

2. **Conflict Resolution**:
   - Last-write-wins con timestamp
   - O merge manuale (markdown è mergeable)

3. **Performance cifratura**:
   - Web Workers per non bloccare UI
   - Chunking per file grandi

4. **Browser Compatibility**:
   - File System API solo Chrome/Edge
   - Fallback: Download manuale

---

## ✅ Conclusione

**Punti di Forza**:
- ✅ Differenziazione chiara (privacy-first)
- ✅ Target specifico (giornalisti) = marketing focused
- ✅ Tecnologia matura (E2EE, local-first)
- ✅ Allineato con trend privacy

**Rischi**:
- ⚠️ Usabilità vs sicurezza (trade-off)
- ⚠️ Onboarding curva (chiavi, backup)
- ⚠️ Market size (niche)

**Raccomandazione**: 
Progetto **fattibile e valido**. Inizia con MVP locale, aggiungi sync dopo. Focus su UX per rendere la sicurezza "invisibile" all'utente.

---

## 📚 Risorse

- [Local-First Software](https://www.inkandswitch.com/local-first/)
- [Zero-Knowledge Architecture](https://proton.me/blog/zero-knowledge-encryption)
- [libsodium Documentation](https://doc.libsodium.org/)
- [CodeMirror 6](https://codemirror.net/)

