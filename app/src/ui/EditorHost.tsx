import { useEffect, useRef, useState } from 'react';
import { Editor } from '@crumpet/editor/editor';
import { diffDocs } from '@crumpet/editor/diff';
import { stepsOf } from '@crumpet/editor/sync/transform';
import type { BlockType, Mark } from '@crumpet/editor/model';
import type { Note } from '../data/types';
import { useAppStore } from './hooks';

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

interface Props {
  note: Note;
  readOnly: boolean;
  /** Toolbar slot rendered before the formatting buttons (e.g. a back button). */
  lead?: React.ReactNode;
  /** Toolbar slot rendered after them (star, more menu). */
  trail?: React.ReactNode;
  /** Rendered above the note body (title, notebook, tags). */
  header: React.ReactNode;
  footer: React.ReactNode;
  /** Reading view: a book-like page without editing tools. */
  reading?: boolean;
  onEditor?(editor: Editor | null): void;
}

/** The note body: our editor engine, mounted once and re-loaded when the open note changes. */
export function EditorHost({ note, readOnly, lead, trail, header, footer, reading = false, onEditor }: Props) {
  const store = useAppStore();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const noteId = useRef(note.id);
  /** The document this editor last showed or saved, to tell changes from elsewhere (sync) apart. */
  const shown = useRef(note.doc);
  const [, setTick] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);

  // Create the editor once.
  useEffect(() => {
    const ed = new Editor(host.current!, note.doc);
    editor.current = ed;
    onEditor?.(ed);
    ed.onChange((state, change) => {
      if (change && change.ops.length && change.source !== 'remote') {
        shown.current = state.doc;
        store.setDoc(noteId.current, state.doc);
      }
      setTick((t) => t + 1);
    });
    const onKey = (e: KeyboardEvent) => {
      // ⌘K on selected text (or inside a link) edits the link; otherwise it falls through to search.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const sel = ed.currentSelection();
        const collapsed = sel.anchor.block === sel.focus.block && sel.anchor.offset === sel.focus.offset;
        if (!collapsed || ed.currentLink()) {
          e.preventDefault();
          setLinkOpen(true);
        }
      }
    };
    host.current!.addEventListener('keydown', onKey);
    const el = host.current!;
    return () => {
      el.removeEventListener('keydown', onKey);
      ed.destroy();
      editor.current = null;
      onEditor?.(null);
    };
    // The editor is created once; later note switches go through load() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the note when a different one is opened.
  useEffect(() => {
    const ed = editor.current;
    if (!ed) return;
    if (noteId.current !== note.id) {
      store.flush();
      noteId.current = note.id;
      shown.current = note.doc;
      ed.load(note.doc);
      setLinkOpen(false);
    }
    ed.setReadOnly(readOnly);
    // Only the note's identity matters here: its doc changes come from the editor itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, readOnly]);

  // The open note changed somewhere else (synced from another device): apply the
  // difference as edits, so the caret stays by the same words and undo still works.
  useEffect(() => {
    const ed = editor.current;
    if (!ed || noteId.current !== note.id || note.doc === shown.current) return;
    shown.current = note.doc;
    const { ops, doc } = diffDocs(ed.state.doc, note.doc);
    if (ops.length) ed.applyRemote(doc, stepsOf(ops));
  }, [note.id, note.doc]);

  const ed = editor.current;
  const type = ed?.currentBlock().type;

  return (
    <div className={`note-pane${reading ? ' reading' : ''}`}>
      <div className="note-toolbar" role="toolbar" aria-label="Formatting">
        {lead}
        <div className="tools" onMouseDown={(e) => e.preventDefault()}>
          {MARKS.map((m) => (
            <button key={m.mark} type="button" className={ed?.isMarkActive(m.mark) ? 'active' : ''} aria-label={m.label} aria-pressed={!!ed?.isMarkActive(m.mark)} title={`${m.label} (${m.key})`} disabled={readOnly} onClick={() => ed?.toggleMark(m.mark)}>
              {m.glyph}
            </button>
          ))}
          <button type="button" aria-label="Link" title={`Link (${mod}K)`} disabled={readOnly} onClick={() => setLinkOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
              <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
            </svg>
          </button>
          <span className="sep" />
          {BLOCKS.map((b) => (
            <button key={b.type} type="button" className={type === b.type ? 'active' : ''} aria-label={b.label} aria-pressed={type === b.type} title={b.label} disabled={readOnly} onClick={() => ed?.setBlockType(b.type)}>
              {b.glyph}
            </button>
          ))}
          <span className="sep" />
          <button type="button" aria-label="Undo" title={`Undo (${mod}Z)`} disabled={readOnly || !ed?.history.canUndo} onClick={() => ed?.undo()}>
            ↶
          </button>
          <button type="button" aria-label="Redo" title={`Redo (${mod}⇧Z)`} disabled={readOnly || !ed?.history.canRedo} onClick={() => ed?.redo()}>
            ↷
          </button>
        </div>
        <span className="grow" />
        {trail}
      </div>
      {linkOpen && ed && <LinkBar editor={ed} onClose={() => setLinkOpen(false)} />}
      <div className="note-scroll">
        <article className="note-body">
          {header}
          <div ref={host} className="note-editor" aria-label="Note text" />
          {footer}
        </article>
      </div>
    </div>
  );
}

function LinkBar({ editor, onClose }: { editor: Editor; onClose(): void }) {
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
