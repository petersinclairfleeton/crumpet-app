// The welcome guide: an introduction to Crumpet, chapter by chapter, with
// pictures of the real app (public/guide/*.jpg, taken by
// tests/shots/guide.shots.ts) and workflows to follow. It opens by itself the
// first time Crumpet is opened on a device, and again from the ? button in
// the top bar or "Open the guide" in the command palette.

import { accountsReady } from '../data/account';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppState, useAppStore } from './hooks';
import { IconBook, IconChevron, IconClose, IconNote, IconPen, IconSearch, IconSun, Logo } from './icons';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';
/** Where the app's own files are (the website's folder, or the Mac app's). */
const BASE: string = (import.meta.env?.BASE_URL as string | undefined) ?? '/';

interface Picture {
  src: string;
  alt: string;
  caption: string;
}

interface Chapter {
  id: string;
  /** In the list down the side. */
  name: string;
  title: string;
  lede: string;
  points: { title: string; text: string }[];
  pictures: Picture[];
}

const pic = (name: string, alt: string, caption: string): Picture => ({ src: `${BASE}guide/${name}.jpg`, alt, caption });

const CHAPTERS: Chapter[] = [
  {
    id: 'welcome',
    name: 'Welcome',
    title: 'Welcome to Crumpet',
    lede: 'A quiet place for notes and long writing: everyday notes, journals and research, and whole books, from the first idea to the finished manuscript.',
    points: [
      { title: 'Write without fuss', text: 'Open it and type. Everything saves as you go, and you can tidy it into notebooks whenever you like.' },
      { title: 'Books, start to finish', text: 'Chapters and parts, an outline, index cards, characters and places, then a manuscript ready for Word, PDF or e-book.' },
      { title: 'Your words stay yours', text: 'Notes are plain text files (Markdown) in your own Google Drive or a folder you choose, readable by any app, for good.' },
    ],
    pictures: [pic('notes', 'Crumpet with the sidebar on the left, a list of notes, and a note open on the right', 'The sidebar on the left, your notes in the middle, the one you’re writing on the right.')],
  },
  {
    id: 'notes',
    name: 'Notes',
    title: 'Notes, notebooks and tags',
    lede: 'Start writing straight away; organise later, in whichever way suits you.',
    points: [
      { title: 'A new note', text: `Click New note, or press N anywhere. The first line is its title; paste a long piece into a new note and its first line becomes the title by itself (the 📋 beside the pasted text can put it back). Notes not yet in a notebook wait in the Inbox; file one from the notebook’s name above its title.` },
      { title: 'Notebooks and stacks', text: 'Group notes in notebooks, and notebooks in stacks. Open Notebooks in the sidebar to see them all, and drag a note onto one to file it; drag notebooks onto a stack to put them in it, or above one another to change their order.' },
      { title: 'Tags and favourites', text: 'Add tags under a note’s title (tags can nest, like book/characters), and star the notes you keep coming back to.' },
      { title: 'Find anything', text: `${mod}K opens Find anything: any note, chapter or heading by name or by a word in it, grouped into notes, what’s in your books and headings, each with a line of its text, and Search everything at the bottom lists every note, chapter, PDF and picture with the words (the Search box in the sidebar does the same, with filters); ${mod}P lists every command. Inside a note, ${mod}F finds and replaces, with wildcards, formatting and a list of results under More options.` },
      { title: 'Upload anything', text: 'Upload files… in the sidebar’s ⚙ menu (at its foot) uploads files, or drag them from your computer onto a notebook, the list or a pane. Pictures, PDFs, video and sound show as they are (drag a picture’s corner to resize it; its Picture menu wraps the text round it, turns, crops, frames or brightens it; Insert has 35 shapes, from stars to flowchart boxes, and 30 icons; a shape’s menu gives it a style, gradient, picture, line and effect, lines of text turned any way, a link to the next text box, edit points to reshape it, puts it behind the text, in order, lined up or grouped with others you Shift+click); Word documents open to edit and are saved back as Word documents.' },
      { title: 'Right-click for more', text: 'Right-click a note to rename, move, tag, duplicate, open it beside another, or put it in the Trash.' },
    ],
    pictures: [pic('notes', 'The note list and an open note with headings, a list and tags', 'A note with headings and a list, filed in the Ideas notebook and tagged #idea.')],
  },
  {
    id: 'writing',
    name: 'Writing',
    title: 'Writing and formatting',
    lede: 'Everything Word can do, without the clutter: it’s there when you need it.',
    points: [
      { title: 'Type / for anything', text: 'Headings, lists, checklists, tables, pictures, footnotes, maths and diagrams: type / at the start of a line and pick. Alt+= puts an equation in the line (LaTeX or UnicodeMath, with structures and symbols to pick). Chart draws your numbers (or a table’s, from its menu); Online video plays YouTube and Vimeo in the text; Screenshot puts in a picture of a window. Object shows a PDF inside the page; 3D model puts in a model to turn. Form control adds tick boxes, drop-down lists, dates and fill-in boxes; Table → Spreadsheet gives a table with A, B, C and sums. Draw opens a drawing in the text: pen, pencil, highlighter and eraser, with a finger, mouse or Apple Pencil; Edit with ink lets you edit by drawing over the words (strike through or scribble to delete, circle to select, a line down for a new paragraph, ^ to type there). Macros records typing and formatting to play back with a key, and More → Customise the bar chooses its buttons. The Table button draws tables, makes them from text, or starts from a calendar or list; in a cell, =SUM(ABOVE) adds up the numbers above it.' },
      { title: 'Format as you go', text: `Five everyday buttons sit at the top of the page (style, bold, italic, list and link; they fade while you type and come back when you move the mouse), and a note’s ··· menu can float them over selected text instead. Fold the sidebar away (the panel button at its top) for room to write: the sidebar becomes a slim strip, the list steps aside, the top of the page shows where the note is and its word count, and the tools float over the words you select (back arrow for the list, the strip’s foot for the sidebar). The ··· beside them opens a few more (font, colour and highlight, footnotes, tables, track changes), and All writing tools… shows everything else in groups, and in page view the groups are menus like Word’s: Format, Insert, Layout, References and Review. Settings → Formatting bar → Show every formatting tool puts them all on the bar; ${mod}D opens the Font window (small caps, underline styles, spacing, effects), and Multilevel list numbers an outline as Chapter 1, 1.1, 1.1.1 or a pattern of your own. Make styles of your own from the Styles tab in the right sidebar (it shows Outline, Review and Links, or In this chapter, Notes and Comments beside a chapter; More has Styles, Pages, Check, Thesaurus and the rest), or dress the whole document with a theme (Themes, Theme colours, Theme fonts and Paragraph spacing, under More).` },
      { title: 'Put right as you type', text: `AutoCorrect curls quotes, makes dashes, fixes typos like “teh” and starts sentences with a capital (${mod}Z takes one back). Settings → Writing turns each off and keeps your own dictionary; characters’ names are never marked as misspelt.` },
      { title: 'Captions, references and an index', text: 'The References button numbers captions (Figure 1, Table 2), adds cross-references that keep up (“see Figure 3”), bookmarks, a table of figures, an index of words you mark, and fields such as page numbers and word counts; footnotes and endnotes; citations in APA, MLA or Chicago with a bibliography. The Search tab in the right sidebar looks things up on Wikipedia.' },
      { title: 'Snippets', text: 'Keep bits of text you use again (a sign-off, a heading block) with the Snippets button, then drop one in from its menu or type its name and press F3. Text from file pours a whole Word or Markdown document in at the caret.' },
      { title: 'Link your notes', text: 'Type [[ and a note’s name to link to it. The notes that link to the one open are named at its foot (and in the right sidebar’s Links tab), and the Graph shows them all.' },
      { title: 'Pages, like on paper', text: 'Page view (in the ··· menu at the top of a note) shows your writing on real pages, with the whole window to itself and two pages side by side if you like (Back to writing view returns), with headers, footers and page numbers; Pages on screen shows one page, several in a row or facing pages like a book, and the Pages tab in the right sidebar has a small copy of each. Outline view shows your headings and paragraphs as an outline to promote, demote and move. The Layout tools under More set the paper (any size, even one per section), columns, breaks (a chapter can start on an odd page), line numbers in the margin and hyphenation; Watermark, Page borders, Page colour and Cover page dress the pages. Double-click a header to write it, and each section can have its own. Focus mode hides everything else.' },
      { title: 'Comments and changes', text: 'Comment on a passage, and track changes as Word does, to review your own edits or someone else’s. The Review tab in the right sidebar lists them all, with who and when, and shows the text with or without the markup. Track everyone’s changes in a document, and lock that with a password, from the ▾ beside Track changes (Track changes is under More until it’s on).' },
    ],
    pictures: [pic('writing', 'The / menu open in a note, offering text, headings and lists', 'Type / at the start of a line for headings, lists, tables, pictures and more.')],
  },
  {
    id: 'books',
    name: 'Books',
    title: 'Books and long writing',
    lede: 'A project holds a book, a thesis or any long piece, in chapters you can move around.',
    points: [
      { title: 'Chapters and parts', text: 'Start a book with + beside Writing in the sidebar. Each chapter has a status (to do, draft, revised, done; pick it at the top of the chapter, and rest the mouse on its dot in the outline to see it), a synopsis (on its card) and a word goal (in the chapter’s ··· menu).' },
      { title: 'Room to write', text: 'In a book the outline is the sidebar: the book’s chapters, one line each, its progress, and Characters & places and Research at the foot (the back arrow returns to your notes). A chapter opens as plain writing, its tools over the words you select; page view is a click away. The inspector (the panel button at the top, which closes it again) shows the characters and places the chapter names, the book’s notes and comments.' },
      { title: 'Three ways to see it', text: 'Write to work on one chapter at a time, Read to read the whole book, Cards to plan on an index-card board and drag chapters into order, the last card adding a new one (Show, beside the cards, picks whether they show synopses, statuses and keywords). With every formatting tool on, these are Chapter, Manuscript and Cards.' },
      { title: 'Looks like a manuscript', text: 'In page view chapters use manuscript format (or Book, or your own styles), with page numbers that run through the whole book. Paragraphs indent their first line as books do; to start a line at the margin, press Backspace at its start (Tab puts the indent back), and − and + at the foot of page view zoom the pages.' },
      { title: 'Goals and deadlines', text: 'Set a word goal and a deadline for the book; Writing stats (in the sidebar’s ⚙ menu) keeps your daily words and streaks.' },
    ],
    pictures: [
      pic('book', 'A book’s outline as the sidebar, a chapter as plain writing, and the inspector with the characters it names', 'The outline is the book’s sidebar; the chapter in the middle; who it names on the right.'),
      pic('cards', 'Chapters as index cards with synopses and statuses', 'Cards: plan the book on index cards, and drag them to reorder the chapters.'),
    ],
  },
  {
    id: 'research',
    name: 'Characters & research',
    title: 'Characters, places and research',
    lede: 'Everything about your story, next to the writing.',
    points: [
      { title: 'A card for everyone', text: 'Add characters and places to a project. Crumpet spots their names in your chapters; hover over one to see their card.' },
      { title: 'Research beside you', text: 'Keep notes, pictures and PDFs in a project’s Research (drag a note onto the project to add it), and open them next to the chapter you’re writing.' },
      { title: 'Clip the web', text: 'The web clipper (Settings → Clipper and Mac app) saves a web page, or the part you select, as a note in one click.' },
      { title: 'See the connections', text: 'The Graph draws your notes and the links between them, so related ideas find each other: it has the window, beside the slim strip (anything on the strip leaves it). The open note is the honey dot, its links in honey; rest the mouse on a dot to see its links and notebook, and zoom with − Fit + in the corner.' },
    ],
    pictures: [
      pic('cast', 'A character’s card beside the chapter, listing where they appear', 'A character’s card: who they are, and every chapter they appear in.'),
      pic('research', 'A research note open beside a chapter', 'Research notes, pictures and PDFs open beside your chapter.'),
      pic('graph', 'The graph of notes and the links between them', 'The Graph: your notes, and how they link.'),
    ],
  },
  {
    id: 'finishing',
    name: 'Finishing',
    title: 'Sharing and finishing',
    lede: 'When it’s ready to leave the house.',
    points: [
      { title: 'Word, PDF and e-book', text: 'Download a note or a whole book as a Word document (or OpenDocument, Rich Text, a web page or plain text), print it (with a preview, page ranges and copies) or save it as a PDF, or make an e-book (ePub). A book can start with a title page and give each part a page of its own, and leaves out comments and tracked changes unless you tick them. Word files you upload open as Word documents, comments and tracked changes included, and are saved back as .docx.' },
      { title: 'Check before you share', text: 'The Check tab in the right sidebar goes through accessibility, what Word won’t keep, comments and hidden text to remove, a spelling pass with suggestions, wordy phrases and more inclusive words.' },
      { title: 'Protect it', text: 'A note’s ⋯ menu → Protect with a password scrambles its text so only the password opens it (forget it and it’s gone). Protect document on the formatting bar marks it as final or lets others only read or comment, and Signature line signs it, warning if it changes afterwards.' },
      { title: 'Snapshots and versions', text: 'Take a snapshot before a big edit; Crumpet also keeps earlier versions as you write, and can compare any two.' },
      { title: 'Read it aloud', text: 'Hear your writing read back to catch what your eyes skip, or dictate instead of typing. The Immersive reader (under More) shows the text on its own, with spacing, line focus, syllables and parts of speech to help reading.' },
    ],
    pictures: [pic('export', 'The Export window: a manuscript for Word, an e-book or a PDF, what’s included, and a picture of page 1', 'The project’s ••• → Export: Word, e-book or PDF, with page 1 to see.')],
  },
  {
    id: 'everywhere',
    name: 'On every device',
    title: 'Your notes, on every device',
    lede: 'Connect once, and your notes and books follow you, kept as files in your own Google Drive.',
    points: [
      { title: 'Google Drive', text: 'Settings → Sync and storage → Continue with Google, then choose a folder (or a new “Crumpet” one). Do the same on each device.' },
      // Only when this copy of Crumpet offers accounts (docs/accounts-setup.md).
      ...(accountsReady ? [{ title: 'An account, if you like', text: 'Sign in with Google or an email and password (Settings → Account) to have your name on every device. It’s optional, and your notes never go to it.' }] : []),
      { title: 'Mac, iPhone and iPad', text: 'Crumpet for Mac is a download in Settings → Clipper and Mac app. On iPhone and iPad, open Crumpet in Safari and add it to the Home Screen. On an iPhone it opens on your library, in the same groups as on a computer (Inbox and Today, your notes, notebooks, books, then tags); tap a row or a tag for its notes, the round + for a new note (from the library it goes to the Inbox), and Share or ··· at the top of a note. On an iPad the formatting tools float at the foot of the page; held upright, a chapter has the whole screen, and tapping its name at the top jumps to another.' },
      { title: 'Or a folder', text: 'Prefer Dropbox, OneDrive or iCloud Drive? In Settings → Sync and storage, beside A folder on this computer, choose a folder they keep in step.' },
      { title: 'Nothing is ever lost', text: 'Crumpet keeps everything on the device too, and works offline; when two devices change the same note, it merges them, or keeps both.' },
    ],
    pictures: [pic('sync', 'Settings, Sync and storage, with Continue with Google', 'Settings → Sync and storage: Continue with Google.')],
  },
];

