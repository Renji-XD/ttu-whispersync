<script lang="ts">
	import DialogTemplate from './DialogTemplate.svelte';
	import Icon from './Icon.svelte';
	import { Action, executeAction } from '../lib/actions';
	import { getDummySubtitle, type EditSubtitleResult, type Subtitle } from '../lib/general';
	import { getAudio } from '../lib/ffmpeg';
	import { bookMatched$, currentAudioFile$, currentSubtitles$ } from '../lib/stores';
	import { toTimeStamp } from '../lib/util';
	import { mdiEqual, mdiPause, mdiRepeat, mdiRestore } from '@mdi/js';
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

	let waveformContainer: HTMLDivElement;
	let wavesurferInstance: WaveSurfer;
	let wavesurgerRegions: RegionsPlugin;
	let isLoading = true;
	let slicedBlobUrl: string;
	let activeRegion: Region;
	let isPlaying = false;
	let stopTime = -1;
	let stopTimer: () => void;

	onMount(createWaveForm);

	onDestroy(() => {
		stopTimer?.();

		wavesurferInstance?.destroy();

		URL.revokeObjectURL(slicedBlobUrl);
	});

	function onTimeUpdate(currentTime: number) {
		if (currentTime > stopTime) {
			pause();
		}
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

	function onSaveNewTime() {
		const adjustedStartSeconds = activeRegion.start + startTime;
		const adjustedEndSeconds = activeRegion.end + startTime;

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

						region.on('update', pause);

						activeRegion = region;
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

	function pause() {
		wavesurferInstance.pause();

		stopTimer?.();

		stopTime = -1;
	}

	function close(resolveValue: EditSubtitleResult) {
		resolver?.(resolveValue);

		dispatch('close');
	}
</script>

<DialogTemplate>
	<svelte:fragment slot="header">Edit Subtitle</svelte:fragment>
	<div class="w-full p-x-xs" slot="content" on:touchstart|stopPropagation>
		<div>
			<button title={!isPlaying ? 'Already paused' : 'Pause playback'} disabled={!isPlaying} on:click={pause}>
				<Icon path={mdiPause} />
			</button>
			<button
				title="Play active subtitle"
				class="m-l-s"
				on:click={() => {
					stopTimer?.();

					stopTime = activeRegion.end;

					stopTimer = wavesurferInstance.on('timeupdate', onTimeUpdate);

					wavesurferInstance.setTime(activeRegion.start);
					wavesurferInstance.play();
				}}
			>
				<Icon path={mdiRepeat} />
			</button>
			<button
				title="Restore time"
				class="m-l-s"
				on:click={() => {
					pause();

					activeRegion.setOptions(getRegionOptions(activeSubtitle));

					activeRegion.element.part.add('active');
				}}
			>
				<Icon path={mdiRestore} />
			</button>
		</div>
		<div class="waveform w-full h-full" bind:this={waveformContainer}></div>
		<div class="flex items-center">
			<div>{activeSubtitle.text}</div>
			{#if $bookMatched$.matchedBy}
				<button title={Action.ALIGN_SUBTITLE} class="m-l-s" on:click={onAlignSubtitle}>
					<Icon path={mdiEqual} />
				</button>
			{/if}
		</div>
	</div>
	<div class="flex grow justify-between p-x-xs" slot="footer">
		<button on:click={onCancel}>Cancel</button>
		<button on:click={onSaveNewTime}>Save</button>
	</div>
</DialogTemplate>
<div class:hidden={!isLoading} class="backdrop">
	<span class="spinner"></span>
</div>
