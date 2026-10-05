import { useEffect, useRef, useState } from 'react';
import { useAppState, useAppStore, keep, remember } from './hooks';
import { allTags, displayTitle, noteCounts, notebookTree, recentNotes, sameView } from '../data/selectors';
import { ACCENTS, NOTEBOOK_COLORS, type Notebook, type Theme, type View } from '../data/types';
import { IconChevron, IconClose, IconNote, IconPlus, IconMore, IconStack, IconStar, IconTag, IconTrash, Logo, NotebookIcon } from './icons';

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
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { loose, stacks } = notebookTree(state.notebooks);
  const counts = noteCounts(state.notes);
  const tags = allTags(state.notes);
  const recent = recentNotes(state.notes);
  const trashCount = state.notes.filter((n) => n.trashedAt !== null).length;
  const active = (v: View) => !state.query && sameView(state.view, v);

  const toggleStack = (name: string) => {
    const next = collapsed.includes(name) ? collapsed.filter((n) => n !== name) : [...collapsed, name];
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
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

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
        <SideRow icon={<IconStar size={13} />} label="Shortcuts" count={state.notes.filter((n) => n.pinned && n.trashedAt === null).length || undefined} active={active({ kind: 'shortcuts' })} onClick={() => onOpenView({ kind: 'shortcuts' })} strong />

        <div className="side-heading">
          <span>Notebooks</span>
          <button type="button" className="icon-btn" aria-label="New notebook" title="New notebook" onClick={() => setAdding(true)}>
            <IconPlus size={13} />
          </button>
        </div>
        {adding && (
          <InlineInput
            label="Notebook name"
            placeholder="Notebook name"
            onDone={(name) => {
              setAdding(false);
              if (name) onOpenView({ kind: 'notebook', id: store.createNotebook(name).id });
            }}
          />
        )}
        {loose.map((nb) => (
          <NotebookRow key={nb.id} nb={nb} count={counts.get(nb.id) ?? 0} depth={0} active={active({ kind: 'notebook', id: nb.id })} onOpen={() => onOpenView({ kind: 'notebook', id: nb.id })} stacks={stacks.map((s) => s.name)} />
        ))}
        {stacks.map((st) => {
          const open = !collapsed.includes(st.name);
          return (
            <div key={st.name} className="stack">
              <div className={`side-row stack-row${active({ kind: 'stack', name: st.name }) ? ' active' : ''}`}>
                <button type="button" className="disclosure" aria-label={open ? `Collapse ${st.name}` : `Expand ${st.name}`} aria-expanded={open} onClick={() => toggleStack(st.name)}>
                  <IconChevron size={10} className={open ? 'rot90' : ''} />
                </button>
                <button type="button" className="row-main" onClick={() => onOpenView({ kind: 'stack', name: st.name })}>
                  <IconStack size={12} />
                  <span className="ellipsis">{st.name}</span>
                </button>
              </div>
              {open &&
                st.notebooks.map((nb) => (
                  <NotebookRow key={nb.id} nb={nb} count={counts.get(nb.id) ?? 0} depth={1} active={active({ kind: 'notebook', id: nb.id })} onOpen={() => onOpenView({ kind: 'notebook', id: nb.id })} stacks={stacks.map((s) => s.name)} />
                ))}
            </div>
          );
        })}

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
            {tags.length === 0 && <p className="side-empty">Tags you add to notes show up here.</p>}
            {tags.map((t) => (
              <SideRow key={t.tag} label={`#${t.tag}`} count={t.count} indent active={active({ kind: 'tag', tag: t.tag })} onClick={() => onOpenView({ kind: 'tag', tag: t.tag })} />
            ))}
          </div>
        )}
        <SideRow icon={<IconTrash size={13} />} label="Trash" count={trashCount || undefined} active={active({ kind: 'trash' })} onClick={() => onOpenView({ kind: 'trash' })} strong />
      </section>

      <div className="side-foot">
        <Logo size={16} />
        <span>{state.temporary ? 'crumpet · not saving' : 'crumpet · saved on this device'}</span>
      </div>
    </nav>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '✎';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function SideRow(props: { icon?: React.ReactNode; label: string; count?: number; active: boolean; onClick(): void; strong?: boolean; indent?: boolean }) {
  return (
    <button type="button" className={`side-row${props.active ? ' active' : ''}${props.strong ? ' strong' : ''}${props.indent ? ' indent' : ''}`} aria-current={props.active ? 'page' : undefined} onClick={props.onClick}>
      {props.icon}
      <span className="grow ellipsis">{props.label}</span>
      {props.count !== undefined && <span className="count">{props.count}</span>}
    </button>
  );
}

function NotebookRow({ nb, count, depth, active, onOpen, stacks }: { nb: Notebook; count: number; depth: number; active: boolean; onOpen(): void; stacks: string[] }) {
  const store = useAppStore();
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState<'menu' | 'rename' | 'stack' | 'delete'>('menu');
  const close = () => {
    setMenu(false);
    setMode('menu');
  };
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
                {nb.stack ? 'Move to another stack…' : 'Put in a stack…'}
              </button>
              {nb.stack && (
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    store.setStack(nb.id, null);
                    close();
                  }}
                >
                  Take out of “{nb.stack}”
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
              <InlineInput
                label="Stack name"
                placeholder="New or existing stack"
                list={stacks}
                finishOnBlur={false}
                initial={nb.stack ?? ''}
                onDone={(name) => {
                  if (name) store.setStack(nb.id, name);
                  close();
                }}
              />
              {stacks.filter((s) => s !== nb.stack).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    store.setStack(nb.id, s);
                    close();
                  }}
                >
                  {s}
                </button>
              ))}
            </>
          )}
          {mode === 'delete' && (
            <div className="menu-confirm">
              {store.getState().notebooks.length <= 1 ? (
                <p>You need at least one notebook, so this one can’t be deleted.</p>
              ) : (
                <>
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
                </>
              )}
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

/** A small panel under the item that opened it; closes on Escape or a click outside. */
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

function SettingsPanel({ onClose }: { onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const s = state.settings;
  return (
    <Popover onClose={onClose} label="Settings">
      <div className="settings">
        <label className="field">
          <span>Your name</span>
          <input value={s.name} placeholder="Shown at the top of the sidebar" onChange={(e) => store.updateSettings({ name: e.target.value })} />
        </label>
        <div className="field" role="group" aria-label="Appearance">
          <span>Appearance</span>
          <div className="segmented">
            {(['system', 'light', 'dark'] as Theme[]).map((t) => (
              <button key={t} type="button" aria-pressed={s.theme === t} onClick={() => store.updateSettings({ theme: t })}>
                {t === 'system' ? 'Match device' : t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>
        <div className="field" role="group" aria-label="Accent colour">
          <span>Accent</span>
          <div className="accents">
            {ACCENTS.map((a) => (
              <button key={a.hex} type="button" className={`swatch big${s.accent === a.hex ? ' on' : ''}`} style={{ background: a.hex }} aria-label={a.name} aria-pressed={s.accent === a.hex} title={a.name} onClick={() => store.updateSettings({ accent: a.hex })} />
            ))}
          </div>
        </div>
      </div>
    </Popover>
  );
}
