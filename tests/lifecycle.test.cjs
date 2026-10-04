const test = require('node:test');
const assert = require('node:assert/strict');
const { load, dom } = require('./helpers.cjs');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const book = '<div class="book-content" style="color: rgb(0,0,0)">Book</div>';
const footer = '<div class="z-10 flex h-8 w-full"><span>Reader footer</span></div>';
function content(html = '', extension = false) {
	const env = dom(html);
	let created = 0,
		destroyed = 0;
	class Menu {
		constructor({ target, props }) {
			created++;
			this.element = env.document.createElement('button');
			this.element.textContent = 'Menu ' + props.currentBookId;
			this.element.dataset.testMenu = '';
			target.append(this.element);
		}
		$destroy() {
			destroyed++;
			this.element.remove();
		}
	}
	if (extension) env.window.chrome = { runtime: { id: 'test', getURL: () => 'about:blank' } };
	const loaded = load('src/content/content.ts', null, {
		...env,
		AudioBookMenu: Menu,
		pageStyles: '',
		defaultFooterActionList: new Map(),
		chrome: env.window.chrome,
	});
	return {
		...loaded,
		...env,
		created: () => created,
		destroyed: () => destroyed,
		close() {
			loaded.run('observer.disconnect(); clearTimeout(observerTimer)');
			env.window.close();
		},
	};
}
test('menu mounts when the footer appears after the book', async () => {
	const c = content(book);
	try {
		assert.equal(c.created(), 0);
		c.document.body.insertAdjacentHTML('beforeend', footer);
		await sleep(150);
		assert.equal(c.created(), 1);
		c.document.body.dataset.updated = 'true';
		await sleep(150);
		assert.equal(c.created(), 1);
	} finally {
		c.close();
	}
});
test('quick route changes do not lose the latest state or duplicate the menu', async () => {
	const c = content();
	try {
		c.window.history.pushState({}, '', '/');
		c.document.body.insertAdjacentHTML('beforeend', book + footer);
		c.window.history.pushState({}, '', '/b?id=2');
		await sleep(150);
		assert.equal(c.created(), 1);
		assert.equal(c.document.querySelector('[data-test-menu]').textContent, 'Menu 2');
		c.window.history.pushState({}, '', '/b?id=3');
		c.document.body.dataset.book = '3';
		await sleep(150);
		assert.equal(c.destroyed(), 1);
		assert.equal(c.created(), 2);
		assert.equal(c.document.querySelectorAll('[data-test-menu]').length, 1);
	} finally {
		c.close();
	}
});
test('leaving during sandbox initialization cancels the stale mount', async () => {
	const c = content(book + footer, true);
	try {
		const stale = c.document.querySelector('iframe');
		c.window.history.pushState({}, '', '/');
		await c.ctx.reconcileReader();
		stale.dispatchEvent(new c.window.Event('load'));
		await sleep(10);
		assert.equal(c.created(), 0);
		assert.equal(stale.isConnected, false);
		c.window.history.pushState({}, '', '/b?id=2');
		const pending = c.ctx.reconcileReader();
		c.document.querySelector('iframe').dispatchEvent(new c.window.Event('load'));
		await pending;
		assert.equal(c.created(), 1);
	} finally {
		c.close();
	}
});
test('dropzone accepts uppercase files without native filesystem globals', async () => {
	const u = load('src/lib/util.ts', ['getFileExtension']).ctx;
	const { ctx } = load(
		'src/components/Dropzone.svelte',
		['processEntry', 'getFileFromEntry', 'extendFile', 'isFileSystemFileEntry', 'isFileSystemDirectoryEntry'],
		{
			getFileExtension: u.getFileExtension,
			formats: new Set(['.mp3', '.srt']),
			formatRegex: undefined,
			oldFiles: [],
			oldHandles: [],
			allowRootFiles: true,
		},
	);
	const entry = {
		isFile: true,
		name: 'BOOK.MP3',
		fullPath: '/BOOK.MP3',
		file: (resolve) => resolve({ name: 'BOOK.MP3', type: 'audio/mpeg' }),
	};
	const result = await ctx.processEntry(entry);
	assert.equal(result.files.length, 1);
	assert.equal(result.files[0].extension, '.mp3');
	const rejected = await ctx.processEntry({ ...entry, name: 'BOOK.exe' });
	assert.match(rejected.errors[0], /Unsupported file type/);
});
