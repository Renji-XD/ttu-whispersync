<script lang="ts">
	export let path: string;
	export let width = '1.4rem';
	export let height = '1.4rem';
	export let element: SVGElement | undefined = undefined;
	export { _class as class };

	let _class = '';
</script>

<svg
	tabindex="0"
	role="button"
	style="width: {width}; height: {height};"
	viewBox="0 0 24 24"
	fill="currentColor"
	class={`icon ${_class}`}
	bind:this={element}
	on:click
	on:keyup
>
	<path d={path} />
</svg>
