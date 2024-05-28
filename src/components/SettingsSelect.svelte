<script lang="ts">
	import Icon from './Icon.svelte';
	import type { SettingsStore } from '../lib/stores';
	import { mdiHelpCircle } from '@mdi/js';
	import Popover from './Popover.svelte';

	export let targetStore$: SettingsStore<string>;
	export let options: string[];
	export let label: string;
	export let helpText: string = '';
	export let buttonIcon: string = '';
	export let buttonTitle: string = '';
	export let disabled = false;

	const id = targetStore$.key();
</script>

<label for={id}>{label}</label>
<select disabled={!options.length || disabled} {id} bind:value={$targetStore$} on:change>
	{#each options as option (option)}
		<option value={option}>
			{option}
		</option>
	{/each}
</select>
{#if helpText}
	<Popover>
		<div slot="icon">
			<Icon path={mdiHelpCircle} />
		</div>
		<div>{helpText}</div>
	</Popover>
{:else if buttonIcon}
	<button title={buttonTitle}>
		<Icon path={buttonIcon} on:click />
	</button>
{:else}
	<div></div>
{/if}
