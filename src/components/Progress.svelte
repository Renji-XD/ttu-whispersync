<script lang="ts">
	export let currentProgress: number;
	export let height = 0.625;
	export let rounded = false;
	export let margin = false;
</script>

<div class="w-full bg-inverted" class:rounded-full={rounded} class:m-t-s={margin} style:height={`${height}rem`}>
	<div
		class="opacity-70"
		class:rounded-full={rounded}
		style:width={`${Math.min(100, currentProgress)}%`}
		style:height={`${height}rem`}
	></div>
</div>
