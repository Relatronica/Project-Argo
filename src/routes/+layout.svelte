<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { isDarkTheme, updateBodyClass } from '../lib/stores/themeStore.js';

	let mounted = false;

	onMount(() => {
		mounted = true;
		// Apply initial theme
		updateBodyClass($isDarkTheme);
	});

	// Update body class when theme changes
	$: if (mounted) {
		updateBodyClass($isDarkTheme);
	}
</script>

<svelte:body class={$isDarkTheme ? 'dark' : 'light'} />

<slot />

