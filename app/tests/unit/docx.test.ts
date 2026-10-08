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
    const c = { ...makeComment('Ann Lee', 'Which hill?', Date.UTC(2026, 9, 7, 9, 32)), replies: [{ author: 'Bo', at: Date.UTC(2026, 9, 7, 10, 0), text: 'The big one' }, { author: 'Ann Lee', at: Date.UTC(2026, 9, 7, 10, 5), text: 'Thanks!' }] };
    const a = makeBlock('paragraph', '');
    a.runs = [{ text: 'The castle ', marks: [] }, { text: 'stood ', marks: [], comment: c }, { text: 'on', marks: ['bold'], comment: c }];
    const b = makeBlock('paragraph', '');
    b.runs = [{ text: 'the hill', marks: [], comment: c }, { text: '.', marks: [] }];
    const bytes = await toDocx([{ doc: { blocks: [a, b] } }], { title: 'T' });
    const files = await readZip(bytes);
    const xml = new TextDecoder().decode(files.get('word/comments.xml'));
    expect(xml).toContain('w:author="Ann Lee"');
    // Each reply is a comment of its own, tied to the first in Word's thread list.
    expect(xml.match(/<w:comment /g)).toHaveLength(3);
    expect(xml).toContain('w:author="Bo"');
    const threads = new TextDecoder().decode(files.get('word/commentsExtended.xml'));
    expect(threads.match(/paraIdParent="10000000"/g)).toHaveLength(2);
    expect(new TextDecoder().decode(files.get('[Content_Types].xml'))).toContain('commentsExtended+xml');
    const doc = new TextDecoder().decode(files.get('word/document.xml'));
    expect(doc.match(/commentRangeStart/g)).toHaveLength(3);
    expect(doc.match(/commentReference/g)).toHaveLength(3);
    const back = await fromDocx(bytes);
    const runs = back.doc.blocks.flatMap((x) => x.runs);
    expect(runs.filter((r) => r.comment).map((r) => r.text)).toEqual(['stood ', 'on', 'the hill']);
    expect(runs.find((r) => r.comment)!.comment).toEqual(c);
  });

  it('read older files whose replies are extra lines in the comment', async () => {
    const c = { ...makeComment('Ann Lee', 'Which hill?', Date.UTC(2026, 9, 7, 9, 32)) };
    const a = makeBlock('paragraph', '');
    a.runs = [{ text: 'stood', marks: [], comment: c }];
    const files = await readZip(await toDocx([{ doc: { blocks: [a] } }], { title: 'T' }));
    // As Crumpet used to write them: no thread list, the reply as a second paragraph.
    const old = new TextDecoder().decode(files.get('word/comments.xml')).replace('</w:p></w:comment>', '</w:p><w:p><w:r><w:t>Bo: The big one</w:t></w:r></w:p></w:comment>');
    files.set('word/comments.xml', new TextEncoder().encode(old));
    files.delete('word/commentsExtended.xml');
    const { writeZip } = await import('../../src/data/zip');
    const back = await fromDocx(await writeZip([...files].map(([name, data]) => ({ name, data }))));
    expect(back.doc.blocks[0].runs[0].comment?.replies).toEqual([{ author: 'Bo', at: 0, text: 'The big one' }]);
  });
});

