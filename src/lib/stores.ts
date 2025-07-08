import type { BooksDB, BooksDBData, ExtensionData } from './db';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import {
	Tabs,
	type Subtitle,
	type AudioChapter,
	createDialogsStore,
	type PlayLineData,
	type SubtitleChange,
	type ActiveSubtitle,
	type BookMatch,
} from './general';
import type { IDBPDatabase } from 'idb';
import type { MediaInfo } from 'mediainfo.js';
import type { ActionListItem, Settings } from './settings';
import { writable, type Subscriber, type Invalidator, type Unsubscriber } from 'svelte/store';
import { writableBooleanStore } from './writeables/writeable-boolean-store';
import { writableNumberStore } from './writeables/writeable-number-store';
import { writeableArrayStore } from './writeables/writeable-object-store';
import { revertWriteable } from './writeables/writeable-revert-store';
import { writableStringStore } from './writeables/writeable-string-store';

export interface SettingsStore<T> {
	subscribe: (this: void, run: Subscriber<T>, invalidate?: Invalidator<T> | undefined) => Unsubscriber;
	set: (value: T) => void;
	get: () => T;
	key: () => keyof Settings;
	reset: () => void;
}

export const isMobile$ = writable<boolean>(false);

export const filesystemApiEnabled$ = writable<boolean>(false);

export const isLoading$ = revertWriteable<boolean>(true);

export const lastError$ = revertWriteable<string>('');

export const dialogs$ = createDialogsStore();

export const skipKeyListener$ = revertWriteable<boolean>(false);

export const booksDB$ = writable<IDBPDatabase<BooksDB>>();

export const ffmpeg$ = writable<FFmpeg | undefined>();

export const mediaInfo$ = writable<MediaInfo | undefined>();

export const bookData$ = revertWriteable<BooksDBData>({ id: 0, title: '', elementHtml: '', lastBookModified: 0 });

export const bookMatched$ = revertWriteable<BookMatch>({ matchedBy: '', matchedOn: 0 });

export const extensionData$ = revertWriteable<ExtensionData>({ title: '' });

export const currentSubtitleFile$ = revertWriteable<File | undefined>();

export const currentSubtitles$ = revertWriteable<Map<string, Subtitle>>(new Map());

export const currentAudioFile$ = writable<File | undefined>();

export const currentCoverUrl$ = writable<string>('');

export const currentAudioSourceUrl$ = writable<string>('');

export const currentAudioChapters$ = writable<AudioChapter[]>([]);

export const currentAudioLoaded$ = writable<boolean>(false);

export const canExportToAnki$ = writable<boolean>(false);

export const isAnkiconnectAndroid$ = writable<boolean>(false);

export const lastExportedCardId$ = writable<number>(0);

export const exportProgress$ = revertWriteable<number>(0);

export const exportCancelController$ = revertWriteable<AbortController | undefined>();

export const isRecording$ = writable<boolean>(false);

export const togglePlaybackTitle$ = writable<string>('');

export const rewindTitle$ = writable<string>('');

export const altRewindTitle$ = writable<string>('');

export const fastForwardTitle$ = writable<string>('');

export const altFastForwardTitle$ = writable<string>('');

export const previousSubtitleTitle$ = writable<string>('');

export const nextSubtitleTitle$ = writable<string>('');

export const restartPlaybackTitle$ = writable<string>('');

export const togglePlayPauseTitle$ = writable<string>('');

export const togglePlaybackLoopTitle$ = writable<string>('');

export const toggleBookmarkTitle$ = writable<string>('');

export const toggleShowBookmarkedSubtitlesTitle$ = writable<string>('');

export const toggleMergeTitle$ = writable<string>('');

export const toggleShowSubtitlesForMergeTitle$ = writable<string>('');

export const editSubtitleTitle$ = writable<string>('');

export const restoreSubtitleTitle$ = writable<string>('');

export const exportNewTitle$ = writable<string>('');

export const exportUpdateTitle$ = writable<string>('');

export const openLastExportedCardTitle$ = writable<string>('');

export const exportCancelTitle$ = writable<string>('');

export const currentMenuPosition$ = writableStringStore()('ttu-whispersync-menu-position', 'left');

export const hideFooterActions$ = writableBooleanStore()('ttu-whispersync-hide-footer-actions', false);

export const currentTab$ = revertWriteable<Tabs>(Tabs.AUDIOBOOK);

export const showBookmarkedSubtitlesOnly$ = writable<boolean>(false);

export const bookmarkedSubtitles$ = revertWriteable<Set<string>>(new Set<string>());

export const showSubtitlesForMergeOnly$ = writable<boolean>(false);

