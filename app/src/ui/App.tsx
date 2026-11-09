import { SimilarHost } from './similar';
import { HomeScreenGuide, useSwipeBack } from './iphone';
import { isMacApp } from '../data/desktop';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Doc } from '@crumpet/editor/model';
import { type Nav, NavContext, useAppState, useAppStore, useMedia } from './hooks';
import { findByTitle } from '../data/links';
import { ClipDialog } from './clipper';
import { Sidebar } from './Sidebar';
import { PhoneLibrary } from './phone';
import { InkEditHost } from './inktools';
import { IconPlus } from './icons';
import { NoteList } from './NoteList';
import { NotePane } from './NotePane';
import { ProjectOutline, ProjectPane } from './Project';
import { TopBar } from './TopBar';
import { LIST, RIGHT, Resizer, SIDEBAR, SidebarRail, TabBar } from './layout';
import { type Peek, PeekContext } from './fold';
import { PaneArea, PanesContext, usePanesState } from './panes';
import { activeTab, groups } from '../data/panes';
import { isBoard } from '../data/board';
import { RightSidebar } from './rightside';
import { type Actions, CommandKeys, Finder, onOpenFinder } from './finder';
import type { SettingsSection } from './Settings';
import { currentHelped } from './helpers';
import { SettingsDialog } from './Settings';
import { Guide, onOpenGuide, shouldOpenGuide } from './guide';
import { Tour } from './Tour';
import { applyTheme } from './theme';
import { startSession } from './writingtab';
import { StatsDialog, useTodayWords } from './stats-ui';
import { type MenuActions, runMenuCommand, useDesktopMenu } from './desktopmenu';
import { SpeechBar } from './speech';
import { CompareDocs } from './comparedocs';
import { useFileIndex } from './fileindex';
import { chooseUploads, uploadFiles, useWordSaving } from './uploads';
import { ReminderAlerts } from './reminders';
import { GoToHost } from './goto';
import { PictureAltHost } from './picture';
import { ReaderHost } from './reader';
import { MacroHost } from './macros';
import { HelpHost, onOpenShortcuts } from './help';
import { SubmissionsHost } from './submissions';
import { SyncScroll } from './viewtools';
import { CombineHost } from './comparedocs';
import { FontDialogHost } from './fontdialog';
import { PasteOptionsHost } from './clipboard';
import { ContextMenuHost } from './contextmenu';
import { SyncNote } from './syncnote';
import { SprintBar } from './sprint';
import type { View } from '../data/types';

/** On narrow screens only one pane shows at a time. */
export type Pane = 'sidebar' | 'list' | 'note';

const NARROW = '(max-width: 759px)';
/** Tablets and small windows: the sidebar starts as a strip of icons. */
const MEDIUM = '(max-width: 1099px)';

