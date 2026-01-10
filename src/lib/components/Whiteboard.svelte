<script>
	import { onMount, onDestroy } from 'svelte';
	import { currentNote, saveCurrentNote, hasUnsavedChanges } from '../stores/notesStore.js';
	
	let canvas;
	let ctx;
	let isDrawing = false;
	let lastX = 0;
	let lastY = 0;
	let mouseX = 0;
	let mouseY = 0;
	let isMouseOver = false;
	let canvasRect = null;
	export let currentTool = 'pen'; // 'pen', 'eraser', 'pan'
	export let currentColor = '#000000';
	export let lineWidth = 2;
	export let isActive = false;
	export let paths = []; // Array of drawing paths - fully controlled by parent
	export let onPathAdd = null; // Callback when a new path is drawn
	export let onPathsChange = null; // Callback when paths need to be changed (for backwards compatibility)

	// Fully controlled component - no manual path updates needed

	// Keyboard event handlers
	let handleKeyDown = null, handleKeyUp = null;
	
	// Zoom and pan state
	let scale = 1;
	let offsetX = 0;
	let offsetY = 0;
	let isPanning = false;
	let panStartX = 0;
	let panStartY = 0;
	let isSpacePressed = false;
	const minScale = 0.1;
	const maxScale = 5;
	const zoomSensitivity = 0.001;
	
	// Expose functions
	export function setTool(tool) {
		currentTool = tool;
	}

	export function setColor(color) {
		currentColor = color;
	}

	export function setLineWidth(width) {
		lineWidth = width;
	}

	export function clearCanvas() {
		currentPath = null;

		if (ctx && canvas) {
			try {
				ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
			} catch (error) {
				console.error('[Whiteboard] Error clearing canvas:', error);
			}
		}

		// Fully controlled: notify parent to clear paths
		if (onPathsChange) {
			onPathsChange([]);
		} else {
			console.warn('[Whiteboard] No path handler provided - clear operation ignored');
		}
	}
	
	export function zoomIn() {
		const newScale = Math.min(scale * 1.2, maxScale);
		setZoom(newScale);
	}
	
	export function zoomOut() {
		const newScale = Math.max(scale / 1.2, minScale);
		setZoom(newScale);
	}
	
	export function resetView() {
		scale = 1;
		offsetX = 0;
		offsetY = 0;
		redraw();
	}
	
	function setZoom(newScale, centerX = null, centerY = null) {
		if (!canvas) return;
		
		// If no center point provided, use canvas center
		if (centerX === null || centerY === null) {
			centerX = canvas.width / window.devicePixelRatio / 2;
			centerY = canvas.height / window.devicePixelRatio / 2;
		}
		
		// Calculate new offset to keep the center point in the same position
		offsetX = centerX - (centerX - offsetX) * (newScale / scale);
		offsetY = centerY - (centerY - offsetY) * (newScale / scale);
		
		scale = newScale;
		redraw();
	}
	let autoSaveTimer = null;
	
	// Drawing state - no internal paths storage, fully controlled by parent
	let currentPath = null;
	let drawingStartTime = null; // Track when drawing started to prevent conflicts
	let lastEventType = null; // Track last event type to prevent mouse/touch conflicts
	let lastSaveTime = 0; // Track when we last saved to avoid immediate reloads

	// React to paths changes from parent - fully controlled component
	$: if (Array.isArray(paths) && canvas && ctx) {
		redraw();
	}

	let resizeObserver = null;

	onMount(() => {
		if (canvas) {
			ctx = canvas.getContext('2d');
			initCanvas();

			// Set up ResizeObserver for efficient resize handling
			resizeObserver = new ResizeObserver(() => {
				handleResize();
			});
			resizeObserver.observe(canvas);

			// Add wheel event for zoom
			canvas.addEventListener('wheel', handleWheel, { passive: false });
		}

		// Add keyboard listeners for space key (pan mode) - improved isolation
		handleKeyDown = (e) => {
			// Only log space key events to reduce console spam
			if (e.code === 'Space') {
				console.log('[Whiteboard] handleKeyDown: Space key pressed');
			}

			// Don't do anything if whiteboard is not active
			if (!isActive) return;

			// More comprehensive check to avoid interfering with text editing
			const activeElement = document.activeElement;
			const isInTextEditor = activeElement && (
				activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA' ||
				activeElement.contentEditable === 'true' ||
				activeElement.classList.contains('ProseMirror') ||
				activeElement.closest('.editor-content')
			);

			// Don't capture space if user is typing in any input field or editor
			if (e.code === 'Space' && !isSpacePressed && !isInTextEditor) {
				console.log('[Whiteboard] handleKeyDown: capturing space key for panning');
				e.preventDefault();
				e.stopPropagation(); // Prevent event bubbling
				isSpacePressed = true;
			}
		};

		handleKeyUp = (e) => {
			// Don't do anything if whiteboard is not active
			if (!isActive) return;

			// Same comprehensive check
			const activeElement = document.activeElement;
			const isInTextEditor = activeElement && (
				activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA' ||
				activeElement.contentEditable === 'true' ||
				activeElement.classList.contains('ProseMirror') ||
				activeElement.closest('.editor-content')
			);

			// Don't interfere with text editing
			if (e.code === 'Space' && !isInTextEditor) {
				console.log('[Whiteboard] handleKeyUp: releasing space key for panning');
				e.preventDefault();
				e.stopPropagation(); // Prevent event bubbling
				isSpacePressed = false;
				if (isPanning) {
					isPanning = false;
				}
			}
		};

		console.log('[Whiteboard] adding window event listeners');
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		return () => {
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
			if (resizeTimer) {
				clearTimeout(resizeTimer);
			}
			if (canvas) {
				canvas.removeEventListener('wheel', handleWheel);
			}
		};
	});


	onDestroy(() => {
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
		}
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
		if (resizeTimer) {
			clearTimeout(resizeTimer);
		}
		if (handleKeyDown && handleKeyUp) {
			console.log('[Whiteboard] removing window event listeners');
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		}
		handleKeyDown = null;
		handleKeyUp = null;
	});
	
	function initCanvas() {
		if (!canvas) return;

		// Get fresh context if needed
		if (!ctx) {
			ctx = canvas.getContext('2d');
		}

		if (!ctx) {
			console.error('Failed to get canvas context');
			return;
		}

		// Set canvas size
		const rect = canvas.getBoundingClientRect();
		canvasRect = rect;

		// Store old dimensions to check if resize is needed
		const oldWidth = canvas.width;
		const oldHeight = canvas.height;

		canvas.width = rect.width * window.devicePixelRatio;
		canvas.height = rect.height * window.devicePixelRatio;

		// Only redraw if canvas was actually resized (to avoid losing content unnecessarily)
		if (canvas.width !== oldWidth || canvas.height !== oldHeight) {
			// Redraw existing paths
			redraw();
		}
	}
	
	// Fully controlled component - no internal data loading needed
	
	// Fully controlled component - parent handles all state management
	
	function redraw() {
		console.log('[Whiteboard] Redraw called, paths length:', paths.length, 'currentPath:', !!currentPath);

		if (!canvas) {
			console.log('[Whiteboard] No canvas, skipping redraw');
			return;
		}

		// Ensure we have a valid context
		if (!ctx) {
			console.log('[Whiteboard] Creating new canvas context');
			ctx = canvas.getContext('2d');
		}

		if (!ctx) {
			console.error('[Whiteboard] Canvas context lost during redraw');
			return;
		}

		try {
			// Save the context state
			ctx.save();

			// Set initial transform with device pixel ratio
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

			// Clear canvas in logical coordinates
			ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);

			// Apply zoom and pan transformations IN LOGICAL COORDINATES
			ctx.translate(offsetX, offsetY);
			ctx.scale(scale, scale);

			// Set default styles
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			// Redraw all completed paths
			paths.forEach(path => {
				if (path.points.length < 2) return;

				ctx.strokeStyle = path.color || '#000000';
				ctx.lineWidth = path.width || 2;
				ctx.globalCompositeOperation = path.tool === 'eraser' ? 'destination-out' : 'source-over';

				ctx.beginPath();
				ctx.moveTo(path.points[0].x, path.points[0].y);

				for (let i = 1; i < path.points.length; i++) {
					ctx.lineTo(path.points[i].x, path.points[i].y);
				}

				ctx.stroke();
			});

			// Draw current path (if drawing)
			if (currentPath && currentPath.points.length >= 2) {
				ctx.strokeStyle = currentPath.color || currentColor;
				ctx.lineWidth = currentPath.width || lineWidth;
				ctx.globalCompositeOperation = currentPath.tool === 'eraser' ? 'destination-out' : 'source-over';

				ctx.beginPath();
				ctx.moveTo(currentPath.points[0].x, currentPath.points[0].y);

				for (let i = 1; i < currentPath.points.length; i++) {
					ctx.lineTo(currentPath.points[i].x, currentPath.points[i].y);
				}

				ctx.stroke();
			}

			ctx.globalCompositeOperation = 'source-over';

		} finally {
			// Always restore the context state
			ctx.restore();
		}
	}
	
	function getCanvasRect() {
		if (!canvasRect || !canvas) {
			canvasRect = canvas.getBoundingClientRect();
		}
		return canvasRect;
	}
	
	/**
	 * Convert screen coordinates to world coordinates (accounting for zoom/pan)
	 * Screen -> Canvas Logical -> World
	 */
	function getMousePos(e) {
		const rect = getCanvasRect();
		// Convert screen to canvas logical coordinates
		const canvasX = (e.clientX - rect.left) * (canvas.width / window.devicePixelRatio / rect.width);
		const canvasY = (e.clientY - rect.top) * (canvas.height / window.devicePixelRatio / rect.height);
		
		// Apply inverse transformations to get world coordinates (where we actually draw)
		return {
			x: (canvasX - offsetX) / scale,
			y: (canvasY - offsetY) / scale
		};
	}
	
	/**
	 * Update HTML cursor position (follows mouse in screen coordinates)
	 */
	function updateCursorPosition(e) {
		if (!canvas) return;
		const rect = getCanvasRect();
		mouseX = e.clientX - rect.left;
		mouseY = e.clientY - rect.top;
	}
	
	function handleMouseEnter() {
		isMouseOver = true;
	}
	
	function handleMouseLeave() {
		isMouseOver = false;
	}
	
	function startDrawing(e) {
		// Prevent duplicate drawing sessions and mouse/touch conflicts
		if (isDrawing) return;

		// Track event type to prevent conflicts between mouse and touch
		const eventType = e.type.startsWith('touch') ? 'touch' : 'mouse';
		if (lastEventType && lastEventType !== eventType && Date.now() - (drawingStartTime || 0) < 100) {
			return; // Ignore conflicting events within 100ms
		}
		lastEventType = eventType;

		// Handle panning
		if (currentTool === 'pan' || isSpacePressed) {
			isPanning = true;
			const rect = getCanvasRect();
			// Convert to canvas logical coordinates
			const canvasX = (e.clientX - rect.left) * (canvas.width / window.devicePixelRatio / rect.width);
			const canvasY = (e.clientY - rect.top) * (canvas.height / window.devicePixelRatio / rect.height);
			panStartX = canvasX - offsetX;
			panStartY = canvasY - offsetY;
			return;
		}

		// Handle drawing
		isDrawing = true;
		drawingStartTime = Date.now();
		const pos = getMousePos(e);
		lastX = pos.x;
		lastY = pos.y;

		currentPath = {
			tool: currentTool,
			color: currentColor,
			width: lineWidth,
			points: [{ x: lastX, y: lastY }]
		};
	}
	
	function draw(e) {
		// Prevent conflicts between mouse and touch events
		const eventType = e.type.startsWith('touch') ? 'touch' : 'mouse';
		if (lastEventType && lastEventType !== eventType) {
			return; // Ignore events from different input type during drawing
		}

		// Handle panning
		if (isPanning) {
			const rect = getCanvasRect();
			// Convert to canvas logical coordinates
			const canvasX = (e.clientX - rect.left) * (canvas.width / window.devicePixelRatio / rect.width);
			const canvasY = (e.clientY - rect.top) * (canvas.height / window.devicePixelRatio / rect.height);
			offsetX = canvasX - panStartX;
			offsetY = canvasY - panStartY;
			redraw();
			return;
		}

		if (!isDrawing || !ctx || !currentPath) {
			console.log('[Whiteboard] draw called but not ready:', { isDrawing, hasCtx: !!ctx, hasCurrentPath: !!currentPath });
			return;
		}
		
		const pos = getMousePos(e);
		
		if ((currentTool === 'pen' || currentTool === 'eraser') && currentPath) {
			// Save the current state
			ctx.save();

			// Set transform with device pixel ratio
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

			// Apply zoom and pan transformations IN LOGICAL COORDINATES
			ctx.translate(offsetX, offsetY);
			ctx.scale(scale, scale);

			// Set drawing styles
			const strokeStyle = currentTool === 'eraser' ? 'rgba(0,0,0,1)' : currentColor;
			ctx.strokeStyle = strokeStyle;
			ctx.lineWidth = lineWidth;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			const compositeOp = currentTool === 'eraser' ? 'destination-out' : 'source-over';
			ctx.globalCompositeOperation = compositeOp;

			// Draw the line segment IN WORLD COORDINATES
			ctx.beginPath();
			ctx.moveTo(lastX, lastY);
			ctx.lineTo(pos.x, pos.y);
			ctx.stroke();

			// Restore the context
			ctx.restore();

			// Add point to current path (world coordinates)
			currentPath.points.push({ x: pos.x, y: pos.y });

			// Don't redraw here - just draw the segment directly for smooth real-time drawing
		}

		lastX = pos.x;
		lastY = pos.y;
	}
	
	function stopDrawing() {
		// Prevent multiple calls for the same drawing session
		if (!isDrawing) return;

		// Stop panning
		if (isPanning) {
			isPanning = false;
			return;
		}

		isDrawing = false;
		const drawingDuration = drawingStartTime ? Date.now() - drawingStartTime : 0;
		drawingStartTime = null;
		lastEventType = null;

		if (currentPath && currentPath.points.length > 0) {
			// Save valid paths (at least 1 point)
			if (currentPath.points.length >= 1) {
				console.log('[Whiteboard] Adding new path:', {
					points: currentPath.points.length,
					duration: drawingDuration
				});

				// Fully controlled: notify parent to add the path
				if (onPathAdd) {
					onPathAdd(currentPath);
				} else if (onPathsChange) {
					// Backwards compatibility
					const newPaths = [...paths, currentPath];
					onPathsChange(newPaths);
				} else {
					// Fallback for standalone usage
					console.warn('[Whiteboard] No path handler provided - path will be lost');
				}
			}
		}

		// Clear drawing state
		if (ctx) {
			ctx.globalCompositeOperation = 'source-over';
		}

		// Redraw canvas to ensure consistency after drawing is complete
		redraw();

		// Now it's safe to clear current path
		currentPath = null;

		// Check if there's a pending resize that was delayed due to active drawing
		if (resizeTimer) {
			clearTimeout(resizeTimer);
			resizeTimer = null;
			canvasRect = null;
			initCanvas();
			redraw();
		}
	}
	
	// Fully controlled component - parent handles all saving
	
	
	// Handle zoom with mouse wheel - improved isolation
	function handleWheel(e) {
		// Check if we're interfering with text editing
		const activeElement = document.activeElement;
		const isInTextEditor = activeElement && (
			activeElement.tagName === 'INPUT' ||
			activeElement.tagName === 'TEXTAREA' ||
			activeElement.contentEditable === 'true' ||
			activeElement.classList.contains('ProseMirror') ||
			activeElement.closest('.editor-content')
		);

		// Don't handle wheel events if user is in text editor
		if (isInTextEditor) {
			return; // Let the event bubble normally
		}

		console.log('[Whiteboard] handleWheel: handling zoom event');
		e.preventDefault();
		e.stopPropagation();

		const rect = getCanvasRect();
		const mouseX = (e.clientX - rect.left) * (canvas.width / window.devicePixelRatio / rect.width);
		const mouseY = (e.clientY - rect.top) * (canvas.height / window.devicePixelRatio / rect.height);

		// Calculate zoom factor
		const delta = e.deltaY * -zoomSensitivity;
		const newScale = Math.min(Math.max(scale * (1 + delta), minScale), maxScale);

		// Zoom centered on mouse position
		setZoom(newScale, mouseX, mouseY);
	}
	
	// Handle window resize with debouncing
	let resizeTimer = null;
	let lastCanvasSize = { width: 0, height: 0 };

	function handleResize() {
		if (resizeTimer) {
			clearTimeout(resizeTimer);
		}
		resizeTimer = setTimeout(() => {
			// Don't resize canvas while actively drawing to avoid losing current stroke
			if (!isDrawing && canvas) {
				const rect = canvas.getBoundingClientRect();
				// Only resize if dimensions actually changed
				if (rect.width !== lastCanvasSize.width || rect.height !== lastCanvasSize.height) {
					lastCanvasSize = { width: rect.width, height: rect.height };
					canvasRect = null; // Invalidate cache
					initCanvas();
					redraw();
				}
			}
		}, 100);
	}
	
	// Cursor size with minimum visibility, scaled by zoom
	$: cursorSize = Math.max(lineWidth * scale, 4);
