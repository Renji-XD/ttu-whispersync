<script lang="ts">
	import ActionButtonList from './ActionButtonList.svelte';
	import Audiobook from './Audiobook.svelte';
	import Chapters from './Chapters.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import Dialogs from './Dialogs.svelte';
	import Icon from './Icon.svelte';
	import { Action, executeAction } from '../lib/actions';
	import { setBooksDB } from '../lib/db';
	import { setAudioContext, setSubtitleContext, updateAudio, updateSubtitles, verifyPermissions } from '../lib/files';
	import { type Context, Tabs, type Subtitle, getDummySubtitle } from '../lib/general';
	import { AudioProcessor, ReaderMenuOpenMode, ReaderMenuPauseMode } from '../lib/settings';
	import {
		activeSubtitle$,
		bookData$,
		bookMatched$,
		booksDB$,
		canExportToAnki$,
		currentAudioChapters$,
		currentAudioLoaded$,
		currentAudioSourceUrl$,
		currentCoverUrl$,
		currentMenuPosition$,
		currentSubtitleFile$,
		currentSubtitles$,
		currentTab$,
		currentTime$,
		dialogs$,
		duration$,
		editSubtitleTitle$,
		exportCancelController$,
		exportCancelTitle$,
		exportNewTitle$,
		exportUpdateTitle$,
		extensionData$,
		isAnkiconnectAndroid$,
		isLoading$,
		isMobile$,
		isRecording$,
		lastError$,
		lastExportedCardId$,
		openLastExportedCardTitle$,
		paused$,
		readerActionSubtitle$,
		restartPlaybackTitle$,
		restoreSubtitleTitle$,
		settings$,
		skipKeyListener$,
		toggleBookmarkTitle$,
		toggleMergeTitle$,
		togglePlaybackLoopTitle$,
		togglePlaybackTitle$,
		togglePlayPauseTitle$,
	} from '../lib/stores';
	import {
		getLineCSSSelectorForId,
		getLineCSSSelector,
		getSubtitleIdFromElement,
		parseHTML,
		toTimeStamp,
		between,
	} from '../lib/util';
	import Match from './Match.svelte';
	import { mdiArrowSplitVertical, mdiClose, mdiPlaylistMusicOutline, mdiRepeatOff, mdiSwapHorizontal } from '@mdi/js';
	import ReaderMenu from './ReaderMenu.svelte';
	import Settings from './Settings.svelte';
	import { onDestroy, onMount, setContext } from 'svelte';

	export let componentContainerElement: HTMLDivElement;
	export let bookContentElement: HTMLDivElement;
	export let sandboxElement: HTMLIFrameElement | undefined;
	export let currentBookId: number;

	const sideMenuWidthKey = 'ttu-whispersync-side-menu-width';
	const supportsFileSystem = 'showOpenFilePicker' in window;
	const isVertical = (window.localStorage.getItem('writingMode') || 'vertical-rl') === 'vertical-rl';
	const isPaginated = (window.localStorage.getItem('viewMode') || 'paginated') === 'paginated';
	const firstDimensionMargin = `-${window.localStorage.getItem('firstDimensionMargin') || 0}px`;
	const readerIntersectionObserver: IntersectionObserver | undefined = isPaginated
		? undefined
		: new IntersectionObserver(onIntersection, {
				rootMargin: isVertical
					? `0px ${firstDimensionMargin} 0px ${firstDimensionMargin}`
					: `${firstDimensionMargin} 0px ${firstDimensionMargin} 0px`,
			});
	const isIOS =
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		navigator.platform === 'iPad' ||
		navigator.platform === 'iPhone' ||
		navigator.platform === 'iPod';
	const {
		readerEnableAutoReload$,
		readerPreventActionOnSelection$,
		readerEnableMenuTarget$,
		readerFooterActions$,
		readerClickAction$,
		readerMenuOpenMode$,
		readerMenuPauseMode$,
		readerMenuOpenTime$,
		subtitlesGlobalStartPadding$,
		subtitlesGlobalEndPadding$,
		ankiUrl$,
		ankiDeck$,
		ankiModel$,
		ankiSoundField$,
		ankiSentenceField$,
		exportAudioProcessor$,
		keybindingsEnableTimeFallback$,
	} = settings$;

	let menuElement: HTMLDivElement;
	let audiobookComponent: Audiobook;
	let readerInteractionTimer: number | undefined;
	let readerMenuBookElement: Element | undefined;
	let readerMenuRangeElement: Range | undefined;
	let readerMenuElement: ReaderMenu | undefined;
	let showMenu = false;
	let loadError = '';
	let sideMenuWidth = window.matchMedia('(min-width: 1000px)').matches
		? window.localStorage.getItem(sideMenuWidthKey) || ''
		: '';
	let originalMenuWidth = 0;
	let originalMouseX = 0;
	let originalPos = 0;
	let posDiff = 0;
	let resizeTimer: number | undefined;

	$isMobile$ = navigator.maxTouchPoints > 0;

	$: isLeftMenu = $currentMenuPosition$ === 'left';

	$: $canExportToAnki$ =
		!!$ankiUrl$ &&
		!!$ankiDeck$ &&
		!!$ankiModel$ &&
		!!(($ankiSoundField$ && $currentAudioLoaded$) || $ankiSentenceField$);

	$: $isRecording$ = $exportAudioProcessor$ === AudioProcessor.RECORDER && !!$exportCancelController$;

	$: footerActions = new Set($readerFooterActions$);

	$: showCancelFooterAction =
		(footerActions.has(Action.EXPORT_NEW) || footerActions.has(Action.EXPORT_UPDATE)) && !!$exportCancelController$;

	$: componentContainerElement.style.width = $readerFooterActions$.length
		? `${2 + 2 * $readerFooterActions$.length + (showCancelFooterAction ? 2 : 0)}rem`
		: '2rem';

	$: if (!$currentAudioLoaded$) {
		$togglePlaybackTitle$ = 'Audio file required';
	} else if ($isRecording$) {
		$togglePlaybackTitle$ = 'Recording in progress';
	} else {
		$togglePlaybackTitle$ = Action.TOGGLE_PLAYBACK;
	}

	$: if (!$currentSubtitles$.size) {
		$restartPlaybackTitle$ = 'Subtitle file required';
		$togglePlayPauseTitle$ = 'Subtitle file required';
		$togglePlaybackLoopTitle$ = 'Subtitle file required';
	} else if (!$currentAudioLoaded$) {
		$restartPlaybackTitle$ = 'Audio file required';
		$togglePlayPauseTitle$ = 'Audio file required';
		$togglePlaybackLoopTitle$ = 'Audio file required';
	} else if ($isRecording$) {
		$restartPlaybackTitle$ = 'Recording in progress';
		$togglePlayPauseTitle$ = 'Recording in progress';
		$togglePlaybackLoopTitle$ = 'Recording in progress';
	} else {
		$restartPlaybackTitle$ = Action.RESTART_PLAYBACK;
		$togglePlayPauseTitle$ = Action.TOGGLE_PLAY_PAUSE;
		$togglePlaybackLoopTitle$ = Action.TOGGLE_PLAYBACK_LOOP;
	}

	$: if (!$currentSubtitles$.size) {
		$editSubtitleTitle$ = 'Subtitle file required';
		$restoreSubtitleTitle$ = 'Subtitle file required';
	} else if (!!$exportCancelController$) {
		$editSubtitleTitle$ = 'Export in progress';
		$restoreSubtitleTitle$ = 'Export in progress';
	} else {
		$editSubtitleTitle$ = Action.EDIT_SUBTITLE;
		$restoreSubtitleTitle$ = Action.RESTORE_SUBTITLE;
	}

	$: if (!$currentSubtitles$.size) {
		$toggleBookmarkTitle$ = 'Subtitle file required';
		$toggleMergeTitle$ = 'Subtitle file required';
	} else {
		$toggleBookmarkTitle$ = Action.TOGGLE_BOOKMARK;
		$toggleMergeTitle$ = Action.TOGGLE_MERGE;
	}

	$: if (!$canExportToAnki$) {
		$exportNewTitle$ = 'Anki configuration required';
		$exportUpdateTitle$ = 'Anki configuration required';
	} else if (!$currentSubtitles$.size) {
		$exportNewTitle$ = 'Subtitle file required';
		$exportUpdateTitle$ = 'Subtitle file required';
	} else if ($ankiSoundField$ && !$currentAudioLoaded$ && !$ankiSentenceField$) {
		$exportNewTitle$ = 'Audio file required';
		$exportUpdateTitle$ = 'Audio file required';
	} else if ($exportCancelController$) {
		$exportNewTitle$ = 'Export in progress';
		$exportUpdateTitle$ = 'Export in progress';
		$exportCancelTitle$ = Action.CANCEL_EXPORT;
	} else {
		$exportNewTitle$ = Action.EXPORT_NEW;
		$exportUpdateTitle$ = $isAnkiconnectAndroid$ ? 'Device not supported' : Action.EXPORT_UPDATE;
		$exportCancelTitle$ = 'Export not started';
	}

	$: if ($isAnkiconnectAndroid$) {
		$openLastExportedCardTitle$ = 'Device not supported';
	} else if ($exportCancelController$) {
		$openLastExportedCardTitle$ = 'Export in progress';
	} else if (!$lastExportedCardId$) {
		$openLastExportedCardTitle$ = 'No card exported';
	} else {
		$openLastExportedCardTitle$ = Action.OPEN_LAST_EXPORTED_CARD;
	}

	$: if (!loadError && $bookMatched$.matchedBy) {
		setupActions($readerMenuOpenMode$, $readerClickAction$, $currentSubtitleFile$);
	}

	$: if (readerMenuRangeElement && $readerMenuPauseMode$ === ReaderMenuPauseMode.PAUSE && !$isRecording$) {
		$paused$ = true;
	}

	$: updateReaderActionSubtitle($currentSubtitles$);

	setContext<Context>('context', {
		bookContentElement,
		sandboxElement,
		isVertical,
		isPaginated,
		supportsFileSystem,
		isIOS,
	});

	onMount(initializeComponent);

	onDestroy(() => {
		clearReaderMenuEvents();

		document.removeEventListener('ttsu:skipKeyListener', onSkipKeyListener, false);
		document.removeEventListener('ttsu:page.change', onPageChange, false);

		readerIntersectionObserver?.disconnect();

		if ($exportCancelController$) {
			$exportCancelController$.abort('user aborted');
		}

		setAudioContext($currentCoverUrl$, $currentAudioSourceUrl$);
	});

	function onKeyDown(event: KeyboardEvent) {
		if ($skipKeyListener$ || event.repeat || !(event.ctrlKey || event.metaKey || event.altKey)) {
			return;
		}

		const actionKey = event.code || event.key?.toLowerCase();
		const prioritizedSubtitle =
			$readerEnableMenuTarget$ && $readerMenuOpenMode$ !== ReaderMenuOpenMode.DISABLED
				? $readerActionSubtitle$
				: undefined;

		let action;
		let targetSubtitle =
			prioritizedSubtitle || $currentSubtitles$.get($activeSubtitle$.current || $activeSubtitle$.previous);

		if (!targetSubtitle && $keybindingsEnableTimeFallback$) {
			const subtitles = [...$currentSubtitles$.values()];

			targetSubtitle = subtitles.findLast((subtitle) => $currentTime$ >= subtitle.startSeconds);
		}

		if (event.altKey) {
			switch (actionKey) {
				case 'KeyE':
				case 'e':
					action = Action.EXPORT_UPDATE;
					break;
				case 'KeyG':
				case 'g':
					action = Action.EDIT_SUBTITLE;
					break;
				case 'KeyZ':
				case 'z':
					action = Action.COPY_SUBTITLE;
					break;
				default:
					action = Action.NONE;
					break;
			}
		} else {
			switch (actionKey) {
				case 'KeyB':
				case 'b':
					action = Action.TOGGLE_BOOKMARK;
					break;
				case 'KeyM':
				case 'm':
					action = Action.TOGGLE_MERGE;
					break;
				case 'KeyE':
				case 'e':
					action = Action.EXPORT_NEW;
					break;
				case 'KeyO':
				case 'o':
					targetSubtitle = getDummySubtitle(0);
					action = Action.OPEN_LAST_EXPORTED_CARD;
					break;
				default:
					action = Action.NONE;
					break;
			}
		}

		if (action === Action.NONE) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		executeAction(action, targetSubtitle);
	}

	function onWindowResize() {
		window.clearTimeout(resizeTimer);

		resizeTimer = window.setTimeout(() => {
			resizeTimer = undefined;

			sideMenuWidth = window.matchMedia('(min-width: 1000px)').matches
				? window.localStorage.getItem(sideMenuWidthKey) || ''
				: '';
			audiobookComponent?.resetSubtitleContainerHeight();
			audiobookComponent?.scrollToSubtitle();
		}, 1000);
	}

	function onStartResizeMenu(event: PointerEvent) {
		originalMenuWidth = menuElement.getBoundingClientRect().width;
		originalMouseX = event.pageX;

		window.addEventListener('pointermove', onResizeMenu, false);
		window.addEventListener('pointerup', onStopResizeMenu, false);
	}

	function onResizeMenu(event: PointerEvent) {
		sideMenuWidth = isLeftMenu
			? `${originalMenuWidth + (event.pageX - originalMouseX)}px`
			: `${originalMenuWidth - (event.pageX - originalMouseX)}px`;
	}

	function onStopResizeMenu() {
		window.removeEventListener('pointermove', onResizeMenu, false);
		window.removeEventListener('pointerup', onStopResizeMenu, false);

		window.localStorage.setItem(sideMenuWidthKey, sideMenuWidth);
		audiobookComponent?.resetSubtitleContainerHeight();
	}

	async function initializeComponent() {
		let body: HTMLElement | undefined;

		document.addEventListener('ttsu:skipKeyListener', onSkipKeyListener, false);

		$isLoading$ = true;

		try {
			if (!$booksDB$) {
				const dbVersion = await new Promise<number>((resolve, reject) => {
					document.addEventListener(
						'ttsu:db.version',
						({ detail }: any) => {
							if (detail > 5) {
								return resolve(detail);
							}

							reject(new Error('Invalid ttu version'));
						},
						{
							once: true,
							capture: false,
						},
					);

					document.dispatchEvent(new CustomEvent('ttu-action', { detail: { type: 'dbVersion' } }));

					setTimeout(() => reject(new Error('Invalid ttu version')), 5000);
				});

				await setBooksDB(dbVersion);
			}

			await new Promise((resolve) => {
				document.addEventListener('ttsu:synced', resolve, {
					once: true,
					capture: false,
				});

				document.dispatchEvent(new CustomEvent('ttu-action', { detail: { type: 'waitForSync' } }));
			});

			const book = await $booksDB$.get('data', currentBookId);

			if (!book || !book.title || (!book.elementHtml && !book.storageSource)) {
				throw new Error(`required data for id ${currentBookId} not found`);
			} else if (!book.elementHtml && book.storageSource) {
				throw new Error(`books from external storage sources are currently not supported`);
			}

			body = parseHTML(new DOMParser(), book.elementHtml);

			const metadataElement = body.firstElementChild;
			const [audioBook, subtitle, audioHandle, subtitleHandle] = await Promise.all([
				$booksDB$.get('audioBook', book.title),
				$booksDB$.get('subtitle', book.title),
				...(supportsFileSystem
					? [
							$booksDB$.get('handle', [book.title, 'audioBook']),
							$booksDB$.get('handle', [book.title, 'subtitle']),
						]
					: []),
			]);

			if (metadataElement instanceof HTMLElement) {
				$bookMatched$ = {
					matchedBy: metadataElement.dataset.ttuWhispersyncMatchedBy || '',
					matchedOn: Number.parseInt(metadataElement.dataset.ttuWhispersyncMatchedOn || '0', 10),
				};
			}

			$bookData$ = book;
			$extensionData$ = {
				title: book.title,
				lastAudio: audioHandle?.handle instanceof FileSystemFileHandle ? audioHandle.handle : undefined,
				lastSubtitle:
					subtitleHandle?.handle instanceof FileSystemFileHandle ? subtitleHandle.handle : undefined,
				playbackPosition: audioBook?.playbackPosition || 0,
				subtitleData: subtitle?.subtitleData,
			};

			$currentTime$ = audioBook?.playbackPosition || 0;
		} catch ({ message }: any) {
			loadError = `Initialization failed: ${message}`;
		}

		if (loadError) {
			$isLoading$ = false;
			return;
		}

		if (isPaginated) {
			document.addEventListener('ttsu:page.change', onPageChange, false);
		}

		await initializeComponentData();
	}

	function onSkipKeyListener({ detail }: any) {
		$skipKeyListener$ = detail;
	}

	function onPageChange() {
		resetReaderMenu();
	}

	async function initializeComponentData(forceLoad = false) {
		if (forceLoad) {
			$isLoading$ = true;
		}

		if ($readerEnableAutoReload$ || forceLoad) {
			await initializeFiles();
		}

		await loadPersistedSubtitles(!$currentAudioSourceUrl$ || forceLoad);
	}

	async function initializeFiles(retry = true) {
		const lastSubtitle =
			!$currentSubtitleFile$ && $extensionData$.lastSubtitle ? $extensionData$.lastSubtitle : undefined;
		const lastAudio = !$currentAudioSourceUrl$ && $extensionData$.lastAudio ? $extensionData$.lastAudio : undefined;

		if (!supportsFileSystem || (!lastSubtitle && !lastAudio)) {
			return;
		}

		try {
			await verifyPermissions([lastSubtitle, lastAudio]);
		} catch ({ message }: any) {
			if (!message.includes('activation is required')) {
				$lastError$ = `Failed to reload file(s): ${message}`;
			} else if (retry) {
				const wasCanceled = await new Promise<boolean>((resolver) =>
					dialogs$.add({
						component: ConfirmDialog,
						props: {
							dialogHeader: 'Reopen files',
							dialogMessage: 'Click confirm to reopen files',
							resolver,
						},
					}),
				);

				if (!wasCanceled) {
					return initializeFiles(false);
				}

				return;
			} else {
				$lastError$ = `Failed to acccess files: ${message}`;
			}
		}

		if ($lastError$) {
			return;
		}

		const errors: string[] = [];

		if (lastSubtitle) {
			try {
				const subtitleFile = await lastSubtitle.getFile();

				await updateSubtitles(subtitleFile, document, true);
			} catch ({ message }: any) {
				errors.push(`Failed to load subtitle file: ${message}`);

				setSubtitleContext();
			}
		}

		if (lastAudio) {
			try {
				const audioFile = await lastAudio.getFile();

				await updateAudio(audioFile, sandboxElement, true);
			} catch ({ message }: any) {
				errors.push(`Failed to load audio file: ${message}`);

				await setAudioContext($currentCoverUrl$, $currentAudioSourceUrl$);
			}
		}

		if (errors.length) {
			$lastError$ = errors.join('; ');
		}
	}

	async function loadPersistedSubtitles(resetIsLoading = false) {
		if (
			$lastError$ ||
			$currentSubtitleFile$ ||
			!$extensionData$.subtitleData ||
			!$extensionData$.subtitleData.subtitles.length
		) {
			if (resetIsLoading) {
				$isLoading$ = false;
			}

			return;
		}

		try {
			const persistedSubtitles = new Map<string, Subtitle>();
			const subtitlesGlobalStartPadding = $subtitlesGlobalStartPadding$ / 1000;
			const subtitlesGlobalEndPadding = $subtitlesGlobalEndPadding$ / 1000;

			for (let index = 0, { length } = $extensionData$.subtitleData.subtitles; index < length; index += 1) {
				const subtitle = $extensionData$.subtitleData.subtitles[index];
				const startSeconds = Math.max(
					0,
					subtitle.adjustedStartSeconds ?? subtitle.originalStartSeconds + subtitlesGlobalStartPadding,
				);
				const endSeconds = $duration$
					? between(
							0,
							$duration$,
							subtitle.adjustedEndSeconds ?? subtitle.originalEndSeconds + subtitlesGlobalEndPadding,
						)
					: Math.max(
							0,
							subtitle.adjustedEndSeconds ?? subtitle.originalEndSeconds + subtitlesGlobalEndPadding,
						);

				persistedSubtitles.set(subtitle.id, {
					...subtitle,
					startSeconds,
					startTime: toTimeStamp(startSeconds),
					endSeconds,
					endTime: toTimeStamp(endSeconds),
				});
			}

			const dummyBlob = new Blob([''], { type: 'application/x-subrip;charset=utf-8' });

			setSubtitleContext(
				new File([dummyBlob], $extensionData$.subtitleData.name, { type: dummyBlob.type }),
				persistedSubtitles,
			);
		} catch ({ message }: any) {
			$lastError$ = `Failed to load persisted subtitle: ${message}`;

			setSubtitleContext();
		}

		if (resetIsLoading) {
			$isLoading$ = false;
		}
	}

	function setupActions(readerMenuOpenMode: string, readerClickAction: string, _: any) {
		clearReaderMenuEvents();
		resetReaderMenu();

		if (
			readerMenuOpenMode === ReaderMenuOpenMode.CLICK ||
			(readerMenuOpenMode === ReaderMenuOpenMode.DISABLED && readerClickAction !== Action.NONE)
		) {
			bookContentElement.addEventListener('click', onReaderClick, false);
		} else if (readerMenuOpenMode === ReaderMenuOpenMode.HOLD) {
			bookContentElement.addEventListener('pointerdown', onReaderPointerDown, false);
		}
	}

	function onReaderClick(event: MouseEvent) {
		if (event.button !== 0 || !setClosestSubtitleElement(event)) {
			return;
		}

		handleReaderInteraction();
	}

	function onReaderPointerDown(event: PointerEvent) {
		if (event.button !== 0 || !setClosestSubtitleElement(event)) {
			return;
		}

		if (!isPaginated) {
			originalPos = isVertical ? event.pageX : event.pageY;
			posDiff = 0;

			window.addEventListener('pointermove', onPointerMove, false);
		}

		if ($readerPreventActionOnSelection$ && $isMobile$) {
			window.getSelection()?.removeAllRanges();
			document.body.style.userSelect = 'none';
		}

		bookContentElement.addEventListener('pointerup', onReaderPointerUp, false);

		readerInteractionTimer = window.setTimeout(handleReaderInteraction, $readerMenuOpenTime$);
	}

	function onPointerMove(event: PointerEvent) {
		const currentPos = isVertical ? event.pageX : event.pageY;

		posDiff = Math.abs(currentPos - originalPos);
	}

	function onReaderPointerUp() {
		if (resetEventEnd()) {
			return;
		}

		if (!$readerPreventActionOnSelection$ || !window.getSelection()?.toString().trim()) {
			setReaderActionSubtitle();

			executeAction($readerClickAction$, $readerActionSubtitle$);
		}

		resetReaderMenu();
	}

	function clearReaderMenuEvents() {
		resetEventEnd();

		bookContentElement.removeEventListener('click', onReaderClick, false);
		bookContentElement.removeEventListener('pointerdown', onReaderPointerDown, false);
	}

	function resetEventEnd() {
		clearTimeout(readerInteractionTimer);

		window.removeEventListener('pointermove', onPointerMove, false);
		bookContentElement.removeEventListener('pointerup', onReaderPointerUp, false);

		document.body.style.userSelect = 'auto';

		return !isPaginated && posDiff > 10;
	}

	function setClosestSubtitleElement(event: MouseEvent | PointerEvent) {
		const elementFromPoint = document.elementFromPoint(event.x, event.y);
		const closestSubtitleElement = elementFromPoint?.closest(getLineCSSSelector());

		if (closestSubtitleElement instanceof HTMLSpanElement) {
			readerMenuBookElement = closestSubtitleElement;
		} else if (!readerMenuElement?.isInReaderMenu(elementFromPoint)) {
			resetReaderMenu();
		}

		return readerMenuBookElement;
	}

	function resetReaderMenu(resetAll = true) {
		const lastActiveElements = bookContentElement.querySelectorAll(`${getLineCSSSelector()}.menu-open`);

		for (let index = 0, { length } = lastActiveElements; index < length; index += 1) {
			lastActiveElements[index].classList.remove('menu-open');
		}

		readerIntersectionObserver?.disconnect();

		if (resetAll) {
			readerMenuBookElement = undefined;
			readerMenuRangeElement = undefined;
			$readerActionSubtitle$ = undefined;
		}
	}

	function setReaderActionSubtitle() {
		if (!readerMenuBookElement) {
			return ['', ''];
		}

		const subtitleId = getSubtitleIdFromElement(readerMenuBookElement);
		const oldSubtitleId = $readerActionSubtitle$?.id;

		$readerActionSubtitle$ = $currentSubtitles$.get(subtitleId);

		return [oldSubtitleId, subtitleId];
	}

	function handleReaderInteraction() {
		if (resetEventEnd()) {
			return;
		}

		if (
			!readerMenuBookElement ||
			($readerPreventActionOnSelection$ && !!window.getSelection()?.toString().trim())
		) {
			return resetReaderMenu();
		}

		if ($readerMenuOpenMode$ === ReaderMenuOpenMode.DISABLED && $readerClickAction$ !== Action.NONE) {
			return onReaderPointerUp();
		}

		const [oldSubtitleId, subtitleId] = setReaderActionSubtitle();

		if (oldSubtitleId === subtitleId) {
			return;
		}

		const subtitleElements = [...bookContentElement.querySelectorAll(getLineCSSSelectorForId(subtitleId!))];
		const startElment = subtitleElements[0];
		const endElement = subtitleElements[subtitleElements.length - 1];
		const nodeRange = document.createRange();

		nodeRange.setStart(startElment, 0);
		nodeRange.setEnd(endElement, endElement.childNodes.length);

		resetReaderMenu(false);

		for (let index = 0, { length } = subtitleElements; index < length; index += 1) {
			subtitleElements[index].classList.add('menu-open');
		}

		readerMenuRangeElement = nodeRange;

		readerIntersectionObserver?.observe(endElement);
	}

	function onIntersection(entries: IntersectionObserverEntry[]) {
		if (entries.every((entry) => !entry.isIntersecting)) {
			resetReaderMenu();
		}
	}

	function updateReaderActionSubtitle(subtitles: Map<string, Subtitle>) {
		if (!$readerActionSubtitle$) {
			return;
		}

		$readerActionSubtitle$ = subtitles.get($readerActionSubtitle$.id);
	}
