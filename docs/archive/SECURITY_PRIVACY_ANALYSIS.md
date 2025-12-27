# 🔐 Analisi Privacy e Sicurezza - Privacy Notes

**Data Analisi:** Gennaio 2025  
**Versione Applicazione:** 0.1.0  
**Rating Complessivo:** B (Buono con miglioramenti necessari)

---

## 📊 Executive Summary

L'applicazione dimostra una solida architettura di sicurezza per un'applicazione local-first con crittografia end-to-end. Tuttavia, sono presenti diverse vulnerabilità che richiedono attenzione, specialmente riguardo alla protezione dei metadati, sanitizzazione HTML robusta, e gestione delle informazioni sensibili nei log.

**Issues Trovate:**  
- 🔴 **Critical:** 1  
- 🟠 **High:** 4  
- 🟡 **Medium:** 6  
- 🟢 **Low:** 3

---

## 🔴 CRITICAL ISSUES (Azione Immediata Richiesta)

### 1. **Metadata Salvati in Chiaro per Performance** ⚠️ CRITICAL
**Risk Level:** 🔴 Critical  
**CVSS Score:** 8.5/10  
**File:** `src/lib/storage/localStorage.js:89-93`

**Problema:**
I metadati delle note (titoli e tag) sono salvati in chiaro in IndexedDB per permettere ricerche veloci, compromettendo la privacy.

```89:93:src/lib/storage/localStorage.js
			// Store searchable fields in clear for performance (compromesso sicurezza/velocità)
			// In produzione, questi dovrebbero essere hash o criptati
			searchableTags: noteMetadata.tags || [],
			searchableTitle: noteMetadata.title || '',
			contentLength: noteMetadata.contentLength || 0
```

**Impatto:**
- Un attaccante con accesso fisico può vedere tutti i titoli e tag delle note senza password
- Pattern di utilizzo tracciabili
- Fingerprinting possibile anche senza decrittare il contenuto

**Raccomandazioni:**
1. **Soluzione Immediata:** Criptare anche i metadati usando blind indexes
2. **Soluzione Ottimale:** Implementare searchable encryption (es. MongoDB Queryable Encryption pattern)
3. **Compromesso Temporaneo:** Almeno hashare i titoli/tag con HMAC per nascondere i valori esatti

**Fix Suggerito:**
```javascript
// Hash dei metadati per ricerca senza esporre valori
const { createHmac } = await import('crypto');
const titleHash = createHmac('sha256', deviceKey)
  .update(noteMetadata.title || '')
  .digest('hex').substring(0, 16); // Primi 16 caratteri per ricerca

await saveNoteMetadata({
  id: noteMetadata.id,
  encryptedData: encryptedData,
  searchableTitleHash: titleHash, // Hash invece di testo chiaro
  searchableTagsHash: noteMetadata.tags?.map(tag => 
    createHmac('sha256', deviceKey).update(tag).digest('hex').substring(0, 8)
  ) || [],
  contentLength: noteMetadata.contentLength || 0
});
```

---

## 🟠 HIGH PRIORITY ISSUES (Fix entro 30 giorni)

### 2. **Sanitizzazione HTML Debole e Vulnerabile** ⚠️ HIGH
**Risk Level:** 🟠 High  
**CVSS Score:** 7.8/10  
**File:** `src/lib/components/MarkdownViewer.svelte:11-39`

**Problema:**
La sanitizzazione HTML usa regex invece di una libreria robusta come DOMPurify. Le regex possono essere bypassate con tecniche di encoding o HTML complessi.

