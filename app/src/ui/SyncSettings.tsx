import { useState } from 'react';
import { BUILT_IN_CLIENT_ID } from '../sync/connection';
import type { SyncStatus } from '../sync/engine';
import { canPickFolder } from '../sync/google-picker';
import { canUseFolder } from '../sync/folder';
import { useSync } from './hooks';

/** Settings: where notes are kept: Google Drive, or a folder on this computer. */
export function SyncSettings() {
  const { sync, state } = useSync();
  const [error, setError] = useState<string | null>(null);
  if (!sync) return null;
  const config = state.config;
  const run = (fn: () => Promise<void>) => {
    setError(null);
    fn().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  if (config) {
    const s = state.status;
    return (
      <div className="field sync-settings" role="group" aria-label="Where your notes live">
        <span>Where your notes live</span>
        <p className="sync-where">
          {config.kind === 'folder' ? (
            <>
              In the folder <b>{config.folderName}</b> on this computer, as Markdown files you can open with any app.
            </>
          ) : (
            <>
              In your Google Drive, in the folder <b>{config.folderName}</b>, as Markdown files you can open with any app.
            </>
          )}
        </p>
        <p className={`sync-line${s?.phase === 'error' ? ' bad' : ''}`} role="status">
          {statusText(s)}
        </p>
        <div className="sync-actions">
          {s?.error?.kind === 'auth' ? (
            <button type="button" className="btn primary" onClick={() => run(() => sync.reconnect())}>
              {config.kind === 'folder' ? 'Allow access to the folder' : 'Sign in again'}
            </button>
          ) : (
            <button type="button" className="btn" disabled={s?.phase === 'syncing'} onClick={() => sync.syncNow()}>
              Sync now
            </button>
          )}
          <button type="button" className="btn quiet" onClick={() => sync.disconnect()}>
            Disconnect
          </button>
        </div>
        {error && <p className="sync-line bad">{error}</p>}
      </div>
    );
  }

  if (state.choosing) {
    const existing = state.choosing.existing;
    return (
      <div className="field sync-settings" role="group" aria-label="Where your notes live">
        <span>Where should your notes go?</span>
        <div className="sync-choices">
          <button type="button" className="sync-choice" disabled={state.connecting} onClick={() => run(() => sync.useFolder(existing ?? 'new'))}>
            <b>{existing ? 'Your Crumpet folder' : 'A new “Crumpet” folder'}</b>
            <small>{existing ? 'Found in your Drive from before' : 'At the top of My Drive'}</small>
          </button>
          {canPickFolder && (
            <button type="button" className="sync-choice" disabled={state.connecting} onClick={() => run(() => sync.pickFolder())}>
              <b>Choose a folder…</b>
              <small>Any folder in your Drive</small>
            </button>
          )}
        </div>
        <div className="sync-actions">
          <button type="button" className="btn quiet" onClick={() => sync.cancelChoosing()}>
            Cancel
          </button>
        </div>
        {state.connecting && <p className="sync-line">Connecting…</p>}
        {error && <p className="sync-line bad">{error}</p>}
      </div>
    );
  }

  return (
    <div className="field sync-settings" role="group" aria-label="Where your notes live">
      <span>Where your notes live</span>
      <p className="sync-where">On this device only.</p>
      <div className="sync-actions">
        <button type="button" className="btn google" disabled={state.connecting || !BUILT_IN_CLIENT_ID} onClick={() => run(() => sync.signInToGoogle())}>
          <GoogleMark />
          {state.connecting ? 'Opening Google…' : 'Continue with Google'}
        </button>
        {canUseFolder && (
          <button type="button" className="btn" disabled={state.connecting} onClick={() => run(() => sync.useLocalFolder())}>
            Use a folder on this computer…
          </button>
        )}
      </div>
      <p className="sync-hint">
        {BUILT_IN_CLIENT_ID
          ? 'Keep your notes as Markdown files in a folder in your Google Drive, and see them on all your devices. Crumpet can only see that folder.'
          : 'Google Drive isn’t set up in this copy of Crumpet yet.'}
        {canUseFolder
          ? ' Or keep them in a folder on this computer: pick one that Dropbox, OneDrive or iCloud Drive keeps in step to have them on your other devices too.'
          : ' (Keeping notes in a folder on this computer needs Chrome or Edge on a computer.)'}
      </p>
      {error && <p className="sync-line bad">{error}</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function statusText(s: SyncStatus | null): string {
  if (!s) return 'Starting…';
  if (s.phase === 'syncing') return 'Syncing…';
  if (s.phase === 'error') return s.error?.kind === 'offline' ? 'Offline. Changes are kept here and sync when you’re back.' : (s.error?.message ?? 'Sync stopped.');
  if (!s.lastSynced) return 'Not synced yet.';
  const conflicts = s.conflicts ? ` ${s.conflicts} conflicted ${s.conflicts === 1 ? 'copy' : 'copies'} made.` : '';
  return `Synced ${ago(s.lastSynced)}.${conflicts}`;
}

function ago(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
