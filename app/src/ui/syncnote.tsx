// A quiet word while changes are on their way to Google Drive or the folder ("Syncing…"),
// then "Synced" for a moment, so it's clear when it's safe to close Crumpet. At the foot
// of the window on a computer (the sidebar's foot says the same when it's showing, so then
// it keeps out of the way), at the top on a phone.

import { useEffect, useRef, useState } from 'react';
import { useSync } from './hooks';

export function SyncNote({ hidden }: { hidden: boolean }) {
  const { state } = useSync();
  const s = state.status;
  const busy = !!state.config && !!s && (s.phase === 'syncing' || !!s.waiting);
  const wasBusy = useRef(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      setDone(false);
      return;
    }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    if (s?.phase !== 'idle') return;
    setDone(true);
    const t = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(t);
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps
  if (hidden || (!busy && !done)) return null;
  const where = state.config?.kind === 'folder' ? 'your folder' : 'Google Drive';
  return (
    <div className={`sync-note${done ? ' done' : ''}`} title={busy ? `Your latest changes are on their way to ${where}.` : `Everything is in ${where}.`}>
      {busy ? (
        <>
          <span className="sync-note-dot" aria-hidden="true" /> Syncing…
        </>
      ) : (
        <>✓ Synced</>
      )}
    </div>
  );
}
