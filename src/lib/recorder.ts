import * as lamejs from '@breezystack/lamejs';

import { MediaRecorder as Recorder, register } from 'extendable-media-recorder';

import { connect } from 'extendable-media-recorder-wav-encoder';

const audioStreams = new WeakMap<HTMLAudioElement, MediaStream>();

let registeredRecorder = false;
let mediaRecorder: MediaRecorder | undefined;
let audioBlobs: Blob[] = [];

function convertChannelData(value: number) {
	const convertedValue = value < 0 ? value * 32768 : value * 32767;

	return Math.max(-32768, Math.min(32768, convertedValue));
}

export async function startRecording(audioElement: HTMLAudioElement) {
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

	let stream = audioStreams.get(audioElement);

	if (!stream) {
		const audioContext = new AudioContext();
		const source = audioContext.createMediaElementSource(audioElement);

		source.connect(audioContext.destination);

		const streamDestination = audioContext.createMediaStreamDestination();

		source.connect(streamDestination);

		stream = streamDestination.stream;

		audioStreams.set(audioElement, stream);
	}

	mediaRecorder = new Recorder(stream, {
		mimeType: 'audio/wav',
	}) as MediaRecorder;

	mediaRecorder.addEventListener('dataavailable', (event) => {
		audioBlobs.push(event.data);
	});

	mediaRecorder.start();
}

export function stopRecording(kbps: number, canceled = false) {
	return new Promise<ArrayBuffer | undefined>((resolve, reject) => {
		if (!mediaRecorder) {
			return resolve(undefined);
		}

		mediaRecorder.addEventListener('stop', async () => {
			if (!mediaRecorder || canceled || !audioBlobs.length) {
				return resolve(undefined);
			}

			try {
				const mp3Data = [];
				const sampleBlockSize = 1152;
				const mimeType = mediaRecorder.mimeType;
				const audioContext = new AudioContext();
				const audioBlob = new Blob(audioBlobs, { type: mimeType });
				const blobBuffer = await audioBlob.arrayBuffer();
				const audioBuffer = await audioContext.decodeAudioData(blobBuffer);
				const leftChannelData = audioBuffer.getChannelData(0);
				const rightChannelData = audioBuffer.getChannelData(1);
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
			}
		});

		mediaRecorder.stop();
	}).finally(() => {
		mediaRecorder = undefined;
		audioBlobs = [];
	});
}
