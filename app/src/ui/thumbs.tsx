// Page thumbnails (Word's Navigation pane, Pages): a small copy of each page
// of the editor's page view, in the right sidebar; click one to go there.

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';

const WIDTH = 116;
/** More pages than this aren't drawn (it would be slow); the list says so. */
const MOST = 80;

export function PagesTab({ editor }: { editor: Editor }) {
  const list = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [current, setCurrent] = useState(-1);
  useEffect(() => {
    let timer = 0;
    const draw = () => {
      const box = list.current;
      if (!box) return;
      const pages = Array.from(editor.view.root.querySelectorAll<HTMLElement>(':scope > .pg'));
      setCount(pages.length);
      box.textContent = '';
      pages.slice(0, MOST).forEach((pg, i) => {
        const w = pg.offsetWidth || 816;
        const h = pg.offsetHeight || 1056;
        const scale = WIDTH / w;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'thumb';
        item.setAttribute('aria-label', `Page ${i + 1}`);
        item.style.height = `${h * scale}px`;
        const copy = pg.cloneNode(true) as HTMLElement;
        copy.removeAttribute('contenteditable');
        copy.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
        copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        copy.style.position = 'absolute';
        copy.style.left = '0';
        copy.style.top = '0';
        copy.style.margin = '0';
        copy.style.transform = `scale(${scale})`;
        copy.style.transformOrigin = '0 0';
        copy.setAttribute('aria-hidden', 'true');
        const paper = document.createElement('span');
        paper.className = `thumb-page ${editor.view.root.className.replace(/\b(paged|show-grid|note-editor|outline-view)\b/g, '')}`;
        paper.appendChild(copy);
        const num = document.createElement('span');
        num.className = 'thumb-num';
        num.textContent = String(i + 1);
        item.append(paper, num);
        item.addEventListener('click', () => pg.scrollIntoView({ block: 'start', behavior: 'smooth' }));
        box.appendChild(item);
      });
    };
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, 400);
    };
    draw();
    const off = editor.onChange(soon);
    // The page the caret is on.
    const where = () => setCurrent(editor.pageOfBlock(editor.currentBlock().id) ?? -1);
    document.addEventListener('selectionchange', where);
    where();
    return () => {
      off();
      window.clearTimeout(timer);
      document.removeEventListener('selectionchange', where);
    };
  }, [editor]);
  useEffect(() => {
    list.current?.querySelectorAll('.thumb').forEach((t, i) => t.classList.toggle('here', i === current));
  }, [current, count]);
  return (
    <div className="pages-tab">
      {count === 0 && <p className="right-empty">Turn on page view to see the pages here.</p>}
      <div ref={list} className="thumbs" />
      {count > MOST && <p className="right-empty">The first {MOST} of {count} pages.</p>}
    </div>
  );
}
