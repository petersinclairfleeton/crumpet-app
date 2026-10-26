// The right sidebar, like Obsidian's: helpers for what you're writing, each
// in a tab: the headings outline, the Styles pane, the Reviewing pane
// (changes and comments), and links.

import { kindInfo } from '../data/world';
import { bookCast } from '../data/series';
import { Popover } from './Sidebar';
import { useEffect, useState } from 'react';
import type { Block } from '@crumpet/editor/model';
import type { Editor } from '@crumpet/editor/editor';
import { useAppState, useAppStore, useNav } from './hooks';
import { useHelped } from './helpers';
import { StylesPane } from './stylespane';
import { ReviewPane } from './review';
import { ClipboardPane } from './clipboard';
import { SelectionPane } from './selectionpane';
import { WebSearchTab } from './websearch';
import { FoldButton } from './fold';
import { SnapshotsPanel } from './snapshots';
import { backlinks, findByTitle, linkedTitles } from '../data/links';
import { displayTitle, preview } from '../data/selectors';
import { useMedia as useCastPicture } from './cast';
import { WritingTab } from './writingtab';
import { PagesTab } from './thumbs';
import { CheckTab } from './checks';
import { ThesaurusTab } from './thesaurus';
import { sameBookmark, toggleBookmark } from '../data/bookmarks';
import { appearances } from '../data/cast';
import { docOwner } from '../data/drafts';

export type RightTab = 'chapter' | 'notes' | 'outline' | 'pages' | 'check' | 'styles' | 'comments' | 'links' | 'snapshots' | 'writing' | 'thesaurus' | 'clipboard' | 'objects' | 'search';
const TABS: { key: RightTab; label: string }[] = [
  { key: 'chapter', label: 'In this chapter' },
  { key: 'notes', label: 'Notes' },
  { key: 'outline', label: 'Outline' },
  { key: 'pages', label: 'Pages' },
  { key: 'styles', label: 'Styles' },
  { key: 'comments', label: 'Review' },
  { key: 'links', label: 'Links' },
  { key: 'snapshots', label: 'Snapshots' },
  { key: 'writing', label: 'Writing' },
  { key: 'check', label: 'Check' },
  { key: 'thesaurus', label: 'Thesaurus' },
  { key: 'clipboard', label: 'Clipboard' },
  { key: 'objects', label: 'Selection' },
  { key: 'search', label: 'Search' },
];

/** Redraws when the editor's text changes. */
function useEdits(editor: Editor | null): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const off = editor.onChange(() => setTick((t) => t + 1));
    // Catch a change made between drawing and listening.
    setTick((t) => t + 1);
    return off;
  }, [editor]);
}

