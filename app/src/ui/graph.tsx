// The graph view, like Obsidian's: every note a dot (coloured by notebook,
// bigger with more links), every link a line. Drag the background to move
// round, scroll to zoom, drag a dot to pull it about; resting on a dot lights
// up its links, and clicking it opens the note in a new tab.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from './hooks';
import { type Graph, buildGraph, step } from '../data/graph';
import { usePanes } from './panes';

const css = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

export function GraphView() {
  const state = useAppState();
  const panes = usePanes();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [orphans, setOrphans] = useState(true);
  const [local, setLocal] = useState(0);
  const [filter, setFilter] = useState('');
  const centre = local ? state.selectedId : null;
  const graph = useMemo<Graph>(() => buildGraph(state.notes, { orphans, around: centre, depth: local }), [state.notes, orphans, centre, local]);
  const colors = useMemo(() => new Map(state.notebooks.map((n) => [n.id, n.color])), [state.notebooks]);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const hover = useRef<number | null>(null);
  const drag = useRef<{ node: number | null; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const heat = useRef(1);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const g = el.getContext('2d')!;
    let frame = 0;
    let fitted = false;
    heat.current = 1;
    const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
    const lit = (t: string) => !words.length || words.every((w) => t.toLowerCase().includes(w));
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      // Settle, then rest (the layout wakes when something is dragged).
      if (heat.current > 0.02) {
        for (let i = 0; i < 2; i++) step(graph, heat.current);
        heat.current *= 0.985;
        // Once it has mostly settled, zoom so the whole graph fits.
        if (!fitted && heat.current < 0.35 && graph.nodes.length) {
          fitted = true;
          const xs = graph.nodes.map((p) => p.x);
          const ys = graph.nodes.map((p) => p.y);
          const bw = Math.max(...xs) - Math.min(...xs) + 120;
          const bh = Math.max(...ys) - Math.min(...ys) + 160;
          const k = Math.min(2.2, Math.max(0.3, Math.min(w / bw, h / bh)));
          view.current = { k, x: -((Math.max(...xs) + Math.min(...xs)) / 2) * k, y: -((Math.max(...ys) + Math.min(...ys)) / 2) * k + 20 };
        }
      }
      const v = view.current;
      const text = css(el, '--text', '#333');
      const muted = css(el, '--muted', '#999');
      const accent = css(el, '--accent', '#d4a257');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.translate(w / 2 + v.x, h / 2 + v.y);
      g.scale(v.k, v.k);
      const hov = hover.current;
      const near = new Set<number>();
      if (hov !== null) for (const e of graph.edges) if (e.a === hov || e.b === hov) near.add(e.a === hov ? e.b : e.a);
      g.lineWidth = 1 / v.k;
      for (const e of graph.edges) {
        const a = graph.nodes[e.a];
        const b = graph.nodes[e.b];
        const on = hov !== null && (e.a === hov || e.b === hov);
        g.strokeStyle = on ? accent : muted;
        g.globalAlpha = hov !== null && !on ? 0.12 : on ? 0.9 : 0.35;
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
      for (const [i, p] of graph.nodes.entries()) {
        const r = 4 + Math.min(10, Math.sqrt(p.degree) * 2.2);
        const dim = (hov !== null && i !== hov && !near.has(i)) || !lit(p.title);
        g.globalAlpha = dim ? 0.18 : 1;
        g.fillStyle = i === hov ? accent : (p.group && colors.get(p.group)) || muted;
        g.beginPath();
        g.arc(p.x, p.y, r, 0, Math.PI * 2);
        g.fill();
        if (p.id === state.selectedId) {
          g.strokeStyle = accent;
          g.lineWidth = 2 / v.k;
          g.stroke();
          g.lineWidth = 1 / v.k;
        }
        // Names when zoomed in, for well-linked notes, and for the one the mouse is on and its neighbours.
        if (!dim && (v.k > 1.1 || p.degree >= 3 || i === hov || near.has(i) || (words.length && lit(p.title)))) {
          g.fillStyle = text;
          g.font = `${12 / Math.max(v.k, 0.6)}px system-ui, sans-serif`;
          g.textAlign = 'center';
          g.fillText(p.title.length > 40 ? `${p.title.slice(0, 39)}…` : p.title, p.x, p.y + r + 13 / Math.max(v.k, 0.6));
        }
      }
      g.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [graph, colors, filter, state.selectedId]);

  /** The dot under a point of the canvas, if any. */
  const hit = (cx: number, cy: number): number | null => {
    const el = canvas.current!;
    const v = view.current;
    const x = (cx - el.clientWidth / 2 - v.x) / v.k;
    const y = (cy - el.clientHeight / 2 - v.y) / v.k;
    let best: number | null = null;
    let bestD = Infinity;
    for (const [i, p] of graph.nodes.entries()) {
      const d = Math.hypot(p.x - x, p.y - y);
      const r = 4 + Math.min(10, Math.sqrt(p.degree) * 2.2) + 4 / v.k;
      if (d < r && d < bestD) {
        best = i;
        bestD = d;
      }
    }
    return best;
  };
  const point = (e: React.PointerEvent | React.WheelEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <section className="graph-view" aria-label="Graph">
      <div className="graph-tools">
        <input type="search" placeholder="Find in the graph" aria-label="Find in the graph" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <label>
          <select aria-label="Which notes" value={local} onChange={(e) => setLocal(Number(e.target.value))}>
            <option value={0}>All notes</option>
            <option value={1}>Linked to the open note</option>
            <option value={2}>Two links from the open note</option>
          </select>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={orphans} onChange={(e) => setOrphans(e.target.checked)} /> Notes without links
        </label>
        <span className="graph-count">
          {graph.nodes.length} note{graph.nodes.length === 1 ? '' : 's'} · {graph.edges.length} link{graph.edges.length === 1 ? '' : 's'}
        </span>
      </div>
      <canvas
        ref={canvas}
        className="graph-canvas"
        aria-label={title ? `Graph of notes: ${title}` : 'Graph of notes and the links between them'}
        role="img"
        onPointerDown={(e) => {
          const [x, y] = point(e);
          const node = hit(x, y);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const v = view.current;
          drag.current = { node, sx: x, sy: y, ox: node === null ? v.x : graph.nodes[node].x, oy: node === null ? v.y : graph.nodes[node].y, moved: false };
          if (node !== null) graph.nodes[node].fixed = true;
        }}
        onPointerMove={(e) => {
          const [x, y] = point(e);
          const d = drag.current;
          if (d) {
            if (Math.hypot(x - d.sx, y - d.sy) > 3) d.moved = true;
            if (d.node === null) {
              view.current.x = d.ox + (x - d.sx);
              view.current.y = d.oy + (y - d.sy);
            } else {
              const p = graph.nodes[d.node];
              p.x = d.ox + (x - d.sx) / view.current.k;
              p.y = d.oy + (y - d.sy) / view.current.k;
              heat.current = Math.max(heat.current, 0.3);
            }
            return;
          }
          const h = hit(x, y);
          if (h !== hover.current) {
            hover.current = h;
            setTitle(h === null ? null : graph.nodes[h].title);
          }
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d?.node !== null && d?.node !== undefined) {
            graph.nodes[d.node].fixed = false;
            if (!d.moved) panes.open({ kind: 'note', id: graph.nodes[d.node].id }, e.shiftKey ? 'replace' : 'tab');
          }
        }}
        onPointerLeave={() => {
          hover.current = null;
          setTitle(null);
        }}
        onWheel={(e) => {
          const [x, y] = point(e);
          const v = view.current;
          const el = canvas.current!;
          const k = Math.min(4, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.0015)));
          // Zoom about the mouse.
          const cx = x - el.clientWidth / 2;
          const cy = y - el.clientHeight / 2;
          v.x = cx - ((cx - v.x) * k) / v.k;
          v.y = cy - ((cy - v.y) * k) / v.k;
          v.k = k;
        }}
        style={{ cursor: title ? 'pointer' : 'grab' }}
      />
      {graph.nodes.length === 0 && <p className="graph-empty">{local ? 'Open a note to see the notes linked to it.' : 'No notes yet.'} Link notes by typing [[ and a title.</p>}
    </section>
  );
}
