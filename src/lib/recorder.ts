import { throwIfAborted } from './util';
import * as lamejs from '@breezystack/lamejs';

import { MediaRecorder as Recorder, register } from 'extendable-media-recorder';

import { connect } from 'extendable-media-recorder-wav-encoder';

const audioStreams = new WeakMap<HTMLAudioElement, { stream: MediaStream; context: AudioContext }>();

let registeredRecorder = false;
let mediaRecorder: MediaRecorder | undefined;
let audioBlobs: Blob[] = [];
let stopPromise: Promise<ArrayBuffer | undefined> | undefined;

function convertChannelData(value: number) {
	const convertedValue = value < 0 ? value * 32768 : value * 32767;

	return Math.max(-32768, Math.min(32767, convertedValue));
}

export async function startRecording(audioElement: HTMLAudioElement, signal?: AbortSignal) {
	if (!audioElement) {
		throw new Error('Audio element not defined');
	}

	if (!registeredRecorder) {
		try {
			await register(await connect());
		} catch ({ message }: any) {
			throw new Error(`Failed to register recorder - ${message}`);
		}

		registeredRecorder = true;
	}

	throwIfAborted(signal);
	let audio = audioStreams.get(audioElement);

	if (!audio) {
		const audioContext = new AudioContext();
		const source = audioContext.createMediaElementSource(audioElement);

		source.connect(audioContext.destination);

		const streamDestination = audioContext.createMediaStreamDestination();

		source.connect(streamDestination);

		audio = { stream: streamDestination.stream, context: audioContext };

		audioStreams.set(audioElement, audio);
	}

	await audio.context.resume();
	throwIfAborted(signal);
	audioBlobs = [];
	mediaRecorder = new Recorder(audio.stream, {
		mimeType: 'audio/wav',
	}) as MediaRecorder;

	mediaRecorder.addEventListener('dataavailable', (event) => {
		audioBlobs.push(event.data);
	});

	mediaRecorder.start();
}

export function stopRecording(kbps: number, canceled = false) {
	if (stopPromise) return stopPromise;
	stopPromise = new Promise<ArrayBuffer | undefined>((resolve, reject) => {
		if (!mediaRecorder) {
			return resolve(undefined);
		}

		mediaRecorder.addEventListener('stop', async () => {
			if (!mediaRecorder || canceled || !audioBlobs.length) {
				return resolve(undefined);
			}

			let audioContext: AudioContext | undefined;
			try {
				audioContext = new AudioContext();
				const mp3Data = [];
				const sampleBlockSize = 1152;
				const mimeType = mediaRecorder.mimeType;
				const audioBlob = new Blob(audioBlobs, { type: mimeType });
				const blobBuffer = await audioBlob.arrayBuffer();
				const audioBuffer = await audioContext.decodeAudioData(blobBuffer);
				const leftChannelData = audioBuffer.getChannelData(0);
				const rightChannelData =
					audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannelData;
				const leftChannel = new Int16Array(leftChannelData.length);
				const rightChannel = new Int16Array(rightChannelData.length);
				const mp3Encoder = new lamejs.Mp3Encoder(audioBuffer.numberOfChannels, audioBuffer.sampleRate, kbps);

				for (let index = 0, { length } = leftChannel; index < length; index += 1) {
					leftChannel[index] = convertChannelData(leftChannelData[index]);
					rightChannel[index] = convertChannelData(rightChannelData[index]);
				}

				for (let index = 0, { length } = leftChannel; index < length; index += sampleBlockSize) {
					const leftChunk = leftChannel.subarray(index, index + sampleBlockSize);
					const rightChunk = rightChannel.subarray(index, index + sampleBlockSize);
					const encodedBuffer = mp3Encoder.encodeBuffer(leftChunk, rightChunk);

					if (encodedBuffer.length) {
						mp3Data.push(encodedBuffer);
					}
				}

				const mp3Buffer = mp3Encoder.flush();

				if (mp3Buffer.length) {
					mp3Data.push(mp3Buffer);
				}

				if (mp3Data.length) {
					const finalBuffer = await new Blob(mp3Data, { type: 'audio/mpeg' }).arrayBuffer();

					resolve(finalBuffer);
				} else {
					resolve(undefined);
				}
			} catch ({ message }: any) {
				reject(new Error(`Failed to stop recorder - ${message}`));
			} finally {
				await audioContext?.close().catch(() => {});
			}
		});

		if (mediaRecorder.state === 'inactive') resolve(undefined);
		else mediaRecorder.stop();
	}).finally(() => {
		mediaRecorder = undefined;
		audioBlobs = [];
		stopPromise = undefined;
	});
	return stopPromise;
}

export function releaseRecordingAudio(audioElement: HTMLAudioElement) {
	const audio = audioStreams.get(audioElement);
	if (audio) {
		for (const track of audio.stream.getTracks()) track.stop();
		void audio.context.close().catch(() => {});
		audioStreams.delete(audioElement);
	}
}
