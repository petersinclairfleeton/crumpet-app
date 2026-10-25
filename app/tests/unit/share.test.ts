import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { comments } from '@crumpet/editor/model';
import { type ReaderComment, bringBack, bringBackBook, findQuote, readerComments, shareCopy } from '../../src/data/share';

const reader = (id: string, quote: string, text: string, extra: Partial<ReaderComment> = {}): ReaderComment => ({ id, quote, text, author: 'Ann Reader', at: Date.UTC(2026, 9, 20, 10, 30, 12), resolved: false, replies: [], ...extra });

describe('sharing with readers', () => {
  it('finds a comment’s words in the text', () => {
    const doc = fromMarkdown('The lamp had not been lit.\n\nThe keeper  waited by the stove.');
    expect(findQuote(doc, 'not been lit')).toEqual({ block: doc.blocks[0].id, from: 13, to: 25 });
    expect(findQuote(doc, 'keeper waited')).toBeNull();
    expect(findQuote(doc, 'waited by')).toMatchObject({ block: doc.blocks[1].id });
    expect(findQuote(doc, '')).toBeNull();
  });

  it('brings readers’ comments back onto the words they’re about, once', () => {
    const doc = fromMarkdown('The lamp had not been lit.\n\nThe keeper waited by the stove.');
    const found = [
      reader('a', 'not been lit', 'Why not? Say more.', { replies: [{ text: 'Agreed', author: 'Bo', at: Date.UTC(2026, 9, 20, 11) }] }),
      reader('b', 'a sentence since cut', 'Lovely line.'),
      reader('c', 'the stove', 'Done', { resolved: true }),
    ];
    const r = bringBack(doc, found);
    expect(r).toMatchObject({ placed: 1, unplaced: 1, brought: ['a', 'b'] });
    const list = comments(r.doc);
    expect(list.map((c) => [c.quote, c.comment.text])).toEqual([
      ['The', 'On “a sentence since cut”: Lovely line.'],
      ['not been lit', 'Why not? Say more.'],
    ]);
    expect(list[1].comment).toMatchObject({ author: 'Ann Reader', at: Date.UTC(2026, 9, 20, 10, 30), replies: [{ author: 'Bo', text: 'Agreed' }] });
    // Saved as Markdown and read again, the same.
    expect(toMarkdown(fromMarkdown(toMarkdown(r.doc)))).toBe(toMarkdown(r.doc));
    // Two readers on the same words: the second goes on a word of its own, quoting them, so neither is lost.
    const both = bringBack(doc, [reader('a', 'not been lit', 'One'), reader('d', 'been lit', 'Two', { author: 'Cy' })]);
    expect(comments(both.doc).map((c) => [c.quote, c.comment.text])).toEqual([
      ['The', 'On “been lit”: Two'],
      ['not been lit', 'One'],
    ]);
    // A quote across two paragraphs is found by its first line.
    expect(findQuote(doc, 'not been lit.\nThe keeper')).toMatchObject({ block: doc.blocks[0].id, from: 13 });
    // A second time: nothing new.
    expect(bringBack(r.doc, found, r.brought)).toMatchObject({ placed: 0, unplaced: 0, brought: [] });
  });

  it('a book’s comments go to the chapter with their words', () => {
    const one = { id: 'one', doc: fromMarkdown('The lamp had not been lit.') };
    const two = { id: 'two', doc: fromMarkdown('The storm came in from the west.') };
    const r = bringBackBook([one, two], [reader('a', 'from the west', 'Which coast?'), reader('b', 'gone now', 'Hmm')]);
    expect([...r.docs.keys()].sort()).toEqual(['one', 'two']);
    expect(comments(r.docs.get('two')!)[0]).toMatchObject({ quote: 'from the west' });
    expect(comments(r.docs.get('one')!)[0].comment.text).toBe('On “gone now”: Hmm');
  });

  it('puts a Google Doc copy in Drive, open to comments by link, and reads its comments', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
      if (url.includes('/files?q=')) return json({ files: [] });
      if (url.includes('/permissions')) return json({ id: 'perm' });
      if (url.includes('/comments')) return json({ comments: [{ id: 'k', content: 'Nice', quotedFileContent: { value: 'lamp' }, author: { displayName: 'Ann' }, createdTime: '2026-10-20T10:00:00Z', replies: [] }] });
      if (url.includes('uploadType=multipart')) return json({ id: 'doc1', webViewLink: 'https://docs.google.com/document/d/doc1/edit' });
      return json({ id: 'folder1' });
    }) as unknown as typeof fetch;
    const shared = await shareCopy({ of: 'n1', title: 'The Lighthouse', docx: new Blob(['PK']), access: 'comment', getToken: async () => 't', fetch: fake });
    expect(shared).toMatchObject({ of: 'n1', docId: 'doc1', url: 'https://docs.google.com/document/d/doc1/edit', access: 'comment' });
    const upload = calls.find((c) => c.url.includes('uploadType=multipart'))!;
    const body = await (upload.init.body as Blob).text();
    expect(body).toContain('"mimeType":"application/vnd.google-apps.document"');
    expect(body).toContain('"parents":["folder1"]');
    const perm = calls.find((c) => c.url.includes('/permissions'))!;
    expect(JSON.parse(String(perm.init.body))).toEqual({ role: 'commenter', type: 'anyone', allowFileDiscovery: false });
    const found = await readerComments('doc1', async () => 't', fake);
    expect(found).toEqual([{ id: 'k', quote: 'lamp', text: 'Nice', author: 'Ann', at: Date.UTC(2026, 9, 20, 10), resolved: false, replies: [] }]);
  });
});
