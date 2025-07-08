import { exportToAnki, openGUIForNote } from './anki';
import InteractiveEditSubtitleDialog from '../components/InteractiveEditSubtitleDialog.svelte';
import ManualEditSubtitleDialog from '../components/ManualEditSubtitleDialog.svelte';
import type { SubtitleData } from './db';
import { getDummySubtitle, type EditSubtitleResult, type Subtitle } from './general';
import { AudioProcessor } from './settings';
import {
	bookmarkedSubtitles$,
	playLine$,
	settings$,
	subtitlesForMerge$,
	currentSubtitles$,
	duration$,
	dialogs$,
	lastError$,
	currentAudioLoaded$,
	paused$,
	subtitleChange$,
	bookData$,
	exportProgress$,
	exportCancelController$,
	isRecording$,
	extensionData$,
	currentSubtitleFile$,
	skipKeyListener$,
	booksDB$,
	canExportToAnki$,
	bookMatched$,
	showBookmarkedSubtitlesOnly$,
	showSubtitlesForMergeOnly$,
} from './stores';
import { get, type Writable } from 'svelte/store';
import { allIgnoredElements, between, getLineCSSSelectorForId, parseHTML, toTimeStamp } from './util';

function dispatchSkipKeyEvent(document: Document, value: boolean) {
	document.dispatchEvent(
		new CustomEvent('ttu-action', { detail: { type: 'skipKeyDownListener', params: { value } } }),
	);

	skipKeyListener$.set(value);
}

function executeFilterAction(filterStore: Writable<Set<string>>, id: string) {
	const storeSet = get(filterStore);

	if (storeSet.has(id)) {
		storeSet.delete(id);
	} else {
		storeSet.add(id);
	}

	filterStore.set(storeSet);
}

async function executeEditSubtitle(activeSubtitle: Subtitle) {
	paused$.set(true);

	const openAdvancedEditor =
		get(currentAudioLoaded$) && get(settings$.exportAudioProcessor$) === AudioProcessor.FFMPEG;
	const component = openAdvancedEditor ? InteractiveEditSubtitleDialog : ManualEditSubtitleDialog;
	const currentSubtitles = get(currentSubtitles$);
	const subtitles = [...currentSubtitles.values()];
	const props: Record<string, any> = { activeSubtitle: JSON.parse(JSON.stringify(activeSubtitle)) };

	if (openAdvancedEditor) {
		const subtitleRegions = subtitles.slice(Math.max(0, activeSubtitle.subIndex - 1), activeSubtitle.subIndex + 2);

		if (activeSubtitle.subIndex === 0) {
			const startSeconds = Math.max(0, activeSubtitle.startSeconds - 10);

			subtitleRegions.unshift(getDummySubtitle(startSeconds));
		} else if (activeSubtitle.subIndex === currentSubtitles.size - 1) {
			const endSeconds = between(0, get(duration$), activeSubtitle.endSeconds + 10);

			subtitleRegions.push(getDummySubtitle(endSeconds, endSeconds));
		}

		props.subtitleRegions = JSON.parse(JSON.stringify(subtitleRegions));
	}

	const result = await new Promise<EditSubtitleResult>((resolver) => {
		dialogs$.add({
			component,
			props: {
				...props,
				resolver,
			},
		});
	});

	if (result.error) {
		return lastError$.set(result.error);
	}

	if (result.wasCanceled || !result.subtitle) {
		return;
	}

	currentSubtitles.set(activeSubtitle.id, result.subtitle);
	currentSubtitles$.set(currentSubtitles);
	subtitleChange$.set({ subtitles: [result.subtitle] });

	if (!get(settings$.subtitlesEnablePersist$)) {
		return;
	}

	lastError$.set('');

	subtitles[result.subtitle.subIndex] = result.subtitle;

	await persistSubtitles({ name: get(currentSubtitleFile$)!.name, subtitles }).catch(({ message }: any) =>
		lastError$.set(message),
	);
}

