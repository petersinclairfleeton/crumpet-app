// Headers and footers on the page: showing them, and editing them in place
// the way Word does (double-click the top or bottom of a page).

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DATE_FORMATS, FIELDS, type HFBand, type HFRun, type HFSlotName, type HeadersFooters, NUMBER_FORMATS, SLOTS, formatDate, hasPageNumbers, tidyRuns, withPageNumbers } from '../data/headers';
import { Popover } from './Sidebar';

const SLOT_NAMES: Record<HFSlotName, string> = { left: 'left', center: 'centre', right: 'right' };

/** Text for a field or plain run. */
export type Resolve = (run: HFRun) => string;

function wrap(node: Node, run: HFRun): Node {
  let n = node;
  if (run.u) {
    const u = document.createElement('u');
    u.append(n);
    n = u;
  }
  if (run.i) {
    const i = document.createElement('i');
    i.append(n);
    n = i;
  }
  if (run.b) {
    const b = document.createElement('b');
    b.append(n);
    n = b;
  }
  return n;
}

export function fieldChip(run: HFRun, resolve: Resolve): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'hf-field';
  chip.contentEditable = 'false';
  chip.dataset.field = run.field!;
  if (run.fmt) chip.dataset.fmt = run.fmt;
  chip.title = FIELDS.find((f) => f.id === run.field)?.name ?? '';
  chip.textContent = chipText(run, resolve);
  return chip;
}

function chipText(run: HFRun, resolve: Resolve): string {
  return resolve(run) || `[${FIELDS.find((f) => f.id === run.field)?.name ?? run.field}]`;
}

/** Puts runs into an editable slot. */
function fillSlot(el: HTMLElement, runs: HFRun[], resolve: Resolve): void {
  el.textContent = '';
  for (const r of runs) {
    if (r.field) {
      el.append(wrap(fieldChip(r, resolve), r));
      continue;
    }
    const frag = document.createDocumentFragment();
    (r.text ?? '').split('\n').forEach((part, k) => {
      if (k) frag.append(document.createElement('br'));
      if (part) frag.append(part);
    });
    el.append(wrap(frag, r));
  }
  // A line break at the very end needs a second one to show.
  if (runs[runs.length - 1]?.text?.endsWith('\n')) el.append(document.createElement('br'));
}

/** Reads an edited slot back into runs. */
export function readSlot(el: HTMLElement): HFRun[] {
  const out: HFRun[] = [];
  type Marks = { b?: boolean; i?: boolean; u?: boolean };
  const newline = (m: Marks) => out.push({ text: '\n', ...m });
  const walk = (n: Node, m: Marks) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = (n as Text).data.replace(/ /g, ' ').replace(/​/g, '');
      if (text) out.push({ text, ...m });
      return;
    }
    if (!(n instanceof HTMLElement)) return;
    if (n.dataset.field) {
      out.push({ field: n.dataset.field as HFRun['field'], ...(n.dataset.fmt ? { fmt: n.dataset.fmt as HFRun['fmt'] } : {}), ...m });
      return;
    }
    if (n.tagName === 'BR') return newline(m);
    const mm: Marks = { ...m };
    const t = n.tagName;
    const st = n.style;
    if (t === 'B' || t === 'STRONG' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) mm.b = true;
    else if (st.fontWeight === 'normal' || st.fontWeight === '400') mm.b = false;
    if (t === 'I' || t === 'EM' || st.fontStyle === 'italic') mm.i = true;
    else if (st.fontStyle === 'normal') mm.i = false;
    if (t === 'U' || st.textDecorationLine.includes('underline')) mm.u = true;
    // Enter in some browsers makes a new line as a block.
    if ((t === 'DIV' || t === 'P') && out.length && !out[out.length - 1].text?.endsWith('\n')) newline(m);
    n.childNodes.forEach((c) => walk(c, mm));
  };
  el.childNodes.forEach((c) => walk(c, {}));
  const runs = tidyRuns(out);
  // The browser keeps a line break at the end so the caret has a line to sit on.
  const last = runs[runs.length - 1];
  if (last?.text?.endsWith('\n')) {
    last.text = last.text.slice(0, -1);
    if (!last.text) runs.pop();
  }
  return runs;
}

