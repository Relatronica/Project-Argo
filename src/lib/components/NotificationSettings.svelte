<script>
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';
	import {
		getNotificationSettings,
		saveNotificationSettings,
		requestNotificationPermission,
		canShowNotifications,
		showNotification
	} from '../utils/notifications.js';
	
	let settings = getNotificationSettings();
	let permissionStatus = 'default';
	let requesting = false;
	
	onMount(() => {
		if (typeof Notification !== 'undefined') {
			permissionStatus = Notification.permission;
		}
	});
	
	async function handleRequestPermission() {
		requesting = true;
		const result = await requestNotificationPermission();
		permissionStatus = result;
		settings = getNotificationSettings();
		requesting = false;
		
		if (result === 'granted') {
			// Show test notification
			showNotification('✅ Notifications Enabled!', {
				body: 'You will now receive reminders for your notes',
				tag: 'test-notification'
			});
		}
	}
	
	function handleToggleSetting(key) {
		settings[key] = !settings[key];
		saveNotificationSettings(settings);
	}
	
	function handleDisable() {
		settings.enabled = false;
		saveNotificationSettings(settings);
	}
</script>

<div class="notification-settings">
	<div class="settings-header">
		<h3>
			<Icon name="bell" size={18} />
			Notification Settings
		</h3>
		<p class="settings-description">Get reminders for your scheduled notes and due dates</p>
	</div>
	
	<div class="settings-content">
		{#if typeof Notification === 'undefined'}
			<div class="unsupported-message">
				<Icon name="alertTriangle" size={20} />
				<p>Notifications are not supported in your browser</p>
			</div>
		{:else if permissionStatus === 'denied'}
			<div class="permission-denied">
				<Icon name="x-circle" size={20} />
				<p><strong>Notifications Blocked</strong></p>
				<p class="help-text">You have blocked notifications. To enable them, please allow notifications in your browser settings and refresh the page.</p>
			</div>
		{:else if permissionStatus === 'default'}
			<div class="permission-request">
				<Icon name="bell" size={32} />
				<p><strong>Enable Notifications</strong></p>
				<p class="help-text">Stay on top of your tasks with timely reminders for due dates and scheduled notes.</p>
				<button
					class="request-btn"
					on:click={handleRequestPermission}
					disabled={requesting}
				>
					{#if requesting}
						Requesting...
					{:else}
						<Icon name="bell" size={16} />
						Enable Notifications
					{/if}
				</button>
			</div>
		{:else}
			<!-- Notifications are granted -->
			<div class="settings-list">
				<div class="setting-item">
					<div class="setting-info">
						<div class="setting-title">
							<Icon name="bell" size={16} />
							Master Switch
						</div>
						<p class="setting-description">Enable or disable all notifications</p>
					</div>
					<label class="toggle-switch">
						<input
							type="checkbox"
							checked={settings.enabled}
							on:change={() => handleToggleSetting('enabled')}
						/>
						<span class="toggle-slider"></span>
					</label>
				</div>
				
				{#if settings.enabled}
					<div class="setting-item">
						<div class="setting-info">
							<div class="setting-title">
								<Icon name="alert-circle" size={16} />
								Due Date Reminders
							</div>
							<p class="setting-description">Notify when notes are due today or overdue</p>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								checked={settings.dueDateReminder}
								on:change={() => handleToggleSetting('dueDateReminder')}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>
					
					<div class="setting-item">
						<div class="setting-info">
							<div class="setting-title">
								<Icon name="clock" size={16} />
								Advance Notice
							</div>
							<p class="setting-description">Notify one day before due date</p>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								checked={settings.beforeDueDate}
								on:change={() => handleToggleSetting('beforeDueDate')}
								disabled={!settings.dueDateReminder}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>
					
					<div class="setting-item">
						<div class="setting-info">
							<div class="setting-title">
								<Icon name="calendar" size={16} />
								Scheduled Reminders
							</div>
							<p class="setting-description">Notify when notes are scheduled for today</p>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								checked={settings.scheduledReminder}
								on:change={() => handleToggleSetting('scheduledReminder')}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>
				{/if}
			</div>
			
			<div class="settings-footer">
				<p class="help-text">
					<Icon name="info" size={14} />
					Notifications are checked every hour when the app is open
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.notification-settings {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	
	.settings-header h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	
	.settings-description {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.5;
	}
	
	.settings-content {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 1.5rem;
	}
	
	.unsupported-message,
	.permission-denied,
	.permission-request {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1rem;
		padding: 2rem 1rem;
		color: var(--text-secondary);
	}
	
	.permission-denied {
		color: var(--error-color);
	}
	
	.help-text {
		font-size: 0.875rem;
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0;
	}
	
	.request-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: var(--radius);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: var(--transition);
		margin-top: 0.5rem;
	}
	
	.request-btn:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}
	
	.request-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}
	
	.settings-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.setting-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		transition: var(--transition);
	}
	
	.setting-item:hover {
		border-color: var(--accent-color);
		background: var(--bg-secondary);
	}
	
	.setting-info {
		flex: 1;
		min-width: 0;
	}
	
	.setting-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	
	.setting-description {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.4;
	}
	
	/* Toggle Switch */
	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
		flex-shrink: 0;
	}
	
	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}
	
	.toggle-slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: var(--bg-primary);
		border: 2px solid var(--border-color);
		transition: var(--transition);
		border-radius: 24px;
	}
	
	.toggle-slider:before {
		position: absolute;
		content: "";
		height: 16px;
		width: 16px;
		left: 2px;
		bottom: 2px;
		background-color: var(--text-secondary);
		transition: var(--transition);
		border-radius: 50%;
	}
	
	input:checked + .toggle-slider {
		background-color: var(--accent-color);
		border-color: var(--accent-color);
	}
	
	input:checked + .toggle-slider:before {
		transform: translateX(20px);
		background-color: white;
	}
	
	input:disabled + .toggle-slider {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.settings-footer {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}
	
	.settings-footer .help-text {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-muted);
	}
</style>

