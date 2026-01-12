<script>
	import { onDestroy } from 'svelte';
	import TextEditor from './TextEditor.svelte';
	import Whiteboard from '../Whiteboard.svelte';

	// Props
	export let note;
	export let onContentChange;
	export let onSelectionUpdate;
	export let onReady;

	// Whiteboard state
	let whiteboardComponent;
	let whiteboardTool = 'pen';
	let whiteboardColor = '#000000';
	let whiteboardLineWidth = 2;

	// State for whiteboard paths
	let whiteboardPaths = [];
	
	// Toolbar animation state
	let toolbarVisible = false; // Start hidden, will animate in on first render
	let isTransitioning = false; // Track if toolbar is transitioning
	let isInitialized = false; // Track if toolbar has been initialized

	// Function called when a new path is added
	function handlePathAdd(newPath) {
		// Create a deep copy to avoid reference sharing
		const newPathCopy = JSON.parse(JSON.stringify(newPath));
		whiteboardPaths = [...whiteboardPaths, newPathCopy];
		saveWhiteboardData();
	}

	// Function called when paths need to be changed (e.g., clear)
	function handlePathsChange(newPaths) {
		// Create a deep copy to avoid reference sharing
		whiteboardPaths = JSON.parse(JSON.stringify(newPaths));
		saveWhiteboardData();
	}

	// Save whiteboard data - updates immediately and notifies parent
	// Parent (EditorContainer) handles debounce and persistence
	function saveWhiteboardData() {
		if (!note) return;

		const data = JSON.stringify({ paths: whiteboardPaths });
		note.whiteboardData = data;
		onContentChange?.(note.whiteboardData);
	}


	// Load whiteboard data from note
	function loadWhiteboardData() {
		console.log('[WhiteboardLayout] loadWhiteboardData called', {
			noteId: note?.id,
			hasWhiteboardData: !!note?.whiteboardData,
			whiteboardDataType: typeof note?.whiteboardData,
			whiteboardDataLength: typeof note?.whiteboardData === 'string' ? note.whiteboardData.length : 'N/A'
		});
		
		// Always reset paths first to prevent showing data from previous note
		whiteboardPaths = [];
		
		if (!note?.whiteboardData) {
			console.log('[WhiteboardLayout] No whiteboardData, returning empty');
			return;
		}

		// Check if whiteboardData is empty or whitespace
		if (typeof note.whiteboardData === 'string' && note.whiteboardData.trim() === '') {
			console.log('[WhiteboardLayout] whiteboardData is empty string, returning empty');
			return;
		}

		// Check if whiteboardData is an empty object
		if (typeof note.whiteboardData === 'string') {
			const trimmed = note.whiteboardData.trim();
			if (trimmed === '{}' || trimmed === '{"paths":[]}' || trimmed === '{"paths": []}') {
				console.log('[WhiteboardLayout] whiteboardData is empty object, returning empty');
				return;
			}
		}

		try {
			const data = typeof note.whiteboardData === 'string'
				? JSON.parse(note.whiteboardData)
				: note.whiteboardData;
			
			// Validate data structure
			if (!data || typeof data !== 'object' || !Array.isArray(data.paths) || data.paths.length === 0) {
				console.log('[WhiteboardLayout] Invalid or empty paths array', {
					hasData: !!data,
					dataType: typeof data,
					hasPaths: !!(data && Array.isArray(data.paths)),
					pathsLength: data?.paths?.length || 0
				});
				return;
			}
			
			// Create a deep copy of paths to avoid reference sharing
			whiteboardPaths = JSON.parse(JSON.stringify(data.paths));
			console.log('[WhiteboardLayout] Loaded', whiteboardPaths.length, 'paths');
		} catch (error) {
			console.error('[WhiteboardLayout] Error parsing whiteboard data:', error);
			whiteboardPaths = [];
		}
	}

	// Load data when component mounts
	loadWhiteboardData();

	// Reactive statement: reload whiteboard data when note changes
	let lastNoteId = note?.id || null;
	
	$: if (note && note.id) {
		if (note.id !== lastNoteId) {
			// Reset paths immediately when note changes
			whiteboardPaths = [];
			lastNoteId = note.id;
			loadWhiteboardData();
		} else if (lastNoteId === null) {
			// First initialization
			lastNoteId = note.id;
			loadWhiteboardData();
		}
	}

	// Toolbar functions for whiteboard
	function setWhiteboardTool(tool) { whiteboardTool = tool; }
	function setWhiteboardColor(color) { whiteboardColor = color; }
	function setWhiteboardLineWidth(width) { whiteboardLineWidth = width; }

	$: if (whiteboardComponent && whiteboardTool) {
		whiteboardComponent.setTool(whiteboardTool);
	}

	$: if (whiteboardComponent && whiteboardColor) {
		whiteboardComponent.setColor(whiteboardColor);
	}

	$: if (whiteboardComponent && whiteboardLineWidth) {
		whiteboardComponent.setLineWidth(whiteboardLineWidth);
	}

	// Notify parent when ready
	$: if (whiteboardComponent && onReady) {
		onReady();
	}
	
	// Function to animate toolbar transition
	function animateToolbarTransition(callback) {
		if (isTransitioning) {
			// If already transitioning, just execute callback without animation
			if (callback) callback();
			return;
		}
		
		isTransitioning = true;
		toolbarVisible = false;
		
		// Wait for hide animation to complete (300ms)
		setTimeout(() => {
			// Execute callback if provided
			if (callback) {
				callback();
			}
			
			// Wait a bit for position to update, then show toolbar again
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					setTimeout(() => {
						toolbarVisible = true;
						isTransitioning = false;
					}, 50);
				});
			});
		}, 300); // Match animation duration
	}
	
	// Animate toolbar in on first render
	$: if (!isInitialized) {
		isInitialized = true;
		// Animate in from bottom after a short delay
		setTimeout(() => {
			toolbarVisible = true;
		}, 100);
	}

	// Cleanup: save before destroying
	onDestroy(() => {
		// Ensure latest data is saved before component is destroyed
		if (note) {
			const data = JSON.stringify({ paths: whiteboardPaths });
			note.whiteboardData = data;
			// Notify parent to save (onDestroy can't be async)
			onContentChange?.(data);
		}
	});
