# Drafts: plan

Peter's idea (October 2026): writers work in drafts. Crumpet should let you
start a second (third…) draft of a single chapter, or of the whole manuscript
at once, and keep improving from there.

## Peter's calls

- **Chapters hold the drafts.** Each chapter has its own list of drafts.
  "New draft of the book" starts a new draft of every chapter at once and
  names it (Draft 2). A chapter can also go on alone (Chapter 7 on Draft 3
  while the rest are on Draft 2).
- **Starting a draft: choose each time.** A copy of the draft before it (to
  revise), or a blank page (to rewrite, with the old one open beside it).
- **Every draft stays editable.** Old drafts aren't locked.
- **The book is each chapter's chosen draft.** One draft per chapter is
  "in use" (normally the newest). Read, printing, Word/e-book export, the
  word count and goals all use it. One click switches a chapter back to an
  older draft.
- **Tabs above the chapter.** `Draft 1 · Draft 2 · +` at the top of the
  chapter; the outline shows a quiet badge (D2) on chapters with more than
  one draft.
- **Separate from snapshots.** Drafts are the deliberate rewrites; snapshots
  and automatic versions stay as the safety net, kept per draft. A snapshot
  can be turned into a draft.
- **While writing:** the old draft beside the new one (scrolling together),
  a note for each draft ("Draft 3: tighten pacing, cut the subplot"), and
  progress between drafts (words, and how much changed).

## How it works for the writer

1. In a chapter, click **+** in the draft tabs → *Copy of Draft 1* or
   *Blank page* → Draft 2 opens and becomes the one in use.
2. In the outline's menu, **New draft of the book…** → name, note, copy or
   blank → every chapter gets the new draft. The outline's top shows the
   book's current draft and its note.
3. Right-click a draft tab: Rename, Edit note, Use this draft for the book,
   Open beside, Compare with the draft before, Delete (asks first; can't
   delete the last one).
4. **Open beside** puts the previous draft in a pane next to this one, the
   two scrolling together.
5. Each tab's tooltip, and a line in the outline, show words and change:
   "Draft 2 · 4,120 words (−380) · 34% rewritten".

## How it's built

- **Model** (`app/src/data/types.ts`): `Chapter.drafts?: ChapterDraft[]`
  (`id`, `name`, `note`, `doc`, `createdAt`, `updatedAt`) for the drafts not
  in use, plus `Chapter.draftName`/`draftNote` for the one in use.
  `Chapter.doc` stays the draft in use, so everything that reads the book
  (manuscript, Read, export, goals, cast, contents, MCP) works unchanged.
  Switching swaps the two. `Project.drafts?: { name, note, at }[]` records
  the book drafts.
- **Store** (`data/store.ts`): `newDraft(chapterId, from, blank)`,
  `newBookDraft(projectId, name, note, blank)`, `useDraft`, `renameDraft`,
  `setDraftDoc`, `deleteDraft`, `snapshotToDraft`. Undo-safe and synced like
  any chapter change.
- **Files** (`sync/layout.ts`, `engine.ts`): the chapter file stays the draft
  in use (front matter gains `draft:` and `draft-note:`); other drafts live in
  the book's folder as `Drafts/<chapter file name>/<draft name>.md`, plain
  Markdown so they're readable outside Crumpet. Three-way merge as for
  chapters.
- **Snapshots**: a snapshot records which draft it was taken from
  (`draft` in its file), and the Snapshots tab lists the open draft's.
- **Screens**: `DraftTabs` in the chapter pane (`Project.tsx`, calm and
  classic looks, phone as a menu in ···), the badge in `ProjectOutline`,
  the book-draft window, side-by-side via `usePanes().split` with
  `SyncScroll`, change measured with diff-match-patch (`data/compare.ts`).
- **Word export** sends only the draft in use; nothing changes in `.docx`.

## In order (one PR each)

1. [x] **Chapter drafts**: the model, files and sync, tabs, new draft (copy or
   blank), switch, rename, note, delete, outline badge; tests; guide.
   Built a little differently from the sketch above: clicking a tab *shows*
   that draft (to read or write in); the dot marks the one the book uses, and
   "Use Draft 1 instead" (or the tab's ⌄ menu) switches. Draft 1's id is the
   chapter's own, so chapters without drafts need nothing new.
2. [x] **Book drafts**: New draft of the book, the outline's draft line and
   note, open beside with scrolling together.
3. [x] **Progress and snapshots**: words and how much changed per draft and for
   the book, snapshots per draft, turn a snapshot into a draft.

## Open questions for later

- Should a book draft's chapters that you *don't* revise stay on the old
  draft (skip a chapter when making the new book draft)? First version: every
  chapter gets one; a chapter can be switched back.
- A "compare drafts" Word export (tracked changes between Draft 1 and 2)
  could come later from `trackedComparison`.
