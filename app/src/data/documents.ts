// Uploaded documents: files opened as what they are. Each becomes a note
// (so it can be filed, tagged, searched and opened in a pane) that points at
// the file, kept in Attachments (`note.file`):
// - pictures, PDFs, videos and sound are shown as themselves;
// - a Word document is edited in the editor and saved back to its own .docx
//   (in its own font, size and paper); left alone, the file stays exactly as
//   it came;
// - Markdown and text files are notes already, so they simply become notes;
// - anything else is kept, to download or open in another app.
// The note's text holds the picture or file too, so other Markdown apps (and
// earlier versions of Crumpet) still show it.

import { type Doc, makeBlock } from '@crumpet/editor/model';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { DOCX_TYPE, toDocx } from './docx';
import { addFile, fileBlob, isImage, replaceFile } from './files';
import { mediaBytes, readWordFile } from './wordfiles';
import { readZip } from './zip';
import { PAGE_SIZES, type PageSize, defaultPage } from './styles';
import type { Note } from './types';

export type FileKind = 'image' | 'pdf' | 'video' | 'audio' | 'word' | 'text' | 'other';

/** What a file is, from its name (and type, when known). */
export function fileKind(name: string, type = ''): FileKind {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  if (ext === 'docx' || type === DOCX_TYPE) return 'word';
  if (ext === 'pdf' || type === 'application/pdf') return 'pdf';
  if (isImage(type, name) || ['ico', 'jfif', 'pjpeg'].includes(ext)) return 'image';
  if (/^video\//.test(type) || ['mp4', 'm4v', 'webm', 'mov', 'ogv'].includes(ext)) return 'video';
  if (/^audio\//.test(type) || ['mp3', 'm4a', 'wav', 'ogg', 'oga', 'aac', 'flac', 'opus'].includes(ext)) return 'audio';
  if (['md', 'markdown', 'txt', 'text'].includes(ext) || type === 'text/markdown' || type === 'text/plain') return 'text';
  return 'other';
}

export const KIND_NAME: Record<FileKind, string> = { image: 'Picture', pdf: 'PDF', video: 'Video', audio: 'Sound', word: 'Word document', text: 'Text', other: 'File' };

/** The file name a note's file goes by (without the Attachments folder and the id before it). */
export function fileLabel(path: string): string {
  return path.replace(/^.*\//, '').replace(/^[a-z0-9]{7}-/, '');
}

/** A note to make from a file, and the file it keeps (if any). */
export interface Upload {
  title: string;
  doc: Doc;
  file?: string;
}

/** Reads a dropped or chosen file into a note's makings. Throws (with a message to show) if it can't. */
export async function readUpload(f: File): Promise<Upload> {
  const kind = fileKind(f.name, f.type);
  const title = f.name.replace(/\.[^.]+$/, '');
  if (kind === 'text') {
    const text = await f.text();
    const md = /\.(md|markdown)$/i.test(f.name) || f.type === 'text/markdown';
    return { title, doc: md ? fromMarkdown(text) : { blocks: text.split(/\r\n?|\n/).map((line) => makeBlock('paragraph', line)) } };
  }
  if (kind === 'word') {
    // The file is kept as it is; the editor gets what's in it.
    const read = await readWordFile(f);
    const kept = await addFile(f);
    return { title: read.title || title, doc: read.doc, file: kept.src };
  }
  const kept = await addFile(f);
  const block = makeBlock(kept.type, kept.type === 'file' ? kept.caption : '', [], { src: kept.src });
  return { title, doc: { blocks: [block] }, file: kept.src };
}

/** A Word document's own look, read from its file: its usual font and size, and its paper. */
export async function wordLook(bytes: Uint8Array): Promise<{ font?: string; size?: number; paper?: PageSize }> {
  const files = await readZip(bytes);
  const text = (p: string) => {
    const b = files.get(p);
    return b ? new TextDecoder().decode(b) : '';
  };
  const styles = text('word/styles.xml');
  const defaults = /<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/.exec(styles)?.[0] ?? '';
  const font = /<w:rFonts[^>]*w:ascii="([^"]+)"/.exec(defaults)?.[1];
  const sz = Number(/<w:sz w:val="(\d+)"/.exec(defaults)?.[1] ?? 0) / 2;
  const body = text('word/document.xml');
  const pg = /<w:pgSz[^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/.exec(body);
  let paper: PageSize | undefined;
  if (pg) {
    const [w, h] = [Number(pg[1]) / 1440, Number(pg[2]) / 1440];
    const [short, long] = [Math.min(w, h), Math.max(w, h)];
    paper = PAGE_SIZES.find((p) => Math.abs(p.width - short) < 0.25 && Math.abs(p.height - long) < 0.25)?.id;
  }
  return { ...(font ? { font } : {}), ...(sz > 0 ? { size: sz } : {}), ...(paper ? { paper } : {}) };
}

/** A Word document's note written back as its .docx, keeping the file's own font, size and paper. */
export async function wordBytes(note: Note, look: { font?: string; size?: number; paper?: PageSize }): Promise<Uint8Array> {
  const page = { ...defaultPage(), ...(look.paper ? { size: look.paper } : {}), pageNumbers: false };
  return toDocx([{ doc: note.doc }], { title: note.title || 'Untitled', page, font: look.font ?? 'Calibri', size: look.size ?? 11, media: mediaBytes });
}

/** Saves a Word document's note back to its file. */
export async function saveWordFile(note: Note): Promise<void> {
  if (!note.file || fileKind(note.file) !== 'word') return;
  const was = await fileBlob(note.file);
  let look = {};
  try {
    if (was) look = await wordLook(new Uint8Array(await was.arrayBuffer()));
  } catch {
    // Not readable: Crumpet's own defaults.
  }
  const bytes = await wordBytes(note, look);
  await replaceFile(note.file, new Blob([bytes as BlobPart], { type: DOCX_TYPE }));
}
