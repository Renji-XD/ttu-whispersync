import { AnkiDuplicateMode, AudioProcessor, ExportFieldMode } from './settings';
import { caluclatePercentage, throwIfAborted } from './util';
import { cleanFiles, getAudio } from './ffmpeg';
import {
	currentAudioFile$,
	currentSubtitleFile$,
	exportCancelController$,
	exportProgress$,
	isAnkiconnectAndroid$,
	isMobile$,
	lastError$,
	paused$,
	playLine$,
	settings$,
} from './stores';

import { Action } from './actions';
import type { Subtitle } from './general';
import { get } from 'svelte/store';

interface VerificationResult {
	isAnkiConfigValid: boolean;
	ankiFields: string[];
}

interface RequestPermissionResult {
	permission: 'granted' | 'denied';
	requireApikey: boolean;
	version: number;
}

interface RequestNotesInfoResult {
	noteId: number;
	fields: Record<string, NotesInfoResultFieldData>;
	tags: string[];
}

interface NotesInfoResultFieldData {
	value: string;
}

interface exportCardInput {
	note: exportCardNoteData;
}

interface exportCardNoteData {
	fields: Record<string, string>;
	tags: string[];
	audio: exportCardAudioField[];
	id?: number;
	deckName?: string;
	modelName?: string;
	options?: exportCardOptions;
}

interface exportCardOptions {
	allowDuplicate: boolean;
	duplicateScope?: string;
	duplicateScopeOptions?: exportCardDuplicateOptions;
}

interface exportCardDuplicateOptions {
	checkChildren: boolean;
	deckName?: string | null;
}

interface exportCardAudioField {
	data: string;
	deleteExisting: boolean;
	filename: string;
	fields?: string[];
}

let permissionGranted = false;
let key = '';

export async function request<T>(ankiUrl: string, body: any, requestForPermission = true): Promise<T> {
	if (requestForPermission) {
		await requestPermission(ankiUrl);
	}

	if (body?.action === 'multi' && key) {
		for (let index = 0, { length } = body.params.actions; index < length; index += 1) {
			body.params.actions[index].key = key;
		}
	}

	return fetch(ankiUrl, {
		headers: { 'Content-Type': 'application/json' },
		method: 'POST',
		body: JSON.stringify({ ...body, ...{ version: 6 }, ...(key ? { key } : {}) }),
	})
		.then((response) => {
			if (!response.ok) {
				throw new Error(`Request failed with status ${response.status}`);
			}

			return response.json();
		})
		.then((data) => {
			let errors = new Set<string>();

			if (data.error) {
				errors.add(data.error);
			}

			if (body?.action === 'multi' && Array.isArray(data.result)) {
				for (let index = 0, { length } = data.result; index < length; index += 1) {
					const { error } = data.result[index];

					if (error) {
						errors.add(error);
					}
				}
			}

			if (errors.size) {
				throw new Error([...errors].join('; '));
			}

			return data.result;
		});
}

async function requestPermission(ankiUrl: string) {
	if (permissionGranted) {
		return;
	}

	const result = await request<RequestPermissionResult | string>(
		ankiUrl,
		{ action: 'requestPermission' },
		false,
	).catch((error) => {
		if (error.message.includes('com.google.gson.stream.MalformedJsonException')) {
			isAnkiconnectAndroid$.set(true);

			return { permission: 'granted', requireApikey: false, version: 6 };
		}

		throw error;
	});

	if (typeof result !== 'string' && result.permission !== 'granted') {
		throw new Error('Anki permission not granted');
	}

	permissionGranted = true;

	return result;
}

