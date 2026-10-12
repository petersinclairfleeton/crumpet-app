// Word's References tab, for the formatting bar: numbered captions,
// cross-references that update, bookmarks, a table of figures, index
// entries and the index, fields (page numbers, word count, title…), and
// Add Text (a paragraph's level in the contents). The windows live outside
// the bar (the More menu closes as they open), shown by ReferencesHost; a
// table of contents' ⚙ opens its options there too.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import type { Block, TocLook } from '@crumpet/editor/model';
import { DOC_FIELDS } from '@crumpet/editor/fields';
import { Popover } from './Sidebar';
import { type ToolItem, closeMore } from './toolbar';

type Win = 'caption' | 'crossref' | 'bookmark' | 'index' | 'field' | 'toc';
interface Ask {
  win: Win;
  editor: Editor;
  /** The table of contents whose options are shown. */
  id?: string;
}
const EVENT = 'crumpet:references';
const ask = (detail: Ask) => window.dispatchEvent(new CustomEvent<Ask>(EVENT, { detail }));

/** A table of contents' ⚙ shows its options (set on each editor). */
export function useTocOptions(editor: Editor | null): void {
  useEffect(() => {
    if (!editor) return;
    editor.onTocOptions = (id) => ask({ win: 'toc', editor, id });
    return () => {
      editor.onTocOptions = null;
    };
  }, [editor]);
}

const blockText = (b: Block) =>
  b.runs
    .filter((r) => r.change?.kind !== 'del' && r.footnote === undefined && r.field === undefined)
    .map((r) => r.text)
    .join('')
    .trim();

/** The captions in a document, label by label: each one's block, number and text ("Figure 2: A gull"). */
export function captionsIn(blocks: Block[]): { id: string; label: string; n: number; text: string }[] {
  const counts = new Map<string, number>();
  const out: { id: string; label: string; n: number; text: string }[] = [];
  for (const b of blocks) {
    let text = '';
    let first: { label: string; n: number } | null = null;
    for (const r of b.runs) {
      if (r.change?.kind === 'del' || r.footnote !== undefined) continue;
      if (r.field?.startsWith('seq:')) {
        const label = r.field.slice(4);
        const n = (counts.get(label) ?? 0) + 1;
        counts.set(label, n);
        first ??= { label, n };
        text += String(n);
      } else if (r.field === undefined) text += r.text;
    }
    if (first) out.push({ id: b.id, ...first, text: text.replace(/\s+/g, ' ').trim() });
  }
  return out;
}

function ReferencesTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  const go = (fn: () => void) => () => {
    setOpen(false);
    closeMore();
    fn();
  };
  const win = (w: Win) => go(() => ed && ask({ win: w, editor: ed }));
  const outline = ed?.currentBlock().para?.outline;
  return (
    <span className="tool-drop">
      <button type="button" aria-label="References" aria-expanded={open} title="References: captions, cross-references, bookmarks, index" disabled={off} onClick={() => setOpen(!open)}>
        {ICON_REFS}
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && ed && (
        <Popover label="References" onClose={() => setOpen(false)}>
          <button type="button" className="menu-item" onClick={win('caption')}>
            Insert caption…
          </button>
          <button type="button" className="menu-item" onClick={win('crossref')}>
            Cross-reference…
          </button>
          <button type="button" className="menu-item" onClick={win('bookmark')}>
            Bookmark…
          </button>
          <button type="button" className="menu-item" onClick={go(() => (ed.focus(), ed.insertList({ kind: 'figures', label: 'Figure' })))}>
            Table of figures
          </button>
          <hr className="menu-sep" />
          <button type="button" className="menu-item" onClick={win('index')}>
            Mark index entry…
          </button>
          <button type="button" className="menu-item" onClick={go(() => (ed.focus(), ed.insertList({ kind: 'index' })))}>
            Insert index
          </button>
          <button type="button" className="menu-item" onClick={win('field')}>
            Field…
          </button>
          <hr className="menu-sep" />
          <div className="menu-head">Add text to the contents</div>
          <div className="menu-row add-text" role="group" aria-label="Add text to the contents">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" className={`btn small${outline === n ? ' on' : ''}`} aria-pressed={outline === n} title={`In the contents at level ${n}`} onClick={go(() => ed.setPara({ outline: n }))}>
                Level {n}
              </button>
            ))}
            <button type="button" className={`btn small${outline === 0 ? ' on' : ''}`} aria-pressed={outline === 0} onClick={go(() => ed.setPara({ outline: 0 }))}>
              Not shown
            </button>
            <button type="button" className="btn small" disabled={outline === undefined} title="As its style says (headings shown, other paragraphs not)" onClick={go(() => ed.setPara({ outline: undefined }))}>
              As its style
            </button>
          </div>
        </Popover>
      )}
    </span>
  );
}

