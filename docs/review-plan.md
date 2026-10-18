# Crumpet review, October 2026, and the plan that follows

A full look at the app as it stands after PR #176: how it works and feels for
the person it's for, what's broken, what's at risk, and what to do next. The
second half is a build list in the same shape as `docs/word-features.md`:
groups in order, each item a checkbox with where in the code to start, with
Peter's decisions at its top.

## Who it's for, and what they do with it

`PLAN.md`: a calm, organised notes app first, documents second; personal first,
built so it could be released. In practice the person is a writer who:

1. jots things down all day, often on a phone (ideas, journal, reading, lists);
2. files and finds them later (notebooks, tags, links, search);
3. writes long pieces, mostly fiction: chapters, an outline, characters,
   research beside the writing;
4. hands work over as a Word manuscript, a PDF or an e-book;
5. moves between Mac, iPad and iPhone, and expects the words to be safe.

## How it was checked

- Ran every check: app types and 284 unit tests, the editor's types and tests,
  and the 160 browser tests. All pass (the browser tests take 7.8 minutes).
- Used the app in Chromium as a first-time visitor and with a sample library
  (30 notes, five notebooks, a four-chapter book): computer, iPad landscape and
  portrait, iPhone, light and dark.
- Measured: load time of the published build (normal and a phone with a 4×
  slower processor on 4G), typing speed in 5,000- and 30,000-word documents
  (with a CPU profile and a style/layout trace), saving when a tab is closed
  straight after typing, and an accessibility scan (axe, WCAG 2.1 AA).
- Not possible here: a real iPhone, iPad or Mac, real Microsoft Word, a real
  Google Drive.

## What's good

- **It looks and feels calm.** Quiet Paper is consistent, warm and readable;
  dark mode is as good as light. The accessibility scan found nothing, and
  everything can be reached with the keyboard.
- **The book side is strong.** The outline as the sidebar, status and words per
  chapter, Cards, Read, characters underlined where they appear, and an export
  window with a preview of page 1 and a proper manuscript format. This is the
  heart of Scrivener, done more simply.
- **Finding things is quick.** Ctrl/⌘ K finds notes and chapters by their words,
  with the matching line shown.
- **Words are safe while writing.** Typing and closing the tab at once (0, 100,
  300 ms) kept every word, after a reload and after closing the tab.
- **It starts quickly.** The published app is on screen in 0.6 s on a computer
  and 1.7 s on a slow phone the first time; 0.3 s / 0.6 s after that.
- **The work is careful.** Types are clean, tests pass, and `CLAUDE.md` maps
  the code well.

## What isn't

In order of how much it gets in the way of the five things above.

1. **Two everyday bugs.**
   - After reopening the app, the list lights up one note while the page shows
     another (reproduced: open the fifth note, reload; the list lights "Story
     ideas", the page shows "Short story: The Ferry"). `store.load()` picks the
     list's first note; the panes bring back the last open tab.
   - On a phone the app opens on the library, which has no New note button:
     writing a quick thought takes three taps (a list, then +, then type).
2. **Typing slows down in long writing.** Time from a key to the screen:
   about 26 ms in a 5,000-word chapter, about 111 ms in a 30,000-word one (and
   the same in a long note, such as an imported Word file). Over 100 ms feels
   like lag, and phones are slower. The causes, from the profile:
   - Writing stats live in `settings`, so most keys make a new settings object;
     `App.tsx` re-applies the whole theme on any settings change, and the
     whole page (6,000 elements) is restyled: about 40 ms a key.
   - The note list rebuilds the moving note's preview from its entire text to
     show 160 characters (`preview()` in `selectors.ts`): about 60 ms a key.
   - In a book, the words of every chapter, the book's contents and the cast's
     appearances are counted again on every key: about 40 ms.
3. **Notes can be lost when nothing is connected.** Until Google Drive or a
   folder is connected, notes live only in the browser's storage. Crumpet
   doesn't ask the browser to keep that storage (`navigator.storage.persist()`),
   and Safari clears a website's storage after seven days without a visit. There
   is no "download everything" either. The welcome page says "Your notes stay on
   this device as plain files you own", which isn't true until a folder is
   connected.
4. **The first visit is a wall.** A sign-in screen comes first, then a nine-step
   guide, before a word can be typed. The account only carries your name to
   other devices; notes never go to it. There are two different "Continue with
   Google" buttons (the account, and Drive) that mean different things.
5. **Two apps in one.** The calm look (what everyone gets) and "Show every
   formatting tool" are different windows: different sidebars, a top bar, tabs,
   an account block, backlinks. Add the phone, iPad and compact-book layouts and
   there are about 200 `calm` branches in 20 screens and 381 calm rules in a
   300 KB stylesheet. The browser tests switch to "every tool" first
   (`open()` in `tests/e2e/app.spec.ts`), so the look people actually use is the
   least tested.
6. **Links between notes are hidden.** The calm note has no "Linked from" under
   it (`NotePane.tsx` drops the footer when calm); it's only in the right
   sidebar, which stays closed until asked. The guide teaches [[links]], but you
   can't see what links to a note.
7. **No checks before merging.** The Pages workflow runs the app's unit tests
   and a type check after a merge to `main`. Nothing runs on a pull request, and
   the editor's tests and the 160 browser tests never run on GitHub. With dozens
   of merges a day, a break can reach the live app.
8. **Scope.** The last ~100 pull requests built Microsoft Word: macros, 3D
   models, form controls, ink gestures, spreadsheets, equations, signature
   lines, watermarks. Hidden well by the calm look, but each
   is code, tests and guide text to keep working in every layout, while the
   notes-on-a-phone basics (above) slipped. `PLAN.md`'s own top risk (the editor
   on real iPhones: autocorrect, predictive text, dictation, other languages'
   keyboards) has never been checked on a device.