async function verifyAnkiSettings(
	ankiUrl: string,
	ankiDeck: string,
	ankiModel: string,
	ankiSentenceField: string,
	ankiSoundField: string,
): Promise<VerificationResult> {
	if (!ankiUrl || !ankiDeck || !ankiModel) {
		return { isAnkiConfigValid: false, ankiFields: [] };
	}

	let ankiFields: string[] = [];
	let isAnkiConfigValid = true;

	try {
		const [ankiDecks, ankiModels] = await getDecksAndModels(ankiUrl);

		if (!ankiDecks.find((entry) => ankiDeck === entry)) {
			settings$.ankiDeck$.set('');

			isAnkiConfigValid = false;
		}

		if (!ankiModels.find((entry) => ankiModel === entry)) {
			settings$.ankiModel$.set('');

			isAnkiConfigValid = false;
		}

		if (isAnkiConfigValid) {
			ankiFields = await getFields(ankiUrl, ankiModel);

			if (ankiSentenceField && !ankiFields.find((field) => field === ankiSentenceField)) {
				settings$.ankiSentenceField$.set('');

				isAnkiConfigValid = false;
			}

			if (ankiSoundField && !ankiFields.find((field) => field === ankiSoundField)) {
				settings$.ankiSoundField$.set('');

				isAnkiConfigValid = false;
			}
		}
	} catch ({ message }: any) {
		resetAnkiSettings();

		lastError$.set(`Failed to verify Anki settings: ${message}`);

		isAnkiConfigValid = false;
		ankiFields = [];
	}

	return { isAnkiConfigValid, ankiFields };
}

async function startExport(ankiUrl: string, isMobile: boolean) {
	if (isMobile) {
		return undefined;
	}

	const selectedNotes = await request<number[]>(ankiUrl, {
		action: 'guiSelectedNotes',
	}).catch(() => {
		return [];
	});

	if (selectedNotes.length) {
		await request(ankiUrl, {
			action: 'guiSelectNote',
			params: {
				note: '1',
			},
		});
	}

	return selectedNotes[selectedNotes.length - 1];
}

function getNewFieldValue(fieldMode: string, existingFieldValue: string, newFieldValue: string) {
	let value = '';

	if (fieldMode === ExportFieldMode.BEFORE) {
		value = `${newFieldValue}${newFieldValue && existingFieldValue ? '<br/>' : ''}${existingFieldValue}`;
	} else if (fieldMode === ExportFieldMode.AFTER) {
		value = `${existingFieldValue}${newFieldValue && existingFieldValue ? `<br/>` : ''}${newFieldValue}`;
	} else {
		value = newFieldValue;
	}

	return value;
}

async function finalizeExport(ankiUrl: string, note: number | undefined) {
	if (note) {
		return request<void>(ankiUrl, {
			action: 'guiSelectNote',
			params: {
				note,
			},
		}).catch(() => {
			// no-op
		});
	}
}

export function setApiKey(value: string) {
	key = value;
}

export function getDecksAndModels(ankiUrl: string) {
	return request<[string[], string[]]>(ankiUrl, {
		action: 'multi',
		params: {
			actions: [{ action: 'deckNames' }, { action: 'modelNames' }],
		},
	});
}

export function getFields(ankiUrl: string, modelName: string) {
	return request<string[]>(ankiUrl, {
		action: 'modelFieldNames',
		params: {
			modelName,
		},
	});
}

export function resetAnkiSettings() {
	settings$.ankiDeck$.set('');
	settings$.ankiModel$.set('');
	settings$.ankiSoundField$.set('');
	settings$.ankiSentenceField$.set('');

	permissionGranted = false;
}

