// Word documents (.docx): writing a note or a manuscript as one, and reading
// one into a note. A .docx is a zip of XML files; we write the parts Word
// needs (styles, lists, footnotes, pictures, headers and footers) and read
// back what Crumpet can show.

import { type Block, type BlockType, type Doc, type Mark, type Run, FOOTNOTE, makeBlock, normalizeRuns, sortMarks, tidyRows } from '@crumpet/editor/model';
import { type HFBand, type HFRun, type HFSet, type HeadersFooters, bandEmpty } from './headers';
import { PAGE_SIZES, type PageSetup } from './styles';
import { type ZipEntry, readZip, utf8, writeZip } from './zip';

export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ------------------------------------------------------------------ writing

export interface DocxPart {
  /** A chapter title, written as Heading 1 starting a new page. */
  heading?: string;
  doc: Doc;
}

export interface DocxOptions {
  title: string;
  author?: string;
  page?: PageSetup;
  /** Headers and footers; fields other than page numbers are filled in by `field`. */
  hf?: HeadersFooters;
  field?(run: HFRun): string;
  /** Writing font and size (points). */
  font?: string;
  size?: number;
  /** The title, written at the top in the Title style. */
  titleParagraph?: string;
  /** A picture's bytes, from its src. */
  media?(src: string): Promise<{ bytes: Uint8Array; type: string } | null>;
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const TWIPS = 1440;
const EMU_PER_PX = 9525;

/** Text made safe for XML (characters XML can't hold are dropped). */
function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PARA_STYLES: Record<string, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  nospacing: 'NoSpacing',
  epigraph: 'Epigraph',
  caption: 'Caption',
  intense: 'IntenseQuote',
};

const JC: Record<string, string> = { center: 'center', right: 'right', justify: 'both' };

