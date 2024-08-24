<script lang="ts">
	import Icon from './Icon.svelte';
	import { skipKeys } from '../lib/actions';
	import type { EventWithElement } from '../lib/general';
	import { getDefaultSetting } from '../lib/settings';
	import { skipKeyListener$, type SettingsStore } from '../lib/stores';
	import { mdiRepeatVariant } from '@mdi/js';
	import { createEventDispatcher } from 'svelte';

	export let targetStore$: SettingsStore<string>;
	export let label: string;

	const id = targetStore$.key();
	const dispatch = createEventDispatcher<{
		change: void;
		reset: void;
	}>();

	function onTextColorBlur({ currentTarget }: EventWithElement<HTMLInputElement>) {
		if (!!currentTarget.value.match(/^#[0-9A-F]{6}$/i)) {
			$targetStore$ = currentTarget.value;
			dispatch('change');
		} else {
			currentTarget.value = $targetStore$;
		}
	}
</script>

<label for={id}>{label}</label>
<div class="flex items-center">
	<input
		type="text"
		style="max-width: 50%;"
		value={$targetStore$}
		on:blur={onTextColorBlur}
		use:skipKeys={{ document, isSkipped: $skipKeyListener$ }}
	/>
	<input class="flex-1 m-l-s" type="color" {id} bind:value={$targetStore$} on:change />
</div>

<button
	title="Reset Color"
	on:click={() => {
		targetStore$.set(getDefaultSetting(id));

		dispatch('reset');
	}}
>
	<Icon path={mdiRepeatVariant} />
</button>
