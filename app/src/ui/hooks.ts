import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AppState, AppStore } from '../data/store';

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