/** Width and height in pixels, read from a PNG, JPEG or GIF's header. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && v.getUint32(0) === 0x89504e47) return { width: v.getUint32(16), height: v.getUint32(20) };
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return { width: v.getUint16(6, true), height: v.getUint16(8, true) };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let p = 2;
    while (p + 9 < bytes.length) {
      if (bytes[p] !== 0xff) return null;
      const marker = bytes[p + 1];
      const len = v.getUint16(p + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: v.getUint16(p + 7), height: v.getUint16(p + 5) };
      p += 2 + len;
    }
  }
  return null;
}

function imageExt(type: string, bytes: Uint8Array): 'png' | 'jpeg' | 'gif' | null {
  if (/png/.test(type) || (bytes[0] === 0x89 && bytes[1] === 0x50)) return 'png';
  if (/jpe?g/.test(type) || (bytes[0] === 0xff && bytes[1] === 0xd8)) return 'jpeg';
  if (/gif/.test(type) || (bytes[0] === 0x47 && bytes[1] === 0x49)) return 'gif';
  return null;
}

class Writer {
  rels: { id: string; type: string; target: string; external?: boolean }[] = [];
  media: ZipEntry[] = [];
  footnotes: string[] = [];
  /** Numbered lists each get their own numbering, so they start again at 1. */
  numbered = 0;
  private nextRel = 1;
  private nextPic = 1;

  constructor(
    private opts: DocxOptions,
    private contentWidth: number,
  ) {}

  rel(type: string, target: string, external = false): string {
    const id = `rId${this.nextRel++}`;
    this.rels.push({ id, type, target, external });
    return id;
  }

  runs(runs: Run[]): string {
    let out = '';
    for (let i = 0; i < runs.length; ) {
      const link = runs[i].link;
      let j = i + 1;
      while (j < runs.length && runs[j].link === link) j++;
      const inner = runs.slice(i, j).map((r) => this.run(r, !!link && /^(https?|mailto):/.test(link))).join('');
      if (link && /^(https?|mailto):/.test(link)) out += `<w:hyperlink r:id="${this.rel(`${REL}/hyperlink`, esc(link), true)}">${inner}</w:hyperlink>`;
      else out += inner;
      i = j;
    }
    return out;
  }

  private props(marks: Mark[], linked: boolean): string {
    let p = '';
    if (linked) p += '<w:rStyle w:val="Hyperlink"/>';
    if (marks.includes('code')) p += '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>';
    if (marks.includes('bold')) p += '<w:b/>';
    if (marks.includes('italic')) p += '<w:i/>';
    if (marks.includes('strike')) p += '<w:strike/>';
    if (marks.includes('underline')) p += '<w:u w:val="single"/>';
    return p ? `<w:rPr>${p}</w:rPr>` : '';
  }

  private run(r: Run, linked: boolean): string {
    if (r.footnote !== undefined) {
      const id = this.footnotes.length + 1;
      this.footnotes.push(r.footnote);
      return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`;
    }
    const props = this.props(r.marks, linked);
    const body = r.text
      .replaceAll(FOOTNOTE, '')
      .split(/(\n|\t)/)
      .map((part) => (part === '\n' ? '<w:br/>' : part === '\t' ? '<w:tab/>' : part ? `<w:t xml:space="preserve">${esc(part)}</w:t>` : ''))
      .join('');
    return body ? `<w:r>${props}${body}</w:r>` : '';
  }

  paragraph(style: string | null, body: string, extra = ''): string {
    const ppr = (style ? `<w:pStyle w:val="${style}"/>` : '') + extra;
    return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${body}</w:p>`;
  }

  async picture(b: Block): Promise<string | null> {
    const got = b.src ? await this.opts.media?.(b.src) : null;
    if (!got) return null;
    const ext = imageExt(got.type, got.bytes);
    if (!ext) return null;
    const n = this.nextPic++;
    const name = `image${n}.${ext === 'jpeg' ? 'jpg' : ext}`;
    this.media.push({ name: `word/media/${name}`, data: got.bytes });
    const id = this.rel(`${REL}/image`, `media/${name}`);
    const size = imageSize(got.bytes) ?? { width: 600, height: 400 };
    // Never wider than the page's text.
    const scale = Math.min(1, this.contentWidth / size.width);
    const cx = Math.round(size.width * scale * EMU_PER_PX);
    const cy = Math.round(size.height * scale * EMU_PER_PX);
    const alt = esc(b.runs.map((r) => r.text).join('') || 'Picture');
    const drawing =
      `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}" descr="${alt}"/>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    const jc = `<w:jc w:val="${JC[b.align ?? ''] ?? (b.align === 'left' ? 'left' : 'center')}"/>`;
    return this.paragraph(null, drawing, `<w:keepNext/>${jc}`);
  }

  table(b: Block): string {
    const rows = tidyRows(b.rows);
    const cols = rows[0].length;
    const w = Math.floor((this.contentWidth / 96) * TWIPS / cols);
    const grid = `<w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    const tr = rows
      .map((row, r) => {
        const cells = row.map((text) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${this.paragraph('TableText', text ? `<w:r>${r === 0 ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>` : '')}</w:tc>`).join('');
        return `<w:tr>${r === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells}</w:tr>`;
      })
      .join('');
    return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>${grid}${tr}</w:tbl>`;
  }

  async blocks(blocks: Block[], first: string): Promise<string> {
    let out = '';
    let num = 0;
    for (const b of blocks) {
      const lead = out ? '' : first;
      // A numbered list starts again at 1 after anything that isn't a list item.
      if (b.type === 'numbered') {
        if (!num) num = ++this.numbered + 1;
      } else if (!isListType(b.type)) num = 0;
      const jc = b.align && JC[b.align] ? `<w:jc w:val="${JC[b.align]}"/>` : '';
      switch (b.type) {
        case 'image': {
          const pic = await this.picture(b);
          if (pic) {
            out += lead ? pic.replace('<w:pPr>', `<w:pPr>${lead}`) : pic;
            if (b.runs.length) out += this.paragraph('Caption', this.runs(b.runs), '<w:jc w:val="center"/>');
          } else out += this.paragraph('Caption', this.runs(b.runs.length ? b.runs : [{ text: `[Picture: ${b.src ?? ''}]`, marks: [] }]), lead);
          continue;
        }
        case 'file':
          out += this.paragraph(null, this.runs(b.runs.length ? b.runs : [{ text: (b.src ?? '').replace(/^.*\//, '').replace(/^[a-z0-9]{7}-/, ''), marks: [] }]), lead);
          continue;
        case 'table':
          if (lead) out += this.paragraph(null, '', lead);
          out += this.table(b);
          continue;
        case 'heading1':
        case 'heading2':
        case 'heading3':
        case 'heading4':
          out += this.paragraph(`Heading${b.type.slice(-1)}`, this.runs(b.runs), lead + jc);
          continue;
        case 'quote':
          out += this.paragraph(b.style === 'intense' ? 'IntenseQuote' : 'Quote', this.runs(b.runs), lead + jc);
          continue;
        case 'bullet':
        case 'todo':
        case 'numbered': {
          const id = b.type === 'numbered' ? num : 1;
          const box = b.type === 'todo' ? [{ text: b.checked ? '☒ ' : '☐ ', marks: [] as Mark[] }] : [];
          const numPr = b.type === 'todo' ? `<w:ind w:left="${360 + (b.indent ?? 0) * 360}"/>` : `<w:numPr><w:ilvl w:val="${Math.min(8, b.indent ?? 0)}"/><w:numId w:val="${id}"/></w:numPr>`;
          out += this.paragraph('ListParagraph', this.runs([...box, ...b.runs]), lead + numPr + jc);
          continue;
        }
        default:
          if (b.style === 'scenebreak' && !b.runs.length) {
            out += this.paragraph('SceneBreak', '<w:r><w:t>*   *   *</w:t></w:r>', lead);
            continue;
          }
          out += this.paragraph(PARA_STYLES[b.style ?? ''] ?? null, this.runs(b.runs), lead + jc);
      }
    }
    return out || this.paragraph(null, '', first);
  }

  band(band: HFBand, style: 'Header' | 'Footer', line: boolean): string {
    const slot = (runs: HFRun[]) =>
      runs
        .map((r) => {
          const props = (r.b ? '<w:b/>' : '') + (r.i ? '<w:i/>' : '') + (r.u ? '<w:u w:val="single"/>' : '');
          const rpr = props ? `<w:rPr>${props}</w:rPr>` : '';
          if (r.field === 'page') return `<w:fldSimple w:instr=" PAGE ${numberSwitch(this.opts.hf)}"><w:r>${rpr}<w:t>1</w:t></w:r></w:fldSimple>`;
          if (r.field === 'pages') return `<w:fldSimple w:instr=" NUMPAGES "><w:r>${rpr}<w:t>1</w:t></w:r></w:fldSimple>`;
          const text = r.field ? (this.opts.field?.(r) ?? '') : (r.text ?? '');
          return text ? `<w:r>${rpr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>` : '';
        })
        .join('');
    const tab = '<w:r><w:tab/></w:r>';
    const body = slot(band.left) + tab + slot(band.center) + tab + slot(band.right);
    const border = line ? `<w:pBdr><w:${style === 'Header' ? 'bottom' : 'top'} w:val="single" w:sz="4" w:space="4" w:color="auto"/></w:pBdr>` : '';
    return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${border}</w:pPr>${body}</w:p>`;
  }
}

function isListType(t: BlockType): boolean {
  return t === 'bullet' || t === 'numbered' || t === 'todo';
}

function numberSwitch(hf: HeadersFooters | undefined): string {
  return { '1': '', i: '\\* roman ', I: '\\* ROMAN ', a: '\\* alphabetic ', A: '\\* ALPHABETIC ' }[hf?.numberFormat ?? '1'];
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = `xmlns:w="${W_NS}" xmlns:r="${R_NS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"`;

function stylesXml(font: string, size: number): string {
  const hp = Math.round(size * 2);
  const para = (id: string, name: string, ppr: string, rpr: string, extra = '') =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>${extra}<w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
  const heading = (n: number, scale: number) => para(`Heading${n}`, `heading ${n}`, `<w:keepNext/><w:keepLines/><w:spacing w:before="${360 - n * 40}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/>`, `<w:b/><w:sz w:val="${Math.round(hp * scale)}"/><w:szCs w:val="${Math.round(hp * scale)}"/>`);
  return (
    XML +
    `<w:styles ${NS}>` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${esc(font)}" w:hAnsi="${esc(font)}" w:eastAsia="${esc(font)}" w:cs="${esc(font)}"/><w:sz w:val="${hp}"/><w:szCs w:val="${hp}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    `<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>` +
    para('Title', 'Title', '<w:spacing w:after="240"/><w:jc w:val="center"/>', `<w:sz w:val="${hp * 2}"/><w:szCs w:val="${hp * 2}"/>`) +
    para('Subtitle', 'Subtitle', '<w:spacing w:after="240"/><w:jc w:val="center"/>', `<w:i/><w:sz w:val="${Math.round(hp * 1.3)}"/>`) +
    heading(1, 1.6) +
    heading(2, 1.35) +
    heading(3, 1.15) +
    heading(4, 1) +
    para('Quote', 'Quote', '<w:ind w:left="720" w:right="720"/>', '<w:i/>') +
    para('IntenseQuote', 'Intense Quote', '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="808080"/></w:pBdr><w:ind w:left="720" w:right="720"/>', '<w:i/><w:b/>') +
    para('NoSpacing', 'No Spacing', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', '') +
    para('Epigraph', 'Epigraph', '<w:ind w:left="2160"/>', '<w:i/>') +
    para('Caption', 'caption', '<w:spacing w:after="200"/>', `<w:i/><w:sz w:val="${Math.round(hp * 0.85)}"/>`) +
    para('SceneBreak', 'Scene Break', '<w:spacing w:before="240" w:after="240"/><w:jc w:val="center"/>', '') +
    para('ListParagraph', 'List Paragraph', '<w:spacing w:after="60"/><w:contextualSpacing/>', '') +
    para('TableText', 'Table Text', '<w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/>', '') +
    para('Header', 'header', '<w:spacing w:after="0"/>', `<w:sz w:val="${Math.round(hp * 0.85)}"/>`) +
    para('Footer', 'footer', '<w:spacing w:after="0"/>', `<w:sz w:val="${Math.round(hp * 0.85)}"/>`) +
    para('FootnoteText', 'footnote text', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', `<w:sz w:val="${Math.round(hp * 0.8)}"/>`) +
    `<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>` +
    `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>` +
    `<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="auto"/><w:left w:val="single" w:sz="4" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:color="auto"/><w:right w:val="single" w:sz="4" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:color="auto"/></w:tblBorders><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>` +
    `</w:styles>`
  );
}

function numberingXml(lists: number): string {
  const levels = (bullet: boolean) =>
    Array.from({ length: 9 }, (_, l) => {
      const fmt = bullet ? 'bullet' : ['decimal', 'lowerLetter', 'lowerRoman'][l % 3];
      const text = bullet ? ['•', '◦', '▪'][l % 3] : `%${l + 1}.`;
      return `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + l * 360}" w:hanging="360"/></w:pPr></w:lvl>`;
    }).join('');
  let nums = '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>';
  for (let i = 2; i <= lists + 1; i++) nums += `<w:num w:numId="${i}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`;
  return XML + `<w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${levels(true)}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${levels(false)}</w:abstractNum>${nums}</w:numbering>`;
}

function footnotesXml(notes: string[]): string {
  const sep = '<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>';
  const body = notes
    .map((text, i) => `<w:footnote w:id="${i + 1}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> ${esc(text)}</w:t></w:r></w:p></w:footnote>`)
    .join('');
  return XML + `<w:footnotes ${NS}>${sep}${body}</w:footnotes>`;
}

/** A Word document holding `parts` (a note is one part; a manuscript has a part per chapter). */
export async function toDocx(parts: DocxPart[], opts: DocxOptions): Promise<Uint8Array> {
  const page = opts.page;
  const size = PAGE_SIZES.find((s) => s.id === page?.size) ?? PAGE_SIZES[0];
  const m = page?.margins ?? { top: 1, right: 1, bottom: 1, left: 1 };
  const contentIn = size.width - m.left - m.right;
  const w = new Writer(opts, contentIn * 96);
  let body = opts.titleParagraph ? w.paragraph('Title', `<w:r><w:t xml:space="preserve">${esc(opts.titleParagraph)}</w:t></w:r>`) : '';
  for (const [i, part] of parts.entries()) {
    const breakBefore = i > 0 ? '<w:pageBreakBefore/>' : '';
    if (part.heading !== undefined) body += w.paragraph('Heading1', part.heading ? `<w:r><w:t xml:space="preserve">${esc(part.heading)}</w:t></w:r>` : '', breakBefore);
    body += await w.blocks(part.doc.blocks, part.heading === undefined ? breakBefore : '');
  }

  // Headers and footers.
  const files: ZipEntry[] = [];
  let refs = '';
  const hf = opts.hf;
  if (hf) {
    const tabs = `<w:tabs><w:tab w:val="center" w:pos="${Math.round((contentIn * TWIPS) / 2)}"/><w:tab w:val="right" w:pos="${Math.round(contentIn * TWIPS)}"/></w:tabs>`;
    let n = 0;
    const add = (kind: 'header' | 'footer', type: string, set: HFSet | undefined) => {
      const band = set?.[kind];
      n++;
      const name = `${kind}${n}.xml`;
      const para = band && !bandEmpty(band) ? w.band(band, kind === 'header' ? 'Header' : 'Footer', kind === 'header' ? hf.headerLine : hf.footerLine).replace(/(<w:pStyle w:val="\w+"\/>)/, `$1${tabs}`) : '<w:p/>';
      files.push({ name: `word/${name}`, data: utf8(`${XML}<w:${kind === 'header' ? 'hdr' : 'ftr'} ${NS}>${para}</w:${kind === 'header' ? 'hdr' : 'ftr'}>`) });
      refs += `<w:${kind}Reference w:type="${type}" r:id="${w.rel(`${REL}/${kind}`, name)}"/>`;
    };
    const variants: [string, HFSet | undefined][] = [['default', hf.sets.main]];
    if (hf.differentOddEven) variants.push(['even', hf.sets.even ?? hf.sets.main]);
    if (hf.differentFirst) variants.push(['first', hf.sets.first]);
    for (const [type, set] of variants) {
      add('header', type, set);
      add('footer', type, set);
    }
    if (hf.differentFirst) refs += '<w:titlePg/>';
  }
  const pgNum = hf ? `<w:pgNumType${hf.numberFormat !== '1' ? ` w:fmt="${{ i: 'lowerRoman', I: 'upperRoman', a: 'lowerLetter', A: 'upperLetter' }[hf.numberFormat]}"` : ''}${hf.startAt !== 1 ? ` w:start="${hf.startAt}"` : ''}/>` : '';
  const tw = (inches: number) => Math.round(inches * TWIPS);
  const titlePg = refs.includes('<w:titlePg/>');
  const sect = `<w:sectPr>${refs.replace('<w:titlePg/>', '')}<w:footnotePr><w:numFmt w:val="decimal"/></w:footnotePr><w:pgSz w:w="${tw(size.width)}" w:h="${tw(size.height)}"/><w:pgMar w:top="${tw(m.top)}" w:right="${tw(m.right)}" w:bottom="${tw(m.bottom)}" w:left="${tw(m.left)}" w:header="${tw(hf?.headerFrom ?? 0.5)}" w:footer="${tw(hf?.footerFrom ?? 0.5)}" w:gutter="0"/>${pgNum}${titlePg ? '<w:titlePg/>' : ''}</w:sectPr>`;
  const documentXml = `${XML}<w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;

  w.rel(`${REL}/styles`, 'styles.xml');
  w.rel(`${REL}/numbering`, 'numbering.xml');
  w.rel(`${REL}/footnotes`, 'footnotes.xml');
  w.rel(`${REL}/settings`, 'settings.xml');
  const docRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${w.rels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"${r.external ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
  const settings = `${XML}<w:settings ${NS}>${hf?.differentOddEven ? '<w:evenAndOddHeaders/>' : ''}<w:defaultTabStop w:val="720"/><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(opts.title)}</dc:title><dc:creator>${esc(opts.author ?? '')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const types =
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>' +
    '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
    files.map((f) => `<Override PartName="/${f.name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${f.name.includes('header') ? 'header' : 'footer'}+xml"/>`).join('') +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  const rootRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

  return writeZip([
    { name: '[Content_Types].xml', data: utf8(types) },
    { name: '_rels/.rels', data: utf8(rootRels) },
    { name: 'docProps/core.xml', data: utf8(core) },
    { name: 'word/document.xml', data: utf8(documentXml) },
    { name: 'word/_rels/document.xml.rels', data: utf8(docRels) },
    { name: 'word/styles.xml', data: utf8(stylesXml(opts.font || 'Georgia', opts.size || 12)) },
    { name: 'word/numbering.xml', data: utf8(numberingXml(w.numbered)) },
    { name: 'word/footnotes.xml', data: utf8(footnotesXml(w.footnotes)) },
    { name: 'word/settings.xml', data: utf8(settings) },
    ...files,
    ...w.media,
  ]);
}

// ------------------------------------------------------------------ reading

export interface DocxImport {
  title: string;
  doc: Doc;
}

export interface ReadOptions {
  /** Keeps a picture from the document; returns its src. */
  saveMedia?(name: string, bytes: Uint8Array, type: string): Promise<string | null>;
}

const kids = (el: Element) => Array.from(el.children);
const attr = (el: Element | undefined | null, name: string) => el?.getAttributeNS(W_NS, name) ?? el?.getAttribute(`w:${name}`) ?? null;
const child = (el: Element | undefined | null, name: string) => (el ? kids(el).find((c) => c.localName === name) : undefined);
/** A w:b-style switch: on unless its value says off. */
const on = (el: Element | undefined) => !!el && !/^(0|false|off|none)$/.test(attr(el, 'val') ?? '');

function parseXml(bytes: Uint8Array | undefined): Document | null {
  if (!bytes) return null;
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
  return xml.getElementsByTagName('parsererror').length ? null : xml;
}

function relsOf(files: Map<string, Uint8Array>, path: string): Map<string, string> {
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  const file = `${dir}_rels/${path.slice(dir.length)}.rels`;
  const out = new Map<string, string>();
  const xml = parseXml(files.get(file));
  for (const r of Array.from(xml?.getElementsByTagName('Relationship') ?? [])) {
    const target = r.getAttribute('Target') ?? '';
    const external = r.getAttribute('TargetMode') === 'External';
    out.set(r.getAttribute('Id') ?? '', external ? target : (target.startsWith('/') ? target.slice(1) : normalizePath(dir + target)));
  }
  return out;
}

function normalizePath(p: string): string {
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

function textOf(el: Element): string {
  let s = '';
  for (const n of Array.from(el.getElementsByTagNameNS(W_NS, '*'))) {
    if (n.localName === 't') s += n.textContent ?? '';
    else if (n.localName === 'tab') s += ' ';
    else if (n.localName === 'p' && s) s += ' ';
  }
  return s.replace(/\s+/g, ' ').trim();
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml', tif: 'image/tiff', tiff: 'image/tiff' };

/** Reads a Word document into a note. Throws if it isn't one. */
export async function fromDocx(bytes: Uint8Array, opts: ReadOptions = {}): Promise<DocxImport> {
  const files = await readZip(bytes);
  const rootRels = parseXml(files.get('_rels/.rels'));
  const main = Array.from(rootRels?.getElementsByTagName('Relationship') ?? []).find((r) => /officeDocument$/.test(r.getAttribute('Type') ?? ''))?.getAttribute('Target')?.replace(/^\//, '') ?? 'word/document.xml';
  const xml = parseXml(files.get(main));
  if (!xml) throw new Error('This isn’t a Word document');
  const rels = relsOf(files, main);

  // Style ids → names (ids are translated in other languages; names aren't), and heading levels.
  const styleName = new Map<string, string>();
  const styleLevel = new Map<string, number>();
  const stylesPath = [...rels.values()].find((p) => /styles\.xml$/.test(p)) ?? 'word/styles.xml';
  for (const s of Array.from(parseXml(files.get(stylesPath))?.getElementsByTagNameNS(W_NS, 'style') ?? [])) {
    const id = attr(s, 'styleId') ?? '';
    styleName.set(id, (attr(child(s, 'name'), 'val') ?? id).toLowerCase());
    const lvl = attr(child(child(s, 'pPr'), 'outlineLvl'), 'val');
    if (lvl !== null) styleLevel.set(id, Number(lvl) + 1);
  }

  // Lists: which numbering is bullets.
  const numFmt = new Map<string, string[]>();
  const numberingPath = [...rels.values()].find((p) => /numbering\.xml$/.test(p)) ?? 'word/numbering.xml';
  const numbering = parseXml(files.get(numberingPath));
  if (numbering) {
    const abstract = new Map<string, string[]>();
    for (const a of Array.from(numbering.getElementsByTagNameNS(W_NS, 'abstractNum'))) {
      abstract.set(attr(a, 'abstractNumId') ?? '', kids(a).filter((c) => c.localName === 'lvl').map((l) => attr(child(l, 'numFmt'), 'val') ?? 'decimal'));
    }
    for (const n of Array.from(numbering.getElementsByTagNameNS(W_NS, 'num'))) numFmt.set(attr(n, 'numId') ?? '', abstract.get(attr(child(n, 'abstractNumId'), 'val') ?? '') ?? []);
  }

  // Footnotes' text.
  const notes = new Map<string, string>();
  const notesPath = [...rels.values()].find((p) => /footnotes\.xml$/.test(p));
  for (const f of Array.from(parseXml(notesPath ? files.get(notesPath) : undefined)?.getElementsByTagNameNS(W_NS, 'footnote') ?? [])) notes.set(attr(f, 'id') ?? '', textOf(f));

  const blocks: Block[] = [];
  let title = '';
  const core = parseXml(files.get('docProps/core.xml'));
  const coreTitle = core?.getElementsByTagName('dc:title')[0]?.textContent?.trim() ?? '';

  const readRuns = async (p: Element, out: Run[], pics: Block[], marks: Mark[] = [], link?: string) => {
    for (const el of kids(p)) {
      switch (el.localName) {
        case 'r': {
          const rpr = child(el, 'rPr');
          const m: Mark[] = [...marks];
          if (on(child(rpr, 'b'))) m.push('bold');
          if (on(child(rpr, 'i'))) m.push('italic');
          if (on(child(rpr, 'strike')) || on(child(rpr, 'dstrike'))) m.push('strike');
          const u = child(rpr, 'u');
          if (u && attr(u, 'val') !== 'none' && !(link && attr(child(rpr, 'rStyle'), 'val') === 'Hyperlink')) m.push('underline');
          if (/courier|consolas|menlo|monaco|mono/i.test(attr(child(rpr, 'rFonts'), 'ascii') ?? '')) m.push('code');
          const marksHere = sortMarks([...new Set(m)]);
          const push = (text: string) => out.push(link ? { text, marks: marksHere, link } : { text, marks: marksHere });
          for (const c of kids(el)) {
            if (c.localName === 't') push(c.textContent ?? '');
            else if (c.localName === 'tab') push('\t');
            else if (c.localName === 'br' || c.localName === 'cr') {
              if (attr(c, 'type') !== 'page' && attr(c, 'type') !== 'column') push('\n');
            } else if (c.localName === 'noBreakHyphen') push('‑');
            else if (c.localName === 'sym') push(String.fromCharCode(parseInt(attr(c, 'char') ?? '20', 16) & 0xff || 32));
            else if (c.localName === 'footnoteReference' || c.localName === 'endnoteReference') {
              const text = c.localName === 'footnoteReference' ? notes.get(attr(c, 'id') ?? '') : undefined;
              out.push({ text: FOOTNOTE, marks: [], footnote: text ?? '' });
            } else if (c.localName === 'drawing' || c.localName === 'pict') {
              const blip = Array.from(c.getElementsByTagName('*')).find((x) => x.localName === 'blip' || x.localName === 'imagedata');
              const id = blip?.getAttributeNS(R_NS, 'embed') ?? blip?.getAttributeNS(R_NS, 'id') ?? blip?.getAttribute('r:embed') ?? blip?.getAttribute('r:id');
              const path = id ? rels.get(id) : undefined;
              const data = path ? files.get(path) : undefined;
              if (data && path && opts.saveMedia) {
                const ext = (path.split('.').pop() ?? '').toLowerCase();
                const descr = Array.from(c.getElementsByTagName('*')).find((x) => x.localName === 'docPr')?.getAttribute('descr') ?? '';
                const src = await opts.saveMedia(path.replace(/^.*\//, ''), data, MIME[ext] ?? 'application/octet-stream');
                if (src) pics.push(makeBlock('image', descr.trim(), [], { src }));
              }
            }
          }
          break;
        }
        case 'hyperlink': {
          const id = el.getAttributeNS(R_NS, 'id') ?? el.getAttribute('r:id');
          const target = id ? rels.get(id) : undefined;
          await readRuns(el, out, pics, marks, target && /^(https?|mailto):/i.test(target) ? target : link);
          break;
        }
        case 'ins':
        case 'smartTag':
        case 'customXml':
        case 'fldSimple':
        case 'sdtContent':
          await readRuns(el, out, pics, marks, link);
          break;
        case 'sdt':
          await readRuns(child(el, 'sdtContent') ?? el, out, pics, marks, link);
          break;
        default:
        // Deleted text, comments, bookmarks, properties: not text.
      }
    }
  };

  const paragraph = async (p: Element) => {
    const ppr = child(p, 'pPr');
    const styleId = attr(child(ppr, 'pStyle'), 'val') ?? '';
    const name = styleName.get(styleId) ?? styleId.toLowerCase();
    const runs: Run[] = [];
    const pics: Block[] = [];
    await readRuns(p, runs, pics);
    const clean = normalizeRuns(runs);
    blocks.push(...pics);
    if (pics.length && !clean.some((r) => r.text.trim())) return;
    const jc = attr(child(ppr, 'jc'), 'val');
    const align = jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : jc === 'both' || jc === 'distribute' ? 'justify' : undefined;
    const num = child(ppr, 'numPr');
    const numId = attr(child(num, 'numId'), 'val');
    const level = Number(attr(child(num, 'ilvl'), 'val') ?? 0);
    const outline = attr(child(ppr, 'outlineLvl'), 'val');
    const heading = /^heading (\d)$/.exec(name)?.[1] ?? styleLevel.get(styleId) ?? (outline !== null && Number(outline) < 9 ? Number(outline) + 1 : undefined);
    let b: Block;
    if (name === 'title') {
      if (!title && !blocks.length) {
        title = clean.map((r) => r.text).join('').trim();
        return;
      }
      b = makeBlock('paragraph', '', [], { style: 'title' });
    } else if (name === 'subtitle') b = makeBlock('paragraph', '', [], { style: 'subtitle' });
    else if (heading) b = makeBlock(`heading${Math.min(4, Number(heading))}` as BlockType);
    else if (numId && numId !== '0') {
      const fmt = numFmt.get(numId)?.[level] ?? 'decimal';
      b = makeBlock(fmt === 'bullet' ? 'bullet' : 'numbered', '', [], { indent: Math.min(6, level) });
    } else if (name === 'quote' || name === 'intense quote') b = makeBlock('quote', '', [], name === 'intense quote' ? { style: 'intense' } : {});
    else if (name === 'no spacing') b = makeBlock('paragraph', '', [], { style: 'nospacing' });
    else if (name === 'caption') b = makeBlock('paragraph', '', [], { style: 'caption' });
    else b = makeBlock('paragraph');
    // Checklist items written as ☐ / ☒.
    const first = clean[0]?.text ?? '';
    if (/^[☐☑☒] ?/.test(first) && (b.type === 'paragraph' || b.type === 'bullet')) {
      b = makeBlock('todo', '', [], { checked: first[0] !== '☐', indent: b.indent });
      clean[0] = { ...clean[0], text: first.replace(/^[☐☑☒] ?/, '') };
    }
    const text = clean.map((r) => r.text).join('');
    if (b.type === 'paragraph' && !b.style && /^\s*(\*\s*){3}$|^\s*#\s*$/.test(text)) {
      blocks.push(makeBlock('paragraph', '', [], { style: 'scenebreak' }));
      return;
    }
    if (align && !b.align) b.align = align;
    b.runs = normalizeRuns(clean);
    blocks.push(b);
  };

  const table = (t: Element) => {
    const rows: string[][] = [];
    for (const tr of kids(t).filter((c) => c.localName === 'tr')) rows.push(kids(tr).filter((c) => c.localName === 'tc').map((tc) => textOf(tc)));
    if (rows.length) blocks.push(makeBlock('table', '', [], { rows: tidyRows(rows) }));
  };

  const body = xml.getElementsByTagNameNS(W_NS, 'body')[0];
  const walk = async (el: Element) => {
    for (const c of kids(el)) {
      if (c.localName === 'p') await paragraph(c);
      else if (c.localName === 'tbl') table(c);
      else if (c.localName === 'sdt') await walk(child(c, 'sdtContent') ?? c);
      else if (c.localName === 'customXml' || c.localName === 'ins') await walk(c);
    }
  };
  if (body) await walk(body);
  // Trailing empty paragraphs aren't wanted.
  while (blocks.length > 1 && blocks[blocks.length - 1].type === 'paragraph' && !blocks[blocks.length - 1].runs.length && !blocks[blocks.length - 1].style) blocks.pop();
  return { title: title || coreTitle, doc: { blocks: blocks.length ? blocks : [makeBlock('paragraph')] } };
}
