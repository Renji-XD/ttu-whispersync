<script lang="ts">
	import ConfirmDialog from './ConfirmDialog.svelte';
	import Icon from './Icon.svelte';
	import { Action, executeAction } from '../lib/actions';
	import {
		type Context,
		getDummySubtitle,
		type PlayLineData,
		type PointerEventWithElement,
		type Subtitle,
		type SubtitleChange,
		type EventWithElement,
	} from '../lib/general';
	import { startRecording, stopRecording } from '../lib/recorder';
	import { AutoPauseMode, ReaderMenuOpenMode } from '../lib/settings';
	import {
		activeSubtitle$,
		booksDB$,
		currentAudioLoaded$,
		currentAudioSourceUrl$,
		currentSubtitles$,
		currentTime$,
		dialogs$,
		duration$,
		exportCancelController$,
		extensionData$,
		isLoading$,
		isRecording$,
		lastError$,
		muted$,
		paused$,
		playbackRate$,
		playLine$,
		readerActionSubtitle$,
		settings$,
		skipKeyListener$,
		subtitleChange$,
	} from '../lib/stores';
	import {
		AbortError,
		between,
		caluclatePercentage,
		getLineCSSSelector,
		getLineCSSSelectorForId,
		getSubtitleIdFromElement,
		timeStringToSeconds,
		toTimeString,
	} from '../lib/util';
	import {
		mdiMinus,
		mdiPause,
		mdiPlay,
		mdiPlus,
		mdiSkipBackward,
		mdiSkipForward,
		mdiSkipNext,
		mdiSkipPrevious,
		mdiSpeedometer,
		mdiVolumeHigh,
		mdiVolumeOff,
	} from '@mdi/js';
	import Popover from './Popover.svelte';
	import Progress from './Progress.svelte';
	import { createEventDispatcher, getContext, onDestroy, onMount, tick } from 'svelte';

	export let imageLoaded: () => void;

	export async function onScrollToSubtitle() {
		if ($isRecording$ || !$readerEnableAutoScroll$) {
			return;
		}

		let targetSubtitle = $currentSubtitles$.get($activeSubtitle$.current || $activeSubtitle$.previous);

		if (!targetSubtitle) {
			const subtitles = [...$currentSubtitles$.values()];

			targetSubtitle = subtitles.findLast((subtitle) => $currentTime$ >= subtitle.startSeconds);
		}

		if (!targetSubtitle) {
			return;
		}

		if ($readerEnableTrackerAutoPause$ && statisticsEnabled) {
			document.dispatchEvent(
				new CustomEvent('ttu-action', {
					detail: {
						type: 'pauseTracker',
						scrollMode: $readerScrollMode$,
						scrollBehavior: $readerScrollBehavior$,
						selector: getLineCSSSelectorForId(targetSubtitle.id),
					},
				}),
			);
		}

		await new Promise((resolve) => setTimeout(resolve));

		document.dispatchEvent(
			new CustomEvent('ttu-action', {
				detail: {
					type: 'cue',
					scrollMode: $readerScrollMode$,
					scrollBehavior: $readerScrollBehavior$,
					selector: getLineCSSSelectorForId(targetSubtitle.id),
				},
			}),
		);
	}

	const dispatch = createEventDispatcher<{
		loaded: void;
	}>();
	const {
		readerEnableAutoScroll$,
		readerEnableTrackerAutoPause$,
		readerScrollMode$,
		readerScrollBehavior$,
		readerEnableMenuTarget$,
		readerMenuOpenMode$,
		playerEnableDictionaryDetection$,
		playerEnableWakeLock$,
		playerEnableSubtitleCopy$,
		playerAutoPauseMode$,
		playerRewindTime$,
		playerAltRewindTime$,
		playerFastForwardTime$,
		playerAltFastForwardTime$,
		playerPlaybackRateDecreaseTime$,
		playerPlaybackRateIncreaseTime$,
		exportAudioBitrate$,
		keybindingsEnableTimeFallback$,
	} = settings$;
	const { isIOS } = getContext<Context>('context');
	const statisticsEnabled = !!+`${window.localStorage.getItem('statisticsEnabled') || '0'}`;
	const yomiObserver = new MutationObserver(handleYomiMutation);
	const dictionaryObserver = new MutationObserver(handleMutation);

	let audioElement: HTMLAudioElement;
	let yomiPopover: HTMLElement | null;
	let jpdbPopover: HTMLElement | null;
	let wakeLock: WakeLockSentinel | undefined;
	let playbackRatesPopover: Popover;
	let visibilityState: DocumentVisibilityState;
	let progressToolTip = '';
	let actionStartTimes: number[] = [];
	let actionEndTimes: number[] = [];
	let pausedByAutoPause = false;
	let isLoopAction = false;
	let actionTimeIndex = -1;
	let originalCurrentTime = -1;
	let originalPlaybackRate = -1;
	let skipNextCue = false;
	let originalMuted: boolean | undefined;
	let displayedPlaybackrate = $playbackRate$;
	let recorderSuccess: undefined | ((audioBuffer: ArrayBuffer | undefined) => void);
	let recorderFailure: undefined | ((error: any) => void);

	$: rewindTitle = $isRecording$ ? 'Recording in progress' : `Rewind ${$playerRewindTime$} seconds`;

	$: altRewindTitle = $isRecording$ ? 'Recording in progress' : `Rewind ${$playerAltRewindTime$} seconds`;

	$: fastForwardTitle = $isRecording$ ? 'Recording in progress' : `Fast-Forward ${$playerFastForwardTime$} seconds`;

	$: altFastForwardTitle = $isRecording$
		? 'Recording in progress'
		: `Fast-Forward ${$playerAltFastForwardTime$} seconds`;

	$: currentProgress = Math.min(100, caluclatePercentage($currentTime$, $duration$));

	$: handleVisibilityChange(visibilityState);

	$: onPlayLine($playLine$);

	$: if (audioElement && $subtitleChange$) {
		updateTextTrack($subtitleChange$);
	}

	$: if ($playerAutoPauseMode$ !== AutoPauseMode.DISABLED && !yomiPopover) {
		yomiPopover = document.querySelector('.yomichan-popup,.yomichan-float,.yomitan-popup,.yomitan-float');

		if (!yomiPopover) {
			yomiObserver.observe(document.body, { childList: true, subtree: false });
		}
	} else {
		yomiObserver.disconnect();
	}

	$: if ($playerAutoPauseMode$ !== AutoPauseMode.DISABLED && !$playerEnableDictionaryDetection$) {
		if (yomiPopover) {
			dictionaryObserver.observe(yomiPopover, { attributes: true });
		}
		if (jpdbPopover) {
			dictionaryObserver.observe(jpdbPopover, { attributes: true });
		}
	} else {
		dictionaryObserver.disconnect();
	}

	$: if ($playerEnableWakeLock$) {
		requestWakeLock();
	} else {
		releaseWakeLock();
	}

	onMount(() => {
		document.addEventListener('ttsu:section.change', updateCSSClasses, false);

		jpdbPopover = document.getElementById('jpdb-popup');
	});

	onDestroy(() => {
		document.removeEventListener('ttsu:section.change', updateCSSClasses, false);

		yomiObserver.disconnect();
		dictionaryObserver.disconnect();

		releaseWakeLock();
	});

	async function onBlur() {
		if (
			$paused$ ||
			$isRecording$ ||
			$playerAutoPauseMode$ !== AutoPauseMode.STRICT ||
			($playerEnableDictionaryDetection$ && isDictionaryDisplayed())
		) {
			return;
		}

		$paused$ = true;
		pausedByAutoPause = true;
	}

	function onFocus() {
		if (
			!$paused$ ||
			!pausedByAutoPause ||
			$playerAutoPauseMode$ !== AutoPauseMode.STRICT ||
			(!$playerEnableDictionaryDetection$ && isDictionaryDisplayed())
		) {
			return;
		}

		$paused$ = false;
		pausedByAutoPause = false;
	}

	function onKeyDown(event: KeyboardEvent) {
		if (
			$skipKeyListener$ ||
			event.repeat ||
			!(event.ctrlKey || event.metaKey || event.altKey) ||
			!$currentAudioLoaded$ ||
			$isRecording$
		) {
			return;
		}

		const actionKey = (event.code || event.key || '').toLowerCase();
		const prioritizedSubtitle =
			$readerEnableMenuTarget$ && $readerMenuOpenMode$ !== ReaderMenuOpenMode.DISABLED
				? $readerActionSubtitle$
				: undefined;

		let action = Action.NONE;
		let stopEvent = true;
		let keepPauseState = false;
		let targetSubtitle =
			prioritizedSubtitle || $currentSubtitles$.get($activeSubtitle$.current || $activeSubtitle$.previous);
		let subtitles: Subtitle[] | undefined;

		if (!targetSubtitle && $keybindingsEnableTimeFallback$) {
			subtitles = [...$currentSubtitles$.values()];

			targetSubtitle = subtitles.findLast((subtitle) => $currentTime$ >= subtitle.startSeconds);
		}

		if (event.altKey) {
			switch (actionKey) {
				case 'keyd':
				case 'd':
					action = targetSubtitle ? Action.TOGGLE_PLAY_PAUSE : Action.NONE;

					break;
				case 'keyq':
				case 'q':
					action = Action.NEXT_SUBTITLE;

					break;
				case 'keyk':
				case 'k':
					adjustPlaybackRateBy($playerPlaybackRateIncreaseTime$);

					break;
				case 'keyj':
				case 'j':
					$paused$ = !$paused$;

					break;
				default:
					stopEvent = false;
					break;
			}
		} else {
			switch (actionKey) {
				case 'space':
				case ' ':
					$paused$ = !$paused$;

					break;
				case 'keyd':
				case 'd':
					action = targetSubtitle ? Action.RESTART_PLAYBACK : Action.NONE;

					break;
				case 'keyl':
				case 'l':
					action = targetSubtitle ? Action.TOGGLE_PLAYBACK_LOOP : Action.NONE;
					break;
				case 'keyq':
				case 'q':
					action = Action.PREVIOUS_SUBTITLE;

					break;
				case 'keyk':
				case 'k':
					adjustPlaybackRateBy(-$playerPlaybackRateDecreaseTime$);

					break;
				case 'arrowleft':
					targetSubtitle = getDummySubtitle(Math.max(0, $currentTime$ - $playerRewindTime$));
					action = Action.RESTART_PLAYBACK;
					keepPauseState = true;

					break;
				case 'arrowdown':
					targetSubtitle = getDummySubtitle(Math.max(0, $currentTime$ - $playerAltRewindTime$));
					action = Action.RESTART_PLAYBACK;
					keepPauseState = true;

					break;
				case 'arrowright':
					targetSubtitle = getDummySubtitle(Math.min($duration$, $currentTime$ + $playerFastForwardTime$));
					action = Action.RESTART_PLAYBACK;
					keepPauseState = true;

					break;
				case 'arrowup':
					targetSubtitle = getDummySubtitle(Math.min($duration$, $currentTime$ + $playerAltFastForwardTime$));
					action = Action.RESTART_PLAYBACK;
					keepPauseState = true;

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

		executeAction(action, targetSubtitle, { keepPauseState });
	}

	async function onLoadedMetadata() {
		if (!isIOS) {
			audioElement.currentTime = $currentTime$;

			return dispatch('loaded');
		}

		let attempts = 0;
		let loadResolve: (_: any) => void;

		const currentTime = $currentTime$;
		const loadedPromise = new Promise((resolve) => {
			loadResolve = resolve;

			audioElement.addEventListener('loadeddata', resolve, { once: true, capture: false });
		});

		await new Promise<boolean>((resolver) =>
			dialogs$.add({
				component: ConfirmDialog,
				props: {
					dialogHeader: 'Audio',
					dialogMessage: 'Start audio session',
					showCancel: false,
					resolver,
				},
			}),
		);

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

		setTime(currentTime);

		await tick();

		dispatch('loaded');
	}

	async function onCurrentTimeChange() {
		if ($exportCancelController$?.signal.aborted) {
			await stopRecording($exportAudioBitrate$, true).catch(() => {
				// no-op
			});

			recorderFailure?.(new AbortError('user aborted'));

			actionStartTimes = [];
			actionEndTimes = [];
			actionTimeIndex = -1;
			isLoopAction = false;
			$paused$ = true;

			return resetRecorderContext();
		} else if (actionTimeIndex > -1 && $currentTime$ > actionEndTimes[actionTimeIndex]) {
			const endReached = actionTimeIndex === actionEndTimes.length - 1;
			const restartLoop = isLoopAction && endReached;
			const executeAction = restartLoop || !endReached;
			const oldActionTimeIndex = actionTimeIndex;

			actionTimeIndex = -1;

			if (executeAction) {
				actionTimeIndex = restartLoop ? 0 : oldActionTimeIndex + 1;

				return setTime(actionStartTimes[actionTimeIndex]);
			}

			actionStartTimes = [];
			actionEndTimes = [];
			isLoopAction = false;
			$paused$ = true;

			if (recorderSuccess) {
				const audioBuffer = await stopRecording($exportAudioBitrate$).catch((error) => {
					recorderFailure?.(error);
					resetRecorderContext();

					return undefined;
				});

				recorderSuccess(audioBuffer);
			}

			return resetRecorderContext();
		}

		let storePlaybackPosition = $currentAudioLoaded$;

		if (!$currentAudioLoaded$) {
			$currentAudioLoaded$ = true;

			if ($currentSubtitles$.size) {
				updateTextTrack({ subtitles: [...$currentSubtitles$.values()], replaceTrack: true });
			}

			await Promise.all([tick(), imageLoaded()]);

			$isLoading$ = false;
		}

		if (originalCurrentTime > -1 || !storePlaybackPosition) {
			return;
		}

		$lastError$ = '';

		try {
			const playbackPosition = $currentTime$;

			await $booksDB$.put('audioBook', {
				playbackPosition,
				title: $extensionData$.title,
				lastAudioBookModified: Date.now(),
			});

			$extensionData$.playbackPosition = playbackPosition;

			document.dispatchEvent(new CustomEvent('ttu-action', { detail: { type: 'sync', syncType: 'audioBook' } }));
		} catch ({ message }: any) {
			$lastError$ = `Failed to update current time: ${message}`;
		}

		$extensionData$ = $extensionData$;
	}

	function onProgressToolTip(event: PointerEventWithElement<Element>) {
		progressToolTip = toTimeString(calculateTime(event));
	}

	async function onProgressClick() {
		await tick();

		executeAction(Action.RESTART_PLAYBACK, getDummySubtitle(timeStringToSeconds(progressToolTip)), {
			keepPauseState: true,
		});
	}

	function onChangePlaybackRate({ currentTarget }: EventWithElement<HTMLInputElement>) {
		const newPlaybackRate = Number.parseFloat(currentTarget.value);

		$playbackRate$ = newPlaybackRate;
		playbackRatesPopover.hide();
	}

	function setTime(seconds: number) {
		$currentTime$ = seconds;

		if (audioElement) {
			audioElement.currentTime = seconds;
		}
	}

	function resetRecorderContext() {
		recorderSuccess = undefined;
		recorderFailure = undefined;

		if (originalCurrentTime > -1) {
			skipNextCue = true;
			setTime(originalCurrentTime);
		}

		if (originalPlaybackRate > -1) {
			$playbackRate$ = originalPlaybackRate;
		}

		if (originalMuted !== undefined) {
			$muted$ = originalMuted;
		}

		originalCurrentTime = -1;
		originalPlaybackRate = -1;
		originalMuted = undefined;
	}

	function calculateTime(event: PointerEventWithElement<Element>) {
		const rect = event.currentTarget.getBoundingClientRect();

		return between(
			0,
			$duration$,
			Math.ceil(((event.clientX - rect.left) / rect.width) * $duration$ + Number.EPSILON),
		);
	}

	function handleVisibilityChange(state: DocumentVisibilityState) {
		if (state === 'visible' && $playerEnableWakeLock$) {
			setTimeout(requestWakeLock, 500);
		}

		if ($playerAutoPauseMode$ !== AutoPauseMode.MODERATE || $isRecording$) {
			return;
		}

		if (state === 'hidden' && !$paused$ && (!$playerEnableDictionaryDetection$ || !isDictionaryDisplayed())) {
			$paused$ = true;
			pausedByAutoPause = true;
		} else if (
			$paused$ &&
			pausedByAutoPause &&
			state === 'visible' &&
			($playerEnableDictionaryDetection$ || !isDictionaryDisplayed())
		) {
			$paused$ = false;
			pausedByAutoPause = false;
		}
	}

	async function onPlayLine(data: PlayLineData) {
		if (!$currentAudioLoaded$ || !data.subtitles.length) {
			return;
		}

		await tick();

		const { action, subtitles, skipUpdates, keepPauseState } = data;
		const { startSeconds } = subtitles[0];
		const executeAction = action !== Action.RESTART_PLAYBACK;

		({ recorderSuccess, recorderFailure } = data);

		if (skipUpdates || recorderSuccess) {
			originalCurrentTime = originalCurrentTime > -1 ? originalCurrentTime : $currentTime$;
			originalPlaybackRate = originalPlaybackRate > -1 ? originalPlaybackRate : $playbackRate$;
			originalMuted = originalMuted !== undefined ? originalMuted : $muted$;
		} else {
			originalCurrentTime = -1;
			originalPlaybackRate = -1;
			originalMuted = undefined;
			skipNextCue = false;
		}

		if (
			!skipUpdates &&
			!$isRecording$ &&
			$readerEnableAutoScroll$ &&
			$readerEnableTrackerAutoPause$ &&
			statisticsEnabled
		) {
			const nextSubtitle = [...$currentSubtitles$.values()].findLast(
				(subtitle) => startSeconds >= subtitle.startSeconds,
			);

			if (nextSubtitle && nextSubtitle.id !== $activeSubtitle$.current) {
				document.dispatchEvent(
					new CustomEvent('ttu-action', {
						detail: {
							type: 'pauseTracker',
							scrollMode: $readerScrollMode$,
							scrollBehavior: $readerScrollBehavior$,
							selector: getLineCSSSelectorForId(nextSubtitle.id),
						},
					}),
				);
			}
		}

		actionStartTimes = executeAction ? subtitles.map((subtitle) => subtitle.startSeconds) : [];
		actionEndTimes = executeAction ? subtitles.map((subtitle) => subtitle.endSeconds) : [];
		actionTimeIndex = executeAction ? 0 : -1;
		isLoopAction = executeAction ? action === Action.TOGGLE_PLAYBACK_LOOP : false;

		setTime(startSeconds);

		if (recorderSuccess && recorderFailure) {
			return startRecording(audioElement)
				.then(() => {
					$playbackRate$ = 1;
					$muted$ = false;
					$paused$ = false;
				})
				.catch((error) => {
					recorderFailure?.(error);
					resetRecorderContext();
				});
		}

		if (!keepPauseState) {
			$paused$ = false;
		}
	}

	function updateTextTrack(subtitleChange: SubtitleChange) {
		const { subtitles } = subtitleChange;
		const existingTracks = [...audioElement.textTracks];
		const activeTrack = existingTracks.findLast((track) => track.mode !== 'disabled');

		if (subtitleChange.replaceTrack) {
			for (let index = 0, { length } = existingTracks; index < length; index += 1) {
				existingTracks[index].mode = 'disabled';
			}
		}

		if (!subtitles.length) {
			return updateCSSClasses();
		}

		if (subtitleChange.replaceTrack) {
			const trackElement = audioElement.addTextTrack('captions', 'Captions', 'jp');

			for (let index = 0, { length } = subtitles; index < length; index += 1) {
				trackElement.addCue(createCue(subtitles[index]));
			}

			trackElement.mode = 'hidden';

			return;
		}

		if (!activeTrack) {
			return;
		}

		for (let index = 0, { length } = subtitles; index < length; index += 1) {
			const changedSubtitle = subtitles[index];
			const oldCue = activeTrack.cues?.getCueById(changedSubtitle.id);

			if (oldCue) {
				oldCue.removeEventListener('enter', handleCueEnter, false);
				oldCue.removeEventListener('exit', updateCSSClasses, false);

				activeTrack.removeCue(oldCue);
			}

			activeTrack.addCue(createCue(changedSubtitle));
		}

		activeTrack.mode = 'hidden';
	}

	function createCue(subtile: Subtitle) {
		const cue = new VTTCue(subtile.startSeconds, subtile.endSeconds, '');

		cue.id = subtile.id;

		cue.addEventListener('enter', handleCueEnter, false);
		cue.addEventListener('exit', updateCSSClasses, false);

		return cue;
	}

	function handleCueEnter(event: Event) {
		const { id } = event.target as VTTCue;

		updateCSSClasses(id);

		if (originalCurrentTime === -1 && $readerEnableAutoScroll$ && !skipNextCue) {
			document.dispatchEvent(
				new CustomEvent('ttu-action', {
					detail: {
						type: 'cue',
						scrollMode: $readerScrollMode$,
						scrollBehavior: $readerScrollBehavior$,
						selector: getLineCSSSelectorForId(id),
					},
				}),
			);
		}

		if (skipNextCue) {
			skipNextCue = false;
		}

		if ($playerEnableSubtitleCopy$) {
			navigator.clipboard
				.writeText($currentSubtitles$.get(id)?.text || '')
				.catch(({ message }) => console.log(`failed to copy subtitle: ${message}`));
		}
	}

	async function updateCSSClasses(lastActiveId?: string | Event) {
		if (originalCurrentTime > -1) {
			return;
		}

		const activeTrack = [...audioElement.textTracks].findLast((track) => track.mode !== 'disabled');

		let activeCues = [...(activeTrack?.activeCues || [])].map((cue) => cue.id);

		if (activeTrack && !activeCues.length && typeof lastActiveId === 'string' && isIOS) {
			const fallbackId =
				[...$currentSubtitles$.values()].findLast((subtitle) => $currentTime$ >= subtitle.startSeconds)?.id ||
				'';

			if (fallbackId) {
				activeCues.push(fallbackId);
			}
		}

		if ($paused$ && activeCues.length > 1) {
			const subtitle1 = $currentSubtitles$.get(activeCues[activeCues.length - 2])!;
			const subtitle2 = $currentSubtitles$.get(activeCues[activeCues.length - 1])!;

			if (
				(subtitle1.startSeconds >= subtitle2.startSeconds && subtitle1.startSeconds <= subtitle2.endSeconds) ||
				(subtitle2.startSeconds >= subtitle1.startSeconds && subtitle2.startSeconds <= subtitle1.endSeconds)
			) {
				activeCues = [subtitle2.id];
			}
		}

		const elements = document.querySelectorAll(
			`${getLineCSSSelector()}.active${
				activeCues.length
					? `,${activeCues.map((activeCue) => getLineCSSSelectorForId(activeCue)).join(',')}`
					: ''
			}`,
		);

		for (let index = 0, { length } = elements; index < length; index += 1) {
			const element = elements[index];
			const id = getSubtitleIdFromElement(element);

			if (id !== 'not existing' && activeCues.find((activeCue) => activeCue === id)) {
				element.classList.add('active');
			} else {
				element.classList.remove('active');
			}
		}

		if (activeCues.length) {
			$activeSubtitle$ = {
				previous: $activeSubtitle$.current,
				current: activeCues[activeCues.length - 1],
				useTimeFallback: false,
			};
		} else {
			$activeSubtitle$ = {
				previous: $activeSubtitle$.current,
				current: '',
				useTimeFallback: true,
			};
		}
	}

	function handleYomiMutation() {
		yomiPopover = document.querySelector('.yomichan-popup,.yomichan-float,.yomitan-popup,.yomitan-float');

		if (yomiPopover) {
			yomiObserver.disconnect();
		}
	}

	function handleMutation() {
		if ((!jpdbPopover && !yomiPopover) || $isRecording$) {
			return;
		}

		const isDisplayed = isDictionaryDisplayed();

		if (isDisplayed && !$paused$) {
			$paused$ = true;
			pausedByAutoPause = true;
		} else if (!isDisplayed && $paused$ && pausedByAutoPause) {
			$paused$ = false;
			pausedByAutoPause = false;
		}
	}

	function isDictionaryDisplayed() {
		return (
			(yomiPopover && yomiPopover.style.visibility !== 'hidden') ||
			(jpdbPopover && jpdbPopover.style.opacity !== '0')
		);
	}

	async function requestWakeLock() {
		if (wakeLock && !wakeLock.released) {
			return;
		}

		wakeLock = await navigator.wakeLock.request().catch(() => undefined);

		if (wakeLock) {
			wakeLock.addEventListener('release', releaseWakeLock, false);
		}
	}

	async function releaseWakeLock() {
		if (wakeLock && !wakeLock.released) {
			await wakeLock.release().catch(() => {
				// no-op
			});
		}

		wakeLock = undefined;
	}

	function adjustPlaybackRateBy(value: number) {
		$playbackRate$ = between(0.1, 2, Math.round(($playbackRate$ + value) * 100 + Number.EPSILON) / 100);
		displayedPlaybackrate = $playbackRate$;
	}
</script>

{#key $currentAudioSourceUrl$}
	<audio
		controls
		class="hidden"
		src={$currentAudioSourceUrl$}
		bind:currentTime={$currentTime$}
		bind:duration={$duration$}
		bind:muted={$muted$}
		bind:paused={$paused$}
		bind:playbackRate={$playbackRate$}
		bind:this={audioElement}
		on:loadstart
		on:loadedmetadata={onLoadedMetadata}
		on:timeupdate={onCurrentTimeChange}
		on:pause={onCurrentTimeChange}
		on:playing={requestWakeLock}
		on:error
	>
	</audio>
{/key}

<svelte:document bind:visibilityState />
<svelte:window on:blur={onBlur} on:focus={onFocus} on:keydown={onKeyDown} />

<div class="flex items-center w-full m-t-b" class:invisible={!$currentAudioLoaded$}>
	<button
		title="Toggle playback"
		class="m-x-xs"
		disabled={$isRecording$}
		on:click={() => {
			$paused$ = !$paused$;
			pausedByAutoPause = false;
		}}
	>
		<Icon path={$isRecording$ || $paused$ ? mdiPlay : mdiPause} />
	</button>
	<button
		class="m-x-xs"
		title={altRewindTitle}
		disabled={$isRecording$}
		on:click={() =>
			executeAction(
				Action.RESTART_PLAYBACK,
				getDummySubtitle(Math.max(0, $currentTime$ - $playerAltRewindTime$)),
				{ keepPauseState: true },
			)}
	>
		<Icon path={mdiSkipBackward} />
	</button>
	<button
		class="m-x-xs"
		title={rewindTitle}
		disabled={$isRecording$}
		on:click={() =>
			executeAction(Action.RESTART_PLAYBACK, getDummySubtitle(Math.max(0, $currentTime$ - $playerRewindTime$)), {
				keepPauseState: true,
			})}
	>
		<Icon path={mdiSkipPrevious} />
	</button>
	<button
		class="w-full relative player-progress-tooltip-button m-x-xs"
		class:recording={$isRecording$}
		disabled={$isRecording$}
		title={$isRecording$ ? 'Recording in progress' : null}
		on:pointerenter={onProgressToolTip}
		on:pointermove={onProgressToolTip}
		on:pointerout={onProgressToolTip}
		on:click={onProgressClick}
	>
		<Progress currentProgress={Math.min(100, currentProgress)} height={1.5} />
		<span class="w-full absolute left-0 player-progress-tooltip">
			{progressToolTip}
		</span>
	</button>
	<button
		class="m-x-xs"
		title={fastForwardTitle}
		disabled={$isRecording$}
		on:click={() =>
			executeAction(
				Action.RESTART_PLAYBACK,
				getDummySubtitle(Math.min($duration$, $currentTime$ + $playerFastForwardTime$)),
				{ keepPauseState: true },
			)}
	>
		<Icon path={mdiSkipNext} />
	</button>
	<button
		class="m-x-xs"
		title={altFastForwardTitle}
		disabled={$isRecording$}
		on:click={() =>
			executeAction(
				Action.RESTART_PLAYBACK,
				getDummySubtitle(Math.min($duration$, $currentTime$ + $playerAltFastForwardTime$)),
				{ keepPauseState: true },
			)}
	>
		<Icon path={mdiSkipForward} />
	</button>
	<button title="Toggle mute" class="m-x-xs" disabled={$isRecording$} on:click={() => ($muted$ = !$muted$)}>
		<Icon path={$isRecording$ || !$muted$ ? mdiVolumeHigh : mdiVolumeOff} />
	</button>
	<Popover placement="top" fallbackPlacements={['top-start', 'left-start']} bind:this={playbackRatesPopover}>
		<div class="flex m-x-xs" slot="icon">
			<button title="Change playback speed" disabled={$isRecording$}>
				<Icon path={mdiSpeedometer} />
			</button>
		</div>
		<div class="playback-rates">
			<input
				type="range"
				min="0.1"
				max="2"
				step="0.05"
				disabled={$isRecording$}
				bind:value={displayedPlaybackrate}
				on:change={onChangePlaybackRate}
			/>
			<div class="playback-display flex m-t-s">
				<button
					disabled={$isRecording$}
					on:click={() => adjustPlaybackRateBy(-$playerPlaybackRateDecreaseTime$)}
				>
					<Icon path={mdiMinus} />
				</button>
				<span class="m-x-s">{displayedPlaybackrate}</span>
				<button
					disabled={$isRecording$}
					on:click={() => adjustPlaybackRateBy($playerPlaybackRateIncreaseTime$)}
				>
					<Icon path={mdiPlus} />
				</button>
			</div>
		</div>
	</Popover>
</div>
