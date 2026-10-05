import { useAppState, useAppStore } from './hooks';
import { displayTitle, groupByDate, listedNotes, matchingNotebooks, preview, shortTime, viewTitle } from '../data/selectors';
import type { Note, View } from '../data/types';
import { IconCards, IconList, IconPlus, IconStar, NotebookIcon } from './icons';

interface Props {
  onOpenNote(id: string): void;
  onNewNote(): void;
  onOpenView(view: View): void;
}

export function NoteList({ onOpenNote, onNewNote, onOpenView }: Props) {
  const state = useAppState();
  const store = useAppStore();
  const notes = listedNotes(state);
  const searching = !!state.query.trim();
  const now = Date.now();
  const trash = state.view.kind === 'trash' && !searching;
  const groups = groupByDate(notes, now, trash ? (n) => n.trashedAt ?? n.updatedAt : undefined);
  const nb = state.view.kind === 'notebook' ? store.notebook(state.view.id) : undefined;
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
          {trash && notes.length > 0 && (
            <button type="button" className="link-btn" onClick={() => store.emptyTrash()}>
              Empty Trash
            </button>
          )}
          <span className="grow" />
          <div className="segmented small" role="group" aria-label="List style">
            <button type="button" aria-pressed={style === 'cards'} aria-label="Cards" title="Cards" onClick={() => store.updateSettings({ listStyle: 'cards' })}>
              <IconCards size={13} />
            </button>
            <button type="button" aria-pressed={style === 'table'} aria-label="Table" title="Table" onClick={() => store.updateSettings({ listStyle: 'table' })}>
              <IconList size={13} />
            </button>
          </div>
        </div>
        {trash && <p className="list-note">Notes in the Trash are deleted for good after 30 days.</p>}
      </header>

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
                <tr key={n.id} className={n.id === state.selectedId ? 'selected' : ''}>
                  <td>
                    <button type="button" className="row-link" onClick={() => onOpenNote(n.id)} aria-current={n.id === state.selectedId ? 'true' : undefined}>
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
                <Card key={n.id} note={n} selected={n.id === state.selectedId} now={now} trash={trash} showNotebook={state.view.kind !== 'notebook' || searching} onOpen={() => onOpenNote(n.id)} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Card({ note, selected, now, trash, showNotebook, onOpen }: { note: Note; selected: boolean; now: number; trash: boolean; showNotebook: boolean; onOpen(): void }) {
  const store = useAppStore();
  const nb = store.notebook(note.notebookId);
  const text = preview(note);
  return (
    <button type="button" className={`card${selected ? ' selected' : ''}`} aria-current={selected ? 'true' : undefined} onClick={onOpen}>
      <span className="card-top">
        <span className="card-title ellipsis">{displayTitle(note)}</span>
        {note.favorite && !trash && (
          <span className="pin" title="In Favorites">
            <IconStar size={11} />
          </span>
        )}
        <span className="card-time">{shortTime(trash ? (note.trashedAt ?? note.updatedAt) : note.updatedAt, now)}</span>
      </span>
      <span className={`card-preview${text ? '' : ' empty'}`}>{text || 'No text yet'}</span>
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
      <svg width="56" height="56" viewBox="0 0 88 88" aria-hidden="true">
        <circle cx="44" cy="44" r="40" fill="var(--field)" />
        <circle cx="30" cy="34" r="7" fill="var(--list-bg)" />
        <circle cx="54" cy="30" r="6" fill="var(--list-bg)" />
        <circle cx="56" cy="54" r="8" fill="var(--list-bg)" />
        <circle cx="34" cy="58" r="6" fill="var(--list-bg)" />
      </svg>
      <p>{text}</p>
      {action && (
        <button type="button" className="btn primary" onClick={onNewNote}>
          <IconPlus size={14} /> New note
        </button>
      )}
    </div>
  );
}
