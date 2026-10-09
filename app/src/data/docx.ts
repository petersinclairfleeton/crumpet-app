// Word documents (.docx): writing a note or a manuscript as one, and reading
// one into a note. A .docx is a zip of XML files; we write the parts Word
// needs (styles, lists, footnotes, pictures, headers and footers) and read
// back what Crumpet can show.

import { type Block, type BlockType, type Change, type Comment, type CommentReply, type Doc, type Look, type Mark, type ParaLook, type Run, type BulletKind, type NumFormat, BULLETS, FOOTNOTE, tidyLook, tidyPara, commentId, makeBlock, normalizeRuns, sortMarks, tidyRows } from '@crumpet/editor/model';
import { TABLE_STYLES, type TableLook, type TableStyleKey, mergeAt, tableStyleColors, tidyTable } from '@crumpet/editor/table';
import { cellRuns, cellText } from '@crumpet/editor/cells';
import { type ShapeKind, tidyShape } from '@crumpet/editor/shape';
import { type HFBand, type HFRun, type HFSet, type HeadersFooters, bandEmpty } from './headers';
import { type PageSetup, paperInches } from './styles';
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
/** Word's highlighter colours (w:highlight); any other colour is written as shading. */
const HIGHLIGHTS: [string, string][] = [
  ['yellow', '#ffff00'],
  ['green', '#00ff00'],
  ['cyan', '#00ffff'],
  ['magenta', '#ff00ff'],
  ['blue', '#0000ff'],
  ['red', '#ff0000'],
  ['darkBlue', '#000080'],
  ['darkCyan', '#008080'],
  ['darkGreen', '#008000'],
  ['darkMagenta', '#800080'],
  ['darkRed', '#800000'],
  ['darkYellow', '#808000'],
  ['darkGray', '#808080'],
  ['lightGray', '#c0c0c0'],
  ['black', '#000000'],
  ['white', '#ffffff'],
];
const HIGHLIGHT_NAME: Record<string, string> = Object.fromEntries(HIGHLIGHTS.map(([n, h]) => [h, n]));
const HIGHLIGHT_HEX: Record<string, string> = Object.fromEntries(HIGHLIGHTS);
const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';
const W15_NS = 'http://schemas.microsoft.com/office/word/2012/wordml';
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
  /** Comments in the order they start (each with its id, and its replies' ids), and how many commented runs each has still to come. */
  comments: { comment: Comment; id: number; replies: number[] }[] = [];
  private nextComment = 0;
  private commentNum = new Map<string, { id: number; replies: number[] }>();
  private commentLeft = new Map<string, number>();
  /** The section being written: its columns, orientation (undefined: the page setup's) and how it starts. */
  section: SectionProps = { cols: 1, type: 'page' };
  /** Sections ended so far. */
  sections = 0;
  /** A section ends with the next paragraph: its settings go in that paragraph. */
  private sectNext: string | null = null;
  /** The headings a table of contents lists (written in ahead of Word filling in the page numbers). */
  tocEntries: { level: number; text: string }[] = [];
  /** Each list gets its own numbering (numId = index + 1), with its levels' number or bullet styles. */
  lists: ListDef[] = [];
  private nextRel = 1;
  private nextPic = 1;

  constructor(
    private opts: DocxOptions,
    private contentWidth: number,
  ) {}

  countComments(parts: DocxPart[]): void {
    for (const p of parts) for (const b of p.doc.blocks) for (const r of b.runs) if (r.comment) this.commentLeft.set(r.comment.id, (this.commentLeft.get(r.comment.id) ?? 0) + 1);
  }

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

  /** A run's properties, in the order Word expects them. */
  private props(marks: Mark[], linked: boolean, look?: Look): string {
    let p = '';
    if (linked) p += '<w:rStyle w:val="Hyperlink"/>';
    const font = marks.includes('code') ? 'Courier New' : look?.font;
    if (font) p += `<w:rFonts w:ascii="${esc(font)}" w:hAnsi="${esc(font)}" w:eastAsia="${esc(font)}" w:cs="${esc(font)}"/>`;
    if (marks.includes('bold')) p += '<w:b/>';
    if (marks.includes('italic')) p += '<w:i/>';
    if (marks.includes('strike')) p += '<w:strike/>';
    if (look?.color) p += `<w:color w:val="${look.color.slice(1).toUpperCase()}"/>`;
    if (look?.size) p += `<w:sz w:val="${Math.round(look.size * 2)}"/><w:szCs w:val="${Math.round(look.size * 2)}"/>`;
    const named = look?.highlight ? HIGHLIGHT_NAME[look.highlight.toLowerCase()] : undefined;
    if (named) p += `<w:highlight w:val="${named}"/>`;
    if (marks.includes('underline')) p += '<w:u w:val="single"/>';
    if (look?.highlight && !named) p += `<w:shd w:val="clear" w:color="auto" w:fill="${look.highlight.slice(1).toUpperCase()}"/>`;
    if (look?.va) p += `<w:vertAlign w:val="${look.va === 'super' ? 'superscript' : 'subscript'}"/>`;
    return p ? `<w:rPr>${p}</w:rPr>` : '';
  }

  /** A run, with the start and end of any comment on it marked around it. */
  private run(r: Run, linked: boolean): string {
    const c = r.comment;
    if (!c) return this.plainRun(r, linked);
    let out = '';
    // Word keeps each reply as a comment of its own on the same text, linked to the first (see commentsExtendedXml).
    let entry = this.commentNum.get(c.id);
    if (!entry) {
      const id = this.nextComment++;
      const replies = (c.replies ?? []).map(() => this.nextComment++);
      entry = { id, replies };
      this.commentNum.set(c.id, entry);
      this.comments.push({ comment: c, ...entry });
      for (const n of [id, ...replies]) out += `<w:commentRangeStart w:id="${n}"/>`;
    }
    out += this.plainRun(r, linked);
    const left = (this.commentLeft.get(c.id) ?? 1) - 1;
    this.commentLeft.set(c.id, left);
    if (left <= 0) for (const n of [entry.id, ...entry.replies]) out += `<w:commentRangeEnd w:id="${n}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${n}"/></w:r>`;
    return out;
  }

  private plainRun(r: Run, linked: boolean): string {
    const xml = this.basicRun(r, linked);
    const c = r.change;
    if (!c || !xml) return xml;
    const attrs = `w:id="${this.nextChange++}" w:author="${esc(c.author || 'Someone')}"${c.at ? ` w:date="${new Date(c.at).toISOString().replace(/\.\d+Z$/, 'Z')}"` : ''}`;
    return c.kind === 'ins' ? `<w:ins ${attrs}>${xml}</w:ins>` : `<w:del ${attrs}>${xml.replace(/<w:t( |>)/g, '<w:delText$1').replace(/<\/w:t>/g, '</w:delText>')}</w:del>`;
  }

  private nextChange = 1000;

  private basicRun(r: Run, linked: boolean): string {
    if (r.footnote !== undefined) {
      const id = this.footnotes.length + 1;
      this.footnotes.push(r.footnote);
      return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`;
    }
    const props = this.props(r.marks, linked, r.look);
    const body = r.text
      .replaceAll(FOOTNOTE, '')
      .split(/(\n|\t)/)
      .map((part) => (part === '\n' ? '<w:br/>' : part === '\t' ? '<w:tab/>' : part ? `<w:t xml:space="preserve">${esc(part)}</w:t>` : ''))
      .join('');
    return body ? `<w:r>${props}${body}</w:r>` : '';
  }

  /** A tracked change on the next paragraph break: Word keeps it on this paragraph's mark. */
  markNext: Change | null = null;

  paragraph(style: string | null, body: string, extra = ''): string {
    let mark = '';
    if (this.markNext) {
      const c = this.markNext;
      this.markNext = null;
      mark = `<w:rPr><w:${c.kind} w:id="${this.nextChange++}" w:author="${esc(c.author || 'Someone')}"${c.at ? ` w:date="${new Date(c.at).toISOString().replace(/\.\d+Z$/, 'Z')}"` : ''}/></w:rPr>`;
    }
    const sect = this.sectNext ?? '';
    this.sectNext = null;
    const ppr = (style ? `<w:pStyle w:val="${style}"/>` : '') + extra + mark + sect;
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

  private nextShape = 1;

  /**
   * A text box or shape, as Word draws one (a DrawingML shape): in line
   * with the text, or anchored to its paragraph with the text wrapping
   * round it on the left or right.
   */
  shape(b: Block, lead: string): string {
    const s = b.shape;
    if (!s) return '';
    const EMU = 914400;
    const cx = Math.round(s.w * EMU);
    const cy = Math.round(s.h * EMU);
    const n = 1000 + this.nextShape++;
    const flat = s.kind === 'line' || s.kind === 'arrow';
    const prst = { rect: 'rect', rounded: 'roundRect', ellipse: 'ellipse', line: 'line', arrow: 'line' }[s.kind];
    const hex = (c: string) => c.slice(1).toUpperCase();
    const fill = !flat && s.fill ? `<a:solidFill><a:srgbClr val="${hex(s.fill)}"/></a:solidFill>` : '<a:noFill/>';
    const line = s.line || flat ? `<a:ln w="19050"><a:solidFill><a:srgbClr val="${hex(s.line ?? '#333333')}"/></a:solidFill>${s.kind === 'arrow' ? '<a:tailEnd type="triangle"/>' : ''}</a:ln>` : '<a:ln><a:noFill/></a:ln>';
    const text = !flat && s.text ? `<wps:txbx><w:txbxContent>${this.paragraph(null, this.runs(cellRuns(s.text)), '<w:jc w:val="center"/>')}</w:txbxContent></wps:txbx>` : '';
    const wsp = `<wps:wsp><wps:cNvSpPr${s.text ? ' txBox="1"' : ''}/><wps:spPr><a:xfrm${flat ? '' : ''}><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${flat ? 0 : cy}"/></a:xfrm><a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fill}${line}</wps:spPr>${text}<wps:bodyPr rot="0" vert="horz" wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="ctr"><a:noAutofit/></wps:bodyPr></wps:wsp>`;
    const graphic = `<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">${wsp}</a:graphicData></a:graphic>`;
    const name = `<wp:docPr id="${n}" name="${s.text ? 'Text Box' : 'Shape'} ${n}"/><wp:cNvGraphicFramePr/>`;
    const drawing =
      s.wrap === 'inline'
        ? `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>${name}${graphic}</wp:inline>`
        : `<wp:anchor distT="45720" distB="45720" distL="114300" distR="114300" simplePos="0" relativeHeight="${251659264 + n}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:align>${s.wrap}</wp:align></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapSquare wrapText="bothSides"/>${name}${graphic}</wp:anchor>`;
    const jc = b.align && b.align !== 'left' && s.wrap === 'inline' ? `<w:jc w:val="${JC[b.align] ?? b.align}"/>` : '';
    return this.paragraph(null, `<w:r><w:drawing>${drawing}</w:drawing></w:r>`, lead + jc);
  }

  /** Word's own Table of Contents field: Word fills in the page numbers when it updates the field (it asks on opening). */
  toc(): string {
    const tab = `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${Math.round((this.contentWidth / 96) * TWIPS)}"/></w:tabs>`;
    const field = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>';
    const end = '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
    const entries = this.tocEntries.length ? this.tocEntries : [{ level: 1, text: '' }];
    const lines = entries.map((e, i) => this.paragraph(`TOC${e.level}`, (i === 0 ? field : '') + (e.text ? `<w:r><w:t xml:space="preserve">${esc(e.text)}</w:t></w:r>` : '') + (i === entries.length - 1 ? end : ''), tab)).join('');
    return `<w:sdt><w:sdtPr><w:docPartObj><w:docPartGallery w:val="Table of Contents"/><w:docPartUnique/></w:docPartObj></w:sdtPr><w:sdtContent>${this.paragraph('TOCHeading', '<w:r><w:t>Contents</w:t></w:r>')}${lines}</w:sdtContent></w:sdt>`;
  }

  table(b: Block): string {
    const rows = tidyRows(b.rows);
    const cols = rows[0].length;
    const t = b.tbl;
    const head = !t?.noHeader;
    const full = (this.contentWidth / 96) * TWIPS;
    // Each column's width: as dragged, or shared out evenly.
    const ws = Array.from({ length: cols }, (_, c) => Math.floor(t?.widths ? (full * t.widths[c]) / 100 : full / cols));
    const grid = `<w:tblGrid>${ws.map((x) => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>`;
    const spanW = (c: number, n: number) => ws.slice(c, c + n).reduce((a, b) => a + b, 0);
    const tr = rows
      .map((row, r) => {
        const cells = row
          .map((text, c) => {
            const m = mergeAt(t, r, c);
            // Inside a merged cell: nothing, or (in a row below its top) a cell carrying the merge down.
            if (m && c !== m[1]) return '';
            const span = m && m[3] > 1 ? `<w:gridSpan w:val="${m[3]}"/>` : '';
            const width = `<w:tcW w:w="${spanW(c, m?.[3] ?? 1)}" w:type="dxa"/>`;
            if (m && r !== m[0]) return `<w:tc><w:tcPr>${width}${span}<w:vMerge/></w:tcPr><w:p/></w:tc>`;
            const vMerge = m && m[2] > 1 ? '<w:vMerge w:val="restart"/>' : '';
            const shade = t?.shades?.[`${r},${c}`];
            const shd = shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade.slice(1).toUpperCase()}"/>` : '';
            const align = t?.aligns?.[c];
            const jc = align ? `<w:jc w:val="${align}"/>` : '';
            // The heading row is bold; a cell's own formatting is kept.
            const cell = cellRuns(text).map((x) => (r === 0 && head ? { ...x, marks: sortMarks([...new Set<Mark>([...x.marks, 'bold'])]) } : x));
            return `<w:tc><w:tcPr>${width}${span}${vMerge}${shd}</w:tcPr>${this.paragraph('TableText', this.runs(cell), jc)}</w:tc>`;
          })
          .join('');
        return `<w:tr>${r === 0 && head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells}</w:tr>`;
      })
      .join('');
    const lineColor = t?.style ? tableStyleColors(t.style).line.slice(1).toUpperCase() : 'auto';
    const line = (side: string, on: boolean) => `<w:${side} w:val="${on ? 'single' : 'none'}" w:sz="4" w:space="0" w:color="${lineColor}"/>`;
    // Lines other than Table Grid's every line: which of top, left, bottom, right, between rows, between columns are drawn.
    const ON: Record<string, string> = { outside: 'tlbr', rows: 'tbh', none: '' };
    const on = t?.borders ? ON[t.borders] : null;
    const borders = on === null ? '' : `<w:tblBorders>${(['t:top', 'l:left', 'b:bottom', 'r:right', 'h:insideH', 'v:insideV'] as const).map((x) => line(x.slice(2), on.includes(x[0]))).join('')}</w:tblBorders>`;
    const look = `<w:tblLook w:val="${head ? '04A0' : '0480'}" w:firstRow="${head ? 1 : 0}" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="${t?.banded ? 0 : 1}" w:noVBand="1"/>`;
    const styleId = t?.style ? wordTableStyle(t.style) : t?.banded ? 'TableGridBanded' : 'TableGrid';
    return `<w:tbl><w:tblPr><w:tblStyle w:val="${styleId}"/>${t?.widths ? `<w:tblW w:w="${Math.round(full)}" w:type="dxa"/>` : '<w:tblW w:w="0" w:type="auto"/>'}${borders}${t?.widths ? '<w:tblLayout w:type="fixed"/>' : ''}${look}</w:tblPr>${grid}${tr}</w:tbl>`;
  }

  /** A section's settings where they go (filled in once the page setup is written; see sectionXml in toDocx). */
  sectionMark(): string {
    this.sections++;
    return `<!--crumpet-sect:${JSON.stringify(this.section)}-->`;
  }

  async blocks(blocks: Block[], first: string): Promise<string> {
    let out = '';
    let num = 0;
    let bul = 0;
    const newList = (bullet: boolean, start?: [number, number]) => this.lists.push({ bullet, levels: [], start });
    for (const [k, b] of blocks.entries()) {
      // (A table or picture ending a section: an empty paragraph after it carries the settings.)
      if (this.sectNext) out += this.paragraph(null, '');
      // A section break before this block (on the document's first block, just the first section's settings).
      const sb = b.para?.sect;
      if (sb) {
        const p = b.para!;
        const was = this.section;
        this.section = { cols: p.cols ?? was.cols, orient: p.orient ?? was.orient, type: sb, mt: p.mt ?? was.mt, mb: p.mb ?? was.mb, ml: p.ml ?? was.ml, mr: p.mr ?? was.mr };
      }
      // The next block starts a new section: this one's paragraph carries this section's settings.
      if (blocks[k + 1]?.para?.sect) this.sectNext = this.sectionMark();
      // A column break: an empty paragraph with the break, then this block at the top of the next column.
      if (b.para?.colBefore) out += '<w:p><w:r><w:br w:type="column"/></w:r></w:p>';
      const lead = out ? '' : first;
      const after = blocks[k + 1]?.brk;
      this.markNext = after && b.type !== 'table' ? after : null;
      // A numbered list starts again at 1 after anything that isn't a list item.
      // Bulleted lists likewise, so each keeps its own bullets. A numbering value set by hand starts a new list, as in Word.
      const lvl = Math.min(8, b.indent ?? 0);
      if (b.type === 'numbered') {
        if (!num || b.para?.start !== undefined) num = newList(false, b.para?.start !== undefined ? [lvl, b.para.start] : undefined);
        const f = b.para?.num;
        if (f === 'legal') this.lists[num - 1].levels = Array(9).fill('legal');
        else if (f) this.lists[num - 1].levels[lvl] = f;
      } else if (b.type === 'bullet') {
        if (!bul) bul = newList(true);
        if (b.para?.bullet) this.lists[bul - 1].levels[lvl] = b.para.bullet;
      } else if (!isListType(b.type)) num = bul = 0;
      const jc = b.align && JC[b.align] ? `<w:jc w:val="${JC[b.align]}"/>` : '';
      // Paragraph settings set by hand, each where Word expects it: keep and page break first, then spacing and indents.
      const p = b.para;
      const keep = (p?.keepNext ? '<w:keepNext/>' : '') + (p?.keepLines ? '<w:keepLines/>' : '');
      const head = keep + lead + (p?.pageBefore && !lead.includes('pageBreakBefore') ? '<w:pageBreakBefore/>' : '');
      const tw = (inches: number) => Math.round(inches * TWIPS);
      const spacing = p && (p.before !== undefined || p.after !== undefined || p.line !== undefined) ? `<w:spacing${p.before !== undefined ? ` w:before="${Math.round(p.before * 20)}"` : ''}${p.after !== undefined ? ` w:after="${Math.round(p.after * 20)}"` : ''}${p.line !== undefined ? ` w:line="${Math.round(p.line * 240)}" w:lineRule="auto"` : ''}/>` : '';
      const left = p?.left ?? (p?.first !== undefined && p.first < 0 ? -p.first : undefined);
      const ind = p && (left !== undefined || p.right !== undefined || p.first !== undefined) ? `<w:ind${left !== undefined ? ` w:left="${tw(left)}"` : ''}${p.right !== undefined ? ` w:right="${tw(p.right)}"` : ''}${p.first !== undefined ? (p.first < 0 ? ` w:hanging="${tw(-p.first)}"` : ` w:firstLine="${tw(p.first)}"`) : ''}/>` : '';
      const sides = p?.border ? ([['t', 'top'], ['l', 'left'], ['b', 'bottom'], ['r', 'right']] as const).filter(([c]) => p.border!.includes(c)).map(([, side]) => `<w:${side} w:val="single" w:sz="4" w:space="4" w:color="auto"/>`).join('') : '';
      const box = (sides ? `<w:pBdr>${sides}</w:pBdr>` : '') + (p?.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${p.shade.slice(1).toUpperCase()}"/>` : '');
      const layout = box + spacing + ind;
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
        case 'toc':
          if (lead) out += this.paragraph(null, '', lead);
          out += this.toc();
          continue;
        case 'shape':
          out += this.shape(b, lead);
          continue;
        case 'code': {
          // Maths and diagrams go to Word as their source, in a typewriter font.
          const lines = (b.code?.text ?? '').split('\n');
          const mono = '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/></w:rPr>';
          out += this.paragraph(null, lines.map((l, i) => `${i ? `<w:r>${mono}<w:br/></w:r>` : ''}<w:r>${mono}<w:t xml:space="preserve">${esc(l)}</w:t></w:r>`).join(''), lead);
          continue;
        }
        case 'heading1':
        case 'heading2':
        case 'heading3':
        case 'heading4':
          out += this.paragraph(`Heading${b.type.slice(-1)}`, this.runs(b.runs), head + layout + jc);
          continue;
        case 'quote':
          out += this.paragraph(b.style === 'intense' ? 'IntenseQuote' : 'Quote', this.runs(b.runs), (CALLOUTS[b.style ?? ''] ? calloutPr(CALLOUTS[b.style!]) : '') + head + layout + jc);
          continue;
        case 'bullet':
        case 'todo':
        case 'numbered': {
          const id = b.type === 'numbered' ? num : bul;
          const check = b.type === 'todo' ? [{ text: b.checked ? '☒ ' : '☐ ', marks: [] as Mark[] }] : [];
          const numPr = b.type === 'todo' ? '' : `<w:numPr><w:ilvl w:val="${Math.min(8, b.indent ?? 0)}"/><w:numId w:val="${id}"/></w:numPr>`;
          const todoInd = b.type === 'todo' && !ind ? `<w:ind w:left="${360 + (b.indent ?? 0) * 360}"/>` : '';
          out += this.paragraph('ListParagraph', this.runs([...check, ...b.runs]), head + numPr + layout + todoInd + jc);
          continue;
        }
        default:
          if (b.style === 'scenebreak' && !b.runs.length) {
            out += this.paragraph('SceneBreak', '<w:r><w:t>*   *   *</w:t></w:r>', head + layout);
            continue;
          }
          out += this.paragraph(PARA_STYLES[b.style ?? ''] ?? null, this.runs(b.runs), head + layout + jc);
      }
    }
    if (this.sectNext) out += this.paragraph(null, '');
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

function isMediaType(t: BlockType): boolean {
  return t === 'image' || t === 'file';
}

function isListType(t: BlockType): boolean {
  return t === 'bullet' || t === 'numbered' || t === 'todo';
}

function numberSwitch(hf: HeadersFooters | undefined): string {
  return { '1': '', i: '\\* roman ', I: '\\* ROMAN ', a: '\\* alphabetic ', A: '\\* ALPHABETIC ' }[hf?.numberFormat ?? '1'];
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
/** Callouts (Note, Tip, Warning, Important): a Quote with a coloured bar down the left and a tinted background. */
const CALLOUTS: Record<string, { bar: string; fill: string }> = {
  note: { bar: '2F6FD1', fill: 'E9F0FB' },
  tip: { bar: '2E8B57', fill: 'E8F4EC' },
  warning: { bar: 'D08A00', fill: 'FBF2DF' },
  important: { bar: 'C0392B', fill: 'F9E6E4' },
};
const calloutPr = (c: { bar: string; fill: string }) => `<w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="${c.bar}"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="${c.fill}"/>`;

const NS = `xmlns:w="${W_NS}" xmlns:r="${R_NS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"`;
/** The document also names the drawing parts, for shapes and text boxes. */
const DOC_NS = `${NS} xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="wps"`;

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
    `<w:style w:type="paragraph" w:styleId="TOCHeading"><w:name w:val="TOC Heading"/><w:basedOn w:val="Heading1"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:qFormat/><w:pPr><w:pageBreakBefore w:val="0"/><w:outlineLvl w:val="9"/></w:pPr></w:style>` +
    [1, 2, 3].map((l) => `<w:style w:type="paragraph" w:styleId="TOC${l}"><w:name w:val="toc ${l}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:pPr><w:spacing w:after="100"/><w:ind w:left="${(l - 1) * 220}" w:firstLine="0"/></w:pPr></w:style>`).join('') +
    para('TableText', 'Table Text', '<w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/>', '') +
    para('Header', 'header', '<w:spacing w:after="0"/>', `<w:sz w:val="${Math.round(hp * 0.85)}"/>`) +
    para('Footer', 'footer', '<w:spacing w:after="0"/>', `<w:sz w:val="${Math.round(hp * 0.85)}"/>`) +
    para('FootnoteText', 'footnote text', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', `<w:sz w:val="${Math.round(hp * 0.8)}"/>`) +
    `<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>` +
    para('CommentText', 'annotation text', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', `<w:sz w:val="20"/>`) +
    `<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:rPr><w:sz w:val="16"/></w:rPr></w:style>` +
    `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>` +
    `<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="auto"/><w:left w:val="single" w:sz="4" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:color="auto"/><w:right w:val="single" w:sz="4" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:color="auto"/></w:tblBorders><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>` +
    tableStylesXml() +
    `<w:style w:type="table" w:styleId="TableGridBanded"><w:name w:val="Table Grid Banded"/><w:basedOn w:val="TableGrid"/><w:tblPr><w:tblStyleRowBandSize w:val="1"/></w:tblPr><w:tblStylePr w:type="band1Horz"><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr></w:tblStylePr></w:style>` +
    `</w:styles>`
  );
}

interface SectionProps {
  cols: number;
  orient?: 'portrait' | 'landscape';
  type: 'page' | 'cont';
  /** Margins in inches, when the section has its own. */
  mt?: number;
  mb?: number;
  ml?: number;
  mr?: number;
}

interface ListDef {
  bullet: boolean;
  /** Number or bullet style set for each level (unset: Word's usual one). */
  levels: (string | undefined)[];
  /** A numbering value set by hand: [level, number]. */
  start?: [number, number];
}

interface WordLevel {
  fmt: string;
  text: string;
  start: number;
}

/** Bullets Word draws from symbol fonts, as the characters they show. */
const WORD_BULLETS: Record<string, BulletKind> = { '\uf0b7': 'disc', '\uf0a7': 'square', o: 'circle', '\uf0d8': 'arrow', '\uf0fc': 'check', '\uf076': 'diamond', '-': 'dash', '\uf0ab': 'star' };

/** A Word list level as Crumpet's number or bullet style, when it isn't the usual one for that level. */
function wordListStyle(l: WordLevel, level: number): ParaLook {
  if (l.fmt === 'bullet') {
    const kind = (Object.keys(BULLETS) as BulletKind[]).find((k) => BULLETS[k] === l.text) ?? WORD_BULLETS[l.text];
    return kind && kind !== DEFAULT_BULLETS[level % 3] ? { bullet: kind } : {};
  }
  const f: NumFormat | undefined = (l.text.match(/%/g) ?? []).length > 1 ? 'legal' : l.fmt === 'decimal' || l.fmt === 'decimalZero' ? (/\)\s*$/.test(l.text) ? 'paren' : 'decimal') : ({ upperLetter: 'upper-alpha', lowerLetter: 'lower-alpha', upperRoman: 'upper-roman', lowerRoman: 'lower-roman' } as Record<string, NumFormat>)[l.fmt];
  return f && f !== DEFAULT_NUMS[level % 3] ? { num: f } : {};
}

const DEFAULT_NUMS = ['decimal', 'lower-alpha', 'lower-roman'];
const DEFAULT_BULLETS: BulletKind[] = ['disc', 'circle', 'square'];
const NUM_FMT: Record<string, string> = { decimal: 'decimal', paren: 'decimal', legal: 'decimal', 'upper-alpha': 'upperLetter', 'lower-alpha': 'lowerLetter', 'upper-roman': 'upperRoman', 'lower-roman': 'lowerRoman' };

function numberingXml(lists: ListDef[]): string {
  const lvl = (list: ListDef, l: number) => {
    const ind = `<w:pPr><w:ind w:left="${720 + l * 360}" w:hanging="360"/></w:pPr>`;
    if (list.bullet) {
      const kind = (list.levels[l] ?? DEFAULT_BULLETS[l % 3]) as BulletKind;
      return `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${BULLETS[kind] ?? '•'}"/><w:lvlJc w:val="left"/>${ind}</w:lvl>`;
    }
    const f = list.levels[l] ?? DEFAULT_NUMS[l % 3];
    const text = f === 'legal' ? Array.from({ length: l + 1 }, (_, i) => `%${i + 1}`).join('.') + (l === 0 ? '.' : '') : `%${l + 1}${f === 'paren' ? ')' : '.'}`;
    return `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${NUM_FMT[f] ?? 'decimal'}"/>${f === 'legal' ? '<w:isLgl/>' : ''}<w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/>${ind}</w:lvl>`;
  };
  const abstracts = lists.map((list, i) => `<w:abstractNum w:abstractNumId="${i}"><w:multiLevelType w:val="${list.levels.includes('legal') ? 'multilevel' : 'hybridMultilevel'}"/>${Array.from({ length: 9 }, (_, l) => lvl(list, l)).join('')}</w:abstractNum>`).join('');
  const nums = lists.map((list, i) => `<w:num w:numId="${i + 1}"><w:abstractNumId w:val="${i}"/>${list.start ? `<w:lvlOverride w:ilvl="${list.start[0]}"><w:startOverride w:val="${list.start[1]}"/></w:lvlOverride>` : ''}</w:num>`).join('');
  return XML + `<w:numbering ${NS}>${abstracts}${nums}</w:numbering>`;
}

/** The id Word uses to tie a comment's paragraph to its thread (8 hex digits, below 0x80000000). */
const paraId = (n: number) => (0x10000000 + n).toString(16).toUpperCase();

type WrittenComment = { comment: Comment; id: number; replies: number[] };

function commentsXml(list: WrittenComment[]): string {
  const one = (id: number, author: string, at: number, text: string) =>
    `<w:comment w:id="${id}" w:author="${esc(author || 'Someone')}"${at ? ` w:date="${new Date(at).toISOString().replace(/\.\d+Z$/, 'Z')}"` : ''} w:initials="${esc((author || 'S').split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 3).toUpperCase())}">` +
    `<w:p w14:paraId="${paraId(id)}" w14:textId="77777777"><w:pPr><w:pStyle w:val="CommentText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p></w:comment>`;
  const body = list.map(({ comment: c, id, replies }) => one(id, c.author, c.at, c.text) + (c.replies ?? []).map((r, i) => one(replies[i], r.author, r.at, r.text)).join('')).join('');
  return XML + `<w:comments ${NS} xmlns:w14="${W14_NS}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14">${body}</w:comments>`;
}

/** Which comments are replies to which: Word's threads. */
function commentsExtendedXml(list: WrittenComment[]): string {
  const body = list.map(({ id, replies }) => `<w15:commentEx w15:paraId="${paraId(id)}" w15:done="0"/>` + replies.map((r) => `<w15:commentEx w15:paraId="${paraId(r)}" w15:paraIdParent="${paraId(id)}" w15:done="0"/>`).join('')).join('');
  return XML + `<w15:commentsEx xmlns:w15="${W15_NS}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w15">${body}</w15:commentsEx>`;
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
  const size = paperInches(page);
  const m = page?.margins ?? { top: 1, right: 1, bottom: 1, left: 1 };
  const contentIn = size.width - m.left - m.right;
  const w = new Writer(opts, contentIn * 96);
  w.countComments(parts);
  w.tocEntries = parts.flatMap((part) => [
    ...(part.heading ? [{ level: 1, text: part.heading }] : []),
    ...part.doc.blocks.filter((b) => b.type === 'heading1' || b.type === 'heading2' || b.type === 'heading3').map((b) => ({ level: Math.min(3, Number(b.type.slice(-1)) + (part.heading !== undefined ? 1 : 0)), text: b.runs.filter((r) => r.change?.kind !== 'del' && !r.footnote).map((r) => r.text).join('').trim() })),
  ]).filter((e) => e.text);
  let body = opts.titleParagraph ? w.paragraph('Title', `<w:r><w:t xml:space="preserve">${esc(opts.titleParagraph)}</w:t></w:r>`) : '';
  for (const [i, part] of parts.entries()) {
    // A part (chapter) starting with a section break: the section before ends with an empty paragraph.
    if (i > 0 && part.doc.blocks[0]?.para?.sect) body += `<w:p><w:pPr>${w.sectionMark()}</w:pPr></w:p>`;
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
  // Each section's settings: the page turned for landscape, its columns and how it starts. The first section has the page numbering and a different first page.
  const sectionXml = (sp: SectionProps, first: boolean) => {
    const landscape = sp.orient ? sp.orient === 'landscape' : !!page?.landscape;
    const long = Math.max(size.width, size.height);
    const short = Math.min(size.width, size.height);
    const [pw, ph] = landscape ? [long, short] : [short, long];
    const type = sp.type === 'cont' && !first ? '<w:type w:val="continuous"/>' : '';
    const cols = sp.cols > 1 ? `<w:cols w:num="${sp.cols}" w:space="720"/>` : '<w:cols w:space="720"/>';
    return `<w:sectPr>${refs.replace('<w:titlePg/>', '')}<w:footnotePr><w:numFmt w:val="decimal"/></w:footnotePr>${type}<w:pgSz w:w="${tw(pw)}" w:h="${tw(ph)}"${landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${tw(sp.mt ?? m.top)}" w:right="${tw(sp.mr ?? m.right)}" w:bottom="${tw(sp.mb ?? m.bottom)}" w:left="${tw(sp.ml ?? m.left)}" w:header="${tw(hf?.headerFrom ?? 0.5)}" w:footer="${tw(hf?.footerFrom ?? 0.5)}" w:gutter="0"/>${first ? pgNum : ''}${cols}${titlePg && first ? '<w:titlePg/>' : ''}</w:sectPr>`;
  };
  let firstSect = true;
  body = body.replace(/<!--crumpet-sect:(.*?)-->/g, (_, json: string) => {
    const xml = sectionXml(JSON.parse(json) as SectionProps, firstSect);
    firstSect = false;
    return xml;
  });
  const sect = sectionXml(w.section, firstSect);
  const documentXml = `${XML}<w:document ${DOC_NS}><w:body>${body}${sect}</w:body></w:document>`;

  w.rel(`${REL}/styles`, 'styles.xml');
  w.rel(`${REL}/numbering`, 'numbering.xml');
  w.rel(`${REL}/footnotes`, 'footnotes.xml');
  w.rel(`${REL}/settings`, 'settings.xml');
  if (w.comments.length) {
    w.rel(`${REL}/comments`, 'comments.xml');
    files.push({ name: 'word/comments.xml', data: utf8(commentsXml(w.comments)) });
    w.rel('http://schemas.microsoft.com/office/2011/relationships/commentsExtended', 'commentsExtended.xml');
    files.push({ name: 'word/commentsExtended.xml', data: utf8(commentsExtendedXml(w.comments)) });
  }
  const docRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${w.rels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"${r.external ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
  const hasToc = parts.some((part) => part.doc.blocks.some((b) => b.type === 'toc'));
  const settings = `${XML}<w:settings ${NS}>${hf?.differentOddEven ? '<w:evenAndOddHeaders/>' : ''}<w:defaultTabStop w:val="720"/>${hasToc ? '<w:updateFields w:val="true"/>' : ''}<w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
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
    files.map((f) => `<Override PartName="/${f.name}" ContentType="${f.name.endsWith('commentsExtended.xml') ? 'application/vnd.ms-word.commentsExtended+xml' : `application/vnd.openxmlformats-officedocument.wordprocessingml.${f.name.includes('header') ? 'header' : f.name.includes('comments') ? 'comments' : 'footer'}+xml`}"/>`).join('') +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  const rootRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

  return writeZip([
    { name: '[Content_Types].xml', data: utf8(types) },
    { name: '_rels/.rels', data: utf8(rootRels) },
    { name: 'docProps/core.xml', data: utf8(core) },
    { name: 'word/document.xml', data: utf8(documentXml) },
    { name: 'word/_rels/document.xml.rels', data: utf8(docRels) },
    { name: 'word/styles.xml', data: utf8(stylesXml(opts.font || 'Georgia', opts.size || 12)) },
    { name: 'word/numbering.xml', data: utf8(numberingXml(w.lists)) },
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
  const stylesXml = parseXml(files.get(stylesPath));
  // The document's usual font and size: text set in those needs no look of its own.
  const defaults = Array.from(stylesXml?.getElementsByTagNameNS(W_NS, 'rPrDefault') ?? [])[0];
  const normal = Array.from(stylesXml?.getElementsByTagNameNS(W_NS, 'style') ?? []).find((x) => attr(x, 'type') === 'paragraph' && attr(x, 'default') === '1');
  const usualFont = new Set([attr(child(child(defaults, 'rPr'), 'rFonts'), 'ascii'), attr(child(child(normal, 'rPr'), 'rFonts'), 'ascii')].filter((x): x is string => !!x));
  const usualSize = new Set([attr(child(child(defaults, 'rPr'), 'sz'), 'val'), attr(child(child(normal, 'rPr'), 'sz'), 'val')].filter((x): x is string => !!x));
  const readLook = (rpr: Element | null | undefined, code: boolean): Look | undefined => {
    if (!rpr) return undefined;
    const look: Look = {};
    const font = attr(child(rpr, 'rFonts'), 'ascii') ?? attr(child(rpr, 'rFonts'), 'hAnsi');
    if (font && !code && !usualFont.has(font)) look.font = font;
    const sz = attr(child(rpr, 'sz'), 'val');
    if (sz && !usualSize.has(sz) && +sz > 0) look.size = +sz / 2;
    const color = attr(child(rpr, 'color'), 'val');
    if (color && /^[0-9a-f]{6}$/i.test(color) && color.toUpperCase() !== '000000') look.color = `#${color.toLowerCase()}`;
    const hl = attr(child(rpr, 'highlight'), 'val');
    const fill = attr(child(rpr, 'shd'), 'fill');
    if (hl && HIGHLIGHT_HEX[hl]) look.highlight = HIGHLIGHT_HEX[hl];
    else if (fill && /^[0-9a-f]{6}$/i.test(fill) && fill.toUpperCase() !== 'FFFFFF') look.highlight = `#${fill.toLowerCase()}`;
    const va = attr(child(rpr, 'vertAlign'), 'val');
    if (va === 'superscript') look.va = 'super';
    else if (va === 'subscript') look.va = 'sub';
    return tidyLook(look);
  };
  for (const s of Array.from(stylesXml?.getElementsByTagNameNS(W_NS, 'style') ?? [])) {
    const id = attr(s, 'styleId') ?? '';
    styleName.set(id, (attr(child(s, 'name'), 'val') ?? id).toLowerCase());
    const lvl = attr(child(child(s, 'pPr'), 'outlineLvl'), 'val');
    if (lvl !== null) styleLevel.set(id, Number(lvl) + 1);
  }

  // Lists: which numbering is bullets.
  // Each numbering's levels (format, text such as "%1.", start), the list it counts with, and any start set on it.
  const numDefs = new Map<string, { abs: string; levels: WordLevel[]; restart: Map<number, number> }>();
  const numberingPath = [...rels.values()].find((p) => /numbering\.xml$/.test(p)) ?? 'word/numbering.xml';
  const numbering = parseXml(files.get(numberingPath));
  if (numbering) {
    const abstract = new Map<string, WordLevel[]>();
    for (const a of Array.from(numbering.getElementsByTagNameNS(W_NS, 'abstractNum'))) {
      abstract.set(
        attr(a, 'abstractNumId') ?? '',
        kids(a)
          .filter((c) => c.localName === 'lvl')
          .map((l) => ({ fmt: attr(child(l, 'numFmt'), 'val') ?? 'decimal', text: attr(child(l, 'lvlText'), 'val') ?? '', start: Number(attr(child(l, 'start'), 'val') ?? 1) || 0 })),
      );
    }
    for (const n of Array.from(numbering.getElementsByTagNameNS(W_NS, 'num'))) {
      const abs = attr(child(n, 'abstractNumId'), 'val') ?? '';
      const restart = new Map<number, number>();
      for (const o of kids(n).filter((c) => c.localName === 'lvlOverride')) {
        const v = attr(child(o, 'startOverride'), 'val');
        if (v !== null) restart.set(Number(attr(o, 'ilvl') ?? 0), Number(v));
      }
      numDefs.set(attr(n, 'numId') ?? '', { abs, levels: abstract.get(abs) ?? [], restart });
    }
  }
  // Word counts each list through the whole document; the number each numbered paragraph shows there.
  const counting = new Map<string, (number | undefined)[]>();
  const begun = new Set<string>();
  const wordNumber = new Map<Block, number>();
  const countItem = (numId: string, level: number): number => {
    const def = numDefs.get(numId);
    const key = def?.abs ?? numId;
    const c = counting.get(key) ?? [];
    counting.set(key, c);
    if (def && !begun.has(numId)) {
      begun.add(numId);
      for (const [l, v] of def.restart) c[l] = v - 1;
    }
    c[level] = (c[level] ?? (def?.levels[level]?.start ?? 1) - 1) + 1;
    c.fill(undefined, level + 1);
    return c[level]!;
  };

  // Footnotes' text.
  const notes = new Map<string, string>();
  const notesPath = [...rels.values()].find((p) => /footnotes\.xml$/.test(p));
  for (const f of Array.from(parseXml(notesPath ? files.get(notesPath) : undefined)?.getElementsByTagNameNS(W_NS, 'footnote') ?? [])) notes.set(attr(f, 'id') ?? '', textOf(f));

  // Comments: what each says, and which are open at the text being read.
  const notesById = new Map<string, Comment>();
  const commentsPath = [...rels.values()].find((p) => /comments\.xml$/.test(p));
  // Word's threads: which comment (by its last paragraph's id) answers which.
  const extendedPath = [...rels.values()].find((p) => /commentsExtended\.xml$/.test(p));
  const extended = parseXml(extendedPath ? files.get(extendedPath) : undefined);
  const parentOf = new Map<string, string>();
  for (const x of Array.from(extended?.getElementsByTagName('*') ?? []).filter((e) => e.localName === 'commentEx')) {
    const own = x.getAttributeNS(W15_NS, 'paraId') ?? x.getAttribute('w15:paraId');
    const parent = x.getAttributeNS(W15_NS, 'paraIdParent') ?? x.getAttribute('w15:paraIdParent');
    if (own && parent) parentOf.set(own.toUpperCase(), parent.toUpperCase());
  }
  const raw = Array.from(parseXml(commentsPath ? files.get(commentsPath) : undefined)?.getElementsByTagNameNS(W_NS, 'comment') ?? []).map((c) => {
    const date = Date.parse(attr(c, 'date') ?? '');
    const ps = kids(c).filter((x) => x.localName === 'p');
    const last = ps[ps.length - 1];
    return {
      xmlId: attr(c, 'id') ?? '',
      author: (attr(c, 'author') ?? '').replace(/\s+/g, ' ').trim(),
      at: Number.isNaN(date) ? 0 : Math.floor(date / 60000) * 60000,
      paras: ps.map(textOf).filter(Boolean),
      paraId: (last?.getAttributeNS(W14_NS, 'paraId') ?? last?.getAttribute('w14:paraId') ?? '').toUpperCase(),
    };
  });
  const byPara = new Map(raw.filter((r) => r.paraId).map((r) => [r.paraId, r]));
  /** The comment that starts a reply's thread. */
  const rootOf = (r: (typeof raw)[number]) => {
    let at = r;
    for (let i = 0; i < 50; i++) {
      const up = byPara.get(parentOf.get(at.paraId) ?? '');
      if (!up || up === at) break;
      at = up;
    }
    return at;
  };
  const replyTo = new Map<string, CommentReply[]>();
  for (const r of raw) {
    const root = rootOf(r);
    if (root === r) continue;
    const list = replyTo.get(root.xmlId) ?? [];
    list.push({ author: r.author, at: r.at, text: r.paras.join(' ') });
    replyTo.set(root.xmlId, list);
  }
  for (const r of raw) {
    if (rootOf(r) !== r) continue;
    const text = parentOf.size ? r.paras.join(' ') : (r.paras[0] ?? '');
    // Without Word's threads (older files), extra paragraphs written as "Name: reply" are replies.
    const legacy: CommentReply[] = parentOf.size
      ? []
      : r.paras.slice(1).map((p) => {
          const m = /^([^:]{1,60}): (.*)$/.exec(p);
          return m ? { author: m[1], at: 0, text: m[2] } : { author: '', at: 0, text: p };
        });
    const replies = [...legacy, ...(replyTo.get(r.xmlId) ?? [])].sort((a, b) => a.at - b.at);
    const comment: Comment = { id: commentId(r.author, r.at, text), author: r.author, at: r.at, text };
    if (replies.length) comment.replies = replies;
    notesById.set(r.xmlId, comment);
  }
  const openComments: string[] = [];
  let trackedChange: Change | undefined;
  const currentComment = () => {
    for (let k = openComments.length - 1; k >= 0; k--) {
      const c = notesById.get(openComments[k]);
      if (c) return c;
    }
    return undefined;
  };

  const blocks: Block[] = [];
  let title = '';
  const core = parseXml(files.get('docProps/core.xml'));
  const coreTitle = core?.getElementsByTagName('dc:title')[0]?.textContent?.trim() ?? '';

  /** A Word text box or shape (DrawingML), as a shape block. */
  const readShape = async (drawing: Element): Promise<Block | null> => {
    // Drawing attributes carry no prefix.
    const plain = (el: Element | undefined | null, name: string) => el?.getAttribute(name) ?? null;
    const all = Array.from(drawing.getElementsByTagName('*'));
    const wsp = all.find((x) => x.localName === 'wsp');
    if (!wsp) return null;
    const find = (root: Element | undefined, name: string) => (root ? Array.from(root.getElementsByTagName('*')).find((x) => x.localName === name) : undefined);
    const extent = all.find((x) => x.localName === 'extent');
    const EMU = 914400;
    const w = Number(plain(extent ?? null, 'cx') ?? 0) / EMU;
    const h = Number(plain(extent ?? null, 'cy') ?? 0) / EMU;
    const spPr = kids(wsp).find((x) => x.localName === 'spPr');
    const prst = plain(find(spPr, 'prstGeom') ?? null, 'prst') ?? 'rect';
    const ln = spPr && kids(spPr).find((x) => x.localName === 'ln');
    const arrow = !!ln && kids(ln).some((x) => (x.localName === 'tailEnd' || x.localName === 'headEnd') && (plain(x, 'type') ?? 'none') !== 'none');
    const kind: ShapeKind = prst === 'roundRect' ? 'rounded' : prst === 'ellipse' ? 'ellipse' : /line|Connector/i.test(prst) ? (arrow ? 'arrow' : 'line') : prst === 'rightArrow' ? 'arrow' : 'rect';
    const colorIn = (el: Element | undefined): string | null | undefined => {
      if (!el) return undefined;
      if (kids(el).some((x) => x.localName === 'noFill')) return null;
      const solid = kids(el).find((x) => x.localName === 'solidFill');
      const rgb = solid && kids(solid).find((x) => x.localName === 'srgbClr');
      const v = plain(rgb ?? null, 'val');
      return v && /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : undefined;
    };
    const fill = spPr ? colorIn(spPr) : undefined;
    const line = ln ? colorIn(ln) : undefined;
    // The text in it.
    const box = find(wsp, 'txbxContent');
    const runs: Run[] = [];
    if (box) {
      for (const [k, p] of kids(box).filter((x) => x.localName === 'p').entries()) {
        if (k > 0) runs.push({ text: ' ', marks: [] });
        await readRuns(p, runs, []);
      }
    }
    const text = cellText(runs.filter((x) => !x.footnote && !x.comment).map((x) => ({ text: x.text.replace(/\n/g, ' '), marks: x.marks, ...(x.look ? { look: x.look } : {}), ...(x.link ? { link: x.link } : {}) })));
    // Floating with the text round it: on the side it's aligned to.
    const anchor = all.find((x) => x.localName === 'anchor');
    const wraps = anchor && Array.from(anchor.children).some((x) => /^wrap(Square|Tight|Through)$/.test(x.localName));
    const side = find(all.find((x) => x.localName === 'positionH'), 'align')?.textContent ?? 'left';
    const shape = tidyShape({ kind, w: w || undefined, h: h || undefined, fill, line, wrap: wraps ? (side === 'right' ? 'right' : 'left') : 'inline', text });
    return makeBlock('shape', '', [], { shape });
  };

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
          const comment = currentComment();
          const change = trackedChange;
          const look = readLook(rpr, marksHere.includes('code'));
          const push = (text: string) => {
            const run: Run = link ? { text, marks: marksHere, link } : { text, marks: marksHere };
            if (comment) run.comment = comment;
            if (change) run.change = change;
            if (look) run.look = look;
            out.push(run);
          };
          for (const c of kids(el)) {
            if (c.localName === 't' || c.localName === 'delText') push(c.textContent ?? '');
            else if (c.localName === 'tab') push('\t');
            else if (c.localName === 'br' || c.localName === 'cr') {
              if (attr(c, 'type') !== 'page' && attr(c, 'type') !== 'column') push('\n');
            } else if (c.localName === 'noBreakHyphen') push('‑');
            else if (c.localName === 'sym') push(String.fromCharCode(parseInt(attr(c, 'char') ?? '20', 16) & 0xff || 32));
            else if (c.localName === 'footnoteReference' || c.localName === 'endnoteReference') {
              const text = c.localName === 'footnoteReference' ? notes.get(attr(c, 'id') ?? '') : undefined;
              out.push({ text: FOOTNOTE, marks: [], footnote: text ?? '' });
            } else if (c.localName === 'AlternateContent') {
              // Word's choice of ways to show something (a shape, with an older drawing as the fallback): the first.
              const choice = kids(c).find((x) => x.localName === 'Choice') ?? kids(c).find((x) => x.localName === 'Fallback');
              const drawing = choice && kids(choice).find((x) => x.localName === 'drawing' || x.localName === 'pict');
              if (drawing) {
                const shape = await readShape(drawing);
                if (shape) pics.push(shape);
              }
            } else if (c.localName === 'drawing' && Array.from(c.getElementsByTagName('*')).some((x) => x.localName === 'wsp')) {
              const shape = await readShape(c);
              if (shape) pics.push(shape);
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
        case 'del':
        case 'moveFrom':
        case 'moveTo': {
          // Tracked changes: who added or deleted this text, and when.
          const date = Date.parse(attr(el, 'date') ?? '');
          const outer = trackedChange;
          trackedChange = { kind: el.localName === 'ins' || el.localName === 'moveTo' ? 'ins' : 'del', author: (attr(el, 'author') ?? '').replace(/\s+/g, ' ').trim(), at: Number.isNaN(date) ? 0 : Math.floor(date / 60000) * 60000 };
          await readRuns(el, out, pics, marks, link);
          trackedChange = outer;
          break;
        }
        case 'smartTag':
        case 'customXml':
        case 'fldSimple':
        case 'sdtContent':
          await readRuns(el, out, pics, marks, link);
          break;
        case 'sdt':
          await readRuns(child(el, 'sdtContent') ?? el, out, pics, marks, link);
          break;
        case 'commentRangeStart':
          openComments.push(attr(el, 'id') ?? '');
          break;
        case 'commentRangeEnd': {
          const k = openComments.lastIndexOf(attr(el, 'id') ?? '');
          if (k >= 0) openComments.splice(k, 1);
          break;
        }
        default:
        // Deleted text, comments, bookmarks, properties: not text.
      }
    }
  };

  /** A tracked change on the last paragraph's mark: the break before the next paragraph. */
  let pendingBreak: Change | undefined;
  /** A page break ended the last paragraph: the next one starts a new page. */
  let pageBreakNext = false;
  let colBreakNext = false;
  // Section settings, as Word keeps them: at the end of each section (in its last paragraph), the last in the body.
  type SectRead = { margins: { mt?: number; mb?: number; ml?: number; mr?: number }; cont: boolean; cols: number; landscape: boolean };
  const sectEnds: { end: number; props: SectRead }[] = [];
  const readSect = (sp: Element): SectRead => {
    const sz = child(sp, 'pgSz');
    const w = Number(attr(sz, 'w') ?? 0);
    const h = Number(attr(sz, 'h') ?? 0);
    const mar = child(sp, 'pgMar');
    const inch = (k: string) => {
      const v = attr(mar, k);
      return v !== null && Number.isFinite(Number(v)) ? Math.round((Number(v) / TWIPS) * 1000) / 1000 : undefined;
    };
    return { margins: { mt: inch('top'), mb: inch('bottom'), ml: inch('left'), mr: inch('right') }, cont: attr(child(sp, 'type'), 'val') === 'continuous', cols: Math.max(1, Math.min(4, Number(attr(child(sp, 'cols'), 'num') ?? 1) || 1)), landscape: attr(sz, 'orient') === 'landscape' || (w > 0 && h > 0 && w > h) };
  };
  /** Whether `el` comes after all the text in paragraph `p`. */
  const isLastThing = (p: Element, el: Element): boolean => {
    const all = Array.from(p.getElementsByTagNameNS(W_NS, '*')).filter((x) => x.localName === 't' || x === el);
    return all[all.length - 1] === el;
  };
  const paragraph = async (p: Element) => {
    const ppr = child(p, 'pPr');
    const brk = pendingBreak;
    const markRpr = child(ppr, 'rPr');
    const markChange = markRpr && kids(markRpr).find((x) => x.localName === 'ins' || x.localName === 'del');
    pendingBreak = markChange ? { kind: markChange.localName as 'ins' | 'del', author: (attr(markChange, 'author') ?? '').replace(/\s+/g, ' ').trim(), at: Number.isNaN(Date.parse(attr(markChange, 'date') ?? '')) ? 0 : Math.floor(Date.parse(attr(markChange, 'date') ?? '') / 60000) * 60000 } : undefined;
    const startAt = blocks.length;
    const styleId = attr(child(ppr, 'pStyle'), 'val') ?? '';
    const name = styleName.get(styleId) ?? styleId.toLowerCase();
    // The lines of a table of contents not in its own box.
    if (/^toc \d$/.test(name)) {
      if (blocks[blocks.length - 1]?.type !== 'toc') blocks.push(makeBlock('toc'));
      return;
    }
    const runs: Run[] = [];
    const pics: Block[] = [];
    await readRuns(p, runs, pics);
    const clean = normalizeRuns(runs);
    blocks.push(...pics);
    if (pics.length && !clean.some((r) => r.text.trim())) return;
    const jc = attr(child(ppr, 'jc'), 'val');
    const align = jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : jc === 'both' || jc === 'distribute' ? 'justify' : undefined;
    const listPara: ParaLook = {};
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
      const lvl = numDefs.get(numId)?.levels[level];
      b = makeBlock(lvl?.fmt === 'bullet' ? 'bullet' : 'numbered', '', [], { indent: Math.min(6, level) });
      if (lvl) Object.assign(listPara, wordListStyle(lvl, level));
      if (b.type === 'numbered') wordNumber.set(b, countItem(numId, level));
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
    // Spacing, indents and page breaks set on the paragraph itself (not by its style); list items keep their own indents.
    const para: ParaLook = isListType(b.type) ? { ...listPara } : {};
    const sp = child(ppr, 'spacing');
    const twPt = (v: string | null) => (v !== null && Number.isFinite(+v) ? +v / 20 : undefined);
    if (sp) {
      para.before = twPt(attr(sp, 'before'));
      para.after = twPt(attr(sp, 'after'));
      const line = attr(sp, 'line');
      if (line && (attr(sp, 'lineRule') ?? 'auto') === 'auto') para.line = Math.round((+line / 240) * 100) / 100;
    }
    const ind = child(ppr, 'ind');
    if (ind && !isListType(b.type)) {
      const inch = (v: string | null) => (v !== null && Number.isFinite(+v) ? Math.round((+v / TWIPS) * 1000) / 1000 : undefined);
      para.left = inch(attr(ind, 'left') ?? attr(ind, 'start'));
      para.right = inch(attr(ind, 'right') ?? attr(ind, 'end'));
      const hanging = inch(attr(ind, 'hanging'));
      para.first = hanging !== undefined ? -hanging : inch(attr(ind, 'firstLine'));
    }
    const on2 = (el: Element | null | undefined) => !!el && attr(el, 'val') !== '0' && attr(el, 'val') !== 'false';
    const carried = pageBreakNext;
    pageBreakNext = false;
    const colCarried = colBreakNext;
    colBreakNext = false;
    if (colCarried) para.colBefore = true;
    if (on2(child(ppr, 'pageBreakBefore')) || carried) para.pageBefore = true;
    if (on2(child(ppr, 'keepNext'))) para.keepNext = true;
    if (on2(child(ppr, 'keepLines'))) para.keepLines = true;
    // Borders and shading.
    const bdr = child(ppr, 'pBdr');
    if (bdr) para.border = (['top', 'bottom', 'left', 'right'] as const).filter((side) => { const v = attr(child(bdr, side), 'val'); return v !== null && v !== 'none' && v !== 'nil'; }).map((side) => side[0]).join('');
    const fill = attr(child(ppr, 'shd'), 'fill');
    if (fill && /^[0-9a-f]{6}$/i.test(fill) && fill.toLowerCase() !== 'ffffff') para.shade = `#${fill.toLowerCase()}`;
    // A page break (Ctrl+Enter in Word): on its own or after the text, the next paragraph starts a new page; before the text, this one does.
    const breaks = Array.from(p.getElementsByTagNameNS(W_NS, 'br')).filter((x) => attr(x, 'type') === 'page');
    if (breaks.length) {
      if (!text.trim() || isLastThing(p, breaks[breaks.length - 1])) pageBreakNext = true;
      else para.pageBefore = true;
    }
    // A column break, likewise.
    const colBreaks = Array.from(p.getElementsByTagNameNS(W_NS, 'br')).filter((x) => attr(x, 'type') === 'column');
    if (colBreaks.length) {
      if (!text.trim() || isLastThing(p, colBreaks[colBreaks.length - 1])) colBreakNext = true;
      else para.colBefore = true;
    }
    const tidy = tidyPara(para);
    if (tidy) b.para = tidy;
    // A paragraph holding nothing but a page or column break is just the break; an empty one ending a section is just the section's end.
    if ((breaks.length || colBreaks.length) && !text.trim() && b.type === 'paragraph' && !b.style) return;
    if (child(ppr, 'sectPr') && !text.trim() && b.type === 'paragraph' && !b.style && !pics.length) return;
    b.runs = normalizeRuns(clean);
    blocks.push(b);
    if (brk && blocks[startAt] && !blocks[startAt].brk) blocks[startAt].brk = brk;
  };

  const table = async (t: Element) => {
    // Cells by grid position: a cell spanning columns (gridSpan) or carrying a merge down (vMerge) becomes a merged cell.
    const rows: string[][] = [];
    const merges: [number, number, number, number][] = [];
    const shades: Record<string, string> = {};
    const jcs: (string | null)[][] = [];
    for (const tr of kids(t).filter((c) => c.localName === 'tr')) {
      const r = rows.length;
      const row: string[] = [];
      const jc: (string | null)[] = [];
      let c = Number(attr(child(child(tr, 'trPr'), 'gridBefore'), 'val') ?? 0);
      for (let i = 0; i < c; i++) row.push(''), jc.push(null);
      for (const tc of kids(tr).filter((x) => x.localName === 'tc')) {
        const pr = child(tc, 'tcPr');
        // The cell's text with its formatting (bold, fonts, colours…); its paragraphs run together on one line.
        const cellRunsRead: Run[] = [];
        for (const [k, cp] of kids(tc).filter((x) => x.localName === 'p').entries()) {
          if (k > 0) cellRunsRead.push({ text: ' ', marks: [] });
          await readRuns(cp, cellRunsRead, []);
        }
        const cellMd = cellText(cellRunsRead.filter((x) => !x.footnote && !x.comment).map((x) => ({ text: x.text, marks: x.marks, ...(x.look ? { look: x.look } : {}), ...(x.link ? { link: x.link } : {}) })));
        const span = Math.max(1, Number(attr(child(pr, 'gridSpan'), 'val') ?? 1) || 1);
        const vm = child(pr, 'vMerge');
        const above = vm && attr(vm, 'val') !== 'restart' ? merges.find((m) => m[1] === c && m[0] + m[2] === r) : undefined;
        if (above) above[2]++;
        else if (span > 1 || (vm && attr(vm, 'val') === 'restart')) merges.push([r, c, 1, span]);
        if (!above) {
          const fill = attr(child(pr, 'shd'), 'fill');
          if (fill && /^[0-9a-f]{6}$/i.test(fill) && fill.toLowerCase() !== 'ffffff') shades[`${r},${c}`] = `#${fill.toLowerCase()}`;
        }
        const align = attr(child(child(child(tc, 'p'), 'pPr'), 'jc'), 'val');
        for (let i = 0; i < span; i++) {
          row.push(i === 0 && !above ? cellMd : '');
          jc.push(i === 0 && !above && textOf(tc).trim() ? (align === 'center' ? 'center' : align === 'right' || align === 'end' ? 'right' : 'left') : null);
        }
        c += span;
      }
      rows.push(row);
      jcs.push(jc);
    }
    if (!rows.length) return;
    const tidy = tidyRows(rows);
    // A column is centred or right-aligned when every filled cell in it (below the heading row) is.
    const aligns = tidy[0].map((_, c) => {
      const seen = jcs.slice(1).map((row) => row[c]).filter((x): x is string => !!x);
      return seen.length && seen.every((x) => x === seen[0]) && seen[0] !== 'left' ? (seen[0] as 'center' | 'right') : null;
    });
    const pr = child(t, 'tblPr');
    const lookEl = child(pr, 'tblLook');
    // One of our gallery's styles, written as Word's table style "Crumpet Blue" and so on.
    const styleVal = attr(child(pr, 'tblStyle'), 'val');
    const galleryStyle = (Object.keys(TABLE_STYLES) as TableStyleKey[]).find((k) => wordTableStyle(k) === styleVal);
    const first = attr(lookEl, 'firstRow') ?? (attr(lookEl, 'val') ? String((parseInt(attr(lookEl, 'val')!, 16) & 0x20) >> 5) : '1');
    // A heading row is bold anyway: its own bold isn't kept.
    if (first !== '0') tidy[0] = tidy[0].map((cell) => cellText(cellRuns(cell).map((x) => ({ ...x, marks: x.marks.filter((m) => m !== 'bold') }))));
    const bdr = child(pr, 'tblBorders');
    const drawn = (side: string) => {
      const v = attr(child(bdr, side), 'val');
      return v !== null && v !== 'none' && v !== 'nil';
    };
    let borders: TableLook['borders'];
    if (bdr) {
      const sides = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].filter(drawn).join();
      borders = sides === 'top,left,bottom,right' ? 'outside' : sides === 'top,bottom,insideH' || sides === 'insideH' ? 'rows' : sides === '' ? 'none' : undefined;
    }
    // Column widths, when they aren't all the same.
    const grid = kids(child(t, 'tblGrid') ?? t).filter((x) => x.localName === 'gridCol').map((g) => Number(attr(g, 'w') ?? 0));
    const even = grid.length !== tidy[0].length || grid.some((x) => !(x > 0)) || Math.max(...grid) - Math.min(...grid) <= Math.max(...grid) * 0.02;
    const tbl = tidyTable({ widths: even ? undefined : grid, noHeader: first === '0', banded: styleVal === 'TableGridBanded' || (!!galleryStyle && attr(lookEl, 'noHBand') === '0'), style: galleryStyle, borders, merges, shades, aligns }, tidy.length, tidy[0].length);
    blocks.push(makeBlock('table', '', [], { rows: tidy, ...(tbl ? { tbl } : {}) }));
  };

  const body = xml.getElementsByTagNameNS(W_NS, 'body')[0];
  const walk = async (el: Element) => {
    for (const c of kids(el)) {
      if (c.localName === 'p') {
        await paragraph(c);
        const sp = child(child(c, 'pPr'), 'sectPr');
        if (sp) sectEnds.push({ end: blocks.length, props: readSect(sp) });
      }
      else if (c.localName === 'tbl') await table(c);
      else if (c.localName === 'commentRangeStart') openComments.push(attr(c, 'id') ?? '');
      else if (c.localName === 'commentRangeEnd') {
        const k = openComments.lastIndexOf(attr(c, 'id') ?? '');
        if (k >= 0) openComments.splice(k, 1);
      }
      else if (c.localName === 'sdt') {
        // Word's Table of Contents is a box of its own: it becomes one, and its lines aren't kept as text.
        const gallery = attr(child(child(child(c, 'sdtPr'), 'docPartObj'), 'docPartGallery'), 'val');
        if (gallery === 'Table of Contents') {
          if (blocks[blocks.length - 1]?.type !== 'toc') blocks.push(makeBlock('toc'));
        } else await walk(child(c, 'sdtContent') ?? c);
      }
      else if (c.localName === 'customXml') await walk(c);
    }
  };
  if (body) await walk(body);
  // Sections: each one after the first starts with a section break on its first block.
  const bodySect = child(body, 'sectPr');
  const sects = [...sectEnds.map((x) => x.props), bodySect ? readSect(bodySect) : ({ margins: {}, cont: false, cols: 1, landscape: false } as SectRead)];
  const startsAt = [0, ...sectEnds.map((x) => x.end)];
  for (let k = sects.length - 1; k >= 0; k--) {
    let at = startsAt[k];
    const sp = sects[k];
    const prev = sects[k - 1];
    if (k === 0 && sp.cols === 1 && !sp.landscape) continue;
    // (The first section's settings go on the first paragraph; a document starting with a picture or table keeps the page setup's.)
    if (k === 0 && blocks[0] && (isMediaType(blocks[0].type) || blocks[0].type === 'table' || blocks[0].type === 'toc')) continue;
    if (k > 0 && at >= blocks.length) continue;
    // A section starting with a picture or table: an empty line before it holds the break.
    if (blocks[at] && (isMediaType(blocks[at].type) || blocks[at].type === 'table' || blocks[at].type === 'toc')) {
      blocks.splice(at, 0, makeBlock('paragraph'));
    }
    if (!blocks[at]) at = blocks.push(makeBlock('paragraph')) - 1;
    const b = blocks[at];
    const orient = sp.landscape ? 'landscape' : prev?.landscape || k === 0 ? 'portrait' : undefined;
    // A section's own margins: where they differ from the section before.
    const own = (key: 'mt' | 'mb' | 'ml' | 'mr') => (k > 0 && prev && sp.margins[key] !== undefined && sp.margins[key] !== prev.margins[key] ? sp.margins[key] : undefined);
    b.para = tidyPara({ ...b.para, sect: k > 0 && sp.cont ? 'cont' : 'page', cols: k === 0 ? sp.cols : sp.cols !== prev?.cols ? sp.cols : undefined, orient: k === 0 ? (sp.landscape ? 'landscape' : undefined) : orient, mt: own('mt'), mb: own('mb'), ml: own('ml'), mr: own('mr') });
  }
  // Where Word's numbering differs from what the list shows on its own (carrying on after a paragraph, or starting again), keep Word's.
  const shown: number[] = [];
  for (const b of blocks) {
    const l = b.indent ?? 0;
    if (b.type === 'numbered') {
      shown[l] = (shown[l] ?? 0) + 1;
      shown.fill(0, l + 1);
      const want = wordNumber.get(b);
      if (want !== undefined && want !== shown[l]) {
        b.para = tidyPara({ ...b.para, start: want });
        shown[l] = want;
      }
    } else if (isListType(b.type)) shown.fill(0, l);
    else shown.length = 0;
  }
  // Trailing empty paragraphs aren't wanted.
  while (blocks.length > 1 && blocks[blocks.length - 1].type === 'paragraph' && !blocks[blocks.length - 1].runs.length && !blocks[blocks.length - 1].style) blocks.pop();
  return { title: title || coreTitle, doc: { blocks: blocks.length ? blocks : [makeBlock('paragraph')] } };
}

