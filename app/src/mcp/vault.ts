// Crumpet's MCP server: the synced folder, read as notes, notebooks and books.
// It works on the files the sync writes (sync/layout.ts): notes are Markdown
// with front matter, notebooks are folders (in a stack's folder or not),
// books are folders in Projects/ with project.json and numbered chapters, and
// their research notes are in Research/. The Trash and Crumpet's own
// settings are left out.

import { parseNoteFile, writeNoteFile } from '../sync/notefile';
import { ATTACHMENTS, PROJECTS, DRAFTS, PROJECT_FILE, RESEARCH, baseName, join, parentOf, safeName } from '../sync/layout';

/** The folder, as the server sees it: its files by path ("Ideas/Rome.md"), read and written by the host (Node, or a test). */
export interface Folder {
  /** Every file's path, with when it last changed (ms). */
  list(): Promise<{ path: string; mtime: number }[]>;
  read(path: string): Promise<string>;
  /** Makes a new file (and its folder); fails if one is there already. */
  create(path: string, text: string): Promise<void>;
}

export interface Entry {
  path: string;
  kind: 'note' | 'chapter' | 'research';
  title: string;
  /** The notebook (folder) a note is in; empty for the Inbox. */
  notebook: string;
  stack: string;
  /** The book a chapter or research note belongs to. */
  book: string;
  /** A chapter's number in its book, and the part it's in. */
  number: number;
  part: string;
  tags: string[];
  favorite: boolean;
  updated: number;
  status: string;
  synopsis: string;
  body: string;
  locked: boolean;
}

export interface Book {
  name: string;
  dir: string;
  goal: number | null;
  /** The part each chapter is in, by the chapter's id. */
  partOf: Record<string, string>;
  cast: { kind: string; name: string; aliases: string[]; description: string; notes: string }[];
  deadline: string;
}

export interface Index {
  entries: Entry[];
  books: Book[];
  notebooks: { name: string; stack: string; path: string; count: number }[];
}

const hidden = (path: string) => path.split('/').some((s) => s.startsWith('.'));

