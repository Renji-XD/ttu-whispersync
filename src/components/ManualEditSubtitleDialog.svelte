<script lang="ts">
	import DialogTemplate from './DialogTemplate.svelte';
	import Icon from './Icon.svelte';
	import { Action, executeAction } from '../lib/actions';
	import type { Context, EditSubtitleResult, Subtitle } from '../lib/general';
	import { bookMatched$, currentAudioSourceUrl$, currentSubtitles$ } from '../lib/stores';
	import { getTimeParts, toTimeStamp } from '../lib/util';
	import { mdiEqual, mdiPause, mdiPlay, mdiRepeat, mdiRestore } from '@mdi/js';
	import { createEventDispatcher, getContext, tick } from 'svelte';
	import TimeEditInput from './TimeEditInput.svelte';

	export let activeSubtitle: Subtitle;
	export let resolver: (arg0: EditSubtitleResult) => void;

	const { isIOS } = getContext<Context>('context');
	const [originalStartHours, originalStartMinutes, originalStartSeconds, originalStartMiliseconds] = getTimeParts(
		activeSubtitle.startSeconds,
	);
	const [originalEndHours, originalEndMinutes, originalEndSeconds, originalEndMiliseconds] = getTimeParts(
		activeSubtitle.endSeconds,
	);

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	let audioElement: HTMLAudioElement;
	let isLoading = !!$currentAudioSourceUrl$;
	let currentTime = activeSubtitle.startSeconds;
	let duration = 0;
	let paused = true;
	let [startHours, startMinutes, startSeconds, startMiliseconds] = [
		originalStartHours,
		originalStartMinutes,
		originalStartSeconds,
		originalStartMiliseconds,
	];
	let [endHours, endMinutes, endSeconds, endMiliseconds] = [
		originalEndHours,
		originalEndMinutes,
		originalEndSeconds,
		originalEndMiliseconds,
	];

	$: currentStartSeconds = startHours * 3600 + startMinutes * 60 + startSeconds + startMiliseconds / 1000;

	$: currentEndSeconds = endHours * 3600 + endMinutes * 60 + endSeconds + endMiliseconds / 1000;

	$: durationHours = $currentAudioSourceUrl$ ? Math.floor(duration / 3600) : 999;

	async function onLoadedMetadata() {
		if (!isIOS) {
			audioElement.currentTime = activeSubtitle.startSeconds;
			isLoading = false;

			return;
		}

		let attempts = 0;
		let loadResolve: (_: any) => void;

		const loadedPromise = new Promise((resolve) => {
			loadResolve = resolve;

			audioElement.addEventListener('loadeddata', resolve, { once: true, capture: false });
		});
		const playPromise = new Promise<void>((resolve) => {
			const playInterval = setInterval(async () => {
				try {
					attempts += 1;

					audioElement.play();

					setTimeout(loadResolve, 10000);

					await loadedPromise;

					audioElement.pause();

					clearInterval(playInterval);

					resolve();
				} catch (_) {
					//no-op
				}

				if (attempts > 20) {
					clearInterval(playInterval);
					loadResolve(undefined);
					resolve();
				}
			}, 500);
		});

		await playPromise;

		audioElement.currentTime = activeSubtitle.startSeconds;

		await tick();

		isLoading = false;
	}

	function onCurrentTimeChange() {
		if (currentTime > currentEndSeconds) {
			paused = true;
			currentTime = currentStartSeconds;
		}
	}

	async function onTimeValueChange() {
		paused = true;

		if ($currentAudioSourceUrl$ && currentStartSeconds > duration) {
			[startHours, startMinutes, startSeconds, startMiliseconds] = getTimeParts(currentEndSeconds);
		}

		if ($currentAudioSourceUrl$ && currentEndSeconds > duration) {
			[endHours, endMinutes, endSeconds, endMiliseconds] = getTimeParts(duration);
		}

		await tick();

		if (currentStartSeconds > currentEndSeconds) {
			[startHours, startMinutes, startSeconds, startMiliseconds] = getTimeParts(currentEndSeconds);
			[endHours, endMinutes, endSeconds, endMiliseconds] = getTimeParts(currentStartSeconds);

			await tick();
		}

		currentTime = currentStartSeconds;
	}

	async function onAlignSubtitle() {
		isLoading = true;

		await executeAction(Action.ALIGN_SUBTITLE, activeSubtitle, {
			persistAlignment: false,
			ignoreSkipKeyListener: true,
		});

		activeSubtitle = $currentSubtitles$.get(activeSubtitle.id)!;

		isLoading = false;
	}

	function onCancel() {
		if (activeSubtitle.text !== activeSubtitle.originalText) {
			activeSubtitle.text = activeSubtitle.originalText;

			return close({ wasCanceled: false, subtitle: activeSubtitle });
		}

		close({ wasCanceled: true });
	}

	async function onSaveNewTime() {
		await tick();

		const adjustedStartSeconds = currentStartSeconds;
		const adjustedEndSeconds = currentEndSeconds;

		close({
			wasCanceled: false,
			subtitle: {
				...activeSubtitle,
				adjustedStartSeconds,
				startSeconds: adjustedStartSeconds,
				startTime: toTimeStamp(adjustedStartSeconds),
				adjustedEndSeconds,
				endSeconds: adjustedEndSeconds,
				endTime: toTimeStamp(adjustedEndSeconds),
			},
		});
	}

	function close(resolveValue: EditSubtitleResult) {
		resolver?.(resolveValue);

		dispatch('close');
	}
