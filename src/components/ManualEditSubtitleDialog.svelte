<script lang="ts">
	import ActionButton from './ActionButton.svelte';
	import DialogTemplate from './DialogTemplate.svelte';
	import Icon from './Icon.svelte';
	import { Action, executeAction } from '../lib/actions';
	import type { Context, EditSubtitleResult, Subtitle } from '../lib/general';
	import {
		bookMatched$,
		currentAudioSourceUrl$,
		currentSubtitles$,
		exportCancelController$,
		exportCancelTitle$,
		exportNewTitle$,
		exportUpdateTitle$,
		isRecording$,
	} from '../lib/stores';
	import { getTimeParts, toTimeStamp } from '../lib/util';
	import {
		mdiCancel,
		mdiDatabasePlus,
		mdiDatabaseSync,
		mdiEqual,
		mdiPause,
		mdiPlay,
		mdiRepeat,
		mdiRestore,
	} from '@mdi/js';
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
	const initialActiveSubtitle = JSON.parse(JSON.stringify(activeSubtitle));
	const wasActiveSubtitleAligned = activeSubtitle.text !== activeSubtitle.originalText;

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

	function onKeyDown(event: KeyboardEvent) {
		if (isLoading || $isRecording$ || event.repeat || !(event.ctrlKey || event.metaKey || event.altKey)) {
			return;
		}

		const actionKey = (event.code || event.key || '').toLowerCase();

		let action = Action.NONE;
		let stopEvent = true;

		if (event.altKey) {
			switch (actionKey) {
				case 'keyd':
				case 'd':
					action = $currentAudioSourceUrl$ ? Action.TOGGLE_PLAY_PAUSE : Action.NONE;

					break;
				case 'keye':
				case 'e':
					pauseReset();
					action = Action.EXPORT_UPDATE;

					break;
				default:
					stopEvent = false;

					break;
			}
		} else {
			switch (actionKey) {
				case 'space':
				case ' ':
					if ($currentAudioSourceUrl$) {
						paused = !paused;
					}

					break;
				case 'keyd':
				case 'd':
					action = $currentAudioSourceUrl$ ? Action.TOGGLE_PLAY_PAUSE : Action.NONE;

					break;
				case 'keye':
				case 'e':
					pauseReset();
					action = Action.EXPORT_NEW;

					break;
				default:
					stopEvent = false;
					break;
			}
		}

		if (stopEvent) {
			event.preventDefault();
			event.stopPropagation();
		}

		if (action === Action.TOGGLE_PLAY_PAUSE) {
			onReplay();
		} else {
			executeAction(action, activeSubtitle, { ignoreSkipKeyListener: true });
		}
	}

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
			pauseReset();
		}
	}

	function onReplay() {
		currentTime = currentStartSeconds;
		paused = false;
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

		updateActiveSubtitle();
	}

	async function onAlignSubtitle() {
		isLoading = true;

		await executeAction(Action.ALIGN_SUBTITLE, initialActiveSubtitle, {
			persistAlignment: false,
			ignoreSkipKeyListener: true,
		});

		activeSubtitle.text = $currentSubtitles$.get(activeSubtitle.id)!.text;

		isLoading = false;
	}

	function onCancel() {
		if (!wasActiveSubtitleAligned && activeSubtitle.text !== activeSubtitle.originalText) {
			return close({ wasCanceled: false, subtitle: initialActiveSubtitle });
		}

		close({ wasCanceled: true });
	}

	async function onSaveNewTime() {
		await tick();

		updateActiveSubtitle();

		close({
			wasCanceled: false,
			subtitle: activeSubtitle,
		});
	}

	function pauseReset() {
		paused = true;
		currentTime = currentStartSeconds;
	}

	function updateActiveSubtitle() {
		activeSubtitle = {
			...activeSubtitle,
			adjustedStartSeconds: currentStartSeconds,
			startSeconds: currentStartSeconds,
			startTime: toTimeStamp(currentStartSeconds),
			adjustedEndSeconds: currentEndSeconds,
			endSeconds: currentEndSeconds,
			endTime: toTimeStamp(currentEndSeconds),
		};
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

<svelte:window on:keydown={onKeyDown} />

<DialogTemplate>
	<svelte:fragment slot="header">Edit Subtitle</svelte:fragment>
	<div slot="content">
		<div class="m-b-s">
			{#if $currentAudioSourceUrl$}
				<button title="Toggle playback" on:click={() => (paused = !paused)}>
					<Icon path={paused ? mdiPlay : mdiPause} />
				</button>
				<button title="Replay" class="m-l-s" on:click={onReplay}>
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

					tick().then(updateActiveSubtitle);
				}}
			>
				<Icon path={mdiRestore} />
			</button>
			<ActionButton
				ignoreSkipKeyListener
				buttonClasses="m-l-s"
				path={mdiDatabasePlus}
				title={$exportNewTitle$}
				action={Action.EXPORT_NEW}
				subtitle={activeSubtitle}
				clickHandler={pauseReset}
			/>
			<ActionButton
				ignoreSkipKeyListener
				buttonClasses="m-l-s"
				path={mdiDatabaseSync}
				title={$exportUpdateTitle$}
				action={Action.EXPORT_UPDATE}
				subtitle={activeSubtitle}
				clickHandler={pauseReset}
			/>
			{#if $exportCancelController$}
				<ActionButton
					ignoreSkipKeyListener
					buttonClasses="match-btns m-l-s"
					path={mdiCancel}
					title={$exportCancelTitle$}
					action={Action.CANCEL_EXPORT}
					subtitle={activeSubtitle}
				/>
			{/if}
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
				{#if !wasActiveSubtitleAligned && $bookMatched$.matchedBy}
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
<div class:hidden={!isLoading && !$exportCancelController$} class="backdrop">
	<span class="spinner"></span>
</div>
