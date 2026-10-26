// The quick switcher (Ctrl+O) and command palette (Ctrl+P), like Obsidian's
// and VS Code's: type a few letters to open any note, chapter, project or
// card, or to run any command. Typing > in the switcher turns it into the
// palette. Enter opens in place, Ctrl+Enter in a new tab, Shift+Enter beside.

import { kindInfo } from '../data/world';
import { ignoreWord, useAddWord } from './spelling';
import { goToPlace, openGoTo } from './goto';
import { MARKUP_VIEWS } from './review';
import { openCombine } from './comparedocs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconBook, IconNote, IconPeople, IconPlus, IconSearch } from './icons';
import { useAppState, useAppStore } from './hooks';
import { type Match, rank } from '../data/fuzzy';
import { type SnippetPart, chapterText, displayTitle, noteText, recentNotes, snippet } from '../data/selectors';
import type { AppState } from '../data/store';
import { type Bookmark, bookmarkLabel, toggleBookmark } from '../data/bookmarks';
import { usePanes } from './panes';
import { type Helped, useHelped, whenHelped } from './helpers';
import { goToLater } from './booktoc';
import { SLASH_ITEMS } from './slash';
import { THEMES } from './themes';
import { openGuide } from './guide';
import { openWhatsNew } from './help';
import { openCustomise } from './customise';
import { currentHelped } from './helpers';
import { DOCX_TYPE, EPUB_TYPE, docxName, download, fileName, noteDocx, noteEpub } from '../data/wordfiles';
import { REVISIONS, hasRevisions } from '../data/revisions';
import { startReading, toggleDictation } from './speech';
import { startPainting } from './painter';
import type { Tab } from '../data/panes';
import { beginSprint, stopSprint } from './sprint';
import { SPRINT_LENGTHS } from '../data/sprints';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

type How = 'here' | 'tab' | 'split';

/** Opening things from the switcher, bookmarks and so on: in place, in a new tab, or beside. */
export function useOpener() {
  const store = useAppStore();
  const panes = usePanes();
  const show = (tab: Tab, how: How) => (how === 'split' ? panes.split(tab, 'right') : panes.open(tab, how === 'tab' ? 'tab' : 'replace'));
  return {
    note(id: string, how: How = 'here') {
      show({ kind: 'note', id }, how);
    },
    chapter(id: string, how: How = 'here') {
      const c = store.chapter(id);
      if (!c) return;
      // In place: the project's writing, at this chapter (its outline shows too).
      if (how === 'here') {
        store.openProject(c.projectId, id);
        panes.open({ kind: 'project', id: c.projectId });
      } else show({ kind: 'chapter', id }, how);
    },
    project(id: string, how: How = 'here') {
      if (how === 'here') store.openProject(id);
      show({ kind: 'project', id }, how);
    },
    cast(project: string, id: string, how: How = 'here') {
      if (how === 'here') {
        store.openProject(project);
        panes.open({ kind: 'project', id: project });
        store.openCast(id);
      } else show({ kind: 'cast', project, id }, how);
    },
    bookmark(b: Bookmark, how: How = 'here') {
      if (b.kind === 'note') return this.note(b.id, how);
      if (b.kind === 'chapter') return this.chapter(b.id, how);
      if (b.kind === 'project') return this.project(b.id, how);
      // A heading: open what it's in, then go to it.
      const s = store.getState();
      if (s.notes.some((n) => n.id === b.id)) {
        this.note(b.id, how);
        if (b.block) whenHelped(b.id, (h) => h.editor.goToBlock(b.block!));
      } else {
        if (b.block) goToLater({ chapter: b.id, block: b.block });
        this.chapter(b.id, how === 'here' ? 'here' : how);
        if (b.block) whenHelped(b.id, (h) => h.editor.goToBlock(b.block!));
      }
    },
  };
}

