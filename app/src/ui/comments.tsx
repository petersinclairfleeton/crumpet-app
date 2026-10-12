// Comments, like Word's and Google Docs': select some text and add a remark
// (the speech-bubble button, or Ctrl+Alt+M); the text is highlighted, and
// clicking it opens the conversation to reply, resolve it (kept, greyed out,
// until it's reopened) or delete it. All of a note's comments are listed
// under it. Typing @ suggests people's names (as a label: nothing is sent
// to anyone).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { type Comment, type Doc, type Selection, changes, comments, makeComment } from '@crumpet/editor/model';
import { useAppState } from './hooks';

type Open = { kind: 'new'; sel: Selection; rect: DOMRect } | { kind: 'thread'; id: string; el: HTMLElement };

function when(at: number): string {
  if (!at) return '';
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** Everyone who has written a comment, reply or change in the document, and you: the names @ suggests. */
export function peopleIn(doc: Doc, you: string): string[] {
  const names = new Set<string>([you]);
  for (const { comment } of comments(doc)) {
    names.add(comment.author);
    for (const r of comment.replies ?? []) names.add(r.author);
    for (const m of [comment.text, ...(comment.replies ?? []).map((r) => r.text)].join(' ').matchAll(/@([\p{Lu}][\p{L}'-]*(?: [\p{Lu}][\p{L}'-]*)?)/gu)) names.add(m[1]);
  }
  for (const c of changes(doc)) names.add(c.change.author);
  return [...names].filter((n) => n && n !== 'Someone').sort((a, b) => a.localeCompare(b));
}

/** A comment's text with @names picked out (the longest known name first, else the word after @). */
export function Mentions({ text, people }: { text: string; people: string[] }) {
  const known = [...people].sort((a, b) => b.length - a.length).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`@(?:${known.length ? `${known.join('|')}|` : ''}[\\p{L}][\\p{L}'-]*)`, 'gu');
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > at) out.push(text.slice(at, m.index));
    out.push(
      <span key={m.index} className="mention">
        {m[0]}
      </span>,
    );
    at = m.index! + m[0].length;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

/** The name being typed after an @ just before the caret, if any. */
function typingMention(value: string, caret: number): { start: number; query: string } | null {
  const m = /(?:^|\s)@([\p{L}][\p{L}'-]*(?: [\p{L}'-]*)?)?$/u.exec(value.slice(0, caret));
  if (!m) return null;
  return { start: caret - (m[1]?.length ?? 0) - 1, query: m[1] ?? '' };
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
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const placeCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (placeCaret.current === null || !field.current) return;
    field.current.focus();
    field.current.setSelectionRange(placeCaret.current, placeCaret.current);
    placeCaret.current = null;
  });
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
  const people = editor ? peopleIn(editor.state.doc, author) : [author];
  // @ names: suggestions for what's being typed after an @.
  const mention = typingMention(value, caret);
  const suggestions = mention ? people.filter((p) => p.toLowerCase().startsWith(mention.query.toLowerCase()) && p !== mention.query).slice(0, 6) : [];
  const choose = (name: string) => {
    if (!mention) return;
    const next = `${value.slice(0, mention.start)}@${name} ${value.slice(caret)}`;
    const pos = mention.start + name.length + 2;
    setValue(next);
    setCaret(pos);
    setPick(0);
    // The caret goes after the name as soon as it's drawn (before anything else is typed).
    placeCaret.current = pos;
  };
  return createPortal(
    <div ref={card} className="comment-card" role="dialog" aria-label={open.kind === 'new' ? 'New comment' : 'Comment'} style={at ? { top: at.top, left: at.left } : { visibility: 'hidden', top: 0, left: 0 }}>
      {thread?.resolved && <p className="comment-resolved">Resolved</p>}
      {messages.map((m, i) => (
        <div key={i} className="comment-msg">
          <div className="comment-who">
            <b>{m.author || 'Someone'}</b>
            <small>{when(m.at)}</small>
          </div>
          <p>
            <Mentions text={m.text} people={people} />
          </p>
        </div>
      ))}
      <textarea
        ref={field}
        rows={open.kind === 'new' ? 3 : 2}
        aria-label={open.kind === 'new' ? 'Comment' : 'Reply'}
        placeholder={open.kind === 'new' ? 'Add a comment' : 'Reply'}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
          setPick(0);
        }}
        onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        onKeyDown={(e) => {
          if (suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setPick((pick + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
            return;
          }
          if (suggestions.length && (e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
            e.preventDefault();
            choose(suggestions[Math.min(pick, suggestions.length - 1)]);
            return;
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
      />
      {suggestions.length > 0 && (
        <div className="mention-list" role="listbox" aria-label="People">
          {suggestions.map((p, i) => (
            <button key={p} type="button" role="option" aria-selected={i === pick} className={i === pick ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(p)}>
              @{p}
            </button>
          ))}
        </div>
      )}
      <div className="comment-actions">
        {thread && (
          <button
            type="button"
            className="btn"
            title={thread.resolved ? 'Open this comment again' : 'Done with this: kept, greyed out, until it’s reopened'}
            onClick={() => {
              const { resolved: _was, ...rest } = thread;
              editor?.setComment(thread.id, thread.resolved ? rest : { ...thread, resolved: true });
              if (!thread.resolved) close();
            }}
          >
            {thread.resolved ? 'Reopen' : 'Resolve'}
          </button>
        )}
        {thread && (
          <button
            type="button"
            className="btn quiet"
            title="Take the comment away"
            onClick={() => {
              editor?.setComment(thread.id, null);
              close();
            }}
          >
            Delete
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
          <li key={c.id} className={c.resolved ? 'resolved' : undefined}>
            <button type="button" disabled={!editor} onClick={() => editor && openComment(editor, c.id)}>
              <span className="comment-quote">“{quote.length > 80 ? `${quote.slice(0, 79)}…` : quote}”</span>
              <span className="comment-line">
                <b>{c.author || 'Someone'}:</b> <Mentions text={c.text} people={[]} />
                {c.replies?.length ? <small> · {c.replies.length} {c.replies.length === 1 ? 'reply' : 'replies'}</small> : null}
                {c.resolved ? <small> · resolved</small> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
