const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');

// Run the source functions themselves. External browser and service boundaries
// are supplied by each test; no application logic is copied into the tests.
function load(file, names, globals = {}) {
	let code = fs.readFileSync(path.join(root, file), 'utf8');
	if (file.endsWith('.svelte')) code = code.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
	const ast = ts.createSourceFile(file + '.ts', code, ts.ScriptTarget.Latest, true);
	code = ast.statements
		.filter((n) =>
			names ? ts.isFunctionDeclaration(n) && names.includes(n.name?.text) : !ts.isImportDeclaration(n),
		)
		.map((n) => n.getText(ast).replace(/^export /, ''))
		.join('\n');
	const ctx = vm.createContext({
		console,
		setTimeout,
		clearTimeout,
		AbortController,
		URL,
		TextEncoder,
		Buffer,
		Blob,
		...globals,
	});
	vm.runInContext(
		ts.transpileModule(code, {
			compilerOptions: {
				target: ts.ScriptTarget.ES2022,
				module: ts.ModuleKind.None,
			},
		}).outputText,
		ctx,
		{ filename: file },
	);
	return { ctx, run: (code) => vm.runInContext(code, ctx) };
}
function dom(html = '') {
	const { window } = new JSDOM(html, { url: 'https://reader.ttsu.app/b?id=1' });
	return {
		window,
		document: window.document,
		DOMParser: window.DOMParser,
		Node: window.Node,
		NodeFilter: window.NodeFilter,
		HTMLElement: window.HTMLElement,
		HTMLSpanElement: window.HTMLSpanElement,
		CustomEvent: window.CustomEvent,
		MutationObserver: window.MutationObserver,
		getComputedStyle: window.getComputedStyle,
	};
}
const store = (value) => ({
	value,
	set(value) {
		this.value = value;
	},
});
const get = (s) => s.value;
const sub = (id, text, startSeconds = 0, endSeconds = 1) => ({
	id: String(id),
	text,
	originalText: text,
	startSeconds,
	endSeconds,
	originalStartSeconds: startSeconds,
	originalEndSeconds: endSeconds,
	startTime: '00:00:00,000',
	endTime: '00:00:01,000',
	subIndex: Number(id) - 1,
});
module.exports = { load, dom, store, get, sub };
