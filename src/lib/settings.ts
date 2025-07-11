export enum Action {
	NONE = 'None',
	TOGGLE_PLAYBACK = 'Toggle playback',
	REWIND = 'Rewind',
	REWIND_ALT = 'Rewind #2',
	FAST_FORWARD = 'Fast-Forward',
	FAST_FORWARD_ALT = 'Fast-Forward #2',
	PREVIOUS_SUBTITLE = 'Go to previous subtitle',
	NEXT_SUBTITLE = 'Go to next subtitle',
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
	EXPORT_NEW = 'Create new card',
	EXPORT_UPDATE = 'Update last created card',
	OPEN_LAST_EXPORTED_CARD = 'Open last exported card',
	CANCEL_EXPORT = 'Cancel Export',
}

export const defaultReaderActionList = new Map<Action, boolean>([
	[Action.COPY_SUBTITLE, true],
	[Action.TOGGLE_PLAYBACK, true],
	[Action.RESTART_PLAYBACK, true],
	[Action.TOGGLE_PLAY_PAUSE, true],
	[Action.TOGGLE_PLAYBACK_LOOP, true],
	[Action.TOGGLE_BOOKMARK, true],
	[Action.TOGGLE_SHOW_BOOKMARKED, false],
	[Action.TOGGLE_MERGE, true],
	[Action.TOGGLE_SHOW_FOR_MERGE, false],
	[Action.EDIT_SUBTITLE, true],
	[Action.RESTORE_SUBTITLE, true],
	[Action.EXPORT_NEW, true],
	[Action.EXPORT_UPDATE, true],
	[Action.OPEN_LAST_EXPORTED_CARD, true],
]);

export const defaultSubtitleActionList = new Map<Action, boolean>([
	[Action.RESTART_PLAYBACK, true],
	[Action.TOGGLE_BOOKMARK, true],
	[Action.TOGGLE_SHOW_BOOKMARKED, false],
	[Action.RESTORE_SUBTITLE, true],
	[Action.TOGGLE_PLAY_PAUSE, true],
	[Action.TOGGLE_MERGE, true],
	[Action.TOGGLE_SHOW_FOR_MERGE, false],
	[Action.EXPORT_NEW, true],
	[Action.TOGGLE_PLAYBACK_LOOP, true],
	[Action.EDIT_SUBTITLE, true],
	[Action.EXPORT_UPDATE, true],
]);

export const defaultFooterActionList = new Map<Action, boolean>([
	[Action.TOGGLE_PLAYBACK, true],
	[Action.REWIND_ALT, false],
	[Action.REWIND, false],
	[Action.FAST_FORWARD, false],
	[Action.FAST_FORWARD_ALT, false],
	[Action.PREVIOUS_SUBTITLE, false],
	[Action.NEXT_SUBTITLE, false],
	[Action.RESTART_PLAYBACK, false],
	[Action.TOGGLE_PLAY_PAUSE, false],
	[Action.TOGGLE_PLAYBACK_LOOP, false],
	[Action.TOGGLE_BOOKMARK, false],
	[Action.TOGGLE_SHOW_BOOKMARKED, false],
	[Action.TOGGLE_MERGE, false],
	[Action.TOGGLE_SHOW_FOR_MERGE, false],
	[Action.EDIT_SUBTITLE, false],
	[Action.RESTORE_SUBTITLE, false],
	[Action.COPY_SUBTITLE, false],
	[Action.EXPORT_NEW, false],
	[Action.EXPORT_UPDATE, false],
	[Action.OPEN_LAST_EXPORTED_CARD, false],
]);

export interface ActionListItem {
	action: Action;
	enabled: boolean;
}

