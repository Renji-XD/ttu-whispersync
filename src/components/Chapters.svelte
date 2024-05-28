<script lang="ts">
	import { Action, executeAction } from '../lib/actions';
	import { Tabs, getDummySubtitle } from '../lib/general';
	import { activeSubtitle$, currentAudioChapters$, currentTab$, currentTime$, isRecording$ } from '../lib/stores';
	import { tick } from 'svelte';

	let chapterContainter: HTMLDivElement;
	let chapterElements: HTMLButtonElement[] = [];
	let activeChapterIndex = -1;

	$: if ($currentTab$ === Tabs.CHAPTERS && $activeSubtitle$) {
		scrollToActiveElement();
	}

	function scrollToActiveElement() {
		activeChapterIndex = $currentAudioChapters$.findLastIndex((chapter) => $currentTime$ >= chapter.startSeconds);

		if (activeChapterIndex === -1 || !chapterElements[activeChapterIndex]) {
			return;
		}

		// @ts-ignore
		if (chapterElements[activeChapterIndex].scrollIntoViewIfNeeded) {
			// @ts-ignore
			chapterElements[activeChapterIndex].scrollIntoViewIfNeeded();
		} else {
			chapterElements[activeChapterIndex].scrollIntoView();
		}
	}
</script>

<div class="flex flex-col" bind:this={chapterContainter}>
	{#each $currentAudioChapters$ as chapter, index (chapter.key)}
		<button
			class="m-y-xs p-b"
			class:inactive-chapter={activeChapterIndex > index}
			class:recording={$isRecording$}
			disabled={$isRecording$}
			title={$isRecording$ ? 'Recording in progress' : 'Play from chapter'}
			bind:this={chapterElements[index]}
			on:click={() => {
				executeAction(Action.RESTART_PLAYBACK, getDummySubtitle(chapter.startSeconds), {
					keepPauseState: true,
				})
					.then(tick)
					.then(scrollToActiveElement);
			}}
		>
			<div>
				{chapter.label}
			</div>
			<div class="audio-time">{chapter.startText}</div>
		</button>
	{/each}
</div>
