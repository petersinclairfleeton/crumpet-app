// Dragging things into panes: a note, project, chapter, research note or card
// (or a tab) carries what it shows while it's dragged, for the panes to drop.

import { useEffect, useState } from 'react';
import type { Tab } from '../data/panes';

const MIME = 'application/x-crumpet-tab';
export let dragged: { tab: Tab; from?: { group: string; index: number } } | null = null;
const dragListeners = new Set<(on: boolean) => void>();

/** Lets something be dragged into a pane: call from its `onDragStart`. */
export function startTabDrag(e: React.DragEvent, tab: Tab, from?: { group: string; index: number }): void {
  dragged = { tab, from };
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

/** The props that make a row draggable into a pane. */
export function tabDrag(tab: Tab): { draggable: true; onDragStart(e: React.DragEvent): void } {
  return { draggable: true, onDragStart: (e) => startTabDrag(e, tab) };
}

export function useDragging(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    dragListeners.add(setOn);
    return () => void dragListeners.delete(setOn);
  }, []);
  return on;
}