9. **Smaller things.**
   - Read view: the chapter's opening ("Chapter One", the title) sits on the
     grey desk above the page instead of on it, and Read shows Ruler, an editing
     tool.
   - Three names for the same thing: "Writing" (sidebar), "book" (welcome,
     phone), "project" (command palette's New project, the export window, the
     full sidebar's Projects).
   - Phone list: four and a half notes fit on screen (Apple Notes fits about
     nine).
   - The note list is one Tab stop per note (30 notes, 30 presses to get past).
   - Every Word tool is in the first download (1.5 MB of script, 470 KB
     compressed; nothing in the interface is loaded only when needed). Fine
     today, heavier on older phones.
   - Spelling, maths and PDF reading only work offline once they've been used
     online (`sw.js` keeps them when first fetched).
   - Two React warnings while the browser tests run: a list without keys in
     `PagesTool`, and a `<div>` inside a `<p>`.

---

## The build list

Continued by `docs/launch-plan.md` (18 October 2026): its stage 1 does groups
6, 3, 2 and 4, and stage 5 groups 9, 8 and 5; tick items here as they land.

Work through the groups in order, one pull request per group (or per few
items when it's big), as `CLAUDE.md` describes, ticking items here as they
land and updating the guide in the same pull request.

**Peter's decisions** (17 October 2026):
- First visit: straight to the page. No sign-in screen and no guide opening by
  itself; connecting Google Drive also signs in (group 4, recommended option).
- Word: done. Keep everything built; no new Word features unless Peter asks
  (group 10, recommended option).
- The classic window retires: "Show every formatting tool" becomes a fuller
  bar inside the calm window (group 5).
- One name for long writing: "book" (group 9; decided as recommended).

**1. Everyday bugs** (small; one PR)
Where: `app/src/data/store.ts` (`load()`, ~line 167), `ui/panes.tsx`
(`usePanesState`), `ui/App.tsx` (the `.fab`, ~line 482), `ui/phone.tsx`
(`PhoneLibrary`), `ui/NotePane.tsx` (`footer`, ~line 503; welcome text ~639).
- [x] The list and the page agree after reopening: on load, choose the note in
      the saved workspace's active tab when it's visible, else the first.
      Browser test: open the fifth note, reload, the same note is lit and shown.
- [x] New note from the phone's library: the round + on `PhoneLibrary` too
      (the note goes to Inbox and opens). Test on a phone-sized page.
- [x] "Linked from" under a note in the calm look: one quiet line of note names,
      only when there are links.
- [x] The welcome text says what's true: "on this device" until a folder or
      Drive is connected, "as plain files you own" after.

**2. Quick typing in long writing**
Where: `ui/App.tsx:75` (`applyTheme`), `ui/theme.ts`, `data/store.ts`
(`countWords`, `flushStats`), `data/selectors.ts` (`preview`, `docWords`,
`chapterWords`, `projectWords`), `ui/booktoc.ts` (`bookEntries`), `ui/cast.tsx`
(`scan`), `ui/Project.tsx` (`ChapterPane`, `ProjectOutline`).
- [ ] Writing stats out of `settings` (a slice of state of their own, still
      saved and synced as now), and `applyTheme` run only when the look's own
      settings change.
- [ ] `preview()` stops once it has enough text, and is remembered per document.
- [ ] Word counts remembered per block (blocks that didn't change keep their
      identity through `ops.ts`, so a `WeakMap` works), used by the chapter,
      outline, book total and stats; the book's contents and the cast's scan
      wait until typing pauses.
- [ ] The title box sizes itself only when the title changes.
- [ ] A speed test kept in the repo: a 30,000-word note, key-to-screen measured
      the way this review did. Aim: under 35 ms (from 111).

**3. Safe without Drive**
Where: `app/src/main.tsx`, `ui/SyncSettings.tsx`, `sync/layout.ts`,
`data/zip.ts`, `ui/Sidebar.tsx` (the "Saved on this device" line).
- [ ] Ask the browser to keep Crumpet's storage (`navigator.storage.persist()`)
      when the first note is made.
- [ ] Settings → Sync and storage → Download everything: a .zip of the same
      Markdown folder the sync writes (notebooks, books, pictures). Upload files
      takes it back in.
- [ ] When notes are only in this browser, the sidebar's line says so once there
      are a few: "Only on this device · Keep a copy", leading to Sync. No pop-ups.

**4. A gentler first visit** (decided: the recommended option)
Where: `ui/account.tsx` (`shouldOpenSignIn`), `ui/App.tsx` (~line 283),
`ui/guide.tsx` (`shouldOpenGuide`), `sync/google-auth.ts`, `ui/SyncSettings.tsx`.
- [ ] The first visit opens on "A clean page." with the cursor ready; no
      sign-in screen and no guide opening by itself (the page already offers
      "Take the two-minute tour").
- [ ] One Google step: connecting Google Drive also signs in the account (same
      Google identity), so there's one "Continue with Google", in Sync.
- [ ] Account stays in Settings for those who want their name on every device.

**5. One window, tested as people use it** (several PRs)
Where: `app/tests/e2e/app.spec.ts` (`open()`), every file with `calm` checks
(`Sidebar.tsx`, `NotePane.tsx`, `Project.tsx`, `App.tsx`, `EditorHost.tsx`,
`Settings.tsx` and the rest), `ui/app.css`.
- [ ] Browser tests in the calm look: `open()` stays calm and reaches tools
      through More, All writing tools and the command palette; a short separate
      set covers "Show every formatting tool".
- [ ] "Show every formatting tool" changes the formatting bar only; the classic
      window (top bar, account block, old sidebar) retires, keeping anything the
      calm one lacks (decided).
- [ ] `app.css` split by area (sidebar, list, note, editor, book, phone, print,
      Word tools) so a change to one can't quietly break another.

**6. Checks before merging**
Where: `.github/workflows/`.
- [ ] A pull-request workflow: app and editor types and unit tests, a build, and
      the browser tests (split across four runners); merging waits for it.
- [ ] The Pages workflow runs the editor's tests too.

**7. Real devices** (Peter, with a checklist; Claude can't do these)
Where: a new `docs/device-checklist.md`.
- [ ] iPhone (Home Screen app): typing with autocorrect, predictive text and
      dictation; selecting, cut and paste; undo; Google Drive sign-in; a note
      made on the phone appears on the Mac.
- [ ] iPad with a keyboard, and with Apple Pencil for drawing.
- [ ] The Mac app: install, sign in to Drive, sync with the phone.
- [ ] Real Word: open an exported manuscript; send it to someone who comments
      and tracks changes, and bring it back.

**8. Lighter to start** (later)
Where: `ui/editing.tsx`, `ui/toolbar.tsx`, the Word tools' windows, `public/sw.js`.
- [ ] Rarely used windows (references, maths, ink, macros, forms, 3D, media,
      design, page setup, protect…) loaded when first opened (`React.lazy`).
      Aim: first download under 800 KB of script (from 1.5 MB).
- [ ] The service worker keeps the small lazily loaded parts (spelling, maths)
      for offline after install.

**9. Polish from the review**
Where: `ui/Project.tsx` (`chapter-opening`, Read), `ui/statusbar.tsx`,
`ui/NoteList.tsx`, `ui/finder.tsx`, `ui/exportbook.tsx`.
- [ ] Read view: the chapter's opening on its first page, as printing does; no
      Ruler in Read.
- [ ] One name for long writing everywhere: "book" (what the welcome page and
      phone already say).
- [ ] Phone list: a compact choice (title and one line) in the list's ··· menu.
- [ ] The note list as one Tab stop, with the arrow keys moving inside it.
- [ ] The two React warnings: keys in `PagesTool`'s list, and no `<div>`
      inside a `<p>`.

**10. Scope** (decided)
- [x] Word is done. No new Word features unless Peter asks; the four left in
      `docs/word-features.md` (grammar, online pictures, add-ins, OneDrive)
      stay parked. Everything built stays, out of the way.

## Next, once the list above is done

Choices for what to build after, all aimed at the writer above:

1. **Crumpet on the iPhone as an app** (Capacitor wrapper, `PLAN.md`'s next
   step): Share → Crumpet from any app, storage that's never cleared, the App
   Store. Needs an Apple Developer account.
2. **Submissions tracker**: where a story or manuscript went (agent, magazine,
   competition), when, and what came back, beside the book.
3. **Grammar** through LanguageTool (needs its service; the last Word item).
4. **Writing together**: share a chapter with an editor or reader for comments
   (needs a server; against "no Crumpet server" in `PLAN.md`, so a big choice).
