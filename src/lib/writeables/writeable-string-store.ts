import { createWriteableStore } from './writeable-store';

export function writableStringStore<T extends string>() {
	return createWriteableStore(
		(x) => x as T,
		(x) => x,
	);
}