export function App() {
  const state = useAppState();
  const store = useAppStore();
  // Phones in the calm look start on the library (design 16), like Apple's Notes.
  const [pane, setPane] = useState<Pane>(() => (window.matchMedia(NARROW).matches && !state.settings.toolbarAll ? 'sidebar' : 'list'));
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  const midWidth = useMedia(MEDIUM);
  const panes = usePanesState();
  useFileIndex();
  useWordSaving();

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => applyTheme(state.settings), [state.settings]);
  // The calm layout on a computer, marked on the page for what sits outside the app (the wash, floating bars).
  const calmLayout = !narrow && !state.settings.toolbarAll;
  const calmPhone = narrow && !state.settings.toolbarAll;
  useEffect(() => {
    document.documentElement.dataset.calm = calmLayout ? '1' : calmPhone ? 'phone' : '';
  }, [calmLayout, calmPhone]);
  // Switching the look on a phone starts again from its first screen: the library, or the list.
  const lastPhone = useRef(calmPhone);
  useEffect(() => {
    if (lastPhone.current === calmPhone) return;
    lastPhone.current = calmPhone;
    setPane(calmPhone ? 'sidebar' : 'list');
  }, [calmPhone]);

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

  // Today: the list of daily notes (makes nothing; the list has New daily note).
  const openToday = useCallback(() => {
    store.openToday();
    setPane('list');
  }, [store]);
  const newDailyNote = useCallback(() => {
    store.newDailyNote();
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
      // New things wait in the Inbox.
      store.showInbox();
      store.createNote({ ...n, notebookId: null });
      setPane('note');
    },
    [store],
  );

  // A new note made while a notebook, tag or Favourites is showing belongs there and the list stays;
  // anywhere else it waits in the Inbox (Inbox shows, unless All notes is).
  const newInboxNote = useCallback(() => {
    store.showInbox();
    store.createNote({ notebookId: null });
  }, [store]);
  const newNote = useCallback(() => {
    const kind = store.getState().view.kind;
    if (kind === 'notebook' || kind === 'tag' || kind === 'favorites') store.createNote();
    else newInboxNote();
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

  // Escape puts a peeking sidebar or list away. (Every other shortcut is ui/shortcuts.tsx's.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPeek(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // N, when not typing: a new note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      // Only when nothing has the focus: a writer typing after clicking a button or a list
      // would otherwise make a note with every n (and the rest of the sentence its title).
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body && el !== document.documentElement) return;
      if (document.querySelector('.dialog')) return;
      e.preventDefault();
      newNote();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newNote]);

  // Focus mode: Escape out (in with its shortcut, ui/shortcuts.tsx).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (store.getState().focusMode && e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.popover, .dialog')) store.setFocusMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  // Find anything (⌘K) and the command palette (⌘P).
  const [finder, setFinder] = useState<null | 'switch' | 'commands' | 'compare'>(null);
  const [compareFrom, setCompareFrom] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAt, setSettingsAt] = useState<SettingsSection | undefined>(undefined);
  useEffect(() => onOpenFinder(() => setFinder('switch')), []);
  useEffect(() => onOpenShortcuts(() => (setSettingsAt('keys'), setSettingsOpen(true))), []);
  // The guide: by itself on a first visit, and from the ? button or the command palette.
  const [guide, setGuide] = useState(false);
  const [touring, setTouring] = useState(false);
  useEffect(() => onOpenGuide(() => setGuide(true)), []);
  useEffect(() => {
    if (state.ready && shouldOpenGuide(store.getState())) setGuide(true);
  }, [state.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // The session target counts from when Crumpet opened.
  const todayAtStart = useTodayWords();
  useEffect(() => {
    if (state.ready) startSession(todayAtStart);
  }, [state.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // A search shows matching notes, even from inside a project.
  const project = state.view.kind === 'project' && !state.query.trim() ? store.project(state.view.id) : undefined;

  const appRef = useRef<HTMLDivElement>(null);
  // Phones: swipe in from the left edge to go back to the list.
  const backToList = useCallback(() => setPane('list'), []);
  useSwipeBack(appRef, narrow && pane === 'note' && !state.focusMode, backToList);
  const peekValue = useMemo(() => ({ peek, ...peekCtl }), [peek, peekCtl]);
  if (!state.ready) return <div className="loading">Opening your notes…</div>;

  // On phones one pane shows at a time, so the layout choices are for bigger screens.
  const layout = narrow ? {} : (state.settings.layout ?? {});
  const chosenSidebar = layout.sidebar ?? (!narrow && window.matchMedia(MEDIUM).matches ? 'icons' : 'full');
  // In a book the notes sidebar steps back to its strip of icons, so the book's outline is the side.
  // A note in page view has the room to itself in the calm look, as Word's pages do: the sidebar
  // steps back to its strip and the list folds away (the edge still peeks it out).
  const pagedNote = !narrow && !state.settings.toolbarAll && !!state.settings.pageView?.notes && state.view.kind !== 'project' && !!state.selectedId;
  // The calm look in a book: the Crumpet sidebar stays as you left it (fold it yourself), and the
  // book's outline takes the list's place beside it.
  const calmBook = !narrow && !state.settings.toolbarAll && state.view.kind === 'project' && !state.query.trim();
  // An iPad held upright, or any window this narrow (design 15): the chapter has the window; the
  // outline comes out beside it from the chapter's sidebar button, and the inspector is a drawer.
  const compactBook = calmBook && midWidth;
  // The calm look gives some things the whole window (designs 19, 20 and 22): the graph keeps only the
  // slim strip; a board and a note in page view have it all (their own back buttons return).
  const single = groups(panes.ws).length === 1;
  const tabNow = activeTab(panes.ws);
  const noteNow = tabNow?.kind === 'note' ? state.notes.find((n) => n.id === tabNow.id) : undefined;
  const calmWide = !narrow && !state.settings.toolbarAll && single && !state.focusMode;
  const whole = !calmWide ? null : tabNow?.kind === 'graph' ? 'graph' : noteNow && isBoard(noteNow) ? 'board' : pagedNote ? 'page' : null;
  const sidebarMode = whole === 'graph' ? 'icons' : whole ? 'none' : compactBook ? 'none' : calmBook ? chosenSidebar : chosenSidebar === 'full' && !narrow && ((state.view.kind === 'project' && layout.bookSidebar !== 'full') || pagedNote) ? 'icons' : chosenSidebar;
  // Before the first note there's nothing to list: the welcome has the room.
  const noNotesYet = !narrow && !state.settings.toolbarAll && state.notes.length === 0 && state.view.kind === 'all' && !state.query;
  const showList = (compactBook ? layout.list === true : layout.list !== false) && !pagedNote && !noNotesYet && !whole;
  const showRight = !!layout.right && !state.focusMode;
  const rightW = layout.rightWidth ?? RIGHT.normal;
  const sideW = layout.sidebarWidth ?? SIDEBAR.normal;
  const listW = layout.listWidth ?? LIST.normal;
  const sizes = narrow ? undefined : ({ '--side-w': layout.sidebarWidth ? `${sideW}px` : undefined, '--list-w': layout.listWidth ? `${listW}px` : undefined, '--right-w': layout.rightWidth ? `${rightW}px` : undefined} as React.CSSProperties);
  const target = () => appRef.current;
  const peekable = !narrow && !state.focusMode;
  const phoneCalm = narrow && !state.settings.toolbarAll;
  // Crumpet's calm look on a computer: the sidebar, the list and the page, as separate sheets over the wash.
  const calm = !narrow && !state.settings.toolbarAll;
  const newProject = () => openView({ kind: 'project', id: store.createProject('Untitled book').id });
  // The Mac and Windows apps' menu bar.
  const [statsOpen, setStatsOpen] = useState(false);
  const menuActions: MenuActions = {
    newNote,
    newDailyNote,
    newProject,
    openToday,
    openSettings: () => setSettingsOpen(true),
    openCommands: () => setFinder('commands'),
    openStats: () => setStatsOpen(true),
    upload: () =>
      chooseUploads(async (files) => {
        const made = await uploadFiles(store, files, { notebookId: null });
        if (made.length) (store.showInbox(), openNote(made[made.length - 1].id));
      }),
    store,
  };
  useDesktopMenu(menuActions);
  // What the command palette and the keyboard shortcuts do.
  const actions: Actions = {
    newNote,
    newProject,
    openToday,
    newDailyNote,
    openSettings: (section) => (setSettingsAt(section), setSettingsOpen(true)),
    openView,
    make: (what) => runMenuCommand(what, menuActions),
    openFinder: (mode) => {
      // Remember the selected text, for commands that act on it once the window closes.
      currentHelped()?.editor.currentSelection();
      setFinder(mode);
    },
    compareFrom: (id) => {
      setCompareFrom(id);
      setTimeout(() => setFinder('compare'));
    },
    compare: (a, b) => setCompare({ a, b }),
  };

  return (
    <NavContext.Provider value={nav}>
    <PanesContext.Provider value={panes}>
    <div ref={appRef} className={`app${narrow ? ' narrow' : ''}${calm ? ' calm' : ''}${narrow && !state.settings.toolbarAll ? ' phone' : ''}${compactBook ? ' compact-book' : ''}${compactBook && showRight ? ' drawer-open' : ''}${state.focusMode ? ' focus-mode' : ''}`} data-pane={narrow ? (state.focusMode ? 'note' : pane) : undefined} style={sizes}>
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
          actions={actions}
          onClose={() => setFinder(null)}
        />
      )}
      {compare && <CompareDocs a={compare.a} b={compare.b} onSwap={() => setCompare({ a: compare.b, b: compare.a })} onClose={() => setCompare(null)} />}
      {settingsOpen && <SettingsDialog section={settingsAt} onClose={() => (setSettingsOpen(false), setSettingsAt(undefined))} />}
      <CommandKeys actions={actions} />
      {statsOpen && <StatsDialog onClose={() => setStatsOpen(false)} />}
      {guide && <Guide onClose={() => setGuide(false)} onNewNote={newNote} onNewProject={newProject} onConnect={() => setSettingsOpen(true)} onTour={() => setTouring(true)} />}
      {touring && <Tour onDone={() => setTouring(false)} />}
      <SpeechBar />
      <SprintBar />
      <ReminderAlerts onOpen={openNote} />
      <GoToHost />
      <PictureAltHost />
      <ReaderHost />
      <MacroHost />
      <HelpHost />
      <SubmissionsHost />
      <SyncScroll />
      <CombineHost />
      <FontDialogHost />
      <PasteOptionsHost />
      <SyncNote hidden={sidebarMode === 'full' && !narrow && !state.focusMode} />
      <ContextMenuHost actions={{ newNote, openFinder: () => setFinder('switch'), openCommands: () => setFinder('commands'), openSettings: () => setSettingsOpen(true) }} />
      <SimilarHost />
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
      {isMacApp && <div className="titlebar-drag" aria-hidden="true" />}
      <div className="frame">
        {peekable && sidebarMode === 'hidden' && <div className="peek-edge" aria-hidden="true" onMouseEnter={() => peekCtl.open('sidebar')} onMouseLeave={peekCtl.leave} />}
        {peekable && peek === 'sidebar' && sidebarMode === 'hidden' && (
          <div className="peek-panel sidebar-peek" onMouseEnter={peekCtl.stay} onMouseLeave={peekCtl.leave}>
            <Sidebar onOpenView={openView} onOpenNote={openNote} onNewNote={newNote} onClose={peekCtl.close} onToday={openToday} onNewDaily={newDailyNote} onTemplate={newFromTemplate} onImport={importNote} />
          </div>
        )}
        {sidebarMode === 'full' && (phoneCalm ? <PhoneLibrary onOpenView={openView} onToday={openToday} /> : <Sidebar onOpenView={openView} onOpenNote={openNote} onNewNote={newNote} onClose={() => setPane('list')} onToday={openToday} onNewDaily={newDailyNote} onTemplate={newFromTemplate} onImport={importNote} />)}
        {sidebarMode === 'full' && !narrow && <Resizer label="Sidebar width" value={sideW} {...SIDEBAR} cssVar="--side-w" target={target} onChange={(v) => store.updateLayout({ sidebarWidth: Math.round(v) })} />}
        {sidebarMode === 'icons' && <SidebarRail onOpenView={openView} onNewNote={newNote} onToday={openToday} />}
        <div className="workspace">
          {!phoneCalm && <TopBar onMenu={() => setPane('sidebar')} onNewNote={newNote} calm={calm} />}
          <div className="panes">
            {peekable && !showList && !whole && sidebarMode !== 'hidden' && <div className="peek-edge" aria-hidden="true" onMouseEnter={() => peekCtl.open('list')} onMouseLeave={peekCtl.leave} />}
            {peekable && !showList && peek === 'list' && (
              <div className="peek-panel list-peek" onMouseEnter={peekCtl.stay} onMouseLeave={peekCtl.leave}>
                {project ? <ProjectOutline project={project} onOpenChapter={openChapter} onBack={() => setPane('sidebar')} /> : <NoteList onOpenNote={openNote} onNewNote={newNote} onOpenView={openView} />}
              </div>
            )}
            {project ? (
              <>
                {showList && <ProjectOutline project={project} onOpenChapter={openChapter} onBack={() => setPane('sidebar')} />}
                {showList && !narrow && <Resizer label="Outline width" value={listW} {...LIST} cssVar="--list-w" target={target} onChange={(v) => store.updateLayout({ listWidth: Math.round(v) })} />}
              </>
            ) : (
              <>
                {showList && <NoteList onOpenNote={openNote} onNewNote={newNote} onOpenView={openView} onBack={() => setPane('sidebar')} />}
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
      <InkEditHost />
      {narrow && (pane === 'list' || (phoneCalm && pane === 'sidebar')) && !state.focusMode && <HomeScreenGuide />}
      {narrow && pane === 'list' && !state.focusMode && !phoneCalm && <TabBar onOpenView={openView} onNotebooks={() => setPane('sidebar')} onNewNote={newNote} onToday={openToday} />}
      {/* The calm phone: no bar of tabs, just the round + on the library and on a list (or a book's chapters). */}
      {/* Out of the way of the results while searching. */}
      {/* (A book's is the outline's own, which knows which of its tabs is open.) */}
      {/* The library's makes a quick note in Inbox, whichever list was open last. */}
      {phoneCalm && !state.focusMode && (pane === 'sidebar' || (pane === 'list' && !state.query && !project)) && (
        <button type="button" className={`fab${pane === 'sidebar' ? ' on-library' : ''}`} aria-label="New note" onClick={pane === 'sidebar' ? () => (newInboxNote(), setPane('note')) : newNote}>
          <IconPlus size={26} />
        </button>
      )}
    </div>
    </PanesContext.Provider>
    </NavContext.Provider>
  );
}
