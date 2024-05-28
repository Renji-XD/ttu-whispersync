<script lang="ts">
	import Icon from './Icon.svelte';
	import type { SettingsStore } from '../lib/stores';
	import { mdiHelpCircle } from '@mdi/js';
	import Popover from './Popover.svelte';

	export let targetStore$: SettingsStore<boolean>;
	export let label: string;
	export let helpText: string;

	const id = targetStore$.key();
</script>

<label for={id}>{label}</label>
<input type="checkbox" {id} bind:checked={$targetStore$} on:change />
<Popover>
	<div slot="icon">
		<Icon path={mdiHelpCircle} />
	</div>
	<div>{helpText}</div>
</Popover>