interface Item {
  key: string;
  label: string;
  /** Where it is (a chapter's project, a heading's note), or a command's shortcut. */
  where?: string;
  glyph: string;
  /** The switcher's heading it goes under (Notes, In your books, Headings). */
  group?: string;
  run(how: How): void;
}

const GROUPS = ['Notes', 'In your books', 'Headings', 'Commands', ''];

export interface Actions {
  newNote(): void;
  newProject(): void;
  openToday(): void;
  openSettings(): void;
  /** Picks another note or chapter to compare `docId` with. */
  compareFrom(docId: string): void;
  /** Compares two notes or chapters. */
  compare(a: string, b: string): void;
}

/** The current thing as a bookmark (and the heading the caret is under, if any). */
function currentBookmarks(state: AppState, h: Helped | null): { doc?: Bookmark; heading?: Bookmark } {
  if (!h) return {};
  const isNote = state.notes.some((n) => n.id === h.docId);
  const isChapter = state.chapters.some((c) => c.id === h.docId);
  if (!isNote && !isChapter) return {};
  const doc: Bookmark = { kind: isNote ? 'note' : 'chapter', id: h.docId };
  const blocks = h.editor.state.doc.blocks;
  const at = blocks.findIndex((b) => b.id === h.editor.currentBlock().id);
  const head = blocks
    .slice(0, at + 1)
    .reverse()
    .find((b) => /^heading[1-4]$/.test(b.type) && b.runs.some((r) => r.text.trim()));
  return { doc, heading: head ? { kind: 'heading', id: h.docId, block: head.id } : undefined };
}