/** Runs as React elements, for showing (not editing). */
function Runs({ runs, resolve }: { runs: HFRun[]; resolve: Resolve }) {
  return (
    <>
      {runs.map((r, k) => {
        const text = r.field ? resolve(r) : (r.text ?? '');
        let node: ReactNode = text.includes('\n') ? text.split('\n').flatMap((p, j) => (j ? [<br key={j} />, p] : [p])) : text;
        if (r.u) node = <u>{node}</u>;
        if (r.i) node = <i>{node}</i>;
        if (r.b) node = <b>{node}</b>;
        return <span key={k}>{node}</span>;
      })}
    </>
  );
}

interface SlotProps {
  name: HFSlotName;
  kind: 'header' | 'footer';
  runs: HFRun[];
  resolve: Resolve;
  editing: boolean;
  onRuns(runs: HFRun[]): void;
  onFocusSlot(el: HTMLElement): void;
  onKey(e: React.KeyboardEvent<HTMLElement>): void;
}

function Slot({ name, kind, runs, resolve, editing, onRuns, onFocusSlot, onKey }: SlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef('');
  const json = JSON.stringify(runs);

  // Fill the editable slot, unless it already shows these runs (it's where the change came from).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !editing) return;
    if (shown.current !== json) {
      fillSlot(el, runs, resolve);
      shown.current = json;
    }
    // Keep field values up to date (the number of pages changes as you type).
    for (const chip of el.querySelectorAll<HTMLElement>('.hf-field')) {
      const t = chipText({ field: chip.dataset.field as HFRun['field'], fmt: chip.dataset.fmt as HFRun['fmt'] }, resolve);
      if (chip.textContent !== t) chip.textContent = t;
    }
  });

  // Different keys: React must not reuse the edited element, whose contents it doesn't manage.
  if (!editing) {
    return (
      <div key="show" className={`hf-slot ${name}`}>
        <Runs runs={runs} resolve={resolve} />
      </div>
    );
  }
  return (
    <div
      key="edit"
      ref={ref}
      className={`hf-slot ${name}`}
      data-slot={name}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={`${kind === 'header' ? 'Header' : 'Footer'}, ${SLOT_NAMES[name]}`}
      data-placeholder="Type here"
      spellCheck
      onFocus={(e) => onFocusSlot(e.currentTarget)}
      onInput={(e) => {
        const next = readSlot(e.currentTarget);
        shown.current = JSON.stringify(next);
        onRuns(next);
      }}
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' '));
      }}
      onKeyDown={onKey}
    />
  );
}

