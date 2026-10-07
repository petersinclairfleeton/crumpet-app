// Pieces shared by everything that edits text: notes, chapters, and the
// manuscript (several chapters on one page sharing one toolbar).

import { type RefObject, useEffect, useRef, useState } from 'react';
import { Editor } from '@crumpet/editor/editor';
import { diffDocs } from '@crumpet/editor/diff';
import { stepsOf } from '@crumpet/editor/sync/transform';
import type { BlockType, Doc, Mark } from '@crumpet/editor/model';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

const MARKS: { mark: Mark; label: string; glyph: React.ReactNode; key: string }[] = [
  { mark: 'bold', label: 'Bold', glyph: <b>B</b>, key: `${mod}B` },
  { mark: 'italic', label: 'Italic', glyph: <i>I</i>, key: `${mod}I` },
  { mark: 'underline', label: 'Underline', glyph: <u>U</u>, key: `${mod}U` },
  { mark: 'strike', label: 'Strikethrough', glyph: <s>S</s>, key: `${mod}⇧X` },
  { mark: 'code', label: 'Code', glyph: <code>{'</>'}</code>, key: `${mod}E` },
];

const BLOCKS: { type: BlockType; label: string; glyph: string }[] = [
  { type: 'heading1', label: 'Heading', glyph: 'H1' },
  { type: 'heading2', label: 'Subheading', glyph: 'H2' },
  { type: 'bullet', label: 'Bulleted list', glyph: '•≡' },
  { type: 'numbered', label: 'Numbered list', glyph: '1≡' },
  { type: 'todo', label: 'Checklist', glyph: '☐' },
  { type: 'quote', label: 'Quote', glyph: '❝' },
];

export interface DocEditorOptions {
  /** Which document is shown; a new id loads it (fresh undo history). */
  docId: string;
  doc: Doc;
  readOnly: boolean;
  /** Called with the document after each edit made here. */
  onDoc(doc: Doc): void;
  /** Called before a different document is loaded (to save the old one). */
  onSwitch?(): void;
  /** Called when the editor is created and destroyed. */
  onReady?(editor: Editor | null): void;
  /** Called when this editor is used (focused or edited), e.g. to point a shared toolbar at it. */
  onActive?(editor: Editor): void;
  /** ⌘K with text selected. */
  onLinkKey?(): void;
}

/**
 * Mounts our editor on an element and keeps it in step with `doc`. Changes
 * from elsewhere (sync) arrive as edits, so the caret stays by the same words
 * and undo keeps working.
 */
