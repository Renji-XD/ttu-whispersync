<script lang="ts">
	import Icon from './Icon.svelte';
	import { executeAction } from '../lib/actions';
	import type { Subtitle } from '../lib/general';

	export let path: string;
	export let title: string;
	export let action: string;
	export let skipUpdates = false;
	export let ignoreSkipKeyListener = false;
	export let buttonClasses = 'm-y-xs';
	export let buttonStyles = '';
	export let iconStyles = '';
	export let subtitle: Subtitle[] | Subtitle | undefined = undefined;
	export let clickHandler: (() => void) | undefined = undefined;
</script>

<button
	{title}
	style={buttonStyles}
	class={buttonClasses}
	disabled={title !== action}
	on:click={() => {
		clickHandler?.();

		executeAction(action, subtitle, {
			skipUpdates,
			ignoreSkipKeyListener,
			mergeSubtitles: false,
			keepPauseState: false,
			persistAlignment: true,
		});
	}}
>
	<Icon {path} {iconStyles} />
</button>
