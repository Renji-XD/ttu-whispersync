<script lang="ts">
	import Icon from './Icon.svelte';
	import { skipKeys } from '../lib/actions';
	import {
		formatKeybind,
		getDefaultKeybind,
		getKeybindWarning,
		hasRequiredModifier,
		isModifierKey,
		isSameKeybind,
		keybindCommandLabels,
		keybindFromEvent,
		type Keybind,
		type KeybindCommand,
		type KeybindingItem,
	} from '../lib/keybindings';
	import { skipKeyListener$ } from '../lib/stores';
	import { mdiAlert, mdiRestore } from '@mdi/js';
	import Popover from './Popover.svelte';
	import { createEventDispatcher } from 'svelte';

	export let command: KeybindCommand;
	export let keybind: Keybind | undefined;
	export let keybindings: KeybindingItem[];
	export let descriptionSuffix = '';

	const dispatch = createEventDispatcher<{ change: { command: KeybindCommand; keybind: Keybind | undefined } }>();

	let isCapturing = false;
	let captureError = '';
	let buttonElement: HTMLButtonElement;

	$: label = `${keybindCommandLabels[command]}${descriptionSuffix}`;

	$: conflictingCommand = keybindings.find(
		(item) => item.command !== command && isSameKeybind(item.keybind, keybind),
	)?.command;

	$: warning =
		captureError ||
		(conflictingCommand ? `Also assigned to "${keybindCommandLabels[conflictingCommand]}"` : '') ||
		getKeybindWarning(keybind);

	$: isDefault = isSameKeybind(keybind, getDefaultKeybind(command)) || (!keybind && !getDefaultKeybind(command));

	function onStartCapture() {
		isCapturing = true;
		captureError = '';
	}

	function onStopCapture() {
		isCapturing = false;
	}

	function onCaptureKeyDown(event: KeyboardEvent) {
		if (!isCapturing) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		if (isModifierKey(event)) {
			return;
		}

		if (event.key === 'Escape') {
			captureError = '';
			isCapturing = false;

			return buttonElement.blur();
		}

		if ((event.key === 'Backspace' || event.key === 'Delete') && !event.ctrlKey && !event.altKey && !event.metaKey) {
			captureError = '';
			isCapturing = false;

			dispatch('change', { command, keybind: undefined });

			return buttonElement.blur();
		}

		const newKeybind = keybindFromEvent(event);

		if (!hasRequiredModifier(newKeybind)) {
			captureError = 'Add at least Ctrl, Alt/Option or Cmd to the shortcut';

			return;
		}

		captureError = '';
		isCapturing = false;

		dispatch('change', { command, keybind: newKeybind });

		buttonElement.blur();
	}

	function onReset() {
		captureError = '';
		isCapturing = false;

		dispatch('change', { command, keybind: getDefaultKeybind(command) });
	}
</script>

<label for={`ttu-whispersync-keybind-${command}`}>{label}</label>
<button
	bind:this={buttonElement}
	id={`ttu-whispersync-keybind-${command}`}
	class="btn keybind-button"
	class:capturing={isCapturing}
	title="Click and press the shortcut - Backspace to unbind, Escape to cancel"
	on:click={onStartCapture}
	on:blur={onStopCapture}
	on:keydown={onCaptureKeyDown}
	use:skipKeys={{ document, isSkipped: $skipKeyListener$ }}
>
	{isCapturing ? 'Press shortcut…' : formatKeybind(keybind)}
</button>
<div class="keybind-actions">
	{#if warning}
		<Popover>
			<div slot="icon">
				<Icon path={mdiAlert} />
			</div>
			<div>{warning}</div>
		</Popover>
	{/if}
	{#if !isDefault}
		<button title="Restore default shortcut" on:click={onReset}>
			<Icon path={mdiRestore} />
		</button>
	{/if}
</div>

