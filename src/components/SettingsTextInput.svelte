<script lang="ts">
	import Icon from './Icon.svelte';
	import { skipKeys } from '../lib/actions';
	import { skipKeyListener$, type SettingsStore } from '../lib/stores';
	import { onTextFieldChange } from '../lib/util';
	import { mdiHelpCircle } from '@mdi/js';
	import Popover from './Popover.svelte';

	export let targetStore$: SettingsStore<string>;
	export let label: string;
	export let helpText = '';
	export let buttonIcon = '';
	export let buttonTitle = '';

	const id = targetStore$.key();
</script>

<label for={id}>{label}</label>
<input
	value={$targetStore$}
	{id}
	on:blur
	on:change={(event) => onTextFieldChange(event, targetStore$)}
	use:skipKeys={{ document, isSkipped: $skipKeyListener$ }}
/>
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
