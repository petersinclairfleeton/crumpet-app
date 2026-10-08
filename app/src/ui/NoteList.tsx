import { useEffect, useRef, useState } from 'react';
import { mediaUrl } from '../data/files';
import { useAppState, useAppStore } from './hooks';
import { type Group, displayTitle, groupByDate, listedNotes, matchingNotebooks, preview, shortTime, viewTitle } from '../data/selectors';
import type { Note, View } from '../data/types';
import { type SortBy, parseQuery, quoted, sortNotes, withToken, withoutToken } from '../data/search';
import { allTags } from '../data/selectors';
import { InlineInput, Popover } from './Sidebar';
import { IconStarFilled, IconTag, IconTrash } from './icons';
import { IconCards, IconList, IconPlus, IconStar, Logo, NotebookIcon } from './icons';

interface Props {
  onOpenNote(id: string): void;
  onNewNote(): void;
  onOpenView(view: View): void;
}

export function NoteList({ onOpenNote, onNewNote, onOpenView }: Props) {
  const state = useAppState();
  const store = useAppStore();
  const searching = !!state.query.trim();
  const trash = state.view.kind === 'trash' && !searching;
  const sort: SortBy = trash ? 'edited' : (state.settings.sort ?? 'edited');
  const notes = sortNotes(listedNotes(state), sort);
  const now = Date.now();
  const groups = sort === 'title' ? byLetter(notes) : groupByDate(notes, now, trash ? (n) => n.trashedAt ?? n.updatedAt : sort === 'created' ? (n) => n.createdAt : undefined);
  const { tokens } = parseQuery(state.query);
  const [saving, setSaving] = useState(false);
  // Several notes picked (Ctrl/Cmd-click, Shift-click) to move, tag, star or trash together.
  const [picked, setPicked] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  const pickedNow = picked.filter((id) => notes.some((n) => n.id === id));
  const open = (id: string, e?: React.MouseEvent) => {
    if (e && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const base = pickedNow.length ? pickedNow : state.selectedId && notes.some((n) => n.id === state.selectedId) ? [state.selectedId] : [];
      setPicked(base.includes(id) ? base.filter((x) => x !== id) : [...base, id]);
      anchor.current = id;
      return;
    }
    if (e?.shiftKey) {
      e.preventDefault();
      const from = notes.findIndex((n) => n.id === (anchor.current ?? state.selectedId));
      const to = notes.findIndex((n) => n.id === id);
      if (from >= 0 && to >= 0) setPicked(notes.slice(Math.min(from, to), Math.max(from, to) + 1).map((n) => n.id));
      return;
    }
    setPicked([]);
    anchor.current = id;
    onOpenNote(id);
  };
  useEffect(() => {
    if (!pickedNow.length) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicked([]);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickedNow.length]);
  const nb = state.view.kind === 'notebook' ? store.notebook(state.view.id) : undefined;
  const [renamingTag, setRenamingTag] = useState(false);
  const style = state.settings.listStyle;
  const jumps = searching ? matchingNotebooks(state) : [];
  const title = searching ? 'Search results' : viewTitle(state.view, state);

  return (
    <section className="list" aria-label="Notes">
      <header className="list-head">
        <div className="list-title">
          {nb && <NotebookIcon color={nb.color} size={15} cut="var(--list-bg)" />}
          <h1>{title}</h1>
        </div>
        <div className="list-sub">
          <span>
            {notes.length} note{notes.length === 1 ? '' : 's'}
          </span>
          {state.view.kind === 'tag' && !searching && (
            <button type="button" className="link-btn" onClick={() => setRenamingTag(true)}>
              Rename tag
            </button>
          )}
          {trash && notes.length > 0 && (
            <button type="button" className="link-btn" onClick={() => store.emptyTrash()}>
              Empty Trash
            </button>
          )}
          <span className="grow" />
          {!trash && (
            <label className="sort-pick">
              <span className="visually-hidden">Sort by</span>
              <select aria-label="Sort by" value={sort} onChange={(e) => store.updateSettings({ sort: e.target.value as SortBy })}>
                <option value="edited">Last edited</option>
                <option value="created">Date created</option>
                <option value="title">Title</option>
              </select>
            </label>
          )}
          <div className="segmented small" role="group" aria-label="List style">
            <button type="button" aria-pressed={style === 'cards'} aria-label="Cards" title="Cards" onClick={() => store.updateSettings({ listStyle: 'cards' })}>
              <IconCards size={13} />
            </button>
            <button type="button" aria-pressed={style === 'table'} aria-label="Table" title="Table" onClick={() => store.updateSettings({ listStyle: 'table' })}>
              <IconList size={13} />
            </button>
          </div>
        </div>
        {renamingTag && state.view.kind === 'tag' && (
          <InlineInput
            label="New name for the tag"
            placeholder="Use / to put it inside another tag"
            initial={state.view.tag}
            onDone={(name) => {
              setRenamingTag(false);
              if (name && state.view.kind === 'tag') store.renameTag(state.view.tag, name);
            }}
          />
        )}
        {trash && <p className="list-note">Notes in the Trash are deleted for good after 30 days.</p>}
        {searching && (
          <div className="search-tools">
            {tokens.map((t) => (
              <button key={t.text} type="button" className="filter-chip" aria-label={`Remove filter: ${t.label}`} onClick={() => store.setQuery(withoutToken(state.query, t))}>
                {t.label} <span aria-hidden="true">×</span>
              </button>
            ))}
            <FilterMenu />
            {saving ? (
              <InlineInput
                label="Name for this search"
                placeholder="Name this search"
                initial={tokens.length ? tokens.map((t) => t.label).join(', ') : state.query.trim()}
                onDone={(name) => {
                  setSaving(false);
                  if (name) store.updateSettings({ savedSearches: [...(state.settings.savedSearches ?? []), { id: crypto.randomUUID(), name, query: state.query.trim() }] });
                }}
              />
            ) : (
              !state.settings.savedSearches?.some((s) => s.query === state.query.trim()) && (
                <button type="button" className="link-btn small" onClick={() => setSaving(true)}>
                  Save this search
                </button>
              )
            )}
          </div>
        )}
      </header>
      {pickedNow.length > 0 && <PickedBar ids={pickedNow} onDone={() => setPicked([])} />}

      {jumps.length > 0 && (
        <div className="jumps" aria-label="Notebooks matching your search">
          {jumps.map((j) => (
            <button key={j.id} type="button" className="chip" onClick={() => onOpenView({ kind: 'notebook', id: j.id })}>
              <NotebookIcon color={j.color} size={11} cut="var(--chip)" />
              {j.name}
            </button>
          ))}
        </div>
      )}

      {notes.length === 0 ? (
        <Empty view={state.view} searching={searching} query={state.query} onNewNote={onNewNote} />
      ) : style === 'table' ? (
        <div className="table-wrap">
          <table className="note-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Notebook</th>
                <th scope="col">{trash ? 'Trashed' : 'Updated'}</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.id} className={(pickedNow.length ? pickedNow.includes(n.id) : n.id === state.selectedId) ? 'selected' : ''}>
                  <td>
                    <button type="button" className="row-link" onClick={(e) => open(n.id, e)} aria-current={n.id === state.selectedId ? 'true' : undefined}>
                      {displayTitle(n)}
                    </button>
                  </td>
                  <td className="muted">{store.notebook(n.notebookId)?.name ?? '—'}</td>
                  <td className="muted nowrap">{shortTime(trash ? (n.trashedAt ?? n.updatedAt) : n.updatedAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cards">
          {groups.map((g) => (
            <div key={g.label} className="group" role="group" aria-label={g.label}>
              <h2 className="group-label">{g.label}</h2>
              {g.notes.map((n) => (
                <Card key={n.id} note={n} selected={pickedNow.length ? pickedNow.includes(n.id) : n.id === state.selectedId} now={now} trash={trash} showNotebook={state.view.kind !== 'notebook' || searching} onOpen={(e) => open(n.id, e)} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Card({ note, selected, now, trash, showNotebook, onOpen }: { note: Note; selected: boolean; now: number; trash: boolean; showNotebook: boolean; onOpen(e: React.MouseEvent): void }) {
  const store = useAppStore();
  const nb = store.notebook(note.notebookId);
  const text = preview(note);
  const picture = note.doc.blocks.find((b) => b.type === 'image' && b.src)?.src;
  return (
    <button type="button" className={`card${selected ? ' selected' : ''}${picture ? ' has-thumb' : ''}`} aria-current={selected ? 'true' : undefined} onClick={(e) => onOpen(e)}>
      {picture && <Thumb src={picture} />}
      <span className="card-top">
        <span className="card-title ellipsis">{displayTitle(note)}</span>
        {note.favorite && !trash && (
          <span className="pin" title="In Favorites">
            <IconStar size={11} />
          </span>
        )}
        <span className="card-time">{shortTime(trash ? (note.trashedAt ?? note.updatedAt) : note.updatedAt, now)}</span>
      </span>
      <span className={`card-preview${text ? '' : ' no-text'}`}>{text || 'No text yet'}</span>
      {(showNotebook || note.tags.length > 0) && (
        <span className="card-meta">
          {showNotebook && nb && (
            <span className="card-nb">
              <NotebookIcon color={nb.color} size={10} cut="var(--list-bg)" />
              {nb.name}
            </span>
          )}
          {note.tags.slice(0, 3).map((t) => (
            <span key={t} className="card-tag">
              #{t}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function Empty({ view, searching, query, onNewNote }: { view: View; searching: boolean; query: string; onNewNote(): void }) {
  let text: string;
  let action = true;
  if (searching) {
    text = `No notes match “${query.trim()}”.`;
    action = false;
  } else if (view.kind === 'trash') {
    text = 'The Trash is empty.';
    action = false;
  } else if (view.kind === 'favorites') text = 'Star a note to keep it in Favorites.';
  else if (view.kind === 'stack') text = 'No notes in this stack’s notebooks yet.';
  else if (view.kind === 'tag') text = 'No notes have this tag any more.';
  else if (view.kind === 'all') text = 'No notes yet. Write your first one, then file it in a notebook whenever you like.';
  else text = 'No notes here yet.';
  return (
    <div className="empty">
      <span className="empty-logo">
        <Logo size={56} />
      </span>
      <p>{text}</p>
      {action && (
        <button type="button" className="btn primary" onClick={onNewNote}>
          <IconPlus size={14} /> New note
        </button>
      )}
    </div>
  );
}

/** The first picture in a note, small, on its card. */
function Thumb({ src }: { src: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const r = mediaUrl(src);
    if (typeof r === 'string') setUrl(r);
    else r.then((u) => live && setUrl(u)).catch(() => {});
    return () => {
      live = false;
    };
  }, [src]);
  return <span className="card-thumb" aria-hidden="true" style={url ? { backgroundImage: `url("${url.replace(/"/g, '%22')}")` } : undefined} />;
}

/** Notes sorted by title, grouped by first letter. */
function byLetter(notes: Note[]): Group[] {
  const groups: Group[] = [];
  for (const n of notes) {
    const ch = (n.title.trim()[0] ?? '').toLocaleUpperCase();
    const label = /\p{L}/u.test(ch) ? ch : n.title.trim() ? '#' : 'Untitled';
    const last = groups[groups.length - 1];
    if (last?.label === label) last.notes.push(n);
    else groups.push({ label, notes: [n] });
  }
  return groups;
}

/** Filters to add to the search. */
function FilterMenu() {
  const state = useAppState();
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const add = (token: string) => {
    store.setQuery(withToken(state.query, token));
    setOpen(false);
  };
  const week = new Date(Date.now() - 7 * 86_400_000);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return (
    <span className="filter-menu">
      <button type="button" className="filter-add" aria-expanded={open} onClick={() => setOpen(!open)}>
        + Filter
      </button>
      {open && (
        <Popover label="Add a filter" onClose={() => setOpen(false)}>
          <button type="button" className="menu-item" onClick={() => add('is:favorite')}>Favorites</button>
          <button type="button" className="menu-item" onClick={() => add('has:picture')}>With pictures</button>
          <button type="button" className="menu-item" onClick={() => add('has:file')}>With files</button>
          <button type="button" className="menu-item" onClick={() => add('has:checklist')}>With checklists</button>
          <button type="button" className="menu-item" onClick={() => add('has:todo')}>With unticked items</button>
          <button type="button" className="menu-item" onClick={() => add('has:link')}>With links</button>
          <button type="button" className="menu-item" onClick={() => add('has:table')}>With tables</button>
          <button type="button" className="menu-item" onClick={() => add(`after:${ymd(week)}`)}>Edited this week</button>
          {state.notebooks.length > 0 && <p className="menu-label">In notebook</p>}
          {state.notebooks.map((nb) => (
            <button key={nb.id} type="button" className="menu-item" onClick={() => add(quoted('in', nb.name))}>
              <NotebookIcon color={nb.color} size={12} cut="var(--page)" /> {nb.name}
            </button>
          ))}
          {allTags(state.notes).length > 0 && <p className="menu-label">Tagged</p>}
          {allTags(state.notes).map((t) => (
            <button key={t.tag} type="button" className="menu-item" onClick={() => add(`#${t.tag}`)}>
              #{t.tag}
            </button>
          ))}
          <p className="menu-hint">You can type these in the search too, like tag:idea, in:"Journal", has:picture or after:2026-01-31.</p>
        </Popover>
      )}
    </span>
  );
}

/** What to do with several notes at once. */
function PickedBar({ ids, onDone }: { ids: string[]; onDone(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const [menu, setMenu] = useState<null | 'move' | 'tag'>(null);
  const all = (fn: (id: string) => void) => {
    for (const id of ids) fn(id);
  };
  const notes = ids.map((id) => store.note(id)).filter((n): n is Note => !!n);
  const allFav = notes.every((n) => n.favorite);
  return (
    <div className="picked-bar" role="toolbar" aria-label={`${ids.length} notes selected`}>
      <b>{ids.length} selected</b>
      <span className="picked-actions">
        <span className="picked-menu">
          <button type="button" className="btn small" aria-expanded={menu === 'move'} onClick={() => setMenu(menu === 'move' ? null : 'move')}>
            Move
          </button>
          {menu === 'move' && (
            <Popover label="Move to" onClose={() => setMenu(null)}>
              <button type="button" className="menu-item" onClick={() => (all((id) => store.moveNote(id, null)), onDone())}>
                No notebook
              </button>
              {state.notebooks.map((nb) => (
                <button key={nb.id} type="button" className="menu-item" onClick={() => (all((id) => store.moveNote(id, nb.id)), onDone())}>
                  <NotebookIcon color={nb.color} size={12} cut="var(--page)" /> {nb.name}
                </button>
              ))}
            </Popover>
          )}
        </span>
        <span className="picked-menu">
          <button type="button" className="btn small" aria-label="Tag" aria-expanded={menu === 'tag'} onClick={() => setMenu(menu === 'tag' ? null : 'tag')}>
            <IconTag size={13} /> Tag
          </button>
          {menu === 'tag' && (
            <Popover label="Add a tag" onClose={() => setMenu(null)}>
              <InlineInput
                label="Tag"
                placeholder="Tag to add"
                list={allTags(state.notes).map((t) => t.tag)}
                onDone={(tag) => {
                  setMenu(null);
                  if (tag) all((id) => store.addTag(id, tag));
                }}
              />
            </Popover>
          )}
        </span>
        <button type="button" className="btn small" aria-label={allFav ? 'Remove from Favorites' : 'Add to Favorites'} onClick={() => all((id) => (store.note(id)?.favorite === allFav ? store.toggleFavorite(id) : undefined))}>
          <IconStarFilled size={13} />
        </button>
        <button type="button" className="btn small danger" aria-label="Move to Trash" onClick={() => (all((id) => store.trashNote(id)), onDone())}>
          <IconTrash size={13} />
        </button>
        <button type="button" className="icon-btn" aria-label="Clear selection" onClick={onDone}>
          ×
        </button>
      </span>
    </div>
  );
}
