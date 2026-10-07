import { useCallback, useEffect, useState } from 'react';
import { useAppState, useAppStore } from './hooks';
import { Sidebar } from './Sidebar';
import { NoteList } from './NoteList';
import { NotePane } from './NotePane';
import { ProjectOutline, ProjectPane } from './Project';
import { TopBar } from './TopBar';
import { applyTheme } from './theme';
import type { View } from '../data/types';

/** On narrow screens only one pane shows at a time. */
export type Pane = 'sidebar' | 'list' | 'note';

const NARROW = '(max-width: 759px)';

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

  const openView = useCallback(
    (view: View) => {
      store.setView(view);
      setPane('list');
    },
    [store],
  );

  const openNote = useCallback(
    (id: string) => {
      store.select(id);
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

  const newNote = useCallback(() => {
    store.createNote();
    setPane('note');
    // The title field focuses itself when a new, empty note opens.
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

  if (!state.ready) return <div className="loading">Opening your notes…</div>;

  return (
    <div className={`app${narrow ? ' narrow' : ''}`} data-pane={narrow ? pane : undefined}>
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
        <Sidebar onOpenView={openView} onOpenNote={openNote} onNewNote={newNote} onClose={() => setPane('list')} />
        <div className="workspace">
          <TopBar onMenu={() => setPane('sidebar')} onNewNote={newNote} />
          <div className="panes">
            {project ? (
              <>
                <ProjectOutline project={project} onOpenChapter={openChapter} />
                <ProjectPane project={project} narrow={narrow} onBack={() => setPane('list')} />
              </>
            ) : (
              <>
                <NoteList onOpenNote={openNote} onNewNote={newNote} onOpenView={openView} />
                <NotePane onBack={() => setPane('list')} narrow={narrow} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