export type Settings = {
	'ttu-whispersync-reader-line-highlight-color': string;
	'ttu-whispersync-reader-line-text-highlight-color': string;
	'ttu-whispersync-reader-enable-line-highlight': boolean;
	'ttu-whispersync-reader-enable-line-text-highlight': boolean;
	'ttu-whispersync-reader-enable-auto-reload': boolean;
	'ttu-whispersync-reader-enable-filesystem-api': boolean;
	'ttu-whispersync-reader-enable-auto-scroll': boolean;
	'ttu-whispersync-reader-enable-tracker-auto-pause': boolean;
	'ttu-whispersync-reader-prevent-action-on-selection': boolean;
	'ttu-whispersync-reader-enable-menu-target': boolean;
	'ttu-whispersync-reader-scroll-mode': ReaderScrollMode;
	'ttu-whispersync-reader-scroll-behavior': ReaderScrollBehavior;
	'ttu-whispersync-reader-click-action': Action;
	'ttu-whispersync-reader-menu-open-mode': ReaderMenuOpenMode;
	'ttu-whispersync-reader-menu-pause-mode': ReaderMenuPauseMode;
	'ttu-whispersync-reader-menu-open-time': number;
	'ttu-whispersync-subtitles-enable-persist': boolean;
	'ttu-whispersync-subtitles-enable-auto-scroll': boolean;
	'ttu-whispersync-subtitles-copy-font-family': boolean;
	'ttu-whispersync-subtitles-copy-font-size': boolean;
	'ttu-whispersync-subtitles-copy-line-height': boolean;
	'ttu-whispersync-subtitles-prevent-action-on-selection': boolean;
	'ttu-whispersync-subtitles-click-action': Action;
	'ttu-whispersync-subtitles-actions-visibility': SubtitleActionsVisibility;
	'ttu-whispersync-subtitles-actions-visibility-time': number;
	'ttu-whispersync-subtitles-global-start-padding': number;
	'ttu-whispersync-subtitles-global-end-padding': number;
	'ttu-whispersync-subtitles-font-family': string;
	'ttu-whispersync-subtitles-font-size': number;
	'ttu-whispersync-subtitles-line-height': number;
	'ttu-whispersync-player-enable-cover': boolean;
	'ttu-whispersync-player-enable-chapters': boolean;
	'ttu-whispersync-player-enable-wake-lock': boolean;
	'ttu-whispersync-player-enable-subtitle-copy': boolean;
	'ttu-whispersync-player-enable-dictionary-detection': boolean;
	'ttu-whispersync-player-auto-pause-mode': AutoPauseMode;
	'ttu-whispersync-player-rewind-time': number;
	'ttu-whispersync-player-alt-rewind-time': number;
	'ttu-whispersync-player-fast-forward-time': number;
	'ttu-whispersync-player-alt-fast-forward-time': number;
	'ttu-whispersync-player-playback-rate-decrease-time': number;
	'ttu-whispersync-player-playback-rate-increase-time': number;
	'ttu-whispersync-export-field-mode': ExportFieldMode;
	'ttu-whispersync-export-audio-processor': AudioProcessor;
	'ttu-whispersync-export-audio-format': AudioFormat;
	'ttu-whispersync-export-audio-bitrate': number;
	'ttu-whispersync-export-cover-format': ImageFormat;
	'ttu-whispersync-export-enable-merge-selection-auto-clear': boolean;
	'ttu-whispersync-enable-ffmpeg-log': boolean;
	'ttu-whispersync-anki-add-subtitle-tag': boolean;
	'ttu-whispersync-anki-add-audio-tag': boolean;
	'ttu-whispersync-anki-enable-open-in-browser': boolean;
	'ttu-whispersync-anki-allow-empty-key-field': boolean;
	'ttu-whispersync-anki-tag-list': string;
	'ttu-whispersync-anki-duplicate-mode': AnkiDuplicateMode;
	'ttu-whispersync-anki-url': string;
	'ttu-whispersync-anki-key': string;
	'ttu-whispersync-anki-deck': string;
	'ttu-whispersync-anki-update-deck': string;
	'ttu-whispersync-anki-model': string;
	'ttu-whispersync-anki-update-model': string;
	'ttu-whispersync-anki-sentence-field': string;
	'ttu-whispersync-anki-update-sentence-field': string;
	'ttu-whispersync-anki-sound-field': string;
	'ttu-whispersync-anki-update-sound-field': string;
	'ttu-whispersync-anki-cover-field': string;
	'ttu-whispersync-anki-update-cover-field': string;
	'ttu-whispersync-action-list-of-reader': ActionListItem[];
	'ttu-whispersync-action-list-of-subtitles': ActionListItem[];
	'ttu-whispersync-action-list-of-footer': ActionListItem[];
	'ttu-whispersync-keybindings-enable-time-fallback': boolean;
	'ttu-whispersync-match-line-ignore-rp': boolean;
	'ttu-whispersync-match-line-similarity-threshold': number;
	'ttu-whispersync-match-line-max-attempts': number;
};