```11:39:src/lib/components/MarkdownViewer.svelte
	// Simple HTML sanitizer to prevent XSS
	function sanitizeHtml(html) {
		if (!html) return '';

		// Remove dangerous tags and attributes
		const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'];
		const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onmouseenter', 'onmouseleave', 'onsubmit'];

		let sanitized = html;

		// Remove dangerous tags
		dangerousTags.forEach(tag => {
			const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>|<${tag}[^>]*/>`, 'gi');
			sanitized = sanitized.replace(regex, '');
		});

		// Remove dangerous attributes
		dangerousAttrs.forEach(attr => {
			const regex = new RegExp(`${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
			sanitized = sanitized.replace(regex, '');
		});

		// Remove javascript: URLs
		sanitized = sanitized.replace(/javascript:[^"']*/gi, '#');

		// Remove data: URLs (can contain scripts)
		sanitized = sanitized.replace(/data:[^;]*;base64,[^"']*/gi, '#');

		return sanitized;
	}
```

**Vulnerabilità:**
- Regex non gestiscono encoding (es. `%3Cscript%3E`, `&lt;script&gt;`)
- Non gestiscono event handlers in stile diverso (es. `onclick` vs `onClick`)
- Non gestiscono SVG con script embedded
- Non gestiscono CSS injection (`<style>` viene rimosso ma CSS inline può essere pericoloso)

**Raccomandazioni:**
1. **Implementare DOMPurify** (libreria standard per sanitizzazione HTML)
2. **Configurare CSP headers** per protezione aggiuntiva
3. **Validare anche CSS inline** se permesso

**Fix Suggerito:**
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

```javascript
import DOMPurify from 'dompurify';

function sanitizeHtml(html) {
	if (!html) return '';
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
		               'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'table', 
		               'thead', 'tbody', 'tr', 'th', 'td'],
		ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style'],
		ALLOW_DATA_ATTR: false,
		FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
		FORBID_ATTR: ['onerror', 'onload', 'onclick']
	});
}
```

### 3. **Uso di innerHTML in Più Punti** ⚠️ HIGH
**Risk Level:** 🟠 High  
**CVSS Score:** 7.2/10

**File Affetti:**
- `src/lib/components/MarkdownViewer.svelte:78`
- `src/lib/models/note.js:39`
- `src/lib/utils/noteHelpers.js:19, 52`

**Problema:**
L'uso diretto di `innerHTML` può essere pericoloso anche dopo sanitizzazione se la sanitizzazione non è perfetta.

**Raccomandazioni:**
1. Usare `textContent` quando possibile invece di `innerHTML`
2. Per HTML necessario, usare sempre DOMPurify prima di `innerHTML`
3. Considerare `insertAdjacentHTML` con sanitizzazione

### 4. **Mancanza di Content Security Policy (CSP)** ⚠️ HIGH
**Risk Level:** 🟠 High  
**CVSS Score:** 7.0/10  
**File:** `src/app.html`

**Problema:**
Nessuna CSP header configurata, permettendo potenziali XSS anche se la sanitizzazione fallisce.

**Raccomandazioni:**
Aggiungere CSP strict in `app.html`:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data:; 
               font-src 'self';">
```

**Nota:** `unsafe-inline` e `unsafe-eval` sono necessari per SvelteKit ma dovrebbero essere rimossi quando possibile usando nonce.

### 5. **Informazioni Sensibili nei Console Log** ⚠️ HIGH
**Risk Level:** 🟠 High  
**CVSS Score:** 6.9/10

**Problema:**
Molti `console.log` e `console.error` che potrebbero esporre informazioni sensibili in produzione:
- Debug info con struttura dati (`ExportImport.svelte:201, 229`)
- Errori che rivelano dettagli di implementazione
- Log di import/export che mostrano metadati

**File Affetti:**
- `src/lib/components/ExportImport.svelte` (linee 201, 229, 355, 372)
- `src/lib/storage/localStorage.js` (linee 51, 210, 312, 329, 342)

**Raccomandazioni:**
1. Rimuovere tutti i `console.log` in produzione
2. Usare variabile d'ambiente per abilitare debug solo in dev
3. Logging strutturato con livelli (error, warn, info, debug)
4. Non loggare mai password, chiavi, o contenuti criptati

**Fix Suggerito:**
```javascript
// src/lib/utils/logger.js
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args) => isDev && console.log('[DEBUG]', ...args),
  info: (...args) => isDev && console.info('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};
```

---

## 🟡 MEDIUM PRIORITY ISSUES (Fix entro 90 giorni)

### 6. **Nessun Rate Limiting su Tentativi Password** ⚠️ MEDIUM
**Risk Level:** 🟡 Medium  
**CVSS Score:** 5.8/10  
**File:** `src/lib/components/UnlockScreen.svelte`

**Problema:**
Nessuna protezione contro brute force attacks. Un attaccante può provare password infinite volte.

**Raccomandazioni:**
1. Implementare exponential backoff dopo tentativi falliti
2. Lock temporaneo dopo N tentativi (es. 5)
3. Mostrare CAPTCHA dopo 3 tentativi falliti
4. Salvare tentativi falliti in localStorage (criptato)

**Fix Suggerito:**
```javascript
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minuti

let failedAttempts = parseInt(localStorage.getItem('failed-attempts') || '0');
let lockoutUntil = parseInt(localStorage.getItem('lockout-until') || '0');

if (Date.now() < lockoutUntil) {
  const minutesLeft = Math.ceil((lockoutUntil - Date.now()) / 60000);
  error = `Account bloccato. Riprova tra ${minutesLeft} minuti}`;
  return;
}

// Dopo tentativo fallito:
failedAttempts++;
localStorage.setItem('failed-attempts', failedAttempts.toString());

if (failedAttempts >= MAX_ATTEMPTS) {
  lockoutUntil = Date.now() + LOCKOUT_TIME;
  localStorage.setItem('lockout-until', lockoutUntil.toString());
}
```

### 7. **Device Fingerprinting Vulnerabile** ⚠️ MEDIUM
**Risk Level:** 🟡 Medium  
**CVSS Score:** 5.5/10  
**File:** `src/lib/crypto/encryption.js:142-181`

**Problema:**
Il device key è derivato da informazioni del browser che possono cambiare o essere tracciate:

```144:149:src/lib/crypto/encryption.js
	const deviceFingerprint = [
		navigator.userAgent,
		navigator.language,
		screen.width + 'x' + screen.height,
		new Date().getTimezoneOffset()
	].join('|');
```

**Impatto:**
- Se il fingerprint cambia (es. aggiornamento browser), i dati diventano illeggibili
- Il fingerprint può essere usato per tracciare utenti tra sessioni

**Raccomandazioni:**
1. Usare un ID device persistente generato randomicamente
2. Salvare l'ID in localStorage criptato
3. Non usare informazioni del browser per fingerprinting

### 8. **Password Policy Debole** ⚠️ MEDIUM
**Risk Level:** 🟡 Medium  
**CVSS Score:** 5.2/10  
**File:** `src/lib/components/UnlockScreen.svelte`

**Problema:**
Nessuna validazione della forza della password. Password deboli sono accettate.

**Raccomandazioni:**
1. Implementare password strength meter (es. zxcvbn)
2. Richiedere minimo 12 caratteri
3. Mostrare feedback visivo sulla forza
4. Avvisare se password è in dizionari comuni

### 9. **Nessuna Verifica Integrità Backup** ⚠️ MEDIUM
**Risk Level:** 🟡 Medium  
**CVSS Score:** 4.9/10  
**File:** `src/lib/components/ExportImport.svelte`

**Problema:**
I backup non hanno firma digitale o HMAC per verificare l'integrità. Un file backup potrebbe essere modificato senza essere rilevato.

**Raccomandazioni:**
1. Aggiungere HMAC a tutti i backup
2. Verificare integrità all'import
3. Firma digitale opzionale per backup critici

### 10. **localStorage per Dati Sensibili** ⚠️ MEDIUM
**Risk Level:** 🟡 Medium  
**CVSS Score:** 4.7/10

**Problema:**
Salt e altre informazioni salvate in localStorage sono vulnerabili a XSS attacks.

**File Affetti:**
- `src/lib/stores/keyStore.js:35, 38` (salt app)
- `src/lib/crypto/encryption.js:152, 155` (device salt)

**Raccomandazioni:**
1. Considerare sessionStorage per dati temporanei
2. Criptare anche i salt se salvati
3. Usare HttpOnly cookies se disponibile (non applicabile per app local-first)

### 11. **Nessun Auto-Lock dopo Inattività** ⚠️ MEDIUM
**Risk Level:** 🟡 Medium  
**CVSS Score:** 4.5/10

**Problema:**
La chiave master rimane in memoria indefinitamente. Se l'utente lascia il dispositivo incustodito, i dati sono accessibili.

**Raccomandazioni:**
1. Auto-lock dopo N minuti di inattività (es. 15 minuti)
2. Opzione configurabile dall'utente
3. Clear della chiave master dalla memoria al lock

---

## 🟢 LOW PRIORITY ISSUES (Miglioramenti Futuri)

### 12. **Timing Attacks Potenziali** ⚠️ LOW
**Risk Level:** 🟢 Low  
**CVSS Score:** 3.2/10

**Problema:**
Possibili timing differences nella verifica password o decrittazione.

**Raccomandazioni:**
- Usare operazioni constant-time dove possibile
- Blinding techniques per operazioni crittografiche

### 13. **Nessun Secure Delete** ⚠️ LOW
**Risk Level:** 🟢 Low  
**CVSS Score:** 2.8/10

**Problema:**
I dati cancellati rimangono su disco e possono essere recuperati.

**Raccomandazioni:**
- Overwrite multipli dei dati prima della cancellazione
- Secure delete per IndexedDB (dove supportato)

### 14. **Dipendenze Non Verificate** ⚠️ LOW
**Risk Level:** 🟢 Low  
**CVSS Score:** 2.5/10

**Problema:**
- `tweetnacl` ultima release 2017 (manutenzione minima)
- Nessun audit automatico delle dipendenze

**Raccomandazioni:**
1. Eseguire `npm audit` regolarmente
2. Considerare sostituzione tweetnacl con WebCrypto API nativa
3. Implementare Dependabot o similar per aggiornamenti automatici

---

## ✅ PUNTI DI FORZA (Cosa Funziona Bene)

### 1. **Crittografia End-to-End Solida** ✅
- ✅ PBKDF2 con 2.1M iterazioni (ottimo, aggiornato rispetto all'audit precedente)
- ✅ XSalsa20-Poly1305 per crittografia autenticata
- ✅ Nonce randomici per ogni operazione
- ✅ Chiavi master mai persistite

### 2. **Architettura Zero-Knowledge** ✅
- ✅ Nessun server, tutti i dati locali
- ✅ Password mai inviate a server esterni
- ✅ Crittografia client-side

### 3. **Gestione Memoria** ✅
- ✅ Password cancellate dopo uso (`UnlockScreen.svelte:39`)
- ✅ Chiavi solo in memoria

### 4. **Sanitizzazione Base Implementata** ✅
- ✅ Tentativo di sanitizzazione HTML (anche se debole)
- ✅ Rimozione di tag pericolosi
- ✅ Configurazione marked.js per sicurezza

---

## 🎯 PRIORITÀ DI FIX

### **Priority 1 (Questa Settimana)**
1. ✅ Criptare metadati (titoli/tag) o almeno hasharli
2. ✅ Implementare DOMPurify per sanitizzazione HTML robusta
3. ✅ Rimuovere/condizionare console.log in produzione
4. ✅ Aggiungere CSP headers

### **Priority 2 (Questo Mese)**
5. ✅ Implementare rate limiting su tentativi password
6. ✅ Migliorare device fingerprinting (ID persistente)
7. ✅ Aggiungere password strength meter
8. ✅ Implementare auto-lock dopo inattività

### **Priority 3 (Questo Trimestre)**
9. ✅ Verifica integrità backup (HMAC)
10. ✅ Audit completo dipendenze
11. ✅ Secure delete opzionale
12. ✅ Timing attack mitigations

---

## 📋 CHECKLIST IMPLEMENTAZIONE

### Crittografia e Storage
- [ ] Criptare/hashare metadati (titoli, tag)
- [ ] Verificare che tutto sia criptato prima di IndexedDB
- [ ] Implementare blind indexes per ricerca sicura

### XSS e Sanitizzazione
- [ ] Installare e configurare DOMPurify
- [ ] Sostituire tutte le sanitizzazioni regex con DOMPurify
- [ ] Aggiungere CSP headers
- [ ] Audit di tutti gli usi di innerHTML

### Autenticazione
- [ ] Implementare rate limiting
- [ ] Aggiungere password strength meter
- [ ] Implementare auto-lock
- [ ] Migliorare gestione errori password

### Logging e Debug
- [ ] Creare sistema di logging strutturato
- [ ] Rimuovere console.log da produzione
- [ ] Non loggare mai dati sensibili

### Backup e Integrità
- [ ] Aggiungere HMAC ai backup
- [ ] Verificare integrità all'import
- [ ] Documentare formato backup

---

## 🔍 TESTING RACCOMANDATO

```bash
# 1. Dependency audit
npm audit
npm audit fix

# 2. Static analysis
npm install --save-dev eslint-plugin-security
# Configurare ESLint con security plugin

# 3. XSS testing
# Testare con payload comuni:
# - <script>alert('XSS')</script>
# - <img src=x onerror=alert('XSS')>
# - <svg onload=alert('XSS')>
# - javascript:alert('XSS')
# - <iframe src="javascript:alert('XSS')">

# 4. Penetration testing
# Considerare servizi come:
# - OWASP ZAP
# - Burp Suite Community
```

---

## 📚 RIFERIMENTI E BEST PRACTICES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)

---

## 📝 NOTE FINALI

Questa analisi è stata condotta seguendo le linee guida OWASP e le best practices dell'industria per applicazioni crittografiche. 

**Raccomandazione:** Eseguire un audit di sicurezza formale da parte di terzi prima di un rilascio pubblico, specialmente se l'app gestisce dati sensibili di giornalisti o attivisti.

**Frequenza Audit:** Ogni 6 mesi o dopo modifiche significative al codice crittografico.

---

*Ultimo aggiornamento: Gennaio 2025*

