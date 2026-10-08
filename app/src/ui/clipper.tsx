// The web clipper's two pieces in the app: the bookmark to drag to the
// bookmarks bar (in Settings), and the window that saves a clip as a note.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Clip, bookmarklet, clipDoc, dismissClip, onClip } from '../data/clip';
import { preview } from '../data/selectors';
import { useAppState, useAppStore } from './hooks';
import { IconClose } from './icons';

/** Where this Crumpet lives, for the bookmark to open. */
function appUrl(): string {
  return `${location.origin}${location.pathname}`;
}

export function ClipperSettings() {
  const href = useMemo(() => bookmarklet(appUrl()), []);
  const link = useRef<HTMLAnchorElement>(null);
  // React won't render javascript: links, so the address is set directly.
  useEffect(() => {
    link.current?.setAttribute('href', href);
  }, [href]);
  const local = location.protocol === 'file:';
  return (
    <div className="field clipper" role="group" aria-label="Web clipper">
      <span>Web clipper</span>
      <p className="sync-hint">Save web pages as notes. Drag this button to your browser’s bookmarks bar, then click it on any page. Select part of a page first to keep just that part.</p>
      <a ref={link} className="clip-bookmark" draggable onClick={(e) => e.preventDefault()} title="Drag me to your bookmarks bar">
        ✂ Clip to Crumpet
      </a>
      <p className="sync-hint">If a site won’t let the button work, copy what you want and paste it into a note: headings, lists, links and formatting come too.</p>
      {local && <p className="sync-hint">The clipper needs Crumpet opened from a web address, not a file on this device.</p>}
      <details className="clip-help">
        <summary>On a phone or tablet</summary>
        <p>Add any page as a bookmark, edit it, and paste this as its address:</p>
        <textarea readOnly rows={3} value={href} aria-label="Bookmark address" onFocus={(e) => e.currentTarget.select()} />
      </details>
    </div>
  );
}

/** Shown when the bookmark has sent a page: check the title, pick a notebook, save. */
export function ClipDialog({ onSaved }: { onSaved(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const [clip, setClip] = useState<Clip | null>(null);
  const [title, setTitle] = useState('');
  const [notebook, setNotebook] = useState('');

  useEffect(
    () =>
      onClip((c) => {
        setClip(c);
        if (c) setTitle(c.title.trim() || 'Clipped page');
      }),
    [],
  );
  const doc = useMemo(() => (clip ? clipDoc(clip) : null), [clip]);
  if (!clip || !doc) return null;

  const save = () => {
    const name = title.trim() || 'Clipped page';
    if (notebook.startsWith('project:')) {
      // Into a project's research, opened beside its writing.
      const projectId = notebook.slice('project:'.length);
      store.setView({ kind: 'project', id: projectId });
      store.addResearchNote(projectId, { title: name, doc, tags: ['clipped'] });
    } else store.createNote({ title: name, doc, notebookId: notebook || null, tags: ['clipped'] });
    dismissClip();
    onSaved();
  };
  const text = preview({ id: '', notebookId: null, title: '', doc: { blocks: doc.blocks.slice(1) }, tags: [], favorite: false, createdAt: 0, updatedAt: 0, trashedAt: null }, 400);
  let host = clip.url;
  try {
    host = new URL(clip.url).hostname.replace(/^www\./, '');
  } catch {
    // Keep the address.
  }

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && dismissClip()}>
      <form
        className="dialog clip-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Save clip"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        onKeyDown={(e) => e.key === 'Escape' && dismissClip()}
      >
        <header className="dialog-head">
          <h2>{clip.selection ? 'Save the selected part' : 'Save this page'}</h2>
          <button type="button" className="icon-btn" aria-label="Don’t save" onClick={dismissClip}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <p className="clip-source">From {host}</p>
          <label className="field">
            <span>Title</span>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>Save to</span>
            <select value={notebook} onChange={(e) => setNotebook(e.target.value)}>
              <option value="">No notebook</option>
              {state.notebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  {nb.name}
                </option>
              ))}
              {state.projects.length > 0 && (
                <optgroup label="Research for a project">
                  {state.projects.map((p) => (
                    <option key={p.id} value={`project:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <p className="clip-preview">{text || 'Nothing but pictures.'}</p>
          <div className="clip-actions">
            <button type="button" className="btn" onClick={dismissClip}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              Save note
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
