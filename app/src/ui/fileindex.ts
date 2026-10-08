// Reads the words in attached PDFs and pictures in the background, one file
// at a time while the app is otherwise quiet, so search can find them.

import { useEffect } from 'react';
import { useAppState, useAppStore } from './hooks';
import { fileBlob } from '../data/files';
import { fileText, readable } from '../data/filetext';

let running = false;
/** Files that couldn't be read this session (not tried again until the app reopens). */
const failed = new Set<string>();

const idle = () => new Promise<void>((r) => ('requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 2000 }) : setTimeout(r, 200)));

export function useFileIndex(): void {
  const state = useAppState();
  const store = useAppStore();
  useEffect(() => {
    if (!state.ready) return;
    const t = setTimeout(async () => {
      if (running) return;
      running = true;
      try {
        for (;;) {
          const s = store.getState();
          const docs = [...s.notes.filter((n) => n.trashedAt === null).map((n) => n.doc), ...s.chapters.map((c) => c.doc)];
          const next = docs.flatMap((d) => d.blocks.map((b) => b.src ?? '')).find((p) => p.startsWith('Attachments/') && readable(p) && s.fileText[p] === undefined && !failed.has(p));
          if (!next) break;
          await idle();
          const blob = await fileBlob(next);
          if (!blob) {
            failed.add(next);
            continue;
          }
          try {
            store.setFileText(next, await fileText(next, blob));
          } catch (err) {
            console.warn('[crumpet] Couldn’t read the words in', next, err);
            failed.add(next);
          }
        }
      } finally {
        running = false;
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [state.ready, state.notes, state.chapters, store]);
}