</script>

{#if $currentAudioSourceUrl$}
	<audio
		controls
		class="hidden"
		src={$currentAudioSourceUrl$}
		bind:duration
		bind:currentTime
		bind:paused
		bind:this={audioElement}
		on:loadedmetadata={onLoadedMetadata}
		on:timeupdate={onCurrentTimeChange}
	>
	</audio>
{/if}

<DialogTemplate>
	<svelte:fragment slot="header">Edit Subtitle</svelte:fragment>
	<div slot="content">
		<div class="m-b-s">
			{#if $currentAudioSourceUrl$}
				<button title="Toggle playback" on:click={() => (paused = !paused)}>
					<Icon path={paused ? mdiPlay : mdiPause} />
				</button>
				<button
					title="Replay"
					class="m-l-s"
					on:click={() => {
						currentTime = currentStartSeconds;
						paused = false;
					}}
				>
					<Icon path={mdiRepeat} />
				</button>
			{/if}
			<button
				title="Restore time"
				class:m-l-s={$currentAudioSourceUrl$}
				on:click={() => {
					paused = true;

					[startHours, startMinutes, startSeconds, startMiliseconds] = [
						originalStartHours,
						originalStartMinutes,
						originalStartSeconds,
						originalStartMiliseconds,
					];

					[endHours, endMinutes, endSeconds, endMiliseconds] = [
						originalEndHours,
						originalEndMinutes,
						originalEndSeconds,
						originalEndMiliseconds,
					];
				}}
			>
				<Icon path={mdiRestore} />
			</button>
		</div>
		<div class="flex flex-col">
			<div class="flex items-center time-edit m-b-s">
				<div class="flex">
					<TimeEditInput
						defaultValue={originalStartHours}
						max={durationHours}
						bind:value={startHours}
						on:changed={onTimeValueChange}
					/>
					<span>:</span>
					<TimeEditInput
						defaultValue={originalStartMinutes}
						bind:value={startMinutes}
						on:changed={onTimeValueChange}
					/>
					<span>:</span>
					<TimeEditInput
						defaultValue={originalStartSeconds}
						bind:value={startSeconds}
						on:changed={onTimeValueChange}
					/>
					<span>,</span>
					<TimeEditInput
						defaultValue={originalStartMiliseconds}
						max={999}
						step={100}
						bind:value={startMiliseconds}
						on:changed={onTimeValueChange}
					/>
				</div>
				<span class="m-b">-</span>
				<div class="flex">
					<TimeEditInput
						defaultValue={originalEndHours}
						max={durationHours}
						bind:value={endHours}
						on:changed={onTimeValueChange}
					/>
					<span>:</span>
					<TimeEditInput
						defaultValue={originalEndMinutes}
						bind:value={endMinutes}
						on:changed={onTimeValueChange}
					/>
					<span>:</span>
					<TimeEditInput
						defaultValue={originalEndSeconds}
						bind:value={endSeconds}
						on:changed={onTimeValueChange}
					/>
					<span>,</span>
					<TimeEditInput
						defaultValue={originalEndMiliseconds}
						max={999}
						step={100}
						bind:value={endMiliseconds}
						on:changed={onTimeValueChange}
					/>
				</div>
			</div>
			<div class="flex items-center m-t-b">
				<div>{activeSubtitle.text}</div>
				{#if $bookMatched$.matchedBy}
					<button title={Action.ALIGN_SUBTITLE} class="m-l-s" on:click={onAlignSubtitle}>
						<Icon path={mdiEqual} />
					</button>
				{/if}
			</div>
		</div>
	</div>
	<div class="flex grow justify-between" slot="footer">
		<button on:click={onCancel}>Cancel</button>
		<button on:click={onSaveNewTime}>Save</button>
	</div>
</DialogTemplate>
<div class:hidden={!isLoading} class="backdrop">
	<span class="spinner"></span>
</div>
