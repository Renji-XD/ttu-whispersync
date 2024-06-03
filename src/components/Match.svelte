<script lang="ts">
	import Icon from './Icon.svelte';
	import type { Context, DiffDetail, Subtitle } from '../lib/general';
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
		getSubtitleIdFromElement,
		parseHTML,
		throwIfAborted,
	} from '../lib/util';
	import MatchDiffDialog from './MatchDiffDialog.svelte';
	import { mdiFloppy, mdiHelpCircle, mdiInformation, mdiTarget, mdiTrashCan } from '@mdi/js';
	import Popover from './Popover.svelte';
	import Progress from './Progress.svelte';
	import SettingsCheckbox from './SettingsCheckbox.svelte';
	import SettingsNumberInput from './SettingsNumberInput.svelte';
	import { createEventDispatcher, getContext } from 'svelte';

	const singleIgnoredElements = new Set(['rt']);
	const normalizeRegex = /[\p{punct}\s]/u;
	const { isIOS } = getContext<Context>('context');
	const { matchLineIgnoreRp$, matchLineSimilarityThreshold$, matchLineMaxAttempts$ } = settings$;
	const dispatch = createEventDispatcher<{ selectHint: void; hintSelected: void }>();

	let bookHTML: HTMLElement | undefined;
	let cancelToken = new AbortController();
	let cancelSignal = cancelToken.signal;
	let currentProgress = 0;
	let maxProgress = 0;
	let lineMatchRate = 'n/a';
	let bookSubtitleDiffRate = 'n/a';
	let subtitlesForDownload: Subtitle[] = [];
	let subtitleDiffDetails: DiffDetail[] = [];
	let unmatchedSubtitles: Subtitle[] = [];
	let startHintNodeContent: string | undefined;
	let startHintParentId: string | undefined;

	$: hasHint = startHintNodeContent !== undefined && startHintParentId !== undefined;

	$: ignoredTags = $matchLineIgnoreRp$ ? allIgnoredElements : singleIgnoredElements;

	async function onTriggerSelectStartHint() {
		document.addEventListener('click', onSelectHintElement, { once: true, capture: false });

		dispatch('selectHint');
	}

	function onResetHint() {
		startHintNodeContent = undefined;
		startHintParentId = undefined;
	}

	function onSelectHintElement({ x, y }: MouseEvent | PointerEvent) {
		const firstTextNode = getTextNode(document.elementFromPoint(x, y));

		if (firstTextNode) {
			const ttuParent = getTTUParent(firstTextNode);

			if (ttuParent?.id) {
				startHintNodeContent = firstTextNode.textContent!;
				startHintParentId = ttuParent.id;

				firstTextNode.parentElement!.style.visibility = 'hidden';

				setTimeout(() => (firstTextNode.parentElement!.style.visibility = ''), 500);
			}
		}

		dispatch('hintSelected');
	}

	function onDownloadUnmatchedSubtitles() {
		$isLoading$ = true;

		let content = '';

		for (let index = 0, { length } = unmatchedSubtitles; index < length; index += 1) {
			const unmatchedSubtitle = unmatchedSubtitles[index];

			content += `${unmatchedSubtitle.id}\n${unmatchedSubtitle.text}\n\n`;
		}

		downloadFile(
			document,
			new Blob([content], { type: 'text/plain;charset=utf-8' }),
			`${$currentSubtitleFile$!.name.split(/\.(?=[^\.]+$)/)[0]}_unmatched.txt`,
			isIOS,
		);

		$isLoading$ = false;
	}

	async function onMatchSubtitles() {
		$isLoading$ = true;
		$lastError$ = '';
		lineMatchRate = 'n/a';
		bookSubtitleDiffRate = 'n/a';
		subtitlesForDownload = [];
		subtitleDiffDetails = [];
		unmatchedSubtitles = [];
		maxProgress = $currentSubtitles$.size;

		try {
			const textNodes: Node[] = [];
			const subtitles = [...$currentSubtitles$.values()];
			const maxMatchAttempts = Math.min(subtitles.length, $matchLineMaxAttempts$);
			const originalElementsMap = new Map<HTMLElement, string>();
			const matchedElementsMap = new Map<HTMLElement, string>();

			let currentNodes: Node[] = [];
			let currentText = '';
			let textInScope = '';
			let currentSubtitleIndex = 0;
			let passedStartNode = hasHint ? false : true;
			let { currentSubtitle, currentSubtitleLength } = getSubtitleData(subtitles, currentSubtitleIndex);

			bookHTML = parseHTML(new DOMParser(), $bookData$.elementHtml);

			const bookTextWalker = document.createTreeWalker(bookHTML, NodeFilter.SHOW_TEXT, {
				acceptNode(node) {
					if (hasHint && !passedStartNode) {
						passedStartNode =
							startHintNodeContent === node.textContent && getTTUParent(node)?.id === startHintParentId;

						if (passedStartNode) {
							node.parentElement!.dataset.ttuWhispersyncStartNode = '';
						}
					}

					if (passedStartNode) {
						const textContent = normalizeString(node.textContent);

						addNodeContentToMap(originalElementsMap, node, textContent);

						if (textContent) {
							textNodes.push(node);
						}
					}

					return NodeFilter.FILTER_ACCEPT;
				},
			});

			while (bookTextWalker.nextNode()) {}

			let matchedSubtitles = 0;
			let matchAttempt = 1;
			let currentTextNodeIndex = 0;
			let textNodeIndexAfterLastMatch = 0;
			let textNodeCount = textNodes.length;

			while (currentTextNodeIndex < textNodeCount && currentSubtitleIndex < subtitles.length) {
				throwIfAborted(cancelSignal);

				const newProgress = caluclatePercentage(currentSubtitleIndex + 1, maxProgress);

				let node = textNodes[currentTextNodeIndex];
				let nodeParentTag = node.parentElement!.tagName.toLowerCase();

				if (newProgress !== currentProgress) {
					currentProgress = newProgress;

					await new Promise((resolve) => setTimeout(resolve));
				}

				if (!ignoredTags.has(nodeParentTag)) {
					currentText += node.textContent;
				}

				const currentNormalizedTextLength = getNormalizedLength(currentText);

				if (currentNormalizedTextLength >= currentSubtitleLength) {
					const textForComparison = getTextForComparison(currentText, currentSubtitleLength);
					const textForComparisonLength = [...textForComparison].length;

					let bestLineSimiliarityStartIndex = 0;
					let bestLineSimiliarityEndIndex = textForComparisonLength;
					let bestLineSimiliarityValue = getSimilarity(textForComparison, currentSubtitle);

					currentNodes.push(node);

					const similiarityResult = findBestSimilarity(
						currentSubtitle,
						currentSubtitleLength,
						textForComparison,
						textForComparisonLength,
						bestLineSimiliarityStartIndex,
						bestLineSimiliarityValue,
						currentNodes,
						textNodes,
						currentTextNodeIndex,
					);
					const isThresholdMet = similiarityResult.bestLineSimiliarityValue >= $matchLineSimilarityThreshold$;

					if (isThresholdMet) {
						({
							bestLineSimiliarityStartIndex,
							bestLineSimiliarityEndIndex,
							currentNodes,
							currentTextNodeIndex,
						} = similiarityResult);
					}

					node = textNodes[currentTextNodeIndex];
					nodeParentTag = node.parentElement!.tagName.toLowerCase();

					currentTextNodeIndex += 1;

					while (ignoredTags.has(nodeParentTag) && currentTextNodeIndex < textNodeCount) {
						node = textNodes[currentTextNodeIndex];
						nodeParentTag = node.parentElement!.tagName.toLowerCase();

						if (ignoredTags.has(nodeParentTag)) {
							currentNodes.push(node);
						}

						currentTextNodeIndex += 1;
					}

					currentTextNodeIndex -= 1;

					if (isThresholdMet) {
						let charactersToProcess = bestLineSimiliarityEndIndex - bestLineSimiliarityStartIndex;
						let charactersProcessed = 0;
						let hadRemainingCharacters = false;

						if (bestLineSimiliarityStartIndex !== 0) {
							const nodeToProcess = currentNodes[0];
							const nodeToProcessTextContent = nodeToProcess.textContent || '';
							const ignoredTextNode = document.createTextNode(
								nodeToProcessTextContent.slice(0, bestLineSimiliarityStartIndex),
							);
							const remainingTextNode = document.createTextNode(
								nodeToProcessTextContent.slice(bestLineSimiliarityStartIndex),
							);

							nodeToProcess.parentElement!.replaceChild(ignoredTextNode, nodeToProcess);
							ignoredTextNode.after(remainingTextNode);

							currentNodes[0] = remainingTextNode;
						}

						for (let index = 0, { length } = currentNodes; index < length; index += 1) {
							const nodeToProcess = currentNodes[index];
							const nodeToProcessParentElement = nodeToProcess.parentElement!;
							const nodeToProcessParentElementTag = nodeToProcessParentElement.tagName.toLowerCase();
							const nodeToProcessTextContent = nodeToProcess.textContent || '';
							const nodeTextContentLength = [...nodeToProcessTextContent].length;
							const isIgnoredParent = ignoredTags.has(nodeToProcessParentElementTag);
							const matchedContainer = document.createElement('span');
							const matchedText = isIgnoredParent
								? nodeToProcessTextContent.slice(0)
								: nodeToProcessTextContent.slice(0, charactersToProcess);
							const matchedTextNode = document.createTextNode(matchedText);
							const matchedTextLength = [...matchedText].length;
							const remainingCharacters = nodeTextContentLength - matchedTextLength;

							if (charactersToProcess) {
								const subtitle = subtitles[currentSubtitleIndex];

								matchedContainer.classList.add(getBaseLineCSSSelectorForId(subtitle.id));

								matchedContainer.appendChild(matchedTextNode);
								nodeToProcessParentElement.replaceChild(matchedContainer, nodeToProcess);

								if (!allIgnoredElements.has(nodeToProcessParentElementTag)) {
									textInScope += matchedText;
								}
							}

							charactersProcessed += isIgnoredParent ? 0 : matchedTextLength;
							charactersToProcess =
								bestLineSimiliarityEndIndex - bestLineSimiliarityStartIndex - charactersProcessed;

							if (!charactersToProcess && remainingCharacters) {
								const leftOverTextNodes: Text[] = [];

								index += matchedTextLength ? 0 : 1;

								let leftOverLength = matchedTextLength;

								while (index < length) {
									const leftOverNode = currentNodes[index];
									const leftOverNodeContent = leftOverNode.textContent || '';
									const remainingTextNode = document.createTextNode(
										leftOverNodeContent.slice(leftOverLength),
									);

									if (!leftOverNodeContent) {
										throw new Error('charactersToProcess without remaining text found');
									}

									if (!leftOverNode.parentElement) {
										matchedContainer.after(remainingTextNode);
										leftOverTextNodes.push(remainingTextNode);
									}

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

						updateSubtitlesForDownload(subtitles[currentSubtitleIndex], textInScope);

						currentText = '';
						textInScope = '';

						if (!hadRemainingCharacters) {
							currentTextNodeIndex += 1;
						}

						textNodeIndexAfterLastMatch = currentTextNodeIndex;
						currentSubtitleIndex += 1;
						matchedSubtitles += 1;
						matchAttempt = 1;

						if (currentSubtitleIndex < subtitles.length) {
							({ currentSubtitle, currentSubtitleLength } = getSubtitleData(
								subtitles,
								currentSubtitleIndex,
							));
						}
					} else {
						currentTextNodeIndex = textNodeIndexAfterLastMatch + matchAttempt;
						matchAttempt += 1;
						currentText = '';
						textInScope = '';

						const isEndReached = currentTextNodeIndex > textNodes.length;
						const maxAttemptsReached = matchAttempt > maxMatchAttempts;

						if (maxAttemptsReached || isEndReached) {
							console.log(
								maxAttemptsReached
									? `Max match attempts for ${currentSubtitle} (${subtitles[currentSubtitleIndex].id}) reached - reset`
									: `End of Text before max attempt for ${currentSubtitle} (${subtitles[currentSubtitleIndex].id}) reached - reset`,
							);

							unmatchedSubtitles.push(subtitles[currentSubtitleIndex]);

							updateSubtitlesForDownload(subtitles[currentSubtitleIndex], textInScope);

							matchAttempt = 1;
							currentSubtitleIndex += 1;

							if (currentSubtitleIndex < subtitles.length) {
								currentTextNodeIndex = textNodeIndexAfterLastMatch;

								({ currentSubtitle, currentSubtitleLength } = getSubtitleData(
									subtitles,
									currentSubtitleIndex,
								));
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

			passedStartNode = hasHint ? false : true;

			const matchedWlker = document.createTreeWalker(bookHTML, NodeFilter.SHOW_TEXT, {
				acceptNode(node) {
					if (hasHint && !passedStartNode) {
						passedStartNode = !!node.parentElement?.closest('*[data-ttu-whispersync-start-node]');
					}

					if (passedStartNode) {
						addNodeContentToMap(matchedElementsMap, node, normalizeString(node.textContent));
					}

					return NodeFilter.FILTER_ACCEPT;
				},
			});

			while (matchedWlker.nextNode()) {}

			const bookTextEntries = [...originalElementsMap.entries()];
			const matchedBookTextEntries = [...matchedElementsMap.entries()];

			for (let index = 0, { length } = bookTextEntries; index < length; index += 1) {
				const [originalElement, originalContent] = bookTextEntries[index];
				const [matchedElement, matchedContent] = matchedBookTextEntries[index] || [];
				const ttuParent = getTTUParent(originalElement);

				if (originalElement !== matchedElement) {
					throwMatchError(`element mismatch on index ${index}`, originalElement, matchedElement, ttuParent);
				}

				const bookTextCharacters = [...originalContent];
				const matchedBookTextCharacters = [...matchedContent];

				for (let index2 = 0, { length: length2 } = bookTextCharacters; index2 < length2; index2 += 1) {
					const bookCharacter = bookTextCharacters[index2];
					const matchCharacter = matchedBookTextCharacters[index2];

					if (bookCharacter !== matchCharacter) {
						throwMatchError(
							`mismatch on index ${index}, position ${index2}: ${originalContent.slice(
								Math.max(0, index2 - 10),
								Math.min(bookTextCharacters.length, index2 + 10),
							)} | vs | ${matchedContent.slice(
								Math.max(0, index2 - 10),
								Math.min(matchedBookTextCharacters.length, index2 + 10),
							)}`,
							originalElement,
							matchedElement,
							ttuParent,
						);
					}
				}
			}

			const lastSubtitle = subtitles[subtitles.length - 1];

			if (currentText) {
				unmatchedSubtitles.push(lastSubtitle);

				console.log(
					`End of Text before max attempt for ${lastSubtitle.text} (${lastSubtitle.id}) reached - reset`,
				);
			}

			if (
				subtitlesForDownload.length &&
				subtitlesForDownload[subtitlesForDownload.length - 1].id !== lastSubtitle.id
			) {
				updateSubtitlesForDownload(lastSubtitle, textInScope);
			}

			lineMatchRate = `${matchedSubtitles} / ${
				subtitles.length
			} (${caluclatePercentage(matchedSubtitles, subtitles.length, false)}%)`;

			bookSubtitleDiffRate = `${subtitleDiffDetails.length} / ${matchedSubtitles} (${caluclatePercentage(
				subtitleDiffDetails.length,
				matchedSubtitles,
				false,
			)}%)`;

			if (bookHTML.firstElementChild instanceof HTMLElement) {
				bookHTML.firstElementChild.dataset.ttuWhispersyncMatchedBy = $currentSubtitleFile$!.name;
				bookHTML.firstElementChild.dataset.ttuWhispersyncMatchedOn = `${Date.now()}`;
				bookHTML.firstElementChild.dataset.ttuWhispersyncMatchedSource = 'default';
			}
		} catch (error: any) {
			lineMatchRate = 'n/a';
			bookSubtitleDiffRate = 'n/a';
			bookHTML = undefined;
			subtitlesForDownload = [];
			subtitleDiffDetails = [];
			unmatchedSubtitles = [];

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

	function onDownloadSubtitles() {
		$isLoading$ = true;

		let subtitleContent = '';

		for (let index = 0, { length } = subtitlesForDownload; index < length; index += 1) {
			const subtitle = subtitlesForDownload[index];

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

	function getTextNode(node: Node | null): Node | undefined {
		if (node === null) {
			return undefined;
		}

		if (node.nodeType === Node.TEXT_NODE && normalizeString(node.textContent)) {
			return node;
		}

		let textNode: Node | undefined;

		for (let index = 0, { length } = node.childNodes; index < length; index += 1) {
			const childNode = node.childNodes[index];

			if (childNode.nodeType === Node.TEXT_NODE && normalizeString(node.textContent)) {
				textNode = childNode;
			} else {
				textNode = getTextNode(childNode);
			}

			if (textNode) {
				break;
			}
		}

		return textNode;
	}

	function getTTUParent(node: Node) {
		return node.parentElement!.closest('div[id^="ttu-"]');
	}

	function getSubtitleData(subtitles: Subtitle[], index: number) {
		const currentSubtitle = subtitles[index].text;
		const currentSubtitleLength = [...currentSubtitle].length;

		return { currentSubtitle, currentSubtitleLength };
	}

	function getNormalizedLength(value: string) {
		return [...normalizeString(value)].length;
	}

	function normalizeString(value: string | null, toLowerCase = false) {
		const cleanValue = (value || '').replace(/\s/g, '').trim();

		return toLowerCase ? cleanValue.toLowerCase() : cleanValue;
	}

	function addNodeContentToMap(map: Map<HTMLElement, string>, node: Node, textContent: string) {
		const parent =
			node.parentElement instanceof HTMLSpanElement &&
			getSubtitleIdFromElement(node.parentElement) !== 'not existing'
				? node.parentElement.parentElement!
				: node.parentElement!;

		map.set(parent, `${map.get(parent) || ''}${textContent}`);
	}

	function getTextForComparison(currentText: string, targetLength: number) {
		const characters = [...currentText];

		if (characters.length === targetLength) {
			return currentText;
		}

		let textForComparison = '';
		let textForComparisonLength = 0;

		for (let index = 0, { length } = characters; index < length; index += 1) {
			let character = characters[index];

			textForComparison += character;

			const trimmedCharacter = character.trim();

			if (trimmedCharacter && !normalizeRegex.test(trimmedCharacter)) {
				textForComparisonLength += 1;
			}

			if (textForComparisonLength === targetLength) {
				break;
			}
		}

		return textForComparison;
	}

	function getSimilarity(str1: string, str2: string) {
		const string1 = normalizeString(str1, true);
		const string2 = normalizeString(str2, true);
		const string1Length = [...string1].length;
		const string2Length = [...string2].length;
		const substringLength = string1Length < 5 ? 1 : 2;

		if (string1 === string2) {
			return 1;
		}

		if (string1Length < substringLength || string2Length < substringLength) {
			return 0;
		}

		const map = new Map();

		for (let i = 0; i < string1Length - (substringLength - 1); i += 1) {
			const substring1 = string1.substring(i, i + substringLength);

			map.set(substring1, map.has(substring1) ? map.get(substring1) + 1 : 1);
		}

		let match = 0;

		for (let j = 0; j < string2Length - (substringLength - 1); j++) {
			const substring2 = string2.substring(j, j + substringLength);
			const count = map.has(substring2) ? map.get(substring2) : 0;

			if (count > 0) {
				map.set(substring2, count - 1);

				match += 1;
			}
		}

		return (match * 2) / (string1Length + string2Length - (substringLength - 1) * 2);
	}

	function findBestSimilarity(
		currentSubtitle: string,
		currentSubtitleLength: number,
		textForComparison: string,
		textForComparisonLength: number,
		currentBestStartIndex: number,
		currentBestValue: number,
		currentNodes: Node[],
		textNodes: Node[],
		currentTextNodeIndex: number,
	) {
		let bestLineSimiliarityStartIndex = currentBestStartIndex;
		let bestLineSimiliarityEndIndex = textForComparisonLength;
		let bestLineSimiliarityValue = currentBestValue;

		if (bestLineSimiliarityValue !== 1) {
			for (let index = bestLineSimiliarityEndIndex; index > currentBestStartIndex; index -= 1) {
				if (
					normalizeString(currentSubtitle) ===
					normalizeString(textForComparison.slice(currentBestStartIndex, index))
				) {
					bestLineSimiliarityStartIndex = currentBestStartIndex;
					bestLineSimiliarityEndIndex = index;
					bestLineSimiliarityValue = 1;
					break;
				}
			}
		}

		if (bestLineSimiliarityValue !== 1) {
			for (let index = currentBestStartIndex; index < bestLineSimiliarityEndIndex; index += 1) {
				const lineSimiliarityToCompare = getSimilarity(
					currentSubtitle,
					textForComparison.slice(index, bestLineSimiliarityEndIndex),
				);

				if (lineSimiliarityToCompare > bestLineSimiliarityValue) {
					bestLineSimiliarityStartIndex = index;
					bestLineSimiliarityEndIndex = textForComparisonLength;
					bestLineSimiliarityValue = lineSimiliarityToCompare;
				}
			}
		}

		if (
			currentBestStartIndex === bestLineSimiliarityStartIndex ||
			bestLineSimiliarityValue === 1 ||
			bestLineSimiliarityValue < $matchLineSimilarityThreshold$
		) {
			if (bestLineSimiliarityValue !== 1) {
				bestLineSimiliarityValue = -1;

				for (let index = bestLineSimiliarityEndIndex; index > currentBestStartIndex; index -= 1) {
					const lineSimiliarityToCompare = getSimilarity(
						currentSubtitle,
						textForComparison.slice(currentBestStartIndex, index),
					);

					if (lineSimiliarityToCompare > bestLineSimiliarityValue) {
						bestLineSimiliarityStartIndex = currentBestStartIndex;
						bestLineSimiliarityEndIndex = index;
						bestLineSimiliarityValue = lineSimiliarityToCompare;
					}
				}
			}

			if (bestLineSimiliarityValue < $matchLineSimilarityThreshold$ || bestLineSimiliarityValue === 1) {
				return {
					bestLineSimiliarityStartIndex,
					bestLineSimiliarityEndIndex,
					bestLineSimiliarityValue,
					currentNodes,
					currentTextNodeIndex,
				};
			}

			const finalNodes = [];
			const originalLength = currentNodes.length;
			const targetCharacterLength = bestLineSimiliarityEndIndex - bestLineSimiliarityStartIndex;

			let characterCount = 0;

			while (characterCount < targetCharacterLength && currentNodes.length) {
				const nodeToCheck = currentNodes.shift()!;
				const nodeToCheckParentTag = nodeToCheck.parentElement!.tagName.toLowerCase();

				characterCount += ignoredTags.has(nodeToCheckParentTag)
					? 0
					: [...(nodeToCheck.textContent || '')].length;

				finalNodes.push(nodeToCheck);
			}

			return {
				bestLineSimiliarityStartIndex,
				bestLineSimiliarityEndIndex,
				bestLineSimiliarityValue,
				currentNodes: finalNodes,
				currentTextNodeIndex: currentTextNodeIndex - (originalLength - finalNodes.length),
			};
		}

		let sliceIndex = 0;
		let charactersSeen = 0;
		let startOffset = bestLineSimiliarityStartIndex;

		for (let index = 0, { length } = currentNodes; index < length; index += 1) {
			let nodeToCheck = currentNodes[index];
			let nodeToCheckParentTag = nodeToCheck.parentElement!.tagName.toLowerCase();
			let nodeToCheckLength = ignoredTags.has(nodeToCheckParentTag)
				? 0
				: [...(nodeToCheck.textContent || '')].length;

			const offsetDiff = startOffset - nodeToCheckLength;

			charactersSeen += nodeToCheckLength;
			startOffset = offsetDiff < 0 ? startOffset : offsetDiff;

			if (charactersSeen >= bestLineSimiliarityStartIndex) {
				sliceIndex = index + (charactersSeen === bestLineSimiliarityStartIndex ? 1 : 0);
				break;
			}
		}

		const newNodes = [];

		let currentText = '';
		let currentNormalizedTextLength = 0;
		let newTextNodeIndex = currentTextNodeIndex - (currentNodes.length - (sliceIndex + 1));

		while (currentNormalizedTextLength <= currentSubtitleLength && newTextNodeIndex < textNodes.length) {
			const nodeToCheck = textNodes[newTextNodeIndex];
			const nodeToCheckParentTag = nodeToCheck.parentElement!.tagName.toLowerCase();

			if (!ignoredTags.has(nodeToCheckParentTag)) {
				currentText += nodeToCheck.textContent;
			}

			newNodes.push(nodeToCheck);

			newTextNodeIndex += 1;
			currentNormalizedTextLength = getNormalizedLength(currentText);
		}

		newTextNodeIndex = newTextNodeIndex - 1;

		currentText = getTextForComparison(currentText, currentSubtitleLength);

		return findBestSimilarity(
			currentSubtitle,
			currentSubtitleLength,
			currentText,
			[...currentText].length,
			startOffset,
			bestLineSimiliarityValue,
			newNodes,
			textNodes,
			newTextNodeIndex,
		);
	}

	function updateSubtitlesForDownload(currentSubtitle: Subtitle, textInScope: string) {
		const trimmedSubtitle = normalizeString(currentSubtitle.text, true);
		const trimmedTextInScope = normalizeString(textInScope, true);

		subtitlesForDownload.push({ ...currentSubtitle });

		if (textInScope && trimmedSubtitle !== trimmedTextInScope) {
			subtitlesForDownload[subtitlesForDownload.length - 1].text = textInScope;

			subtitleDiffDetails.push({
				id: currentSubtitle.id,
				original: currentSubtitle.text,
				adjusted: textInScope,
			});
		}
	}

	function throwMatchError(
		error: string,
		originalElement: HTMLElement,
		matchedElement: HTMLElement,
		ttuParent: Element | null,
	) {
		console.log(error, originalElement, matchedElement, ttuParent);

		throw new Error(error);
	}
</script>

<div class="flex-1">
	<div class="settings-grid">
		<div>Lines to match</div>
		<div>{$currentSubtitles$.size}</div>
		<button title={hasHint ? 'Delete start hint element' : 'Select start hint element'}>
			<Icon
				path={hasHint ? mdiTrashCan : mdiTarget}
				on:click={() => (hasHint ? onResetHint() : onTriggerSelectStartHint())}
			/>
		</button>
		<div>Line match rate</div>
		<div>{lineMatchRate}</div>
		<div>
			{#if !maxProgress && unmatchedSubtitles.length}
				<button title="Download unmatched subtitle list">
					<Icon path={mdiFloppy} on:click={onDownloadUnmatchedSubtitles} />
				</button>
			{/if}
		</div>
		<div>Book diff rate</div>
		<div>{bookSubtitleDiffRate}</div>
		<Popover>
			<div slot="icon">
				<Icon path={mdiHelpCircle} />
			</div>
			<div>Indicates # of lines which passed the similiarity check but are not equal to the book text</div>
		</Popover>
		{#if !maxProgress && subtitleDiffDetails.length}
			<button
				on:click={() =>
					dialogs$.add({
						component: MatchDiffDialog,
						props: { subtitleDiffDetails },
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
	{#if !maxProgress && subtitleDiffDetails.length}
		<button class="btn m-r-s" on:click={onDownloadSubtitles}>Download</button>
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
