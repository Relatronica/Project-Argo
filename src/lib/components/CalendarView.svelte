<script>
	import { createEventDispatcher } from 'svelte';
	import Icon from './Icon.svelte';
	
	export let notes = [];
	export let selectedDate = null;
	
	const dispatch = createEventDispatcher();
	
	let currentDate = new Date();
	let currentMonth = currentDate.getMonth();
	let currentYear = currentDate.getFullYear();
	let currentView = 'month'; // 'month', 'week', 'today'
	
	const monthNames = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
	
	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	
	// Navigate months
	function prevMonth() {
		if (currentMonth === 0) {
			currentMonth = 11;
			currentYear--;
		} else {
			currentMonth--;
		}
	}
	
	function nextMonth() {
		if (currentMonth === 11) {
			currentMonth = 0;
			currentYear++;
		} else {
			currentMonth++;
		}
	}
	
	function goToToday() {
		const today = new Date();
		currentMonth = today.getMonth();
		currentYear = today.getFullYear();
		selectedDate = null;
	}
	
	// Generate calendar days
	function getCalendarDays() {
		const firstDay = new Date(currentYear, currentMonth, 1);
		const lastDay = new Date(currentYear, currentMonth + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startingDayOfWeek = firstDay.getDay();
		
		const days = [];
		
		// Add empty cells for days before month starts
		for (let i = 0; i < startingDayOfWeek; i++) {
			days.push(null);
		}
		
		// Add days of the month
		for (let day = 1; day <= daysInMonth; day++) {
			days.push(day);
		}
		
		return days;
	}
	
	// Get notes for a specific day
	function getNotesForDay(day) {
		if (!day) return [];
		
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		
		return notes.filter(note => {
			// Check created date
			if (note.created && note.created.startsWith(dateStr)) return true;
			// Check updated date
			if (note.updated && note.updated.startsWith(dateStr)) return true;
			// Check scheduled date
			if (note.scheduledFor && note.scheduledFor.startsWith(dateStr)) return true;
			// Check due date
			if (note.dueDate && note.dueDate.startsWith(dateStr)) return true;
			return false;
		});
	}
	
	// Get note types for a day
	function getDayInfo(day) {
		if (!day) return { count: 0, hasCreated: false, hasUpdated: false, hasScheduled: false, hasDue: false };
		
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		
		let count = 0;
		let hasCreated = false;
		let hasUpdated = false;
		let hasScheduled = false;
		let hasDue = false;
		
		const processedIds = new Set();
		
		notes.forEach(note => {
			let hasMatch = false;
			
			if (note.created && note.created.startsWith(dateStr)) {
				hasCreated = true;
				hasMatch = true;
			}
			if (note.updated && note.updated.startsWith(dateStr) && !note.created?.startsWith(dateStr)) {
				hasUpdated = true;
				hasMatch = true;
			}
			if (note.scheduledFor && note.scheduledFor.startsWith(dateStr)) {
				hasScheduled = true;
				hasMatch = true;
			}
			if (note.dueDate && note.dueDate.startsWith(dateStr)) {
				hasDue = true;
				hasMatch = true;
			}
			
			if (hasMatch && !processedIds.has(note.id)) {
				count++;
				processedIds.add(note.id);
			}
		});
		
		return { count, hasCreated, hasUpdated, hasScheduled, hasDue };
	}
	
	// Check if day is today
	function isToday(day) {
		const today = new Date();
		return day && 
			today.getDate() === day && 
			today.getMonth() === currentMonth && 
			today.getFullYear() === currentYear;
	}
	
	// Check if day is selected
	function isSelected(day) {
		if (!selectedDate || !day) return false;
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		return selectedDate === dateStr;
	}
	
	// Handle day click
	function handleDayClick(day, event) {
		if (!day) return;
		
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		
		// Toggle selection
		if (selectedDate === dateStr) {
			selectedDate = null;
			dispatch('dateselect', { date: null, notes: [] });
		} else {
			selectedDate = dateStr;
			const dayNotes = getNotesForDay(day);
			dispatch('dateselect', { date: dateStr, notes: dayNotes });
		}
	}
	
	// Handle create note for day
	function handleCreateNoteForDay(day, event) {
		event.stopPropagation();
		if (!day) return;
		
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		dispatch('createnote', { date: dateStr });
	}
	
	// Handle note click
	function handleNoteClick(note, event) {
		event.stopPropagation();
		dispatch('noteclick', { note });
	}
	
	// Reactive calendar days - recalculate when month, year, or notes change
	// Track notes length to force recalculation when notes array changes
	$: notesLength = notes ? notes.length : 0;
	let calendarDays = [];
	// Include notesLength in the condition to force recalculation when notes change
	// This ensures {@const dayInfo = getDayInfo(day)} in template is re-evaluated when notes change
	$: if (currentMonth >= 0 && currentYear > 0 && notesLength >= 0) {
		// Recalculate calendar days when month/year changes or when notes array changes
		// notesLength >= 0 ensures this runs when notes is initialized (length >= 0)
		// and when notes array changes (notesLength changes)
		calendarDays = getCalendarDays();
	}
	
	// Declare selectedDayNotes before using it in reactive statement
	let selectedDayNotes = [];
	// Recalculate selectedDayNotes when selectedDate OR notes change
	$: if (selectedDate && notes) {
		const dayNum = parseInt(selectedDate.split('-')[2]);
		selectedDayNotes = getNotesForDay(dayNum);
	} else {
		selectedDayNotes = [];
	}
	
	// Get today's notes
	function getTodayNotes() {
		const today = new Date();
		const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
		
		return notes.filter(note => {
			if (note.scheduledFor && note.scheduledFor.startsWith(todayStr)) return true;
			if (note.dueDate && note.dueDate.startsWith(todayStr)) return true;
			return false;
		});
	}
	
	// Get upcoming notes (next 7 days)
	function getUpcomingNotes() {
		const today = new Date();
		const upcoming = [];
		
		for (let i = 1; i <= 7; i++) {
			const date = new Date(today);
			date.setDate(today.getDate() + i);
			const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
			
			const dayNotes = notes.filter(note => {
				if (note.scheduledFor && note.scheduledFor.startsWith(dateStr)) return true;
				if (note.dueDate && note.dueDate.startsWith(dateStr)) return true;
				return false;
			});
			
			if (dayNotes.length > 0) {
				upcoming.push({ date: dateStr, dateObj: date, notes: dayNotes });
			}
		}
		
		return upcoming;
	}
	
	// Get week days (7 days starting from Monday or today)
	function getWeekDays() {
		const today = new Date();
		const dayOfWeek = today.getDay();
		const monday = new Date(today);
		
		// Get Monday of current week
		const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
		monday.setDate(today.getDate() + diff);
		
		const weekDays = [];
		for (let i = 0; i < 7; i++) {
			const date = new Date(monday);
			date.setDate(monday.getDate() + i);
			const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
			
			const dayNotes = notes.filter(note => {
				if (note.created && note.created.startsWith(dateStr)) return true;
				if (note.updated && note.updated.startsWith(dateStr) && !note.created?.startsWith(dateStr)) return true;
				if (note.scheduledFor && note.scheduledFor.startsWith(dateStr)) return true;
				if (note.dueDate && note.dueDate.startsWith(dateStr)) return true;
				return false;
			});
			
			weekDays.push({
				date: dateStr,
				dateObj: date,
				dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
				isToday: dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
				notes: dayNotes
			});
		}
		
		return weekDays;
	}
	
	// Change view
	function setView(view) {
		currentView = view;
		selectedDate = null;
	}
	
	$: todayNotes = getTodayNotes();
	$: upcomingNotes = getUpcomingNotes();
	$: weekDays = getWeekDays();
</script>

<div class="calendar-view">
	<!-- View Selector -->
	<div class="view-selector">
		<button
			class="view-btn"
			class:active={currentView === 'month'}
			on:click={() => setView('month')}
			title="Month view"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
				<line x1="3" y1="10" x2="21" y2="10"></line>
			</svg>
			<span>Month</span>
		</button>
		<button
			class="view-btn"
			class:active={currentView === 'week'}
			on:click={() => setView('week')}
			title="Week view"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
				<line x1="16" y1="2" x2="16" y2="6"></line>
				<line x1="8" y1="2" x2="8" y2="6"></line>
				<line x1="3" y1="10" x2="21" y2="10"></line>
				<line x1="10" y1="10" x2="10" y2="22"></line>
				<line x1="17" y1="10" x2="17" y2="22"></line>
			</svg>
			<span>Week</span>
		</button>
		<button
			class="view-btn"
			class:active={currentView === 'today'}
			on:click={() => setView('today')}
			title="Today view"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10"></circle>
				<polyline points="12 6 12 12 16 14"></polyline>
			</svg>
			<span>Today</span>
		</button>
	</div>

	<!-- Header (only for month view) -->
	{#if currentView === 'month'}
	<div class="calendar-header">
		<button class="nav-btn" on:click={prevMonth} title="Previous month">
			<Icon name="chevron-left" size={20} />
		</button>
		
		<div class="month-year">
			<h2>{monthNames[currentMonth]} {currentYear}</h2>
			<button class="today-btn" on:click={goToToday}>Today</button>
		</div>
		
		<button class="nav-btn" on:click={nextMonth} title="Next month">
			<Icon name="chevron-right" size={20} />
		</button>
	</div>
	{/if}
	
	<!-- MONTH VIEW -->
	{#if currentView === 'month'}
	<!-- Day names -->
	<div class="day-names">
		{#each dayNames as dayName}
			<div class="day-name">{dayName}</div>
		{/each}
	</div>
	
	<!-- Calendar grid -->
	<div class="calendar-grid">
		{#each calendarDays as day}
			{@const dayInfo = getDayInfo(day)}
			{@const today = isToday(day)}
			{@const selected = isSelected(day)}
			
			<div class="calendar-day-wrapper">
				<button
					class="calendar-day"
					class:empty={!day}
					class:today={today}
					class:selected={selected}
					class:has-notes={dayInfo.count > 0}
					on:click={() => handleDayClick(day)}
					disabled={!day}
				>
					{#if day}
						<span class="day-number">{day}</span>
						{#if dayInfo.count > 0}
							<div class="day-indicators">
								{#if dayInfo.hasCreated}
									<span class="indicator created" title="Created"></span>
								{/if}
								{#if dayInfo.hasUpdated}
									<span class="indicator updated" title="Updated"></span>
								{/if}
								{#if dayInfo.hasScheduled}
									<span class="indicator scheduled" title="Scheduled"></span>
								{/if}
								{#if dayInfo.hasDue}
									<span class="indicator due" title="Due"></span>
								{/if}
							</div>
							<span class="note-count">{dayInfo.count}</span>
						{/if}
					{/if}
				</button>
				{#if day}
					<button
						class="add-note-btn"
						on:click={(e) => handleCreateNoteForDay(day, e)}
						title="Create note for this day"
					>
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<line x1="12" y1="5" x2="12" y2="19"></line>
							<line x1="5" y1="12" x2="19" y2="12"></line>
						</svg>
					</button>
				{/if}
			</div>
		{/each}
	</div>
	
	<!-- Legend -->
	<div class="calendar-legend">
		<div class="legend-item">
			<span class="indicator created"></span>
			<span>Created</span>
		</div>
		<div class="legend-item">
			<span class="indicator updated"></span>
			<span>Updated</span>
		</div>
		<div class="legend-item">
			<span class="indicator scheduled"></span>
			<span>Scheduled</span>
		</div>
		<div class="legend-item">
			<span class="indicator due"></span>
			<span>Due</span>
		</div>
	</div>
	
	<!-- Selected Day Notes -->
	{#if selectedDate && selectedDayNotes.length > 0}
		<div class="selected-day-notes">
			<div class="selected-day-header">
				<h3>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
						<polyline points="14 2 14 8 20 8"></polyline>
					</svg>
					{selectedDayNotes.length} {selectedDayNotes.length === 1 ? 'note' : 'notes'} on {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
				</h3>
				<button
					class="close-notes-btn"
					on:click={() => {
						selectedDate = null;
						dispatch('dateselect', { date: null, notes: [] });
					}}
					title="Close"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>
			<div class="notes-list">
				{#each selectedDayNotes as note}
					<button
						class="note-item"
						on:click={(e) => handleNoteClick(note, e)}
						title="Open note"
					>
						<div class="note-item-content">
							<div class="note-item-title">
								{note.title || 'Untitled Note'}
							</div>
							<div class="note-item-badges">
								{#if note.created && note.created.startsWith(selectedDate)}
									<span class="note-badge created" title="Created on this day">Created</span>
								{/if}
								{#if note.updated && note.updated.startsWith(selectedDate) && !note.created?.startsWith(selectedDate)}
									<span class="note-badge updated" title="Updated on this day">Updated</span>
								{/if}
								{#if note.scheduledFor && note.scheduledFor.startsWith(selectedDate)}
									<span class="note-badge scheduled" title="Scheduled for this day">Scheduled</span>
								{/if}
								{#if note.dueDate && note.dueDate.startsWith(selectedDate)}
									<span class="note-badge due" title="Due on this day">Due</span>
								{/if}
							</div>
						</div>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="9 18 15 12 9 6"></polyline>
						</svg>
					</button>
				{/each}
			</div>
		</div>
	{/if}
	{/if}
	
	<!-- TODAY VIEW -->
	{#if currentView === 'today'}
	<div class="today-view">
		<div class="today-header">
			<h2>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
				</svg>
				Today
			</h2>
			<p class="today-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
		</div>
		
		{#if todayNotes.length > 0}
			<div class="today-section">
				<h3 class="section-title">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
						<polyline points="14 2 14 8 20 8"></polyline>
					</svg>
					Today's Notes ({todayNotes.length})
				</h3>
				<div class="notes-list">
					{#each todayNotes as note}
						<button
							class="note-item-large"
							on:click={(e) => handleNoteClick(note, e)}
							title="Open note"
						>
							<div class="note-item-content">
								<div class="note-item-title">{note.title || 'Untitled Note'}</div>
								<div class="note-item-badges">
									{#if note.scheduledFor}
										<span class="note-badge scheduled">Scheduled</span>
									{/if}
									{#if note.dueDate}
										<span class="note-badge due">Due</span>
									{/if}
								</div>
							</div>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="9 18 15 12 9 6"></polyline>
							</svg>
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<div class="empty-state">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
				</svg>
				<p>No notes scheduled for today</p>
				<button class="create-note-btn" on:click={(e) => {
					const today = new Date();
					const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
					dispatch('createnote', { date: dateStr });
				}}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="12" y1="5" x2="12" y2="19"></line>
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
					Create note for today
				</button>
			</div>
		{/if}
		
		{#if upcomingNotes.length > 0}
			<div class="upcoming-section">
				<h3 class="section-title">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
					</svg>
					Upcoming (Next 7 days)
				</h3>
				{#each upcomingNotes as day}
					<div class="upcoming-day">
						<div class="upcoming-day-header">
							<span class="upcoming-date">{day.dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
							<span class="upcoming-count">{day.notes.length} {day.notes.length === 1 ? 'note' : 'notes'}</span>
						</div>
						<div class="upcoming-notes">
							{#each day.notes as note}
								<button
									class="note-item-compact"
									on:click={(e) => handleNoteClick(note, e)}
									title="Open note"
								>
									<div class="note-item-title">{note.title || 'Untitled Note'}</div>
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="9 18 15 12 9 6"></polyline>
									</svg>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
	{/if}
	
	<!-- WEEK VIEW -->
	{#if currentView === 'week'}
	<div class="week-view">
		<div class="week-header">
			<h2>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
					<line x1="16" y1="2" x2="16" y2="6"></line>
					<line x1="8" y1="2" x2="8" y2="6"></line>
					<line x1="3" y1="10" x2="21" y2="10"></line>
				</svg>
				This Week
			</h2>
		</div>
		
		<div class="week-grid">
			{#each weekDays as day}
				<div class="week-day" class:is-today={day.isToday}>
					<div class="week-day-header">
						<div>
							<div class="week-day-name">{day.dayName}</div>
							<div class="week-day-date" class:today={day.isToday}>
								{day.dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
							</div>
						</div>
						{#if day.notes.length > 0}
							<span class="week-note-count">{day.notes.length}</span>
						{/if}
					</div>
					<div class="week-day-content">
						{#if day.notes.length > 0}
							{#each day.notes as note}
								<button
									class="week-note-item"
									on:click={(e) => handleNoteClick(note, e)}
									title="Open note"
								>
									<div class="week-note-title">{note.title || 'Untitled'}</div>
									<div class="week-note-badges">
										{#if note.scheduledFor && note.scheduledFor.startsWith(day.date)}
											<span class="mini-indicator scheduled" title="Scheduled"></span>
										{/if}
										{#if note.dueDate && note.dueDate.startsWith(day.date)}
											<span class="mini-indicator due" title="Due"></span>
										{/if}
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<polyline points="9 18 15 12 9 6"></polyline>
										</svg>
									</div>
								</button>
							{/each}
						{:else}
							<div class="week-day-empty">
								<button
									class="week-add-btn"
									on:click={(e) => {
										e.stopPropagation();
										dispatch('createnote', { date: day.date });
									}}
									title="Create note for this day"
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="12" y1="5" x2="12" y2="19"></line>
										<line x1="5" y1="12" x2="19" y2="12"></line>
									</svg>
									<span>Add note</span>
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
	{/if}
</div>

<style>
	.calendar-view {
		display: flex;
		flex-direction: column;
		padding: 1rem;
		overflow-y: auto;
		overflow-x: hidden;
	}
	
	.calendar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		gap: 0.5rem;
	}
	
	.month-year {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}
	
	.month-year h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}
	
	.nav-btn {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 0.5rem;
		cursor: pointer;
		color: var(--text-secondary);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.nav-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		border-color: var(--accent-color);
	}
	
	.today-btn {
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: var(--transition);
	}
	
	.today-btn:hover {
		background: var(--accent-hover);
	}
	
	.day-names {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 3px;
		margin-bottom: 0.35rem;
	}
	
	.day-name {
		text-align: center;
		font-size: 0.6rem;
		font-weight: 600;
		color: var(--text-secondary);
		padding: 0.25rem 0;
		text-transform: uppercase;
		line-height: 1;
		letter-spacing: -0.5px;
	}
	
	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 3px;
		align-content: start;
	}
	
	.calendar-day-wrapper {
		position: relative;
		aspect-ratio: 1 / 1;
		min-height: 38px;
		max-height: 44px;
	}
	
	.calendar-day-wrapper:hover .add-note-btn {
		opacity: 1;
		pointer-events: auto;
	}
	
	.calendar-day {
		width: 100%;
		height: 100%;
		background: var(--bg-secondary);
		border: 1px solid transparent;
		border-radius: 4px;
		padding: 0.25rem 0.15rem;
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: relative;
	}
	
	.calendar-day.empty {
		background: transparent;
		border: none;
		cursor: default;
	}
	
	.calendar-day:not(.empty):hover {
		background: var(--bg-tertiary);
		border-color: var(--accent-color);
		transform: scale(1.05);
		z-index: 5;
	}
	
	.calendar-day.today {
		border-color: var(--accent-color);
		border-width: 1.5px;
		box-shadow: 0 0 0 1px var(--accent-color);
	}
	
	.calendar-day.selected {
		background: var(--accent-light);
		border-color: var(--accent-color);
		border-width: 1.5px;
		box-shadow: 0 0 0 1px var(--accent-color);
	}
	
	.calendar-day.has-notes {
		background: var(--bg-tertiary);
		border-color: var(--border-color);
	}
	
	.day-number {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-primary);
		line-height: 1;
	}
	
	.calendar-day.today .day-number {
		color: var(--accent-color);
		font-weight: 700;
		font-size: 0.75rem;
	}
	
	.day-indicators {
		display: flex;
		gap: 2px;
		flex-wrap: wrap;
		justify-content: center;
		margin-top: 1px;
		max-width: 100%;
		position: absolute;
		bottom: 3px;
		left: 50%;
		transform: translateX(-50%);
	}
	
	.indicator {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		display: inline-block;
	}
	
	.indicator.created {
		background: #10b981; /* green */
	}
	
	.indicator.updated {
		background: #3b82f6; /* blue */
	}
	
	.indicator.scheduled {
		background: #f59e0b; /* orange */
	}
	
	.indicator.due {
		background: #ef4444; /* red */
	}
	
	.note-count {
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--accent-color);
		position: absolute;
		top: 2px;
		left: 2px;
		line-height: 1;
		background: var(--accent-light);
		padding: 0.1rem 0.25rem;
		border-radius: 3px;
		min-width: 12px;
		text-align: center;
	}
	
	.calendar-legend {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-color);
		justify-content: center;
		flex-wrap: wrap;
	}
	
	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.625rem;
		color: var(--text-secondary);
	}
	
	.legend-item .indicator {
		width: 7px;
		height: 7px;
	}
	
	/* Add Note Button */
	.add-note-btn {
		position: absolute;
		top: 1px;
		right: 1px;
		width: 14px;
		height: 14px;
		background: var(--accent-color);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: var(--transition);
		opacity: 0;
		pointer-events: none;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		z-index: 10;
	}
	
	.add-note-btn svg {
		width: 9px;
		height: 9px;
	}
	
	.add-note-btn:hover {
		background: var(--accent-hover);
		transform: scale(1.1);
		box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
	}
	
	.add-note-btn:active {
		transform: scale(0.95);
	}
	
	/* Selected Day Notes */
	.selected-day-notes {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-color);
		animation: slideDown 0.3s ease;
	}
	
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	.selected-day-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}
	
	.selected-day-header h3 {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	
	.selected-day-header h3 svg {
		width: 14px;
		height: 14px;
	}
	
	.close-notes-btn {
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
	}
	
	.close-notes-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}
	
	.notes-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 300px;
		overflow-y: auto;
	}
	
	.note-item {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 0.5rem;
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.375rem;
		text-align: left;
		width: 100%;
	}
	
	.note-item:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent-color);
		transform: translateX(4px);
	}
	
	.note-item-content {
		flex: 1;
		min-width: 0;
	}
	
	.note-item-title {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.note-item-badges {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}
	
	.note-badge {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		border-radius: var(--radius-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	
	.note-badge.created {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}
	
	.note-badge.updated {
		background: rgba(59, 130, 246, 0.15);
		color: #3b82f6;
	}
	
	.note-badge.scheduled {
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}
	
	.note-badge.due {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}
	
	/* Responsive adjustments */
	@media (max-width: 768px) {
		.calendar-view {
			padding: 0.5rem;
		}
		
		.month-year h2 {
			font-size: 1rem;
		}
		
		.calendar-day-wrapper {
			min-height: 50px;
		}
		
		.calendar-day {
			padding: 0.25rem;
		}
		
		.day-number {
			font-size: 0.75rem;
		}
		
		.note-count {
			font-size: 0.625rem;
		}
		
		.add-note-btn {
			width: 18px;
			height: 18px;
		}
		
		.selected-day-notes {
			font-size: 0.875rem;
		}
		
		.note-item {
			padding: 0.5rem;
		}
	}
	
	/* VIEW SELECTOR */
	.view-selector {
		display: flex;
		gap: 0.375rem;
		margin-bottom: 2rem;
		background: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		padding: 0.375rem;
	}
	
	.view-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.375rem 0.5rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.7rem;
		font-weight: 500;
		cursor: pointer;
		transition: var(--transition);
	}
	
	.view-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}
	
	.view-btn.active {
		background: var(--accent-color);
		color: white;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}
	
	.view-btn span {
		font-size: 0.7rem;
	}
	
	/* TODAY VIEW */
	.today-view {
		flex: 1;
		overflow-y: auto;
		padding-left: 1rem;
    	padding-right: 1rem;
	}
	
	.today-header {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--border-color);
	}
	
	.today-header h2 {
		margin: 0 0 0.75rem 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	
	.today-date {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 500;
	}
	
	.today-section, .upcoming-section {
		margin-bottom: 2rem;
	}
	
	.section-title {
		margin: 0 0 1rem 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	
	.note-item-large {
		width: 100%;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 1rem;
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		text-align: left;
		margin-bottom: 0.75rem;
	}
	
	.note-item-large:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent-color);
		transform: translateX(4px);
	}
	
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		text-align: center;
		color: var(--text-secondary);
	}
	
	.empty-state svg {
		margin-bottom: 1rem;
		opacity: 0.5;
	}
	
	.empty-state p {
		margin: 0 0 1rem 0;
		font-size: 0.875rem;
	}
	
	.create-note-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: var(--transition);
	}
	
	.create-note-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}
	
	.upcoming-day {
		margin-bottom: 1.25rem;
	}
	
	.upcoming-day-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		margin-bottom: 0.5rem;
	}
	
	.upcoming-date {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
	}
	
	.upcoming-count {
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--accent-color);
		background: var(--accent-light);
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}
	
	.upcoming-notes {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.note-item-compact {
		width: 100%;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 0.75rem;
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.375rem;
		text-align: left;
	}
	
	.note-item-compact:hover {
		background: var(--bg-tertiary);
		border-color: var(--accent-color);
		transform: translateX(4px);
	}
	
	.note-item-compact .note-item-title {
		font-size: 0.75rem;
		margin: 0;
	}
	
	/* WEEK VIEW */
	.week-view {
		flex: 1;
		overflow-y: auto;
		padding-left: 1rem;
    	padding-right: 1rem;
	}
	
	.week-header {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--border-color);
	}
	
	.week-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	
	.week-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.week-day {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		transition: var(--transition);
	}
	
	.week-day.is-today {
		border-color: var(--accent-color);
		border-width: 2px;
		box-shadow: 0 0 0 1px var(--accent-color);
		background: var(--accent-light);
	}
	
	.week-day-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-color);
	}
	
	.week-day-name {
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 0.25rem;
	}
	
	.week-day-date {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	
	.week-day-date.today {
		color: var(--accent-color);
	}
	
	.week-day-date.today::before {
		content: '';
		width: 6px;
		height: 6px;
		background: var(--accent-color);
		border-radius: 50%;
		animation: pulse 2s infinite;
	}
	
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.6;
			transform: scale(0.8);
		}
	}
	
	.week-day-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.week-note-item {
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 0.75rem 0.875rem;
		cursor: pointer;
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.625rem;
		text-align: left;
		width: 100%;
	}
	
	.week-note-item:hover {
		background: var(--bg-primary);
		border-color: var(--accent-color);
		transform: translateX(4px);
	}
	
	.week-note-title {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}
	
	.week-note-badges {
		display: flex;
		gap: 0.25rem;
		align-items: center;
	}
	
	.mini-indicator {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		display: inline-block;
	}
	
	.mini-indicator.scheduled {
		background: #f59e0b;
	}
	
	.mini-indicator.due {
		background: #ef4444;
	}
	
	.week-day-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
		color: var(--text-secondary);
		font-size: 0.75rem;
	}
	
	.week-add-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.875rem;
		background: var(--bg-tertiary);
		border: 1px dashed var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 500;
		transition: var(--transition);
	}
	
	.week-add-btn:hover {
		background: var(--accent-color);
		border-color: var(--accent-color);
		border-style: solid;
		color: white;
		transform: translateX(4px);
	}
	
	.week-note-count {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--accent-color);
		background: var(--accent-light);
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}
	
	/* Responsive for new views */
	@media (max-width: 768px) {
		.week-grid {
			gap: 0.375rem;
		}
		
		.week-day {
			padding: 0.5rem;
		}
		
		.week-day-header {
			margin-bottom: 0.5rem;
		}
		
		.view-btn span {
			font-size: 0.65rem;
		}
		
		.today-view,
		.week-view {
			padding: 0 0.25rem;
		}
	}
</style>

