// The tools Crumpet's MCP server offers an AI: finding and reading notes and
// books, and writing new notes. It never changes or deletes what's there.

import { type Entry, type Folder, createNote, findBook, readIndex, search, wordCount } from './vault';

export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
}

export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

const reading = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'integer', description, minimum: 1 });

export const TOOLS: Tool[] = [
  {
    name: 'search',
    title: 'Search notes and books',
    description: 'Finds notes, book chapters and research notes containing every word of the query (in the title, tags or text). Returns each one’s path, title, where it is and a line of text around the match. Use read with a path for the whole text.',
    inputSchema: { type: 'object', properties: { query: str('Words to look for.'), limit: num('How many to return (default 20).') }, required: ['query'] },
    annotations: reading,
  },
  {
    name: 'list_notes',
    title: 'List notes',
    description: 'Lists notes, most recently edited first, with their notebook, tags and when they were edited. Optionally only one notebook ("Inbox" for notes in no notebook), or only notes with a tag.',
    inputSchema: { type: 'object', properties: { notebook: str('A notebook’s name.'), tag: str('A tag.'), limit: num('How many to return (default 50).') } },
    annotations: reading,
  },
  {
    name: 'list_notebooks',
    title: 'List notebooks',
    description: 'Lists the notebooks (and the stacks they are in), with how many notes each has, and every tag used.',
    inputSchema: { type: 'object', properties: {} },
    annotations: reading,
  },
  {
    name: 'list_books',
    title: 'List books',
    description: 'Lists the books (projects of chapters), with their word counts, goals and number of chapters.',
    inputSchema: { type: 'object', properties: {} },
    annotations: reading,
  },
  {
    name: 'read_book',
    title: 'Read a book’s outline',
    description: 'A book’s outline: its chapters in order (with parts, status, synopsis, words and the path to read each), its characters and places, and its research notes.',
    inputSchema: { type: 'object', properties: { book: str('The book’s name.') }, required: ['book'] },
    annotations: reading,
  },
  {
    name: 'read',
    title: 'Read a note or chapter',
    description: 'The whole text of a note, chapter or research note, as Markdown, with its title, tags and where it is. Give the path from search, list_notes or read_book (or a title).',
    inputSchema: { type: 'object', properties: { path: str('Its path, e.g. "Travel/Rome.md".'), title: str('Or its title.') } },
    annotations: reading,
  },
  {
    name: 'create_note',
    title: 'Write a new note',
    description: 'Writes a new note in Crumpet, in the Inbox, an existing notebook, or a book’s research notes. The text is Markdown (headings, lists, **bold**, links, [[Note links]]). It never changes or replaces an existing note. Crumpet shows it after its next sync with the folder.',
    inputSchema: {
      type: 'object',
      properties: {
        title: str('The note’s title.'),
        text: str('The note’s text, in Markdown (without the title).'),
        notebook: str('An existing notebook’s name; leave out for the Inbox.'),
        book: str('A book’s name, to keep the note with its research instead.'),
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for it.' },
      },
      required: ['title', 'text'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

/** Notes too long for one reply are cut here (the AI is told). */
const MAX_TEXT = 200_000;

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

function where(e: Entry): string {
  if (e.kind === 'chapter') return `chapter ${e.number} of ${e.book}${e.part ? ` (${e.part})` : ''}`;
  if (e.kind === 'research') return `research for ${e.book}`;
  return e.notebook ? `notebook ${e.stack ? `${e.stack} / ` : ''}${e.notebook}` : 'Inbox';
}

const line = (e: Entry) => `- ${e.title || 'Untitled'} — ${where(e)}${e.tags.length ? ` · tags: ${e.tags.join(', ')}` : ''} · edited ${day(e.updated)} · path: ${e.path}`;

const text = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }] });
const fail = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }], isError: true });

const arg = (args: Record<string, unknown>, k: string) => (typeof args[k] === 'string' ? (args[k] as string) : '');
const limit = (args: Record<string, unknown>, d: number) => (typeof args.limit === 'number' && args.limit >= 1 ? Math.min(500, Math.floor(args.limit)) : d);

