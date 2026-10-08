// Page view: laying the text out on pages the way a word processor does.
//
// The text is measured once as one long column (at each section's column
// width), then dealt out onto pages: each page is a box of its own size
// (a landscape section's pages are wider than they are tall), holding one or
// more bands of columns (a section with columns, or a continuous section
// break, starts a band). A paragraph that runs past the bottom of a column is
// split there: the rest goes into a continuation box at the top of the next
// column or page. Continuations are the same paragraph (same data-block),
// with `data-from` saying where in its text they start, so the editor's
// mapping between the page and the document still counts characters.
//
// Like Word: a paragraph never leaves a single line alone at the bottom of a
// page or the top of the next (widows and orphans), a heading stays with the
// text that follows it, "keep lines together" and "keep with next" are
// honoured, a page break before a paragraph starts a new page, and the
// columns of a section that ends with a continuous section break are
// balanced.

export interface PageGeometry {
  /** The page's size and margins, in px (the first section's; later ones may turn it). */
  width: number;
  height: number;
  margins: { top: number; right: number; bottom: number; left: number };
  /** Space between pages on screen, px. */
  gap: number;
  /** Space above a page's footnotes (for the short line over them), px. */
  noteGap?: number;
  /** Columns in the first section, and the space between columns (px). */
  cols?: number;
  colGap?: number;
}

/** Where a page is, relative to the top left of the text (unscaled px), and its size. */
export interface PageBox {
  top: number;
  left: number;
  width: number;
  height: number;
  landscape: boolean;
  /** Its margins, px. */
  margins: Margins;
}

type Margins = { top: number; right: number; bottom: number; left: number };

/** A section: blocks from `start` to `end` (indexes), how its pages are, and how many columns. */
interface Section {
  start: number;
  end: number;
  cont: boolean;
  margins: Margins;
  width: number;
  height: number;
  landscape: boolean;
  cols: number;
  colWidth: number;
}

/** What a block looks like laid out in one long column (px from its section's top). */
interface Measured {
  el: HTMLElement;
  top: number;
  bottom: number;
  /** From the top of a line's box to the top of its letters (worked out when it's needed). */
  lead?: number;
  pageBefore: boolean;
  colBefore: boolean;
  keepNext: boolean;
  keepLines: boolean;
  heading: boolean;
  /** Tables, pictures, a table of contents: never split. */
  whole: boolean;
  /** Footnote markers in it, as their numbers (from 0) and where they are. */
  notes: { n: number; y: number }[];
  lines?: Line[];
}

interface Line {
  offset: number;
  top: number;
  bottom: number;
}

/** Part of a block in a column: characters `from` to `to` (null: to its end). */
interface Piece {
  i: number;
  from: number;
  to: number | null;
  notes: number[];
}

interface Band {
  sect: Section;
  top: number;
  height: number;
  cols: Piece[][];
}

interface Page {
  width: number;
  height: number;
  landscape: boolean;
  margins: Margins;
  bands: Band[];
  notes: number[];
}

const CONT = 'data-cont';

export class Paginator {
  private geometry: PageGeometry | null = null;
  pages = 1;
  /** Footnotes at the foot of each page: their numbers (from 0, in order through the text), page by page. */
  pageNotes: number[][] = [];
  /** Each page's place and size. */
  pageBoxes: PageBox[] = [];
  /** The page each block starts on (from 0). */
  pageOf = new Map<string, number>();
  /** How tall footnote `index` is at the foot of a page, in px; without it footnotes take no room. */
  noteHeight: ((index: number) => number) | null = null;

  constructor(private root: HTMLElement) {}

  get active(): boolean {
    return !!this.geometry;
  }

  set(geometry: PageGeometry | null): void {
    this.geometry = geometry;
    this.update();
  }

