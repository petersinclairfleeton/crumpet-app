// Word's ruler above the pages: inches from the left margin, the margins
// shaded, the paragraph's indents as markers you can drag (first line,
// hanging and left, right), and its tab stops: click the ruler to set one
// (of the kind the corner button shows), drag one to move it, or off the
// ruler to clear it, as in Word.

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { type TabStop, tidyTabs } from '@crumpet/editor/model';
import { TAB_ALIGN_NAMES } from './tabstops';
import { PX_PER_IN, type StyleSheet, blockStyleKey, styleDefFor } from '../data/styles';

type Marker = 'first' | 'left' | 'right';
const KINDS: TabStop['align'][] = ['left', 'center', 'right', 'decimal'];

/** Word's tab stop marks: └ left, ┴ centre, ┘ right, ┴ with a dot for decimal. */
function TabGlyph({ align }: { align: TabStop['align'] }) {
  // The upright is at the middle (x = 5), where the stop is.
  const d = align === 'left' ? 'M5 1v7h4.5' : align === 'right' ? 'M5 1v7H0.5' : 'M5 1v7M1 8h8';
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={d} />
      {align === 'decimal' && <circle cx="8.2" cy="4" r="1.1" fill="currentColor" stroke="none" />}
    </svg>
  );
}

export function Ruler({ editor, width: baseWidth, boxes, margins: baseMargins, scale, sheet }: { editor: Editor; width: number; boxes?: { width: number; margins?: { left: number; right: number } }[]; margins: { left: number; right: number }; scale: number; sheet?: StyleSheet }) {
  const [, setTick] = useState(0);
  const [drag, setDrag] = useState<{ which: Marker; at: number } | null>(null);
  const [kind, setKind] = useState<TabStop['align']>('left');
  const [tabDrag, setTabDrag] = useState<{ from: number; at: number; off: boolean } | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  // Follow the caret from paragraph to paragraph.
  useEffect(() => {
    const again = () => setTick((t) => t + 1);
    const off = editor.onChange(again);
    document.addEventListener('selectionchange', again);
    return () => {
      off();
      document.removeEventListener('selectionchange', again);
    };
  }, [editor]);

  const ppi = PX_PER_IN * scale;
  // The page the caret is on (a landscape page is wider).
  const onPage = editor.pageOfBlock(editor.currentBlock().id);
  const box = onPage !== undefined ? boxes?.[onPage] : undefined;
  const width = box?.width ?? baseWidth;
  // That page's margins (a section can have its own), in inches.
  const margins = box?.margins ? { left: box.margins.left / PX_PER_IN, right: box.margins.right / PX_PER_IN } : baseMargins;
  const inches = width / PX_PER_IN;
  const blk = editor.currentBlock();
  const def = sheet ? styleDefFor(sheet, blockStyleKey(sheet, blk)) : undefined;
  const left = blk.para?.left ?? def?.leftIndent ?? 0;
  const first = blk.para?.first ?? def?.firstIndent ?? 0;
  const right = blk.para?.right ?? 0;
  // Positions in inches from the left margin.
  const pos: Record<Marker, number> = { first: left + first, left, right: inches - margins.left - margins.right - right };
  const at = (m: Marker) => (drag?.which === m ? drag.at : pos[m]);

  const fromX = (clientX: number) => {
    const box = bar.current!.getBoundingClientRect();
    const x = (clientX - box.left) / ppi - margins.left;
    return Math.round(x * 16) / 16;
  };
  const start = (which: Marker) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ which, at: pos[which] });
  };
  const move = (e: React.PointerEvent) => drag && setDrag({ ...drag, at: fromX(e.clientX) });
  const end = () => {
    if (!drag) return;
    const x = drag.at;
    setDrag(null);
    const round = (n: number) => Math.round(n * 1000) / 1000;
    if (drag.which === 'first') editor.setPara({ first: round(x - left) || undefined });
    else if (drag.which === 'left') editor.setPara({ left: round(Math.max(-margins.left, x)) || undefined, first: round(first) || undefined });
    else editor.setPara({ right: round(Math.max(0, inches - margins.left - margins.right - x)) || undefined });
  };

  // Tab stops.
  const stops = blk.para?.tabs ?? [];
  const setStops = (next: TabStop[]) => editor.setPara({ tabs: tidyTabs(next) });
  const addTab = (e: React.PointerEvent) => {
    // A click on the ruler itself (not a marker), between the margins: a tab stop there.
    if (e.target !== bar.current && !(e.target as Element).classList.contains('tick')) return;
    const x = fromX(e.clientX);
    if (x <= 0 || x >= inches - margins.left - margins.right) return;
    e.preventDefault();
    setStops([...stops.filter((t) => Math.abs(t.at - x) >= 0.01), { at: x, align: kind }]);
  };
  const tabStart = (t: TabStop) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setTabDrag({ from: t.at, at: t.at, off: false });
  };
  const tabMove = (e: React.PointerEvent) => {
    if (!tabDrag) return;
    const box = bar.current!.getBoundingClientRect();
    setTabDrag({ ...tabDrag, at: fromX(e.clientX), off: e.clientY > box.bottom + 16 || e.clientY < box.top - 16 });
  };
  const tabEnd = () => {
    if (!tabDrag) return;
    const d = tabDrag;
    setTabDrag(null);
    const moved = stops.find((t) => t.at === d.from);
    if (!moved) return;
    const rest = stops.filter((t) => t !== moved);
    // Dragged off the ruler: cleared.
    if (d.off || d.at <= 0) setStops(rest);
    else if (d.at !== d.from) setStops([...rest.filter((t) => Math.abs(t.at - d.at) >= 0.01), { ...moved, at: d.at }]);
  };

  const ticks = [];
  for (let i = 0; i <= inches * 8; i++) {
    const x = i / 8;
    const rel = x - margins.left;
    const whole = Math.abs(rel - Math.round(rel)) < 0.001;
    ticks.push(
      <i key={i} className={`tick${whole ? ' inch' : Math.abs((rel * 2) % 1) < 0.001 ? ' half' : ''}`} style={{ left: x * ppi }}>
        {whole && Math.round(rel) !== 0 ? <b>{Math.abs(Math.round(rel))}</b> : null}
      </i>,
    );
  }
  const marker = (m: Marker, cls: string, label: string) => (
    <button type="button" className={`ruler-mark ${cls}`} style={{ left: (margins.left + at(m)) * ppi }} aria-label={label} title={label} onPointerDown={start(m)} onPointerMove={move} onPointerUp={end} onMouseDown={(e) => e.preventDefault()} />
  );
  return (
    <div ref={bar} className="ruler" style={{ width: width * scale }} aria-label="Ruler" role="group" onPointerDown={addTab}>
      <button
        type="button"
        className="ruler-kind"
        aria-label={`Tab stop kind: ${TAB_ALIGN_NAMES[kind]}`}
        title={`Click the ruler to set a ${TAB_ALIGN_NAMES[kind].toLowerCase()} tab stop; click here for another kind`}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setKind(KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length])}
      >
        <TabGlyph align={kind} />
      </button>
      <span className="ruler-margin" style={{ left: 0, width: margins.left * ppi }} />
      <span className="ruler-margin" style={{ right: 0, width: margins.right * ppi }} />
      {ticks}
      {marker('first', 'first', 'First line indent')}
      {marker('left', 'left', 'Left indent')}
      {marker('right', 'right', 'Right indent')}
      {stops.map((t) => {
        const dragging = tabDrag?.from === t.at;
        const x = dragging ? tabDrag!.at : t.at;
        return (
          <button
            key={t.at}
            type="button"
            className={`ruler-tab${dragging && tabDrag!.off ? ' off' : ''}`}
            style={{ left: (margins.left + x) * ppi }}
            aria-label={`${TAB_ALIGN_NAMES[t.align]} tab stop at ${t.at} inches`}
            title={`${TAB_ALIGN_NAMES[t.align]} tab stop: drag to move, or off the ruler to clear`}
            onPointerDown={tabStart(t)}
            onPointerMove={tabMove}
            onPointerUp={tabEnd}
            onMouseDown={(e) => e.preventDefault()}
          >
            <TabGlyph align={t.align} />
          </button>
        );
      })}
    </div>
  );
}
