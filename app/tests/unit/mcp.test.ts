import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import { SyncEngine, type SyncState } from '../../src/sync/engine';
import { MemoryProvider } from '../../src/sync/provider';
import { handle, serve } from '../../src/mcp/server';
import { callTool } from '../../src/mcp/tools';
import type { Folder } from '../../src/mcp/vault';

let clock = 1_700_000_000_000;
const now = () => (clock += 1000);

/** Crumpet on one device, syncing with `cloud`. */
async function device(cloud: MemoryProvider) {
  const store = new AppStore(new MemoryStorage(), now);
  await store.load();
  let saved: SyncState | null = null;
  const engine = new SyncEngine(store, cloud, { load: async () => saved, save: async (s) => void (saved = structuredClone(s)) }, { now });
  return { store, engine };
}

/** The synced files, as the MCP server sees a folder. */
function folderOf(cloud: MemoryProvider): Folder {
  return {
    list: async () => [...cloud.files].map(([path, f]) => ({ path, mtime: f.modified })),
    read: async (path) => (await cloud.read(path)).text,
    create: async (path, text) => {
      if (cloud.files.has(path)) throw new Error('exists');
      await cloud.write(path, text);
    },
  };
}

async function library() {
  const cloud = new MemoryProvider(now);
  const mac = await device(cloud);
  const s = mac.store;
  const nb = s.createNotebook('Travel', s.createStack('Life').id);
  s.createNote({ title: 'Rome in spring', notebookId: nb.id, doc: fromMarkdown('The Colosseum at dawn, gelato by the Pantheon.\n'), tags: ['italy'] });
  s.createNote({ title: 'Loose thought', doc: fromMarkdown('Bridges and rivers.\n') });
  const gone = s.createNote({ title: 'Old Rome list', doc: fromMarkdown('rome\n') });
  s.trashNote(gone.id);
  const book = s.createProject('The Storm');
  const first = s.getState().chapters.find((c) => c.projectId === book.id)!;
  s.setChapterTitle(first.id, 'The rain');
  s.setChapterDoc(first.id, fromMarkdown('The rain came down over the hills and the bridge.\n'));
  const tam = s.addCastMember(book.id, 'character', 'Tam')!;
  s.updateCastMember(book.id, tam.id, { description: 'Keeps the bridge.' });
  await mac.engine.sync();
  return { cloud, mac, folder: folderOf(cloud) };
}

const say = async (folder: Folder, name: string, args: Record<string, unknown> = {}) => {
  const r = await callTool(folder, name, args);
  return { text: r.content[0].text, error: !!r.isError };
};

describe('Crumpet’s MCP server', () => {
  it('finds and reads notes, notebooks and books, leaving out the Trash', async () => {
    const { folder } = await library();
    const found = await say(folder, 'search', { query: 'rome' });
    expect(found.text).toContain('Rome in spring — notebook Life / Travel · tags: italy');
    expect(found.text).not.toContain('Old Rome list');
    expect((await say(folder, 'search', { query: 'bridge' })).text).toMatch(/2 found[\s\S]*chapter 1 of The Storm/);
    expect((await say(folder, 'list_notebooks')).text).toMatch(/Inbox \(notes in no notebook\): 1\nLife \/ Travel: 1 note\n\nTags: italy/);
    const read = await say(folder, 'read', { path: 'Life/Travel/Rome in spring.md' });
    expect(read.text).toMatch(/^# Rome in spring\nnotebook Life \/ Travel · tags: italy · edited \S+ · 8 words\n\nThe Colosseum at dawn/);
    expect((await say(folder, 'read', { title: 'loose thought' })).text).toContain('Bridges and rivers.');
    expect(await say(folder, 'read', { path: '../secret.md' })).toMatchObject({ error: true });
    const book = (await say(folder, 'read_book', { book: 'storm' })).text;
    expect(book).toContain('1. The rain — 10 words, to do · path: Projects/The Storm/01 The rain.md');
    expect(book).toContain('- Tam (character): Keeps the bridge.');
    expect((await say(folder, 'list_books')).text).toBe('- The Storm: 1 chapter, 10 words');
  });

  it('writes new notes that Crumpet picks up at its next sync, never over another', async () => {
    const { mac, folder } = await library();
    const made = await say(folder, 'create_note', { title: 'Rome in spring', text: '## Plan\n\n- Day one: **Forum**', notebook: 'travel', tags: ['#trip'] });
    expect(made.text).toContain('Written as Life/Travel/Rome in spring 2.md');
    expect((await say(folder, 'create_note', { title: 'Map', text: 'Rivers.', book: 'The Storm' })).text).toContain('Projects/The Storm/Research/Map.md');
    expect((await say(folder, 'create_note', { title: 'Lost', text: 'x', notebook: 'Nowhere' })).text).toMatch(/no notebook called “Nowhere”. Notebooks: Life\/Travel/);
    await mac.engine.sync();
    const notes = mac.store.getState().notes.filter((n) => n.title === 'Rome in spring');
    expect(notes).toHaveLength(2);
    const added = notes.find((n) => n.tags.includes('trip'))!;
    expect(mac.store.getState().notebooks.find((nb) => nb.id === added.notebookId)?.name).toBe('Travel');
    expect(toMarkdown(added.doc)).toBe('## Plan\n\n- Day one: **Forum**\n');
    expect(toMarkdown(notes.find((n) => n !== added)!.doc)).toContain('Colosseum');
    const research = mac.store.getState().notes.find((n) => n.title === 'Map')!;
    expect(research.projectId).toBe(mac.store.getState().projects[0].id);
  });

  it('speaks MCP: initialize, tools, notifications and errors', async () => {
    const { folder } = await library();
    const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, folder);
    expect(init?.result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'crumpet' } });
    expect(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, folder)).toBeNull();
    expect(await handle({ jsonrpc: '2.0', id: 2, method: 'nope' }, folder)).toMatchObject({ error: { code: -32601 } });
    const lines: string[] = [];
    async function* input() {
      yield '{"jsonrpc":"2.0","id":3,"method":"tools/list"}\n{"jsonrpc":"2.0","id":4,"method":"tools/ca';
      yield 'll","params":{"name":"list_books","arguments":{}}}\nnot json\n';
    }
    await serve(input(), (l) => lines.push(l), folder);
    const replies = lines.map((l) => JSON.parse(l));
    expect(replies[0].result.tools.map((t: { name: string }) => t.name)).toEqual(['search', 'list_notes', 'list_notebooks', 'list_books', 'read_book', 'read', 'create_note']);
    expect(replies[1].result.content[0].text).toContain('The Storm');
    expect(replies[2].error.code).toBe(-32700);
  });
});
