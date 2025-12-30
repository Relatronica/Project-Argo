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
	export let currentTool = 'pen'; // 'pen', 'eraser', 'select'
	export let currentColor = '#000000';
	export let lineWidth = 2;
	
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
		paths = [];
		if (ctx) {
			ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
		}
		// Mark as having unsaved changes when clearing canvas
		hasUnsavedChanges.set(true);
		saveWhiteboardData();
	}
	let autoSaveTimer = null;
	
	// Whiteboard data structure
	let paths = [];
	let currentPath = null;
	let lastNoteId = null;
	
	let resizeObserver = null;
	
	onMount(() => {
		if (canvas) {
			ctx = canvas.getContext('2d');
			initCanvas();
			loadWhiteboardData();
			if ($currentNote) {
				lastNoteId = $currentNote.id;
			}
			
			// Set up ResizeObserver for efficient resize handling
			resizeObserver = new ResizeObserver(() => {
				handleResize();
			});
			resizeObserver.observe(canvas);
		}
		
		return () => {
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
			if (resizeTimer) {
				clearTimeout(resizeTimer);
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
	});
	
	function initCanvas() {
		if (!canvas || !ctx) return;
		
		// Set canvas size
		const rect = canvas.getBoundingClientRect();
		canvasRect = rect;
		canvas.width = rect.width * window.devicePixelRatio;
		canvas.height = rect.height * window.devicePixelRatio;
		ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
		
		// Set default styles
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = currentColor;
		ctx.lineWidth = lineWidth;
		
		// Redraw existing paths
		redraw();
	}
	
	function loadWhiteboardData() {
		if (!$currentNote || !$currentNote.whiteboardData) {
			paths = [];
			redraw();
			return;
		}
		
		try {
			const data = typeof $currentNote.whiteboardData === 'string' 
				? JSON.parse($currentNote.whiteboardData) 
				: $currentNote.whiteboardData;
			paths = data.paths || [];
			redraw();
		} catch (error) {
			console.error('Error loading whiteboard data:', error);
			paths = [];
			redraw();
		}
	}
	
	// React to note changes - reload whiteboard data when note changes
	$: if ($currentNote && canvas && ctx) {
		// Note changed - load new note's whiteboard data
		if (lastNoteId !== $currentNote.id) {
			// Clear any pending auto-save timer when switching notes
			// (The previous note's data should have been saved by saveWhiteboardData()
			// when paths were modified, but we clear the timer to avoid saving to wrong note)
			if (autoSaveTimer) {
				clearTimeout(autoSaveTimer);
				autoSaveTimer = null;
			}
			
			lastNoteId = $currentNote.id;
			loadWhiteboardData();
		}
	}
	
	function redraw() {
		if (!canvas || !ctx) return;
		
		// Clear canvas
		ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
		
		// Redraw all paths
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
		
		ctx.globalCompositeOperation = 'source-over';
	}
	
	function getCanvasRect() {
		if (!canvasRect || !canvas) {
			canvasRect = canvas.getBoundingClientRect();
		}
		return canvasRect;
	}
	
	function getMousePos(e) {
		const rect = getCanvasRect();
		return {
			x: (e.clientX - rect.left) * (canvas.width / window.devicePixelRatio / rect.width),
			y: (e.clientY - rect.top) * (canvas.height / window.devicePixelRatio / rect.height)
		};
	}
	
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
		isDrawing = true;
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
		if (!isDrawing || !ctx) return;
		
		const pos = getMousePos(e);
		
		if (currentTool === 'pen' || currentTool === 'eraser') {
			// Only update styles if they changed
			const strokeStyle = currentTool === 'eraser' ? 'rgba(0,0,0,1)' : currentColor;
			if (ctx.strokeStyle !== strokeStyle) {
				ctx.strokeStyle = strokeStyle;
			}
			if (ctx.lineWidth !== lineWidth) {
				ctx.lineWidth = lineWidth;
			}
			const compositeOp = currentTool === 'eraser' ? 'destination-out' : 'source-over';
			if (ctx.globalCompositeOperation !== compositeOp) {
				ctx.globalCompositeOperation = compositeOp;
			}
			
			ctx.beginPath();
			ctx.moveTo(lastX, lastY);
			ctx.lineTo(pos.x, pos.y);
			ctx.stroke();
			
			currentPath.points.push({ x: pos.x, y: pos.y });
		}
		
		lastX = pos.x;
		lastY = pos.y;
	}
	
	function stopDrawing() {
		if (!isDrawing) return;
		isDrawing = false;

		if (currentPath && currentPath.points.length > 0) {
			paths.push(currentPath);
			// Mark as having unsaved changes when drawing
			hasUnsavedChanges.set(true);
			saveWhiteboardData();
		}

		currentPath = null;
		ctx.globalCompositeOperation = 'source-over';
	}
	
	function saveWhiteboardData() {
		if (!$currentNote) return;
		
		// Clear existing timer
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
		}
		
		// Set new timer for auto-save (2 seconds after last change)
		autoSaveTimer = setTimeout(async () => {
			if ($currentNote) {
				$currentNote.whiteboardData = JSON.stringify({ paths });
				await saveCurrentNote();
			}
		}, 2000);
	}
	
	
	// Handle window resize with debouncing
	let resizeTimer = null;
	function handleResize() {
		if (resizeTimer) {
			clearTimeout(resizeTimer);
		}
		resizeTimer = setTimeout(() => {
			canvasRect = null; // Invalidate cache
			initCanvas();
			redraw();
		}, 100);
	}
	
	// Cursor size with minimum visibility
	$: cursorSize = Math.max(lineWidth, 4);
</script>

<div class="whiteboard-container">
	<canvas
		bind:this={canvas}
		class="whiteboard-canvas"
		class:pen-cursor={currentTool === 'pen' && isMouseOver}
		class:eraser-cursor={currentTool === 'eraser' && isMouseOver}
		on:mousedown={startDrawing}
		on:mousemove={(e) => { 
			updateCursorPosition(e);
			if (isDrawing) {
				draw(e);
			}
		}}
		on:mouseup={stopDrawing}
		on:mouseleave={(e) => { handleMouseLeave(); stopDrawing(e); }}
		on:mouseenter={handleMouseEnter}
		on:touchstart={(e) => { e.preventDefault(); startDrawing(e.touches[0]); }}
		on:touchmove={(e) => { e.preventDefault(); draw(e.touches[0]); }}
		on:touchend={(e) => { e.preventDefault(); stopDrawing(); }}
	></canvas>
	{#if (currentTool === 'pen' || currentTool === 'eraser') && isMouseOver}
		<div 
			class="brush-cursor"
			class:eraser={currentTool === 'eraser'}
			style="left: {mouseX}px; top: {mouseY}px; width: {cursorSize}px; height: {cursorSize}px;"
		></div>
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
</style>

