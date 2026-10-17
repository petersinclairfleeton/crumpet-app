// Word's Draw tab, in a drawing window: pen, pencil and highlighter in
// colours and thicknesses, an eraser (whole strokes), a lasso to pick strokes
// and drag them, Ink to Shape (rough lines, boxes, ovals and triangles made
// neat as they're drawn, or the picked ones afterwards) and Ink Replay (the
// strokes drawn again in order). Works with a finger, a mouse or a pen
// (Apple Pencil's pressure thickens the line). The drawing is a ```ink block
// (the editor's ink.ts); the formatting bar's Draw button adds one, and
// clicking one opens it here.

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { INK_COLOURS, type Ink, type InkTool, type Stroke, inkText, insideLasso, parseInk, recognizeShape, strokeNear, strokeSvg } from '@crumpet/editor/ink';
import { type ToolItem, closeMore } from './toolbar';

type Tool = InkTool | 'eraser' | 'lasso';
const TOOL_NAMES: [Tool, string, string][] = [
  ['pen', 'Pen', '✒️'],
  ['pencil', 'Pencil', '✏️'],
  ['highlighter', 'Highlighter', '🖍️'],
  ['eraser', 'Eraser', '🧽'],
  ['lasso', 'Lasso select', '➰'],
];
const WIDTHS = [1.5, 3, 6, 10];

