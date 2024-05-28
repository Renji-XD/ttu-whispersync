<script lang="ts">
	import Icon from './Icon.svelte';
	import { executeAction } from '../lib/actions';
	import type { Subtitle } from '../lib/general';

	export let path: string;
	export let title: string;
	export let action: string;
	export let buttonClasses = 'm-y-xs';
	export let subtitle: Subtitle[] | Subtitle | undefined = undefined;
</script>

<button class={buttonClasses} disabled={title !== action} {title} on:click={() => executeAction(action, subtitle)}>
	<Icon {path} />
</button>
