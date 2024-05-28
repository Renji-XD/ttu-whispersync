import { createWriteableStore } from './writeable-store';

export function writableNumberStore() {
	return createWriteableStore<number>(
		(x) => +x,
		(x) => `${x}`,
	);
}
