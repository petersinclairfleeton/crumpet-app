// Charts to and from Word: a chart part (DrawingML's c:chartSpace) holding
// the numbers themselves (literals, no spreadsheet inside), so Word draws the
// chart as its own; and Word's charts read back from their cached numbers.

import { CHART_COLOURS, type Chart, type ChartType } from '@crumpet/editor/chart';

export const C_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function strLit(items: string[]): string {
  return `<c:strLit><c:ptCount val="${items.length}"/>${items.map((t, i) => `<c:pt idx="${i}"><c:v>${esc(t)}</c:v></c:pt>`).join('')}</c:strLit>`;
}

function numLit(items: number[]): string {
  return `<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${items.length}"/>${items.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numLit>`;
}

const fill = (colour: string) => `<c:spPr><a:solidFill><a:srgbClr val="${colour.slice(1).toUpperCase()}"/></a:solidFill></c:spPr>`;
const line = (colour: string) => `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${colour.slice(1).toUpperCase()}"/></a:solidFill><a:round/></a:ln></c:spPr>`;

/** Word's chart part for a chart. */
export function chartSpaceXml(c: Chart): string {
  const pie = c.type === 'pie' || c.type === 'doughnut';
  const series = c.series.map((s, i) => {
    const colour = CHART_COLOURS[i % CHART_COLOURS.length];
    const points = pie ? c.categories.map((_, k) => `<c:dPt><c:idx val="${k}"/><c:bubble3D val="0"/>${fill(CHART_COLOURS[k % CHART_COLOURS.length])}</c:dPt>`).join('') : '';
    const look = c.type === 'line' ? `${line(colour)}<c:marker><c:symbol val="circle"/><c:size val="6"/>${fill(colour)}</c:marker>` : pie ? '' : fill(colour);
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>${look}${points}<c:cat>${strLit(c.categories)}</c:cat><c:val>${numLit(s.values)}</c:val>${c.type === 'line' ? '<c:smooth val="0"/>' : ''}</c:ser>`;
  });
  const axes = '<c:axId val="111111111"/><c:axId val="222222222"/>';
  const grouping = c.stacked ? 'stacked' : c.type === 'line' || c.type === 'area' ? 'standard' : 'clustered';
  let plot: string;
  if (c.type === 'column' || c.type === 'bar') plot = `<c:barChart><c:barDir val="${c.type === 'bar' ? 'bar' : 'col'}"/><c:grouping val="${grouping}"/><c:varyColors val="0"/>${series.join('')}<c:gapWidth val="150"/>${c.stacked ? '<c:overlap val="100"/>' : ''}${axes}</c:barChart>`;
  else if (c.type === 'line') plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series.join('')}<c:marker val="1"/>${axes}</c:lineChart>`;
  else if (c.type === 'area') plot = `<c:areaChart><c:grouping val="${grouping}"/><c:varyColors val="0"/>${series.join('')}${axes}</c:areaChart>`;
  else if (c.type === 'pie') plot = `<c:pieChart><c:varyColors val="1"/>${series.slice(0, 1).join('')}<c:firstSliceAng val="0"/></c:pieChart>`;
  else plot = `<c:doughnutChart><c:varyColors val="1"/>${series.slice(0, 1).join('')}<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`;
  const axis = (id: string, cross: string, pos: string, kind: 'cat' | 'val') =>
    `<c:${kind}Ax><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${pos}"/>${kind === 'val' ? '<c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="0"/>' : ''}<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${cross}"/><c:crosses val="autoZero"/>${kind === 'cat' ? '<c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>' : '<c:crossBetween val="between"/>'}</c:${kind}Ax>`;
  const axisXml = pie ? '' : axis('111111111', '222222222', c.type === 'bar' ? 'l' : 'b', 'cat') + axis('222222222', '111111111', c.type === 'bar' ? 'b' : 'l', 'val');
  const title = c.title ? `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${esc(c.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` : '<c:autoTitleDeleted val="1"/>';
  const legend = c.series.length > 1 || pie ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace xmlns:c="${C_NS}" xmlns:a="${A_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plot}${axisXml}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}

/** A chart from Word's chart part (from the numbers it keeps), or null if it's a kind we don't draw. */
export function readChartXml(xml: Document): Chart | null {
  const all = (el: Element | Document, name: string) => Array.from(el.getElementsByTagNameNS(C_NS, name));
  const one = (el: Element | Document, name: string) => all(el, name)[0] ?? null;
  const val = (el: Element | null) => el?.getAttribute('val') ?? null;
  const plot = one(xml, 'plotArea');
  if (!plot) return null;
  const kinds: [string, ChartType][] = [['barChart', 'column'], ['bar3DChart', 'column'], ['lineChart', 'line'], ['line3DChart', 'line'], ['areaChart', 'area'], ['pieChart', 'pie'], ['pie3DChart', 'pie'], ['doughnutChart', 'doughnut']];
  const found = kinds.map(([n, t]) => [one(plot, n), t] as const).find(([el]) => el);
  if (!found) return null;
  const [el, base] = found;
  const type: ChartType = base === 'column' && val(one(el!, 'barDir')) === 'bar' ? 'bar' : base;
  const points = (holder: Element | null): string[] => {
    if (!holder) return [];
    const pts = all(holder, 'pt');
    const n = Number(val(one(holder, 'ptCount')) ?? pts.length);
    const out = Array.from({ length: n }, () => '');
    for (const p of pts) out[Number(p.getAttribute('idx') ?? 0)] = one(p, 'v')?.textContent ?? '';
    return out;
  };
  const series = all(el!, 'ser').map((s, i) => {
    const tx = one(s, 'tx');
    const name = (tx && (one(tx, 'v')?.textContent ?? points(tx)[0])) || `Series ${i + 1}`;
    return { name, values: points(one(s, 'val')).map((v) => Number(v) || 0), cats: points(one(s, 'cat')) };
  });
  if (!series.length) return null;
  const title = one(xml, 'title');
  const titleText = title ? Array.from(title.getElementsByTagNameNS(A_NS, 't')).map((t) => t.textContent ?? '').join('') : '';
  const categories = series[0].cats.length ? series[0].cats : series[0].values.map((_, i) => String(i + 1));
  return {
    type,
    ...(titleText ? { title: titleText } : {}),
    ...(val(one(el!, 'grouping')) === 'stacked' || val(one(el!, 'grouping')) === 'percentStacked' ? { stacked: true } : {}),
    categories,
    series: series.map(({ name, values }) => ({ name, values })),
  };
}