/** The drawing window, for the editor's drawing being drawn on (null: closed). */
export function InkHost({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState<{ id: string; ink: Ink } | null>(null);
  useEffect(() => {
    if (!editor) return;
    editor.onInkEdit = (id, text) => setOpen({ id, ink: parseInk(text) });
    return () => {
      editor.onInkEdit = null;
    };
  }, [editor]);
  if (!open || !editor) return null;
  return (
    <InkWindow
      ink={open.ink}
      onDone={(ink) => {
        if (ink) editor.setCodeText(open.id, inkText(ink));
        setOpen(null);
      }}
    />
  );
}

function InkWindow({ ink: start, onDone }: { ink: Ink; onDone(ink: Ink | null): void }) {
  const [ink, setInk] = useState<Ink>(start);
  const [past, setPast] = useState<Ink[]>([]);
  const [future, setFuture] = useState<Ink[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [colour, setColour] = useState(INK_COLOURS[0]);
  const [width, setWidth] = useState(3);
  const [toShape, setToShape] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [live, setLive] = useState<Stroke | null>(null);
  const [lasso, setLasso] = useState<number[][] | null>(null);
  const [replay, setReplay] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; from: Ink } | null>(null);

  const change = (next: Ink) => {
    setPast((p) => [...p.slice(-50), ink]);
    setFuture([]);
    setInk(next);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [ink, ...f]);
    setInk(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setPicked([]);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, ink]);
    setInk(future[0]);
    setFuture(future.slice(1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone(null);
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && picked.length) {
        change({ ...ink, strokes: ink.strokes.filter((_, i) => !picked.includes(i)) });
        setPicked([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Ink Replay: the strokes appear one by one, in the order they were drawn.
  useEffect(() => {
    if (replay === null) return;
    if (replay >= ink.strokes.length) {
      const t = setTimeout(() => setReplay(null), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setReplay(replay + 1), Math.min(500, 120 + ink.strokes[replay].p.length * 6));
    return () => clearTimeout(t);
  }, [replay, ink.strokes]);

  /** A pointer's place in the drawing's own units. */
  const at = (e: React.PointerEvent): [number, number, number?] => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * ink.w;
    const y = ((e.clientY - r.top) / r.height) * ink.h;
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? Math.round(e.pressure * 100) / 100 : undefined;
    return pressure === undefined ? [Math.round(x * 10) / 10, Math.round(y * 10) / 10] : [Math.round(x * 10) / 10, Math.round(y * 10) / 10, pressure];
  };

  const erase = (x: number, y: number, from = ink) => {
    const keep = from.strokes.filter((s) => !strokeNear(s, x, y, 6));
    return keep.length === from.strokes.length ? null : { ...from, strokes: keep };
  };

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (replay !== null) return;
    e.preventDefault();
    svg.current?.setPointerCapture?.(e.pointerId);
    const p = at(e);
    if (tool === 'eraser') {
      drag.current = { x: p[0], y: p[1], from: ink };
      const next = erase(p[0], p[1]);
      if (next) setInk(next);
    } else if (tool === 'lasso') {
      // On a picked stroke: drag the picked ones; elsewhere, draw a new lasso.
      if (picked.some((i) => strokeNear(ink.strokes[i], p[0], p[1], 8))) drag.current = { x: p[0], y: p[1], from: ink };
      else {
        setPicked([]);
        setLasso([[p[0], p[1]]]);
      }
    } else setLive({ t: tool, c: colour, w: width, p: [p] });
  };

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = at(e);
    if (live) setLive({ ...live, p: [...live.p, p] });
    else if (lasso) setLasso([...lasso, [p[0], p[1]]]);
    else if (drag.current && tool === 'eraser') {
      const next = erase(p[0], p[1]);
      if (next) setInk(next);
    } else if (drag.current && tool === 'lasso') {
      const dx = p[0] - drag.current.x;
      const dy = p[1] - drag.current.y;
      const from = drag.current.from;
      setInk({ ...from, strokes: from.strokes.map((s, i) => (picked.includes(i) ? { ...s, p: s.p.map((q) => [q[0] + dx, q[1] + dy, ...(q[2] !== undefined ? [q[2]] : [])] as Stroke['p'][number]) } : s)) });
    }
  };

  const up = () => {
    if (live) {
      const stroke = toShape ? (recognizeShape(live) ?? live) : live;
      change({ ...ink, strokes: [...ink.strokes, stroke] });
      setLive(null);
    } else if (lasso) {
      if (lasso.length > 2) setPicked(ink.strokes.map((s, i) => (s.p.every((q) => insideLasso(lasso, q[0], q[1])) ? i : -1)).filter((i) => i >= 0));
      setLasso(null);
    } else if (drag.current) {
      // An erase or a move is one step to undo.
      const from = drag.current.from;
      if (from !== ink) {
        setPast((ps) => [...ps.slice(-50), from]);
        setFuture([]);
      }
    }
    drag.current = null;
  };

  const shapePicked = () => {
    const strokes = ink.strokes.map((s, i) => (picked.includes(i) ? (recognizeShape(s) ?? s) : s));
    change({ ...ink, strokes });
  };

  const shown = replay === null ? ink.strokes : ink.strokes.slice(0, replay);
  return (
    <div className="dialog-backdrop ink-backdrop">
      <div className="dialog ink-window" role="dialog" aria-modal="true" aria-label="Drawing">
        <div className="ink-tools" role="toolbar" aria-label="Draw">
          {TOOL_NAMES.map(([t, name, glyph]) => (
            <button key={t} type="button" className={`ink-tool${tool === t ? ' on' : ''}`} aria-pressed={tool === t} aria-label={name} title={name} onClick={() => (setTool(t), t !== 'lasso' && setPicked([]))}>
              {glyph}
            </button>
          ))}
          <span className="ink-sep" />
          {INK_COLOURS.map((c) => (
            <button key={c} type="button" className={`ink-colour${colour === c ? ' on' : ''}`} style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={colour === c} onClick={() => setColour(c)} />
          ))}
          <span className="ink-sep" />
          {WIDTHS.map((w) => (
            <button key={w} type="button" className={`ink-width${width === w ? ' on' : ''}`} aria-label={`Thickness ${w}`} aria-pressed={width === w} onClick={() => setWidth(w)}>
              <span style={{ width: 18, height: Math.max(1, w), background: 'currentColor', borderRadius: w }} />
            </button>
          ))}
          <span className="ink-sep" />
          <label className="ink-check" title="Rough lines, boxes, ovals and triangles become neat shapes as you draw them">
            <input type="checkbox" checked={toShape} onChange={(e) => setToShape(e.target.checked)} /> Ink to shape
          </label>
          {picked.length > 0 && (
            <>
              <button type="button" className="btn small" onClick={shapePicked}>
                Make into shapes
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  change({ ...ink, strokes: ink.strokes.map((s, i) => (picked.includes(i) ? { ...s, c: colour } : s)) });
                }}
              >
                Recolour
              </button>
            </>
          )}
        </div>
        <div className="ink-paper">
          <svg
            ref={svg}
            className="ink-canvas"
            viewBox={`0 0 ${ink.w} ${ink.h}`}
            role="img"
            aria-label="Drawing area"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            dangerouslySetInnerHTML={{
              __html:
                (shown.some((s) => s.t === 'pencil') || live?.t === 'pencil' ? '<defs><filter id="pencil"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.2"/></filter></defs>' : '') +
                shown.map((s, i) => (picked.includes(i) ? `<g class="ink-picked">${strokeSvg(s)}</g>` : strokeSvg(s))).join('') +
                (live ? strokeSvg(live) : '') +
                (lasso ? `<polyline points="${lasso.map((q) => q.join(',')).join(' ')}" fill="rgba(80,120,220,0.08)" stroke="#5078dc" stroke-dasharray="4 3" stroke-width="1"/>` : ''),
            }}
          />
        </div>
        <footer className="ink-foot">
          <button type="button" className="btn quiet small" disabled={!past.length} onClick={undo}>
            Undo
          </button>
          <button type="button" className="btn quiet small" disabled={!future.length} onClick={redo}>
            Redo
          </button>
          <button type="button" className="btn quiet small" disabled={!ink.strokes.length} onClick={() => setReplay(0)}>
            ▶ Replay
          </button>
          <button type="button" className="btn quiet small" disabled={!ink.strokes.length} onClick={() => (change({ ...ink, strokes: [] }), setPicked([]))}>
            Clear
          </button>
          <label className="ink-size">
            Height
            <select aria-label="Drawing height" value={ink.h} onChange={(e) => change({ ...ink, h: Number(e.target.value) })}>
              {[200, 300, 400, 600, 800].map((h) => (
                <option key={h} value={h}>
                  {h === 200 ? 'Short' : h === 300 ? 'Medium' : h === 400 ? 'Tall' : h === 600 ? 'Taller' : 'A page'}
                </option>
              ))}
            </select>
          </label>
          <span className="grow" />
          <button type="button" className="btn small" onClick={() => onDone(null)}>
            Cancel
          </button>
          <button type="button" className="btn primary small" onClick={() => onDone(ink)}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

const ICON_DRAW = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 21c3 0 4-2 6-2s3 2 5 2M15 4l5 5L10 19H5v-5z" />
  </svg>
);

export function inkItems(ed: Editor | null, off: boolean): ToolItem[] {
  const draw = () => {
    closeMore();
    ed?.focus();
    ed?.insertDrawing();
  };
  const inkEdit = () => {
    closeMore();
    if (ed) openInkEditing(ed);
  };
  return [
    {
      key: 'draw',
      pri: 1,
      node: (
        <button type="button" aria-label="Draw" title="Draw: a drawing canvas (pen, pencil, highlighter)" disabled={off} onClick={draw}>
          {ICON_DRAW}
        </button>
      ),
      menu: (
        <button type="button" className="menu-item" disabled={off} onClick={draw}>
          <span className="menu-glyph">{ICON_DRAW}</span> Draw
        </button>
      ),
    },
    {
      key: 'inkedit',
      pri: 0,
      node: (
        <button type="button" aria-label="Edit with ink" title="Edit with ink: strike out, scribble, circle, a line down, or ^ over the text" disabled={off} onClick={inkEdit}>
          {ICON_INK_EDIT}
        </button>
      ),
      menu: (
        <button type="button" className="menu-item" disabled={off} onClick={inkEdit}>
          <span className="menu-glyph">{ICON_INK_EDIT}</span> Edit with ink
        </button>
      ),
    },
  ];
}

const ICON_INK_EDIT = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12h16M7 18l3-4 3 4M17 4l3 3-6 6h-3v-3z" />
  </svg>
);

