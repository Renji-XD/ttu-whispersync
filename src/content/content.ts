import AudioBookMenu from '../components/AudioBookMenu.svelte';
import { Action, defaultFooterActionList, type ActionListItem } from '../lib/settings';
import pageStyles from '../styles.css?inline';

let wasOnReader = false;
let currentBookId = 0;
let componentMenu: AudioBookMenu;
let observerTimer: number | undefined;

async function observerCallback() {
	if (observerTimer) {
		return;
	}

	observerTimer = window.setTimeout(() => (observerTimer = undefined), 1000);

	const site = new URL(window.location.href);
	const isOnReader =
		site.href.startsWith('https://reader.ttsu.app/b') || site.href.startsWith('http://localhost:5173/b')
			? site.searchParams.has('id')
			: false;

	if (isOnReader && !wasOnReader) {
		wasOnReader = true;

		let bookContentElement = document.querySelector<HTMLDivElement>('.book-content');

		await new Promise<void>((resolve) => {
			if (bookContentElement) {
				return resolve();
			}

			const waitForBookContentElement = setInterval(() => {
				bookContentElement = document.querySelector<HTMLDivElement>('.book-content');

				if (bookContentElement) {
					clearInterval(waitForBookContentElement);
					resolve();
				}
			}, 500);
		});

		const footerElm = document.querySelector<HTMLDivElement>('.z-10.flex.h-8.w-full');

		if (!bookContentElement || !footerElm || !footerElm.firstElementChild) {
			return;
		}

		const footerActions = window.localStorage.getItem('ttu-whispersync-reader-footer-actions');

		if (footerActions) {
			const actionList: Action[] = JSON.parse(footerActions);
			const newActionList: ActionListItem[] = [];

			for (let index = 0, { length } = actionList; index < length; index += 1) {
				const action = actionList[index];

				if (defaultFooterActionList.has(action)) {
					newActionList.push({ action, enabled: true });
				}
			}

			window.localStorage.setItem('ttu-whispersync-action-list-of-footer', JSON.stringify(newActionList));
			window.localStorage.removeItem('ttu-whispersync-reader-footer-actions');
		}

		currentBookId = Number.parseInt(site.searchParams.get('id') || '0', 10);

		const root = document.querySelector<HTMLElement>(':root')!;
		const componentContainerElement = document.createElement('div');
		const stylesId = 'ttu-whispersync-styles';
		const sandboxId = 'ttu-whispersync-sandbox';
		const [r, g, b] = (bookContentElement.style.color.match(/rgb[a]{0,1}\((.+)\)/)?.[1] || '0,0,0,1')
			.split(',')
			.map((x: string) => parseFloat(x.trim()));

		let sandboxElement = document.getElementById(sandboxId) as HTMLIFrameElement;
		let pageStylesElement = document.getElementById(stylesId);
		let backgroundColor = '';

		if (!pageStylesElement) {
			pageStylesElement = document.createElement('style');
			pageStylesElement.id = stylesId;
			pageStylesElement.innerText = pageStyles;

			document.head.appendChild(pageStylesElement);
		}

		if (!sandboxElement && window.chrome && chrome.runtime && chrome.runtime.id) {
			sandboxElement = document.createElement('iframe');
			sandboxElement.id = sandboxId;
			sandboxElement.style.display = 'none';
			sandboxElement.src = chrome.runtime.getURL('src/sandbox/sandbox.html');

			await new Promise((resolve) => {
				sandboxElement.addEventListener('load', resolve, false);

				document.body.appendChild(sandboxElement);
			});
		}

		componentContainerElement.classList.add(
			'flex',
			'h-full',
			'items-center',
			'justify-center',
			'text-sm',
			'sm:text-lg',
		);
		componentContainerElement.addEventListener('click', stopEventPropagation, false);

		footerElm.classList.remove('justify-between');
		footerElm.firstElementChild.insertAdjacentElement('beforebegin', componentContainerElement);

		await new Promise<void>((resolve) => {
			const waitForBodyStyleInterval = setInterval(() => {
				backgroundColor = document.body.style.backgroundColor;

				if (backgroundColor) {
					clearInterval(waitForBodyStyleInterval);
					resolve();
				}
			}, 500);
		});

		root.style.setProperty('--ttu-whispersync-background-color', backgroundColor);
		root.style.setProperty('--ttu-whispersync-color', `rgb(${r},${g},${b})`);

		componentMenu = new AudioBookMenu({
			target: componentContainerElement,
			props: {
				componentContainerElement,
				bookContentElement,
				sandboxElement,
				currentBookId,
			},
		});
	} else if (!isOnReader) {
		componentMenu?.$destroy();

		clearTimeout(observerTimer);

		currentBookId = 0;
		wasOnReader = false;
		observerTimer = undefined;
	}
}

function stopEventPropagation(event: Event) {
	event.stopPropagation();
}

const observer = new MutationObserver(observerCallback);

observer.observe(document.body, { attributes: true });

observerCallback();
