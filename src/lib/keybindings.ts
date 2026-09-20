export enum KeybindCommand {
	TOGGLE_PLAYBACK = 'toggle-playback',
	RESTART_PLAYBACK = 'restart-playback',
	TOGGLE_PLAY_PAUSE = 'toggle-play-pause',
	TOGGLE_PLAYBACK_LOOP = 'toggle-playback-loop',
	PREVIOUS_SUBTITLE = 'previous-subtitle',
	NEXT_SUBTITLE = 'next-subtitle',
	DECREASE_PLAYBACK_RATE = 'decrease-playback-rate',
	INCREASE_PLAYBACK_RATE = 'increase-playback-rate',
	REWIND = 'rewind',
	REWIND_ALT = 'rewind-alt',
	FAST_FORWARD = 'fast-forward',
	FAST_FORWARD_ALT = 'fast-forward-alt',
	TOGGLE_BOOKMARK = 'toggle-bookmark',
	TOGGLE_MERGE = 'toggle-merge',
	EDIT_SUBTITLE = 'edit-subtitle',
	COPY_SUBTITLE = 'copy-subtitle',
	EXPORT_NEW = 'export-new',
	EXPORT_UPDATE = 'export-update',
	OPEN_LAST_EXPORTED_CARD = 'open-last-exported-card',
	TOGGLE_FOOTER_ACTIONS = 'toggle-footer-actions',
}

export interface Keybind {
	key: string;
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
	meta: boolean;
}

export interface KeybindingItem {
	command: KeybindCommand;
	keybind: Keybind | undefined;
}

export const isMacPlatform =
	typeof navigator !== 'undefined' &&
	(/Mac|iPad|iPhone|iPod/.test(navigator.platform || '') || /Mac OS X/.test(navigator.userAgent || ''));

export const keybindCommands: KeybindCommand[] = [
	KeybindCommand.TOGGLE_PLAYBACK,
	KeybindCommand.RESTART_PLAYBACK,
	KeybindCommand.TOGGLE_PLAY_PAUSE,
	KeybindCommand.TOGGLE_PLAYBACK_LOOP,
	KeybindCommand.PREVIOUS_SUBTITLE,
	KeybindCommand.NEXT_SUBTITLE,
	KeybindCommand.DECREASE_PLAYBACK_RATE,
	KeybindCommand.INCREASE_PLAYBACK_RATE,
	KeybindCommand.REWIND,
	KeybindCommand.REWIND_ALT,
	KeybindCommand.FAST_FORWARD,
	KeybindCommand.FAST_FORWARD_ALT,
	KeybindCommand.TOGGLE_BOOKMARK,
	KeybindCommand.TOGGLE_MERGE,
	KeybindCommand.EDIT_SUBTITLE,
	KeybindCommand.COPY_SUBTITLE,
	KeybindCommand.EXPORT_NEW,
	KeybindCommand.EXPORT_UPDATE,
	KeybindCommand.OPEN_LAST_EXPORTED_CARD,
	KeybindCommand.TOGGLE_FOOTER_ACTIONS,
];

export const keybindCommandLabels: Record<KeybindCommand, string> = {
	[KeybindCommand.TOGGLE_PLAYBACK]: 'Toggle playback',
	[KeybindCommand.RESTART_PLAYBACK]: 'Restart playback for active subtitle',
	[KeybindCommand.TOGGLE_PLAY_PAUSE]: 'Toggle play and pause for active subtitle',
	[KeybindCommand.TOGGLE_PLAYBACK_LOOP]: 'Toggle playback loop for active subtitle',
	[KeybindCommand.PREVIOUS_SUBTITLE]: 'Go to previous subtitle',
	[KeybindCommand.NEXT_SUBTITLE]: 'Go to next subtitle',
	[KeybindCommand.DECREASE_PLAYBACK_RATE]: 'Decrease playbackrate',
	[KeybindCommand.INCREASE_PLAYBACK_RATE]: 'Increase playbackrate',
	[KeybindCommand.REWIND]: 'Rewind',
	[KeybindCommand.REWIND_ALT]: 'Rewind #2',
	[KeybindCommand.FAST_FORWARD]: 'Fast-Forward',
	[KeybindCommand.FAST_FORWARD_ALT]: 'Fast-Forward #2',
	[KeybindCommand.TOGGLE_BOOKMARK]: 'Toggle bookmark for active subtitle',
	[KeybindCommand.TOGGLE_MERGE]: 'Toggle for merge for active subtitle',
	[KeybindCommand.EDIT_SUBTITLE]: 'Edit subtitle',
	[KeybindCommand.COPY_SUBTITLE]: 'Copy subtitle',
	[KeybindCommand.EXPORT_NEW]: 'Create new card for active subtitle',
	[KeybindCommand.EXPORT_UPDATE]: 'Update last created card for active subtitle',
	[KeybindCommand.OPEN_LAST_EXPORTED_CARD]: 'Open last exported card',
	[KeybindCommand.TOGGLE_FOOTER_ACTIONS]: 'Toggle visibility of footer actions',
};

