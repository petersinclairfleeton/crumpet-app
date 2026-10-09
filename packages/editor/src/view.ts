// The view: draws the model into a contenteditable element and translates
// between DOM positions and model positions. Only blocks whose model object
// changed are rebuilt; the rest of the DOM is left alone.

import type { Block, CodeLang, CodeLook, Doc, Mark, Pos, Run, Selection } from './model';
import { isCovered, mergeAt } from './table';
import { type ShapeLook, tidyShape } from './shape';
import { fillCell, readCell } from './cells';
import { BULLETS, foldedUnder, isHeading, isList, isToggle, listLabels, runsLength, tidyCode } from './model';

const TAGS: Record<Block['type'], string> = {
  paragraph: 'p',
  heading1: 'h1',
  heading2: 'h2',
  heading3: 'h3',
  heading4: 'h4',
  todo: 'div',
  bullet: 'div',
  numbered: 'div',
  quote: 'blockquote',
  image: 'figure',
  file: 'div',
  table: 'div',
  toc: 'nav',
  shape: 'div',
  code: 'div',
};

/**
 * Turns a picture's or file's `src` into an address the browser can show
 * (the app keeps files itself). Without one, `src` is used as it is.
 */
export type MediaResolver = (src: string) => string | Promise<string>;
let resolveMedia: MediaResolver = (src) => src;
export function setMediaResolver(fn: MediaResolver): void {
  resolveMedia = fn;
}

/** The file name shown for an attached file: its path without the folder or the id in front. */
export function fileLabel(src: string): string {
  const name = decodeURIComponent(src.split('/').pop() ?? src);
  return name.replace(/^[0-9a-z]{6,}-/i, '');
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const MARK_TAGS: Record<Mark, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  code: 'code',
};

interface Rendered {
  block: Block;
  el: HTMLElement;
}

export class View {
  private rendered = new Map<string, Rendered>();

  /** Entries for a table of contents other than this document's headings (a book's, set by the app). */
  tocOverride: TocEntry[] | null = null;
  /** Footnotes before this document's first (a book's earlier chapters), so its numbers run on. */
  footnoteStart = 0;

  constructor(public root: HTMLElement) {
    root.contentEditable = 'true';
    root.spellcheck = true;
    root.setAttribute('role', 'textbox');
    root.setAttribute('aria-multiline', 'true');
    root.classList.add('editor');
  }

  /** Draws the doc. Blocks whose model object is unchanged keep their DOM. */
  render(doc: Doc, force: Set<string> = new Set()): void {
    const live = new Set<string>();
    for (const block of doc.blocks) {
      live.add(block.id);
      const old = this.rendered.get(block.id);
      if (old && old.block === block && !force.has(block.id)) continue;
      // A table being edited keeps its element: only cells that changed are updated, so the caret stays put.
      // A shape being typed in likewise keeps its text box.
      if (old && old.block.type === 'shape' && block.type === 'shape' && patchShape(old.el, block)) {
        this.rendered.set(block.id, { block, el: old.el });
        continue;
      }
      if (old && old.block.type === 'code' && block.type === 'code' && patchCode(old.el, block)) {
        this.rendered.set(block.id, { block, el: old.el });
        continue;
      }
      if (old && old.block.type === 'table' && block.type === 'table' && patchTable(old.el, block)) {
        this.rendered.set(block.id, { block, el: old.el });
        continue;
      }
      const el = buildBlock(block);
      if (old) old.el.replaceWith(el);
      this.rendered.set(block.id, { block, el });
    }
    for (const [id, r] of this.rendered) {
      if (!live.has(id)) {
        r.el.remove();
        this.rendered.delete(id);
      }
    }
    // Put elements in document order, moving only what is out of place.
    let cursor: ChildNode | null = this.root.firstChild;
    for (const block of doc.blocks) {
      const el = this.rendered.get(block.id)!.el;
      if (el === cursor) {
        cursor = cursor.nextSibling;
      } else {
        this.root.insertBefore(el, cursor);
      }
    }
    // Anything left over was not put there by us (e.g. a browser-inserted node).
    while (cursor) {
      const next: ChildNode | null = cursor.nextSibling;
      cursor.remove();
      cursor = next;
    }
    // Sections under folded headings, and folded toggles' content, are hidden (kept in the text, just not shown).
    let hideBelow = 0;
    const inToggle = new Map<string, boolean>();
    doc.blocks.forEach((block, i) => {
      if (isToggle(block)) for (const x of foldedUnder(doc, i)) inToggle.set(x.id, !!block.folded);
    });
    for (const block of doc.blocks) {
      const el = this.rendered.get(block.id)!.el;
      const level = isHeading(block.type) ? Number(block.type.slice(-1)) : 99;
      if (hideBelow && level <= hideBelow) hideBelow = 0;
      el.toggleAttribute('data-folded-away', !!hideBelow || inToggle.get(block.id) === true);
      el.toggleAttribute('data-in-toggle', inToggle.has(block.id));
      if (!hideBelow && block.folded && isHeading(block.type)) hideBelow = level;
    }
    // List numbers, worked out here (not by CSS counters) so they stay right however the page splits the text.
    const labels = listLabels(doc.blocks);
    for (const block of doc.blocks) {
      if (block.type !== 'numbered') continue;
      const el = this.rendered.get(block.id)!.el;
      const label = labels.get(block.id) ?? '';
      if (el.dataset.label !== label) el.dataset.label = label;
    }
    // A table of contents lists the headings as they are now.
    if (doc.blocks.some((b) => b.type === 'toc')) {
      const entries = this.tocOverride ?? tocEntries(doc);
      for (const block of doc.blocks) if (block.type === 'toc') fillToc(this.rendered.get(block.id)!.el, entries);
    }
    this.numberFootnotes();
    const empty = doc.blocks.length === 1 && runsLength(doc.blocks[0].runs) === 0 && doc.blocks[0].type === 'paragraph';
    this.root.toggleAttribute('data-empty', empty);
  }

