// SVG drawings as shapes: reading an SVG file's outlines into one path (for
// Convert to Shape), and writing a path in Word's own way of drawing outlines
// (DrawingML moveTo, lnTo, cubicBezTo, close), and reading it back.

import type { ShapeLook } from '@crumpet/editor/shape';

type Seg = { op: 'M' | 'L'; x: number; y: number } | { op: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number } | { op: 'Z' };

/** A path's commands, every one made absolute: moves, straight lines, cubic curves and closes (arcs and quadratic curves turned into cubics). */
export function normalizePath(d: string): Seg[] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) ?? [];
  const out: Seg[] = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lastC: [number, number] | null = null;
  let lastQ: [number, number] | null = null;
  const num = () => Number(tokens[i++]);
  const isNum = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]);
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) break;
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (C === 'Z') {
      out.push({ op: 'Z' });
      x = sx;
      y = sy;
      lastC = lastQ = null;
      continue;
    }
    if (!isNum()) break;
    if (C === 'M') {
      x = ox + num();
      y = oy + num();
      sx = x;
      sy = y;
      out.push({ op: 'M', x, y });
      cmd = rel ? 'l' : 'L';
      lastC = lastQ = null;
    } else if (C === 'L' || C === 'H' || C === 'V') {
      if (C === 'H') x = ox + num();
      else if (C === 'V') y = oy + num();
      else {
        x = ox + num();
        y = oy + num();
      }
      out.push({ op: 'L', x, y });
      lastC = lastQ = null;
    } else if (C === 'C' || C === 'S') {
      let x1: number;
      let y1: number;
      if (C === 'C') {
        x1 = ox + num();
        y1 = oy + num();
      } else [x1, y1] = lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y];
      const x2 = ox + num();
      const y2 = oy + num();
      const ex = ox + num();
      const ey = oy + num();
      out.push({ op: 'C', x1, y1, x2, y2, x: ex, y: ey });
      lastC = [x2, y2];
      lastQ = null;
      x = ex;
      y = ey;
    } else if (C === 'Q' || C === 'T') {
      let qx: number;
      let qy: number;
      if (C === 'Q') {
        qx = ox + num();
        qy = oy + num();
      } else [qx, qy] = lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y];
      const ex = ox + num();
      const ey = oy + num();
      out.push({ op: 'C', x1: x + (2 / 3) * (qx - x), y1: y + (2 / 3) * (qy - y), x2: ex + (2 / 3) * (qx - ex), y2: ey + (2 / 3) * (qy - ey), x: ex, y: ey });
      lastQ = [qx, qy];
      lastC = null;
      x = ex;
      y = ey;
    } else if (C === 'A') {
      const rx = Math.abs(num());
      const ry = Math.abs(num());
      const rot = num();
      const large = num() !== 0;
      const sweep = num() !== 0;
      const ex = ox + num();
      const ey = oy + num();
      out.push(...arcToCubics(x, y, rx, ry, rot, large, sweep, ex, ey));
      x = ex;
      y = ey;
      lastC = lastQ = null;
    } else break;
  }
  return out;
}

