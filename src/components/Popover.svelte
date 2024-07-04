<script lang="ts">
	import { autoUpdate, computePosition, flip, offset, shift, type Placement } from '@floating-ui/dom';
	import { clickOutside } from '../lib/actions';
	import { tick } from 'svelte';

	export let placement: Placement = 'left';
	export let fallbackPlacements: Placement[] = ['right', 'top', 'left'];

	export function hide() {
		cleanup?.();
		isOpen = false;
	}

	let triggerElement: HTMLButtonElement;
	let popoverElement: HTMLDivElement;
	let isOpen = false;
	let cleanup: () => void;

	async function onTogglePopover() {
		if (isOpen) {
			return hide();
		}

		isOpen = true;

		await tick();

		cleanup = autoUpdate(triggerElement, popoverElement, updatePosition);
	}

	function updatePosition() {
		computePosition(triggerElement, popoverElement, {
			placement,
			middleware: [offset(5), flip({ fallbackPlacements }), shift()],
		})
			.then(({ x, y }) => {
				popoverElement.style.left = `${x}px`;
				popoverElement.style.top = `${y}px`;
			})
			.catch(() => {
				// no-op
			});
	}
</script>

<div class="flex">
	<button bind:this={triggerElement} on:click={onTogglePopover}>
		<slot name="icon" />
	</button>
	{#if isOpen}
		<div
			class="ttu-whispersync-container popover"
			bind:this={popoverElement}
			use:clickOutside={({ target }) => {
				if (!(target instanceof Element)) {
					return;
				}

				if (target !== triggerElement && !triggerElement.contains(target)) {
					hide();
				}
			}}
		>
			<slot />
		</div>
	{/if}
</div>