export function referenceItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [{ key: 'references', label: 'References', pri: 1, node: <ReferencesTool ed={ed} off={off} /> }];
}

export function ReferencesHost() {
  const [open, setOpen] = useState<Ask | null>(null);
  useEffect(() => {
    const on = (e: Event) => setOpen((e as CustomEvent<Ask>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  if (!open) return null;
  const close = () => setOpen(null);
  const { editor } = open;
  switch (open.win) {
    case 'caption':
      return <CaptionDialog editor={editor} onClose={close} />;
    case 'crossref':
      return <CrossRefDialog editor={editor} onClose={close} />;
    case 'bookmark':
      return <BookmarkDialog editor={editor} onClose={close} />;
    case 'index':
      return <IndexDialog editor={editor} onClose={close} />;
    case 'field':
      return <FieldDialog editor={editor} onClose={close} />;
    case 'toc':
      return open.id ? <TocDialog editor={editor} id={open.id} onClose={close} /> : null;
  }
}

/** A small window: a form with a title, its fields, and Cancel / OK. */
function Dialog({ title, onClose, onOk, ok = 'OK', children, wide = false }: { title: string; onClose(): void; onOk?(): void; ok?: string; children: React.ReactNode; wide?: boolean }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className={`dialog para-dialog${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(e) => {
          e.preventDefault();
          onOk?.();
        }}
      >
        <header className="dialog-head">
          <h2>{title}</h2>
        </header>
        <div className="settings">
          {children}
          <div className="para-foot">
            <span className="grow" />
            <button type="button" className="btn" onClick={onClose}>
              {onOk ? 'Cancel' : 'Close'}
            </button>
            {onOk && (
              <button type="submit" className="btn primary">
                {ok}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}

const LABELS = ['Figure', 'Table', 'Equation'];

/** Word's Insert Caption: a label, its number (counting up by itself) and words after it. */
function CaptionDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const used = [...new Set(captionsIn(editor.state.doc.blocks).map((c) => c.label))];
  const here = editor.currentBlock();
  const [label, setLabel] = useState(here.type === 'image' ? 'Figure' : editor.currentTable() ? 'Table' : 'Figure');
  const [own, setOwn] = useState('');
  const [text, setText] = useState('');
  const [where, setWhere] = useState<'below' | 'above'>(editor.currentTable() ? 'above' : 'below');
  const labels = [...new Set([...LABELS, ...used])];
  const name = label === '' ? own.trim() : label;
  const valid = /^[A-Za-z][\w ]{0,30}$/.test(name);
  const n = captionsIn(editor.state.doc.blocks).filter((c) => c.label === name).length + 1;
  return (
    <Dialog
      title="Insert caption"
      onClose={onClose}
      onOk={() => {
        if (!valid) return;
        editor.focus();
        editor.insertCaption(name, text.trim(), where);
        onClose();
      }}
    >
      <label className="field">
        <span>Label</span>
        <select aria-label="Label" value={label} onChange={(e) => setLabel(e.target.value)}>
          {labels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
          <option value="">A label of your own…</option>
        </select>
      </label>
      {label === '' && (
        <label className="field">
          <span>Your label</span>
          <input aria-label="Your label" value={own} placeholder="Map, Plate, Chart…" onChange={(e) => setOwn(e.target.value)} />
        </label>
      )}
      <label className="field">
        <span>Caption</span>
        <input aria-label="Caption text" autoFocus value={text} placeholder={here.type === 'image' ? 'What the picture shows' : 'Words after the number'} onChange={(e) => setText(e.target.value)} />
      </label>
      {here.type !== 'image' && (
        <label className="field">
          <span>Position</span>
          <select aria-label="Position" value={where} onChange={(e) => setWhere(e.target.value as 'above' | 'below')}>
            <option value="below">Below {editor.currentTable() ? 'the table' : 'this paragraph'}</option>
            <option value="above">Above {editor.currentTable() ? 'the table' : 'this paragraph'}</option>
          </select>
        </label>
      )}
      <p className="caption-preview" aria-label="Preview">
        {valid ? `${name} ${n}${text.trim() ? `: ${text.trim()}` : ''}` : 'A label starts with a letter (letters, figures and spaces).'}
      </p>
    </Dialog>
  );
}

type RefHow = 'num' | 'text' | 'page' | 'dir';

/** Word's Cross-reference: to a heading, a caption or a bookmark, as its number, its text, its page, or "above"/"below". */
function CrossRefDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const blocks = editor.state.doc.blocks;
  const captions = captionsIn(blocks);
  const labels = [...new Set(captions.map((c) => c.label))];
  const kinds = ['Heading', ...labels, 'Bookmark'];
  const [kind, setKind] = useState(captions.length ? labels[0] : 'Heading');
  const [how, setHow] = useState<RefHow>('num');
  const items: { key: string; text: string; block?: string; bookmark?: string }[] =
    kind === 'Heading'
      ? blocks.filter((b) => /^heading[1-4]$/.test(b.type) && blockText(b)).map((b) => ({ key: b.id, block: b.id, text: `${'  '.repeat(Number(b.type.slice(-1)) - 1)}${blockText(b)}` }))
      : kind === 'Bookmark'
        ? editor
            .bookmarks()
            .filter((b) => !b.name.startsWith('_'))
            .map((b) => ({ key: b.name, bookmark: b.name, text: b.name }))
        : captions.filter((c) => c.label === kind).map((c) => ({ key: c.id, block: c.id, text: c.text }));
  const [pick, setPick] = useState(0);
  const item = items[Math.min(pick, items.length - 1)];
  const HOWS: [RefHow, string][] = kind === 'Heading' ? [['num', 'Heading text'], ['page', 'Page number'], ['dir', 'Above/below']] : kind === 'Bookmark' ? [['text', 'Bookmark text'], ['page', 'Page number'], ['dir', 'Above/below']] : [['num', `${kind} and number only`], ['text', 'Entire caption'], ['page', 'Page number'], ['dir', 'Above/below']];
  const howNow = HOWS.some(([h]) => h === how) ? how : HOWS[0][0];
  return (
    <Dialog
      title="Cross-reference"
      ok="Insert"
      onClose={onClose}
      onOk={() => {
        if (!item) return;
        const name = item.bookmark ?? editor.bookmarkBlock(item.block!);
        editor.focus();
        editor.insertField(`ref:${name}${howNow === 'num' ? '' : `:${howNow}`}`);
        onClose();
      }}
    >
      <div className="style-row">
        <label className="field">
          <span>Reference type</span>
          <select aria-label="Reference type" value={kind} onChange={(e) => (setKind(e.target.value), setPick(0))}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Insert reference to</span>
          <select aria-label="Insert reference to" value={howNow} onChange={(e) => setHow(e.target.value as RefHow)}>
            {HOWS.map(([h, l]) => (
              <option key={h} value={h}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      {items.length ? (
        <ul className="pick-list" role="listbox" aria-label={`Which ${kind.toLowerCase()}`}>
          {items.map((x, i) => (
            <li key={x.key}>
              <button type="button" role="option" aria-selected={x === item} className={x === item ? 'on' : ''} onClick={() => setPick(i)}>
                {x.text}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sync-hint">{kind === 'Bookmark' ? 'No bookmarks yet: add one with References → Bookmark….' : kind === 'Heading' ? 'No headings yet.' : 'No captions with this label yet.'}</p>
      )}
      <p className="sync-hint">It updates by itself as the text changes; Ctrl+click it to go there.</p>
    </Dialog>
  );
}

const BM_NAME = /^[A-Za-z][\w-]{0,39}$/;

/** Word's Bookmark: name a spot in the text, go to one, or take one away. */
function BookmarkDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const [list, setList] = useState(() => editor.bookmarks().filter((b) => !b.name.startsWith('_')));
  const [name, setName] = useState(() => (window.getSelection()?.toString() ?? '').trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '').slice(0, 40));
  const [sort, setSort] = useState<'name' | 'place'>('name');
  const valid = BM_NAME.test(name);
  const refresh = () => setList(editor.bookmarks().filter((b) => !b.name.startsWith('_')));
  const shown = sort === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  return (
    <Dialog
      title="Bookmark"
      ok="Add"
      onClose={onClose}
      onOk={() => {
        if (!valid) return;
        // The same name again moves the bookmark here.
        const old = list.find((b) => b.name === name);
        if (old) editor.removeFieldAt(old.pos);
        editor.focus();
        editor.insertField(`bm:${name}`);
        onClose();
      }}
    >
      <label className="field">
        <span>Bookmark name</span>
        <input aria-label="Bookmark name" autoFocus value={name} placeholder="Letters, figures, - and _" onChange={(e) => setName(e.target.value)} />
      </label>
      {name && !valid && <p className="error">A name starts with a letter, and has only letters, figures, - and _ (no spaces).</p>}
      {list.length > 0 && (
        <>
          <div className="segmented small" role="group" aria-label="Sort by">
            <button type="button" aria-pressed={sort === 'name'} onClick={() => setSort('name')}>
              Name
            </button>
            <button type="button" aria-pressed={sort === 'place'} onClick={() => setSort('place')}>
              Place
            </button>
          </div>
          <ul className="pick-list" aria-label="Bookmarks">
            {shown.map((b) => (
              <li key={b.name} className="pick-row">
                <span className="grow">{b.name}</span>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    onClose();
                    editor.goToBookmark(b.name);
                  }}
                >
                  Go to
                </button>
                <button
                  type="button"
                  className="btn small quiet"
                  aria-label={`Delete bookmark ${b.name}`}
                  onClick={() => {
                    editor.removeFieldAt(b.pos);
                    refresh();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}

/** Word's Mark Index Entry: a word for the index (and an entry under it), marked here or everywhere it's written. */
function IndexDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const selected = (window.getSelection()?.toString() ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const [main, setMain] = useState(selected.replace(/[:{}]/g, ''));
  const [sub, setSub] = useState('');
  const [done, setDone] = useState('');
  const entry = `xe:${main.trim()}${sub.trim() ? `:${sub.trim().replace(/[:{}]/g, '')}` : ''}`;
  const ok = !!main.trim() && !/[{}]/.test(main);
  /** An entry after each place the selected words are written (from the end, so places stay put). */
  const markAll = () => {
    const matches = editor.find(selected, { matchCase: true, wholeWord: true });
    const sorted = [...matches].sort((a, b) => {
      const blocks = editor.state.doc.blocks;
      return blocks.findIndex((x) => x.id === b.block) - blocks.findIndex((x) => x.id === a.block) || b.to - a.to;
    });
    for (const m of sorted) {
      editor.focusPos({ block: m.block, offset: m.to });
      editor.insertField(entry);
    }
    setDone(`Marked in ${matches.length} place${matches.length === 1 ? '' : 's'}.`);
  };
  return (
    <Dialog
      title="Mark index entry"
      ok="Mark"
      onClose={onClose}
      onOk={() => {
        if (!ok) return;
        editor.focus();
        editor.collapseToEnd();
        editor.insertField(entry);
        onClose();
      }}
    >
      <label className="field">
        <span>Main entry</span>
        <input aria-label="Main entry" autoFocus value={main} onChange={(e) => setMain(e.target.value.replace(/[:{}]/g, ''))} />
      </label>
      <label className="field">
        <span>Subentry (optional)</span>
        <input aria-label="Subentry" value={sub} onChange={(e) => setSub(e.target.value)} />
      </label>
      {selected && (
        <button type="button" className="btn quiet" disabled={!ok} onClick={markAll}>
          Mark all “{selected}”
        </button>
      )}
      {done && <p className="sync-hint" role="status">{done}</p>}
      <p className="sync-hint">Then References → Insert index lists them, A to Z, with their pages in page view.</p>
    </Dialog>
  );
}

/** Word's Field: page numbers, counts and the document's own details, kept up to date. */
function FieldDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const [name, setName] = useState('page');
  return (
    <Dialog
      title="Field"
      ok="Insert"
      onClose={onClose}
      onOk={() => {
        editor.focus();
        editor.insertField(name);
        onClose();
      }}
    >
      <ul className="pick-list" role="listbox" aria-label="Fields">
        {Object.entries(DOC_FIELDS).map(([k, label]) => (
          <li key={k}>
            <button type="button" role="option" aria-selected={k === name} className={k === name ? 'on' : ''} onClick={() => setName(k)} onDoubleClick={() => (editor.focus(), editor.insertField(k), onClose())}>
              {label}
            </button>
          </li>
        ))}
      </ul>
      <p className="sync-hint">Page numbers show in page view. Dates and times are under Insert → Date and time.</p>
    </Dialog>
  );
}

/** A table of contents' options (Word's Table of Contents dialog), or a table of figures', an index's or a bibliography's. */
function TocDialog({ editor, id, onClose }: { editor: Editor; id: string; onClose(): void }) {
  const blk = editor.state.doc.blocks.find((b) => b.id === id);
  const [look, setLook] = useState<TocLook>(blk?.tocl ?? {});
  const kind = look.kind;
  const labels = [...new Set([...LABELS, ...captionsIn(editor.state.doc.blocks).map((c) => c.label)])];
  const set = (patch: Partial<TocLook>) => setLook({ ...look, ...patch });
  return (
    <Dialog
      title={kind === 'figures' ? 'Table of figures' : kind === 'index' ? 'Index' : kind === 'sources' ? 'Bibliography' : 'Table of contents'}
      onClose={onClose}
      onOk={() => {
        editor.setTocLook(id, look);
        onClose();
      }}
    >
      <label className="field">
        <span>Title</span>
        <input aria-label="Title" value={look.title ?? ''} placeholder={kind === 'figures' ? 'Table of figures' : kind === 'index' ? 'Index' : kind === 'sources' ? 'Bibliography' : 'Contents'} onChange={(e) => set({ title: e.target.value || undefined })} />
      </label>
      {!kind && (
        <label className="field">
          <span>Show levels</span>
          <select aria-label="Show levels" value={look.levels ?? 3} onChange={(e) => set({ levels: Number(e.target.value) })}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'Heading 1 only' : `Headings 1 to ${n}`}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === 'figures' && (
        <label className="field">
          <span>Caption label</span>
          <select aria-label="Caption label" value={look.label ?? 'Figure'} onChange={(e) => set({ label: e.target.value })}>
            {labels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind !== 'sources' && (
        <>
          <label className="check-row">
            <input type="checkbox" checked={!look.noPages} onChange={(e) => set({ noPages: !e.target.checked || undefined })} /> Show page numbers (in page view)
          </label>
          <label className="check-row">
            <input type="checkbox" checked={!look.noDots} disabled={!!look.noPages} onChange={(e) => set({ noDots: !e.target.checked || undefined })} /> Dotted line to the page number
          </label>
        </>
      )}
      {!kind && <p className="sync-hint">Paragraphs can be added to it, or headings left out, with References → Add text to the contents.</p>}
    </Dialog>
  );
}

const ICON_REFS = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M9 11h7M9 15h5M9 7h3" />
    <circle cx="17.5" cy="17.5" r="0.6" fill="currentColor" />
  </svg>
);
