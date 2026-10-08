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
    marks, links, footnotes, comments, tracked changes and a `look` (font,
    size, colour, highlight, super/subscript); blocks carry type, style,
    alignment, tables (`rows`, `tbl`), pictures (`src`), folding, tracked
    paragraph breaks (`brk`) and `para` (Word's paragraph settings: spacing,
    indents, page breaks, keeps, list number/bullet style and start,
    borders, shading). A `toc` block is a table of contents. A paragraph
    styled `toggle` folds the lines after it (up to a blank line or heading)
    like a heading folds its section (`foldedUnder`); quotes styled `note`,
    `tip`, `warning` or `important` are callouts. A `code` block is maths (LaTeX)
    or a diagram (Mermaid): its source in a text area, drawn by the app's
    renderer (`setCodeRenderer`, `app/src/ui/coderender.ts`, KaTeX and
    Mermaid loaded when first needed); saved as ```` ```math ```` /
    ```` ```mermaid ```` fences.
  - `table.ts`: table formatting (merged cells, shading, column alignment
    and widths, heading row, banding, lines) and keeping it in step as rows and
    columns change. `cells.ts`: a cell's text is a line of inline
    Markdown (bold, fonts, colours), drawn into and read from its box, and
    formatting applied there (the toolbar goes to the cell being typed in).
  - `shape.ts`: text boxes and shapes (`shape` blocks: rectangle, rounded,
    oval, line, arrow; size in inches, fill, line, wrapping left/right, and
    one line of inline Markdown text). Saved as
    `{shape ellipse w=2 h=1 fill=#cfe2f3 line=none wrap=left} Text`.
  - `ops.ts`: small invertible operations (insert, remove, split, join,
    setAttrs, format). Everything is built from these, so undo and sync just
    work. `attrsOf` always includes `brk`; a `setAttrs` whose `to` has no
    `brk` key keeps the block's tracked break.
  - `commands.ts`: editing commands as transactions. `editor.ts`: input
    handling, clipboard, tables, hooks the app sets (`onFootnoteClick`,
    `onCommentKey`, `htmlToBlocks`, `tracking`…). `view.ts`: drawing
    (including the Table menu under tables and the contents list; list
    numbers are worked out there, not by CSS counters).
    `paginate.ts`: page view's layout engine. The text is measured as one
    flow per section (at its column width), then dealt onto page boxes
    (`.pg` > `.pg-band` > `.pg-col`) of each section's size and columns; a
    paragraph running past a column is split into its element plus
    continuation elements (`data-cont`, `data-from` = offset in the text).
    Before every redraw the pages are taken apart (`clear()`), so the view
    always draws one flat flow. Handles footnote room, page breaks, keeps,
    widows and orphans, balanced columns before a continuous section break,
    and the contents' page numbers. The app draws sheets, headers, footers
    and footnotes from `editor.pageBoxes`.
  - `markdown.ts`: the file format. Plain Markdown, plus `{.style}` at the
    end of a line, `[[Note links]]`, footnotes `^[text]`, pipe tables,
    CriticMarkup for comments `{==text==}{>>Name (date): comment<<}` and
    tracked changes `{++added++}` / `{--deleted--}`, tracked paragraph breaks
    as a tracked `¶` at the start of the line. Text looks are spans
    `[text]{font="Lora" size=14 color=#cc0000}`; paragraph settings go at
    the end of the line `{.center line=2 num=upper-roman border=tb}` (a
    section break before a paragraph is `{sect=page cols=2 orient=landscape mt=1.5}`
    or `sect=cont`, a column break `.colbreak`); a
    table's look is a `{table .banded merge=1-0-1-2}` line under it, with
    column alignment in its rule row; `[TOC]` is a table of contents.
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
    settings in `.crumpet/vault.json`; snapshots one file each in
    `.crumpet/snapshots/` (`sync/snapshots.ts`, never changed once taken). A sync merges three versions (this
    device, the files, the last agreed version).
  - `src/data/keywords.ts`: chapter keywords (Scrivener's), saved in the
    chapter file's `tags`; `ui/keywords.tsx` draws chips and the outline's
    filter (`keywordFilter` in the store, applied to outline, cards and
    manuscript by `shownOutline`).
  - `src/data/textstats.ts`: text statistics, words used most, and the
    linguistic focus finders (dialogue, -ly adverbs, filler, likely passive);
    the right sidebar's Writing tab (`ui/writingtab.tsx`) highlights them with
    the CSS highlight `crumpet-focus` and keeps the session target.
  - `src/data/revisions.ts`: revision mode (Scrivener's): the round's
    colour is set on the editor (`editor.revisionColor`, via `useTracking`)
    and typed text takes it as an ordinary text colour; `removeRevisions`
    takes the colours off.
  - `src/data/filetext.ts`: the words in attached PDFs (pdf.js) and pictures
    (Tesseract OCR, shipped with the app under `/ocr/` by `app/ocr.plugin.ts`),
    read in the background by `ui/fileindex.ts` into the store's `fileText`,
    and searched with `noteText(note, fileText)`.
  - `src/data/graph.ts`: the graph view's notes, links and force layout;
    `ui/graph.tsx` draws it on a canvas, in a pane tab of kind `graph`.
  - `src/data/snapshots.ts`: snapshots of notes and chapters (Scrivener's):
    kept in the store (`takeSnapshot`, `restoreSnapshot`), compared with
    diff-match-patch; the right sidebar's Snapshots tab is `ui/snapshots.tsx`.
  - `src/data/`: Word files (`docx.ts`, `zip.ts`), e-books (`epub.ts`), the
    web clipper (`clip.ts`), writing stats, search, templates, attachments.
  - `src/data/panes.ts`: the writing area's panes, like Obsidian's: a tree of
    rows and columns of tab groups (`Workspace`, saved in
    `settings.layout.panes`), with pure functions to open, split, drop, move
    and close tabs. A tab shows a note, project, chapter, research note or
    character/place card.
  - `src/ui/`: screens. `panes.tsx` draws the panes (tab bars, drop zones
    while dragging, resizable edges) and keeps them in step with the note
    list and outline (`usePanesState`, `usePanes().open/split`); things are
    made draggable into panes with `tabDrag`/`startTabDrag` (`tabdrag.ts`).
    Phones show one thing at a time instead. `finder.tsx`: the quick
    switcher (Ctrl+O) and command palette (Ctrl+P, or > in the switcher),
    matching with `data/fuzzy.ts`; `useOpener` opens things in place, in a
    new tab or beside. `bookmarks.tsx` (+ `data/bookmarks.ts`): sidebar
    shortcuts to notes, chapters, projects and headings. `fold.tsx`: the « buttons that
    fold the sidebar and list away, and the peek.
    `speech.tsx`: read aloud (speechSynthesis, each word lit with the CSS
    highlight `crumpet-speak`) and dictation (SpeechRecognition), with the
    floating `SpeechBar`.
    `thesaurus.tsx` (+ `data/thesaurus.ts`): the right sidebar's Thesaurus
    tab (Datamuse and the Free Dictionary API; Shift+F7). `painter.ts`:
    Word's format painter.
    `comparedocs.tsx` (+ `data/compare.ts`): comparing two notes or chapters
    (word by word), or a copy with the differences as tracked changes.
    `EditorHost.tsx` wraps the editor for notes;
    `Project.tsx` holds the outline, chapter, manuscript and side panes;
    `pages.tsx` is page view, headers and footers, and printing.
    The formatting bar is one row (`toolbar.tsx`, extras under More) built
    in `editing.tsx` from `fonttools.tsx` (Font group), `paratools.tsx`
    (Paragraph group and window), `listtools.tsx` (bullet and numbering
    libraries, borders, shading), `inserttools.tsx` (symbols, date,
    contents) and `layouttools.tsx` (Breaks, Columns, Orientation, and
    `pagesetup.tsx`'s Page Setup window, for the caret's section, the whole
    document or from the caret on; the first section's settings sit on the
    first paragraph). `rightside.tsx` is the right sidebar: tabs for the
    headings outline, Word's Styles pane (`stylespane.tsx`), comments and
    links, working on the editor last clicked in (`helpers.ts`: editors offer
    themselves with `useOfferHelped`). `booktoc.ts`: in a project, a table of contents
    lists the whole book (chapters with their start pages, and their
    headings), given to each chapter's editor (`setTocEntries`,
    `setPageOffset`). Page view has `ruler.tsx` and `statusbar.tsx` (page,
    words, headings, zoom).
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
- Word features not built: styles of tables beyond the Table menu, paper
  size per section; shapes hold one paragraph of text and can't be rotated
  or placed freely on the page. Printing turns landscape pages only
  in browsers that support named pages (Chrome, Edge, Firefox). A book's table of contents
  guesses the pages of headings in chapters not laid out yet (from their
  words) until they have been.
- Not built yet: native Mac/iPhone/iPad apps, other storage (local folder,
  Dropbox, OneDrive, iCloud), version history, reminders, sharing.
