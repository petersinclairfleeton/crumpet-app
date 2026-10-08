// The graph view's data and layout, like Obsidian's: each note is a dot,
// each link between notes a line; dots push apart, lines pull together, and
// the whole settles into clusters of related notes.

import type { Note } from './types';
import { findByTitle, linkedTitles } from './links';
import { displayTitle } from './selectors';

export interface GraphNode {
  id: string;
  title: string;
  /** Its notebook, for colour. */
  group: string | null;
  /** How many links it has (either way). */
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Held by the mouse: not moved by the layout. */
  fixed?: boolean;
}

export interface Graph {
  nodes: GraphNode[];
  edges: { a: number; b: number }[];
}

/**
 * The notes and their links. With `around`, only the notes within `depth`
 * links of that one (the local graph); `orphans` keeps notes with no links.
 */
export function buildGraph(notes: Note[], opts: { around?: string | null; depth?: number; orphans?: boolean } = {}): Graph {
  const live = notes.filter((n) => n.trashedAt === null && !n.projectId);
  const index = new Map(live.map((n, i) => [n.id, i]));
  const pairs = new Set<string>();
  const edges: { a: number; b: number }[] = [];
  for (const [i, n] of live.entries()) {
    for (const t of linkedTitles(n.doc)) {
      const target = findByTitle(live, t);
      const j = target ? index.get(target.id) : undefined;
      if (j === undefined || j === i) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (pairs.has(key)) continue;
      pairs.add(key);
      edges.push({ a: i, b: j });
    }
  }
  const degree = new Array(live.length).fill(0);
  for (const e of edges) {
    degree[e.a]++;
    degree[e.b]++;
  }
  let keep = live.map((_, i) => opts.orphans !== false || degree[i] > 0);
  if (opts.around && index.has(opts.around)) {
    // Breadth-first out from the note, up to `depth` links away.
    const near = new Set([index.get(opts.around)!]);
    let edge = [...near];
    for (let d = 0; d < (opts.depth ?? 1); d++) {
      const next: number[] = [];
      for (const e of edges) {
        if (edge.includes(e.a) && !near.has(e.b)) next.push(e.b);
        if (edge.includes(e.b) && !near.has(e.a)) next.push(e.a);
      }
      next.forEach((x) => near.add(x));
      edge = next;
    }
    keep = live.map((_, i) => near.has(i));
  }
  const newIndex = new Map<number, number>();
  const nodes: GraphNode[] = [];
  live.forEach((n, i) => {
    if (!keep[i]) return;
    newIndex.set(i, nodes.length);
    // Start on a spiral, so the layout settles the same way each time.
    const k = nodes.length;
    const r = 30 * Math.sqrt(k + 1);
    const t = k * 2.399963;
    nodes.push({ id: n.id, title: displayTitle(n), group: n.notebookId, degree: degree[i], x: r * Math.cos(t), y: r * Math.sin(t), vx: 0, vy: 0 });
  });
  return {
    nodes,
    edges: edges.filter((e) => newIndex.has(e.a) && newIndex.has(e.b)).map((e) => ({ a: newIndex.get(e.a)!, b: newIndex.get(e.b)! })),
  };
}

/** One step of the layout; returns how much things moved (small when settled). */
export function step(g: Graph, strength = 1): number {
  const { nodes, edges } = g;
  const n = nodes.length;
  // Dots push each other apart (gently, beyond a distance).
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        dx = (i - j) * 0.1;
        dy = 0.1;
        d2 = dx * dx + dy * dy;
      }
      if (d2 > 250000) continue;
      const f = (900 / d2) * strength;
      const d = Math.sqrt(d2);
      a.vx -= (dx / d) * f;
      a.vy -= (dy / d) * f;
      b.vx += (dx / d) * f;
      b.vy += (dy / d) * f;
    }
  }
  // Links pull their ends towards a comfortable length.
  for (const e of edges) {
    const a = nodes[e.a];
    const b = nodes[e.b];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const f = (d - 70) * 0.02 * strength;
    a.vx += (dx / d) * f;
    a.vy += (dy / d) * f;
    b.vx -= (dx / d) * f;
    b.vy -= (dy / d) * f;
  }
  // Everything drifts gently to the middle, and slows down.
  let moved = 0;
  for (const p of nodes) {
    p.vx = (p.vx - p.x * 0.002 * strength) * 0.82;
    p.vy = (p.vy - p.y * 0.002 * strength) * 0.82;
    if (p.fixed) {
      p.vx = p.vy = 0;
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    moved += Math.abs(p.vx) + Math.abs(p.vy);
  }
  return n ? moved / n : 0;
}
