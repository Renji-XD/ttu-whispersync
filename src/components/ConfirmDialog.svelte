<script lang="ts">
	import DialogTemplate from './DialogTemplate.svelte';
	import { createEventDispatcher } from 'svelte';

	export let dialogHeader: string;
	export let dialogMessage: string;
	export let contentStyles: string;
	export let showCancel = true;
	export let resolver: (arg0: boolean) => void;

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	function closeDialog(wasCanceled = false) {
		resolver(wasCanceled);

		dispatch('close');
	}
</script>

<DialogTemplate>
	<svelte:fragment slot="header">{dialogHeader}</svelte:fragment>
	<svelte:fragment slot="content">
		<p style={contentStyles}>{dialogMessage}</p>
	</svelte:fragment>
	<div class="flex grow justify-between" slot="footer">
		<button class:invisible={!showCancel} on:click={() => closeDialog(true)}>Cancel</button>
		<button on:click={() => closeDialog()}>Confirm</button>
	</div>
</DialogTemplate>
