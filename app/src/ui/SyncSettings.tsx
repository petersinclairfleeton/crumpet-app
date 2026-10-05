import { useState } from 'react';
import { BUILT_IN_CLIENT_ID } from '../sync/connection';
import type { SyncStatus } from '../sync/engine';
import { useSync } from './hooks';

const SETUP_GUIDE = 'https://github.com/petersinclairfleeton/crumpet-app/blob/main/docs/google-drive-setup.md';

/** Settings: where notes are kept, and connecting Google Drive. */
export function SyncSettings() {
  const { sync, state } = useSync();
  const [choosing, setChoosing] = useState(false);
  const [clientId, setClientId] = useState(BUILT_IN_CLIENT_ID);
  const [folder, setFolder] = useState('Crumpet');
  const [error, setError] = useState<string | null>(null);
  if (!sync) return null;
  const config = state.config;

  const connect = async () => {
    setError(null);
    try {
      await sync.connectDrive(clientId, folder);
      setChoosing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (config) {
    const s = state.status;
    return (
      <div className="field sync-settings" role="group" aria-label="Where your notes live">
        <span>Where your notes live</span>
        <p className="sync-where">
          Google Drive, in the folder <b>{config.folderName}</b>, as Markdown files you can open anywhere.
        </p>
        <p className={`sync-line${s?.phase === 'error' ? ' bad' : ''}`} role="status">
          {statusText(s)}
        </p>
        <div className="sync-actions">
          {s?.error?.kind === 'auth' ? (
            <button type="button" className="btn primary" onClick={() => sync.reconnect().catch((e) => setError(String(e?.message ?? e)))}>
              Sign in again
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

  return (
    <div className="field sync-settings" role="group" aria-label="Where your notes live">
      <span>Where your notes live</span>
      {!choosing ? (
        <>
          <p className="sync-where">In this browser only. Connect a cloud folder to keep them as files you own and to see them on your other devices.</p>
          <div className="sync-actions">
            <button type="button" className="btn primary" onClick={() => setChoosing(true)}>
              Connect Google Drive
            </button>
          </div>
          <p className="sync-hint">A folder on this computer is coming next.</p>
        </>
      ) : (
        <form
          className="sync-form"
          onSubmit={(e) => {
            e.preventDefault();
            connect();
          }}
        >
          {!BUILT_IN_CLIENT_ID && (
            <label className="field">
              <span>Google client ID</span>
              <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="…apps.googleusercontent.com" autoComplete="off" spellCheck={false} required />
              <small className="sync-hint">
                Your own, so only you hold the keys.{' '}
                <a href={SETUP_GUIDE} target="_blank" rel="noreferrer">
                  How to get one (5 minutes)
                </a>
              </small>
            </label>
          )}
          <label className="field">
            <span>Folder in your Drive</span>
            <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Crumpet" />
          </label>
          <p className="sync-hint">Crumpet can only see files it creates in your Drive, nothing else.</p>
          <div className="sync-actions">
            <button type="submit" className="btn primary" disabled={state.connecting || !clientId.trim()}>
              {state.connecting ? 'Connecting…' : 'Connect'}
            </button>
            <button type="button" className="btn quiet" onClick={() => setChoosing(false)}>
              Cancel
            </button>
          </div>
          {error && <p className="sync-line bad">{error}</p>}
        </form>
      )}
    </div>
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
