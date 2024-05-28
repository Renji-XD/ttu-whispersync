import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import manifest from './src/manifest.config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	build: {
		emptyOutDir: true,
	},
	plugins: [nodePolyfills(), svelte(), crx({ manifest })],
	server: {
		port: 5170,
		strictPort: true,
		hmr: {
			clientPort: 5170,
		},
	},
});
