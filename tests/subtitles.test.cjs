const test = require('node:test');
const assert = require('node:assert/strict');
const { load, dom, store, get, sub } = require('./helpers.cjs');
const utils = load('src/lib/util.ts', [
	'getTimeParts',
	'toTimeStamp',
	'getFileExtension',
	'parseHTML',
	'normalizeAnkiTag',
	'waitForReaderEvent',
]);

test('timestamps carry rounded milliseconds into seconds, minutes and hours', () => {
	assert.equal(utils.ctx.toTimeStamp(3599.9996), '01:00:00,000');
	assert.equal(utils.ctx.toTimeStamp(59.9996), '00:01:00,000');
	assert.equal(utils.ctx.toTimeStamp(1.25), '00:00:01,250');
});
test('empty HTML produces a controlled error', () => {
	assert.throws(() => utils.ctx.parseHTML(new (dom().DOMParser)(), ''), /Failed to parse html/);
});
test('tags normalize Unicode whitespace', () => {
	assert.equal(utils.ctx.normalizeAnkiTag(' 吾輩は　猫である\t第一章 '), '吾輩は_猫である_第一章');
});
test('reader sync wait times out and removes its listener', async () => {
	const { document, CustomEvent } = dom();
	const { ctx } = load('src/lib/util.ts', ['waitForReaderEvent'], { CustomEvent });
	let removed = 0;
	const original = document.removeEventListener.bind(document);
	document.removeEventListener = (...args) => {
		removed++;
		return original(...args);
	};
	await assert.rejects(ctx.waitForReaderEvent(document, 'ttsu:synced', 'waitForSync', 5), /did not respond/);
	assert.equal(removed, 1);
});
test('reader sync listener is installed before requesting sync', async () => {
	const { document, CustomEvent } = dom();
	const { ctx } = load('src/lib/util.ts', ['waitForReaderEvent'], { CustomEvent });
	document.addEventListener('ttu-action', () =>
		document.dispatchEvent(new CustomEvent('ttsu:synced', { detail: 42 })),
	);
	assert.equal(await ctx.waitForReaderEvent(document, 'ttsu:synced', 'waitForSync', 20), 42);
});
test('uppercase SRT imports all duplicate ids with dense navigation indexes', async () => {
	const Parser = require('srt-parser-2').default;
	const { ctx } = load('src/lib/files.ts', ['updateSubtitles'], {
		get,
		srtParser2: Parser,
		getFileExtension: utils.ctx.getFileExtension,
		paused$: store(false),
		duration$: store(0),
		settings$: { subtitlesGlobalStartPadding$: store(0), subtitlesGlobalEndPadding$: store(0) },
		toTimeStamp: utils.ctx.toTimeStamp,
		readFile: async () =>
			[1, 1, 2].map((id, i) => `${id}\n00:00:0${i},000 --> 00:00:0${i + 1},000\nline${i}\n`).join('\n'),
	});
	const result = await ctx.updateSubtitles({ name: 'BOOK.SRT' }, {});
	assert.equal(result.size, 3);
	assert.deepEqual(
		[...result.values()].map((s) => s.subIndex),
		[0, 1, 2],
	);
	assert.deepEqual(
		[...result.values()].map((s) => s.text),
		['line0', 'line1', 'line2'],
	);
	assert.equal(result.get('2').text, 'line2');
});
test('alignment keeps unmatched lines and preserves spaces in matched fragments', async () => {
	const lines = [sub(1, 'first'), sub(2, 'Unmatched')];
	const { ctx } = load('src/lib/actions.ts', ['executeAlignSubtitle'], {
		...dom(),
		get,
		lastError$: store(''),
		bookData$: store({
			elementHtml: '<div><span class="line1">Hello </span><span class="line1">world</span></div>',
		}),
		currentSubtitles$: store(new Map(lines.map((s) => [s.id, s]))),
		getLineCSSSelectorForId: (id) => `.line${id}`,
		allIgnoredElements: new Set(['rt', 'rp']),
		parseHTML: utils.ctx.parseHTML,
		settings$: { subtitlesEnablePersist$: store(false) },
	});
	await ctx.executeAlignSubtitle(lines, false);
	assert.equal(lines[0].text, 'Hello world');
	assert.equal(lines[1].text, 'Unmatched');
	// Restore a manually changed line even when the book equals originalText.
	lines[0].originalText = 'Hello world';
	lines[0].text = 'manual';
	await ctx.executeAlignSubtitle([lines[0]], false);
	assert.equal(lines[0].text, 'Hello world');
});