interface Workflow {
  id: string;
  title: string;
  lede: string;
  icon: React.ReactNode;
  steps: string[];
}

const WORKFLOWS: Workflow[] = [
  {
    id: 'novel',
    title: 'Write a novel',
    lede: 'From the first idea to a manuscript you can send.',
    icon: <IconBook size={20} />,
    steps: [
      'Click + next to Writing in the sidebar and name your book.',
      'Switch to Cards and add a card for each chapter you can see: a title and a line about what happens. Drag them until the order feels right.',
      'Add the people and places under Characters & places, so their cards are a hover away while you write.',
      'Set a word goal and a deadline from the project’s ••• menu.',
      'Write a chapter at a time. Change its status as it moves from draft to done; take a snapshot before a big rewrite.',
      'Read it through in Manuscript, then ••• → Export: a manuscript for Word for agents and editors, or an e-book for readers (with a title page and part pages; leave out chapters still To do if you like).',
    ],
  },
  {
    id: 'journal',
    title: 'Keep a journal',
    lede: 'A page a day, and a streak to keep.',
    icon: <IconSun size={20} />,
    steps: [
      'Click Today in the sidebar: it opens today’s note, dated, in a Daily notes notebook.',
      'Want the same prompts each day? Write them in a note in a notebook called Templates, named “Daily note”.',
      'Set a daily word goal in Writing stats (in the sidebar’s ⚙ menu) and watch the calendar fill in.',
      'Add a reminder from a note’s ··· menu to be reminded about it on a given day; the bell then shows at the top of the note.',
    ],
  },
  {
    id: 'research',
    title: 'Research a topic',
    lede: 'Gather, connect and find it again.',
    icon: <IconSearch size={20} />,
    steps: [
      'Drag the web clipper to your bookmarks bar (Settings → Clipper and Mac app) and clip pages as you read.',
      'Tag what you gather, for example research/lighthouses, and add PDFs and pictures: Crumpet reads the words in them too.',
      'Write your own notes and link them with [[ to the sources they came from.',
      `Open the Graph (Graph of links in the sidebar’s ⚙ menu, or ${mod}G) to see what connects, and search to find any line again in seconds.`,
    ],
  },
  {
    id: 'edit',
    title: 'Work with an editor',
    lede: 'Send it out, take the changes back in.',
    icon: <IconPen size={20} />,
    steps: [
      'Download the chapter or book as a Word document and send it.',
      'When it comes back, upload it (Upload files… in the sidebar’s ⚙ menu, or drag it onto Crumpet): it opens as a Word document, with their comments and tracked changes, and stays one as you work on it.',
      'Go through them one by one: accept or reject each change, and reply to comments.',
      'Not sure what changed? Compare two versions word by word from the command palette (Compare…).',
    ],
  },
];

