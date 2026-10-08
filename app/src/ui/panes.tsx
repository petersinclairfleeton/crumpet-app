// The writing area as panes of tabs, like Obsidian's. Notes, projects,
// chapters, research and character cards open in tabs; dragging one (from the
// list, the sidebar, a project's outline, or another tab) to the edge of a pane
// splits it, and dropping it in the middle or on the tab bar adds a tab.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type Group, type PaneNode, type Side, type Tab, type Workspace, activeGroup, activeTab, closeOthers, closeTab, closeWhere, drop, emptyWorkspace, findGroup, focusGroup, focusTab, groups, open, resize, sameTab, shownTabs, split, tidyWorkspace } from '../data/panes';
import type { AppState } from '../data/store';
import { displayTitle } from '../data/selectors';
import { useAppState, useAppStore } from './hooks';
import { NotePane } from './NotePane';
import { ChapterPane, ProjectPane } from './Project';
import { ResearchPane } from './research';
import { CastPane } from './cast';
import { IconBook, IconClose, IconNote, IconPage, IconPen, IconNotebook } from './icons';
import { Popover } from './Sidebar';
import { dragged, startTabDrag, useDragging } from './tabdrag';

// ---------------------------------------------------------------- the workspace

interface Panes {
  /** Opens something where you're working: in place of the tab showing, or as a new tab. */
  open(tab: Tab, how?: 'replace' | 'tab'): void;
  /** Opens something in a new pane beside the one you're working in. */
  split(tab: Tab, side: 'right' | 'bottom'): void;
}
export type Ctl = Panes & { ws: Workspace; current(): Workspace; update(fn: (w: Workspace) => Workspace): void };
export const PanesContext = createContext<Panes>({ open() {}, split() {} });
export function usePanes(): Panes {
  return useContext(PanesContext);
}