function matcher(lines, html) {
	const env = dom();
	const u = load(
		'src/lib/util.ts',
		[
			'parseHTML',
			'throwIfAborted',
			'caluclatePercentage',
			'getBaseLineCSSSelectorForId',
			'getSubtitleIdFromElement',
		],
		{ baseLineCSSClass: 'ttu-whispersync-line-highlight-' },
	).ctx;
	const names = [
		'onMatchSubtitles',
		'onSaveMatch',
		'getTextNode',
		'getTTUParent',
		'getSubtitleData',
		'getNormalizedLength',
		'normalizeString',
		'addNodeContentToMap',
		'getTextForComparison',
		'getSimilarity',
		'getSimilarityRanges',
		'findBestSimilarity',
		'updateSubtitlesForDownload',
		'throwMatchError',
	];
	const token = new AbortController();
	return load('src/components/Match.svelte', names, {
		...env,
		...u,
		$isLoading$: false,
		$lastError$: '',
		$currentSubtitles$: new Map(lines.map((s) => [s.id, s])),
		$currentSubtitleFile$: { name: 'book.srt' },
		$bookData$: { elementHtml: html },
		$matchLineMaxAttempts$: 10,
		$matchLineSimilarityThreshold$: 1,
		hasHint: false,
		ignoredTagsSelector: 'rt,rp',
		allIgnoredElements: new Set(['rt', 'rp']),
		cancelToken: token,
		cancelSignal: token.signal,
		currentProgress: 0,
		maxProgress: 0,
		lineMatchRate: '',
		bookSubtitleDiffRate: '',
		subtitlesForDownload: [],
		subtitleDiffDetails: [],
		unmatchedSubtitles: [],
		bookHTML: undefined,
	});
}
test('matching keeps every trailing unmatched subtitle in both downloads', async () => {
	const { ctx } = matcher(
		[sub(1, 'alpha'), sub(2, 'beta'), sub(3, 'gamma'), sub(4, 'delta')],
		'<div id="ttu-1"><p>alpha</p></div>',
	);
	await ctx.onMatchSubtitles();
	assert.equal(ctx.$lastError$, '');
	assert.deepEqual(
		Array.from(ctx.subtitlesForDownload, (s) => s.id),
		['1', '2', '3', '4'],
	);
	assert.deepEqual(
		Array.from(ctx.unmatchedSubtitles, (s) => s.id),
		['2', '3', '4'],
	);
});
test('repeated matching uses and retains the original book backup', async () => {
	const original = '<div id="ttu-1"><p>alpha</p></div>';
	const { ctx } = matcher(
		[sub(1, 'alpha')],
		'<div id="ttu-1"><p><span class="ttu-whispersync-line-highlight-99">alpha</span></p></div>',
	);
	ctx.$bookData$.htmlBackup = original;
	let saved;
	ctx.$booksDB$ = {
		put: async (_, value) => {
			saved = value;
		},
	};
	ctx.window = { location: { reload: () => {} } };
	await ctx.onMatchSubtitles();
	assert.equal(ctx.$lastError$, '');
	assert.equal(ctx.bookHTML.querySelector('.ttu-whispersync-line-highlight-99'), null);
	await ctx.onSaveMatch();
	assert.equal(saved.htmlBackup, original);
});
test('match hint ignores leading whitespace text nodes', () => {
	const { ctx } = matcher([], '<div/>');
	const parent = ctx.document.createElement('div');
	parent.innerHTML = '  <span>word</span>';
	assert.equal(ctx.getTextNode(parent).textContent, 'word');
});