export function RightSidebar() {
  const state = useAppState();
  const store = useAppStore();
  const helped = useHelped();
  // In a book's chapter, the first tab shows who and where the chapter mentions.
  const chapter = helped ? state.chapters.find((c) => c.id === docOwner(helped.docId)) : undefined;
  // (A book's notes, its research, are a tab beside a chapter in the calm look.)
  const calmBook = !!chapter && !state.settings.toolbarAll;
  const tabs = (chapter ? TABS : TABS.filter((t) => t.key !== 'chapter')).filter((t) => t.key !== 'notes' || calmBook);
  const chosen: RightTab = state.settings.layout?.rightTab ?? (chapter ? 'chapter' : 'outline');
  const tab: RightTab = chosen === 'chapter' && !chapter ? 'outline' : chosen;
  // The calm look shows three tabs (and the one open); the rest wait under More.
  const calm = !state.settings.toolbarAll;
  const main: RightTab[] = chapter ? (calm ? ['chapter', 'notes', 'comments'] : ['chapter', 'outline', 'comments']) : ['outline', 'comments', 'links'];
  // Beside a chapter the calm inspector calls Review "Comments", as the design does.
  const label = (t: { key: RightTab; label: string }) => (calmBook && t.key === 'comments' ? 'Comments' : t.label);
  const shownTabs = calm ? tabs.filter((t) => main.includes(t.key) || t.key === tab) : tabs;
  const moreTabs = tabs.filter((t) => !shownTabs.includes(t));
  const [more, setMore] = useState(false);
  useEdits(helped?.editor ?? null);
  return (
    <aside className="right-side" aria-label="Right sidebar">
      <header className="right-head">
        <div className={`right-tabs${calm ? ' calm' : ''}`} role="tablist" aria-label="Helpers">
          {shownTabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => store.updateLayout({ rightTab: t.key })}>
              {label(t)}
            </button>
          ))}
          {moreTabs.length > 0 && (
            <span className="right-more">
              <button type="button" aria-expanded={more} aria-label="More helpers" onClick={() => setMore(!more)}>
                {calm ? '···' : 'More ▾'}
              </button>
              {more && (
                <Popover label="More helpers" onClose={() => setMore(false)}>
                  {moreTabs.map((t) => (
                    <button key={t.key} type="button" className="menu-item" onClick={() => (setMore(false), store.updateLayout({ rightTab: t.key }))}>
                      {t.label}
                    </button>
                  ))}
                </Popover>
              )}
            </span>
          )}
        </div>
        <FoldButton what="right" />
      </header>
      <div className="right-body" role="tabpanel" aria-label={TABS.find((t) => t.key === tab)!.label}>
        {!helped ? <p className="right-empty">Open a note or chapter to see its {tab === 'styles' ? 'styles' : tab} here.</p> : tab === 'chapter' && chapter ? <InThisChapter chapterId={chapter.id} calm={calm} /> : tab === 'notes' && chapter ? <BookNotes projectId={chapter.projectId} /> : tab === 'outline' ? <Outline editor={helped.editor} docId={helped.docId} /> : tab === 'pages' ? <PagesTab editor={helped.editor} /> : tab === 'check' ? <CheckTab editor={helped.editor} /> : tab === 'styles' ? <StylesPane embedded editor={helped.editor} sheet={helped.sheet} onSheet={helped.onSheet} onEditStyles={helped.onEditStyles} onClose={() => store.updateLayout({ right: false })} /> : tab === 'comments' ? <ReviewPane editor={helped.editor} /> : tab === 'snapshots' ? <SnapshotsPanel docId={helped.docId} editor={helped.editor} /> : tab === 'writing' ? <WritingTab key={helped.docId} editor={helped.editor} docId={helped.docId} /> : tab === 'thesaurus' ? <ThesaurusTab editor={helped.editor} /> : tab === 'clipboard' ? <ClipboardPane editor={helped.editor} /> : tab === 'objects' ? <SelectionPane editor={helped.editor} /> : tab === 'search' ? <WebSearchTab editor={helped.editor} docId={helped.docId} /> : <Links docId={helped.docId} />}
      </div>
    </aside>
  );
}

