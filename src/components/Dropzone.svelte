<script lang="ts">
	import type { FileInstance, EventWithElement, FileResult } from '../lib/dropzone';
	import { createEventDispatcher } from 'svelte';

	export let disabled = false;
	export let width = '100%';
	export let height = '120px';
	export let classes = '';
	export let dragClasses = '';
	export let label = 'Drag-and-drop files / folders to this zone or click it to select them';
	export let allowRootFiles = false;
	export let multiple = false;
	export let preferNativeFilesystem = false;
	export let fileFormatsDescription = 'Allowed files';
	export let filePickerId = 'Dropzone';
	export let fileFormats: FileExtension[] = [];
	export let oldHandles: FileSystemFileHandle[] = [];
	export let oldFiles: File[] = [];
	export let accepts = '';
	export let types = '';

	const dispatch = createEventDispatcher<{ start: void; stop: void; result: FileResult }>();
	const useNativeFileSystem = 'showOpenFilePicker' in window && preferNativeFilesystem;

	let inputElement: HTMLInputElement;
	let draggedOver = false;

	$: containerClasses = `dropzone flex justify-center items-center relative ${classes ? classes : ''} ${draggedOver ? dragClasses : ''}`;

	$: containerStyles = `width: ${width}; height: ${height};`;

	$: formats = fileFormats.length ? new Set<FileExtension>(fileFormats) : new Set<FileExtension>();

	$: accept = accepts ? accepts : [...formats].join(',') || '*';

	$: formatRegex = types ? new RegExp(types) : undefined;

	function onTriggerFileSelection() {
		if (disabled) {
			return;
		}

		if (useNativeFileSystem) {
			dispatch('start');

			return getFilesFromFileSystem();
		}

		inputElement.click();
	}

	async function onFileChange({ currentTarget }: EventWithElement<HTMLInputElement>) {
		if (disabled || !currentTarget.files?.length) {
			return;
		}

		const files = [...currentTarget.files];
		const result: FileResult = { files: [], errors: [] };

		for (let index = 0, { length } = files; index < length; index += 1) {
			const file = extendFile(files[index], '/');
			const extension: FileExtension = `.${file.name.split('.').pop()}`;

			try {
				if (
					(!formats.size || formats.has(extension)) &&
					(!formatRegex || formatRegex.test(file.type)) &&
					!oldFiles.find((oldFile) => oldFile === file)
				) {
					result.files.push({ file, extension });
				}
			} catch ({ message }: any) {
				result.errors.push(`Error on file ${file.name} - ${message}`);
			}
		}

		currentTarget.value = '';

		dispatchResult(result);
	}

	function onDrop({ dataTransfer }: DragEvent) {
		draggedOver = false;

		if (disabled || !dataTransfer) {
			return;
		}

		const items = dataTransfer.items;
		const itemsInScope: Promise<FileSystemHandle | FileSystemEntry | null>[] = [];

		dispatch('start');

		for (let index = 0, { length } = items; index < length; index += 1) {
			const item = items[index];

			if (item.kind === 'file') {
				const entry = useNativeFileSystem ? item.getAsFileSystemHandle() : item.webkitGetAsEntry();

				if (entry) {
					itemsInScope.push(Promise.resolve(entry));
				}
			}
		}

		collectFiles(itemsInScope);
	}

	async function getFilesFromFileSystem() {
		try {
			const extensions = [...formats];
			const files = await window.showOpenFilePicker({
				multiple,
				id: filePickerId,
				excludeAcceptAllOption: formats.size ? true : false,
				...(formats.size
					? {
							types: [
								{
									description: fileFormatsDescription,
									accept: { '*/*': extensions },
								},
							],
						}
					: {}),
			});

			collectFiles(files.map((item) => Promise.resolve(item)));
		} catch (error: any) {
			if (error.name === 'AbortError') {
				dispatchResult();
			} else {
				dispatchResult({ files: [], errors: [`Error selecting file(s) - ${error.message}`] });
			}
		}
	}

	async function collectFiles(entries: Promise<FileSystemHandle | FileSystemEntry | null>[]) {
		const result: FileResult = { files: [], errors: [] };

		for (let index = 0, { length } = entries; index < length; index += 1) {
			try {
				const entry = await entries[index];

				if (entry) {
					const results = await processEntry(entry);

					result.files.push(...results.files);
					result.errors.push(...results.errors);
				}
			} catch ({ message }: any) {
				result.errors.push(`Error processing entry - ${message}`);
			}

			if (result.files.length && !multiple) {
				break;
			}
		}

		dispatchResult(result);
	}

	async function processEntry(entry: FileSystemHandle | FileSystemEntry, currentPath = '/') {
		const result: FileResult = { files: [], errors: [] };

		if (entry instanceof FileSystemFileHandle) {
			const extension: FileExtension = `.${entry.name.split('.').pop()}`;

			let isSameEntry = false;

			if (formats.size && !formats.has(extension)) {
				return result;
			}

			for (let index = 0, { length } = oldHandles; index < length; index += 1) {
				if (isSameEntry) {
					break;
				}

				isSameEntry = await oldHandles[index].isSameEntry(entry).catch(() => false);
			}

			if (isSameEntry) {
				return result;
			}

			await entry
				.getFile()
				.then((fileObject) => {
					const file = extendFile(fileObject, currentPath);

					if (
						(allowRootFiles || file.filePath !== '/') &&
						(!formatRegex || formatRegex.test(file.type)) &&
						!oldFiles.find((oldFile) => oldFile === file)
					) {
						result.files.push({ file, handle: entry, extension });
					}
				})
				.catch(({ message }) => result.errors.push(`Error reading file ${entry.name} - ${message}`));

			return result;
		} else if (isFileSystemFileEntry(entry)) {
			const extension: FileExtension = `.${entry.name.split('.').pop()}`;

			if (formats.size && !formats.has(extension)) {
				return result;
			}

			await getFileFromEntry(entry)
				.then((fileObject) => {
					const file = extendFile(fileObject, entry.fullPath);

					if (
						(allowRootFiles || file.filePath !== '/') &&
						(!formatRegex || formatRegex.test(file.type)) &&
						!oldFiles.find((oldFile) => oldFile === file)
					) {
						result.files.push({ file, extension });
					}
				})
				.catch(({ message }) => result.errors.push(`Error reading file ${entry.name} - ${message}`));

			return result;
		} else if (entry instanceof FileSystemDirectoryHandle) {
			const iterator = entry.entries();

			let entries = await iterator.next().catch(({ message }) => {
				result.errors.push(`Error reading directory ${entry.name} - ${message}`);

				return { done: true, value: [] };
			});

			while (!entries.done) {
				const [key, handle] = entries.value;
				const results = await processEntry(
					handle,
					`${currentPath}${currentPath === '/' ? '' : '/'}${entry.name}${handle.kind === 'file' ? `/${key}` : ''}`,
				);

				result.errors.push(...results.errors);

				if (!result.files.length || multiple) {
					const length = multiple ? results.files.length : 1;

					for (let index = 0; index < length; index++) {
						result.files.push(results.files[index]);
					}
				}

				entries =
					!result.files.length || multiple
						? await iterator.next().catch(({ message }) => {
								result.errors.push(`Error reading directory ${entry.name} - ${message}`);

								return { done: true, value: [] };
							})
						: { done: true, value: [] };
			}

			return result;
		} else if (isFileSystemDirectoryEntry(entry)) {
			return getFilesFromDirectory(entry.createReader(), entry.fullPath || entry.name);
		}

		return result;
	}

	function extendFile(file: File, path: string) {
		const fileInstance = file as FileInstance;
		const pathSegments = path.split('/');

		fileInstance.filePath = path;
		fileInstance.parentFolder = pathSegments.length > 2 ? pathSegments[pathSegments.length - 2] : '/';

		return fileInstance;
	}

	function isFileSystemFileEntry(entry: FileSystemHandle | FileSystemEntry): entry is FileSystemFileEntry {
		return entry.isFile;
	}

	function isFileSystemDirectoryEntry(entry: FileSystemHandle | FileSystemEntry): entry is FileSystemDirectoryEntry {
		return entry.isDirectory;
	}

	function getFileFromEntry(entry: FileSystemFileEntry): Promise<File> {
		return new Promise((resolve, reject) => {
			entry.file((file) => resolve(file), reject);
		});
	}

	async function getFilesFromDirectory(reader: FileSystemDirectoryReader, name: string) {
		const result: FileResult = { files: [], errors: [] };

		let entries = await getEntriesFromDirectory(reader).catch(({ message }) => {
			result.errors.push(`Error reading directory ${name} - ${message}`);

			return [];
		});

		while (entries.length) {
			for (let index = 0, length = entries.length; index < length; index += 1) {
				const entry = entries[index];

				try {
					const results = await processEntry(entries[index], entry.fullPath);

					result.errors.push(...results.errors);

					if (!result.files.length || multiple) {
						const length = multiple ? results.files.length : 1;

						for (let index = 0; index < length; index++) {
							result.files.push(results.files[index]);
						}
					}
				} catch ({ message }: any) {
					result.errors.push(`Error reading file ${entry.name} - ${message}`);
				}

				if (result.files.length && !multiple) {
					break;
				}
			}

			entries =
				!result.files.length || multiple
					? await getEntriesFromDirectory(reader).catch(({ message }) => {
							result.errors.push(`Error reading directory ${name} - ${message}`);
							return [];
						})
					: [];
		}

		return result;
	}

	function getEntriesFromDirectory(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
		return new Promise((resolve, reject) => {
			reader.readEntries(resolve, reject);
		});
	}

	function dispatchResult(result: FileResult = { files: [], errors: [] }) {
		if (result.files.length || result.errors.length) {
			dispatch('result', result);
		} else {
			dispatch('stop');
		}
	}
</script>

<button
	class={containerClasses}
	style={containerStyles}
	on:dragenter={() => {
		if (!disabled) {
			draggedOver = true;
		}
	}}
	on:dragleave={() => {
		if (!disabled) {
			draggedOver = false;
		}
	}}
	on:dragover|preventDefault
	on:drop|preventDefault={onDrop}
	on:click={onTriggerFileSelection}
>
	<div class="pointer-events-none whitespace-pre-wrap p-4">{label}</div>
</button>
<input class="hidden" type="file" {multiple} {accept} bind:this={inputElement} on:change={onFileChange} />