/** An elliptical arc as cubic curves (the usual conversion, in quarter turns at most). */
function arcToCubics(x1: number, y1: number, rx: number, ry: number, angle: number, large: boolean, sweep: boolean, x2: number, y2: number): Seg[] {
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return [{ op: 'L', x: x2, y: y2 }];
  const phi = (angle * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.ceil(Math.abs(dt) / (Math.PI / 2));
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const out: Seg[] = [];
  const pt = (t: number) => {
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy];
  };
  const der = (t: number) => {
    const ex = -rx * Math.sin(t);
    const ey = ry * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  for (let j = 0; j < n; j++) {
    const a = t1 + j * step;
    const b = a + step;
    const [ax, ay] = pt(a);
    const [bx, by] = pt(b);
    const [dax, day] = der(a);
    const [dbx, dby] = der(b);
    out.push({ op: 'C', x1: ax + k * dax, y1: ay + k * day, x2: bx - k * dbx, y2: by - k * dby, x: bx, y: by });
  }
  return out;
}

/** A path drawn in Word's way (a custom geometry), in a box `vb` wide and high. */
export function pathToDrawingML(d: string, vb: [number, number]): string {
  const S = 1000;
  const n = (v: number) => Math.round(v * S);
  const pt = (x: number, y: number) => `<a:pt x="${n(x)}" y="${n(y)}"/>`;
  const body = normalizePath(d)
    .map((s) => (s.op === 'M' ? `<a:moveTo>${pt(s.x, s.y)}</a:moveTo>` : s.op === 'L' ? `<a:lnTo>${pt(s.x, s.y)}</a:lnTo>` : s.op === 'C' ? `<a:cubicBezTo>${pt(s.x1, s.y1)}${pt(s.x2, s.y2)}${pt(s.x, s.y)}</a:cubicBezTo>` : '<a:close/>'))
    .join('');
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${n(vb[0])}" h="${n(vb[1])}">${body}</a:path></a:pathLst></a:custGeom>`;
}

/** A freeform's corners as a path in a 1 × 1 box. */
export function pointsToPath(pts: [number, number][]): string {
  return `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
}

/** Word's custom geometry read back: the path and its box; or a freeform's corners when it's only straight lines. */
export function drawingMLToShape(geom: Element): Partial<ShapeLook> | null {
  const path = Array.from(geom.getElementsByTagName('*')).find((x) => x.localName === 'path');
  if (!path) return null;
  const w = Number(path.getAttribute('w') ?? 0);
  const h = Number(path.getAttribute('h') ?? 0);
  if (!(w > 0 && h > 0)) return null;
  const pts = (el: Element) => Array.from(el.children).filter((x) => x.localName === 'pt').map((p) => [Number(p.getAttribute('x') ?? 0), Number(p.getAttribute('y') ?? 0)]);
  let d = '';
  let straight = true;
  let moves = 0;
  const corners: [number, number][] = [];
  for (const c of Array.from(path.children)) {
    const p = pts(c);
    if (c.localName === 'moveTo' && p[0]) {
      d += `M${p[0][0]} ${p[0][1]}`;
      moves++;
      corners.push([p[0][0] / w, p[0][1] / h]);
    } else if (c.localName === 'lnTo' && p[0]) {
      d += `L${p[0][0]} ${p[0][1]}`;
      corners.push([p[0][0] / w, p[0][1] / h]);
    } else if (c.localName === 'cubicBezTo' && p.length === 3) {
      d += `C${p.map(([x, y]) => `${x} ${y}`).join(' ')}`;
      straight = false;
    } else if (c.localName === 'quadBezTo' && p.length === 2) {
      d += `Q${p.map(([x, y]) => `${x} ${y}`).join(' ')}`;
      straight = false;
    } else if (c.localName === 'close') d += 'Z';
    else if (c.localName === 'arcTo') straight = false;
  }
  if (straight && moves === 1 && corners.length >= 3) return { kind: 'freeform', pts: corners.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]) };
  return d ? { kind: 'path', d, vb: [w, h] } : null;
}

/** An SVG file's drawing as one path: its outlines (paths, rectangles, circles, ellipses, polygons, lines), its box and first colours. */
export function svgToShapeLook(svgText: string): Partial<ShapeLook> | null {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  const vbAttr = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const width = parseFloat(svg.getAttribute('width') ?? '') || 0;
  const height = parseFloat(svg.getAttribute('height') ?? '') || 0;
  const [vx, vy, vw, vh] = vbAttr.length === 4 && vbAttr.every((v) => Number.isFinite(v)) ? vbAttr : [0, 0, width || 24, height || 24];
  const parts: string[] = [];
  let fill: string | null = null;
  let line: string | null = null;
  const color = (v: string | null) => {
    if (!v || v === 'none' || v.startsWith('url(')) return null;
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
    if (!m) return v === 'black' ? '#000000' : v === 'white' ? '#ffffff' : null;
    return m[1].length === 3 ? `#${[...m[1]].map((c) => c + c).join('')}`.toLowerCase() : `#${m[1].toLowerCase()}`;
  };
  const f = (el: Element, a: string) => Number(el.getAttribute(a) ?? 0);
  for (const el of Array.from(svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line'))) {
    if (el.closest('defs, clipPath, mask, symbol')) continue;
    let d = '';
    switch (el.localName) {
      case 'path':
        d = el.getAttribute('d') ?? '';
        break;
      case 'rect': {
        const [x, y, w, h] = [f(el, 'x'), f(el, 'y'), f(el, 'width'), f(el, 'height')];
        if (w > 0 && h > 0) d = `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
        break;
      }
      case 'circle':
      case 'ellipse': {
        const cx = f(el, 'cx');
        const cy = f(el, 'cy');
        const rx = el.localName === 'circle' ? f(el, 'r') : f(el, 'rx');
        const ry = el.localName === 'circle' ? f(el, 'r') : f(el, 'ry');
        if (rx > 0 && ry > 0) d = `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
        break;
      }
      case 'polygon':
      case 'polyline': {
        const nums = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
        const pts: string[] = [];
        for (let i = 0; i + 1 < nums.length; i += 2) pts.push(`${nums[i]} ${nums[i + 1]}`);
        if (pts.length > 1) d = `M${pts.join('L')}${el.localName === 'polygon' ? 'Z' : ''}`;
        break;
      }
      case 'line':
        d = `M${f(el, 'x1')} ${f(el, 'y1')}L${f(el, 'x2')} ${f(el, 'y2')}`;
        break;
    }
    if (!d) continue;
    // Made absolute and moved so the box starts at 0, 0 (transforms on groups aren't followed).
    const segs = normalizePath(d);
    parts.push(
      segs
        .map((s) => (s.op === 'Z' ? 'Z' : s.op === 'C' ? `C${s.x1 - vx} ${s.y1 - vy} ${s.x2 - vx} ${s.y2 - vy} ${s.x - vx} ${s.y - vy}` : `${s.op}${s.x - vx} ${s.y - vy}`))
        .join('')
        .replace(/(\.\d{3})\d+/g, '$1'),
    );
    const style = el.getAttribute('style') ?? '';
    fill ??= color(el.getAttribute('fill') ?? /fill:\s*([^;]+)/.exec(style)?.[1] ?? el.closest('[fill]')?.getAttribute('fill') ?? null);
    line ??= color(el.getAttribute('stroke') ?? /stroke:\s*([^;]+)/.exec(style)?.[1] ?? el.closest('[stroke]')?.getAttribute('stroke') ?? null);
  }
  if (!parts.length || !(vw > 0 && vh > 0)) return null;
  const d = parts.join('');
  if (d.length > 20000) return null;
  return { kind: 'path', d, vb: [vw, vh], fill: fill ?? (line ? null : '#000000'), line };
}
