<script lang="ts">
	import ActionButton from './ActionButton.svelte';
	import { Action } from '../lib/actions';
	import { getDummySubtitle, type Context, type Subtitle } from '../lib/general';
	import {
		bookmarkedSubtitles$,
		duration$,
		editSubtitleTitle$,
		exportCancelController$,
		exportCancelTitle$,
		exportNewTitle$,
		exportUpdateTitle$,
		isRecording$,
		paused$,
		restartPlaybackTitle$,
		restoreSubtitleTitle$,
		settings$,
		subtitlesForMerge$,
		toggleBookmarkTitle$,
		toggleMergeTitle$,
		togglePlayPauseTitle$,
		togglePlaybackLoopTitle$,
		togglePlaybackTitle$,
	} from '../lib/stores';
	import { between } from '../lib/util';
	import {
		mdiCancel,
		mdiClockEdit,
		mdiContentCopy,
		mdiDatabasePlus,
		mdiDatabaseSync,
		mdiPause,
		mdiPauseCircleOutline,
		mdiPlay,
		mdiPlayCircleOutline,
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
	export let footerActions = new Set<string>();
	export let showCancelFooterAction = false;
	export let isReaderMenu = false;
	export let skipUpdates = false;

	const { isVertical } = getContext<Context>('context');
	const { subtitlesGlobalStartPadding$, subtitlesGlobalEndPadding$ } = settings$;

	$: bookmarkPath = subtitle && $bookmarkedSubtitles$.has(subtitle.id) ? mdiStar : mdiStarOutline;

	$: mergePath = subtitle && $subtitlesForMerge$.has(subtitle.id) ? mdiSelectRemove : mdiSelect;

	function getActionButtonProps(
		action: Action,
		title: string,
		path: string,
		referenceSubtitle: Subtitle | undefined,
	) {
		let initialTitle = referenceSubtitle ? '' : 'No matching subtitle';

		if (title === $restoreSubtitleTitle$ && referenceSubtitle) {
			const subtitlesGlobalStartPadding = $subtitlesGlobalStartPadding$ / 1000;
			const subtitlesGlobalEndPadding = $subtitlesGlobalEndPadding$ / 1000;
			const startSeconds = Math.max(0, referenceSubtitle.originalStartSeconds + subtitlesGlobalStartPadding);
			const endSeconds = $duration$
				? between(0, $duration$, referenceSubtitle.originalEndSeconds + subtitlesGlobalEndPadding)
				: Math.max(0, referenceSubtitle.originalEndSeconds + subtitlesGlobalEndPadding);

			initialTitle =
				referenceSubtitle.text !== referenceSubtitle.originalText ||
				(Number.isFinite(referenceSubtitle.adjustedStartSeconds) &&
					referenceSubtitle.adjustedStartSeconds !== startSeconds) ||
				(Number.isFinite(referenceSubtitle.adjustedEndSeconds) &&
					referenceSubtitle.adjustedEndSeconds !== endSeconds)
					? title
					: 'No data to restore';
		}

		const finalTitle = action === title ? initialTitle || title : title;
		const isDisabled = finalTitle !== action;

		return {
			path,
			action,
			title: finalTitle,
			subtitle: referenceSubtitle,
			buttonStyles: footerActions.size ? `margin-left: 0.5rem;${isDisabled ? 'opacity: 0.4;' : ''}` : '',
			iconStyles: footerActions.size && isDisabled ? 'cursor: not-allowed;' : '',
		};
	}
</script>

{#if isReaderMenu}
	<ActionButton
		path={mdiContentCopy}
		title={Action.COPY_SUBTITLE}
		action={Action.COPY_SUBTITLE}
		buttonClasses={isVertical ? 'p-t-xs p-b-s' : 'p-l-xs p-r-s'}
		{subtitle}
		on:executed
	/>
	<ActionButton
		{...getActionButtonProps(
			Action.TOGGLE_PLAYBACK,
			$togglePlaybackTitle$,
			$isRecording$ || $paused$ ? mdiPlay : mdiPause,
			getDummySubtitle(0),
		)}
		buttonClasses={isVertical ? 'p-t-xs separator-y' : 'p-l-xs p-r-s separator-x'}
	/>
	<ActionButton
		{...getActionButtonProps(Action.RESTART_PLAYBACK, $restartPlaybackTitle$, mdiPlaylistPlay, subtitle)}
		buttonClasses={isVertical ? 'p-t-xs p-b-s' : 'p-l-xs p-r-s'}
	/>
	<ActionButton
		{...getActionButtonProps(Action.TOGGLE_PLAY_PAUSE, $togglePlayPauseTitle$, mdiPlayPause, subtitle)}
		buttonClasses={isVertical ? 'p-b-xs separator-y' : 'p-r-xs separator-x'}
	/>
	<ActionButton
		{...getActionButtonProps(Action.TOGGLE_PLAYBACK_LOOP, $togglePlaybackLoopTitle$, mdiRefresh, subtitle)}
		buttonClasses={isVertical ? 'p-t-xs p-b-s' : 'p-l-xs p-r-s'}
	/>
	<ActionButton
		{...getActionButtonProps(Action.TOGGLE_BOOKMARK, $toggleBookmarkTitle$, bookmarkPath, subtitle)}
		buttonClasses={isVertical ? 'p-b-xs separator-y' : 'p-r-xs separator-x'}
		{subtitle}
	/>
	<ActionButton
		{...getActionButtonProps(Action.TOGGLE_MERGE, $toggleMergeTitle$, mergePath, subtitle)}
		buttonClasses={isVertical ? 'p-t-xs p-b-s' : 'p-l-xs p-r-s'}
	/>
	<ActionButton
		{...getActionButtonProps(Action.EDIT_SUBTITLE, $editSubtitleTitle$, mdiClockEdit, subtitle)}
		buttonClasses={isVertical ? 'p-b-xs separator-y' : 'p-r-xs separator-x-row'}
	/>
	<ActionButton
		{...getActionButtonProps(Action.RESTORE_SUBTITLE, $restoreSubtitleTitle$, mdiRestore, subtitle)}
		buttonClasses={isVertical ? 'p-t-xs p-b-s' : 'p-l-xs p-r-s'}
	/>
	<ActionButton
		{...getActionButtonProps(Action.EXPORT_NEW, $exportNewTitle$, mdiDatabasePlus, subtitle)}
		buttonClasses={isVertical ? 'p-b-xs separator-y' : 'p-r-xs separator-x'}
	/>
	<ActionButton
		{...getActionButtonProps(Action.EXPORT_UPDATE, $exportUpdateTitle$, mdiDatabaseSync, subtitle)}
		buttonClasses={isVertical ? 'p-t-xs p-b-s' : 'p-l-xs p-r-s'}
	/>
	{#if $exportCancelController$}
		<ActionButton
			{...getActionButtonProps(Action.CANCEL_EXPORT, $exportCancelTitle$, mdiCancel, getDummySubtitle(0))}
			buttonClasses={isVertical ? 'p-t-xs p-b-s' : 'p-l-xs p-r-s'}
		/>
	{/if}
{:else if footerActions.size}
	{#if footerActions.has(Action.TOGGLE_PLAYBACK)}
		<ActionButton
			{...getActionButtonProps(
				Action.TOGGLE_PLAYBACK,
				$togglePlaybackTitle$,
				$isRecording$ || $paused$ ? mdiPlayCircleOutline : mdiPauseCircleOutline,
				getDummySubtitle(0),
			)}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
	{#if footerActions.has(Action.RESTART_PLAYBACK)}
		<ActionButton
			{...getActionButtonProps(Action.RESTART_PLAYBACK, $restartPlaybackTitle$, mdiPlaylistPlay, subtitle)}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
	{#if footerActions.has(Action.TOGGLE_PLAY_PAUSE)}
		<ActionButton
			{...getActionButtonProps(Action.TOGGLE_PLAY_PAUSE, $togglePlayPauseTitle$, mdiPlayPause, subtitle)}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
	{#if footerActions.has(Action.TOGGLE_PLAYBACK_LOOP)}
		<ActionButton
			{...getActionButtonProps(Action.TOGGLE_PLAYBACK_LOOP, $togglePlaybackLoopTitle$, mdiRefresh, subtitle)}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
	{#if footerActions.has(Action.TOGGLE_BOOKMARK)}
		<ActionButton
			{...getActionButtonProps(Action.TOGGLE_BOOKMARK, $toggleBookmarkTitle$, bookmarkPath, subtitle)}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
	{#if footerActions.has(Action.TOGGLE_MERGE)}
		<ActionButton
			{...getActionButtonProps(Action.TOGGLE_MERGE, $toggleMergeTitle$, mergePath, subtitle)}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
	{#if footerActions.has(Action.EDIT_SUBTITLE)}
		<ActionButton
			{...getActionButtonProps(Action.EDIT_SUBTITLE, $editSubtitleTitle$, mdiClockEdit, subtitle)}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
	{#if footerActions.has(Action.RESTORE_SUBTITLE)}
		<ActionButton
			{...getActionButtonProps(Action.RESTORE_SUBTITLE, $restoreSubtitleTitle$, mdiRestore, subtitle)}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
	{#if footerActions.has(Action.COPY_SUBTITLE)}
		<ActionButton
			{...getActionButtonProps(Action.COPY_SUBTITLE, Action.COPY_SUBTITLE, mdiContentCopy, subtitle)}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
	{#if footerActions.has(Action.EXPORT_NEW)}
		<ActionButton
			{...getActionButtonProps(Action.EXPORT_NEW, $exportNewTitle$, mdiDatabasePlus, subtitle)}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
	{#if footerActions.has(Action.EXPORT_UPDATE)}
		<ActionButton
			{...getActionButtonProps(Action.EXPORT_UPDATE, $exportUpdateTitle$, mdiDatabaseSync, subtitle)}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
	{#if showCancelFooterAction}
		<ActionButton
			{...getActionButtonProps(Action.CANCEL_EXPORT, $exportCancelTitle$, mdiCancel, getDummySubtitle(0))}
			buttonClasses={'h-full hover:opacity-70'}
		/>
	{/if}
{:else}
	<div class="flex flex-col">
		<ActionButton
			{skipUpdates}
			{...getActionButtonProps(Action.RESTART_PLAYBACK, $restartPlaybackTitle$, mdiPlaylistPlay, subtitle)}
		/>
		<ActionButton
			{skipUpdates}
			{...getActionButtonProps(Action.TOGGLE_PLAY_PAUSE, $togglePlayPauseTitle$, mdiPlayPause, subtitle)}
			buttonClasses="m-t-xs"
		/>
		<ActionButton
			{skipUpdates}
			{...getActionButtonProps(Action.TOGGLE_PLAYBACK_LOOP, $togglePlaybackLoopTitle$, mdiRefresh, subtitle)}
			buttonClasses="m-t-xs"
		/>
	</div>
	<div class="flex flex-col">
		<ActionButton
			{...getActionButtonProps(Action.TOGGLE_BOOKMARK, $toggleBookmarkTitle$, bookmarkPath, subtitle)}
		/>
		<ActionButton
			{...getActionButtonProps(Action.TOGGLE_MERGE, $toggleMergeTitle$, mergePath, subtitle)}
			buttonClasses="m-t-xs"
		/>
		<ActionButton
			{...getActionButtonProps(Action.EDIT_SUBTITLE, $editSubtitleTitle$, mdiClockEdit, subtitle)}
			buttonClasses="m-t-xs"
		/>
	</div>
	<div class="flex flex-col">
		<ActionButton
			{...getActionButtonProps(Action.RESTORE_SUBTITLE, $restoreSubtitleTitle$, mdiRestore, subtitle)}
		/>
		<ActionButton
			{...getActionButtonProps(Action.EXPORT_NEW, $exportNewTitle$, mdiDatabasePlus, subtitle)}
			buttonClasses="m-t-xs"
		/>
		<ActionButton
			{...getActionButtonProps(Action.EXPORT_UPDATE, $exportUpdateTitle$, mdiDatabaseSync, subtitle)}
			buttonClasses="m-t-xs"
		/>
	</div>
{/if}
