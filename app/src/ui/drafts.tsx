// A chapter's drafts on screen: tabs above the chapter (`Draft 1 · Draft 2 · +`)
// once it has more than one, the choice of copy or blank page for a new one,
// and each draft's menu (rename, its note, use it for the book, delete).
// See data/drafts.ts.

import { useState } from 'react';
import { type DraftView, chapterDraft, chapterDrafts, draftBadge, nextBookDraftName } from '../data/drafts';
import { docWords } from '../data/selectors';
import type { Chapter, Project } from '../data/types';
import { useAppStore } from './hooks';
import { IconChevron, IconPlus } from './icons';
import { InlineInput, Popover } from './Sidebar';

const words = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'word' : 'words'}`;

/** The choices for a new draft: a copy of `from` to revise, or a blank page to write again. */
export function NewDraftChoices({ chapter, from, onMade }: { chapter: Chapter; from: string; onMade(id: string): void }) {
  const store = useAppStore();
  const source = chapterDraft(chapter, from);
  return (
    <div className="draft-new" role="group" aria-label="New draft">
      <p className="menu-label">New draft of this chapter</p>
      <button type="button" className="menu-item" onClick={() => onMade(store.newDraft(chapter.id, { from })!)}>
        <span className="draft-choice">
          <strong>Copy of {source?.name ?? 'this draft'}</strong>
          <small>Revise from where it is now</small>
        </span>
      </button>
      <button type="button" className="menu-item" onClick={() => onMade(store.newDraft(chapter.id, { blank: true })!)}>
        <span className="draft-choice">
          <strong>Blank page</strong>
          <small>Write it again, with the old draft to look back at</small>
        </span>
      </button>
    </div>
  );
}

/**
 * The drafts as tabs: the one shown is pressed, the one the book uses has a
 * dot. Nothing is drawn while a chapter has only its first draft (New draft
 * is in its menu then).
 */
export function DraftTabs({ chapter, viewing, onView, onBeside }: { chapter: Chapter; viewing: string; onView(id: string): void; onBeside?(id: string): void }) {
  const store = useAppStore();
  const drafts = chapterDrafts(chapter);
  const [menu, setMenu] = useState<null | { id: string; mode: 'menu' | 'rename' | 'note' } | 'new'>(null);
  if (drafts.length < 2) return null;
  const shown = drafts.find((d) => d.id === viewing) ?? drafts.find((d) => d.inUse)!;
  const inUse = drafts.find((d) => d.inUse)!;
  const open = menu && menu !== 'new' ? drafts.find((d) => d.id === menu.id) : undefined;
  return (
    <div className="draft-bar">
      <div className="draft-tabs" role="tablist" aria-label="Drafts of this chapter">
        {drafts.map((d) => (
          <span key={d.id} className={`draft-tab${d.id === shown.id ? ' on' : ''}`}>
            <button
              type="button"
              role="tab"
              aria-selected={d.id === shown.id}
              title={tip(d)}
              onClick={() => onView(d.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                onView(d.id);
                setMenu({ id: d.id, mode: 'menu' });
              }}
            >
              {d.inUse && <span className="draft-dot" aria-label="(in the book)" />}
              {d.name}
            </button>
            {d.id === shown.id && (
              <button type="button" className="draft-more" aria-label={`${d.name} options`} aria-expanded={menu !== null && menu !== 'new' && menu.id === d.id} onClick={() => setMenu(menu && menu !== 'new' ? null : { id: d.id, mode: 'menu' })}>
                <IconChevron size={12} className="rot90" />
              </button>
            )}
          </span>
        ))}
        <button type="button" className="draft-add" aria-label="New draft" data-tip="New draft" aria-expanded={menu === 'new'} onClick={() => setMenu(menu === 'new' ? null : 'new')}>
          <IconPlus size={14} />
        </button>
      </div>
      {menu === 'new' && (
        <Popover onClose={() => setMenu(null)} label="New draft">
          <NewDraftChoices
            chapter={chapter}
            from={shown.id}
            onMade={(id) => {
              setMenu(null);
              onView(id);
            }}
          />
        </Popover>
      )}
      {open && menu !== 'new' && menu && (
        <Popover onClose={() => setMenu(null)} label={`${open.name} options`}>
          {menu.mode === 'menu' && (
            <>
              {!open.inUse && (
                <button type="button" className="menu-item" onClick={() => (setMenu(null), store.useDraft(chapter.id, open.id))}>
                  Use this draft for the book
                </button>
              )}
              {onBeside && (
                <button type="button" className="menu-item" onClick={() => (setMenu(null), onBeside(open.id))}>
                  Open beside
                </button>
              )}
              <button type="button" className="menu-item" onClick={() => setMenu({ id: open.id, mode: 'rename' })}>
                Rename…
              </button>
              <button type="button" className="menu-item" onClick={() => setMenu({ id: open.id, mode: 'note' })}>
                {open.note ? 'Change the note…' : 'Add a note on what it’s for…'}
              </button>
              <hr className="menu-sep" />
              <button
                type="button"
                className="menu-item danger"
                onClick={() => {
                  setMenu(null);
                  const n = docWords(open.doc);
                  if (n === 0 || confirm(`Delete ${open.name} of “${chapter.title || 'Untitled chapter'}” and its ${words(n)}?${open.inUse ? ` The book will use ${drafts.filter((d) => !d.inUse).pop()!.name}.` : ''}`)) {
                    store.deleteDraft(chapter.id, open.id);
                    if (open.id === shown.id) onView(open.inUse ? '' : inUse.id);
                  }
                }}
              >
                Delete this draft…
              </button>
            </>
          )}
          {menu.mode === 'rename' && (
            <InlineInput
              label="Draft name"
              initial={open.name}
              onDone={(v) => {
                setMenu(null);
                if (v?.trim()) store.setDraftInfo(chapter.id, open.id, { name: v });
              }}
            />
          )}
          {menu.mode === 'note' && (
            <InlineInput
              label="What this draft is for"
              placeholder="Tighten the pacing, cut the subplot…"
              initial={open.note}
              onDone={(v) => {
                setMenu(null);
                if (v !== null) store.setDraftInfo(chapter.id, open.id, { note: v.trim() });
              }}
            />
          )}
        </Popover>
      )}
      {shown.note && <p className="draft-note">{shown.note}</p>}
      {!shown.inUse && (
        <p className="draft-aside" role="status">
          Your book uses {inUse.name}.{' '}
          <button type="button" className="link-btn" onClick={() => store.useDraft(chapter.id, shown.id)}>
            Use {shown.name} instead
          </button>
        </p>
      )}
    </div>
  );
}

function tip(d: DraftView): string {
  return [`${d.name} · ${words(docWords(d.doc))}`, d.inUse ? 'The book uses this draft' : '', d.note].filter(Boolean).join('\n');
}

/** The outline's quiet mark on a chapter with more than one draft: the draft its book uses ("D2"). */
export function DraftBadge({ chapter }: { chapter: Chapter }) {
  const drafts = chapterDrafts(chapter);
  const used = drafts.find((d) => d.inUse)!;
  return (
    <span className="draft-badge" title={`The book uses ${used.name} (of ${drafts.length} drafts)`}>
      {draftBadge(used.name)}
    </span>
  );
}

/** New draft of the book: a name and what it's for, then every chapter starts one, as a copy or a blank page. */
export function BookDraftForm({ project, chapters, onDone }: { project: Project; chapters: Chapter[]; onDone(): void }) {
  const store = useAppStore();
  const [name, setName] = useState(() => nextBookDraftName(chapters));
  const [note, setNote] = useState('');
  const make = (blank: boolean) => {
    store.newBookDraft(project.id, { name, note, blank });
    onDone();
  };
  return (
    <div className="draft-new book-draft-form" role="group" aria-label="New draft of the book">
      <p className="menu-label">New draft of the whole book</p>
      <label className="field-row">
        <span>Name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field-row">
        <span>What it’s for</span>
        <input type="text" value={note} placeholder="Tighten the pacing, cut the subplot…" onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && make(false)} />
      </label>
      <p className="draft-small">Each of the {chapters.length === 1 ? 'chapter' : `${chapters.length} chapters`} starts {name.trim() || 'a new draft'}; the drafts before stay, to look back at or go back to.</p>
      <button type="button" className="menu-item" onClick={() => make(false)}>
        <span className="draft-choice">
          <strong>Copy every chapter</strong>
          <small>Revise from where the book is now</small>
        </span>
      </button>
      <button type="button" className="menu-item" onClick={() => make(true)}>
        <span className="draft-choice">
          <strong>Blank pages</strong>
          <small>Write every chapter again</small>
        </span>
      </button>
    </div>
  );
}
