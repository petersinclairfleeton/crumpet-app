// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FIELD, makeBlock, runsText } from '@crumpet/editor/model';
import { fromDocx, toDocx } from '../../src/data/docx';
import { readZip, writeZip } from '../../src/data/zip';

describe('Word: drop caps and date fields', () => {
  it('a drop cap goes to Word as a framed first letter, and comes back as one paragraph', async () => {
    const p = makeBlock('paragraph', 'Once upon a time.', [], { para: { drop: 3, pageBefore: true } });
    const bytes = await toDocx([{ doc: { blocks: [makeBlock('paragraph', 'Before'), p] } }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('w:dropCap="drop" w:lines="3"');
    expect(xml.match(/pageBreakBefore/g)).toHaveLength(1);
    const back = await fromDocx(bytes);
    const blocks = back.doc.blocks;
    expect(blocks.map((b) => runsText(b.runs))).toEqual(['Before', 'Once upon a time.']);
    expect(blocks[1].para?.drop).toBe(3);
    expect(blocks[1].para?.pageBefore).toBe(true);
    expect(blocks[1].runs.some((r) => r.look?.size)).toBe(false);
  });

  it('a date field goes to Word as a DATE field and comes back as a field', async () => {
    const p = makeBlock('paragraph', 'Today: ');
    p.runs.push({ text: FIELD, marks: [], field: 'date-full' });
    const bytes = await toDocx([{ doc: { blocks: [p] } }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('DATE \\@ &quot;dddd, d MMMM yyyy&quot;');
    const back = await fromDocx(bytes);
    expect(back.doc.blocks[0].runs.find((r) => r.field)?.field).toBe('date-full');
  });

  it('reads Word’s long-form date fields, and keeps what other fields showed', async () => {
    const files = await readZip(await toDocx([{ doc: { blocks: [makeBlock('paragraph', 'x')] } }], { title: 'T' }));
    const doc = new TextDecoder().decode(files.get('word/document.xml'));
    const r = (inner: string) => `<w:r>${inner}</w:r>`;
    const body =
      '<w:p>' +
      r('<w:t xml:space="preserve">On </w:t>') +
      r('<w:fldChar w:fldCharType="begin"/>') +
      r('<w:instrText xml:space="preserve"> TIME \\@ "HH:mm" </w:instrText>') +
      r('<w:fldChar w:fldCharType="separate"/>') +
      r('<w:t>09:15</w:t>') +
      r('<w:fldChar w:fldCharType="end"/>') +
      r('<w:t xml:space="preserve">, page </w:t>') +
      r('<w:fldChar w:fldCharType="begin"/>') +
      r('<w:instrText> PAGE </w:instrText>') +
      r('<w:fldChar w:fldCharType="separate"/>') +
      r('<w:t>4</w:t>') +
      r('<w:fldChar w:fldCharType="end"/>') +
      '</w:p>';
    files.set('word/document.xml', new TextEncoder().encode(doc.replace(/<w:body>.*?(<w:sectPr)/s, `<w:body>${body}$1`)));
    const back = await fromDocx(await writeZip([...files].map(([name, data]) => ({ name, data }))));
    const runs = back.doc.blocks[0].runs;
    expect(runs.find((x) => x.field)?.field).toBe('time');
    expect(runsText(runs).replace(FIELD, '#')).toBe('On #, page 4');
  });
});

describe('Word: tab stops', () => {
  it('go to Word and come back', async () => {
    const p = makeBlock('paragraph', 'Chapter one\t7', [], { para: { tabs: [{ at: 1, align: 'center' }, { at: 6, align: 'right', leader: 'dot' }] } });
    const bytes = await toDocx([{ doc: { blocks: [p] } }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('<w:tabs><w:tab w:val="center" w:pos="1440"/><w:tab w:val="right" w:leader="dot" w:pos="8640"/></w:tabs>');
    const back = await fromDocx(bytes);
    expect(back.doc.blocks[0].para?.tabs).toEqual([{ at: 1, align: 'center' }, { at: 6, align: 'right', leader: 'dot' }]);
    expect(runsText(back.doc.blocks[0].runs)).toBe('Chapter one\t7');
  });
});

describe('Word: pictures', () => {
  // A 2×1 PNG.
  const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwQZGBgAJ+wE/OXBtvUAAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
  const opts = { title: 'T', media: async () => ({ bytes: PNG, type: 'image/png' }) };
  const back = async (bytes: Uint8Array) => (await fromDocx(bytes, { saveMedia: async (name: string) => `Attachments/x-${name}` })).doc.blocks;

  it('keep their width, turn, wrapping and alt text', async () => {
    const img = makeBlock('image', 'A gull', [], { src: 'Attachments/a-gull.png', pic: { w: 2, rot: 15, wrap: 'right', alt: 'A gull on a post' } });
    const bytes = await toDocx([{ doc: { blocks: [img, makeBlock('paragraph', 'Text beside it.')] } }], opts);
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('<wp:wrapSquare wrapText="bothSides"/>');
    expect(xml).toContain('descr="A gull on a post"');
    expect(xml).toContain('rot="900000"');
    const [pic] = await back(bytes);
    expect(pic).toMatchObject({ type: 'image', runs: [{ text: 'A gull' }], pic: { w: 2, rot: 15, wrap: 'right', alt: 'A gull on a post' } });
  });

  it('in front of the text: where it was put', async () => {
    const img = makeBlock('image', '', [], { src: 'Attachments/a-gull.png', pic: { w: 1.5, wrap: 'free', x: 1, y: -0.5 } });
    const [pic] = await back(await toDocx([{ doc: { blocks: [img] } }], opts));
    expect(pic.pic).toMatchObject({ w: 1.5, wrap: 'free', x: 1, y: -0.5 });
  });
});
