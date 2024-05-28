<script lang="ts">
	import { SettingsMenu } from '../lib/settings';

	export let openSettingsMenu: SettingsMenu;
	export let settingsMenu: SettingsMenu;

	$: open = openSettingsMenu === settingsMenu;

	function onToggleSettingsMenu() {
		openSettingsMenu = open ? SettingsMenu.NONE : settingsMenu;
	}
</script>

<details {open}>
	<summary on:click|stopPropagation|preventDefault={onToggleSettingsMenu}>{settingsMenu}</summary>
	<div class="settings-grid">
		<slot></slot>
	</div>
</details>
