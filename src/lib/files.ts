import type { AudioChapter, AudioResult, Subtitle } from './general';
import {
	activeSubtitle$,
	bookmarkedSubtitles$,
	currentAudioChapters$,
	currentAudioFile$,
	currentAudioLoaded$,
	currentAudioSourceUrl$,
	currentCoverUrl$,
	currentSubtitleFile$,
	currentSubtitles$,
	duration$,
	paused$,
	settings$,
	subtitleChange$,
	subtitlesForMerge$,
} from './stores';
import { between, interactWithSandbox, toTimeStamp, toTimeString } from './util';
import { getAudioMetadata, getMediaInfoCover } from './mediaInfo';
import { initializeFFMPEG, putAudioFileInFFMPEG } from './ffmpeg';

import { AudioProcessor } from './settings';
import type { MediaInfoType } from 'mediainfo.js';
import { get } from 'svelte/store';
import srtParser2 from 'srt-parser-2';

async function verifyPermission(
	handle: FileSystemFileHandle,
	options: FileSystemHandlePermissionDescriptor = { mode: 'read' },
) {
	if ((await handle.queryPermission(options)) === 'granted') {
		return true;
	}

	if ((await handle.requestPermission(options)) === 'granted') {
		return true;
	}

	throw new Error('File access not granted');
}

function readFile(file: File) {
	return new Promise<string>((resolve, reject) => {
		const fileReader = new FileReader();

		fileReader.addEventListener('loadend', (event) => {
			if (!event.target) {
				return reject(new Error('No FileReader data'));
			} else if (event.target.error) {
				return reject(new Error(`Error reading file - ${event.target.error.message}`));
			}

			resolve(event.target.result as string);
		});

		fileReader.addEventListener('error', () => {
			reject(new Error('Error reading file'));
		});

		fileReader.readAsText(file);
	});
}

function getVTTCues(url: string, document: Document) {
	const audio = document.createElement('audio');
	const track = document.createElement('track');

	track.default = true;

	audio.append(track);

	return new Promise<VTTCue[]>((resolve, reject) => {
		track.addEventListener('load', () => resolve([...((audio.textTracks[0].cues || []) as VTTCue[])]));
		track.addEventListener('error', () => reject(new Error('Failed to load vtt track')));
		track.src = url;
	});
}

export async function verifyPermissions(
	handles: (FileSystemFileHandle | undefined)[],
	options: FileSystemHandlePermissionDescriptor = { mode: 'read' },
) {
	const checks: Promise<boolean>[] = [];

	for (let index = 0, { length } = handles; index < length; index += 1) {
		const handle = handles[index];

		if (handle) {
			checks.push(verifyPermission(handle, options));
		}
	}

	const gotAccesses = await Promise.all(checks);

	if (gotAccesses.some((access) => !access)) {
		throw new Error('File access not granted');
	}

	return true;
}

export async function updateSubtitles(file: File, document: Document, updateContext = false) {
	const subtitles = new Map<string, Subtitle>();

	let subUrl = '';

	try {
		paused$.set(true);

		const subtitlesGlobalStartPadding = get(settings$.subtitlesGlobalStartPadding$) / 1000;
		const subtitlesGlobalEndPadding = get(settings$.subtitlesGlobalEndPadding$) / 1000;
		const duration = get(duration$);

		if (file.name.endsWith('.srt') || file.name.endsWith('.txt')) {
			const parser = new srtParser2();
			const fileContent = await readFile(file);
			const parsingResults = [...parser.fromSrt(fileContent)];

			for (let index = 0, { length } = parsingResults; index < length; index += 1) {
				const parsingResult = parsingResults[index];
				const startSeconds = Math.max(0, parsingResult.startSeconds + subtitlesGlobalStartPadding);
				const endSeconds = duration
					? between(0, duration, parsingResult.endSeconds + subtitlesGlobalEndPadding)
					: Math.max(0, parsingResult.endSeconds + subtitlesGlobalEndPadding);
				const text = parsingResult.text.trim();

				subtitles.set(parsingResult.id, {
					id: parsingResult.id,
					originalStartSeconds: parsingResult.startSeconds,
					startSeconds,
					startTime: toTimeStamp(startSeconds),
					originalEndSeconds: parsingResult.endSeconds,
					endSeconds,
					endTime: toTimeStamp(endSeconds),
					originalText: text,
					text,
					subIndex: index,
				});
			}
		} else if (file.name.endsWith('.vtt')) {
			subUrl = URL.createObjectURL(file);

			const cues = await getVTTCues(subUrl, document);

			for (let index = 0, { length } = cues; index < length; index += 1) {
				const cue = cues[index];
				const id = `${index + 1}`;
				const startSeconds = Math.max(0, cue.startTime + subtitlesGlobalStartPadding);
				const endSeconds = duration
					? between(0, duration, cue.endTime + subtitlesGlobalEndPadding)
					: Math.max(0, cue.endTime + subtitlesGlobalEndPadding);
				const text = cue.text.trim();

				subtitles.set(id, {
					id,
					originalStartSeconds: cue.startTime,
					startSeconds,
					startTime: toTimeStamp(startSeconds),
					originalEndSeconds: cue.endTime,
					endSeconds,
					endTime: toTimeStamp(endSeconds),
					originalText: text,
					text,
					subIndex: index,
				});
			}
		} else {
			throw new Error('File needs to be .srt,.txt or .vtt');
		}

		if (updateContext) {
			setSubtitleContext(file, subtitles);
		}

		return subtitles;
	} finally {
		URL.revokeObjectURL(subUrl);
	}
}

