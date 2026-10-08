// A toolbar that stays on one row: when there isn't room for everything, the
// least-used controls move into a "More" menu at the end (as in Word when its
// window is narrow). Each control has a priority; lower priorities go first.

import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Popover } from './Sidebar';

export interface ToolItem {
  key: string;
  /** Higher stays longer: 4 (bold, italic…) the last to go, 1 the first. */
  pri: number;
  /** As it appears in the bar. */
  node: ReactNode;
  /** As it appears in the More menu (the bar's version, with its name, when not given). */
  menu?: ReactNode;
  /** A thin line between groups (goes with the item after it). */
  sep?: boolean;
}

export function OverflowRow({ items, fit = true }: { items: ToolItem[]; fit?: boolean }) {
  const row = useRef<HTMLDivElement>(null);
  const widths = useRef(new Map<string, number>());
  const [hidden, setHidden] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const keys = items.map((i) => i.key).join();

  useLayoutEffect(() => {
    const el = row.current;
    if (!el || !fit) return;
    const measure = () => {
      // Remember the width of everything on show (hidden ones keep their last width).
      for (const child of Array.from(el.children) as HTMLElement[]) {
        const k = child.dataset.tool;
        if (k && child.offsetWidth) widths.current.set(k, child.offsetWidth + (child.dataset.sep ? 9 : 0));
      }
      const room = el.clientWidth - 40; // the More button
      const total = (list: ToolItem[]) => list.reduce((n, i) => n + (widths.current.get(i.key) ?? 32) + 2, 0);
      if (total(items) <= el.clientWidth) {
        setHidden((h) => (h.length ? [] : h));
        return;
      }
      const keep = [...items];
      const order = [...items].sort((a, b) => a.pri - b.pri || items.indexOf(b) - items.indexOf(a));
      const gone: string[] = [];
      for (const i of order) {
        if (total(keep) <= room) break;
        keep.splice(keep.indexOf(i), 1);
        gone.push(i.key);
      }
      setHidden((h) => (h.join() === gone.join() ? h : gone));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [keys, fit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Floating over the text, the bar keeps to the most-used controls.
  const shown = fit ? items.filter((i) => !hidden.includes(i.key)) : items.filter((i) => i.pri >= 2);
  const extra = fit ? items.filter((i) => hidden.includes(i.key)) : [];
  return (
    <div ref={row} className={`tools${fit ? ' fit' : ''}`} onMouseDown={(e) => !(e.target as Element).closest('input, select, textarea') && e.preventDefault()}>
      {shown.map((i, n) => (
        <span key={i.key} className="tool" data-tool={i.key} data-sep={i.sep && n > 0 ? '1' : undefined}>
          {i.sep && n > 0 && <span className="sep" />}
          {i.node}
        </span>
      ))}
      {extra.length > 0 && (
        <span className="tool more-tools">
          <button type="button" aria-label="More formatting" aria-expanded={open} data-tip="More" onClick={() => setOpen(!open)}>
            More ▾
          </button>
          {open && (
            <Popover label="More formatting" onClose={() => setOpen(false)}>
              <div className="more-menu" onClick={(e) => (e.target as Element).closest('button.menu-item') && setOpen(false)}>
                {extra.map((i) => (
                  <div key={i.key} className="more-row">
                    {i.menu ?? i.node}
                  </div>
                ))}
              </div>
            </Popover>
          )}
        </span>
      )}
    </div>
  );
}
