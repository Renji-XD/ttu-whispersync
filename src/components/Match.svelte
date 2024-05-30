<script lang="ts">
	import Icon from './Icon.svelte';
	import type { Context, DiffDetail, Subtitle } from '../lib/general';
	import { MatchSpaceMode } from '../lib/settings';
	import {
		bookData$,
		booksDB$,
		currentSubtitleFile$,
		currentSubtitles$,
		dialogs$,
		exportCancelController$,
		isLoading$,
		lastError$,
		settings$,
	} from '../lib/stores';
	import {
		allIgnoredElements,
		caluclatePercentage,
		downloadFile,
		getBaseLineCSSSelectorForId,
		parseHTML,
		throwIfAborted,
	} from '../lib/util';
	import { mdiHelpCircle, mdiInformation } from '@mdi/js';
	import Popover from './Popover.svelte';
	import Progress from './Progress.svelte';
	import SettingsCheckbox from './SettingsCheckbox.svelte';
	import SettingsNumberInput from './SettingsNumberInput.svelte';
	import ShowMatchDiffDialog from './ShowMatchDiffDialog.svelte';
	import { stringSimilarity } from 'string-similarity-js';
	import { getContext } from 'svelte';
	import SettingsSelect from './SettingsSelect.svelte';

	const singleIgnoredElements = new Set(['rt']);
	const {
		matchLineIgnoreRp$,
		matchLineSpaceMode$,
		matchLineLookAhead$,
		matchLineSimilarityThreshold$,
		matchLineMaxAttempts$,
	} = settings$;
	const { isIOS } = getContext<Context>('context');
	const matchLLineSpaceModes = [MatchSpaceMode.ORIGINAL, MatchSpaceMode.LEADING_TRAILING, MatchSpaceMode.ALL];

	let bookHTML: HTMLElement | undefined;
	let cancelToken = new AbortController();
	let cancelSignal = cancelToken.signal;
	let currentProgress = 0;
	let maxProgress = 0;
	let lineMatchRate = 'n/a';
	let bookSubtitleDiffRate = 'n/a';
	let bookSubtitleDiffLines = 0;
	let matchLineSpaceModeHelpText = '';
	let adjustedSubtitles: Subtitle[] = [];
	let diffDetails: DiffDetail[] = [];

	$: ignoredTags = $matchLineIgnoreRp$ ? allIgnoredElements : singleIgnoredElements;

	$: if ($matchLineSpaceMode$ === MatchSpaceMode.ORIGINAL) {
		matchLineSpaceModeHelpText = 'Lines and book text will be compared as is';
	} else {
		matchLineSpaceModeHelpText =
			$matchLineSpaceMode$ === MatchSpaceMode.LEADING_TRAILING
				? 'Leading and trailing whitespace of lines and book text will be ignored for the comparison'
				: 'All whitespaces of lines and book text will be ignored for the comparison';
	}

	async function onMatchSubtitles() {
		$isLoading$ = true;
		$lastError$ = '';
		lineMatchRate = 'n/a';
		bookSubtitleDiffRate = 'n/a';
		bookSubtitleDiffLines = 0;
		adjustedSubtitles = [];
		diffDetails = [];
		maxProgress = $currentSubtitles$.size;

		try {
			const textNodes: Node[] = [];
			const subtitles = [...$currentSubtitles$.values()];
			const maxMatchAttempts = Math.min(subtitles.length, $matchLineMaxAttempts$);

			let currentNodes: Node[] = [];
			let currentText = '';
			let textInScope = '';
			let bookText = '';
			let matchedBookText = '';
			let currentSubLineIndex = 0;
			let currentSubLine = subtitles[currentSubLineIndex].text;
			let currentSubLineLength = [...currentSubLine].length;
			let currentSubLineLookAheadLength =
				currentSubLineLength + Math.ceil(Math.min($matchLineLookAhead$, currentSubLineLength / 2));

			bookHTML = parseHTML(new DOMParser(), $bookData$.elementHtml);

			const walker = document.createTreeWalker(bookHTML, NodeFilter.SHOW_TEXT, {
				acceptNode(node) {
					const textContent = (node.textContent || '').replace(/\s/g, '').trim();

					if (textContent) {
						textNodes.push(node);
					}

					bookText += (node.textContent || '').replace(/\s/g, '').trim();

					return NodeFilter.FILTER_ACCEPT;
				},
			});

			while (walker.nextNode()) {}

			let textNodeCount = textNodes.length;
			let currentTextNodeIndex = 0;
			let textNodeIndexAfterLastMatch = 0;
			let matchedLines = 0;
			let matchAttempt = 1;

			while (currentTextNodeIndex < textNodeCount) {
				throwIfAborted(cancelSignal);

				const newProgress = caluclatePercentage(currentSubLineIndex + 1, maxProgress);

				let node = textNodes[currentTextNodeIndex];
				let nodeParentElement = node.parentElement!;
				let nodeParentTag = nodeParentElement.tagName.toLowerCase();

				if (newProgress !== currentProgress) {
					currentProgress = newProgress;

					await new Promise((resolve) => setTimeout(resolve));
				}

				if (!ignoredTags.has(nodeParentTag)) {
					currentText += getAdjustedValue(node.textContent);
				}

				const originalTextLength = [...currentText].length;

				if (originalTextLength >= currentSubLineLength) {
					const textToCheck = currentText.slice(0, currentSubLineLookAheadLength);
					const textToCheckLength = [...textToCheck].length;
					const currentSubLineTextForComparison = getValueForComparison(currentSubLine);
					const textToCheckForComparison = getValueForComparison(textToCheck);

					const lineSimiliarity =
						currentSubLineTextForComparison === textToCheckForComparison
							? 1
							: stringSimilarity(currentSubLineTextForComparison, textToCheckForComparison);

					currentNodes.push(node);

					currentTextNodeIndex += 1;

					while (ignoredTags.has(nodeParentTag) && currentTextNodeIndex < textNodeCount) {
						node = textNodes[currentTextNodeIndex];
						nodeParentElement = node.parentElement!;
						nodeParentTag = nodeParentElement.tagName.toLowerCase();

						if (ignoredTags.has(nodeParentTag)) {
							currentNodes.push(node);
						}

						currentTextNodeIndex += 1;
					}

					currentTextNodeIndex -= 1;

					if (lineSimiliarity > $matchLineSimilarityThreshold$) {
						let bestLineSimiliarityLength = textToCheckLength;
						let bestLineSimiliarityValue = lineSimiliarity;

						if (bestLineSimiliarityValue !== 1) {
							for (let index = textToCheckLength - 1; index > 0; index -= 1) {
								const substring = textToCheck.slice(0, index);
								const substringForComparison = getValueForComparison(substring);
								const lineSimiliarityToCompare =
									currentSubLineTextForComparison === substringForComparison
										? 1
										: stringSimilarity(currentSubLineTextForComparison, substringForComparison);

								if (lineSimiliarityToCompare > bestLineSimiliarityValue) {
									bestLineSimiliarityLength = index;
									bestLineSimiliarityValue = lineSimiliarityToCompare;
								}
							}
						}

						let charactersToProcess = bestLineSimiliarityLength;
						let charactersProcessed = 0;
						let hadRemainingCharacters = false;

						for (let index = 0, { length } = currentNodes; index < length; index += 1) {
							const nodeToProcess = currentNodes[index];
							const parentElement = nodeToProcess.parentElement!;
							const parentElementTag = parentElement.tagName.toLowerCase();
							const nodeTextContent = getAdjustedValue(nodeToProcess.textContent);
							const nodeTextContentLength = [...nodeTextContent].length;
							const isIgnoredParent = ignoredTags.has(parentElementTag);
							const matchedContainer = document.createElement('span');
							const matchedText = isIgnoredParent
								? nodeTextContent.slice(0)
								: nodeTextContent.slice(0, charactersToProcess);
							const matchedTextNode = document.createTextNode(matchedText);
							const matchedTextLength = [...matchedText].length;
							const remainingCharacters = nodeTextContentLength - matchedTextLength;

							let replacedInParent = false;

							if (charactersToProcess) {
								const subtitle = subtitles[currentSubLineIndex];

								matchedContainer.classList.add(getBaseLineCSSSelectorForId(subtitle.id));

								matchedContainer.appendChild(matchedTextNode);
								parentElement.replaceChild(matchedContainer, nodeToProcess);

								replacedInParent = true;

								if (!allIgnoredElements.has(parentElementTag)) {
									textInScope += matchedText;
								}
							}

							charactersProcessed += isIgnoredParent ? 0 : matchedTextLength;
							charactersToProcess = bestLineSimiliarityLength - charactersProcessed;

							if (!charactersToProcess && remainingCharacters) {
								const leftOverTextNodes: Text[] = [];

								index += matchedTextLength ? 0 : 1;

								let leftOverLength = matchedTextLength;

								while (index < length) {
									const leftOverNode = currentNodes[index];
									const leftOverNodeContent = getAdjustedValue(leftOverNode.textContent);
									const leftOverText = leftOverNodeContent.slice(leftOverLength);
									const remainingTextNode = document.createTextNode(leftOverText);

									if (!leftOverNodeContent) {
										throw new Error('charactersToProcess without remaining text found');
									}

									if (replacedInParent) {
										matchedContainer.after(remainingTextNode);
									} else {
										parentElement.appendChild(remainingTextNode);
									}

									leftOverTextNodes.push(remainingTextNode);

									index += 1;
									leftOverLength = 0;
								}

								if (leftOverTextNodes.length) {
									textNodes.splice(
										currentTextNodeIndex,
										leftOverTextNodes.length,
										...leftOverTextNodes,
									);
								}

								hadRemainingCharacters = true;
							}
						}

						const currentSubtitle = subtitles[currentSubLineIndex];
						const trimmedSubtitle = currentSubLine.replace(/\s/g, '').trim().toLowerCase();
						const trimmedTextInScope = textInScope.replace(/\s/g, '').trim().toLowerCase();

						adjustedSubtitles.push({ ...currentSubtitle });

						if (trimmedSubtitle !== trimmedTextInScope) {
							adjustedSubtitles[adjustedSubtitles.length - 1].text = textInScope.trim();
							bookSubtitleDiffLines += 1;

							diffDetails.push({
								id: currentSubtitle.id,
								original: currentSubLine,
								adjusted: textInScope,
							});
						}

						currentText = '';
						textInScope = '';

						if (!hadRemainingCharacters) {
							currentTextNodeIndex += 1;
						}

						textNodeIndexAfterLastMatch = currentTextNodeIndex;
						currentSubLineIndex += 1;
						matchedLines += 1;
						matchAttempt = 1;

						if (currentSubLineIndex < subtitles.length) {
							currentSubLine = subtitles[currentSubLineIndex].text;
							currentSubLineLength = [...currentSubLine].length;
							currentSubLineLookAheadLength =
								currentSubLineLength +
								Math.ceil(Math.min($matchLineLookAhead$, currentSubLineLength / 2));
						}
					} else {
						matchAttempt += 1;
						currentTextNodeIndex += 1;
						currentText = '';
						textInScope = '';

						const isEndReached = currentTextNodeIndex > textNodes.length;
						const maxAttemptsReached = matchAttempt > maxMatchAttempts;

						if (maxAttemptsReached || isEndReached) {
							matchAttempt = 1;
							currentSubLineIndex += 1;

							console.log(
								maxAttemptsReached
									? `max match attempts for ${currentSubLine} reached - reset`
									: 'End of Text before max attempt reached - reset',
							);

							if (currentSubLineIndex < subtitles.length) {
								currentTextNodeIndex = textNodeIndexAfterLastMatch;
								currentSubLine = subtitles[currentSubLineIndex].text;
								currentSubLineLength = [...currentSubLine].length;
								currentSubLineLookAheadLength =
									currentSubLineLength + Math.ceil(Math.min(16, currentSubLineLength / 2));
							} else {
								currentTextNodeIndex = textNodeCount;
							}
						}
					}

					currentNodes = [];
				} else {
					currentNodes.push(node);
					currentTextNodeIndex += 1;
				}

				textNodeCount = textNodes.length;
			}

			const matchedWlker = document.createTreeWalker(bookHTML, NodeFilter.SHOW_TEXT, {
				acceptNode(node) {
					matchedBookText += (node.textContent || '').replace(/\s/g, '').trim();

					return NodeFilter.FILTER_ACCEPT;
				},
			});

			while (matchedWlker.nextNode()) {}

			const bookTextCharacters = [...bookText];
			const matchedBookTextCharacters = [...matchedBookText];

			for (let index = 0, { length } = bookTextCharacters; index < length; index += 1) {
				const bookCharacter = bookTextCharacters[index];
				const matchCharacter = matchedBookTextCharacters[index];

				if (bookCharacter !== matchCharacter) {
					throw new Error(
						`mismatch on position ${index}: ${bookText.slice(
							Math.max(0, index - 10),
							Math.min(bookTextCharacters.length, index + 10),
						)} | vs | ${matchedBookText.slice(
							Math.max(0, index - 10),
							Math.min(matchedBookTextCharacters.length, index + 10),
						)}`,
					);
				}
			}

			lineMatchRate = `${matchedLines} / ${
				subtitles.length
			} (${caluclatePercentage(matchedLines, subtitles.length, false)}%)`;

			bookSubtitleDiffRate = `${bookSubtitleDiffLines} / ${
				adjustedSubtitles.length
			} (${adjustedSubtitles.length ? caluclatePercentage(bookSubtitleDiffLines, adjustedSubtitles.length, false) : 0}%)`;

			if (bookHTML.firstElementChild instanceof HTMLElement) {
				bookHTML.firstElementChild.dataset.ttuWhispersyncMatchedBy = $currentSubtitleFile$!.name;
				bookHTML.firstElementChild.dataset.ttuWhispersyncMatchedOn = `${Date.now()}`;
			}
		} catch (error: any) {
			lineMatchRate = 'n/a';
			bookSubtitleDiffRate = 'n/a';
			bookSubtitleDiffLines = 0;
			bookHTML = undefined;
			adjustedSubtitles = [];
			diffDetails = [];

			if (!cancelToken.signal.aborted && error.name !== 'AbortError') {
				$lastError$ = `Failed to match: ${error.message}`;
			}
		}

		currentProgress = 0;
		maxProgress = 0;
		cancelToken = new AbortController();
		cancelSignal = cancelToken.signal;
		$isLoading$ = false;
	}

	function onCancelMatch() {
		if (cancelSignal.aborted) {
			return;
		}

		cancelToken.abort('user aborted');
	}

	function onDownloadAdjustedSubtiles() {
		$isLoading$ = true;

		let subtitleContent = '';

		for (let index = 0, { length } = adjustedSubtitles; index < length; index += 1) {
			const subtitle = adjustedSubtitles[index];

			subtitleContent += `${subtitle.id}\n${subtitle.startTime} --> ${subtitle.endTime}\n${subtitle.text}\n\n`;
		}

		downloadFile(
			document,
			new Blob([subtitleContent], { type: `${isIOS ? 'text/plain' : 'application/x-subrip'};charset=utf-8` }),
			`${$currentSubtitleFile$!.name.split(/\.(?=[^\.]+$)/)[0]}_adjusted.srt`,
			isIOS,
		);

		$isLoading$ = false;
	}

	async function onSaveMatch() {
		$isLoading$ = true;

		try {
			const newData = {
				...$bookData$,
				htmlBackup: $bookData$.elementHtml,
				elementHtml: bookHTML!.innerHTML,
				lastBookModified: Date.now(),
			};

			await $booksDB$.put('data', newData);

			window.location.reload();
		} catch ({ message }: any) {
			$lastError$ = `Failed to save data: ${message}`;

			$isLoading$ = false;
		}
	}

	function getAdjustedValue(value: string | null) {
		if (!value) {
			return '';
		}

		return $matchLineSpaceMode$ === MatchSpaceMode.ORIGINAL ? value : value.trim();
	}

	function getValueForComparison(value: string) {
		if ($matchLineSpaceMode$ === MatchSpaceMode.ORIGINAL) {
			return value;
		}

		return $matchLineSpaceMode$ === MatchSpaceMode.LEADING_TRAILING
			? value.trim()
			: value.replace(/\s/g, '').trim();
	}
