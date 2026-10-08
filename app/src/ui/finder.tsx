// The quick switcher (Ctrl+O) and command palette (Ctrl+P), like Obsidian's
// and VS Code's: type a few letters to open any note, chapter, project or
// card, or to run any command. Typing > in the switcher turns it into the
// palette. Enter opens in place, Ctrl+Enter in a new tab, Shift+Enter beside.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState, useAppStore } from './hooks';
import { type Match, rank } from '../data/fuzzy';
import { displayTitle, recentNotes } from '../data/selectors';
import type { AppState } from '../data/store';
import { type Bookmark, bookmarkLabel, toggleBookmark } from '../data/bookmarks';
import { usePanes } from './panes';
import { type Helped, useHelped, whenHelped } from './helpers';
import { goToLater } from './booktoc';
import { SLASH_ITEMS } from './slash';
import { THEMES } from './themes';
import { DOCX_TYPE, EPUB_TYPE, docxName, download, fileName, noteDocx, noteEpub } from '../data/wordfiles';
import type { Tab } from '../data/panes';

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
  run(how: How): void;
}

export interface Actions {
  newNote(): void;
  newProject(): void;
  openToday(): void;
  openSettings(): void;
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
    }, `${mod}K`),
    cmd(layout.sidebar === 'hidden' ? 'Show the sidebar' : 'Hide the sidebar', () => set({ sidebar: layout.sidebar === 'hidden' ? 'full' : 'hidden' }), `${mod}\\`),
    cmd(layout.list === false ? 'Show the note list' : 'Hide the note list', () => set({ list: layout.list === false }), `${isMac ? '⌘⇧' : 'Ctrl+Shift+'}\\`),
    cmd(layout.right ? 'Hide the right sidebar' : 'Show the right sidebar', () => set({ right: !layout.right }), `${isMac ? '⌘⌥' : 'Ctrl+Alt+'}\\`),
    ...(['outline', 'styles', 'comments', 'links', 'snapshots'] as const).map((t) => cmd(`Show ${t === 'styles' ? 'the Styles pane' : t}`, () => set({ right: true, rightTab: t }))),
    cmd('Split right', () => helped && panes.split(here.doc?.kind === 'chapter' ? { kind: 'chapter', id: helped.docId } : { kind: 'note', id: helped.docId }, 'right')),
    cmd('Split down', () => helped && panes.split(here.doc?.kind === 'chapter' ? { kind: 'chapter', id: helped.docId } : { kind: 'note', id: helped.docId }, 'bottom')),
    cmd('Close tab', () => panes.closeActive()),
    cmd(state.focusMode ? 'Leave focus mode' : 'Focus mode', () => store.setFocusMode(!state.focusMode), `${isMac ? '⌘⇧' : 'Ctrl+Shift+'}F`),
    cmd(state.settings.trackChanges ? 'Stop tracking changes' : 'Track changes', () => store.updateSettings({ trackChanges: !state.settings.trackChanges })),
    cmd(state.settings.pageView?.notes ? 'Notes as one long page' : 'Notes as pages (page view)', () => store.updateSettings({ pageView: { ...state.settings.pageView, notes: !state.settings.pageView?.notes } })),
    cmd(state.settings.ruler ? 'Hide the ruler' : 'Show the ruler', () => store.updateSettings({ ruler: !state.settings.ruler })),
    cmd(state.settings.toolbar === 'always' ? 'Formatting bar only over selected text' : 'Always show the formatting bar', () => store.updateSettings({ toolbar: state.settings.toolbar === 'always' ? 'selection' : 'always' })),
    cmd(state.settings.typewriter?.scroll ? 'Typewriter mode off' : 'Typewriter mode', () => store.updateSettings({ typewriter: { ...state.settings.typewriter, scroll: !state.settings.typewriter?.scroll, fade: !state.settings.typewriter?.scroll } })),
    cmd('Settings', actions.openSettings),
    ...THEMES.map((t) => cmd(`Theme: ${t.name}`, () => store.updateSettings({ theme: t.id }))),
  ];
  if (here.doc) {
    const on = marks.some((m) => m.kind === here.doc!.kind && m.id === here.doc!.id && !m.block);
    list.push(cmd(on ? `Remove bookmark: ${here.doc.kind === 'note' ? 'this note' : 'this chapter'}` : `Bookmark ${here.doc.kind === 'note' ? 'this note' : 'this chapter'}`, () => store.updateSettings({ bookmarks: toggleBookmark(marks, here.doc!) })));
  }
  if (here.doc) {
    list.push(cmd('Take a snapshot', () => {
      store.takeSnapshot(here.doc!.id);
      set({ right: true, rightTab: 'snapshots' });
    }, `${isMac ? '⌘⌥' : 'Ctrl+Alt+'}S`));
  }
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
      cmd('Align left', onText((e) => e.setAlign('left'))),
      cmd('Center', onText((e) => e.setAlign('center'))),
      cmd('Align right', onText((e) => e.setAlign('right'))),
      cmd('Justify', onText((e) => e.setAlign('justify'))),
      cmd('Find and replace', () => {
        ed.focus();
        // As if Ctrl+H were pressed in the text: its pane opens find and replace.
        (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true }));
      }, 'Ctrl+H'),
      ...SLASH_ITEMS.map((i) => cmd(`${/^h\d$|^text$|^bullet$|^numbered$|^todo$|^quote$|^title$/.test(i.id) ? 'Turn into' : 'Insert'}: ${i.label}`, onText((e) => i.run(e)), undefined, i.glyph)),
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
    for (const n of notes) out.push({ key: `note:${n.id}`, label: displayTitle(n), where: n.projectId ? `Research · ${state.projects.find((p) => p.id === n.projectId)?.name ?? ''}` : undefined, glyph: n.projectId ? '✎' : '¶', run: (how) => opener.note(n.id, how) });
    for (const p of state.projects) {
      out.push({ key: `project:${p.id}`, label: p.name || 'Untitled project', where: 'Project', glyph: '▤', run: (how) => opener.project(p.id, how) });
      for (const c of state.chapters.filter((x) => x.projectId === p.id)) out.push({ key: `chapter:${c.id}`, label: c.title.trim() || 'Untitled chapter', where: p.name, glyph: '§', run: (how) => opener.chapter(c.id, how) });
      for (const m of p.cast ?? []) out.push({ key: `cast:${m.id}`, label: m.name || 'Unnamed', where: `${m.kind === 'place' ? 'Place' : 'Character'} · ${p.name}`, glyph: m.kind === 'place' ? '⌂' : '☺', run: (how) => opener.cast(p.id, m.id, how) });
    }
    for (const b of state.settings.bookmarks ?? []) {
      if (b.kind !== 'heading') continue;
      const l = bookmarkLabel(state, b);
      if (l) out.push({ key: `heading:${b.id}:${b.block}`, label: l.title, where: `Heading · ${l.where ?? ''}`, glyph: '#', run: (how) => opener.bookmark(b, how) });
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

export function Finder({ mode, actions, onClose }: { mode: 'switch' | 'commands'; actions: Actions; onClose(): void }) {
  const store = useAppStore();
  const opener = useOpener();
  const [text, setText] = useState(mode === 'commands' ? '>' : '');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const commands = useCommands(actions);
  const targets = useTargets();
  const commanding = text.startsWith('>');
  const query = commanding ? text.slice(1) : text;
  const results = useMemo(() => {
    const found = rank(query, commanding ? commands : targets, (i) => i.label).slice(0, 60);
    // Nothing to open: offer to make a note with that title.
    if (!commanding && query.trim() && !found.some((r) => r.item.label.toLowerCase() === query.trim().toLowerCase())) {
      found.push({ item: { key: 'create', label: `Create note “${query.trim()}”`, glyph: '+', run: (how) => {
        const n = store.createNote({ title: query.trim() });
        opener.note(n.id, how);
      } }, match: { score: 0, hits: [] } });
    }
    return found;
  }, [query, commanding, commands, targets]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="dialog finder" role="dialog" aria-modal="true" aria-label={commanding ? 'Command palette' : 'Quick switcher'}>
        <input
          ref={input}
          className="finder-input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="finder-list"
          aria-activedescendant={results[at] ? `finder-${at}` : undefined}
          aria-label={commanding ? 'Command' : 'Find a note, chapter or project'}
          placeholder={commanding ? 'Type a command…' : 'Find a note, chapter, project or card… (type > for commands)'}
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
          {results.map((r, i) => (
            <li key={r.item.key} id={`finder-${i}`} role="option" aria-selected={i === at} className={i === at ? 'on' : ''} onMouseMove={() => i !== at && setAt(i)} onMouseDown={(e) => e.preventDefault()} onClick={(e) => choose(i, e.metaKey || e.ctrlKey ? 'tab' : e.shiftKey ? 'split' : 'here')}>
              <span className="finder-glyph" aria-hidden="true">
                {r.item.glyph}
              </span>
              <span className="finder-label">
                <Highlight text={r.item.label} match={r.match} />
              </span>
              {r.item.where && <span className={commanding ? 'finder-key' : 'finder-where'}>{r.item.where}</span>}
            </li>
          ))}
        </ul>
        <footer className="finder-foot">
          {commanding ? (
            <span>↵ run · Esc close</span>
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
