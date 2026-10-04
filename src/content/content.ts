import AudioBookMenu from '../components/AudioBookMenu.svelte';
import { Action, defaultFooterActionList, type ActionListItem } from '../lib/settings';
import pageStyles from '../styles.css?inline';

let componentMenu: AudioBookMenu | undefined;
let componentContainerElement: HTMLDivElement | undefined;
let currentBookId: number | undefined;
let currentBookContent: HTMLDivElement | null = null;
let pendingMount: AbortController | undefined;
let observerTimer: number | undefined;

function getReaderBookId() {
	const site = new URL(window.location.href);
	if (
		!['https://reader.ttsu.app', 'http://localhost:5173'].includes(site.origin) ||
		!site.pathname.startsWith('/b') ||
		!site.searchParams.has('id')
	)
		return undefined;
	const id = Number(site.searchParams.get('id'));
	return Number.isInteger(id) && id > 0 ? id : undefined;
}

function scheduleUpdate() {
	// Coalesce mutations but always process the latest DOM and route.
	if (observerTimer !== undefined) return;
	observerTimer = window.setTimeout(() => {
		observerTimer = undefined;
		void reconcileReader();
	}, 100);
}

async function reconcileReader() {
	const bookId = getReaderBookId();
	const bookContentElement = document.querySelector<HTMLDivElement>('.book-content');
	if (
		bookId !== currentBookId ||
		bookContentElement !== currentBookContent ||
		(componentMenu && !componentContainerElement?.isConnected)
	) {
		pendingMount?.abort();
		pendingMount = undefined;
		componentMenu?.$destroy();
		componentMenu = undefined;
		componentContainerElement?.remove();
		componentContainerElement = undefined;
		currentBookId = bookId;
		currentBookContent = bookContentElement;
	}
	if (bookId === undefined || !bookContentElement || componentMenu || pendingMount) return;
	const footerElm = document.querySelector<HTMLDivElement>('.z-10.flex.h-8.w-full');
	if (!footerElm?.firstElementChild) return;

	const controller = new AbortController();
	pendingMount = controller;
	try {
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

		const root = document.querySelector<HTMLElement>(':root')!;
		componentContainerElement = document.createElement('div');
		const stylesId = 'ttu-whispersync-styles';
		const sandboxId = 'ttu-whispersync-sandbox';
		const [r, g, b] = (bookContentElement.style.color.match(/rgb[a]{0,1}\((.+)\)/)?.[1] || '0,0,0,1')
			.split(',')
			.map((x: string) => parseFloat(x.trim()));

		let sandboxElement = document.getElementById(sandboxId) as HTMLIFrameElement;
		let pageStylesElement = document.getElementById(stylesId);
		const backgroundColor = document.body.style.backgroundColor || getComputedStyle(document.body).backgroundColor;

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

			await new Promise<void>((resolve, reject) => {
				const cleanup = () => {
					clearTimeout(timer);
					sandboxElement.removeEventListener('load', onLoad);
					controller.signal.removeEventListener('abort', onAbort);
				};
				const onLoad = () => {
					cleanup();
					resolve();
				};
				const onAbort = () => {
					cleanup();
					sandboxElement.remove();
					reject(new Error('Mount canceled'));
				};
				const timer = setTimeout(() => {
					cleanup();
					sandboxElement.remove();
					reject(new Error('Sandbox failed to load'));
				}, 10000);
				sandboxElement.addEventListener('load', onLoad, { once: true });
				controller.signal.addEventListener('abort', onAbort, { once: true });
				document.body.appendChild(sandboxElement);
			});
		}

		if (
			controller.signal.aborted ||
			getReaderBookId() !== bookId ||
			!bookContentElement.isConnected ||
			!footerElm.isConnected
		)
			return;

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
		footerElm.firstElementChild!.insertAdjacentElement('beforebegin', componentContainerElement);

		root.style.setProperty('--ttu-whispersync-background-color', backgroundColor);
		root.style.setProperty('--ttu-whispersync-color', `rgb(${r},${g},${b})`);

		componentMenu = new AudioBookMenu({
			target: componentContainerElement,
			props: {
				componentContainerElement,
				bookContentElement,
				sandboxElement,
				currentBookId: bookId,
			},
		});
	} catch (error) {
		if (!controller.signal.aborted) {
			componentContainerElement?.remove();
			console.error('Failed to initialize ttu-whispersync', error);
		}
	} finally {
		if (pendingMount === controller) pendingMount = undefined;
	}
}

function stopEventPropagation(event: Event) {
	event.stopPropagation();
}

const observer = new MutationObserver(scheduleUpdate);
observer.observe(document.body, { attributes: true, childList: true, subtree: true });
window.addEventListener('popstate', scheduleUpdate);
window.addEventListener('hashchange', scheduleUpdate);
void reconcileReader();