  /** Footnotes are numbered in order through the whole note (or book). */
  numberFootnotes(): void {
    this.root.querySelectorAll<HTMLElement>('sup.fn').forEach((el, i) => {
      const n = String(i + 1 + this.footnoteStart);
      if (el.dataset.n !== n) el.dataset.n = n;
    });
  }

  blockElement(id: string): HTMLElement | null {
    return this.rendered.get(id)?.el ?? null;
  }

  /** A block's element and, in page view, the continuations of it on later columns and pages, in order. */
  pieces(id: string): HTMLElement[] {
    const el = this.blockElement(id);
    if (!el) return [];
    if (!el.hasAttribute('data-split')) return [el];
    return [el, ...Array.from(this.root.querySelectorAll<HTMLElement>(`[data-block="${CSS.escape(id)}"][data-cont]`))];
  }

  /** The text the DOM currently shows for a block (may differ from the model during IME composition). */
  blockText(id: string): string | null {
    const el = this.blockElement(id);
    if (!el || !el.isConnected) return null;
    return this.pieces(id)
      .map((p) => textEl(p).textContent ?? '')
      .join('');
  }

  /** True if the DOM still has exactly the block elements we rendered, in order. */
  structureIntact(doc: Doc): boolean {
    const kids = Array.from(this.root.children);
    if (kids.some((k) => k.classList.contains('pg'))) {
      // Page view: the blocks are in the pages' columns.
      const heads = Array.from(this.root.querySelectorAll<HTMLElement>(':scope > .pg > .pg-band > .pg-col > [data-block]:not([data-cont])'));
      return heads.length === doc.blocks.length && doc.blocks.every((b, i) => heads[i] === this.rendered.get(b.id)?.el);
    }
    return kids.length === doc.blocks.length && doc.blocks.every((b, i) => kids[i] === this.rendered.get(b.id)?.el);
  }

  domToPos(node: Node, offset: number): Pos | null {
    if (!(node instanceof Element ? node : node.parentElement)?.closest('[data-block]')) {
      // The text itself, or a page, band or column around the blocks: the block just after (or before) that point.
      if (!(node instanceof Element) || !this.root.contains(node)) return null;
      const kid = node.childNodes[offset] as Node | undefined;
      const blockIn = (n: Node | undefined, last: boolean): HTMLElement | null => {
        if (!(n instanceof HTMLElement)) return null;
        if (n.dataset.block) return n;
        const all = n.querySelectorAll<HTMLElement>('[data-block]');
        return all.length ? all[last ? all.length - 1 : 0] : null;
      };
      const after = blockIn(kid, false);
      if (after) return { block: after.dataset.block!, offset: Number(after.dataset.from ?? 0) };
      const before = blockIn(node.childNodes[offset - 1] ?? node, true);
      if (!before) return null;
      return { block: before.dataset.block!, offset: Number(before.dataset.from ?? 0) + (textEl(before).textContent ?? '').length };
    }
    const el = (node instanceof Element ? node : node.parentElement)!.closest<HTMLElement>('[data-block]')!;
    if (!this.root.contains(el)) return null;
    const id = el.dataset.block!;
    const base = Number(el.dataset.from ?? 0);
    const text = textEl(el);
    if (!text.contains(node)) {
      // Selection on the block element itself or its checkbox.
      if (node === el && offset > Array.prototype.indexOf.call(el.childNodes, text)) {
        return { block: id, offset: base + (text.textContent ?? '').length };
      }
      return { block: id, offset: base };
    }
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(node, offset);
    return { block: id, offset: base + range.toString().length };
  }

  posToDom(pos: Pos): { node: Node; offset: number } | null {
    const pieces = this.pieces(pos.block);
    if (!pieces.length) return null;
    let remaining = pos.offset;
    let last: Text | null = null;
    for (const piece of pieces) {
      const walker = document.createTreeWalker(textEl(piece), NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
        // Prefer the end of the earlier node at a boundary, so the caret takes the marks of the text before it.
        if (remaining <= n.data.length) return { node: n, offset: remaining };
        remaining -= n.data.length;
        last = n;
      }
    }
    if (last) return { node: last, offset: last.data.length };
    return { node: textEl(pieces[0]), offset: 0 };
  }

