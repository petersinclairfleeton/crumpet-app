// Sharing a note, a chapter or a whole book with readers (beta readers, an
// editor, a writing group): Crumpet puts a copy in your Google Drive as a
// Google Doc that anyone with its link can read and comment on, and brings
// their comments back onto your text as Crumpet comments. Your own files are
// never shared; each share is a copy as the text stood then.

import { type Comment, type Doc, commentId, comments as docComments, normalizeRuns, runsText, setCommentOnRuns, sliceRuns } from '@crumpet/editor/model';
import { findOrCreateFolder } from '../sync/drive';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_DOC = 'application/vnd.google-apps.document';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** The folder at the top of My Drive that shared copies go in. */
export const SHARED_FOLDER = 'Crumpet – shared copies';

/** A shared copy: what it's a copy of, the Google Doc and its link, and when. */
export interface Shared {
  /** The note, chapter or book shared. */
  of: string;
  docId: string;
  url: string;
  at: number;
  title: string;
  /** Who can do what with the link. */
  access: 'comment' | 'view';
  /** Comments already brought back (Google's ids). */
  brought?: string[];
}

export type GetToken = (fresh?: boolean) => Promise<string>;

async function call(url: string, init: RequestInit, getToken: GetToken, fetchFn: typeof fetch): Promise<Response> {
  for (let fresh = false; ; fresh = true) {
    let res: Response;
    try {
      res = await fetchFn(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await getToken(fresh)}` } });
    } catch {
      throw new Error('Couldn’t reach Google Drive. Are you online?');
    }
    if (res.ok) return res;
    if (res.status === 401 && !fresh) continue;
    throw new Error(res.status === 401 ? 'Google needs you to sign in again.' : `Google Drive said no (${res.status}).`);
  }
}

/**
 * Puts a Word file in Drive as a Google Doc (in the shared copies folder) that anyone with the link can
 * comment on (or only read), and returns it.
 */
export async function shareCopy(opts: { of: string; title: string; docx: Blob; access: 'comment' | 'view'; getToken: GetToken; fetch?: typeof fetch }): Promise<Shared> {
  const fetchFn = opts.fetch ?? fetch.bind(globalThis);
  const folder = await findOrCreateFolder(SHARED_FOLDER, opts.getToken, fetchFn);
  const boundary = `crumpet${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name: opts.title, mimeType: GOOGLE_DOC, parents: [folder] });
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${DOCX}\r\n\r\n`, opts.docx, `\r\n--${boundary}--`]);
  const made = (await (await call(`${UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }, opts.getToken, fetchFn)).json()) as { id: string; webViewLink?: string };
  await call(`${API}/files/${made.id}/permissions?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: opts.access === 'comment' ? 'commenter' : 'reader', type: 'anyone', allowFileDiscovery: false }) }, opts.getToken, fetchFn);
  return { of: opts.of, docId: made.id, url: made.webViewLink ?? `https://docs.google.com/document/d/${made.id}/edit`, at: Date.now(), title: opts.title, access: opts.access };
}

/** A reader's comment on a shared copy: the words it's on, what they said, who, when, and the replies. */
export interface ReaderComment {
  id: string;
  quote: string;
  text: string;
  author: string;
  at: number;
  resolved: boolean;
  replies: { text: string; author: string; at: number }[];
}

/** The comments readers have left on a shared copy. */
export async function readerComments(docId: string, getToken: GetToken, fetchFn: typeof fetch = fetch.bind(globalThis)): Promise<ReaderComment[]> {
  const out: ReaderComment[] = [];
  let page = '';
  do {
    const url = `${API}/files/${docId}/comments?pageSize=100&includeDeleted=false&fields=nextPageToken,comments(id,content,quotedFileContent,author(displayName),createdTime,resolved,replies(content,author(displayName),createdTime,deleted))${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`;
    const res = (await (await call(url, {}, getToken, fetchFn)).json()) as {
      nextPageToken?: string;
      comments?: { id: string; content?: string; quotedFileContent?: { value?: string }; author?: { displayName?: string }; createdTime?: string; resolved?: boolean; replies?: { content?: string; author?: { displayName?: string }; createdTime?: string; deleted?: boolean }[] }[];
    };
    for (const c of res.comments ?? []) {
      out.push({
        id: c.id,
        quote: (c.quotedFileContent?.value ?? '').trim(),
        text: (c.content ?? '').trim(),
        author: c.author?.displayName ?? 'A reader',
        at: c.createdTime ? Date.parse(c.createdTime) : Date.now(),
        resolved: !!c.resolved,
        replies: (c.replies ?? []).filter((r) => !r.deleted && r.content?.trim()).map((r) => ({ text: r.content!.trim(), author: r.author?.displayName ?? 'A reader', at: r.createdTime ? Date.parse(r.createdTime) : Date.now() })),
      });
    }
    page = res.nextPageToken ?? '';
  } while (page);
  return out;
}

