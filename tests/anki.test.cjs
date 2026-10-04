const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { load, store, get, sub } = require('./helpers.cjs');

function anki(options = {}) {
	const u = load('src/lib/util.ts', ['throwIfAborted', 'normalizeAnkiTag', 'caluclatePercentage']).ctx;
	const values = {
		exportAudioProcessor$: 'ffmpeg',
		exportAudioFormat$: 'mp3',
		exportAudioBitrate$: 128,
		exportFieldMode$: 'replace',
		exportCoverFormat$: 'auto',
		ankiTagList$: '',
		ankiDuplicateMode$: 'disabled',
		ankiDeck$: 'Deck',
		ankiModel$: 'Model',
		ankiSentenceField$: 'Sentence',
		ankiSoundField$: 'Audio',
		ankiCoverField$: '',
		ankiUrl$: 'http://mock/',
		...options.settings,
	};
	const stores = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, store(v)]));
	const settings$ = new Proxy(stores, { get: (obj, key) => obj[key] ?? (obj[key] = store(false)) });
	const media = new Map(),
		notes = [],
		calls = [];
	let cleaned = 0;
	const globals = {
		...u,
		get,
		settings$,
		window: { crypto: crypto.webcrypto },
		AudioProcessor: { FFMPEG: 'ffmpeg' },
		AnkiDuplicateMode: { DISABLED: 'disabled' },
		ExportFieldMode: { BEFORE: 'before', AFTER: 'after' },
		ImageFormat: { AUTO: 'auto' },
		currentSubtitleFile$: store({ name: 'book.srt' }),
		currentAudioFile$: store({ name: 'book.mp3' }),
		currentCoverUrl$: store(options.cover ? 'blob:cover' : ''),
		isAnkiconnectAndroid$: store(false),
		lastError$: store(''),
		exportProgress$: store(0),
		exportCancelController$: store(),
		paused$: store(true),
		lastExportedCardId$: store(0),
		subtitlesForMerge$: store(new Set(['1', '2'])),
		cleanFiles: async () => {
			cleaned++;
		},
		getAudio: async (_, subs) =>
			Buffer.from(subs.map((s) => `${s.id}:${s.startSeconds}-${s.endSeconds}`).join(',')),
		fetch: async (url, init) => {
			if (url === 'blob:cover')
				return { ok: true, blob: async () => new Blob(['image'], { type: 'image/jpeg' }) };
			const body = JSON.parse(init.body);
			calls.push(body);
			if (options.fetch) return options.fetch(body, init);
			let result = null;
			switch (body.action) {
				case 'requestPermission':
					result = { permission: 'granted' };
					break;
				case 'apiReflect':
					result = {};
					break;
				case 'multi':
					result = [['Deck'], ['Model']];
					break;
				case 'modelFieldNames':
					result = ['Sentence', 'Audio', 'Cover'];
					break;
				case 'guiSelectedNotes':
					result = [99];
					break;
				case 'storeMediaFile': {
					let name = body.params.filename;
					if (media.has(name) && body.params.deleteExisting === false && media.get(name) !== body.params.data)
						name = name.replace(/\./, `-${media.size}.`);
					media.set(name, body.params.data);
					result = name;
					break;
				}
				case 'addNote':
					notes.push(body.params.note);
					result = 100 + notes.length;
					break;
			}
			return { ok: true, json: async () => ({ result, error: null }) };
		},
	};
	const { ctx, run } = load('src/lib/anki.ts', null, globals);
	return { ctx, run, stores, media, notes, calls, cleaned: () => cleaned };
}
test('repeated export does not overwrite audio used by existing notes', async () => {
	const a = anki();
	await a.ctx.exportToAnki([[sub(1, 'first', 0, 2)]], false, false);
	const original = [...a.media.values()][0];
	await a.ctx.exportToAnki([[sub(1, 'edited', 5, 8)]], false, false);
	assert.equal(a.notes.length, 2);
	assert.equal(a.media.size, 2);
	assert.notEqual(a.notes[0].fields.Audio, a.notes[1].fields.Audio);
	assert.equal([...a.media.values()][0], original);
});
test('different merge selections with equal endpoints have distinct audio references', async () => {
	const a = anki();
	const lines = [sub(1, 'a'), sub(2, 'b'), sub(3, 'c')];
	await a.ctx.exportToAnki([lines], false, true);
	await a.ctx.exportToAnki([[lines[0], lines[2]]], false, true);
	assert.notEqual(a.notes[0].fields.Audio, a.notes[1].fields.Audio);
});
test('cover fallback has a name and opts out of overwriting', async () => {
	const a = anki({ cover: true, settings: { ankiCoverField$: 'Cover' } });
	a.ctx.window.crypto = undefined;
	await a.ctx.exportToAnki([[sub(1, 'a')]], false, false);
	const cover = a.calls.find((c) => c.action === 'storeMediaFile' && c.params.filename.endsWith('.jpeg'));
	assert.equal(cover.params.filename, 'book_cover.jpeg');
	assert.equal(cover.params.deleteExisting, false);
});
test('Anki network failure preserves configured deck, model and fields', async () => {
	const a = anki({
		fetch: async () => {
			throw new Error('Failed to fetch');
		},
	});
	await a.ctx.exportToAnki([[sub(1, 'a')]], false, false);
	assert.equal(a.stores.ankiDeck$.value, 'Deck');
	assert.equal(a.stores.ankiModel$.value, 'Model');
	assert.equal(a.stores.ankiSentenceField$.value, 'Sentence');
	assert.equal(a.stores.ankiSoundField$.value, 'Audio');
	assert.match(a.ctx.lastError$.value, /Failed to fetch/);
	assert.equal(a.cleaned(), 1);
});
test('Settings refresh failure preserves stored selections', async () => {
	const globals = {
		$isLoading$: false,
		$lastError$: '',
		ankiDecks: [],
		ankiModels: [],
		ankiFields: [],
		ankiModelFields: new Map(),
		$ankiUrl$: 'mock',
		getDecksAndModels: async () => {
			throw new Error('offline');
		},
		showAnkiCreateSettings: true,
	};
	const { ctx } = load('src/components/Settings.svelte', ['onFetchAnkiData', 'resetAnkiData'], globals);
	await ctx.onFetchAnkiData(true);
	assert.match(ctx.$lastError$, /offline/);
	assert.equal(ctx.$isLoading$, false);
});
test('cancel between batch items cleans files, restores selection and records the completed note', async () => {
	const a = anki();
	a.ctx.exportProgress$.set = (value) => {
		if (value > 0) a.ctx.exportCancelController$.value.abort(new Error('canceled'));
	};
	await a.ctx.exportToAnki([[sub(1, 'a')], [sub(2, 'b')]], false, false);
	assert.equal(a.notes.length, 1);
	assert.equal(a.cleaned(), 1);
	assert.equal(a.ctx.lastExportedCardId$.value, 101);
	assert.ok(a.calls.some((c) => c.action === 'guiSelectNote' && c.params.note === 99));
	assert.equal(a.ctx.lastError$.value, '');
});
test('cancel does not clear a merge selection', async () => {
	const a = anki({ settings: { exportEnableMergeSelectionAutoClear$: true } });
	a.ctx.exportProgress$.set = (value) => {
		if (value > 0) a.ctx.exportCancelController$.value.abort(new Error('canceled'));
	};
	await a.ctx.exportToAnki([[sub(1, 'a'), sub(2, 'b')]], false, true);
	assert.equal(a.ctx.subtitlesForMerge$.value.size, 2);
});
test('in-flight HTTP requests abort immediately', async () => {
	let fetched;
	const ready = new Promise((resolve) => {
		fetched = resolve;
	});
	const a = anki({
		fetch: async (_, init) =>
			new Promise((_, reject) => {
				init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
				fetched();
			}),
	});
	const controller = new AbortController();
	const pending = a.ctx.request('mock', {}, false, controller.signal);
	await ready;
	controller.abort(new Error('canceled'));
	await assert.rejects(pending, /canceled/);
});
test('HTTP requests have a deadline even without user cancellation', async () => {
	const a = anki({
		fetch: async (_, init) =>
			new Promise((_, reject) => {
				init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
			}),
	});
	a.ctx.setTimeout = (fn) => setTimeout(fn, 5);
	await assert.rejects(a.ctx.request('mock', {}, false), /timed out/);
});
test('unavailable actions do not unexpectedly open the Anki browser', async () => {
	let opened = 0;
	const keys = [
		'NONE',
		'TOGGLE_PLAYBACK',
		'RESTART_PLAYBACK',
		'TOGGLE_PLAY_PAUSE',
		'TOGGLE_PLAYBACK_LOOP',
		'TOGGLE_BOOKMARK',
		'TOGGLE_SHOW_BOOKMARKED',
		'TOGGLE_MERGE',
		'TOGGLE_SHOW_FOR_MERGE',
		'EDIT_SUBTITLE',
		'ALIGN_SUBTITLE',
		'RESTORE_SUBTITLE',
		'COPY_SUBTITLE',
		'PREVIOUS_SUBTITLE',
		'NEXT_SUBTITLE',
		'EXPORT_NEW',
		'EXPORT_UPDATE',
		'OPEN_LAST_EXPORTED_CARD',
		'CANCEL_EXPORT',
	];
	const { ctx } = load('src/lib/actions.ts', ['executeAction'], {
		get,
		Action: Object.fromEntries(keys.map((k) => [k, k])),
		exportCancelController$: store(),
		skipKeyListener$: store(false),
		isRecording$: store(false),
		canExportToAnki$: store(false),
		bookMatched$: store({ matchedBy: '' }),
		settings$: { ankiUrl$: store('mock') },
		openGUIForNote: async () => {
			opened++;
		},
	});
	await ctx.executeAction('EXPORT_NEW', sub(1, 'a'));
	await ctx.executeAction('ALIGN_SUBTITLE', sub(1, 'a'));
	assert.equal(opened, 0);
	await ctx.executeAction('OPEN_LAST_EXPORTED_CARD', sub(1, 'a'));
	assert.equal(opened, 1);
});
