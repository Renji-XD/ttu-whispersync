import { dirname, join } from 'path';

import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { writeFileSync } from 'fs';

const outDir = 'violent_monkey';
const outName = 'ttu-whispersync.iife.js';
const header = `// ==UserScript==
// @author      Renji-xD
// @name        ttu-whispersync
// @namespace   https://github.com/Renji-XD
// @match       https://reader.ttsu.app/*
// @match       http://localhost:5173/*
// @version     1.0.0
// @description Listen to audiobooks with ttu ebook-reader
// @icon https://raw.githubusercontent.com/Renji-XD/ttu-whispersync/main/src/assets/icons/icon64.png
// @run-at      document-idle
// @noframes
// @grant       none
// @downloadURL https://raw.githubusercontent.com/Renji-XD/ttu-whispersync/main/violent_monkey/ttu-whispersync.iife.js
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
			lib: { name: 'ttuWhispersync', entry: './src/content/content.ts', formats: ['iife'] },
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
