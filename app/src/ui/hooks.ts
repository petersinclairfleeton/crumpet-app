import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
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
