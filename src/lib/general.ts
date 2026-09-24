import { writable } from 'svelte/store';

export type EventWithElement<T> = Event & { currentTarget: T };

export type MouseEventWithElement<T> = MouseEvent & { currentTarget: T };

export type PointerEventWithElement<T> = PointerEvent & { currentTarget: T };

export enum Tabs {
	AUDIOBOOK = 'Audiobook',
	MATCH = 'Match',
	CHAPTERS = 'Chapters',
	SETTINGS = 'Settings',
}

export interface Dialog {
	component: (new (...args: any[]) => any) | string;
	props?: Record<string, any>;
	disableCloseOnClick?: boolean;
	zIndex?: string;
}

export interface Context {
	bookContentElement: HTMLDivElement;
	sandboxElement: HTMLIFrameElement | undefined;
	isVertical: boolean;
	isPaginated: boolean;
	supportsFileSystem: boolean;
	isIOS: boolean;
}

export interface Subtitle {
	id: string;
	originalStartSeconds: number;
	adjustedStartSeconds?: number;
	startSeconds: number;
	startTime: string;
	originalEndSeconds: number;
	adjustedEndSeconds?: number;
	endSeconds: number;
	endTime: string;
	originalText: string;
	text: string;
	subIndex: number;
}

export interface DiffDetail {
	id: string;
	original: string;
	adjusted: string;
}

export interface BookMatch {
	matchedBy: string;
	matchedOn: number;
}

export interface ActiveSubtitle {
	previous: string;
	current: string;
	useTimeFallback: boolean;
}

export interface AudioChapter {
	key: string;
	label: string;
	startSeconds: number;
	startText: string;
}

export interface AudioResult {
	coverUrl: string;
	chapters: AudioChapter[];
	audioSourceUrl: string;
}

export interface AudioRange {
	startSeconds: number;
	endSeconds: number;
}

export interface PlayLineData {
	action: string;
	subtitles: Subtitle[];
	skipUpdates?: boolean;
	keepPauseState?: boolean;
	maxSilenceSeconds?: number;
	recorderSuccess?: (audioBuffer: ArrayBuffer | undefined) => void;
	recorderFailure?: (error: any) => void;
}

export interface SubtitleChange {
	subtitles: Subtitle[];
	replaceTrack?: boolean;
}

export interface EditSubtitleResult {
	wasCanceled: boolean;
	subtitle?: Subtitle;
	error?: string;
}

export function createDialogsStore() {
	const { subscribe, set, update } = writable<Dialog[]>([]);

	return {
		subscribe,
		set,
		add: (dialog: Dialog) => {
			update((oldDialogs) => {
				oldDialogs.push(dialog);

				return oldDialogs;
			});
		},
	};
}

export function getDummySubtitle(startSeconds: number, endSeconds = 0): Subtitle {
	return {
		id: '-1',
		originalStartSeconds: startSeconds,
		startSeconds: startSeconds,
		startTime: '',
		originalEndSeconds: endSeconds,
		endSeconds: endSeconds,
		endTime: '',
		originalText: '',
		text: '',
		subIndex: -1,
	};
}

/**
 * Collapses subtitles into the audio ranges to play or cut - consecutive lines share one continuous range so the
 * audio flows through their boundaries, while gaps in the selection stay separate ranges. A silence between
 * consecutive lines longer than maxSilenceSeconds is shortened to that length, split evenly around the cut
 */
export function getAudioRanges(subtitles: Subtitle[], maxSilenceSeconds = Infinity) {
	const ranges: AudioRange[] = [];

	for (let index = 0, { length } = subtitles; index < length; index += 1) {
		const { startSeconds, endSeconds, subIndex } = subtitles[index];
		const lastRange = ranges[ranges.length - 1];

		if (!lastRange || subIndex !== subtitles[index - 1].subIndex + 1) {
			ranges.push({ startSeconds, endSeconds });
		} else if (startSeconds - lastRange.endSeconds > maxSilenceSeconds) {
			lastRange.endSeconds += maxSilenceSeconds / 2;
			ranges.push({ startSeconds: startSeconds - maxSilenceSeconds / 2, endSeconds });
		} else {
			lastRange.endSeconds = Math.max(lastRange.endSeconds, endSeconds);
		}
	}

	return ranges;
}
