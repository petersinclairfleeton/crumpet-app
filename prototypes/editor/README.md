# Editor prototype (throwaway)

A first, deliberately small version of Crumpet's own rich-text editor. It exists to
find out whether our approach holds up before the real app depends on it. Nothing
here is meant to ship as is.

## Run it

```sh
npm install
npm run dev          # http://localhost:5173 (add ?fresh for the sample note, ?blank for an empty one)
                     # http://localhost:5173/sync.html for the two-device sync demo
npm test             # model and command unit tests
npm run e2e          # browser tests (Chromium); set CHROMIUM_PATH if Playwright's browser isn't installed
npm run typecheck
```

The page shows a note styled like the Crumpet design, a formatting toolbar, and a
debug panel with the live model, the operations each edit produced, and the raw
input events the browser sent.

## How it works

No editor library. We write the document model, operations, rendering and input
handling ourselves.

- **Model** (`src/model.ts`): a flat list of blocks (paragraph, heading 1/2,
  checklist item, quote), each holding runs of text with marks (bold, italic,
  underline, strike, code). Immutable, so unchanged blocks keep their identity.
- **Operations** (`src/ops.ts`): the only way the document changes. Six kinds:
  insert, remove, split, join, setAttrs, format. Each one is serialisable and has
  an exact inverse. This gives undo/redo now and is the unit we will sync between
  devices later.
- **Commands** (`src/commands.ts`): typing, Enter, Backspace/Delete, word deletion,
  formatting, block types, markdown shortcuts (`# `, `## `, `[] `, `> `), paste.
  Pure functions from state to a transaction, so they are tested without a browser.
- **History** (`src/history.ts`): undo/redo by applying inverted operations;
  quick typing merges into one step.
- **View** (`src/view.ts`): draws the model into the page, rebuilding only the
  blocks that changed, and converts between page positions and model positions.
- **Input** (`src/editor.ts`): the page is a `contenteditable` element, so the
  browser still provides the caret, selection, keyboard handling, spellcheck,
  accessibility and IME. Every `beforeinput` event is cancelled and turned into
  our own operations. Where the browser cannot be stopped (IME composition, some
  autocorrect paths), we let it change the page and then read the changed block
  back into the model as ordinary operations, then redraw it.

Using `contenteditable` only as an input surface is the same approach the major
editors take. The alternative, a hidden text field with our own caret and text
layout (as in Google Docs), would mean rebuilding selection, IME and accessibility
too. That is far bigger and not justified until this approach is shown to fail.

## Sync

`src/sync/` holds a first version of syncing one note between devices, run against a
server simulated in the page (`sync.html`: two editors side by side, each with an
online/offline switch).

- The **server** keeps one ordered list of operations and only accepts a batch built
  on its latest version. Every device applies the same operations in the same order,
  so every device ends up with the same note.
- Each **device** keeps the last version the server confirmed plus its own edits the
  server hasn't accepted yet. When other devices' edits arrive, it rewrites its own
  pending edits to sit on top of them (`src/sync/transform.ts`): every position is
  mapped back through its own earlier edits, forward through the other devices'
  edits, then forward through its own rewritten edits. Positions inside text it typed
  offline are remembered across that round trip, so formatting and further typing stay
  attached to that text. The data each edit carries is then re-read from the note it
  will apply to. Formatting ops record their intent ("bold on"), so they can be
  re-applied to text that changed underneath them.
- The caret is moved the same way, so it stays next to the same text when others'
  edits arrive.

- **Undo works across devices.** Every change to the note, from anywhere, goes on a
  timeline. When nothing from another device has come in since an edit, undo applies
  its exact inverse. Otherwise the inverse is rebased over everything since, the same
  way as pending sync edits, so it removes your words from where they are now and
  leaves other people's edits alone (`src/history.ts`).
- **Typing is compressed.** A burst of typing, or of Backspace presses, is merged
  into one operation before it is sent, and into one undo step.

Remembering positions inside text that is removed and later put back (by undo, redo
or a sync round trip) is what makes this work. Each memory is tied to one pass of an
edit (the edit, its undo, its redo), to the paragraph the text came from, and to the
same text coming back. Several bugs found by the randomised tests lived here.

Limits for now: there is no real server, storage or network.

## What is proven so far

- 67 unit tests:
  - Editing commands, plus a randomised test of 3,000 edits that checks every
    transaction can be undone back to exactly the previous document.
  - Seven sync conflict scenarios (simultaneous typing, formatting across a split the
    other device made, typing into a paragraph the other device merged away, bold on
    text typed offline, deleting around the other device's insert, and more), and caret
    placement after a sync.
  - A randomised sync test: three devices making 600 random edits and undos while
    randomly going offline and online, over 40 seeds. Every run ends with all devices
    identical and no edit dropped.
  - Undo history: every undo returns to exactly the state before that edit and redo
    replays them all; undoing everything with merged typing returns to the start; and
    with a second device editing concurrently, undo removes only your own words. These
    run 30 random histories each by default; `SEEDS=400 npm test` runs a long soak.
- 16 browser tests in Chromium driving real key events: typing, Enter/Backspace
  across blocks, shortcuts, formatting across blocks, markdown shortcuts,
  checklists, undo/redo, replacing a cross-block selection, word deletion, paste,
  emoji deletion, and IME composition (simulated Japanese input). Each test also
  checks that the page still shows exactly what the model holds, and one checks
  that the device-test recorder notices when it doesn't. Two more drive the sync page:
  live typing reaching the other device, offline edits on both devices merging, and
  undo on one device after the other has edited.

## Testing on real devices

`npm run build:single` makes `dist-single/index.html` (the editor) and
`dist-single-sync/sync.html` (the sync demo), each one self-contained page that can be
opened on any device. The debug panel's **Device test** section records every keyboard,
input and composition event, marks which ones the editor handled, and checks after each
one that the page still matches the model. Anything that slips past shows up as a
problem in red. **Copy report** puts the whole log, plus the device details, on the
clipboard to send back.

## Not tested yet: needs real devices

These are the main risks, and automated Chromium on Linux can't cover them:

- **iPhone and iPad (Safari/WebKit)**: on-screen keyboard, autocorrect,
  predictive text, dictation, text replacement, selection handles.
- **Mac Safari**: input events and IME differ from Chrome.
- **Android (Gboard)**: composes almost everything, even plain typing.
- **Real IMEs**: Japanese, Chinese and Korean on each platform.
- **Screen readers**: VoiceOver on Mac and iOS.

## Known gaps (deliberate for now)

Nested lists, links, images, tables, rich paste (formatting is dropped on paste),
drag and drop, soft line breaks, large-document performance, and a real sync server
and storage.
