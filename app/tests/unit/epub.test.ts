// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FOOTNOTE, makeBlock } from '@crumpet/editor/model';
import { toEpub } from '../../src/data/epub';
import { readZip } from '../../src/data/zip';

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwQZGBgAJ+wE/OXBtvUAAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

describe('e-books', () => {
  it('hold the chapters, pictures and footnotes, in well-formed files', async () => {
    const p = makeBlock('paragraph');
    p.runs = [{ text: 'It was <dark> & ', marks: [] }, { text: 'stormy', marks: ['italic'] }, { text: FOOTNOTE, marks: [], footnote: 'Very.' }, { text: ' gone', marks: [], change: { kind: 'del', author: '', at: 0 } }];
    const chapters = [
      {
        title: 'One',
        doc: {
          blocks: [
            p,
            makeBlock('bullet', 'a'),
            makeBlock('bullet', 'a1', [], { indent: 1 }),
            makeBlock('numbered', 'n'),
            makeBlock('todo', 'done', [], { checked: true }),
            makeBlock('paragraph', '', [], { style: 'scenebreak' }),
            makeBlock('image', 'Lamp', [], { src: 'Attachments/x-lamp.png' }),
            makeBlock('table', '', [], { rows: [['A', 'B'], ['1', '2']] }),
            makeBlock('heading2', 'Part'),
          ],
        },
      },
      { title: 'Two', doc: { blocks: [makeBlock('paragraph', 'Second.')] } },
    ];
    const bytes = await toEpub(chapters, { title: 'My Book', author: 'Me', language: 'en-GB', id: 'p1', media: async () => ({ bytes: PNG, type: 'image/png' }) });
    // "mimetype" first, stored as it is.
    expect(new TextDecoder().decode(bytes.subarray(30, 38))).toBe('mimetype');
    expect(new TextDecoder().decode(bytes.subarray(38, 58))).toBe('application/epub+zip');
    const files = await readZip(bytes);
    expect([...files.keys()]).toEqual(expect.arrayContaining(['META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/nav.xhtml', 'OEBPS/title.xhtml', 'OEBPS/chapter1.xhtml', 'OEBPS/chapter2.xhtml', 'OEBPS/images/image1.png', 'OEBPS/style.css']));
    for (const [name, data] of files) {
      if (!/\.(xhtml|opf|xml)$/.test(name)) continue;
      const xml = new DOMParser().parseFromString(new TextDecoder().decode(data), 'application/xml');
      expect(xml.getElementsByTagName('parsererror'), name).toHaveLength(0);
    }
    const ch1 = new TextDecoder().decode(files.get('OEBPS/chapter1.xhtml'));
    expect(ch1).toContain('It was &lt;dark&gt; &amp; <em>stormy</em><a epub:type="noteref" href="#fn1-1"');
    expect(ch1).not.toContain('gone');
    expect(ch1).toContain('<ul><li>a<ul><li>a1</li></ul></li></ul><ol><li>n</li></ol><ul class="checklist"><li><span class="box">☑</span> done</li></ul>');
    expect(ch1).toContain('<img src="images/image1.png" alt="Lamp"/>');
    expect(ch1).toContain('<aside epub:type="footnote" id="fn1-1" class="footnote"><p><a href="#ref1-1">1.</a> Very.</p></aside>');
    expect(ch1).toContain('<h3>Part</h3>');
    const opf = new TextDecoder().decode(files.get('OEBPS/content.opf'));
    expect(opf).toContain('<dc:title>My Book</dc:title>');
    expect(opf).toContain('<item id="img1" href="images/image1.png" media-type="image/png"/>');
    expect(new TextDecoder().decode(files.get('OEBPS/nav.xhtml'))).toContain('<a href="chapter2.xhtml">Two</a>');
  });
});
