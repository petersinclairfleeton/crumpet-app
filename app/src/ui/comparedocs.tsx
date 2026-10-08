// Comparing two notes or chapters (from the command palette, like Word's
// Compare): the differences shown, with the two swapped round, or made into a
// new note where they're tracked changes to accept or reject one by one.

import { useAppState, useAppStore } from './hooks';
import { CompareDialog } from './snapshots';
import { plainText, trackedComparison } from '../data/compare';
import { displayTitle } from '../data/selectors';
import { usePanes } from './panes';

export function CompareDocs({ a, b, onSwap, onClose }: { a: string; b: string; onSwap(): void; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const panes = usePanes();
  const find = (id: string) => {
    const n = state.notes.find((x) => x.id === id);
    if (n) return { title: displayTitle(n), doc: n.doc };
    const c = state.chapters.find((x) => x.id === id);
    return c ? { title: c.title.trim() || 'Untitled chapter', doc: c.doc } : null;
  };
  const from = find(a);
  const to = find(b);
  if (!from || !to) return null;
  return (
    <CompareDialog
      label="Compare documents"
      title={
        <>
          From “{from.title}” to “{to.title}”
        </>
      }
      before={plainText(from.doc)}
      after={plainText(to.doc)}
      onClose={onClose}
      actions={
        <span className="compare-actions">
          <button type="button" className="btn quiet small" onClick={onSwap}>
            Swap
          </button>
          <button
            type="button"
            className="btn small"
            title="A new note with the differences as tracked changes, to accept or reject one by one"
            onClick={() => {
              const n = store.createNote({ title: `${from.title} → ${to.title} (compared)`, doc: trackedComparison(from.doc, to.doc, state.settings.name.trim() || 'Compare') });
              panes.open({ kind: 'note', id: n.id });
              onClose();
            }}
          >
            Make a copy with tracked changes
          </button>
        </span>
      }
    />
  );
}
