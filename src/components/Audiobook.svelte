<script lang="ts">
	import ActionButton from './ActionButton.svelte';
	import Dropzone from './Dropzone.svelte';
	import Icon from './Icon.svelte';
	import { Action, executeAction, persistSubtitles } from '../lib/actions';
	import type { FileEntry, FileResult } from '../lib/dropzone';
	import {
		getFileHandle,
		setAudioContext,
		setSubtitleContext,
		updateAudio,
		updateSubtitles,
		verifyPermissions,
	} from '../lib/files';
	import { Tabs, type Context, type Subtitle, getDummySubtitle } from '../lib/general';
	import {
		activeSubtitle$,
		bookData$,
		bookMatched$,
		bookmarkedSubtitles$,
		booksDB$,
		canExportToAnki$,
		currentAudioFile$,
		currentAudioLoaded$,
		currentAudioSourceUrl$,
		currentCoverUrl$,
		currentSubtitleFile$,
		currentSubtitles$,
		currentTab$,
		currentTime$,
		duration$,
		exportCancelController$,
		exportProgress$,
		extensionData$,
		filesystemApiEnabled$,
		hideFooterActions$,
		isLoading$,
		isMobile$,
		isRecording$,
		lastError$,
		openLastExportedCardTitle$,
		paused$,
		settings$,
		showBookmarkedSubtitlesOnly$,
		showSubtitlesForMergeOnly$,
		skipKeyListener$,
		subtitlesForMerge$,
		toggleShowBookmarkedSubtitlesTitle$,
		toggleShowSubtitlesForMergeTitle$,
	} from '../lib/stores';
	import {
		allIgnoredElements,
		between,
		downloadFile,
		getDateString,
		getLineCSSSelector,
		getTimeParts,
		parseHTML,
		toTimeString,
	} from '../lib/util';
	import {
		mdiBookMusic,
		mdiCancel,
		mdiCheck,
		mdiDatabasePlus,
		mdiDatabaseRemove,
		mdiDatabaseSync,
		mdiDebugStepOver,
		mdiDeleteClock,
		mdiDeleteSweep,
		mdiEqual,
		mdiEyeOffOutline,
		mdiEyeOutline,
		mdiFileArrowLeftRightOutline,
		mdiFilePlusOutline,
		mdiFloppy,
		mdiInformation,
		mdiOpenInApp,
		mdiPlayPause,
		mdiRefresh,
		mdiRestore,
		mdiSelect,
		mdiSelectRemove,
		mdiStar,
		mdiStarOutline,
		mdiText,
		mdiTextBox,
		mdiTrashCan,
		mdiTrashCanOutline,
	} from '@mdi/js';
	import Player from './Player.svelte';
	import Popover from './Popover.svelte';
	import Progress from './Progress.svelte';
	import Subtitles from './Subtitles.svelte';
	import { getContext, tick } from 'svelte';
	import TimeEditInput from './TimeEditInput.svelte';

	export let showMenu: boolean;

	export function resetSubtitleContainerHeight() {
		subtitleListElement?.onResetList();
	}

	export function scrollToSubtitle() {
		playerElement?.onScrollToSubtitle();
	}

	const { subtitlesEnablePersist$, ankiSentenceField$, ankiSoundField$ } = settings$;
	const { sandboxElement, isIOS } = getContext<Context>('context');
	const allowedSubtitleExtensions: FileExtension[] = ['.srt', '.vtt', '.txt'];
	const allowedAudioExtensions: FileExtension[] = ['.m4a', '.m4b', '.mp3'];

	let subtitleInput: HTMLInputElement;
	let audioFileInput: HTMLInputElement;
	let subtitleFilePopover: Popover;
	let audioFilePopover: Popover;
	let currentTimePopover: Popover;
	let subtitleListElement: Subtitles;
	let playerElement: Player;
	let addedSubtitleByDropzone = false;
	let addedAudioByDropzone = false;
	let changeSubtitleTitle = '';
	let resetBookTitle = '';
	let changeAudioTitle = '';
	let resetPlaybackPositionTitle = '';
	let alignSubtitlesTitle = '';
	let restoreSubtitlesTitle = '';
	let playPauseActionTitle = '';
	let loopSubtitleActionTitle = '';
	let exportNewTitle = '';
	let exportUpdateTitle = '';
	let canExportNew = false;
	let canExportUpdate = false;
	let currentHours = 0;
	let currentMinutes = 0;
	let currentSeconds = 0;
	let currentActiveSubtitle = '';
	let imageLoaded: () => void;
	let subtitles: Subtitle[] = [];

	$: updateSubtitleList($currentSubtitles$, $showBookmarkedSubtitlesOnly$, $showSubtitlesForMergeOnly$);

	$: hasListItems = subtitles.length > 0;

	$: audioActionAvailable = $currentAudioLoaded$ && hasListItems && !$isRecording$;

	$: durationHours = $duration$ ? Math.floor($duration$ / 3600) : 999;

	$: toggleHideFooterActionsTitle = $hideFooterActions$ ? 'Show footer actions' : 'Hide footer actions';

	$: if ($exportCancelController$) {
		changeSubtitleTitle = 'Export in progress';
		resetBookTitle = 'Export in progress';
		changeAudioTitle = 'Export in progress';
	} else {
		changeSubtitleTitle = `${$currentSubtitleFile$ ? 'Change' : 'Set'} subtitle file`;
		resetBookTitle = $bookData$.htmlBackup ? 'Reset book & reload page' : 'No data to reset';
		changeAudioTitle = `${$currentAudioFile$ ? 'Change' : 'Set'} audio file`;
	}

	$: if (!Number.isFinite($extensionData$.playbackPosition) || $extensionData$.playbackPosition === 0) {
		resetPlaybackPositionTitle = 'No data to reset';
	} else if (!!$exportCancelController$) {
		resetPlaybackPositionTitle = 'Export in progress';
	} else {
		resetPlaybackPositionTitle = 'Reset playback position';
	}

	$: if (!$currentSubtitles$.size) {
		alignSubtitlesTitle = 'Subtitle file required';
	} else if ($isRecording$) {
		alignSubtitlesTitle = 'Recording in progress';
	} else if (!hasListItems) {
		alignSubtitlesTitle = 'No subtitle matches current filter';
	} else if (!$bookMatched$.matchedBy) {
		alignSubtitlesTitle = 'Matched book required';
	} else {
		alignSubtitlesTitle = `Align${$showBookmarkedSubtitlesOnly$ || $showSubtitlesForMergeOnly$ ? ' selected' : ' all'} subtitles with book text`;
	}

	$: if (!$currentSubtitles$.size) {
		restoreSubtitlesTitle = 'Subtitle file required';
	} else if ($isRecording$) {
		restoreSubtitlesTitle = 'Recording in progress';
	} else if (!hasListItems) {
		restoreSubtitlesTitle = 'No subtitle matches current filter';
	} else {
		restoreSubtitlesTitle = `Restore original time and text for${$showBookmarkedSubtitlesOnly$ || $showSubtitlesForMergeOnly$ ? ' selected' : ' all'} subtitles`;
	}

	$: if (!$currentSubtitles$.size) {
		$toggleShowBookmarkedSubtitlesTitle$ = 'Subtitle file required';
		$toggleShowSubtitlesForMergeTitle$ = 'Subtitle file required';
	} else {
		$toggleShowBookmarkedSubtitlesTitle$ = Action.TOGGLE_SHOW_BOOKMARKED;
		$toggleShowSubtitlesForMergeTitle$ = Action.TOGGLE_SHOW_FOR_MERGE;
	}

	$: if (!$currentSubtitles$.size) {
		playPauseActionTitle = 'Subtitle file required';
		loopSubtitleActionTitle = 'Subtitle file required';
	} else if (!$currentAudioLoaded$) {
		playPauseActionTitle = 'Audio file required';
		loopSubtitleActionTitle = 'Audio file required';
	} else if ($isRecording$) {
		playPauseActionTitle = 'Recording in progress';
		loopSubtitleActionTitle = 'Recording in progress';
	} else if (!hasListItems) {
		playPauseActionTitle = 'No subtitle matches current filter';
		loopSubtitleActionTitle = 'No subtitle matches current filter';
	} else if (!$showBookmarkedSubtitlesOnly$ && !$showSubtitlesForMergeOnly$) {
		playPauseActionTitle = 'Bookmark or merge filter required';
		loopSubtitleActionTitle = 'Bookmark or merge filter required';
	} else {
		playPauseActionTitle = 'Toggle play and pause for selected subtitles';
		loopSubtitleActionTitle = 'Toggle playback loop for selected subtitles';
	}

	$: if (!$canExportToAnki$) {
		exportNewTitle = 'Anki configuration required';
		exportUpdateTitle = 'Anki configuration required';
		canExportNew = false;
		canExportUpdate = false;
	} else if ($exportCancelController$) {
		exportNewTitle = 'Export in progress';
		exportUpdateTitle = 'Export in progress';
		canExportNew = false;
		canExportUpdate = false;
	} else if (!$currentSubtitles$.size) {
		exportNewTitle = 'Subtitle file required';
		exportUpdateTitle = 'Subtitle file required';
		canExportNew = false;
		canExportUpdate = false;
	} else if ($ankiSoundField$ && !$currentAudioLoaded$ && !$ankiSentenceField$) {
		exportNewTitle = 'Audio file required';
		exportUpdateTitle = 'Audio file required';
		canExportNew = false;
		canExportUpdate = false;
	} else if (!hasListItems) {
		exportNewTitle = 'No subtitle matches current filter';
		exportUpdateTitle = 'No subtitle matches current filter';
		canExportNew = false;
		canExportUpdate = false;
	} else {
		if ($showSubtitlesForMergeOnly$) {
			exportNewTitle = 'Merge selected subtitles and create new Card for selected subtitles';
			canExportNew = true;
		} else if ($showBookmarkedSubtitlesOnly$) {
			exportNewTitle = 'Create new cards for selected subtitles';
			canExportNew = true;
		} else {
			exportNewTitle = 'Bookmark or merge filter required';
			canExportNew = false;
		}

		if ($showSubtitlesForMergeOnly$) {
			exportUpdateTitle = 'Merge selected subtitles and update last card';
			canExportUpdate = true;
		} else {
			exportUpdateTitle = 'Merge filter required';
			canExportUpdate = false;
		}
	}

	$: if ($showBookmarkedSubtitlesOnly$) {
		updateSubtitleList($bookmarkedSubtitles$);
	}

	$: if ($showSubtitlesForMergeOnly$) {
		updateSubtitleList($subtitlesForMerge$);
	}

	$: if ($currentSubtitleFile$) {
		$showBookmarkedSubtitlesOnly$ = false;
		$showSubtitlesForMergeOnly$ = false;
	}

	$: if (!$currentAudioSourceUrl$) {
		onAudioLoad();
	}

	function onFilesStart() {
		$paused$ = true;
		$isLoading$ = true;
		$skipKeyListener$ = true;
		$lastError$ = '';

		subtitleFilePopover.hide();
		audioFilePopover.hide();
	}

	async function onHandleFiles({ detail: { files, errors } }: CustomEvent<FileResult>) {
		const subtitles: FileEntry[] = [];
		const audioFiles: FileEntry[] = [];

		let subtitle: FileEntry;
		let audio: FileEntry;

		onFilesStart();

		for (let index = 0, { length } = files; index < length; index += 1) {
			const fileEntry = files[index];

			if (fileEntry.extension === '.srt' || fileEntry.extension === '.vtt' || fileEntry.extension === '.txt') {
				subtitles.push(fileEntry);
			} else {
				audioFiles.push(fileEntry);
			}
		}

		let tooManyFiles = subtitles.length > 1 || audioFiles.length > 1;

		if (subtitles.length > 1) {
			errors.push(`Only 1 subtitle file is allowed`);
		}

		if (audioFiles.length > 1) {
			errors.push(`Only 1 audio file is allowed`);
		}

		try {
			if (tooManyFiles || (!subtitles.length && !audioFiles.length)) {
				throw new Error('Stop process');
			}

			[subtitle] = subtitles;
			[audio] = audioFiles;

			const hasAccesses = await verifyPermissions([subtitle?.handle, audio?.handle]).catch(({ message }) => {
				errors.push(`Access check failed: ${message}`);

				return false;
			});

			if (!hasAccesses) {
				throw new Error('Stop process');
			}
		} catch (error) {
			$lastError$ = errors.join('; ');
			$isLoading$ = false;
			$skipKeyListener$ = false;

			return;
		}

		if (subtitle) {
			try {
				const newSubtitles = await updateSubtitles(subtitle.file, document);

				if (subtitle.handle) {
					await storeFileHandle(subtitle.handle, 'lastSubtitle');
				}

				if ($subtitlesEnablePersist$) {
					await persistSubtitles({ name: subtitle.file.name, subtitles: [...newSubtitles.values()] }).catch(
						({ message }) => errors.push(message),
					);
				}

				setSubtitleContext(subtitle.file, newSubtitles);

				addedSubtitleByDropzone = true;
			} catch ({ message }: any) {
				errors.push(`Failed to process subtitle: ${message}`);
			}

			if (!audio) {
				$isLoading$ = false;
			}
		}

		if (audio) {
			try {
				const audioResult = await updateAudio(audio.file, sandboxElement);

				if (audio.handle) {
					await storeFileHandle(audio.handle, 'lastAudio');
				}

				await setAudioContext($currentCoverUrl$, $currentAudioSourceUrl$, audio.file, audioResult);

				addedAudioByDropzone = true;
			} catch ({ message }: any) {
				errors.push(`Failed to process audio: ${message}`);

				$isLoading$ = false;
			}
		}

		$lastError$ = errors.join('; ');
		$skipKeyListener$ = false;
	}

	async function onExportToText() {
		$isLoading$ = true;
		$lastError$ = '';

		try {
			await new Promise<void>((resolve) => setTimeout(resolve, 100));

			const bookHTML = parseHTML(new DOMParser(), $bookData$.htmlBackup || $bookData$.elementHtml);

			let bookText = '';

			const walker = document.createTreeWalker(bookHTML, NodeFilter.SHOW_TEXT, {
				acceptNode(node) {
					const parentTag = (node.parentElement?.tagName || '').toLowerCase();
					const textContent = (node.textContent || '').replace(/\s/g, '').trim();

					if (!allIgnoredElements.has(parentTag) && textContent) {
						bookText += `${node.textContent}\n`;
					}

					return NodeFilter.FILTER_ACCEPT;
				},
			});

			while (walker.nextNode()) {}

			if (bookText) {
				downloadFile(
					document,
					new Blob([bookText], { type: 'text/plain;charset=utf-8' }),
					`${$bookData$.title}.txt`,
					isIOS,
				);
			}
		} catch ({ message }: any) {
			$lastError$ = `Failed to export text: ${message}`;
		}

		$isLoading$ = false;
	}

	async function onSaveSubtitles() {
		$isLoading$ = true;

		await new Promise<void>((resolve) => setTimeout(resolve, 100));

		const subtitles = [...$currentSubtitles$.values()];

		let subtitleContent = '';

		for (let index = 0, { length } = subtitles; index < length; index += 1) {
			const subtitle = subtitles[index];

			subtitleContent += `${subtitle.id}\n${subtitle.startTime} --> ${subtitle.endTime}\n${subtitle.text}\n\n`;
		}

		if (subtitleContent) {
			downloadFile(
				document,
				new Blob([subtitleContent], { type: `${isIOS ? 'text/plain' : 'application/x-subrip'};charset=utf-8` }),
				`${$currentSubtitleFile$!.name.split(/\.(?=[^\.]+$)/)[0]}.srt`,
				isIOS,
			);
		}

		$isLoading$ = false;
	}

	async function onSetSubtitleFile() {
		subtitleFilePopover.hide();

		if ($filesystemApiEnabled$) {
			$skipKeyListener$ = true;
			$isLoading$ = true;
			$lastError$ = '';

			try {
				const { handle, file } = await getFileHandle(
					window,
					'Subtitle',
					allowedSubtitleExtensions,
					$extensionData$.lastSubtitle,
				);

				if (file) {
					const newSubtitles = await updateSubtitles(file, document);

					await storeFileHandle(handle, 'lastSubtitle');

					if ($subtitlesEnablePersist$) {
						await persistSubtitles({
							name: handle.name,
							subtitles: [...newSubtitles.values()],
						});
					}

					setSubtitleContext(file, newSubtitles);

					addedSubtitleByDropzone = false;
				}
			} catch (error: any) {
				if (error.name !== 'AbortError') {
					$lastError$ = `Failed to process subtitle: ${error.message}`;
				}
			}

			$isLoading$ = false;
			$skipKeyListener$ = false;
		} else {
			subtitleInput.click();
		}
	}

	async function onSetAudioFile() {
		audioFilePopover.hide();

		if ($filesystemApiEnabled$) {
			$skipKeyListener$ = true;
			$isLoading$ = true;
			$lastError$ = '';

			try {
				const { handle, file } = await getFileHandle(
					window,
					'Audio',
					allowedAudioExtensions,
					$extensionData$.lastAudio,
				);

				if (file) {
					const audioResult = await updateAudio(file, sandboxElement);

					await storeFileHandle(handle, 'lastAudio');
					await setAudioContext($currentCoverUrl$, $currentAudioSourceUrl$, file, audioResult);

					addedAudioByDropzone = false;
				} else {
					$isLoading$ = false;
				}
			} catch (error: any) {
				if (error.name !== 'AbortError') {
					$lastError$ = `Failed to process audio: ${error.message}`;
				}

				$isLoading$ = false;
			}

			$skipKeyListener$ = false;
		} else {
			audioFileInput.click();
		}
	}

	async function onFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const isSubtitle = target.accept.includes('.srt');
		const [file] = target.files || [];

		if (!file) {
			return;
		}

		$skipKeyListener$ = true;
		$isLoading$ = true;
		$lastError$ = '';

		try {
			if (isSubtitle) {
				const newSubtitles = await updateSubtitles(file, document, true);

				if ($subtitlesEnablePersist$) {
					await persistSubtitles({ name: file.name, subtitles: [...newSubtitles.values()] });
				}

				$isLoading$ = false;
				addedSubtitleByDropzone = false;
			} else {
				await updateAudio(file, sandboxElement, true, false, $currentCoverUrl$, $currentAudioSourceUrl$);

				addedAudioByDropzone = false;
			}
		} catch ({ message }: any) {
			$lastError$ = `Failed to process ${isSubtitle ? 'subtitle' : 'audio'}: ${message}`;

			$isLoading$ = false;
		}

		$skipKeyListener$ = false;
	}

	async function onDropFile(key: 'lastSubtitle' | 'lastAudio') {
		if (key === 'lastSubtitle') {
			subtitleFilePopover.hide();
		} else {
			audioFilePopover.hide();
		}

		$skipKeyListener$ = true;
		$isLoading$ = true;
		$lastError$ = '';
		$paused$ = true;

		if ($filesystemApiEnabled$) {
			try {
				if (key === 'lastSubtitle') {
					await $booksDB$.delete('handle', [$extensionData$.title, 'subtitle']);

					if (!$extensionData$.subtitleData || !$extensionData$.subtitleData.subtitles.length) {
						setSubtitleContext();
					}

					addedSubtitleByDropzone = false;
				} else if (key === 'lastAudio') {
					await $booksDB$.delete('handle', [$extensionData$.title, 'audioBook']);
					await setAudioContext($currentCoverUrl$, $currentAudioSourceUrl$);

					addedAudioByDropzone = false;
				}

				delete $extensionData$[key];
			} catch ({ message }: any) {
				$lastError$ = `Failed to drop file: ${message}`;
			}
		} else if (key === 'lastSubtitle') {
			if (!$extensionData$.subtitleData || !$extensionData$.subtitleData.subtitles.length) {
				setSubtitleContext();
			}

			subtitleInput.value = '';
			addedSubtitleByDropzone = false;
		} else if (key === 'lastAudio') {
			await setAudioContext($currentCoverUrl$, $currentAudioSourceUrl$);

			audioFileInput.value = '';
			addedAudioByDropzone = false;
		}

		$isLoading$ = false;
		$skipKeyListener$ = false;
		$extensionData$ = $extensionData$;
	}

	async function onDropPersistedSubtitles() {
		subtitleFilePopover.hide();

		$isLoading$ = true;
		$skipKeyListener$ = true;
		$lastError$ = '';

		try {
			const subtitleData = { name: $extensionData$.subtitleData!.name, subtitles: [] };

			await $booksDB$.put('subtitle', {
				subtitleData,
				title: $extensionData$.title,
				lastSubtitleDataModified: Date.now(),
			});

			if (!$extensionData$.lastSubtitle && !subtitleInput.value && !addedSubtitleByDropzone) {
				$paused$ = true;

				setSubtitleContext();
			}

			$extensionData$.subtitleData = subtitleData;

			document.dispatchEvent(new CustomEvent('ttu-action', { detail: { type: 'sync', syncType: 'subtitle' } }));
		} catch ({ message }: any) {
			$lastError$ = `Failed to drop persisted subtitles: ${message}`;
		}

		$isLoading$ = false;
		$skipKeyListener$ = false;
		$extensionData$ = $extensionData$;
	}

	async function onResetBook() {
		$skipKeyListener$ = true;
		$isLoading$ = true;
		$paused$ = true;

		const { elementHtml, htmlBackup, lastBookModified } = $bookData$;

		try {
			$bookData$.elementHtml = htmlBackup!;
			$bookData$.lastBookModified = Date.now();

			delete $bookData$.htmlBackup;

			await $booksDB$.put('data', $bookData$);

			window.location.reload();
		} catch ({ message }: any) {
			$lastError$ = `Failed to reset book: ${message}`;

			$bookData$ = { ...$bookData$, elementHtml, htmlBackup, lastBookModified };
		}

		$isLoading$ = false;
		$skipKeyListener$ = false;
	}

	async function onResetPlaybackPosition() {
		$skipKeyListener$ = true;
		$isLoading$ = true;
		$paused$ = true;

		try {
			await $booksDB$.put('audioBook', {
				title: $extensionData$.title,
				playbackPosition: 0,
				lastAudioBookModified: Date.now(),
			});

			$currentTime$ = 0;
			$extensionData$.playbackPosition = 0;
			$activeSubtitle$ = { previous: '', current: '', useTimeFallback: true };
		} catch ({ message }: any) {
			$lastError$ = `Failed to reset playback position: ${message}`;
		}

		$isLoading$ = false;
		$skipKeyListener$ = false;
		$extensionData$ = $extensionData$;
	}

	async function onResetAll() {
		$skipKeyListener$ = true;
		$isLoading$ = true;
		$paused$ = true;

		const tx = $booksDB$.transaction(['data', 'audioBook', 'subtitle', 'handle'], 'readwrite');
		const { elementHtml, htmlBackup, lastBookModified } = $bookData$;
		const lastModified = Date.now();
		const oldSubtitleData = $extensionData$.subtitleData;
		const oldPlaybackPosition = $extensionData$.playbackPosition;

		try {
			if (htmlBackup) {
				$bookData$.elementHtml = htmlBackup;
				$bookData$.lastBookModified = lastModified;

				delete $bookData$.htmlBackup;

				await tx.objectStore('data').put($bookData$);
			}

			if (oldSubtitleData) {
				const subtitleData = { name: oldSubtitleData.name, subtitles: [] };

				await tx.objectStore('subtitle').put({
					subtitleData,
					title: $bookData$.title,
					lastSubtitleDataModified: lastModified,
				});

				$extensionData$.subtitleData = subtitleData;
			}

			await tx
				.objectStore('audioBook')
				.put({ title: $bookData$.title, playbackPosition: 0, lastAudioBookModified: lastModified });
			await tx.objectStore('handle').delete(IDBKeyRange.bound([$bookData$.title], [$bookData$.title, []]));
			await tx.done;

			$extensionData$.playbackPosition = 0;

			window.location.reload();
		} catch ({ message }: any) {
			try {
				tx.abort();

				await tx.done;
			} catch (_) {
				// no-op
			}

			$lastError$ = `Failed to reset Data: ${message}`;

			$bookData$ = { ...$bookData$, elementHtml, htmlBackup, lastBookModified };
			$extensionData$ = {
				...$extensionData$,
				playbackPosition: oldPlaybackPosition,
				subtitleData: oldSubtitleData,
			};
		}

		$isLoading$ = false;
		$skipKeyListener$ = false;
	}

	async function onJumpToTime() {
		currentTimePopover.hide();

		const newSeconds = (currentHours || 0) * 3600 + (currentMinutes || 0) * 60 + (currentSeconds || 0);

		await executeAction(
			Action.RESTART_PLAYBACK,
			getDummySubtitle($currentAudioLoaded$ ? between(0, $duration$, newSeconds) : Math.max(0, newSeconds)),
			{ keepPauseState: true },
		);

		updateScrollAfterJump(newSeconds);
	}

	async function onJumpToId() {
		currentTimePopover.hide();

		const targetSubtitle = $currentSubtitles$.get(currentActiveSubtitle);

		if (!targetSubtitle) {
			return;
		}

		await executeAction(Action.RESTART_PLAYBACK, getDummySubtitle(targetSubtitle.startSeconds), {
			keepPauseState: true,
		});

		updateScrollAfterJump(targetSubtitle.startSeconds);
	}

	async function storeFileHandle(handle: FileSystemFileHandle, key: 'lastSubtitle' | 'lastAudio') {
		try {
			await $booksDB$.put('handle', {
				handle,
				title: $extensionData$.title,
				lastHandleModified: Date.now(),
				dataType: key === 'lastSubtitle' ? 'subtitle' : 'audioBook',
			});

			$extensionData$[key] = handle;
		} catch ({ message }: any) {
			throw new Error(`Failed to update extension data - ${message}`);
		} finally {
			$extensionData$ = $extensionData$;
		}
	}

	async function updateSubtitleList(..._: any[]) {
		subtitles = [...$currentSubtitles$.values()].filter(
			(subtitle) =>
				(!$showBookmarkedSubtitlesOnly$ || $bookmarkedSubtitles$.has(subtitle.id)) &&
				(!$showSubtitlesForMergeOnly$ || $subtitlesForMerge$.has(subtitle.id)),
		);

		await tick();

		hasListItems = subtitles.length > 0;
	}

	function onAudioLoad(..._args: any) {
		$currentAudioLoaded$ = false;

		new Promise<void>((resolver) => (imageLoaded = resolver));

		const elements = document.querySelectorAll(`${getLineCSSSelector()}.active`);

		for (let index = 0, { length } = elements; index < length; index += 1) {
			elements[index].classList.remove('active');
		}
	}

	function updateScrollAfterJump(newSeconds: number) {
		if ($currentAudioLoaded$) {
			return;
		}

		$currentTime$ = newSeconds;

		subtitleListElement?.scrollToSubtitle(true);
	}
