<script lang="ts">
	import { skipKeys } from '../lib/actions';
	import type { EventWithElement } from '../lib/general';
	import { skipKeyListener$ } from '../lib/stores';
	import { onNumberFieldChangeWithDefault } from '../lib/util';
	import { createEventDispatcher } from 'svelte';

	export let value: number;
	export let defaultValue: number;
	export let min = 0;
	export let max = 59;
	export let step = 1;

	const dispatch = createEventDispatcher<{ changed: void }>();

	async function onTimeValueChange(event: EventWithElement<HTMLInputElement>) {
		await onNumberFieldChangeWithDefault(event, defaultValue);

		dispatch('changed');
	}
</script>

<input
	type="number"
	class="time-input"
	{min}
	{max}
	{step}
	bind:value
	on:change={onTimeValueChange}
	use:skipKeys={{ document, isSkipped: $skipKeyListener$ }}
/>
