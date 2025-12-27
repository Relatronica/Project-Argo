<script>
	import { onMount } from 'svelte';
	import { unlockWithPassword, keyError, isUnlocked } from '../stores/keyStore.js';
	import { masterKey, loadNotes } from '../stores/notesStore.js';
	import { initDB } from '../storage/localStorage.js';
	import { checkLockout, recordFailedAttempt, resetFailedAttempts, getRemainingAttempts } from '../utils/rateLimiter.js';
	import { checkPasswordStrength, getStrengthColor, getStrengthLabel } from '../utils/passwordStrength.js';
	import Icon from './Icon.svelte';

	const MAX_ATTEMPTS = 5;
	
	let password = '';
	let isLoading = false;
	let error = '';
	let attemptsRemaining = MAX_ATTEMPTS;
	let showPasswordStrength = false;
	let passwordStrength = { score: 0, strength: 'empty', feedback: [] };

	// Check lockout status on mount
	onMount(async () => {
		const lockoutStatus = await checkLockout();
		if (lockoutStatus.locked) {
			error = `Account locked. Please try again in ${lockoutStatus.minutesLeft} minute${lockoutStatus.minutesLeft > 1 ? 's' : ''}.`;
			attemptsRemaining = 0;
		} else {
			attemptsRemaining = await getRemainingAttempts();
		}
	});

	$: if ($keyError) {
		error = $keyError;
	}

	// Update password strength when password changes
	$: if (password && showPasswordStrength) {
		passwordStrength = checkPasswordStrength(password);
	} else if (!password) {
		passwordStrength = { score: 0, strength: 'empty', feedback: [] };
	}

	async function handleUnlock() {
		if (!password.trim()) {
			error = 'Password is required';
			return;
		}

		// Check if account is locked
		const lockoutStatus = await checkLockout();
		if (lockoutStatus.locked) {
			error = `Account locked. Please try again in ${lockoutStatus.minutesLeft} minute${lockoutStatus.minutesLeft > 1 ? 's' : ''}.`;
			return;
		}

		isLoading = true;
		error = '';

		try {
			// Initialize databases (both regular and secure storage)
			await initDB();
			const { initSecureStorage } = await import('../storage/secureStorage.js');
			await initSecureStorage();

			// Derive master key
			const key = await unlockWithPassword(password);

			// Set master key and unlock
			masterKey.set(key);
			isUnlocked.set(true);

			// Reset failed attempts on successful unlock
			await resetFailedAttempts();
			attemptsRemaining = MAX_ATTEMPTS;

			// Load notes
			await loadNotes();

			// Initialize auto-lock
			const { initializeAutoLock } = await import('../utils/autoLock.js');
			initializeAutoLock();

			// Clear password from memory
			password = '';
		} catch (err) {
			// Record failed attempt
			const attemptResult = await recordFailedAttempt();
			attemptsRemaining = attemptResult.attemptsRemaining;

			if (attemptResult.locked) {
				error = `Too many failed attempts. Account locked for ${attemptResult.minutesLeft} minutes.`;
			} else {
				error = err.message || 'Failed to unlock';
				if (attemptsRemaining > 0) {
					error += ` (${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining)`;
				}
			}
		} finally {
			isLoading = false;
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Enter') {
			handleUnlock();
		}
	}
</script>