function useCommands(actions: Actions): Item[] {
  const state = useAppState();
  const store = useAppStore();
  const panes = usePanes();
  const helped = useHelped();
  const layout = state.settings.layout ?? {};
  const set = (patch: Parameters<typeof store.updateLayout>[0]) => store.updateLayout(patch);
  const cmd = (label: string, run: () => void, where?: string, glyph = '›'): Item => ({ key: `cmd:${label}`, label, where, glyph, run: () => run() });
  const ed = helped?.editor ?? null;
  const addWord = useAddWord();
  // Commands on the text run in the editor, with its selection as it was.
  const onText = (f: (e: NonNullable<typeof ed>) => void) => () => {
    if (!ed) return;
    ed.focus();
    f(ed);
  };
  const marks = state.settings.bookmarks ?? [];
  const here = currentBookmarks(state, helped);
  const note = helped ? state.notes.find((n) => n.id === helped.docId) : undefined;
  const list: Item[] = [
    cmd('New note', actions.newNote, 'N'),
    cmd('New project', actions.newProject),
    cmd('Open today’s note', actions.openToday),
    cmd('Search notes', () => {
      const search = document.getElementById('search') as HTMLInputElement | null;
      search?.focus();
    }),
    cmd(layout.sidebar === 'hidden' ? 'Show the sidebar' : 'Hide the sidebar', () => set({ sidebar: layout.sidebar === 'hidden' ? 'full' : 'hidden' }), `${mod}\\`),
    cmd(layout.list === false ? 'Show the note list' : 'Hide the note list', () => set({ list: layout.list === false }), `${isMac ? '⌘⇧' : 'Ctrl+Shift+'}\\`),
    cmd(layout.right ? 'Hide the right sidebar' : 'Show the right sidebar', () => set({ right: !layout.right }), `${isMac ? '⌘⌥' : 'Ctrl+Alt+'}\\`),
    ...(['outline', 'styles', 'links', 'snapshots'] as const).map((t) => cmd(`Show ${t === 'styles' ? 'the Styles pane' : t}`, () => set({ right: true, rightTab: t }))),
    cmd('Text statistics, highlighting and session target', () => set({ right: true, rightTab: 'writing' })),
    cmd('Thesaurus and definitions', () => set({ right: true, rightTab: 'thesaurus' }), isMac ? '⇧F7' : 'Shift+F7'),
    cmd('Split right', () => helped && panes.split(here.doc?.kind === 'chapter' ? { kind: 'chapter', id: helped.docId } : { kind: 'note', id: helped.docId }, 'right')),
    cmd('Split down', () => helped && panes.split(here.doc?.kind === 'chapter' ? { kind: 'chapter', id: helped.docId } : { kind: 'note', id: helped.docId }, 'bottom')),
    cmd('Close tab', () => panes.closeActive()),
    cmd('Open graph view', () => panes.open({ kind: 'graph', id: 'graph' }, 'tab'), `${mod}G`),
    cmd(state.focusMode ? 'Leave focus mode' : 'Focus mode', () => store.setFocusMode(!state.focusMode), `${isMac ? '⌘⇧' : 'Ctrl+Shift+'}F`),
    cmd(state.settings.trackChanges ? 'Stop tracking changes' : 'Track changes', () => store.updateSettings({ trackChanges: !state.settings.trackChanges })),
    cmd(state.settings.pageView?.notes ? 'Notes as one long page' : 'Notes as pages (page view)', () => store.updateSettings({ pageView: { ...state.settings.pageView, notes: !state.settings.pageView?.notes } })),
    cmd(state.settings.ruler ? 'Hide the ruler' : 'Show the ruler', () => store.updateSettings({ ruler: !state.settings.ruler })),
    cmd(state.settings.toolbar === 'always' ? 'Formatting bar only over selected text' : 'Always show the formatting bar', () => store.updateSettings({ toolbar: state.settings.toolbar === 'always' ? 'selection' : 'always' })),
    cmd(state.settings.typewriter?.scroll ? 'Typewriter mode off' : 'Typewriter mode', () => store.updateSettings({ typewriter: { ...state.settings.typewriter, scroll: !state.settings.typewriter?.scroll, fade: !state.settings.typewriter?.scroll } })),
    ...(state.settings.sprint
      ? [cmd('Stop the writing sprint', () => stopSprint(store))]
      : SPRINT_LENGTHS.map((m) => cmd(`Start a ${m}-minute writing sprint`, () => beginSprint(store, m)))),
    cmd('Settings', actions.openSettings),
    cmd('Open the guide to Crumpet', openGuide),
    cmd('What’s new in Crumpet', openWhatsNew),
    cmd('Customise the formatting bar', openCustomise),
    ...(state.settings.macros ?? []).map((m) => cmd(`Run macro: ${m.name}`, () => {
      const ed = currentHelped()?.editor;
      if (ed) {
        ed.focus();
        ed.playMacro(m.steps);
      }
    }, m.key ? `Alt+Shift+${m.key}` : undefined)),
    ...REVISIONS.map((r, i) => cmd(`Revision mode: ${r.name.toLowerCase()} round`, () => store.updateSettings({ revision: i + 1 }))),
    ...(state.settings.revision ? [cmd('Revision mode off', () => store.updateSettings({ revision: 0 }))] : []),
    ...THEMES.map((t) => cmd(`Theme: ${t.name}`, () => store.updateSettings({ theme: t.id }))),
  ];
  if (here.doc) {
    const on = marks.some((m) => m.kind === here.doc!.kind && m.id === here.doc!.id && !m.block);
    list.push(cmd(on ? `Remove bookmark: ${here.doc.kind === 'note' ? 'this note' : 'this chapter'}` : `Bookmark ${here.doc.kind === 'note' ? 'this note' : 'this chapter'}`, () => store.updateSettings({ bookmarks: toggleBookmark(marks, here.doc!) })));
  }
  if (here.doc) {
    list.push(cmd('Compare with another note or chapter…', () => actions.compareFrom(here.doc!.id)));
    list.push(cmd('Combine reviewers’ copies of this…', () => openCombine(here.doc!.id)));
    list.push(cmd('Take a snapshot', () => {
      store.takeSnapshot(here.doc!.id);
      set({ right: true, rightTab: 'snapshots' });
    }, `${isMac ? '⌘⌥' : 'Ctrl+Alt+'}S`));
  }
  if (here.doc && helped && hasRevisions(helped.editor.state.doc)) list.push(cmd('Remove revision colours', () => store.removeRevisions(helped.docId)));
  if (here.heading) {
    const on = marks.some((m) => m.kind === 'heading' && m.id === here.heading!.id && m.block === here.heading!.block);
    list.push(cmd(on ? 'Remove bookmark: this heading' : 'Bookmark this heading', () => store.updateSettings({ bookmarks: toggleBookmark(marks, here.heading!) })));
  }
  if (note) {
    list.push(
      cmd('Download as Word document', async () => download(await noteDocx(store.getState(), note), docxName(displayTitle(note)), DOCX_TYPE)),
      cmd('Download as e-book (ePub)', async () => download(await noteEpub(store.getState(), note), fileName(displayTitle(note), 'epub'), EPUB_TYPE)),
    );
  }
  if (ed) {
    list.push(
      cmd('Undo', onText((e) => e.undo()), `${mod}Z`),
      cmd('Redo', onText((e) => e.redo()), isMac ? '⌘⇧Z' : 'Ctrl+Y'),
      cmd('Bold', onText((e) => e.toggleMark('bold')), `${mod}B`),
      cmd('Italic', onText((e) => e.toggleMark('italic')), `${mod}I`),
      cmd('Underline', onText((e) => e.toggleMark('underline')), `${mod}U`),
      cmd('Strikethrough', onText((e) => e.toggleMark('strike'))),
      cmd('Clear formatting', onText((e) => e.clearFormatting())),
      cmd('Format painter', onText((e) => startPainting(e))),
      cmd('Read aloud', onText((e) => startReading(e, state.settings)), `${isMac ? '⌘⌥' : 'Ctrl+Alt+'}Space`),
      cmd('Dictate', onText((e) => toggleDictation(e)), `${isMac ? '⌘⌥' : 'Ctrl+Alt+'}D`),
      cmd('Align left', onText((e) => e.setAlign('left'))),
      cmd('Center', onText((e) => e.setAlign('center'))),
      cmd('Align right', onText((e) => e.setAlign('right'))),
      cmd('Justify', onText((e) => e.setAlign('justify'))),
      ...(() => {
        const w = ed.wordAtCaret();
        return w
          ? [
              cmd(`Spelling: add “${w}” to your dictionary`, () => addWord(w)),
              cmd(`Spelling: ignore “${w}” everywhere for now`, () => ignoreWord(w)),
            ]
          : [];
      })(),
      cmd('Go to page, heading, footnote or comment…', () => openGoTo(ed.pageBoxes.length ? 'page' : 'heading'), 'F5'),
      cmd('Next footnote', onText((e) => goToPlace(e, 'footnote', 'next'))),
      cmd('Previous footnote', onText((e) => goToPlace(e, 'footnote', 'previous'))),
      cmd('Next comment', onText((e) => goToPlace(e, 'comment', 'next'))),
      cmd('Previous comment', onText((e) => goToPlace(e, 'comment', 'previous'))),
      cmd('Next change', onText((e) => goToPlace(e, 'change', 'next'))),
      cmd('Previous change', onText((e) => goToPlace(e, 'change', 'previous'))),
      ...MARKUP_VIEWS.map(([v, name]) => cmd(`Show ${name.toLowerCase()}`, () => store.updateSettings({ markup: v }))),
      cmd('Reviewing pane: every change and comment', () => set({ right: true, rightTab: 'comments' })),
      cmd('Next heading', onText((e) => goToPlace(e, 'heading', 'next'))),
      cmd('Previous heading', onText((e) => goToPlace(e, 'heading', 'previous'))),
      cmd('Find and replace', () => {
        ed.focus();
        // As if Ctrl+H were pressed in the text: its pane opens find and replace.
        (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true }));
      }, 'Ctrl+H'),
      ...SLASH_ITEMS.map((i) => cmd(`${/^h\d$|^text$|^bullet$|^numbered$|^todo$|^quote$|^title$|^toggle$|^note$|^tip$|^warning$|^important$/.test(i.id) ? 'Turn into' : 'Insert'}: ${i.label}`, onText((e) => i.run(e)), undefined, i.glyph)),
    );
  }
  return list;
}

