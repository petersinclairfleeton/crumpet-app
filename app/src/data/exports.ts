// More ways to download a document (Word's Save As types): plain text,
// a web page (HTML, pictures inside it), Rich Text (RTF) and OpenDocument
// Text (ODT, for LibreOffice and others). Each walks the document the same
// way: headings, paragraphs, lists, quotes, tables, pictures and footnotes,
// with bold, italic, underline, strikethrough, links and colours in the text.

import { chartSvg, parseChart } from '@crumpet/editor/chart';
import { inkSvg, parseInk } from '@crumpet/editor/ink';
import type { Block, Doc, Run } from '@crumpet/editor/model';
import { FIELD, FOOTNOTE, isHeading, isList } from '@crumpet/editor/model';
import { cellRuns } from '@crumpet/editor/cells';
import { type ZipEntry, utf8, writeZip } from './zip';

export interface ExportPart {
  /** A chapter's title, written as a heading before it. */
  heading?: string;
  doc: Doc;
}

export type Media = (src: string) => Promise<{ bytes: Uint8Array; type: string } | null>;

type Item =
  | { kind: 'h'; level: number; runs: Run[] }
  | { kind: 'p'; runs: Run[]; align?: string; quote?: boolean }
  | { kind: 'li'; ordered: boolean; number: number; level: number; runs: Run[]; checked?: boolean }
  | { kind: 'table'; rows: Run[][][] }
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'code'; text: string; lang?: string }
  | { kind: 'break' };

/** The parts as simple items, in order, and their footnotes (numbered through the whole document). */
function walk(parts: ExportPart[]): { items: Item[]; notes: string[] } {
  const items: Item[] = [];
  const notes: string[] = [];
  parts.forEach((part, k) => {
    if (k > 0) items.push({ kind: 'break' });
    if (part.heading) items.push({ kind: 'h', level: 1, runs: [{ text: part.heading, marks: [] }] });
    const counts: number[] = [];
    for (const b of part.doc.blocks) {
      if (b.para?.pageBefore && items.length) items.push({ kind: 'break' });
      const runs = shown(b, notes);
      if (isHeading(b.type)) items.push({ kind: 'h', level: Math.min(6, Number(b.type.slice(-1)) + (part.heading ? 1 : 0)), runs });
      else if (isList(b.type)) {
        const level = b.indent ?? 0;
        const ordered = b.type === 'numbered';
        counts.length = level + 1;
        counts[level] = ordered ? (b.para?.start ?? (counts[level] ?? 0) + 1) : 0;
        items.push({ kind: 'li', ordered, number: counts[level], level, runs, ...(b.type === 'todo' ? { checked: !!b.checked } : {}) });
        continue;
      } else if (b.type === 'table') items.push({ kind: 'table', rows: (b.rows ?? []).map((row) => row.map((cell) => cellRuns(cell))) });
      else if (b.type === 'image' && b.src) items.push({ kind: 'image', src: b.src, alt: b.pic?.alt ?? runs.map((r) => r.text).join('') });
      else if (b.type === 'code') items.push({ kind: 'code', text: b.code?.text ?? '', lang: b.code?.lang });
      // (A drawing's strokes are no use as text: the text downloads say it's there.)
      else if (b.type === 'shape') {
        if (b.shape?.text) items.push({ kind: 'p', runs: cellRuns(b.shape.text) });
      } else if (b.type === 'toc') {
        // (A table of contents is left out: the reader's app makes its own.)
      } else items.push({ kind: 'p', runs, align: b.align, quote: b.type === 'quote' });
      counts.length = 0;
    }
  });
  return { items, notes };
}