  readSelection(): Selection | null {
    const sel = this.root.ownerDocument.getSelection();
    if (!sel || !sel.anchorNode || !sel.focusNode) return null;
    if (!this.root.contains(sel.anchorNode) || !this.root.contains(sel.focusNode)) return null;
    const anchor = this.domToPos(sel.anchorNode, sel.anchorOffset);
    const focus = this.domToPos(sel.focusNode, sel.focusOffset);
    return anchor && focus ? { anchor, focus } : null;
  }

  writeSelection(selection: Selection): void {
    const a = this.posToDom(selection.anchor);
    const f = this.posToDom(selection.focus);
    const sel = this.root.ownerDocument.getSelection();
    if (!a || !f || !sel) return;
    if (sel.anchorNode === a.node && sel.anchorOffset === a.offset && sel.focusNode === f.node && sel.focusOffset === f.offset) return;
    sel.setBaseAndExtent(a.node, a.offset, f.node, f.offset);
  }
}

function textEl(blockEl: HTMLElement): HTMLElement {
  return blockEl.querySelector<HTMLElement>(':scope > .text') ?? blockEl;
}

function buildBlock(block: Block): HTMLElement {
  const el = document.createElement(TAGS[block.type]);
  el.className = `blk blk-${block.type}`;
  el.dataset.block = block.id;
  if (block.style) el.dataset.style = block.style;
  if (block.align) el.dataset.align = block.align;
  if (isList(block.type)) {
    el.classList.add('blk-list');
    el.dataset.indent = String(block.indent ?? 0);
    el.style.setProperty('--indent', String(block.indent ?? 0));
  }
  // Spacing and indents set on this paragraph by hand win over its style's.
  const p = block.para;
  if (p) {
    if (p.before !== undefined) el.style.marginTop = `${p.before}pt`;
    if (p.after !== undefined) el.style.marginBottom = `${p.after}pt`;
    if (p.line !== undefined) el.style.lineHeight = String(p.line * 1.15);
    if (p.left !== undefined) el.style.marginLeft = isList(block.type) ? `calc(${p.left}in + var(--indent, 0) * 24px)` : `${p.left}in`;
    if (p.right !== undefined) el.style.marginRight = `${p.right}in`;
    if (p.first !== undefined) el.style.textIndent = `${p.first}in`;
    if (p.first !== undefined && p.first < 0 && p.left === undefined) el.style.marginLeft = `${-p.first}in`;
    if (p.pageBefore) el.dataset.pageBefore = '';
    if (p.keepNext) el.dataset.keepNext = '';
    if (p.keepLines) el.dataset.keepLines = '';
    if (p.colBefore) el.dataset.colBefore = '';
    if (p.sect) {
      // A section break before this paragraph: what the section after it is like.
      el.dataset.sect = p.sect;
      if (p.cols) el.dataset.cols = String(p.cols);
      if (p.orient) el.dataset.orient = p.orient;
      // The section's own margins, in inches.
      if (p.mt !== undefined) el.dataset.mt = String(p.mt);
      if (p.mb !== undefined) el.dataset.mb = String(p.mb);
      if (p.ml !== undefined) el.dataset.ml = String(p.ml);
      if (p.mr !== undefined) el.dataset.mr = String(p.mr);
    }
    if (block.type === 'numbered' && p.num) el.dataset.num = p.num;
    if (block.type === 'bullet' && p.bullet) el.dataset.bullet = BULLETS[p.bullet];
    if (p.border) {
      el.dataset.border = p.border;
      for (const [c, side] of [['t', 'Top'], ['b', 'Bottom'], ['l', 'Left'], ['r', 'Right']] as const) if (p.border.includes(c)) el.style.setProperty(`border-${side.toLowerCase()}`, '1px solid currentColor');
    }
    if (p.shade) {
      el.dataset.shade = '';
      el.style.backgroundColor = p.shade;
    }
  }
  if (block.type === 'todo') {
    el.classList.toggle('checked', !!block.checked);
    const box = document.createElement('span');
    box.className = 'check';
    box.contentEditable = 'false';
    box.setAttribute('role', 'checkbox');
    box.setAttribute('aria-checked', String(!!block.checked));
    box.setAttribute('aria-label', 'Done');
    el.appendChild(box);
  }
  if (block.type === 'image' || block.type === 'file') el.appendChild(buildMedia(block));
  if (block.type === 'table') el.appendChild(buildTable(block));
  if (block.type === 'shape') {
    el.dataset.wrap = block.shape?.wrap ?? 'inline';
    el.appendChild(buildShape(block));
  }
  if (block.type === 'code') el.appendChild(buildCode(block));
  if (block.type === 'toc') {
    const box = document.createElement('div');
    box.className = 'toc-box';
    box.contentEditable = 'false';
    box.dataset.widget = 'toc';
    el.setAttribute('aria-label', 'Table of contents');
    el.appendChild(box);
  }
  if (isHeading(block.type) || isToggle(block)) {
    // The arrow that folds the section away (shown on hover, and always when folded or on a toggle).
    el.toggleAttribute('data-folded', !!block.folded);
    const fold = document.createElement('span');
    fold.className = 'fold';
    fold.contentEditable = 'false';
    fold.setAttribute('role', 'button');
    fold.setAttribute('aria-label', isToggle(block) ? (block.folded ? 'Open this toggle' : 'Close this toggle') : block.folded ? 'Show this section' : 'Fold this section away');
    fold.setAttribute('aria-expanded', String(!block.folded));
    el.appendChild(fold);
  }
  if (block.brk) {
    // Track changes: the paragraph break before this one was added or deleted.
    el.dataset.brk = block.brk.kind;
    const mark = document.createElement('span');
    mark.className = `brk ${block.brk.kind}`;
    mark.contentEditable = 'false';
    mark.title = `Paragraph break ${block.brk.kind === 'ins' ? 'added' : 'deleted'} by ${block.brk.author || 'someone'}`;
    el.appendChild(mark);
  } else delete el.dataset.brk;
  const text = document.createElement('span');
  text.className = 'text';
  if (!block.runs.length) {
    text.appendChild(document.createElement('br'));
  }
  for (const run of block.runs) text.appendChild(runNode(run));
  el.appendChild(text);
  return el;
}

