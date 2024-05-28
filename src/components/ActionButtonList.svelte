<script lang="ts">
	import ActionButton from './ActionButton.svelte';
	import { Action } from '../lib/actions';
	import type { Context, Subtitle } from '../lib/general';
	import {
		bookmarkedSubtitles$,
		currentSubtitles$,
		duration$,
		editSubtitleTitle$,
		exportCancelController$,
		exportCancelTitle$,
		exportNewTitle$,
		exportUpdateTitle$,
		restartPlaybackTitle$,
		restoreSubtitleTitle$,
		settings$,
		subtitlesForMerge$,
		toggleBookmarkTitle$,
		toggleMergeTitle$,
		togglePlayPauseTitle$,
		togglePlaybackLoopTitle$,
	} from '../lib/stores';
	import { between } from '../lib/util';
	import {
		mdiCancel,
		mdiClockEdit,
		mdiDatabasePlus,
		mdiDatabaseSync,
		mdiPlayPause,
		mdiPlaylistPlay,
		mdiRefresh,
		mdiRestore,
		mdiSelect,
		mdiSelectRemove,
		mdiStar,
		mdiStarOutline,
	} from '@mdi/js';
	import { getContext } from 'svelte';

	export let subtitle: Subtitle | undefined;
	export let isReaderMenu: boolean = false;

	const { isVertical } = getContext<Context>('context');
	const { subtitlesGlobalStartPadding$, subtitlesGlobalEndPadding$ } = settings$;

	$: bookmarkPath = subtitle && $bookmarkedSubtitles$.has(subtitle.id) ? mdiStar : mdiStarOutline;

	$: mergePath = subtitle && $subtitlesForMerge$.has(subtitle.id) ? mdiSelectRemove : mdiSelect;

	function getFinalTitle(title: string, currentSubtitles: Map<string, Subtitle>, _: Subtitle | undefined) {
		if (!currentSubtitles.size) {
			return 'Subtitle file required';
		} else if (!subtitle) {
			return 'No matching subtitle';
		} else if (title === $restoreSubtitleTitle$) {
			const subtitlesGlobalStartPadding = $subtitlesGlobalStartPadding$ / 1000;
			const subtitlesGlobalEndPadding = $subtitlesGlobalEndPadding$ / 1000;
			const startSeconds = Math.max(0, subtitle.originalStartSeconds + subtitlesGlobalStartPadding);
			const endSeconds = $duration$
				? between(0, $duration$, subtitle.originalEndSeconds + subtitlesGlobalEndPadding)
				: Math.max(0, subtitle.originalEndSeconds + subtitlesGlobalEndPadding);

			return subtitle.text !== subtitle.originalText ||
				(Number.isFinite(subtitle.adjustedStartSeconds) && subtitle.adjustedStartSeconds !== startSeconds) ||
				(Number.isFinite(subtitle.adjustedEndSeconds) && subtitle.adjustedEndSeconds !== endSeconds)
				? title
				: 'No data to restore';
		}

		return title;
	}
</script>

