import type { Subtitle } from './general';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { booksDB$ } from './stores';

interface BooksDbData {
	id: number;
	title: string;
	elementHtml: string;
	lastBookModified: number;
	storageSource?: string;
	htmlBackup?: string;
}

interface BooksDbAudioBook {
	title: string;
	playbackPosition: number;
	lastAudioBookModified: number;
}

interface BooksDbSubtitleData {
	title: string;
	subtitleData: SubtitleData;
	lastSubtitleDataModified: number;
}

interface BooksDbHandle {
	title: string;
	dataType: string;
	handle: FileSystemFileHandle | FileSystemDirectoryHandle;
	lastHandleModified: number;
}

export interface SubtitleData {
	name: string;
	subtitles: Subtitle[];
}

export interface BooksDB extends DBSchema {
	data: {
		key: number;
		value: BooksDbData;
		indexes: {
			title: string;
		};
	};
	audioBook: {
		key: string;
		value: BooksDbAudioBook;
	};
	subtitle: {
		key: string;
		value: BooksDbSubtitleData;
	};
	handle: {
		key: string[];
		value: BooksDbHandle;
	};
}

export interface ExtensionData {
	title: string;
	lastSubtitle?: FileSystemFileHandle;
	subtitleData?: SubtitleData;
	lastAudio?: FileSystemFileHandle;
	playbackPosition?: number;
}

export type BooksDBData = BooksDB['data']['value'];

export async function setBooksDB(dbVersion: number) {
	try {
		const booksDB: IDBPDatabase<BooksDB> = await openDB('books', dbVersion);

		if (!booksDB) {
			throw new Error('failed to open db');
		}

		booksDB$.set(booksDB);
	} catch ({ message }: any) {
		throw new Error(`Error accessing books db - ${message}`);
	}
}
