import { dirname, join } from 'path';

import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { writeFileSync } from 'fs';

const outDir = 'violent_monkey';
const outName = 'ttu-whispersync.user.js';
const header = `// ==UserScript==
// @author      Renji-xD
// @name        ttu-whispersync
// @namespace   https://github.com/Renji-XD
// @match       https://reader.ttsu.app/*
// @match       http://localhost:5173/*
// @version     1.0.9
// @description Listen to audiobooks with ttu ebook-reader
// @icon https://raw.githubusercontent.com/Renji-XD/ttu-whispersync/main/src/assets/icons/icon64.png
// @resource mediaInfo https://cdn.jsdelivr.net/npm/mediainfo.js@0.2.1/dist/MediaInfoModule.wasm
// @resource ffmpeg-core.js https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js
// @resource ffmpeg-core.wasm https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm
// @run-at      document-idle
// @noframes
// @grant       GM_getResourceURL
// @downloadURL https://github.com/Renji-XD/ttu-whispersync/releases/latest/download/ttu-whispersync.user.js
// @supportURL  https://github.com/Renji-XD/ttu-whispersync/issues
// @homepageURL https://github.com/Renji-XD/ttu-whispersync
// ==/UserScript==`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const filePath = join(__dirname, outDir, outName);

export default defineConfig((config) => {
	return {
		build: {
			outDir,
			emptyOutDir: true,
			lib: {
				name: 'ttuWhispersync',
				entry: './src/content/content.ts',
				formats: ['iife'],
				fileName: () => 'ttu-whispersync.user.js',
			},
			minify: config.mode === 'production',
		},
		plugins: [
			nodePolyfills(),
			svelte({ emitCss: false }),
			viteSingleFile(),
			(() => {
				{
					return {
						name: 'copy-header',
						writeBundle(_, id: any) {
							writeFileSync(filePath, `${header}\n${id[outName].code}`, { encoding: 'utf-8' });
						},
					};
				}
			})(),
		],
	};
});
