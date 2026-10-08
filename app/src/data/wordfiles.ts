// Saving notes and manuscripts as Word documents, and opening Word documents
// as new notes: the app's side of docx.ts (pictures, fonts, page setup,
// header and footer fields, and the download itself).

import type { Doc } from '@crumpet/editor/model';
import { DOCX_TYPE, fromDocx, toDocx } from './docx';
import { EPUB_TYPE, toEpub } from './epub';
import { addFile, mediaUrl } from './files';
import { type HFContext, type HFRun, cleanHF, fieldValue } from './headers';
import { docWords, projectChapters } from './selectors';
import type { AppState } from './store';
import { defaultPage, manuscriptPage } from './styles';
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
  });
}

/** A project's manuscript as a Word document: each chapter on a new page under its title. */
export async function projectDocx(state: AppState, project: Project): Promise<Uint8Array> {
  const page = project.page ?? manuscriptPage();
  const hf = cleanHF(page.hf, page.pageNumbers);
  const list = projectChapters(project, state.chapters);
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
    list.map(({ chapter, number }) => ({ heading: chapter.title || `Chapter ${number}`, doc: chapter.doc })),
    { title: project.name, author: ctx.author || undefined, page, hf, field: fieldFiller(ctx, hf), font: 'Times New Roman', size: 12, media: mediaBytes },
  );
}

/** Opens a Word document as a note's title and text, keeping its pictures. */
export async function readWordFile(file: File): Promise<{ title: string; doc: Doc }> {
  let result;
  try {
    result = await fromDocx(new Uint8Array(await file.arrayBuffer()), {
      saveMedia: async (name, bytes, type) => (await addFile(new File([bytes as BlobPart], name, { type }))).src,
    });
  } catch {
    throw new Error(`${file.name} couldn’t be opened. Is it a Word document (.docx)?`);
  }
  return { title: result.title || file.name.replace(/\.docx$/i, ''), doc: result.doc };
}

/** A project as an e-book: a title page, contents, and each chapter. */
export async function projectEpub(state: AppState, project: Project): Promise<Uint8Array> {
  const list = projectChapters(project, state.chapters);
  const page = project.page ?? manuscriptPage();
  const author = cleanHF(page.hf, page.pageNumbers).author || state.settings.name || undefined;
  return toEpub(
    list.map(({ chapter, number }) => ({ title: chapter.title || `Chapter ${number}`, doc: chapter.doc })),
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