/** A run of text as the page shows it: its marks, look, footnote, change, comment and link around it. */
export function runNode(run: Run): Node {
  let node: Node = document.createTextNode(run.text);
  for (const mark of [...run.marks].reverse()) {
    const wrap = document.createElement(MARK_TAGS[mark]);
    wrap.appendChild(node);
    node = wrap;
  }
  if (run.look) {
    // Font, size, colour and highlight, as chosen for this text.
    const span = document.createElement('span');
    span.className = 'lk';
    const l = run.look;
    if (l.font) span.style.fontFamily = `"${l.font.replace(/"/g, '')}", var(--note-font, serif)`;
    if (l.size) span.style.fontSize = `${l.size}pt`;
    if (l.color) span.style.color = l.color;
    if (l.highlight) span.style.backgroundColor = l.highlight;
    if (l.va) {
      span.style.verticalAlign = l.va;
      span.style.fontSize = l.size ? `${l.size * 0.65}pt` : '0.65em';
      span.style.lineHeight = '0';
    }
    span.appendChild(node);
    node = span;
  }
  if (run.footnote !== undefined) {
    // The marker: an invisible character in the text, with its number drawn beside it.
    const sup = document.createElement('sup');
    sup.className = 'fn';
    sup.title = run.footnote || 'Footnote';
    sup.appendChild(node);
    node = sup;
  }
  if (run.change) {
    // Track changes: added text underlined, deleted text struck through.
    const el = document.createElement(run.change.kind);
    el.className = 'trk';
    const who = run.change.author || 'Someone';
    el.title = `${run.change.kind === 'ins' ? 'Added' : 'Deleted'} by ${who}${run.change.at ? `, ${new Date(run.change.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : ''}`;
    el.appendChild(node);
    node = el;
  }
  if (run.comment) {
    // Commented text is highlighted; the comment itself is shown by the app.
    const mark = document.createElement('mark');
    mark.className = 'cmt';
    mark.dataset.comment = run.comment.id;
    mark.appendChild(node);
    node = mark;
  }
  if (run.link) {
    const a = document.createElement('a');
    a.href = run.link;
    a.title = `${run.link} (${isMac ? '⌘' : 'Ctrl'}-click to open)`;
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    a.appendChild(node);
    node = a;
  }
  return node;
}

/** The picture, or the attached file's chip, above a media block's caption. */
function buildMedia(block: Block): HTMLElement {
  const box = document.createElement('span');
  box.className = 'media';
  box.contentEditable = 'false';
  const src = block.src ?? '';
  const show = (apply: (url: string) => void) => {
    const r = resolveMedia(src);
    if (typeof r === 'string') apply(r);
    else void r.then(apply, () => box.classList.add('missing'));
  };
  if (block.type === 'image') {
    const img = document.createElement('img');
    img.alt = block.runs.map((r) => r.text).join('');
    img.draggable = false;
    img.decoding = 'async';
    img.addEventListener('error', () => box.classList.add('missing'));
    show((url) => (img.src = url));
    box.appendChild(img);
  } else {
    const a = document.createElement('a');
    a.className = 'file-chip';
    a.textContent = fileLabel(src);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = fileLabel(src);
    show((url) => (a.href = url));
    box.appendChild(a);
  }
  return box;
}

// ---------------------------------------------------------------- table of contents

/**
 * A line of a table of contents: a heading in this document (`id`), or
 * something elsewhere (a chapter of the book, `chapter`), with its page
 * number when it's known from elsewhere.
 */
export interface TocEntry {
  id?: string;
  chapter?: string;
  level: number;
  text: string;
  page?: number;
}

/** The headings a table of contents lists (Heading 1 to 3, as Word's own does). */
export function tocEntries(doc: Doc): TocEntry[] {
  return doc.blocks
    .filter((b) => (b.type === 'heading1' || b.type === 'heading2' || b.type === 'heading3') && b.runs.some((r) => r.text.trim() && r.change?.kind !== 'del'))
    .map((b) => ({ id: b.id, level: Number(b.type.slice(-1)), text: b.runs.filter((r) => r.change?.kind !== 'del' && !r.footnote).map((r) => r.text).join('').trim() }));
}

function fillToc(el: HTMLElement, entries: TocEntry[]): void {
  const box = el.querySelector<HTMLElement>('.toc-box');
  if (!box) return;
  const key = JSON.stringify(entries);
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.textContent = '';
  const head = document.createElement('div');
  head.className = 'toc-title';
  head.textContent = 'Contents';
  box.appendChild(head);
  if (!entries.length) {
    const none = document.createElement('div');
    none.className = 'toc-none';
    none.textContent = 'Headings you add (Heading 1 to 3) are listed here.';
    box.appendChild(none);
  }
  for (const e of entries) {
    const row = document.createElement('a');
    row.className = `toc-entry toc-${e.level}`;
    row.href = `#${e.id ?? e.chapter ?? ''}`;
    if (e.id) row.dataset.tocTarget = e.id;
    if (e.chapter) row.dataset.tocChapter = e.chapter;
    const text = document.createElement('span');
    text.className = 'toc-text';
    text.textContent = e.text;
    const dots = document.createElement('span');
    dots.className = 'toc-dots';
    const page = document.createElement('span');
    page.className = 'toc-page';
    // A page number from elsewhere stays; one for a heading here is filled in by page view.
    if (e.page !== undefined) {
      page.textContent = String(e.page);
      page.dataset.fixed = '';
    }
    row.append(text, dots, page);
    box.appendChild(row);
  }
}

// ---------------------------------------------------------------- text boxes and shapes

const SHAPE_COLORS: [string, string][] = [
  ['#ffffff', 'White'], ['#f2f2f2', 'Light grey'], ['#fff2cc', 'Light gold'], ['#fce5cd', 'Light orange'], ['#f4cccc', 'Light red'],
  ['#d9d2e9', 'Light purple'], ['#cfe2f3', 'Light blue'], ['#d9ead3', 'Light green'], ['#333333', 'Dark grey'], ['#1155cc', 'Blue'],
];

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The shape itself, drawn to fill its box. */
function shapeArt(s: ShapeLook): SVGSVGElement {
  const W = s.w * 96;
  const H = s.h * 96;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'shape-art');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const add = (tag: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    el.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(el);
    return el;
  };
  const fill = s.fill ?? 'none';
  const stroke = s.line ?? 'none';
  const sw = 1.5;
  if (s.kind === 'rect') add('rect', { x: sw / 2, y: sw / 2, width: W - sw, height: H - sw, fill, stroke, 'stroke-width': sw });
  else if (s.kind === 'rounded') add('rect', { x: sw / 2, y: sw / 2, width: W - sw, height: H - sw, rx: Math.min(W, H) * 0.18, fill, stroke, 'stroke-width': sw });
  else if (s.kind === 'ellipse') add('ellipse', { cx: W / 2, cy: H / 2, rx: W / 2 - sw, ry: H / 2 - sw, fill, stroke, 'stroke-width': sw });
  else {
    const head = s.kind === 'arrow' ? Math.min(14, W / 4) : 0;
    add('line', { x1: 0, y1: H / 2, x2: W - head, y2: H / 2, stroke: s.line ?? '#333333', 'stroke-width': 2 });
    if (head) add('polygon', { points: `${W - head},${H / 2 - head / 2} ${W},${H / 2} ${W - head},${H / 2 + head / 2}`, fill: s.line ?? '#333333' });
  }
  return svg;
}

