// Share with readers: a note, a chapter or a whole book as a Google Doc that
// anyone with the link can comment on (or only read), in a folder of its own
// in your Google Drive; then Bring back comments puts what readers said on
// your text, as Crumpet comments. Each share is a copy as the text stood then.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { type Shared, bringBack, bringBackBook, readerComments, shareCopy } from '../data/share';
import { projectChapters } from '../data/selectors';
import type { AppStore } from '../data/store';
import type { Project } from '../data/types';
import { finalDoc, noteDocx, projectDocx } from '../data/wordfiles';
import { BUILT_IN_CLIENT_ID, googleReady } from '../sync/connection';
import { useAppState, useAppStore } from './hooks';
import { IconClose, IconCopy } from './icons';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** What's being shared. */
export type ShareWhat = { kind: 'note'; id: string } | { kind: 'chapter'; id: string } | { kind: 'book'; id: string };

/** Its title, and a Word file of it as it reads (changes accepted, without your comments, so only readers' come back). */
async function wordCopy(store: AppStore, what: ShareWhat): Promise<{ title: string; bytes: Uint8Array } | null> {
  const state = store.getState();
  if (what.kind === 'note') {
    const note = store.note(what.id);
    return note ? { title: note.title.trim() || 'Untitled', bytes: await noteDocx(state, { ...note, doc: finalDoc(note.doc) }) } : null;
  }
  if (what.kind === 'book') {
    const project = store.project(what.id);
    return project ? { title: project.name, bytes: await projectDocx(state, project, { titlePage: true, partHeadings: true, notes: false }) } : null;
  }
  const chapter = store.chapter(what.id);
  const project = chapter && store.project(chapter.projectId);
  if (!chapter || !project) return null;
  const one: Project = { ...project, outline: [{ type: 'chapter', id: chapter.id }] };
  return { title: `${project.name}: ${chapter.title || 'Untitled chapter'}`, bytes: await projectDocx(state, one, { notes: false }) };
}

/** Readers' comments, brought back onto the note, chapter or book they're on. */
async function fetchBack(store: AppStore, share: Shared, what: ShareWhat): Promise<string> {
  const found = await readerComments(share.docId, await googleReady());
  const fresh = found.filter((c) => !(share.brought ?? []).includes(c.id) && !c.resolved && c.text);
  if (!fresh.length) return found.length ? 'No new comments since you last looked.' : 'No comments yet.';
  let placed = 0;
  let unplaced = 0;
  let brought: string[] = [];
  if (what.kind === 'note') {
    const note = store.note(what.id);
    if (!note) return 'The note is gone.';
    const r = bringBack(note.doc, fresh);
    store.setDoc(note.id, r.doc);
    ({ placed, unplaced, brought } = r);
  } else if (what.kind === 'chapter') {
    const chapter = store.chapter(what.id);
    if (!chapter) return 'The chapter is gone.';
    const r = bringBack(chapter.doc, fresh);
    store.setChapterDoc(chapter.id, r.doc);
    ({ placed, unplaced, brought } = r);
  } else {
    const project = store.project(what.id);
    if (!project) return 'The book is gone.';
    const list = projectChapters(project, store.getState().chapters).map(({ chapter }) => ({ id: chapter.id, doc: chapter.doc }));
    const r = bringBackBook(list, fresh);
    for (const [id, doc] of r.docs) store.setChapterDoc(id, doc);
    ({ placed, unplaced, brought } = r);
  }
  const shares = store.getState().settings.shares ?? [];
  store.updateSettings({ shares: shares.map((s) => (s.docId === share.docId ? { ...s, brought: [...(s.brought ?? []), ...brought] } : s)) });
  const n = placed + unplaced;
  return `${n} comment${n === 1 ? '' : 's'} brought back${unplaced ? ` (${unplaced} on words that have since changed, put at the start, quoting them)` : ''}. They’re in the comments beside the text.`;
}

export function ShareDialog({ what, onClose }: { what: ShareWhat; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const [access, setAccess] = useState<'comment' | 'view'>('comment');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState('');
  const shares = (state.settings.shares ?? []).filter((s) => s.of === what.id).sort((a, b) => b.at - a.at);
  const can = !!BUILT_IN_CLIENT_ID;
  const name = what.kind === 'note' ? 'note' : what.kind === 'chapter' ? 'chapter' : 'book';

  const make = async () => {
    setBusy(true);
    setMessage('');
    try {
      // Asked for first, from the click, so Google's sign-in window isn't blocked.
      const getToken = await googleReady();
      const copy = await wordCopy(store, what);
      if (!copy) throw new Error(`The ${name} is gone.`);
      const shared = await shareCopy({ of: what.id, title: copy.title, docx: new Blob([copy.bytes as BlobPart], { type: DOCX }), access, getToken });
      store.updateSettings({ shares: [...(store.getState().settings.shares ?? []), shared] });
      setMessage('Copied the link: paste it to your readers.');
      void navigator.clipboard?.writeText(shared.url).catch(() => undefined);
      setCopied(shared.docId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(false);
    }
  };
  const back = async (s: Shared) => {
    setBusy(true);
    setMessage('');
    try {
      setMessage(await fetchBack(store, s, what));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(false);
    }
  };
  const copy = (s: Shared) => {
    void navigator.clipboard?.writeText(s.url).catch(() => undefined);
    setCopied(s.docId);
  };

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog share-dialog" role="dialog" aria-modal="true" aria-label="Share with readers" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <header className="dialog-head">
          <h2>Share with readers</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <p className="sync-hint">
            Crumpet puts a copy of this {name} in your Google Drive (in a folder called “Crumpet – shared copies”) as a Google Doc, and gives you its link. Beta readers, an editor or your writing group open the link in their browser, no Crumpet needed. Your own notes and files aren’t shared.
          </p>
          {!can ? (
            <p className="error">Sharing needs Google sign-in, which isn’t set up in this copy of Crumpet.</p>
          ) : (
            <>
              <div className="segmented" role="radiogroup" aria-label="Readers can">
                <button type="button" role="radio" aria-checked={access === 'comment'} onClick={() => setAccess('comment')}>
                  Read and comment
                </button>
                <button type="button" role="radio" aria-checked={access === 'view'} onClick={() => setAccess('view')}>
                  Only read
                </button>
              </div>
              <button type="button" className="btn primary" disabled={busy} onClick={() => void make()}>
                {busy ? 'Working…' : shares.length ? 'Share a new copy' : 'Make a link'}
              </button>
            </>
          )}
          {message && (
            <p className="share-message" role="status">
              {message}
            </p>
          )}
          {shares.length > 0 && (
            <ul className="share-list" aria-label="Shared copies">
              {shares.map((s) => (
                <li key={s.docId}>
                  <div className="grow">
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.title}
                    </a>
                    <small>
                      {new Date(s.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {s.access === 'comment' ? 'readers can comment' : 'read only'}
                      {s.brought?.length ? ` · ${s.brought.length} comment${s.brought.length === 1 ? '' : 's'} brought back` : ''}
                    </small>
                  </div>
                  <button type="button" className="btn small" onClick={() => copy(s)}>
                    <IconCopy size={13} /> {copied === s.docId ? 'Copied' : 'Copy link'}
                  </button>
                  {s.access === 'comment' && (
                    <button type="button" className="btn small" disabled={busy} onClick={() => void back(s)}>
                      Bring back comments
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="sync-hint">To stop sharing a copy, delete it in Google Drive (or change who can open it there).</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
