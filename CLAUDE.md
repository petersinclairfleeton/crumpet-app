# Crumpet: notes for Claude

Read this first in every session. `PLAN.md` has the product plan and visual
design; this file is how we work and where things are.

**Current work: Word features.** `docs/word-features.md` compares Crumpet
with Microsoft Word, feature by feature, with Peter's choices of what to
build. Its last section, "Wanted: the build list", is the to-do list:
groups in order, each item a checkbox with where in the code to start.
"Continue the plan" means take the first group with unticked items, build
it (one PR per group, or per few items when it's big), tick the items, mark
them ✅ in that file's tables, and carry on. Items marked "ask Peter first"
need a service or key from him.

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
2. **Keep the welcome guide up to date, in the same PR.** When a change
   alters something the guide describes (`app/src/ui/guide.tsx`: its
   chapters, points, captions and workflows), or adds a feature people
   would want to hear about, update the guide's text as part of the change,
   and retake its pictures if what they show has changed
   (`CHROMIUM_PATH=… npx playwright test -c playwright.shots.config.ts`,
   adding to `tests/shots/guide.shots.ts` for a new picture). Check every
   sentence in it is still true. Say in the PR what changed in the guide (or
   that nothing needed to).
3. Run every check (below), and look at new screens with a screenshot.
4. Commit, push, open the PR (what's new in plain words, how it was tested),
   then merge it with a merge commit.
5. Merging to `main` publishes the web app to GitHub Pages
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
    `tip`, `warning` or `important` are callouts. Fields (`fields.ts`): dates, document fields (`page`,
    `words`, `title`…; title and author from the app through
    `editor.setFieldValues`), and `seq:Figure` (captions' numbers),
    `bm:Name` (bookmarks), `ref:Name[:text|page|dir]` (cross-references),
    `xe:Term` (index entries), `cite:key`; the view works them out over the
    whole document (`fillFields`). A `toc` block's `tocl` makes it a table
    of figures, an index or a bibliography (`lists.ts`); `para.outline` is
    Word's Add Text; `app/src/ui/references.tsx` is the References button
    and its windows. A footnote run with `endnote` is an endnote (`^^[…]`,
    numbered i, ii, iii, listed at the end by `EndnoteList`). Citations:
    `app/src/data/citations.ts` (sources in `settings.sources`, shared like
    the note styles via `SHARED_SETTINGS`; APA, MLA, Chicago), given to each
    editor by `useCitations`. `ui/snippets.tsx`: snippets (F3) and Text from
    file; `ui/websearch.tsx`: the right sidebar's Search tab (Wikipedia). A
    `code` block is maths (LaTeX)
    or a diagram (Mermaid): its source in a text area, drawn by the app's
    renderer (`setCodeRenderer`, `app/src/ui/coderender.ts`, KaTeX and
    Mermaid loaded when first needed); saved as ```` ```math ```` /
    ```` ```mermaid ```` fences.
    An equation within a line is a field `math:LaTeX` (`$`…`$` in
    Markdown), drawn by the view as a picture from the app (`setMathImage`:
    KaTeX's MathML in an SVG, `coderender.ts`); clicking it (or Alt+=,
    `editor.insertMath`) opens `ui/mathtools.tsx`'s `MathCard`, and
    `MathBlockBar` floats over a maths block's source: structures, symbols and
    UnicodeMath (`data/unicodemath.ts`). Word gets Office Math, made from
    KaTeX's MathML, and Word's comes back as LaTeX (`data/omml.ts`).
    A ```` ```chart ```` block is a chart (`editor/src/chart.ts`: its text is
    `type:`/`title:`/`stacked:` lines then rows of numbers; `chartSvg` draws it,
    a table's menu → Make a chart, `insertAfterBlock`); Word gets a chart part
    with literal numbers (`data/chartxml.ts`). Online video: a `file` block
    whose `src` is a YouTube/Vimeo link (`editor/src/video.ts`, `{.video}` in
    Markdown) plays in an iframe; attached video and sound play too.
    `ui/mediatools.tsx`: Chart, Online video, Screenshot (getDisplayMedia),
    Object and 3D model. A `file` block styled `embed` (`{.embed}`) shows a
    PDF or web page inside the page (`embeddable` in `video.ts`); .glb/.gltf
    files show in Google's `<model-viewer>`, loaded by the app on first use
    (`setModelLoader`, `coderender.ts`; `@google/model-viewer` + `three`).
    Form controls are fields too (`chk:0|1`, `drop:N:A|B`, `pick:YYYY-MM-DD`,
    `fill:Prompt|value`; `readForm`/`formName`/`formShown` in `fields.ts`):
    a tick box ticks on click, the others open `ui/formtools.tsx`'s `FormCard`
    (`editor.onFormClick`, `setForm`); `restrict=forms` (Filling in forms)
    leaves only them usable (`editor.formsOnly`). Word gets content controls
    (`w:sdt`, `w14:checkbox`). A table's look `sheet` shows it as a spreadsheet
    (column letters and row numbers from `data-col`/`data-row` on its cells;
    Table → Spreadsheet, `editor.insertSpreadsheet`).
    A ```` ```ink ```` block is a drawing (`editor/src/ink.ts`: strokes as JSON,
    `inkSvg`, `recognizeShape` for Ink to Shape, `strokeNear`/`insideLasso`);
    clicking it (`editor.onInkEdit`) or Draw (`insertDrawing`) opens
    `ui/inktools.tsx`'s drawing window (pointer events, pressure, undo,
    replay); Word gets a PNG of it (`inkPng` in `docx.ts`, browser only).
    Macros: the editor records steps (`startMacro`/`stopMacro`/`playMacro`,
    `MacroStep`: typing, Enter, Backspace, caret moves, and calls to
    `MACRO_COMMANDS`, wrapped while recording); `ui/macros.tsx` (Macros ▾,
    the recording strip, Alt+Shift+number) keeps them in `settings.macros`.
    `ui/customise.tsx`: Customise the bar (`settings.toolbarCustom` hide/pin;
    pinned items get priority 9). `ui/help.tsx`: the top bar's Help menu (guide,
    What's new from `data/whatsnew.ts` with `settings.whatsNewSeen`, feedback and
    support only when `VITE_FEEDBACK_EMAIL` / `VITE_SUPPORT_URL` are set).
  - `table.ts`: table formatting (merged cells, shading, column alignment
    and widths, heading row, banding, lines, and the gallery's styles,
    `TABLE_STYLES`, which go to Word as table styles "Crumpet Blue" and so on) and keeping it in step as rows and
    columns change. `cells.ts`: a cell's text is inline
    Markdown (bold, fonts, colours; lines within it as `&#10;`, Shift+Enter),
    drawn into and read from its box, and formatting applied there (the
    toolbar goes to the cell being typed in). A table's look also holds each
    cell's own settings (`cells`: alignment, text direction, lines), row
    heights, cell margins and style options; `formula.ts` works out cells
    starting with = (=SUM(ABOVE)). In page view a table splits between rows
    (`paginate.ts`: `splitTable`, the heading row repeated), so the editor
    finds cells through `view.pieces(id)`. `app/src/ui/tabletools.tsx` is
    the Table button (size grid, Draw table, Convert text to table, Quick
    tables).
  - `shape.ts`: text boxes and shapes (`shape` blocks: 35 kinds in
    `SHAPE_GROUPS`, outlines from `shapePath`, Word names in `WORD_SHAPES`,
    styles in `SHAPE_STYLES`; fill `grad`/`img`, line `lw`/`dash`/`head`/`tail`,
    effect `fx`, text colour `tc`, text `ta`/`tv`/`dir` (lines kept as `&#10;`),
    linked boxes `chain` (laid out by `Editor.flowChains`), `freeform` corners
    `pts` (Edit points), `path` drawings `d` in `vb` (icons in `icons.ts`; an
    SVG picture's Convert to shape, read by `app/src/data/svgpath.ts`, which
    also writes them for Word); size in inches, fill, line, wrapping left/right or
    in front of the text at `x`,`y` inches from its paragraph (`wrap=free`,
    dragged by its ✥ handle), turned by `rot` degrees, and one line of
    inline Markdown text). Also `wrap=behind` (under the text, brought up by
    the Selection pane's Go to it), `wrap=topbottom` (moved across by `x`),
    `tight=1`, `rel=page|margin` (placed by `Editor.placeShapes` after each
    layout), `z` (its place in the stack) and `grp` (moved together; Shift+click
    picks shapes for Group and Align); `settings.gridlines` shows a grid and
    snaps to quarter inches. Saved as
    `{shape ellipse w=2 h=1 fill=#cfe2f3 line=none wrap=left rot=15} Text`.
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
    Before a redraw the pages are taken apart (`clear()`), so the view
    always draws one flat flow; but typing inside a paragraph that stays
    the same height redraws it where it stands (`Editor.drawInPlace`), and
    a full layout holds the text's height so the scroll box can't jump.
    After typing, `revealCaret` scrolls the caret into sight. Handles footnote room, page breaks, keeps,
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
  - `src/sync/`: syncing with a folder the person owns: Google Drive
    (`drive.ts`) or a folder on the computer (`folder.ts`, the File System
    Access API in Chrome and Edge; its handle is kept in IndexedDB, and the
    browser may ask again after a restart: "Allow access to the folder"). Notes
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
  - `src/data/reminders.ts` (+ `ui/reminders.tsx`): reminders on notes
    (`note.reminder`, the bell beside the star, the sidebar's Reminders view,
    `ReminderAlerts` while the app is open; in the file as `reminder:` and
    `reminder-done:`, and as one string while syncing).
  - `src/data/graph.ts`: the graph view's notes, links and force layout;
    `ui/graph.tsx` draws it on a canvas, in a pane tab of kind `graph`.
  - `src/data/board.ts`: boards (like Obsidian's Canvas): a note whose only
    block is a ```` ```canvas ```` code block holding JSON Canvas (text,
    note and group cards, arrows). `NotePane` shows `ui/board.tsx`
    (`BoardView`) for such notes instead of the editor; made from the
    sidebar's template menu ("New board").
  - `src/data/snapshots.ts`: snapshots of notes and chapters (Scrivener's):
    kept in the store (`takeSnapshot`, `restoreSnapshot`), compared with
    diff-match-patch; the right sidebar's Snapshots tab is `ui/snapshots.tsx`.
    Version history: `setDoc`/`setChapterDoc` keep the text as it was as an
    automatic snapshot (`auto`), at most every ten minutes (`keepVersion`),
    thinned by `pruneVersions`; off with `settings.autoVersions = false`.
  - `src/data/`: Word files (`docx.ts`, `zip.ts`), e-books (`epub.ts`), other
    download types (`exports.ts`: .odt, .rtf, .html, .txt; `ui/exportmenu.tsx`), the
    web clipper (`clip.ts`: the bookmark tidies the page and sends it in the
    address, `#clip=…`; the Mac app's opens `crumpet://clip#clip=…`), writing stats, search, templates, attachments.
  - `src/data/panes.ts`: the writing area's panes, like Obsidian's: a tree of
    rows and columns of tab groups (`Workspace`, saved in
    `settings.layout.panes`), with pure functions to open, split, drop, move
    and close tabs. A tab shows a note, project, chapter, research note or
    character/place card.
  - `src/ui/`: screens. `panes.tsx` draws the panes (tab bars, drop zones
    while dragging, resizable edges) and keeps them in step with the note
    list and outline (`usePanesState`, `usePanes().open/split`); things are
    made draggable into panes with `tabDrag`/`startTabDrag` (`tabdrag.ts`);
    notes dropped on the sidebar (Trash, a notebook, Favorites, a tag) are
    taken by `useNoteDrop`. `notemenu.tsx`: the right-click menu on notes.
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
    Word's format painter. Styles of one's own are `StyleSheet.custom`
    (`data/styles.ts`: `sheetStyles`, `blockStyleKey`; a paragraph's style
    `c-name`, `{.c-name}` in the file), with `hidden` and `order` for the
    menu; `reveal.tsx` is Reveal formatting (in the Styles pane);
    `similar.tsx` selects text with similar formatting (`editor.applyToAll`
    formats every place as one undo step); `selectionpane.tsx` is the right
    sidebar's Selection tab (pictures and shapes hidden with `hide`). Find's
    wildcards, formatting and special characters are in `editor/src/find.ts`.
    `comparedocs.tsx` (+ `data/compare.ts`): comparing two notes or chapters
    (word by word), or a copy with the differences as tracked changes.
    `EditorHost.tsx` wraps the editor for notes;
    `Project.tsx` holds the outline, chapter, manuscript and side panes;
    `pages.tsx` is page view, headers and footers, and printing (`print.tsx`:
    the pages laid out off screen, then Crumpet's print window with a preview,
    page ranges and copies, then the browser's).
    `guide.tsx`: the welcome guide (chapters with pictures of the app,
    workflows, a start page): opens by itself on a device's first visit
    (`shouldOpenGuide`; not under automation, `navigator.webdriver`), then
    `settings.guideSeen`; again from the top bar's ? button, the command
    palette or the welcome page (`openGuide()`). Its pictures are
    `public/guide/*.jpg`, taken from the real app by
    `tests/shots/guide.shots.ts`: retake them after the look changes with
    `CHROMIUM_PATH=… npx playwright test -c playwright.shots.config.ts`.
    The formatting bar is one row (`toolbar.tsx`, extras under More) built
    in `editing.tsx` from `fonttools.tsx` (Font group), `paratools.tsx`
    (Paragraph group and window), `listtools.tsx` (bullet and numbering
    libraries, borders, shading), `inserttools.tsx` (symbols, date,
    contents) and `layouttools.tsx` (Breaks (page, column, odd/even page,
    text wrapping), Columns, Orientation, Line numbers, Hyphenation, and
    `pagesetup.tsx`'s Page Setup window, for the caret's section, the whole
    document or from the caret on; the first section's settings sit on the
    first paragraph; a section of its own paper size has `pw`/`ph` inches, and
    document-wide `hyph`, `lnum`/`lnr` sit on the first paragraph too, as do
    the watermark `wm`/`wmimg`, page colour `pgc` and page border `pgb`, set by
    `designtools.tsx` (Watermark, Page borders, Cover page; the document's
    page colour is in Layout's Page colour). A section's own header and
    footer are `hdr`/`ftr` on its first paragraph, written short by
    `data/sectionhf.ts` ("left|centre|right", fields as %page%), with
    `hfirst` (blank first page) and `pstart`/`pfmt` (numbers started again);
    `pageHF` works out each page's from `editor.pageBoxes` (`sectionBlock`).
    A cover page (`editor/src/cover.ts`) is paragraphs marked `cover` at the
    start, a section of its own). Document themes (`data/doctheme.ts`): the
    theme's colour set, font pair, effects and paragraph spacing by name on
    the first paragraph (`thc`, `thf`, `thx`, `psp`); the view marks the
    editor with `data-thc` and so on, and `themeCss()` (injected by
    `applyThemeLook`) draws them; Word gets them as its styles' fonts and
    colours plus a `CrumpetDesign` docVar to come back. `rightside.tsx` is the right sidebar: tabs for the
    headings outline, Word's Styles pane (`stylespane.tsx`), comments and
    links, working on the editor last clicked in (`helpers.ts`: editors offer
    themselves with `useOfferHelped`). `booktoc.ts`: in a project, a table of contents
    lists the whole book (chapters with their start pages, and their
    headings), given to each chapter's editor (`setTocEntries`,
    `setPageOffset`), and footnote numbers run on from the chapters before
    (`footnotesBefore`, `editor.setFootnoteStart`; also in printing and e-books).
    Page view has `ruler.tsx` and `statusbar.tsx` (page,
    words, headings, zoom); `viewtools.tsx` is Outline view (the editor's
    `setOutlineView`: `data-ol` levels, markers dragged by `dragOutline`, moves by
    `moveBlocks`/`sectionOf`, `shiftLevel`) and Pages on screen
    (`settings.pageLayout` one/multi/book, `pagesPerRow`: the paginator's
    `perRow`/`book` place pages in rows); `thumbs.tsx` is the right sidebar's
    Pages tab (page thumbnails); `reader.tsx` is the Immersive reader
    (`openReader`, prefs in `settings.reader`; syllables, parts of speech and
    the picture dictionary in `data/reading.ts`); New window splits the active
    tab beside itself (`usePanes().newWindow`), and `SyncScroll` scrolls panes
    together (`settings.syncScroll`). `checks.tsx` is the right sidebar's Check tab
    (`data/checks.ts`: accessibility, compatibility, inspect, clarity,
    inclusive; `data/spell.ts`: the spelling pass with nspell and the
    dictionary-en / dictionary-en-gb word lists, loaded only when it runs).
    Protection: a note with a password (`data/lock.ts`, PBKDF2 + AES-GCM; the
    note's text becomes one ```` ```locked ```` block; `ui/locked.tsx` keeps
    opened notes in memory for the session and re-locks as they change);
    `ui/protecttools.tsx` is Protect document (first paragraph's `final`,
    `restrict` read/comments/forms, its password's lock `plock`; EditorHost makes
    the editor read only and shows `ProtectBanner`; Word's
    documentProtection and `_MarkAsFinal`) and Signature line (a paragraph
    with `sig`, the document's fingerprint `docPrint`; `data-sig-ok` says
    if it's changed since).
  - `public/`: icons, logos (`brand/`), the offline service worker (`sw.js`),
    privacy and terms pages.
  - Looks: `ui/theme.ts` sets `data-theme` and `data-look` on the page: Crumpet's
    own themes (`system`, `light`, `dark`) get `data-look='crumpet'` (the frosted
    window over a wash, Onest), `paper` gets `data-look='paper'` (Paper and ink);
    the rest keep the classic frame. The paper colour (`settings.paper`,
    `data/paper.ts`, `ui/paper.tsx`) sets `--paper`/`--paper-ink` and
    `data-paper` on the page. Tokens and look rules are in `app.css`;
    the theme list (names, previews) in `ui/themes.ts`.
- iPhone and iPad: the app added to the Home Screen from Safari (no App Store
  app). `index.html` has the launch screens (`public/splash/`, made per iPhone
  size, light and dark) and a status bar in the app's own colour
  (`theme-color`); `ui/iphone.tsx` stops iOS zooming into boxes
  (`maximum-scale=1`, iOS only), swipes in from the left edge go back to the
  list (`useSwipeBack`), and Safari shows a guide to adding it
  (`HomeScreenGuide`); touch details are in `app.css` ("iPhone and iPad").
  Note: the Home Screen app keeps its own notes, apart from Safari's.
- `desktop/`: Crumpet for Mac (Electron). `main.cjs` serves the built web app
  (`app/dist`, packed inside as `resources/web`) from `app://crumpet/`, with a
  Mac window (hidden title bar, the window buttons over the sidebar, the
  sidebar's `vibrancy`); links to other sites open in the browser. It makes its own right-click
  menu (spelling suggestions, cut/copy/paste) and takes `crumpet://clip`
  links from the web clipper (passed to the page by `preload.cjs`'s `onClip`).
  `preload.cjs` tells the page (`window.crumpetDesktop`, read by
  `app/src/data/desktop.ts`), which sets `data-shell='mac'` on the page for the
  window's styles (`app.css`, "The Mac app") and leaves out Google's folder
  picker. Google Drive sign-in in the Mac app (`desktop/google.cjs`): Google's
  page opens in the browser (PKCE, an iOS-type client, no secret) and comes
  back to `com.googleusercontent.apps.<id>:/oauth2redirect`; the refresh token
  is kept with `safeStorage`; the page gets access tokens through
  `crumpetDesktop.google` (`app/src/sync/desktop-auth.ts`). Its client id is
  `VITE_GOOGLE_MAC_CLIENT_ID` in `app/.env` (same Google project as the
  website, so drive.file covers both); `electron-builder.config.cjs` declares
  the address to macOS. Without the id the Mac app offers only a folder.
  Google only lets Crumpet see files a Crumpet sign-in made: files that reach
  its Drive folder another way (Google Drive for desktop, uploads) are hidden
  from it.
  `.github/workflows/mac.yml` builds it on GitHub's Macs on every change
  (one app for Apple silicon and Intel, signed ad hoc, no Apple Developer ID
  yet) and publishes it as the latest release; Settings → Clipper & app
  links to `releases/latest/download/Crumpet-Mac.dmg`. Try it here with
  `cd app && npx vite build`, then `cd desktop && npx electron-builder --linux dir`
  and run the result under `xvfb-run` (Playwright's `_electron` can drive it).
- Accounts (optional): `app/src/data/account.ts` talks to Firebase
  Authentication's REST API directly (no Firebase library): email and
  password, password reset, confirming the email, Google (an access token
  for `openid email profile` from Google's sign-in window, `googleIdentity`
  in `sync/google-auth.ts`, swapped with `signInWithIdp`), and deleting the
  account. The account is kept in `localStorage` (`crumpet.account`) and
  only says who you are: notes never go to it. `ui/account.tsx` is the
  sign-in screen (on a device's first visit, before the guide, unless
  skipped or under automation) and Settings → Account. Off unless
  `VITE_FIREBASE_API_KEY` is set (`docs/accounts-setup.md`); browser tests
  fake the service (`tests/e2e/account.spec.ts`).
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
- The web clipper may still be blocked by a few sites' security settings
  (pasting keeps formatting instead), and doesn't work in the single-file
  build. Bookmarks dragged to the bar before the clipper changed need dragging
  again.
- Word features not built: Word's own built-in table styles (ours go to Word as
  styles of their own), shapes hold one paragraph of text; groups go to Word as separate
  shapes; pictures can't go behind the text or wrap tight. Page borders are plain lines (no art) and the
  same on every page; the document's page colour shows only in page view;
  watermarks and section headers go to Word as VML and header parts (checked by
  tests, not yet in real Word). Printing turns landscape pages only
  in browsers that support named pages (Chrome, Edge, Firefox). A book's table of contents
  guesses the pages of headings in chapters not laid out yet (from their
  words) until they have been.
- The Mac app isn't signed with an Apple Developer ID (macOS asks to confirm it
  once); its Google sign-in needs `VITE_GOOGLE_MAC_CLIENT_ID` (docs step 4b),
  and was tested on Linux with a stand-in for Google, not on a real Mac; its
  fonts come from the internet (the Mac's own font is used offline).
- Accounts are on (Firebase key in `app/.env`, `docs/accounts-setup.md`); the Mac app
  offers email sign-in only (no Google there yet).
- Not built yet: native iPhone/iPad apps, Dropbox/OneDrive/iCloud as
  services of their own (they need app keys from their makers; on a computer,
  a folder they keep in step works instead), sharing. Reminders only nudge
  while Crumpet is open (no push from a server). A folder on
  the computer needs Chrome or Edge on a computer.