/** Reads the whole folder. */
export async function readIndex(folder: Folder): Promise<Index> {
  const files = (await folder.list()).filter((f) => !hidden(f.path) && f.path.split('/')[0] !== ATTACHMENTS);
  const books: Book[] = [];
  const bookByDir = new Map<string, Book>();
  for (const f of files) {
    const parts = f.path.split('/');
    if (parts.length !== 3 || parts[0] !== PROJECTS || parts[2] !== PROJECT_FILE) continue;
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(await folder.read(f.path)) as Record<string, unknown>;
    } catch {
      // A project.json that doesn't read: the book still shows by its folder's name.
    }
    const dir = parentOf(f.path);
    const outline = Array.isArray(json.outline) ? (json.outline as { type?: string; id?: string; title?: string }[]) : [];
    const partOf: Record<string, string> = {};
    let part = '';
    for (const o of outline) {
      if (o.type === 'part') part = o.title ?? '';
      else if (o.type === 'chapter' && o.id && part) partOf[o.id] = part;
    }
    const deadline = json.deadline && typeof json.deadline === 'object' ? (json.deadline as { date?: unknown }).date : undefined;
    const book: Book = {
      name: typeof json.name === 'string' && json.name ? json.name : baseName(dir),
      dir,
      goal: typeof json.goal === 'number' ? json.goal : null,
      partOf,
      cast: (Array.isArray(json.cast) ? (json.cast as Record<string, unknown>[]) : []).map((c) => ({
        kind: typeof c.kind === 'string' && c.kind ? c.kind : 'character',
        name: String(c.name ?? ''),
        aliases: Array.isArray(c.aliases) ? c.aliases.map(String) : [],
        description: String(c.description ?? ''),
        notes: String(c.notes ?? ''),
      })),
      deadline: typeof deadline === 'string' ? deadline : '',
    };
    books.push(book);
    bookByDir.set(dir, book);
  }
  const entries: Entry[] = [];
  const counts = new Map<string, number>();
  const folders = new Set<string>();
  for (const f of files) {
    const parts = f.path.split('/');
    if (parts[0] !== PROJECTS && parts.length > 1) folders.add(parentOf(f.path));
    if (!f.path.toLowerCase().endsWith('.md')) continue;
    let text: string;
    try {
      text = await folder.read(f.path);
    } catch {
      continue;
    }
    const file = parseNoteFile(text);
    const name = baseName(f.path).replace(/\.md$/i, '');
    const e: Entry = {
      path: f.path,
      kind: 'note',
      title: file.title ?? name,
      notebook: '',
      stack: '',
      book: '',
      number: 0,
      part: '',
      tags: file.tags,
      favorite: file.favorite,
      updated: file.updated ?? f.mtime,
      status: file.status ?? '',
      synopsis: file.synopsis ?? '',
      body: file.body,
      locked: /^```locked\b/.test(file.body.trimStart()),
    };
    if (parts[0] === PROJECTS) {
      const book = bookByDir.get(parts.slice(0, 2).join('/'));
      // Chapters' other drafts (Drafts/) aren't the book: it's made of the drafts its chapter files hold.
      if (!book || parts.length < 3 || parts[2] === DRAFTS) continue;
      e.book = book.name;
      if (parts[2] === RESEARCH) e.kind = 'research';
      else {
        e.kind = 'chapter';
        e.part = (file.id && book.partOf[file.id]) || '';
        const m = /^(\d+)\s+(.*)$/.exec(name);
        if (m) {
          e.number = Number(m[1]);
          if (file.title === null) e.title = m[2];
        }
      }
    } else if (parts.length >= 2) {
      e.notebook = parts[parts.length - 2];
      e.stack = parts.length >= 3 ? parts[parts.length - 3] : '';
      counts.set(parentOf(f.path), (counts.get(parentOf(f.path)) ?? 0) + 1);
    }
    entries.push(e);
  }
  // Chapters in their books' order, numbered 1, 2, 3 as Crumpet shows them.
  for (const book of books) {
    const chapters = entries.filter((e) => e.kind === 'chapter' && e.book === book.name).sort((a, b) => a.number - b.number || (a.path < b.path ? -1 : 1));
    chapters.forEach((c, i) => (c.number = i + 1));
  }
  const notebooks = [...folders]
    .filter((p) => (counts.get(p) ?? 0) > 0 || p.split('/').length <= 2)
    .map((p) => ({ name: baseName(p), stack: p.includes('/') ? parentOf(p) : '', path: p, count: counts.get(p) ?? 0 }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return { entries, books, notebooks };
}

/** Words in the text, for counting. */
export function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Notes and chapters with every word of the query (in the title, tags or text), best first, each with a line of text around the first match. */
export function search(index: Index, query: string): { entry: Entry; snippet: string }[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out: { entry: Entry; snippet: string; score: number }[] = [];
  for (const e of index.entries) {
    const title = fold(e.title);
    const tags = fold(e.tags.join(' '));
    const body = e.locked ? '' : fold(e.body);
    if (!words.every((w) => title.includes(w) || tags.includes(w) || body.includes(w))) continue;
    let score = 0;
    for (const w of words) {
      if (title.includes(w)) score += 10;
      if (tags.includes(w)) score += 5;
      score += Math.min(5, body.split(w).length - 1);
    }
    const at = body.indexOf(words.find((w) => body.includes(w)) ?? '\u0000');
    const snippet = at < 0 ? '' : `${at > 60 ? '…' : ''}${e.body.slice(Math.max(0, at - 60), at + 140).replace(/\s+/g, ' ').trim()}${at + 140 < e.body.length ? '…' : ''}`;
    out.push({ entry: e, snippet, score });
  }
  return out.sort((a, b) => b.score - a.score || b.entry.updated - a.entry.updated);
}

/** A new note's file: in a notebook, a book's research, or the Inbox; never over another file. */
export async function createNote(folder: Folder, index: Index, note: { title: string; text: string; notebook?: string; book?: string; tags?: string[] }): Promise<string> {
  let dir = '';
  if (note.book) {
    const book = findBook(index, note.book);
    if (!book) throw new Error(`There's no book called “${note.book}”. Books: ${index.books.map((b) => b.name).join(', ') || 'none yet'}.`);
    dir = join(book.dir, RESEARCH);
  } else if (note.notebook && !/^inbox$/i.test(note.notebook.trim())) {
    const want = fold(note.notebook.trim());
    const nb = index.notebooks.find((n) => fold(n.path) === want) ?? index.notebooks.find((n) => fold(n.name) === want);
    if (!nb) throw new Error(`There's no notebook called “${note.notebook}”. Notebooks: ${index.notebooks.map((n) => n.path).join(', ') || 'none yet'} (or leave it out for the Inbox).`);
    dir = nb.path;
  }
  const taken = new Set((await folder.list()).map((f) => f.path.toLowerCase()));
  const base = safeName(note.title || 'Untitled');
  let path = join(dir, `${base}.md`);
  for (let n = 2; taken.has(path.toLowerCase()); n++) path = join(dir, `${base} ${n}.md`);
  const now = Date.now();
  const text = writeNoteFile({
    id: crypto.randomUUID(),
    title: note.title,
    tags: (note.tags ?? []).map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
    favorite: false,
    created: now,
    updated: now,
    trashed: null,
    from: null,
    extra: '',
    body: note.text.trim() ? `${note.text.trim()}\n` : '',
  });
  await folder.create(path, text);
  return path;
}

export function findBook(index: Index, name: string): Book | undefined {
  const want = fold(name.trim());
  return index.books.find((b) => fold(b.name) === want) ?? index.books.find((b) => fold(b.name).includes(want));
}