async function executeAlignSubtitle(subtitles: Subtitle[], persistAlignment: boolean | undefined) {
	try {
		lastError$.set('');

		await new Promise<void>((resolve) => window.setTimeout(resolve, 100));

		const book = parseHTML(new DOMParser(), get(bookData$).elementHtml);
		const currentSubtitles = get(currentSubtitles$);

		let hadChange = false;

		for (let index = 0, { length } = subtitles; index < length; index += 1) {
			const subtitle = currentSubtitles.get(subtitles[index].id)!;
			const elements = book.querySelectorAll<HTMLSpanElement>(getLineCSSSelectorForId(subtitle.id));

			let text = '';

			for (let index2 = 0, { length: length2 } = elements; index2 < length2; index2 += 1) {
				const element = elements[index2];
				const parentTag = (element.parentElement?.tagName || '').toLowerCase();

				if (!allIgnoredElements.has(parentTag)) {
					text += element.innerText.trim();
				}
			}

			if (text !== subtitle.originalText) {
				subtitle.text = text;

				currentSubtitles.set(subtitle.id, subtitle);

				hadChange = true;
			}
		}

		if (!hadChange) {
			return;
		}

		currentSubtitles$.set(currentSubtitles);

		if (!persistAlignment || !get(settings$.subtitlesEnablePersist$)) {
			return;
		}

		lastError$.set('');

		await persistSubtitles({
			name: get(currentSubtitleFile$)!.name,
			subtitles: [...currentSubtitles.values()],
		});
	} catch ({ message }: any) {
		lastError$.set(`Failed to align: ${message}`);
	}
}

async function executeRestoreSubtitle(subtitles: Subtitle[]) {
	const changedSubtitles: Subtitle[] = [];
	const currentSubtitles = get(currentSubtitles$);
	const duration = get(duration$);
	const subtitlesGlobalStartPadding = get(settings$.subtitlesGlobalStartPadding$) / 1000;
	const subtitlesGlobalEndPadding = get(settings$.subtitlesGlobalEndPadding$) / 1000;

	let hadChange = false;

	for (let index = 0, { length } = subtitles; index < length; index += 1) {
		const subtitle = subtitles[index];
		const startSeconds = Math.max(0, subtitle.originalStartSeconds + subtitlesGlobalStartPadding);
		const endSeconds = duration
			? between(0, duration, subtitle.originalEndSeconds + subtitlesGlobalEndPadding)
			: Math.max(0, subtitle.originalEndSeconds + subtitlesGlobalEndPadding);
		const hasTextDiff = subtitle.text !== subtitle.originalText;
		const hasTimeDiff =
			(Number.isFinite(subtitle.adjustedStartSeconds) && subtitle.adjustedStartSeconds !== startSeconds) ||
			(Number.isFinite(subtitle.adjustedEndSeconds) && subtitle.adjustedEndSeconds !== endSeconds);

		delete subtitle.adjustedStartSeconds;
		delete subtitle.adjustedEndSeconds;

		if (hasTextDiff || hasTimeDiff) {
			const changedSubtitle = {
				...subtitle,
				startSeconds,
				startTime: toTimeStamp(startSeconds),
				endSeconds,
				endTime: toTimeStamp(endSeconds),
				text: subtitle.originalText,
			};

			currentSubtitles.set(subtitle.id, changedSubtitle);

			hadChange = true;

			if (hasTimeDiff) {
				changedSubtitles.push(changedSubtitle);
			}
		}
	}

	if (!hadChange) {
		return;
	}

	currentSubtitles$.set(currentSubtitles);
	subtitleChange$.set({ subtitles: changedSubtitles });

	if (!get(settings$.subtitlesEnablePersist$)) {
		return;
	}

	lastError$.set('');

	await persistSubtitles({
		name: get(currentSubtitleFile$)!.name,
		subtitles: [...currentSubtitles.values()],
	}).catch(({ message }: any) => lastError$.set(message));
}

