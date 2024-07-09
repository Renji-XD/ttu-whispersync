<script lang="ts">
	import ActionButton from './ActionButton.svelte';
	import { Action } from '../lib/actions';
	import { getDummySubtitle, type Subtitle } from '../lib/general';
	import type { ActionListItem } from '../lib/settings';
	import {
		bookmarkedSubtitles$,
		duration$,
		editSubtitleTitle$,
		exportCancelController$,
		exportCancelTitle$,
		exportNewTitle$,
		exportUpdateTitle$,
		isRecording$,
		nextSubtitleTitle$,
		openLastExportedCardTitle$,
		paused$,
		previousSubtitleTitle$,
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
		mdiOpenInApp,
		mdiPageNextOutline,
		mdiPagePreviousOutline,
		mdiPauseCircleOutline,
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

	export let listItems: ActionListItem[];
	export let subtitle: Subtitle | undefined;
	export let hideCancelAction = false;
	export let skipUpdates = false;
	export let isFooter = false;

	export let buttonClasses = '';

	const { subtitlesGlobalStartPadding$, subtitlesGlobalEndPadding$ } = settings$;

	$: bookmarkPath = subtitle && $bookmarkedSubtitles$.has(subtitle.id) ? mdiStar : mdiStarOutline;

	$: mergePath = subtitle && $subtitlesForMerge$.has(subtitle.id) ? mdiSelectRemove : mdiSelect;

	$: showCancelAction =
		!hideCancelAction &&
		!!$exportCancelController$ &&
		!!listItems.find(({ action }) => action === Action.EXPORT_NEW || action === Action.EXPORT_UPDATE);

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
			buttonClasses,
			title: finalTitle,
			subtitle: referenceSubtitle,
			buttonStyles: isFooter ? `margin-left: 0.5rem;${isDisabled ? 'opacity: 0.4;' : ''}` : '',
			iconStyles: isFooter && isDisabled ? 'cursor: not-allowed;' : '',
		};
	}
</script>

{#each listItems as listItem (listItem.action)}
	{#if listItem.enabled}
		{#if listItem.action === Action.TOGGLE_PLAYBACK}
			<ActionButton
				{...getActionButtonProps(
					Action.TOGGLE_PLAYBACK,
					$togglePlaybackTitle$,
					$isRecording$ || $paused$ ? mdiPlayCircleOutline : mdiPauseCircleOutline,
					getDummySubtitle(0),
				)}
				on:executed
			/>
		{:else if listItem.action === Action.PREVIOUS_SUBTITLE}
			<ActionButton
				{...getActionButtonProps(
					Action.PREVIOUS_SUBTITLE,
					$previousSubtitleTitle$,
					mdiPagePreviousOutline,
					subtitle,
				)}
				on:executed
			/>
		{:else if listItem.action === Action.NEXT_SUBTITLE}
			<ActionButton
				{...getActionButtonProps(Action.NEXT_SUBTITLE, $nextSubtitleTitle$, mdiPageNextOutline, subtitle)}
				on:executed
			/>
		{:else if listItem.action === Action.RESTART_PLAYBACK}
			<ActionButton
				{skipUpdates}
				{...getActionButtonProps(Action.RESTART_PLAYBACK, $restartPlaybackTitle$, mdiPlaylistPlay, subtitle)}
				on:executed
			/>
		{:else if listItem.action === Action.TOGGLE_PLAY_PAUSE}
			<ActionButton
				{skipUpdates}
				{...getActionButtonProps(Action.TOGGLE_PLAY_PAUSE, $togglePlayPauseTitle$, mdiPlayPause, subtitle)}
				on:executed
			/>
		{:else if listItem.action === Action.TOGGLE_PLAYBACK_LOOP}
			<ActionButton
				{skipUpdates}
				{...getActionButtonProps(Action.TOGGLE_PLAYBACK_LOOP, $togglePlaybackLoopTitle$, mdiRefresh, subtitle)}
				on:executed
			/>
		{:else if listItem.action === Action.TOGGLE_BOOKMARK}
			<ActionButton
				{...getActionButtonProps(Action.TOGGLE_BOOKMARK, $toggleBookmarkTitle$, bookmarkPath, subtitle)}
				on:executed
			/>
		{:else if listItem.action === Action.TOGGLE_MERGE}
			<ActionButton
				{...getActionButtonProps(Action.TOGGLE_MERGE, $toggleMergeTitle$, mergePath, subtitle)}
				on:executed
			/>
		{:else if listItem.action === Action.EDIT_SUBTITLE}
			<ActionButton
				{...getActionButtonProps(Action.EDIT_SUBTITLE, $editSubtitleTitle$, mdiClockEdit, subtitle)}
				on:executed
			/>
		{:else if listItem.action === Action.RESTORE_SUBTITLE}
			<ActionButton
				{...getActionButtonProps(Action.RESTORE_SUBTITLE, $restoreSubtitleTitle$, mdiRestore, subtitle)}
				on:executed
			/>
		{:else if listItem.action === Action.COPY_SUBTITLE}
			<ActionButton
				{...getActionButtonProps(Action.COPY_SUBTITLE, Action.COPY_SUBTITLE, mdiContentCopy, subtitle)}
				on:executed
			/>
		{:else if listItem.action === Action.EXPORT_NEW}
			<ActionButton
				{...getActionButtonProps(Action.EXPORT_NEW, $exportNewTitle$, mdiDatabasePlus, subtitle)}
				on:executed
			/>
		{:else if listItem.action === Action.EXPORT_UPDATE}
			<ActionButton
				{...getActionButtonProps(Action.EXPORT_UPDATE, $exportUpdateTitle$, mdiDatabaseSync, subtitle)}
				on:executed
			/>
		{:else if listItem.action === Action.OPEN_LAST_EXPORTED_CARD}
			<ActionButton
				{...getActionButtonProps(
					Action.OPEN_LAST_EXPORTED_CARD,
					$openLastExportedCardTitle$,
					mdiOpenInApp,
					getDummySubtitle(0),
				)}
				on:executed
			/>
		{/if}
	{/if}
{/each}
{#if showCancelAction}
	<ActionButton
		{...getActionButtonProps(Action.CANCEL_EXPORT, $exportCancelTitle$, mdiCancel, getDummySubtitle(0))}
		on:executed
	/>
{/if}