/** Everything the switcher can open, recent notes first. */
function useTargets(): Item[] {
  const state = useAppState();
  const opener = useOpener();
  return useMemo(() => {
    const out: Item[] = [];
    const recent = recentNotes(state.notes, 50);
    const seen = new Set(recent.map((n) => n.id));
    const notes = [...recent, ...state.notes.filter((n) => !seen.has(n.id))].filter((n) => n.trashedAt === null);
    for (const n of notes) out.push({ key: `note:${n.id}`, label: displayTitle(n), where: n.projectId ? `Research · ${state.projects.find((p) => p.id === n.projectId)?.name ?? ''}` : undefined, glyph: n.projectId ? '✎' : '¶', group: n.projectId ? 'In your books' : 'Notes', run: (how) => opener.note(n.id, how) });
    for (const p of state.projects) {
      out.push({ key: `project:${p.id}`, label: p.name || 'Untitled project', where: 'Project', glyph: '▤', group: 'In your books', run: (how) => opener.project(p.id, how) });
      for (const c of state.chapters.filter((x) => x.projectId === p.id)) out.push({ key: `chapter:${c.id}`, label: c.title.trim() || 'Untitled chapter', where: p.name, glyph: '§', group: 'In your books', run: (how) => opener.chapter(c.id, how) });
      for (const m of p.cast ?? []) out.push({ key: `cast:${m.id}`, label: m.name || 'Unnamed', where: `${kindInfo(m.kind).name} · ${p.name}`, glyph: m.kind === 'place' ? '⌂' : '☺', group: 'In your books', run: (how) => opener.cast(p.id, m.id, how) });
    }
    for (const b of state.settings.bookmarks ?? []) {
      if (b.kind !== 'heading') continue;
      const l = bookmarkLabel(state, b);
      if (l) out.push({ key: `heading:${b.id}:${b.block}`, label: l.title, where: `Heading · ${l.where ?? ''}`, glyph: '#', group: 'Headings', run: (how) => opener.bookmark(b, how) });
    }
    return out;
  }, [state.notes, state.projects, state.chapters, state.settings.bookmarks]); // eslint-disable-line react-hooks/exhaustive-deps
}

