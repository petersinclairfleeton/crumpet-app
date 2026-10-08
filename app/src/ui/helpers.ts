// Which editor the right sidebar's helpers (outline, styles, comments, links)
// work on: the one you last clicked or typed in, among the editors showing.

import { type RefObject, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { StyleKey, StyleSheet } from '../data/styles';

export interface Helped {
  editor: Editor;
  /** The note or chapter being edited. */
  docId: string;
  sheet: StyleSheet;
  onSheet?(s: StyleSheet): void;
  onEditStyles?(key?: StyleKey): void;
}

type Slot = { current: Helped | null };
const slots: Slot[] = [];
let chosen: Slot | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((f) => f());

/** The editor the helpers work on now. */
export function currentHelped(): Helped | null {
  return current();
}

function current(): Helped | null {
  return chosen?.current ?? null;
}

/** The editor the helpers work on (null when none is showing). */
export function useHelped(): Helped | null {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    current,
    current,
  );
}

/** Offers an editor to the helpers; it's chosen when clicked or typed in under `root` (or when it's the only one). */
export function useOfferHelped(entry: Helped | null, root: RefObject<HTMLElement>): void {
  const slot = useRef<Slot>({ current: null });
  const told = useRef<Helped | null>(null);
  // Keep the slot's contents up to date (the note shown can change under the same editor).
  slot.current.current = entry;
  useEffect(() => {
    if (told.current === entry) return;
    told.current = entry;
    // Tell the helpers when what they show changes, or take over when nothing else is chosen.
    if (chosen === slot.current || (entry && !chosen?.current)) {
      chosen = slot.current;
      tell();
    }
  });
  useEffect(() => {
    const s = slot.current;
    slots.push(s);
    if (!chosen?.current) {
      chosen = s;
      tell();
    }
    const el = root.current;
    const pick = () => {
      if (chosen !== s && s.current) {
        chosen = s;
        tell();
      }
    };
    el?.addEventListener('focusin', pick);
    el?.addEventListener('pointerdown', pick);
    return () => {
      el?.removeEventListener('focusin', pick);
      el?.removeEventListener('pointerdown', pick);
      slots.splice(slots.indexOf(s), 1);
      if (chosen === s) {
        chosen = [...slots].reverse().find((x) => x.current) ?? slots[slots.length - 1] ?? null;
        tell();
      }
    };
  }, [root]);
}

/** Runs `fn` with the editor for `docId` once it's the one the helpers work on (it may still be opening). */
export function whenHelped(docId: string, fn: (h: Helped) => void, wait = 3000): void {
  const until = Date.now() + wait;
  const tick = () => {
    const h = current();
    if (h?.docId === docId) fn(h);
    else if (Date.now() < until) setTimeout(tick, 40);
  };
  tick();
}