/** A text box or shape: drawn at its size, with its text, a corner to drag, and a menu under it. */
function buildShape(block: Block): HTMLElement {
  const s = block.shape ?? tidyShape(undefined);
  const wrap = document.createElement('div');
  wrap.className = 'shape-wrap';
  wrap.contentEditable = 'false';
  wrap.dataset.widget = 'shape';
  const box = document.createElement('div');
  box.className = 'shape-box';
  box.style.width = `${s.w}in`;
  box.style.height = `${s.h}in`;
  box.dataset.kind = s.kind;
  box.appendChild(shapeArt(s));
  if (s.kind !== 'line' && s.kind !== 'arrow') {
    const text = document.createElement('div');
    text.className = 'cell shape-text';
    text.contentEditable = 'true';
    text.setAttribute('role', 'textbox');
    text.setAttribute('aria-label', 'Text in the shape');
    fillCell(text, s.text);
    box.appendChild(text);
  }
  const grip = document.createElement('span');
  grip.className = 'shape-grip';
  grip.dataset.shapeAction = 'resize';
  grip.title = 'Drag to resize';
  box.appendChild(grip);
  const tools = document.createElement('div');
  tools.className = 'table-tools shape-tools';
  const button = (action: string, label: string, title = label, value?: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.shapeAction = action;
    if (value !== undefined) b.dataset.value = value;
    b.textContent = label;
    b.title = title;
    b.tabIndex = -1;
    return b;
  };
  tools.append(button('menu', 'Shape ▾', 'Fill, line and wrapping'));
  const menu = document.createElement('div');
  menu.className = 'table-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Shape');
  const group = (name: string, items: HTMLElement[]) => {
    const g = document.createElement('div');
    g.className = 'table-menu-group';
    const h = document.createElement('span');
    h.className = 'table-menu-head';
    h.textContent = name;
    g.append(h, ...items);
    menu.appendChild(g);
  };
  const swatches = (action: string, what: string) => {
    const box = document.createElement('div');
    box.className = 'table-swatches';
    for (const [hex, name] of SHAPE_COLORS) {
      const b = button(action, '', `${what}: ${name}`, hex);
      b.setAttribute('aria-label', `${what} ${name.toLowerCase()}`);
      b.style.background = hex;
      box.appendChild(b);
    }
    return box;
  };
  group('Fill', [swatches('fill', 'Fill'), button('fill', 'No fill', 'No fill', '')]);
  group('Line', [swatches('line', 'Line'), button('line', 'No line', 'No line', '')]);
  group('Wrap text', [button('wrap', 'In line with text', 'In line with text', 'inline'), button('wrap', 'Square, on the left', 'Text wraps round it, on the left', 'left'), button('wrap', 'Square, on the right', 'Text wraps round it, on the right', 'right')]);
  group('', [button('delete', 'Delete shape')]);
  tools.appendChild(menu);
  wrap.append(box, tools);
  markShape(wrap, s);
  return wrap;
}

