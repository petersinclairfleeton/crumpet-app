// The strip along the bottom of page view, as in Word: which page the caret
// is on, the words (and how many are selected), the ruler, a list of the
// headings to jump to, and zoom.

import { type RefObject, useEffect, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { isHeading } from '@crumpet/editor/model';
import { useAppState, useAppStore } from './hooks';
import { Popover } from './Sidebar';

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const count = (text: string) => (text.match(WORD) ?? []).length;
const ZOOMS = [50, 75, 90, 100, 110, 125, 150, 175, 200];

export function StatusBar({ editors, scroller, pageOffset = 0, pageTotal }: { editors: Editor[]; scroller: RefObject<HTMLElement>; pageOffset?: number; pageTotal?: number }) {
  const settings = useAppState().settings;
  const store = useAppStore();
  const [, setTick] = useState(0);
  const [headings, setHeadings] = useState(false);

  useEffect(() => {
    const again = () => setTick((t) => t + 1);
    const offs = editors.map((ed) => ed.onChange(again));
    document.addEventListener('selectionchange', again);
    const box = scroller.current;
    box?.addEventListener('scroll', again, { passive: true });
    return () => {
      offs.forEach((off) => off());
      document.removeEventListener('selectionchange', again);
      box?.removeEventListener('scroll', again);
    };
  }, [editors, scroller]);

  // The page: where the caret is, or else the middle of what's on screen.
  const sheets = Array.from(scroller.current?.querySelectorAll<HTMLElement>('.sheet') ?? []);
  let y: number | null = null;
  const sel = getSelection();
  if (sel?.rangeCount && editors.some((ed) => ed.view.root.contains(sel.focusNode))) {
    const r = sel.getRangeAt(0).getClientRects()[0] ?? (sel.focusNode instanceof Element ? sel.focusNode : sel.focusNode?.parentElement)?.getBoundingClientRect();
    if (r) y = r.top + r.height / 2;
  }
  if (y === null && scroller.current) {
    const b = scroller.current.getBoundingClientRect();
    y = b.top + b.height / 2;
  }
  let page = 1;
  sheets.forEach((s, i) => {
    if (y !== null && s.getBoundingClientRect().top <= y) page = i + 1;
  });
  const total = sheets.length;

  const all = editors.reduce((n, ed) => n + count(ed.state.doc.blocks.map((b) => b.runs.filter((r) => r.change?.kind !== 'del').map((r) => r.text).join('')).join('\n')), 0);
  const selected = sel && !sel.isCollapsed && editors.some((ed) => ed.view.root.contains(sel.anchorNode)) ? count(sel.toString()) : 0;

  const zoom = settings.zoom;
  const setZoom = (z: number | undefined) => store.updateSettings({ zoom: z && Math.round(z) !== 0 ? Math.min(300, Math.max(25, Math.round(z))) : undefined });
  const step = (dir: 1 | -1) => {
    const now = zoom ?? 100;
    const next = dir > 0 ? (ZOOMS.find((z) => z > now) ?? 300) : ([...ZOOMS].reverse().find((z) => z < now) ?? 25);
    setZoom(next);
  };

  const list = editors.flatMap((ed) => ed.state.doc.blocks.filter((b) => isHeading(b.type) && b.runs.length).map((b) => ({ ed, b })));
  const go = (ed: Editor, id: string) => {
    setHeadings(false);
    ed.focusPos({ block: id, offset: 0 });
    const el = ed.view.blockElement(id);
    const box = scroller.current;
    if (el && box) box.scrollTo({ top: box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - 40 });
  };

  return (
    <div className="status-bar" role="group" aria-label="Page details">
      {total > 0 && (
        <span className="status-item" aria-label="Page">
          Page {page + pageOffset} of {Math.max(pageTotal ?? 0, total + pageOffset)}
        </span>
      )}
      <span className="status-item" aria-label="Word count">
        {selected ? `${selected.toLocaleString()} of ${all.toLocaleString()} words` : `${all.toLocaleString()} word${all === 1 ? '' : 's'}`}
      </span>
      <span className="grow" />
      <span className="status-drop">
        <button type="button" className="status-btn" aria-expanded={headings} onClick={() => setHeadings(!headings)}>
          Headings
        </button>
        {headings && (
          <Popover label="Headings" onClose={() => setHeadings(false)}>
            <div className="headings-list">
              {list.length === 0 && <p className="sync-hint">No headings yet. Headings you add (Heading 1 to 4) are listed here to jump to.</p>}
              {list.map(({ ed, b }) => (
                <button key={b.id} type="button" className={`menu-item heading-${b.type.slice(-1)}`} onClick={() => go(ed, b.id)}>
                  {b.runs.map((r) => r.text).join('')}
                </button>
              ))}
            </div>
          </Popover>
        )}
      </span>
      <button type="button" className="status-btn" aria-pressed={!!settings.ruler} onClick={() => store.updateSettings({ ruler: !settings.ruler })}>
        Ruler
      </button>
      <span className="zoom" role="group" aria-label="Zoom">
        <button type="button" className="status-btn" aria-label="Zoom out" onClick={() => step(-1)}>
          −
        </button>
        <input type="range" aria-label="Zoom level" min={25} max={300} step={5} value={zoom ?? 100} onChange={(e) => setZoom(Number(e.target.value))} />
        <button type="button" className="status-btn" aria-label="Zoom in" onClick={() => step(1)}>
          +
        </button>
        <button type="button" className="status-btn zoom-level" aria-pressed={!zoom} title={zoom ? 'Fit the page to the window' : 'Fitting the page to the window'} onClick={() => setZoom(zoom ? undefined : 100)}>
          {zoom ? `${zoom}%` : 'Fit'}
        </button>
      </span>
    </div>
  );
}
