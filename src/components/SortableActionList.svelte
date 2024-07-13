<script lang="ts">
	import Icon from './Icon.svelte';
	import type { Action, ActionListItem } from '../lib/settings';
	import { mdiCheckAll, mdiDeleteOutline, mdiRestore } from '@mdi/js';
	import Sortable, { Swap } from 'sortablejs';
	import { onMount } from 'svelte';

	export let actionList: ActionListItem[];
	export let defaultActions: Map<Action, boolean>;

	let listContainer: HTMLDivElement;
	let sortableInstance: Sortable;
	let listItems: ActionListItem[] = [];

	onMount(() => {
		const allActions = [...defaultActions.entries()];
		const processedActions = new Set<Action>();
		const newListItems: ActionListItem[] = [];

		for (let index = 0, { length } = actionList; index < length; index += 1) {
			const { action, enabled } = actionList[index];

			if (defaultActions.has(action)) {
				newListItems.push({ action, enabled });
				processedActions.add(action);
			}
		}

		for (let index = 0, { length } = allActions; index < length; index += 1) {
			const [action, enabled] = allActions[index];

			if (!processedActions.has(action)) {
				newListItems.push({ action, enabled });
				processedActions.add(action);
			}
		}

		listItems = newListItems;

		try {
			Sortable.mount(new Swap());
		} catch (_) {
			// no-op
		}

		sortableInstance = Sortable.create(listContainer, {
			swap: true,
			swapClass: 'swap',
			animation: 150,
			filter: '.disable-sort',
			store: {
				get: () => [...processedActions],
				set: onUpdateActionList,
			},
		});

		return () => {
			sortableInstance.destroy();
		};
	});

	function onToggle(newValue: boolean) {
		const sortedList = getSortedList();

		listItems = sortedList.map((listItem) => ({ action: listItem.action, enabled: newValue }));
		actionList = listItems;
	}

	function onRestoreDefaults() {
		const defaultList: ActionListItem[] = [];
		const defaults = [...defaultActions.entries()];

		for (let index = 0, { length } = defaults; index < length; index += 1) {
			const [action, enabled] = defaults[index];

			defaultList.push({ action, enabled });
		}

		listItems = defaultList;
		actionList = defaultList;
		sortableInstance.sort([...defaultActions.keys()], false);
	}

	function onUpdateActionList() {
		actionList = getSortedList();
	}

	function getSortedList() {
		const sortedList = sortableInstance.toArray();

		return listItems.slice().sort((a, b) => sortedList.indexOf(a.action) - sortedList.indexOf(b.action));
	}
</script>

<div class="sortable-list-icons">
	<button title="Select all" class="m-r-s" on:click={() => onToggle(true)}>
		<Icon path={mdiCheckAll} />
	</button>
	<button title="Remove all" class="m-r-s">
		<Icon path={mdiDeleteOutline} on:click={() => onToggle(false)} />
	</button>
	<button title="Restore defaults">
		<Icon path={mdiRestore} on:click={onRestoreDefaults} />
	</button>
</div>
<div class="sortable-list-container" bind:this={listContainer}>
	{#each listItems as listItem (listItem.action)}
		<div class="sortable-list-item" data-id={listItem.action}>
			{listItem.action}
			<div class="disable-sort">
				<input type="checkbox" bind:checked={listItem.enabled} on:change={onUpdateActionList} />
			</div>
		</div>
	{/each}
</div>
