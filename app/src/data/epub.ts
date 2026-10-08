// E-books (ePub 3): a project's chapters, or a single note, as a book that
// opens in Apple Books, Kobo, Google Play Books and the like (and converts
// for Kindle). Pictures and footnotes come along; comments don't, and
// tracked changes are shown as if accepted.

import { type Block, type Doc, type Run, isList, tidyRows } from '@crumpet/editor/model';
import { NOTE_LINK } from '@crumpet/editor/markdown';
import { type ZipEntry, utf8, writeZip } from './zip';

export const EPUB_TYPE = 'application/epub+zip';

export interface BookChapter {
  title: string;
  doc: Doc;
}

export interface BookOptions {
  title: string;
  author?: string;
  language?: string;
  /** Stays the same for the same book, so readers know it's a new version of it. */
  id: string;
  /** A picture's bytes, from its src. */
  media?(src: string): Promise<{ bytes: Uint8Array; type: string } | null>;
}

function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp' };

class Book {
  images: { href: string; type: string; data: Uint8Array }[] = [];
  private seen = new Map<string, string | null>();

  constructor(private opts: BookOptions) {}

  async image(src: string): Promise<string | null> {
    if (this.seen.has(src)) return this.seen.get(src)!;
    let href: string | null = null;
    const got = await this.opts.media?.(src).catch(() => null);
    const ext = got && IMAGE_TYPES[got.type.split(';')[0]];
    if (got && ext) {
      href = `images/image${this.images.length + 1}.${ext}`;
      this.images.push({ href, type: got.type.split(';')[0], data: got.bytes });
    }
    this.seen.set(src, href);
    return href;
  }

