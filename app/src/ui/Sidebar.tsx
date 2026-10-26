import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Doc } from '@crumpet/editor/model';
import { useAppState, useAppStore, useMedia, useSync, keep, remember } from './hooks';
import { statusText } from './SyncSettings';
import { SettingsDialog, type SettingsSection } from './Settings';
import { canUseFolder } from '../sync/folder';
import { openReminders } from '../data/reminders';
import { BUILT_IN_CLIENT_ID } from '../sync/connection';
import { allTags, tagTree, type TagNode, displayTitle, noteCounts, notebookTree, projectWords, projectsInOrder, recentNotes, sameView } from '../data/selectors';
import { NOTEBOOK_COLORS, type Notebook, type Stack, type View } from '../data/types';
import { BUILT_IN_TEMPLATES, DAILY_NOTEBOOK, TEMPLATES_NOTEBOOK, longDate } from '../data/templates';
import { toMarkdown } from '@crumpet/editor/markdown';
import { StatsDialog, useTodayWords } from './stats-ui';
import { FoldButton } from './fold';
import { type Folder, type FolderDrop, bothDrops, folderDrag, tabDrag, useFileDrop, useFolderDrop, useNoteDrop } from './tabdrag';
import { chooseUploads, uploadFiles } from './uploads';
import { NoteMenu, type NoteMenuAt, noteMenuAt } from './notemenu';
import type { Tab } from '../data/panes';
import { Bookmarks } from './bookmarks';
import { usePanes } from './panes';
import { boardDoc, emptyBoard } from '../data/board';
import { IconBell, IconBook, IconChart, IconGraph, IconSearch, IconSun, IconChevronDown, IconChevron, IconClose, IconMore, IconNote, IconNotebook, IconPlus, IconStack, IconStar, IconTag, IconTrash, IconUpload, IconInbox, IconCheck, IconCrumpet, IconSettings, IconShare, Logo, NotebookIcon } from './icons';
import { openFinder } from './finder';
import { HelpItems } from './help';
import { openSubmissions } from './submissions';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

interface Props {
  onOpenView(view: View): void;
  onOpenNote(id: string): void;
  onNewNote(): void;
  onClose(): void;
  onToday(): void;
  onTemplate(t: { title: string; body: string }): void;
  /** A Word document opened as a new note. */
  onImport(note: { title: string; doc: Doc }): void;
}

