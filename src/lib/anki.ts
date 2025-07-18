import { AnkiDuplicateMode, AudioProcessor, ExportFieldMode, ImageFormat } from './settings';
import { caluclatePercentage, throwIfAborted } from './util';
import { cleanFiles, getAudio } from './ffmpeg';
import {
	currentAudioFile$,
	currentCoverUrl$,
	currentSubtitleFile$,
	exportCancelController$,
	exportProgress$,
	isAnkiconnectAndroid$,
	lastError$,
	lastExportedCardId$,
	paused$,
	playLine$,
	settings$,
	subtitlesForMerge$,
	type SettingsStore,
} from './stores';

import { Action } from './actions';
import type { Subtitle } from './general';
import { get } from 'svelte/store';

interface VerificationResult {
	isOutdatedVersion: boolean;
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
	deckStore: SettingsStore<string>,
	ankiModel: string,
	modelStore: SettingsStore<string>,
	ankiSentenceField: string,
	sentenceFieldStore: SettingsStore<string>,
	ankiSoundField: string,
	soundFieldStore: SettingsStore<string>,
	ankiCoverField: string,
	coverFieldStore: SettingsStore<string>,
	isUpdate: boolean,
): Promise<VerificationResult> {
	if (!ankiUrl || !ankiDeck || !ankiModel || (!ankiSentenceField && !ankiSoundField)) {
		return { isOutdatedVersion: false, isAnkiConfigValid: false, ankiFields: [] };
	}

	let ankiFields: string[] = [];
	let isOutdatedVersion = false;
	let isAnkiConfigValid = true;

	try {
		isOutdatedVersion = await request<any>(ankiUrl, {
			action: 'apiReflect',
			params: {
				scopes: ['actions'],
				actions: ['updateNote'],
			},
		})
			.then(() => false)
			.catch(() => true);

		const [ankiDecks, ankiModels] = await getDecksAndModels(ankiUrl);

		if (!ankiDecks.find((entry) => ankiDeck === entry)) {
			deckStore.set('');

			isAnkiConfigValid = false;
		}

		if (!ankiModels.find((entry) => ankiModel === entry)) {
			modelStore.set('');

			isAnkiConfigValid = false;
		}

		if (isAnkiConfigValid) {
			ankiFields = await getFields(ankiUrl, ankiModel);

			if (ankiSentenceField && !ankiFields.find((field) => field === ankiSentenceField)) {
				sentenceFieldStore.set('');

				isAnkiConfigValid = false;
			}

			if (ankiSoundField && !ankiFields.find((field) => field === ankiSoundField)) {
				soundFieldStore.set('');

				isAnkiConfigValid = false;
			}

			if (ankiCoverField && !ankiFields.find((field) => field === ankiCoverField)) {
				coverFieldStore.set('');

				isAnkiConfigValid = false;
			}
		}
	} catch ({ message }: any) {
		resetAnkiSettings(isUpdate);

		lastError$.set(`Failed to verify Anki settings for card ${isUpdate ? 'update' : 'creation'}: ${message}`);

		isAnkiConfigValid = false;
		ankiFields = [];
	}

	return { isOutdatedVersion, isAnkiConfigValid, ankiFields };
}

async function startExport(ankiUrl: string, isAnkiconnectAndroid: boolean, isOutdatedVersion: boolean) {
	if (isAnkiconnectAndroid) {
		return undefined;
	}

	const selectedNotes = await request<number[]>(ankiUrl, {
		action: 'guiSelectedNotes',
	}).catch(() => {
		return [];
	});

	if (selectedNotes.length && isOutdatedVersion) {
		await request<number[]>(ankiUrl, {
			action: 'guiBrowse',
			params: { query: 'nid:1' },
		});
	} else if (selectedNotes.length) {
		await request(ankiUrl, {
			action: 'guiSelectNote',
			params: {
				note: '1',
			},
		});
	}

	return selectedNotes[selectedNotes.length - 1];
}

async function createFileNameHash(encoder: TextEncoder, name: string) {
	const data = encoder.encode(name);
	const hashBuffer = await window.crypto.subtle.digest('SHA-1', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));

	return hashArray
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
		.trim();
}

