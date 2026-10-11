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
  return dragged.tab.kind === 'note' ? [dragged.tab.id] : [];
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
