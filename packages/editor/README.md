# @crumpet/editor

Crumpet's own rich-text editor engine, with no editor library underneath.

- `src/model.ts`: blocks (paragraphs, headings, quotes, nested list items) holding runs of formatted, optionally linked text.
- `src/ops.ts`: the six invertible operations every change is made of.
- `src/commands.ts`: editing commands (typing, Enter, Backspace, formatting, lists, links, markdown shortcuts).
- `src/history.ts`: undo/redo that keeps working when other devices' edits arrive.
- `src/view.ts`, `src/editor.ts`: draws the model into a `contenteditable` element and turns browser input into operations.
- `src/editor.css`: styles for the note content; the host page provides the colour tokens.
- `src/sync/`: rebasing local edits onto other devices' edits, and a minimal server/client.
- `src/recorder.ts`: logs input events and flags any mismatch between page and model, for device testing.

Used by `app/` and `prototypes/editor/` through the `@crumpet/editor` path alias.

```sh
npm install
npm test          # unit tests, including randomised undo and sync tests (SEEDS=400 for a long soak)
npm run typecheck
```