{#if isReaderMenu}
	<ActionButton
		title={getFinalTitle($restartPlaybackTitle$, $currentSubtitles$, subtitle)}
		action={Action.RESTART_PLAYBACK}
		path={mdiPlaylistPlay}
		buttonClasses={isVertical ? 'm-y-xs' : 'm-x-xs'}
		{subtitle}
	/>
	<ActionButton
		title={getFinalTitle($togglePlayPauseTitle$, $currentSubtitles$, subtitle)}
		action={Action.TOGGLE_PLAY_PAUSE}
		path={mdiPlayPause}
		buttonClasses={isVertical ? 'm-y-xs' : 'm-x-xs'}
		{subtitle}
	/>
	<ActionButton
		title={getFinalTitle($togglePlaybackLoopTitle$, $currentSubtitles$, subtitle)}
		action={Action.TOGGLE_PLAYBACK_LOOP}
		path={mdiRefresh}
		buttonClasses={isVertical ? 'm-y-xs' : 'm-x-xs'}
		{subtitle}
	/>
	<ActionButton
		title={getFinalTitle($toggleBookmarkTitle$, $currentSubtitles$, subtitle)}
		action={Action.TOGGLE_BOOKMARK}
		path={bookmarkPath}
		buttonClasses={isVertical ? 'm-y-xs' : 'm-x-xs'}
		{subtitle}
	/>
	<ActionButton
		title={getFinalTitle($toggleMergeTitle$, $currentSubtitles$, subtitle)}
		action={Action.TOGGLE_MERGE}
		path={mergePath}
		buttonClasses={isVertical ? 'm-y-xs' : 'm-x-xs'}
		{subtitle}
	/>
	<ActionButton
		title={getFinalTitle($editSubtitleTitle$, $currentSubtitles$, subtitle)}
		action={Action.EDIT_SUBTITLE}
		path={mdiClockEdit}
		buttonClasses={isVertical ? 'm-y-xs' : 'm-x-xs'}
		{subtitle}
	/>
	<ActionButton
		title={getFinalTitle($restoreSubtitleTitle$, $currentSubtitles$, subtitle)}
		action={Action.RESTORE_SUBTITLE}
		path={mdiRestore}
		buttonClasses={isVertical ? 'm-y-xs' : 'm-x-xs'}
		{subtitle}
	/>
	<ActionButton
		title={getFinalTitle($exportNewTitle$, $currentSubtitles$, subtitle)}
		action={Action.EXPORT_NEW}
		path={mdiDatabasePlus}
		buttonClasses={isVertical ? 'm-y-xs' : 'm-x-xs'}
		{subtitle}
	/>
	<ActionButton
		title={getFinalTitle($exportUpdateTitle$, $currentSubtitles$, subtitle)}
		action={Action.EXPORT_UPDATE}
		path={mdiDatabaseSync}
		buttonClasses={isVertical ? 'm-y-xs' : 'm-x-xs'}
		{subtitle}
	/>
	{#if $exportCancelController$}
		<ActionButton
			title={$exportCancelTitle$}
			action={Action.CANCEL_EXPORT}
			path={mdiCancel}
			buttonClasses={isVertical ? 'm-y-xs' : 'm-x-xs'}
			{subtitle}
		/>
	{/if}
{:else}
	<div class="flex flex-col">
		<ActionButton
			title={getFinalTitle($restartPlaybackTitle$, $currentSubtitles$, subtitle)}
			action={Action.RESTART_PLAYBACK}
			path={mdiPlaylistPlay}
			{subtitle}
		/>
		<ActionButton
			buttonClasses="m-t-xs"
			title={getFinalTitle($togglePlayPauseTitle$, $currentSubtitles$, subtitle)}
			action={Action.TOGGLE_PLAY_PAUSE}
			path={mdiPlayPause}
			{subtitle}
		/>
		<ActionButton
			buttonClasses="m-t-xs"
			title={getFinalTitle($togglePlaybackLoopTitle$, $currentSubtitles$, subtitle)}
			action={Action.TOGGLE_PLAYBACK_LOOP}
			path={mdiRefresh}
			{subtitle}
		/>
	</div>
	<div class="flex flex-col">
		<ActionButton
			title={getFinalTitle($toggleBookmarkTitle$, $currentSubtitles$, subtitle)}
			action={Action.TOGGLE_BOOKMARK}
			path={bookmarkPath}
			{subtitle}
		/>
		<ActionButton
			buttonClasses="m-t-xs"
			title={getFinalTitle($toggleMergeTitle$, $currentSubtitles$, subtitle)}
			action={Action.TOGGLE_MERGE}
			path={mergePath}
			{subtitle}
		/>
		<ActionButton
			buttonClasses="m-t-xs"
			title={getFinalTitle($editSubtitleTitle$, $currentSubtitles$, subtitle)}
			action={Action.EDIT_SUBTITLE}
			path={mdiClockEdit}
			{subtitle}
		/>
	</div>
	<div class="flex flex-col">
		<ActionButton
			title={getFinalTitle($restoreSubtitleTitle$, $currentSubtitles$, subtitle)}
			action={Action.RESTORE_SUBTITLE}
			path={mdiRestore}
			{subtitle}
		/>
		<ActionButton
			buttonClasses="m-t-xs"
			title={getFinalTitle($exportNewTitle$, $currentSubtitles$, subtitle)}
			action={Action.EXPORT_NEW}
			path={mdiDatabasePlus}
			{subtitle}
		/>
		<ActionButton
			buttonClasses="m-t-xs"
			title={getFinalTitle($exportUpdateTitle$, $currentSubtitles$, subtitle)}
			action={Action.EXPORT_UPDATE}
			path={mdiDatabaseSync}
			{subtitle}
		/>
	</div>
{/if}