<div class="unlock-screen">
	<div class="unlock-container">
		<div class="logo">
			<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
				<rect width="64" height="64" rx="12" fill="#4a9eff"/>
				<path d="M20 20h24v24H20z" fill="white" opacity="0.2"/>
				<path d="M32 16v32M16 32h32" stroke="white" stroke-width="3" stroke-linecap="round"/>
			</svg>
		</div>
		<h1>Privacy Notes</h1>
		<p class="subtitle">End-to-end encrypted note-taking</p>

		<form on:submit|preventDefault={handleUnlock} class="unlock-form">
			<input
				type="password"
				bind:value={password}
				on:keydown={handleKeydown}
				on:focus={() => showPasswordStrength = true}
				on:blur={() => {
					// Keep showing if there's an error or if password is being entered
					if (!error && !password) {
						showPasswordStrength = false;
					}
				}}
				placeholder="Enter your password"
				class="password-input"
				disabled={isLoading}
				autofocus
			/>

			{#if showPasswordStrength && password}
				<div class="password-strength">
					<div class="strength-bar-container">
						<div 
							class="strength-bar"
							style="width: {passwordStrength.score}%; background-color: {getStrengthColor(passwordStrength.strength)}"
						></div>
					</div>
					<div class="strength-info">
						<span class="strength-label" style="color: {getStrengthColor(passwordStrength.strength)}">
							{getStrengthLabel(passwordStrength.strength)}
						</span>
						<span class="strength-score">{passwordStrength.score}/100</span>
					</div>
					{#if passwordStrength.feedback.length > 0}
						<ul class="strength-feedback">
							{#each passwordStrength.feedback as item}
								<li>{item}</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}

			{#if error}
				<div class="error">{error}</div>
			{/if}

			{#if attemptsRemaining > 0 && attemptsRemaining < MAX_ATTEMPTS}
				<div class="warning">
					<Icon name="alertTriangle" size={14} />
					{attemptsRemaining} attempt{attemptsRemaining > 1 ? 's' : ''} remaining before lockout
				</div>
			{/if}

			<button type="submit" class="unlock-btn" disabled={isLoading || !password.trim()}>
				{isLoading ? 'Unlocking...' : 'Unlock'}
			</button>
		</form>

		<div class="info">
			<p><Icon name="lock" size={16} /> Your notes are encrypted locally</p>
			<p><Icon name="key" size={16} /> Your password is never sent to any server</p>
			<p><Icon name="hardDrive" size={16} /> All data stays on your device</p>
		</div>
	</div>
</div>

<style>
	.unlock-screen {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
	}

	.unlock-container {
		width: 100%;
		max-width: 400px;
		padding: 2rem;
		text-align: center;
	}

	.logo {
		margin-bottom: 1.5rem;
		display: flex;
		justify-content: center;
	}

	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary, #fff);
	}

	.subtitle {
		margin: 0 0 2rem 0;
		color: var(--text-secondary, #999);
		font-size: 0.9rem;
	}

	.unlock-form {
		margin-bottom: 2rem;
	}

	.password-input {
		width: 100%;
		padding: 1rem;
		background: var(--input-bg, #2a2a2a);
		border: 2px solid var(--border-color, #333);
		border-radius: 8px;
		color: var(--text-primary, #fff);
		font-size: 1rem;
		margin-bottom: 1rem;
		box-sizing: border-box;
	}

	.password-input:focus {
		outline: none;
		border-color: var(--accent-color, #4a9eff);
	}

	.password-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error {
		color: #ff6b6b;
		font-size: 0.9rem;
		margin-bottom: 1rem;
		text-align: left;
	}

	.warning {
		color: #ffa500;
		font-size: 0.85rem;
		margin-bottom: 1rem;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.password-strength {
		margin-top: 0.75rem;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: var(--bg-tertiary, #2a2a2a);
		border-radius: 6px;
		border: 1px solid var(--border-color, #333);
	}

	.strength-bar-container {
		width: 100%;
		height: 4px;
		background: var(--bg-secondary, #1a1a1a);
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.strength-bar {
		height: 100%;
		transition: width 0.3s ease, background-color 0.3s ease;
		border-radius: 2px;
	}

	.strength-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.strength-label {
		font-weight: 600;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.strength-score {
		font-size: 0.75rem;
		color: var(--text-secondary, #999);
	}

	.strength-feedback {
		margin: 0.5rem 0 0 0;
		padding-left: 1.2rem;
		font-size: 0.8rem;
		color: var(--text-secondary, #999);
		list-style: disc;
	}

	.strength-feedback li {
		margin: 0.25rem 0;
		line-height: 1.4;
	}

	.unlock-btn {
		width: 100%;
		padding: 1rem;
		background: var(--accent-color, #4a9eff);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.unlock-btn:hover:not(:disabled) {
		background: var(--accent-hover, #5aaaff);
	}

	.unlock-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.info {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 1px solid var(--border-color, #333);
	}

	.info p {
		margin: 0.5rem 0;
		color: var(--text-secondary, #999);
		font-size: 0.85rem;
	}
</style>

