import type { EventWithElement } from './general';
import { getDefaultSetting } from './settings';
import { type SettingsStore } from './stores';
import { tick } from 'svelte';

async function _onNumberFieldChange(
	{ currentTarget }: EventWithElement<HTMLInputElement>,
	defaultValue: number,
	targetStore: SettingsStore<number> | undefined,
) {
	const hasMin = currentTarget.hasAttribute('min');
	const hasMax = currentTarget.hasAttribute('max');
	const min = hasMin ? Number.parseFloat(currentTarget.min) : 0;
	const max = hasMax ? Number.parseFloat(currentTarget.max) : 0;

	let newValue = Number.parseFloat(currentTarget.value);

	if (Number.isNaN(newValue) || (hasMin && newValue < min) || (hasMax && newValue > max)) {
		newValue = defaultValue;
	}

	await new Promise<void>((resolve) => setTimeout(resolve));

	targetStore?.set(newValue);

	await tick();

	currentTarget.value = `${newValue}`;
}

async function _onTextFieldChange(
	{ currentTarget }: EventWithElement<HTMLInputElement>,
	defaultValue: string,
	targetStore: SettingsStore<string> | undefined,
) {
	let newValue = currentTarget.value || '';

	if (!newValue) {
		newValue = defaultValue;
	}

	targetStore?.set(newValue);

	await tick();

	currentTarget.value = newValue;
}

export class AbortError extends Error {
	name = 'AbortError';
}

export const baseLineCSSClass = `ttu-whispersync-line-highlight-`;

export const allIgnoredElements = new Set(['rp', 'rt']);

export function parseHTML(domParser: DOMParser, hmtl: string) {
	let { body } = domParser.parseFromString(hmtl, 'text/html');

	if (!body.childNodes.length) {
		({ body } = domParser.parseFromString(hmtl, 'text/xml'));
	}

	if (!body.childNodes.length) {
		throw new Error(`Failed to parse html`);
	}

	return body;
}

export function interactWithSandbox<T>(sandboxElement: HTMLIFrameElement, payload: any): Promise<T> {
	if (!sandboxElement.contentWindow) {
		throw new Error('Sandbox has no content window');
	}

	const messageChannel = new MessageChannel();

	messageChannel.port1.start();

	return new Promise<T>((resolve, reject) => {
		messageChannel.port1.addEventListener(
			'message',
			({ data }) => {
				messageChannel.port1.close();

				if (data.error) {
					return reject(new Error(data.error));
				}

				resolve(data);
			},
			false,
		);

		sandboxElement.contentWindow!.postMessage(payload, '*', [messageChannel.port2]);
	});
}

export function getTimeParts(s: number) {
	const hours = Math.floor(s / 3600);
	const hoursDiff = s - hours * 3600;
	const minutes = Math.floor(hoursDiff / 60);
	const minutesDiff = hoursDiff - minutes * 60;
	const seconds = Math.floor(minutesDiff);
	const ms = Math.round((minutesDiff - seconds) * 1000);

	return [hours, minutes, seconds, ms];
}

export function toTimeStamp(s: number) {
	const [hours, minutes, seconds, ms] = getTimeParts(s);

	return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')},${`${ms}`.padStart(3, '0')}`;
}

export function getLineCSSSelector() {
	return `span[class^='${baseLineCSSClass}']`;
}

export function getSubtitleIdFromElement(element: Element) {
	return (
		[...element.classList]
			.find((cssClass) => cssClass.startsWith(baseLineCSSClass))
			?.replace(baseLineCSSClass, '') || 'not existing'
	);
}

export function getLineCSSSelectorForId(id: string) {
	return `span.${baseLineCSSClass}${id}`;
}

export function getBaseLineCSSSelectorForId(id: string) {
	return `${baseLineCSSClass}${id}`;
}

export function onNumberFieldChangeWithDefault(event: EventWithElement<HTMLInputElement>, defaultValue: number) {
	return _onNumberFieldChange(event, defaultValue, undefined);
}

export function onNumberFieldChange(event: EventWithElement<HTMLInputElement>, targetStore: SettingsStore<number>) {
	return _onNumberFieldChange(event, getDefaultSetting(targetStore.key()), targetStore);
}

export function onTextFieldChange(event: EventWithElement<HTMLInputElement>, targetStore: SettingsStore<string>) {
	return _onTextFieldChange(event, getDefaultSetting(targetStore.key()), targetStore);
}

export function between(min: number, max: number, value: number) {
	return Math.min(max, Math.max(value, min));
}

export function throwIfAborted(cancelSignal?: AbortSignal) {
	if (!cancelSignal) {
		return;
	}

	if (typeof cancelSignal.throwIfAborted === 'function') {
		cancelSignal.throwIfAborted();
	} else if (cancelSignal.aborted) {
		throw new AbortError('user aborted');
	}
}

export function downloadFile(document: Document, blob: Blob, filename: string, openInTab = false) {
	const a = document.createElement('a');

	a.href = URL.createObjectURL(blob);

	if (openInTab) {
		a.target = '_blank';
	} else {
		a.rel = 'noopener';
		a.download = filename;
	}

	setTimeout(() => {
		URL.revokeObjectURL(a.href);
	}, 1e4);

	setTimeout(() => {
		a.click();
	});
}

export function toTimeString(s: number) {
	const [hours, minutes, seconds] = getTimeParts(s);

	return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
}

export function caluclatePercentage(x: number, y: number, roundDown = true) {
	if (!x || !y) {
		return 0;
	}

	if (roundDown) {
		return Math.floor((x / y) * 100);
	}

	return Math.round(((x / y) * 100 + Number.EPSILON) * 100) / 100;
}

export function timeStringToSeconds(timeString: string) {
	const parts = timeString.split(':');
	const hours = Number.parseInt(parts[0], 10);
	const minutes = Number.parseInt(parts[1], 10);
	const seconds = Number.parseInt(parts[2], 10);

	return Math.floor(hours * 3600) + Math.floor(minutes * 60) + seconds;
}

export function getDateString(date: Date) {
	return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}
