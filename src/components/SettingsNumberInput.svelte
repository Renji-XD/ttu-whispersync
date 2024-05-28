<script lang="ts">
	import Icon from './Icon.svelte';
	import { skipKeys } from '../lib/actions';
	import type { EventWithElement } from '../lib/general';
	import { skipKeyListener$, type SettingsStore } from '../lib/stores';
	import { onNumberFieldChange } from '../lib/util';
	import { mdiHelpCircle } from '@mdi/js';
	import Popover from './Popover.svelte';

	export let targetStore$: SettingsStore<number>;
	export let label: string;
	export let helpText: string;
	export let disabled: boolean | undefined = undefined;
	export let min: number | undefined = undefined;
	export let max: number | undefined = undefined;
	export let step: number = 100;
	export let blurHandler:
		| ((event: EventWithElement<HTMLInputElement>, targetStore: SettingsStore<number>) => void)
		| undefined = undefined;

	const id = targetStore$.key();
</script>

<label for={id}>{label}</label>
<input
	type="number"
	value={$targetStore$}
	{id}
	{disabled}
	{min}
	{max}
	{step}
	on:change={(event) => {
		if (!blurHandler) {
			onNumberFieldChange(event, targetStore$);
		}
	}}
	on:blur={(event) => {
		if (blurHandler) {
			blurHandler(event, targetStore$);
		}
	}}
	use:skipKeys={{ document, isSkipped: $skipKeyListener$ }}
/>
<Popover>
	<div slot="icon">
		<Icon path={mdiHelpCircle} />
	</div>
	<div>{helpText}</div>
</Popover>
