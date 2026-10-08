// The right sidebar, like Obsidian's: helpers for what you're writing, each
// in a tab: the headings outline, the Styles pane, comments, and links.

import { useEffect, useState } from 'react';
import { type Block, comments } from '@crumpet/editor/model';
import type { Editor } from '@crumpet/editor/editor';
import { useAppState, useAppStore, useNav } from './hooks';
import { useHelped } from './helpers';
import { StylesPane } from './stylespane';
import { CommentList } from './comments';
import { FoldButton } from './fold';
import { backlinks, findByTitle, linkedTitles } from '../data/links';
import { displayTitle } from '../data/selectors';

export type RightTab = 'outline' | 'styles' | 'comments' | 'links';
const TABS: { key: RightTab; label: string }[] = [
  { key: 'outline', label: 'Outline' },
  { key: 'styles', label: 'Styles' },
  { key: 'comments', label: 'Comments' },
  { key: 'links', label: 'Links' },
];

/** Redraws when the editor's text changes. */
function useEdits(editor: Editor | null): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    return editor.onChange(() => setTick((t) => t + 1));
  }, [editor]);
}

export function RightSidebar() {
  const state = useAppState();
  const store = useAppStore();
  const helped = useHelped();
  const tab: RightTab = state.settings.layout?.rightTab ?? 'outline';
  useEdits(helped?.editor ?? null);
  return (
    <aside className="right-side" aria-label="Right sidebar">
      <header className="right-head">
        <div className="right-tabs" role="tablist" aria-label="Helpers">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => store.updateLayout({ rightTab: t.key })}>
              {t.label}
            </button>
          ))}
        </div>
        <FoldButton what="right" />
      </header>
      <div className="right-body" role="tabpanel" aria-label={TABS.find((t) => t.key === tab)!.label}>
        {!helped ? <p className="right-empty">Open a note or chapter to see its {tab === 'styles' ? 'styles' : tab} here.</p> : tab === 'outline' ? <Outline editor={helped.editor} /> : tab === 'styles' ? <StylesPane embedded editor={helped.editor} sheet={helped.sheet} onSheet={helped.onSheet} onEditStyles={helped.onEditStyles} onClose={() => store.updateLayout({ right: false })} /> : tab === 'comments' ? <Comments editor={helped.editor} /> : <Links docId={helped.docId} />}
      </div>
    </aside>
  );
}

const headingText = (b: Block) =>
  b.runs
    .filter((r) => r.change?.kind !== 'del' && !r.footnote)
    .map((r) => r.text)
    .join('')
    .trim();

/** The headings, indented by level; the one you're in is marked. Click one to go there. */
function Outline({ editor }: { editor: Editor }) {
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
        </li>
      ))}
    </ul>
  );
}

function Comments({ editor }: { editor: Editor }) {
  const doc = editor.state.doc;
  if (!comments(doc).length) return <p className="right-empty">No comments yet. Select some text and choose Comment to add one.</p>;
  return <CommentList doc={doc} editor={editor} />;
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
