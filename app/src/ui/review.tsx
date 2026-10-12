// Word's Reviewing pane, in the right sidebar: every tracked change and
// comment in the note or chapter, in order, with who and when; the markup
// view (all markup, simple, none, the original); previous and next change
// or comment; and Accept or Reject for each change, or all of them.

import { useEffect, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { type Change, type Comment, changes, comments, runsText, sliceRuns } from '@crumpet/editor/model';
import type { Settings } from '../data/types';
import { useAppState, useAppStore } from './hooks';
import { goToPlace } from './goto';
import { openComment } from './comments';

export const MARKUP_VIEWS: [NonNullable<Settings['markup']>, string][] = [
  ['all', 'All markup'],
  ['simple', 'Simple markup'],
  ['none', 'No markup'],
  ['original', 'Original'],
];

function when(at: number): string {
  if (!at) return '';
  const d = new Date(at);
  return new Date().toDateString() === d.toDateString() ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

type Item = { kind: 'change'; block: string; from: number; to: number; change: Change; text: string; order: number } | { kind: 'comment'; comment: Comment; quote: string; block: string; offset: number; order: number };

/** Every change and comment, in the order they come in the text. */
export function reviewItems(editor: Editor): Item[] {
  const doc = editor.state.doc;
  const index = new Map(doc.blocks.map((b, i) => [b.id, i]));
  const order = (block: string, offset: number) => (index.get(block) ?? 0) * 1e7 + Math.max(0, offset);
  const out: Item[] = [];
  for (const c of changes(doc)) {
    const blk = doc.blocks.find((b) => b.id === c.block);
    const text = c.from < 0 || !blk ? '' : runsText(sliceRuns(blk.runs, c.from, c.to));
    out.push({ kind: 'change', ...c, text, order: order(c.block, c.from) });
  }
  for (const c of comments(doc)) out.push({ kind: 'comment', ...c, order: order(c.block, c.offset) + 0.5 });
  return out.sort((a, b) => a.order - b.order);
}

/** Redraws when the text changes. */
function useEditorChanges(editor: Editor): void {
  const [, setTick] = useState(0);
  useEffect(() => editor.onChange(() => setTick((t) => t + 1)), [editor]);
}

/** The markup view, as a menu. */
export function MarkupSelect() {
  const state = useAppState();
  const store = useAppStore();
  return (
    <label className="markup-select">
      <select aria-label="Markup view" value={state.settings.markup ?? 'all'} onChange={(e) => store.updateSettings({ markup: e.target.value as Settings['markup'] })}>
        {MARKUP_VIEWS.map(([v, name]) => (
          <option key={v} value={v}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ReviewPane({ editor }: { editor: Editor }) {
  useEditorChanges(editor);
  const items = reviewItems(editor);
  const nChanges = items.filter((i) => i.kind === 'change').length;
  const nComments = items.length - nChanges;
  const step = (kind: 'change' | 'comment', dir: 'next' | 'previous') => {
    editor.focus();
    goToPlace(editor, kind, dir);
  };
  return (
    <div className="review-pane">
      <div className="review-head">
        <MarkupSelect />
        <div className="review-row">
          <span>
            {nChanges} change{nChanges === 1 ? '' : 's'}
          </span>
          <span className="grow" />
          <button type="button" className="btn quiet" aria-label="Previous change" title="Previous change" disabled={!nChanges} onClick={() => step('change', 'previous')}>
            ‹
          </button>
          <button type="button" className="btn quiet" aria-label="Next change" title="Next change" disabled={!nChanges} onClick={() => step('change', 'next')}>
            ›
          </button>
          <button type="button" className="btn quiet" disabled={!nChanges} onClick={() => editor.resolveChanges(false)}>
            Reject all
          </button>
          <button type="button" className="btn" disabled={!nChanges} onClick={() => editor.resolveChanges(true)}>
            Accept all
          </button>
        </div>
        <div className="review-row">
          <span>
            {nComments} comment{nComments === 1 ? '' : 's'}
          </span>
          <span className="grow" />
          <button type="button" className="btn quiet" aria-label="Previous comment" title="Previous comment" disabled={!nComments} onClick={() => step('comment', 'previous')}>
            ‹
          </button>
          <button type="button" className="btn quiet" aria-label="Next comment" title="Next comment" disabled={!nComments} onClick={() => step('comment', 'next')}>
            ›
          </button>
        </div>
      </div>
      {!items.length ? (
        <p className="right-empty">No changes or comments. Turn on Track changes to mark what’s added and deleted; select some text and choose Comment to add a remark.</p>
      ) : (
        <ul className="review-list" aria-label="Changes and comments">
          {items.map((it) =>
            it.kind === 'change' ? (
              <li key={`ch:${it.block}:${it.from}:${it.to}`} className={`review-item ${it.change.kind}`}>
                <button type="button" className="review-go" onClick={() => editor.goTo({ block: it.block, offset: Math.max(0, it.from) })}>
                  <span className="review-who">
                    <b>{it.change.author || 'Someone'}</b> {it.change.kind === 'ins' ? 'added' : 'deleted'}
                    {it.from < 0 ? ' a paragraph break' : ''} <small>{when(it.change.at)}</small>
                  </span>
                  {it.text && <span className={`review-text ${it.change.kind}`}>{it.text.length > 120 ? `${it.text.slice(0, 119)}…` : it.text}</span>}
                </button>
                <span className="review-actions">
                  <button type="button" className="btn quiet" onClick={() => editor.resolveChanges(false, { block: it.block, from: it.from, to: it.to })}>
                    Reject
                  </button>
                  <button type="button" className="btn" onClick={() => editor.resolveChanges(true, { block: it.block, from: it.from, to: it.to })}>
                    Accept
                  </button>
                </span>
              </li>
            ) : (
              <li key={`cm:${it.comment.id}`} className={`review-item comment${it.comment.resolved ? ' resolved' : ''}`}>
                <button type="button" className="review-go" onClick={() => openComment(editor, it.comment.id)}>
                  <span className="review-who">
                    <b>{it.comment.author || 'Someone'}</b> commented <small>{when(it.comment.at)}</small>
                    {it.comment.resolved && <small> · resolved</small>}
                  </span>
                  <span className="review-quote">“{it.quote.length > 60 ? `${it.quote.slice(0, 59)}…` : it.quote}”</span>
                  <span className="review-text">{it.comment.text}</span>
                  {it.comment.replies?.length ? (
                    <small className="review-replies">
                      {it.comment.replies.length} {it.comment.replies.length === 1 ? 'reply' : 'replies'}
                    </small>
                  ) : null}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