</script>

<svelte:window on:resize={onWindowResize} on:keydown={onKeyDown} />

<button
	class="h-full hover:opacity-70"
	class:text-red-500={loadError || $lastError$}
	class:animate-pulse={loadError || $lastError$}
	on:click|stopPropagation={() => {
		showMenu = true;

		if (!loadError && !$isLoading$) {
			initializeComponentData(true);
		}
	}}
>
	<Icon path={mdiPlaylistMusicOutline} />
</button>

{#if footerActions.size}
	<ActionButtonList
		{footerActions}
		{showCancelFooterAction}
		subtitle={$currentSubtitles$.get($activeSubtitle$.current || $activeSubtitle$.previous)}
	/>
{/if}

<Dialogs />

<ReaderMenu
	range={readerMenuRangeElement}
	subtitle={$readerActionSubtitle$}
	bind:this={readerMenuElement}
	on:close={() => resetReaderMenu()}
/>

<div
	class="ttu-whispersync-container side-menu flex-col justify-between fixed top-0 left-0 h-full writing-horizontal-tb z-[60]"
	class:left-0={isLeftMenu}
	class:right-0={!isLeftMenu}
	class:hidden={!showMenu}
	class:flex={showMenu}
	style:width={sideMenuWidth || null}
	bind:this={menuElement}
	on:wheel|passive|stopPropagation
>
	<div class="flex justify-between right-menu p-4" class:left-menu={isLeftMenu}>
		<button on:click={() => ($lastError$ = '')}>{loadError || $lastError$}</button>
		<div class="flex right-menu" class:left-menu={isLeftMenu}>
			<button
				title="Close menu"
				class:m-l-b={isLeftMenu}
				class:m-r-b={!isLeftMenu}
				on:click={() => (showMenu = false)}
			>
				<Icon path={mdiClose} />
			</button>
			<button
				title={`Switch menu position to ${isLeftMenu ? 'right' : 'left'}`}
				class="side-menu-only"
				class:m-l-s={isLeftMenu}
				class:m-r-s={!isLeftMenu}
				on:click={() => ($currentMenuPosition$ = isLeftMenu ? 'right' : 'left')}
			>
				<Icon path={mdiSwapHorizontal} />
			</button>
			<button
				title="Reset menu width"
				class="side-menu-only"
				class:m-l-s={isLeftMenu}
				class:m-r-s={!isLeftMenu}
				on:click={() => {
					sideMenuWidth = `${36 * parseFloat(window.getComputedStyle(document.documentElement).fontSize)}px`;

					window.localStorage.removeItem(sideMenuWidthKey);

					audiobookComponent?.resetSubtitleContainerHeight();
				}}
			>
				<Icon path={mdiRepeatOff} />
			</button>
			<button
				title="Resize menu width"
				class="resize-cursor side-menu-only"
				class:m-l-s={isLeftMenu}
				class:m-r-s={!isLeftMenu}
				on:pointerdown|preventDefault={onStartResizeMenu}
			>
				<Icon path={mdiArrowSplitVertical} />
			</button>
		</div>
	</div>
	<div
		class="flex flex-col flex-1 p-x-b p-y-s"
		class:overflow-auto={$currentTab$ === Tabs.SETTINGS || $currentTab$ === Tabs.CHAPTERS}
	>
		{#if !loadError && $bookData$?.elementHtml && $extensionData$?.title}
			<div class="flex justify-between w-full tabs m-b-s">
				<button
					title="Switch to Audiobook tab"
					class:tab-active={$currentTab$ === Tabs.AUDIOBOOK}
					on:click={() => ($currentTab$ = Tabs.AUDIOBOOK)}
				>
					{Tabs.AUDIOBOOK}
				</button>
				{#if $currentSubtitles$.size && !$bookMatched$.matchedBy}
					<button
						title="Switch to Match tab"
						class:tab-active={$currentTab$ === Tabs.MATCH}
						on:click={() => ($currentTab$ = Tabs.MATCH)}
					>
						{Tabs.MATCH}
					</button>
				{/if}
				{#if $currentAudioChapters$.length}
					<button
						title="Switch to Chapters tab"
						class:tab-active={$currentTab$ === Tabs.CHAPTERS}
						on:click={() => ($currentTab$ = Tabs.CHAPTERS)}
					>
						{Tabs.CHAPTERS}
					</button>
				{/if}
				<button
					title="Switch to Settings tab"
					class:tab-active={$currentTab$ === Tabs.SETTINGS}
					on:click={() => ($currentTab$ = Tabs.SETTINGS)}
				>
					{Tabs.SETTINGS}
				</button>
			</div>
			<div
				class="flex-col flex-1 m-b-s"
				class:hidden={$currentTab$ !== Tabs.AUDIOBOOK}
				class:flex={$currentTab$ === Tabs.AUDIOBOOK}
			>
				<Audiobook {showMenu} bind:this={audiobookComponent} />
			</div>
			<div class="flex flex-col flex-1" class:hidden={$currentTab$ !== Tabs.MATCH}>
				<Match on:selectHint={() => (showMenu = false)} on:hintSelected={() => (showMenu = true)} />
			</div>
			<div class="overflow-auto" class:hidden={$currentTab$ !== Tabs.CHAPTERS}>
				<Chapters />
			</div>
			<div class="overflow-auto" class:hidden={$currentTab$ !== Tabs.SETTINGS}>
				<Settings />
			</div>
		{/if}
	</div>
	<div class:hidden={!$isLoading$} class="backdrop">
		<span class="spinner"></span>
	</div>
</div>
