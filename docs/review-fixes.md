# Long-book matching fixes (1.0.14)

- Compare book and subtitle lengths using the same whitespace normalization. The previous comparison counted spaces in subtitles but not in book text, overran cue boundaries and could miss even an exact cue near the end of a book.
- Convert Unicode strings to character arrays once when computing Dice similarity. Score candidate prefixes and suffixes incrementally by updating n-gram counts, and locate exact prefixes in one pass. This removes the repeated scans that made long cues extremely expensive. Preserve direct substring scoring for contextual Greek sigma lowercasing.
- Yield to the browser after approximately 16 ms of work between matching steps, as well as at percentage changes. Check cancellation immediately after yielding. Large subtitle files no longer have to process hundreds of cues before letting the cancel button respond. Individual DOM operations and comparisons still run synchronously.
- Preserve cue IDs/timestamps and book text. Matching does not repair implausible timestamps in source SRT files.

Validation: 39 regression tests, including long cues, Unicode candidate-score equivalence, exact matches across inline elements, and cancellation before 1% progress. On a local English EPUB with 38,726 and 38,046 cues, both complete matching runs finished in about 12 seconds at the default 0.9 threshold and 50 attempts. Match rates were 95.62% and 94.10%. These measurements execute the actual matcher in jsdom with EPUB spine bodies in reader-style containers; they are not timings from the user's installed reader. Book contents and subtitle fixtures are not included in this repository.

## Earlier review fixes (1.0.13)

Base: Renji-XD/ttu-whispersync commit `cfca4f69543d032f4807c39b3c38736d1475b2c0`.

## Data safety and export

- Preserve Anki deck/model/field preferences on network errors in both exports and the Settings screen. A successful response that proves a selected entity no longer exists may still clear that selection.
- Store audio and covers with `deleteExisting: false` and use AnkiConnect's returned filename. Re-exporting changed timing, changing the middle lines of a merge, or loading another file with the same name must not replace media used by existing cards.
- Supply a nonempty cover filename even when Web Crypto is unavailable.
- Normalize Unicode whitespace in tags, including full-width Japanese spaces, and ignore empty comma-separated tags.
- Pass cancellation to Anki HTTP requests and impose a 30-second request deadline. Always attempt temporary-file cleanup and preserve the last confirmed exported note after partial success. Restore the previous browser selection where available. Canceling an operation does not roll back notes already accepted by Anki; a disconnected request can have an unknown server-side outcome.
- Keep the merge selection when export is canceled.
- Dispatch "open last exported card" only for that action, not as a catch-all for unavailable actions.
- Reject failed FFmpeg commands before reading their output so an earlier batch item's file cannot be reused as a successful conversion.

## Subtitles and matching

- Leave unmatched subtitles unchanged during alignment. Preserve whitespace between matched fragments and compare against the current text, so a manual edit can be aligned back to the book.
- Rematch from the original HTML backup and retain that backup on subsequent saves. This prevents new corruption; an original already overwritten by an older version cannot be reconstructed automatically.
- Retain every trailing unmatched subtitle in both adjusted-SRT and unmatched-text downloads.
- Skip whitespace-only child nodes when choosing a match hint.
- Accept uppercase file extensions in imports and MP3 metadata detection, and report unsupported dropped files. Guard native filesystem constructors on browsers that do not expose them and do not append undefined file entries for empty folders.
- Preserve all cues in SRT files with duplicate IDs. Keep existing unique IDs and assign unused numeric IDs to duplicates; navigation indexes remain contiguous.
- Round total milliseconds before splitting timestamps, carrying across second/minute/hour boundaries.
- Report empty HTML as a controlled parse failure instead of dereferencing the nonexistent body of an XML document.

## Audio and browser lifecycle

- Finish recording at the exact end of a file, or on the ended event if a subtitle extends beyond the file; restart playback when looping at EOF.
- Stop a paused recording immediately on cancellation, without waiting for another timeupdate. Avoid duplicate recorder stops and report encoding errors without calling cleared callbacks.
- Clamp PCM samples to the signed 16-bit range, support mono decoding, reset recording chunks, close decoding contexts, and release source contexts when audio elements are removed.
- Parse full chapter titles containing colons.
- Cache the fetched WASM response instead of downloading it again via Cache.add.
- Report FFmpeg initialization failure without persistently changing the selected backend. Users can retry or explicitly choose Recorder.
- Mount the menu only when both book and footer exist; process the latest DOM/route state, cancel pending sandbox initialization on navigation, and clean up old menus on book changes. Use computed background color rather than an unbounded wait for an inline body style.
- Bound the reader sync wait and remove the response listener on success or timeout.
- Put the action-list reset/select handlers on the whole button.
- Document Control as an alternative to system-reserved Command shortcuts on macOS. Both modifiers were already accepted by the implementation; page code cannot reliably override operating-system shortcuts.

## Items intentionally not treated as confirmed defects

- Playback-position persistence on each timeupdate is frequent, but the review provided no measurement of storage/network pressure or reader-side sync behavior. Throttling would change progress durability and is deferred until measured; pausing, seeking, and closing a tab must not lose the last position.
- `-write_xing 0` for other audio formats was not shown to fail and was retained. The earlier review also retained `\p{punct}`; version 1.0.14 subsequently replaced that character-counting condition so book and subtitle lengths use the same normalization.
- File reload taking precedence over locally persisted subtitles is described as fallback behavior in the existing setting. It was not changed as part of this review.

## Verification

Run:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build:all
```

Tests execute the actual TypeScript function bodies extracted from the source files, with jsdom for DOM behavior and deterministic doubles for browser audio and external Anki/FFmpeg services. They cover imports, matching, timestamps, alignment, menu lifecycle, HTTP cancellation/deadlines, partial exports, media collisions, audio completion, PCM clipping, context cleanup, and caching. They are not full end-to-end tests against a live Anki collection or an installed extension.

The type-check configuration excludes vendored FFmpeg JavaScript while keeping application TypeScript/Svelte checks enabled. ReaderMenu captures a stable Range reference for asynchronous positioning callbacks.

Verified locally: 35 tests passed; `pnpm check` reported zero errors and warnings; all three distribution builds completed. The actual built Tampermonkey userscript was also loaded in a browser against a local reader fixture with disposable IndexedDB data. A delayed footer mounted one menu, switching books retained one menu, and leaving the reader removed it, with no browser console errors during those checks. Live Anki, mobile browsers, and an installed Chrome extension were not exercised.