export function useDocEditor(opts: DocEditorOptions): { host: RefObject<HTMLDivElement>; editor: Editor | null } {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const docId = useRef(opts.docId);
  /** The document this editor last showed or saved, to tell changes from elsewhere apart. */
  const shown = useRef(opts.doc);
  const latest = useRef(opts);
  latest.current = opts;
  const [, setTick] = useState(0);

  // Create the editor once.
  useEffect(() => {
    const el = host.current!;
    const ed = new Editor(el, latest.current.doc);
    editor.current = ed;
    ed.setReadOnly(latest.current.readOnly);
    latest.current.onReady?.(ed);
    ed.onChange((state, change) => {
      if (change && change.ops.length && change.source !== 'remote') {
        shown.current = state.doc;
        latest.current.onDoc(state.doc);
        latest.current.onActive?.(ed);
      }
      setTick((t) => t + 1);
    });
    const onFocus = () => latest.current.onActive?.(ed);
    const onKey = (e: KeyboardEvent) => {
      // ⌘K on selected text (or inside a link) edits the link; otherwise it falls through to search.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && latest.current.onLinkKey) {
        const sel = ed.currentSelection();
        const collapsed = sel.anchor.block === sel.focus.block && sel.anchor.offset === sel.focus.offset;
        if (!collapsed || ed.currentLink()) {
          e.preventDefault();
          latest.current.onLinkKey();
        }
      }
    };
    el.addEventListener('focusin', onFocus);
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('focusin', onFocus);
      el.removeEventListener('keydown', onKey);
      ed.destroy();
      editor.current = null;
      latest.current.onReady?.(null);
    };
  }, []);

  // Load a different document when the id changes.
  useEffect(() => {
    const ed = editor.current;
    if (!ed) return;
    if (docId.current !== opts.docId) {
      latest.current.onSwitch?.();
      docId.current = opts.docId;
      shown.current = opts.doc;
      ed.load(opts.doc);
    }
    ed.setReadOnly(opts.readOnly);
    // Only the identity matters here: doc changes come from the editor itself, or the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.docId, opts.readOnly]);

  // The document changed somewhere else (synced from another device): apply the difference as edits.
  useEffect(() => {
    const ed = editor.current;
    if (!ed || docId.current !== opts.docId || opts.doc === shown.current) return;
    shown.current = opts.doc;
    const { ops, doc } = diffDocs(ed.state.doc, opts.doc);
    if (ops.length) ed.applyRemote(doc, stepsOf(ops));
  }, [opts.docId, opts.doc]);

  return { host, editor: editor.current };
}

/** The formatting buttons, acting on whichever editor is given. */
export function FormatTools({ editor: ed, readOnly, onLink }: { editor: Editor | null; readOnly: boolean; onLink(): void }) {
  const type = ed?.currentBlock().type;
  const off = readOnly || !ed;
  return (
    <div className="tools" onMouseDown={(e) => e.preventDefault()}>
      {MARKS.map((m) => (
        <button key={m.mark} type="button" className={ed?.isMarkActive(m.mark) ? 'active' : ''} aria-label={m.label} aria-pressed={!!ed?.isMarkActive(m.mark)} title={`${m.label} (${m.key})`} disabled={off} onClick={() => ed?.toggleMark(m.mark)}>
          {m.glyph}
        </button>
      ))}
      <button type="button" aria-label="Link" title={`Link (${mod}K)`} disabled={off} onClick={onLink}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
        </svg>
      </button>
      <span className="sep" />
      {BLOCKS.map((b) => (
        <button key={b.type} type="button" className={type === b.type ? 'active' : ''} aria-label={b.label} aria-pressed={type === b.type} title={b.label} disabled={off} onClick={() => ed?.setBlockType(b.type)}>
          {b.glyph}
        </button>
      ))}
      <span className="sep" />
      <button type="button" aria-label="Undo" title={`Undo (${mod}Z)`} disabled={off || !ed?.history.canUndo} onClick={() => ed?.undo()}>
        ↶
      </button>
      <button type="button" aria-label="Redo" title={`Redo (${mod}⇧Z)`} disabled={off || !ed?.history.canRedo} onClick={() => ed?.redo()}>
        ↷
      </button>
    </div>
  );
}

export function LinkBar({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const [value, setValue] = useState(() => editor.currentLink() ?? '');
  const [error, setError] = useState('');
  const sel = editor.currentSelection();
  const nothingSelected = sel.anchor.block === sel.focus.block && sel.anchor.offset === sel.focus.offset && !editor.currentLink();
  const close = () => {
    onClose();
    editor.focus();
  };
  return (
    <form
      className="linkbar"
      onSubmit={(e) => {
        e.preventDefault();
        if (!editor.setLink(value || null)) {
          setError('That doesn’t look like a web address. Try something like example.com.');
          return;
        }
        close();
      }}
    >
      {nothingSelected ? (
        <>
          <p className="link-error">Select some text first, then add a link to it.</p>
          <button type="button" onClick={close}>
            OK
          </button>
        </>
      ) : (
        <>
          <label htmlFor="link-input">Link</label>
          <input
            id="link-input"
            autoFocus
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste or type a web address"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                close();
              }
            }}
          />
          <button type="submit" className="primary">
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              editor.setLink(null);
              close();
            }}
          >
            Remove link
          </button>
          {error && (
            <p className="link-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </form>
  );
}