export async function exportToAnki(subtitlesToExport: Subtitle[][], isUpdate: boolean) {
	const abortController = new AbortController();
	const currentSubtitleFile = get(currentSubtitleFile$);
	const isFFMPEG = get(settings$.exportAudioProcessor$) === AudioProcessor.FFMPEG;

	if (!currentSubtitleFile) {
		return;
	}

	if (!isFFMPEG) {
		paused$.set(true);
	}

	lastError$.set('');
	exportProgress$.set(0);
	exportCancelController$.set(abortController);

	const isMobile = get(isMobile$);
	const currentAudioFile = get(currentAudioFile$);
	const exportAudioFormat = get(settings$.exportAudioFormat$);
	const exportAudioBitrate = get(settings$.exportAudioBitrate$);
	const exportFieldMode = get(settings$.exportFieldMode$);
	const ankiAddSubtitleTag = get(settings$.ankiAddSubtitleTag$);
	const ankiAddAudioTag = get(settings$.ankiAddAudioTag$);
	const ankiTagListSetting = get(settings$.ankiTagList$).trim();
	const ankiTagList = ankiTagListSetting
		? ankiTagListSetting.split(',').map((tag) => tag.trim().replaceAll(' ', '_').trim())
		: [];
	const duplicateScope = get(settings$.ankiDuplicateMode$);
	const ankiUrl = get(settings$.ankiUrl$);
	const deckName = get(settings$.ankiDeck$);
	const modelName = get(settings$.ankiModel$);
	const ankiSentenceField = get(settings$.ankiSentenceField$);
	const ankiSoundField = get(settings$.ankiSoundField$);
	const { isAnkiConfigValid, ankiFields } = await verifyAnkiSettings(
		ankiUrl,
		deckName,
		modelName,
		ankiSentenceField,
		ankiSoundField,
	);
	const isAnkiconnectAndroid = get(isAnkiconnectAndroid$);
	const isBlockedUpdated = isUpdate && isAnkiconnectAndroid;
	const isEmptyKeyFieldAllowed =
		duplicateScope === AnkiDuplicateMode.DISABLED && get(settings$.ankiAllowEmptyKeyField$);

	let cardToUpdate: RequestNotesInfoResult | undefined;

	isAnkiconnectAndroid$.set(isAnkiconnectAndroid);

	if (!isAnkiConfigValid || isBlockedUpdated) {
		const lastError = get(lastError$);

		return lastError$.set(
			`${lastError ? `${lastError}; ` : ''}${isAnkiConfigValid ? '' : 'Anki settings are invalid'}${
				isBlockedUpdated ? `${isAnkiConfigValid ? '' : '; '}Your AnkiConnect does not support updates` : ''
			}`,
		);
	}

	if (isUpdate) {
		try {
			const notesFromToday = await request<string[]>(ankiUrl, {
				action: 'findNotes',
				params: {
					query: `added:1 "deck:${deckName}" "note:${modelName}"`,
				},
			});
			const noteIdToUpdate = notesFromToday[notesFromToday.length - 1];

			if (!noteIdToUpdate) {
				throw new Error('No card added today');
			}

			const notesToUpdate = await request<RequestNotesInfoResult[]>(ankiUrl, {
				action: 'notesInfo',
				params: {
					notes: [noteIdToUpdate],
				},
			});

			[cardToUpdate] = notesToUpdate;

			if (!cardToUpdate) {
				throw new Error('Data for last added card not available');
			}
		} catch ({ message }: any) {
			return lastError$.set(`Failed to get card for update: ${message}`);
		}
	}

	const lastNoteId = await startExport(ankiUrl, isAnkiconnectAndroid);
	const baseSubtitleFileName = currentSubtitleFile.name.split(/\.(?=[^\.]+$)/)[0];
	const baseAudioFileName = currentAudioFile ? currentAudioFile.name.split(/\.(?=[^\.]+$)/)[0] : '';

	let failures = 0;

	for (let index = 0, { length } = subtitlesToExport; index < length; index += 1) {
		throwIfAborted(abortController.signal);

		const subtitles = subtitlesToExport[index];
		const audioFileName = `${baseSubtitleFileName}-${subtitles[0].id}${subtitles.length > 1 ? `-${subtitles[subtitles.length - 1].id}` : ''}.${exportAudioFormat}`;
		const sentenceContent = subtitles.map((subtitle) => subtitle.text.trim()).join('<br/>') || '';
		const tagList = new Set<string>(cardToUpdate ? cardToUpdate.tags : []);
		const cardData: exportCardInput = {
			note: { fields: {}, tags: [], audio: [] },
		};

		let audioContent = '';
		let audioBuffer: ArrayBufferLike | undefined;

		try {
			if (ankiSoundField && currentAudioFile) {
				if (isFFMPEG) {
					audioBuffer = await getAudio(
						currentAudioFile,
						subtitles,
						false,
						abortController.signal,
						exportAudioFormat,
						exportAudioBitrate,
						true,
					);
				} else {
					audioBuffer = await new Promise<ArrayBuffer | undefined>((recorderSuccess, recorderFailure) =>
						playLine$.set({
							subtitles,
							action: Action.TOGGLE_PLAY_PAUSE,
							recorderSuccess,
							recorderFailure,
						}),
					);
				}

				if (!audioBuffer) {
					throw new Error('No audio file returned');
				}

				audioContent = Buffer.from(audioBuffer).toString('base64');
			}

			if (ankiAddSubtitleTag) {
				tagList.add(baseSubtitleFileName.trim().replaceAll(' ', '_').trim());
			}

			if (ankiAddAudioTag && baseAudioFileName) {
				tagList.add(baseAudioFileName.trim().replaceAll(' ', '_').trim());
			}

			const tags = [...new Set<string>([...tagList, ...ankiTagList])];
			const options: exportCardOptions =
				duplicateScope !== AnkiDuplicateMode.DISABLED
					? {
							allowDuplicate: false,
							duplicateScope:
								duplicateScope === AnkiDuplicateMode.DECK ||
								duplicateScope === AnkiDuplicateMode.SUBDECK
									? 'deck'
									: 'collection',
							duplicateScopeOptions: { checkChildren: duplicateScope === AnkiDuplicateMode.SUBDECK },
						}
					: { allowDuplicate: true };

			if (options.duplicateScopeOptions && duplicateScope === AnkiDuplicateMode.DECK) {
				options.duplicateScopeOptions.deckName = deckName;
			}

			cardData.note = cardToUpdate
				? { ...cardData.note, id: cardToUpdate.noteId, tags }
				: {
						...cardData.note,
						deckName,
						modelName,
						options,
						tags,
					};

			for (let index2 = 0, { length: length2 } = ankiFields; index2 < length2; index2 += 1) {
				const field = ankiFields[index2];
				const processAsSentenceField = field === ankiSentenceField && sentenceContent;
				const processAsAudioField = field === ankiSoundField && audioContent;
				const existingFieldValue = cardToUpdate ? cardToUpdate.fields[field]?.value || '' : '';

				if (processAsSentenceField || processAsAudioField) {
					let newFieldValue = '';
					let finalFileName = '';

					if (processAsSentenceField) {
						newFieldValue += sentenceContent;
					}

					if (processAsAudioField) {
						if (isMobile) {
							finalFileName = await request<string>(ankiUrl, {
								action: 'storeMediaFile',
								params: {
									data: audioContent,
									filename: audioFileName,
								},
							});
						} else {
							cardData.note.audio = [
								{
									data: audioContent,
									deleteExisting: true,
									filename: audioFileName,
									fields: [''],
								},
							];

							finalFileName = audioFileName;
						}

						newFieldValue = getNewFieldValue(
							ExportFieldMode.AFTER,
							newFieldValue,
							`[sound:${finalFileName}]`,
						);
					}

					cardData.note.fields[field] = getNewFieldValue(exportFieldMode, existingFieldValue, newFieldValue);
				} else {
					cardData.note.fields[field] = existingFieldValue;
				}
			}

			const isKeyFieldEmpty = !cardData.note.fields[ankiFields[0]]?.trim();

			if (isKeyFieldEmpty && isEmptyKeyFieldAllowed) {
				cardData.note.fields[ankiFields[0]] = getNewFieldValue(exportFieldMode, '', '&#8203;');
			} else if (isKeyFieldEmpty) {
				throw new Error('cannot process note because it is empty');
			}

			const result = await request<number | boolean | null>(ankiUrl, {
				action: isUpdate ? 'updateNote' : 'addNote',
				params: cardData,
			});

			if (!isUpdate && !result) {
				throw new Error(`Got failure response`);
			}
		} catch (error: any) {
			if (!abortController.signal.aborted && error.name !== 'AbortError') {
				console.log(
					`Failed to create card for subtitle(s) ${subtitles.map((subtitle) => subtitle.id).join(', ')}: ${error.message}`,
				);

				failures += 1;
			} else {
				break;
			}
		}

		exportProgress$.set(Math.min(100, caluclatePercentage(index + 1, length)));
	}

	await cleanFiles();
	await finalizeExport(ankiUrl, lastNoteId);

	if (failures) {
		lastError$.set(`${failures} Export(s) failed`);
	}
}