// Word's ink editor: a clear layer over the page; each stroke is read as an edit when the pen lifts.
let inkEditListener: ((ed: Editor) => void) | null = null;
/** Starts editing `ed`'s text with ink (shown by InkEditHost, which the app keeps). */
export function openInkEditing(ed: Editor): void {
  inkEditListener?.(ed);
}

const GESTURE_DONE: Record<string, string> = { strike: 'Struck out', scribble: 'Scribbled out', circle: 'Selected', split: 'New paragraph', insert: 'Caret placed: type to add' };

export function InkEditHost() {
  const [ed, setEd] = useState<Editor | null>(null);
  useEffect(() => {
    inkEditListener = setEd;
    return () => {
      inkEditListener = null;
    };
  }, []);
  return ed ? <InkEditLayer editor={ed} onDone={() => setEd(null)} /> : null;
}

function InkEditLayer({ editor, onDone }: { editor: Editor; onDone(): void }) {
  const layer = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[] | null>(null);
  const [said, setSaid] = useState('Draw over the text: a line through or a scribble deletes, a circle selects, a line down starts a new paragraph, a ^ puts the caret there.');
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onDone]);
  const finish = (pts: { x: number; y: number }[]) => {
    setPoints(null);
    // Looking through the layer at the text underneath.
    const el = layer.current;
    if (el) el.style.pointerEvents = 'none';
    const did = editor.inkGesture(pts);
    if (el) el.style.pointerEvents = '';
    setSaid(did ? GESTURE_DONE[did] : 'That wasn’t one of the gestures. Try a line through, a scribble, a circle, a line down or a ^.');
    // A ^ is for typing: the layer steps aside.
    if (did === 'insert' || did === 'circle') onDone();
  };
  // Scrolling still moves the page underneath.
  const wheel = (e: React.WheelEvent) => {
    const el = layer.current;
    if (!el) return;
    el.style.pointerEvents = 'none';
    let under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    el.style.pointerEvents = '';
    while (under && !(under.scrollHeight > under.clientHeight && /auto|scroll/.test(getComputedStyle(under).overflowY))) under = under.parentElement;
    under?.scrollBy(0, e.deltaY);
  };
  const d = points && points.length > 1 ? `M${points.map((p) => `${p.x} ${p.y}`).join('L')}` : '';
  return (
    <div
      ref={layer}
      className="ink-edit-layer"
      role="application"
      aria-label="Editing with ink"
      onWheel={wheel}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.ink-edit-bar')) return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setPoints([{ x: e.clientX, y: e.clientY }]);
      }}
      onPointerMove={(e) => points && setPoints([...points, { x: e.clientX, y: e.clientY }])}
      onPointerUp={() => points && finish(points)}
      onPointerCancel={() => setPoints(null)}
    >
      <svg className="ink-edit-stroke" aria-hidden="true">
        {d && <path d={d} />}
      </svg>
      <div className="ink-edit-bar" role="status">
        <span>{said}</span>
        <button type="button" className="btn small" onClick={() => editor.undo()}>
          Undo
        </button>
        <button type="button" className="btn small primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