export function Sidebar({ onOpenView, onOpenNote, onNewNote, onClose, onToday, onTemplate, onImport }: Props) {
  const state = useAppState();
  const store = useAppStore();
  const [collapsed, setCollapsed] = useState<string[]>(() => remember('collapsedStacks', []));
  const [tagsOpen, setTagsOpen] = useState<boolean>(() => remember('tagsOpen', false));
  // Recent notes, Writing stats and the Graph fold away under Explore.
  const [moreOpen, setMoreOpen] = useState<boolean>(() => remember('sideMore', false));
  const [creating, setCreating] = useState<null | 'menu' | 'notebook' | 'stack' | 'project'>(null);
  // The calm sidebar folds the notebooks under one row; its menu at the foot holds the rest.
  const [notebooksOpen, setNotebooksOpen] = useState<boolean>(() => remember('notebooksOpen', false));
  const [footMenu, setFootMenu] = useState<null | 'menu' | 'templates'>(null);
  // A link ending in #connect opens straight to connecting Google Drive.
  const [settingsOpen, setSettingsOpen] = useState(() => typeof location !== 'undefined' && location.hash === '#connect');
  // Where Settings opens: where the notes are kept, from the foot's status or a #connect link.
  const [settingsAt, setSettingsAt] = useState<SettingsSection | undefined>(() => (typeof location !== 'undefined' && location.hash === '#connect' ? 'sync' : undefined));
  const { state: sync } = useSync();
  const [statsOpen, setStatsOpen] = useState(false);
  const [menuAt, setMenuAt] = useState<NoteMenuAt | null>(null);
  const todayWords = useTodayWords();
  const panes = usePanes();
  useEffect(() => {
    const onHash = () => location.hash === '#connect' && (setSettingsAt('sync'), setSettingsOpen(true));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const order = state.settings.sideOrder;
  const { loose, stacks } = notebookTree(state.stacks, state.notebooks, order);
  const projects = projectsInOrder(state.projects, order);
  // Notebooks, stacks and projects dropped on their heading go to the top (a notebook out of its stack).
  const notebooksHead = useFolderDrop(
    (f) => (f.kind === 'notebook' || f.kind === 'stack' ? 'into' : null),
    (f) => (f.kind === 'notebook' ? store.moveNotebook(f.id, null, loose.find((n) => n.id !== f.id)?.id ?? null) : store.moveStack(f.id, stacks[0]?.stack.id ?? null)),
  );
  const projectsHead = useFolderDrop(
    (f) => (f.kind === 'project' ? 'into' : null),
    (f) => store.moveProject(f.id, projects[0]?.id ?? null),
  );
  const counts = noteCounts(state.notes);
  const tags = tagTree(state.notes);
  const recent = recentNotes(state.notes);
  const trashCount = state.notes.filter((n) => n.trashedAt !== null).length;
  const allCount = state.notes.filter((n) => n.trashedAt === null && !n.projectId).length;
  const inboxCount = state.notes.filter((n) => n.trashedAt === null && !n.projectId && !n.notebookId).length;
  const favCount = state.notes.filter((n) => n.favorite && n.trashedAt === null).length;
  const tagCount = allTags(state.notes).length;
  const active = (v: View) => !state.query && sameView(state.view, v);
  const nothingYet = !state.notebooks.length && !state.stacks.length;
  const daily = state.notebooks.find((n) => n.name.toLowerCase() === DAILY_NOTEBOOK.toLowerCase());
  const todayOpen = !!daily && !state.query && state.view.kind === 'notebook' && state.view.id === daily.id && store.note(state.selectedId)?.title === longDate();

  // Notes dragged from the list (or Recent Notes) and dropped on the sidebar.
  const live = (ids: string[]) => ids.map((id) => store.note(id)).filter((n) => !!n);
  const toTrash = (ids: string[]) => live(ids).forEach((n) => n.trashedAt === null && store.trashNote(n.id));
  const toFavorites = (ids: string[]) => live(ids).forEach((n) => n.trashedAt === null && !n.favorite && store.toggleFavorite(n.id));
  const toTag = (tag: string) => (ids: string[]) => live(ids).forEach((n) => n.trashedAt === null && store.addTag(n.id, tag));
  // Files from the computer: each becomes a note (in a notebook, or a project's research), and the last one opens.
  const upload = (where: { notebookId?: string | null; projectId?: string }) => async (files: File[]) => {
    const made = await uploadFiles(store, files, where);
    const last = made[made.length - 1];
    if (!last) return;
    if (where.projectId) {
      onOpenView({ kind: 'project', id: where.projectId });
      store.openResearch(last.id);
    } else onOpenNote(last.id);
  };

  // Notes dropped on a project become its research (out of the Trash, if they were in it).
  const toProject = (id: string) => (ids: string[]) =>
    live(ids).forEach((n) => {
      if (n.trashedAt !== null) store.restoreNote(n.id);
      if (n.projectId !== id) store.setResearchProject(n.id, id);
    });

  const toggleStack = (id: string) => {
    const next = collapsed.includes(id) ? collapsed.filter((n) => n !== id) : [...collapsed, id];
    setCollapsed(next);
    keep('collapsedStacks', next);
  };

  // The calm look (Quiet Paper) keeps the sidebar to finding things: Capture, Library, Writing;
  // uploads, templates, the Trash and Explore wait in the menu at its foot.
  // (Phones keep the full sidebar as their Notebooks screen.)
  const narrow = useMedia('(max-width: 759px)');
  // On an iPad (design 14) the list has the search box, and New note sits at the sidebar's foot.
  const touch = useMedia('(pointer: coarse)');
  const calm = !state.settings.toolbarAll && !narrow;
  const projectRows = projects.map((p) => (
    <SideRow
      key={p.id}
      folder={{
        accept: (f) => (f.kind === 'project' && f.id !== p.id ? 'before' : null),
        onDrop: (f) => store.moveProject(f.id, p.id),
      }}
      drop={toProject(p.id)}
      files={upload({ projectId: p.id })}
      icon={<IconBook size={calm ? 18 : 13} />}
      label={p.name}
      count={calm ? undefined : projectWords(p, state.chapters) || undefined}
      countLabel="words"
      active={active({ kind: 'project', id: p.id })}
      onClick={() => onOpenView({ kind: 'project', id: p.id })}
      drag={{ kind: 'project', id: p.id }}
    />
  ));
  const newProject =
    creating === 'project' ? (
      <InlineInput
        label="Project name"
        placeholder="Project name"
        onDone={(name) => {
          setCreating(null);
          if (name) onOpenView({ kind: 'project', id: store.createProject(name).id });
        }}
      />
    ) : null;
  const notebookRows = (
    <>
      {creating === 'menu' && (
        <Popover onClose={() => setCreating(null)} label="Create">
          <button type="button" className="menu-item" onClick={() => setCreating('notebook')}>
            <IconNotebook size={14} /> New notebook
          </button>
          <button type="button" className="menu-item" onClick={() => setCreating('stack')}>
            <IconStack size={14} /> New stack
          </button>
        </Popover>
      )}
      {creating === 'notebook' && (
        <InlineInput
          label="Notebook name"
          placeholder="Notebook name"
          onDone={(name) => {
            setCreating(null);
            if (name) onOpenView({ kind: 'notebook', id: store.createNotebook(name).id });
          }}
        />
      )}
      {creating === 'stack' && (
        <InlineInput
          label="Stack name"
          placeholder="Stack name"
          onDone={(name) => {
            setCreating(null);
            if (name) store.createStack(name);
          }}
        />
      )}
      {nothingYet && !creating && (
        <div className="side-empty">
          <p>Notebooks group your notes; stacks group notebooks.</p>
          <button type="button" className="side-link" onClick={() => setCreating('notebook')}>
            Create a notebook
          </button>
        </div>
      )}
      {loose.map((nb) => (
        <NotebookRow key={nb.id} nb={nb} count={counts.get(nb.id) ?? 0} depth={calm ? 1 : 0} active={active({ kind: 'notebook', id: nb.id })} onOpen={() => onOpenView({ kind: 'notebook', id: nb.id })} />
      ))}
      {stacks.map(({ stack, notebooks }) => (
        <StackGroup key={stack.id} stack={stack} notebooks={notebooks} counts={counts} open={!collapsed.includes(stack.id)} onToggle={() => toggleStack(stack.id)} active={active} onOpenView={onOpenView} />
      ))}
    </>
  );
  const tagsRow = (
    <>
      <button
        type="button"
        className="side-row strong fold-row"
        aria-expanded={tagsOpen}
        onClick={() => {
          setTagsOpen(!tagsOpen);
          keep('tagsOpen', !tagsOpen);
        }}
      >
        {calm ? <IconChevron size={18} className={tagsOpen ? 'rot90' : ''} /> : <IconTag size={13} />}
        <span className="grow">Tags</span>
        {calm ? tagCount > 0 && <span className="count">{tagCount}</span> : <IconChevron size={10} className={tagsOpen ? 'rot90' : ''} />}
      </button>
      {tagsOpen && (
        <div className="tag-list">
          {tags.length === 0 && <p className="side-empty indent">Tags you add to notes show up here.</p>}
          <TagRows nodes={tags} depth={0} active={active} onOpenView={onOpenView} onDropTag={toTag} />
        </div>
      )}
    </>
  );
  const savedSearches = (state.settings.savedSearches ?? []).length > 0 && (
    <>
      <div className="side-heading">
        <span>Saved searches</span>
      </div>
      {state.settings.savedSearches!.map((q) => (
        <div key={q.id} className={`side-row saved-search${state.query.trim() === q.query ? ' active' : ''}`}>
          <button
            type="button"
            className="row-main"
            onClick={() => {
              store.setQuery(q.query);
              if (state.settings.layout?.list === false) store.updateLayout({ list: true });
              onClose();
            }}
          >
            <IconSearch size={13} />
            <span className="ellipsis">{q.name}</span>
          </button>
          <button type="button" className="icon-btn row-more" aria-label={`Forget saved search ${q.name}`} title="Forget this search" onClick={() => store.updateSettings({ savedSearches: state.settings.savedSearches!.filter((x) => x.id !== q.id) })}>
            <IconClose size={11} />
          </button>
        </div>
      ))}
    </>
  );
  const reminders = state.notes.some((n) => n.reminder && n.trashedAt === null) && (
    <SideRow icon={<IconBell size={calm ? 18 : 13} />} label="Reminders" count={openReminders(state.notes) || undefined} active={active({ kind: 'reminders' })} onClick={() => onOpenView({ kind: 'reminders' })} strong />
  );
  const fixSync = sync.config && ((sync.status?.phase === 'error' && sync.status.error?.kind !== 'offline') || !!sync.status?.unseen?.length) && (
    <button type="button" className="link-btn foot-link" onClick={() => (setSettingsAt('sync'), setSettingsOpen(true))}>
      Fix…
    </button>
  );

  // A first visit (design 6): nothing to find yet, so just New note and All notes, and a word about the rest.
  const fresh = !state.notes.length && !state.notebooks.length && !state.stacks.length && !state.projects.length && !sync.config;
  if (calm)
    return (
      <nav className={`sidebar calm${fresh ? ' fresh' : ''}`} aria-label="Notebooks">
        <div className="side-top">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true">
              <IconCrumpet size={16} />
            </span>
            Crumpet
          </span>
          <FoldButton what="sidebar" />
          <button type="button" className="icon-btn close-side" aria-label="Close menu" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        {settingsOpen && <SettingsDialog section={settingsAt} onClose={() => (setSettingsOpen(false), setSettingsAt(undefined))} />}
        {statsOpen && <StatsDialog onClose={() => setStatsOpen(false)} />}
        {menuAt && <NoteMenu at={menuAt} onClose={() => setMenuAt(null)} />}

        <div className={`side-start${touch ? ' touch' : ''}`}>
          <button type="button" className="new-note" onClick={onNewNote} onContextMenu={(e) => (e.preventDefault(), setFootMenu('templates'))}>
            <IconPlus size={18} />
            New note
          </button>
          {!fresh && !touch && <label className="side-search">
            <IconSearch size={18} />
            <span className="visually-hidden">Search notes</span>
            <input
              id="search"
              type="search"
              autoComplete="off"
              placeholder="Search"
              value={state.query}
              onChange={(e) => store.setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  store.setQuery('');
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            {!state.query && (
              <button type="button" className="find-key" aria-label="Find anything" title="Find anything: notes, chapters and commands" onClick={openFinder}>
                {isMac ? '⌘K' : 'Ctrl K'}
              </button>
            )}
          </label>}
        </div>

        <Bookmarks />

        {fresh ? (
          <section className="side-section" aria-label="Library">
            <h2 className="side-label">Library</h2>
            <SideRow icon={<IconNote size={18} />} label="All notes" active={active({ kind: 'all' })} onClick={() => onOpenView({ kind: 'all' })} strong />
          </section>
        ) : (
        <>
        <section className="side-section" aria-label="Capture">
          <h2 className="side-label">Capture</h2>
          <SideRow icon={<IconInbox size={18} />} label="Inbox" count={inboxCount || undefined} active={active({ kind: 'inbox' })} onClick={() => onOpenView({ kind: 'inbox' })} strong files={upload({ notebookId: null })} />
          <SideRow icon={<IconSun size={18} />} label="Today" active={todayOpen} onClick={onToday} strong />
          {reminders}
        </section>

        <section className="side-section" aria-label="Library">
          <h2 className="side-label">Library</h2>
          <SideRow icon={<IconNote size={18} />} label="All notes" count={allCount} active={active({ kind: 'all' })} onClick={() => onOpenView({ kind: 'all' })} strong files={upload({ notebookId: null })} />
          <SideRow icon={<IconStar size={18} />} label="Favourites" count={favCount || undefined} active={active({ kind: 'favorites' })} onClick={() => onOpenView({ kind: 'favorites' })} strong drop={toFavorites} />
          <div className={`side-row strong fold-row${notebooksHead.over ? ' drop-over' : ''}`} {...notebooksHead.props}>
            <button
              type="button"
              className="row-main"
              aria-expanded={notebooksOpen}
              onClick={() => {
                setNotebooksOpen(!notebooksOpen);
                keep('notebooksOpen', !notebooksOpen);
              }}
            >
              <IconChevron size={18} className={notebooksOpen ? 'rot90' : ''} />
              <span className="grow">Notebooks</span>
            </button>
            {state.notebooks.length > 0 && <span className="count">{state.notebooks.length}</span>}
            <button type="button" className="icon-btn row-more" aria-label="New notebook or stack" title="New notebook or stack" aria-expanded={creating === 'menu'} onClick={() => (setNotebooksOpen(true), setCreating(creating ? null : 'menu'))}>
              <IconPlus size={14} />
            </button>
          </div>
          {notebooksOpen && <div className="side-folded">{notebookRows}</div>}
          {tagsRow}
          {savedSearches}
        </section>

        <section className="side-section" aria-label="Writing">
          <div className={`side-heading${projectsHead.over ? ' drop-over' : ''}`} {...projectsHead.props}>
            <h2 className="side-label">Writing</h2>
            <button type="button" className="icon-btn" aria-label="New project" title="New project" onClick={() => setCreating(creating === 'project' ? null : 'project')}>
              <IconPlus size={14} />
            </button>
          </div>
          {newProject}
          {state.projects.length === 0 && creating !== 'project' && (
            <button type="button" className="side-row strong quiet-row" onClick={() => setCreating('project')}>
              <IconBook size={18} />
              <span className="grow">Start a book</span>
            </button>
          )}
          {projectRows}
        </section>
        </>
        )}

        <div className="side-foot">
          {/* Where the notes are kept; clicking it opens Settings to keep them in Google Drive or a folder. */}
          {fresh ? <p className="side-hint">Notebooks, tags and projects appear here once you make them.</p> : <button type="button" className="foot-status" title={sync.config ? 'Where your notes are kept' : 'Keep your notes in Google Drive or a folder'} onClick={() => (setSettingsAt('sync'), setSettingsOpen(true))}>
            <IconCheck size={16} className="saved-tick" />
            <span aria-live="polite">{calmFootText(state.temporary, sync)}</span>
          </button>}
          {fixSync}
          <SideMenu
            open={footMenu}
            onOpen={setFootMenu}
            trashCount={trashCount}
            todayWords={todayWords}
            onSettings={() => setSettingsOpen(true)}
            onStats={() => setStatsOpen(true)}
            onGraph={() => panes.open({ kind: 'graph', id: 'graph' }, 'tab')}
            onTrash={() => onOpenView({ kind: 'trash' })}
            onUpload={() => chooseUploads(upload({}))}
            onTemplate={onTemplate}
            onImport={onImport}
          />
        </div>
      </nav>
    );

  return (
    <nav className="sidebar" aria-label="Notebooks">
      <div className="side-top">
        <button type="button" className="account" onClick={() => setSettingsOpen((o) => !o)} aria-expanded={settingsOpen}>
          <span className="avatar">{initials(state.settings.name)}</span>
          <span className="account-name">{state.settings.name || 'Your notes'}</span>
          <IconChevron size={10} className="rot90" />
        </button>
        <FoldButton what="sidebar" />
        <button type="button" className="icon-btn close-side" aria-label="Close menu" onClick={onClose}>
          <IconClose />
        </button>
      </div>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {statsOpen && <StatsDialog onClose={() => setStatsOpen(false)} />}
      {menuAt && <NoteMenu at={menuAt} onClose={() => setMenuAt(null)} />}

      <div className="new-note-row">
        <button type="button" className="new-note" onClick={onNewNote}>
          <span className="plus">
            <IconPlus size={12} />
          </span>
          New note
        </button>
        <button type="button" className="icon-btn upload-btn" aria-label="Upload files" title="Upload files: pictures, PDFs, Word documents and more" onClick={() => chooseUploads(upload({}))}>
          <IconUpload size={14} />
        </button>
        <TemplateMenu onTemplate={onTemplate} onImport={onImport} onUpload={() => chooseUploads(upload({}))} />
      </div>

      <Bookmarks />

      <section className="side-section" aria-label="Library">
        <h2 className="side-label">Library</h2>
        <SideRow icon={<IconInbox size={13} />} label="Inbox" count={inboxCount || undefined} active={active({ kind: 'inbox' })} onClick={() => onOpenView({ kind: 'inbox' })} strong />
        <SideRow icon={<IconNote size={13} />} label="All notes" count={allCount} active={active({ kind: 'all' })} onClick={() => onOpenView({ kind: 'all' })} strong files={upload({ notebookId: null })} />
        <SideRow icon={<IconStar size={13} />} label="Favourites" count={favCount || undefined} active={active({ kind: 'favorites' })} onClick={() => onOpenView({ kind: 'favorites' })} strong drop={toFavorites} />
        <SideRow icon={<IconSun size={13} />} label="Today" active={todayOpen} onClick={onToday} strong />
        {reminders}
        {savedSearches}
      </section>

      <section className="side-section">
        <div className={`side-heading${projectsHead.over ? ' drop-over' : ''}`} {...projectsHead.props}>
          <span>Projects</span>
          <button type="button" className="icon-btn" aria-label="New project" title="New project" onClick={() => setCreating(creating === 'project' ? null : 'project')}>
            <IconPlus size={13} />
          </button>
        </div>
        {newProject}
        {state.projects.length === 0 && creating !== 'project' && (
          <div className="side-empty">
            <p>Books, essays and other long writing, in chapters.</p>
            <button type="button" className="side-link" onClick={() => setCreating('project')}>
              Start a project
            </button>
          </div>
        )}
        {projectRows}

        <div className={`side-heading${notebooksHead.over ? ' drop-over' : ''}`} {...notebooksHead.props}>
          <span>Notebooks</span>
          <button type="button" className="icon-btn" aria-label="New notebook or stack" title="New notebook or stack" aria-expanded={creating === 'menu'} onClick={() => setCreating(creating ? null : 'menu')}>
            <IconPlus size={13} />
          </button>
        </div>
        {notebookRows}
        {tagsRow}
        <SideRow icon={<IconTrash size={13} />} label="Trash" count={trashCount || undefined} active={active({ kind: 'trash' })} onClick={() => onOpenView({ kind: 'trash' })} strong drop={toTrash} />
      </section>

      <section className="side-section side-more">
        <button
          type="button"
          className="side-row strong"
          aria-expanded={moreOpen}
          onClick={() => {
            setMoreOpen(!moreOpen);
            keep('sideMore', !moreOpen);
          }}
        >
          <IconMore size={13} />
          <span className="grow">Explore</span>
          <IconChevron size={10} className={moreOpen ? 'rot90' : ''} />
        </button>
        {moreOpen && (
          <>
            <SideRow icon={<IconChart size={13} />} label="Writing stats" count={todayWords || undefined} countLabel="words today" active={false} onClick={() => setStatsOpen(true)} strong />
            <SideRow icon={<IconGraph size={13} />} label="Graph" active={false} onClick={() => panes.open({ kind: 'graph', id: 'graph' }, 'tab')} strong drag={{ kind: 'graph', id: 'graph' }} />
            <SideRow icon={<IconShare size={13} />} label="Submissions" active={false} onClick={() => openSubmissions()} strong />
            {recent.length > 0 && (
              <section className="side-section" aria-label="Recent notes">
                <h2 className="side-label">Recent notes</h2>
                {recent.map((n) => (
                  <button key={n.id} type="button" className="side-row recent" onClick={() => onOpenNote(n.id)} onContextMenu={(e) => setMenuAt(noteMenuAt(e, [n.id]))} {...tabDrag({ kind: 'note', id: n.id })}>
                    <IconNote size={12} />
                    <span className="ellipsis">{displayTitle(n)}</span>
                  </button>
                ))}
              </section>
            )}
          </>
        )}
      </section>

      <div className="side-foot">
        <Logo size={16} />
        <span role="status">{footText(state.temporary, sync)}</span>
        {!state.temporary && !sync.config && (BUILT_IN_CLIENT_ID || canUseFolder) && (
          <button type="button" className="link-btn foot-link" onClick={() => setSettingsOpen(true)}>
            {BUILT_IN_CLIENT_ID ? 'Connect Google Drive' : 'Save to a folder'}
          </button>
        )}
        {fixSync}
      </div>
    </nav>
  );
}

/** The calm sidebar's menu at its foot: Settings, help, and what the sidebar leaves out. */
function SideMenu(props: {
  open: null | 'menu' | 'templates';
  onOpen(m: null | 'menu' | 'templates'): void;
  trashCount: number;
  todayWords: number;
  onSettings(): void;
  onStats(): void;
  onGraph(): void;
  onTrash(): void;
  onUpload(): void;
  onTemplate(t: { title: string; body: string }): void;
  onImport(note: { title: string; doc: Doc }): void;
}) {
  const { open, onOpen } = props;
  const button = useRef<HTMLButtonElement>(null);
  // The menu opens up from the button, over everything (the frosted sidebar would clip it).
  const at = button.current?.getBoundingClientRect();
  const place = at ? { left: Math.max(8, at.left - 8), bottom: window.innerHeight - at.top + 8 } : { left: 16, bottom: 64 };
  const pick = (f: () => void) => () => {
    onOpen(null);
    f();
  };
  return (
    <span className="side-menu">
      <button ref={button} type="button" className="icon-btn" aria-label="Settings and more" title="Settings and more" aria-expanded={!!open} onClick={() => onOpen(open ? null : 'menu')}>
        <IconSettings size={18} />
      </button>
      {open &&
        createPortal(
        <div className="context-menu side-menu-pop" style={{ left: place.left, bottom: place.bottom }}>
        <Popover label={open === 'templates' ? 'New from a template' : 'Settings and more'} onClose={() => onOpen(null)}>
          {open === 'templates' ? (
            <TemplateList onTemplate={pick2(onOpen, props.onTemplate)} onImport={pick2(onOpen, props.onImport)} onUpload={pick(props.onUpload)} />
          ) : (
            <>
              <button type="button" className="menu-item" onClick={pick(props.onSettings)}>
                Settings…
              </button>
              <hr className="menu-sep" />
              <button type="button" className="menu-item" onClick={() => onOpen('templates')}>
                New from a template…
              </button>
              <button type="button" className="menu-item" onClick={pick(props.onUpload)}>
                Upload files…
              </button>
              <hr className="menu-sep" />
              <button type="button" className="menu-item" onClick={pick(props.onStats)}>
                Writing stats {props.todayWords > 0 && <small className="menu-hint">{props.todayWords.toLocaleString()} words today</small>}
              </button>
              <button type="button" className="menu-item" onClick={pick(props.onGraph)}>
                Graph of links
              </button>
              <button type="button" className="menu-item" onClick={pick(() => openSubmissions())}>
                Submissions
              </button>
              <button type="button" className="menu-item" onClick={pick(props.onTrash)}>
                Trash {props.trashCount > 0 && <small className="menu-hint">{props.trashCount}</small>}
              </button>
              <hr className="menu-sep" />
              <HelpItems onPick={() => onOpen(null)} />
            </>
          )}
        </Popover>
        </div>,
          document.body,
        )}
    </span>
  );
}

function pick2<T>(onOpen: (m: null) => void, f: (x: T) => void) {
  return (x: T) => {
    onOpen(null);
    f(x);
  };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '✎';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Tags as a tree: tags nested in another ("book/characters") fold away under it. */
function TagRows({ nodes, depth, active, onOpenView, onDropTag }: { nodes: TagNode[]; depth: number; active(v: View): boolean; onOpenView(v: View): void; onDropTag(tag: string): (ids: string[]) => void }) {
  const [open, setOpen] = useState<string[]>(() => remember('openTags', []));
  const toggle = (path: string) => {
    const next = open.includes(path) ? open.filter((p) => p !== path) : [...open, path];
    setOpen(next);
    keep('openTags', next);
  };
  const rows = (list: TagNode[], level: number): React.ReactNode[] =>
    list.flatMap((t) => {
      const isOpen = open.includes(t.path);
      const view: View = { kind: 'tag', tag: t.path };
      const row = (
        <div key={t.path} className="tag-row" style={{ '--tag-depth': level } as React.CSSProperties}>
          {t.children.length > 0 ? (
            <button type="button" className="tag-fold" aria-label={`${isOpen ? 'Fold away' : 'Show'} tags in #${t.path}`} aria-expanded={isOpen} onClick={() => toggle(t.path)}>
              <IconChevron size={9} className={isOpen ? 'rot90' : ''} />
            </button>
          ) : (
            <span className="tag-fold" />
          )}
          <SideRow label={`#${t.name}`} count={t.count} active={active(view)} onClick={() => onOpenView(view)} drop={onDropTag(t.path)} />
        </div>
      );
      return isOpen ? [row, ...rows(t.children, level + 1)] : [row];
    });
  return <>{rows(nodes, depth)}</>;
}

function SideRow(props: { icon?: React.ReactNode; label: string; count?: number; countLabel?: string; active: boolean; onClick(): void; strong?: boolean; indent?: boolean; drag?: Tab; drop?(ids: string[]): void; folder?: { accept(f: Folder): FolderDrop | null; onDrop(f: Folder, how: FolderDrop): void }; files?(files: File[]): void }) {
  const drop = useNoteDrop(props.drop);
  const files = useFileDrop(props.files);
  const folder = useFolderDrop(props.folder?.accept ?? (() => null), props.folder?.onDrop ?? (() => {}));
  return (
    <button
      type="button"
      className={`side-row${props.active ? ' active' : ''}${props.strong ? ' strong' : ''}${props.indent ? ' indent' : ''}${drop.over || files.over || folder.over === 'into' ? ' drop-over' : ''}${folder.over === 'before' ? ' drop-before' : ''}`}
      aria-current={props.active ? 'page' : undefined}
      onClick={props.onClick}
      {...(props.drag ? tabDrag(props.drag) : {})}
      {...bothDrops(files.props, folder.props, drop.props)}
    >
      {props.icon}
      <span className="grow ellipsis">{props.label}</span>
      {props.count !== undefined && (
        <span className="count" title={props.countLabel ? `${props.count.toLocaleString()} ${props.countLabel}` : undefined}>
          {props.countLabel ? `${compact(props.count)} ${props.countLabel.split(' ')[0]}` : props.count}
        </span>
      )}
    </button>
  );
}

function StackGroup({
  stack,
  notebooks,
  counts,
  open,
  onToggle,
  active,
  onOpenView,
}: {
  stack: Stack;
  notebooks: Notebook[];
  counts: Map<string, number>;
  open: boolean;
  onToggle(): void;
  active(v: View): boolean;
  onOpenView(v: View): void;
}) {
  const store = useAppStore();
  const [menu, setMenu] = useState<null | 'menu' | 'rename' | 'add' | 'delete'>(null);
  const [adding, setAdding] = useState(false);
  const close = () => setMenu(null);
  // A notebook dropped here goes into the stack (at the end); a stack, just above this one.
  const drop = useFolderDrop(
    (f) => (f.kind === 'notebook' ? 'into' : f.kind === 'stack' && f.id !== stack.id ? 'before' : null),
    (f) => (f.kind === 'notebook' ? store.moveNotebook(f.id, stack.id, null) : store.moveStack(f.id, stack.id)),
  );
  return (
    <div className="stack">
      <div
        className={`side-row stack-row${active({ kind: 'stack', id: stack.id }) ? ' active' : ''}${drop.over === 'into' ? ' drop-over' : ''}${drop.over === 'before' ? ' drop-before' : ''}`}
        {...folderDrag({ kind: 'stack', id: stack.id }, stack.name)}
        {...drop.props}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu('menu');
        }}
      >
        <button type="button" className="disclosure" aria-label={open ? `Collapse ${stack.name}` : `Expand ${stack.name}`} aria-expanded={open} onClick={onToggle}>
          <IconChevron size={10} className={open ? 'rot90' : ''} />
        </button>
        <button type="button" className="row-main" onClick={() => onOpenView({ kind: 'stack', id: stack.id })}>
          <IconStack size={12} />
          <span className="ellipsis">{stack.name}</span>
        </button>
        <button type="button" className="icon-btn row-more" aria-label={`${stack.name} options`} aria-expanded={menu !== null} onClick={() => setMenu(menu ? null : 'menu')}>
          <IconMore size={13} />
        </button>
      </div>
      {menu && (
        <Popover onClose={close} label={`${stack.name} options`}>
          {menu === 'menu' && (
            <>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  close();
                  setAdding(true);
                  if (!open) onToggle();
                }}
              >
                New notebook in this stack…
              </button>
              <button type="button" className="menu-item" onClick={() => setMenu('rename')}>
                Rename stack…
              </button>
              <button type="button" className="menu-item danger" onClick={() => setMenu('delete')}>
                Delete stack…
              </button>
            </>
          )}
          {menu === 'rename' && (
            <InlineInput
              label="New stack name"
              initial={stack.name}
              onDone={(name) => {
                if (name) store.renameStack(stack.id, name);
                close();
              }}
            />
          )}
          {menu === 'delete' && (
            <div className="menu-confirm">
              <p>
                Delete the stack “{stack.name}”?{' '}
                {notebooks.length ? `Its ${notebooks.length} notebook${notebooks.length === 1 ? '' : 's'} and their notes stay; they just won’t be in a stack.` : 'It has no notebooks.'}
              </p>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  store.deleteStack(stack.id);
                  close();
                }}
              >
                Delete stack
              </button>
              <button type="button" className="btn" onClick={close}>
                Cancel
              </button>
            </div>
          )}
        </Popover>
      )}
      {open && (
        <>
          {adding && (
            <div className="stack-input">
              <InlineInput
                label={`New notebook in ${stack.name}`}
                placeholder="Notebook name"
                onDone={(name) => {
                  setAdding(false);
                  if (name) onOpenView({ kind: 'notebook', id: store.createNotebook(name, stack.id).id });
                }}
              />
            </div>
          )}
          {notebooks.map((nb) => (
            <NotebookRow key={nb.id} nb={nb} count={counts.get(nb.id) ?? 0} depth={1} active={active({ kind: 'notebook', id: nb.id })} onOpen={() => onOpenView({ kind: 'notebook', id: nb.id })} />
          ))}
          {!notebooks.length && !adding && (
            <button type="button" className="side-link indent" onClick={() => setAdding(true)}>
              Add a notebook
            </button>
          )}
        </>
      )}
    </div>
  );
}

