<script lang="ts">
	import Icon from './Icon.svelte';
	import { getDefaultSetting } from '../lib/settings';
	import type { SettingsStore } from '../lib/stores';
	import { mdiRepeatVariant } from '@mdi/js';
	import { createEventDispatcher } from 'svelte';

	export let targetStore$: SettingsStore<string>;
	export let label: string;

	const id = targetStore$.key();
	const dispatch = createEventDispatcher<{
		reset: void;
	}>();
</script>

<label for={id}>{label}</label>
<input type="color" {id} bind:value={$targetStore$} on:change />
<button
	title="Reset Color"
	on:click={() => {
		targetStore$.set(getDefaultSetting(id));

		dispatch('reset');
	}}
>
	<Icon path={mdiRepeatVariant} />
</button>
