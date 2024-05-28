import { getAudioMetadata, setMediaInfoInstance } from '../lib/mediaInfo';

async function handleMessage({ data, ports }: MessageEvent) {
	try {
		if (data.action === 'getAudioMetadata') {
			const metadata = await getAudioMetadata(data.file, data.enableCover, data.url);

			ports[0].postMessage(metadata);
		} else if (data.action === 'setMediaInfoInstance') {
			await setMediaInfoInstance(data.enableCover, true, data.url);

			ports[0].postMessage('');
		} else {
			ports[0].postMessage({ error: 'Unsupported action' });
		}
	} catch ({ message }: any) {
		ports[0].postMessage({ error: message });
	}
}

window.addEventListener('message', handleMessage, false);
