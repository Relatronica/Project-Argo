<script>
	import { organizationPreferences, toggleCompactView, setSortBy, setSortOrder, setGroupBy, toggleShowFavoritesFirst } from '../stores/organizationStore.js';
	import { isDarkTheme, toggleTheme } from '../stores/themeStore.js';
	import Icon from './Icon.svelte';
	import ExportImport from './ExportImport.svelte';
	
	let showModal = false;
	let activeSection = 'appearance'; // 'appearance' | 'view' | 'organization' | 'backup'
	
	const settingsSections = [
		{ id: 'appearance', label: 'Appearance', icon: 'palette' },
		{ id: 'view', label: 'View', icon: 'list' },
		{ id: 'organization', label: 'Organization', icon: 'settings' },
		{ id: 'backup', label: 'Backup', icon: 'package' }
	];
	
	function openModal() {
		showModal = true;
		activeSection = 'appearance'; // Reset to first section when opening
	}
	
	function closeModal() {
		showModal = false;
	}
	
	function handleClickOutside(event) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}
	
	function setActiveSection(sectionId) {
		activeSection = sectionId;
	}
</script>

<!-- Settings button (to be placed at bottom of sidebar) -->
<button class="settings-btn" on:click={openModal} title="Settings">
	<Icon name="settings" size={16} />
	<span>Settings</span>
</button>

