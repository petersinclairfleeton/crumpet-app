// The sidebar's Bookmarks: shortcuts to notes, chapters, projects and
// headings. Click to open, middle-click for a new tab, drag into a pane.

import { useAppState, useAppStore } from './hooks';
import { type Bookmark, bookmarkLabel, sameBookmark } from '../data/bookmarks';
import { useOpener } from './finder';
import { tabDrag } from './tabdrag';
import { IconBook, IconClose, IconNote, IconPage } from './icons';

const glyph = (b: Bookmark) => (b.kind === 'project' ? <IconBook size={12} /> : b.kind === 'chapter' ? <IconPage size={12} /> : b.kind === 'heading' ? <span className="bookmark-hash">#</span> : <IconNote size={12} />);

export function Bookmarks() {
  const state = useAppState();
  const store = useAppStore();
  const opener = useOpener();
  const list = (state.settings.bookmarks ?? []).map((b) => ({ b, label: bookmarkLabel(state, b) })).filter((x) => x.label);
  if (!list.length) return null;
  return (
    <section className="side-section" aria-label="Bookmarks">
      <h2 className="side-label">Bookmarks</h2>
      {list.map(({ b, label }) => (
        <div key={`${b.kind}:${b.id}:${b.block ?? ''}`} className="side-row bookmark-row">
          <button
            type="button"
            className="bookmark-open"
            title={label!.where ? `${label!.title} · ${label!.where}` : label!.title}
            onClick={() => opener.bookmark(b)}
            onAuxClick={(e) => e.button === 1 && opener.bookmark(b, 'tab')}
            {...tabDrag(b.kind === 'heading' ? (state.notes.some((n) => n.id === b.id) ? { kind: 'note', id: b.id } : { kind: 'chapter', id: b.id }) : { kind: b.kind, id: b.id })}
          >
            {glyph(b)}
            <span className="ellipsis">{label!.title}</span>
            {label!.where && <span className="bookmark-where ellipsis">{label!.where}</span>}
          </button>
          <button type="button" className="icon-btn row-more" aria-label={`Remove bookmark ${label!.title}`} title="Remove bookmark" onClick={() => store.updateSettings({ bookmarks: (state.settings.bookmarks ?? []).filter((x) => !sameBookmark(x, b)) })}>
            <IconClose size={11} />
          </button>
        </div>
      ))}
    </section>
  );
}