/** The characters and places a chapter mentions, most mentioned first, as cards to open. */
function InThisChapter({ chapterId, calm = false }: { chapterId: string; calm?: boolean }) {
  const state = useAppState();
  const store = useAppStore();
  const chapter = state.chapters.find((c) => c.id === chapterId);
  const project = chapter && state.projects.find((p) => p.id === chapter.projectId);
  if (!chapter || !project) return null;
  const everyone = bookCast(state.projects, project);
  const found = appearances(everyone, [chapter]);
  const here = everyone
    .map((m) => ({ m, count: found.get(m.id)?.[0]?.count ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  if (!here.length)
    return <p className="right-empty">{project.cast?.length ? 'None of the book’s characters or places are named in this chapter yet.' : 'Characters and places you add to the book show here when a chapter names them.'}</p>;
  return (
    <ul className="chapter-cast">
      {here.map(({ m, count }) => (
        <li key={m.id}>
          <button type="button" className={`cast-card${m.picture ? ' with-picture' : ''}`} onClick={() => store.openCast(m.id)}>
            {calm && m.picture && <CastPicture src={m.picture} />}
            <span className="cast-card-head">
              <b>{m.name}</b>
              <small>{kindInfo(m.kind).name}</small>
            </span>
            {m.description && <span className="cast-card-text">{m.description}</span>}
            {!calm && <small className="cast-card-count">Named {count === 1 ? 'once' : `${count} times`}</small>}
          </button>
        </li>
      ))}
      {calm && (
        <li>
          <button type="button" className="link-btn cast-all" onClick={() => store.updateLayout({ list: true })}>
            All characters and places
          </button>
        </li>
      )}
    </ul>
  );
}

function CastPicture({ src }: { src: string }) {
  const url = useCastPicture(src);
  return url ? <img className="cast-card-picture" src={url} alt="" /> : null;
}

/** A book's research notes, beside its chapters (the calm inspector's Notes tab). */
function BookNotes({ projectId }: { projectId: string }) {
  const state = useAppState();
  const store = useAppStore();
  const linked = new Set(store.linkedNotes(projectId).map((n) => n.id));
  const notes = state.notes.filter((n) => ((n.projectId === projectId && n.trashedAt === null) || linked.has(n.id))).sort((a, b) => b.updatedAt - a.updatedAt);
  if (!notes.length) return <p className="right-empty">The book’s research notes show here: add them under Research in the outline, link a note from your notebooks there, or drag a note onto the book.</p>;
  return (
    <ul className="chapter-cast">
      {notes.map((n) => (
        <li key={n.id}>
          <button type="button" className="cast-card" onClick={() => store.openResearch(n.id)}>
            <span className="cast-card-head">
              <b>{displayTitle(n)}</b>
              <small>{linked.has(n.id) ? 'Linked note' : 'Note'}</small>
            </span>
            <span className="cast-card-text">{preview(n)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const headingText = (b: Block) =>
  b.runs
    .filter((r) => r.change?.kind !== 'del' && !r.footnote)
    .map((r) => r.text)
    .join('')
    .trim();

/** The headings, indented by level; the one you're in is marked. Click one to go there. */
function Outline({ editor, docId }: { editor: Editor; docId: string }) {
  const state = useAppState();
  const store = useAppStore();
  const marks = state.settings.bookmarks ?? [];
  const [, setTick] = useState(0);
  useEffect(() => {
    const again = () => setTick((t) => t + 1);
    document.addEventListener('selectionchange', again);
    return () => document.removeEventListener('selectionchange', again);
  }, []);
  const blocks = editor.state.doc.blocks;
  const heads = blocks.filter((b) => /^heading[1-4]$/.test(b.type) && headingText(b));
  if (!heads.length) return <p className="right-empty">No headings yet. Headings you add (Heading 1 to 4) are listed here to jump to.</p>;
  // The heading the caret is under.
  const at = blocks.findIndex((b) => b.id === editor.currentBlock().id);
  const here = [...blocks.slice(0, at + 1)].reverse().find((b) => heads.includes(b))?.id;
  return (
    <ul className="right-outline">
      {heads.map((b) => (
        <li key={b.id}>
          <button type="button" className={`level-${b.type.slice(-1)}${b.id === here ? ' here' : ''}`} aria-current={b.id === here ? 'location' : undefined} onClick={() => editor.goToBlock(b.id)}>
            {headingText(b)}
          </button>
          {(() => {
            const mark = { kind: 'heading' as const, id: docId, block: b.id };
            const on = marks.some((m) => sameBookmark(m, mark));
            return (
              <button type="button" className={`outline-mark${on ? ' on' : ''}`} aria-pressed={on} aria-label={on ? `Remove bookmark ${headingText(b)}` : `Bookmark ${headingText(b)}`} title={on ? 'Remove bookmark' : 'Bookmark this heading'} onClick={() => store.updateSettings({ bookmarks: toggleBookmark(marks, mark) })}>
                {on ? '★' : '☆'}
              </button>
            );
          })()}
        </li>
      ))}
    </ul>
  );
}

/** Notes this one links to, and notes that link to it. */
function Links({ docId }: { docId: string }) {
  const state = useAppState();
  const nav = useNav();
  const note = state.notes.find((n) => n.id === docId);
  if (!note) return <p className="right-empty">Links between notes show here when a note is open. Type [[ in a note to link to another.</p>;
  const out = linkedTitles(note.doc).map((title) => ({ title, note: findByTitle(state.notes, title) }));
  const from = backlinks(note, state.notes);
  return (
    <div className="right-links">
      <h3>Links to</h3>
      {out.length === 0 ? (
        <p className="right-empty">None yet. Type [[ to link to another note.</p>
      ) : (
        <ul>
          {out.map(({ title, note: n }) => (
            <li key={title}>
              <button type="button" className={n ? '' : 'missing'} title={n ? undefined : 'No note with this title yet: click to make it'} onClick={() => nav.openTitle(title)}>
                {n ? displayTitle(n) : title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3>Linked from</h3>
      {from.length === 0 ? (
        <p className="right-empty">No notes link here yet.</p>
      ) : (
        <ul>
          {from.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => nav.openNote(n.id)}>
                {displayTitle(n)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
