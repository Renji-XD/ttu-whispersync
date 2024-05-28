import { writable } from 'svelte/store';

function revertToDefault<T>(set: (value: T) => void, defaultValue?: T) {
	//@ts-ignore
	set(defaultValue);
}

export function revertWriteable<T>(defaultValue?: T) {
	return writable<T>(defaultValue, (set) => revertToDefault(set, defaultValue));
}