function getCoverData(coverFormat: string) {
	return new Promise<string[]>((resolve, reject) => {
		const canvas = document.createElement('canvas');
		const img = document.querySelector<HTMLImageElement>('#ttu-whispersync-cover');

		if (!img) {
			return reject(new Error('cover element not found'));
		}

		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;

		const ctx = canvas.getContext('2d');

		if (!ctx) {
			return reject(new Error('canvas context undefined'));
		}

		ctx.drawImage(img, 0, 0);

		const result = canvas.toDataURL(coverFormat);
		const ext = result.match(/data:image\/(?<ext>.+);/)?.groups?.ext || 'jpeg';

		resolve([result.split(',')[1], ext]);
	});
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

async function finalizeExport(ankiUrl: string, note: number | undefined, ankiModel: string | undefined) {
	if (!note) {
		return;
	}

	if (ankiModel) {
		return request<number[]>(ankiUrl, {
			action: 'guiBrowse',
			params: { query: `"note:${ankiModel}"` },
		}).catch(() => {
			// no-op
		});
	}

	return request<void>(ankiUrl, {
		action: 'guiSelectNote',
		params: {
			note,
		},
	}).catch(() => {
		// no-op
	});
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

export function resetAnkiSettings(isUpdate: boolean) {
	if (isUpdate) {
		settings$.ankiUpdateDeck$.set('');
		settings$.ankiUpdateModel$.set('');
		settings$.ankiUpdateSentenceField$.set('');
		settings$.ankiUpdateSoundField$.set('');
	} else {
		settings$.ankiDeck$.set('');
		settings$.ankiModel$.set('');
		settings$.ankiSentenceField$.set('');
		settings$.ankiSoundField$.set('');
		settings$.ankiCoverField$.set('');
	}

	permissionGranted = false;
}

export async function exportToAnki(subtitlesToExport: Subtitle[][], isUpdate: boolean, isMerge: boolean) {
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

	const currentAudioFile = get(currentAudioFile$);
	const currentCoverUrl = get(currentCoverUrl$);
	const exportAudioFormat = get(settings$.exportAudioFormat$);
	const exportAudioBitrate = get(settings$.exportAudioBitrate$);
	const exportCoverFormat = get(settings$.exportCoverFormat$);
	const exportFieldMode = get(settings$.exportFieldMode$);
	const ankiAddSubtitleTag = get(settings$.ankiAddSubtitleTag$);
	const ankiAddAudioTag = get(settings$.ankiAddAudioTag$);
	const ankiTagListSetting = get(settings$.ankiTagList$).trim();
	const ankiTagList = ankiTagListSetting
		? ankiTagListSetting.split(',').map((tag) => tag.trim().replaceAll(' ', '_').trim())
		: [];
	const duplicateScope = get(settings$.ankiDuplicateMode$);
	const useUpdateStores =
		isUpdate && (!!get(settings$.ankiUpdateSentenceField$) || !!get(settings$.ankiUpdateSoundField$));
	const deckStore = useUpdateStores ? settings$.ankiUpdateDeck$ : settings$.ankiDeck$;
	const modelStore = useUpdateStores ? settings$.ankiUpdateModel$ : settings$.ankiModel$;
	const sentenceFieldStore = useUpdateStores ? settings$.ankiUpdateSentenceField$ : settings$.ankiSentenceField$;
	const soundFieldStore = useUpdateStores ? settings$.ankiUpdateSoundField$ : settings$.ankiSoundField$;
	const coverFieldStore = useUpdateStores ? settings$.ankiUpdateCoverField$ : settings$.ankiCoverField$;
	const ankiUrl = get(settings$.ankiUrl$);
	const deckName = get(deckStore);
	const modelName = get(modelStore);
	const ankiSentenceField = get(sentenceFieldStore);
	const ankiSoundField = get(soundFieldStore);
	const ankiCoverField = get(coverFieldStore);
	const ankiEnableOpenInBrowser = get(settings$.ankiEnableOpenInBrowser$);
	const { isOutdatedVersion, isAnkiConfigValid, ankiFields } = await verifyAnkiSettings(
		ankiUrl,
		deckName,
		deckStore,
		modelName,
		modelStore,
		ankiSentenceField,
		sentenceFieldStore,
		ankiSoundField,
		soundFieldStore,
		ankiCoverField,
		coverFieldStore,
		isUpdate,
	);
	const isAnkiconnectAndroid = get(isAnkiconnectAndroid$);
	const isEmptyKeyFieldAllowed =
		duplicateScope === AnkiDuplicateMode.DISABLED && get(settings$.ankiAllowEmptyKeyField$);

	let cardToUpdate: RequestNotesInfoResult | undefined;

	if (!isAnkiConfigValid) {
		const lastError = get(lastError$);

		return lastError$.set(
			`${lastError ? `${lastError}; ` : ''}${isAnkiConfigValid ? '' : `Anki ${isUpdate ? 'update' : 'create'} settings are invalid`}`,
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
	const lastNoteId = await startExport(ankiUrl, isAnkiconnectAndroid, isOutdatedVersion);
	const baseSubtitleFileName = currentSubtitleFile.name.split(/\.(?=[^\.]+$)/)[0];
	const baseAudioFileName = currentAudioFile ? currentAudioFile.name.split(/\.(?=[^\.]+$)/)[0] : '';

	let failures = 0;
	let audioFilePrefix = '';
	let coverFilePrefix = '';
	let coverExtension = '';
	let coverContent = '';
	let lastExportedCardId = 0;

	try {
		const encoder = new TextEncoder();

		audioFilePrefix = await createFileNameHash(encoder, baseAudioFileName);
		coverFilePrefix = await createFileNameHash(encoder, `${baseAudioFileName}_cover`);
	} catch (_) {
		audioFilePrefix = baseSubtitleFileName;
	}

	try {
		if (currentCoverUrl && ankiCoverField) {
			if (exportCoverFormat === ImageFormat.AUTO) {
				coverContent = await fetch(currentCoverUrl)
					.then((response) => {
						if (!response.ok) {
							throw new Error('Failed to fetch cover');
						}

						return response.blob();
					})
					.then((blob) => {
						coverExtension = blob.type.replace('image/', '') || 'jpeg';

						return blob.arrayBuffer();
					})
					.then((blobBuffer) => {
						return Buffer.from(blobBuffer).toString('base64');
					});
			} else {
				[coverContent, coverExtension] = await getCoverData(`image/${exportCoverFormat}`);
			}
		}
	} catch ({ message }: any) {
		return lastError$.set(`Failed to get cover: ${message}`);
	}

	lastExportedCardId$.set(0);

	for (let index = 0, { length } = subtitlesToExport; index < length; index += 1) {
		throwIfAborted(abortController.signal);

		const subtitles = subtitlesToExport[index];
		const audioFileName = `${audioFilePrefix}-${subtitles[0].id}${subtitles.length > 1 ? `-${subtitles[subtitles.length - 1].id}` : ''}.${exportAudioFormat}`;
		const sentenceContent = subtitles.map((subtitle) => subtitle.text.trim()).join('<br/>') || '';
		const tagList = new Set<string>(cardToUpdate ? cardToUpdate.tags : []);
		const cardData: exportCardInput = {
			note: { fields: {}, tags: [] },
		};

		let actionName = '';
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
				const processAsCoverField = field === ankiCoverField && coverContent;
				const existingFieldValue = cardToUpdate ? cardToUpdate.fields[field]?.value || '' : '';

				if (processAsSentenceField || processAsAudioField || processAsCoverField) {
					let newFieldValue = '';

					if (processAsSentenceField) {
						newFieldValue += sentenceContent;
					}

					if (processAsCoverField) {
						const finalFileName = await request<string>(ankiUrl, {
							action: 'storeMediaFile',
							params: {
								data: coverContent,
								filename: `${coverFilePrefix}.${coverExtension}`,
							},
						});

						newFieldValue = getNewFieldValue(
							ExportFieldMode.AFTER,
							newFieldValue,
							`<img src="${finalFileName}">`,
						);
					}

					if (processAsAudioField) {
						const finalFileName = await request<string>(ankiUrl, {
							action: 'storeMediaFile',
							params: {
								data: audioContent,
								filename: audioFileName,
							},
						});

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

			if (isUpdate) {
				actionName = isAnkiconnectAndroid || isOutdatedVersion ? 'updateNoteFields' : 'updateNote';
			} else {
				actionName = 'addNote';
			}

			const result = await request<number | boolean | null>(ankiUrl, {
				action: actionName,
				params: cardData,
			});

			if (!isUpdate && !result) {
				throw new Error(`Got failure response`);
			}

			if (cardToUpdate) {
				lastExportedCardId = cardToUpdate.noteId;
			} else if (typeof result === 'number') {
				lastExportedCardId = result;
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

	const handleLastExportedCard = lastExportedCardId && !isAnkiconnectAndroid;

	await cleanFiles();

	if (handleLastExportedCard) {
		lastExportedCardId$.set(lastExportedCardId);
	}

	if (handleLastExportedCard && ankiEnableOpenInBrowser) {
		await openGUIForNote(ankiUrl, lastExportedCardId);
	} else {
		await finalizeExport(ankiUrl, lastNoteId, isOutdatedVersion ? modelName : undefined);
	}

	if (failures) {
		lastError$.set(`${failures} Export(s) failed`);
	} else if (isMerge && get(settings$.exportEnableMergeSelectionAutoClear$)) {
		subtitlesForMerge$.set(new Set<string>());
	}
}

export function openGUIForNote(ankiUrl: string, note = 0) {
	const nid = note || get(lastExportedCardId$);

	if (!nid) {
		return Promise.resolve([0]);
	}

	return request<number[]>(ankiUrl, {
		action: 'guiBrowse',
		params: { query: `nid:${note || get(lastExportedCardId$)}` },
	}).catch(({ message }) => console.log(`Failed to open Anki browser: ${message}`));
}