function getSubtitlesForExport(subtitles: Subtitle[], mergeSubtitles: boolean | undefined) {
	if (mergeSubtitles) {
		return JSON.parse(JSON.stringify([subtitles]));
	}

	const subtitlesForExport: Subtitle[][] = [];

	for (let index = 0, { length } = subtitles; index < length; index += 1) {
		subtitlesForExport.push([subtitles[index]]);
	}

	return JSON.parse(JSON.stringify(subtitlesForExport));
}

export enum Action {
	NONE = 'None',
	TOGGLE_PLAYBACK = 'Toggle playback',
	REWIND = 'Rewind',
	REWIND_ALT = 'Rewind #2',
	FAST_FORWARD = 'Fast-Forward',
	FAST_FORWARD_ALT = 'Fast-Forward #2',
	RESTART_PLAYBACK = 'Restart playback',
	TOGGLE_PLAY_PAUSE = 'Toggle play and pause',
	TOGGLE_PLAYBACK_LOOP = 'Toggle playback loop',
	TOGGLE_BOOKMARK = 'Toggle bookmark',
	TOGGLE_SHOW_BOOKMARKED = 'Toggle menu bookmark filter',
	TOGGLE_MERGE = 'Toggle for merge',
	TOGGLE_SHOW_FOR_MERGE = 'Toggle menu merge filter',
	ALIGN_SUBTITLE = 'Align with book text',
	EDIT_SUBTITLE = 'Edit subtitle',
	RESTORE_SUBTITLE = 'Restore original text and time',
	COPY_SUBTITLE = 'Copy subtitle',
	PREVIOUS_SUBTITLE = 'Go to previous subtitle',
	NEXT_SUBTITLE = 'Go to next subtitle',
	EXPORT_NEW = 'Create new card',
	EXPORT_UPDATE = 'Update last created card',
	OPEN_LAST_EXPORTED_CARD = 'Open last exported card',
	CANCEL_EXPORT = 'Cancel Export',
}

export interface ActionSettings {
	mergeSubtitles?: boolean;
	skipUpdates?: boolean;
	keepPauseState?: boolean;
	persistAlignment?: boolean;
	ignoreSkipKeyListener?: boolean;
}

export function clickOutside(node: Node, listener: (ev: MouseEvent) => void) {
	const handler = (ev: MouseEvent) => {
		if (!ev.defaultPrevented && !node.contains(ev.target as Node)) {
			listener(ev);
		}
	};

	document.addEventListener('click', handler, true);

	return {
		destroy() {
			document.removeEventListener('click', handler, true);
		},
	};
}

export function skipKeys(node: Node, { document, isSkipped }: { document: Document; isSkipped: boolean }) {
	const focusHandler = () => dispatchSkipKeyEvent(document, true);
	const blurHandler = () => dispatchSkipKeyEvent(document, false);

	if (!isSkipped) {
		node.addEventListener('focus', focusHandler, false);
		node.addEventListener('blur', blurHandler, false);
	}

	return {
		destroy() {
			node.removeEventListener('focus', focusHandler, false);
			node.removeEventListener('blur', blurHandler, false);

			if (!isSkipped) {
				dispatchSkipKeyEvent(document, false);
			}
		},
	};
}