/** The id of a gallery table style in Word ("CrumpetBlue", shown as "Crumpet Blue"). */
function wordTableStyle(key: TableStyleKey): string {
  return `Crumpet${key[0].toUpperCase()}${key.slice(1)}`;
}

/** The gallery's table styles as Word table styles: the heading row filled (bold, its text white or black), bands and lines paler. */
function tableStylesXml(): string {
  return (Object.keys(TABLE_STYLES) as TableStyleKey[])
    .map((key) => {
      const c = tableStyleColors(key);
      const hex = (x: string) => x.slice(1).toUpperCase();
      const side = (name: string, sz = 4, color = c.line) => `<w:${name} w:val="single" w:sz="${sz}" w:space="0" w:color="${hex(color)}"/>`;
      const borders = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((n) => side(n)).join('')}</w:tblBorders>`;
      const headCell = c.head ? `<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${hex(c.head)}"/></w:tcPr>` : `<w:tcPr><w:tcBorders>${side('bottom', 12, TABLE_STYLES[key].color)}</w:tcBorders></w:tcPr>`;
      const headRun = `<w:rPr><w:b/>${c.headText ? `<w:color w:val="${hex(c.headText)}"/>` : ''}</w:rPr>`;
      return `<w:style w:type="table" w:customStyle="1" w:styleId="${wordTableStyle(key)}"><w:name w:val="Crumpet ${TABLE_STYLES[key].name}"/><w:basedOn w:val="TableGrid"/><w:tblPr><w:tblStyleRowBandSize w:val="1"/>${borders}</w:tblPr><w:tblStylePr w:type="firstRow">${headRun}${headCell}</w:tblStylePr><w:tblStylePr w:type="band1Horz"><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${hex(c.band)}"/></w:tcPr></w:tblStylePr></w:style>`;
    })
    .join('');
}
