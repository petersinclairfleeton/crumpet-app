# Editor prototype (throwaway)

A first, deliberately small version of Crumpet's own rich-text editor. It exists to
find out whether our approach holds up before the real app depends on it. Nothing
here is meant to ship as is.

## Run it

```sh
npm install
npm run dev          # http://localhost:5173 (add ?fresh for the sample note, ?blank for an empty one)
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

## What is proven so far

- 13 unit tests, including a randomised test of 3,000 edits that checks every
  transaction can be undone back to exactly the previous document.
- 13 browser tests in Chromium driving real key events: typing, Enter/Backspace
  across blocks, shortcuts, formatting across blocks, markdown shortcuts,
  checklists, undo/redo, replacing a cross-block selection, word deletion, paste,
  emoji deletion, and IME composition (simulated Japanese input). Each test also
  checks that the page still shows exactly what the model holds, and one checks
  that the device-test recorder notices when it doesn't.

## Testing on real devices

`npm run build:single` makes `dist-single/index.html`, one self-contained page that can be
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
drag and drop, soft line breaks, large-document performance, and any sync between
devices.
