import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Doc } from '@crumpet/editor/model';
import { type Nav, NavContext, useAppState, useAppStore } from './hooks';
import { findByTitle } from '../data/links';
import { ClipDialog } from './clipper';
import { Sidebar } from './Sidebar';
import { NoteList } from './NoteList';
import { NotePane } from './NotePane';
import { ProjectOutline, ProjectPane } from './Project';
import { TopBar } from './TopBar';
import { LIST, RIGHT, Resizer, SIDEBAR, SidebarRail, TabBar } from './layout';
import { type Peek, PeekContext } from './fold';
import { PaneArea, PanesContext, usePanesState } from './panes';
import { RightSidebar } from './rightside';
import { Finder } from './finder';
import { currentHelped } from './helpers';
import { SettingsDialog } from './Settings';
import { applyTheme } from './theme';
import { startSession } from './writingtab';
import { useTodayWords } from './stats-ui';
import { SpeechBar, startReading, toggleDictation } from './speech';
import { CompareDocs } from './comparedocs';
import { useFileIndex } from './fileindex';
import type { View } from '../data/types';

/** On narrow screens only one pane shows at a time. */
export type Pane = 'sidebar' | 'list' | 'note';

const NARROW = '(max-width: 759px)';
/** Tablets and small windows: the sidebar starts as a strip of icons. */
const MEDIUM = '(max-width: 1099px)';

