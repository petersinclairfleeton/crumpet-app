// One note as a file: YAML front matter for the note's details, then its
// body as Markdown.
//
//   ---
//   id: 0b6f…
//   title: Opening scene
//   tags: [draft, chapter-1]
//   favorite: true
//   reminder: 2026-10-10T09:00:00.000Z
//   created: 2026-10-05T09:12:00.000Z
//   updated: 2026-10-05T10:40:12.000Z
//   ---
//
//   The body…
//
// Only a small, predictable part of YAML is written. Reading is forgiving, so
// files edited by hand or by other apps still open, and front matter keys
// Crumpet doesn't use are kept exactly as they were.

export interface NoteFile {
  id: string | null;
  title: string | null;
  tags: string[];
  favorite: boolean;
  created: number | null;
  updated: number | null;
  /** When it was moved to the Trash (files in `.trash/` only). */
  trashed: number | null;
  /** Folder a trashed note came from, so restoring puts it back. */
  from: string | null;
  /** Front matter lines Crumpet doesn't use, kept as written. */
  extra: string;
  body: string;
  /** A reminder ("ISO date", with " done" once dealt with), as the sync keeps it. */
  reminder?: string;
  /** Chapters only: status, synopsis and word goal. */
  status?: string;
  synopsis?: string;
  goal?: number | null;
}

const KNOWN = new Set(['id', 'title', 'tags', 'favorite', 'reminder', 'reminder-done', 'created', 'updated', 'trashed', 'from', 'status', 'synopsis', 'goal']);

export function writeNoteFile(f: NoteFile): string {
  const lines = ['---'];
  if (f.id) lines.push(`id: ${scalar(f.id)}`);
  if (f.title !== null) lines.push(`title: ${scalar(f.title)}`);
  if (f.tags.length) lines.push(`tags: [${f.tags.map((t) => (/^[\p{L}\p{N}_./-]+$/u.test(t) ? scalar(t) : JSON.stringify(t))).join(', ')}]`);
  if (f.favorite) lines.push('favorite: true');
  if (f.reminder) {
    const [at, done] = f.reminder.split(' ');
    lines.push(`reminder: ${at}`);
    if (done) lines.push('reminder-done: true');
  }
  if (f.created !== null) lines.push(`created: ${date(f.created)}`);
  if (f.updated !== null) lines.push(`updated: ${date(f.updated)}`);
  if (f.trashed !== null) lines.push(`trashed: ${date(f.trashed)}`);
  if (f.from !== null) lines.push(`from: ${scalar(f.from)}`);
  if (f.status !== undefined) lines.push(`status: ${scalar(f.status)}`);
  if (f.synopsis !== undefined) lines.push(`synopsis: ${f.synopsis ? scalar(f.synopsis) : '""'}`);
  if (f.goal !== undefined && f.goal !== null) lines.push(`goal: ${f.goal}`);
  if (f.extra) lines.push(f.extra.replace(/\n+$/, ''));
  lines.push('---');
  return f.body ? `${lines.join('\n')}\n\n${f.body}` : `${lines.join('\n')}\n`;
}

function date(t: number): string {
  return new Date(t).toISOString();
}

/** A YAML scalar: plain when that reads back the same, otherwise double-quoted (JSON strings are valid YAML). */
function scalar(s: string): string {
  const plain =
    s !== '' &&
    !/^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(s) &&
    !/\s$/.test(s) &&
    !/: |:$| #|[\u0000-\u001f\u007f]/.test(s) &&
    !/^(true|false|yes|no|on|off|null|~|[-+]?(\d[\d_]*(\.\d*)?|\.\d+)([eE][-+]?\d+)?|\.inf|\.nan)$/i.test(s);
  return plain ? s : JSON.stringify(s);
}

