// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { toHtml, toOdt, toRtf, toText } from '../../src/data/exports';
import { readZip } from '../../src/data/zip';
import { pageRange } from '../../src/ui/print';

const doc = fromMarkdown('# Chapter\n\nSome **bold** and *italic* with a note.^[The note.]\n\n- One\n- Two\n\n1. First\n2. Second\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> A quote\n');

describe('more download types', () => {
  it('plain text: headings, lists with bullets and numbers, tables with tabs, notes at the end', () => {
    const t = toText('Book', [{ doc }]);
    expect(t).toContain('CHAPTER');
    expect(t).toContain('• One');
    expect(t).toContain('2. Second');
    expect(t).toContain('A\tB');
    expect(t).toMatch(/Notes\n1\. The note\./);
  });

  it('a web page: headings, bold and italic, lists, a table, footnotes', async () => {
    const h = await toHtml('Book', [{ doc }]);
    expect(h).toContain('<h1>Chapter</h1>');
    expect(h).toContain('<strong>bold</strong>');
    expect(h).toContain('<ul>');
    expect(h).toContain('<ol>');
    expect(h).toContain('<th>A</th>');
    expect(h).toContain('<blockquote>');
    expect(h).toContain('<li>The note.</li>');
  });

  it('Rich Text: bold and italic, bullets, a table row, and characters past plain ASCII', () => {
    const r = toRtf('Café', [{ doc }]);
    expect(r.startsWith('{\\rtf1')).toBe(true);
    expect(r).toContain('{\\b bold}');
    expect(r).toContain('\\bullet');
    expect(r).toContain('\\row');
    expect(r).toContain('Caf\\u233?');
  });

  it('OpenDocument: the type first and not compressed, then content with headings, lists and a table', async () => {
    const bytes = await toOdt('Book', [{ doc }]);
    expect(new TextDecoder().decode(bytes.slice(30, 38))).toBe('mimetype');
    const files = await readZip(bytes);
    const content = new TextDecoder().decode(files.get('content.xml'));
    expect(content).toContain('<text:h text:style-name="Heading_20_1" text:outline-level="1">Chapter</text:h>');
    expect(content).toContain('<text:list text:style-name="Bullets">');
    expect(content).toContain('<table:table ');
    expect(new TextDecoder().decode(files.get('META-INF/manifest.xml'))).toContain('application/vnd.oasis.opendocument.text');
  });
});

describe('the print window’s page ranges', () => {
  it('reads ranges, single pages and open ends', () => {
    expect(pageRange('1-3, 5', 10)).toEqual([1, 2, 3, 5]);
    expect(pageRange('8-', 10)).toEqual([8, 9, 10]);
    expect(pageRange('-2', 10)).toEqual([1, 2]);
    expect(pageRange('3–4', 10)).toEqual([3, 4]);
    expect(pageRange('12', 10)).toBeNull();
    expect(pageRange('a', 10)).toBeNull();
  });
});
