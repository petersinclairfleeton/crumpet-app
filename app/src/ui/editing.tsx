// Pieces shared by everything that edits text: notes, chapters, and the
// manuscript (several chapters on one page sharing one toolbar).

import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Editor } from '@crumpet/editor/editor';
import { diffDocs } from '@crumpet/editor/diff';
import { stepsOf } from '@crumpet/editor/sync/transform';
import type { BlockType, Doc, Mark } from '@crumpet/editor/model';
import type { StyleSheet } from '../data/styles';
import { AlignTools, StylePicker } from './styles-ui';
import { addFile } from '../data/files';
import { NOTE_LINK, noteLinkTitle } from '@crumpet/editor/markdown';

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
  { type: 'bullet', label: 'Bulleted list', glyph: '•≡' },
  { type: 'numbered', label: 'Numbered list', glyph: '1≡' },
  { type: 'todo', label: 'Checklist', glyph: '☐' },
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
  /** A click on a link to another note (its title). */
  onNoteLink?(title: string): void;
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
    // Pictures and files dropped or pasted in.
    ed.onFiles = (files) => void insertFiles(ed, files);
    // Links to other notes open them (a plain click: they're part of Crumpet, not the web).
    ed.onLinkClick = (href) => {
      if (!href.startsWith(NOTE_LINK)) return false;
      latest.current.onNoteLink?.(noteLinkTitle(href));
      return true;
    };
    // Draw again so whoever uses the hook gets the editor now that it exists.
    setTick((t) => t + 1);
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

/** Keeps files and puts them in the text at the caret, one after another. */
export async function insertFiles(ed: Editor, files: File[]): Promise<void> {
  for (const file of files) {
    try {
      const { type, src, caption } = await addFile(file);
      ed.insertMedia(type, src, caption);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'That file couldn’t be added.');
    }
  }
}

/** Opens the file chooser and puts what's chosen in the text. */
export function chooseFiles(ed: Editor): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.addEventListener('change', () => void insertFiles(ed, Array.from(input.files ?? [])));
  input.click();
}

/** The formatting buttons, acting on whichever editor is given. */
export function FormatTools({ editor: ed, readOnly, onLink, sheet, onEditStyles, compact = false, attach = true }: { editor: Editor | null; readOnly: boolean; onLink(): void; sheet: StyleSheet; onEditStyles?(): void; compact?: boolean; attach?: boolean }) {
  const type = ed?.currentBlock().type;
  const off = readOnly || !ed;
  return (
    <div className="tools" onMouseDown={(e) => e.preventDefault()}>
      <StylePicker editor={ed} sheet={sheet} disabled={off} onEditStyles={onEditStyles} />
      <span className="sep" />
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
      <button type="button" data-comment-button aria-label="Comment" title={`Comment on the selected text (${mod}${isMac ? '⌥' : 'Alt+'}M)`} disabled={off} onMouseDown={(e) => e.preventDefault()} onClick={() => ed?.onCommentKey?.()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
        </svg>
      </button>
      <span className="sep" />
      <AlignTools editor={ed} disabled={off} />
      <span className="sep" />
      {BLOCKS.map((b) => (
        <button key={b.type} type="button" className={type === b.type ? 'active' : ''} aria-label={b.label} aria-pressed={type === b.type} title={b.label} disabled={off} onClick={() => ed?.setBlockType(b.type)}>
          {b.glyph}
        </button>
      ))}
      {attach && (
        <button type="button" aria-label="Add a picture or file" title="Add a picture or file (or drop one in)" disabled={off} onClick={() => ed && chooseFiles(ed)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="M21 16l-5-5-8 8" />
          </svg>
        </button>
      )}
      {!compact && (
        <>
          <span className="sep" />
          <button type="button" aria-label="Undo" title={`Undo (${mod}Z)`} disabled={off || !ed?.history.canUndo} onClick={() => ed?.undo()}>
            ↶
          </button>
          <button type="button" aria-label="Redo" title={`Redo (${mod}⇧Z)`} disabled={off || !ed?.history.canRedo} onClick={() => ed?.redo()}>
            ↷
          </button>
        </>
      )}
    </div>
  );
}

/**
 * The formatting bar that floats above selected text (like Medium or Notion),
 * so the page stays clear while writing.
 */
export function SelectionBar({ host, children }: { host: RefObject<HTMLElement>; children: ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; bottom: number; mid: number } | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const update = () => {
      // Working in the bar itself (a menu in it): keep it where it is.
      if (bar.current?.contains(document.activeElement)) return;
      const sel = getSelection();
      const h = host.current;
      if (!sel || !sel.rangeCount || sel.isCollapsed || !h || !h.contains(sel.anchorNode) || !h.contains(sel.focusNode)) return setAt(null);
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) return setAt(null);
      setAt({ top: r.top, bottom: r.bottom, mid: r.left + r.width / 2 });
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    // The page moving under the selection (focus mode, panes resized) moves the bar too.
    const ro = new ResizeObserver(update);
    if (host.current) ro.observe(host.current);
    return () => {
      ro.disconnect();
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [host]);

  // Above the selection, kept inside the window; below it when there's no room above.
  useLayoutEffect(() => {
    const el = bar.current;
    if (!at || !el) return setPlace(null);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.min(window.innerWidth - w - 8, Math.max(8, at.mid - w / 2));
    const top = at.top - h - 10 >= 8 ? at.top - h - 10 : at.bottom + 10;
    setPlace({ top, left });
  }, [at]);

  if (!at) return null;
  return createPortal(
    <div ref={bar} className="selection-bar" role="toolbar" aria-label="Formatting" style={place ? { top: place.top, left: place.left } : { visibility: 'hidden', top: 0, left: 0 }}>
      {children}
    </div>,
    document.body,
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

/**
 * On phones: the formatting bar sits just above the on-screen keyboard while
 * writing, with a button to put the keyboard away.
 */
export function KeyboardBar({ host, children }: { host: RefObject<HTMLElement>; children: ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  const [writing, setWriting] = useState(false);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    const h = host.current;
    if (!h) return;
    const inside = (n: EventTarget | null) => !!n && (h.contains(n as Node) || !!bar.current?.contains(n as Node));
    const onIn = () => setWriting(true);
    const onOut = (e: FocusEvent) => {
      if (!inside(e.relatedTarget)) setWriting(false);
    };
    h.addEventListener('focusin', onIn);
    h.addEventListener('focusout', onOut);
    // The keyboard shrinks the visual viewport; keep the bar right above it.
    const vv = window.visualViewport;
    const place = () => vv && setLift(Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)));
    vv?.addEventListener('resize', place);
    vv?.addEventListener('scroll', place);
    place();
    return () => {
      h.removeEventListener('focusin', onIn);
      h.removeEventListener('focusout', onOut);
      vv?.removeEventListener('resize', place);
      vv?.removeEventListener('scroll', place);
    };
  }, [host]);

  if (!writing) return null;
  return createPortal(
    <div ref={bar} className="keyboard-bar" role="toolbar" aria-label="Formatting" style={{ bottom: lift }} onMouseDown={(e) => e.preventDefault()}>
      <div className="keyboard-tools">{children}</div>
      <button
        type="button"
        className="kb-done"
        onClick={() => {
          (document.activeElement as HTMLElement | null)?.blur();
          setWriting(false);
        }}
      >
        Done
      </button>
    </div>,
    document.body,
  );
}
