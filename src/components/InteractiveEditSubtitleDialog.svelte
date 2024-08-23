<script lang="ts">
	import ActionButton from './ActionButton.svelte';
	import DialogTemplate from './DialogTemplate.svelte';
	import Icon from './Icon.svelte';
	import { Action, executeAction } from '../lib/actions';
	import { getDummySubtitle, type EditSubtitleResult, type Subtitle } from '../lib/general';
	import { getAudio } from '../lib/ffmpeg';
	import {
		bookMatched$,
		currentAudioFile$,
		currentSubtitles$,
		exportCancelController$,
		exportCancelTitle$,
		exportNewTitle$,
		exportUpdateTitle$,
		isAnkiconnectAndroid$,
		openLastExportedCardTitle$,
		settings$,
	} from '../lib/stores';
	import { toTimeStamp } from '../lib/util';
	import {
		mdiCancel,
		mdiContentCopy,
		mdiDatabasePlus,
		mdiDatabaseSync,
		mdiEqual,
		mdiOpenInApp,
		mdiPause,
		mdiRepeat,
		mdiRestore,
	} from '@mdi/js';
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import WaveSurfer from 'wavesurfer.js';
	import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';

	export let activeSubtitle: Subtitle;
	export let subtitleRegions: Subtitle[];
	export let resolver: (arg0: EditSubtitleResult) => void;

	const startTime = subtitleRegions[0].startSeconds;
	const color = getComputedStyle(document.documentElement).getPropertyValue('--ttu-whispersync-color');
	const dispatch = createEventDispatcher<{
		close: void;
	}>();
	const initialActiveSubtitle = JSON.parse(JSON.stringify(activeSubtitle));
	const wasActiveSubtitleAligned = activeSubtitle.text !== activeSubtitle.originalText;
	const { ankiEnableOpenInBrowser$ } = settings$;

	let waveformContainer: HTMLDivElement;
	let wavesurferInstance: WaveSurfer;
	let wavesurgerRegions: RegionsPlugin;
	let isLoading = true;
	let slicedBlobUrl: string;
	let activeRegion: Region;
	let isPlaying = false;
	let wasExportCanceled = false;
	let stopTime = -1;
	let stopTimer: () => void;

	onMount(createWaveForm);

	onDestroy(() => {
		stopTimer?.();

		wavesurferInstance?.destroy();

		URL.revokeObjectURL(slicedBlobUrl);
	});

	function onKeyDown(event: KeyboardEvent) {
		if (isLoading || event.repeat || !(event.ctrlKey || event.metaKey || event.altKey)) {
			return;
		}

		const actionKey = (event.code || event.key || '').toLowerCase();

		let action = Action.NONE;
		let stopEvent = true;

		if (event.altKey) {
			switch (actionKey) {
				case 'keyd':
				case 'd':
					action = Action.TOGGLE_PLAY_PAUSE;

					break;
				case 'keye':
				case 'e':
					action = Action.EXPORT_UPDATE;

					break;
				case 'keyz':
				case 'z':
					action = Action.COPY_SUBTITLE;

					break;
				case 'keyj':
				case 'j':
					onPause();

					break;
				default:
					stopEvent = false;

					break;
			}
		} else {
			switch (actionKey) {
				case 'space':
				case ' ':
					onPause();

					break;
				case 'keyd':
				case 'd':
					action = Action.TOGGLE_PLAY_PAUSE;

					break;
				case 'keye':
				case 'e':
					action = Action.EXPORT_NEW;

					break;
				case 'keyo':
				case 'o':
					action = Action.OPEN_LAST_EXPORTED_CARD;

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
			onPlayActiveSubtitle();
		} else {
			executeAction(action, activeSubtitle, { ignoreSkipKeyListener: true });
		}
	}

	function onPause() {
		wavesurferInstance.pause();

		stopTimer?.();

		stopTime = -1;
	}

	function onPlayActiveSubtitle() {
		stopTimer?.();

		stopTime = activeRegion.end;

		stopTimer = wavesurferInstance.on('timeupdate', onTimeUpdate);

		wavesurferInstance.setTime(activeRegion.start);
		wavesurferInstance.play();
	}

	function onTimeUpdate(currentTime: number) {
		if (currentTime > stopTime) {
			onPause();
		}
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

	function onResetWasExportCanceled() {
		wasExportCanceled = false;
	}

	function onAfterExport() {
		if (wasExportCanceled || (!$isAnkiconnectAndroid$ && !$ankiEnableOpenInBrowser$)) {
			return;
		}

		const adjustedStartSeconds = activeRegion.start + startTime;
		const adjustedEndSeconds = activeRegion.end + startTime;

		if (
			(!wasActiveSubtitleAligned && activeSubtitle.text !== activeSubtitle.originalText) ||
			adjustedStartSeconds !== initialActiveSubtitle.startSeconds ||
			adjustedEndSeconds !== initialActiveSubtitle.endSeconds
		) {
			return onSaveNewTime();
		}

		return close({ wasCanceled: true });
	}

	function onCancel() {
		if (!wasActiveSubtitleAligned && activeSubtitle.text !== activeSubtitle.originalText) {
			return close({
				wasCanceled: false,
				subtitle: initialActiveSubtitle,
			});
		}

		close({ wasCanceled: true });
	}

	function onSaveNewTime() {
		updateActiveSubtitle();

		close({
			wasCanceled: false,
			subtitle: activeSubtitle,
		});
	}

	async function createWaveForm() {
		try {
			if (!$currentAudioFile$) {
				throw new Error('Audio file required');
			}

			const audioBuffer = await getAudio($currentAudioFile$, [
				getDummySubtitle(
					subtitleRegions[0].startSeconds,
					subtitleRegions[subtitleRegions.length - 1].endSeconds,
				),
			]);

			if (!audioBuffer) {
				throw new Error('No audio file returned');
			}

			slicedBlobUrl = URL.createObjectURL(new Blob([audioBuffer], { type: 'audio/mpeg' }));

			wavesurferInstance = WaveSurfer.create({
				container: waveformContainer,
				waveColor: color,
				url: slicedBlobUrl,
			});

			wavesurgerRegions = wavesurferInstance.registerPlugin(RegionsPlugin.create());

			wavesurferInstance.once('decode', () => {
				for (let index = 0, { length } = subtitleRegions; index < length; index += 1) {
					const subtitle = subtitleRegions[index];

					if (subtitle.subIndex === -1) {
						continue;
					}

					const isActiveSub = activeSubtitle.id === subtitle.id;
					const region = wavesurgerRegions.addRegion(getRegionOptions(subtitle, isActiveSub));

					if (isActiveSub) {
						region.element.part.add('active');

						region.on('update', onPause);
						region.on('update-end', updateActiveSubtitle);

						activeRegion = region;

						updateActiveSubtitle();
					} else {
						region.element.part.add('inactive');
					}
				}
			});

			wavesurferInstance.on('interaction', (newTime) => {
				stopTimer?.();

				if (newTime >= activeRegion.start && newTime <= activeRegion.end) {
					stopTime = activeRegion.end;

					stopTimer = wavesurferInstance.on('timeupdate', onTimeUpdate);
				}

				wavesurferInstance.play();
			});

			wavesurferInstance.on('play', () => (isPlaying = true));
			wavesurferInstance.on('pause', () => (isPlaying = false));
			wavesurferInstance.once('ready', () => {
				isLoading = false;
			});
		} catch ({ message }: any) {
			isLoading = false;

			close({ wasCanceled: false, error: `Failed to create waveform: ${message}` });
		}
	}

	function getRegionOptions(subtitle: Subtitle, isActiveSub = true) {
		return {
			start: subtitle.startSeconds - startTime,
			end: subtitle.endSeconds - startTime,
			color,
			drag: isActiveSub,
			resize: isActiveSub,
			id: subtitle.id,
		};
	}

	function updateActiveSubtitle() {
		const adjustedStartSeconds = activeRegion.start + startTime;
		const adjustedEndSeconds = activeRegion.end + startTime;

		activeSubtitle = {
			...activeSubtitle,
			adjustedStartSeconds,
			startSeconds: adjustedStartSeconds,
			startTime: toTimeStamp(adjustedStartSeconds),
			adjustedEndSeconds,
			endSeconds: adjustedEndSeconds,
			endTime: toTimeStamp(adjustedEndSeconds),
		};
	}

	function close(resolveValue: EditSubtitleResult) {
		resolver?.(resolveValue);

		dispatch('close');
	}
</script>

<svelte:window on:keydown={onKeyDown} />

<DialogTemplate>
	<svelte:fragment slot="header">Edit Subtitle</svelte:fragment>
	<div class="w-full p-x-xs" slot="content" on:touchstart|stopPropagation>
		<div>
			<button title={!isPlaying ? 'Already paused' : 'Pause playback'} disabled={!isPlaying} on:click={onPause}>
				<Icon path={mdiPause} />
			</button>
			<button title="Play active subtitle" class="m-l-s" on:click={onPlayActiveSubtitle}>
				<Icon path={mdiRepeat} />
			</button>
			<button
				title="Restore time"
				class="m-l-s"
				on:click={() => {
					onPause();

					activeRegion.setOptions(getRegionOptions(initialActiveSubtitle));

					activeRegion.element.part.add('active');

					updateActiveSubtitle();
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
				clickHandler={onResetWasExportCanceled}
				on:executed={onAfterExport}
			/>
			<ActionButton
				ignoreSkipKeyListener
				buttonClasses="m-l-s"
				path={mdiDatabaseSync}
				title={$exportUpdateTitle$}
				action={Action.EXPORT_UPDATE}
				subtitle={activeSubtitle}
				clickHandler={onResetWasExportCanceled}
				on:executed={onAfterExport}
			/>
			<ActionButton
				ignoreSkipKeyListener
				buttonClasses="m-l-s"
				path={mdiOpenInApp}
				title={$openLastExportedCardTitle$}
				action={Action.OPEN_LAST_EXPORTED_CARD}
				subtitle={activeSubtitle}
			/>
			{#if $exportCancelController$}
				<ActionButton
					ignoreSkipKeyListener
					buttonClasses="match-btns m-l-s"
					path={mdiCancel}
					title={$exportCancelTitle$}
					action={Action.CANCEL_EXPORT}
					subtitle={activeSubtitle}
					on:executed={() => (wasExportCanceled = true)}
				/>
			{/if}
		</div>
		<div class="waveform w-full h-full" bind:this={waveformContainer}></div>
		<div class="flex items-center">
			<div>{activeSubtitle.text}</div>
			{#if !wasActiveSubtitleAligned && $bookMatched$.matchedBy}
				<button title={Action.ALIGN_SUBTITLE} class="m-l-s" on:click={onAlignSubtitle}>
					<Icon path={mdiEqual} />
				</button>
			{/if}
			<ActionButton
				path={mdiContentCopy}
				title={Action.COPY_SUBTITLE}
				action={Action.COPY_SUBTITLE}
				subtitle={activeSubtitle}
				ignoreSkipKeyListener
				buttonClasses="match-btns m-l-s"
			/>
		</div>
	</div>
	<div class="flex grow justify-between p-x-xs" slot="footer">
		<button on:click={onCancel}>Cancel</button>
		<button on:click={onSaveNewTime}>Save</button>
	</div>
</DialogTemplate>
<div class:hidden={!isLoading && !$exportCancelController$} class="backdrop">
	<span class="spinner"></span>
</div>
