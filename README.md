# ttu-whispersync

A [Violentmonkey](https://violentmonkey.github.io/get-it/) script / Chrome extension for listening to audiobooks with ttu ebook-reader

## Getting started

1. Install [Anki](https://apps.ankiweb.net/) and configure deck and note type
2. Install [AnkiConnect](https://ankiweb.net/shared/info/2055492159)
3. Add https://reader.ttsu.app (and http://localhost:5173 for local development) to the webCorsOriginList of AnkiConnect
4. You can install the extension as Violentmonkey script by clicking on this [url](https://github.com/Renji-XD/ttu-whispersync/releases/latest/download/ttu-whispersync.user.js) (you need to be online at installation time in order to download required dependencies) or as [unpackaged](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) extension in a chromium browser by downloading the latest major version from releases or by [building](#development--building) the current version by yourself
5. Open the reader / reload the tab and click on the icon in the bottom left corner to open the menu and load subtitle/audio files
6. Switch to "Match" Tab, match the subtitle against your book and click on "Save & reload page" to enable full functionality like reader highlighting, reader menu, autoscroll etc. after the page was reloaded
7. Configure your experience to your preferences by going to the settings tab

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
| <kbd>Alt</kbd> + <kbd>j</kbd>           | Toggle playback (alt keybind)            |
| <kbd>Cmd</kbd> + <kbd>d</kbd>           | Restart playback for active line         |
| <kbd>Alt</kbd> + <kbd>d</kbd>           | Toggle play and pause for active line    |
| <kbd>Cmd</kbd> + <kbd>l</kbd>           | Toggle playback loop for active line     |
| <kbd>Cmd</kbd> + <kbd>b</kbd>           | Toggle bookmark for active line          |
| <kbd>Cmd</kbd> + <kbd>m</kbd>           | Toggle for merge for active line         |
| <kbd>Cmd</kbd> + <kbd>e</kbd>           | Create new card for active line          |
| <kbd>Alt</kbd> + <kbd>e</kbd>           | Update last created card for active line |
| <kbd>Cmd</kbd> + <kbd>o</kbd>           | Open last exported card in Anki Browser  |
| <kbd>Alt</kbd> + <kbd>g</kbd>           | Edit subtitle                            |
| <kbd>Alt</kbd> + <kbd>z</kbd>           | Copy active subtitle                     |
| <kbd>Cmd</kbd> + <kbd>q</kbd>           | Go to previous subtitle                  |
| <kbd>Alt</kbd> + <kbd>q</kbd>           | Go to next subtitle                      |
| <kbd>Cmd</kbd> + <kbd>k</kbd>           | Decrease playbackrate                    |
| <kbd>Alt</kbd> + <kbd>k</kbd>           | Increase playbackrate                    |
| <kbd>Cmd</kbd> + <kbd>Arrow Left</kbd>  | Rewind                                   |
| <kbd>Cmd</kbd> + <kbd>Arrow Down</kbd>  | Rewind #2                                |
| <kbd>Cmd</kbd> + <kbd>Arrow Right</kbd> | Fast-Forward                             |
| <kbd>Cmd</kbd> + <kbd>Arrow Up</kbd>    | Fast-Forward #2                          |
| <kbd>Alt</kbd> + <kbd>h</kbd>           | Toggle visibility of footer actions      |

## FAQ

### How to create subtitles for audio files

-   Follow instructions for [SubPlz](https://github.com/kanjieater/SubPlz?tab=readme-ov-file#how-to-use)

### What formats are supported

-   .srt / .vtt for subtitle and .m4a / .m4b / .mp3 (with constant bitrate) for audio files (support may depends on used browser / actual audio codec / container)

### Are mobile devices supported

-   The functionality was briefly tested on mobile (android 10, kiwi browser 124.0.6327.4, AnkiconnectAndroid 1.13) but the main focus and support is currently on desktop systems and you may face issues on other devices

Known issues / missing features are e. g. :

-   worse performance
-   no filesystem api support
-   no "open in anki browser" functionality
-   no tag update functionality
-   no duplicate check for creating cards
-   various iOS quirks

### How to use ttu-whispersync on mobile devices

#### Android

-   Install and follow instructions for [AnkiconnectAndroid](https://github.com/KamWithK/AnkiconnectAndroid?tab=readme-ov-file#instructions) (if you need multiple hosts for cors use a '\*' character to whitelist all sources)
-   Install a browser which supports ViolentMonkey or chrome extensions (e. g. [Kiwi](https://play.google.com/store/apps/details?id=com.kiwibrowser.browser))
-   Install ttu-whispersync as described in [Getting started](#getting-started)

#### iOS

-   Install a browser which supports ViolentMonkey or chrome extensions (e. g. [Orion](https://apps.apple.com/us/app/orion-browser-by-kagi/id1484498200))
-   Install ttu-whispersync as described in [Getting started](#getting-started)

Note: iOS may block the ability to select certain files. For subtitles you therefore may need to store the content of a srt subtitle as txt file instead, while for audio you may need to convert the file to a common format like mp3 in advance. In case the loading spinner after selecting an audio file/editing a subtitle is not disappearing, tap a couple of times on the screen to force an user action event, wait 10 seconds and/or disable the cover + chapter options via settings. The active subtitle display can be slightly delayed due to an text track issue on iOS. There is also no equivalent to AnkiconnectAndroid meaning any export functionality is basically missing. As with ttu reader continous mode has several issues and should not be used

### What are the differences between the Violentmonkey script and Chrome extension

-   There are no functional differences, they only differ in the way of installation / storage location. Violentmonkey includes an auto update functionality while updates for the chrome extension need to be loaded manually by downloading the latest version from releases tab

### What are the differences between desktop/mobile Chrome and/or other browsers

-   The Filesystem API is only supported on desktop chromium browsers (some browsers like brave may need to have extra options enabled for it). On other devices/browsers you need to select your files every time you open or refresh the tab. Subtitles have a local storage option, audio files are never stored locally
-   "Enable subtitle copy" will only work in chromium browsers as other browsers block clipboard actions without user interaction

### The menu icon in the bottom left corner is not visible or duplicated

-   It may happen that the footer element was not loaded at script injection time or that you are missing a required site update - connecting to the internet and hard refreshing the tab couple of times should fix this. If you are using the browser extension make sure it has the respective site permissions enabled

### What is the "Invalid ttu version" error

-   You are missing a required site update - connecting to the internet and hard refreshing the tab couple of times should fix this

### I get a very low line match rate

-   Try to change some of the matching options and see if different combinations may increase the match rate. You can also try to hint the script from where to start by clicking on the bullseye icon and clicking on the respective element afterwards

### The matching speed is very low

-   This can give you a hint that the script has problems to find a proper first match against your subtitle. You can try out to tell the script from where to start by clicking on the bullseye icon and clicking on the respective element afterwards or alternatively increase the number of match attempts

### After matching the book it looks different

-   By matching the book the text content is wrapped by helper elements to identify the related subtitle. Depending on the browser this may lead to some layout shifting afterwards and is expected / not really fixable. Whole missing characters or elements can be considered a bug which can be reported under "Issues". You can also try out the "Original" line space mode for matching in case you used a different one before

### Audio file is not loading / loading spinner remains visible

-   Some browser require user interaction in order to fire the required audio load events - so try to click/tap a couple of times on the loading spinner. If you have extensions like uBlock or use browser like brave (with their shield) try to disable them/whitelist the reader and check if the file is now loading

### Files are not loading after the "Reopen Files" confirmation dialog / loading spinner remains visible

-   Your browser may have unsupported implementations (e. g. Arc Browser) for the required apis. Disable the filesystem api via respective setting and reload the page to switch to manual file selection. In case you can't access the confirmation dialog or settings menu you can set the option manually by executing following code snippet in the browser devtools console (typically F12 key) and reloading the page: `window.localStorage.setItem('ttu-whispersync-reader-enable-filesystem-api',0)`

### Files are not reloading with "Enable auto reload"

-   You may have disabled the "Enable filesystem api" option during file import. Dropping the subtitle and audiofile and reloading them should add the required data and should auto load the files on the next page reload

### What are the differences between the recorder and ffmpeg backend

-   The recorder backend will create audio clips by recording the system audio. Therefore it needs to play the audio parts in real time and without muted sound. To avoid issues the main controls of the script will be disabled during this duration. The recorder only supports mp3 as export format. Editing subtitles is only availabe as basic functionality. On browsers like Firefox you may encounter unresponsiveness during the mp3 conversion compared to Chrome
-   The ffmpeg backend uses a WebAssembly compiled version of FFMPEG and therefore has more options for the audio export format. Editing subtitles is available with the advanced editor. The ffmpeg backend can process the audio in the background which allows you to continuing using most of the script functionality during export. Furthermore it can provide a data fallback for audio chapters. The ffmpeg backend is limited to files with a maximum size around 1.8 GB. As it needs to copy the file into memory and executes actions inside of it you may encounter unresponsiveness or site crashes on lower spec devices / big files - in this case refresh the tab and consider using the recorder backend instead

### "Failed to fetch" error for exports

-   Make sure your Anki and AnkiConnect are running (on mobile the service needs to be started) and that the respective urls were added to the webCorsOriginList list

### Anki field requirements

-   Anki cards require a non empty key field (first field of your card template). Trying to create a card without configuring the sentence or sound field (from which one of them need to be the key field) will therefore fail. In case you have the duplicate check disabled you can enable the "Allow empty key field" setting as workaround but note that this is considered bad practice and can also be confusing in the card browser

### "Export(s) failed" details

-   You can find more details by opening the developer tools of your browser (often F12 keybind on desktop) and checking the console tab / output

### Card updates are not working on android

-   Make sure to have AnkiconnectAndroid 1.14 (or higher) installed - previous versions are not supporting the required apis for updates

### Exported covers have a different file extension

-   Your browser may not support creating images in the requested format and therefore fallbacked to the png image format

### What is the bookmark functionality

-   You can bookmark subtitles to "remember" them in order to listen to important lines again or do a bulk export later to not interrupt your session. You can find them by opening the subtitle list menu (main icon in the bottom left corner) and enabling the bookmark filter in the top controls. Playing / Looping via respective top control icon will play all bookmarked lines while skipping the ones in between and skipping the update to your current playback position. You can do a bulk export by clicking on the respective icon in the top controls - this will create a card with respective audio for every single subtitle (and is therefore limited to the create action)

### What is the merge functionality

-   You can flag subtitles for merge to "remember" them in order to listen to important lines again or do a merged export to combine multiple lines into one card. You can find them by opening the subtitle list menu (main icon in the bottom left corner) and enabling the merge filter in the top controls. Playing / Looping via respective top control icon will play all flagged lines while skipping the ones in between and skipping the update to your current playback position. You can do a merge export by clicking on the respective icon in the top controls - this will either create one single new card or update your last card with the content of all flagged lines and their respective audio

### Do the export / update keybinds / subtitle / reader / footer actions respect the merge / bookmark filter?

-   No - exports / updates executed in this way will always be executed for the subtitle context it was called on. To avoid wrongly exported / missing data merge / bookmark exports / updates are only available via the audiobook menu buttons on the right side of the cover (with respective filters enabled)

### Is it possible to queue / execute exports in parallel

-   No - there is no export queue implemented. If you e.g. execute an export keybind while an other export is still running it will be simply ignored. If you often want to export close lines it is better to use the bookmark functionality and do a bulk export in the end of your reading/listening session

### Can i rebind the Keybindings?

-   No - the extension is external to the ttu website and therefore has static keybinds in order to avoid collisions with reader keybinds (which are also static)

### Keybind 'X' is not executed

-   Note that most of the keybinds are only executed for the current most recent active subtitle. If none exist no action will be executed but you can still do so with the reader / subtitle actions. For exports see also the [previous](#is-it-possible-to-queue--execute-exports-in-parallel) point. Alternatively you can enable the "Enable time fallback" setting under keybindings which search through the whole list for the closest subtitle on the current playback position

### The player does not auto pause when a dictionary popup is open

-   As extensions cannot access each other directly there is often no direct way to tell if the popup is open or not - therefore ttu-whispersync applies some technical workarounds for attempting to detect those states. Based on the nature of workarounds they may or they may not work - depending on used browser and device. Also make sure to disable dictionary detection for those cases and tryi to explicitly tap into the dictionary popup as some devices may not report the required focus loss event otherwise

### The reader menu / action list is not opening - only my popup dictionary

-   The popop dictionary is probably capturing the necessary events and therefore prevents the script functionality. Check available scan options for your dictionary (e. g. Yomitan will not work with enabled touch press option)

### The audio gets out of sync after seeking / playing for a while

-   You may use a mp3 file with variable bitrate which is not supported. Consider changing the bitrate to a constant value e. g. via Audacity export or FFMPEG:

<details>
<summary>Audacity</summary>
File => Export => Export as mp3

![Icon](src/assets/readme/audacity.png)

</details>

<details>
<summary>FFMPEG example command</summary>

ffmpeg.exe -y -i "path_to_input" -c:v copy -c:a libmp3lame -b:a 128 -map_metadata 0 -id3v2_version 3 -write_xing 0 "output_path"

</details>

### Is it possible to sync data to other devices/browsers

-   The playback position and persisted subtitles can be synced via default "Auto Import/Export" functionality. Matched book content can be synced via manual "Book Data" export - other data is currently not syncable

### Is it possible to read/load books from an external storage source like gdrive?

-   Currently only books loaded via browser storage source / local browser db are supported - otherwise you will get an error like 'required data for id x not found'. You can still sync the progress etc. to those sources

### Is it possible to change the order of actions?

-   You can configure the list of actions and their order for the reader menu, subtitle list and footer as per your preference via settings. To show the action check the respective checkbox. To change the order hold down your mouse/pointer on the respective action box and move it to the item with which you want to swap the position

### Limitation for autoscroll in pagination mode

-   In pagination mode it can happen that a subtitle line extends multiple pages in which case the autoscroll behavior is not working properly. This probably can't be fixed but you can try to minimize those occurrences by enabling the "Avoid Page Break" option of ttu
-   In case you are using the "jpdb-browser-reader" extension you may face the issue of delayed scrolling as this extensions "pushes" the elements out of their original page / order

## Potential enhancements

-   Native ttu reader implementation
-   finer granularity on progress updates during export / recording
-   PiP / separate window for audiobook menu
-   Custom/Extended duplicate checks for updates / mobile
-   Text-to-speech support (e. g. [VOICEVOX](https://voicevox.hiroshiba.jp/), Web Speech API or similar)
-   External file sources

### Not planned

-   Listening statistics / goals
-   Profiles / Per file settings (if then only after native setting sync / profile implementation on ttu)
-   EPUB3 Media Overlays