function NotebookRow({ nb, count, depth, active, onOpen }: { nb: Notebook; count: number; depth: number; active: boolean; onOpen(): void }) {
  const store = useAppStore();
  const state = useAppState();
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState<'menu' | 'rename' | 'stack' | 'newstack' | 'delete'>('menu');
  const close = () => {
    setMenu(false);
    setMode('menu');
  };
  const current = store.stack(nb.stackId);
  // Notes dropped here are filed in this notebook (from the Trash, they come back into it).
  const drop = useNoteDrop((ids) => {
    for (const id of ids) {
      const n = store.note(id);
      if (!n) continue;
      if (n.trashedAt !== null) store.restoreNote(id);
      // Research for a project comes out of it, into this notebook.
      if (store.note(id)?.projectId) store.setResearchProject(id, null, nb.id);
      else if (n.notebookId !== nb.id) store.moveNote(id, nb.id);
    }
  });
  // Another notebook dropped here goes just above this one, in the same stack.
  const place = useFolderDrop(
    (f) => (f.kind === 'notebook' && f.id !== nb.id ? 'before' : null),
    (f) => store.moveNotebook(f.id, nb.stackId && store.stack(nb.stackId) ? nb.stackId : null, nb.id),
  );
  // Files from the computer dropped here become notes in this notebook.
  const files = useFileDrop(async (list) => {
    const made = await uploadFiles(store, list, { notebookId: nb.id });
    if (made.length) {
      onOpen();
      store.select(made[made.length - 1].id);
    }
  });
  return (
    <div className="nb">
      <div className={`side-row nb-row${active ? ' active' : ''}${drop.over || files.over ? ' drop-over' : ''}${place.over ? ' drop-before' : ''}`} style={{ paddingLeft: 8 + depth * 18 }}
        {...folderDrag({ kind: 'notebook', id: nb.id }, nb.name)}
        {...bothDrops(files.props, place.props, drop.props)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMode('menu');
          setMenu(true);
        }}
      >
        <button type="button" className="row-main" aria-current={active ? 'page' : undefined} onClick={onOpen}>
          <NotebookIcon color={nb.color} cut={active ? 'var(--side-sel)' : 'var(--side-bg)'} />
          <span className="ellipsis">{nb.name}</span>
        </button>
        <span className="count">{count}</span>
        <button type="button" className="icon-btn row-more" aria-label={`${nb.name} options`} aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <IconMore size={13} />
        </button>
      </div>
      {menu && (
        <Popover onClose={close} label={`${nb.name} options`}>
          {mode === 'menu' && (
            <>
              <button type="button" className="menu-item" onClick={() => setMode('rename')}>
                Rename…
              </button>
              <button type="button" className="menu-item" onClick={() => setMode('stack')}>
                {current ? 'Move to another stack…' : 'Put in a stack…'}
              </button>
              {current && (
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    store.setStack(nb.id, null);
                    close();
                  }}
                >
                  Take out of “{current.name}”
                </button>
              )}
              <div className="menu-colours" role="group" aria-label="Colour">
                {NOTEBOOK_COLORS.map((c) => (
                  <button key={c} type="button" className={`swatch${c === nb.color ? ' on' : ''}`} style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={c === nb.color} onClick={() => store.setNotebookColor(nb.id, c)} />
                ))}
              </div>
              <button type="button" className="menu-item danger" onClick={() => setMode('delete')}>
                Delete notebook…
              </button>
            </>
          )}
          {mode === 'rename' && (
            <InlineInput
              label="New name"
              initial={nb.name}
              onDone={(name) => {
                if (name) store.renameNotebook(nb.id, name);
                close();
              }}
            />
          )}
          {mode === 'stack' && (
            <>
              {state.stacks
                .filter((s) => s.id !== nb.stackId)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      store.setStack(nb.id, s.id);
                      close();
                    }}
                  >
                    <IconStack size={13} /> {s.name}
                  </button>
                ))}
              <button type="button" className="menu-item" onClick={() => setMode('newstack')}>
                <IconPlus size={13} /> New stack…
              </button>
            </>
          )}
          {mode === 'newstack' && (
            <InlineInput
              label="New stack name"
              placeholder="Stack name"
              onDone={(name) => {
                if (name) store.setStack(nb.id, store.createStack(name).id);
                close();
              }}
            />
          )}
          {mode === 'delete' && (
            <div className="menu-confirm">
              <p>
                Delete “{nb.name}”? {count ? `Its ${count} note${count === 1 ? '' : 's'} will move to the Trash.` : 'It has no notes.'}
              </p>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  store.deleteNotebook(nb.id);
                  close();
                }}
              >
                Delete notebook
              </button>
              <button type="button" className="btn" onClick={close}>
                Cancel
              </button>
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}

