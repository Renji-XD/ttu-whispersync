import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from '../package.json';

const { version, name, description } = packageJson;
const [major, minor, patch] = version.replace(/[^\d.-]+/g, '').split(/[.-]/);

export default defineManifest(async () => ({
	manifest_version: 3,
	name: name,
	description: description,
	version: `${major}.${minor}.${patch}`,
	version_name: version,
	minimum_chrome_version: '122',
	key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA24szbB0LRkcgKhGGWudiZHX35Z9EdaY5CRW63R7gziHvlCBixzU4R6QBRK9tw1JJTs7g0e3gW1w4kkxDf9MhMSrqXfiQppZe3xKpdvhAKjuJF5k6n1qK3498iA5jOB+5O7Q75jYcQQBMQgeF1NR8ZJhO2qIoAwb5uwEy0KICpxbkgoxnUrRkeW+Em0qlSoDrhJv6GcdM7EZ+FNyitYoyvxn9XfISPyCO/TMkTS28BXJN0UPX0c+QFLFFfTNmHoNvkdHB1wYMpL0MvxmUEtNA+jizRyG+y1ryGD/CiVna0/YBtFroaGvGPnichelvpGjpLCOO7oU+x+Y686JySDUfdQIDAQAB',
	icons: {
		'64': 'src/assets/icons/icon64.png',
		'128': 'src/assets/icons/icon128.png',
		'256': 'src/assets/icons/icon256.png',
	},
	content_scripts: [
		{
			matches: ['https://reader.ttsu.app/*', 'http://localhost:5173/*'],
			js: ['src/content/content.ts'],
			run_at: 'document_idle',
		},
	],
	sandbox: {
		pages: ['src/sandbox/sandbox.html'],
	},
	web_accessible_resources: [
		{
			matches: ['https://reader.ttsu.app/*', 'http://localhost:5173/*'],
			resources: [
				'src/sandbox/sandbox.html',
				'src/assets/js/ffmpeg-core.js',
				'src/assets/js/ffmpeg-core.wasm',
				'src/assets/js/MediaInfoModule_0.2.1.wasm',
			],
		},
	],
}));