export function parseNoteFile(text: string): NoteFile {
  const f: NoteFile = { id: null, title: null, tags: [], favorite: false, created: null, updated: null, trashed: null, from: null, extra: '', body: '' };
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = /^---[ \t]*\n([\s\S]*?\n)?(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(src);
  if (!m) {
    f.body = src;
    return f;
  }
  f.body = src.slice(m[0].length).replace(/^[ \t]*\n/, '');
  const lines = (m[1] ?? '').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const extra: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = /^([A-Za-z_][\w-]*)[ \t]*:(?:[ \t]+(.*?))?[ \t]*$/.exec(line);
    // Indented lines and list items belong to the key above.
    let j = i + 1;
    while (j < lines.length && /^([ \t]+|-[ \t]|-$)/.test(lines[j])) j++;
    const block = lines.slice(i + 1, j);
    if (!kv || !KNOWN.has(kv[1].toLowerCase())) {
      extra.push(line, ...block);
      i = j - 1;
      continue;
    }
    i = j - 1;
    const key = kv[1].toLowerCase();
    const raw = kv[2] ?? '';
    switch (key) {
      case 'id':
        f.id = parseScalar(raw) || null;
        break;
      case 'title':
        f.title = parseScalar(raw);
        break;
      case 'from':
        f.from = parseScalar(raw) || null;
        break;
      case 'status':
        f.status = parseScalar(raw);
        break;
      case 'synopsis':
        f.synopsis = parseScalar(raw);
        break;
      case 'goal': {
        const n = parseInt(parseScalar(raw), 10);
        f.goal = Number.isFinite(n) && n > 0 ? n : null;
        break;
      }
      case 'favorite':
        f.favorite = /^(true|yes|on)$/i.test(parseScalar(raw));
        break;
      case 'reminder': {
        const at = parseDate(parseScalar(raw));
        if (at !== null) f.reminder = new Date(at).toISOString() + (f.reminder?.endsWith(' done') ? ' done' : '');
        break;
      }
      case 'reminder-done':
        if (/^(true|yes|on)$/i.test(parseScalar(raw))) f.reminder = f.reminder ? `${f.reminder.split(' ')[0]} done` : ' done';
        break;
      case 'created':
      case 'updated':
      case 'trashed':
        f[key] = parseDate(parseScalar(raw));
        break;
      case 'tags': {
        const items = raw ? parseList(raw) : block.map((l) => /^[ \t]*-[ \t]*(.*)$/.exec(l)?.[1]).filter((x): x is string => x !== undefined).map(parseScalar);
        f.tags = [...new Set(items.map((t) => t.replace(/^#/, '').trim()).filter(Boolean))];
        break;
      }
    }
  }
  f.extra = extra.join('\n');
  // "Done" with no date isn't a reminder.
  if (f.reminder?.startsWith(' ')) delete f.reminder;
  return f;
}

function parseScalar(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('"')) {
    try {
      return JSON.parse(s.replace(/[ \t]+#.*$/, '').replace(/\\x([0-9a-fA-F]{2})/g, '\\u00$1')) as string;
    } catch {
      return s.slice(1, s.lastIndexOf('"') > 0 ? s.lastIndexOf('"') : undefined);
    }
  }
  if (s.startsWith("'")) {
    let out = '';
    for (let i = 1; i < s.length; i++) {
      if (s[i] !== "'") out += s[i];
      else if (s[i + 1] === "'") out += s[i++];
      else break;
    }
    return out;
  }
  return s.replace(/[ \t]+#.*$/, '');
}

function parseList(raw: string): string[] {
  const s = raw.trim();
  if (!s.startsWith('[')) return s.split(/[,\s]+/).map(parseScalar).filter(Boolean);
  const inner = s.slice(1, s.lastIndexOf(']') > 0 ? s.lastIndexOf(']') : undefined);
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quote) {
      cur += c;
      if (c === '\\' && quote === '"') cur += inner[++i] ?? '';
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
      cur += c;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map(parseScalar).filter(Boolean);
}

function parseDate(s: string): number | null {
  if (!s) return null;
  const n = /^\d+$/.test(s) ? Number(s) : Date.parse(s);
  return Number.isFinite(n) ? n : null;
}