export function Popover({ children, onClose, label }: { children: React.ReactNode; onClose(): void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as Element).closest?.('[aria-expanded="true"]')) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div className="popover" ref={ref} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}

/** A text field that finishes on Enter or blur and cancels on Escape. */
export function InlineInput({ label, placeholder, initial = '', list, onDone, finishOnBlur = true }: { label: string; placeholder?: string; initial?: string; list?: string[]; onDone(value: string | null): void; finishOnBlur?: boolean }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const listId = useRef(`list-${Math.random().toString(36).slice(2)}`).current;
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <div className="inline-input">
      <input
        autoFocus
        aria-label={label}
        placeholder={placeholder}
        value={value}
        list={list ? listId : undefined}
        // Renaming: the current name is selected, so typing replaces it.
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(value.trim() || null);
          if (e.key === 'Escape') finish(null);
        }}
        onBlur={() => finishOnBlur && finish(value.trim() || null)}
      />
      {list && (
        <datalist id={listId}>
          {list.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

function footText(temporary: boolean, sync: ReturnType<typeof useSync>['state']): string {
  if (temporary) return 'crumpet · not saving';
  if (!sync.config) return 'crumpet · saved on this device';
  const s = sync.status;
  if (s?.phase === 'syncing' || s?.waiting) return 'Syncing…';
  if (s?.phase === 'error') return s.error?.kind === 'offline' ? 'Offline · saved on this device' : 'Sync needs attention';
  return statusText(s).replace(/\.$/, '').replace(/^Synced/, `${sync.config.kind === 'folder' ? 'Folder' : 'Google Drive'} · synced`);
}

/** The calm sidebar's foot: where the notes are kept, in a few words. */
function calmFootText(temporary: boolean, sync: ReturnType<typeof useSync>['state']): string {
  if (temporary) return 'Not saving in this browser';
  if (!sync.config) return 'Saved on this device';
  return footText(temporary, sync).replace(/^crumpet · /, '');
}

/** 1234 → "1.2k", for word counts in narrow places. */
function compact(n: number): string {
  return n < 1000 ? String(n) : n < 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(n / 1000)}k`;
}

/** New from a template: the ready-made ones, and your own (notes in a "Templates" notebook). */
function TemplateMenu({ onTemplate, onImport, onUpload }: { onTemplate(t: { title: string; body: string }): void; onImport(note: { title: string; doc: Doc }): void; onUpload(): void }) {
  const [open, setOpen] = useState(false);
  const close = <T,>(f: (x: T) => void) => (x: T) => {
    setOpen(false);
    f(x);
  };
  return (
    <span className="template-menu">
      <button type="button" className="icon-btn" aria-label="New from a template" title="New from a template" aria-expanded={open} onClick={() => setOpen(!open)}>
        <IconChevronDown size={13} />
      </button>
      {open && (
        <Popover label="New from a template" onClose={() => setOpen(false)}>
          <TemplateList onTemplate={close(onTemplate)} onImport={close(onImport)} onUpload={() => (setOpen(false), onUpload())} />
        </Popover>
      )}
    </span>
  );
}

function TemplateList({ onTemplate, onImport, onUpload }: { onTemplate(t: { title: string; body: string }): void; onImport(note: { title: string; doc: Doc }): void; onUpload(): void }) {
  const state = useAppState();
  const nb = state.notebooks.find((n) => n.name.toLowerCase() === TEMPLATES_NOTEBOOK.toLowerCase());
  const mine = nb ? state.notes.filter((n) => n.notebookId === nb.id && n.trashedAt === null) : [];
  return (
    <>
      <p className="menu-label">New from a template</p>
      {BUILT_IN_TEMPLATES.map((t) => (
        <button key={t.id} type="button" className="menu-item two-line" onClick={() => onTemplate(t)}>
          <b>{t.name}</b>
          <small>{t.hint}</small>
        </button>
      ))}
      {mine.length > 0 && <p className="menu-label">Yours</p>}
      {mine.map((n) => (
        <button key={n.id} type="button" className="menu-item" onClick={() => onTemplate({ title: n.title, body: toMarkdown(n.doc) })}>
          {n.title || 'Untitled template'}
        </button>
      ))}
      <p className="menu-hint">Make your own: open a note’s ••• menu and choose Save as template.</p>
      <button type="button" className="menu-item" onClick={onUpload}>
        Upload files… <small className="menu-hint">Word, PDF, pictures…</small>
      </button>
      <button type="button" className="menu-item" onClick={() => onImport({ title: '', doc: boardDoc(emptyBoard()) })}>
        New board (cards and arrows)
      </button>
    </>
  );
}
