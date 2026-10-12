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
    pictures: [pic('notes', 'Crumpet with notebooks on the left, a list of notes, and a note open on the right', 'Notebooks on the left, your notes in the middle, the one you’re writing on the right.')],
  },
  {
    id: 'notes',
    name: 'Notes',
    title: 'Notes, notebooks and tags',
    lede: 'Start writing straight away; organise later, in whichever way suits you.',
    points: [
      { title: 'A new note', text: `Click New Note, or press N anywhere. The first line is its title.` },
      { title: 'Notebooks and stacks', text: 'Group notes in notebooks, and notebooks in stacks. Drag a note onto a notebook in the sidebar to file it; drag notebooks onto a stack to put them in it, or above one another to change their order.' },
      { title: 'Tags and favourites', text: 'Add tags under a note’s title (tags can nest, like book/characters), and star the notes you keep coming back to.' },
      { title: 'Find anything', text: `Search every note, chapter, PDF and picture from the top bar (${mod}K). ${mod}O jumps to any note by name; ${mod}P lists every command.` },
      { title: 'Upload anything', text: 'The ↑ button next to New Note uploads files, or drag them from your computer onto a notebook, the list or a pane. Pictures, PDFs, video and sound show as they are (drag a picture’s corner to resize it; its Picture menu wraps the text round it, turns, crops, frames or brightens it); Word documents open to edit and are saved back as Word documents.' },
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
      { title: 'Type / for anything', text: 'Headings, lists, checklists, tables, pictures, footnotes, maths and diagrams: type / at the start of a line and pick.' },
      { title: 'Format as you go', text: `Select text and a formatting bar appears. Click Aa in the corner to keep it on screen, with fonts, colours, styles and more; ${mod}D opens the Font window (small caps, underline styles, spacing, effects).` },
      { title: 'Put right as you type', text: `AutoCorrect curls quotes, makes dashes, fixes typos like “teh” and starts sentences with a capital (${mod}Z takes one back). Settings → Writing turns each off and keeps your own dictionary; characters’ names are never marked as misspelt.` },
      { title: 'Link your notes', text: 'Type [[ and a note’s name to link to it. Every note shows the notes that link to it, and the Graph shows them all.' },
      { title: 'Pages, like on paper', text: 'Page view shows your writing on real pages, with headers, footers and page numbers. Focus mode hides everything else.' },
      { title: 'Comments and changes', text: 'Comment on a passage, and track changes as Word does, to review your own edits or someone else’s. The Review tab in the right sidebar lists them all, with who and when, and shows the text with or without the markup. Track everyone’s changes in a document, and lock that with a password, from the ▾ beside Track changes.' },
    ],
    pictures: [pic('writing', 'The / menu open in a note, offering text, headings and lists', 'Type / at the start of a line for headings, lists, tables, pictures and more.')],
  },
  {
    id: 'books',
    name: 'Books',
    title: 'Books and long writing',
    lede: 'A project holds a book, a thesis or any long piece, in chapters you can move around.',
    points: [
      { title: 'Chapters and parts', text: 'Start a project from Projects in the sidebar. Each chapter has a status (to do, draft, revised, done), a synopsis and a word goal.' },
      { title: 'Three ways to see it', text: 'Chapter to write one at a time, Manuscript to read the whole book, Cards to plan on an index-card board and drag chapters into order.' },
      { title: 'Looks like a manuscript', text: 'Chapters use manuscript format (or Book, or your own styles), with page numbers that run through the whole book.' },
      { title: 'Goals and deadlines', text: 'Set a word goal and a deadline for the book; Writing stats keeps your daily words and streaks.' },
    ],
    pictures: [
      pic('book', 'A book’s outline with parts and chapters beside a chapter shown as a page', 'The outline on the left; the chapter on the page, in manuscript format.'),
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
      { title: 'Clip the web', text: 'The web clipper (Settings → Clipper & app) saves a web page, or the part you select, as a note in one click.' },
      { title: 'See the connections', text: 'The Graph draws your notes and the links between them, so related ideas find each other.' },
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
      { title: 'Word, PDF and e-book', text: 'Download a note or a whole book as a Word document, print it or save it as a PDF, or make an e-book (ePub). Word files you upload open as Word documents, comments and tracked changes included, and are saved back as .docx.' },
      { title: 'Snapshots and versions', text: 'Take a snapshot before a big edit; Crumpet also keeps earlier versions as you write, and can compare any two.' },
      { title: 'Read it aloud', text: 'Hear your writing read back to catch what your eyes skip, or dictate instead of typing.' },
    ],
    pictures: [pic('export', 'The project menu with Download as Word document, Print or save as PDF and Download as e-book', 'The project’s ••• menu: Word, PDF or e-book.')],
  },
  {
    id: 'everywhere',
    name: 'On every device',
    title: 'Your notes, on every device',
    lede: 'Connect once, and your notes and books follow you, kept as files in your own Google Drive.',
    points: [
      { title: 'Google Drive', text: 'Settings → Account & sync → Continue with Google, then choose a folder (or a new “Crumpet” one). Do the same on each device.' },
      // Only when this copy of Crumpet offers accounts (docs/accounts-setup.md).
      ...(accountsReady ? [{ title: 'An account, if you like', text: 'Sign in with Google or an email and password (Settings → Account & sync) to have your name on every device. It’s optional, and your notes never go to it.' }] : []),
      { title: 'Mac, iPhone and iPad', text: 'Crumpet for Mac is a download in Settings → Clipper & app. On iPhone and iPad, open Crumpet in Safari and add it to the Home Screen.' },
      { title: 'Or a folder', text: 'Prefer Dropbox, OneDrive or iCloud Drive? Choose “Use a folder on this computer” and pick a folder they keep in step.' },
      { title: 'Nothing is ever lost', text: 'Crumpet keeps everything on the device too, and works offline; when two devices change the same note, it merges them, or keeps both.' },
    ],
    pictures: [pic('sync', 'Settings, Account and sync, with Continue with Google', 'Settings → Account & sync: Continue with Google.')],
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
      'Click + next to Projects in the sidebar and name your book.',
      'Switch to Cards and add a card for each chapter you can see: a title and a line about what happens. Drag them until the order feels right.',
      'Add the people and places under Characters & places, so their cards are a hover away while you write.',
      'Set a word goal and a deadline from the project’s ••• menu.',
      'Write a chapter at a time. Change its status as it moves from draft to done; take a snapshot before a big rewrite.',
      'Read it through in Manuscript, then ••• → Download as Word document for agents and editors, or as an e-book for readers.',
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
      'Set a daily word goal in Writing stats and watch the calendar fill in.',
      'Ring the bell at the top of a note to be reminded about it on a given day.',
    ],
  },
  {
    id: 'research',
    title: 'Research a topic',
    lede: 'Gather, connect and find it again.',
    icon: <IconSearch size={20} />,
    steps: [
      'Drag the web clipper to your bookmarks bar (Settings → Clipper & app) and clip pages as you read.',
      'Tag what you gather, for example research/lighthouses, and add PDFs and pictures: Crumpet reads the words in them too.',
      'Write your own notes and link them with [[ to the sources they came from.',
      'Open the Graph to see what connects, and search to find any line again in seconds.',
    ],
  },
  {
    id: 'edit',
    title: 'Work with an editor',
    lede: 'Send it out, take the changes back in.',
    icon: <IconPen size={20} />,
    steps: [
      'Download the chapter or book as a Word document and send it.',
      'When it comes back, upload it (the ↑ button next to New Note, or drag it onto Crumpet): it opens as a Word document, with their comments and tracked changes, and stays one as you work on it.',
      'Go through them one by one: accept or reject each change, and reply to comments.',
      'Not sure what changed? Compare two versions word by word from the command palette (Compare…).',
    ],
  },
];

type Page = { kind: 'chapter'; chapter: Chapter } | { kind: 'workflows' } | { kind: 'ready' };
const PAGES: Page[] = [...CHAPTERS.map((chapter) => ({ kind: 'chapter' as const, chapter })), { kind: 'workflows' }, { kind: 'ready' }];
const pageName = (p: Page) => (p.kind === 'chapter' ? p.chapter.name : p.kind === 'workflows' ? 'Workflows' : 'Ready to start');

const OPEN = 'crumpet-open-guide';

/** Opens the guide (from the ? button, the command palette or the welcome page). */
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
                  Open this guide again any time with the <b>?</b> button at the top, or{' '}
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
