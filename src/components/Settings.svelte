<script lang="ts">
	import Icon from './Icon.svelte';
	import { Action, persistSubtitles } from '../lib/actions';
	import { getDecksAndModels, getFields, resetAnkiSettings, setApiKey } from '../lib/anki';
	import { getChapterData, initializeFFMPEG, putAudioFileInFFMPEG, terminateFFMPEG } from '../lib/ffmpeg';
	import { updateAudio } from '../lib/files';
	import { type Subtitle, type Context, type EventWithElement } from '../lib/general';
	import { setMediaInfoInstance } from '../lib/mediaInfo';
	import {
		AnkiDuplicateMode,
		AnkiSettingssMode,
		AudioFormat,
		AudioProcessor,
		AutoPauseMode,
		ExportFieldMode,
		ReaderMenuOpenMode,
		ReaderMenuPauseMode,
		ReaderScrollBehavior,
		ReaderScrollMode,
		SettingsMenu,
		SubtitleActionsVisibility,
	} from '../lib/settings';
	import {
		currentAudioChapters$,
		currentAudioFile$,
		currentCoverUrl$,
		currentSubtitleFile$,
		currentSubtitles$,
		duration$,
		exportCancelController$,
		isLoading$,
		isMobile$,
		lastError$,
		settings$,
		subtitleChange$,
		type SettingsStore,
	} from '../lib/stores';
	import { between, interactWithSandbox, onNumberFieldChange, toTimeStamp } from '../lib/util';
	import { mdiHelpCircle, mdiRepeatVariant, mdiTrashCan } from '@mdi/js';
	import Popover from './Popover.svelte';
	import SettingsCheckbox from './SettingsCheckbox.svelte';
	import SettingsColorInput from './SettingsColorInput.svelte';
	import SettingsKeybind from './SettingsKeybind.svelte';
	import SettingsMenuContent from './SettingsMenuContent.svelte';
	import SettingsNumberInput from './SettingsNumberInput.svelte';
	import SettingsSelect from './SettingsSelect.svelte';
	import SettingsTextInput from './SettingsTextInput.svelte';
	import { getContext, tick } from 'svelte';
	import { get } from 'svelte/store';

	const wakeLockSupported = 'wakeLock' in navigator;
	const { supportsFileSystem, sandboxElement } = getContext<Context>('context');
	const footerActions = [
		Action.TOGGLE_PLAYBACK,
		Action.RESTART_PLAYBACK,
		Action.TOGGLE_PLAY_PAUSE,
		Action.TOGGLE_PLAYBACK_LOOP,
		Action.TOGGLE_BOOKMARK,
		Action.TOGGLE_MERGE,
		Action.EDIT_SUBTITLE,
		Action.RESTORE_SUBTITLE,
		Action.EXPORT_NEW,
		Action.EXPORT_UPDATE,
	];
	const clickActions = [
		Action.NONE,
		Action.RESTART_PLAYBACK,
		Action.TOGGLE_PLAY_PAUSE,
		Action.TOGGLE_PLAYBACK_LOOP,
		Action.TOGGLE_BOOKMARK,
		Action.TOGGLE_MERGE,
		Action.EDIT_SUBTITLE,
		Action.RESTORE_SUBTITLE,
		Action.EXPORT_NEW,
		Action.EXPORT_UPDATE,
	];
	const readerScrollModes = [ReaderScrollMode.ALWAYS, ReaderScrollMode.PAGE];
	const readerScrollBehaviors = [
		ReaderScrollBehavior.AUTO,
		ReaderScrollBehavior.INSTANT,
		ReaderScrollBehavior.SMOOTH,
	];
	const readerMenuOpenModes = [ReaderMenuOpenMode.DISABLED, ReaderMenuOpenMode.CLICK, ReaderMenuOpenMode.HOLD];
	const readerMenuPauseModes = [ReaderMenuPauseMode.DISABLED, ReaderMenuPauseMode.PAUSE];
	const subtitleActionVisbilityModes = [
		SubtitleActionsVisibility.HIDDEN,
		SubtitleActionsVisibility.ALWAYS,
		SubtitleActionsVisibility.HOVER,
		SubtitleActionsVisibility.TOGGLE,
	];
	const autoPauseModes = [AutoPauseMode.DISABLED, AutoPauseMode.MODERATE, AutoPauseMode.STRICT];
	const exportFieldModes = [ExportFieldMode.BEFORE, ExportFieldMode.AFTER, ExportFieldMode.REPLACE];
	const audioProcessors = [AudioProcessor.RECORDER, AudioProcessor.FFMPEG];
	const ankiDuplicateModes = [
		AnkiDuplicateMode.DISABLED,
		AnkiDuplicateMode.DECK,
		AnkiDuplicateMode.SUBDECK,
		AnkiDuplicateMode.COLLECTION,
	];
	const {
		readerLineHighlightColor$,
		readerLineTextHighlightColor$,
		readerEnableLineHighlight$,
		readerEnableAutoScroll$,
		readerFooterActions$,
		readerScrollMode$,
		readerClickAction$,
		readerMenuOpenMode$,
		subtitlesEnablePersist$,
		subtitlesCopyFontFamily$,
		subtitlesCopyFontSize$,
		subtitlesCopyLineHeight$,
		subtitlesClickAction$,
		subtitlesActionsVisibility$,
		subtitlesGlobalStartPadding$,
		subtitlesGlobalEndPadding$,
		playerEnableCover$,
		playerEnableChapters$,
		playerAutoPauseMode$,
		playerRewindTime$,
		playerAltRewindTime$,
		playerFastForwardTime$,
		playerAltFastForwardTime$,
		exportAudioProcessor$,
		exportAudioFormat$,
		ankiDuplicateMode$,
		ankiUrl$,
		ankiKey$,
		ankiDeck$,
		ankiUpdateDeck$,
		ankiModel$,
		ankiUpdateModel$,
		ankiSentenceField$,
		ankiUpdateSentenceField$,
		ankiSoundField$,
		ankiUpdateSoundField$,
	} = settings$;
	const ankiModelFields = new Map<string, string[]>();
	const ankiSettingsModes: AnkiSettingssMode[] = [AnkiSettingssMode.CREATE, AnkiSettingssMode.UPDATE];

	let ankiSettingsMode = AnkiSettingssMode.CREATE;
	let openSettingsMenu = SettingsMenu.READER;
	let autoPauseHelpText = '';
	let ankiDecks: string[] = [];
	let ankiModels: string[] = [];
	let ankiFields: string[] = [];

	$: readerScrollModeHelpText =
		$readerScrollMode$ === ReaderScrollMode.ALWAYS
			? 'The reader scrolls on every subtitle change'
			: 'The reader will only scroll if the subtitle is not fully visibile on the page';

	$: audioProcessorHelpText =
		$exportAudioProcessor$ === AudioProcessor.RECORDER
			? `Use realtime audio recording - requires to block certain actions during export`
			: 'Use background transcoding (file limit ~1.8 GB) - has certain performance requirements and may crash the site but is non blocking. Reload the page/use recorder in case of issues';

	$: availableAudioFormats =
		$exportAudioProcessor$ === AudioProcessor.FFMPEG
			? [AudioFormat.MP3, AudioFormat.OGG, AudioFormat.OPUS]
			: [AudioFormat.MP3];

	$: showAnkiCreateSettings = ankiSettingsMode === AnkiSettingssMode.CREATE;

	$: if ($playerAutoPauseMode$ === AutoPauseMode.DISABLED) {
		autoPauseHelpText = 'Player does not auto pause';
	} else {
		autoPauseHelpText =
			$playerAutoPauseMode$ === AutoPauseMode.MODERATE
				? 'Player will auto pause when the browser tab loses focus'
				: 'Player will auto pause on any kind of site focus loss (e. g. different window etc.)';
	}

	$: if ($exportAudioProcessor$ === AudioProcessor.RECORDER) {
		$exportAudioFormat$ = AudioFormat.MP3;
	}

	$: if (openSettingsMenu === SettingsMenu.ANKI) {
		onFetchAnkiData();
	}

	$: onUpdateColorStylesNode($readerEnableLineHighlight$);

	async function onUpdateColorStylesNode(_?: any) {
		await tick();

		const nodeId = 'ttu-whispersync-color-styles';
		const textNode = document.createTextNode(
			`${
				$readerEnableLineHighlight$ ? `span[class^='ttu-whispersync-line-highlight-'].active,` : ''
			}span[class^='ttu-whispersync-line-highlight-'].menu-open {color: ${$readerLineTextHighlightColor$};background-color: ${$readerLineHighlightColor$};}`,
		);

		let styleElement = document.getElementById(nodeId);

		if (styleElement) {
			return styleElement.replaceChild(textNode, styleElement.firstChild!);
		}

		styleElement = document.createElement('style');
		styleElement.id = nodeId;

		styleElement.appendChild(textNode);
		document.head.append(styleElement);
	}

	async function onChangePersistSubtitles() {
		if (!$subtitlesEnablePersist$ || !$currentSubtitleFile$) {
			return;
		}

		$isLoading$ = true;
		$lastError$ = '';

		await persistSubtitles({
			name: $currentSubtitleFile$.name,
			subtitles: [...$currentSubtitles$.values()],
		}).catch(({ message }: any) => ($lastError$ = message));

		$isLoading$ = false;
	}

	async function onChangeGlobalPadding(
		event: EventWithElement<HTMLInputElement>,
		targetStore: SettingsStore<number>,
	) {
		$isLoading$ = true;

		const oldStartPadding = $subtitlesGlobalStartPadding$;
		const oldEndPadding = $subtitlesGlobalEndPadding$;

		await onNumberFieldChange(event, targetStore);

		if (
			!$currentSubtitles$.size ||
			(oldStartPadding === $subtitlesGlobalStartPadding$ && oldEndPadding === $subtitlesGlobalEndPadding$)
		) {
			$isLoading$ = false;

			return;
		}

		const newSubtitles: Subtitle[] = [];
		const newSubtitleData = new Map<string, Subtitle>();
		const oldSubtitleData = [...$currentSubtitles$.entries()];
		const subtitlesGlobalStartPadding = $subtitlesGlobalStartPadding$ / 1000;
		const subtitlesGlobalEndPadding = $subtitlesGlobalEndPadding$ / 1000;

		for (let index = 0, { length } = oldSubtitleData; index < length; index += 1) {
			const [id, subtitle] = oldSubtitleData[index];
			const startSeconds =
				subtitle.adjustedStartSeconds ??
				Math.max(0, subtitle.originalStartSeconds + subtitlesGlobalStartPadding);
			const endSeconds =
				subtitle.adjustedEndSeconds ??
				($duration$
					? between(0, $duration$, subtitle.originalEndSeconds + subtitlesGlobalEndPadding)
					: Math.max(0, subtitle.originalEndSeconds + subtitlesGlobalEndPadding));
			const newSubtitle: Subtitle = {
				...subtitle,
				...{ startSeconds, startTime: toTimeStamp(startSeconds), endSeconds, endTime: toTimeStamp(endSeconds) },
			};

			newSubtitles.push(newSubtitle);
			newSubtitleData.set(id, newSubtitle);
		}

		$currentSubtitles$ = newSubtitleData;
		subtitleChange$.set({ subtitles: newSubtitles, replaceTrack: true });

		if ($subtitlesEnablePersist$) {
			$lastError$ = '';

			await persistSubtitles({
				name: $currentSubtitleFile$!.name,
				subtitles: newSubtitles,
			}).catch(({ message }: any) => ($lastError$ = message));
		}

		$isLoading$ = false;
	}

	async function onChangeEnableCover() {
		$isLoading$ = true;
		$lastError$ = '';

		try {
			await (sandboxElement
				? interactWithSandbox<void>(sandboxElement, {
						action: 'setMediaInfoInstance',
						enableCover: $playerEnableCover$,
						url: chrome.runtime.getURL('src/assets/js/MediaInfoModule_0.2.1.wasm'),
					})
				: setMediaInfoInstance($playerEnableCover$, true, ''));
		} catch ({ message }: any) {
			$lastError$ = `MediaInfo failure: ${message}`;
			$isLoading$ = false;

			return;
		}

		if ($playerEnableCover$ && $currentAudioFile$) {
			try {
				const { coverUrl } = await updateAudio($currentAudioFile$, sandboxElement, false, true);

				URL.revokeObjectURL($currentCoverUrl$);

				$currentCoverUrl$ = coverUrl;
			} catch ({ message }: any) {
				$lastError$ = `Failed to set cover: ${message}`;
			}
		} else if (!$playerEnableCover$) {
			URL.revokeObjectURL($currentCoverUrl$);

			$currentCoverUrl$ = '';
		}

		$isLoading$ = false;
	}

	async function onChangeEnableChapters() {
		$isLoading$ = true;
		$lastError$ = '';

		try {
			await (sandboxElement
				? interactWithSandbox<void>(sandboxElement, {
						action: 'setMediaInfoInstance',
						enableCover: $playerEnableCover$,
						url: chrome.runtime.getURL('src/assets/js/MediaInfoModule_0.2.1.wasm'),
					})
				: setMediaInfoInstance($playerEnableCover$, true, ''));
		} catch ({ message }: any) {
			$lastError$ = `MediaInfo failure: ${message}`;
			$isLoading$ = false;

			return;
		}

		if ($playerEnableChapters$ && $currentAudioFile$) {
			try {
				let { chapters } = await updateAudio($currentAudioFile$, sandboxElement, false, true);

				if (!chapters.length && $exportAudioProcessor$ === AudioProcessor.FFMPEG) {
					chapters = await getChapterData($currentAudioFile$);
				}

				$currentAudioChapters$ = chapters;
			} catch ({ message }: any) {
				$lastError$ = `Failed to set chapters: ${message}`;
			}
		} else if (!$playerEnableChapters$) {
			$currentAudioChapters$ = [];
		}

		$isLoading$ = false;
	}

	async function onChangeAudioProcessor({ currentTarget }: Event) {
		if (!(currentTarget instanceof HTMLSelectElement)) {
			return;
		}

		$isLoading$ = true;
		$lastError$ = '';

		let nextAudioProcessor = AudioProcessor.RECORDER;

		if ($exportAudioProcessor$ === AudioProcessor.FFMPEG) {
			try {
				await initializeFFMPEG();
				await putAudioFileInFFMPEG($currentAudioFile$);

				nextAudioProcessor = AudioProcessor.FFMPEG;
			} catch ({ message }: any) {
				$lastError$ = `Update to FFMPEG failed: ${message}`;
			}
		}

		if (
			nextAudioProcessor === AudioProcessor.FFMPEG &&
			!$currentAudioChapters$.length &&
			$playerEnableChapters$ &&
			$currentAudioFile$
		) {
			$currentAudioChapters$ = await getChapterData($currentAudioFile$);
		}

		if (nextAudioProcessor === AudioProcessor.RECORDER) {
			try {
				terminateFFMPEG();
			} catch (_) {
				// no-op
			}
		}

		currentTarget.value = nextAudioProcessor;
		$exportAudioProcessor$ = nextAudioProcessor;
		$isLoading$ = false;
	}

	async function onFetchAnkiData(forceRefresh = false, forceFieldCheck = false) {
		if (!forceRefresh && !forceFieldCheck && ankiDecks.length && ankiModels.length) {
			return;
		}

		$isLoading$ = true;
		$lastError$ = '';

		try {
			if (forceRefresh || !ankiDecks.length || !ankiModels.length) {
				[ankiDecks, ankiModels] = await getDecksAndModels($ankiUrl$);
			}

			if (forceRefresh) {
				ankiModelFields.clear();
			}

			let targetDeck$ = showAnkiCreateSettings ? ankiDeck$ : ankiUpdateDeck$;
			let targetModel$ = showAnkiCreateSettings ? ankiModel$ : ankiUpdateModel$;
			let targetDeck = get(targetDeck$);
			let targetModel = get(targetModel$);

			if (targetDeck && !ankiDecks.find((ankiDeck) => ankiDeck === targetDeck)) {
				targetDeck$.set('');
			}

			if (targetModel && !ankiModels.find((ankiModel) => ankiModel === targetModel)) {
				targetModel$.set('');
				targetModel = '';
			}

			if (targetModel) {
				await onUpdateAnkiFields(targetModel);
			}
		} catch ({ message }: any) {
			$lastError$ = `Failed to get Anki data: ${message}`;

			resetAnkiData();
		}

		$isLoading$ = false;
	}

	async function onUpdateAnkiFields(targetModel: string) {
		$isLoading$ = true;
		$lastError$ = '';

		try {
			ankiFields = await (ankiModelFields.has(targetModel)
				? Promise.resolve(ankiModelFields.get(targetModel)!)
				: getFields($ankiUrl$, targetModel));

			ankiModelFields.set(targetModel, ankiFields);

			let targetSentenceField$ = showAnkiCreateSettings ? ankiSentenceField$ : ankiUpdateSentenceField$;
			let targetSoundField$ = showAnkiCreateSettings ? ankiSoundField$ : ankiUpdateSoundField$;
			let targetSentenceField = get(targetSentenceField$);
			let targetSoundField = get(targetSoundField$);

			if (targetSentenceField && !ankiFields.find((field) => field === targetSentenceField)) {
				targetSentenceField$.set('');
			}

			if (targetSoundField && !ankiFields.find((field) => field === targetSoundField)) {
				targetSoundField$.set('');
			}
		} catch ({ message }: any) {
			$lastError$ = `Failed to get Anki data: ${message}`;

			resetAnkiData();
		}

		$isLoading$ = false;
	}

	function resetAnkiData() {
		resetAnkiSettings(!showAnkiCreateSettings);

		ankiModelFields.clear();

		ankiDecks = [];
		ankiModels = [];
		ankiFields = [];
	}