  /** Puts the text back as one flow of blocks (continuations joined back on, pages taken away). */
  clear(): void {
    const root = this.root;
    root.querySelectorAll('.toc-page').forEach((el) => el.textContent && (el.textContent = ''));
    if (!root.querySelector('.pg, .pg-measure')) return;
    // Continuations hand their text back to the block they continue.
    const last = new Map<string, HTMLElement>();
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-block]'))) {
      const id = el.dataset.block!;
      if (!el.hasAttribute(CONT)) {
        last.set(id, el);
        continue;
      }
      const head = last.get(id);
      if (head) {
        const into = textEl(head);
        const from = textEl(el);
        while (from.firstChild) into.appendChild(from.firstChild);
      }
      el.remove();
    }
    for (const head of last.values()) {
      if (head.hasAttribute('data-split')) {
        head.removeAttribute('data-split');
        textEl(head).normalize();
      }
      root.appendChild(head);
    }
    for (const box of Array.from(root.querySelectorAll(':scope > .pg, :scope > .pg-measure'))) box.remove();
  }

  /** Lays the text out on pages again. Returns the number of pages. */
  update(): number {
    this.clear();
    const g = this.geometry;
    this.pageNotes = [];
    this.pageBoxes = [];
    this.pageOf = new Map();
    const root = this.root;
    root.classList.toggle('paged', !!g);
    if (!g || g.height - g.margins.top - g.margins.bottom <= 0) return (this.pages = 1);
    const blocks = Array.from(root.children).filter((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.block);
    if (!blocks.length) return (this.pages = 1);

    // Sections: where each starts, its page size and columns.
    const m = g.margins;
    const colGap = g.colGap ?? 48;
    const baseLandscape = g.width > g.height;
    const long = Math.max(g.width, g.height);
    const short = Math.min(g.width, g.height);
    const sections: Section[] = [];
    let cols = Math.max(1, g.cols ?? 1);
    let landscape = baseLandscape;
    let margins: Margins = { ...m };
    blocks.forEach((el, i) => {
      const sect = el.dataset.sect;
      if (i > 0 && !sect) return;
      // (On the very first paragraph, a section break just holds the first section's settings.)
      if (el.dataset.cols) cols = Math.max(1, Number(el.dataset.cols) || 1);
      if (el.dataset.orient) landscape = el.dataset.orient === 'landscape';
      // The section's own margins (inches), otherwise the page setup's.
      const inch = (v: string | undefined, base: number) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) * 96 : base);
      margins = { top: inch(el.dataset.mt, margins.top), bottom: inch(el.dataset.mb, margins.bottom), left: inch(el.dataset.ml, margins.left), right: inch(el.dataset.mr, margins.right) };
      const width = landscape ? long : short;
      const height = landscape ? short : long;
      const content = width - margins.left - margins.right;
      const prev = sections[sections.length - 1];
      if (prev) prev.end = i - 1;
      sections.push({ start: i, end: blocks.length - 1, cont: i > 0 && sect === 'cont', margins, width, height, landscape, cols, colWidth: Math.max(40, (content - (cols - 1) * colGap) / cols) });
    });

    // Measure everything in one long column per section, at the column's width.
    const wrappers = sections.map((s) => {
      const w = document.createElement('div');
      w.className = 'pg-measure';
      w.style.width = `${s.colWidth}px`;
      for (let i = s.start; i <= s.end; i++) w.appendChild(blocks[i]);
      root.appendChild(w);
      return w;
    });
    const rootBox = root.getBoundingClientRect();
    const scale = root.offsetWidth ? rootBox.width / root.offsetWidth || 1 : 1;
    const markers = Array.from(root.querySelectorAll<HTMLElement>('sup.fn'));
    const noteIndex = new Map(markers.map((el, n) => [el, n]));
    const info: Measured[] = [];
    sections.forEach((s, si) => {
      const top = wrappers[si].getBoundingClientRect().top;
      const y = (v: number) => (v - top) / scale;
      for (let i = s.start; i <= s.end; i++) {
        const el = blocks[i];
        const box = el.getBoundingClientRect();
        info[i] = {
          el,
          top: y(box.top),
          bottom: y(box.bottom),
          pageBefore: el.dataset.pageBefore !== undefined,
          colBefore: el.dataset.colBefore !== undefined,
          keepNext: el.dataset.keepNext !== undefined,
          keepLines: el.dataset.keepLines !== undefined,
          heading: /^H[1-6]$/.test(el.tagName),
          whole: !!el.querySelector('[data-widget], .media') || el.classList.contains('blk-table') || el.classList.contains('blk-toc'),
          notes: this.noteHeight
            ? Array.from(el.querySelectorAll<HTMLElement>('sup.fn')).map((f) => {
                const r = f.getBoundingClientRect();
                return { n: noteIndex.get(f)!, y: y(r.top + r.height / 2) };
              })
            : [],
        };
      }
    });
    const leadOf = (i: number): number => {
      const b = info[i];
      if (b.lead === undefined) {
        const cs = getComputedStyle(b.el);
        const contentTop = b.top + ((parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.borderTopWidth) || 0));
        const lines = linesOf(i);
        b.lead = Math.max(0, lines[0].top - contentTop);
      }
      return b.lead;
    };
    const linesOf = (i: number): Line[] => {
      const b = info[i];
      if (!b.lines) {
        const si = sections.findIndex((s) => i >= s.start && i <= s.end);
        const top = wrappers[si].getBoundingClientRect().top;
        b.lines = lineStarts(b.el, (v) => (v - top) / scale);
      }
      return b.lines;
    };

    // Footnotes take room at the foot of their page.
    const heights = new Map<number, number>();
    const heightOf = (n: number) => {
      if (!heights.has(n)) heights.set(n, this.noteHeight?.(n) ?? 0);
      return heights.get(n)!;
    };
    const reserve = (notes: number[]) => (notes.length && this.noteHeight ? (g.noteGap ?? 0) + notes.reduce((h, n) => h + heightOf(n), 0) : 0);

    const pages: Page[] = [];
    const newPage = (s: Section): Page => {
      const p: Page = { width: s.width, height: s.height, landscape: s.landscape, margins: s.margins, bands: [], notes: [] };
      pages.push(p);
      return p;
    };
    const contentHeight = (p: Page) => p.height - p.margins.top - p.margins.bottom;

    /**
     * Fills a band of `s`'s columns on page `p`, `top` px down its text area,
     * from block `at.i` (character `at.k`). Columns are `height` px tall
     * (or reach the page's foot). Returns the columns, where the section
     * goes on (null when it's all in), and how far down each column's text reaches.
     */
    const fillBand = (s: Section, p: Page, top: number, at: { i: number; k: number }, height?: number) => {
      const out: Piece[][] = [[]];
      const used: number[] = [0];
      let c = 0;
      let start: number | null = null;
      let { i, k } = at;
      const notesSoFar = () => [...p.notes, ...out.flat().flatMap((x) => x.notes)];
      const colBottom = () => start! + (height ?? contentHeight(p) - top);
      const nextColumn = (): boolean => {
        if (c + 1 >= s.cols) return false;
        c++;
        out.push([]);
        used.push(0);
        start = null;
        return true;
      };
      let pageBreak = false;
      while (i <= s.end) {
        const b = info[i];
        const col = out[c];
        if (start === null) start = k ? lineTop(linesOf(i), k) - leadOf(i) : b.top;
        // A page break before this paragraph (unless it's at the top of a page already).
        if (b.pageBefore && k === 0 && !(top === 0 && c === 0 && !col.length)) {
          pageBreak = true;
          break;
        }
        // A column break: on to the next column (from the last, the next page).
        if (b.colBefore && k === 0 && col.length) {
          if (nextColumn()) continue;
          break;
        }
        const limit = colBottom() - reserve(notesSoFar());
        if (!b.notes.length && b.bottom <= limit + 0.5) {
          col.push({ i, from: k, to: null, notes: [] });
          used[c] = b.bottom - start;
          i++;
          k = 0;
          continue;
        }
        if (b.whole) {
          // Never split: on to the next column, unless this one is empty (then it just doesn't fit).
          if (col.length) {
            if (nextColumn()) continue;
            break;
          }
          col.push({ i, from: 0, to: null, notes: b.notes.map((x) => x.n) });
          used[c] = b.bottom - start;
          i++;
          k = 0;
          continue;
        }
        const lines = linesOf(i);
        const lineNotes = lines.map(() => [] as number[]);
        for (const f of b.notes) {
          let j = lines.length - 1;
          while (j > 0 && lines[j].top > f.y) j--;
          lineNotes[j].push(f.n);
        }
        const firstHere = Math.max(0, lines.findIndex((l) => l.offset >= k));
        let cut = -1;
        const adding: number[] = [];
        for (let j = firstHere; j < lines.length; j++) {
          const lim = colBottom() - reserve([...notesSoFar(), ...adding, ...lineNotes[j]]);
          // A line at the top of an empty column always goes in (a footnote too long for any page stays with it).
          const alone = !col.length && j === firstHere;
          if (lines[j].bottom > lim + 0.5 && !alone) {
            cut = j;
            break;
          }
          adding.push(...lineNotes[j]);
        }
        if (cut < 0) {
          col.push({ i, from: k, to: null, notes: adding });
          used[c] = b.bottom - start;
          i++;
          k = 0;
          continue;
        }
        if (col.length) {
          // Lines kept together: the whole paragraph moves if it can.
          if (b.keepLines && firstHere === 0 && cut > 0) cut = 0;
          // No lone first line at the foot of a column (orphan)…
          if (cut === 1 && firstHere === 0 && lines.length > 1) cut = 0;
        }
        // …and no lone last line at the top of the next (widow).
        if (cut > firstHere && cut === lines.length - 1 && cut - firstHere >= 2) cut -= 1;
        if (cut === firstHere) {
          // Nothing of it fits here. A heading (or "keep with next" paragraph) just above it goes along, to stay with it.
          const prev = col[col.length - 1];
          if (prev && col.length > 1 && prev.from === 0 && prev.to === null && prev.i === i - 1 && (info[prev.i].heading || info[prev.i].keepNext)) {
            col.pop();
            i = prev.i;
            k = 0;
          }
          if (nextColumn()) continue;
          break;
        }
        col.push({ i, from: k, to: lines[cut].offset, notes: lineNotes.slice(firstHere, cut).flat() });
        used[c] = lines[cut - 1].bottom - start;
        k = lines[cut].offset;
        if (nextColumn()) continue;
        break;
      }
      return { cols: out, used, next: i > s.end ? null : { i, k }, pageBreak };
    };

    let page: Page | null = null;
    let y = 0;
    sections.forEach((s, si) => {
      const next = sections[si + 1];
      // A new page, unless this section carries on down the page (and the page is the same shape).
      if (!page || !s.cont || page.landscape !== s.landscape || page.width !== s.width || page.margins.left !== s.margins.left || page.margins.right !== s.margins.right) {
        page = newPage(s);
        y = 0;
      }
      let at: { i: number; k: number } | null = { i: s.start, k: 0 };
      while (at) {
        const p: Page = page!;
        let res = fillBand(s, p, y, at);
        let height = contentHeight(p) - y;
        if (!res.next && next?.cont) {
          // The section ends here and the next carries on down the page: its columns are balanced, and the band is only as tall as it needs.
          if (s.cols > 1) {
            let lo = 1;
            let hi = height;
            let best = res;
            for (let n = 0; n < 14 && hi - lo > 1; n++) {
              const h = (lo + hi) / 2;
              const trial = fillBand(s, p, y, at, h);
              if (!trial.next && !trial.pageBreak) {
                hi = h;
                best = trial;
              } else lo = h;
            }
            res = best;
          }
          height = Math.max(...res.used, 0);
        }
        p.bands.push({ sect: s, top: y, height, cols: res.cols });
        p.notes.push(...res.cols.flat().flatMap((x) => x.notes));
        if (res.next || res.pageBreak) {
          at = res.next;
          page = newPage(s);
          y = 0;
          if (!at) break;
        } else {
          y += height;
          at = null;
        }
      }
    });

    this.build(pages, blocks, colGap, g);
    this.pages = pages.length;
    return this.pages;
  }

  /** Puts the blocks (split where they run on) into page, band and column boxes. */
  private build(pages: Page[], blocks: HTMLElement[], colGap: number, g: PageGeometry): void {
    const root = this.root;
    const widest = Math.max(...pages.map((p) => p.width));
    // The part of each block not yet placed: its element, and where in the text that element starts.
    const rest = new Map<number, { el: HTMLElement; from: number }>();
    blocks.forEach((el, i) => rest.set(i, { el, from: 0 }));
    let top = 0;
    pages.forEach((p, n) => {
      const box = document.createElement('div');
      box.className = 'pg';
      box.dataset.page = String(n);
      if (p.landscape) box.dataset.orient = 'landscape';
      box.style.width = `${p.width}px`;
      box.style.height = `${p.height}px`;
      const pm = p.margins;
      box.style.padding = `${pm.top}px ${pm.right}px ${pm.bottom}px ${pm.left}px`;
      box.style.marginBottom = `${g.gap}px`;
      for (const band of p.bands) {
        const row = document.createElement('div');
        row.className = 'pg-band';
        row.style.height = `${band.height}px`;
        row.style.columnGap = `${colGap}px`;
        for (const col of band.cols) {
          const colEl = document.createElement('div');
          colEl.className = 'pg-col';
          colEl.style.width = `${band.sect.colWidth}px`;
          for (const piece of col) {
            const r = rest.get(piece.i)!;
            const el = r.el;
            if (piece.to !== null) {
              // The rest of the paragraph goes on in a continuation box.
              const cont = splitBlock(el, piece.to - r.from, piece.to);
              rest.set(piece.i, { el: cont, from: piece.to });
            }
            if (piece.from === 0) this.pageOf.set(blocks[piece.i].dataset.block!, n);
            colEl.appendChild(el);
          }
          row.appendChild(colEl);
        }
        box.appendChild(row);
      }
      root.appendChild(box);
      this.pageNotes[n] = p.notes;
      this.pageBoxes.push({ top, left: (widest - p.width) / 2, width: p.width, height: p.height, landscape: p.landscape, margins: p.margins });
      top += p.height + g.gap;
    });
    // Anything not placed (it shouldn't happen) goes on the last page rather than vanish.
    const lastCol = root.querySelector<HTMLElement>('.pg:last-child .pg-col:last-child');
    for (const w of Array.from(root.querySelectorAll<HTMLElement>(':scope > .pg-measure'))) {
      while (w.firstChild) (lastCol ?? root).appendChild(w.firstChild);
      w.remove();
    }
    // A table of contents shows the page each heading is on.
    for (const entry of root.querySelectorAll<HTMLElement>('[data-toc-target]')) {
      const n = this.pageOf.get(entry.dataset.tocTarget!);
      const span = entry.querySelector('.toc-page');
      if (span && n !== undefined) span.textContent = String(n + 1);
    }
  }
}