export enum SettingsMenu {
	NONE = 'none',
	READER = 'Reader',
	SUBTITLES = 'Subtitles',
	PLAYER = 'Player',
	EXPORT = 'Export',
	ANKI = 'Anki',
	KEYBINDINGS = 'Keybindings',
	READER_ACTIONS = 'Reader actions',
	SUBTITLE_ACTIONS = 'Subtitle actions',
	FOOTER_ACTIONS = 'Footer actions',
}

export enum AnkiSettingssMode {
	CREATE = 'Create card',
	UPDATE = 'Update card',
}

export enum ReaderScrollMode {
	ALWAYS = 'Always',
	PAGE = 'Page',
}

export enum ReaderScrollBehavior {
	AUTO = 'auto',
	INSTANT = 'instant',
	SMOOTH = 'smooth',
}

export enum ReaderMenuOpenMode {
	DISABLED = 'Disabled',
	CLICK = 'On click',
	HOLD = 'On hold',
}

export enum ReaderMenuPauseMode {
	DISABLED = 'Disabled',
	PAUSE = 'Pause on open',
}

export enum SubtitleActionsVisibility {
	HIDDEN = 'Hidden',
	ALWAYS = 'Always visible',
	HOVER = 'On hover',
	TOGGLE = 'Toggle on hold',
}

export enum AutoPauseMode {
	DISABLED = 'Disabled',
	MODERATE = 'Moderate',
	STRICT = 'Strict',
}

export enum AudioProcessor {
	RECORDER = 'Recorder',
	FFMPEG = 'FFMPEG',
}

export enum AudioFormat {
	MP3 = 'mp3',
	OGG = 'ogg',
	OPUS = 'opus',
}

export enum ImageFormat {
	AUTO = 'auto',
	JPEG = 'jpeg',
	PNG = 'png',
	WEBP = 'webp',
}

export enum ExportFieldMode {
	BEFORE = 'Insert before',
	AFTER = 'Insert after',
	REPLACE = 'Replace',
}

export enum AnkiDuplicateMode {
	DISABLED = 'Disabled',
	DECK = 'Deck',
	SUBDECK = 'Deck and children',
	COLLECTION = 'Collection',
}