function Highlight({ text, match }: { text: string; match: Match }) {
  if (!match.hits.length) return <>{text}</>;
  const hit = new Set(match.hits);
  const parts: { t: string; on: boolean }[] = [];
  for (const [i, ch] of [...text].entries()) {
    const on = hit.has(i);
    if (parts.length && parts[parts.length - 1].on === on) parts[parts.length - 1].t += ch;
    else parts.push({ t: ch, on });
  }
  return (
    <>
      {parts.map((p, i) => (p.on ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </>
  );
}

const OPEN_FINDER = 'crumpet:open-finder';
/** Opens Find anything (⌘K), as from the sidebar's search box. */
export function openFinder(): void {
  window.dispatchEvent(new Event(OPEN_FINDER));
}
/** Calls `fn` whenever Find anything is asked for. */
export function onOpenFinder(fn: () => void): () => void {
  window.addEventListener(OPEN_FINDER, fn);
  return () => window.removeEventListener(OPEN_FINDER, fn);
}

/** The calm look's icon for a result, by what it is. */
function calmGlyph(key: string): React.ReactNode {
  const kind = key.split(':')[0];
  if (kind === 'note') return <IconNote size={16} />;
  if (kind === 'chapter' || kind === 'project') return <IconBook size={16} />;
  if (kind === 'cast') return <IconPeople size={16} />;
  if (key === 'create') return <IconPlus size={16} />;
  if (key === 'search') return <IconSearch size={16} />;
  return null;
}

export function Finder({ mode, actions, onClose, compareFrom }: { mode: 'switch' | 'commands' | 'compare'; actions: Actions; onClose(): void; compareFrom?: string }) {
  const store = useAppStore();
  const opener = useOpener();
  // The calm look (design 11): icons in soft squares, a book's name over its chapters, the keys at the foot.
  const calm = !store.getState().settings.toolbarAll;
  const [text, setText] = useState(mode === 'commands' ? '>' : '');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const commands = useCommands(actions);
  const targets = useTargets();
  const comparing = mode === 'compare';
  const commanding = !comparing && text.startsWith('>');
  const query = commanding ? text.slice(1) : text;
  const results = useMemo(() => {
    // Comparing: only notes and chapters (not the one being compared), and choosing one compares them.
    const pool = comparing
      ? targets.filter((t) => (t.key.startsWith('note:') || t.key.startsWith('chapter:')) && t.key.split(':')[1] !== compareFrom).map((t) => ({ ...t, run: () => actions.compare(compareFrom!, t.key.split(':')[1]) }))
      : commanding
        ? commands
        : targets;
    const found: { item: Item; match: Match; snip?: SnippetPart[] | null }[] = rank(query, pool, (i) => i.label).slice(0, 60);
    if (!commanding && !comparing && query.trim()) {
      // Each note and chapter shows a line of its text, with the words found lit;
      // notes and chapters with the words in their text (not their title) come after.
      const words = query.trim().toLowerCase().split(/\s+/);
      const s = store.getState();
      const textOf = (key: string): string => {
        const [kind, id] = key.split(':');
        if (kind === 'note') {
          const n = s.notes.find((x) => x.id === id);
          return n ? noteText(n, s.fileText) : '';
        }
        if (kind === 'chapter') {
          const c = s.chapters.find((x) => x.id === id);
          return c ? chapterText(c, false) || c.synopsis : '';
        }
        return '';
      };
      for (const r of found) {
        if (!/^(note|chapter):/.test(r.item.key)) continue;
        const text = textOf(r.item.key);
        r.snip = snippet(text, words, 110) ?? (text ? [{ text: text.replace(/\s+/g, ' ').slice(0, 110), hit: false }] : null);
      }
      if (query.trim().length >= 3) {
        const have = new Set(found.map((r) => r.item.key));
        const extra = pool.filter((t) => /^(note|chapter):/.test(t.key) && !have.has(t.key) && words.every((w) => textOf(t.key).toLowerCase().includes(w))).slice(0, 12);
        for (const t of extra) found.push({ item: t, match: { score: 0, hits: [] }, snip: snippet(textOf(t.key), words, 110) });
      }
      // Grouped: notes, then what's in your books, then headings.
      found.sort((a, b) => GROUPS.indexOf(a.item.group ?? '') - GROUPS.indexOf(b.item.group ?? ''));
    }
    // Every match, with filters: the note list's search.
    if (!commanding && !comparing && query.trim()) {
      found.push({ item: { key: 'search', label: `Search everything for “${query.trim()}”`, glyph: '⌕', group: 'Commands', run: () => store.setQuery(query.trim()) }, match: { score: 0, hits: [] } });
    }
    // Nothing to open: offer to make a note with that title.
    if (!commanding && !comparing && query.trim() && !found.some((r) => r.item.label.toLowerCase() === query.trim().toLowerCase())) {
      found.push({ item: { key: 'create', label: calm ? `New note called “${query.trim()}”` : `Create note “${query.trim()}”`, glyph: '+', group: 'Commands', run: (how) => {
        const n = store.createNote({ title: query.trim() });
        opener.note(n.id, how);
      } }, match: { score: 0, hits: [] } });
    }
    return found;
  }, [query, commanding, comparing, commands, targets]); // eslint-disable-line react-hooks/exhaustive-deps

  const books = [...new Set(results.filter((r) => r.item.key.startsWith('chapter:')).map((r) => r.item.where ?? ''))];
  useEffect(() => input.current?.focus(), []);
  useEffect(() => setAt(0), [text]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [at]);

  const choose = (i: number, how: How) => {
    const r = results[i];
    if (!r) return;
    onClose();
    // After the dialog has gone, so focus goes back where it was.
    setTimeout(() => r.item.run(how), 0);
  };

  return (
    <div className="dialog-backdrop finder-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog finder" role="dialog" aria-modal="true" aria-label={comparing ? 'Compare with' : commanding ? 'Command palette' : 'Quick switcher'}>
        {calm && (
          <span className="finder-search" aria-hidden="true">
            <IconSearch size={18} />
          </span>
        )}
        {calm && (
          <button type="button" className="finder-esc" aria-label="Close" onClick={onClose}>
            esc
          </button>
        )}
        <input
          ref={input}
          className="finder-input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="finder-list"
          aria-activedescendant={results[at] ? `finder-${at}` : undefined}
          aria-label={commanding ? 'Command' : 'Find a note, chapter or project'}
          placeholder={comparing ? 'Compare with which note or chapter?' : commanding ? 'Type a command…' : 'Find a note, chapter, project or card… (type > for commands)'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAt((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAt((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              choose(at, e.metaKey || e.ctrlKey ? 'tab' : e.shiftKey ? 'split' : 'here');
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
        />
        <ul id="finder-list" ref={listRef} className="finder-list" role="listbox" aria-label="Results">
          {results.length === 0 && <li className="finder-none">Nothing matches.</li>}
          {results.map((r, i) => [
            !commanding && !comparing && query.trim() && r.item.group && r.item.group !== results[i - 1]?.item.group && (
              <li key={`g:${r.item.group}`} role="presentation" className="finder-group">
                {calm && r.item.group === 'In your books' && books.length === 1 ? `In ${books[0]}` : r.item.group}
              </li>
            ),
            <li key={r.item.key} id={`finder-${i}`} role="option" aria-selected={i === at} className={`${i === at ? 'on' : ''}${'snip' in r && r.snip ? ' with-snip' : ''}`} onMouseMove={() => i !== at && setAt(i)} onMouseDown={(e) => e.preventDefault()} onClick={(e) => choose(i, e.metaKey || e.ctrlKey ? 'tab' : e.shiftKey ? 'split' : 'here')}>
              <span className="finder-glyph" aria-hidden="true">
                {calm ? calmGlyph(r.item.key) ?? r.item.glyph : r.item.glyph}
              </span>
              <span className="finder-label">
                <Highlight text={r.item.label} match={r.match} />
                {'snip' in r && r.snip && <span className="finder-snip">{r.snip.map((p, k) => (p.hit ? <mark key={k}>{p.text}</mark> : p.text))}</span>}
              </span>
              {r.item.where && !(calm && i === at && !commanding) && !(calm && books.length === 1 && r.item.key.startsWith('chapter:')) && <span className={commanding ? 'finder-key' : 'finder-where'}>{r.item.where}</span>}
              {calm && i === at && !commanding && <span className="finder-enter">↵ open</span>}
            </li>,
          ])}
        </ul>
        <footer className="finder-foot">
          {comparing ? (
            <span>↵ compare · Esc close</span>
          ) : commanding ? (
            <span>↵ run · Esc close</span>
          ) : calm ? (
            <span className="finder-keys">
              <kbd>↑</kbd>
              <kbd>↓</kbd> move <kbd>⇧</kbd>
              <kbd>↵</kbd> open beside <span>Type</span> <kbd>&gt;</kbd> for commands
            </span>
          ) : (
            <span>
              ↵ open · {mod}↵ new tab · ⇧↵ beside · <b>&gt;</b> commands
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