/** Shows the shape's wrapping and colours as chosen in its menu. */
function markShape(wrap: HTMLElement, s: ShapeLook): void {
  wrap.closest<HTMLElement>('.blk')?.setAttribute('data-wrap', s.wrap);
  wrap.querySelectorAll<HTMLElement>('[data-shape-action="wrap"]').forEach((b) => b.classList.toggle('on', b.dataset.value === s.wrap));
}

/** Updates a shape in place (keeping its text box, which may be being typed in). False when it must be built again. */
function patchShape(el: HTMLElement, block: Block): boolean {
  const s = block.shape;
  const box = el.querySelector<HTMLElement>('.shape-box');
  if (!s || !box || box.dataset.kind !== s.kind) return false;
  box.style.width = `${s.w}in`;
  box.style.height = `${s.h}in`;
  box.querySelector('.shape-art')?.replaceWith(shapeArt(s));
  const text = box.querySelector<HTMLElement>('.shape-text');
  if (text && text !== el.ownerDocument.activeElement && readCell(text) !== s.text) fillCell(text, s.text);
  el.dataset.wrap = s.wrap;
  markShape(box.parentElement!, s);
  if (block.align) el.dataset.align = block.align;
  else delete el.dataset.align;
  return true;
}

// ---------------------------------------------------------------- maths and diagrams

/** Draws maths or a diagram from its source into `out` (set by the app, which has KaTeX and Mermaid). */
export type CodeRenderer = (lang: CodeLang, text: string, out: HTMLElement) => void;
let codeRenderer: CodeRenderer | null = null;
export function setCodeRenderer(f: CodeRenderer | null): void {
  codeRenderer = f;
}

const CODE_NAMES: Partial<Record<CodeLang, string>> = { math: 'Maths', mermaid: 'Diagram' };

function drawCode(preview: HTMLElement, c: CodeLook): void {
  if (preview.dataset.drawn === `${c.lang}\n${c.text}`) return;
  preview.dataset.drawn = `${c.lang}\n${c.text}`;
  preview.textContent = '';
  if (!c.text.trim()) {
    preview.textContent = c.lang === 'math' ? 'Type maths (LaTeX), like E = mc^2 or \\frac{a}{b}' : c.lang === 'mermaid' ? 'Type a diagram (Mermaid), like graph LR; A --> B' : 'An empty board';
    preview.classList.add('code-empty');
    return;
  }
  preview.classList.remove('code-empty');
  if (codeRenderer) codeRenderer(c.lang, c.text, preview);
  else preview.textContent = c.text;
}