export function getDefaultSettings(): Settings {
	return {
		'ttu-whispersync-reader-line-highlight-color': '#fffa82',
		'ttu-whispersync-reader-line-text-highlight-color': '#000000',
		'ttu-whispersync-reader-enable-line-highlight': true,
		'ttu-whispersync-reader-enable-line-text-highlight': true,
		'ttu-whispersync-reader-enable-auto-reload': true,
		'ttu-whispersync-reader-enable-filesystem-api': true,
		'ttu-whispersync-reader-enable-auto-scroll': true,
		'ttu-whispersync-reader-enable-tracker-auto-pause': true,
		'ttu-whispersync-reader-prevent-action-on-selection': true,
		'ttu-whispersync-reader-enable-menu-target': true,
		'ttu-whispersync-reader-scroll-mode': ReaderScrollMode.ALWAYS,
		'ttu-whispersync-reader-scroll-behavior': ReaderScrollBehavior.INSTANT,
		'ttu-whispersync-reader-click-action': Action.NONE,
		'ttu-whispersync-reader-menu-open-mode': ReaderMenuOpenMode.CLICK,
		'ttu-whispersync-reader-menu-pause-mode': ReaderMenuPauseMode.PAUSE,
		'ttu-whispersync-reader-menu-open-time': 500,
		'ttu-whispersync-subtitles-enable-persist': false,
		'ttu-whispersync-subtitles-enable-auto-scroll': true,
		'ttu-whispersync-subtitles-copy-font-family': true,
		'ttu-whispersync-subtitles-copy-font-size': false,
		'ttu-whispersync-subtitles-copy-line-height': false,
		'ttu-whispersync-subtitles-prevent-action-on-selection': true,
		'ttu-whispersync-subtitles-click-action': Action.RESTART_PLAYBACK,
		'ttu-whispersync-subtitles-actions-visibility': SubtitleActionsVisibility.HOVER,
		'ttu-whispersync-subtitles-actions-visibility-time': 500,
		'ttu-whispersync-subtitles-global-start-padding': 0,
		'ttu-whispersync-subtitles-global-end-padding': 0,
		'ttu-whispersync-subtitles-font-family': 'Noto Serif JP',
		'ttu-whispersync-subtitles-font-size': 20,
		'ttu-whispersync-subtitles-line-height': 1.65,
		'ttu-whispersync-player-enable-cover': true,
		'ttu-whispersync-player-enable-chapters': true,
		'ttu-whispersync-player-enable-wake-lock': false,
		'ttu-whispersync-player-enable-subtitle-copy': false,
		'ttu-whispersync-player-enable-dictionary-detection': false,
		'ttu-whispersync-player-auto-pause-mode': AutoPauseMode.DISABLED,
		'ttu-whispersync-player-rewind-time': 5,
		'ttu-whispersync-player-alt-rewind-time': 10,
		'ttu-whispersync-player-fast-forward-time': 5,
		'ttu-whispersync-player-alt-fast-forward-time': 10,
		'ttu-whispersync-player-playback-rate-decrease-time': 0.05,
		'ttu-whispersync-player-playback-rate-increase-time': 0.05,
		'ttu-whispersync-export-field-mode': ExportFieldMode.AFTER,
		'ttu-whispersync-export-audio-processor': AudioProcessor.RECORDER,
		'ttu-whispersync-export-audio-format': AudioFormat.MP3,
		'ttu-whispersync-export-audio-bitrate': 128,
		'ttu-whispersync-export-cover-format': ImageFormat.AUTO,
		'ttu-whispersync-export-enable-merge-selection-auto-clear': false,
		'ttu-whispersync-enable-ffmpeg-log': false,
		'ttu-whispersync-anki-add-subtitle-tag': false,
		'ttu-whispersync-anki-add-audio-tag': false,
		'ttu-whispersync-anki-enable-open-in-browser': false,
		'ttu-whispersync-anki-allow-empty-key-field': false,
		'ttu-whispersync-anki-tag-list': '',
		'ttu-whispersync-anki-duplicate-mode': AnkiDuplicateMode.DISABLED,
		'ttu-whispersync-anki-url': 'http://localhost:8765',
		'ttu-whispersync-anki-key': '',
		'ttu-whispersync-anki-deck': '',
		'ttu-whispersync-anki-update-deck': '',
		'ttu-whispersync-anki-model': '',
		'ttu-whispersync-anki-update-model': '',
		'ttu-whispersync-anki-sentence-field': '',
		'ttu-whispersync-anki-update-sentence-field': '',
		'ttu-whispersync-anki-sound-field': '',
		'ttu-whispersync-anki-update-sound-field': '',
		'ttu-whispersync-anki-cover-field': '',
		'ttu-whispersync-anki-update-cover-field': '',
		'ttu-whispersync-keybindings-enable-time-fallback': false,
		'ttu-whispersync-action-list-of-reader': transformToActionList(defaultReaderActionList),
		'ttu-whispersync-action-list-of-subtitles': transformToActionList(defaultSubtitleActionList),
		'ttu-whispersync-action-list-of-footer': transformToActionList(defaultFooterActionList),
		'ttu-whispersync-match-line-ignore-rp': false,
		'ttu-whispersync-match-line-similarity-threshold': 0.9,
		'ttu-whispersync-match-line-max-attempts': 50,
	};
}

export function getDefaultSetting<T>(key: keyof Settings) {
	return defaultSettings[key] as T;
}

const defaultSettings = getDefaultSettings();

function transformToActionList(data: Map<Action, boolean>) {
	const actionList: ActionListItem[] = [];
	const entries = [...data.entries()];

	for (let index = 0, { length } = entries; index < length; index += 1) {
		const [action, enabled] = entries[index];

		actionList.push({ action, enabled });
	}

	return actionList;
}
