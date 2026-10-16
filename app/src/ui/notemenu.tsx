// The menu a right click on a note in the list (or Recent Notes) opens: open
// it, rename it, star it, file it, tag it, copy it or throw it away. With
// several notes picked, it works on all of them.

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { allTags, displayTitle } from '../data/selectors';
import type { Note } from '../data/types';
import { useAppState, useAppStore } from './hooks';
import { usePanes } from './panes';
import { InlineInput, Popover } from './Sidebar';
import { IconStar, IconTag, IconTrash, NotebookIcon } from './icons';

export interface NoteMenuAt {
  ids: string[];
  x: number;
  y: number;
}

/** What a list row needs to open the menu: call from its `onContextMenu`. */
export function noteMenuAt(e: React.MouseEvent, ids: string[]): NoteMenuAt {
  e.preventDefault();
  return { ids, x: e.clientX, y: e.clientY };
}

export function NoteMenu({ at, onClose }: { at: NoteMenuAt; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const panes = usePanes();
  const [mode, setMode] = useState<'menu' | 'rename' | 'move' | 'tag'>('menu');
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: at.x, top: at.y });
  const notes = at.ids.map((id) => store.note(id)).filter((n): n is Note => !!n);

  // Kept on the screen: opened up or to the left when there isn't room below or to the right.
  useLayoutEffect(() => {
    const el = box.current?.firstElementChild as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(at.x, innerWidth - r.width - 8));
    const top = at.y + r.height + 8 > innerHeight ? Math.max(8, at.y - r.height) : at.y;
    if (left !== pos.left || top !== pos.top) setPos({ left, top });
  });

  if (!notes.length) return null;
  const one = notes.length === 1 ? notes[0] : null;
  const trashed = notes.every((n) => n.trashedAt !== null);
  const allFav = notes.every((n) => n.favorite);
  const done = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const each = (fn: (n: Note) => void) => done(() => notes.forEach(fn));
  const label = one ? displayTitle(one) : `${notes.length} notes`;

  return createPortal(
    <div className="context-menu" ref={box} style={{ left: pos.left, top: pos.top }} onContextMenu={(e) => e.preventDefault()}>
      <Popover label={`${label}: options`} onClose={onClose}>
        {mode === 'menu' && trashed && (
          <>
            <button type="button" className="menu-item" onClick={each((n) => store.restoreNote(n.id))}>
              Restore
            </button>
            <button type="button" className="menu-item danger" onClick={each((n) => store.deleteForever(n.id))}>
              <IconTrash size={14} /> Delete forever
            </button>
          </>
        )}
        {mode === 'menu' && !trashed && (
          <>
            {one && (
              <>
                <button type="button" className="menu-item" onClick={done(() => panes.open({ kind: 'note', id: one.id }, 'tab'))}>
                  Open in a new tab
                </button>
                <button type="button" className="menu-item" onClick={done(() => panes.split({ kind: 'note', id: one.id }, 'right'))}>
                  Open to the side
                </button>
                <hr className="menu-rule" />
                <button type="button" className="menu-item" onClick={() => setMode('rename')}>
                  Rename…
                </button>
              </>
            )}
            <button type="button" className="menu-item" onClick={each((n) => n.favorite === allFav && store.toggleFavorite(n.id))}>
              <IconStar size={14} /> {allFav ? 'Remove from Favourites' : 'Add to Favourites'}
            </button>
            {!notes.some((n) => n.projectId) && (
              <button type="button" className="menu-item" onClick={() => setMode('move')}>
                Move to notebook…
              </button>
            )}
            <button type="button" className="menu-item" onClick={() => setMode('tag')}>
              <IconTag size={14} /> Add tag…
            </button>
            {one && !one.projectId && (
              <button
                type="button"
                className="menu-item"
                onClick={done(() => {
                  const { view } = store.getState();
                  store.createNote({ title: one.title ? `${one.title} (copy)` : '', doc: one.doc, notebookId: one.notebookId, tags: one.tags, favorite: false });
                  store.setView(view);
                })}
              >
                Duplicate
              </button>
            )}
            <hr className="menu-rule" />
            <button type="button" className="menu-item danger" onClick={each((n) => store.trashNote(n.id))}>
              <IconTrash size={14} /> Move to Trash
            </button>
          </>
        )}
        {mode === 'rename' && one && (
          <InlineInput
            label="New title"
            initial={one.title}
            placeholder="Title"
            onDone={(title) => {
              if (title !== null) store.setTitle(one.id, title);
              onClose();
            }}
          />
        )}
        {mode === 'move' && (
          <>
            <p className="menu-label">Move to</p>
            <button type="button" className="menu-item" onClick={each((n) => store.moveNote(n.id, null))}>
              No notebook
            </button>
            {state.notebooks.map((nb) => (
              <button key={nb.id} type="button" className="menu-item" onClick={each((n) => store.moveNote(n.id, nb.id))}>
                <NotebookIcon color={nb.color} size={12} cut="var(--page)" /> {nb.name}
              </button>
            ))}
          </>
        )}
        {mode === 'tag' && (
          <InlineInput
            label="Tag to add"
            placeholder="Tag to add"
            list={allTags(state.notes).map((t) => t.tag)}
            onDone={(tag) => {
              if (tag) notes.forEach((n) => store.addTag(n.id, tag));
              onClose();
            }}
          />
        )}
      </Popover>
    </div>,
    document.body,
  );
}
