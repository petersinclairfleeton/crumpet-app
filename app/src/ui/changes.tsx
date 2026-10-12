// Track changes, like Word's: when it's on, what you type is underlined and
// what you delete is struck through, so someone can accept or reject each
// change (or all of them) later. Tracking is just for you (on this device),
// or for everyone who edits the document (saved in it), and can be locked
// with a password so it can't be turned off, nor changes accepted or rejected.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { type Change, type Doc, changes } from '@crumpet/editor/model';
import { REVISIONS, revisionColor } from '../data/revisions';
import { useAppState, useAppStore } from './hooks';
import { MarkupSelect } from './review';
import { Popover } from './Sidebar';
import { useSpelling } from './spelling';
import { usePictureActions } from './picture';
import { useClipboard } from './clipboard';

interface Open {
  where: { block: string; from: number; to: number };
  change: Change;
  el: HTMLElement;
}

function when(at: number): string {
  if (!at) return '';
  const d = new Date(at);
  return new Date().toDateString() === d.toDateString() ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Keeps the editor tracking (or not), in revision mode, checking spelling and correcting as Settings say. */
export function useTracking(editor: Editor | null): void {
  const state = useAppState();
  const forAll = useDocTracking(editor).all;
  const on = !!state.settings.trackChanges || forAll;
  const author = state.settings.name.trim() || 'You';
  useEffect(() => {
    editor?.setTracking(on ? author : null);
  }, [editor, on, author]);
  useEffect(() => {
    if (!editor) return;
    editor.onLockedReview = () => alert('Tracking is locked in this document. Unlock it from the Track changes menu (▾) to accept or reject changes.');
    return () => {
      editor.onLockedReview = null;
    };
  }, [editor]);
  // Revision mode: typing in the round's colour.
  const color = revisionColor(state.settings.revision);
  useEffect(() => {
    if (editor) editor.revisionColor = color;
  }, [editor, color]);
  useSpelling(editor);
  usePictureActions(editor);
  useClipboard(editor);
  // Markup view: how changes and comments are shown.
  const markup = state.settings.markup ?? 'all';
  useEffect(() => {
    if (!editor) return;
    if (markup === 'all') delete editor.view.root.dataset.markup;
    else editor.view.root.dataset.markup = markup;
    // What's shown takes more or less room on the pages.
    editor.repaginate();
  }, [editor, markup]);
  // Show Markup: what's hidden, by kind and by person (one stylesheet for every editor).
  const hide = state.settings.markupHide;
  useEffect(() => {
    const id = 'crumpet-markup-hide';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = markupHideCss(hide);
    editor?.repaginate();
  }, [editor, hide]);
  // AutoCorrect, as Settings → Writing says.
  const autocorrect = state.settings.autocorrect;
  useEffect(() => {
    if (editor) editor.autocorrect = autocorrect ?? {};
  }, [editor, autocorrect]);
}

/** CSS that hides markup, by kind and by person: changes shown as if made (or not), comments without their highlight. */
export function markupHideCss(hide: { changes?: boolean; comments?: boolean; people?: string[] } | undefined): string {
  const who = (hide?.people ?? []).map((p) => `[data-author="${CSS.escape(p)}"]`);
  const ins = [...(hide?.changes ? [''] : []), ...who].map((w) => `.editor ins.trk${w}`);
  const del = [...(hide?.changes ? [''] : []), ...who].map((w) => `.editor del.trk${w}`);
  const cmt = [...(hide?.comments ? [''] : []), ...who].map((w) => `.editor mark.cmt${w}`);
  return [ins.length ? `${ins.join(', ')} { text-decoration: none; color: inherit; }` : '', del.length ? `${del.join(', ')} { display: none; }` : '', cmt.length ? `${cmt.join(', ')} { background: none; border-bottom: none; }` : ''].join('\n');
}

/** The document's own tracking settings (for everyone, locked), kept up to date as it changes. */
export function useDocTracking(editor: Editor | null): { all: boolean; lock?: string } {
  const read = () => (editor ? editor.docTracking : { all: false });
  const [now, setNow] = useState(read);
  useEffect(() => {
    setNow(read());
    if (!editor) return;
    return editor.onChange(() => {
      const next = editor.docTracking;
      setNow((was) => (was.all === next.all && was.lock === next.lock ? was : next));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
  return now;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A lock for tracking: a salted hash of the password ('open' when there's none). */
export async function makeLock(password: string): Promise<string> {
  if (!password) return 'open';
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  return salt + (await hashPassword(password, salt));
}

/** Whether a password opens a lock. */
export async function opensLock(lock: string, password: string): Promise<boolean> {
  if (lock === 'open') return true;
  return (await hashPassword(password, lock.slice(0, 16))) === lock.slice(16);
}

/** Tracking: just mine or everyone's, and locking it. */
function TrackMenu({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const doc = useDocTracking(editor);
  const [asking, setAsking] = useState<'lock' | 'unlock' | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const mine = !!state.settings.trackChanges;
  const set = (how: 'off' | 'mine' | 'all') => {
    if (doc.lock) return;
    store.updateSettings({ trackChanges: how === 'mine' || (how === 'all' && mine) });
    editor.setDocTracking({ track: how === 'all' ? 'all' : undefined });
    onClose();
  };
  const submit = async () => {
    if (asking === 'lock') {
      if (pw !== pw2) return setError('The two passwords aren’t the same.');
      editor.setDocTracking({ track: 'all', lock: await makeLock(pw) });
      onClose();
    } else if (asking === 'unlock' && doc.lock) {
      if (!(await opensLock(doc.lock, pw))) return setError('That isn’t the password.');
      editor.setDocTracking({ lock: undefined });
      onClose();
    }
  };
  const now = doc.all ? 'all' : mine ? 'mine' : 'off';
  if (asking)
    return (
      <form
        className="track-lock"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="sync-hint">{asking === 'lock' ? 'Everyone’s changes are tracked, and tracking can’t be turned off, nor changes accepted or rejected, without the password. Leave it empty to lock without one.' : doc.lock === 'open' ? 'This lock has no password.' : 'The password it was locked with:'}</p>
        {(asking === 'lock' || doc.lock !== 'open') && <input type="password" aria-label="Password" placeholder="Password" value={pw} autoFocus onChange={(e) => (setPw(e.target.value), setError(''))} />}
        {asking === 'lock' && <input type="password" aria-label="Password again" placeholder="Password again" value={pw2} onChange={(e) => (setPw2(e.target.value), setError(''))} />}
        {error && (
          <p className="sync-hint goto-error" role="status">
            {error}
          </p>
        )}
        <div className="comment-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <span className="grow" />
          <button type="submit" className="btn primary">
            {asking === 'lock' ? 'Lock' : 'Unlock'}
          </button>
        </div>
      </form>
    );
  return (
    <>
      {(
        [
          ['off', 'Off'],
          ['mine', 'Just mine (on this device)'],
          ['all', 'Everyone’s (saved in this document)'],
        ] as const
      ).map(([how, label]) => (
        <button key={how} type="button" role="menuitemradio" aria-checked={now === how} className={`menu-item${now === how ? ' on' : ''}`} disabled={!!doc.lock && how !== 'all'} onClick={() => set(how)}>
          {label}
        </button>
      ))}
      <hr className="menu-sep" />
      {doc.lock ? (
        <button type="button" className="menu-item" onClick={() => setAsking('unlock')}>
          Unlock tracking…
        </button>
      ) : (
        <button type="button" className="menu-item" onClick={() => setAsking('lock')}>
          Lock tracking…
        </button>
      )}
    </>
  );
}

/** The button that turns tracking on and off, and its menu (just mine or everyone's, locking). */
export function TrackToggle({ editor = null }: { editor?: Editor | null }) {
  const state = useAppState();
  const store = useAppStore();
  const doc = useDocTracking(editor);
  const [menu, setMenu] = useState(false);
  if (doc.all)
    return (
      <span className="track-wrap">
        <button type="button" className="track-toggle on" aria-pressed="true" aria-expanded={menu} data-tip={doc.lock ? 'Tracking is locked for everyone in this document' : 'Tracking everyone’s changes in this document'} onClick={() => setMenu(!menu)}>
          {doc.lock ? '🔒 ' : ''}Tracking for everyone
        </button>
        {menu && editor && (
          <Popover label="Track changes" onClose={() => setMenu(false)}>
            <TrackMenu editor={editor} onClose={() => setMenu(false)} />
          </Popover>
        )}
      </span>
    );
  return <TrackToggleMine editor={editor} menu={menu} setMenu={setMenu} state={state} store={store} />;
}

function TrackToggleMine({ editor, menu, setMenu, state, store }: { editor: Editor | null; menu: boolean; setMenu(v: boolean): void; state: ReturnType<typeof useAppState>; store: ReturnType<typeof useAppStore> }) {
  const on = !!state.settings.trackChanges;
  return (
    <span className="track-wrap">
    <button type="button" className={`track-toggle${on ? ' on' : ''}`} aria-pressed={on} data-tip={on ? 'Tracking changes: click to stop' : 'Track changes: mark what’s added and deleted'} onClick={() => store.updateSettings({ trackChanges: !on })}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20h4L19 9l-4-4L4 16v4z" />
        <path d="M13 7l4 4" />
      </svg>
      {on ? 'Tracking changes' : 'Track changes'}
    </button>
      {editor && (
        <button type="button" className="track-more" aria-label="Tracking options" aria-expanded={menu} data-tip="Just mine or everyone’s; lock tracking" onClick={() => setMenu(!menu)}>
          ▾
        </button>
      )}
      {menu && editor && (
        <Popover label="Track changes" onClose={() => setMenu(false)}>
          <TrackMenu editor={editor} onClose={() => setMenu(false)} />
        </Popover>
      )}
    </span>
  );
}

/** While revising: which round, in its colour; click to stop. */
export function RevisionChip() {
  const state = useAppState();
  const store = useAppStore();
  const round = state.settings.revision ?? 0;
  const r = REVISIONS[round - 1];
  if (!r) return null;
  return (
    <button type="button" className="revision-chip" style={{ '--rev': r.color } as React.CSSProperties} data-tip="Revision mode: what you type is in this colour. Click to stop." onClick={() => store.updateSettings({ revision: 0 })}>
      {r.name} revision
    </button>
  );
}

/** How many changes there are, with Accept all and Reject all. */
export function ChangesBar({ doc, editor }: { doc: Doc; editor: Editor | null }) {
  const n = changes(doc).length;
  if (!n || !editor) return null;
  return (
    <div className="changes-bar" role="region" aria-label="Tracked changes">
      <span>
        {n} tracked change{n === 1 ? '' : 's'}
      </span>
      <span className="grow" />
      <MarkupSelect />
      <button type="button" className="btn" onClick={() => editor.resolveChanges(false)}>
        Reject all
      </button>
      <button type="button" className="btn primary" onClick={() => editor.resolveChanges(true)}>
        Accept all
      </button>
    </div>
  );
}

/** The card for one change: who made it, and Accept or Reject. */
export function ChangeCard({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    editor.onChangeClick = (hit, el) => setOpen({ where: { block: hit.block, from: hit.from, to: hit.to }, change: hit.change, el });
    return () => {
      editor.onChangeClick = null;
    };
  }, [editor]);

  useLayoutEffect(() => {
    if (!open) return setAt(null);
    const r = open.el.getBoundingClientRect();
    const w = 260;
    setAt({ top: r.bottom + 6, left: Math.min(window.innerWidth - w - 8, Math.max(8, r.left)) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!card.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open || !editor) return null;
  const resolve = (accept: boolean) => {
    editor.resolveChanges(accept, open.where);
    setOpen(null);
  };
  const c = open.change;
  const what = open.where.from < 0 ? 'paragraph break' : 'text';
  return createPortal(
    <div ref={card} className="change-card" role="dialog" aria-label={`${c.kind === 'ins' ? 'Added' : 'Deleted'} ${what}`} style={at ? { top: at.top, left: at.left } : { visibility: 'hidden', top: 0, left: 0 }}>
      <p>
        <b>{c.kind === 'ins' ? 'Added' : 'Deleted'}</b>
        {open.where.from < 0 ? ' a paragraph break' : ''} by {c.author || 'someone'}
        {c.at ? <small> · {when(c.at)}</small> : null}
      </p>
      <div className="comment-actions">
        <button type="button" className="btn" onClick={() => resolve(false)}>
          Reject
        </button>
        <span className="grow" />
        <button type="button" className="btn primary" onClick={() => resolve(true)}>
          Accept
        </button>
      </div>
    </div>,
    document.body,
  );
}
