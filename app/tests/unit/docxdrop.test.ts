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
      r('<w:instrText> FILENAME </w:instrText>') +
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

describe('Word: picture crops and corrections', () => {
  const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwQZGBgAJ+wE/OXBtvUAAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
  it('go to Word as its own picture settings and come back', async () => {
    const img = makeBlock('image', '', [], { src: 'Attachments/a.png', pic: { w: 2, crop: [0.1, 0.2, 0.1, 0.2], mask: 'oval', border: '#c0392b', bright: 20, contrast: -10, fade: 30, effect: 'grey', style: 'shadow' } });
    const bytes = await toDocx([{ doc: { blocks: [img] } }], { title: 'T', media: async () => ({ bytes: PNG, type: 'image/png' }) });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('<a:srcRect l="20000" t="10000" r="20000" b="10000"/>');
    expect(xml).toContain('prst="ellipse"');
    expect(xml).toContain('<a:lum bright="20000" contrast="-10000"/>');
    const back = (await fromDocx(bytes, { saveMedia: async (n: string) => `Attachments/x-${n}` })).doc.blocks[0];
    expect(back.pic).toMatchObject({ w: 2, crop: [0.1, 0.2, 0.1, 0.2], mask: 'oval', border: '#c0392b', bright: 20, contrast: -10, fade: 30, effect: 'grey', style: 'shadow' });
  });
});

describe('Word: tracking for everyone, locked', () => {
  it('goes to Word as its own settings and comes back', async () => {
    const p = makeBlock('paragraph', 'Text', [], { para: { track: 'all', lock: 'open' } });
    const bytes = await toDocx([{ doc: { blocks: [p] } }], { title: 'T' });
    const settings = new TextDecoder().decode((await readZip(bytes)).get('word/settings.xml'));
    expect(settings).toContain('<w:trackRevisions/>');
    expect(settings).toContain('w:edit="trackedChanges" w:enforcement="1"');
    const back = await fromDocx(bytes);
    expect(back.doc.blocks[0].para).toMatchObject({ track: 'all', lock: 'open' });
  });
});