/** The text part of a block (list items and checkboxes have more around it). */
function textEl(block: HTMLElement): HTMLElement {
  return block.querySelector<HTMLElement>(':scope > .text') ?? block;
}

function textNodes(el: HTMLElement): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

/** Top of the line starting at character `offset`. */
function lineTop(lines: Line[], offset: number): number {
  return (lines.find((l) => l.offset >= offset) ?? lines[lines.length - 1]).top;
}

/** Where each line of a block starts: its character offset, and its top and bottom (unscaled px). */
function lineStarts(block: HTMLElement, y: (v: number) => number): Line[] {
  const text = textEl(block);
  const nodes = textNodes(text);
  const starts: number[] = [];
  let total = 0;
  for (const n of nodes) {
    starts.push(total);
    total += n.data.length;
  }
  const range = document.createRange();
  /** The box of character `i` (null for one with no box, like a collapsed space). */
  const charRect = (i: number): DOMRect | null => {
    let j = nodes.length - 1;
    while (j > 0 && starts[j] > i) j--;
    const n = nodes[j];
    const at = i - starts[j];
    if (!n || at >= n.data.length) return null;
    range.setStart(n, at);
    range.setEnd(n, at + 1);
    const rects = range.getClientRects();
    const r = rects[rects.length - 1] ?? null;
    return r && (r.width || r.height) ? r : null;
  };
  /** The top of the first character from `i` on that has a box, and which one it is. */
  const topFrom = (i: number): { i: number; top: number } | null => {
    for (let k = i; k < total; k++) {
      const r = charRect(k);
      if (r) return { i: k, top: r.top };
    }
    return null;
  };
  const out: Line[] = [];
  // The lines, as the browser draws them: one box per line (or several, for marks and fonts), top to bottom.
  range.selectNodeContents(text);
  const boxes = Array.from(range.getClientRects()).filter((r) => r.width || r.height);
  const tops: { top: number; bottom: number }[] = [];
  for (const r of boxes.sort((a, b) => a.top - b.top)) {
    const lastLine = tops[tops.length - 1];
    if (lastLine && r.top < lastLine.bottom - 1 && r.top - lastLine.top < (lastLine.bottom - lastLine.top) / 2) lastLine.bottom = Math.max(lastLine.bottom, r.bottom);
    else tops.push({ top: r.top, bottom: r.bottom });
  }
  // Each line's first character: halving the search between the line before's and the end.
  let from = 0;
  for (const line of tops) {
    const first = topFrom(from);
    if (!first) break;
    let lo = first.i;
    // Already on this line or further down: find the first character at or below this line's top.
    if (first.top >= line.top - 1) {
      out.push({ offset: lo, top: y(first.top), bottom: y(line.bottom) });
      from = lo + 1;
      continue;
    }
    let hi = total;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      const r = topFrom(mid);
      if (!r || r.top >= line.top - 1) hi = mid;
      else lo = mid;
    }
    const at = topFrom(hi);
    if (!at) break;
    out.push({ offset: at.i, top: y(at.top), bottom: y(line.bottom) });
    from = at.i + 1;
  }
  // Lines too close together to tell apart by their boxes are one line.
  const lines = out.filter((l, i) => i === 0 || l.offset > out[i - 1].offset);
  if (!lines.length) {
    // An empty block: one line, as tall as the block's text.
    const box = text.getBoundingClientRect();
    lines.push({ offset: 0, top: y(box.top), bottom: y(box.bottom) });
  } else lines[0].offset = 0;
  // The last line reaches the foot of the block (its padding and border go with it).
  lines[lines.length - 1].bottom = Math.max(lines[lines.length - 1].bottom, y(block.getBoundingClientRect().bottom) - 0.01);
  return lines;
}

/**
 * Splits a block's element before character `at` of its own text: what
 * follows goes into a new continuation element (same block, marked as
 * continuing from `from` in the block's text), placed right after it.
 */
function splitBlock(el: HTMLElement, at: number, from: number): HTMLElement {
  const text = textEl(el);
  const range = document.createRange();
  let remaining = at;
  let placed = false;
  for (const n of textNodes(text)) {
    if (remaining <= n.data.length) {
      range.setStart(n, remaining);
      placed = true;
      break;
    }
    remaining -= n.data.length;
  }
  if (!placed) range.setStart(text, text.childNodes.length);
  range.setEnd(text, text.childNodes.length);
  const tail = range.extractContents();
  const cont = document.createElement(el.tagName);
  cont.className = el.className;
  for (const a of ['block', 'style', 'align', 'indent']) if (el.dataset[a] !== undefined) cont.dataset[a] = el.dataset[a];
  cont.setAttribute(CONT, '');
  cont.dataset.from = String(from);
  cont.setAttribute('style', el.getAttribute('style') ?? '');
  const span = document.createElement('span');
  span.className = 'text';
  span.appendChild(tail);
  cont.appendChild(span);
  el.setAttribute('data-split', '');
  el.after(cont);
  return cont;
}