</script>

<div class="whiteboard-container">
	<canvas
		bind:this={canvas}
		class="whiteboard-canvas"
		tabindex="-1"
		class:pen-cursor={currentTool === 'pen' && isMouseOver && !isSpacePressed}
		class:eraser-cursor={currentTool === 'eraser' && isMouseOver && !isSpacePressed}
		class:pan-cursor={currentTool === 'pan' || isSpacePressed}
		class:panning-cursor={isPanning}
		on:mousedown={(e) => { e.stopPropagation(); startDrawing(e); }}
		on:mousemove={(e) => {
			e.stopPropagation();
			updateCursorPosition(e);
			if (isDrawing || isPanning) {
				draw(e);
			}
		}}
		on:mouseup={(e) => { e.stopPropagation(); stopDrawing(e); }}
		on:mouseleave={(e) => { e.stopPropagation(); handleMouseLeave(); stopDrawing(e); }}
		on:mouseenter={(e) => { e.stopPropagation(); handleMouseEnter(e); }}
		on:touchstart={(e) => { e.preventDefault(); e.stopPropagation(); startDrawing(e.touches[0]); }}
		on:touchmove={(e) => { e.preventDefault(); e.stopPropagation(); draw(e.touches[0]); }}
		on:touchend={(e) => { e.preventDefault(); e.stopPropagation(); stopDrawing(); }}
	></canvas>
	{#if (currentTool === 'pen' || currentTool === 'eraser') && isMouseOver && !isSpacePressed && !isPanning}
		<div 
			class="brush-cursor"
			class:eraser={currentTool === 'eraser'}
			style="left: {mouseX}px; top: {mouseY}px; width: {cursorSize}px; height: {cursorSize}px;"
		></div>
	{/if}
	
	<!-- Zoom indicator -->
	{#if scale !== 1}
		<div class="zoom-indicator">
			{Math.round(scale * 100)}%
		</div>
	{/if}
</div>

<style>
	.whiteboard-container {
		display: flex;
		flex-direction: row;
		height: 100%;
		width: 100%;
		background: var(--bg-primary);
		position: relative;
		overflow: hidden;
	}
	
	.whiteboard-toolbar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1rem 0.75rem;
		border-left: 1px solid var(--border-color);
		background: var(--bg-secondary);
		flex-shrink: 0;
		width: 60px;
	}
	
	.toolbar-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}
	
	.tool-btn {
		background: transparent;
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
	
	.tool-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}
	
	.tool-btn.active {
		background: var(--accent-light);
		color: var(--accent-color);
		border-color: var(--accent-color);
	}
	
	.color-input {
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		cursor: pointer;
		padding: 0;
		background: transparent;
	}
	
	.width-input {
		width: 80%;
		writing-mode: bt-lr; /* Vertical orientation */
		-webkit-appearance: slider-vertical;
		appearance: slider-vertical;
		height: 80px;
	}
	
	.width-label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		text-align: center;
	}
	
	.whiteboard-canvas {
		flex: 1;
		width: 100%;
		height: 100%;
		cursor: crosshair;
		touch-action: none;
		min-width: 0;
		background-image: radial-gradient(circle, var(--border-color) 1px, transparent 1px);
		background-size: 20px 20px;
		background-position: 0 0;
		will-change: contents;
		image-rendering: -webkit-optimize-contrast;
		image-rendering: crisp-edges;
	}
	
	.whiteboard-canvas.pen-cursor,
	.whiteboard-canvas.eraser-cursor {
		cursor: none;
	}
	
	.whiteboard-canvas.pan-cursor {
		cursor: grab;
	}
	
	.whiteboard-canvas.panning-cursor {
		cursor: grabbing;
	}
	
	.brush-cursor {
		position: absolute;
		pointer-events: none;
		border-radius: 50%;
		border: 1.5px solid var(--text-primary);
		background: transparent;
		box-sizing: border-box;
		z-index: 1000;
		transform: translate(-50%, -50%);
		mix-blend-mode: difference;
		opacity: 0.8;
		will-change: transform, left, top;
	}
	
	.brush-cursor.eraser {
		border-color: var(--text-primary);
		background: rgba(255, 255, 255, 0.2);
		border-style: dashed;
		mix-blend-mode: normal;
	}
	
	.zoom-indicator {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
		pointer-events: none;
		z-index: 10;
		box-shadow: var(--shadow-sm);
	}
</style>