export async function executeAction(
	action: string,
	subtitle: Subtitle[] | Subtitle | undefined,
	settings: ActionSettings = {
		mergeSubtitles: false,
		skipUpdates: false,
		keepPauseState: false,
		persistAlignment: true,
		ignoreSkipKeyListener: false,
	},
) {
	if (action === Action.NONE || !subtitle || (!settings.ignoreSkipKeyListener && get(skipKeyListener$))) {
		return;
	}

	const subtitles = Array.isArray(subtitle) ? subtitle : [subtitle];
	const exportCancelController = get(exportCancelController$);
	const isRecording = get(isRecording$);

	if (!subtitles.length) {
		return;
	}

	if (!isRecording && action === Action.TOGGLE_PLAYBACK) {
		const paused = get(paused$);

		paused$.set(!paused);
	} else if (
		!isRecording &&
		(action === Action.RESTART_PLAYBACK ||
			action === Action.TOGGLE_PLAY_PAUSE ||
			action === Action.TOGGLE_PLAYBACK_LOOP)
	) {
		playLine$.set({
			action,
			subtitles,
			skipUpdates: settings.skipUpdates,
			keepPauseState: settings.keepPauseState,
		});
	} else if (action === Action.TOGGLE_BOOKMARK) {
		executeFilterAction(bookmarkedSubtitles$, subtitles[0].id);
	} else if (action === Action.TOGGLE_SHOW_BOOKMARKED) {
		showBookmarkedSubtitlesOnly$.set(!get(showBookmarkedSubtitlesOnly$));
	} else if (action === Action.TOGGLE_MERGE) {
		executeFilterAction(subtitlesForMerge$, subtitles[0].id);
	} else if (action === Action.TOGGLE_SHOW_FOR_MERGE) {
		showSubtitlesForMergeOnly$.set(!get(showSubtitlesForMergeOnly$));
	} else if (!exportCancelController && action === Action.EDIT_SUBTITLE) {
		await executeEditSubtitle(subtitles[0]);
	} else if (!exportCancelController && action === Action.ALIGN_SUBTITLE && get(bookMatched$).matchedBy) {
		await executeAlignSubtitle(subtitles, settings.persistAlignment);
	} else if (!exportCancelController && action === Action.RESTORE_SUBTITLE) {
		await executeRestoreSubtitle(subtitles);
	} else if (action === Action.COPY_SUBTITLE) {
		await navigator.clipboard
			.writeText(subtitles[0].text)
			.catch(({ message }) => console.log(`failed to copy subtitle: ${message}`));
	} else if (!isRecording && (action === Action.PREVIOUS_SUBTITLE || action === Action.NEXT_SUBTITLE)) {
		const currentSubtitles = [...get(currentSubtitles$).values()];

		let targetSubtitle: Subtitle;

		if (action === Action.PREVIOUS_SUBTITLE) {
			targetSubtitle = currentSubtitles[Math.max(subtitles[0].subIndex - 1, 0)];
		} else {
			targetSubtitle = currentSubtitles[Math.min(subtitles[0].subIndex + 1, currentSubtitles.length - 1)];
		}

		playLine$.set({
			action: Action.RESTART_PLAYBACK,
			subtitles: [targetSubtitle],
			skipUpdates: settings.skipUpdates,
			keepPauseState: true,
		});
	} else if (
		!exportCancelController &&
		(action === Action.EXPORT_NEW || action === Action.EXPORT_UPDATE) &&
		get(canExportToAnki$)
	) {
		await exportToAnki(
			getSubtitlesForExport(subtitles, settings.mergeSubtitles),
			action === Action.EXPORT_UPDATE,
			settings.mergeSubtitles || false,
		).finally(() => {
			exportProgress$.set(0);
			exportCancelController$.set(undefined);
		});
	} else if (!exportCancelController) {
		await openGUIForNote(get(settings$.ankiUrl$));
	} else if (exportCancelController && !exportCancelController.signal.aborted && action === Action.CANCEL_EXPORT) {
		exportCancelController.abort('user aborted');
		exportCancelController$.set(exportCancelController);
	}
}

export async function persistSubtitles(subtitleData: SubtitleData) {
	const extensionData = get(extensionData$);

	try {
		await get(booksDB$).put('subtitle', {
			subtitleData,
			title: extensionData.title,
			lastSubtitleDataModified: Date.now(),
		});

		extensionData.subtitleData = subtitleData;

		document.dispatchEvent(new CustomEvent('ttu-action', { detail: { type: 'sync', syncType: 'subtitle' } }));
	} catch ({ message }: any) {
		throw new Error(`Failed to persist subtitles - ${message}`);
	} finally {
		extensionData$.set(extensionData);
	}
}
