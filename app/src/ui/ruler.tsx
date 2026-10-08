// Word's ruler above the pages: inches from the left margin, the margins
// shaded, and the paragraph's indents as markers you can drag (first line,
// hanging and left, right), as in Word.

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { PX_PER_IN, type StyleSheet, styleKeyOf } from '../data/styles';

type Marker = 'first' | 'left' | 'right';

export function Ruler({ editor, width: baseWidth, boxes, margins, scale, sheet }: { editor: Editor; width: number; boxes?: { width: number }[]; margins: { left: number; right: number }; scale: number; sheet?: StyleSheet }) {
  const [, setTick] = useState(0);
  const [drag, setDrag] = useState<{ which: Marker; at: number } | null>(null);
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
  const width = (onPage !== undefined ? boxes?.[onPage]?.width : undefined) ?? baseWidth;
  const inches = width / PX_PER_IN;
  const blk = editor.currentBlock();
  const def = sheet?.styles[styleKeyOf(blk)];
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
    <div ref={bar} className="ruler" style={{ width: width * scale }} aria-label="Ruler" role="group">
      <span className="ruler-margin" style={{ left: 0, width: margins.left * ppi }} />
      <span className="ruler-margin" style={{ right: 0, width: margins.right * ppi }} />
      {ticks}
      {marker('first', 'first', 'First line indent')}
      {marker('left', 'left', 'Left indent')}
      {marker('right', 'right', 'Right indent')}
    </div>
  );
}
