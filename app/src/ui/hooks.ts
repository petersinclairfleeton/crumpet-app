import { type RefObject, createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AppState, AppStore } from '../data/store';
import type { ConnectionState, SyncConnection } from '../sync/connection';

export const StoreContext = createContext<AppStore | null>(null);

export function useAppStore(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreContext missing');
  return store;
}

/** The current app state; re-renders when it changes. */
export function useAppState(): AppState {
  const store = useAppStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}

/** Small helper for remembering a UI preference in this browser only (never required to work). */
export function remember<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`crumpet:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function keep(key: string, value: unknown): void {
  try {
    localStorage.setItem(`crumpet:${key}`, JSON.stringify(value));
  } catch {
    /* not kept; fine */
  }
}

export const SyncContext = createContext<SyncConnection | null>(null);

const NO_SYNC: ConnectionState = { config: null, status: null, connecting: false, choosing: null };

/** The sync connection and its state (none in tests that don't provide one). */
export function useSync(): { sync: SyncConnection | null; state: ConnectionState } {
  const sync = useContext(SyncContext);
  const state = useSyncExternalStore(sync?.subscribe ?? noSubscribe, sync?.getState ?? (() => NO_SYNC));
  return { sync, state };
}

const noSubscribe = () => () => {};

/** Whether a CSS media query matches, following changes. */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const change = () => setOn(mq.matches);
    change();
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, [query]);
  return on;
}

/** Moving around the app from deep inside it (a link to another note). */
export interface Nav {
  openNote(id: string): void;
  /** Opens the note with this title, making it if there isn't one. */
  openTitle(title: string): void;
}
export const NavContext = createContext<Nav>({ openNote: () => {}, openTitle: () => {} });
export function useNav(): Nav {
  return useContext(NavContext);
}

/**
 * Keeps a text area as tall as its text (a title of several lines shows them all): after each
 * change, and when it gets narrower or wider (a sidebar folded, the window resized) or the
 * title's font finishes loading, any of which can wrap it onto more lines.
 */
export function useAutoHeight(ref: RefObject<HTMLTextAreaElement>): void {
  const watching = useRef<{ el: HTMLTextAreaElement; stop(): void } | null>(null);
  useLayoutEffect(() => fit(ref.current));
  // Watch the box showing now (it may come and go, or be another one).
  useEffect(() => {
    const el = ref.current;
    if (watching.current?.el === el) return;
    watching.current?.stop();
    watching.current = el ? { el, stop: watchSize(el) } : null;
  });
  useEffect(
    () => () => {
      watching.current?.stop();
      watching.current = null;
    },
    [],
  );
}

function watchSize(el: HTMLTextAreaElement): () => void {
  let width = el.clientWidth;
  const resized = new ResizeObserver(() => {
    if (el.clientWidth === width) return;
    width = el.clientWidth;
    fit(el);
  });
  resized.observe(el);
  const fonts = () => fit(el);
  document.fonts?.addEventListener?.('loadingdone', fonts);
  void document.fonts?.ready.then(fonts);
  return () => {
    resized.disconnect();
    document.fonts?.removeEventListener?.('loadingdone', fonts);
  };
}

function fit(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
