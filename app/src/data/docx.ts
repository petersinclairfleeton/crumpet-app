// Word documents (.docx): writing a note or a manuscript as one, and reading
// one into a note. A .docx is a zip of XML files; we write the parts Word
// needs (styles, lists, footnotes, pictures, headers and footers) and read
// back what Crumpet can show.

import { type Block, type BlockType, type Change, type Comment, type CommentReply, type Doc, type Look, type Mark, type ParaLook, type Run, type TabStop, type BulletKind, type NumFormat, BULLETS, FOOTNOTE, FIELD, runsText, sliceRuns, tidyLook, lookValueOk, tidyPara, commentId, makeBlock, normalizeRuns, sortMarks, tidyRows } from '@crumpet/editor/model';
import { type CellLook, TABLE_STYLES, type TableLook, type TableStyleKey, mergeAt, tableStyleColors, tidyTable } from '@crumpet/editor/table';
import { evaluateCell, formatValue, isFormula } from '@crumpet/editor/formula';
import { cellPlain, cellRuns, cellText } from '@crumpet/editor/cells';
import { type LineEnd, type ShapeKind, type ShapeLook, WORD_SHAPES, isLineKind, tidyShape } from '@crumpet/editor/shape';
import { FIELDS, fieldFromWord, fieldValue, wordInstr } from '@crumpet/editor/fields';
import { figureEntries, indexEntries } from '@crumpet/editor/lists';
import { type PicLook, tidyPic } from '@crumpet/editor/picture';
import { type HFBand, type HFRun, type HFSet, type HeadersFooters, bandEmpty, tidyRuns } from './headers';
import { decodeBand, encodeBand } from './sectionhf';
import { colourSet, firstFamily, fontPair, spacing } from './doctheme';
import { drawingMLToShape, pathToDrawingML, pointsToPath } from './svgpath';
import { type CustomStyle, type PageSetup, type StyleDef, type StyleKey, paperInches } from './styles';
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
  /** Styles of one's own the text uses, written as Word styles of the same names. */
  custom?: CustomStyle[];
  /** A bibliography's lines (the sources cited, in the citation style), and a citation's text. */
  sources?(): string[];
  cite?(key: string): string;
}

/** A style of one's own's Word style id. */
function customWordId(id: string): string {
  return `My${id.slice(2).replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()).replace(/^[a-z]/, (c) => c.toUpperCase())}`;
}

const WORD_BASE: Partial<Record<StyleKey, string>> = { normal: 'Normal', title: 'Title', subtitle: 'Subtitle', heading1: 'Heading1', heading2: 'Heading2', heading3: 'Heading3', heading4: 'Heading4', quote: 'Quote', epigraph: 'Epigraph', caption: 'Caption' };