test('incremental candidate scores agree with direct Dice comparisons for Unicode text', () => {
	const { ctx } = matcher([], '<div/>');
	const examples = [
		['hello', 'xx Hello, world!'],
		['a', '  a a '],
		['', ' \t'],
		['𠮷野家で食べる', '　𠮷野家で食べる。次の文'],
		['İstanbul', ' İstanbul, '],
		['ΟΣ', ' ΟΣ ΑΣ '],
		['banana', 'bananana'],
		['café', 'café\nCAFÉ'],
	];
	let seed = 42;
	const alphabet = [...'ab 𠮷日İ!?'];
	for (let i = 0; i < 80; i++) {
		const randomString = () =>
			Array.from({ length: 15 }, () => {
				seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
				return alphabet[seed % alphabet.length];
			}).join('');
		examples.push([randomString(), randomString()]);
	}
	for (const [target, candidate] of examples) {
		const characters = [...candidate];
		for (const trimStart of [false, true]) {
			for (const start of [0, 1]) {
				const end = characters.length;
				for (const [index, score] of ctx.getSimilarityRanges(target, characters, start, end, trimStart)) {
					const text = characters.slice(trimStart ? index : start, trimStart ? end : index).join('');
					assert.equal(score, ctx.getSimilarity(target, text), JSON.stringify({ target, text, index }));
				}
			}
		}
	}
});

test('a 22000-character cue can scan every prefix and suffix within a bounded process', () => {
	const { execFileSync } = require('node:child_process');
	execFileSync(
		process.execPath,
		[
			'-e',
			`
		const assert = require('node:assert/strict');
		const { load } = require('./tests/helpers.cjs');
		const { ctx } = load('src/components/Match.svelte', ['normalizeString', 'getSimilarity', 'getSimilarityRanges']);
		const text = 'a long subtitle sentence. '.repeat(900);
		const candidate = [...('missing introduction ' + text + ' extra ending')];
		for (const trimStart of [true, false]) {
			const scores = [...ctx.getSimilarityRanges(text, candidate, 0, candidate.length, trimStart)];
			assert.equal(scores.length, candidate.length);
			assert.ok(Math.max(...scores.map(s => s[1])) > 0.99);
		}
	`,
		],
		{ cwd: require('node:path').resolve(__dirname, '..'), timeout: 5000 },
	);
});

test('a long exact cue across inline elements preserves book text and subtitle timing', async () => {
	const text = 'A long passage with Unicode 𠮷. '.repeat(800);
	const { ctx } = matcher(
		[sub(1, text, 5, 10), sub(2, 'Next sentence.', 10, 12)],
		`<div id="ttu-1"><p><em>${text.slice(0, 500)}</em>${text.slice(500)}Next sentence.</p></div>`,
	);
	await ctx.onMatchSubtitles();
	assert.equal(ctx.$lastError$, '');
	assert.equal(ctx.unmatchedSubtitles.length, 0);
	assert.equal(ctx.bookHTML.textContent, text + 'Next sentence.');
	assert.equal(ctx.subtitlesForDownload[0].startSeconds, 5);
	assert.equal(ctx.subtitlesForDownload[0].endSeconds, 10);
});

test('cancel is handled during many failed attempts before progress reaches one percent', async () => {
	const lines = Array.from({ length: 10000 }, (_, i) => sub(i + 1, 'subtitle absent from the book'));
	const { ctx } = matcher(
		lines,
		'<div id="ttu-1">' + '<p>Entirely different passage with enough characters.</p>'.repeat(100) + '</div>',
	);
	ctx.console = { log: () => {} };
	const token = ctx.cancelToken;
	let progressAtCancel;
	setTimeout(() => {
		progressAtCancel = ctx.currentProgress;
		token.abort();
	}, 0);
	await ctx.onMatchSubtitles();
	assert.equal(progressAtCancel, 0);
	assert.equal(ctx.$isLoading$, false);
	assert.equal(ctx.$lastError$, '');
	assert.equal(ctx.bookHTML, undefined);
});
