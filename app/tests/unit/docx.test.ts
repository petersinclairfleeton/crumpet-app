// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FOOTNOTE, type Doc, makeBlock, makeComment } from '@crumpet/editor/model';
import { fromDocx, imageSize, toDocx } from '../../src/data/docx';
import { readZip, writeZip } from '../../src/data/zip';
import { manuscriptHeaders } from '../../src/data/headers';
import { defaultPage } from '../../src/data/styles';

// A 2×1 PNG.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwQZGBgAJ+wE/OXBtvUAAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

function sample(): Doc {
  const p = makeBlock('paragraph', 'Plain ');
  p.runs = [
    { text: 'Plain ', marks: [] },
    { text: 'bold', marks: ['bold'] },
    { text: ' and ', marks: [] },
    { text: 'a link', marks: ['italic'], link: 'https://example.com/' },
    { text: FOOTNOTE, marks: [], footnote: 'A note & more.' },
    { text: '.', marks: [] },
  ];
  return {
    blocks: [
      makeBlock('heading1', 'Chapter <One>'),
      p,
      makeBlock('bullet', 'Apples'),
      makeBlock('bullet', 'Green', [], { indent: 1 }),
      makeBlock('numbered', 'First'),
      makeBlock('numbered', 'Second'),
      makeBlock('todo', 'Done thing', [], { checked: true }),
      makeBlock('todo', 'Open thing'),
      makeBlock('quote', 'Said someone'),
      makeBlock('paragraph', 'Centred', [], { align: 'center' }),
      makeBlock('paragraph', '', [], { style: 'scenebreak' }),
      makeBlock('table', '', [], { rows: [['Name', 'Age'], ['Ann', '3']] }),
      makeBlock('image', 'A dot', [], { src: 'Attachments/abc1234-dot.png' }),
      makeBlock('paragraph', 'The end.'),
    ],
  };
}

describe('zip', () => {
  it('writes and reads back', async () => {
    const files = await readZip(await writeZip([{ name: 'a.txt', data: new TextEncoder().encode('hello '.repeat(50)) }, { name: 'dir/b.bin', data: PNG }]));
    expect(new TextDecoder().decode(files.get('a.txt'))).toBe('hello '.repeat(50));
    expect(files.get('dir/b.bin')).toEqual(PNG);
  });
});

describe('Word documents', () => {
  it('reads picture sizes', () => {
    expect(imageSize(PNG)).toEqual({ width: 2, height: 1 });
  });

  it('are written with well-formed parts, and read back into the same note', async () => {
    const bytes = await toDocx([{ doc: sample() }], {
      title: 'My essay',
      author: 'Me',
      page: { ...defaultPage(), hf: manuscriptHeaders() },
      hf: manuscriptHeaders(),
      field: (r) => (r.field === 'author' ? 'Me' : r.field === 'title' ? 'MY ESSAY' : ''),
      media: async () => ({ bytes: PNG, type: 'image/png' }),
    });
    const files = await readZip(bytes);
    for (const [name, data] of files) {
      if (!/\.(xml|rels)$/.test(name)) continue;
      const doc = new DOMParser().parseFromString(new TextDecoder().decode(data), 'application/xml');
      expect(doc.getElementsByTagName('parsererror'), name).toHaveLength(0);
    }
    expect(files.has('word/media/image1.png')).toBe(true);
    expect(new TextDecoder().decode(files.get('word/footnotes.xml'))).toContain('A note &amp; more.');

    const saved: string[] = [];
    const back = await fromDocx(bytes, { saveMedia: async (name) => (saved.push(name), `Attachments/x-${name}`) });
    expect(back.title).toBe('My essay');
    const b = back.doc.blocks;
    expect(b.map((x) => x.type)).toEqual(['heading1', 'paragraph', 'bullet', 'bullet', 'numbered', 'numbered', 'todo', 'todo', 'quote', 'paragraph', 'paragraph', 'table', 'image', 'paragraph', 'paragraph']);
    expect(b[0].runs[0].text).toBe('Chapter <One>');
    expect(b[1].runs).toEqual(sample().blocks[1].runs);
    expect(b[3].indent).toBe(1);
    expect(b[6]).toMatchObject({ checked: true, runs: [{ text: 'Done thing' }] });
    expect(b[7]).toMatchObject({ checked: false });
    expect(b[9].align).toBe('center');
    expect(b[10].style).toBe('scenebreak');
    expect(b[11].rows).toEqual([['Name', 'Age'], ['Ann', '3']]);
    expect(b[12]).toMatchObject({ type: 'image', src: 'Attachments/x-image1.png', runs: [{ text: 'A dot' }] });
    expect(b[13]).toMatchObject({ style: 'caption', runs: [{ text: 'A dot' }] });
    expect(saved).toEqual(['image1.png']);
  });

  it('a manuscript puts each chapter on a new page under its title', async () => {
    const bytes = await toDocx([{ heading: 'One', doc: { blocks: [makeBlock('paragraph', 'a')] } }, { heading: 'Two', doc: { blocks: [makeBlock('paragraph', 'b')] } }], { title: 'Book' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml.match(/pageBreakBefore/g)).toHaveLength(1);
    const back = await fromDocx(bytes);
    expect(back.doc.blocks.map((x) => [x.type, x.runs[0]?.text])).toEqual([
      ['heading1', 'One'],
      ['paragraph', 'a'],
      ['heading1', 'Two'],
      ['paragraph', 'b'],
    ]);
  });

  it('a file that isn’t a Word document is refused', async () => {
    await expect(fromDocx(new TextEncoder().encode('hello'))).rejects.toThrow();
  });
});

describe('Word comments', () => {
  it('are written as Word comments and read back onto the same text', async () => {
    const c = { ...makeComment('Ann Lee', 'Which hill?', Date.UTC(2026, 9, 7, 9, 32)), replies: [{ author: 'Bo', at: 0, text: 'The big one' }] };
    const a = makeBlock('paragraph', '');
    a.runs = [{ text: 'The castle ', marks: [] }, { text: 'stood ', marks: [], comment: c }, { text: 'on', marks: ['bold'], comment: c }];
    const b = makeBlock('paragraph', '');
    b.runs = [{ text: 'the hill', marks: [], comment: c }, { text: '.', marks: [] }];
    const bytes = await toDocx([{ doc: { blocks: [a, b] } }], { title: 'T' });
    const files = await readZip(bytes);
    const xml = new TextDecoder().decode(files.get('word/comments.xml'));
    expect(xml).toContain('w:author="Ann Lee"');
    expect(xml).toContain('Bo: The big one');
    const doc = new TextDecoder().decode(files.get('word/document.xml'));
    expect(doc.match(/commentRangeStart/g)).toHaveLength(1);
    expect(doc.match(/commentReference/g)).toHaveLength(1);
    const back = await fromDocx(bytes);
    const runs = back.doc.blocks.flatMap((x) => x.runs);
    expect(runs.filter((r) => r.comment).map((r) => r.text)).toEqual(['stood ', 'on', 'the hill']);
    expect(runs.find((r) => r.comment)!.comment).toEqual(c);
  });
});