type Page = { kind: 'chapter'; chapter: Chapter } | { kind: 'workflows' } | { kind: 'ready' };
const PAGES: Page[] = [...CHAPTERS.map((chapter) => ({ kind: 'chapter' as const, chapter })), { kind: 'workflows' }, { kind: 'ready' }];
const pageName = (p: Page) => (p.kind === 'chapter' ? p.chapter.name : p.kind === 'workflows' ? 'Workflows' : 'Ready to start');

const OPEN = 'crumpet-open-guide';

/** Opens the guide (from the sidebar's ⚙ menu or the ? button, the command palette or the welcome page). */
export function openGuide(): void {
  window.dispatchEvent(new Event(OPEN));
}

/** Calls `fn` whenever the guide is asked for. */
export function onOpenGuide(fn: () => void): () => void {
  window.addEventListener(OPEN, fn);
  return () => window.removeEventListener(OPEN, fn);
}

/** Opens by itself on a device's first visit (not in the automated browsers that test Crumpet). */
export function shouldOpenGuide(state: { settings: { guideSeen?: boolean }; notes: unknown[]; projects: unknown[] }): boolean {
  if (state.settings.guideSeen || state.notes.length || state.projects.length) return false;
  return !(typeof navigator !== 'undefined' && navigator.webdriver);
}

