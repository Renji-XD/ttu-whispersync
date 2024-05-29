# ttu-whispersync

A [Violentmonkey](https://violentmonkey.github.io/get-it/) script / Chrome extension for listening to audiobooks with ttu ebook-reader

## Getting started

1. Install [Anki](https://apps.ankiweb.net/) and configure deck and note type
2. Install [AnkiConnect](https://ankiweb.net/shared/info/2055492159)
3. Add https://reader.ttsu.app (and http://localhost:5173 for local development) to the webCorsOriginList of AnkiConnect
4. You can install the extension as Violentmonkey script by clicking on this [url](https://github.com/Renji-XD/ttu-whispersync/releases/latest/download/ttu-whispersync.user.js) or as [unpackaged](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) extension in a chromium browser by downloading the latest major version from releases or by [building](#development--building) the current version by yourself
5. Open the reader / reload the tab and click on the icon in the bottom left corner to open the menu and load subtitle/audio files
6. Configure your experience to your preferences by going to the settings tab

## Development / Building

```
# Install pnpm
npm install --global pnpm

# Install dependencies
pnpm install

# Start Violentmonkey script development file watcher and auto rebuild
pnpm run dev

# Start extension development
pnpm run dev:ext

# Build prod version of Violentmonkey script
pnpm run build

# Build dev version of Violentmonkey script
pnpm run build:dev

# Build prod version of extension
pnpm run build:ext
```

## Keybindings

| Keybind                                 | Description                              |
| --------------------------------------- | ---------------------------------------- |
| <kbd>Cmd</kbd> + <kbd>Space</kbd>       | Toggle playback                          |
| <kbd>Cmd</kbd> + <kbd>d</kbd>           | Restart playback for active line         |
| <kbd>Alt</kbd> + <kbd>d</kbd>           | Toggle play and pause for active line    |
| <kbd>Cmd</kbd> + <kbd>l</kbd>           | Toggle playback loop for active line     |
| <kbd>Cmd</kbd> + <kbd>b</kbd>           | Toggle bookmark for active line          |
| <kbd>Cmd</kbd> + <kbd>m</kbd>           | Toggle for merge for active line         |
| <kbd>Cmd</kbd> + <kbd>e</kbd>           | Create new card for active line          |
| <kbd>Alt</kbd> + <kbd>e</kbd>           | Update last created card for active line |
| <kbd>Cmd</kbd> + <kbd>q</kbd>           | Go to previous subtitle                  |
| <kbd>Alt</kbd> + <kbd>q</kbd>           | Go to next subtitle                      |
| <kbd>Cmd</kbd> + <kbd>Arrow Left</kbd>  | Rewind                                   |
| <kbd>Cmd</kbd> + <kbd>Arrow Down</kbd>  | Rewind #2                                |
| <kbd>Cmd</kbd> + <kbd>Arrow Right</kbd> | Fast-Forward                             |
| <kbd>Cmd</kbd> + <kbd>Arrow Up</kbd>    | Fast-Forward #2                          |

## FAQ

### How to create subtitles for audio files

-   Follow instructions for [SubPlz](https://github.com/kanjieater/SubPlz?tab=readme-ov-file#how-to-use)

### What formats are supported

-   .srt / .vtt for subtitle and .m4a / .m4b / .mp3 for audio files (support may depends on used browser / actual audio codec)

### Are mobile devices supported

-   The functionality was briefly tested on mobile (android 10, kiwi browser 124.0.6327.4, AnkiconnectAndroid 1.13) but the main focus and support is currently on desktop systems and you may face issues on other devices

Known issues / missing features are e. g. :

-   worse performance
-   no filesystem api support
-   no "update last created card" functionality
-   no duplicate check for creating cards
-   various iOS quirks

### How to use ttu-whispersync on mobile devices

#### Android

-   Install and follow instructions for [AnkiconnectAndroid](https://github.com/KamWithK/AnkiconnectAndroid?tab=readme-ov-file#instructions)
-   Install a browser which supports ViolentMonkey or chrome extensions (e. g. [Kiwi](https://play.google.com/store/apps/details?id=com.kiwibrowser.browser))
-   Install ttu-whispersync as described in [Getting started](#getting-started)

Note: AnkiconnectAndroid is not implementing all required apis for the export. Therefore card creation may take longer and card updates are currently not supported at all (see this open [pr](https://github.com/KamWithK/AnkiconnectAndroid/pull/60))

#### iOS

-   Install a browser which supports ViolentMonkey or chrome extensions (e. g. [Orion](https://apps.apple.com/us/app/orion-browser-by-kagi/id1484498200))
-   Install ttu-whispersync as described in [Getting started](#getting-started)

Note: iOS may block the ability to select certain files. For subtitles you therefore may need to store the content of a srt subtitle as txt file instead, while for audio you may need to convert the file to a common format like mp3 in advance. In case the loading spinner after selecting an audio file/editing a subtitle is not disappearing tap a couple of times on the screen to force an user action event, wait 10 seconds and/or disable the cover + chapter options via settings. The active subtitle display can be slightly delayed due to an text track issue on iOS. There is also no equivalent to AnkiconnectAndroid meaning any export functionality is basically missing. As with ttu reader continous mode has several issues and should not be used

### What are the differences between the Violentmonkey script and Chrome extension

-   The Violentmonkey script has not included all external dependencies. If you plan to use the cover/chapter functionality or ffmpeg backend you need to be online at the time of loading your first files. Afterwards you can go offline as long as the tab is not closed or refreshed. Violentmonkey includes an auto update functionality
-   The Chrome Extension has full offline compability. Updates need to be loaded manually by downloading the latest version from release tab

### What are the differences between desktop/mobile Chrome and/or other browsers

-   The Filesystem API is only supported on desktop chromium browsers (some browsers like brave may need to have extra options enabled for it). On other devices/browsers you need to select your files every time you open or refresh the tab. Subtitles have a local storage option, audio files are never stored locally

### The menu icon in the bottom left corner is not visible or duplicated

-   It may happen that the footer element was not loaded at script injection time or that you are missing a required site update - connecting to the internet and hard refreshing the tab couple of times should fix this. If you are using the browser extension make sure it has the respective site permissions enabled

### What is the "Invalid ttu version" error

-   You are missing a required site update - connecting to the internet and hard refreshing the tab couple of times should fix this

### What are the differences between the recorder and ffmpeg backend

-   The recorder backend will create audio clips by recording the system audio. Therefore it needs to play the audio parts in real time and without muted sound. To avoid issues the main controls of the script will be disabled during this duration. The recorder only supports mp3 as export format. Editing subtitles is only availabe as basic functionality. On browsers like Firefox you may encounter unresponsiveness during the mp3 conversion compared to Chrome
-   The ffmpeg backend uses a WebAssembly compiled version of FFMPEG and therefore has more options for the audio export format. Editing subtitles is available with the advanced editor. The ffmpeg backend can process the audio in the background which allows you to continuing using most of the script functionality during export. It is limited to files with a maximum size around 1.8 GB. As the ffmpeg backend needs to copy the file into memory and executes actions inside of it you may encounter unresponsiveness or site crashes on lower spec devices / big files - in this case refresh the tab and consider using the recorder backend instead

### Is it possible to queue / execute exports in parallel

-   No - there is no export queue implemented. If you e.g. execute an export keybind while an other export is still running it will be simply ignored. If you often want to export close lines it is better to use the bookmark functionality and do a bulk export in the end of your reading/listening session

### Keybind 'X' is not executed

-   Note that most of the keybinds are only executed for the current most recent active subtitle. If none exist no action will be executed but you can still do so with the reader / subtitle actions. For exports see also the [previous](#is-it-possible-to-queue--execute-exports-in-parallel) point

### The reader menu / action list is not opening - only my popup dictionary

-   The popop dictionary is probably capturing the necessary events and therefore prevents the script functionality. Check available scan options for your dictionary (e. g. Yomitan will not work with enabled touch press option)

### Is it possible to sync data to other devices/browsers

-   The playback position and persisted subtitles can be synced via default "Auto Import/Export" functionality. Matched book content can be synced via manual "Book Data" export - other data is currently not syncable

### Is it possible to read/load books from an external storage source like gdrive?

-   Currently only books loaded via browser storage source / local browser db are supported - otherwise you will get an error like 'required data for id x not found'. You can still sync the progress etc. to those sources

### Limitation for autoscroll in pagination mode

-   In pagination mode it can happen that a subtitle line extends multiple pages in which case the autoscroll behavior is not working properly. This probably can't be fixed but you can try to minimize those occurrences by enabling the "Avoid Page Break" option of ttu
-   In case you are using the "jpdb-browser-reader" extension you may face the issue of delayed scrolling as this extensions "pushes" the elements out of their original page / order

## Potential enhancements

-   Native ttu reader implementation
-   finer granularity on progress updates during export / recording
-   PiP / separate window for audiobook menu
-   Quick controls in footer
-   Custom/Extended duplicate checks for updates / mobile
-   Text-to-speech support (e. g. [VOICEVOX](https://voicevox.hiroshiba.jp/), Web Speech API or similar)
-   External file sources

### Not planned

-   Listening statistics / goals
-   Profiles / Per file settings (if then only after native setting sync / profile implementation on ttu)
-   EPUB3 Media Overlays