</script>

<div class="whiteboard-layout-container">
	<div class="whiteboard-layout">
		<!-- Text Editor Section -->
		<div class="editor-section">
			<TextEditor
				{note}
				{onContentChange}
				{onSelectionUpdate}
				{onReady}
				showBubbleMenu={false}
			/>
		</div>

		<!-- Vertical Divider -->
		<div class="vertical-divider"></div>

		<!-- Whiteboard Section -->
		<div class="whiteboard-section">
			<Whiteboard
				bind:this={whiteboardComponent}
				currentTool={whiteboardTool}
				currentColor={whiteboardColor}
				lineWidth={whiteboardLineWidth}
				isActive={true}
				paths={whiteboardPaths}
				onPathAdd={handlePathAdd}
				onPathsChange={handlePathsChange}
			/>
		</div>

		<!-- Whiteboard Toolbar (outside whiteboard-section to avoid overflow:hidden) -->
		<div class="whiteboard-toolbar-container" class:hidden={!toolbarVisible}>
			<div class="whiteboard-toolbar-content">
				<!-- Whiteboard Tools -->
				<button
					class="toolbar-btn"
					class:active={whiteboardTool === 'pen'}
					on:click={() => setWhiteboardTool('pen')}
					title="Pen"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 19l7-7 3 3-7 7-3-3z"></path>
						<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
						<path d="M2 2l7.586 7.586"></path>
						<circle cx="11" cy="11" r="2"></circle>
					</svg>
				</button>
				<button
					class="toolbar-btn"
					class:active={whiteboardTool === 'eraser'}
					on:click={() => setWhiteboardTool('eraser')}
					title="Eraser"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
						<path d="M18 8l-6 6"></path>
						<path d="M12 8l-6 6"></path>
					</svg>
				</button>
				<button
					class="toolbar-btn"
					class:active={whiteboardTool === 'pan'}
					on:click={() => setWhiteboardTool('pan')}
					title="Pan (or hold Space)"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M5.5 8.5 9 12l-3.5 3.5L2 12l3.5-3.5Z"></path>
						<path d="m12 2 3.5 3.5L12 9 8.5 5.5 12 2Z"></path>
						<path d="M18.5 8.5 22 12l-3.5 3.5L15 12l3.5-3.5Z"></path>
						<path d="m12 15 3.5 3.5L12 22l-3.5-3.5L12 15Z"></path>
					</svg>
				</button>

				<div class="toolbar-separator"></div>

				<!-- Zoom Controls -->
				<button
					class="toolbar-btn"
					on:click={() => { whiteboardComponent?.zoomIn(); }}
					title="Zoom In"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"></circle>
						<path d="m21 21-4.35-4.35"></path>
						<line x1="11" y1="8" x2="11" y2="14"></line>
						<line x1="8" y1="11" x2="14" y2="11"></line>
					</svg>
				</button>
				<button
					class="toolbar-btn"
					on:click={() => { whiteboardComponent?.zoomOut(); }}
					title="Zoom Out"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"></circle>
						<path d="m21 21-4.35-4.35"></path>
						<line x1="8" y1="11" x2="14" y2="11"></line>
					</svg>
				</button>
				<button
					class="toolbar-btn"
					on:click={() => { whiteboardComponent?.resetView(); }}
					title="Reset View"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
						<path d="M21 3v5h-5"></path>
						<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
						<path d="M3 21v-5h5"></path>
					</svg>
				</button>

				<div class="toolbar-separator"></div>

				<!-- Whiteboard Color -->
				<input
					type="color"
					bind:value={whiteboardColor}
					class="whiteboard-color-input"
					title="Whiteboard Color"
				/>

				<!-- Whiteboard Line Width -->
				<div class="whiteboard-width-control">
					<input
						type="range"
						min="1"
						max="20"
						bind:value={whiteboardLineWidth}
						class="whiteboard-width-input"
						title="Line Width"
					/>
					<span class="whiteboard-width-label">{whiteboardLineWidth}px</span>
				</div>

				<div class="toolbar-separator"></div>

				<!-- Clear Whiteboard -->
				<button
					class="toolbar-btn"
					on:click={() => {
						if (whiteboardComponent && confirm('Clear the entire whiteboard?')) {
							whiteboardComponent.clearCanvas();
						}
					}}
					title="Clear Whiteboard"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 6h18"></path>
						<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
						<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
					</svg>
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.whiteboard-layout-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
		max-height: 100vh;
		overflow: hidden;
	}

	.whiteboard-layout {
		display: flex;
		flex-direction: row;
		height: 100%;
		width: 100%;
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	.editor-section {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
		overflow: auto;
		position: relative;
	}

	.whiteboard-section {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
		overflow: hidden;
		position: relative;
		height: 100vh;
		max-height: 100vh;
	}

.whiteboard-toolbar-container {
	position: fixed; /* Changed from absolute to fixed to match text editor toolbar positioning */
	bottom: 1.5rem; /* Same as text editor toolbar - aligned at same visual height */
	left: 75%;
	transform: translateX(-50%) translateY(0);
	z-index: 1000;
	background: var(--bg-secondary);
	border: 1px solid var(--border-color);
	border-radius: var(--radius);
	box-shadow: var(--shadow-lg);
	padding: 0.5rem; /* Same padding as text editor toolbar for consistent height */
	/* Smooth transition for visibility and position */
	transition: opacity 0.3s ease-out, transform 0.3s ease-out;
	opacity: 1;
	pointer-events: auto;
	box-sizing: border-box; /* Ensure border is included in height calculation */
	height: calc(32px + 1rem + 2px); /* Button height (32px) + padding top/bottom (0.5rem * 2 = 1rem) + border top/bottom (1px * 2 = 2px) */
}

.whiteboard-toolbar-container.hidden {
	opacity: 0;
	transform: translateX(-50%) translateY(100px);
	pointer-events: none;
}

	.whiteboard-toolbar-content {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		height: 32px; /* Exact height to match text editor toolbar buttons */
	}

	.whiteboard-color-input {
		width: 32px;
		height: 32px;
		min-width: 32px;
		min-height: 32px;
		max-width: 32px;
		max-height: 32px;
		aspect-ratio: 1;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		cursor: pointer;
		padding: 0;
		margin: 0;
		background: transparent;
		box-sizing: border-box;
		flex-shrink: 0;
		-webkit-appearance: none;
		appearance: none;
	}

	.whiteboard-color-input::-webkit-color-swatch-wrapper {
		padding: 0;
		border: none;
		border-radius: var(--radius-sm);
	}

	.whiteboard-color-input::-webkit-color-swatch {
		border: none;
		border-radius: var(--radius-sm);
	}

	.whiteboard-width-control {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
	}

	.whiteboard-width-input {
		width: 80px;
	}

	.whiteboard-width-label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		text-align: center;
	}

	.toolbar-btn {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.375rem;
		border-radius: var(--radius-sm);
		transition: var(--transition);
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		height: 32px;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.toolbar-btn:hover {
		background: var(--bg-tertiary);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	.toolbar-btn.active {
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.toolbar-separator {
		width: 1px;
		height: 24px;
		background: var(--border-color);
		margin: 0 0.25rem;
	}

	.vertical-divider {
		width: 1px;
		height: 100%;
		background: var(--border-color);
		flex-shrink: 0;
		position: relative;
		z-index: 1;
	}

</style>