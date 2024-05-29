<script lang="ts">
	import ActionButtonList from './ActionButtonList.svelte';
	import { Action, executeAction } from '../lib/actions';
	import type { MouseEventWithElement, PointerEventWithElement, Subtitle } from '../lib/general';
	import { SubtitleActionsVisibility } from '../lib/settings';
	import {
		activeSubtitle$,
		currentSubtitles$,
		currentTime$,
		isMobile$,
		isRecording$,
		lastError$,
		settings$,
	} from '../lib/stores';
	import { onMount, tick } from 'svelte';
	import type { Readable } from 'svelte/store';
	import { createVirtualizer, type SvelteVirtualizer } from '@tanstack/svelte-virtual';

	export let subtitles: Subtitle[];
	export let skipUpdates = false;

	export async function onResetList(..._args: any) {
		if (!virtualListElement) {
			return;
		}

		containerHeight = 0;

		await tick();

		if (!virtualizer) {
			virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
				count: subtitles.length,
				overscan: 10,
				estimateSize: () => 150,
				getScrollElement: () => virtualListElement,
				getItemKey: (index) => subtitles[index].id,
			});
		}

		$virtualizer.measure();

		containerHeight = Math.floor(virtualListElement.getBoundingClientRect().height);

		await tick();

		scrollToSubtitle();
	}

	export async function scrollToSubtitle(force = false) {
		if (
			$isRecording$ ||
			!$virtualizer ||
			!subtitles.length ||
			(!force &&
				(!$subtitlesEnableAutoScroll$ ||
					(!$activeSubtitle$.previous && !$activeSubtitle$.current && !$activeSubtitle$.useTimeFallback)))
		) {
			return;
		}

		const { previous, current, useTimeFallback } = $activeSubtitle$;
		const currentTime = $currentTime$;

		let subtitleIndex = -1;

		if (current && $currentSubtitles$.has(current)) {
			subtitleIndex = subtitles.findIndex((subtitle) => subtitle.id === current);
		} else if (previous && $currentSubtitles$.has(previous)) {
			subtitleIndex = subtitles.findIndex((subtitle) => subtitle.id === previous);
		}

		if (subtitleIndex === -1 && (force || useTimeFallback)) {
			subtitleIndex = currentTime
				? subtitles.findLastIndex((subtitle) => currentTime >= subtitle.startSeconds)
				: 0;
		}

		if (subtitleIndex === -1) {
			return;
		}

		//@ts-ignore
		while (!$virtualizer.itemSizeCache.has(subtitles[subtitleIndex].id)) {
			measureElements();

			$virtualizer.scrollToIndex(subtitleIndex, { align: 'auto' });

			await new Promise<void>((resolve) => setTimeout(resolve));
		}

		measureElements();

		$virtualizer.scrollToIndex(subtitleIndex, { align: 'auto' });
	}

	const {
		subtitlesEnableAutoScroll$,
		subtitlePreventActionOnSelection$,
		subtitlesCopyFontFamily$,
		subtitlesCopyFontSize$,
		subtitlesCopyLineHeight$,
		subtitlesFontFamily$,
		subtitlesFontSize$,
		subtitlesLineHeight$,
		subtitlesClickAction$,
		subtitlesActionsVisibility$,
		subtitlesActionsVisibilityTime$,
	} = settings$;
	const font = $subtitlesCopyFontFamily$
		? window.localStorage.getItem('fontFamilyGroupOne') || 'Noto Serif JP'
		: $subtitlesFontFamily$;
	const fontSize = $subtitlesCopyFontSize$
		? Number.parseInt(window.localStorage.getItem('fontSize') || '16', 10)
		: $subtitlesFontSize$;
	const lineHeight = $subtitlesCopyLineHeight$
		? Number.parseFloat(window.localStorage.getItem('lineHeight') || '1.65')
		: $subtitlesLineHeight$;

	let virtualizer: Readable<SvelteVirtualizer<HTMLDivElement, HTMLDivElement>>;
	let virtualListElement: HTMLDivElement;
	let virtualItemElements: HTMLDivElement[] = [];
	let subtitleInteractionTimer: number | undefined;
	let isPointerDown = false;
	let containerHeight = 0;

	$: displayedSubtitles = virtualizer ? $virtualizer.getVirtualItems() : [];

	$: onResetList($lastError$);

	$: if (subtitles) {
		refreshList();
	}

	$: if ($activeSubtitle$) {
		scrollToSubtitle();
	}

	$: if (virtualItemElements.length && !isPointerDown) {
		measureElements();
	}

	onMount(onResetList);

	function onSubtitleClick(event: MouseEventWithElement<HTMLDivElement>) {
		if (
			event.button !== 0 ||
			$subtitlesClickAction$ === Action.NONE ||
			$subtitlesActionsVisibility$ === SubtitleActionsVisibility.TOGGLE ||
			hasSelection()
		) {
			return;
		}

		clearSubtitleEvents();

		executeAction(
			$subtitlesClickAction$,
			subtitles[Number.parseInt(event.currentTarget.parentElement!.dataset.index!, 10)],
		);
	}

	function onSubtitlePointerDown(event: PointerEventWithElement<HTMLDivElement>) {
		if (event.button !== 0 || $subtitlesActionsVisibility$ !== SubtitleActionsVisibility.TOGGLE) {
			return;
		}

		if ($subtitlePreventActionOnSelection$ && $isMobile$) {
			window.getSelection()?.removeAllRanges();
			document.body.style.userSelect = 'none';
		}

		const { currentTarget } = event;

		currentTarget.addEventListener('pointerup', onSubtitlePointerUp, false);

		subtitleInteractionTimer = window.setTimeout(() => {
			clearSubtitleEvents(currentTarget);

			if (!hasSelection()) {
				currentTarget.nextElementSibling?.classList.toggle('show');
			}
		}, $subtitlesActionsVisibilityTime$);
	}

	function onSubtitlePointerUp(this: HTMLDivElement) {
		clearSubtitleEvents(this);

		if (hasSelection()) {
			return;
		}

		executeAction($subtitlesClickAction$, subtitles[Number.parseInt(this.parentElement!.dataset.index!, 10)]);
	}

	function hasSelection() {
		if (!$subtitlePreventActionOnSelection$) {
			return false;
		}

		const selected = window.getSelection()?.toString().trim();

		return !!selected;
	}

	function clearSubtitleEvents(element?: HTMLDivElement) {
		clearTimeout(subtitleInteractionTimer);

		element?.removeEventListener('pointerup', onSubtitlePointerUp, false);

		document.body.style.userSelect = 'auto';
	}

	async function refreshList() {
		if (!$virtualizer) {
			return;
		}

		$virtualizer.setOptions({ count: subtitles.length });
		$virtualizer.scrollToOffset(0);

		displayedSubtitles = $virtualizer.getVirtualItems();

		$virtualizer.measure();

		scrollToSubtitle();
	}

	function measureElements() {
		for (let index = 0, { length } = virtualItemElements; index < length; index += 1) {
			$virtualizer.measureElement(virtualItemElements[index]);
		}
	}