/** Maths or a diagram: its source in a box of its own (shown while editing), and drawn below. */
function buildCode(block: Block): HTMLElement {
  const c = tidyCode(block.code);
  const wrap = document.createElement('div');
  wrap.className = 'code-wrap';
  wrap.contentEditable = 'false';
  wrap.dataset.widget = 'code';
  wrap.dataset.lang = c.lang;
  const head = document.createElement('div');
  head.className = 'code-head';
  const kind = document.createElement('select');
  kind.dataset.codeLang = '';
  kind.setAttribute('aria-label', 'Kind');
  for (const k of Object.keys(CODE_NAMES) as CodeLang[]) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = CODE_NAMES[k] ?? k;
    kind.appendChild(o);
  }
  kind.value = c.lang;
  head.appendChild(kind);
  const src = document.createElement('textarea');
  src.className = 'code-src';
  src.dataset.code = '';
  src.spellcheck = false;
  src.setAttribute('aria-label', c.lang === 'math' ? 'Maths source (LaTeX)' : 'Diagram source (Mermaid)');
  src.value = c.text;
  src.rows = Math.max(2, c.text.split('\n').length + 1);
  const preview = document.createElement('div');
  preview.className = 'code-preview';
  preview.dataset.codePreview = '';
  preview.title = 'Click to edit';
  wrap.append(head, src, preview);
  drawCode(preview, c);
  return wrap;
}

/** Updates maths or a diagram in place (keeping its source box, which may be being typed in). */
function patchCode(el: HTMLElement, block: Block): boolean {
  const wrap = el.querySelector<HTMLElement>('.code-wrap');
  const src = wrap?.querySelector<HTMLTextAreaElement>('.code-src');
  const preview = wrap?.querySelector<HTMLElement>('.code-preview');
  const kind = wrap?.querySelector<HTMLSelectElement>('select');
  if (!wrap || !src || !preview || !kind) return false;
  const c = tidyCode(block.code);
  wrap.dataset.lang = c.lang;
  kind.value = c.lang;
  if (src !== el.ownerDocument.activeElement && src.value !== c.text) src.value = c.text;
  src.rows = Math.max(2, src.value.split('\n').length + 1);
  drawCode(preview, c);
  return true;
}

// ---------------------------------------------------------------- tables

/** A table you type in directly: each cell is its own little editable box. */
function buildTable(block: Block): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  wrap.contentEditable = 'false';
  wrap.dataset.widget = 'table';
  const tools = document.createElement('div');
  tools.className = 'table-tools';
  const button = (action: string, label: string, title = label, value?: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.tableAction = action;
    if (value !== undefined) b.dataset.value = value;
    b.textContent = label;
    b.title = title;
    b.tabIndex = -1;
    return b;
  };
  tools.append(button('row', '+ Row', 'Insert a row below'), button('col', '+ Column', 'Insert a column to the right'), button('menu', 'Table ▾', 'Table layout and design'));
  // Word's Table Layout and Table Design, in a menu under the table.
  const menu = document.createElement('div');
  menu.className = 'table-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Table');
  const group = (name: string, items: HTMLElement[]) => {
    const g = document.createElement('div');
    g.className = 'table-menu-group';
    const h = document.createElement('span');
    h.className = 'table-menu-head';
    h.textContent = name;
    g.append(h, ...items);
    menu.appendChild(g);
  };
  group('Rows and columns', [
    button('row-above', 'Insert row above'),
    button('row', 'Insert row below'),
    button('col-left', 'Insert column left'),
    button('col', 'Insert column right'),
    button('del-row', 'Delete row'),
    button('del-col', 'Delete column'),
  ]);
  group('Merge', [button('merge-right', 'Merge with cell to the right'), button('merge-down', 'Merge with cell below'), button('split', 'Split cell')]);
  group('Align column', [button('align', 'Left', 'Align column left', ''), button('align', 'Centre', 'Align column centre', 'center'), button('align', 'Right', 'Align column right', 'right')]);
  const toggle = (action: string, label: string) => {
    const b = button(action, label);
    b.setAttribute('role', 'menuitemcheckbox');
    return b;
  };
  group('Style', [toggle('header', 'Heading row'), toggle('banded', 'Banded rows')]);
  group('Lines', [button('borders', 'All lines', 'All lines', ''), button('borders', 'Outside only', 'Outside only', 'outside'), button('borders', 'Between rows', 'Lines between rows', 'rows'), button('borders', 'No lines', 'No lines', 'none')]);
  const swatches = document.createElement('div');
  swatches.className = 'table-swatches';
  for (const [hex, name] of CELL_SHADES) {
    const b = button('shade', '', `Shade cell: ${name}`, hex);
    b.setAttribute('aria-label', `Shade cell ${name.toLowerCase()}`);
    b.style.background = hex;
    swatches.appendChild(b);
  }
  group('Cell shading', [swatches, button('shade', 'No shading', 'No shading', '')]);
  group('', [button('delete', 'Delete table')]);
  tools.appendChild(menu);
  // The table scrolls sideways on its own; the tools sit below it, so they never cover a cell.
  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';
  const table = document.createElement('table');
  scroll.appendChild(table);
  wrap.append(scroll, tools);
  fillTable(table, block);
  return wrap;
}

const CELL_SHADES = [
  ['#f2f2f2', 'Light grey'], ['#d9d9d9', 'Grey'], ['#fff2cc', 'Light gold'], ['#fce5cd', 'Light orange'], ['#f4cccc', 'Light red'],
  ['#d9d2e9', 'Light purple'], ['#cfe2f3', 'Light blue'], ['#d0e0e3', 'Light teal'], ['#d9ead3', 'Light green'], ['#ffff00', 'Yellow'],
];

