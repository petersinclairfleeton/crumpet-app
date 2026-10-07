import { useEffect, useRef, useState } from 'react';
import { useAppState, useAppStore, useSync, keep, remember } from './hooks';
import { statusText } from './SyncSettings';
import { SettingsDialog } from './Settings';
import { BUILT_IN_CLIENT_ID } from '../sync/connection';
import { allTags, displayTitle, noteCounts, notebookTree, projectWords, recentNotes, sameView } from '../data/selectors';
import { NOTEBOOK_COLORS, type Notebook, type Stack, type View } from '../data/types';
import { IconBook, IconChevron, IconClose, IconMore, IconNote, IconNotebook, IconPlus, IconStack, IconStar, IconTag, IconTrash, Logo, NotebookIcon } from './icons';

interface Props {
  onOpenView(view: View): void;
  onOpenNote(id: string): void;
  onNewNote(): void;
  onClose(): void;
}

export function Sidebar({ onOpenView, onOpenNote, onNewNote, onClose }: Props) {
  const state = useAppState();
  const store = useAppStore();
  const [collapsed, setCollapsed] = useState<string[]>(() => remember('collapsedStacks', []));
  const [tagsOpen, setTagsOpen] = useState<boolean>(() => remember('tagsOpen', false));
  const [creating, setCreating] = useState<null | 'menu' | 'notebook' | 'stack' | 'project'>(null);
  // A link ending in #connect opens straight to connecting Google Drive.
  const [settingsOpen, setSettingsOpen] = useState(() => typeof location !== 'undefined' && location.hash === '#connect');
  const { state: sync } = useSync();
  useEffect(() => {
    const onHash = () => location.hash === '#connect' && setSettingsOpen(true);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const { loose, stacks } = notebookTree(state.stacks, state.notebooks);
  const counts = noteCounts(state.notes);
  const tags = allTags(state.notes);
  const recent = recentNotes(state.notes);
  const trashCount = state.notes.filter((n) => n.trashedAt !== null).length;
  const active = (v: View) => !state.query && sameView(state.view, v);
  const nothingYet = !state.notebooks.length && !state.stacks.length;

  const toggleStack = (id: string) => {
    const next = collapsed.includes(id) ? collapsed.filter((n) => n !== id) : [...collapsed, id];
    setCollapsed(next);
    keep('collapsedStacks', next);
  };

  return (
    <nav className="sidebar" aria-label="Notebooks">
      <div className="side-top">
        <button type="button" className="account" onClick={() => setSettingsOpen((o) => !o)} aria-expanded={settingsOpen}>
          <span className="avatar">{initials(state.settings.name)}</span>
          <span className="account-name">{state.settings.name || 'Your notes'}</span>
          <IconChevron size={10} className="rot90" />
        </button>
        <button type="button" className="icon-btn close-side" aria-label="Close menu" onClick={onClose}>
          <IconClose />
        </button>
      </div>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}

      <button type="button" className="new-note" onClick={onNewNote}>
        <span className="plus">
          <IconPlus size={12} />
        </span>
        New Note
      </button>

      {recent.length > 0 && (
        <section className="side-section" aria-label="Recent notes">
          <h2 className="side-label">Recent Notes</h2>
          {recent.map((n) => (
            <button key={n.id} type="button" className="side-row recent" onClick={() => onOpenNote(n.id)}>
              <IconNote size={12} />
              <span className="ellipsis">{displayTitle(n)}</span>
            </button>
          ))}
        </section>
      )}

      <section className="side-section">
        <SideRow icon={<IconNote size={13} />} label="All Notes" count={state.notes.filter((n) => n.trashedAt === null).length} active={active({ kind: 'all' })} onClick={() => onOpenView({ kind: 'all' })} strong />
        <SideRow icon={<IconStar size={13} />} label="Favorites" count={state.notes.filter((n) => n.favorite && n.trashedAt === null).length || undefined} active={active({ kind: 'favorites' })} onClick={() => onOpenView({ kind: 'favorites' })} strong />

        <div className="side-heading">
          <span>Projects</span>
          <button type="button" className="icon-btn" aria-label="New project" title="New project" onClick={() => setCreating(creating === 'project' ? null : 'project')}>
            <IconPlus size={13} />
          </button>
        </div>
        {creating === 'project' && (
          <InlineInput
            label="Project name"
            placeholder="Project name"
            onDone={(name) => {
              setCreating(null);
              if (name) onOpenView({ kind: 'project', id: store.createProject(name).id });
            }}
          />
        )}
        {state.projects.length === 0 && creating !== 'project' && (
          <div className="side-empty">
            <p>Books, essays and other long writing, in chapters.</p>
            <button type="button" className="side-link" onClick={() => setCreating('project')}>
              Start a project
            </button>
          </div>
        )}
        {state.projects.map((p) => (
          <SideRow
            key={p.id}
            icon={<IconBook size={13} />}
            label={p.name}
            count={projectWords(p, state.chapters) || undefined}
            countLabel="words"
            active={active({ kind: 'project', id: p.id })}
            onClick={() => onOpenView({ kind: 'project', id: p.id })}
          />
        ))}

        <div className="side-heading">
          <span>Notebooks</span>
          <button type="button" className="icon-btn" aria-label="New notebook or stack" title="New notebook or stack" aria-expanded={creating === 'menu'} onClick={() => setCreating(creating ? null : 'menu')}>
            <IconPlus size={13} />
          </button>
        </div>
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
          <NotebookRow key={nb.id} nb={nb} count={counts.get(nb.id) ?? 0} depth={0} active={active({ kind: 'notebook', id: nb.id })} onOpen={() => onOpenView({ kind: 'notebook', id: nb.id })} />
        ))}
        {stacks.map(({ stack, notebooks }) => (
          <StackGroup
            key={stack.id}
            stack={stack}
            notebooks={notebooks}
            counts={counts}
            open={!collapsed.includes(stack.id)}
            onToggle={() => toggleStack(stack.id)}
            active={active}
            onOpenView={onOpenView}
          />
        ))}

        <button
          type="button"
          className="side-row strong"
          aria-expanded={tagsOpen}
          onClick={() => {
            setTagsOpen(!tagsOpen);
            keep('tagsOpen', !tagsOpen);
          }}
        >
          <IconTag size={13} />
          <span className="grow">Tags</span>
          <IconChevron size={10} className={tagsOpen ? 'rot90' : ''} />
        </button>
        {tagsOpen && (
          <div className="tag-list">
            {tags.length === 0 && <p className="side-empty indent">Tags you add to notes show up here.</p>}
            {tags.map((t) => (
              <SideRow key={t.tag} label={`#${t.tag}`} count={t.count} indent active={active({ kind: 'tag', tag: t.tag })} onClick={() => onOpenView({ kind: 'tag', tag: t.tag })} />
            ))}
          </div>
        )}
        <SideRow icon={<IconTrash size={13} />} label="Trash" count={trashCount || undefined} active={active({ kind: 'trash' })} onClick={() => onOpenView({ kind: 'trash' })} strong />
      </section>

      <div className="side-foot">
        <Logo size={16} />
        <span role="status">{footText(state.temporary, sync)}</span>
        {!state.temporary && !sync.config && BUILT_IN_CLIENT_ID && (
          <button type="button" className="link-btn foot-link" onClick={() => setSettingsOpen(true)}>
            Connect Google Drive
          </button>
        )}
      </div>
    </nav>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '✎';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function SideRow(props: { icon?: React.ReactNode; label: string; count?: number; countLabel?: string; active: boolean; onClick(): void; strong?: boolean; indent?: boolean }) {
  return (
    <button type="button" className={`side-row${props.active ? ' active' : ''}${props.strong ? ' strong' : ''}${props.indent ? ' indent' : ''}`} aria-current={props.active ? 'page' : undefined} onClick={props.onClick}>
      {props.icon}
      <span className="grow ellipsis">{props.label}</span>
      {props.count !== undefined && (
        <span className="count" title={props.countLabel ? `${props.count.toLocaleString()} ${props.countLabel}` : undefined}>
          {props.countLabel ? compact(props.count) : props.count}
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
  return (
    <div className="stack">
      <div className={`side-row stack-row${active({ kind: 'stack', id: stack.id }) ? ' active' : ''}`}>
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
  return (
    <div className="nb">
      <div className={`side-row nb-row${active ? ' active' : ''}`} style={{ paddingLeft: 8 + depth * 18 }}>
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
  if (s?.phase === 'syncing') return 'Syncing…';
  if (s?.phase === 'error') return s.error?.kind === 'offline' ? 'Offline · saved on this device' : 'Sync needs attention';
  return statusText(s).replace(/\.$/, '').replace(/^Synced/, 'Google Drive · synced');
}

/** 1234 → "1.2k", for word counts in narrow places. */
function compact(n: number): string {
  return n < 1000 ? String(n) : n < 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(n / 1000)}k`;
}