/** The saved workspace, or one showing the note that's selected. */
function useWorkspace(): [Workspace, (ws: Workspace) => void] {
  const state = useAppState();
  const store = useAppStore();
  const saved = state.settings.layout?.panes;
  const ws = useMemo(() => tidyWorkspace(saved) ?? emptyWorkspace(state.selectedId ? { kind: 'note', id: state.selectedId } : undefined), [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((next: Workspace) => store.updateLayout({ panes: next }), [store]);
  return [ws, set];
}

/** Is what a tab shows still there? */
function exists(state: AppState, t: Tab): boolean {
  switch (t.kind) {
    case 'note':
    case 'research':
      return state.notes.some((n) => n.id === t.id);
    case 'project':
      return state.projects.some((p) => p.id === t.id);
    case 'chapter':
      return state.chapters.some((c) => c.id === t.id);
    case 'cast':
      return !!state.projects.find((p) => p.id === t.project)?.cast?.some((m) => m.id === t.id);
  }
}

export function tabTitle(state: AppState, t: Tab): string {
  switch (t.kind) {
    case 'note':
    case 'research': {
      const n = state.notes.find((x) => x.id === t.id);
      return n ? displayTitle(n) : 'Gone';
    }
    case 'project':
      return state.projects.find((p) => p.id === t.id)?.name || 'Untitled project';
    case 'chapter':
      return state.chapters.find((c) => c.id === t.id)?.title.trim() || 'Untitled chapter';
    case 'cast':
      return state.projects.find((p) => p.id === t.project)?.cast?.find((m) => m.id === t.id)?.name || 'Card';
  }
}

function TabIcon({ tab }: { tab: Tab }) {
  if (tab.kind === 'project') return <IconBook size={13} />;
  if (tab.kind === 'chapter') return <IconPage size={13} />;
  if (tab.kind === 'research') return <IconNotebook size={13} />;
  if (tab.kind === 'cast') return <IconPen size={13} />;
  return <IconNote size={13} />;
}

interface Props {
  narrow: boolean;
  onBack(): void;
  onNewNote(): void;
  onNewProject(): void;
  children?: React.ReactNode;
}

/** The panes, kept in step with what's selected elsewhere (the note list, a project's outline). Give it to `PanesContext`. */
export function usePanesState(): Ctl {
  const state = useAppState();
  const store = useAppStore();
  const [ws, setWs] = useWorkspace();
  const latest = useRef(ws);
  latest.current = ws;
  const update = useCallback((fn: (w: Workspace) => Workspace) => {
    const next = fn(latest.current);
    if (next !== latest.current) {
      latest.current = next;
      setWs(next);
    }
  }, [setWs]);

  // A note selected anywhere (the list, a link, a new note) shows where you're working, or in the pane already showing it.
  // (Not when the app opens: the panes are as you left them.)
  const projectId = state.view.kind === 'project' ? state.view.id : null;
  const seen = useRef({ note: state.selectedId, project: projectId, chapter: state.chapterId });
  useEffect(() => {
    // An empty workspace (the first time) shows what's selected.
    update((w) => (activeTab(w) ? w : projectId ? open(w, { kind: 'project', id: projectId }) : state.selectedId ? open(w, { kind: 'note', id: state.selectedId }) : w));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = state.selectedId;
    if (id === seen.current.note) return;
    seen.current.note = id;
    if (!id) return;
    update((w) => {
      const tab: Tab = { kind: 'note', id };
      if (sameTab(activeTab(w), tab)) return w;
      const showing = groups(w).find((g) => sameTab(g.tabs[g.active], tab));
      return showing ? focusGroup(w, showing.id) : open(w, tab);
    });
  }, [state.selectedId, update]);

  // Opening a project (or one of its chapters) shows its writing.
  useEffect(() => {
    if (projectId === seen.current.project && state.chapterId === seen.current.chapter) return;
    seen.current.project = projectId;
    seen.current.chapter = state.chapterId;
    if (!projectId) return;
    update((w) => {
      const tab: Tab = { kind: 'project', id: projectId };
      if (sameTab(activeTab(w), tab)) return w;
      const showing = groups(w).find((g) => sameTab(g.tabs[g.active], tab));
      return showing ? focusGroup(w, showing.id) : open(w, tab);
    });
  }, [projectId, state.chapterId, update]);

  // Tabs for things deleted for good close.
  const sizes = `${state.notes.length}/${state.projects.length}/${state.chapters.length}`;
  useEffect(() => {
    const s = store.getState();
    update((w) => closeWhere(w, (t) => !exists(s, t)));
  }, [sizes, store, update]);

  const panes = useMemo<Ctl>(
    () => ({
      ws,
      update,
      current: () => latest.current,
      open: (tab, how = 'replace') => {
        update((w) => open(w, tab, how));
        follow(store, tab);
      },
      split: (tab, side) => {
        update((w) => split(w, w.active, side, tab));
        follow(store, tab);
      },
    }),
    [ws, update, store],
  );
  return panes;
}

/** Working in a tab makes it what's selected: its note in the list, its project's outline. */
function follow(store: ReturnType<typeof useAppStore>, tab: Tab | undefined): void {
  if (!tab) return;
  const s = store.getState();
  if (tab.kind === 'note' && s.selectedId !== tab.id) store.select(tab.id);
  if (tab.kind === 'project' && !(s.view.kind === 'project' && s.view.id === tab.id)) store.openProject(tab.id);
}


/** The panes themselves. */
export function PaneArea({ narrow, onBack, onNewNote, onNewProject }: Props) {
  const state = useAppState();
  const ctl = useContext(PanesContext) as Ctl;
  const { ws } = ctl;
  // Focus mode: just the page being written on.
  if (state.focusMode) {
    const g = activeGroup(ws);
    return (
      <div className="pane-area">
        <GroupView group={g} only narrow={narrow} onBack={onBack} onNewNote={onNewNote} onNewProject={onNewProject} />
      </div>
    );
  }
  return (
    <div className="pane-area">
      <NodeView node={ws.root} path={[]} narrow={narrow} onBack={onBack} onNewNote={onNewNote} onNewProject={onNewProject} />
    </div>
  );
}

function NodeView({ node, path, ...rest }: { node: PaneNode; path: number[] } & Props) {
  if (node.kind === 'group') return <GroupView group={node.group} {...rest} />;
  return <SplitView node={node} path={path} {...rest} />;
}

function SplitView({ node, path, ...rest }: { node: Extract<PaneNode, { kind: 'split' }>; path: number[] } & Props) {
  const ctl = useContext(PanesContext) as Ctl;
  const box = useRef<HTMLDivElement>(null);
  const total = node.sizes.reduce((a, b) => a + b, 0) || 1;
  const row = node.dir === 'row';
  const startResize = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    const el = box.current;
    if (!el) return;
    const length = row ? el.clientWidth : el.clientHeight;
    const start = row ? e.clientX : e.clientY;
    const sizes = node.sizes.slice();
    const pair = sizes[i] + sizes[i + 1];
    const cells = Array.from(el.children).filter((c) => c.classList.contains('pane-cell')) as HTMLElement[];
    let latest = sizes;
    const move = (ev: PointerEvent) => {
      const delta = (((row ? ev.clientX : ev.clientY) - start) / length) * total;
      const min = (240 / length) * total;
      const a = Math.min(pair - min, Math.max(min, sizes[i] + delta));
      latest = sizes.slice();
      latest[i] = a;
      latest[i + 1] = pair - a;
      cells[i].style.flexGrow = String(latest[i]);
      cells[i + 1].style.flexGrow = String(latest[i + 1]);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('pane-resizing', row ? 'col-resize' : 'row-resize');
      ctl.update((w) => resize(w, path, latest.map((x) => Math.round((x / total) * 1000) / 1000)));
    };
    document.body.classList.add('pane-resizing', row ? 'col-resize' : 'row-resize');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const nudge = (i: number) => (e: React.KeyboardEvent) => {
    const back = row ? 'ArrowLeft' : 'ArrowUp';
    const forward = row ? 'ArrowRight' : 'ArrowDown';
    if (e.key !== back && e.key !== forward) return;
    e.preventDefault();
    const step = total * 0.05 * (e.key === forward ? 1 : -1);
    const sizes = node.sizes.slice();
    const pair = sizes[i] + sizes[i + 1];
    sizes[i] = Math.min(pair * 0.9, Math.max(pair * 0.1, sizes[i] + step));
    sizes[i + 1] = pair - sizes[i];
    ctl.update((w) => resize(w, path, sizes));
  };
  return (
    <div ref={box} className={`pane-split ${node.dir}`}>
      {node.children.map((child, i) => (
        <PaneCell key={child.kind === 'group' ? child.group.id : `s${i}`} grow={node.sizes[i] ?? 1} last={i === node.children.length - 1} row={row} onResize={startResize(i)} onNudge={nudge(i)}>
          <NodeView node={child} path={[...path, i]} {...rest} />
        </PaneCell>
      ))}
    </div>
  );
}

function PaneCell({ grow, last, row, onResize, onNudge, children }: { grow: number; last: boolean; row: boolean; onResize(e: React.PointerEvent): void; onNudge(e: React.KeyboardEvent): void; children: React.ReactNode }) {
  return (
    <>
      <div className="pane-cell" style={{ flexGrow: grow }}>
        {children}
      </div>
      {!last && <div className={`pane-resizer ${row ? 'row' : 'col'}`} role="separator" aria-orientation={row ? 'vertical' : 'horizontal'} aria-label="Pane size" tabIndex={0} onPointerDown={onResize} onKeyDown={onNudge} />}
    </>
  );
}

function sideAt(e: React.DragEvent, el: HTMLElement): Side {
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  const edge = Math.min(x, 1 - x, y, 1 - y);
  if (edge > 0.25) return 'center';
  if (edge === x) return 'left';
  if (edge === 1 - x) return 'right';
  return edge === y ? 'top' : 'bottom';
}

function GroupView({ group, only = false, narrow, onBack, onNewNote, onNewProject }: { group: Group; only?: boolean } & Props) {
  const state = useAppState();
  const store = useAppStore();
  const ctl = useContext(PanesContext) as Ctl;
  const dragging = useDragging();
  const [zone, setZone] = useState<Side | null>(null);
  const [barAt, setBarAt] = useState<number | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const tab = group.tabs[group.active];
  const active = ctl.ws.active === group.id;
  const many = groups(ctl.ws).length > 1;
  useEffect(() => {
    if (!dragging) {
      setZone(null);
      setBarAt(null);
    }
  }, [dragging]);

  const activate = () => {
    if (ctl.current().active === group.id) return;
    ctl.update((w) => focusGroup(w, group.id));
    follow(store, tab);
  };
  const show = (i: number) => {
    ctl.update((w) => focusTab(w, group.id, i));
    follow(store, group.tabs[i]);
  };
  const close = (i: number) => {
    ctl.update((w) => closeTab(w, group.id, i));
    // Whatever shows next where you're working becomes what's selected.
    setTimeout(() => follow(store, activeTab(ctl.current())));
  };
  const onDrop = (side: Side, index?: number) => (e: React.DragEvent) => {
    if (!dragged) return;
    e.preventDefault();
    e.stopPropagation();
    const { tab: t, from } = dragged;
    ctl.update((w) => drop(w, t, group.id, side, from, index));
    setZone(null);
    setBarAt(null);
    follow(store, t);
  };

  const body = (
    <div
      className="pane-body"
      onDragOver={(e) => {
        if (!dragged) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = dragged.from ? 'move' : 'copy';
        const s = sideAt(e, e.currentTarget);
        if (s !== zone) setZone(s);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setZone(null);
      }}
      onDrop={(e) => zone && onDrop(zone)(e)}
    >
      {tab ? <TabView key={`${tab.kind}:${tab.id}`} tab={tab} narrow={narrow} onBack={onBack} onNewNote={onNewNote} onNewProject={onNewProject} onClose={() => close(group.active)} /> : <EmptyPane onNewNote={onNewNote} onNewProject={onNewProject} />}
      {dragging && <div className="pane-drop-catcher" aria-hidden="true" />}
      {dragging && zone && <div className={`pane-drop ${zone}`} aria-hidden="true" />}
    </div>
  );
  if (only) return <section className="pane-group active only">{body}</section>;

  return (
    <section className={`pane-group${active && many ? ' active' : ''}`} aria-label="Pane" onMouseDownCapture={activate} onFocusCapture={activate}>
      <div
        className="pane-tabs"
        role="tablist"
        aria-label="Tabs"
        onDragOver={(e) => {
          if (!dragged) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = dragged.from ? 'move' : 'copy';
          const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('.pane-tab'));
          let at = items.length;
          for (const [i, el] of items.entries()) {
            const r = el.getBoundingClientRect();
            if (e.clientX < r.left + r.width / 2) {
              at = i;
              break;
            }
          }
          if (at !== barAt) setBarAt(at);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setBarAt(null);
        }}
        onDrop={(e) => onDrop('center', barAt ?? undefined)(e)}
      >
        {group.tabs.map((t, i) => (
          <div key={`${t.kind}:${t.id}`} className={`pane-tab-wrap${barAt === i ? ' drop-before' : ''}${barAt === group.tabs.length && i === group.tabs.length - 1 ? ' drop-after' : ''}`}>
            <button
              type="button"
              role="tab"
              className={`pane-tab${i === group.active ? ' on' : ''}`}
              aria-selected={i === group.active}
              title={tabTitle(state, t)}
              draggable
              onDragStart={(e) => startTabDrag(e, t, { group: group.id, index: i })}
              onClick={() => show(i)}
              onAuxClick={(e) => e.button === 1 && close(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu(i);
              }}
            >
              <TabIcon tab={t} />
              <span className="pane-tab-title">{tabTitle(state, t)}</span>
            </button>
            <button type="button" className="pane-tab-close" aria-label="Close tab" title="Close tab" onClick={() => close(i)}>
              <IconClose size={11} />
            </button>
            {menu === i && (
              <Popover label="Tab" onClose={() => setMenu(null)}>
                {(['right', 'bottom'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMenu(null);
                      ctl.update((w) => drop(w, t, group.id, side, group.tabs.length > 1 ? { group: group.id, index: i } : undefined));
                    }}
                  >
                    {side === 'right' ? 'Split right' : 'Split down'}
                  </button>
                ))}
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setMenu(null);
                    close(i);
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="menu-item"
                  disabled={group.tabs.length < 2}
                  onClick={() => {
                    setMenu(null);
                    ctl.update((w) => closeOthers(w, group.id, i));
                  }}
                >
                  Close other tabs
                </button>
              </Popover>
            )}
          </div>
        ))}
        <span className="pane-tabs-rest" />
        {many && (
          <button
            type="button"
            className="icon-btn pane-close"
            aria-label="Close this pane"
            title="Close this pane"
            onClick={() => {
              let w = ctl.current();
              for (let i = group.tabs.length - 1; i >= 0; i--) w = closeTab(w, group.id, i);
              if (findGroup(w, group.id)) w = closeTab(w, group.id, 0);
              ctl.update(() => w);
              setTimeout(() => follow(store, activeTab(ctl.current())));
            }}
          >
            <IconClose size={13} />
          </button>
        )}
      </div>
      {body}
    </section>
  );
}