/** The table's shape and look, as a string: when it changes, the table is drawn again. */
function tableKey(block: Block): string {
  const rows = block.rows ?? [['']];
  return JSON.stringify([rows.length, rows[0]?.length ?? 0, block.tbl ?? null]);
}

function fillTable(table: HTMLTableElement, block: Block): void {
  const rows = block.rows ?? [['']];
  const t = block.tbl;
  table.textContent = '';
  table.dataset.key = tableKey(block);
  if (t?.borders) table.dataset.borders = t.borders;
  else delete table.dataset.borders;
  table.classList.toggle('banded', !!t?.banded);
  table.classList.toggle('no-header', !!t?.noHeader);
  // Column widths set by dragging; otherwise the browser shares the width out.
  if (t?.widths) {
    table.style.tableLayout = 'fixed';
    const group = document.createElement('colgroup');
    for (const w of t.widths) {
      const col = document.createElement('col');
      col.style.width = `${w}%`;
      group.appendChild(col);
    }
    table.appendChild(group);
  } else table.style.tableLayout = '';
  const wrap = table.closest('.table-wrap');
  const check = (sel: string, on: boolean) => wrap?.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-checked', String(on)));
  check('[data-table-action="header"]', !t?.noHeader);
  check('[data-table-action="banded"]', !!t?.banded);
  wrap?.querySelectorAll<HTMLElement>('[data-table-action="borders"]').forEach((b) => b.classList.toggle('on', b.dataset.value === (t?.borders ?? '')));
  rows.forEach((row, r) => {
    const tr = table.insertRow();
    row.forEach((text, c) => {
      if (isCovered(t, r, c)) return;
      const head = r === 0 && !t?.noHeader;
      const cell = document.createElement(head ? 'th' : 'td');
      const m = mergeAt(t, r, c);
      if (m) {
        cell.rowSpan = m[2];
        cell.colSpan = m[3];
      }
      const shade = t?.shades?.[`${r},${c}`];
      if (shade) cell.style.background = shade;
      const align = t?.aligns?.[c];
      if (align) cell.style.textAlign = align;
      const box = document.createElement('div');
      box.className = 'cell';
      box.contentEditable = 'true';
      box.dataset.r = String(r);
      box.dataset.c = String(c);
      box.setAttribute('role', 'textbox');
      box.setAttribute('aria-label', head ? `Heading ${c + 1}` : `Row ${t?.noHeader ? r + 1 : r}, column ${c + 1}`);
      fillCell(box, text);
      cell.appendChild(box);
      // Along the top row, a handle on each column's right edge to drag it wider or narrower.
      const right = c + (m?.[3] ?? 1) - 1;
      if (r === 0 && right < row.length - 1) {
        const grip = document.createElement('span');
        grip.className = 'col-grip';
        grip.contentEditable = 'false';
        grip.dataset.col = String(right);
        grip.title = 'Drag to change the column’s width (double-click to even them out)';
        cell.appendChild(grip);
      }
      tr.appendChild(cell);
    });
  });
}

/** Updates a table's cells in place. False when its shape changed (it's rebuilt instead). */
function patchTable(el: HTMLElement, block: Block): boolean {
  const table = el.querySelector('table');
  const rows = block.rows ?? [['']];
  if (!table) return false;
  if (table.dataset.key !== tableKey(block)) {
    // Keep the caret's cell, if there still is one.
    const active = el.ownerDocument.activeElement as HTMLElement | null;
    const at = active?.classList.contains('cell') && el.contains(active) ? { r: Number(active.dataset.r), c: Number(active.dataset.c) } : null;
    fillTable(table, block);
    if (at) {
      const m = mergeAt(block.tbl, Math.min(at.r, rows.length - 1), Math.min(at.c, rows[0].length - 1));
      const [r, c] = m ? [m[0], m[1]] : [Math.min(at.r, rows.length - 1), Math.min(at.c, rows[0].length - 1)];
      table.querySelector<HTMLElement>(`.cell[data-r="${r}"][data-c="${c}"]`)?.focus();
    }
    return true;
  }
  for (const box of table.querySelectorAll<HTMLElement>('.cell')) {
    const text = rows[Number(box.dataset.r)][Number(box.dataset.c)];
    if (box !== el.ownerDocument.activeElement && readCell(box) !== text) fillCell(box, text);
  }
  return true;
}

/** The cells' text as the table shows it now. */
export function readTable(el: HTMLElement, block: Block): string[][] {
  const rows = (block.rows ?? [['']]).map((row) => [...row]);
  for (const box of el.querySelectorAll<HTMLElement>('table .cell')) {
    const r = Number(box.dataset.r);
    const c = Number(box.dataset.c);
    if (rows[r]?.[c] !== undefined) rows[r][c] = readCell(box);
  }
  return rows;
}
