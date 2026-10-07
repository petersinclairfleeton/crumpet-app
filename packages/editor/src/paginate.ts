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
}

const SPACER = 'page-break';

export class Paginator {
  private geometry: PageGeometry | null = null;
  pages = 1;

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
    if (!g || g.content <= 0) return (this.pages = 1);
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
        const pageBottom = pageTop + g.content;
        if (top >= pageTop + pitch) {
          // Pushed further down already: catch up.
          page = Math.floor(top / pitch);
          continue;
        }
        if (bottom <= pageBottom + 0.5) break; // fits
        const lines = lineStarts(el, y);
        let k = lines.findIndex((l) => l.bottom > pageBottom + 0.5);
        if (k < 0) break; // only margins overflow
        // No lone first line at the bottom of a page (orphan)…
        if (k === 1 && lines.length > 1) k = 0;
        // …and no lone last line at the top of the next (widow).
        if (k > 0 && k === lines.length - 1 && k >= 2) k -= 1;
        if (k === 0) {
          // The whole block moves. A heading just above it goes too, to stay with its text.
          const prev = blocks[i - 1];
          if (prev && /^H[1-6]$/.test(prev.tagName) && !prev.querySelector(`.${SPACER}`)) {
            const pTop = y(prev.getBoundingClientRect().top);
            if (pTop >= pageTop && pTop < pageBottom) {
              insertSpacer(prev, 0, (page + 1) * pitch - y(firstLineTop(prev)));
              page += 1;
              i -= 1; // look at this block again, now below its heading
              break;
            }
          }
        }
        const at = lines[k];
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
