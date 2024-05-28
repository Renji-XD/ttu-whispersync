<script lang="ts">
	import type { Dialog } from '../lib/general';
	import { dialogs$, skipKeyListener$ } from '../lib/stores';

	let dialog: Dialog | undefined;
	let zIndex = '';

	$: if ($dialogs$.length && !dialog) {
		nextDialog();
	}

	function closeDialog() {
		$dialogs$ = $dialogs$.slice(0, -1);

		nextDialog();
	}

	function nextDialog() {
		const nextIndex = $dialogs$.length - 1;

		dialog = $dialogs$[nextIndex];
		zIndex = $dialogs$[nextIndex]?.zIndex || '';

		$skipKeyListener$ = !!dialog;
	}
</script>

{#if dialog}
	<div
		class="ttu-whispersync-dialog writing-horizontal-tb fixed inset-0 w-full h-full"
		style:z-index={zIndex}
		on:wheel|passive|stopPropagation
	>
		<div tabindex="0" role="button" class="absolute inset-0 tap-highlight-transparent bg-black/[.32]" />
		<div
			class="ttu-whispersync-container dialog-container relative top-1/2 left-1/2 inline-block -translate-x-1/2 -translate-y-1/2"
		>
			{#if typeof dialog.component === 'string'}
				{@html dialog.component}
			{:else}
				<svelte:component this={dialog.component} {...dialog.props} on:close={closeDialog} />
			{/if}
		</div>
	</div>
{/if}
