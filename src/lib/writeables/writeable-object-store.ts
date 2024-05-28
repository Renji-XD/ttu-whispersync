import { createWriteableStore } from './writeable-store';

function createWritteableObjectStore<T>(fallback: string) {
	return createWriteableStore(
		(x) => JSON.parse(x || fallback) as T,
		(x) => JSON.stringify(x),
	);
}

export function writeableObjectStore<T>() {
	return createWritteableObjectStore<T>('{}');
}

export function writeableArrayStore<T>() {
	return createWritteableObjectStore<T[]>('[]');
}
