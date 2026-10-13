// Notes protected with a password: the screen asking for it, opening the
// note for this session (the text kept only in memory, saved locked again
// as it changes), and the windows for setting and removing the password.

import { useEffect, useRef, useState } from 'react';
import type { Doc } from '@crumpet/editor/model';
import { type Opened, lockDoc, sealWith, unlockDoc } from '../data/lock';
import { useAppStore } from './hooks';

/** Notes opened with their password in this session (forgotten when the app closes, or on Lock now). */
const open = new Map<string, Opened>();
const LISTEN = 'crumpet:unlocked';
const changed = () => window.dispatchEvent(new Event(LISTEN));

/** The note's text when it's been opened with its password (null while it's locked), and saving changes locked. */
export function useOpened(id: string): { doc: Doc | null; save(doc: Doc): void; forget(): void } {
  const store = useAppStore();
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(LISTEN, on);
    return () => window.removeEventListener(LISTEN, on);
  }, []);
  const timer = useRef(0);
  const o = open.get(id) ?? null;
  return {
    doc: o?.doc ?? null,
    save: (doc) => {
      const now = open.get(id);
      if (!now) return;
      now.doc = doc;
      // Locked again a moment after typing stops.
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => {
        const at = open.get(id);
        if (at) store.setDoc(id, await sealWith(at.doc, at.key, at.salt));
      }, 600);
    },
    forget: () => {
      open.delete(id);
      changed();
    },
  };
}

/** Asks for the note's password, and opens it. */
export function LockedNote({ id, title, doc }: { id: string; title: string; doc: Doc }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      open.set(id, await unlockDoc(doc, pw));
      changed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That isn’t the password.');
    }
    setBusy(false);
  };
  return (
    <div className="locked-note">
      <form className="locked-card" onSubmit={(e) => void submit(e)} aria-label="Locked note">
        <span className="locked-icon" aria-hidden="true">🔒</span>
        <h2>{title || 'Untitled'}</h2>
        <p>This note is protected with a password.</p>
        <input type="password" aria-label="Password" placeholder="Password" value={pw} autoFocus onChange={(e) => setPw(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary" disabled={!pw || busy}>
          {busy ? 'Opening…' : 'Open'}
        </button>
      </form>
    </div>
  );
}

/** Sets a password on a note: its text locked from now on (the note stays open for this session). */
export function PasswordDialog({ id, doc, onClose }: { id: string; doc: Doc; onClose(): void }) {
  const store = useAppStore();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = pw.length >= 4 && pw === again;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    const { doc: sealed, opened } = await lockDoc(doc, pw);
    open.set(id, opened);
    store.setDoc(id, sealed);
    changed();
    onClose();
  };
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog small-dialog" role="dialog" aria-modal="true" aria-label="Protect with a password" onSubmit={(e) => void submit(e)}>
        <header className="dialog-head">
          <h2>Protect with a password</h2>
        </header>
        <div className="dialog-body">
          <p>The note’s text is scrambled with this password, here and in your folder or Drive. Its title stays readable.</p>
          <p className="warning-text">If you forget the password, the text can’t be opened again, not even by Crumpet.</p>
          <label className="field">
            <span>Password</span>
            <input type="password" aria-label="New password" value={pw} autoFocus onChange={(e) => setPw(e.target.value)} />
          </label>
          <label className="field">
            <span>Type it again</span>
            <input type="password" aria-label="Password again" value={again} onChange={(e) => setAgain(e.target.value)} />
          </label>
          {pw && pw.length < 4 && <p className="error">At least 4 characters.</p>}
          {again && pw !== again && <p className="error">The two don’t match.</p>}
        </div>
        <footer className="print-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!ok || busy}>
            {busy ? 'Locking…' : 'Protect'}
          </button>
        </footer>
      </form>
    </div>
  );
}

/** Takes the password off: the text saved readable again. */
export function removePassword(id: string, store: ReturnType<typeof useAppStore>): void {
  const o = open.get(id);
  if (!o) return;
  store.setDoc(id, o.doc);
  open.delete(id);
  changed();
}