/** A header or footer: left, centre and right. */
export function Band({ kind, band, resolve, editing, line, onBand, onFocusSlot, onKey }: { kind: 'header' | 'footer'; band: HFBand; resolve: Resolve; editing: boolean; line: boolean; onBand(b: HFBand): void; onFocusSlot(el: HTMLElement): void; onKey(e: React.KeyboardEvent<HTMLElement>): void }) {
  return (
    <div className={`hf-band hf-${kind}${line ? ' lined' : ''}${editing ? ' editing' : ''}`}>
      {SLOTS.map((s) => (
        <Slot key={s} name={s} kind={kind} runs={band[s]} resolve={resolve} editing={editing} onRuns={(runs) => onBand({ ...band, [s]: runs })} onFocusSlot={onFocusSlot} onKey={onKey} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- the toolbar

const keep = (e: React.MouseEvent) => e.preventDefault();

/** Header & Footer tools, shown while editing them (like Word's tab of the same name). */
export function HFToolbar({ label, hf, chapters, onHF, onInsert, onClose, host }: { label: string; hf: HeadersFooters; chapters: boolean; onHF(hf: HeadersFooters): void; onInsert(run: HFRun): void; onClose(): void; host: HTMLElement | null }) {
  const [menu, setMenu] = useState<'insert' | 'options' | null>(null);
  const now = Date.now();
  const fields = FIELDS.filter((f) => chapters || !['chapter', 'chapterTitle', 'part', 'chapterPages'].includes(f.id));
  const insert = (run: HFRun) => {
    onInsert(run);
    setMenu(null);
  };
  const bar = (
      <div className="hf-bar" role="toolbar" aria-label="Header and footer" onMouseDown={(e) => (e.target as HTMLElement).closest('input, select, label') || keep(e)}>
        <span className="hf-bar-title">
          Header &amp; Footer <small>{label}</small>
        </span>
        <button type="button" className="icon-btn" aria-label="Bold" title="Bold" onClick={() => document.execCommand('bold')}>
          <b>B</b>
        </button>
        <button type="button" className="icon-btn" aria-label="Italic" title="Italic" onClick={() => document.execCommand('italic')}>
          <i>I</i>
        </button>
        <button type="button" className="icon-btn" aria-label="Underline" title="Underline" onClick={() => document.execCommand('underline')}>
          <u>U</u>
        </button>
        <span className="hf-menu">
          <button type="button" className="btn quiet small" aria-expanded={menu === 'insert'} onClick={() => setMenu(menu === 'insert' ? null : 'insert')}>
            Insert ▾
          </button>
          {menu === 'insert' && (
            <Popover label="Insert a field" onClose={() => setMenu(null)}>
              <button type="button" className="menu-item" onMouseDown={keep} onClick={() => insert({ field: 'page' })}>
                Page number
              </button>
              <button type="button" className="menu-item" onMouseDown={keep} onClick={() => { onInsert({ text: 'Page ' }); onInsert({ field: 'page' }); onInsert({ text: ' of ' }); insert({ field: 'pages' }); }}>
                Page X of Y
              </button>
              <hr />
              {fields
                .filter((f) => f.id !== 'page' && f.id !== 'date')
                .map((f) => (
                  <button key={f.id} type="button" className="menu-item" title={f.hint} onMouseDown={keep} onClick={() => insert({ field: f.id })}>
                    {f.name}
                  </button>
                ))}
              <hr />
              {DATE_FORMATS.map((d) => (
                <button key={d.id} type="button" className="menu-item" onMouseDown={keep} onClick={() => insert({ field: 'date', fmt: d.id })}>
                  Date: {formatDate(now, d.id)}
                </button>
              ))}
            </Popover>
          )}
        </span>
        <span className="hf-menu">
          <button type="button" className="btn quiet small" aria-expanded={menu === 'options'} onClick={() => setMenu(menu === 'options' ? null : 'options')}>
            Options ▾
          </button>
          {menu === 'options' && (
            <Popover label="Header and footer options" onClose={() => setMenu(null)}>
              <HFOptions hf={hf} chapters={chapters} onChange={onHF} />
            </Popover>
          )}
        </span>
        <span className="grow" />
        <button type="button" className="btn primary small" onClick={onClose}>
          Close
        </button>
      </div>
  );
  // Below the pane's own toolbar, where it doesn't cover the page; on its own above the pages otherwise.
  return host ? createPortal(bar, host) : <div className="hf-bar-anchor">{bar}</div>;
}

const metric = typeof navigator !== 'undefined' && !/^en-(US|CA)|^es-(US|MX)/.test(navigator.language || 'en-US');

/** The settings for headers and footers, in the toolbar and in Page setup. */
export function HFOptions({ hf, chapters, onChange }: { hf: HeadersFooters; chapters: boolean; onChange(hf: HeadersFooters): void }) {
  const unit = metric ? 'cm' : 'in';
  const show = (inches: number) => Math.round((metric ? inches * 2.54 : inches) * 100) / 100;
  const read = (v: number) => (metric ? v / 2.54 : v);
  const check = (key: 'differentFirst' | 'differentChapterFirst' | 'headerLine' | 'footerLine', label: string) => (
    <label className="check">
      <input type="checkbox" checked={hf[key]} onChange={(e) => onChange({ ...hf, [key]: e.target.checked })} /> {label}
    </label>
  );
  return (
    <div className="hf-options" role="group" aria-label="Header and footer options">
      <label className="check">
        <input type="checkbox" checked={hasPageNumbers(hf)} onChange={(e) => onChange(withPageNumbers(hf, e.target.checked))} /> Page numbers
      </label>
      {check('differentFirst', 'Different first page')}
      {chapters && check('differentChapterFirst', 'Different first page of each chapter')}
      <label className="check">
        <input
          type="checkbox"
          checked={hf.differentOddEven}
          // Even pages start as a copy of the others, to change from there.
          onChange={(e) => onChange({ ...hf, differentOddEven: e.target.checked, sets: e.target.checked && !hf.sets.even && hf.sets.main ? { ...hf.sets, even: structuredClone(hf.sets.main) } : hf.sets })}
        />{' '}
        Different odd and even pages
      </label>
      <div className="style-row">
        <label className="style-num">
          <span>Number format</span>
          <select aria-label="Number format" value={hf.numberFormat} onChange={(e) => onChange({ ...hf, numberFormat: e.target.value as HeadersFooters['numberFormat'] })}>
            {NUMBER_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="style-num">
          <span>Start at</span>
          <input type="number" min={0} step={1} aria-label="Start page numbers at" value={hf.startAt} onChange={(e) => e.target.value !== '' && onChange({ ...hf, startAt: Math.max(0, Math.round(Number(e.target.value))) })} />
        </label>
      </div>
      <div className="style-row">
        <label className="style-num">
          <span>Header from top</span>
          <span className="with-unit">
            <input type="number" min={0} step={0.1} value={show(hf.headerFrom)} onChange={(e) => e.target.value !== '' && onChange({ ...hf, headerFrom: Math.max(0, read(Number(e.target.value))) })} />
            <small>{unit}</small>
          </span>
        </label>
        <label className="style-num">
          <span>Footer from bottom</span>
          <span className="with-unit">
            <input type="number" min={0} step={0.1} value={show(hf.footerFrom)} onChange={(e) => e.target.value !== '' && onChange({ ...hf, footerFrom: Math.max(0, read(Number(e.target.value))) })} />
            <small>{unit}</small>
          </span>
        </label>
      </div>
      {check('headerLine', 'Line under the header')}
      {check('footerLine', 'Line above the footer')}
      <label className="field">
        <span>Author name</span>
        <input value={hf.author ?? ''} placeholder="Your name from Settings" onChange={(e) => onChange({ ...hf, author: e.target.value || undefined })} />
      </label>
    </div>
  );
}

/** Places a run at the caret in a slot (or at its end). */
export function insertRun(slot: HTMLElement, range: Range | null, run: HFRun, resolve: Resolve): void {
  const live = getSelection();
  const inSlot = (x: Range | null | undefined) => !!x && slot.contains(x.commonAncestorContainer);
  const now = live && live.rangeCount ? live.getRangeAt(0) : null;
  let r: Range;
  if (inSlot(now)) r = now!;
  else if (inSlot(range)) r = range!;
  else {
    r = document.createRange();
    r.selectNodeContents(slot);
    r.collapse(false);
  }
  const node = run.field ? fieldChip(run, resolve) : document.createTextNode(run.text ?? '');
  r.deleteContents();
  r.insertNode(node);
  r.setStartAfter(node);
  r.collapse(true);
  const sel = getSelection();
  sel?.removeAllRanges();
  sel?.addRange(r);
  slot.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Remembers the caret in the slot being edited, for inserting from the toolbar. */
export function useSlotCaret(active: React.MutableRefObject<HTMLElement | null>) {
  const range = useRef<Range | null>(null);
  useEffect(() => {
    const onSel = () => {
      const sel = getSelection();
      const el = active.current;
      if (sel && sel.rangeCount && el && el.contains(sel.anchorNode)) range.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [active]);
  return range;
}
