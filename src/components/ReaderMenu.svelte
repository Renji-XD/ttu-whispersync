<script lang="ts">
	import ActionButtonList from './ActionButtonList.svelte';
	import { computePosition, flip, inline, offset, autoUpdate, type Placement } from '@floating-ui/dom';
	import Icon from './Icon.svelte';
	import type { Context, Subtitle } from '../lib/general';
	import { currentAudioLoaded$, currentSubtitles$, isRecording$, paused$ } from '../lib/stores';
	import { mdiClose, mdiPause, mdiPlay } from '@mdi/js';
	import { createEventDispatcher, getContext, onDestroy, tick } from 'svelte';

	export let range: Range | undefined;
	export let subtitle: Subtitle | undefined;

	export function isInReaderMenu(element: Element | null) {
		if (!element || !popoverElement) {
			return false;
		}

		return popoverElement.contains(element);
	}

	const { bookContentElement, isVertical, isPaginated } = getContext<Context>('context');
	const placement: Placement = isVertical ? 'left-start' : 'top-start';
	const fallbackPlacements: Placement[] = isVertical
		? ['right-start', 'left-end', 'right-end']
		: ['bottom-start', 'top-end', 'bottom-end'];
	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	let cleanup: () => void;
	let popoverElement: HTMLDivElement;
	let bookStyles: CSSStyleDeclaration | undefined;
	let togglePlaybackTitle = '';

	$: if (!subtitle) {
		togglePlaybackTitle = $currentSubtitles$.size ? 'No matching subtitle' : 'Subtitle file required';
	} else if (!$currentAudioLoaded$) {
		togglePlaybackTitle = 'Audio file required';
	} else if ($isRecording$) {
		togglePlaybackTitle = 'Recording in progress';
	} else {
		togglePlaybackTitle = 'Toggle playback';
	}

	$: setupMenu(range);

	onDestroy(() => cleanup?.());

	async function setupMenu(rangeElement: Range | undefined) {
		cleanup?.();

		if (rangeElement) {
			await tick();

			cleanup = autoUpdate(rangeElement, popoverElement, updatePosition);
		}
	}

	function updatePosition() {
		if (!range) {
			return;
		}

		computePosition(
			{
				getBoundingClientRect: () => range.getBoundingClientRect(),
				// @ts-expect-error
				getClientRects: () => {
					if (!isPaginated) {
						return range.getClientRects();
					}

					const rect1 = getReferencePoints();
					const clientRects = [...range.getClientRects()];
					const visibleRects = clientRects.filter(
						(rect2) =>
							rect2.bottom > rect1.top &&
							rect2.right > rect1.left &&
							rect2.top < rect1.bottom &&
							rect2.left < rect1.right,
					);
					const rectsInScope = (visibleRects.length ? visibleRects : clientRects).filter((rect2) => {
						const rtParent = document.elementFromPoint(rect2.x, rect2.y)?.closest('rt');

						return !rtParent;
					});

					return rectsInScope.length ? rectsInScope : clientRects;
				},
			},
			popoverElement,
			{
				placement,
				middleware: [
					offset(5),
					inline(),
					flip({
						fallbackPlacements,
					}),
				],
			},
		)
			.then(({ x, y }) => {
				popoverElement.style.left = `${x}px`;
				popoverElement.style.top = `${y}px`;
			})
			.catch(() => {
				// no-op
			});
	}

	function getReferencePoints() {
		if (!bookStyles) {
			bookStyles = window.getComputedStyle(bookContentElement);
		}

		const rect = bookContentElement.getBoundingClientRect();
		const top = isVertical ? rect.top : rect.top + Number.parseFloat(bookStyles.paddingTop.replace('px', ''));
		const right = isVertical
			? rect.right - Number.parseFloat(bookStyles.paddingRight.replace('px', ''))
			: rect.right;
		const bottom = isVertical
			? rect.bottom
			: rect.bottom - Number.parseFloat(bookStyles.paddingBottom.replace('px', ''));
		const left = isVertical ? rect.left + Number.parseFloat(bookStyles.paddingLeft.replace('px', '')) : rect.left;

		return {
			top,
			right,
			left,
			bottom,
		};
	}
</script>

<div
	class="ttu-whispersync-container popover flex"
	class:flex-col={isVertical}
	class:hidden={!range}
	bind:this={popoverElement}
>
	<button
		title="Close menu"
		class:p-y-xs={isVertical}
		class:p-r-xs={!isVertical}
		class:p-l-xs={!isVertical}
		on:click={() => dispatch('close')}
	>
		<Icon path={mdiClose} />
	</button>
	<button
		class:p-y-xs={isVertical}
		class:separator-y={isVertical}
		class:p-r-xs={!isVertical}
		class:p-l-xs={!isVertical}
		class:separator-x={!isVertical}
		title={togglePlaybackTitle}
		disabled={togglePlaybackTitle !== 'Toggle playback'}
		on:click={() => ($paused$ = !$paused$)}
	>
		<Icon path={$paused$ ? mdiPlay : mdiPause} />
	</button>
	<ActionButtonList isReaderMenu {subtitle} />
</div>