/**
 * Defaults mirror the original hardcoded shortcuts - the Ctrl/Cmd family uses Cmd on macOS and Ctrl elsewhere
 */
const primary = isMacPlatform ? { meta: true } : { ctrl: true };
const defaultKeybinds: Record<KeybindCommand, Keybind | undefined> = {
	[KeybindCommand.TOGGLE_PLAYBACK]: createKeybind('j', { alt: true }),
	[KeybindCommand.RESTART_PLAYBACK]: createKeybind('d', primary),
	[KeybindCommand.TOGGLE_PLAY_PAUSE]: createKeybind('d', { alt: true }),
	[KeybindCommand.TOGGLE_PLAYBACK_LOOP]: createKeybind('l', primary),
	[KeybindCommand.PREVIOUS_SUBTITLE]: createKeybind('q', primary),
	[KeybindCommand.NEXT_SUBTITLE]: createKeybind('q', { alt: true }),
	[KeybindCommand.DECREASE_PLAYBACK_RATE]: createKeybind('k', primary),
	[KeybindCommand.INCREASE_PLAYBACK_RATE]: createKeybind('k', { alt: true }),
	[KeybindCommand.REWIND]: createKeybind('arrowleft', primary),
	[KeybindCommand.REWIND_ALT]: createKeybind('arrowdown', primary),
	[KeybindCommand.FAST_FORWARD]: createKeybind('arrowright', primary),
	[KeybindCommand.FAST_FORWARD_ALT]: createKeybind('arrowup', primary),
	[KeybindCommand.TOGGLE_BOOKMARK]: createKeybind('b', primary),
	[KeybindCommand.TOGGLE_MERGE]: createKeybind('m', primary),
	[KeybindCommand.EDIT_SUBTITLE]: createKeybind('g', { alt: true }),
	[KeybindCommand.COPY_SUBTITLE]: createKeybind('z', { alt: true }),
	[KeybindCommand.EXPORT_NEW]: createKeybind('e', primary),
	[KeybindCommand.EXPORT_UPDATE]: createKeybind('e', { alt: true }),
	[KeybindCommand.OPEN_LAST_EXPORTED_CARD]: createKeybind('o', primary),
	[KeybindCommand.TOGGLE_FOOTER_ACTIONS]: createKeybind('h', { alt: true }),
};

function createKeybind(key: string, modifiers: Partial<Omit<Keybind, 'key'>>): Keybind {
	return {
		key,
		ctrl: !!modifiers.ctrl,
		alt: !!modifiers.alt,
		shift: !!modifiers.shift,
		meta: !!modifiers.meta,
	};
}

export function getDefaultKeybindings(): KeybindingItem[] {
	return keybindCommands.map((command) => ({
		command,
		keybind: defaultKeybinds[command] ? { ...(defaultKeybinds[command] as Keybind) } : undefined,
	}));
}

export function getDefaultKeybind(command: KeybindCommand) {
	const keybind = defaultKeybinds[command];

	return keybind ? { ...keybind } : undefined;
}

/**
 * Merges stored keybindings with the current defaults so that added commands appear and
 * removed/unknown ones are dropped instead of breaking the settings list.
 */
export function mergeKeybindings(storedKeybindings: KeybindingItem[] | undefined): KeybindingItem[] {
	const stored = new Map<KeybindCommand, Keybind | undefined>();

	for (const item of storedKeybindings || []) {
		if (item && keybindCommands.includes(item.command)) {
			stored.set(item.command, sanitizeKeybind(item.keybind));
		}
	}

	return keybindCommands.map((command) => ({
		command,
		keybind: stored.has(command) ? stored.get(command) : getDefaultKeybind(command),
	}));
}

function sanitizeKeybind(keybind: Keybind | undefined): Keybind | undefined {
	if (!keybind || typeof keybind.key !== 'string' || !keybind.key) {
		return undefined;
	}

	const sanitized = createKeybind(keybind.key.toLowerCase(), keybind);

	return hasRequiredModifier(sanitized) ? sanitized : undefined;
}

export function hasRequiredModifier(keybind: Keybind) {
	return keybind.ctrl || keybind.alt || keybind.meta;
}

/**
 * Resolves a physical key independent of the produced character - required because
 * Alt/Option on macOS turns e.g. Alt + d into "∂" for event.key.
 */
export function getEventKey(event: KeyboardEvent) {
	const code = event.code || '';

	if (/^Key[A-Z]$/.test(code)) {
		return code.slice(3).toLowerCase();
	}

	if (/^Digit\d$/.test(code)) {
		return code.slice(5);
	}

	return (code || event.key || '').toLowerCase();
}

export function keybindFromEvent(event: KeyboardEvent): Keybind {
	return createKeybind(getEventKey(event), {
		ctrl: event.ctrlKey,
		alt: event.altKey,
		shift: event.shiftKey,
		meta: event.metaKey,
	});
}

