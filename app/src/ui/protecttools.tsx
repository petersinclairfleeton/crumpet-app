// Word's Protect Document, for the formatting bar: Mark as final, Restrict
// editing (read only, or comments only, with a password if you like), and a
// signature line that tells whether the document has changed since it was
// signed; and the banner on a protected document, to lift it.

import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { Popover } from './Sidebar';
import { type ToolItem, closeMore } from './toolbar';
import { makeLock, opensLock } from './changes';
import { useAppState } from './hooks';
import { formatDate } from '../data/headers';

const svg = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON_PROTECT = svg('M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z');
const ICON_SIGN = svg('M3 17c3-4 5 2 8-2s4-6 6-2M3 21h18');

function ProtectMenu({ ed, close }: { ed: Editor; close(): void }) {
  const [mode, setMode] = useState<'read' | 'comments'>('read');
  const [pw, setPw] = useState('');
  return (
    <div className="menu-list protect-menu">
      <span className="menu-head">Protect this document</span>
      <button type="button" className="menu-item" onClick={() => (ed.setProtection({ final: true }), close())}>
        Mark as final <small className="menu-key">read only, until someone chooses to edit</small>
      </button>
      <span className="menu-head">Restrict editing</span>
      <div className="segmented small" role="group" aria-label="Allow only">
        <button type="button" aria-pressed={mode === 'read'} onClick={() => setMode('read')}>
          No changes
        </button>
        <button type="button" aria-pressed={mode === 'comments'} onClick={() => setMode('comments')}>
          Comments only
        </button>
      </div>
      <label className="field">
        <span>Password (if you like)</span>
        <input type="password" aria-label="Restriction password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      <button
        type="button"
        className="btn small primary"
        onClick={async () => {
          ed.setProtection({ restrict: mode, plock: await makeLock(pw) });
          close();
        }}
      >
        Start protection
      </button>
      <p className="menu-note">Kept in the document, and sent to Word. Tracked changes for everyone are under Track changes ▾.</p>
    </div>
  );
}

function SignMenu({ ed, close }: { ed: Editor; close(): void }) {
  const { settings } = useAppState();
  const [name, setName] = useState(settings.name ?? '');
  const [title, setTitle] = useState('');
  return (
    <form
      className="menu-list"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        ed.insertSignature([name.trim(), title.trim(), `signed ${formatDate(Date.now(), 'long')}`].filter(Boolean).join(' · '));
        close();
      }}
    >
      <span className="menu-head">Signature line</span>
      <label className="field">
        <span>Name</span>
        <input aria-label="Signer’s name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Title (if any)</span>
        <input aria-label="Signer’s title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <button type="submit" className="btn small primary" disabled={!name.trim()}>
        Sign here
      </button>
      <p className="menu-note">The signature remembers the document as it is now, and says if it changes afterwards. (Not a certificate-based digital signature.)</p>
    </form>
  );
}

function Drop({ label, glyph, off, children }: { label: string; glyph: React.ReactNode; off: boolean; children(close: () => void): React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tool-drop">
      <button type="button" aria-label={label} aria-expanded={open} title={label} disabled={off} onClick={() => setOpen(!open)}>
        {glyph}
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <Popover label={label} onClose={() => setOpen(false)}>
          {children(() => {
            setOpen(false);
            closeMore();
          })}
        </Popover>
      )}
    </span>
  );
}

export function protectItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [
    { key: 'protect', label: 'Protect document', pri: 1, node: <Drop label="Protect document" glyph={ICON_PROTECT} off={off}>{(close) => ed && <ProtectMenu ed={ed} close={close} />}</Drop> },
    { key: 'signature', label: 'Signature line', pri: 1, node: <Drop label="Signature line" glyph={ICON_SIGN} off={off}>{(close) => ed && <SignMenu ed={ed} close={close} />}</Drop> },
  ];
}

/** The strip on a protected document: what's allowed, and lifting it (with its password, when it has one). */
export function ProtectBanner({ editor, kind, lock }: { editor: Editor; kind: 'final' | 'read' | 'comments'; lock?: string }) {
  const [asking, setAsking] = useState(false);
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const stop = async () => {
    if (lock && lock !== 'open' && !(await opensLock(lock, pw))) return setError('That isn’t the password.');
    editor.setProtection({ restrict: undefined, plock: undefined });
  };
  return (
    <div className="protect-bar" role="region" aria-label="Protected document">
      <span>{kind === 'final' ? 'Marked as final: an author has finished it, so it opens read only.' : kind === 'comments' ? 'Editing is restricted: you can add comments, but not change the text.' : 'Editing is restricted: this document is read only.'}</span>
      <span className="grow" />
      {kind === 'final' ? (
        <button type="button" className="btn small" onClick={() => editor.setProtection({ final: undefined })}>
          Edit anyway
        </button>
      ) : asking && lock && lock !== 'open' ? (
        <form
          className="protect-unlock"
          onSubmit={(e) => {
            e.preventDefault();
            void stop();
          }}
        >
          <input type="password" aria-label="Password to stop protection" value={pw} autoFocus onChange={(e) => setPw(e.target.value)} />
          <button type="submit" className="btn small primary">
            Stop protection
          </button>
          {error && <span className="error">{error}</span>}
        </form>
      ) : (
        <>
          {kind === 'comments' && (
            <button type="button" className="btn small" onClick={() => editor.onCommentKey?.()}>
              Comment on the selected text
            </button>
          )}
          <button type="button" className="btn small" onClick={() => (lock && lock !== 'open' ? setAsking(true) : void stop())}>
            Stop protection
          </button>
        </>
      )}
    </div>
  );
}
