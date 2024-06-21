import type { AudioChapter, Subtitle } from './general';
import { AudioFormat, AudioProcessor } from './settings';
import { throwIfAborted, toTimeString } from './util';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import ffmpegWorker from '../assets/js/ffmpeg.worker?url';
import { get } from 'svelte/store';
import { settings$ } from './stores';

const ffmpeg = new FFmpeg();
const isChromeExtension = !!window.chrome && !!chrome.runtime && chrome.runtime.id;
const libMap = new Map<string, string>([
	['ogg', 'libvorbis'],
	['opus', 'opus'],
	['mp3', 'libmp3lame'],
]);
const chapterTimeMatchRegex = /chapter.+start (\d+\.\d+), end/i;
const chapterLabelMatchRegex = /title.+:(.+)/i;

let lastParsedChapter: AudioChapter = { key: '', label: '', startSeconds: 0, startText: '' };
let parsedChapters: AudioChapter[] = [];
let waitForChapter = true;

function toBlobURL(url: string, type: string) {
	return fetch(url)
		.then((response) => {
			if (!response.ok) {
				throw new Error(`Failed to download from ${url}`);
			}

			return response.arrayBuffer();
		})
		.then((buffer: ArrayBuffer) => {
			const blob = new Blob([buffer], { type });

			return URL.createObjectURL(blob);
		});
}

function getUrl(fileName: string, type = 'text/javascript') {
	if (fileName === ffmpegWorker) {
		return toBlobURL(ffmpegWorker, type);
	}

	return isChromeExtension
		? toBlobURL(chrome.runtime.getURL(`src/assets/js/${fileName}`), type)
		: window.GM_getResourceURL(fileName);
}

function handleFFMPEGLogForChapterData(event: { type: string; message: string }) {
	try {
		if (waitForChapter) {
			const chapterTimeMatch = event.message.match(chapterTimeMatchRegex);

			if (chapterTimeMatch?.length === 2) {
				const startSeconds = Number.parseFloat(chapterTimeMatch[1]);

				lastParsedChapter.startSeconds = startSeconds;

				waitForChapter = false;
			}
		} else if (!waitForChapter) {
			const chapterLabelMatch = event.message.match(chapterLabelMatchRegex);

			if (chapterLabelMatch?.length === 2) {
				const label = chapterLabelMatch[1].trim();
				const { startSeconds } = lastParsedChapter;

				lastParsedChapter = {
					key: `${label}_${startSeconds}`,
					label,
					startSeconds,
					startText: toTimeString(startSeconds),
				};

				parsedChapters.push(lastParsedChapter);

				resetChapterData();
			}
		}
	} catch (_) {
		resetChapterData();
	}
}

function resetChapterData(resetParsedChapters = false) {
	lastParsedChapter = { key: '', label: '', startSeconds: 0, startText: '' };
	waitForChapter = true;

	if (resetParsedChapters) {
		parsedChapters = [];
	}
}

function handleFFMPEGLog(event: { type: string; message: string }) {
	console.log(event.type, event.message);
}

export async function initializeFFMPEG() {
	if (ffmpeg.loaded) {
		return;
	}

	const blobUrls: string[] = [];

	try {
		const errors: string[] = [];
		const results = await Promise.allSettled([
			getUrl('ffmpeg-core.js'),
			getUrl('ffmpeg-core.wasm', 'application/wasm'),
			getUrl(ffmpegWorker),
		]);

		for (let index = 0, { length } = results; index < length; index += 1) {
			const result = results[index];

			if (result.status === 'rejected') {
				errors.push(result.reason.message);
			} else {
				blobUrls.push(result.value);
			}
		}

		if (errors.length) {
			throw new Error(errors.join('; '));
		}

		await ffmpeg.load({
			coreURL: blobUrls[0],
			wasmURL: blobUrls[1],
			classWorkerURL: blobUrls[2],
		});
	} catch ({ message }: any) {
		settings$.exportAudioProcessor$.set(AudioProcessor.RECORDER);

		throw new Error(`Error loading FFMPEG - ${message}`);
	} finally {
		for (let index = 0, { length } = blobUrls; index < length; index += 1) {
			URL.revokeObjectURL(blobUrls[index]);
		}
	}
}

export async function putAudioFileInFFMPEG(audioFile: File | undefined) {
	if (!ffmpeg.loaded) {
		return;
	}

	try {
		await cleanFiles(true);

		if (audioFile) {
			const fileExtension = audioFile.name.split('.').pop();
			const buffer = await audioFile.arrayBuffer();

			await ffmpeg.writeFile(`audio_input.${fileExtension}`, new Uint8Array(buffer));
		}
	} catch ({ message }: any) {
		throw new Error(`Failed to update files in FFMPEG - ${message}`);
	}
}