export function App() {
  const state = useAppState();
  const store = useAppStore();
  const [pane, setPane] = useState<Pane>('list');
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  const panes = usePanesState();
  const panesRef = useRef(panes);
  panesRef.current = panes;
  useFileIndex();

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => applyTheme(state.settings), [state.settings]);

  // A character card or research note opening in a project takes the whole screen on a phone.
  useEffect(() => {
    if (state.castId || state.researchId) setPane('note');
  }, [state.castId, state.researchId]);

  const openView = useCallback(
    (view: View) => {
      store.setView(view);
      setPane('list');
      // Choosing a notebook or tag shows its notes, even if the list was hidden.
      if (store.getState().settings.layout?.list === false) store.updateLayout({ list: true });
    },
    [store],
  );

  const openNote = useCallback(
    (id: string) => {
      // Where you're working (the pane last clicked in), even if it's already the selected note.
      panes.open({ kind: 'note', id });
      setPane('note');
    },
    [store, panes],
  );

  const openChapter = useCallback(
    (id: string) => {
      store.selectChapter(id);
      const p = store.chapter(id)?.projectId;
      if (p) panes.open({ kind: 'project', id: p });
      setPane('note');
    },
    [store, panes],
  );

  /** From a link: the note with this title, or a new one with it. */
  const nav = useMemo<Nav>(
    () => ({
      openNote: (id: string) => {
        const n = store.note(id);
        if (!n) return;
        const s = store.getState();
        // Leave a project (or a list the note isn't in) for the note's own notebook.
        if (s.view.kind === 'project' || s.query) store.setView(n.notebookId ? { kind: 'notebook', id: n.notebookId } : { kind: 'all' });
        openNote(id);
      },
      openTitle: (title: string) => {
        const found = findByTitle(store.getState().notes, title);
        if (found) return nav.openNote(found.id);
        const s = store.getState();
        if (s.view.kind === 'project') store.setView({ kind: 'all' });
        store.createNote({ title });
        setPane('note');
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store],
  );

  const openToday = useCallback(() => {
    store.openToday();
    setPane('note');
  }, [store]);

  const newFromTemplate = useCallback(
    (t: { title: string; body: string }) => {
      store.newFromTemplate(t);
      setPane('note');
    },
    [store],
  );

  const importNote = useCallback(
    (n: { title: string; doc: Doc }) => {
      store.createNote(n);
      setPane('note');
    },
    [store],
  );

  const newNote = useCallback(() => {
    store.createNote();
    setPane('note');
    // The title field focuses itself when a new, empty note opens.
  }, [store]);

  // A folded-away sidebar or list peeks out while the mouse rests on its edge or its button.
  const [peek, setPeek] = useState<Peek>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout>>();
  const peekCtl = useMemo(() => {
    const later = (p: Peek, ms: number) => {
      clearTimeout(peekTimer.current);
      peekTimer.current = setTimeout(() => setPeek(p), ms);
    };
    return {
      open: (p: Peek) => later(p, 120),
      leave: () => later(null, 350),
      stay: () => clearTimeout(peekTimer.current),
      close: () => {
        clearTimeout(peekTimer.current);
        setPeek(null);
      },
    };
  }, []);
  useEffect(() => () => clearTimeout(peekTimer.current), []);

  // Ctrl+\ (⌘\ on a Mac): show or hide the sidebar; with Shift, the note list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.code === 'Backslash' || e.key === '\\')) {
        e.preventDefault();
        setPeek(null);
        const layout = store.getState().settings.layout;
        if (e.altKey) store.updateLayout({ right: !layout?.right });
        else if (e.shiftKey) store.updateLayout({ list: layout?.list === false });
        else store.updateLayout({ sidebar: (layout?.sidebar ?? 'full') === 'hidden' ? 'full' : 'hidden' });
      }
      if (e.key === 'Escape') setPeek(null);
      // Ctrl+G (⌘G): the graph view, as in Obsidian.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        panesRef.current.open({ kind: 'graph', id: 'graph' }, 'tab');
      }
      // Shift+F7: the thesaurus, as in Word.
      if (e.shiftKey && e.key === 'F7') {
        e.preventDefault();
        store.updateLayout({ right: true, rightTab: 'thesaurus' });
      }
      // Ctrl+Alt+Space (⌘⌥Space): read aloud; Ctrl+Alt+D (⌘⌥D): dictate.
      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.code === 'Space' || e.code === 'KeyD')) {
        const h = currentHelped();
        if (!h) return;
        e.preventDefault();
        if (e.code === 'Space') startReading(h.editor, store.getState().settings);
        else toggleDictation(h.editor);
      }
      // Ctrl+Alt+S (⌘⌥S): a snapshot of what you're writing, shown in the right sidebar.
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyS') {
        const h = currentHelped();
        if (!h) return;
        e.preventDefault();
        if (store.takeSnapshot(h.docId)) store.updateLayout({ right: true, rightTab: 'snapshots' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  // N, when not typing: a new note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector('.dialog')) return;
      e.preventDefault();
      newNote();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newNote]);

  // Focus mode: Ctrl+Shift+F (⌘⇧F) in and out; Escape out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const focus = store.getState().focusMode;
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        store.setFocusMode(!focus);
      } else if (focus && e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.popover, .dialog')) {
        store.setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  // ⌘K / Ctrl+K: search, unless editing text with a selection (then the editor uses it for links).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k' && !e.defaultPrevented) {
        e.preventDefault();
        const search = document.getElementById('search') as HTMLInputElement | null;
        search?.focus();
        search?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Ctrl+O (⌘O): the quick switcher; Ctrl+P (⌘P) or Ctrl+Shift+P: the command palette.
  const [finder, setFinder] = useState<null | 'switch' | 'commands' | 'compare'>(null);
  const [compareFrom, setCompareFrom] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      // Remember the selected text, for commands that act on it once the window closes.
      if (k === 'o' || k === 'p') currentHelped()?.editor.currentSelection();
      if (k === 'o' && !e.shiftKey) {
        e.preventDefault();
        setFinder('switch');
      } else if (k === 'p') {
        e.preventDefault();
        setFinder('commands');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The session target counts from when Crumpet opened.
  const todayAtStart = useTodayWords();
  useEffect(() => {
    if (state.ready) startSession(todayAtStart);
  }, [state.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // A search shows matching notes, even from inside a project.
  const project = state.view.kind === 'project' && !state.query.trim() ? store.project(state.view.id) : undefined;

  const appRef = useRef<HTMLDivElement>(null);
  const peekValue = useMemo(() => ({ peek, ...peekCtl }), [peek, peekCtl]);
  if (!state.ready) return <div className="loading">Opening your notes…</div>;

  // On phones one pane shows at a time, so the layout choices are for bigger screens.
  const layout = narrow ? {} : (state.settings.layout ?? {});
  const sidebarMode = layout.sidebar ?? (!narrow && window.matchMedia(MEDIUM).matches ? 'icons' : 'full');
  const showList = layout.list !== false;
  const showRight = !!layout.right && !state.focusMode;
  const rightW = layout.rightWidth ?? RIGHT.normal;
  const sideW = layout.sidebarWidth ?? SIDEBAR.normal;
  const listW = layout.listWidth ?? LIST.normal;
  const sizes = narrow ? undefined : ({ '--side-w': layout.sidebarWidth ? `${sideW}px` : undefined, '--list-w': layout.listWidth ? `${listW}px` : undefined, '--right-w': layout.rightWidth ? `${rightW}px` : undefined} as React.CSSProperties);
  const target = () => appRef.current;
  const peekable = !narrow && !state.focusMode;
  const newProject = () => openView({ kind: 'project', id: store.createProject('Untitled project').id });

  return (
    <NavContext.Provider value={nav}>
    <PanesContext.Provider value={panes}>
    <div ref={appRef} className={`app${narrow ? ' narrow' : ''}${state.focusMode ? ' focus-mode' : ''}`} data-pane={narrow ? (state.focusMode ? 'note' : pane) : undefined} style={sizes}>
      {state.focusMode && (
        <div className="focus-bar">
          <button
            type="button"
            className="btn quiet"
            aria-pressed={!!state.settings.typewriter?.scroll}
            onClick={() => {
              const on = !state.settings.typewriter?.scroll;
              store.updateSettings({ typewriter: { ...state.settings.typewriter, scroll: on, fade: on } });
            }}
          >
            Typewriter
          </button>
          <button type="button" className="btn quiet exit-focus" onClick={() => store.setFocusMode(false)}>
            Exit focus <kbd>Esc</kbd>
          </button>
        </div>
      )}
      <ClipDialog onSaved={() => setPane('note')} />
      {finder && (
        <Finder
          mode={finder}
          compareFrom={compareFrom ?? undefined}
          actions={{
            newNote,
            newProject,
            openToday,
            openSettings: () => setSettingsOpen(true),
            compareFrom: (id) => {
              setCompareFrom(id);
              setTimeout(() => setFinder('compare'));
            },
            compare: (a, b) => setCompare({ a, b }),
          }}
          onClose={() => setFinder(null)}
        />
      )}
      {compare && <CompareDocs a={compare.a} b={compare.b} onSwap={() => setCompare({ a: compare.b, b: compare.a })} onClose={() => setCompare(null)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <SpeechBar />
      {state.temporary && (
        <p className="banner" role="status">
          This browser isn’t letting Crumpet save, so notes will be lost when you close the page. Private windows often do this.
        </p>
      )}
      {store.saveFailures > 0 && (
        <p className="banner" role="alert">
          Some changes couldn’t be saved. Keep this page open and check your device has free space.
        </p>
      )}
      <PeekContext.Provider value={peekValue}>
      <div className="frame">
        {peekable && sidebarMode === 'hidden' && <div className="peek-edge" aria-hidden="true" onMouseEnter={() => peekCtl.open('sidebar')} onMouseLeave={peekCtl.leave} />}
        {peekable && peek === 'sidebar' && sidebarMode === 'hidden' && (
          <div className="peek-panel sidebar-peek" onMouseEnter={peekCtl.stay} onMouseLeave={peekCtl.leave}>
            <Sidebar onOpenView={openView} onOpenNote={openNote} onNewNote={newNote} onClose={peekCtl.close} onToday={openToday} onTemplate={newFromTemplate} onImport={importNote} />
          </div>
        )}
        {sidebarMode === 'full' && <Sidebar onOpenView={openView} onOpenNote={openNote} onNewNote={newNote} onClose={() => setPane('list')} onToday={openToday} onTemplate={newFromTemplate} onImport={importNote} />}
        {sidebarMode === 'full' && !narrow && <Resizer label="Sidebar width" value={sideW} {...SIDEBAR} cssVar="--side-w" target={target} onChange={(v) => store.updateLayout({ sidebarWidth: Math.round(v) })} />}
        {sidebarMode === 'icons' && <SidebarRail onOpenView={openView} onNewNote={newNote} onToday={openToday} />}
        <div className="workspace">
          <TopBar onMenu={() => setPane('sidebar')} onNewNote={newNote} />
          <div className="panes">
            {peekable && !showList && sidebarMode !== 'hidden' && <div className="peek-edge" aria-hidden="true" onMouseEnter={() => peekCtl.open('list')} onMouseLeave={peekCtl.leave} />}
            {peekable && !showList && peek === 'list' && (
              <div className="peek-panel list-peek" onMouseEnter={peekCtl.stay} onMouseLeave={peekCtl.leave}>
                {project ? <ProjectOutline project={project} onOpenChapter={openChapter} /> : <NoteList onOpenNote={openNote} onNewNote={newNote} onOpenView={openView} />}
              </div>
            )}
            {project ? (
              <>
                {showList && <ProjectOutline project={project} onOpenChapter={openChapter} />}
                {showList && !narrow && <Resizer label="Outline width" value={listW} {...LIST} cssVar="--list-w" target={target} onChange={(v) => store.updateLayout({ listWidth: Math.round(v) })} />}
              </>
            ) : (
              <>
                {showList && <NoteList onOpenNote={openNote} onNewNote={newNote} onOpenView={openView} />}
                {showList && !narrow && <Resizer label="Note list width" value={listW} {...LIST} cssVar="--list-w" target={target} onChange={(v) => store.updateLayout({ listWidth: Math.round(v) })} />}
              </>
            )}
            {/* Phones show one thing at a time; bigger screens, panes of tabs. */}
            {narrow ? (
              project ? <ProjectPane project={project} narrow={narrow} onBack={() => setPane('list')} /> : <NotePane onBack={() => setPane('list')} narrow={narrow} onNewNote={newNote} onNewProject={newProject} />
            ) : (
              <PaneArea narrow={narrow} onBack={() => setPane('list')} onNewNote={newNote} onNewProject={newProject} />
            )}
          </div>
        </div>
        {!narrow && showRight && <Resizer label="Right sidebar width" reverse value={rightW} {...RIGHT} cssVar="--right-w" target={target} onChange={(v) => store.updateLayout({ rightWidth: Math.round(v) })} />}
        {!narrow && showRight && <RightSidebar />}
        {peekable && !showRight && <div className="peek-edge right" aria-hidden="true" onMouseEnter={() => peekCtl.open('right')} onMouseLeave={peekCtl.leave} />}
        {peekable && !showRight && peek === 'right' && (
          <div className="peek-panel right-peek" onMouseEnter={peekCtl.stay} onMouseLeave={peekCtl.leave}>
            <RightSidebar />
          </div>
        )}
      </div>
      </PeekContext.Provider>
      {narrow && pane === 'list' && !state.focusMode && <TabBar onOpenView={openView} onNotebooks={() => setPane('sidebar')} onNewNote={newNote} onToday={openToday} />}
    </div>
    </PanesContext.Provider>
    </NavContext.Provider>
  );
}