/** Styles of one's own as Word paragraph styles, based on the built-in one each started from. */
function customStylesXml(custom: CustomStyle[]): string {
  return custom
    .map((c) => {
      const d = c.def;
      const rpr = (d.font ? `<w:rFonts w:ascii="${esc(d.font.family)}" w:hAnsi="${esc(d.font.family)}" w:cs="${esc(d.font.family)}"/>` : '') + (d.bold ? '<w:b/>' : '<w:b w:val="0"/>') + (d.italic ? '<w:i/>' : '<w:i w:val="0"/>') + (d.caps ? '<w:caps/>' : '') + (d.size ? `<w:sz w:val="${Math.round(d.size * 2)}"/><w:szCs w:val="${Math.round(d.size * 2)}"/>` : '');
      const jc = d.align === 'left' ? 'left' : d.align === 'center' ? 'center' : d.align === 'right' ? 'right' : 'both';
      const ppr = `<w:spacing w:before="${Math.round(d.spaceBefore * 20)}" w:after="${Math.round(d.spaceAfter * 20)}" w:line="${Math.round((d.lineSpacing / 1.15) * 240)}" w:lineRule="auto"/><w:ind w:left="${Math.round(d.leftIndent * 1440)}" ${d.firstIndent < 0 ? `w:hanging="${Math.round(-d.firstIndent * 1440)}"` : `w:firstLine="${Math.round(d.firstIndent * 1440)}"`}/><w:jc w:val="${jc}"/>${c.base.startsWith('heading') ? `<w:outlineLvl w:val="${Number(c.base.slice(-1)) - 1}"/>` : ''}`;
      return `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${customWordId(c.id)}"><w:name w:val="${esc(c.name)}"/><w:basedOn w:val="${WORD_BASE[c.base] ?? 'Normal'}"/><w:next w:val="Normal"/><w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
    })
    .join('');
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
  endnotes: string[] = [];
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

  /** Fields' values as written (Word works them out again when the file opens): captions' numbers, and what each bookmark's cross-references show. */
  private seqCount = new Map<string, number>();
  private refText = new Map<string, { num: string; text: string }>();
  private nextBookmark = 1;

  prepareFields(parts: DocxPart[]): void {
    const count = new Map<string, number>();
    for (const p of parts)
      for (const b of p.doc.blocks) {
        let caption = '';
        let text = '';
        const marks: string[] = [];
        for (const r of b.runs) {
          if (r.change?.kind === 'del' || r.footnote !== undefined) continue;
          if (r.field?.startsWith('seq:')) {
            const label = r.field.slice(4);
            const n = (count.get(label) ?? 0) + 1;
            count.set(label, n);
            caption ||= `${label} ${n}`;
            text += String(n);
          } else if (r.field?.startsWith('bm:')) marks.push(r.field.slice(3));
          else if (r.field === undefined) text += r.text;
        }
        text = text.replace(/\s+/g, ' ').trim();
        for (const m of marks) if (!this.refText.has(m)) this.refText.set(m, { num: caption || text.slice(0, 60), text });
      }
  }

  /** What a field shows in the file. */
  fieldShown(name: string): string {
    if (name.startsWith('seq:')) {
      const label = name.slice(4);
      const n = (this.seqCount.get(label) ?? 0) + 1;
      this.seqCount.set(label, n);
      return String(n);
    }
    if (name.startsWith('ref:')) {
      const [, target, how] = name.split(':');
      const r = this.refText.get(target);
      return how === 'page' ? '1' : how === 'dir' ? 'above' : how === 'text' ? (r?.text ?? '') : (r?.num ?? '');
    }
    if (name === 'page' || name === 'pages') return '1';
    if (name === 'title') return this.opts.title;
    if (name === 'author') return this.opts.author ?? '';
    if (name.startsWith('cite:')) return this.opts.cite?.(name.slice(5)) ?? `(${name.slice(5)})`;
    if (name.startsWith('xe:')) return '';
    return fieldValue(name);
  }

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
    // Word's Font window, each where Word expects it.
    if (look?.caps === 'all') p += '<w:caps/>';
    if (look?.caps === 'small') p += '<w:smallCaps/>';
    if (marks.includes('strike')) p += '<w:strike/>';
    if (look?.dstrike) p += '<w:dstrike/>';
    const FX: Record<string, string> = { outline: '<w:outline/>', shadow: '<w:shadow/>', emboss: '<w:emboss/>', engrave: '<w:imprint/>' };
    if (look?.fx && FX[look.fx]) p += FX[look.fx];
    if (look?.hidden) p += '<w:vanish/>';
    if (look?.color) p += `<w:color w:val="${look.color.slice(1).toUpperCase()}"/>`;
    if (look?.sp) p += `<w:spacing w:val="${Math.round(look.sp * 20)}"/>`;
    if (look?.pos && !look.va) p += `<w:position w:val="${Math.round(look.pos * 2)}"/>`;
    if (look?.size) p += `<w:sz w:val="${Math.round(look.size * 2)}"/><w:szCs w:val="${Math.round(look.size * 2)}"/>`;
    const named = look?.highlight ? HIGHLIGHT_NAME[look.highlight.toLowerCase()] : undefined;
    if (named) p += `<w:highlight w:val="${named}"/>`;
    const UL: Record<string, string> = { single: 'single', double: 'double', dotted: 'dotted', dashed: 'dash', wavy: 'wave', thick: 'thick' };
    if (look?.ul) p += `<w:u w:val="${UL[look.ul]}"${look.ulc ? ` w:color="${look.ulc.slice(1).toUpperCase()}"` : ''}/>`;
    else if (marks.includes('underline')) p += '<w:u w:val="single"/>';
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
    if (r.footnote !== undefined && r.endnote) {
      const id = this.endnotes.length + 1;
      this.endnotes.push(r.footnote);
      return `<w:r><w:rPr><w:rStyle w:val="EndnoteReference"/></w:rPr><w:endnoteReference w:id="${id}"/></w:r>`;
    }
    if (r.footnote !== undefined) {
      const id = this.footnotes.length + 1;
      this.footnotes.push(r.footnote);
      return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`;
    }
    const props = this.props(r.marks, linked, r.look);
    if (r.field !== undefined) {
      // A bookmark: Word's bookmark, at this spot.
      if (r.field.startsWith('bm:')) {
        const id = this.nextBookmark++;
        return `<w:bookmarkStart w:id="${id}" w:name="${esc(r.field.slice(3))}"/><w:bookmarkEnd w:id="${id}"/>`;
      }
      // Word's Text Wrapping break.
      if (r.field === 'wrapbreak') return '<w:r><w:br w:type="textWrapping" w:clear="all"/></w:r>';
      // A citation: its text, as written in the citation style.
      if (r.field.startsWith('cite:')) return `<w:r>${props}<w:t xml:space="preserve">${esc(this.fieldShown(r.field))}</w:t></w:r>`;
      const instr = wordInstr(r.field);
      if (!instr) return '';
      const shown = this.fieldShown(r.field);
      return `<w:fldSimple w:instr="${esc(instr)}">${shown ? `<w:r>${props}<w:t xml:space="preserve">${esc(shown)}</w:t></w:r>` : ''}</w:fldSimple>`;
    }
    const body = r.text
      .replaceAll(FOOTNOTE, '')
      .split(/(\n|\t)/)
      .map((part) => (part === '\n' ? '<w:br/>' : part === '\t' ? '<w:tab/>' : part ? `<w:t xml:space="preserve">${esc(part)}</w:t>` : ''))
      .join('');
    return body ? `<w:r>${props}${body}</w:r>` : '';
  }

  /** Word's drop cap paragraph: the letter in a frame `lines` tall, the text after it wrapping round. */
  dropCap(runs: Run[], lines: number, head: string): string {
    const size = this.opts.size || 12;
    const hp = Math.round(size * 2 * lines * 1.35);
    const big = runs.map((r) => ({ ...r, look: { ...r.look, size: hp / 2 } }));
    const ppr = `${head}<w:framePr w:dropCap="drop" w:lines="${lines}" w:wrap="around" w:vAnchor="text" w:hAnchor="text"/><w:spacing w:before="0" w:after="0" w:line="${hp * 10}" w:lineRule="exact"/><w:textAlignment w:val="baseline"/>`;
    return this.paragraph(null, this.runs(big), ppr);
  }

  /** A tracked change on the next paragraph break: Word keeps it on this paragraph's mark. */
  markNext: Change | null = null;

  /** A block's Word style: its own style's, when it has one Word is told about, else `usual`. */
  styleOf(b: Block, usual: string | null): string | null {
    return b.style?.startsWith('c-') && this.opts.custom?.some((c) => c.id === b.style) ? customWordId(b.style) : usual;
  }

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
    const p = b.pic ?? {};
    // What's left after cropping, at its width as set (or its own), never wider than the page's text.
    const [ct, cr, cb, cl] = p.crop ?? [0, 0, 0, 0];
    const shownW = size.width * (1 - cl - cr);
    const shownH = size.height * (1 - ct - cb);
    const want = p.w ? p.w * 96 : shownW;
    const scale = Math.min(this.contentWidth, want) / shownW;
    const cx = Math.round(shownW * scale * EMU_PER_PX);
    const cy = Math.round(shownH * scale * EMU_PER_PX);
    const pct = (v: number) => Math.round(v * 100000);
    const srcRect = p.crop ? `<a:srcRect l="${pct(cl)}" t="${pct(ct)}" r="${pct(cr)}" b="${pct(cb)}"/>` : '';
    // Corrections Word keeps on the picture itself: brightness and contrast, black and white, see-through.
    const blipFx = (p.bright || p.contrast ? `<a:lum${p.bright ? ` bright="${p.bright * 1000}"` : ''}${p.contrast ? ` contrast="${p.contrast * 1000}"` : ''}/>` : '') + (p.effect === 'grey' ? '<a:grayscl/>' : '') + (p.fade ? `<a:alphaModFix amt="${(100 - p.fade) * 1000}"/>` : '');
    const PRST: Record<string, string> = { oval: 'ellipse', rounded: 'roundRect', triangle: 'triangle', diamond: 'diamond', hexagon: 'hexagon', star: 'star5' };
    const prst = (p.mask && PRST[p.mask]) || (p.style === 'rounded' ? 'roundRect' : 'rect');
    const lineColor = p.border ?? (p.style === 'frame' ? '#2b2b2b' : p.style === 'white' || p.style === 'polaroid' ? '#ffffff' : undefined);
    const ln = lineColor ? `<a:ln w="${p.style === 'white' || p.style === 'polaroid' ? 76200 : 38100}"><a:solidFill><a:srgbClr val="${lineColor.slice(1).toUpperCase()}"/></a:solidFill></a:ln>` : '';
    const shadow = p.style === 'shadow' || p.style === 'white' || p.style === 'rounded' || p.style === 'polaroid' ? '<a:effectLst><a:outerShdw blurRad="101600" dist="38100" dir="5400000" algn="t" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="40000"/></a:srgbClr></a:outerShdw></a:effectLst>' : '';
    const alt = esc(p.alt || b.runs.map((r) => r.text).join('') || 'Picture');
    const docPr = `<wp:docPr id="${n}" name="Picture ${n}" descr="${alt}"${p.hide ? ' hidden="1"' : ''}/>`;
    const graphic =
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${id}"${blipFx ? `>${blipFx}</a:blip>` : '/>'}${srcRect}<a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm${p.rot ? ` rot="${p.rot * 60000}"` : ''}><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${ln}${shadow}</pic:spPr></pic:pic></a:graphicData></a:graphic>`;
    const EMU = 914400;
    const anchor = (pos: string, wrapXml: string, dist: string) => `<wp:anchor ${dist} simplePos="0" relativeHeight="${251659264 + n}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>${pos}<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>${wrapXml}${docPr}<wp:cNvGraphicFramePr/>${graphic}</wp:anchor>`;
    const drawing =
      p.wrap === 'left' || p.wrap === 'right'
        ? anchor(`<wp:positionH relativeFrom="column"><wp:align>${p.wrap}</wp:align></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>`, '<wp:wrapSquare wrapText="bothSides"/>', 'distT="45720" distB="45720" distL="114300" distR="114300"')
        : p.wrap === 'free'
          ? anchor(`<wp:positionH relativeFrom="column"><wp:posOffset>${Math.round((p.x ?? 0) * EMU)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${Math.round((p.y ?? 0) * EMU)}</wp:posOffset></wp:positionV>`, '<wp:wrapNone/>', 'distT="0" distB="0" distL="114300" distR="114300"')
          : `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>${docPr}${graphic}</wp:inline>`;
    const jc = `<w:jc w:val="${JC[b.align ?? ''] ?? (b.align === 'left' ? 'left' : 'center')}"/>`;
    return this.paragraph(null, `<w:r><w:drawing>${drawing}</w:drawing></w:r>`, `<w:keepNext/>${jc}`);
  }

  private nextShape = 1;
  /** Linked text boxes: each chain's number in Word, and how many of its boxes are written. */
  private chains: Record<string, { id: number; seq: number }> = {};

  /**
   * A text box or shape, as Word draws one (a DrawingML shape): in line
   * with the text, or anchored to its paragraph with the text wrapping
   * round it on the left or right.
   */
  async shape(b: Block, lead: string): Promise<string> {
    const s = b.shape;
    if (!s) return '';
    const EMU = 914400;
    const cx = Math.round(s.w * EMU);
    const cy = Math.round(s.h * EMU);
    const n = 1000 + this.nextShape++;
    const flat = isLineKind(s.kind);
    const prst = WORD_SHAPES[s.kind];
    const hex = (c: string) => c.slice(1).toUpperCase();
    // The fill: a colour, a gradient (top to bottom) or a picture.
    let fill = !flat && s.fill ? `<a:solidFill><a:srgbClr val="${hex(s.fill)}"/></a:solidFill>` : '<a:noFill/>';
    if (!flat && s.grad && s.fill) fill = `<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${hex(s.fill)}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${hex(s.grad)}"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>`;
    if (!flat && s.img) {
      const got = await this.opts.media?.(s.img);
      const ext = got ? imageExt(got.type, got.bytes) : null;
      if (got && ext) {
        const name = `image${this.nextPic++}.${ext === 'jpeg' ? 'jpg' : ext}`;
        this.media.push({ name: `word/media/${name}`, data: got.bytes });
        fill = `<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${this.rel(`${REL}/image`, `media/${name}`)}"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></a:blipFill>`;
      }
    }
    // The line: its thickness, dashes and ends.
    const END = { arrow: 'triangle', open: 'arrow', dot: 'oval' };
    const head = s.head ?? (s.kind === 'arrow' ? 'arrow' : undefined);
    const dash = s.dash ? `<a:prstDash val="${{ dash: 'dash', dot: 'sysDot', dashdot: 'dashDot' }[s.dash]}"/>` : '';
    const ends = flat ? `${s.tail ? `<a:headEnd type="${END[s.tail]}"/>` : ''}${head ? `<a:tailEnd type="${END[head]}"/>` : ''}` : '';
    const line = s.line || flat ? `<a:ln w="${Math.round((s.lw ?? 1.5) * 12700)}"><a:solidFill><a:srgbClr val="${hex(s.line ?? '#333333')}"/></a:solidFill>${dash}${ends}</a:ln>` : '<a:ln><a:noFill/></a:ln>';
    // An effect.
    const glow = s.fill ?? s.line ?? '#4472C4';
    const effect =
      s.fx === 'shadow' ? '<a:effectLst><a:outerShdw blurRad="50800" dist="38100" dir="2700000" algn="tl" rotWithShape="0"><a:prstClr val="black"><a:alpha val="40000"/></a:prstClr></a:outerShdw></a:effectLst>'
      : s.fx === 'glow' ? `<a:effectLst><a:glow rad="101600"><a:srgbClr val="${hex(glow)}"><a:alpha val="60000"/></a:srgbClr></a:glow></a:effectLst>`
      : s.fx === 'soft' ? '<a:effectLst><a:softEdge rad="63500"/></a:effectLst>'
      : s.fx === 'reflect' ? '<a:effectLst><a:reflection blurRad="6350" stA="50000" endA="300" endPos="55000" dir="5400000" sy="-100000" algn="bl" rotWithShape="0"/></a:effectLst>'
      : s.fx === 'bevel' ? '<a:effectLst><a:outerShdw blurRad="50800" dist="38100" dir="2700000" algn="tl" rotWithShape="0"><a:prstClr val="black"><a:alpha val="40000"/></a:prstClr></a:outerShdw></a:effectLst><a:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/></a:scene3d><a:sp3d><a:bevelT w="63500" h="25400"/></a:sp3d>'
      : '';
    // The text, in its colour: a paragraph for each line, aligned as set.
    const runs = cellRuns(s.text).map((r) => (s.tc && !r.look?.color ? { ...r, look: { ...r.look, color: s.tc } } : r));
    const lines: Run[][] = [[]];
    for (const r of runs) {
      const bits = r.text.split('\n');
      bits.forEach((t, k) => {
        if (k > 0) lines.push([]);
        if (t) lines[lines.length - 1].push({ ...r, text: t });
      });
    }
    const textJc = `<w:jc w:val="${s.ta === 'left' ? 'left' : s.ta === 'right' ? 'right' : 'center'}"/>`;
    const content = `<w:txbxContent>${lines.map((l) => this.paragraph(null, this.runs(l), textJc)).join('')}</w:txbxContent>`;
    // Linked text boxes: the first holds the text, the rest carry it on.
    let text = '';
    if (!flat && s.chain) {
      const link = (this.chains[s.chain] ??= { id: Object.keys(this.chains).length + 1, seq: 0 });
      text = link.seq++ === 0 ? `<wps:txbx id="${link.id}">${content}</wps:txbx>` : `<wps:linkedTxbx id="${link.id}" seq="${link.seq - 1}"/>`;
    } else if (!flat && s.text) text = `<wps:txbx>${content}</wps:txbx>`;
    const geom = s.kind === 'freeform' && s.pts ? pathToDrawingML(pointsToPath(s.pts), [1, 1]) : s.kind === 'path' && s.d ? pathToDrawingML(s.d, s.vb ?? [24, 24]) : `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>`;
    const vert = s.dir === 'down' ? 'vert' : s.dir === 'up' ? 'vert270' : 'horz';
    const anchorText = s.tv === 'top' || s.chain ? 't' : s.tv === 'bottom' ? 'b' : 'ctr';
    const wsp = `<wps:wsp><wps:cNvSpPr${s.text || s.chain ? ' txBox="1"' : ''}/><wps:spPr><a:xfrm${s.rot ? ` rot="${s.rot * 60000}"` : ''}><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${flat ? 0 : cy}"/></a:xfrm>${geom}${fill}${line}${effect}</wps:spPr>${text}<wps:bodyPr rot="0" vert="${vert}" wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="${anchorText}"><a:noAutofit/></wps:bodyPr></wps:wsp>`;
    const graphic = `<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">${wsp}</a:graphicData></a:graphic>`;
    const name = `<wp:docPr id="${n}" name="${s.text ? 'Text Box' : 'Shape'} ${n}"${s.hide ? ' hidden="1"' : ''}/><wp:cNvGraphicFramePr/>`;
    // Placed anywhere: from the column and paragraph, or the page or its margins; in front of or behind the text, in its place in the stack.
    const height = 251659264 + (s.z ?? 0) * 1024 + n;
    const fromH = s.rel === 'page' ? 'page' : s.rel === 'margin' ? 'margin' : 'column';
    const fromV = s.rel === 'page' ? 'page' : s.rel === 'margin' ? 'margin' : 'paragraph';
    const anchor = (dist: string, behind: boolean, pos: string, wrapXml: string) =>
      `<wp:anchor ${dist} simplePos="0" relativeHeight="${height}" behindDoc="${behind ? 1 : 0}" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>${pos}<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>${wrapXml}${name}${graphic}</wp:anchor>`;
    const tightPolygon = '<wp:wrapPolygon edited="0"><wp:start x="0" y="0"/><wp:lineTo x="0" y="21600"/><wp:lineTo x="21600" y="21600"/><wp:lineTo x="21600" y="0"/><wp:lineTo x="0" y="0"/></wp:wrapPolygon>';
    const drawing =
      s.wrap === 'inline'
        ? `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>${name}${graphic}</wp:inline>`
        : s.wrap === 'free' || s.wrap === 'behind'
          ? anchor('distT="0" distB="0" distL="114300" distR="114300"', s.wrap === 'behind', `<wp:positionH relativeFrom="${fromH}"><wp:posOffset>${Math.round((s.x ?? 0) * EMU)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="${fromV}"><wp:posOffset>${Math.round((s.y ?? 0) * EMU)}</wp:posOffset></wp:positionV>`, '<wp:wrapNone/>')
          : s.wrap === 'topbottom'
            ? anchor('distT="45720" distB="45720" distL="114300" distR="114300"', false, `<wp:positionH relativeFrom="column"><wp:posOffset>${Math.round((s.x ?? 0) * EMU)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>`, '<wp:wrapTopAndBottom/>')
            : anchor('distT="45720" distB="45720" distL="114300" distR="114300"', false, `<wp:positionH relativeFrom="column"><wp:align>${s.wrap}</wp:align></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>`, s.tight ? `<wp:wrapTight wrapText="bothSides">${tightPolygon}</wp:wrapTight>` : '<wp:wrapSquare wrapText="bothSides"/>');
    const jc = b.align && b.align !== 'left' && s.wrap === 'inline' ? `<w:jc w:val="${JC[b.align] ?? b.align}"/>` : '';
    return this.paragraph(null, `<w:r><w:drawing>${drawing}</w:drawing></w:r>`, lead + jc);
  }

  /** Word's own Table of Contents field: Word fills in the page numbers when it updates the field (it asks on opening). */
  /** The blocks being written now (a table of figures or an index lists what's in them). */
  private current: Block[] = [];

  toc(b?: Block): string {
    const t = b?.tocl;
    const tab = `<w:tabs><w:tab w:val="right" w:leader="${t?.noDots ? 'none' : 'dot'}" w:pos="${Math.round((this.contentWidth / 96) * TWIPS)}"/></w:tabs>`;
    const kind = t?.kind;
    const instr = kind === 'figures' ? ` TOC \\h \\z \\c "${t?.label ?? 'Figure'}" ` : kind === 'index' ? ' INDEX \\e "	" \\h "A" ' : kind === 'sources' ? ' BIBLIOGRAPHY ' : ` TOC \\o "1-${t?.levels ?? 3}" \\h \\z \\u${t?.noPages ? ' \\n' : ''} `;
    const field = `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">${instr.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>`;
    const end = '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
    const listed: { level: number; text: string }[] =
      kind === 'figures' ? figureEntries({ blocks: this.current }, t?.label ?? 'Figure') : kind === 'index' ? indexEntries({ blocks: this.current }) : kind === 'sources' ? (this.opts.sources?.() ?? []).map((text) => ({ level: 1, text })) : this.tocEntries.filter((e) => e.level <= (t?.levels ?? 3));
    const entries = listed.length ? listed : [{ level: 1, text: '' }];
    const style = (level: number) => (kind === 'figures' ? 'TableofFigures' : kind === 'index' ? `Index${Math.min(2, level)}` : kind === 'sources' ? 'Bibliography' : `TOC${Math.min(3, level)}`);
    const lines = entries.map((e, i) => this.paragraph(style(e.level), (i === 0 ? field : '') + (e.text ? `<w:r><w:t xml:space="preserve">${esc(e.text)}</w:t></w:r>` : '') + (i === entries.length - 1 ? end : ''), kind === 'sources' ? '' : tab)).join('');
    const title = t?.title ?? (kind === 'figures' ? 'Table of figures' : kind === 'index' ? 'Index' : kind === 'sources' ? 'Bibliography' : 'Contents');
    if (kind) return this.paragraph('TOCHeading', `<w:r><w:t>${esc(title)}</w:t></w:r>`) + lines;
    return `<w:sdt><w:sdtPr><w:docPartObj><w:docPartGallery w:val="Table of Contents"/><w:docPartUnique/></w:docPartObj></w:sdtPr><w:sdtContent>${this.paragraph('TOCHeading', `<w:r><w:t>${esc(title)}</w:t></w:r>`)}${lines}</w:sdtContent></w:sdt>`;
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
    const plain = rows.some((row) => row.some(isFormula)) ? rows.map((row) => row.map(cellPlain)) : null;
    const BDR: Record<string, [string, number]> = { single: ['single', 4], thick: ['single', 18], double: ['double', 4], dotted: ['dotted', 6], dashed: ['dashed', 6] };
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
            const own = t?.cells?.[`${r},${c}`];
            // The cell's own lines.
            let tcBorders = '';
            if (own?.bd) {
              const [bv, bs] = BDR[own.bs ?? 'single'];
              const color = own.bc ? own.bc.slice(1).toUpperCase() : 'auto';
              tcBorders = `<w:tcBorders>${(['t:top', 'l:left', 'b:bottom', 'r:right'] as const).filter((x) => own.bd === '0' || own.bd!.includes(x[0])).map((x) => (own.bd === '0' ? `<w:${x.slice(2)} w:val="nil"/>` : `<w:${x.slice(2)} w:val="${bv}" w:sz="${bs}" w:space="0" w:color="${color}"/>`)).join('')}</w:tcBorders>`;
            }
            const shade = t?.shades?.[`${r},${c}`];
            const shd = shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade.slice(1).toUpperCase()}"/>` : '';
            const dir = own?.dir ? `<w:textDirection w:val="${own.dir === 'up' ? 'btLr' : 'tbRl'}"/>` : '';
            const vAlign = own?.v ? `<w:vAlign w:val="${own.v === 'middle' ? 'center' : 'bottom'}"/>` : '';
            const align = own?.h ?? t?.aligns?.[c];
            const jc = align && align !== 'left' ? `<w:jc w:val="${align}"/>` : '';
            const tcPr = `<w:tcPr>${width}${span}${vMerge}${tcBorders}${shd}${dir}${vAlign}</w:tcPr>`;
            // A formula goes to Word as its field, showing what it comes to.
            if (plain && isFormula(text)) {
              const value = formatValue(evaluateCell(plain, r, c));
              const bold = r === 0 && head ? '<w:rPr><w:b/></w:rPr>' : '';
              return `<w:tc>${tcPr}${this.paragraph('TableText', `<w:fldSimple w:instr=" ${esc(text.trim())} "><w:r>${bold}<w:t xml:space="preserve">${esc(value)}</w:t></w:r></w:fldSimple>`, jc)}</w:tc>`;
            }
            // The heading row is bold; a cell's own formatting is kept. Each line in the cell is a paragraph of its own.
            const cell = cellRuns(text).map((x) => (r === 0 && head ? { ...x, marks: sortMarks([...new Set<Mark>([...x.marks, 'bold'])]) } : x));
            const paras: Run[][] = [[]];
            for (const x of cell) {
              const parts = x.text.split('\n');
              parts.forEach((part, k) => {
                if (k) paras.push([]);
                if (part) paras[paras.length - 1].push({ ...x, text: part });
              });
            }
            return `<w:tc>${tcPr}${paras.map((p) => this.paragraph('TableText', this.runs(p), jc)).join('')}</w:tc>`;
          })
          .join('');
        const height = t?.heights?.[r] ? `<w:trHeight w:val="${Math.round(t.heights[r]! * TWIPS)}" w:hRule="atLeast"/>` : '';
        const repeat = r === 0 && head && !t?.noRepeat ? '<w:tblHeader/>' : '';
        return `<w:tr>${height || repeat ? `<w:trPr>${height}${repeat}</w:trPr>` : ''}${cells}</w:tr>`;
      })
      .join('');
    const lineColor = t?.style ? tableStyleColors(t.style).line.slice(1).toUpperCase() : 'auto';
    const line = (side: string, on: boolean) => `<w:${side} w:val="${on ? 'single' : 'none'}" w:sz="4" w:space="0" w:color="${lineColor}"/>`;
    // Lines other than Table Grid's every line: which of top, left, bottom, right, between rows, between columns are drawn.
    const ON: Record<string, string> = { outside: 'tlbr', rows: 'tbh', none: '' };
    const on = t?.borders ? ON[t.borders] : null;
    const borders = on === null ? '' : `<w:tblBorders>${(['t:top', 'l:left', 'b:bottom', 'r:right', 'h:insideH', 'v:insideV'] as const).map((x) => line(x.slice(2), on.includes(x[0]))).join('')}</w:tblBorders>`;
    const flag = (v: boolean | undefined) => (v ? 1 : 0);
    const look = `<w:tblLook w:val="${head ? '04A0' : '0480'}" w:firstRow="${flag(head)}" w:lastRow="${flag(t?.totalRow)}" w:firstColumn="${flag(t?.firstCol)}" w:lastColumn="${flag(t?.lastCol)}" w:noHBand="${t?.banded ? 0 : 1}" w:noVBand="${t?.bandedCols ? 0 : 1}"/>`;
    const pad = t?.pad !== undefined ? `<w:tblCellMar><w:top w:w="${Math.round(t.pad * TWIPS)}" w:type="dxa"/><w:left w:w="${Math.round(t.pad * TWIPS)}" w:type="dxa"/><w:bottom w:w="${Math.round(t.pad * TWIPS)}" w:type="dxa"/><w:right w:w="${Math.round(t.pad * TWIPS)}" w:type="dxa"/></w:tblCellMar>` : '';
    const styleId = t?.style ? wordTableStyle(t.style) : t?.banded ? 'TableGridBanded' : 'TableGrid';
    return `<w:tbl><w:tblPr><w:tblStyle w:val="${styleId}"/>${t?.widths ? `<w:tblW w:w="${Math.round(full)}" w:type="dxa"/>` : '<w:tblW w:w="0" w:type="auto"/>'}${borders}${t?.widths ? '<w:tblLayout w:type="fixed"/>' : ''}${pad}${look}</w:tblPr>${grid}${tr}</w:tbl>`;
  }

  /** A section's settings where they go (filled in once the page setup is written; see sectionXml in toDocx). */
  sectionMark(): string {
    this.sections++;
    return `<!--crumpet-sect:${JSON.stringify(this.section)}-->`;
  }

  async blocks(blocks: Block[], first: string): Promise<string> {
    this.current = blocks;
    let out = '';
    let num = 0;
    let bul = 0;
    const newList = (bullet: boolean, start?: [number, number]) => this.lists.push({ bullet, levels: [], start });
    for (let [k, b] of blocks.entries()) {
      // (A table or picture ending a section: an empty paragraph after it carries the settings.)
      if (this.sectNext) out += this.paragraph(null, '');
      // A section break before this block (on the document's first block, just the first section's settings).
      const sb = b.para?.sect;
      if (sb) {
        const p = b.para!;
        const was = this.section;
        this.section = { cols: p.cols ?? was.cols, orient: p.orient ?? was.orient, type: sb, mt: p.mt ?? was.mt, mb: p.mb ?? was.mb, ml: p.ml ?? was.ml, mr: p.mr ?? was.mr, pw: p.pw ?? was.pw, ph: p.ph ?? was.ph, hdr: p.hdr, ftr: p.ftr, hfirst: p.hfirst, pstart: p.pstart, pfmt: p.pfmt };
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
        // A pattern of its own for the number ("Chapter %1", "%1.%2"): Word's own level text, the same.
        if (b.para?.numText) (this.lists[num - 1].texts ??= [])[lvl] = b.para.numText;
      } else if (b.type === 'bullet') {
        if (!bul) bul = newList(true);
        if (b.para?.bullet) this.lists[bul - 1].levels[lvl] = b.para.bullet;
      } else if (!isListType(b.type)) num = bul = 0;
      // (Word's Add Text: the paragraph's level in the contents, which comes after the alignment.)
      const jc = (b.align && JC[b.align] ? `<w:jc w:val="${JC[b.align]}"/>` : '') + (b.para?.outline ? `<w:outlineLvl w:val="${b.para.outline - 1}"/>` : b.para?.outline === 0 ? '<w:outlineLvl w:val="9"/>' : '');
      // Paragraph settings set by hand, each where Word expects it: keep and page break first, then spacing and indents.
      const p = b.para;
      const keep = (p?.keepNext ? '<w:keepNext/>' : '') + (p?.keepLines ? '<w:keepLines/>' : '');
      let head = keep + lead + (p?.pageBefore && !lead.includes('pageBreakBefore') ? '<w:pageBreakBefore/>' : '') + (p?.nowidow ? '<w:widowControl w:val="0"/>' : '');
      // A drop cap: in Word, a framed paragraph of its own holding the first letter (and any punctuation before it), before the rest.
      if (p?.drop && /^(paragraph|quote|heading\d)$/.test(b.type)) {
        const text = runsText(b.runs);
        const n = /^[\p{P}\s]*[^\p{P}\s]/u.exec(text)?.[0].length ?? 0;
        if (n) {
          out += this.dropCap(sliceRuns(b.runs, 0, n), p.drop, head);
          b = { ...b, runs: sliceRuns(b.runs, n, text.length) };
          head = keep;
        }
      }
      const tw = (inches: number) => Math.round(inches * TWIPS);
      const spacing = p && (p.before !== undefined || p.after !== undefined || p.line !== undefined) ? `<w:spacing${p.before !== undefined ? ` w:before="${Math.round(p.before * 20)}"` : ''}${p.after !== undefined ? ` w:after="${Math.round(p.after * 20)}"` : ''}${p.line !== undefined ? ` w:line="${Math.round(p.line * 240)}" w:lineRule="auto"` : ''}/>` : '';
      const left = p?.left ?? (p?.first !== undefined && p.first < 0 ? -p.first : undefined);
      const ind = p && (left !== undefined || p.right !== undefined || p.first !== undefined) ? `<w:ind${left !== undefined ? ` w:left="${tw(left)}"` : ''}${p.right !== undefined ? ` w:right="${tw(p.right)}"` : ''}${p.first !== undefined ? (p.first < 0 ? ` w:hanging="${tw(-p.first)}"` : ` w:firstLine="${tw(p.first)}"`) : ''}/>` : '';
      const BDR: Record<string, [string, number]> = { single: ['single', 4], thick: ['single', 18], double: ['double', 4], dotted: ['dotted', 6], dashed: ['dashed', 6] };
      const [bval, bsz] = BDR[p?.bstyle ?? 'single'];
      const bcol = p?.bcolor ? p.bcolor.slice(1).toUpperCase() : 'auto';
      const sides = p?.border ? ([['t', 'top'], ['l', 'left'], ['b', 'bottom'], ['r', 'right']] as const).filter(([c]) => p.border!.includes(c)).map(([, side]) => `<w:${side} w:val="${bval}" w:sz="${bsz}" w:space="4" w:color="${bcol}"/>`).join('') : '';
      const box = (sides ? `<w:pBdr>${sides}</w:pBdr>` : '') + (p?.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${p.shade.slice(1).toUpperCase()}"/>` : '');
      const LEADER = { dot: 'dot', dash: 'hyphen', line: 'underscore' } as const;
      const tabs = p?.tabs ? `<w:tabs>${p.tabs.map((t) => `<w:tab w:val="${t.align}"${t.leader ? ` w:leader="${LEADER[t.leader]}"` : ''} w:pos="${tw(t.at)}"/>`).join('')}</w:tabs>` : '';
      const layout = box + tabs + spacing + ind;
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
          out += this.toc(b);
          continue;
        case 'shape':
          out += await this.shape(b, lead);
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
          out += this.paragraph(this.styleOf(b, `Heading${b.type.slice(-1)}`), this.runs(b.runs), head + layout + jc);
          continue;
        case 'quote':
          out += this.paragraph(this.styleOf(b, b.style === 'intense' ? 'IntenseQuote' : 'Quote'), this.runs(b.runs), (CALLOUTS[b.style ?? ''] ? calloutPr(CALLOUTS[b.style!]) : '') + head + layout + jc);
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
          out += this.paragraph(this.styleOf(b, PARA_STYLES[b.style ?? ''] ?? null), this.runs(b.runs), head + layout + jc);
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
/** Headers and footers, with what a watermark needs (VML, as Word writes it). */
const HF_NS = `${NS} xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w10="urn:schemas-microsoft-com:office:word"`;

/** Word's text watermark: a WordArt shape behind the text, slanting (or flat), in a faint colour. */
function textWatermark(text: string, color: string | undefined, flat: boolean): string {
  const shapetype =
    '<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e"><v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/><v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas><v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/><v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles><o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype>';
  const width = 468;
  const height = Math.round(Math.min(160, (width / Math.max(4, text.length)) * 1.6));
  return `<w:r><w:rPr><w:noProof/></w:rPr><w:pict>${shapetype}<v:shape id="PowerPlusWaterMarkObject1" o:spid="_x0000_s2049" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:${width}pt;height:${height}pt;${flat ? '' : 'rotation:315;'}z-index:-251657216;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" o:allowincell="f" fillcolor="${color ?? 'silver'}" stroked="f"><v:fill opacity=".5"/><v:textpath style="font-family:&quot;Calibri&quot;;font-size:1pt" string="${esc(text)}"/><w10:wrap anchorx="margin" anchory="margin"/></v:shape></w:pict></w:r>`;
}

/** Word's picture watermark: the picture behind the text, washed out. */
function pictureWatermark(wPt: number, hPt: number): string {
  return `<w:r><w:rPr><w:noProof/></w:rPr><w:pict><v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f"><v:stroke joinstyle="miter"/><v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/><o:lock v:ext="edit" aspectratio="t"/></v:shapetype><v:shape id="WordPictureWatermark1" o:spid="_x0000_s2050" type="#_x0000_t75" style="position:absolute;margin-left:0;margin-top:0;width:${Math.round(wPt)}pt;height:${Math.round(hPt)}pt;z-index:-251656192;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" o:allowincell="f"><v:imagedata r:id="rIdWm" o:title="" gain="19661f" blacklevel="22938f"/></v:shape></w:pict></w:r>`;
}

const DOC_NS = `${NS} xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="wps"`;

/** The document's design (theme colours, fonts, effects, spacing), by name, kept in Word's settings to come back. */
function designVar(p: ParaLook | undefined): string {
  const v = (['thc', 'thf', 'thx', 'psp'] as const).filter((k) => p?.[k]).map((k) => `${k}=${p![k]}`).join(';');
  return v ? `<w:docVars><w:docVar w:name="CrumpetDesign" w:val="${v}"/></w:docVars>` : '';
}

/** Word's styles in the document's theme: headings' font and colour, the body's font, links, and paragraph spacing. */
function themeStyles(xml: string, p: ParaLook | undefined): string {
  const c = colourSet(p?.thc);
  const f = fontPair(p?.thf);
  const sp = spacing(p?.psp);
  if (f) {
    const body = esc(firstFamily(f.body));
    xml = xml.replace(/(<w:rPrDefault><w:rPr>)<w:rFonts [^>]*\/>/, `$1<w:rFonts w:ascii="${body}" w:hAnsi="${body}" w:eastAsia="${body}" w:cs="${body}"/>`);
  }
  if (sp) xml = xml.replace(/(<w:pPrDefault><w:pPr>)<w:spacing [^>]*\/>/, `$1<w:spacing w:before="${(sp.before ?? 0) * 20}" w:after="${sp.after * 20}" w:line="${Math.round(sp.line * 240)}" w:lineRule="auto"/>`);
  if (c) xml = xml.replace('<w:color w:val="0563C1"/>', `<w:color w:val="${c.link.slice(1).toUpperCase()}"/>`);
  for (const id of ['Heading1', 'Heading2', 'Heading3', 'Heading4', 'Title', 'Subtitle']) {
    xml = xml.replace(new RegExp(`(<w:style w:type="paragraph" w:styleId="${id}">.*?<w:rPr>)(.*?)(</w:rPr></w:style>)`), (_, open: string, rpr: string, close: string) => {
      let out = rpr;
      if (f) {
        const head = esc(firstFamily(f.head));
        out = `<w:rFonts w:ascii="${head}" w:hAnsi="${head}" w:eastAsia="${head}" w:cs="${head}"/>${out}`;
      }
      if (c) {
        const color = `<w:color w:val="${(id === 'Title' ? c.title : id === 'Subtitle' ? c.accents[1] : c.heading).slice(1).toUpperCase()}"/>`;
        out = out.includes('<w:sz') ? out.replace('<w:sz', `${color}<w:sz`) : out + color;
      }
      return open + out + close;
    });
  }
  return xml;
}

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
    para('TableofFigures', 'table of figures', '<w:spacing w:after="60"/>', '') +
    para('Index1', 'index 1', '<w:spacing w:after="0"/><w:ind w:left="220" w:hanging="220"/>', '') +
    para('Index2', 'index 2', '<w:spacing w:after="0"/><w:ind w:left="440" w:hanging="220"/>', '') +
    para('Bibliography', 'Bibliography', '<w:spacing w:after="120"/><w:ind w:left="720" w:hanging="720"/>', '') +
    para('TableText', 'Table Text', '<w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/>', '') +
    para('Header', 'header', '<w:spacing w:after="0"/>', `<w:sz w:val="${Math.round(hp * 0.85)}"/>`) +
    para('Footer', 'footer', '<w:spacing w:after="0"/>', `<w:sz w:val="${Math.round(hp * 0.85)}"/>`) +
    para('FootnoteText', 'footnote text', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', `<w:sz w:val="${Math.round(hp * 0.8)}"/>`) +
    `<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>` +
    para('EndnoteText', 'endnote text', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', `<w:sz w:val="${Math.round(hp * 0.8)}"/>`) +
    `<w:style w:type="character" w:styleId="EndnoteReference"><w:name w:val="endnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>` +
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
  type: 'page' | 'cont' | 'odd' | 'even';
  /** The section's own paper, inches (standing upright). */
  pw?: number;
  ph?: number;
  /** Margins in inches, when the section has its own. */
  mt?: number;
  mb?: number;
  ml?: number;
  mr?: number;
  /** Its own header and footer (see sectionhf.ts), a blank first page, and page numbers started again. */
  hdr?: string;
  ftr?: string;
  hfirst?: boolean;
  pstart?: number;
  pfmt?: string;
}

interface ListDef {
  bullet: boolean;
  /** Number or bullet style set for each level (unset: Word's usual one). */
  levels: (string | undefined)[];
  /** A numbering value set by hand: [level, number]. */
  start?: [number, number];
  /** Each level's number pattern ("%1.%2"), when it isn't the usual one. */
  texts?: (string | undefined)[];
}

interface WordLevel {
  fmt: string;
  text: string;
  start: number;
  /** Word's legal-style numbering (every level's number shown as a plain number). */
  legal?: boolean;
}

/** Bullets Word draws from symbol fonts, as the characters they show. */
const WORD_BULLETS: Record<string, BulletKind> = { '\uf0b7': 'disc', '\uf0a7': 'square', o: 'circle', '\uf0d8': 'arrow', '\uf0fc': 'check', '\uf076': 'diamond', '-': 'dash', '\uf0ab': 'star' };

/** A Word list level as Crumpet's number or bullet style, when it isn't the usual one for that level. */
function wordListStyle(l: WordLevel, level: number): ParaLook {
  if (l.fmt === 'bullet') {
    const kind = (Object.keys(BULLETS) as BulletKind[]).find((k) => BULLETS[k] === l.text) ?? WORD_BULLETS[l.text];
    return kind && kind !== DEFAULT_BULLETS[level % 3] ? { bullet: kind } : {};
  }
  const own = ({ upperLetter: 'upper-alpha', lowerLetter: 'lower-alpha', upperRoman: 'upper-roman', lowerRoman: 'lower-roman' } as Record<string, NumFormat>)[l.fmt];
  const legalText = Array.from({ length: level + 1 }, (_, i) => `%${i + 1}`).join('.');
  const isLegal = !!l.legal && (l.text.match(/%/g) ?? []).length > 1 && (l.text === legalText || l.text === `${legalText}.`);
  const f: NumFormat | undefined = isLegal || (l.legal && (l.text.match(/%/g) ?? []).length > 1) ? 'legal' : l.fmt === 'decimal' || l.fmt === 'decimalZero' ? (/\)\s*$/.test(l.text) ? 'paren' : 'decimal') : own;
  // A pattern of its own ("Chapter %1", "(%1)", "%1.%2" in letters…): kept as it is.
  const usual = new RegExp(`^%${level + 1}[.)]?$`);
  const numText = !isLegal && /%[1-9]/.test(l.text) && !usual.test(l.text.trim()) ? l.text.trim() : undefined;
  return { ...(f && (f !== DEFAULT_NUMS[level % 3] || numText) ? { num: f } : {}), ...(numText ? { numText } : {}) };
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
    const text = esc(list.texts?.[l] ?? (f === 'legal' ? Array.from({ length: l + 1 }, (_, i) => `%${i + 1}`).join('.') + (l === 0 ? '.' : '') : `%${l + 1}${f === 'paren' ? ')' : '.'}`));
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
  // A resolved comment is "done" in Word, its replies too.
  const body = list.map(({ id, replies, comment }) => `<w15:commentEx w15:paraId="${paraId(id)}" w15:done="${comment.resolved ? 1 : 0}"/>` + replies.map((r) => `<w15:commentEx w15:paraId="${paraId(r)}" w15:paraIdParent="${paraId(id)}" w15:done="${comment.resolved ? 1 : 0}"/>`).join('')).join('');
  return XML + `<w15:commentsEx xmlns:w15="${W15_NS}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w15">${body}</w15:commentsEx>`;
}

/** Endnotes, as Word keeps them (numbered i, ii, iii at the end). */
function endnotesXml(notes: string[]): string {
  const sep = '<w:endnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:endnote><w:endnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:endnote>';
  const body = notes
    .map((text, i) => `<w:endnote w:id="${i + 1}"><w:p><w:pPr><w:pStyle w:val="EndnoteText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="EndnoteReference"/></w:rPr><w:endnoteRef/></w:r><w:r><w:t xml:space="preserve"> ${esc(text)}</w:t></w:r></w:p></w:endnote>`)
    .join('');
  return XML + `<w:endnotes ${NS}>${sep}${body}</w:endnotes>`;
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
  w.prepareFields(parts);
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

  // Headers and footers: the page setup's (in the first section; the others are linked to it), and sections' own.
  const files: ZipEntry[] = [];
  const hf = opts.hf;
  const p0 = parts[0]?.doc.blocks[0]?.para;
  const tabs = `<w:tabs><w:tab w:val="center" w:pos="${Math.round((contentIn * TWIPS) / 2)}"/><w:tab w:val="right" w:pos="${Math.round(contentIn * TWIPS)}"/></w:tabs>`;
  // A watermark goes in every header, as Word keeps it.
  let watermark = '';
  let wmPicture: string | null = null;
  if (p0?.wm) watermark = textWatermark(p0.wm, p0.wmc, !!p0.wmflat);
  else if (p0?.wmimg) {
    const got = await opts.media?.(p0.wmimg);
    const ext = got ? imageExt(got.type, got.bytes) : null;
    if (got && ext) {
      wmPicture = `watermark.${ext === 'jpeg' ? 'jpg' : ext}`;
      w.media.push({ name: `word/media/${wmPicture}`, data: got.bytes });
      const size = imageSize(got.bytes) ?? { width: 400, height: 300 };
      const wPt = Math.min(400, size.width * 0.75);
      watermark = pictureWatermark(wPt, (wPt * size.height) / size.width);
    }
  }
  let n = 0;
  /** A header or footer part holding `band` (none: an empty one); returns its reference. */
  const hfPart = (kind: 'header' | 'footer', type: string, band: HFBand | undefined): string => {
    n++;
    const name = `${kind}${n}.xml`;
    let para = band && !bandEmpty(band) ? w.band(band, kind === 'header' ? 'Header' : 'Footer', kind === 'header' ? !!hf?.headerLine : !!hf?.footerLine).replace(/(<w:pStyle w:val="\w+"\/>)/, `$1${tabs}`) : `<w:p><w:pPr><w:pStyle w:val="${kind === 'header' ? 'Header' : 'Footer'}"/></w:pPr></w:p>`;
    if (kind === 'header' && watermark) {
      para = para.replace(/<\/w:p>$/, `${watermark}</w:p>`);
      if (wmPicture) files.push({ name: `word/_rels/${name}.rels`, data: utf8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdWm" Type="${REL}/image" Target="media/${wmPicture}"/></Relationships>`) });
    }
    const tag = kind === 'header' ? 'hdr' : 'ftr';
    files.push({ name: `word/${name}`, data: utf8(`${XML}<w:${tag} ${HF_NS}>${para}</w:${tag}>`) });
    return `<w:${kind}Reference w:type="${type}" r:id="${w.rel(`${REL}/${kind}`, name)}"/>`;
  };
  // The page setup's, by kind and type.
  const base = new Map<string, string>();
  if (hf || watermark) {
    const variants: [string, HFSet | undefined][] = [['default', hf?.sets.main]];
    if (hf?.differentOddEven) variants.push(['even', hf.sets.even ?? hf.sets.main]);
    if (hf?.differentFirst) variants.push(['first', hf.sets.first]);
    for (const [type, set] of variants) {
      base.set(`header:${type}`, hfPart('header', type, set?.header));
      base.set(`footer:${type}`, hfPart('footer', type, set?.footer));
    }
  }
  const fmtOf = (f: string | undefined) => (f && f !== '1' ? ` w:fmt="${{ i: 'lowerRoman', I: 'upperRoman', a: 'lowerLetter', A: 'upperLetter' }[f as 'i']}"` : '');
  const tw = (inches: number) => Math.round(inches * TWIPS);
  const lines = p0?.lnum ? { every: p0.lnum, restart: p0.lnr ?? 'page' } : null;
  // A line round every page (Word keeps it on each section).
  const PGB: Record<string, [string, number]> = { single: ['single', 6], double: ['double', 6], thick: ['single', 24], dotted: ['dotted', 12], dashed: ['dashed', 12] };
  const pgb = p0?.pgb ? PGB[p0.pgb] : null;
  const pgBorders = pgb ? `<w:pgBorders w:offsetFrom="page">${['top', 'left', 'bottom', 'right'].map((side) => `<w:${side} w:val="${pgb[0]}" w:sz="${pgb[1]}" w:space="24" w:color="${(p0?.pgbc ?? '#333333').slice(1).toUpperCase()}"/>`).join('')}</w:pgBorders>` : '';
  // Each section's settings: the page turned for landscape, its columns and how it starts, its headers and footers. The first section has the page setup's.
  const sectionXml = (sp: SectionProps, first: boolean) => {
    const landscape = sp.orient ? sp.orient === 'landscape' : !!page?.landscape;
    const long = sp.pw && sp.ph ? Math.max(sp.pw, sp.ph) : Math.max(size.width, size.height);
    const short = sp.pw && sp.ph ? Math.min(sp.pw, sp.ph) : Math.min(size.width, size.height);
    const [pw, ph] = landscape ? [long, short] : [short, long];
    const type = first ? '' : sp.type === 'cont' ? '<w:type w:val="continuous"/>' : sp.type === 'odd' ? '<w:type w:val="oddPage"/>' : sp.type === 'even' ? '<w:type w:val="evenPage"/>' : '';
    // Line numbers (the whole document's).
    const lnNum = lines ? `<w:lnNumType w:countBy="${lines.every}" w:restart="${lines.restart === 'sect' ? 'newSection' : lines.restart === 'cont' ? 'continuous' : 'newPage'}"/>` : '';
    const cols = sp.cols > 1 ? `<w:cols w:num="${sp.cols}" w:space="720"/>` : '<w:cols w:space="720"/>';
    const refs = new Map<string, string>(first ? base : []);
    let titlePg = first && !!hf?.differentFirst;
    if (sp.hdr !== undefined) {
      const band = decodeBand(sp.hdr);
      refs.set('header:default', hfPart('header', 'default', band));
      if (hf?.differentOddEven) refs.set('header:even', hfPart('header', 'even', band));
      if (titlePg && !sp.hfirst) refs.set('header:first', hfPart('header', 'first', band));
    }
    if (sp.ftr !== undefined) {
      const band = decodeBand(sp.ftr);
      refs.set('footer:default', hfPart('footer', 'default', band));
      if (hf?.differentOddEven) refs.set('footer:even', hfPart('footer', 'even', band));
      if (titlePg && !sp.hfirst) refs.set('footer:first', hfPart('footer', 'first', band));
    }
    if (sp.hfirst) {
      refs.set('header:first', hfPart('header', 'first', undefined));
      refs.set('footer:first', hfPart('footer', 'first', undefined));
      titlePg = true;
    }
    const order = ['header:default', 'header:even', 'header:first', 'footer:default', 'footer:even', 'footer:first'];
    const refXml = order.map((k) => refs.get(k) ?? '').join('');
    const pgNum = sp.pstart !== undefined ? `<w:pgNumType${fmtOf(sp.pfmt)} w:start="${sp.pstart}"/>` : first && hf ? `<w:pgNumType${fmtOf(hf.numberFormat)}${hf.startAt !== 1 ? ` w:start="${hf.startAt}"` : ''}/>` : '';
    return `<w:sectPr>${refXml}<w:footnotePr><w:numFmt w:val="decimal"/></w:footnotePr>${type}<w:pgSz w:w="${tw(pw)}" w:h="${tw(ph)}"${landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${tw(sp.mt ?? m.top)}" w:right="${tw(sp.mr ?? m.right)}" w:bottom="${tw(sp.mb ?? m.bottom)}" w:left="${tw(sp.ml ?? m.left)}" w:header="${tw(hf?.headerFrom ?? 0.5)}" w:footer="${tw(hf?.footerFrom ?? 0.5)}" w:gutter="0"/>${pgBorders}${lnNum}${pgNum}${cols}${titlePg ? '<w:titlePg/>' : ''}</w:sectPr>`;
  };
  let firstSect = true;
  body = body.replace(/<!--crumpet-sect:(.*?)-->/g, (_, json: string) => {
    const xml = sectionXml(JSON.parse(json) as SectionProps, firstSect);
    firstSect = false;
    return xml;
  });
  const sect = sectionXml(w.section, firstSect);
  const background = p0?.pgc ? `<w:background w:color="${p0.pgc.slice(1).toUpperCase()}"/>` : '';
  const documentXml = `${XML}<w:document ${DOC_NS}>${background}<w:body>${body}${sect}</w:body></w:document>`;

  w.rel(`${REL}/styles`, 'styles.xml');
  w.rel(`${REL}/numbering`, 'numbering.xml');
  w.rel(`${REL}/footnotes`, 'footnotes.xml');
  w.rel(`${REL}/endnotes`, 'endnotes.xml');
  w.rel(`${REL}/settings`, 'settings.xml');
  if (w.comments.length) {
    w.rel(`${REL}/comments`, 'comments.xml');
    files.push({ name: 'word/comments.xml', data: utf8(commentsXml(w.comments)) });
    w.rel('http://schemas.microsoft.com/office/2011/relationships/commentsExtended', 'commentsExtended.xml');
    files.push({ name: 'word/commentsExtended.xml', data: utf8(commentsExtendedXml(w.comments)) });
  }
  const docRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${w.rels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"${r.external ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
  const hasToc = parts.some((part) => part.doc.blocks.some((b) => b.type === 'toc' || b.runs.some((r) => r.field !== undefined && !(r.field in FIELDS))));
  // Tracking everyone's changes, and locked (without a password: Word can't check ours).
  const firstPara = parts[0]?.doc.blocks[0]?.para;
  const protect = firstPara?.lock ? '<w:documentProtection w:edit="trackedChanges" w:enforcement="1"/>' : '';
  const trackAll = firstPara?.track === 'all' ? '<w:trackRevisions/>' : '';
  const settings = `${XML}<w:settings ${NS}>${p0?.pgc ? '<w:displayBackgroundShape/>' : ''}${protect}${trackAll}${hf?.differentOddEven ? '<w:evenAndOddHeaders/>' : ''}${parts[0]?.doc.blocks[0]?.para?.hyph ? '<w:autoHyphenation/>' : ''}<w:defaultTabStop w:val="720"/>${hasToc ? '<w:updateFields w:val="true"/>' : ''}<w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:endnotePr><w:numFmt w:val="lowerRoman"/><w:endnote w:id="-1"/><w:endnote w:id="0"/></w:endnotePr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>${designVar(p0)}</w:settings>`;
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
    '<Override PartName="/word/endnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml"/>' +
    '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
    files.filter((f) => !f.name.endsWith('.rels')).map((f) => `<Override PartName="/${f.name}" ContentType="${f.name.endsWith('commentsExtended.xml') ? 'application/vnd.ms-word.commentsExtended+xml' : `application/vnd.openxmlformats-officedocument.wordprocessingml.${f.name.includes('header') ? 'header' : f.name.includes('comments') ? 'comments' : 'footer'}+xml`}"/>`).join('') +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  const rootRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

  return writeZip([
    { name: '[Content_Types].xml', data: utf8(types) },
    { name: '_rels/.rels', data: utf8(rootRels) },
    { name: 'docProps/core.xml', data: utf8(core) },
    { name: 'word/document.xml', data: utf8(documentXml) },
    { name: 'word/_rels/document.xml.rels', data: utf8(docRels) },
    { name: 'word/styles.xml', data: utf8(themeStyles(stylesXml(opts.font || 'Georgia', opts.size || 12), p0).replace('</w:styles>', `${customStylesXml(opts.custom ?? [])}</w:styles>`)) },
    { name: 'word/numbering.xml', data: utf8(numberingXml(w.lists)) },
    { name: 'word/footnotes.xml', data: utf8(footnotesXml(w.footnotes)) },
    { name: 'word/endnotes.xml', data: utf8(endnotesXml(w.endnotes)) },
    { name: 'word/settings.xml', data: utf8(settings) },
    ...files,
    ...w.media,
  ]);
}

// ------------------------------------------------------------------ reading

export interface DocxImport {
  title: string;
  doc: Doc;
  /** The document's own Word styles its paragraphs use, as styles of one's own (what Word says of them). */
  styles?: { id: string; name: string; base: StyleKey; def: Partial<StyleDef> }[];
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
    // Word's Font window.
    if (on(child(rpr, 'caps'))) look.caps = 'all';
    else if (on(child(rpr, 'smallCaps'))) look.caps = 'small';
    if (on(child(rpr, 'dstrike'))) look.dstrike = 1;
    if (on(child(rpr, 'vanish'))) look.hidden = 1;
    if (on(child(rpr, 'outline'))) look.fx = 'outline';
    else if (on(child(rpr, 'shadow'))) look.fx = 'shadow';
    else if (on(child(rpr, 'emboss'))) look.fx = 'emboss';
    else if (on(child(rpr, 'imprint'))) look.fx = 'engrave';
    const u = attr(child(rpr, 'u'), 'val');
    const UL: Record<string, Look['ul']> = { double: 'double', dotted: 'dotted', dottedHeavy: 'dotted', dash: 'dashed', dashLong: 'dashed', dashedHeavy: 'dashed', wave: 'wavy', wavyHeavy: 'wavy', wavyDouble: 'wavy', thick: 'thick' };
    const ulc = attr(child(rpr, 'u'), 'color');
    if (u && UL[u]) look.ul = UL[u];
    if (u && u !== 'none' && ulc && /^[0-9a-f]{6}$/i.test(ulc)) {
      look.ulc = `#${ulc.toLowerCase()}`;
      look.ul ??= 'single';
    }
    const spacing = Number(attr(child(rpr, 'spacing'), 'val') ?? 0) / 20;
    if (spacing && lookValueOk('sp', spacing)) look.sp = Math.round(spacing * 10) / 10;
    const position = Number(attr(child(rpr, 'position'), 'val') ?? 0) / 2;
    if (position && !look.va && lookValueOk('pos', position)) look.pos = position;
    return tidyLook(look);
  };
  // Word styles of the document's own, which come in as styles of one's own.
  const ownStyles = new Map<string, { id: string; name: string; def: Partial<StyleDef>; basedOn: string }>();
  const usedOwn = new Set<string>();
  const KNOWN_BASES: Record<string, StyleKey> = { normal: 'normal', title: 'title', subtitle: 'subtitle', 'heading 1': 'heading1', 'heading 2': 'heading2', 'heading 3': 'heading3', 'heading 4': 'heading4', quote: 'quote', epigraph: 'epigraph', caption: 'caption' };
  for (const s of Array.from(stylesXml?.getElementsByTagNameNS(W_NS, 'style') ?? [])) {
    const id = attr(s, 'styleId') ?? '';
    styleName.set(id, (attr(child(s, 'name'), 'val') ?? id).toLowerCase());
    if (attr(s, 'type') === 'paragraph' && /^(1|true|on)$/.test(attr(s, 'customStyle') ?? '')) {
      const name = (attr(child(s, 'name'), 'val') ?? id).trim().slice(0, 40);
      const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
      if (!slug || !name) continue;
      const rpr = child(s, 'rPr');
      const ppr = child(s, 'pPr');
      const def: Partial<StyleDef> = {};
      const fam = attr(child(rpr, 'rFonts'), 'ascii');
      if (fam) def.font = { family: fam, source: 'system' };
      const sz = Number(attr(child(rpr, 'sz'), 'val'));
      if (sz) def.size = sz / 2;
      if (child(rpr, 'b')) def.bold = on(child(rpr, 'b'));
      if (child(rpr, 'i')) def.italic = on(child(rpr, 'i'));
      if (child(rpr, 'caps')) def.caps = on(child(rpr, 'caps'));
      const jc = attr(child(ppr, 'jc'), 'val');
      if (jc) def.align = jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : jc === 'both' ? 'justify' : 'left';
      const sp = child(ppr, 'spacing');
      if (attr(sp, 'before') !== null) def.spaceBefore = Number(attr(sp, 'before')) / 20;
      if (attr(sp, 'after') !== null) def.spaceAfter = Number(attr(sp, 'after')) / 20;
      if (attr(sp, 'line') !== null && (attr(sp, 'lineRule') ?? 'auto') === 'auto') def.lineSpacing = Math.round((Number(attr(sp, 'line')) / 240) * 1.15 * 100) / 100;
      const ind = child(ppr, 'ind');
      if (attr(ind, 'left') !== null) def.leftIndent = Number(attr(ind, 'left')) / 1440;
      if (attr(ind, 'firstLine') !== null) def.firstIndent = Number(attr(ind, 'firstLine')) / 1440;
      if (attr(ind, 'hanging') !== null) def.firstIndent = -Number(attr(ind, 'hanging')) / 1440;
      for (const [k, v] of Object.entries(def)) if (typeof v === 'number' && !Number.isFinite(v)) delete (def as Record<string, unknown>)[k];
      ownStyles.set(id, { id: `c-${slug}`, name, def, basedOn: attr(child(s, 'basedOn'), 'val') ?? '' });
    }
    const lvl = attr(child(child(s, 'pPr'), 'outlineLvl'), 'val');
    if (lvl !== null) styleLevel.set(id, Number(lvl) + 1);
  }

  // A style based on a heading is a heading of that level too.
  const basedOn = new Map<string, string>();
  for (const s of Array.from(stylesXml?.getElementsByTagNameNS(W_NS, 'style') ?? [])) {
    const on = attr(child(s, 'basedOn'), 'val');
    if (on) basedOn.set(attr(s, 'styleId') ?? '', on);
  }
  for (const id of basedOn.keys()) {
    let at = id;
    for (let hops = 0; hops < 10 && !styleLevel.has(at) && basedOn.has(at); hops++) at = basedOn.get(at)!;
    const lvl = styleLevel.get(at) ?? (/^heading (\d)$/.exec(styleName.get(at) ?? '')?.[1] ? Number(/^heading (\d)$/.exec(styleName.get(at)!)![1]) : undefined);
    if (lvl && !styleLevel.has(id)) styleLevel.set(id, lvl);
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
          .map((l) => ({ fmt: attr(child(l, 'numFmt'), 'val') ?? 'decimal', text: attr(child(l, 'lvlText'), 'val') ?? '', start: Number(attr(child(l, 'start'), 'val') ?? 1) || 0, legal: on(child(l, 'isLgl')) })),
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
  // Endnotes come in as endnotes (their text was lost before).
  const endnotes = new Map<string, string>();
  const endPath = [...rels.values()].find((p) => /endnotes\.xml$/.test(p));
  for (const f of Array.from(parseXml(endPath ? files.get(endPath) : undefined)?.getElementsByTagNameNS(W_NS, 'endnote') ?? [])) endnotes.set(attr(f, 'id') ?? '', textOf(f));

  // Comments: what each says, and which are open at the text being read.
  const notesById = new Map<string, Comment>();
  const commentsPath = [...rels.values()].find((p) => /comments\.xml$/.test(p));
  // Word's threads: which comment (by its last paragraph's id) answers which.
  const extendedPath = [...rels.values()].find((p) => /commentsExtended\.xml$/.test(p));
  const extended = parseXml(extendedPath ? files.get(extendedPath) : undefined);
  const parentOf = new Map<string, string>();
  /** Comments Word marks done (resolved), by their last paragraph's id. */
  const doneParas = new Set<string>();
  for (const x of Array.from(extended?.getElementsByTagName('*') ?? []).filter((e) => e.localName === 'commentEx')) {
    const own = x.getAttributeNS(W15_NS, 'paraId') ?? x.getAttribute('w15:paraId');
    const parent = x.getAttributeNS(W15_NS, 'paraIdParent') ?? x.getAttribute('w15:paraIdParent');
    if (own && parent) parentOf.set(own.toUpperCase(), parent.toUpperCase());
    const done = x.getAttributeNS(W15_NS, 'done') ?? x.getAttribute('w15:done');
    if (own && done === '1') doneParas.add(own.toUpperCase());
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
    if (doneParas.has(r.paraId)) comment.resolved = true;
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
  /** A Word picture's alt text, size, turn and wrapping, as a picture look of ours. */
  const readPictureLook = (drawing: Element): PicLook | undefined => {
    const all = Array.from(drawing.getElementsByTagName('*'));
    const plain = (el: Element | undefined, name: string) => el?.getAttribute(name) ?? null;
    const EMU = 914400;
    const cx = Number(plain(all.find((x) => x.localName === 'extent'), 'cx') ?? 0) / EMU;
    const rot = Number(plain(all.find((x) => x.localName === 'xfrm'), 'rot') ?? 0) / 60000;
    const anchor = all.find((x) => x.localName === 'anchor');
    let wrap: PicLook['wrap'];
    let x: number | undefined;
    let y: number | undefined;
    if (anchor) {
      const kidsOf = Array.from(anchor.children);
      if (kidsOf.some((k) => /^wrap(Square|Tight|Through)$/.test(k.localName))) {
        const side = Array.from(all.find((k) => k.localName === 'positionH')?.getElementsByTagName('*') ?? []).find((k) => k.localName === 'align')?.textContent;
        wrap = side === 'right' ? 'right' : 'left';
      } else if (kidsOf.some((k) => k.localName === 'wrapNone')) {
        wrap = 'free';
        const off = (name: string) => Number(Array.from(all.find((k) => k.localName === name)?.getElementsByTagName('*') ?? []).find((k) => k.localName === 'posOffset')?.textContent ?? 0) / EMU;
        x = off('positionH');
        y = off('positionV');
      }
    }
    const descr = (plain(all.find((k) => k.localName === 'docPr'), 'descr') ?? '').trim();
    // Cropped, cropped to a shape, corrected, see-through, a border, a shadow.
    const src = all.find((k) => k.localName === 'srcRect');
    const share = (name: string) => Math.max(0, Number(plain(src, name) ?? 0) / 100000);
    const crop: [number, number, number, number] | undefined = src ? [share('t'), share('r'), share('b'), share('l')] : undefined;
    const SHAPES: Record<string, PicLook['mask']> = { ellipse: 'oval', roundRect: 'rounded', triangle: 'triangle', diamond: 'diamond', hexagon: 'hexagon', star5: 'star' };
    const prst = plain(all.find((k) => k.localName === 'prstGeom'), 'prst') ?? 'rect';
    const lum = all.find((k) => k.localName === 'lum');
    const alpha = all.find((k) => k.localName === 'alphaModFix');
    const spPr = all.find((k) => k.localName === 'spPr');
    const lnFill = spPr ? Array.from(spPr.getElementsByTagName('*')).find((k) => k.localName === 'ln') : undefined;
    const rgb = lnFill ? Array.from(lnFill.getElementsByTagName('*')).find((k) => k.localName === 'srgbClr') : undefined;
    const lnColor = plain(rgb, 'val');
    return tidyPic({
      w: cx || undefined,
      rot,
      wrap,
      x,
      y,
      alt: descr || undefined,
      crop,
      mask: SHAPES[prst],
      bright: lum ? Number(plain(lum, 'bright') ?? 0) / 1000 : undefined,
      contrast: lum ? Number(plain(lum, 'contrast') ?? 0) / 1000 : undefined,
      fade: alpha ? 100 - Number(plain(alpha, 'amt') ?? 100000) / 1000 : undefined,
      effect: all.some((k) => k.localName === 'grayscl') ? 'grey' : undefined,
      border: lnColor && /^[0-9a-f]{6}$/i.test(lnColor) ? `#${lnColor.toLowerCase()}` : undefined,
      style: all.some((k) => k.localName === 'outerShdw') ? 'shadow' : undefined,
    });
  };

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
    const own = (Object.entries(WORD_SHAPES) as [ShapeKind, string][]).find(([k, v]) => v === prst && !isLineKind(k))?.[0];
    const kind: ShapeKind = /line|Connector/i.test(prst) ? (arrow ? 'arrow' : 'line') : (own ?? (prst === 'flowChartProcess' ? 'rect' : prst === 'flowChartDecision' ? 'diamond' : prst === 'flowChartConnector' ? 'ellipse' : 'rect'));
    // Its line's thickness, dashes and ends; a gradient or picture fill; an effect.
    const END: Record<string, LineEnd> = { triangle: 'arrow', stealth: 'arrow', diamond: 'arrow', arrow: 'open', oval: 'dot' };
    const endOf = (name: string) => END[plain(ln ? kids(ln).find((x) => x.localName === name) ?? null : null, 'type') ?? ''];
    const lw = ln && plain(ln, 'w') ? Number(plain(ln, 'w')) / 12700 : undefined;
    const dashVal = plain(find(ln ?? undefined, 'prstDash') ?? null, 'val');
    const dash = !dashVal || dashVal === 'solid' ? undefined : /dot$/i.test(dashVal) && !/dash/i.test(dashVal) ? 'dot' : /dashDot/i.test(dashVal) ? 'dashdot' : 'dash';
    const gradStops = spPr ? kids(kids(spPr).find((x) => x.localName === 'gradFill') ?? spPr).find((x) => x.localName === 'gsLst') : undefined;
    const stopColor = (i: number) => {
      const v = plain(find(gradStops ? kids(gradStops)[i] : undefined, 'srgbClr') ?? null, 'val');
      return v && /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : undefined;
    };
    let img: string | undefined;
    const blip = spPr ? find(kids(spPr).find((x) => x.localName === 'blipFill'), 'blip') : undefined;
    const embed = blip?.getAttributeNS(R_NS, 'embed') ?? blip?.getAttribute('r:embed');
    if (embed && opts.saveMedia) {
      const path = rels.get(embed);
      const bytes = path ? files.get(path) : undefined;
      if (path && bytes) img = (await opts.saveMedia(path.split('/').pop() ?? 'fill', bytes, MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/png')) ?? undefined;
    }
    const fxs = spPr ? Array.from(spPr.getElementsByTagName('*')).map((x) => x.localName) : [];
    const fx: ShapeLook['fx'] = fxs.includes('bevelT') ? 'bevel' : fxs.includes('glow') ? 'glow' : fxs.includes('softEdge') ? 'soft' : fxs.includes('reflection') ? 'reflect' : fxs.includes('outerShdw') ? 'shadow' : undefined;
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
    let ta: ShapeLook['ta'];
    if (box) {
      for (const [k, p] of kids(box).filter((x) => x.localName === 'p').entries()) {
        if (k > 0) runs.push({ text: '\n', marks: [] });
        else {
          const jc = attr(child(child(p, 'pPr'), 'jc'), 'val');
          ta = jc === 'left' || jc === 'start' ? 'left' : jc === 'right' || jc === 'end' ? 'right' : undefined;
        }
        await readRuns(p, runs, []);
      }
    }
    const text = cellText(runs.filter((x) => !x.footnote && !x.comment).map((x) => ({ text: x.text, marks: x.marks, ...(x.look ? { look: x.look } : {}), ...(x.link ? { link: x.link } : {}) })));
    // The text's direction and place; a box linked to others; a drawn outline of its own.
    const body = kids(wsp).find((x) => x.localName === 'bodyPr');
    const vertAttr = plain(body ?? null, 'vert');
    const dir: ShapeLook['dir'] = vertAttr === 'vert' || vertAttr === 'eaVert' ? 'down' : vertAttr === 'vert270' ? 'up' : undefined;
    const anchorAt = plain(body ?? null, 'anchor');
    const tv: ShapeLook['tv'] = anchorAt === 't' ? 'top' : anchorAt === 'b' ? 'bottom' : undefined;
    const linked = kids(wsp).find((x) => x.localName === 'linkedTxbx');
    const txbxId = plain(kids(wsp).find((x) => x.localName === 'txbx') ?? null, 'id');
    const chainId = linked ? plain(linked, 'id') : txbxId;
    const linkedIds = new Set(Array.from(xml.getElementsByTagNameNS('*', 'linkedTxbx')).map((x) => x.getAttribute('id')));
    const chain = chainId && (linked || linkedIds.has(chainId)) ? `c${chainId}` : undefined;
    const cust = spPr ? kids(spPr).find((x) => x.localName === 'custGeom') : undefined;
    const drawn = cust ? drawingMLToShape(cust) : null;
    // Floating with the text round it: on the side it's aligned to.
    const anchor = all.find((x) => x.localName === 'anchor');
    const wraps = anchor && Array.from(anchor.children).some((x) => /^wrap(Square|Tight|Through)$/.test(x.localName));
    const side = find(all.find((x) => x.localName === 'positionH'), 'align')?.textContent ?? 'left';
    // In front of (or behind) the text, where it was put: from the column and paragraph, as we place it.
    const free = !!anchor && !wraps && Array.from(anchor.children).some((x) => x.localName === 'wrapNone');
    const offset = (axis: string) => {
      const pos = all.find((x) => x.localName === axis);
      return Number(find(pos, 'posOffset')?.textContent ?? 0) / EMU || 0;
    };
    const xfrm = spPr && kids(spPr).find((x) => x.localName === 'xfrm');
    const rot = Number(plain(xfrm ?? null, 'rot') ?? 0) / 60000;
    const behind = free && anchor?.getAttribute('behindDoc') === '1';
    const topBottom = !!anchor && Array.from(anchor.children).some((x) => x.localName === 'wrapTopAndBottom');
    const tight = !!anchor && Array.from(anchor.children).some((x) => x.localName === 'wrapTight' || x.localName === 'wrapThrough');
    const from = all.find((x) => x.localName === 'positionH')?.getAttribute('relativeFrom');
    const rel = from === 'page' ? 'page' : from === 'margin' ? 'margin' : undefined;
    // A line ending in a plain arrowhead is an arrow; any other ends are a line's.
    const head = endOf('tailEnd');
    const tail = endOf('headEnd');
    const plainArrow = isLineKind(kind) && head === 'arrow' && !tail;
    const lineKind: ShapeKind = isLineKind(kind) ? (plainArrow ? 'arrow' : 'line') : kind;
    // The text's one colour, as the shape's text colour.
    const colors = new Set(runs.filter((r) => r.text.trim()).map((r) => r.look?.color));
    const tc = colors.size === 1 ? [...colors][0] : undefined;
    const shape = tidyShape({ ...(drawn ?? {}), kind: drawn?.kind ?? lineKind, ta, tv: chain ? undefined : tv, dir, chain, w: w || undefined, h: h || undefined, fill: fill ?? (gradStops ? stopColor(0) : undefined), grad: stopColor(gradStops ? kids(gradStops).length - 1 : -1), img, lw, dash, head: plainArrow ? undefined : head, tail, fx, tc, line, wrap: behind ? 'behind' : free ? 'free' : topBottom ? 'topbottom' : wraps ? (side === 'right' ? 'right' : 'left') : 'inline', tight, text, rot, ...(free ? { x: offset('positionH'), y: offset('positionV'), rel } : topBottom ? { x: offset('positionH') } : {}) });
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
            // A field in Word's long form: begin, its instruction, separate, what it showed, end. Dates and times become fields of ours; others keep what they showed.
            if (c.localName === 'fldChar') {
              const kind = attr(c, 'fldCharType');
              if (kind === 'begin') wordField = { instr: '', showing: false };
              else if (kind === 'separate' && wordField) wordField.showing = true;
              else if (kind === 'end' && wordField) {
                const f = fieldFromWord(wordField.instr);
                if (f) {
                  push(FIELD);
                  out[out.length - 1].field = f;
                }
                wordField = null;
              }
              continue;
            }
            if (wordField && (!wordField.showing || fieldFromWord(wordField.instr))) {
              if (c.localName === 'instrText' && !wordField.showing) wordField.instr += c.textContent ?? '';
              continue;
            }
            if (c.localName === 't' || c.localName === 'delText') push(c.textContent ?? '');
            else if (c.localName === 'tab') push('\t');
            else if (c.localName === 'br' && attr(c, 'type') === 'textWrapping' && attr(c, 'clear') && attr(c, 'clear') !== 'none') {
              push(FIELD);
              out[out.length - 1].field = 'wrapbreak';
            } else if (c.localName === 'br' || c.localName === 'cr') {
              if (attr(c, 'type') !== 'page' && attr(c, 'type') !== 'column') push('\n');
            } else if (c.localName === 'noBreakHyphen') push('‑');
            else if (c.localName === 'sym') push(String.fromCharCode(parseInt(attr(c, 'char') ?? '20', 16) & 0xff || 32));
            else if (c.localName === 'footnoteReference' || c.localName === 'endnoteReference') {
              const end = c.localName === 'endnoteReference';
              const text = (end ? endnotes : notes).get(attr(c, 'id') ?? '');
              out.push({ text: FOOTNOTE, marks: [], footnote: text ?? '', ...(end ? { endnote: true as const } : {}) });
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
                const src = await opts.saveMedia(path.replace(/^.*\//, ''), data, MIME[ext] ?? 'application/octet-stream');
                if (src) {
                  const img = makeBlock('image', '', [], { src });
                  const pic = readPictureLook(c);
                  if (pic) img.pic = pic;
                  pics.push(img);
                }
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
        case 'bookmarkStart': {
          // A bookmark (not Word's own hidden ones, except those cross-references point at).
          const name = attr(el, 'name') ?? '';
          if (/^[A-Za-z][\w-]{0,39}$/.test(name) || /^_Ref\d+$/.test(name)) out.push({ text: FIELD, marks: [], field: `bm:${name}` });
          break;
        }
        case 'fldSimple': {
          // A date or time field becomes one of ours; any other keeps what it showed.
          const f = fieldFromWord(attr(el, 'instr') ?? '');
          if (f) {
            const at = out.length;
            await readRuns(el, out, pics, marks, link);
            const shown = out.splice(at);
            const run: Run = { ...(shown[0] ?? { marks: [] }), text: FIELD, field: f };
            out.push(run);
          } else await readRuns(el, out, pics, marks, link);
          break;
        }
        case 'smartTag':
        case 'customXml':
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
  /** A drop cap (a framed paragraph with the first letter) goes on the paragraph after it. */
  let dropNext: { runs: Run[]; lines: number } | null = null;
  /** A field in Word's long form being read (see readRuns). */
  let wordField: { instr: string; showing: boolean } | null = null;
  let colBreakNext = false;
  // Section settings, as Word keeps them: at the end of each section (in its last paragraph), the last in the body.
  type SectRead = { margins: { mt?: number; mb?: number; ml?: number; mr?: number }; cont: boolean; parity?: 'odd' | 'even'; cols: number; landscape: boolean; paper?: { w: number; h: number }; lines?: { every: number; restart: 'page' | 'sect' | 'cont' }; hdr?: string; ftr?: string; hfirst?: boolean; pstart?: number; pfmt?: '1' | 'i' | 'I' | 'a' | 'A' };
  const sectEnds: { end: number; props: SectRead }[] = [];
  /** A header or footer part's words, as a section's own band written short (see sectionhf.ts). */
  const readBand = (rid: string | null): string | undefined => {
    const path = rid ? rels.get(rid) : undefined;
    const part = path ? parseXml(files.get(path)) : null;
    if (!part) return undefined;
    const band = { left: [] as HFRun[], center: [] as HFRun[], right: [] as HFRun[] };
    for (const para of Array.from(part.getElementsByTagNameNS(W_NS, 'p'))) {
      const slots: HFRun[][] = [[]];
      let skip = false;
      let instr = '';
      const walkHF = (el: Element) => {
        for (const c of kids(el)) {
          const name = c.localName;
          if (name === 'pict' || name === 'drawing' || name === 'AlternateContent' || name === 'pPr' || name === 'rPr') continue;
          if (name === 'tab') slots.push([]);
          else if (name === 'fldSimple') {
            const f = /NUMPAGES/i.test(attr(c, 'instr') ?? '') ? 'pages' : /PAGE/i.test(attr(c, 'instr') ?? '') ? 'page' : null;
            if (f) slots[slots.length - 1].push({ field: f });
            else walkHF(c);
          } else if (name === 'fldChar') {
            const t = attr(c, 'fldCharType');
            if (t === 'begin') instr = '';
            else if (t === 'separate') {
              const f = /NUMPAGES/i.test(instr) ? 'pages' : /\bPAGE\b/i.test(instr) ? 'page' : null;
              if (f) {
                slots[slots.length - 1].push({ field: f });
                skip = true;
              }
            } else if (t === 'end') skip = false;
          } else if (name === 'instrText') instr += c.textContent ?? '';
          else if (name === 't') {
            if (!skip && c.textContent) slots[slots.length - 1].push({ text: c.textContent });
          } else walkHF(c);
        }
      };
      walkHF(para);
      if (slots.every((x) => !x.length)) continue;
      const jc = attr(child(child(para, 'pPr'), 'jc'), 'val');
      // Text with tabs: left, centre, right; otherwise where the paragraph is aligned.
      const placed = slots.length > 1 ? slots : jc === 'center' ? [[], slots[0]] : jc === 'right' || jc === 'end' ? [[], [], slots[0]] : slots;
      (['left', 'center', 'right'] as const).forEach((k, i) => {
        const runs = i === 2 ? placed.slice(2).flat() : (placed[i] ?? []);
        if (!runs.length) return;
        if (band[k].length) band[k].push({ text: ' ' });
        band[k].push(...runs);
      });
    }
    return encodeBand({ left: tidyRuns(band.left), center: tidyRuns(band.center), right: tidyRuns(band.right) });
  };
  const readSect = (sp: Element): SectRead => {
    const sz = child(sp, 'pgSz');
    const w = Number(attr(sz, 'w') ?? 0);
    const h = Number(attr(sz, 'h') ?? 0);
    const mar = child(sp, 'pgMar');
    const inch = (k: string) => {
      const v = attr(mar, k);
      return v !== null && Number.isFinite(Number(v)) ? Math.round((Number(v) / TWIPS) * 1000) / 1000 : undefined;
    };
    const typ = attr(child(sp, 'type'), 'val');
    const ln = child(sp, 'lnNumType');
    const every = Number(attr(ln, 'countBy') ?? (ln ? 1 : 0));
    const restart = attr(ln, 'restart');
    return {
      margins: { mt: inch('top'), mb: inch('bottom'), ml: inch('left'), mr: inch('right') },
      cont: typ === 'continuous',
      ...(typ === 'oddPage' ? { parity: 'odd' as const } : typ === 'evenPage' ? { parity: 'even' as const } : {}),
      cols: Math.max(1, Math.min(4, Number(attr(child(sp, 'cols'), 'num') ?? 1) || 1)),
      landscape: attr(sz, 'orient') === 'landscape' || (w > 0 && h > 0 && w > h),
      ...(w > 0 && h > 0 ? { paper: { w: Math.round((Math.min(w, h) / TWIPS) * 100) / 100, h: Math.round((Math.max(w, h) / TWIPS) * 100) / 100 } } : {}),
      ...(every > 0 ? { lines: { every, restart: restart === 'newSection' ? ('sect' as const) : restart === 'continuous' ? ('cont' as const) : ('page' as const) } } : {}),
      ...readSectHF(sp),
    };
  };
  /** A section's own headers and footers, blank first page and page numbering. */
  const readSectHF = (sp: Element): Pick<SectRead, 'hdr' | 'ftr' | 'hfirst' | 'pstart' | 'pfmt'> => {
    const ref = (kind: string, type: string) => kids(sp).find((c) => c.localName === `${kind}Reference` && (attr(c, 'type') ?? 'default') === type);
    const out: Pick<SectRead, 'hdr' | 'ftr' | 'hfirst' | 'pstart' | 'pfmt'> = {};
    const h = ref('header', 'default');
    const f = ref('footer', 'default');
    if (h) out.hdr = readBand(h.getAttributeNS(R_NS, 'id') ?? h.getAttribute('r:id'));
    if (f) out.ftr = readBand(f.getAttributeNS(R_NS, 'id') ?? f.getAttribute('r:id'));
    if (on(child(sp, 'titlePg'))) {
      const fh = ref('header', 'first');
      const ff = ref('footer', 'first');
      const empty = (r: Element | undefined) => !r || (readBand(r.getAttributeNS(R_NS, 'id') ?? r.getAttribute('r:id')) ?? '').replace(/\|/g, '') === '';
      if (empty(fh) && empty(ff)) out.hfirst = true;
    }
    const pg = child(sp, 'pgNumType');
    const start = attr(pg, 'start');
    if (start !== null && Number.isFinite(Number(start))) out.pstart = Number(start);
    const fmt = { lowerRoman: 'i', upperRoman: 'I', lowerLetter: 'a', upperLetter: 'A' }[attr(pg, 'fmt') ?? ''] as SectRead['pfmt'];
    if (fmt && out.pstart !== undefined) out.pfmt = fmt;
    return out;
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
    let clean = normalizeRuns(runs);
    const frame = child(ppr, 'framePr');
    const dropCap = attr(frame, 'dropCap');
    if ((dropCap === 'drop' || dropCap === 'margin') && clean.length) {
      // The letter's own size and lowering are Word's way of drawing it; ours comes from the lines.
      dropNext = { runs: clean.map((r) => ({ ...r, look: tidyLook({ ...r.look, size: undefined }) })), lines: Number(attr(frame, 'lines') ?? 3) || 3 };
      const pb = child(ppr, 'pageBreakBefore');
      if (pb && attr(pb, 'val') !== '0' && attr(pb, 'val') !== 'false') pageBreakNext = true;
      return;
    }
    const drop = dropNext;
    dropNext = null;
    if (drop) clean = normalizeRuns([...drop.runs, ...clean]);
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
    else if (name === 'caption') {
      // A caption straight after a picture is that picture's caption (alt text the same as it is dropped: the caption serves).
      const prev = blocks[blocks.length - 1];
      const said = clean.map((r) => r.text).join('').trim();
      if (prev?.type === 'image' && !prev.runs.length && !pics.length && said) {
        prev.runs = normalizeRuns(clean);
        if (prev.pic?.alt === said) prev.pic = tidyPic({ ...prev.pic, alt: undefined });
        if (!prev.pic) delete prev.pic;
        return;
      }
      b = makeBlock('paragraph', '', [], { style: 'caption' });
    }
    else b = makeBlock('paragraph');
    // A paragraph in one of the document's own styles keeps it.
    const own = ownStyles.get(styleId);
    if (own && !b.style && (b.type === 'paragraph' || b.type.startsWith('heading') || b.type === 'quote')) {
      b.style = own.id;
      usedOwn.add(styleId);
    }
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
    // Tab stops set on the paragraph (a "clear" one only undoes a style's, which we don't keep).
    const tabsEl = child(ppr, 'tabs');
    const tabEls = (tabsEl ? kids(tabsEl) : []).filter((t) => t.localName === 'tab' && attr(t, 'val') !== 'clear' && attr(t, 'val') !== 'bar' && attr(t, 'val') !== 'num');
    if (tabEls.length) {
      const ALIGN: Record<string, TabStop['align']> = { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', decimal: 'decimal' };
      const LEAD: Record<string, TabStop['leader']> = { dot: 'dot', middleDot: 'dot', hyphen: 'dash', underscore: 'line', heavy: 'line' };
      para.tabs = tabEls.map((t) => ({ at: Number(attr(t, 'pos') ?? 0) / TWIPS, align: ALIGN[attr(t, 'val') ?? 'left'] ?? 'left', ...(LEAD[attr(t, 'leader') ?? ''] ? { leader: LEAD[attr(t, 'leader')!] } : {}) }));
    }
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
    if (drop && !isListType(b.type)) para.drop = drop.lines;
    if (on2(child(ppr, 'pageBreakBefore')) || carried) para.pageBefore = true;
    if (on2(child(ppr, 'keepNext'))) para.keepNext = true;
    if (on2(child(ppr, 'keepLines'))) para.keepLines = true;
    // Borders and shading.
    const bdr = child(ppr, 'pBdr');
    if (bdr) {
      const drawn = (['top', 'bottom', 'left', 'right'] as const).filter((side) => { const v = attr(child(bdr, side), 'val'); return v !== null && v !== 'none' && v !== 'nil'; });
      para.border = drawn.map((side) => side[0]).join('');
      // The line's style and colour, from its first side.
      const first = drawn[0] ? child(bdr, drawn[0]) : undefined;
      const val = attr(first, 'val') ?? 'single';
      const sz = Number(attr(first, 'sz') ?? 4);
      para.bstyle = val === 'double' ? 'double' : /dot/i.test(val) ? 'dotted' : /dash/i.test(val) ? 'dashed' : sz >= 12 ? 'thick' : undefined;
      const col = attr(first, 'color');
      if (col && /^[0-9a-f]{6}$/i.test(col)) para.bcolor = `#${col.toLowerCase()}`;
    }
    const widow = child(ppr, 'widowControl');
    if (widow && /^(0|false|off)$/.test(attr(widow, 'val') ?? '')) para.nowidow = true;
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
    const cellLooks: Record<string, CellLook> = {};
    const heights: (number | null)[] = [];
    let repeatHead = false;
    for (const tr of kids(t).filter((c) => c.localName === 'tr')) {
      const r = rows.length;
      const trPr = child(tr, 'trPr');
      const th = child(trPr, 'trHeight');
      const hv = Number(attr(th, 'val') ?? 0);
      heights.push(hv > 0 && attr(th, 'hRule') !== 'auto' ? Math.round((hv / TWIPS) * 100) / 100 : null);
      if (r === 0 && on(child(trPr, 'tblHeader'))) repeatHead = true;
      const row: string[] = [];
      const jc: (string | null)[] = [];
      let c = Number(attr(child(child(tr, 'trPr'), 'gridBefore'), 'val') ?? 0);
      for (let i = 0; i < c; i++) row.push(''), jc.push(null);
      for (const tc of kids(tr).filter((x) => x.localName === 'tc')) {
        const pr = child(tc, 'tcPr');
        // The cell's text with its formatting (bold, fonts, colours…); its paragraphs run together on one line.
        const cellRunsRead: Run[] = [];
        const paras = kids(tc).filter((x) => x.localName === 'p');
        // A formula field (=SUM(ABOVE)) comes in as the formula.
        const fld = paras.length === 1 ? kids(paras[0]).find((x) => x.localName === 'fldSimple' && /^\s*=/.test(attr(x, 'instr') ?? '')) : undefined;
        for (const [k, cp] of paras.entries()) {
          if (k > 0) cellRunsRead.push({ text: '\n', marks: [] });
          await readRuns(cp, cellRunsRead, []);
        }
        if (fld) cellRunsRead.splice(0, cellRunsRead.length, { text: (attr(fld, 'instr') ?? '').trim(), marks: [] });
        const cellMd = cellText(cellRunsRead.filter((x) => !x.footnote && !x.comment).map((x) => ({ text: x.text, marks: x.marks, ...(x.look ? { look: x.look } : {}), ...(x.link ? { link: x.link } : {}) })));
        const span = Math.max(1, Number(attr(child(pr, 'gridSpan'), 'val') ?? 1) || 1);
        const vm = child(pr, 'vMerge');
        const above = vm && attr(vm, 'val') !== 'restart' ? merges.find((m) => m[1] === c && m[0] + m[2] === r) : undefined;
        if (above) above[2]++;
        else if (span > 1 || (vm && attr(vm, 'val') === 'restart')) merges.push([r, c, 1, span]);
        if (!above) {
          const fill = attr(child(pr, 'shd'), 'fill');
          if (fill && /^[0-9a-f]{6}$/i.test(fill) && fill.toLowerCase() !== 'ffffff') shades[`${r},${c}`] = `#${fill.toLowerCase()}`;
          // The cell's own text direction, up-and-down alignment and lines.
          const own: CellLook = {};
          const td = attr(child(pr, 'textDirection'), 'val');
          if (td === 'btLr') own.dir = 'up';
          else if (td === 'tbRl' || td === 'tbRlV') own.dir = 'down';
          const va = attr(child(pr, 'vAlign'), 'val');
          if (va === 'center') own.v = 'middle';
          else if (va === 'bottom') own.v = 'bottom';
          const tcb = child(pr, 'tcBorders');
          if (tcb) {
            const sideEls = (['top', 'bottom', 'left', 'right'] as const).map((side) => [side, child(tcb, side)] as const).filter(([, e]) => e);
            const drawnSides = sideEls.filter(([, e]) => !['nil', 'none'].includes(attr(e, 'val') ?? ''));
            if (drawnSides.length) {
              own.bd = drawnSides.map(([side]) => side[0]).join('');
              const e = drawnSides[0][1]!;
              const v = attr(e, 'val');
              const sz = Number(attr(e, 'sz') ?? 4);
              own.bs = v === 'double' ? 'double' : v === 'dotted' ? 'dotted' : v === 'dashed' ? 'dashed' : sz >= 12 ? 'thick' : 'single';
              const col = attr(e, 'color');
              if (col && /^[0-9a-f]{6}$/i.test(col)) own.bc = `#${col.toLowerCase()}`;
            } else if (sideEls.length === 4) own.bd = '0';
          }
          if (Object.keys(own).length) cellLooks[`${r},${c}`] = own;
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
    // A cell's own alignment where it differs from its column's.
    jcs.forEach((row, r) =>
      row.forEach((x, c) => {
        if (!x || r === 0) return;
        const col = aligns[c] ?? 'left';
        if (x !== col && (x === 'left' || x === 'center' || x === 'right')) cellLooks[`${r},${c}`] = { ...cellLooks[`${r},${c}`], h: x };
      }),
    );
    const marEl = child(pr, 'tblCellMar');
    const marLeft = Number(attr(child(marEl, 'left') ?? child(marEl, 'start'), 'w') ?? NaN);
    const lookFlag = (k: string) => attr(lookEl, k) === '1' || attr(lookEl, k) === 'true';
    const tbl = tidyTable(
      {
        widths: even ? undefined : grid,
        noHeader: first === '0',
        banded: styleVal === 'TableGridBanded' || (!!galleryStyle && attr(lookEl, 'noHBand') === '0'),
        style: galleryStyle,
        borders,
        merges,
        shades,
        aligns,
        cells: cellLooks,
        heights,
        firstCol: lookFlag('firstColumn'),
        lastCol: lookFlag('lastColumn'),
        totalRow: lookFlag('lastRow'),
        bandedCols: attr(lookEl, 'noVBand') === '0',
        noRepeat: first !== '0' && !repeatHead,
        ...(Number.isFinite(marLeft) && Math.abs(marLeft - 108) > 10 ? { pad: Math.round((marLeft / TWIPS) * 100) / 100 } : {}),
      },
      tidy.length,
      tidy[0].length,
    );
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
    if (k === 0 && sp.cols === 1 && !sp.landscape && !sp.lines && sp.hdr === undefined && sp.ftr === undefined && !sp.hfirst && sp.pstart === undefined) continue;
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
    // A section's own paper: where it differs from the one before.
    const paper = k > 0 && prev?.paper && sp.paper && (Math.abs(sp.paper.w - prev.paper.w) > 0.05 || Math.abs(sp.paper.h - prev.paper.h) > 0.05) ? sp.paper : undefined;
    b.para = tidyPara({ ...b.para, sect: k > 0 && sp.cont ? 'cont' : k > 0 && sp.parity ? sp.parity : 'page', cols: k === 0 ? sp.cols : sp.cols !== prev?.cols ? sp.cols : undefined, orient: k === 0 ? (sp.landscape ? 'landscape' : undefined) : orient, mt: own('mt'), mb: own('mb'), ml: own('ml'), mr: own('mr'), pw: paper?.w, ph: paper?.h, ...(k === 0 && sp.lines ? { lnum: sp.lines.every, lnr: sp.lines.restart === 'page' ? undefined : sp.lines.restart } : {}), hdr: sp.hdr, ftr: sp.ftr, hfirst: sp.hfirst, pstart: sp.pstart, pfmt: sp.pfmt });
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
  const out = blocks.length ? blocks : [makeBlock('paragraph')];
  // Word's "track changes" (and locked to tracked changes): kept on the first paragraph, as Crumpet keeps them.
  const wordSettings = parseXml(files.get('word/settings.xml'));
  const setting = (name: string) => Array.from(wordSettings?.getElementsByTagNameNS(W_NS, name) ?? [])[0];
  // The page colour, a line round the pages, and a watermark (from the first section's header): the whole document's.
  const doc0: ParaLook = {};
  const bg = attr(Array.from(xml.getElementsByTagNameNS(W_NS, 'background'))[0], 'color');
  if (bg && /^[0-9a-f]{6}$/i.test(bg)) doc0.pgc = `#${bg.toLowerCase()}`;
  const borders = child(bodySect, 'pgBorders');
  const top = child(borders, 'top') ?? child(borders, 'left');
  const bval = attr(top, 'val');
  if (bval && bval !== 'none' && bval !== 'nil') {
    doc0.pgb = bval === 'double' ? 'double' : bval === 'dotted' ? 'dotted' : bval.startsWith('dash') ? 'dashed' : Number(attr(top, 'sz') ?? 4) >= 18 ? 'thick' : 'single';
    const bc = attr(top, 'color');
    if (bc && /^[0-9a-f]{6}$/i.test(bc) && bc.toUpperCase() !== '333333') doc0.pgbc = `#${bc.toLowerCase()}`;
  }
  const firstSect = sectEnds[0] ? null : bodySect;
  const sectForWm = sectEnds.length ? Array.from(xml.getElementsByTagNameNS(W_NS, 'sectPr'))[0] : firstSect;
  const hdrRef = sectForWm ? kids(sectForWm).find((c) => c.localName === 'headerReference' && (attr(c, 'type') ?? 'default') === 'default') : undefined;
  const hdrPath = hdrRef ? rels.get(hdrRef.getAttributeNS(R_NS, 'id') ?? hdrRef.getAttribute('r:id') ?? '') : undefined;
  const hdrXml = hdrPath ? parseXml(files.get(hdrPath)) : null;
  if (hdrXml) {
    const VML = 'urn:schemas-microsoft-com:vml';
    const shape = Array.from(hdrXml.getElementsByTagNameNS(VML, 'shape')).find((x) => /watermark/i.test(x.getAttribute('id') ?? ''));
    const textpath = shape ? Array.from(shape.getElementsByTagNameNS(VML, 'textpath'))[0] : undefined;
    const words = textpath?.getAttribute('string');
    if (shape && words) {
      doc0.wm = words;
      const fill = shape.getAttribute('fillcolor') ?? '';
      if (/^#[0-9a-f]{6}$/i.test(fill) && fill.toLowerCase() !== '#c0c0c0') doc0.wmc = fill.toLowerCase();
      if (!/rotation\s*:\s*(315|-45)/.test(shape.getAttribute('style') ?? '')) doc0.wmflat = true;
    } else if (shape && opts.saveMedia) {
      const img = Array.from(shape.getElementsByTagNameNS(VML, 'imagedata'))[0];
      const rid = img?.getAttributeNS(R_NS, 'id') ?? img?.getAttribute('r:id');
      const media = rid ? relsOf(files, hdrPath!).get(rid) : undefined;
      const bytes = media ? files.get(media) : undefined;
      if (media && bytes) {
        const ext = media.split('.').pop()?.toLowerCase() ?? '';
        const src = await opts.saveMedia(media.split('/').pop() ?? 'watermark', bytes, MIME[ext] ?? 'image/png');
        if (src) doc0.wmimg = src;
      }
    }
  }
  // Crumpet's own design names, if Crumpet wrote the file.
  const design = Array.from(wordSettings?.getElementsByTagNameNS(W_NS, 'docVar') ?? []).find((v) => attr(v, 'name') === 'CrumpetDesign');
  for (const part of (attr(design, 'val') ?? '').split(';')) {
    const [k, v] = part.split('=');
    if ((k === 'thc' || k === 'thf' || k === 'thx' || k === 'psp') && v) doc0[k] = v;
  }
  if (Object.keys(doc0).length) out[0].para = tidyPara({ ...out[0].para, ...doc0 });
  if (on(setting('autoHyphenation'))) {
    const first = out[0];
    first.para = tidyPara({ ...first.para, hyph: true });
  }
  const track = setting('trackRevisions');
  const protection = setting('documentProtection');
  const locked = !!protection && attr(protection, 'edit') === 'trackedChanges' && /^(1|true|on)$/.test(attr(protection, 'enforcement') ?? '');
  if ((track && attr(track, 'val') !== 'false' && attr(track, 'val') !== '0') || locked) {
    let first = out[0];
    if (first.type !== 'paragraph' && first.type !== 'quote' && !first.type.startsWith('heading') && first.type !== 'bullet' && first.type !== 'numbered' && first.type !== 'todo') {
      first = makeBlock('paragraph');
      out.unshift(first);
    }
    first.para = tidyPara({ ...first.para, track: 'all', ...(locked ? { lock: 'open' } : {}) });
  }
  const styles = [...usedOwn].map((id) => {
    const o = ownStyles.get(id)!;
    const base = KNOWN_BASES[styleName.get(o.basedOn) ?? ''] ?? 'normal';
    return { id: o.id, name: o.name, base, def: o.def };
  });
  return { title: title || coreTitle, doc: { blocks: out }, ...(styles.length ? { styles } : {}) };
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
