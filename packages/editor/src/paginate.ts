// Page view: splitting the text into pages the way a word processor does.
//
// The text stays one editable flow. Where a page ends, a spacer is placed
// inside the text so that whatever follows starts at the top of the next
// page; a paragraph can break across two pages at any line. Spacers hold no
// text, so the editor's mapping between the page and the document (which
// counts characters) never sees them.
//
// Like Word: a paragraph never leaves a single line alone at the bottom of a
// page or the top of the next (widows and orphans), and a heading stays with
// the text that follows it.

export interface PageGeometry {
  /** Height of the text area of a page, in px. */
  content: number;
  /** Distance from the bottom of one page's text area to the top of the next (margins plus the gap between pages), in px. */
  between: number;
  /** Space above a page's footnotes (for the short line over them), in px. */
  noteGap?: number;
}

const SPACER = 'page-break';

export class Paginator {
  private geometry: PageGeometry | null = null;
  pages = 1;
  /** Footnotes at the foot of each page: their numbers (from 0, in order through the text), page by page. */
  pageNotes: number[][] = [];
  /** How tall footnote `index` is at the foot of a page, in px; without it footnotes take no room. */
  noteHeight: ((index: number) => number) | null = null;

  constructor(private root: HTMLElement) {}

  set(geometry: PageGeometry | null): void {
    this.geometry = geometry;
    this.update();
  }

  /** Removes every spacer (leaving the text exactly as it was). */
  clear(): void {
    const spacers = this.root.querySelectorAll(`.${SPACER}`);
    const parents = new Set<Node>();
    for (const s of spacers) {
      if (s.parentNode) parents.add(s.parentNode);
      s.remove();
    }
    for (const p of parents) p.normalize();
  }

