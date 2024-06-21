import { type MediaInfo, type MediaInfoType, type ReadChunkFunc } from 'mediainfo.js';
import MediaInfoFactory from 'mediainfo.js';

const imageMagicNumbers: Map<string, string> = new Map([
	['/9j/', 'image/jpg'],
	['iVBORw0KGgo', 'image/png'],
	['UklGR', 'image/webp'],
	['R0lGODdh', 'image/gif'],
	['R0lGODlh', 'image/gif'],
]);

let mediaInfoInstance: MediaInfo;

function getImageMimeType(base64: string | undefined) {
	if (!base64) {
		return undefined;
	}

	const magicNumberKeys = [...imageMagicNumbers.keys()];
	const imageMagicNumber = magicNumberKeys.find((magicNumberKey) => base64.startsWith(magicNumberKey)) || '';

	return imageMagicNumbers.get(imageMagicNumber);
}

export function setMediaInfoInstance(
	coverData: boolean,
	resetInstance: boolean,
	mediaInfoUrl: string | undefined,
): Promise<void> {
	return new Promise((resolve, reject) => {
		if (mediaInfoInstance && !resetInstance) {
			return resolve();
		}

		MediaInfoFactory(
			{
				coverData,
				format: 'object',
				locateFile: () => mediaInfoUrl || window.GM_getResourceURL('mediaInfo'),
			},
			(mediainfo: MediaInfo) => {
				if (mediaInfoInstance) {
					try {
						mediaInfoInstance.close();
					} catch (_) {
						// no-op
					}
				}

				mediaInfoInstance = mediainfo;

				resolve();
			},
			({ message }: any) => reject(new Error(`Failed to create MediaInfo instance - ${message}`)),
		);
	});
}

export async function getAudioMetadata(file: File, coverData: boolean, mediaInfoUrl = ''): Promise<MediaInfoType> {
	await setMediaInfoInstance(coverData, false, mediaInfoUrl);

	return new Promise<MediaInfoType>((resolve, reject) => {
		const getSize = () => file.size;
		const readChunk: ReadChunkFunc = (chunkSize, offset) =>
			new Promise((resolve, reject) => {
				const fileReader = new FileReader();

				fileReader.addEventListener('loadend', (event) => {
					if (!event.target) {
						return reject(new Error('No FileReader data'));
					} else if (event.target.error) {
						return reject(new Error(`Error reading file - ${event.target.error.message}`));
					}

					resolve(new Uint8Array(event.target.result as ArrayBuffer));
				});

				fileReader.addEventListener('error', () => {
					reject(new Error('Error reading file'));
				});

				fileReader.readAsArrayBuffer(file.slice(offset, offset + chunkSize));
			});

		mediaInfoInstance
			.analyzeData(getSize, readChunk)
			.then((metadata) => resolve(metadata))
			.catch(({ message }: any) => reject(new Error(`Failed to get audio metadata - ${message}`)));
	});
}

export function getMediaInfoCover(coverData: string | undefined) {
	if (!coverData) {
		return '';
	}

	const coverMimeType = getImageMimeType(coverData);

	return coverMimeType
		? URL.createObjectURL(
				new Blob([Buffer.from(coverData, 'base64')], {
					type: coverMimeType,
				}),
			)
		: '';
}