</script>

<div class="flex m-y-s">
	<button title={changeAudioTitle} disabled={!!$exportCancelController$} on:click={onSetAudioFile}>
		{#if $currentCoverUrl$}
			<img id="ttu-whispersync-cover" class="cover" src={$currentCoverUrl$} alt="cover" on:load={imageLoaded} />
		{:else}
			<div class="cover">
				<svg
					width="100%"
					height="100%"
					viewBox="0 0 512 512"
					aria-hidden="true"
					role="img"
					xmlns="http://www.w3.org/2000/svg"
					on:load={imageLoaded}
				>
					<g transform="translate(256 256)" transform-origin="128 0">
						<g transform="translate(0,0) scale(1,1)">
							<path
								d="M448 80c8.8 0 16 7.2 16 16V415.8l-5-6.5-136-176c-4.5-5.9-11.6-9.3-19-9.3s-14.4 3.4-19 9.3L202 340.7l-30.5-42.7C167 291.7 159.8 288 152 288s-15 3.7-19.5 10.1l-80 112L48 416.3l0-.3V96c0-8.8 7.2-16 16-16H448zM64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm80 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z"
								fill="currentColor"
								transform="translate(-256 -256)"
							></path>
						</g>
					</g>
				</svg>
			</div>
		{/if}
	</button>
	<div class="flex flex-1 flex-col">
		<div class="flex justify-between w-full header-icons">
			<button title="Export book to text file" on:click={onExportToText}>
				<Icon path={mdiTextBox} />
			</button>
			<button
				title={!$currentSubtitles$.size ? 'Subtitle file required' : 'Save subtitles to file'}
				disabled={!$currentSubtitles$.size}
				on:click={onSaveSubtitles}
			>
				<Icon path={mdiFloppy} />
			</button>
			<Popover placement="bottom" bind:this={subtitleFilePopover}>
				<div slot="icon" title="Show subtitle file">
					<Icon path={mdiText} />
				</div>
				<div>{$currentSubtitleFile$?.name || 'None selected'}</div>
				<button title={changeSubtitleTitle} disabled={!!$exportCancelController$} on:click={onSetSubtitleFile}>
					<Icon path={$currentSubtitleFile$ ? mdiFileArrowLeftRightOutline : mdiFilePlusOutline} />
				</button>
				{#if $extensionData$.lastSubtitle || subtitleInput?.value || addedSubtitleByDropzone}
					<button
						class="m-l-s"
						title={$exportCancelController$ ? 'Export in progress' : 'Drop subtitle file'}
						disabled={!!$exportCancelController$}
						on:click={() => onDropFile('lastSubtitle')}
					>
						<Icon path={mdiTrashCanOutline} />
					</button>
				{/if}
				{#if $extensionData$.subtitleData && $extensionData$.subtitleData.subtitles.length}
					<button
						class="m-l-s"
						title={$exportCancelController$ ? 'Export in progress' : 'Drop persisted subtitles'}
						disabled={!!$exportCancelController$}
						on:click={onDropPersistedSubtitles}
					>
						<Icon path={mdiDatabaseRemove} />
					</button>
				{/if}
			</Popover>
			<Popover placement="bottom">
				<div slot="icon" title="Show matched subtitle file">
					<Icon path={mdiInformation} />
				</div>
				{#if $bookMatched$.matchedBy}
					<div>Matched by</div>
					<div>{$bookMatched$.matchedBy}</div>
					{#if $bookMatched$.matchedOn}
						<div class="m-t-xs">On: {getDateString(new Date($bookMatched$.matchedOn))}</div>
					{/if}
				{:else}
					<div>Book not matched yet</div>
				{/if}
			</Popover>
			<button
				title={resetBookTitle}
				disabled={!!$exportCancelController$ || !$bookData$.htmlBackup}
				on:click={onResetBook}
			>
				<Icon path={mdiDeleteSweep} />
			</button>
			<Popover placement="bottom" bind:this={audioFilePopover}>
				<div slot="icon" title="Show audio file">
					<Icon path={mdiBookMusic} />
				</div>
				<div>{$currentAudioFile$?.name || 'None selected'}</div>
				<button title={changeAudioTitle} disabled={!!$exportCancelController$} on:click={onSetAudioFile}>
					<Icon path={$currentAudioFile$ ? mdiFileArrowLeftRightOutline : mdiFilePlusOutline} />
				</button>
				{#if $extensionData$.lastAudio || audioFileInput?.value || addedAudioByDropzone}
					<button
						class="m-l-s"
						title={$exportCancelController$ ? 'Export in progress' : 'Drop audio file'}
						disabled={!!$exportCancelController$}
						on:click={() => onDropFile('lastAudio')}
					>
						<Icon path={mdiTrashCanOutline} />
					</button>
				{/if}
			</Popover>
			<button
				title={$exportCancelController$ ? 'Export in progress' : 'Reset all & reload page'}
				disabled={!!$exportCancelController$}
				on:click={onResetAll}
			>
				<Icon path={mdiTrashCan} />
			</button>
		</div>
		<div class="flex justify-between w-full m-t-s header-icons">
			<button
				title={resetPlaybackPositionTitle}
				disabled={resetPlaybackPositionTitle !== 'Reset playback position'}
				on:click={onResetPlaybackPosition}
			>
				<Icon path={mdiDeleteClock} />
			</button>
			<button
				title={alignSubtitlesTitle}
				disabled={$isRecording$ || !hasListItems || !$bookMatched$.matchedBy}
				on:click={async () => {
					$isLoading$ = true;

					await executeAction(Action.ALIGN_SUBTITLE, subtitles);

					$isLoading$ = false;
				}}
			>
				<Icon path={mdiEqual} />
			</button>
			<button
				title={restoreSubtitlesTitle}
				disabled={$isRecording$ || !hasListItems}
				on:click={async () => {
					$isLoading$ = true;

					await executeAction(Action.RESTORE_SUBTITLE, subtitles);

					$isLoading$ = false;
				}}
			>
				<Icon path={mdiRestore} />
			</button>
			<button
				title={$toggleShowBookmarkedSubtitlesTitle$}
				disabled={!$currentSubtitles$.size}
				on:click={() => ($showBookmarkedSubtitlesOnly$ = !$showBookmarkedSubtitlesOnly$)}
			>
				<Icon path={$showBookmarkedSubtitlesOnly$ ? mdiStar : mdiStarOutline} />
			</button>
			<button
				title={$toggleShowSubtitlesForMergeTitle$}
				disabled={!$currentSubtitles$.size}
				on:click={() => ($showSubtitlesForMergeOnly$ = !$showSubtitlesForMergeOnly$)}
			>
				<Icon path={$showSubtitlesForMergeOnly$ ? mdiSelectRemove : mdiSelect} />
			</button>
			<button
				title={playPauseActionTitle}
				disabled={!audioActionAvailable || (!$showBookmarkedSubtitlesOnly$ && !$showSubtitlesForMergeOnly$)}
				on:click={() => executeAction(Action.TOGGLE_PLAY_PAUSE, subtitles, { skipUpdates: true })}
			>
				<Icon path={mdiPlayPause} />
			</button>
			<button
				title={loopSubtitleActionTitle}
				disabled={!audioActionAvailable || (!$showBookmarkedSubtitlesOnly$ && !$showSubtitlesForMergeOnly$)}
				on:click={() => executeAction(Action.TOGGLE_PLAYBACK_LOOP, subtitles, { skipUpdates: true })}
			>
				<Icon path={mdiRefresh} />
			</button>
		</div>
		<div class="flex justify-between w-full m-t-s header-icons">
			<button title={toggleHideFooterActionsTitle} on:click={() => ($hideFooterActions$ = !$hideFooterActions$)}>
				<Icon path={$hideFooterActions$ ? mdiEyeOutline : mdiEyeOffOutline} />
			</button>
			<button
				title={exportNewTitle}
				disabled={!canExportNew}
				on:click={() =>
					executeAction(Action.EXPORT_NEW, subtitles, {
						mergeSubtitles: $showSubtitlesForMergeOnly$,
					}).finally(() => {
						if ($showSubtitlesForMergeOnly$) {
							updateSubtitleList(
								$currentSubtitles$,
								$showBookmarkedSubtitlesOnly$,
								$showSubtitlesForMergeOnly$,
							);
						}
					})}
			>
				<Icon path={mdiDatabasePlus} />
			</button>
			<button
				title={exportUpdateTitle}
				disabled={!canExportUpdate}
				on:click={() =>
					executeAction(Action.EXPORT_UPDATE, subtitles, {
						mergeSubtitles: true,
					}).finally(() => {
						if ($showSubtitlesForMergeOnly$) {
							updateSubtitleList(
								$currentSubtitles$,
								$showBookmarkedSubtitlesOnly$,
								$showSubtitlesForMergeOnly$,
							);
						}
					})}
			>
				<Icon path={mdiDatabaseSync} />
			</button>
			<ActionButton
				title={$openLastExportedCardTitle$}
				action={Action.OPEN_LAST_EXPORTED_CARD}
				subtitle={getDummySubtitle(0)}
				path={mdiOpenInApp}
				buttonClasses=""
			/>
			<button class="invisible">
				<Icon path={mdiFloppy} />
			</button>
			<button class="invisible">
				<Icon path={mdiFloppy} />
			</button>
			<button class="invisible">
				<Icon path={mdiFloppy} />
			</button>
		</div>
		<div
			class="flex flex-1"
			class:hidden={!$currentAudioLoaded$ && !$currentSubtitles$.size}
			style="align-items: flex-end;"
		>
			<Popover placement="bottom" bind:this={currentTimePopover}>
				<div slot="icon">
					<button
						title={$isRecording$ ? 'Recording in progress' : 'Change playback position'}
						disabled={$isRecording$}
						on:click={() => {
							[currentHours, currentMinutes, currentSeconds] = getTimeParts($currentTime$);
							currentActiveSubtitle = $activeSubtitle$.current || $activeSubtitle$.previous;
						}}
					>
						{toTimeString($currentTime$)} / {toTimeString($duration$)}
					</button>
				</div>
				<div class="pos-nav">
					<span class="flex items-center m-r-s">Time:</span>
					<div class="flex items-center">
						<TimeEditInput defaultValue={0} max={durationHours} bind:value={currentHours} />
						<span>:</span>
						<TimeEditInput defaultValue={0} bind:value={currentMinutes} />
						<span>:</span>
						<TimeEditInput defaultValue={0} bind:value={currentSeconds} />
					</div>
					<button title="Jump to time" class="m-x-s" disabled={$isRecording$} on:click={onJumpToTime}>
						<Icon path={mdiCheck} />
					</button>
					{#if $currentSubtitles$.size}
						<span class="flex items-center m-r-s">Id:</span>
						<input class="m-b-s" style="width: 70px; height: 35px;" bind:value={currentActiveSubtitle} />
						<button title="Jump to time" class="m-x-s" disabled={$isRecording$} on:click={onJumpToId}>
							<Icon path={mdiCheck} />
						</button>
					{/if}
				</div>
			</Popover>
			{#if $currentSubtitles$.size}
				<button
					class="m-l-s"
					title={$isRecording$ ? 'Recording in progress' : 'Scroll to current playback position'}
					disabled={$isRecording$}
				>
					<Icon path={mdiDebugStepOver} on:click={() => subtitleListElement?.scrollToSubtitle(true)} />
				</button>
			{/if}
		</div>
	</div>
</div>
<div class="flex flex-col flex-1">
	<div class="flex flex-col flex-1">
		{#if !$currentSubtitles$.size}
			<Dropzone
				multiple
				allowRootFiles
				preferNativeFilesystem
				height="100%"
				dragClasses="on-drag"
				filePickerId="ttu-whispersync-file"
				label={$isMobile$
					? 'Click this zone / above icons to select subtitle/audio files'
					: 'Click this zone / above icons or drag-and-drop to select subtitle/audio files'}
				disabled={!!$exportCancelController$}
				fileFormats={[...allowedSubtitleExtensions, ...allowedAudioExtensions]}
				oldHandles={[...($extensionData$.lastSubtitle ? [] : []), ...($extensionData$.lastAudio ? [] : [])]}
				oldFiles={[...($currentSubtitleFile$ ? [] : []), ...($currentAudioFile$ ? [] : [])]}
				on:start={onFilesStart}
				on:stop={() => {
					$isLoading$ = false;
					$skipKeyListener$ = false;
				}}
				on:result={onHandleFiles}
			/>
		{/if}
		{#if showMenu && $currentTab$ === Tabs.AUDIOBOOK && $currentSubtitles$.size}
			<div class="flex match-btns m-b-s" class:invisible={!$exportCancelController$}>
				<Progress currentProgress={$exportProgress$} rounded margin />
				<button
					class="m-l-s"
					title="Cancel export"
					disabled={$exportCancelController$?.signal.aborted}
					on:click={() => executeAction(Action.CANCEL_EXPORT, subtitles)}
				>
					<Icon path={mdiCancel} />
				</button>
			</div>
			<Subtitles
				skipUpdates={$showBookmarkedSubtitlesOnly$ || $showSubtitlesForMergeOnly$}
				{subtitles}
				bind:this={subtitleListElement}
			/>
		{/if}
	</div>
	{#if $currentAudioSourceUrl$}
		<Player
			{imageLoaded}
			on:loadstart={onAudioLoad}
			on:loaded={() => subtitleListElement?.onResetList()}
			on:error={() => {
				setAudioContext($currentCoverUrl$, $currentCoverUrl$).finally(() => {
					$lastError$ = 'Unable to play audio - try a different codec/format';
					$isLoading$ = false;
				});
			}}
			bind:this={playerElement}
		/>
	{/if}
</div>
<input
	type="file"
	class="hidden"
	accept={`application/x-subrip,text/vtt,text/plain,${allowedSubtitleExtensions.join(',')}`}
	on:change={onFileChange}
	bind:this={subtitleInput}
/>
<input
	type="file"
	class="hidden"
	accept={`audio/mp4,audio/mpeg,${allowedAudioExtensions.join(',')}`}
	on:change={onFileChange}
	bind:this={audioFileInput}
/>
