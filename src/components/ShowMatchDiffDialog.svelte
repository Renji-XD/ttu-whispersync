<script lang="ts">
	import DialogTemplate from './DialogTemplate.svelte';
	import type { DiffDetail } from '../lib/general';
	import { createEventDispatcher } from 'svelte';

	export let diffDetails: DiffDetail[];

	const dispatch = createEventDispatcher<{
		close: void;
	}>();
</script>

<DialogTemplate>
	<svelte:fragment slot="header">Differences</svelte:fragment>
	<svelte:fragment slot="content">
		<div class="overflow-auto p-s">
			<div class="diff-grid">
				<div>Id</div>
				<div>Original</div>
				<div>Adjusted</div>
				{#each diffDetails as diffDetail (diffDetail.id)}
					<div>{diffDetail.id}</div>
					<div>{diffDetail.original}</div>
					<div>{diffDetail.adjusted}</div>
				{/each}
			</div>
		</div>
	</svelte:fragment>
	<div slot="footer">
		<button on:click={() => dispatch('close')}>Close</button>
	</div>
</DialogTemplate>
