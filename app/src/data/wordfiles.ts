// Saving notes and manuscripts as Word documents, and opening Word documents
// as new notes: the app's side of docx.ts (pictures, fonts, page setup,
// header and footer fields, and the download itself).

import { toFountain } from './fountain';
import { type Doc, caret, makeBlock } from '@crumpet/editor/model';
import { resolveChanges } from '@crumpet/editor/commands';
import { applyOps } from '@crumpet/editor/ops';
import { DOCX_TYPE, type DocxImport, type DocxOptions, fromDocx, toDocx } from './docx';
import { bibliography, inText } from './citations';
import { EPUB_TYPE, toEpub } from './epub';
import { EXPORT_TYPES, type ExportPart, toHtml, toOdt, toRtf, toText } from './exports';
import { addFile, mediaUrl } from './files';
import { type HFContext, type HFRun, cleanHF, fieldValue } from './headers';
import { docWords, projectChapters } from './selectors';
import type { AppState } from './store';
import { defaultPage, fullSheet, manuscriptPage } from './styles';
import { DEFAULT_NOTE_SIZE, type Note, type Project } from './types';

/** A picture's bytes, wherever it's kept. */
export async function mediaBytes(src: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    const url = await mediaUrl(src);
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type };
  } catch {
    return null;
  }
}

/** A name for the downloaded file. */
export function docxName(title: string): string {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  return `${base || 'Untitled'}.docx`;
}