<!-- Modal -->
{#if showModal}
	<div class="modal-overlay" on:click={handleClickOutside}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h3>
					<Icon name="settings" size={20} />
					Settings
				</h3>
				<button class="close-btn" on:click={closeModal}>×</button>
			</div>

			<div class="modal-body">
				<div class="settings-layout">
					<!-- Left sidebar menu -->
					<div class="settings-sidebar">
						<nav class="settings-nav">
							{#each settingsSections as section}
								<button
									class="settings-nav-item"
									class:active={activeSection === section.id}
									on:click={() => setActiveSection(section.id)}
								>
									<Icon name={section.id === 'view' && $organizationPreferences.compactView ? "grid" : section.icon} size={16} />
									<span>{section.label}</span>
								</button>
							{/each}
						</nav>
					</div>

					<!-- Right content area -->
					<div class="settings-content-area">
						{#if activeSection === 'appearance'}
							<div class="settings-panel">
								<div class="panel-header">
									<h4>
										<Icon name="palette" size={20} />
										Appearance Settings
									</h4>
									<p class="panel-description">Customize the look and feel of the application</p>
								</div>
								<div class="panel-content">
									<div class="setting-item">
										<div class="setting-info">
											<label class="setting-label">Theme</label>
											<p class="setting-description">Choose between light and dark theme</p>
										</div>
										<div class="theme-toggle-container">
											<label class="toggle-switch theme-toggle-switch">
												<input 
													type="checkbox" 
													checked={$isDarkTheme}
													on:change={toggleTheme}
												/>
												<span class="toggle-slider"></span>
											</label>
											<span class="toggle-label">
												{#if $isDarkTheme}
													<Icon name="moon" size={16} />
													Dark Mode
												{:else}
													<Icon name="sun" size={16} />
													Light Mode
												{/if}
											</span>
										</div>
									</div>
								</div>
							</div>
						{:else if activeSection === 'view'}
							<div class="settings-panel">
								<div class="panel-header">
									<h4>
										<Icon name={$organizationPreferences.compactView ? "grid" : "list"} size={20} />
										View Settings
									</h4>
									<p class="panel-description">Customize how notes are displayed in the sidebar</p>
								</div>
								<div class="panel-content">
									<div class="setting-item">
										<div class="setting-info">
											<label class="setting-label">View Mode</label>
											<p class="setting-description">Choose between compact and expanded view for notes</p>
										</div>
										<button 
											class="view-toggle-btn"
											class:compact={$organizationPreferences.compactView}
											on:click={toggleCompactView}
											title={$organizationPreferences.compactView ? "Switch to expanded view" : "Switch to compact view"}
										>
											<Icon name={$organizationPreferences.compactView ? "grid" : "list"} size={16} />
											<span>{$organizationPreferences.compactView ? "Switch to Expanded View" : "Switch to Compact View"}</span>
										</button>
									</div>
								</div>
							</div>
						{:else if activeSection === 'organization'}
							<div class="settings-panel">
								<div class="panel-header">
									<h4>
										<Icon name="settings" size={20} />
										Organization Settings
									</h4>
									<p class="panel-description">Configure how notes are sorted and grouped</p>
								</div>
								<div class="panel-content">
									<!-- Sort By -->
									<div class="setting-item">
										<div class="setting-info">
											<label class="setting-label">Sort By</label>
											<p class="setting-description">Choose how notes should be sorted</p>
										</div>
										<div class="setting-controls">
											<button 
												class="option-btn"
												class:active={$organizationPreferences.sortBy === 'date'}
												on:click={() => setSortBy('date')}
											>
												<Icon name="calendar" size={16} />
												<span>Date</span>
											</button>
											<button 
												class="option-btn"
												class:active={$organizationPreferences.sortBy === 'alphabetical'}
												on:click={() => setSortBy('alphabetical')}
											>
												<Icon name="text" size={16} />
												<span>Alphabetical</span>
											</button>
											<button 
												class="option-btn"
												class:active={$organizationPreferences.sortBy === 'favorites'}
												on:click={() => setSortBy('favorites')}
											>
												<Icon name="star" size={16} />
												<span>Favorites</span>
											</button>
										</div>
									</div>

									<!-- Sort Order -->
									<div class="setting-item">
										<div class="setting-info">
											<label class="setting-label">Sort Order</label>
											<p class="setting-description">Choose the order direction</p>
										</div>
										<div class="setting-controls">
											<button 
												class="option-btn"
												class:active={$organizationPreferences.sortOrder === 'desc'}
												on:click={() => setSortOrder('desc')}
											>
												<Icon name="arrow-down" size={16} />
												<span>Newest First</span>
											</button>
											<button 
												class="option-btn"
												class:active={$organizationPreferences.sortOrder === 'asc'}
												on:click={() => setSortOrder('asc')}
											>
												<Icon name="arrow-up" size={16} />
												<span>Oldest First</span>
											</button>
										</div>
									</div>

									<!-- Group By -->
									<div class="setting-item">
										<div class="setting-info">
											<label class="setting-label">Group By</label>
											<p class="setting-description">Choose how notes should be grouped</p>
										</div>
										<div class="setting-controls">
											<button 
												class="option-btn"
												class:active={$organizationPreferences.groupBy === 'none'}
												on:click={() => setGroupBy('none')}
											>
												<span>None</span>
											</button>
											<button 
												class="option-btn"
												class:active={$organizationPreferences.groupBy === 'date'}
												on:click={() => setGroupBy('date')}
											>
												<Icon name="calendar" size={16} />
												<span>Date</span>
											</button>
											<button 
												class="option-btn"
												class:active={$organizationPreferences.groupBy === 'tags'}
												on:click={() => setGroupBy('tags')}
											>
												<Icon name="tag" size={16} />
												<span>Tags</span>
											</button>
											<button 
												class="option-btn"
												class:active={$organizationPreferences.groupBy === 'folders'}
												on:click={() => setGroupBy('folders')}
											>
												<Icon name="folderOpen" size={16} />
												<span>Folders</span>
											</button>
										</div>
									</div>

									<!-- Show Favorites First -->
									<div class="setting-item">
										<div class="setting-info">
											<label class="setting-label">Show Favorites First</label>
											<p class="setting-description">Always display favorite notes at the top</p>
										</div>
										<label class="toggle-switch">
											<input 
												type="checkbox" 
												checked={$organizationPreferences.showFavoritesFirst}
												on:change={toggleShowFavoritesFirst}
											/>
											<span class="toggle-slider"></span>
										</label>
									</div>
								</div>
							</div>
						{:else if activeSection === 'backup'}
							<div class="settings-panel">
								<div class="panel-header">
									<h4>
										<Icon name="package" size={20} />
										Backup & Import
									</h4>
									<p class="panel-description">Export and import your notes</p>
								</div>
								<div class="panel-content">
									<div class="backup-section-wrapper">
										<ExportImport showButton={false} inline={true} />
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.settings-btn {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-secondary);
		padding: 0.5rem 0.875rem;
		background: transparent;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		border: none;
		cursor: pointer;
		text-align: left;
		width: 100%;
	}

	.settings-btn :global(.icon) {
		font-size: 16px;
		color: var(--accent-color);
		opacity: 0.9;
		flex-shrink: 0;
	}

	.settings-btn span {
		flex: 1;
		text-transform: none;
		letter-spacing: normal;
		font-weight: 500;
	}

	.settings-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
		transform: translateX(2px);
	}

	.settings-btn:active {
		transform: translateX(0);
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.2s ease;
		padding: 1rem;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal-content {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-xl);
		width: 100%;
		max-width: 800px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		animation: slideUpScale 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	@keyframes slideUpScale {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(1rem);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.modal-header {
		padding: var(--spacing-xl) var(--spacing-2xl);
		border-bottom: 1px solid var(--border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h3 {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-weight: var(--font-weight-semibold);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 1.5rem;
		cursor: pointer;
		padding: var(--spacing-xs);
		border-radius: var(--radius);
		transition: var(--transition);
		line-height: 1;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		transform: scale(1.1);
	}

	.close-btn:active {
		transform: scale(0.95);
	}

	.modal-body {
		padding: 0;
		overflow: hidden;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.settings-layout {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.settings-sidebar {
		width: 200px;
		flex-shrink: 0;
		border-right: 1px solid var(--border-color);
		background: var(--bg-tertiary);
		display: flex;
		flex-direction: column;
	}

	.settings-nav {
		padding: var(--spacing-md);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.settings-nav-item {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		font-size: var(--font-size-sm);
		cursor: pointer;
		padding: var(--spacing-md) var(--spacing-lg);
		border-radius: var(--radius);
		transition: var(--transition);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		text-align: left;
		font-weight: var(--font-weight-medium);
	}

	.settings-nav-item:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.settings-nav-item.active {
		background: var(--accent-light);
		color: var(--accent-color);
		border-left: 3px solid var(--accent-color);
	}

	.settings-content-area {
		flex: 1;
		overflow-y: auto;
		background: var(--bg-secondary);
	}

	.settings-panel {
		padding: var(--spacing-2xl);
	}

	.panel-header {
		margin-bottom: var(--spacing-2xl);
		padding-bottom: var(--spacing-lg);
		border-bottom: 1px solid var(--border-color);
	}

	.panel-header h4 {
		margin: 0 0 var(--spacing-sm) 0;
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-semibold);
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.panel-description {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		line-height: 1.5;
	}

	.panel-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xl);
		padding: var(--spacing-xl);
	}

	.backup-section-wrapper {
		width: 100%;
	}

	.backup-section-wrapper :global(.export-import-btn) {
		display: none;
	}

	.setting-item {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.setting-label {
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
		color: var(--text-primary);
		margin: 0;
	}

	.setting-description {
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		margin: 0;
		line-height: 1.5;
	}

	.view-toggle-btn {
		background: linear-gradient(135deg, #a855f7 0%, #c084fc 100%);
		border: none;
		color: white;
		font-size: 0.875rem;
		cursor: pointer;
		padding: 0.75rem 1.25rem;
		border-radius: var(--radius-md);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: fit-content;
		min-width: 200px;
		font-weight: 500;
		box-shadow: 0 2px 8px rgba(168, 85, 247, 0.3);
		align-self: flex-start;
	}

	.view-toggle-btn :global(.icon) {
		font-size: 1rem;
	}

	.view-toggle-btn span {
		font-size: 0.875rem;
	}

	.view-toggle-btn:hover {
		background: linear-gradient(135deg, #c084fc 0%, #d8b4fe 100%);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4);
	}

	.view-toggle-btn:active {
		transform: translateY(0);
	}

	.view-toggle-btn.compact {
		background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
	}

	.setting-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.option-btn {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		color: var(--text-primary);
		font-size: var(--font-size-sm);
		cursor: pointer;
		padding: var(--spacing-md) var(--spacing-lg);
		border-radius: var(--radius);
		transition: var(--transition);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-weight: var(--font-weight-medium);
		flex: 1;
		min-width: 120px;
		justify-content: center;
	}

	.option-btn:hover {
		background: var(--bg-tertiary);
		border-color: var(--border-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow-xs);
	}

	.option-btn:active {
		transform: translateY(0);
	}

	.option-btn.active {
		background: var(--accent-light);
		border-color: var(--accent-color);
		color: var(--accent-color);
		font-weight: var(--font-weight-semibold);
	}

	.option-btn.active:hover {
		background: var(--accent-light);
		border-color: var(--accent-hover);
		color: var(--accent-hover);
	}

	.theme-toggle-container {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
	}

	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 48px;
		height: 24px;
		cursor: pointer;
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
		background-color: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		transition: var(--transition);
		border-radius: var(--radius-full);
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: var(--font-size-sm);
		color: var(--text-primary);
		font-weight: var(--font-weight-medium);
	}

	.toggle-slider:before {
		position: absolute;
		content: "";
		height: 18px;
		width: 18px;
		left: 2px;
		bottom: 2px;
		background-color: var(--text-secondary);
		transition: var(--transition);
		border-radius: 50%;
	}

	.toggle-switch input:checked + .toggle-slider {
		background-color: var(--accent-color);
		border-color: var(--accent-color);
	}

	.toggle-switch input:checked + .toggle-slider:before {
		transform: translateX(24px);
		background-color: white;
	}

	.toggle-switch:hover .toggle-slider {
		border-color: var(--border-hover);
	}

	.toggle-switch input:checked:hover + .toggle-slider {
		background-color: var(--accent-hover);
		border-color: var(--accent-hover);
	}
</style>