export async function callTool(folder: Folder, name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const index = await readIndex(folder);
  try {
    switch (name) {
      case 'search': {
        const q = arg(args, 'query');
        if (!q.trim()) return fail('Give some words to search for.');
        const found = search(index, q);
        if (!found.length) return text(`Nothing has all of: ${q}`);
        const shown = found.slice(0, limit(args, 20));
        return text(`${found.length} found${found.length > shown.length ? `, the best ${shown.length} here` : ''}:\n${shown.map((f) => `${line(f.entry)}${f.snippet ? `\n  ${f.snippet}` : ''}`).join('\n')}`);
      }
      case 'list_notes': {
        let list = index.entries.filter((e) => e.kind === 'note');
        const nb = arg(args, 'notebook').trim().toLowerCase();
        if (nb) list = list.filter((e) => (nb === 'inbox' ? !e.notebook : e.notebook.toLowerCase() === nb || `${e.stack}/${e.notebook}`.toLowerCase() === nb));
        const tag = arg(args, 'tag').trim().replace(/^#/, '').toLowerCase();
        if (tag) list = list.filter((e) => e.tags.some((t) => t.toLowerCase() === tag || t.toLowerCase().startsWith(`${tag}/`)));
        list.sort((a, b) => b.updated - a.updated);
        const shown = list.slice(0, limit(args, 50));
        if (!shown.length) return text('No notes there.');
        return text(`${list.length} note${list.length === 1 ? '' : 's'}${list.length > shown.length ? `, the latest ${shown.length} here` : ''}:\n${shown.map(line).join('\n')}`);
      }
      case 'list_notebooks': {
        const inbox = index.entries.filter((e) => e.kind === 'note' && !e.notebook).length;
        const tags = [...new Set(index.entries.flatMap((e) => e.tags))].sort();
        return text(
          [`Inbox (notes in no notebook): ${inbox}`, ...index.notebooks.map((n) => `${n.stack ? `${n.stack} / ` : ''}${n.name}: ${n.count} note${n.count === 1 ? '' : 's'}`), '', `Tags: ${tags.join(', ') || 'none'}`].join('\n'),
        );
      }
      case 'list_books': {
        if (!index.books.length) return text('No books yet.');
        return text(
          index.books
            .map((b) => {
              const chapters = index.entries.filter((e) => e.kind === 'chapter' && e.book === b.name);
              const words = chapters.reduce((n, c) => n + wordCount(c.body), 0);
              return `- ${b.name}: ${chapters.length} chapter${chapters.length === 1 ? '' : 's'}, ${words} words${b.goal ? ` (goal ${b.goal.toLocaleString('en-GB')})` : ''}${b.deadline ? `, due ${b.deadline.slice(0, 10)}` : ''}`;
            })
            .join('\n'),
        );
      }
      case 'read_book': {
        const book = findBook(index, arg(args, 'book'));
        if (!book) return fail(`There's no book called “${arg(args, 'book')}”. Books: ${index.books.map((b) => b.name).join(', ') || 'none yet'}.`);
        const chapters = index.entries.filter((e) => e.kind === 'chapter' && e.book === book.name).sort((a, b) => a.number - b.number);
        const research = index.entries.filter((e) => e.kind === 'research' && e.book === book.name);
        const out = [`# ${book.name}`, '', '## Chapters'];
        let part = '';
        for (const c of chapters) {
          if (c.part && c.part !== part) out.push(`### ${(part = c.part)}`);
          out.push(`${c.number}. ${c.title || 'Untitled'} — ${wordCount(c.body)} words${c.status ? `, ${c.status === 'todo' ? 'to do' : c.status}` : ''} · path: ${c.path}${c.synopsis ? `\n   Synopsis: ${c.synopsis}` : ''}`);
        }
        if (!chapters.length) out.push('(none yet)');
        if (book.cast.length) {
          out.push('', '## Characters and places');
          for (const c of book.cast) out.push(`- ${c.name} (${c.kind}${c.aliases.length ? `; also ${c.aliases.join(', ')}` : ''})${c.description ? `: ${c.description}` : ''}${c.notes ? `\n  ${c.notes.replace(/\n+/g, ' ')}` : ''}`);
        }
        if (research.length) out.push('', '## Research', ...research.map(line));
        return text(out.join('\n'));
      }
      case 'read': {
        const path = arg(args, 'path').trim().replace(/^\/+/, '');
        const title = arg(args, 'title').trim().toLowerCase();
        const e = path ? index.entries.find((x) => x.path === path) ?? index.entries.find((x) => x.path.toLowerCase() === path.toLowerCase()) : index.entries.filter((x) => x.title.toLowerCase() === title).sort((a, b) => b.updated - a.updated)[0];
        if (!e) return fail(path ? `There's no note at “${path}”. Use search or list_notes to find its path.` : title ? `There's no note called “${arg(args, 'title')}”.` : 'Give a path or a title.');
        const head = [`# ${e.title || 'Untitled'}`, `${where(e)}${e.tags.length ? ` · tags: ${e.tags.join(', ')}` : ''} · edited ${day(e.updated)}${e.locked ? '' : ` · ${wordCount(e.body)} words`}`];
        if (e.kind === 'chapter' && e.synopsis) head.push(`Synopsis: ${e.synopsis}`);
        if (e.locked) return text(`${head.join('\n')}\n\nThis note is locked with a password; it can only be read in Crumpet.`);
        const body = e.body.length > MAX_TEXT ? `${e.body.slice(0, MAX_TEXT)}\n\n[The rest is cut: the note is ${e.body.length} characters long.]` : e.body;
        return text(`${head.join('\n')}\n\n${body}`);
      }
      case 'create_note': {
        const title = arg(args, 'title').trim();
        if (!title) return fail('Give the note a title.');
        const tags = Array.isArray(args.tags) ? args.tags.filter((t): t is string => typeof t === 'string') : [];
        const path = await createNote(folder, index, { title, text: arg(args, 'text'), notebook: arg(args, 'notebook') || undefined, book: arg(args, 'book') || undefined, tags });
        return text(`Written as ${path}. It shows in Crumpet after its next sync with the folder.`);
      }
      default:
        return fail(`There's no tool called ${name}.`);
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}
