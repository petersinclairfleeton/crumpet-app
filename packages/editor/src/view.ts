// The view: draws the model into a contenteditable element and translates
// between DOM positions and model positions. Only blocks whose model object
// changed are rebuilt; the rest of the DOM is left alone.

import type { Block, Doc, Mark, Pos, Selection } from './model';
import { isList, runsLength } from './model';

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
};

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
    const empty = doc.blocks.length === 1 && runsLength(doc.blocks[0].runs) === 0 && doc.blocks[0].type === 'paragraph';
    this.root.toggleAttribute('data-empty', empty);
  }

  blockElement(id: string): HTMLElement | null {
    return this.rendered.get(id)?.el ?? null;
  }

  /** The text the DOM currently shows for a block (may differ from the model during IME composition). */
  blockText(id: string): string | null {
    const el = this.blockElement(id);
    if (!el || !el.isConnected) return null;
    return textEl(el).textContent ?? '';
  }

  /** True if the DOM still has exactly the block elements we rendered, in order. */
  structureIntact(doc: Doc): boolean {
    const kids = Array.from(this.root.children);
    return kids.length === doc.blocks.length && doc.blocks.every((b, i) => kids[i] === this.rendered.get(b.id)?.el);
  }

  domToPos(node: Node, offset: number): Pos | null {
    if (node === this.root) {
      const kids = this.root.children;
      if (!kids.length) return null;
      if (offset >= kids.length) {
        const last = kids[kids.length - 1] as HTMLElement;
        return { block: last.dataset.block!, offset: (textEl(last).textContent ?? '').length };
      }
      return { block: (kids[offset] as HTMLElement).dataset.block!, offset: 0 };
    }
    const el = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-block]');
    if (!el || !this.root.contains(el)) return null;
    const id = el.dataset.block!;
    const text = textEl(el);
    if (!text.contains(node)) {
      // Selection on the block element itself or its checkbox.
      if (node === el && offset > Array.prototype.indexOf.call(el.childNodes, text)) {
        return { block: id, offset: (text.textContent ?? '').length };
      }
      return { block: id, offset: 0 };
    }
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(node, offset);
    return { block: id, offset: range.toString().length };
  }

  posToDom(pos: Pos): { node: Node; offset: number } | null {
    const el = this.blockElement(pos.block);
    if (!el) return null;
    const text = textEl(el);
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    let remaining = pos.offset;
    let last: Text | null = null;
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      // Prefer the end of the earlier node at a boundary, so the caret takes the marks of the text before it.
      if (remaining <= n.data.length) return { node: n, offset: remaining };
      remaining -= n.data.length;
      last = n;
    }
    if (last) return { node: last, offset: last.data.length };
    return { node: text, offset: 0 };
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
  const text = document.createElement('span');
  text.className = 'text';
  if (!block.runs.length) {
    text.appendChild(document.createElement('br'));
  }
  for (const run of block.runs) {
    let node: Node = document.createTextNode(run.text);
    for (const mark of [...run.marks].reverse()) {
      const wrap = document.createElement(MARK_TAGS[mark]);
      wrap.appendChild(node);
      node = wrap;
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
    text.appendChild(node);
  }
  el.appendChild(text);
  return el;
}
