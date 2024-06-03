<script lang="ts">
	import DialogTemplate from './DialogTemplate.svelte';
	import type { DiffDetail } from '../lib/general';
	import { createEventDispatcher } from 'svelte';

	export let subtitleDiffDetails: DiffDetail[];

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
				{#each subtitleDiffDetails as subtitleDiffDetail (subtitleDiffDetail.id)}
					<div>{subtitleDiffDetail.id}</div>
					<div>{subtitleDiffDetail.original}</div>
					<div>{subtitleDiffDetail.adjusted}</div>
				{/each}
			</div>
		</div>
	</svelte:fragment>
	<div slot="footer">
		<button on:click={() => dispatch('close')}>Close</button>
	</div>
</DialogTemplate>
