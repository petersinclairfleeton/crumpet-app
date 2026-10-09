// The right sidebar's Snapshots tab, like Scrivener's: take a snapshot of the
// note or chapter before a big change, compare it with the text now, or go
// back to it (the text it replaces is kept as a snapshot too). It also lists
// the versions kept automatically while writing (version history), by day.

import { useMemo, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { type Doc, runsText } from '@crumpet/editor/model';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { useAppState, useAppStore } from './hooks';
import { type Snapshot, compareTexts } from '../data/snapshots';
import { IconClose } from './icons';

const docText = (doc: Doc) =>
  doc.blocks
    .map((b) => (b.type === 'table' ? (b.rows ?? []).map((r) => r.join(' | ')).join('\n') : runsText(b.runs.filter((r) => r.change?.kind !== 'del'))))
    .join('\n\n');

const plural = (n: number) => `${n.toLocaleString()} word${n === 1 ? '' : 's'}`;
const dayOf = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};
const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function SnapshotsPanel({ docId, editor }: { docId: string; editor: Editor }) {
  const state = useAppState();
  const store = useAppStore();
  const [name, setName] = useState('');
  const [asking, setAsking] = useState<null | { id: string; what: 'restore' | 'delete' }>(null);
  const [comparing, setComparing] = useState<Snapshot | null>(null);
  const [showAuto, setShowAuto] = useState(true);
  const all = state.snapshots.filter((s) => s.docId === docId);
  const list = all.filter((s) => showAuto || !s.auto);
  const versions = all.filter((s) => s.auto).length;
  const keeping = state.settings.autoVersions !== false;
  const known = state.notes.some((n) => n.id === docId) || state.chapters.some((c) => c.id === docId);
  if (!known) return <p className="right-empty">Snapshots are for notes and chapters.</p>;
  return (
    <div className="snapshots">
      <form
        className="snapshot-take"
        onSubmit={(e) => {
          e.preventDefault();
          store.takeSnapshot(docId, name);
          setName('');
        }}
      >
        <input type="text" value={name} placeholder="Name (optional)" aria-label="Snapshot name" onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn small">
          Take snapshot
        </button>
      </form>
      <div className="snapshot-options">
        <label className="check-row">
          <input type="checkbox" checked={keeping} onChange={(e) => store.updateSettings({ autoVersions: e.target.checked })} /> Keep versions while I write
        </label>
        {versions > 0 && (
          <label className="check-row">
            <input type="checkbox" checked={showAuto} onChange={(e) => setShowAuto(e.target.checked)} /> Show {versions} automatic version{versions === 1 ? '' : 's'}
          </label>
        )}
      </div>
      {list.length === 0 && <p className="right-empty">No snapshots yet. Take one before a big rewrite, to compare with or go back to later.{keeping ? ' Versions are also kept as you write (every ten minutes or so).' : ''}</p>}
      <ul className="snapshot-list">
        {list.map((s, i) => (
          <li key={s.id} className={s.auto ? 'auto' : undefined}>
            {(i === 0 || dayOf(list[i - 1].at) !== dayOf(s.at)) && <h4 className="snapshot-day">{dayOf(s.at)}</h4>}
            <div className="snapshot-name">{s.auto ? <>Version <span className="snapshot-tag">automatic</span></> : s.name || 'Snapshot'}</div>
            <div className="snapshot-meta">
              {when(s.at)} · {s.words.toLocaleString()} word{s.words === 1 ? '' : 's'}
            </div>
            {asking?.id === s.id ? (
              <div className="snapshot-ask" role="group" aria-label="Are you sure?">
                <span>{asking.what === 'restore' ? 'Go back to this version? The text now is kept as a snapshot.' : 'Delete this snapshot?'}</span>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    if (asking.what === 'restore') store.restoreSnapshot(s.id);
                    else store.deleteSnapshot(s.id);
                    setAsking(null);
                  }}
                >
                  {asking.what === 'restore' ? 'Go back' : 'Delete'}
                </button>
                <button type="button" className="btn quiet small" onClick={() => setAsking(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="snapshot-actions">
                <button type="button" className="link-btn" onClick={() => setComparing(s)}>
                  Compare
                </button>
                <button type="button" className="link-btn" onClick={() => setAsking({ id: s.id, what: 'restore' })}>
                  Go back to this
                </button>
                <button type="button" className="link-btn danger" onClick={() => setAsking({ id: s.id, what: 'delete' })}>
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {comparing && (
        <CompareDialog
          label="Compare with snapshot"
          title={
            <>
              Since {comparing.auto ? 'the version' : `“${comparing.name || 'Snapshot'}”`} <small>{when(comparing.at)}</small>
            </>
          }
          before={docText(fromMarkdown(comparing.md))}
          after={docText(editor.state.doc)}
          onClose={() => setComparing(null)}
        />
      )}
    </div>
  );
}

/** Two texts compared: what's been taken out, and what's been added. */
export function CompareDialog({ label, title, before, after, onClose, actions }: { label: string; title: React.ReactNode; before: string; after: string; onClose(): void; actions?: React.ReactNode }) {
  const parts = useMemo(() => compareTexts(before, after), [before, after]);
  const added = parts.filter((p) => p.kind === 'add').reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);
  const removed = parts.filter((p) => p.kind === 'del').reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="dialog compare-dialog" role="dialog" aria-modal="true" aria-label={label}>
        <header className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} autoFocus>
            <IconClose />
          </button>
        </header>
        <p className="compare-key">
          <span className="key-add">{plural(added)} added</span> <span className="key-del">{plural(removed)} taken out</span>
          {actions}
        </p>
        <div className="compare-text">
          {parts.length === 0 || parts.every((p) => p.kind === 'same') ? <span className="compare-same">No differences.</span> : null}
          {parts.map((p, i) => (p.kind === 'add' ? <ins key={i}>{p.text}</ins> : p.kind === 'del' ? <del key={i}>{p.text}</del> : <span key={i}>{p.text}</span>))}
        </div>
      </div>
    </div>
  );
}