function TabView({ tab, narrow, onBack, onNewNote, onNewProject, onClose }: { tab: Tab; onClose(): void } & Props) {
  const state = useAppState();
  switch (tab.kind) {
    case 'note':
      return <NotePane noteId={tab.id} onBack={onBack} narrow={narrow} onNewNote={onNewNote} onNewProject={onNewProject} />;
    case 'project': {
      const project = state.projects.find((p) => p.id === tab.id);
      return project ? <ProjectPane project={project} narrow={narrow} onBack={onBack} /> : <Gone onClose={onClose} />;
    }
    case 'chapter': {
      const chapter = state.chapters.find((c) => c.id === tab.id);
      const project = chapter && state.projects.find((p) => p.id === chapter.projectId);
      return chapter && project ? <ChapterPane project={project} chapter={chapter} narrow={narrow} onBack={onBack} /> : <Gone onClose={onClose} />;
    }
    case 'research': {
      const note = state.notes.find((n) => n.id === tab.id);
      return note ? <ResearchPane note={note} onClose={onClose} /> : <Gone onClose={onClose} />;
    }
    case 'cast': {
      const project = state.projects.find((p) => p.id === tab.project);
      const member = project?.cast?.find((m) => m.id === tab.id);
      return project && member ? <CastPane project={project} member={member} onClose={onClose} /> : <Gone onClose={onClose} />;
    }
  }
}

function Gone({ onClose }: { onClose(): void }) {
  return (
    <section className="pane-empty" aria-label="Gone">
      <p>This isn’t here any more.</p>
      <button type="button" className="btn quiet" onClick={onClose}>
        Close tab
      </button>
    </section>
  );
}

function EmptyPane({ onNewNote, onNewProject }: { onNewNote(): void; onNewProject(): void }) {
  const state = useAppState();
  if (!state.notes.length && !state.projects.length) return <NotePane noteId={null} onBack={() => {}} narrow={false} onNewNote={onNewNote} onNewProject={onNewProject} />;
  return (
    <section className="pane-empty" aria-label="Empty pane">
      <p>Choose a note, or drag one here.</p>
    </section>
  );
}

/** The thing showing where you're working, for helpers that act on it. */
export function useActiveTab(): Tab | undefined {
  const ctl = useContext(PanesContext) as Ctl;
  return ctl.ws ? activeTab(ctl.ws) : undefined;
}

export { shownTabs };