</script>

<div class="flex-1">
	<div class="settings-grid">
		<div>Lines to match</div>
		<div>{$currentSubtitles$.size}</div>
		<div></div>
		<div>Line match rate</div>
		<div>{lineMatchRate}</div>
		<div></div>
		<div>Book diff rate</div>
		<div>{bookSubtitleDiffRate}</div>
		<Popover>
			<div slot="icon">
				<Icon path={mdiHelpCircle} />
			</div>
			<div>Indicates # of lines which passed the similiarity check but are not equal to the book text</div>
		</Popover>
		{#if !maxProgress && diffDetails.length}
			<button
				on:click={() =>
					dialogs$.add({
						component: ShowMatchDiffDialog,
						props: { diffDetails },
					})}
			>
				Show Diff
			</button>
			<div></div>
			<div></div>
		{/if}
		<SettingsCheckbox
			label="Ignore rp elements"
			helpText="If enabled the content of rp elements will be ignored for the similiarity check"
			targetStore$={matchLineIgnoreRp$}
		/>
		<SettingsSelect
			label="Line space mode"
			helpText={matchLineSpaceModeHelpText}
			targetStore$={matchLineSpaceMode$}
			options={matchLLineSpaceModes}
		/>
		<SettingsNumberInput
			label="Line lookahead"
			helpText="Determines the extra amount of characters added from 50% length of a subtitle line up to this value
		which is used for the similiarity check"
			min={1}
			max={30}
			step={1}
			targetStore$={matchLineLookAhead$}
		/>
		<SettingsNumberInput
			label="Line similiarity %"
			helpText="Determines the % threshold for which a book text line is considered a match (1 being identical)"
			min={0.1}
			max={1}
			step={0.1}
			targetStore$={matchLineSimilarityThreshold$}
		/>
		<SettingsNumberInput
			label="Line match attempts"
			helpText="Determines how many book text lines are tested before skipping the current subtitle line as unmatched"
			min={1}
			step={1}
			targetStore$={matchLineMaxAttempts$}
		/>
	</div>
</div>
<div class="flex justify-end match-btns">
	{#if maxProgress}
		<button class="btn m-r-s" disabled={cancelSignal.aborted} on:click={onCancelMatch}>Cancel</button>
	{/if}
	{#if bookHTML && !maxProgress}
		<button
			class="btn m-r-s"
			disabled={!!$exportCancelController$}
			title={$exportCancelController$ ? 'Export in progress' : null}
			on:click={onSaveMatch}
		>
			Save & reload page
		</button>
	{/if}
	{#if bookSubtitleDiffLines && !maxProgress}
		<button class="btn m-r-s" on:click={onDownloadAdjustedSubtiles}>Download</button>
	{/if}
	<button class="btn m-r-s" disabled={maxProgress > 0} on:click={onMatchSubtitles}>Parse</button>
	<Popover placement="top">
		<div slot="icon">
			<Icon path={mdiInformation} />
		</div>
		<div>
			By matching the subtitles to the book you can enable extra functionality like the reader menu, auto scroll
			etc.
		</div>
	</Popover>
</div>
<Progress {currentProgress} rounded margin />