  /** A chapter's text as XHTML, with its footnotes gathered at the end. */
  async chapter(doc: Doc, n: number): Promise<string> {
    const notes: string[] = [];
    const runs = (list: Run[]): string => {
      let out = '';
      for (const r of list) {
        if (r.change?.kind === 'del') continue;
        if (r.footnote !== undefined) {
          const k = notes.length + 1;
          notes.push(`<aside epub:type="footnote" id="fn${n}-${k}" class="footnote"><p><a href="#ref${n}-${k}">${k}.</a> ${esc(r.footnote)}</p></aside>`);
          out += `<a epub:type="noteref" href="#fn${n}-${k}" id="ref${n}-${k}" class="noteref">${k}</a>`;
          continue;
        }
        let t = esc(r.text).replace(/\n/g, '<br/>').replace(/\t/g, ' ');
        const m = r.marks;
        if (m.includes('code')) t = `<code>${t}</code>`;
        if (m.includes('strike')) t = `<s>${t}</s>`;
        if (m.includes('underline')) t = `<u>${t}</u>`;
        if (m.includes('italic')) t = `<em>${t}</em>`;
        if (m.includes('bold')) t = `<strong>${t}</strong>`;
        // E-readers choose the font and size; colour, highlight and raised or lowered text are kept.
        if (r.look?.va) t = r.look.va === 'super' ? `<sup>${t}</sup>` : `<sub>${t}</sub>`;
        const css = [r.look?.color ? `color: ${r.look.color}` : '', r.look?.highlight ? `background-color: ${r.look.highlight}` : ''].filter(Boolean).join('; ');
        if (css) t = `<span style="${css}">${t}</span>`;
        if (r.link && /^(https?|mailto):/.test(r.link)) t = `<a href="${esc(r.link)}">${t}</a>`;
        else if (r.link?.startsWith(NOTE_LINK)) t = `<span class="note-link">${t}</span>`;
        out += t;
      }
      return out;
    };
    const style = (b: Block) => (b.align && b.align !== 'left' ? ` style="text-align: ${b.align}"` : '');

    let out = '';
    const blocks = doc.blocks;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (isList(b.type)) {
        // A run of list items, nested by indent.
        const open: string[] = [];
        let j = i;
        for (; j < blocks.length && isList(blocks[j].type); j++) {
          const it = blocks[j];
          const level = it.indent ?? 0;
          const tag = it.type === 'numbered' ? 'ol' : 'ul';
          while (open.length > level + 1) out += `</li></${open.pop()}>`;
          if (open.length === level + 1 && open[level] !== tag) out += `</li></${open.pop()}>`;
          if (open.length === level + 1) out += '</li>';
          while (open.length < level + 1) {
            out += `<${tag}${it.type === 'todo' ? ' class="checklist"' : ''}>`;
            open.push(tag);
          }
          const box = it.type === 'todo' ? `<span class="box">${it.checked ? '☑' : '☐'}</span> ` : '';
          out += `<li${style(it)}>${box}${runs(it.runs)}`;
        }
        while (open.length) out += `</li></${open.pop()}>`;
        i = j - 1;
        continue;
      }
      switch (b.type) {
        case 'heading1':
        case 'heading2':
        case 'heading3':
        case 'heading4':
          // The chapter title is the h1; headings inside a chapter sit one level below.
          out += `<h${Number(b.type.slice(-1)) + 1}${style(b)}>${runs(b.runs)}</h${Number(b.type.slice(-1)) + 1}>`;
          break;
        case 'quote':
          out += `<blockquote${b.style === 'intense' ? ' class="intense"' : ''}><p${style(b)}>${runs(b.runs)}</p></blockquote>`;
          break;
        case 'image': {
          const href = b.src ? await this.image(b.src) : null;
          const caption = runs(b.runs);
          if (href) out += `<figure><img src="${esc(href)}" alt="${esc(b.runs.map((r) => r.text).join(''))}"/>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
          else if (caption) out += `<p class="caption">${caption}</p>`;
          break;
        }
        case 'file':
          out += `<p>${runs(b.runs) || esc((b.src ?? '').replace(/^.*\//, ''))}</p>`;
          break;
        case 'table': {
          const rows = tidyRows(b.rows);
          out += `<table><thead><tr>${rows[0].map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows
            .slice(1)
            .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`;
          break;
        }
        default:
          if (b.style === 'scenebreak' && !b.runs.length) out += '<p class="scenebreak">*&#160;&#160;*&#160;&#160;*</p>';
          else out += `<p${b.style ? ` class="${b.style}"` : ''}${style(b)}>${runs(b.runs) || '&#160;'}</p>`;
      }
    }
    if (notes.length) out += `<section epub:type="footnotes" class="footnotes"><hr/>${notes.join('')}</section>`;
    return out;
  }
}

const CSS = `body { font-family: Georgia, "Times New Roman", serif; line-height: 1.5; margin: 0 5%; }
h1 { font-size: 1.6em; text-align: center; margin: 2em 0 1.5em; font-weight: normal; }
h2 { font-size: 1.3em; margin: 1.5em 0 0.5em; } h3 { font-size: 1.15em; } h4, h5 { font-size: 1em; }
p { margin: 0; text-indent: 1.5em; }
h1 + p, h2 + p, h3 + p, h4 + p, h5 + p, .scenebreak + p, blockquote + p, figure + p, ul + p, ol + p, table + p, p.nospacing { text-indent: 0; }
p.title { font-size: 2em; text-align: center; text-indent: 0; margin: 1em 0; }
p.subtitle { font-size: 1.3em; text-align: center; text-indent: 0; font-style: italic; }
p.epigraph { margin: 1em 0 1em 30%; font-style: italic; text-indent: 0; }
p.caption, figcaption { font-size: 0.85em; font-style: italic; text-align: center; text-indent: 0; }
p.scenebreak { text-align: center; text-indent: 0; margin: 1em 0; }
blockquote { margin: 1em 2em; font-style: italic; } blockquote.intense { font-weight: bold; }
blockquote p { text-indent: 0; }
figure { margin: 1em 0; text-align: center; } img { max-width: 100%; }
ul, ol { margin: 0.5em 0 0.5em 1.5em; padding: 0; } ul.checklist { list-style: none; margin-left: 0.5em; }
table { border-collapse: collapse; margin: 1em 0; width: 100%; } th, td { border: 1px solid #999; padding: 0.2em 0.4em; text-align: left; }
a.noteref { vertical-align: super; font-size: 0.7em; line-height: 0; text-decoration: none; }
.footnotes { margin-top: 2em; font-size: 0.85em; } .footnotes hr { width: 30%; margin-left: 0; } .footnote p { text-indent: 0; margin: 0.3em 0; }
.title-page { text-align: center; margin-top: 30%; } .title-page h1 { font-size: 2em; } .title-page p { text-indent: 0; font-size: 1.2em; }
`;

const page = (title: string, lang: string, body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${esc(lang)}" lang="${esc(lang)}"><head><meta charset="UTF-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${body}</body></html>\n`;

/** An e-book of `chapters`. */
export async function toEpub(chapters: BookChapter[], opts: BookOptions): Promise<Uint8Array> {
  const lang = opts.language || 'en';
  const book = new Book(opts);
  const files: ZipEntry[] = [];
  const titlePage = page(opts.title, lang, `<section class="title-page" epub:type="titlepage"><h1>${esc(opts.title)}</h1>${opts.author ? `<p>${esc(opts.author)}</p>` : ''}</section>`);
  files.push({ name: 'OEBPS/title.xhtml', data: utf8(titlePage) });
  const items: { id: string; href: string; title: string }[] = [];
  for (const [i, c] of chapters.entries()) {
    const href = `chapter${i + 1}.xhtml`;
    const body = await book.chapter(c.doc, i + 1);
    files.push({ name: `OEBPS/${href}`, data: utf8(page(c.title, lang, `<section epub:type="chapter"><h1>${esc(c.title)}</h1>${body}</section>`)) });
    items.push({ id: `ch${i + 1}`, href, title: c.title });
  }
  const nav = page(
    'Contents',
    lang,
    `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${items.map((it) => `<li><a href="${it.href}">${esc(it.title)}</a></li>`).join('')}</ol></nav>`,
  );
  files.push({ name: 'OEBPS/nav.xhtml', data: utf8(nav) });
  files.push({ name: 'OEBPS/style.css', data: utf8(CSS) });
  for (const img of book.images) files.push({ name: `OEBPS/${img.href}`, data: img.data });

  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${esc(lang)}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">urn:crumpet:${esc(opts.id)}</dc:identifier>
<dc:title>${esc(opts.title)}</dc:title>
${opts.author ? `<dc:creator>${esc(opts.author)}</dc:creator>\n` : ''}<dc:language>${esc(lang)}</dc:language>
<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
<item id="css" href="style.css" media-type="text/css"/>
${items.map((it) => `<item id="${it.id}" href="${it.href}" media-type="application/xhtml+xml"/>`).join('\n')}
${book.images.map((img, i) => `<item id="img${i + 1}" href="${img.href}" media-type="${img.type}"/>`).join('\n')}
</manifest>
<spine>
<itemref idref="title"/>
<itemref idref="nav"/>
${items.map((it) => `<itemref idref="${it.id}"/>`).join('\n')}
</spine>
</package>
`;
  const container = `<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n`;
  return writeZip([
    // Must come first, uncompressed, so readers know what the file is.
    { name: 'mimetype', data: utf8(EPUB_TYPE), store: true },
    { name: 'META-INF/container.xml', data: utf8(container) },
    { name: 'OEBPS/content.opf', data: utf8(opf) },
    ...files,
  ]);
}
