// Dragging things into panes: a note, project, chapter, research note or card
// (or a tab) carries what it shows while it's dragged, for the panes to drop.

import { useEffect, useState } from 'react';
import type { Tab } from '../data/panes';

const MIME = 'application/x-crumpet-tab';
export let dragged: { tab: Tab; from?: { group: string; index: number }; notes?: string[] } | null = null;
const dragListeners = new Set<(on: boolean) => void>();

/** Lets something be dragged into a pane: call from its `onDragStart`. */
export function startTabDrag(e: React.DragEvent, tab: Tab, from?: { group: string; index: number }, notes?: string[]): void {
  dragged = { tab, from, notes };
  e.dataTransfer.setData(MIME, JSON.stringify(tab));
  if (!e.dataTransfer.types.includes('text/plain')) e.dataTransfer.setData('text/plain', tab.id);
  e.dataTransfer.effectAllowed = from ? 'move' : 'copyMove';
  dragListeners.forEach((f) => f(true));
  const end = () => {
    dragged = null;
    dragListeners.forEach((f) => f(false));
    window.removeEventListener('dragend', end, true);
    window.removeEventListener('drop', end, true);
  };
  // After the drop has been handled.
  window.addEventListener('dragend', end, true);
  window.addEventListener('drop', () => setTimeout(end), { capture: true, once: true });
}

/** The props that make a row draggable into a pane. `notes`: the notes it carries to the sidebar (several picked ones, say). */
export function tabDrag(tab: Tab, notes?: string[]): { draggable: true; onDragStart(e: React.DragEvent): void } {
  return { draggable: true, onDragStart: (e) => startTabDrag(e, tab, undefined, notes) };
}

/** The notes being dragged (to drop on the Trash, a notebook, Favorites or a tag), if any. */
export function draggedNotes(): string[] {
  if (!dragged) return [];
  if (dragged.notes?.length) return dragged.notes;
  return dragged.tab.kind === 'note' || dragged.tab.kind === 'research' ? [dragged.tab.id] : [];
}

/**
 * The props that let a sidebar row take notes dropped on it, and whether
 * notes are over it now (to light it up).
 */
export function useNoteDrop(onDrop: ((ids: string[]) => void) | undefined): { over: boolean; props: Partial<Pick<React.HTMLAttributes<HTMLElement>, 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop'>> } {
  const [over, setOver] = useState(false);
  if (!onDrop) return { over: false, props: {} };
  const ok = (e: React.DragEvent) => {
    if (!draggedNotes().length) return false;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return true;
  };
  return {
    over,
    props: {
      onDragEnter: (e) => ok(e) && setOver(true),
      onDragOver: (e) => ok(e) && !over && setOver(true),
      onDragLeave: (e) => {
        if (!(e.currentTarget as Node).contains(e.relatedTarget as Node | null)) setOver(false);
      },
      onDrop: (e) => {
        const ids = draggedNotes();
        setOver(false);
        if (!ids.length) return;
        e.preventDefault();
        onDrop(ids);
      },
    },
  };
}

export function useDragging(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    dragListeners.add(setOn);
    return () => void dragListeners.delete(setOn);
  }, []);
  return on;
}

// ---------- moving notebooks, stacks and projects around the sidebar ----------

/** A sidebar folder being dragged: a notebook or stack (projects are dragged as tabs). */
export type Folder = { kind: 'notebook' | 'stack' | 'project'; id: string };
const FOLDER_MIME = 'application/x-crumpet-folder';
let folder: Folder | null = null;

/** The props that let a notebook or stack be dragged to another place in the sidebar. */
export function folderDrag(f: { kind: 'notebook' | 'stack'; id: string }, name: string): { draggable: true; onDragStart(e: React.DragEvent): void } {
  return {
    draggable: true,
    onDragStart: (e) => {
      e.stopPropagation();
      folder = f;
      e.dataTransfer.setData(FOLDER_MIME, JSON.stringify(f));
      e.dataTransfer.setData('text/plain', name);
      e.dataTransfer.effectAllowed = 'move';
      dragListeners.forEach((l) => l(true));
      const end = () => {
        folder = null;
        dragListeners.forEach((l) => l(false));
        window.removeEventListener('dragend', end, true);
      };
      window.addEventListener('dragend', end, true);
      window.addEventListener('drop', () => setTimeout(end), { capture: true, once: true });
    },
  };
}

/** The notebook, stack or project being dragged, if any. */
export function draggedFolder(): Folder | null {
  if (folder) return folder;
  return dragged?.tab.kind === 'project' && !dragged.from ? { kind: 'project', id: dragged.tab.id } : null;
}

/** Where a dragged folder would go: just above this row, or into it. */
export type FolderDrop = 'before' | 'into';

/**
 * The props that let a sidebar row take a notebook, stack or project dropped
 * on it (`accept` says how, or null for not at all), and how one is over it
 * now (to show a line above it, or light it up).
 */
export function useFolderDrop(accept: (f: Folder) => FolderDrop | null, onDrop: (f: Folder, how: FolderDrop) => void): { over: FolderDrop | null; props: Pick<React.HTMLAttributes<HTMLElement>, 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop'> } {
  const [over, setOver] = useState<FolderDrop | null>(null);
  const how = (e: React.DragEvent): FolderDrop | null => {
    const f = draggedFolder();
    const h = f ? accept(f) : null;
    if (!h) return null;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    return h;
  };
  return {
    over,
    props: {
      onDragEnter: (e) => setOver(how(e)),
      onDragOver: (e) => {
        const h = how(e);
        if (h !== over) setOver(h);
      },
      onDragLeave: (e) => {
        if (!(e.currentTarget as Node).contains(e.relatedTarget as Node | null)) setOver(null);
      },
      onDrop: (e) => {
        const f = draggedFolder();
        const h = how(e);
        setOver(null);
        if (f && h) onDrop(f, h);
      },
    },
  };
}

/** Event props from several drop helpers on one element: each handler runs in turn. */
export function bothDrops(...all: Partial<Pick<React.HTMLAttributes<HTMLElement>, 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop'>>[]): Pick<React.HTMLAttributes<HTMLElement>, 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop'> {
  const run = (k: 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop') => (e: React.DragEvent<HTMLElement>) => all.forEach((p) => p[k]?.(e));
  return { onDragOver: run('onDragOver'), onDragEnter: run('onDragEnter'), onDragLeave: run('onDragLeave'), onDrop: run('onDrop') };
}