export async function cleanFiles(cleanInput = false) {
	if (!ffmpeg.loaded) {
		return;
	}

	const entries = await ffmpeg.listDir('/');
	const audioFiles = entries.filter(
		(entry) =>
			!entry.isDir &&
			((cleanInput && entry.name.startsWith('audio_input')) || entry.name.startsWith('audio_output')),
	);

	return Promise.allSettled(audioFiles.map((audioFile) => ffmpeg.deleteFile(audioFile.name)));
}

export async function getChapterData(audioFile: File) {
	resetChapterData(true);

	if (!ffmpeg.loaded) {
		return parsedChapters;
	}

	try {
		const fileExtension = audioFile.name.split('.').pop();
		const ffmpegArguments = ['-hide_banner', '-y', '-i', `audio_input.${fileExtension}`];

		ffmpeg.on('log', handleFFMPEGLogForChapterData);

		await ffmpeg.exec(ffmpegArguments);
	} catch ({ message }: any) {
		console.log(`Failed to get chapter data with ffmpeg: ${message}`);
	}

	ffmpeg.off('log', handleFFMPEGLogForChapterData);

	return parsedChapters;
}

export async function getAudio(
	audioFile: File,
	subtitles: Subtitle[],
	executeCleanFiles = true,
	abortSignal: AbortSignal | undefined = undefined,
	audioFormat = 'mp3',
	audioBitrate = 128,
	forExport = false,
) {
	const fileExtension = audioFile.name.split('.').pop();
	const enableFFMPEGLog = get(settings$.enableFFMPEGLog$);
	const finalOutput = subtitles.length === 1 ? `audio_output_0.${audioFormat}` : `audio_output.${audioFormat}`;

	let failure = '';
	let filterInput = '';
	let mergeInputs = [];
	let buffer: ArrayBufferLike | undefined;

	try {
		if (enableFFMPEGLog) {
			ffmpeg.on('log', handleFFMPEGLog);
		}

		for (let index = 0, { length } = subtitles; index < length; index += 1) {
			throwIfAborted(abortSignal);

			const subtitle = subtitles[index];
			const output = `audio_output_${index}.${audioFormat}`;
			const ffmpegArguments = [
				'-hide_banner',
				'-y',
				'-ss',
				`${subtitle.startSeconds}`,
				'-i',
				`audio_input.${fileExtension}`,
				'-t',
				`${subtitle.endSeconds - subtitle.startSeconds}`,
				...(audioFormat === AudioFormat.OPUS ? ['-strict', '-2'] : []),
				'-vn',
				'-acodec',
				libMap.get(audioFormat) || 'libmp3lame',
				...(forExport ? ['-b:a', `${audioBitrate}k`] : []),
				'-write_xing',
				'0',
				output,
			];

			if (enableFFMPEGLog) {
				console.log(ffmpegArguments);
			}

			mergeInputs.push('-i', output);

			filterInput += `[${index}:a]`;

			await ffmpeg.exec(ffmpegArguments);
		}

		if (subtitles.length > 1) {
			mergeInputs.push('-filter_complex');

			filterInput = `${filterInput}concat=n=${subtitles.length}:v=0:a=1`;

			const ffmpegArguments = [
				'-hide_banner',
				'-y',
				...mergeInputs,
				filterInput,
				...(audioFormat === AudioFormat.OPUS ? ['-strict', '-2'] : []),
				'-vn',
				'-acodec',
				libMap.get(audioFormat) || 'libmp3lame',
				...(forExport ? ['-b:a', `${audioBitrate}k`] : []),
				'-write_xing',
				'0',
				finalOutput,
			];

			if (enableFFMPEGLog) {
				console.log(ffmpegArguments);
			}

			await ffmpeg.exec(ffmpegArguments);
		}

		const file = (await ffmpeg.readFile(finalOutput)) as Buffer;

		buffer = file.buffer;
	} catch (error: any) {
		if (!(abortSignal && abortSignal.aborted) && error.name !== 'AbortError') {
			failure =
				typeof error === 'string'
					? `Audio creation failed - ${error}`
					: `Audio creation failed${error.message ? ` - ${error.message}` : ''}`;
		}
	}

	if (executeCleanFiles) {
		await cleanFiles();
	}

	if (enableFFMPEGLog) {
		ffmpeg.off('log', handleFFMPEGLog);
	}

	if (failure) {
		throw new Error(failure);
	}

	throwIfAborted(abortSignal);

	return buffer;
}

export function terminateFFMPEG() {
	if (ffmpeg.loaded) {
		ffmpeg.terminate();
	}
}