export function Guide({ onClose, onNewNote, onNewProject, onConnect, onTour }: { onClose(): void; onNewNote(): void; onNewProject(): void; onConnect(): void; onTour(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const [open, setOpen] = useState<string | null>(WORKFLOWS[0].id);
  // A picture shown full size (tapped or clicked).
  const [zoom, setZoom] = useState<Picture | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const page = PAGES[i];

  const close = useRef(onClose);
  close.current = onClose;
  const zoomed = useRef(zoom);
  zoomed.current = zoom;
  // Seen once it's open, so it doesn't come back by itself.
  useEffect(() => {
    if (!store.getState().settings.guideSeen) store.updateSettings({ guideSeen: true });
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomed.current) setZoom(null);
        else close.current();
      }
      if ((e.target as HTMLElement).closest?.('input, textarea')) return;
      if (e.key === 'ArrowRight') setI((n) => Math.min(PAGES.length - 1, n + 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);
  useEffect(() => {
    setShown(0);
    body.current?.scrollTo({ top: 0 });
  }, [i]);

  const go = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return createPortal(
    <div className="dialog-backdrop guide-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="guide" role="dialog" aria-modal="true" aria-label="Welcome to Crumpet: the guide" tabIndex={-1} ref={panel}>
        <nav className="guide-nav" aria-label="Guide chapters">
          <div className="guide-brand">
            <Logo size={28} />
            <b>Crumpet guide</b>
          </div>
          <ol>
            {PAGES.map((p, n) => (
              <li key={pageName(p)}>
                <button type="button" aria-current={n === i ? 'step' : undefined} className={n < i ? 'done' : ''} onClick={() => setI(n)}>
                  <span className="guide-dot" aria-hidden="true">
                    {n + 1}
                  </span>
                  {pageName(p)}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="guide-main">
          <button type="button" className="icon-btn guide-close" aria-label="Close the guide" onClick={onClose}>
            <IconClose size={16} />
          </button>
          <div className="guide-body" ref={body}>
            {page.kind === 'chapter' && (
              <article className={`guide-page guide-${page.chapter.id}`} aria-labelledby="guide-title">
                {page.chapter.id === 'welcome' && <Logo size={64} />}
                <p className="guide-kicker">
                  {i + 1} of {PAGES.length}
                </p>
                <h2 id="guide-title">{page.chapter.title}</h2>
                <p className="guide-lede">{page.chapter.lede}</p>
                <figure className="guide-figure">
                  <button type="button" className="guide-shot" aria-label={`Show full size: ${page.chapter.pictures[shown].alt}`} onClick={() => setZoom(page.chapter.pictures[shown])}>
                    <img src={page.chapter.pictures[shown].src} alt={page.chapter.pictures[shown].alt} width={1280} height={800} loading="eager" />
                  </button>
                  <figcaption>{page.chapter.pictures[shown].caption}</figcaption>
                  {page.chapter.pictures.length > 1 && (
                    <div className="guide-thumbs" role="group" aria-label="Pictures">
                      {page.chapter.pictures.map((p, n) => (
                        <button key={p.src} type="button" aria-pressed={n === shown} aria-label={`Picture ${n + 1}: ${p.caption}`} onClick={() => setShown(n)}>
                          <img src={p.src} alt="" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </figure>
                <ul className="guide-points">
                  {page.chapter.points.map((pt) => (
                    <li key={pt.title}>
                      <b>{pt.title}</b>
                      <span>{pt.text}</span>
                    </li>
                  ))}
                </ul>
              </article>
            )}
            {page.kind === 'workflows' && (
              <article className="guide-page" aria-labelledby="guide-title">
                <p className="guide-kicker">
                  {i + 1} of {PAGES.length}
                </p>
                <h2 id="guide-title">Workflows</h2>
                <p className="guide-lede">Step-by-step ways of working that writers use in Crumpet. Open one to follow along.</p>
                <div className="guide-flows">
                  {WORKFLOWS.map((w) => (
                    <section key={w.id} className={`guide-flow${open === w.id ? ' open' : ''}`}>
                      <button type="button" className="guide-flow-head" aria-expanded={open === w.id} onClick={() => setOpen(open === w.id ? null : w.id)}>
                        <span className="guide-flow-icon" aria-hidden="true">
                          {w.icon}
                        </span>
                        <span>
                          <b>{w.title}</b>
                          <small>{w.lede}</small>
                        </span>
                        <IconChevron size={12} className={open === w.id ? 'rot90' : ''} />
                      </button>
                      {open === w.id && (
                        <ol>
                          {w.steps.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ol>
                      )}
                    </section>
                  ))}
                </div>
              </article>
            )}
            {page.kind === 'ready' && (
              <article className="guide-page guide-ready" aria-labelledby="guide-title">
                <Logo size={64} />
                <p className="guide-kicker">
                  {i + 1} of {PAGES.length}
                </p>
                <h2 id="guide-title">Ready when you are</h2>
                <p className="guide-lede">Tell Crumpet your name (it goes at the top of the sidebar and on manuscripts), then pick a way to start.</p>
                <label className="field guide-name">
                  <span>Your name</span>
                  <input value={state.settings.name} placeholder="Your name" onChange={(e) => store.updateSettings({ name: e.target.value })} />
                </label>
                <div className="guide-starts">
                  <button type="button" className="guide-start" onClick={go(onNewNote)}>
                    <IconNote size={20} />
                    <b>Write a note</b>
                    <small>Just start typing</small>
                  </button>
                  <button type="button" className="guide-start" onClick={go(onNewProject)}>
                    <IconBook size={20} />
                    <b>Start a book</b>
                    <small>Chapters, outline and cards</small>
                  </button>
                  <button type="button" className="guide-start" onClick={go(onConnect)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-.5 9.5z" />
                    </svg>
                    <b>Connect Google Drive</b>
                    <small>Your notes on every device</small>
                  </button>
                </div>
                <p className="guide-again">
                  Open this guide again any time from the <b>?</b> (Help) menu at the top, which also lists what’s new, or{' '}
                  <button type="button" className="link-btn" onClick={go(onTour)}>
                    take a 30-second tour
                  </button>{' '}
                  of where everything is.
                </p>
              </article>
            )}
          </div>
          {zoom && (
            <button type="button" className="guide-zoom" aria-label="Close the picture" onClick={() => setZoom(null)}>
              <img src={zoom.src} alt={zoom.alt} />
            </button>
          )}
          <footer className="guide-foot">
            <button type="button" className="btn quiet" disabled={i === 0} onClick={() => setI(i - 1)}>
              Back
            </button>
            <span className="guide-progress" aria-hidden="true">
              <span style={{ width: `${((i + 1) / PAGES.length) * 100}%` }} />
            </span>
            {i < PAGES.length - 1 ? (
              <button type="button" className="btn primary" onClick={() => setI(i + 1)}>
                <span>
                  Next<span className="guide-next-to">: {pageName(PAGES[i + 1])}</span>
                </span>
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={onClose}>
                Done
              </button>
            )}
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}