export const subtitlesForMerge$ = revertWriteable<Set<string>>(new Set<string>());

export const activeSubtitle$ = revertWriteable<ActiveSubtitle>({ previous: '', current: '', useTimeFallback: true });

export const readerActionSubtitle$ = revertWriteable<Subtitle | undefined>();

export const paused$ = revertWriteable<boolean>(true);

export const currentTime$ = revertWriteable<number>(0);

export const duration$ = revertWriteable<number>(0);

export const muted$ = revertWriteable<boolean>(false);

export const playbackRate$ = writableNumberStore()('ttu-whispersync-player-playback-rate', 1);

export const playLine$ = revertWriteable<PlayLineData>();

export const subtitleChange$ = revertWriteable<SubtitleChange>();

export const settings$ = {
	readerLineHighlightColor$: writableStringStore()('ttu-whispersync-reader-line-highlight-color'),
	readerLineTextHighlightColor$: writableStringStore()('ttu-whispersync-reader-line-text-highlight-color'),
	readerEnableLineHighlight$: writableBooleanStore()('ttu-whispersync-reader-enable-line-highlight'),
	readerEnableLineTextHighlight$: writableBooleanStore()('ttu-whispersync-reader-enable-line-text-highlight'),
	readerEnableAutoReload$: writableBooleanStore()('ttu-whispersync-reader-enable-auto-reload'),
	readerEnableFilesystemApi$: writableBooleanStore()('ttu-whispersync-reader-enable-filesystem-api'),
	readerEnableAutoScroll$: writableBooleanStore()('ttu-whispersync-reader-enable-auto-scroll'),
	readerEnableTrackerAutoPause$: writableBooleanStore()('ttu-whispersync-reader-enable-tracker-auto-pause'),
	readerPreventActionOnSelection$: writableBooleanStore()('ttu-whispersync-reader-prevent-action-on-selection'),
	readerEnableMenuTarget$: writableBooleanStore()('ttu-whispersync-reader-enable-menu-target'),
	readerScrollMode$: writableStringStore()('ttu-whispersync-reader-scroll-mode'),
	readerScrollBehavior$: writableStringStore()('ttu-whispersync-reader-scroll-behavior'),
	readerClickAction$: writableStringStore()('ttu-whispersync-reader-click-action'),
	readerMenuOpenMode$: writableStringStore()('ttu-whispersync-reader-menu-open-mode'),
	readerMenuPauseMode$: writableStringStore()('ttu-whispersync-reader-menu-pause-mode'),
	readerMenuOpenTime$: writableNumberStore()('ttu-whispersync-reader-menu-open-time'),
	readerTrackerPauseThreshold$: writableNumberStore()('ttu-whispersync-reader-tracker-pause-threshold'),
	subtitlesEnablePersist$: writableBooleanStore()('ttu-whispersync-subtitles-enable-persist'),
	subtitlesEnableAutoScroll$: writableBooleanStore()('ttu-whispersync-subtitles-enable-auto-scroll'),
	subtitlesCopyFontFamily$: writableBooleanStore()('ttu-whispersync-subtitles-copy-font-family'),
	subtitlesCopyFontSize$: writableBooleanStore()('ttu-whispersync-subtitles-copy-font-size'),
	subtitlesCopyLineHeight$: writableBooleanStore()('ttu-whispersync-subtitles-copy-line-height'),
	subtitlePreventActionOnSelection$: writableBooleanStore()('ttu-whispersync-subtitles-prevent-action-on-selection'),
	subtitlesClickAction$: writableStringStore()('ttu-whispersync-subtitles-click-action'),
	subtitlesActionsVisibility$: writableStringStore()('ttu-whispersync-subtitles-actions-visibility'),
	subtitlesActionsVisibilityTime$: writableNumberStore()('ttu-whispersync-subtitles-actions-visibility-time'),
	subtitlesGlobalStartPadding$: writableNumberStore()('ttu-whispersync-subtitles-global-start-padding'),
	subtitlesGlobalEndPadding$: writableNumberStore()('ttu-whispersync-subtitles-global-end-padding'),
	subtitlesFontFamily$: writableStringStore()('ttu-whispersync-subtitles-font-family'),
	subtitlesFontSize$: writableNumberStore()('ttu-whispersync-subtitles-font-size'),
	subtitlesLineHeight$: writableNumberStore()('ttu-whispersync-subtitles-line-height'),
	playerEnableCover$: writableBooleanStore()('ttu-whispersync-player-enable-cover'),
	playerEnableChapters$: writableBooleanStore()('ttu-whispersync-player-enable-chapters'),
	playerEnableWakeLock$: writableBooleanStore()('ttu-whispersync-player-enable-wake-lock'),
	playerEnableSubtitleCopy$: writableBooleanStore()('ttu-whispersync-player-enable-subtitle-copy'),
	playerEnableDictionaryDetection$: writableBooleanStore()('ttu-whispersync-player-enable-dictionary-detection'),
	playerAutoPauseMode$: writableStringStore()('ttu-whispersync-player-auto-pause-mode'),
	playerRewindTime$: writableNumberStore()('ttu-whispersync-player-rewind-time'),
	playerAltRewindTime$: writableNumberStore()('ttu-whispersync-player-alt-rewind-time'),
	playerFastForwardTime$: writableNumberStore()('ttu-whispersync-player-fast-forward-time'),
	playerAltFastForwardTime$: writableNumberStore()('ttu-whispersync-player-alt-fast-forward-time'),
	playerPlaybackRateDecreaseTime$: writableNumberStore()('ttu-whispersync-player-playback-rate-decrease-time'),
	playerPlaybackRateIncreaseTime$: writableNumberStore()('ttu-whispersync-player-playback-rate-increase-time'),
	exportFieldMode$: writableStringStore()('ttu-whispersync-export-field-mode'),
	exportAudioProcessor$: writableStringStore()('ttu-whispersync-export-audio-processor'),
	exportAudioFormat$: writableStringStore()('ttu-whispersync-export-audio-format'),
	exportAudioBitrate$: writableNumberStore()('ttu-whispersync-export-audio-bitrate'),
	exportCoverFormat$: writableStringStore()('ttu-whispersync-export-cover-format'),
	exportEnableMergeSelectionAutoClear$: writableBooleanStore()(
		'ttu-whispersync-export-enable-merge-selection-auto-clear',
	),
	enableFFMPEGLog$: writableBooleanStore()('ttu-whispersync-enable-ffmpeg-log'),
	ankiAddSubtitleTag$: writableBooleanStore()('ttu-whispersync-anki-add-subtitle-tag'),
	ankiAddAudioTag$: writableBooleanStore()('ttu-whispersync-anki-add-audio-tag'),
	ankiAllowEmptyKeyField$: writableBooleanStore()('ttu-whispersync-anki-allow-empty-key-field'),
	ankiTagList$: writableStringStore()('ttu-whispersync-anki-tag-list'),
	ankiDuplicateMode$: writableStringStore()('ttu-whispersync-anki-duplicate-mode'),
	ankiUrl$: writableStringStore()('ttu-whispersync-anki-url'),
	ankiKey$: writableStringStore()('ttu-whispersync-anki-key'),
	ankiDeck$: writableStringStore()('ttu-whispersync-anki-deck'),
	ankiUpdateDeck$: writableStringStore()('ttu-whispersync-anki-update-deck'),
	ankiModel$: writableStringStore()('ttu-whispersync-anki-model'),
	ankiUpdateModel$: writableStringStore()('ttu-whispersync-anki-update-model'),
	ankiSentenceField$: writableStringStore()('ttu-whispersync-anki-sentence-field'),
	ankiUpdateSentenceField$: writableStringStore()('ttu-whispersync-anki-update-sentence-field'),
	ankiSoundField$: writableStringStore()('ttu-whispersync-anki-sound-field'),
	ankiUpdateSoundField$: writableStringStore()('ttu-whispersync-anki-update-sound-field'),
	ankiCoverField$: writableStringStore()('ttu-whispersync-anki-cover-field'),
	ankiUpdateCoverField$: writableStringStore()('ttu-whispersync-anki-update-cover-field'),
	ankiEnableOpenInBrowser$: writableBooleanStore()('ttu-whispersync-anki-enable-open-in-browser'),
	actionListOfReader$: writeableArrayStore<ActionListItem>()('ttu-whispersync-action-list-of-reader'),
	actionListOfSubtitles$: writeableArrayStore<ActionListItem>()('ttu-whispersync-action-list-of-subtitles'),
	actionListOfFooter$: writeableArrayStore<ActionListItem>()('ttu-whispersync-action-list-of-footer'),
	keybindingsEnableTimeFallback$: writableBooleanStore()('ttu-whispersync-keybindings-enable-time-fallback'),
	matchLineIgnoreRp$: writableBooleanStore()('ttu-whispersync-match-line-ignore-rp'),
	matchLineSimilarityThreshold$: writableNumberStore()('ttu-whispersync-match-line-similarity-threshold'),
	matchLineMaxAttempts$: writableNumberStore()('ttu-whispersync-match-line-max-attempts'),
};