</script>

<div
	class="ttu-whispersync-container subtitle-container h-full w-full"
	style:height={containerHeight ? `${containerHeight}px` : null}
	bind:this={virtualListElement}
	on:pointerdown={() => (isPointerDown = true)}
	on:pointerup={() => (isPointerDown = false)}
>
	{#if containerHeight > 0 && virtualizer}
		<div class="relative w-full" style:height={`${$virtualizer.getTotalSize()}px`}>
			<div
				class="absolute top-0 left-0 w-full"
				style={`transform: translateY(${
					displayedSubtitles[0]?.start || 0
				}px); font-family: "${font}", "Lora", "Noto Serif JP", serif; font-size: ${fontSize}px; line-height: ${lineHeight};`}
			>
				{#each displayedSubtitles as displayedSubtitle, idx (displayedSubtitle.key)}
					<div
						class="flex items-center sub"
						class:active={$activeSubtitle$.current === displayedSubtitle.key}
						class:on-hover={$subtitlesActionsVisibility$ === SubtitleActionsVisibility.HOVER && !$isMobile$}
						data-index={displayedSubtitle.index}
						bind:this={virtualItemElements[idx]}
					>
						<div
							tabindex="0"
							role="button"
							class="flex-1 p-b"
							class:cursor-not-allowed={$isRecording$}
							title={$isRecording$ ? 'Recording in progress' : null}
							on:click={onSubtitleClick}
							on:pointerdown={onSubtitlePointerDown}
							on:keyup={() => {}}
						>
							{subtitles[displayedSubtitle.index].text}
						</div>
						<div
							class="flex invisible m-x-xs m-y-b sub-action"
							class:show={$subtitlesActionsVisibility$ === SubtitleActionsVisibility.ALWAYS}
							class:hidden={$subtitlesActionsVisibility$ === SubtitleActionsVisibility.HIDDEN}
						>
							<ActionButtonList subtitle={subtitles[displayedSubtitle.index]} {skipUpdates} />
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