describe('Word tracked changes', () => {
  it('are written as Word revisions and read back', async () => {
    const ins = { kind: 'ins' as const, author: 'Robin', at: Date.UTC(2026, 9, 7, 9, 32) };
    const del = { kind: 'del' as const, author: 'Sam', at: Date.UTC(2026, 9, 7, 9, 40) };
    const a = makeBlock('paragraph', '');
    a.runs = [{ text: 'The ', marks: [] }, { text: 'big', marks: [], change: del }, { text: 'huge', marks: ['bold'], change: ins }, { text: ' sea.', marks: [] }];
    const bytes = await toDocx([{ doc: { blocks: [a] } }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('<w:del w:id=');
    expect(xml).toContain('<w:delText xml:space="preserve">big</w:delText>');
    expect(xml).toContain('<w:ins w:id=');
    const back = await fromDocx(bytes);
    expect(back.doc.blocks[0].runs).toEqual(a.runs);
  });
});

describe('Word tracked paragraph breaks', () => {
  it('ride on the paragraph mark before them, both ways', async () => {
    const c = { kind: 'ins' as const, author: 'Robin', at: Date.UTC(2026, 9, 7, 9, 32) };
    const blocks = [makeBlock('paragraph', 'One'), { ...makeBlock('paragraph', 'Two'), brk: c }, { ...makeBlock('paragraph', 'Three'), brk: { ...c, kind: 'del' as const } }];
    const bytes = await toDocx([{ doc: { blocks } }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toMatch(/One<\/w:t>/);
    expect(xml).toMatch(/<w:pPr><w:rPr><w:ins w:id="\d+" w:author="Robin"/);
    const back = await fromDocx(bytes);
    expect(back.doc.blocks.map((b) => [b.runs[0].text, b.brk?.kind])).toEqual([['One', undefined], ['Two', 'ins'], ['Three', 'del']]);
    expect(back.doc.blocks[1].brk).toEqual(c);
  });
});

describe('Word fonts, sizes and colours', () => {
  it('are written as Word run settings and read back', async () => {
    const a = makeBlock('paragraph', '');
    a.runs = [
      { text: 'Plain ', marks: [] },
      { text: 'grand', marks: ['bold'], look: { font: 'EB Garamond', size: 20, color: '#cc0000' } },
      { text: ' marked', marks: [], look: { highlight: '#ffff00' } },
      { text: ' soft', marks: [], look: { highlight: '#fde7c8' } },
      { text: ' E=mc', marks: [] },
      { text: '2', marks: [], look: { va: 'super' } },
    ];
    const bytes = await toDocx([{ doc: { blocks: [a] } }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('<w:rFonts w:ascii="EB Garamond"');
    expect(xml).toContain('<w:sz w:val="40"/>');
    expect(xml).toContain('<w:color w:val="CC0000"/>');
    expect(xml).toContain('<w:highlight w:val="yellow"/>');
    expect(xml).toContain('w:fill="FDE7C8"');
    expect(xml).toContain('<w:vertAlign w:val="superscript"/>');
    const back = await fromDocx(bytes);
    expect(back.doc.blocks[0].runs).toEqual(a.runs);
  });
});

describe('Word paragraph settings', () => {
  it('spacing, indents, keeps and page breaks are written and read back', async () => {
    const a = { ...makeBlock('paragraph', 'Spaced'), para: { line: 2, before: 12, after: 6, left: 0.5, right: 0.25, first: 0.5, keepNext: true } };
    const b = { ...makeBlock('paragraph', 'Hanging'), para: { left: 0.5, first: -0.5 } };
    const c = { ...makeBlock('paragraph', 'New page'), para: { pageBefore: true } };
    const bytes = await toDocx([{ doc: { blocks: [a, b, c] } }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('<w:spacing w:before="240" w:after="120" w:line="480" w:lineRule="auto"/>');
    expect(xml).toContain('<w:ind w:left="720" w:right="360" w:firstLine="720"/>');
    expect(xml).toContain('w:hanging="720"');
    expect(xml).toContain('<w:pageBreakBefore/>');
    const back = await fromDocx(bytes);
    expect(back.doc.blocks.map((x) => x.para)).toEqual([a.para, b.para, c.para]);
  });

  it('a page break typed in Word starts the next paragraph on a new page', async () => {
    const p = (inner: string) => `<w:p>${inner}</w:p>`;
    const body = p('<w:r><w:t>Before</w:t></w:r>') + p('<w:r><w:br w:type="page"/></w:r>') + p('<w:r><w:t>After</w:t></w:r>') + p('<w:r><w:t>End</w:t></w:r><w:r><w:br w:type="page"/></w:r>') + p('<w:r><w:t>Last</w:t></w:r>');
    const files = await readZip(await toDocx([{ doc: { blocks: [makeBlock('paragraph', 'x')] } }], { title: 'T' }));
    const doc = new TextDecoder().decode(files.get('word/document.xml')).replace(/<w:body>.*<w:sectPr>/s, `<w:body>${body}<w:sectPr>`);
    files.set('word/document.xml', new TextEncoder().encode(doc));
    const { writeZip } = await import('../../src/data/zip');
    const back = await fromDocx(await writeZip([...files].map(([name, data]) => ({ name, data }))));
    expect(back.doc.blocks.map((x) => [x.runs.map((r) => r.text).join(''), !!x.para?.pageBefore])).toEqual([
      ['Before', false],
      ['After', true],
      ['End', false],
      ['Last', true],
    ]);
  });
});
