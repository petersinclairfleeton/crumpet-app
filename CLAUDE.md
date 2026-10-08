# Crumpet: notes for Claude

Read this first in every session. `PLAN.md` has the product plan and visual
design; this file is how we work and where things are.

## Working with Peter

- **Plain language.** Explain what changed and why in everyday words, not
  jargon. Peter isn't reading the code.
- **Ask with multiple-choice questions** (the question tool) when a decision is
  his to make: features, look, scope. Put the recommended option first.
  Don't ask about things you can decide sensibly yourself.
- **One pull request per feature**, built, tested, merged and published
  without waiting, unless he asks to review first. "Complete the plan" means
  work through it all autonomously and summarise at the end.
- **End with a short summary**: what's new (how to use it), anything that
  didn't work or was left out, and what could come next, as numbered
  choices.
- Be honest about limits and things you couldn't check (for example real
  Microsoft Word isn't available here).

## Shipping a change

1. Work on the session's branch (restart it from `origin/main` after each
   merge, so every PR is fresh).
2. Run every check (below), and look at new screens with a screenshot.
3. Commit, push, open the PR (what's new in plain words, how it was tested),
   then merge it with a merge commit.
4. Merging to `main` publishes the web app to GitHub Pages
   (https://petersinclairfleeton.github.io/crumpet-app/) through
   `.github/workflows/pages.yml`, which also runs the unit tests and a type
   check. Check the run went green.

## Checks

```sh
cd app && npx tsc --noEmit -p . && npx vitest run          # app types + unit tests
cd packages/editor && npx tsc --noEmit -p . && npx vitest run   # editor
cd app && CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test  # browser tests
```

- Browser tests start their own dev server on port 5181. If one is left
  running from earlier, stop it first:
  `for pid in $(ps -eo pid,args | grep "vite --port 5181" | grep -v grep | awk '{print $1}'); do kill $pid; done`
- Unit tests that need the DOM start with `// @vitest-environment jsdom`.
- Test files are type-checked: no `process`, `node:fs` or `Buffer` types in
  `tests/e2e` (use a `globalThis` cast if needed).
- `npx vite build --mode single` makes a one-file app in `app/dist-single`
  (not committed).
- Never run `pip download`/`pip install` inside the repo (it drops files
  there). Use `--target` in the scratchpad. EPUBCheck works that way
  (`pip install --target <scratch> epubcheck`, then
  `java -jar <scratch>/epubcheck/epubcheck.jar book.epub`). LibreOffice is
  installed but can't open files in the cloud container.

## Where things are

- `packages/editor/`: our own rich-text editor (no ProseMirror etc.).
  - `model.ts`: flat list of blocks, each with runs of text. Runs carry
    marks, links, footnotes, comments and tracked changes; blocks carry type,
    style, alignment, tables (`rows`), pictures (`src`), folding and tracked
    paragraph breaks (`brk`).
  - `ops.ts`: small invertible operations (insert, remove, split, join,
    setAttrs, format). Everything is built from these, so undo and sync just
    work. `attrsOf` always includes `brk`; a `setAttrs` whose `to` has no
    `brk` key keeps the block's tracked break.
  - `commands.ts`: editing commands as transactions. `editor.ts`: input
    handling, clipboard, tables, hooks the app sets (`onFootnoteClick`,
    `onCommentKey`, `htmlToBlocks`, `tracking`…). `view.ts`: drawing.
    `paginate.ts`: page view, including room for footnotes.
  - `markdown.ts`: the file format. Plain Markdown, plus `{.style}` at the
    end of a line, `[[Note links]]`, footnotes `^[text]`, pipe tables,
    CriticMarkup for comments `{==text==}{>>Name (date): comment<<}` and
    tracked changes `{++added++}` / `{--deleted--}`, tracked paragraph breaks
    as a tracked `¶` at the start of the line.
  - `diff.ts` and `sync/`: turning remote changes into operations, and
    rebasing undo history.
- `app/`: the app (React + TypeScript + Vite).
  - `src/data/store.ts`: all app state and actions. `types.ts`: notes,
    notebooks, projects, chapters, characters and places, settings.
    `db.ts`: IndexedDB.
  - `src/sync/`: syncing with a folder the person owns (Google Drive). Notes
    are Markdown files with front matter; projects are folders with
    `project.json` (outline, styles, characters and places) and numbered
    chapter files, plus `Research/`; pictures are in `Attachments/`; shared
    settings in `.crumpet/vault.json`. A sync merges three versions (this
    device, the files, the last agreed version).
  - `src/data/`: Word files (`docx.ts`, `zip.ts`), e-books (`epub.ts`), the
    web clipper (`clip.ts`), writing stats, search, templates, attachments.
  - `src/ui/`: screens. `EditorHost.tsx` wraps the editor for notes;
    `Project.tsx` holds the outline, chapter, manuscript and side panes;
    `pages.tsx` is page view, headers and footers, and printing.
  - `public/`: icons, logos (`brand/`), the offline service worker (`sw.js`),
    privacy and terms pages.
- `docs/google-drive-setup.md`: one-off Google setup. The Google client id
  and API key in `app/.env` are public by design. Never ask for or store a
  client secret.

## Known gaps

- Writing stats are added up across devices through
  `.crumpet/stats/<device>.json` (one file per device), but a project's
  deadline counts today's words on this device only.
- Track changes: deletions made through some phone keyboards' word
  suggestions aren't tracked (typing is).
- Names of characters and places match in any case, except a one-word name
  written all in small letters (so Rose isn't found in "rose").
- Comment replies go to Word as Word's own threaded replies
  (`commentsExtended.xml`); checked by tests, not yet in real Word.
- Footnotes restart in each chapter of a manuscript.
- The web clipper doesn't work on sites with strict security settings
  (pasting keeps formatting instead) or in the single-file build.
- Not built yet: native Mac/iPhone/iPad apps, other storage (local folder,
  Dropbox, OneDrive, iCloud), version history, reminders, sharing.