  /** Lays the text out in pages again. Returns the number of pages. */
  update(): number {
    this.clear();
    const g = this.geometry;
    this.pageNotes = [];
    if (!g || g.content <= 0) return (this.pages = 1);
    // Footnote markers, in order, and the room each one's footnote takes.
    const markers = Array.from(this.root.querySelectorAll<HTMLElement>('sup.fn'));
    const noteIndex = new Map(markers.map((m, i) => [m, i]));
    const heights = new Map<number, number>();
    const heightOf = (i: number) => {
      if (!heights.has(i)) heights.set(i, this.noteHeight?.(i) ?? 0);
      return heights.get(i)!;
    };
    const notesOn = (p: number) => (this.pageNotes[p] ??= []);
    /** Room the footnotes already on page `p` (plus any extra ones) take. */
    const reserve = (p: number, extra: number[] = []) => {
      const all = [...notesOn(p), ...extra];
      if (!all.length || !this.noteHeight) return 0;
      return (g.noteGap ?? 0) + all.reduce((h, i) => h + heightOf(i), 0);
    };
    const pitch = g.content + g.between;
    // Measurements come back scaled if the page view is zoomed.
    const rootBox = this.root.getBoundingClientRect();
    const scale = this.root.offsetHeight ? rootBox.height / this.root.offsetHeight || 1 : 1;
    const y = (v: number) => (v - this.root.getBoundingClientRect().top) / scale;
    const blocks = Array.from(this.root.children) as HTMLElement[];
    let page = 0;
    let guard = 0;
    for (let i = 0; i < blocks.length && guard < 10000; i++) {
      const el = blocks[i];
      for (;;) {
        if (++guard > 10000) break;
        const box = el.getBoundingClientRect();
        const top = y(box.top);
        const bottom = y(box.bottom);
        const pageTop = page * pitch;
        if (top >= pageTop + pitch) {
          // Pushed further down already: catch up.
          page = Math.floor(top / pitch);
          continue;
        }
        // A paragraph set to start a new page (Word's page break) does, unless it's at the top of one already.
        if (el.dataset.pageBefore !== undefined && i > 0 && top > pageTop + 2 && !el.querySelector(`.${SPACER}`)) {
          insertSpacer(el, 0, (page + 1) * pitch - y(firstLineTop(el)));
          page += 1;
          continue;
        }
        const fns = this.noteHeight ? Array.from(el.querySelectorAll<HTMLElement>('sup.fn')) : [];
        if (!fns.length && bottom <= pageTop + g.content - reserve(page) + 0.5) break; // fits
        const lines = lineStarts(el, y);
        // Footnotes whose numbers are on each line: the page's text area shrinks to make room for them.
        const lineNotes = lines.map(() => [] as number[]);
        for (const f of fns) {
          const r = f.getBoundingClientRect();
          const fy = y(r.top + r.height / 2);
          let j = lines.length - 1;
          while (j > 0 && lines[j].top > fy) j--;
          lineNotes[j].push(noteIndex.get(f)!);
        }
        // Lines before this page were laid out (and their footnotes placed) already.
        const firstHere = lines.findIndex((l) => l.top >= pageTop - 0.5);
        if (firstHere < 0) break;
        let k = -1;
        const adding: number[] = [];
        for (let j = firstHere; j < lines.length; j++) {
          const limit = pageTop + g.content - reserve(page, [...adding, ...lineNotes[j]]);
          // A footnote too long for any page stays with its first line rather than pushing it on for ever.
          const alone = lines[j].top <= pageTop + 2 && !notesOn(page).length && lines[j].bottom <= pageTop + g.content + 0.5;
          if (lines[j].bottom > limit + 0.5 && !alone) {
            k = j;
            break;
          }
          adding.push(...lineNotes[j]);
        }
        if (k < 0) {
          notesOn(page).push(...adding);
          break; // fits
        }
        // Lines kept together: the whole paragraph moves if it can.
        if (el.dataset.keepLines !== undefined && firstHere === 0 && k > 0) k = 0;
        // No lone first line at the bottom of a page (orphan)…
        if (k === 1 && firstHere === 0 && lines.length > 1) k = 0;
        // …and no lone last line at the top of the next (widow).
        if (k > firstHere && k === lines.length - 1 && k - firstHere >= 2) k -= 1;
        if (k === 0) {
          // The whole block moves. A heading just above it goes too, to stay with its text.
          const prev = blocks[i - 1];
          if (prev && (/^H[1-6]$/.test(prev.tagName) || prev.dataset.keepNext !== undefined) && !prev.querySelector(`.${SPACER}`)) {
            const pTop = y(prev.getBoundingClientRect().top);
            if (pTop >= pageTop && pTop < pageTop + g.content) {
              // Its footnotes go with it.
              const moving = new Set(Array.from(prev.querySelectorAll<HTMLElement>('sup.fn')).map((f) => noteIndex.get(f)!));
              this.pageNotes[page] = notesOn(page).filter((n) => !moving.has(n));
              insertSpacer(prev, 0, (page + 1) * pitch - y(firstLineTop(prev)));
              page += 1;
              i -= 1; // look at this block again, now below its heading
              break;
            }
          }
        }
        const at = lines[k];
        // The footnotes of the lines that stay on this page are this page's.
        for (let j = Math.max(0, firstHere); j < k; j++) notesOn(page).push(...lineNotes[j]);
        insertSpacer(el, at.offset, (page + 1) * pitch - at.top);
        page += 1;
      }
    }
    const last = blocks[blocks.length - 1];
    const end = last ? y(last.getBoundingClientRect().bottom) : 0;
    this.pages = Math.max(1, Math.floor(Math.max(0, end - 1) / pitch) + 1);
    return this.pages;
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

/** Where each line of a block starts: its character offset, and its top and bottom (unscaled px from the page top). */
function lineStarts(block: HTMLElement, y: (v: number) => number): { offset: number; top: number; bottom: number }[] {
  const nodes = textNodes(textEl(block));
  const range = document.createRange();
  const out: { offset: number; top: number; bottom: number }[] = [];
  let offset = 0;
  let lastTop = -Infinity;
  for (const n of nodes) {
    for (let i = 0; i < n.data.length; i++, offset++) {
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      const rects = range.getClientRects();
      const r = rects[rects.length - 1] ?? range.getBoundingClientRect();
      if (!r || (r.width === 0 && r.height === 0)) continue;
      const top = y(r.top);
      if (top > lastTop + 1) {
        out.push({ offset, top, bottom: y(r.bottom) });
        lastTop = top;
      } else {
        const line = out[out.length - 1];
        line.bottom = Math.max(line.bottom, y(r.bottom));
      }
    }
  }
  if (!out.length) {
    // An empty block: one line, as tall as the block's text.
    const box = textEl(block).getBoundingClientRect();
    out.push({ offset: 0, top: y(box.top), bottom: y(box.bottom) });
  }
  return out;
}

/** Top of a block's first line, in client px. */
function firstLineTop(block: HTMLElement): number {
  return lineStarts(block, (v) => v)[0]?.top ?? block.getBoundingClientRect().top;
}

/** Puts a spacer of `height` px before character `offset` of a block's text. */
function insertSpacer(block: HTMLElement, offset: number, height: number): void {
  const spacer = document.createElement('span');
  spacer.className = SPACER;
  spacer.contentEditable = 'false';
  spacer.setAttribute('aria-hidden', 'true');
  spacer.style.height = `${Math.max(0, height)}px`;
  const text = textEl(block);
  let remaining = offset;
  for (const n of textNodes(text)) {
    if (remaining < n.data.length || (remaining === 0 && n.data.length === 0)) {
      const after = remaining > 0 ? n.splitText(remaining) : n;
      after.parentNode!.insertBefore(spacer, after);
      return;
    }
    remaining -= n.data.length;
  }
  text.insertBefore(spacer, text.firstChild);
}