/** No comment on any of a block's text from `from` to `to` (a stretch of text holds one comment). */
function uncommented(doc: Doc, block: string, from: number, to: number): boolean {
  const b = doc.blocks.find((x) => x.id === block);
  return !!b && !sliceRuns(b.runs, from, to).some((r) => r.comment);
}

/**
 * Where a quote is in a document: the first place with its words (spaces matched loosely) that has no comment
 * on it yet, and its offsets. A quote across paragraphs is found by its first line.
 */
export function findQuote(doc: Doc, quote: string): { block: string; from: number; to: number } | null {
  const lines = quote.split(/\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const q = lines.join(' ');
  if (!q) return null;
  for (const b of doc.blocks) {
    const text = runsText(b.runs).replace(/\s/g, ' ');
    for (let at = text.indexOf(q); at >= 0; at = text.indexOf(q, at + 1)) if (uncommented(doc, b.id, at, at + q.length)) return { block: b.id, from: at, to: at + q.length };
  }
  return lines.length > 1 ? findQuote(doc, lines[0]) : null;
}

/** The first word in the document with no comment on it, for a comment whose words have gone. */
function freeWord(doc: Doc): { block: string; from: number; to: number } | null {
  for (const b of doc.blocks) {
    const text = runsText(b.runs);
    for (const m of text.matchAll(/\S+/g)) if (uncommented(doc, b.id, m.index, m.index + m[0].length)) return { block: b.id, from: m.index, to: m.index + m[0].length };
  }
  return null;
}

/**
 * Readers' comments put on the text they're about, as Crumpet comments (with their replies); those whose
 * words can't be found any more go on the first word free of comments, quoting them. Comments already brought
 * back (by Google id) are left out. Returns the document and the ids brought back.
 */
export function bringBack(doc: Doc, found: ReaderComment[], already: string[] = []): { doc: Doc; brought: string[]; placed: number; unplaced: number } {
  let blocks = doc.blocks;
  const brought: string[] = [];
  let placed = 0;
  let unplaced = 0;
  const have = new Set(docComments(doc).map((c) => c.comment.id));
  // To the minute, as files keep comments' times (so the same comment always gets the same id).
  const minute = (t: number) => Math.floor(t / 60_000) * 60_000;
  for (const c of found) {
    if (already.includes(c.id) || c.resolved || !c.text) continue;
    const comment: Comment = {
      id: commentId(c.author, minute(c.at), c.text),
      author: c.author,
      at: minute(c.at),
      text: c.text,
      ...(c.replies.length ? { replies: c.replies.map((r) => ({ author: r.author, at: minute(r.at), text: r.text })) } : {}),
    };
    if (have.has(comment.id)) {
      brought.push(c.id);
      continue;
    }
    const where = findQuote({ blocks }, c.quote);
    const target = where ?? freeWord({ blocks });
    // Nowhere free to put it (every word has a comment): left for another time.
    if (!target) continue;
    brought.push(c.id);
    if (!where) {
      comment.text = c.quote ? `On “${c.quote.replace(/\s+/g, ' ').trim()}”: ${c.text}` : c.text;
      unplaced++;
    } else placed++;
    blocks = blocks.map((b) => {
      if (b.id !== target.block) return b;
      const len = runsText(b.runs).length;
      return { ...b, runs: normalizeRuns([...sliceRuns(b.runs, 0, target.from), ...setCommentOnRuns(sliceRuns(b.runs, target.from, target.to), comment), ...sliceRuns(b.runs, target.to, len)]) };
    });
  }
  return { doc: { ...doc, blocks }, brought, placed, unplaced };
}

/**
 * Readers' comments on a shared book, put back on the chapters they're about: each in the first chapter whose text
 * has its words (any not found go to the first chapter, quoting them). Returns the chapters changed.
 */
export function bringBackBook(chapters: { id: string; doc: Doc }[], found: ReaderComment[], already: string[] = []): { docs: Map<string, Doc>; brought: string[]; placed: number; unplaced: number } {
  const docs = new Map<string, Doc>();
  const fresh = found.filter((c) => !already.includes(c.id) && !c.resolved && c.text);
  const home = (c: ReaderComment) => chapters.find((ch) => findQuote(docs.get(ch.id) ?? ch.doc, c.quote))?.id ?? chapters[0]?.id;
  let placed = 0;
  let unplaced = 0;
  const brought: string[] = [];
  for (const c of fresh) {
    const id = home(c);
    const ch = chapters.find((x) => x.id === id);
    if (!ch) continue;
    const r = bringBack(docs.get(ch.id) ?? ch.doc, [c]);
    docs.set(ch.id, r.doc);
    placed += r.placed;
    unplaced += r.unplaced;
    brought.push(...r.brought);
  }
  return { docs, brought, placed, unplaced };
}