/** Hands the browser a file to save. */
export function download(bytes: Uint8Array, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function fieldFiller(ctx: HFContext, hf: ReturnType<typeof cleanHF>) {
  return (run: HFRun) => fieldValue(run, ctx, 1, hf);
}

/** Citations' text and the bibliography's lines, from the sources the documents cite. */
function citing(state: AppState, docs: Doc[]): Pick<DocxOptions, 'cite' | 'sources'> {
  const sources = state.settings.sources ?? [];
  const style = state.settings.citeStyle ?? 'apa';
  const keys = [...new Set(docs.flatMap((d) => d.blocks.flatMap((b) => b.runs.filter((r) => r.field?.startsWith('cite:')).map((r) => r.field!.slice(5)))))];
  return {
    cite: (key) => {
      const src = sources.find((x) => x.key === key);
      return src ? inText(src, style) : `(${key})`;
    },
    sources: () => bibliography(sources, keys, style),
  };
}

/** A note as a Word document. */
export async function noteDocx(state: AppState, note: Note): Promise<Uint8Array> {
  const s = state.settings;
  const page = s.notePage ?? defaultPage();
  const hf = cleanHF(page.hf, page.pageNumbers);
  const ctx: HFContext = { title: note.title || 'Untitled', author: s.name || '', words: docWords(note.doc), created: note.createdAt, updated: note.updatedAt, pages: 1, chapterPages: 1, now: Date.now() };
  const family = s.noteFont && s.noteFont.source !== 'default' ? s.noteFont.family : 'Georgia';
  return toDocx([{ doc: note.doc }], {
    title: note.title || 'Untitled',
    author: s.name || undefined,
    page,
    hf,
    field: fieldFiller(ctx, hf),
    font: family,
    size: Math.round((s.noteSize ?? DEFAULT_NOTE_SIZE) * 0.75 * 2) / 2,
    media: mediaBytes,
    titleParagraph: note.title.trim() || undefined,
    custom: fullSheet(s.noteStyles, 'crumpet').custom,
    ...citing(state, [note.doc]),
  });
}

/** A project's manuscript as a Word document: each chapter on a new page under its title. */
export async function projectDocx(state: AppState, project: Project, opts: BookOptions = {}): Promise<Uint8Array> {
  const page = project.page ?? manuscriptPage();
  const hf = cleanHF(page.hf, page.pageNumbers);
  const list = projectChapters(project, state.chapters);
  const parts = bookParts(state, project, opts);
  const ctx: HFContext = {
    title: project.name,
    author: hf.author || state.settings.name || '',
    words: list.reduce((n, x) => n + docWords(x.chapter.doc), 0),
    created: project.createdAt,
    updated: project.updatedAt,
    pages: 1,
    chapterPages: 1,
    now: Date.now(),
  };
  return toDocx(
    parts,
    { title: project.name, author: ctx.author || undefined, page, hf, field: fieldFiller(ctx, hf), font: 'Times New Roman', size: 12, media: mediaBytes, custom: fullSheet(project.styles, 'manuscript').custom, ...citing(state, parts.map((x) => x.doc)) },
  );
}

/** Opens a Word document as a note's title and text, keeping its pictures. */
export type WordStyles = NonNullable<DocxImport['styles']>;

export async function readWordFile(file: File): Promise<{ title: string; doc: Doc; styles?: WordStyles }> {
  let result;
  try {
    result = await fromDocx(new Uint8Array(await file.arrayBuffer()), {
      saveMedia: async (name, bytes, type) => (await addFile(new File([bytes as BlobPart], name, { type }))).src,
    });
  } catch {
    throw new Error(`${file.name} couldn’t be opened. Is it a Word document (.docx)?`);
  }
  return { title: result.title || file.name.replace(/\.docx$/i, ''), doc: result.doc, ...(result.styles ? { styles: result.styles } : {}) };
}

/** A project as an e-book: a title page, contents, and each chapter. */
export async function projectEpub(state: AppState, project: Project, opts: BookOptions = {}): Promise<Uint8Array> {
  const page = project.page ?? manuscriptPage();
  const author = cleanHF(page.hf, page.pageNumbers).author || state.settings.name || undefined;
  // An e-book always has its own title page.
  return toEpub(
    bookParts(state, project, { ...opts, titlePage: false }).map((p) => ({ title: p.heading || '', doc: p.doc })),
    { title: project.name || 'Untitled', author, language: navigator.language, id: project.id, media: mediaBytes },
  );
}

/** A note as a little e-book of one chapter. */
export async function noteEpub(state: AppState, note: Note): Promise<Uint8Array> {
  const title = note.title || 'Untitled';
  return toEpub([{ title, doc: note.doc }], { title, author: state.settings.name || undefined, language: navigator.language, id: note.id, media: mediaBytes });
}

/** A name for a downloaded file. */
export function fileName(title: string, ext: string): string {
  return docxName(title).replace(/\.docx$/, `.${ext}`);
}

export { DOCX_TYPE, EPUB_TYPE };

/** A note's or project's text in another format (Word's Save As types). */
export async function exportAs(kind: keyof typeof EXPORT_TYPES, title: string, parts: ExportPart[]): Promise<void> {
  const t = title || 'Untitled';
  const data = kind === 'fountain' ? toFountain(t, parts) : kind === 'txt' ? toText(t, parts) : kind === 'html' ? await toHtml(t, parts, mediaBytes) : kind === 'rtf' ? toRtf(t, parts) : await toOdt(t, parts, mediaBytes);
  download(typeof data === 'string' ? new TextEncoder().encode(data) : data, fileName(t, kind), EXPORT_TYPES[kind].type);
}

/** A project's chapters, each under its title, for exporting. */
export function projectParts(state: AppState, project: Project, opts: BookOptions = {}): ExportPart[] {
  return bookParts(state, project, opts);
}

/** What goes into an exported book besides its chapters (the Export window's Included). */
export interface BookOptions {
  /** A first page with the title, the author and the length. */
  titlePage?: boolean;
  /** A page with each part's name before its chapters. */
  partHeadings?: boolean;
  /** Keep comments and tracked changes; otherwise the text reads as if every change were accepted. */
  notes?: boolean;
}

/** The text as it reads with every change accepted and no comments on it. */
export function finalDoc(doc: Doc): Doc {
  let d = doc;
  const first = doc.blocks[0];
  if (first) {
    const tr = resolveChanges({ doc, selection: caret({ block: first.id, offset: 0 }), storedMarks: null }, true);
    if (tr) d = applyOps(doc, tr.ops);
  }
  if (!d.blocks.some((b) => b.runs.some((r) => r.comment))) return d;
  return { ...d, blocks: d.blocks.map((b) => (b.runs.some((r) => r.comment) ? { ...b, runs: b.runs.map(({ comment: _, ...r }) => r) } : b)) };
}

/** A book's pages for exporting: a title page, part pages and chapters, each chapter under its title. */
export function bookParts(state: AppState, project: Project, opts: BookOptions = {}): { heading?: string; doc: Doc }[] {
  const list = projectChapters(project, state.chapters);
  const out: { heading?: string; doc: Doc }[] = [];
  if (opts.titlePage) {
    const page = project.page ?? manuscriptPage();
    const author = cleanHF(page.hf, page.pageNumbers).author || state.settings.name || '';
    const words = list.reduce((n, x) => n + docWords(x.chapter.doc), 0);
    const about = words >= 1000 ? Math.round(words / 1000) * 1000 : Math.max(100, Math.round(words / 100) * 100);
    const centre = { align: 'center' as const };
    out.push({
      doc: {
        blocks: [
          ...['', '', '', '', '', ''].map(() => makeBlock('paragraph')),
          makeBlock('paragraph', project.name || 'Untitled', [], { ...centre, style: 'title' }),
          ...(author ? [makeBlock('paragraph', `by ${author}`, [], centre)] : []),
          makeBlock('paragraph'),
          makeBlock('paragraph', `About ${about.toLocaleString('en-GB')} words`, [], centre),
        ],
      },
    });
  }
  let part: string | null = null;
  for (const { chapter, number, part: p } of list) {
    if (opts.partHeadings && p && p.id !== part) out.push({ heading: p.title || 'Part', doc: { blocks: [] } });
    part = p?.id ?? null;
    out.push({ heading: chapter.title || `Chapter ${number}`, doc: opts.notes === false ? finalDoc(chapter.doc) : chapter.doc });
  }
  return out;
}