</script>

<div>
	<SettingsMenuContent settingsMenu={SettingsMenu.READER} bind:openSettingsMenu>
		<SettingsColorInput
			label="Line highlight"
			targetStore$={readerLineHighlightColor$}
			on:change={onUpdateColorStylesNode}
			on:reset={onUpdateColorStylesNode}
		/>
		<SettingsColorInput
			label="Line text color"
			targetStore$={readerLineTextHighlightColor$}
			on:change={onUpdateColorStylesNode}
			on:reset={onUpdateColorStylesNode}
		/>
		<SettingsCheckbox
			label="Enable line highlight"
			helpText="If enabled active subtitles will be highlighted in the reader - requires matched book/line and subtitle/audio file"
			targetStore$={readerEnableLineHighlight$}
		/>
		{#if supportsFileSystem}
			<SettingsCheckbox
				label="Enable auto reload"
				helpText="If enabled the reader will attempt to reload last used files from filesystem automatically without the need for opening the side menu"
				targetStore$={settings$.readerEnableAutoReload$}
			/>
		{/if}
		<SettingsCheckbox
			label="Enable auto scroll"
			helpText="If enabled the reader will automatically scroll to active subtitles - requires matched book/line and subtitle/audio file"
			targetStore$={readerEnableAutoScroll$}
		/>
		{#if $readerEnableAutoScroll$}
			<SettingsCheckbox
				label="Enable tracker pause"
				helpText="If enabled user triggered changes to the playback position (e. g. click action, player controls etc.) will auto pause and unpause the reading tracker"
				targetStore$={settings$.readerEnableTrackerAutoPause$}
			/>
		{/if}
		{#if $readerClickAction$ !== Action.NONE || $readerMenuOpenMode$ !== ReaderMenuOpenMode.DISABLED}
			<SettingsCheckbox
				label="Prevent action on selection"
				helpText="If enabled click/hold will not execute any action / open the reader menu in case any text is selected"
				targetStore$={settings$.readerPreventActionOnSelection$}
			/>
		{/if}
		{#if $readerMenuOpenMode$ !== ReaderMenuOpenMode.DISABLED}
			<SettingsCheckbox
				label="Enable menu target"
				helpText="If enabled keybindings will prioritize the active menu subtitle over the current played one"
				targetStore$={settings$.readerEnableMenuTarget$}
			/>
		{/if}
		<label for={readerFooterActions$.key()}>Footer Actions</label>
		<select multiple size="3" bind:value={$readerFooterActions$}>
			{#each footerActions as footerAction (footerAction)}
				<option class="truncate" title={footerAction} value={footerAction}>
					{footerAction}
				</option>
			{/each}
		</select>
		<button title="Remove all" on:click={() => ($readerFooterActions$ = [])}>
			<Icon path={mdiTrashCan}></Icon>
		</button>
		{#if $readerEnableAutoScroll$}
			<SettingsSelect
				label="Continuous scroll"
				helpText={readerScrollModeHelpText}
				targetStore$={readerScrollMode$}
				options={readerScrollModes}
			/>
			<SettingsSelect
				label="Scroll behavior"
				helpText="Determines the used scroll animation"
				targetStore$={settings$.readerScrollBehavior$}
				options={readerScrollBehaviors}
			/>
		{/if}
		{#if $readerMenuOpenMode$ !== ReaderMenuOpenMode.CLICK}
			<SettingsSelect
				label="Click Action"
				helpText="Determines the action executed when clicking on book text - requires matched book/line and subtitle/audio file"
				targetStore$={settings$.readerClickAction$}
				options={clickActions}
			/>
		{/if}
		<SettingsSelect
			label="Menu mode"
			helpText="Determines the action for opening the reader menu - requires matched book/line"
			targetStore$={readerMenuOpenMode$}
			options={readerMenuOpenModes}
		/>
		{#if $readerMenuOpenMode$ !== ReaderMenuOpenMode.DISABLED}
			<SettingsSelect
				label="Menu pause"
				helpText="Determines if playback is automatilcally paused when opening the reader menu or not"
				targetStore$={settings$.readerMenuPauseMode$}
				options={readerMenuPauseModes}
			/>
		{/if}
		{#if $readerMenuOpenMode$ === ReaderMenuOpenMode.HOLD}
			<SettingsNumberInput
				label="Menu open time"
				helpText="# of ms to hold down on book text to open the reader menu - requires matched book/line. If released earlier the configured click action is executed instead"
				targetStore$={settings$.readerMenuOpenTime$}
				min={100}
			/>
		{/if}
	</SettingsMenuContent>
	<SettingsMenuContent settingsMenu={SettingsMenu.SUBTITLES} bind:openSettingsMenu>
		<SettingsCheckbox
			label="Persist subtitles"
			helpText="If enabled loading subtitles or changes to them will be stored locally in your browser and can be used as data fallback/source. May takes more storage quota and increased update times"
			targetStore$={subtitlesEnablePersist$}
			on:change={onChangePersistSubtitles}
		/>
		<SettingsCheckbox
			label="Enable auto scroll"
			helpText="If enabled the subtitle list will automatically scroll to active subtitles"
			targetStore$={settings$.subtitlesEnableAutoScroll$}
		/>
		<SettingsCheckbox
			label="Copy font"
			helpText="If enabled the configured font of the reader is used for the subtitle list"
			targetStore$={subtitlesCopyFontFamily$}
		/>
		<SettingsCheckbox
			label="Copy font size"
			helpText="If enabled the configured font size of the reader is used for the subtitle list"
			targetStore$={subtitlesCopyFontSize$}
		/>
		<SettingsCheckbox
			label="Copy line height"
			helpText="If enabled the configured line height of the reader is used for the subtitle list"
			targetStore$={subtitlesCopyLineHeight$}
		/>
		{#if $subtitlesClickAction$ !== Action.NONE || $subtitlesActionsVisibility$ === SubtitleActionsVisibility.TOGGLE}
			<SettingsCheckbox
				label="Prevent action on selection"
				helpText="If enabled click/hold will not execute any action / open the subtitle action list in case any text is selected"
				targetStore$={settings$.subtitlePreventActionOnSelection$}
			/>
		{/if}
		<SettingsSelect
			label="Click Action"
			helpText="Determines the action executed when clicking on a subtitle"
			targetStore$={subtitlesClickAction$}
			options={clickActions}
		/>
		<SettingsSelect
			label="Actions visibility"
			helpText="Determines the conditions for showing actions in the subtitle list"
			targetStore$={subtitlesActionsVisibility$}
			options={subtitleActionVisbilityModes}
		/>
		{#if $subtitlesActionsVisibility$ === SubtitleActionsVisibility.TOGGLE}
			<SettingsNumberInput
				label="Visibility toggle time"
				helpText="# of ms to hold down to toggle the action list. If released earlier the configured click action is executed instead"
				targetStore$={settings$.subtitlesActionsVisibilityTime$}
				min={100}
			/>
		{/if}
		<SettingsNumberInput
			label="Global start padding"
			helpText="# of ms by which all subtitle start times are shifted"
			disabled={!!$exportCancelController$}
			targetStore$={subtitlesGlobalStartPadding$}
			blurHandler={onChangeGlobalPadding}
		/>
		<SettingsNumberInput
			label="Global end padding"
			helpText="# of ms by which all subtitle end times are shifted"
			disabled={!!$exportCancelController$}
			targetStore$={subtitlesGlobalEndPadding$}
			blurHandler={onChangeGlobalPadding}
		/>
		{#if !$subtitlesCopyFontFamily$}
			<SettingsTextInput
				label="Font"
				helpText="Font name to use for the subtitle list - needs to be installed on the device or via reader"
				targetStore$={settings$.subtitlesFontFamily$}
			/>
		{/if}
		{#if !$subtitlesCopyFontSize$}
			<SettingsNumberInput
				label="Font size"
				helpText="Font size to use for the subtitle list"
				targetStore$={settings$.subtitlesFontSize$}
				min={1}
				step={1}
			/>
		{/if}
		{#if !$subtitlesCopyLineHeight$}
			<SettingsNumberInput
				label="Line height"
				helpText="Line height to use for the subtitle list"
				targetStore$={settings$.subtitlesLineHeight$}
				min={1}
				step={0.05}
			/>
		{/if}
	</SettingsMenuContent>
	<SettingsMenuContent settingsMenu={SettingsMenu.PLAYER} bind:openSettingsMenu>
		{#if $playerAutoPauseMode$ !== AutoPauseMode.DISABLED}
			<SettingsCheckbox
				label="Dictionary detection"
				helpText="If enabled auto pause is skipped if open yomitan/jpdb-browser-reader was detected - yomitan requires disabled 'Secure Container' settings"
				targetStore$={settings$.playerEnableDictionaryDetection$}
			/>
		{/if}
		<SettingsCheckbox
			label="Enable cover"
			helpText="If enabled the audio file is searched through for a cover with a cost of slightly longer loading time"
			targetStore$={playerEnableCover$}
			on:change={onChangeEnableCover}
		/>
		<SettingsCheckbox
			label="Enable chapters"
			helpText="If enabled the audio file is searched through for chapter metadata with a cost of slightly longer loading time"
			targetStore$={playerEnableChapters$}
			on:change={onChangeEnableChapters}
		/>
		{#if wakeLockSupported}
			<SettingsCheckbox
				label="Enable WakeLock"
				helpText="If enabled the sites attempts to request a WakeLock during audio play that prevents device screens from dimming or locking"
				targetStore$={settings$.playerEnableWakeLock$}
			/>
		{/if}
		<SettingsSelect
			label="Auto pause"
			helpText={autoPauseHelpText}
			targetStore$={playerAutoPauseMode$}
			options={autoPauseModes}
		/>
		<SettingsNumberInput
			label="Rewind"
			helpText="# of seconds used for the regular rewind action"
			targetStore$={settings$.playerRewindTime$}
			min={1}
			step={1}
		/>
		<SettingsNumberInput
			label="Rewind #2"
			helpText="# of seconds used for the alternative rewind action"
			targetStore$={settings$.playerAltRewindTime$}
			min={1}
			step={1}
		/>
		<SettingsNumberInput
			label="Fast-Forward"
			helpText="# of seconds used for the regular fast-forward action"
			targetStore$={settings$.playerFastForwardTime$}
			min={1}
			step={1}
		/>
		<SettingsNumberInput
			label="Fast-Forward #2"
			helpText="# of seconds used for the alternative fast-forward action"
			targetStore$={settings$.playerAltFastForwardTime$}
			min={1}
			step={1}
		/>
	</SettingsMenuContent>
	<SettingsMenuContent settingsMenu={SettingsMenu.EXPORT} bind:openSettingsMenu>
		<SettingsSelect
			label="Field mode"
			helpText="Determines if the card data will be added before/after any current field value or if it will replace it"
			targetStore$={settings$.exportFieldMode$}
			options={exportFieldModes}
		/>
		<SettingsSelect
			label="Audio processor"
			helpText={audioProcessorHelpText}
			disabled={!!$exportCancelController$}
			targetStore$={exportAudioProcessor$}
			options={audioProcessors}
			on:change={onChangeAudioProcessor}
		/>
		<SettingsSelect
			label="Audio Format"
			helpText="Audio format used for exported audio"
			targetStore$={exportAudioFormat$}
			options={availableAudioFormats}
		/>
		<SettingsNumberInput
			label="Bitrate"
			helpText="Approximate Kbps bitrate target used for exported audio"
			disabled={!!$exportCancelController$}
			targetStore$={settings$.exportAudioBitrate$}
			min={64}
			step={10}
		/>
		{#if $exportAudioProcessor$ === AudioProcessor.FFMPEG}
			<SettingsCheckbox
				label="Enable FFMPEG log"
				helpText="If enabled ffmpeg logs will be printed out on console during export"
				targetStore$={settings$.enableFFMPEGLog$}
			/>
		{/if}
	</SettingsMenuContent>
	<SettingsMenuContent settingsMenu={SettingsMenu.ANKI} bind:openSettingsMenu>
		<SettingsCheckbox
			label="Add subtitle tag"
			helpText="If enabled the name of the current loaded subtitle file will be added to the card tag list"
			targetStore$={settings$.ankiAddSubtitleTag$}
		/>
		<SettingsCheckbox
			label="Add audio tag"
			helpText="If enabled the name of the current loaded audio file will be added to the card tag list"
			targetStore$={settings$.ankiAddAudioTag$}
		/>
		{#if $ankiDuplicateMode$ === AnkiDuplicateMode.DISABLED}
			<SettingsCheckbox
				label="Allow empty key field"
				helpText="If enabled the export will set an empty key field to a zero-width character in order to avoid export errors"
				targetStore$={settings$.ankiAllowEmptyKeyField$}
			/>
		{/if}
		<SettingsTextInput
			label="Card tags"
			helpText="Comma separated list of tags added to the card tag list"
			targetStore$={settings$.ankiTagList$}
		/>
		<SettingsSelect
			label="Check duplicates"
			helpText="Sets the respective options for Anki-Connect - works only on desktop and for creating new cards"
			targetStore$={ankiDuplicateMode$}
			options={ankiDuplicateModes}
		/>
		<SettingsTextInput
			label="Anki url"
			buttonTitle="Reload Anki data"
			targetStore$={ankiUrl$}
			buttonIcon={mdiRepeatVariant}
			on:click={() => onFetchAnkiData(true)}
		/>
		<SettingsTextInput
			helpText="Anki API key"
			label="Anki key"
			targetStore$={ankiKey$}
			on:blur={() => {
				setApiKey($ankiKey$);
			}}
		/>
		<label for="anki-settings-mode">Anki settings</label>
		<select id="anki-settings-mode" bind:value={ankiSettingsMode} on:change={() => onFetchAnkiData(false, true)}>
			{#each ankiSettingsModes as mode (mode)}
				<option value={mode}>
					{mode}
				</option>
			{/each}
		</select>
		<Popover>
			<div slot="icon">
				<Icon path={mdiHelpCircle} />
			</div>
			<div>
				Anki export settings for the respective operation. Leaving sentence and sound field empty for 'Update
				card' will automatically use all values from 'Create card' as fallback
			</div>
		</Popover>
		<SettingsSelect
			label="Anki deck"
			helpText="Target anki deck for exporting"
			targetStore$={showAnkiCreateSettings ? ankiDeck$ : ankiUpdateDeck$}
			options={ankiDecks}
		/>
		<SettingsSelect
			label="Anki model"
			helpText="Target anki model for exporting"
			targetStore$={showAnkiCreateSettings ? ankiModel$ : ankiUpdateModel$}
			options={ankiModels}
			on:change={() => onUpdateAnkiFields(showAnkiCreateSettings ? $ankiModel$ : $ankiUpdateModel$)}
		/>
		<SettingsSelect
			label="Sentence field"
			buttonTitle="Clear field"
			targetStore$={showAnkiCreateSettings ? ankiSentenceField$ : ankiUpdateSentenceField$}
			buttonIcon={mdiTrashCan}
			options={ankiFields}
			on:click={() => {
				if (showAnkiCreateSettings) {
					$ankiSentenceField$ = '';
				} else {
					$ankiUpdateSentenceField$ = '';
				}
			}}
		/>
		<SettingsSelect
			label="Sound field"
			buttonTitle="Clear field"
			targetStore$={showAnkiCreateSettings ? ankiSoundField$ : ankiUpdateSoundField$}
			buttonIcon={mdiTrashCan}
			options={ankiFields}
			on:click={() => {
				if (showAnkiCreateSettings) {
					$ankiUpdateSoundField$ = '';
				} else {
					$ankiUpdateSoundField$ = '';
				}
			}}
		/>
	</SettingsMenuContent>
	{#if !$isMobile$}
		<SettingsMenuContent settingsMenu={SettingsMenu.KEYBINDINGS} bind:openSettingsMenu>
			<SettingsCheckbox
				label="Enable time fallback"
				helpText="If enabled and no subtitle is currently active the current time is used as fallback to search for the closest subtitle"
				targetStore$={settings$.keybindingsEnableTimeFallback$}
			/>
			<SettingsKeybind key="Cmd + Space" description="Toggle playback" extendDescription={false} />
			<SettingsKeybind key="Cmd + d" description={Action.RESTART_PLAYBACK} />
			<SettingsKeybind key="Alt + d" description={Action.TOGGLE_PLAY_PAUSE} />
			<SettingsKeybind key="Cmd + l" description={Action.TOGGLE_PLAYBACK_LOOP} />
			<SettingsKeybind key="Cmd + b" description={Action.TOGGLE_BOOKMARK} />
			<SettingsKeybind key="Cmd + m" description={Action.TOGGLE_MERGE} />
			<SettingsKeybind key="Cmd + e" description={Action.EXPORT_NEW} />
			<SettingsKeybind key="Alt + e" description={Action.EXPORT_UPDATE} />
			<SettingsKeybind key="Alt + g" description={Action.EDIT_SUBTITLE} extendDescription={false} />
			<SettingsKeybind key="Cmd + q" description="Go to previous subtitle" extendDescription={false} />
			<SettingsKeybind key="Alt + q" description="Go to next subtitle" extendDescription={false} />
			<SettingsKeybind
				key="Cmd + Arrow Left"
				description={`Rewind ${$playerRewindTime$} seconds`}
				extendDescription={false}
			/>
			<SettingsKeybind
				key="Cmd + Arrow Down"
				description={`Rewind ${$playerAltRewindTime$} seconds`}
				extendDescription={false}
			/>
			<SettingsKeybind
				key="Cmd + Arrow Right"
				description={`Fast-Forward ${$playerFastForwardTime$} seconds`}
				extendDescription={false}
			/>
			<SettingsKeybind
				key="Cmd + Arrow Up"
				description={`Fast-Forward ${$playerAltFastForwardTime$} seconds`}
				extendDescription={false}
			/>
		</SettingsMenuContent>
	{/if}
</div>
