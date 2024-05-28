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

export interface PlayLineData {
	action: string;
	subtitles: Subtitle[];
	skipUpdates?: boolean;
	keepPauseState?: boolean;
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
