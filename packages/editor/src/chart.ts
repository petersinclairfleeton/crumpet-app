// Charts, like Word's Insert Chart: a ```chart block holds the kind of chart
// and its numbers as plain text (a few "name: value" lines, then the data,
// one row a line, cells parted by commas or tabs), and is drawn here as SVG.
//
//   type: column
//   title: Fruit sold
//   , 2024, 2025
//   Apples, 3, 5
//   Pears, 4, 2

export type ChartType = 'column' | 'bar' | 'line' | 'area' | 'pie' | 'doughnut';
export const CHART_TYPES: [ChartType, string][] = [
  ['column', 'Column'],
  ['bar', 'Bar'],
  ['line', 'Line'],
  ['area', 'Area'],
  ['pie', 'Pie'],
  ['doughnut', 'Doughnut'],
];

export interface Chart {
  type: ChartType;
  title?: string;
  /** Bars stacked on each other (column, bar and area charts). */
  stacked?: boolean;
  categories: string[];
  series: { name: string; values: number[] }[];
}

/** The colours series take in turn (Word's Office colours). */
export const CHART_COLOURS = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#264478', '#9e480e', '#636363', '#997300'];

const splitRow = (line: string) => (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim());
const num = (s: string) => {
  const n = Number(s.replace(/[£$€%\s]/g, '').replace(/,(?=\d{3}\b)/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** A chart from its text. */
export function parseChart(text: string): Chart {
  const chart: Chart = { type: 'column', categories: [], series: [] };
  const rows: string[][] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const opt = /^(type|title|stacked)\s*:\s*(.*)$/i.exec(line);
    if (opt && !rows.length) {
      const [, k, v] = opt;
      if (k.toLowerCase() === 'type') {
        const t = v.trim().toLowerCase();
        if (CHART_TYPES.some(([c]) => c === t)) chart.type = t as ChartType;
      } else if (k.toLowerCase() === 'title') chart.title = v.trim() || undefined;
      else chart.stacked = /^(yes|true|1)$/i.test(v.trim());
      continue;
    }
    rows.push(splitRow(line));
  }
  if (!rows.length) return chart;
  // The first row names the series when its cells (after the first) aren't all numbers.
  const head = rows[0];
  const named = head.slice(1).some((c) => c && !/^[-+]?[\d.,£$€%\s]+$/.test(c)) || head[0] === '';
  const width = Math.max(...rows.map((r) => r.length));
  const names = named ? head.slice(1) : [];
  const body = named ? rows.slice(1) : rows;
  for (let s = 0; s < width - 1; s++) chart.series.push({ name: names[s] || `Series ${s + 1}`, values: body.map((r) => num(r[s + 1] ?? '')) });
  chart.categories = body.map((r, i) => r[0] || `${i + 1}`);
  return chart;
}

/** A chart's text. */
export function chartText(c: Chart): string {
  const cell = (s: string) => s.replace(/[,\t\n]/g, ' ');
  const lines = [`type: ${c.type}`];
  if (c.title) lines.push(`title: ${cell(c.title)}`);
  if (c.stacked) lines.push('stacked: yes');
  lines.push(['', ...c.series.map((s) => cell(s.name))].join(', '));
  c.categories.forEach((cat, i) => lines.push([cell(cat), ...c.series.map((s) => String(s.values[i] ?? 0))].join(', ')));
  return lines.join('\n');
}

/** A chart of a table's cells: the first row names the series, the first column the categories. */
export function chartFromRows(rows: string[][], type: ChartType = 'column'): string {
  // Empty rows (a table's last, waiting to be typed in) are left out.
  const kept = rows.filter((r) => r.some((c) => c.trim()));
  const lines = [`type: ${type}`, ...kept.map((r) => r.map((c) => c.replace(/[,\t\n]/g, ' ').trim()).join(', '))];
  return lines.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A round step for an axis from 0 to `max`. */
function niceStep(max: number): number {
  const raw = max / 5 || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

const fmt = (n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString('en-GB') : String(Math.round(n * 100) / 100));

/** The chart drawn as SVG (it scales to the width it's given). */
export function chartSvg(c: Chart, ink = 'currentColor'): string {
  const W = 600;
  const H = 360;
  const out: string[] = [];
  const font = 'font-family="inherit" font-size="12"';
  let top = 16;
  if (c.title) {
    out.push(`<text x="${W / 2}" y="26" text-anchor="middle" font-family="inherit" font-size="16" font-weight="600" fill="${ink}">${esc(c.title)}</text>`);
    top = 44;
  }
  const series = c.series.length ? c.series : [{ name: 'Series 1', values: [] }];
  const legendH = series.length > 1 || c.type === 'pie' || c.type === 'doughnut' ? 26 : 0;
  // The legend, along the bottom.
  if (legendH) {
    const items = c.type === 'pie' || c.type === 'doughnut' ? c.categories : series.map((s) => s.name);
    const widths = items.map((t) => 22 + Math.min(18, t.length) * 7);
    let x = (W - widths.reduce((a, b) => a + b, 0)) / 2;
    items.forEach((t, i) => {
      out.push(`<rect x="${x}" y="${H - 18}" width="10" height="10" rx="2" fill="${CHART_COLOURS[i % CHART_COLOURS.length]}"/><text x="${x + 14}" y="${H - 9}" ${font} fill="${ink}">${esc(t.slice(0, 18))}</text>`);
      x += widths[i];
    });
  }
  const bottom = H - legendH - 8;
  if (c.type === 'pie' || c.type === 'doughnut') {
    const vals = (series[0]?.values ?? []).map((v) => Math.max(0, v));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = W / 2;
    const cy = (top + bottom) / 2;
    const r = Math.min((bottom - top) / 2, 150);
    let a = -Math.PI / 2;
    vals.forEach((v, i) => {
      const sweep = (v / total) * Math.PI * 2;
      const colour = CHART_COLOURS[i % CHART_COLOURS.length];
      if (sweep >= Math.PI * 2 - 1e-6) out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colour}"/>`);
      else if (sweep > 0) {
        const [x1, y1] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
        const [x2, y2] = [cx + r * Math.cos(a + sweep), cy + r * Math.sin(a + sweep)];
        out.push(`<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${colour}" stroke="#fff" stroke-width="1.5"/>`);
      }
      // Its share, in the middle of the slice.
      if (v / total >= 0.05) {
        const mid = a + sweep / 2;
        const lr = c.type === 'doughnut' ? r * 0.78 : r * 0.62;
        out.push(`<text x="${(cx + lr * Math.cos(mid)).toFixed(1)}" y="${(cy + lr * Math.sin(mid) + 4).toFixed(1)}" text-anchor="middle" ${font} fill="#fff" font-weight="600">${Math.round((v / total) * 100)}%</text>`);
      }
      a += sweep;
    });
    if (c.type === 'doughnut') out.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="var(--chart-hole, #fff)"/>`);
  } else {
    const n = c.categories.length || 1;
    const stacked = !!c.stacked && c.type !== 'line';
    const sums = c.categories.map((_, i) => series.reduce((s, x) => s + Math.max(0, x.values[i] ?? 0), 0));
    const all = series.flatMap((s) => s.values);
    const max = Math.max(1e-9, stacked ? Math.max(0, ...sums) : Math.max(0, ...all));
    const min = stacked ? 0 : Math.min(0, ...all);
    const step = niceStep(max - min);
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step || step;
    const horizontal = c.type === 'bar';
    const left = horizontal ? 16 + Math.min(14, Math.max(...c.categories.map((t) => t.length), 1)) * 7 : 48;
    const right = W - 16;
    const plotBottom = horizontal ? bottom - 18 : bottom - 22;
    const span = (v: number) => (v - lo) / (hi - lo || 1);
    // Gridlines and the value axis's numbers.
    for (let v = lo; v <= hi + step / 2; v += step) {
      if (horizontal) {
        const x = left + span(v) * (right - left);
        out.push(`<line x1="${x.toFixed(1)}" y1="${top}" x2="${x.toFixed(1)}" y2="${plotBottom}" stroke="${ink}" stroke-opacity="0.15"/><text x="${x.toFixed(1)}" y="${plotBottom + 14}" text-anchor="middle" ${font} fill="${ink}" fill-opacity="0.7">${fmt(v)}</text>`);
      } else {
        const y = plotBottom - span(v) * (plotBottom - top);
        out.push(`<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${ink}" stroke-opacity="0.15"/><text x="${left - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" ${font} fill="${ink}" fill-opacity="0.7">${fmt(v)}</text>`);
      }
    }
    const band = ((horizontal ? plotBottom - top : right - left) as number) / n;
    // The categories along their axis.
    c.categories.forEach((t, i) => {
      const mid = (horizontal ? top : left) + band * (i + 0.5);
      if (horizontal) out.push(`<text x="${left - 6}" y="${(mid + 4).toFixed(1)}" text-anchor="end" ${font} fill="${ink}">${esc(t.slice(0, 14))}</text>`);
      else out.push(`<text x="${mid.toFixed(1)}" y="${plotBottom + 16}" text-anchor="middle" ${font} fill="${ink}">${esc(t.slice(0, Math.max(3, Math.floor(band / 7))))}</text>`);
    });
    const zero = span(Math.max(lo, 0));
    if (c.type === 'column' || c.type === 'bar') {
      const groups = stacked ? 1 : series.length;
      const inner = band * 0.7;
      const w = inner / groups;
      const base = c.categories.map(() => 0);
      series.forEach((s, si) => {
        const colour = CHART_COLOURS[si % CHART_COLOURS.length];
        s.values.forEach((v, i) => {
          const from = stacked ? base[i] : 0;
          const to = from + v;
          if (stacked) base[i] = to;
          const a = span(Math.max(lo, Math.min(from, to)));
          const b = span(Math.max(from, to));
          const start = (horizontal ? top : left) + band * i + (band - inner) / 2 + (stacked ? 0 : si * w);
          if (horizontal) out.push(`<rect x="${(left + a * (right - left)).toFixed(1)}" y="${start.toFixed(1)}" width="${Math.max(0, (b - a) * (right - left)).toFixed(1)}" height="${(w - 2).toFixed(1)}" fill="${colour}"><title>${esc(`${s.name}, ${c.categories[i]}: ${fmt(v)}`)}</title></rect>`);
          else out.push(`<rect x="${start.toFixed(1)}" y="${(plotBottom - b * (plotBottom - top)).toFixed(1)}" width="${(w - 2).toFixed(1)}" height="${Math.max(0, (b - a) * (plotBottom - top)).toFixed(1)}" fill="${colour}"><title>${esc(`${s.name}, ${c.categories[i]}: ${fmt(v)}`)}</title></rect>`);
        });
      });
    } else {
      const base = c.categories.map(() => 0);
      const x = (i: number) => left + band * (i + 0.5);
      const y = (v: number) => plotBottom - span(v) * (plotBottom - top);
      // Stacked areas from the top series down, so each sits on the ones below.
      const tops = series.map((s) => s.values.map((v, i) => (stacked ? (base[i] += v) : v)));
      for (let si = series.length - 1; si >= 0; si--) {
        const colour = CHART_COLOURS[si % CHART_COLOURS.length];
        const pts = tops[si].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
        if (!pts.length) continue;
        if (c.type === 'area') {
          const floor = stacked && si > 0 ? tops[si - 1].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse() : [`${x(tops[si].length - 1).toFixed(1)},${(plotBottom - zero * (plotBottom - top)).toFixed(1)}`, `${x(0).toFixed(1)},${(plotBottom - zero * (plotBottom - top)).toFixed(1)}`];
          out.push(`<polygon points="${[...pts, ...floor].join(' ')}" fill="${colour}" fill-opacity="${stacked ? 0.9 : 0.55}"/>`);
        } else {
          out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-linejoin="round"/>`);
          tops[si].forEach((v, i) => out.push(`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="${colour}"><title>${esc(`${series[si].name}, ${c.categories[i]}: ${fmt(series[si].values[i])}`)}</title></circle>`));
        }
      }
    }
    // The axis line at zero.
    if (horizontal) out.push(`<line x1="${(left + zero * (right - left)).toFixed(1)}" y1="${top}" x2="${(left + zero * (right - left)).toFixed(1)}" y2="${plotBottom}" stroke="${ink}" stroke-opacity="0.5"/>`);
    else out.push(`<line x1="${left}" y1="${(plotBottom - zero * (plotBottom - top)).toFixed(1)}" x2="${right}" y2="${(plotBottom - zero * (plotBottom - top)).toFixed(1)}" stroke="${ink}" stroke-opacity="0.5"/>`);
  }
  return `<svg class="chart-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title || `${c.type} chart`)}">${out.join('')}</svg>`;
}
