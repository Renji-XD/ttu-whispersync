enum Action {
	NONE = 'None',
	RESTART_PLAYBACK = 'Restart playback',
	TOGGLE_PLAY_PAUSE = 'Toggle play and pause',
	TOGGLE_PLAYBACK_LOOP = 'Toggle playback loop',
	TOGGLE_BOOKMARK = 'Toggle bookmark',
	TOGGLE_MERGE = 'Toggle for merge',
	ALIGN_SUBTITLE = 'Align with book text',
	EDIT_SUBTITLE = 'Edit subtitle',
	RESTORE_SUBTITLE = 'Restore original text and time',
	EXPORT_NEW = 'Create new card',
	EXPORT_UPDATE = 'Update last card',
	CANCEL_EXPORT = 'Cancel export',
}

const defaultSettings = getDefaultSettings();

export type Settings = {
	'ttu-whispersync-reader-line-highlight-color': string;
	'ttu-whispersync-reader-line-text-highlight-color': string;
	'ttu-whispersync-reader-enable-line-highlight': boolean;
	'ttu-whispersync-reader-enable-auto-reload': boolean;
	'ttu-whispersync-reader-enable-auto-scroll': boolean;
	'ttu-whispersync-reader-enable-tracker-auto-pause': boolean;
	'ttu-whispersync-reader-prevent-action-on-selection': boolean;
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
	'ttu-whispersync-player-enable-dictionary-detection': boolean;
	'ttu-whispersync-player-auto-pause-mode': AutoPauseMode;
	'ttu-whispersync-player-rewind-time': number;
	'ttu-whispersync-player-alt-rewind-time': number;
	'ttu-whispersync-player-fast-forward-time': number;
	'ttu-whispersync-player-alt-fast-forward-time': number;
	'ttu-whispersync-export-field-mode': ExportFieldMode;
	'ttu-whispersync-export-audio-processor': AudioProcessor;
	'ttu-whispersync-export-audio-format': AudioFormat;
	'ttu-whispersync-export-audio-bitrate': number;
	'ttu-whispersync-enable-ffmpeg-log': boolean;
	'ttu-whispersync-anki-add-subtitle-tag': boolean;
	'ttu-whispersync-anki-add-audio-tag': boolean;
	'ttu-whispersync-anki-tag-list': string;
	'ttu-whispersync-anki-duplicate-mode': AnkiDuplicateMode;
	'ttu-whispersync-anki-url': string;
	'ttu-whispersync-anki-key': string;
	'ttu-whispersync-anki-deck': string;
	'ttu-whispersync-anki-model': string;
	'ttu-whispersync-anki-sentence-field': string;
	'ttu-whispersync-anki-sound-field': string;
	'ttu-whispersync-match-line-ignore-rp': boolean;
	'ttu-whispersync-match-line-space-mode': string;
	'ttu-whispersync-match-line-lookahead': number;
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
}

export enum ReaderMenuPauseMode {
	DISABLED = 'Disabled',
	PAUSE = 'Pause on open',
}

export enum ReaderMenuOpenMode {
	DISABLED = 'Disabled',
	CLICK = 'On click',
	HOLD = 'On hold',
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

export enum MatchSpaceMode {
	ORIGINAL = 'Original',
	LEADING_TRAILING = 'Leading/Trailing removed',
	ALL = 'All removed',
}

export function getDefaultSettings(): Settings {
	return {
		'ttu-whispersync-reader-line-highlight-color': '#fffa82',
		'ttu-whispersync-reader-line-text-highlight-color': '#000000',
		'ttu-whispersync-reader-enable-line-highlight': true,
		'ttu-whispersync-reader-enable-auto-reload': true,
		'ttu-whispersync-reader-enable-auto-scroll': true,
		'ttu-whispersync-reader-enable-tracker-auto-pause': true,
		'ttu-whispersync-reader-prevent-action-on-selection': true,
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
		'ttu-whispersync-player-enable-dictionary-detection': false,
		'ttu-whispersync-player-auto-pause-mode': AutoPauseMode.DISABLED,
		'ttu-whispersync-player-rewind-time': 5,
		'ttu-whispersync-player-alt-rewind-time': 10,
		'ttu-whispersync-player-fast-forward-time': 5,
		'ttu-whispersync-player-alt-fast-forward-time': 10,
		'ttu-whispersync-export-field-mode': ExportFieldMode.AFTER,
		'ttu-whispersync-export-audio-processor': AudioProcessor.RECORDER,
		'ttu-whispersync-export-audio-format': AudioFormat.MP3,
		'ttu-whispersync-export-audio-bitrate': 128,
		'ttu-whispersync-enable-ffmpeg-log': false,
		'ttu-whispersync-anki-add-subtitle-tag': false,
		'ttu-whispersync-anki-add-audio-tag': false,
		'ttu-whispersync-anki-tag-list': '',
		'ttu-whispersync-anki-duplicate-mode': AnkiDuplicateMode.DISABLED,
		'ttu-whispersync-anki-url': 'http://localhost:8765',
		'ttu-whispersync-anki-key': '',
		'ttu-whispersync-anki-deck': '',
		'ttu-whispersync-anki-model': '',
		'ttu-whispersync-anki-sentence-field': '',
		'ttu-whispersync-anki-sound-field': '',
		'ttu-whispersync-match-line-ignore-rp': false,
		'ttu-whispersync-match-line-space-mode': MatchSpaceMode.ORIGINAL,
		'ttu-whispersync-match-line-lookahead': 5,
		'ttu-whispersync-match-line-similarity-threshold': 0.6,
		'ttu-whispersync-match-line-max-attempts': 30,
	};
}

export function getDefaultSetting<T>(key: keyof Settings) {
	return defaultSettings[key] as T;
}
