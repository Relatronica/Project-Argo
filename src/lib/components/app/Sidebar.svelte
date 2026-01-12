<script>
	import { createEventDispatcher } from 'svelte';
	import { currentNote, createNewNote, notesMetadata } from '../../stores/notesStore.js';
	import { allFolders } from '../../stores/folderStore.js';
	import NoteList from '../NoteList.svelte';
	import SearchBar from '../SearchBar.svelte';
	import CalendarView from '../CalendarView.svelte';
	import Icon from '../Icon.svelte';

	const dispatch = createEventDispatcher();

	export let sidebarOpen = true;
	export let showCalendar = false;
	export let toggleCalendar;
	export let selectedCalendarDate = null;
	export let handleDateSelect;
	export let handleCreateNoteFromCalendar;
	export let handleNoteClickFromCalendar;

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	async function handleCreateNote() {
		await createNewNote();
		dispatch('noteCreated');
	}
</script>

<aside class="sidebar" class:collapsed={!sidebarOpen}>
	<div class="sidebar-header">
		<button
			class="sidebar-toggle"
			on:click={toggleSidebar}
			title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
		>
			<Icon name={sidebarOpen ? 'sidebar-collapse' : 'sidebar-expand'} size={16} />
		</button>

		{#if sidebarOpen}
			<h1 class="app-title">Project Argo</h1>

			<div class="sidebar-header-actions">
				<button
					class="calendar-toggle-btn"
					class:active={showCalendar}
					on:click={toggleCalendar}
					title={showCalendar ? 'Hide calendar' : 'Show calendar'}
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
						<line x1="16" y1="2" x2="16" y2="6"></line>
						<line x1="8" y1="2" x2="8" y2="6"></line>
						<line x1="3" y1="10" x2="21" y2="10"></line>
					</svg>
				</button>
			</div>
		{/if}
	</div>

	{#if sidebarOpen}
		<div class="sidebar-content">
			{#if showCalendar}
				<div class="calendar-container">
					<CalendarView
						notes={$notesMetadata}
						selectedDate={selectedCalendarDate}
						on:dateselect={handleDateSelect}
						on:createnote={handleCreateNoteFromCalendar}
						on:noteclick={handleNoteClickFromCalendar}
					/>
				</div>
			{:else}
				<div class="sidebar-actions">
					<button
						class="action-btn primary"
						on:click={handleCreateNote}
						title="Create new note"
					>
						<Icon name="plus" size={16} />
						<span>New Note</span>
					</button>
				</div>

				<div class="search-section">
					<SearchBar />
				</div>

				<div class="notes-section">
					<NoteList />
				</div>
			{/if}
		</div>
	{/if}
</aside>

<style>
	.sidebar {
		width: 320px;
		height: 100%;
		background: var(--bg-secondary);
		border-right: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		transition: width 0.2s ease;
		position: relative;
		flex-shrink: 0;
		overflow: hidden;
	}

	.sidebar.collapsed {
		width: 48px;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
		min-height: 60px;
		flex-shrink: 0;
	}

	.sidebar-toggle {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.sidebar-toggle:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.app-title {
		margin: 0 0 0 0.5rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary);
		flex: 1;
	}

	.sidebar.collapsed .app-title {
		display: none;
	}

	.sidebar-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
		height: 100%;
	}

	.sidebar-actions {
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.action-btn {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: var(--radius);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: var(--transition);
		justify-content: center;
	}

	.action-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow-sm);
	}

	.search-section {
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}

	.notes-section {
		flex: 1;
		overflow: hidden;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/* Collapsed state */
	.sidebar.collapsed .sidebar-content,
	.sidebar.collapsed .sidebar-actions,
	.sidebar.collapsed .search-section {
		display: none;
	}

	/* Header actions */
	.sidebar-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	/* Calendar toggle button */
	.calendar-toggle-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		opacity: 0.7;
	}

	.calendar-toggle-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		opacity: 1;
	}

	.calendar-toggle-btn.active {
		background: var(--accent-light);
		color: var(--accent-color);
		opacity: 1;
	}

	.calendar-toggle-btn svg {
		flex-shrink: 0;
	}

	/* Calendar container */
	.calendar-container {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
</style>
