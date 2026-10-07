// Comments, like Word's and Google Docs': select some text and add a remark
// (the speech-bubble button, or Ctrl+Alt+M); the text is highlighted, and
// clicking it opens the conversation to reply or resolve it. All of a note's
// comments are listed under it.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { type Comment, type Doc, type Selection, comments, makeComment } from '@crumpet/editor/model';
import { useAppState } from './hooks';

type Open = { kind: 'new'; sel: Selection; rect: DOMRect } | { kind: 'thread'; id: string; el: HTMLElement };

function when(at: number): string {
  if (!at) return '';
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** Opens a comment's conversation beside its text. */
export function openComment(editor: Editor, id: string): void {
  const el = editor.commentElement(id);
  const found = comments(editor.state.doc).find((c) => c.comment.id === id);
  if (!el || !found) return;
  el.scrollIntoView({ block: 'center' });
  editor.onCommentClick?.(found.comment, el);
}

/** The card for writing a comment, or reading and answering one. */
export function CommentCard({ editor }: { editor: Editor | null }) {
  const state = useAppState();
  const author = state.settings.name.trim() || 'You';
  const [open, setOpen] = useState<Open | null>(null);
  const [value, setValue] = useState('');
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(open);
  latest.current = open;

  useEffect(() => {
    if (!editor) return;
    editor.onCommentKey = () => {
      const sel = editor.currentSelection();
      if (sel.anchor.block === sel.focus.block && sel.anchor.offset === sel.focus.offset) return;
      const range = getSelection()?.rangeCount ? getSelection()!.getRangeAt(0) : null;
      const rect = range?.getBoundingClientRect() ?? editor.view.root.getBoundingClientRect();
      setValue('');
      setOpen({ kind: 'new', sel, rect });
    };
    editor.onCommentClick = (c, el) => {
      if (latest.current?.kind === 'thread' && latest.current.id === c.id) return;
      setValue('');
      setOpen({ kind: 'thread', id: c.id, el });
    };
    return () => {
      editor.onCommentKey = null;
      editor.onCommentClick = null;
    };
  }, [editor]);

  const thread = open?.kind === 'thread' && editor ? comments(editor.state.doc).find((c) => c.comment.id === open.id)?.comment : undefined;
  // A comment taken away (undo, or another device) closes its card.
  useEffect(() => {
    if (open?.kind === 'thread' && !thread) setOpen(null);
  });

  // Its text stays highlighted while the card is open.
  useEffect(() => {
    if (open?.kind !== 'thread' || !editor) return;
    const marks = editor.view.root.querySelectorAll(`mark.cmt[data-comment="${CSS.escape(open.id)}"]`);
    marks.forEach((m) => m.classList.add('active'));
    return () => marks.forEach((m) => m.classList.remove('active'));
  });

  const close = () => setOpen(null);

  const save = () => {
    if (!editor || !open) return;
    const text = value.trim();
    if (open.kind === 'new') {
      if (text) {
        editor.select(open.sel);
        editor.addComment(makeComment(author, text));
      }
      close();
      editor.focus();
      return;
    }
    if (thread && text) {
      const r = makeComment(author, text);
      const next: Comment = { ...thread, replies: [...(thread.replies ?? []), { author: r.author, at: r.at, text: r.text }] };
      editor.setComment(thread.id, next);
      setValue('');
    }
  };

  useLayoutEffect(() => {
    if (!open) return setAt(null);
    const r = open.kind === 'new' ? open.rect : open.el.isConnected ? open.el.getBoundingClientRect() : (editor?.commentElement(open.id)?.getBoundingClientRect() ?? null);
    if (!r) return setAt(null);
    const w = Math.min(340, window.innerWidth - 16);
    const h = card.current?.offsetHeight ?? 180;
    const below = r.bottom + 8 + h < window.innerHeight;
    setAt({ top: below ? r.bottom + 8 : Math.max(8, r.top - 8 - h), left: Math.min(window.innerWidth - w - 8, Math.max(8, r.left)) });
  }, [open, thread?.replies?.length, editor]);

  // Into the card once it's in place, when writing a new comment.
  useEffect(() => {
    if (at && open?.kind === 'new') field.current?.focus();
  }, [at, open?.kind]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element;
      if (card.current?.contains(t) || t.closest?.('mark.cmt') || t.closest?.('[data-comment-button]')) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && latest.current) {
        close();
        if (latest.current.kind === 'new') editor?.focus();
      }
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, editor]);

  if (!open || (open.kind === 'thread' && !thread)) return null;
  const messages = thread ? [thread, ...(thread.replies ?? [])] : [];
  return createPortal(
    <div ref={card} className="comment-card" role="dialog" aria-label={open.kind === 'new' ? 'New comment' : 'Comment'} style={at ? { top: at.top, left: at.left } : { visibility: 'hidden', top: 0, left: 0 }}>
      {messages.map((m, i) => (
        <div key={i} className="comment-msg">
          <div className="comment-who">
            <b>{m.author || 'Someone'}</b>
            <small>{when(m.at)}</small>
          </div>
          <p>{m.text}</p>
        </div>
      ))}
      <textarea
        ref={field}
        rows={open.kind === 'new' ? 3 : 2}
        aria-label={open.kind === 'new' ? 'Comment' : 'Reply'}
        placeholder={open.kind === 'new' ? 'Add a comment' : 'Reply'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
      />
      <div className="comment-actions">
        {thread && (
          <button
            type="button"
            className="btn"
            title="Done with this: take the comment away"
            onClick={() => {
              editor?.setComment(thread.id, null);
              close();
            }}
          >
            Resolve
          </button>
        )}
        <span className="grow" />
        {open.kind === 'new' && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              close();
              editor?.focus();
            }}
          >
            Cancel
          </button>
        )}
        <button type="button" className="btn primary" disabled={!value.trim()} onClick={save}>
          {open.kind === 'new' ? 'Comment' : 'Reply'}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** A note's comments, listed under it; clicking one opens it. */
export function CommentList({ doc, editor }: { doc: Doc; editor: Editor | null }) {
  const list = comments(doc);
  if (!list.length) return null;
  return (
    <section className="comment-list" aria-label="Comments">
      <h2>Comments</h2>
      <ul>
        {list.map(({ comment: c, quote }) => (
          <li key={c.id}>
            <button type="button" disabled={!editor} onClick={() => editor && openComment(editor, c.id)}>
              <span className="comment-quote">“{quote.length > 80 ? `${quote.slice(0, 79)}…` : quote}”</span>
              <span className="comment-line">
                <b>{c.author || 'Someone'}:</b> {c.text}
                {c.replies?.length ? <small> · {c.replies.length} {c.replies.length === 1 ? 'reply' : 'replies'}</small> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