export function isModifierKey(event: KeyboardEvent) {
	return ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock'].includes(event.key);
}

export function isSameKeybind(first: Keybind | undefined, second: Keybind | undefined) {
	if (!first || !second) {
		return false;
	}

	return (
		first.key === second.key &&
		first.ctrl === second.ctrl &&
		first.alt === second.alt &&
		first.shift === second.shift &&
		first.meta === second.meta
	);
}

export function keybindMatchesEvent(keybind: Keybind | undefined, event: KeyboardEvent) {
	return !!keybind && isSameKeybind(keybind, keybindFromEvent(event));
}

export function resolveKeybindCommand(event: KeyboardEvent, keybindings: KeybindingItem[]) {
	const pressed = keybindFromEvent(event);

	return keybindings.find((item) => isSameKeybind(item.keybind, pressed))?.command;
}

const keyLabels: Record<string, string> = {
	space: 'Space',
	arrowleft: 'Arrow Left',
	arrowright: 'Arrow Right',
	arrowup: 'Arrow Up',
	arrowdown: 'Arrow Down',
	escape: 'Escape',
	enter: 'Enter',
	tab: 'Tab',
	backspace: 'Backspace',
	delete: 'Delete',
	comma: ',',
	period: '.',
	slash: '/',
	backslash: '\\',
	semicolon: ';',
	quote: "'",
	backquote: '`',
	minus: '-',
	equal: '=',
	bracketleft: '[',
	bracketright: ']',
	home: 'Home',
	end: 'End',
	pageup: 'Page Up',
	pagedown: 'Page Down',
};

export function formatKeybind(keybind: Keybind | undefined) {
	if (!keybind) {
		return 'Unbound';
	}

	const parts: string[] = [];

	if (keybind.ctrl) {
		parts.push(isMacPlatform ? 'Control' : 'Ctrl');
	}

	if (keybind.alt) {
		parts.push(isMacPlatform ? 'Option' : 'Alt');
	}

	if (keybind.shift) {
		parts.push('Shift');
	}

	if (keybind.meta) {
		parts.push(isMacPlatform ? 'Cmd' : 'Win');
	}

	parts.push(formatKeybindKey(keybind.key));

	return parts.join(' + ');
}

function formatKeybindKey(key: string) {
	if (keyLabels[key]) {
		return keyLabels[key];
	}

	if (/^f\d{1,2}$/.test(key)) {
		return key.toUpperCase();
	}

	if (key.startsWith('numpad')) {
		return `Numpad ${key.slice(6)}`;
	}

	return key.length === 1 ? key.toUpperCase() : key;
}

const macReservedKeybinds: { keybind: Keybind; reason: string }[] = [
	{ keybind: createKeybind('q', { meta: true }), reason: 'macOS quits the browser with Cmd + Q' },
	{ keybind: createKeybind('space', { meta: true }), reason: 'macOS opens Spotlight with Cmd + Space' },
	{ keybind: createKeybind('w', { meta: true }), reason: 'the browser closes the tab with Cmd + W' },
	{ keybind: createKeybind('h', { meta: true }), reason: 'macOS hides the window with Cmd + H' },
	{ keybind: createKeybind('m', { meta: true }), reason: 'macOS minimizes the window with Cmd + M' },
	{ keybind: createKeybind('n', { meta: true }), reason: 'the browser opens a new window with Cmd + N' },
	{ keybind: createKeybind('t', { meta: true }), reason: 'the browser opens a new tab with Cmd + T' },
	{ keybind: createKeybind('space', { ctrl: true }), reason: 'macOS switches the input source with Control + Space' },
];

const otherReservedKeybinds: { keybind: Keybind; reason: string }[] = [
	{ keybind: createKeybind('w', { ctrl: true }), reason: 'the browser closes the tab with Ctrl + W' },
	{ keybind: createKeybind('t', { ctrl: true }), reason: 'the browser opens a new tab with Ctrl + T' },
	{ keybind: createKeybind('n', { ctrl: true }), reason: 'the browser opens a new window with Ctrl + N' },
	{ keybind: createKeybind('space', { alt: true }), reason: 'Windows opens the window menu with Alt + Space' },
	{ keybind: createKeybind('arrowleft', { alt: true }), reason: 'the browser navigates back with Alt + Arrow Left' },
	{
		keybind: createKeybind('arrowright', { alt: true }),
		reason: 'the browser navigates forward with Alt + Arrow Right',
	},
];

export function getKeybindWarning(keybind: Keybind | undefined) {
	if (!keybind) {
		return '';
	}

	const reserved = (isMacPlatform ? macReservedKeybinds : otherReservedKeybinds).find((entry) =>
		isSameKeybind(entry.keybind, keybind),
	);

	return reserved ? `This shortcut may not reach the page because ${reserved.reason}` : '';
}
