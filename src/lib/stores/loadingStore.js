import { writable } from 'svelte/store';

/**
 * Store per gestire lo stato di loading durante il cambio nota
 * Impedisce click multipli e fornisce feedback visivo
 */
export const isLoadingNote = writable(false);
export const loadingMessage = writable('');

/**
 * Messaggi hacker/cyberpunk casuali per intrattenere l'utente durante il loading
 */
const hackerMessages = [
	'Decrypting neural pathways...',
	'Initializing quantum matrix...',
	'Bypassing security protocols...',
	'Accessing encrypted data streams...',
	'Syncing with mainframe...',
	'Establishing secure connection...',
	'Decrypting cipher...',
	'Loading quantum data...',
	'Hacking the matrix...',
	'Establishing neural link...',
	'Decrypting secure vault...',
	'Accessing encrypted memory banks...',
	'Bypassing firewall...',
	'Establishing quantum entanglement...',
	'Decrypting data packets...',
	'Initializing cyber interface...',
	'Accessing neural network...',
	'Decrypting quantum encryption...',
	'Establishing secure tunnel...',
	'Bypassing security layers...',
	'Initializing neural interface...',
	'Decrypting bio-metric lock...',
	'Accessing shadow network...',
	'Establishing quantum link...',
	'Bypassing encryption protocols...',
	'Decrypting secure channels...',
	'Initializing cyber-space connection...',
	'Accessing encrypted archives...',
	'Establishing neural pathways...',
	'Decrypting quantum vault...',
	'Bypassing digital barriers...',
	'Accessing secure data core...',
	'Initializing quantum decryption...',
	'Establishing cyber-link...',
	'Decrypting neural encryption...'
];

/**
 * Messaggi per il salvataggio
 */
const savingMessages = [
	'Encrypting data streams...',
	'Securing quantum matrix...',
	'Establishing secure backup...',
	'Encrypting neural pathways...',
	'Syncing with mainframe...',
	'Securing data vault...',
	'Encrypting quantum packets...',
	'Establishing secure connection...',
	'Backing up to secure server...',
	'Encrypting memory banks...',
	'Securing neural network...',
	'Encrypting data core...',
	'Establishing quantum backup...',
	'Securing encrypted channels...',
	'Backing up neural data...'
];

/**
 * Ottiene un messaggio casuale dalla lista
 */
function getRandomMessage(messages) {
	return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Helper per impostare lo stato di loading
 * @param {boolean} isLoading - Se true, mostra il loading
 * @param {string} message - Messaggio personalizzato (opzionale, se non fornito usa un messaggio casuale)
 * @param {string} type - Tipo di operazione: 'loading' o 'saving' (default: 'loading')
 */
export function setLoadingNote(isLoading, message = '', type = 'loading') {
	isLoadingNote.set(isLoading);
	
	if (isLoading) {
		// Se non è fornito un messaggio, usa uno casuale basato sul tipo
		if (!message) {
			message = type === 'saving' 
				? getRandomMessage(savingMessages)
				: getRandomMessage(hackerMessages);
		}
		loadingMessage.set(message);
	} else {
		loadingMessage.set('');
	}
}
