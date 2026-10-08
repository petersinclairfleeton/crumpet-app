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
import { LIST, Resizer, SIDEBAR, SidebarRail, TabBar } from './layout';
import { applyTheme } from './theme';
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
      const s = store.getState();
      // With two notes open, a note opens on the side last worked in.
      if (!window.matchMedia(NARROW).matches && (s.settings.layout?.split ?? 'one') !== 'one' && s.activeSide === 'second') store.openSecond(id);
      else store.select(id);
      setPane('note');
    },
    [store],
  );

  const openChapter = useCallback(
    (id: string) => {
      store.selectChapter(id);
      setPane('note');
    },
    [store],
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

  // Ctrl+\ (⌘\ on a Mac): show or hide the sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        const now = store.getState().settings.layout?.sidebar ?? 'full';
        store.updateLayout({ sidebar: now === 'hidden' ? 'full' : 'hidden' });
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

  // A search shows matching notes, even from inside a project.
  const project = state.view.kind === 'project' && !state.query.trim() ? store.project(state.view.id) : undefined;

  const appRef = useRef<HTMLDivElement>(null);
  if (!state.ready) return <div className="loading">Opening your notes…</div>;

  // On phones one pane shows at a time, so the layout choices are for bigger screens.
  const layout = narrow ? {} : (state.settings.layout ?? {});
  const sidebarMode = layout.sidebar ?? (!narrow && window.matchMedia(MEDIUM).matches ? 'icons' : 'full');
  const showList = layout.list !== false;
  const split = project ? 'one' : (layout.split ?? 'one');
  const sideW = layout.sidebarWidth ?? SIDEBAR.normal;
  const listW = layout.listWidth ?? LIST.normal;
  const ratio = layout.splitRatio ?? 0.5;
  const sizes = narrow ? undefined : ({ '--side-w': layout.sidebarWidth ? `${sideW}px` : undefined, '--list-w': layout.listWidth ? `${listW}px` : undefined, '--split': ratio } as React.CSSProperties);
  const target = () => appRef.current;
  const newProject = () => openView({ kind: 'project', id: store.createProject('Untitled project').id });

  return (
    <NavContext.Provider value={nav}>
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
      <div className="frame">
        {sidebarMode === 'full' && <Sidebar onOpenView={openView} onOpenNote={openNote} onNewNote={newNote} onClose={() => setPane('list')} onToday={openToday} onTemplate={newFromTemplate} onImport={importNote} />}
        {sidebarMode === 'full' && !narrow && <Resizer label="Sidebar width" value={sideW} {...SIDEBAR} cssVar="--side-w" target={target} onChange={(v) => store.updateLayout({ sidebarWidth: Math.round(v) })} />}
        {sidebarMode === 'icons' && <SidebarRail onOpenView={openView} onNewNote={newNote} onToday={openToday} />}
        <div className="workspace">
          <TopBar onMenu={() => setPane('sidebar')} onNewNote={newNote} />
          <div className="panes">
            {project ? (
              <>
                {showList && <ProjectOutline project={project} onOpenChapter={openChapter} />}
                {showList && !narrow && <Resizer label="Outline width" value={listW} {...LIST} cssVar="--list-w" target={target} onChange={(v) => store.updateLayout({ listWidth: Math.round(v) })} />}
                <ProjectPane project={project} narrow={narrow} onBack={() => setPane('list')} />
              </>
            ) : (
              <>
                {showList && <NoteList onOpenNote={openNote} onNewNote={newNote} onOpenView={openView} />}
                {showList && !narrow && <Resizer label="Note list width" value={listW} {...LIST} cssVar="--list-w" target={target} onChange={(v) => store.updateLayout({ listWidth: Math.round(v) })} />}
                {split === 'one' ? (
                  <NotePane onBack={() => setPane('list')} narrow={narrow} onNewNote={newNote} onNewProject={newProject} />
                ) : (
                  <div className={`notes-split ${split}`}>
                    <NotePane side="first" noteId={state.selectedId} onBack={() => setPane('list')} narrow={narrow} onNewNote={newNote} onNewProject={newProject} />
                    <Resizer
                      label={split === 'side' ? 'Width of the two notes' : 'Height of the two notes'}
                      vertical={split === 'stacked'}
                      value={ratio}
                      min={0.2}
                      max={0.8}
                      normal={0.5}
                      scale={split === 'side' ? (appRef.current?.querySelector('.notes-split')?.clientWidth ?? 1000) : (appRef.current?.querySelector('.notes-split')?.clientHeight ?? 700)}
                      cssVar="--split"
                      target={target}
                      onChange={(v) => store.updateLayout({ splitRatio: Math.round(v * 100) / 100 })}
                    />
                    <NotePane side="second" noteId={state.secondId} onBack={() => setPane('list')} narrow={narrow} onNewNote={newNote} onNewProject={newProject} onCloseSide={() => store.updateLayout({ split: 'one' })} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {narrow && pane === 'list' && !state.focusMode && <TabBar onOpenView={openView} onNotebooks={() => setPane('sidebar')} onNewNote={newNote} onToday={openToday} />}
    </div>
    </NavContext.Provider>
  );
}