/** A block's runs as they read: deleted changes out, footnotes as their numbers (their text collected), fields as their text. */
function shown(b: Block, notes: string[]): Run[] {
  const out: Run[] = [];
  for (const r of b.runs) {
    if (r.change?.kind === 'del') continue;
    if (r.footnote !== undefined) {
      notes.push(r.footnote);
      out.push({ text: String(notes.length), marks: [], look: { va: 'super' } });
      continue;
    }
    const text = r.text.replaceAll(FOOTNOTE, '').replaceAll(FIELD, '');
    if (text) out.push({ ...r, text });
  }
  return out;
}

const plainRuns = (runs: Run[]) => runs.map((r) => r.text).join('');

// ---------------------------------------------------------------- plain text

export function toText(title: string, parts: ExportPart[]): string {
  const { items, notes } = walk(parts);
  const lines: string[] = [];
  if (title) lines.push(title, '='.repeat(Math.min(60, title.length)), '');
  for (const it of items) {
    if (it.kind === 'h') lines.push(it.level === 1 ? plainRuns(it.runs).toUpperCase() : plainRuns(it.runs), '');
    else if (it.kind === 'p') lines.push(`${it.quote ? '    ' : ''}${plainRuns(it.runs)}`, '');
    else if (it.kind === 'li') lines.push(`${'  '.repeat(it.level)}${it.checked !== undefined ? (it.checked ? '[x] ' : '[ ] ') : it.ordered ? `${it.number}. ` : '• '}${plainRuns(it.runs)}`);
    else if (it.kind === 'table') lines.push(...it.rows.map((row) => row.map(plainRuns).join('\t')), '');
    else if (it.kind === 'image') lines.push(`[Picture${it.alt ? `: ${it.alt}` : ''}]`, '');
    else if (it.kind === 'code') lines.push(it.lang === 'ink' ? '[Drawing]' : it.text, '');
    else lines.push('', '* * *', '');
  }
  if (notes.length) lines.push('', 'Notes', ...notes.map((n, i) => `${i + 1}. ${n}`));
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

// ---------------------------------------------------------------- HTML

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function htmlRuns(runs: Run[]): string {
  return runs
    .map((r) => {
      let h = esc(r.text).replace(/\n/g, '<br>').replace(/\t/g, '&emsp;');
      const m = r.marks;
      if (m.includes('code')) h = `<code>${h}</code>`;
      if (m.includes('bold')) h = `<strong>${h}</strong>`;
      if (m.includes('italic')) h = `<em>${h}</em>`;
      if (m.includes('underline')) h = `<u>${h}</u>`;
      if (m.includes('strike')) h = `<s>${h}</s>`;
      if (r.look?.va === 'super') h = `<sup>${h}</sup>`;
      if (r.look?.va === 'sub') h = `<sub>${h}</sub>`;
      const css = [r.look?.color ? `color:${r.look.color}` : '', r.look?.highlight ? `background:${r.look.highlight}` : '', r.look?.font ? `font-family:'${esc(r.look.font)}'` : '', r.look?.size ? `font-size:${r.look.size}pt` : ''].filter(Boolean).join(';');
      if (css) h = `<span style="${css}">${h}</span>`;
      if (r.link && !r.link.startsWith('note:') && !r.link.startsWith('#')) h = `<a href="${esc(r.link)}">${h}</a>`;
      return h;
    })
    .join('');
}

export async function toHtml(title: string, parts: ExportPart[], media?: Media): Promise<string> {
  const { items, notes } = walk(parts);
  const out: string[] = [];
  const list: { ordered: boolean; level: number }[] = [];
  const closeLists = (to = 0) => {
    while (list.length > to) out.push(list.pop()!.ordered ? '</ol>' : '</ul>');
  };
  for (const it of items) {
    if (it.kind !== 'li') closeLists();
    if (it.kind === 'h') out.push(`<h${it.level}>${htmlRuns(it.runs)}</h${it.level}>`);
    else if (it.kind === 'p') out.push(it.quote ? `<blockquote><p>${htmlRuns(it.runs)}</p></blockquote>` : `<p${it.align && it.align !== 'left' ? ` style="text-align:${it.align}"` : ''}>${htmlRuns(it.runs) || '&nbsp;'}</p>`);
    else if (it.kind === 'li') {
      while (list.length > it.level + 1) closeLists(list.length - 1);
      while (list.length < it.level + 1) {
        list.push({ ordered: it.ordered, level: list.length });
        out.push(it.ordered ? `<ol${it.number > 1 && list.length === it.level + 1 ? ` start="${it.number}"` : ''}>` : '<ul>');
      }
      out.push(`<li>${it.checked !== undefined ? `<input type="checkbox" disabled${it.checked ? ' checked' : ''}> ` : ''}${htmlRuns(it.runs)}</li>`);
    } else if (it.kind === 'table') out.push(`<table>${it.rows.map((row, i) => `<tr>${row.map((c) => (i === 0 ? `<th>${htmlRuns(c)}</th>` : `<td>${htmlRuns(c)}</td>`)).join('')}</tr>`).join('')}</table>`);
    else if (it.kind === 'image') {
      const got = await media?.(it.src);
      const src = got ? `data:${got.type};base64,${base64(got.bytes)}` : /^https?:/.test(it.src) ? it.src : '';
      if (src) out.push(`<figure><img src="${esc(src)}" alt="${esc(it.alt)}"></figure>`);
    } else if (it.kind === 'code') out.push(it.lang === 'chart' ? `<figure class="chart">${chartSvg(parseChart(it.text), '#222')}</figure>` : it.lang === 'ink' ? `<figure class="drawing">${inkSvg(parseInk(it.text))}</figure>` : `<pre>${esc(it.text)}</pre>`);
    else out.push('<hr class="page-break">');
  }
  closeLists();
  if (notes.length) out.push(`<section class="notes"><h2>Notes</h2><ol>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ol></section>`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
body { max-width: 42em; margin: 3em auto; padding: 0 1.2em; font: 18px/1.6 Georgia, serif; color: #222; }
h1, h2, h3 { line-height: 1.25; }
blockquote { margin: 1em 2em; font-style: italic; }
table { border-collapse: collapse; margin: 1em 0; }
th, td { border: 1px solid #bbb; padding: 4px 8px; text-align: left; }
img { max-width: 100%; }
hr.page-break { border: none; border-top: 1px dashed #ccc; margin: 2em 0; }
.notes { font-size: 0.85em; border-top: 1px solid #ddd; margin-top: 3em; }
</style>
</head>
<body>
${title ? `<h1>${esc(title)}</h1>\n` : ''}${out.join('\n')}
</body>
</html>
`;
}

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---------------------------------------------------------------- RTF

/** Text for RTF: its special characters escaped, and anything past plain ASCII as \uN. */
function rtfText(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === '\\' || ch === '{' || ch === '}') out += `\\${ch}`;
    else if (ch === '\n') out += '\\line ';
    else if (ch === '\t') out += '\\tab ';
    else if (c > 127) {
      if (c > 0xffff) {
        const hi = Math.floor((c - 0x10000) / 0x400) + 0xd800;
        const lo = ((c - 0x10000) % 0x400) + 0xdc00;
        out += `\\u${hi - 65536}?\\u${lo - 65536}?`;
      } else out += `\\u${c > 32767 ? c - 65536 : c}?`;
    } else out += ch;
  }
  return out;
}

function rtfRuns(runs: Run[], colours: string[]): string {
  return runs
    .map((r) => {
      const m = r.marks;
      let f = '';
      if (m.includes('bold')) f += '\\b';
      if (m.includes('italic')) f += '\\i';
      if (m.includes('underline')) f += '\\ul';
      if (m.includes('strike')) f += '\\strike';
      if (r.look?.va === 'super') f += '\\super';
      if (r.look?.va === 'sub') f += '\\sub';
      if (r.look?.size) f += `\\fs${Math.round(r.look.size * 2)}`;
      if (r.look?.color) {
        let k = colours.indexOf(r.look.color);
        if (k < 0) k = colours.push(r.look.color) - 1;
        f += `\\cf${k + 1}`;
      }
      const body = rtfText(r.text);
      const text = f ? `{${f} ${body}}` : body;
      return r.link && /^https?:/.test(r.link) ? `{\\field{\\*\\fldinst HYPERLINK "${rtfText(r.link)}"}{\\fldrslt ${text}}}` : text;
    })
    .join('');
}

export function toRtf(title: string, parts: ExportPart[]): string {
  const { items, notes } = walk(parts);
  const colours: string[] = [];
  const body: string[] = [];
  if (title) body.push(`{\\pard\\qc\\sb240\\sa240\\b\\fs48 ${rtfText(title)}\\par}`);
  for (const it of items) {
    if (it.kind === 'h') body.push(`{\\pard\\keepn\\sb240\\sa120\\b\\fs${[0, 36, 30, 26, 24, 24, 24][it.level]} ${rtfRuns(it.runs, colours)}\\par}`);
    else if (it.kind === 'p') body.push(`{\\pard${it.quote ? '\\li720\\ri720\\i' : ''}${it.align === 'center' ? '\\qc' : it.align === 'right' ? '\\qr' : it.align === 'justify' ? '\\qj' : ''}\\sa160 ${rtfRuns(it.runs, colours)}\\par}`);
    else if (it.kind === 'li') {
      const mark = it.checked !== undefined ? (it.checked ? '\\u9745?' : '\\u9744?') : it.ordered ? `${it.number}.` : '\\bullet';
      body.push(`{\\pard\\li${720 + it.level * 360}\\fi-360\\sa60 ${mark}\\tab ${rtfRuns(it.runs, colours)}\\par}`);
    } else if (it.kind === 'table') {
      for (const [i, row] of it.rows.entries()) {
        const n = Math.max(1, row.length);
        const cells = Array.from({ length: n }, (_, c) => `\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx${Math.round(((c + 1) * 9000) / n)}`).join('');
        body.push(`{\\trowd\\trgaph108${cells}${row.map((c) => `\\pard\\intbl${i === 0 ? '\\b' : ''} ${rtfRuns(c, colours)}${i === 0 ? '\\b0' : ''}\\cell`).join('')}\\row}`);
      }
      body.push('{\\pard\\par}');
    } else if (it.kind === 'image') body.push(`{\\pard\\i [Picture${it.alt ? `: ${rtfText(it.alt)}` : ''}]\\par}`);
    else if (it.kind === 'code') body.push(`{\\pard\\f1\\fs20 ${rtfText(it.lang === 'ink' ? '[Drawing]' : it.text)}\\par}`);
    else body.push('\\page');
  }
  if (notes.length) body.push(`{\\pard\\sb240\\b Notes\\par}`, ...notes.map((n, i) => `{\\pard\\fs20 ${i + 1}. ${rtfText(n)}\\par}`));
  const colourTable = `{\\colortbl;${colours.map((c) => `\\red${parseInt(c.slice(1, 3), 16)}\\green${parseInt(c.slice(3, 5), 16)}\\blue${parseInt(c.slice(5, 7), 16)};`).join('')}}`;
  return `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman Georgia;}{\\f1\\fmodern Courier New;}}${colourTable}{\\info{\\title ${rtfText(title)}}}\\fs24\n${body.join('\n')}\n}`;
}

// ---------------------------------------------------------------- OpenDocument Text

const xml = (s: string) => esc(s).replace(/'/g, '&apos;');

/** OpenDocument's text: spans for each look (styles made as needed), tabs, line breaks and runs of spaces. */
function odtRuns(runs: Run[], styles: Map<string, string>): string {
  return runs
    .map((r) => {
      const props = [
        r.marks.includes('bold') ? 'fo:font-weight="bold"' : '',
        r.marks.includes('italic') ? 'fo:font-style="italic"' : '',
        r.marks.includes('underline') ? 'style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"' : '',
        r.marks.includes('strike') ? 'style:text-line-through-style="solid"' : '',
        r.look?.va === 'super' ? 'style:text-position="super 58%"' : r.look?.va === 'sub' ? 'style:text-position="sub 58%"' : '',
        r.look?.color ? `fo:color="${r.look.color}"` : '',
        r.look?.highlight ? `fo:background-color="${r.look.highlight}"` : '',
        r.look?.size ? `fo:font-size="${r.look.size}pt"` : '',
        r.marks.includes('code') ? 'style:font-name="Courier New"' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const text = xml(r.text)
        .replace(/\n/g, '<text:line-break/>')
        .replace(/\t/g, '<text:tab/>')
        .replace(/ {2,}/g, (sp) => ` <text:s text:c="${sp.length - 1}"/>`);
      let out = text;
      if (props) {
        let name = styles.get(props);
        if (!name) {
          name = `T${styles.size + 1}`;
          styles.set(props, name);
        }
        out = `<text:span text:style-name="${name}">${text}</text:span>`;
      }
      return r.link && /^https?:/.test(r.link) ? `<text:a xlink:type="simple" xlink:href="${xml(r.link)}">${out}</text:a>` : out;
    })
    .join('');
}

export async function toOdt(title: string, parts: ExportPart[], media?: Media): Promise<Uint8Array> {
  const { items, notes } = walk(parts);
  const spans = new Map<string, string>();
  const pics: ZipEntry[] = [];
  const body: string[] = [];
  const open: { ordered: boolean }[] = [];
  const closeLists = (to = 0) => {
    while (open.length > to) {
      open.pop();
      body.push('</text:list-item></text:list>');
    }
  };
  // (Footnote numbers stay in the text as small raised figures; the notes are listed at the end.)
  let noteNo = 0;
  if (title) body.push(`<text:p text:style-name="Title">${xml(title)}</text:p>`);
  for (const it of items) {
    if (it.kind !== 'li') closeLists();
    if (it.kind === 'h') body.push(`<text:h text:style-name="Heading_20_${Math.min(4, it.level)}" text:outline-level="${it.level}">${odtRuns(it.runs, spans)}</text:h>`);
    else if (it.kind === 'p') body.push(`<text:p text:style-name="${it.quote ? 'Quotations' : it.align === 'center' ? 'Centre' : it.align === 'right' ? 'Right' : it.align === 'justify' ? 'Justify' : 'Text_20_body'}">${odtRuns(it.runs, spans)}</text:p>`);
    else if (it.kind === 'li') {
      const depth = it.level + 1;
      if (open.length >= depth) {
        closeLists(depth);
        body.push('</text:list-item><text:list-item>');
      }
      while (open.length < depth) {
        open.push({ ordered: it.ordered });
        body.push(`<text:list text:style-name="${it.ordered ? 'Numbering' : 'Bullets'}"><text:list-item>`);
      }
      body.push(`<text:p text:style-name="List">${it.checked !== undefined ? (it.checked ? '☑ ' : '☐ ') : ''}${odtRuns(it.runs, spans)}</text:p>`);
    } else if (it.kind === 'table') {
      const cols = Math.max(1, ...it.rows.map((r) => r.length));
      body.push(`<table:table table:name="Table${body.length}"><table:table-column table:number-columns-repeated="${cols}"/>${it.rows.map((row, i) => `<table:table-row>${row.map((c) => `<table:table-cell table:style-name="Cell" office:value-type="string"><text:p text:style-name="${i === 0 ? 'Table_20_Heading' : 'Table_20_Contents'}">${odtRuns(c, spans)}</text:p></table:table-cell>`).join('')}</table:table-row>`).join('')}</table:table>`);
    } else if (it.kind === 'image') {
      const got = await media?.(it.src);
      if (got) {
        const ext = got.type.includes('png') ? 'png' : got.type.includes('gif') ? 'gif' : got.type.includes('svg') ? 'svg' : 'jpg';
        const name = `Pictures/image${pics.length + 1}.${ext}`;
        pics.push({ name, data: got.bytes });
        const size = imageSize(got.bytes);
        const w = Math.min(6, size ? size.width / 96 : 4);
        const h = size ? (w * size.height) / size.width : w * 0.66;
        body.push(`<text:p text:style-name="Centre"><draw:frame draw:name="Picture ${pics.length}" text:anchor-type="as-char" svg:width="${w.toFixed(2)}in" svg:height="${h.toFixed(2)}in"><draw:image xlink:href="${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>${it.alt ? `<svg:desc>${xml(it.alt)}</svg:desc>` : ''}</draw:frame></text:p>`);
      }
    } else if (it.kind === 'code') body.push(...(it.lang === 'ink' ? '[Drawing]' : it.text).split('\n').map((l) => `<text:p text:style-name="Preformatted_20_Text">${xml(l).replace(/ {2,}/g, (sp) => ` <text:s text:c="${sp.length - 1}"/>`)}</text:p>`));
    else body.push('<text:p text:style-name="Page_20_break"/>');
  }
  closeLists();
  if (notes.length) {
    body.push('<text:h text:style-name="Heading_20_2" text:outline-level="2">Notes</text:h>');
    for (const n of notes) body.push(`<text:p text:style-name="Footnote">${++noteNo}. ${xml(n)}</text:p>`);
  }
  const ns =
    'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"';
  const auto = [...spans.entries()].map(([props, name]) => `<style:style style:name="${name}" style:family="text"><style:text-properties ${props}/></style:style>`).join('');
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${ns} office:version="1.3"><office:automatic-styles>${auto}<style:style style:name="Cell" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid #999999" fo:padding="0.05in"/></style:style></office:automatic-styles><office:body><office:text>${body.join('')}</office:text></office:body></office:document-content>`;
  const para = (name: string, display: string, props: string, text = '', parent = 'Standard') => `<style:style style:name="${name}" style:display-name="${display}" style:family="paragraph" style:parent-style-name="${parent}"${name.startsWith('Heading') ? ' style:next-style-name="Text_20_body" style:default-outline-level="' + name.slice(-1) + '"' : ''}><style:paragraph-properties ${props}/>${text ? `<style:text-properties ${text}/>` : ''}</style:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles ${ns} office:version="1.3"><office:font-face-decls/><office:styles>
<style:default-style style:family="paragraph"><style:text-properties style:font-name="Georgia" fo:font-family="Georgia" fo:font-size="12pt" fo:language="en" fo:country="GB"/></style:default-style>
<style:style style:name="Standard" style:family="paragraph" style:class="text"/>
${para('Text_20_body', 'Text body', 'fo:margin-bottom="0.08in" fo:line-height="130%"')}
${para('Title', 'Title', 'fo:text-align="center" fo:margin-bottom="0.2in"', 'fo:font-size="26pt" fo:font-weight="bold"')}
${para('Heading_20_1', 'Heading 1', 'fo:margin-top="0.25in" fo:margin-bottom="0.1in" fo:keep-with-next="always"', 'fo:font-size="18pt" fo:font-weight="bold"')}
${para('Heading_20_2', 'Heading 2', 'fo:margin-top="0.2in" fo:margin-bottom="0.08in" fo:keep-with-next="always"', 'fo:font-size="15pt" fo:font-weight="bold"')}
${para('Heading_20_3', 'Heading 3', 'fo:margin-top="0.16in" fo:margin-bottom="0.06in" fo:keep-with-next="always"', 'fo:font-size="13pt" fo:font-weight="bold"')}
${para('Heading_20_4', 'Heading 4', 'fo:margin-top="0.14in" fo:margin-bottom="0.06in" fo:keep-with-next="always"', 'fo:font-size="12pt" fo:font-weight="bold" fo:font-style="italic"')}
${para('Quotations', 'Quotations', 'fo:margin-left="0.4in" fo:margin-right="0.4in" fo:margin-bottom="0.08in"', 'fo:font-style="italic"')}
${para('Centre', 'Centre', 'fo:text-align="center" fo:margin-bottom="0.08in"', '', 'Text_20_body')}
${para('Right', 'Right', 'fo:text-align="end" fo:margin-bottom="0.08in"', '', 'Text_20_body')}
${para('Justify', 'Justify', 'fo:text-align="justify" fo:margin-bottom="0.08in"', '', 'Text_20_body')}
${para('List', 'List', 'fo:margin-bottom="0.03in"')}
${para('Table_20_Contents', 'Table Contents', '')}
${para('Table_20_Heading', 'Table Heading', '', 'fo:font-weight="bold"')}
${para('Preformatted_20_Text', 'Preformatted Text', '', 'style:font-name="Courier New" fo:font-family="Courier New" fo:font-size="10pt"')}
${para('Footnote', 'Footnote', '', 'fo:font-size="10pt"')}
${para('Page_20_break', 'Page break', 'fo:break-before="page"')}
<text:list-style style:name="Bullets"><text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.25in" fo:margin-left="0.5in"/></style:list-level-properties></text:list-level-style-bullet><text:list-level-style-bullet text:level="2" text:bullet-char="◦"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.25in" fo:margin-left="0.75in"/></style:list-level-properties></text:list-level-style-bullet></text:list-style>
<text:list-style style:name="Numbering"><text:list-level-style-number text:level="1" style:num-suffix="." style:num-format="1"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.25in" fo:margin-left="0.5in"/></style:list-level-properties></text:list-level-style-number><text:list-level-style-number text:level="2" style:num-suffix="." style:num-format="a"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.25in" fo:margin-left="0.75in"/></style:list-level-properties></text:list-level-style-number></text:list-style>
</office:styles></office:document-styles>`;
  const meta = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta ${ns} office:version="1.3"><office:meta><dc:title>${xml(title)}</dc:title><meta:generator>Crumpet</meta:generator></office:meta></office:document-meta>`;
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${pics.map((p) => `<manifest:file-entry manifest:full-path="${p.name}" manifest:media-type="${p.name.endsWith('png') ? 'image/png' : p.name.endsWith('gif') ? 'image/gif' : p.name.endsWith('svg') ? 'image/svg+xml' : 'image/jpeg'}"/>`).join('')}</manifest:manifest>`;
  return writeZip([
    // The type first, not compressed, as OpenDocument requires.
    { name: 'mimetype', data: utf8('application/vnd.oasis.opendocument.text'), store: true },
    { name: 'META-INF/manifest.xml', data: utf8(manifest) },
    { name: 'content.xml', data: utf8(content) },
    { name: 'styles.xml', data: utf8(styles) },
    { name: 'meta.xml', data: utf8(meta) },
    ...pics,
  ]);
}

/** Width and height of a PNG, JPEG or GIF from its first bytes. */
function imageSize(b: Uint8Array): { width: number; height: number } | null {
  if (b[0] === 0x89 && b[1] === 0x50) return { width: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], height: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
  if (b[0] === 0x47 && b[1] === 0x49) return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xc3) return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      i += 2 + len;
    }
  }
  return null;
}

export const EXPORT_TYPES = {
  txt: { type: 'text/plain;charset=utf-8', name: 'Plain text' },
  html: { type: 'text/html;charset=utf-8', name: 'Web page' },
  rtf: { type: 'application/rtf', name: 'Rich Text' },
  odt: { type: 'application/vnd.oasis.opendocument.text', name: 'OpenDocument Text' },
  fountain: { type: 'text/plain;charset=utf-8', name: 'Fountain (screenplay)' },
} as const;