export function setSubtitleContext(
	newSubtitleFile: File | undefined = undefined,
	newSubtitles = new Map<string, Subtitle>(),
) {
	bookmarkedSubtitles$.set(new Set<string>());
	subtitlesForMerge$.set(new Set<string>());
	currentSubtitleFile$.set(newSubtitleFile);
	currentSubtitles$.set(newSubtitles);
	subtitleChange$.set({ subtitles: [...newSubtitles.values()], replaceTrack: true });
}

export async function updateAudio(
	file: File,
	sandboxElement: HTMLIFrameElement | undefined,
	updateContext = false,
	metadataOnly = false,
	oldCoverUrl = '',
	oldAudioSourceSource = '',
) {
	const enableCover = get(settings$.playerEnableCover$);
	const enableChapters = get(settings$.playerEnableChapters$);
	const errors: string[] = [];

	let coverUrl = '';
	let audioSourceUrl = '';
	let chapters: AudioChapter[] = [];
	let metadata: MediaInfoType | undefined;

	if (!metadataOnly) {
		paused$.set(true);

		if (get(settings$.exportAudioProcessor$) === AudioProcessor.FFMPEG) {
			await initializeFFMPEG().catch(({ message }) => errors.push(`FFMEPG failure: ${message}`));
		}
	}

	if (enableCover || enableChapters) {
		try {
			metadata = await (sandboxElement
				? interactWithSandbox<MediaInfoType>(sandboxElement, {
						action: 'getAudioMetadata',
						url: chrome.runtime.getURL('src/assets/js/MediaInfoModule_0.2.1.wasm'),
						file,
						enableCover,
					})
				: getAudioMetadata(file, enableCover));

			if (!metadata?.media) {
				throw new Error('No media metadata found');
			}

			const generalTrack = metadata.media.track.find((entry) => entry['@type'] === 'General');

			if (!generalTrack) {
				throw new Error('No general track found');
			}

			if (enableChapters) {
				for (let index = 0, { length } = metadata.media.track; index < length; index += 1) {
					const track = metadata.media.track[index];
					const extraKeys = Object.keys(track.extra || {});

					if (
						track['@type'] !== 'Menu' ||
						!extraKeys.length ||
						!extraKeys[0].match(/_(\d{2}_\d{2}_\d{2}_\d{3})/)
					) {
						continue;
					}

					for (let index2 = 0, { length: length2 } = extraKeys; index2 < length2; index2 += 1) {
						const extraKey = extraKeys[index2];
						const timeParts = extraKey.split('_');
						const label = track.extra![extraKey] as string;
						const startSeconds =
							Number.parseInt(timeParts[1], 10) * 3600 +
							Number.parseInt(timeParts[2], 10) * 60 +
							Number.parseInt(timeParts[3], 10) +
							Number.parseInt(timeParts[4], 10) / 1000;

						chapters.push({
							key: `${label}_${startSeconds}`,
							label,
							startSeconds,
							startText: toTimeString(startSeconds),
						});
					}
				}
			}

			if (enableCover) {
				coverUrl = getMediaInfoCover(generalTrack.Cover_Data);
			}
		} catch ({ message }: any) {
			errors.push(`MediaInfo failure: ${message}`);
		}
	}

	if (!metadataOnly) {
		try {
			audioSourceUrl = URL.createObjectURL(file);

			if (updateContext) {
				await setAudioContext(oldCoverUrl, oldAudioSourceSource, file, {
					coverUrl,
					chapters,
					audioSourceUrl,
				});
			}
		} catch ({ message }: any) {
			URL.revokeObjectURL(coverUrl);
			URL.revokeObjectURL(audioSourceUrl);

			errors.push(message);
		}
	}

	if (errors.length) {
		throw new Error(errors.join('; '));
	}

	return { coverUrl, audioSourceUrl, chapters };
}

export async function setAudioContext(
	oldCoverUrl: string,
	oldAudioSourceUrl: string,
	newAudioFile: File | undefined = undefined,
	audioResult: AudioResult = { coverUrl: '', chapters: [], audioSourceUrl: '' },
) {
	await putAudioFileInFFMPEG(newAudioFile);

	currentAudioLoaded$.set(false);
	currentAudioFile$.set(newAudioFile);
	currentCoverUrl$.set(audioResult.coverUrl);
	currentAudioSourceUrl$.set(audioResult.audioSourceUrl);
	currentAudioChapters$.set(audioResult.chapters);

	if (!newAudioFile) {
		activeSubtitle$.set({ previous: '', current: '', useTimeFallback: false });
	}

	URL.revokeObjectURL(oldCoverUrl);
	URL.revokeObjectURL(oldAudioSourceUrl);
}

export async function getFileHandle(
	window: Window & typeof globalThis,
	description: string,
	allowedExtensions: FileExtension[],
	oldHandle: FileSystemFileHandle | undefined,
) {
	const [handle] = await window.showOpenFilePicker({
		excludeAcceptAllOption: true,
		id: 'ttu-whispersync-file',
		types: [
			{
				description,
				accept: {
					'*/*': allowedExtensions,
				},
			},
		],
	});

	const hasAccess = await verifyPermission(handle);

	if (!hasAccess) {
		throw new Error('File access not granted');
	}

	const isSameEntry = await (oldHandle ? oldHandle.isSameEntry(handle) : Promise.resolve(false));

	let file: File | undefined;

	if (!isSameEntry) {
		file = await handle.getFile();
	}

	return { handle, file };
}