describe('Word: the Font window’s settings', () => {
  it('go to Word as its own run settings and come back', async () => {
    const p = makeBlock('paragraph', '');
    p.runs = [{ text: 'Styled', marks: [], look: { caps: 'small', dstrike: 1, hidden: 1, ul: 'wavy', ulc: '#c0392b', sp: 1.5, pos: 3, fx: 'emboss' } }];
    const bytes = await toDocx([{ doc: { blocks: [p] } }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('<w:smallCaps/><w:dstrike/><w:emboss/><w:vanish/><w:spacing w:val="30"/><w:position w:val="6"/><w:u w:val="wave" w:color="C0392B"/>');
    const back = await fromDocx(bytes);
    expect(back.doc.blocks[0].runs[0].look).toEqual(p.runs[0].look);
  });
});

describe('Word: multilevel lists, border styles and widow control', () => {
  it('go to Word and come back', async () => {
    const blocks = [
      makeBlock('numbered', 'Part', [], { para: { num: 'upper-roman', numText: 'Part %1' } }),
      makeBlock('numbered', 'Inner', [], { indent: 1, para: { num: 'decimal', numText: '%1.%2' } }),
      makeBlock('paragraph', 'Boxed', [], { para: { border: 'tblr', bstyle: 'double', bcolor: '#2f6fd1', nowidow: true } }),
    ];
    const bytes = await toDocx([{ doc: { blocks } }], { title: 'T' });
    const files = await readZip(bytes);
    const numbering = new TextDecoder().decode(files.get('word/numbering.xml'));
    expect(numbering).toContain('<w:lvlText w:val="Part %1"/>');
    expect(numbering).toContain('<w:lvlText w:val="%1.%2"/>');
    const xml = new TextDecoder().decode(files.get('word/document.xml'));
    expect(xml).toContain('<w:top w:val="double" w:sz="4" w:space="4" w:color="2F6FD1"/>');
    expect(xml).toContain('<w:widowControl w:val="0"/>');
    const back = (await fromDocx(bytes)).doc.blocks;
    expect(back[0].para).toMatchObject({ num: 'upper-roman', numText: 'Part %1' });
    expect(back[1].para).toMatchObject({ num: 'decimal', numText: '%1.%2' });
    expect(back[2].para).toMatchObject({ border: 'tblr', bstyle: 'double', bcolor: '#2f6fd1', nowidow: true });
  });
});

describe('Word: styles of your own', () => {
  it('go to Word as styles of the same name, and come back as styles of your own', async () => {
    const def = { font: null, size: 13, bold: false, italic: true, caps: false, align: 'center' as const, spaceBefore: 6, spaceAfter: 12, lineSpacing: 1.15, firstIndent: 0, leftIndent: 0.5 };
    const custom = [{ id: 'c-letter', name: 'Letter', base: 'normal' as const, def }, { id: 'c-part-head', name: 'Part head', base: 'heading2' as const, def: { ...def, bold: true } }];
    const blocks = [makeBlock('paragraph', 'Dear Mara,', [], { style: 'c-letter' }), makeBlock('heading2', 'Part one', [], { style: 'c-part-head' }), makeBlock('paragraph', 'Plain')];
    const bytes = await toDocx([{ doc: { blocks } }], { title: 'T', custom });
    const files = await readZip(bytes);
    const styles = new TextDecoder().decode(files.get('word/styles.xml'));
    expect(styles).toContain('w:customStyle="1" w:styleId="MyLetter"><w:name w:val="Letter"/><w:basedOn w:val="Normal"/>');
    expect(styles).toContain('w:styleId="MyPartHead"><w:name w:val="Part head"/><w:basedOn w:val="Heading2"/>');
    expect(new TextDecoder().decode(files.get('word/document.xml'))).toContain('<w:pStyle w:val="MyLetter"/>');
    const back = await fromDocx(bytes);
    expect(back.doc.blocks.map((b) => [b.type, b.style])).toEqual([
      ['paragraph', 'c-letter'],
      ['heading2', 'c-part-head'],
      ['paragraph', undefined],
    ]);
    const letter = back.styles?.find((x) => x.id === 'c-letter');
    expect(letter).toMatchObject({ name: 'Letter', base: 'normal', def: { size: 13, italic: true, align: 'center', spaceBefore: 6, spaceAfter: 12, leftIndent: 0.5 } });
    expect(back.styles?.find((x) => x.id === 'c-part-head')?.base).toBe('heading2');
  });
});

describe('Word: table settings', () => {
  it('cells of their own, heights, margins, options, lines in a cell and formulas go to Word and come back', async () => {
    const tbl = { firstCol: true, totalRow: true, bandedCols: true, pad: 0.15, heights: [null, 0.5], cells: { '1,0': { v: 'middle' as const, dir: 'up' as const, bd: 'tb', bs: 'double' as const, bc: '#2f6fd1' }, '1,1': { h: 'right' as const } } };
    const rows = [
      ['Item', 'Cost'],
      ['Tea&#10;• hot', '2'],
      ['Total', '=SUM(ABOVE)'],
    ];
    const bytes = await toDocx([{ doc: { blocks: [makeBlock('table', '', [], { rows, tbl })] } }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('<w:textDirection w:val="btLr"/>');
    expect(xml).toContain('<w:vAlign w:val="center"/>');
    expect(xml).toContain('<w:trHeight w:val="720" w:hRule="atLeast"/>');
    expect(xml).toContain('w:lastRow="1" w:firstColumn="1"');
    expect(xml).toContain('<w:fldSimple w:instr=" =SUM(ABOVE) "><w:r><w:t xml:space="preserve">2</w:t>');
    expect(xml).toContain('<w:top w:val="double" w:sz="4" w:space="0" w:color="2F6FD1"/>');
    const back = (await fromDocx(bytes)).doc.blocks[0];
    expect(back.rows).toEqual([
      ['Item', 'Cost'],
      ['Tea&#10;• hot', '2'],
      ['Total', '=SUM(ABOVE)'],
    ]);
    expect(back.tbl).toMatchObject({ firstCol: true, totalRow: true, bandedCols: true, pad: 0.15, heights: [null, 0.5] });
    expect(back.tbl?.cells?.['1,0']).toEqual({ v: 'middle', dir: 'up', bd: 'tb', bs: 'double', bc: '#2f6fd1' });
    expect(back.tbl?.cells?.['1,1']).toEqual({ h: 'right' });
  });
});

describe('Word: endnotes, bookmarks and fields', () => {
  it('endnotes go to Word as endnotes and come back with their text', async () => {
    const p = makeBlock('paragraph', 'The lamp.');
    p.runs.push({ text: '⁣', marks: [], footnote: 'Lit in 1902.', endnote: true });
    p.runs.push({ text: ' Gulls.', marks: [] });
    p.runs.push({ text: '⁣', marks: [], footnote: 'Herring gulls.' });
    const bytes = await toDocx([{ doc: { blocks: [p] } }], { title: 'T' });
    const files = await readZip(bytes);
    expect(new TextDecoder().decode(files.get('word/endnotes.xml'))).toContain('Lit in 1902.');
    expect(new TextDecoder().decode(files.get('word/document.xml'))).toContain('<w:endnoteReference w:id="1"/>');
    const back = (await fromDocx(bytes)).doc.blocks[0].runs.filter((r) => r.footnote !== undefined);
    expect(back.map((r) => [r.footnote, !!r.endnote])).toEqual([
      ['Lit in 1902.', true],
      ['Herring gulls.', false],
    ]);
  });

  it('a bookmark, a caption number and a cross-reference go to Word and come back', async () => {
    const cap = makeBlock('paragraph', '', [], { style: 'caption', runs: [{ text: FIELD, marks: [], field: 'bm:lamp' }, { text: 'Figure ', marks: [] }, { text: FIELD, marks: [], field: 'seq:Figure' }, { text: ': The lamp', marks: [] }] });
    const see = makeBlock('paragraph', '', [], { runs: [{ text: 'See ', marks: [] }, { text: FIELD, marks: [], field: 'ref:lamp' }, { text: ', page ', marks: [] }, { text: FIELD, marks: [], field: 'page' }] });
    const bytes = await toDocx([{ doc: { blocks: [cap, see] } }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('<w:bookmarkStart w:id="1" w:name="lamp"/>');
    expect(xml).toContain('w:instr=" SEQ Figure \\* ARABIC "><w:r><w:t xml:space="preserve">1</w:t>');
    expect(xml).toContain('w:instr=" REF lamp \\h "><w:r><w:t xml:space="preserve">Figure 1</w:t>');
    const back = (await fromDocx(bytes)).doc.blocks;
    expect(back[0].runs.filter((r) => r.field).map((r) => r.field)).toEqual(['bm:lamp', 'seq:Figure']);
    expect(back[1].runs.filter((r) => r.field).map((r) => r.field)).toEqual(['ref:lamp', 'page']);
  });
});

describe('Word: page layout', () => {
  it('odd page sections, a section\'s own paper, line numbers, hyphenation and the text wrapping break go to Word and come back', async () => {
    const first = makeBlock('paragraph', 'One', [], { para: { hyph: true, lnum: 5, lnr: 'sect' } });
    const odd = makeBlock('paragraph', 'Two', [], { para: { sect: 'odd', pw: 5, ph: 8 } });
    const wrap = makeBlock('paragraph', '', [], { runs: [{ text: 'A', marks: [] }, { text: FIELD, marks: [], field: 'wrapbreak' }, { text: 'B', marks: [] }] });
    const bytes = await toDocx([{ doc: { blocks: [first, odd, wrap] } }], { title: 'T' });
    const files = await readZip(bytes);
    const xml = new TextDecoder().decode(files.get('word/document.xml'));
    expect(xml).toContain('<w:type w:val="oddPage"/><w:pgSz w:w="7200" w:h="11520"/>');
    expect(xml).toContain('<w:lnNumType w:countBy="5" w:restart="newSection"/>');
    expect(xml).toContain('<w:br w:type="textWrapping" w:clear="all"/>');
    expect(new TextDecoder().decode(files.get('word/settings.xml'))).toContain('<w:autoHyphenation/>');
    const back = (await fromDocx(bytes)).doc.blocks;
    expect(back[0].para).toMatchObject({ hyph: true, lnum: 5, lnr: 'sect' });
    expect(back[1].para).toMatchObject({ sect: 'odd', pw: 5, ph: 8 });
    expect(back[2].runs.map((r) => r.field ?? r.text)).toEqual(['A', 'wrapbreak', 'B']);
  });
});

describe('Word: page design', () => {
  it('sections’ own headers, a blank first page, page numbers started again, a watermark, page colour and border go to Word and come back', async () => {
    const first = makeBlock('paragraph', 'Cover', [], { para: { sect: 'page', hfirst: true, wm: 'DRAFT', pgc: '#fff2cc', pgb: 'double', pgbc: '#2f5d8a' } });
    const two = makeBlock('paragraph', 'Two', [], { para: { sect: 'page', hdr: 'Part two||%page%', pstart: 1, pfmt: 'i' } });
    const pageHf = { sets: { main: { header: { left: [], center: [{ text: 'Book' }], right: [] }, footer: { left: [], center: [], right: [] } } }, differentFirst: false, differentChapterFirst: false, differentOddEven: false, numberFormat: '1' as const, startAt: 1, headerFrom: 0.5, footerFrom: 0.5, headerLine: false, footerLine: false };
    const bytes = await toDocx([{ doc: { blocks: [first, two] } }], { title: 'T', hf: pageHf });
    const files = await readZip(bytes);
    const xml = new TextDecoder().decode(files.get('word/document.xml'));
    expect(xml).toContain('<w:background w:color="FFF2CC"/>');
    expect(xml).toContain('<w:pgBorders w:offsetFrom="page"><w:top w:val="double" w:sz="6" w:space="24" w:color="2F5D8A"/>');
    expect(xml).toContain('<w:pgNumType w:fmt="lowerRoman" w:start="1"/>');
    expect(xml.match(/<w:titlePg\/>/g)).toHaveLength(1);
    const headers = [...files.keys()].filter((k) => /word\/header\d+\.xml$/.test(k)).map((k) => new TextDecoder().decode(files.get(k)));
    expect(headers.every((h) => h.includes('PowerPlusWaterMarkObject1') && h.includes('string="DRAFT"'))).toBe(true);
    expect(headers.some((h) => h.includes('Part two'))).toBe(true);
    expect(new TextDecoder().decode(files.get('[Content_Types].xml'))).not.toContain('.rels"');
    const back = (await fromDocx(bytes)).doc.blocks;
    expect(back[0].para).toMatchObject({ sect: 'page', hfirst: true, hdr: '|Book|', wm: 'DRAFT', pgc: '#fff2cc', pgb: 'double', pgbc: '#2f5d8a' });
    expect(back[1].para).toMatchObject({ sect: 'page', hdr: 'Part two||%page%', pstart: 1, pfmt: 'i' });
  });
});

describe('Word: document themes', () => {
  it('the theme’s fonts, colours and paragraph spacing go into Word’s styles, and the names come back', async () => {
    const first = makeBlock('heading1', 'Title', [], { para: { thc: 'ocean', thf: 'modern', thx: 'soft', psp: 'open' } });
    const bytes = await toDocx([{ doc: { blocks: [first, makeBlock('paragraph', 'Body')] } }], { title: 'T' });
    const files = await readZip(bytes);
    const styles = new TextDecoder().decode(files.get('word/styles.xml'));
    expect(styles).toContain('<w:rPrDefault><w:rPr><w:rFonts w:ascii="Open Sans"');
    expect(styles).toMatch(/w:styleId="Heading1">.*?<w:rPr><w:rFonts w:ascii="Montserrat"[^>]*\/><w:b\/><w:color w:val="1F5F8B"\/>/);
    expect(styles).toContain('<w:spacing w:before="120" w:after="200" w:line="276" w:lineRule="auto"/>');
    expect(new TextDecoder().decode(files.get('word/settings.xml'))).toContain('<w:docVar w:name="CrumpetDesign" w:val="thc=ocean;thf=modern;thx=soft;psp=open"/>');
    const back = (await fromDocx(bytes)).doc.blocks;
    expect(back[0].para).toMatchObject({ thc: 'ocean', thf: 'modern', thx: 'soft', psp: 'open' });
  });
});
