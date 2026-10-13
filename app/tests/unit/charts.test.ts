// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { chartFromRows, chartSvg, chartText, parseChart } from '@crumpet/editor/chart';
import { playable, videoEmbed } from '@crumpet/editor/video';
import { fromDocx, toDocx } from '../../src/data/docx';
import { readZip } from '../../src/data/zip';
import { toHtml } from '../../src/data/exports';

const SAMPLE = 'type: bar\ntitle: Fruit sold\n, 2024, 2025\nApples, 3, 5\nPears, 4, 2';

describe('charts', () => {
  it('reads its kind, title, series and categories, and writes them back', () => {
    const c = parseChart(SAMPLE);
    expect(c).toEqual({ type: 'bar', title: 'Fruit sold', categories: ['Apples', 'Pears'], series: [{ name: '2024', values: [3, 4] }, { name: '2025', values: [5, 2] }] });
    expect(parseChart(chartText(c))).toEqual(c);
  });

  it('numbers without names, tabs, money and thousands', () => {
    expect(parseChart('a\t£1,200\nb\t30%').series[0].values).toEqual([1200, 30]);
    expect(parseChart('a, 1\nb, 2').series[0].name).toBe('Series 1');
  });

  it('a chart of a table', () => {
    expect(parseChart(chartFromRows([['', 'Q1', 'Q2'], ['North', '10', '12'], ['South', '7', '9']])).series.map((s) => s.name)).toEqual(['Q1', 'Q2']);
  });

  it('draws each kind', () => {
    for (const type of ['column', 'bar', 'line', 'area', 'pie', 'doughnut']) {
      const svg = chartSvg(parseChart(SAMPLE.replace('bar', type)));
      expect(svg).toMatch(/^<svg/);
      expect(svg).toContain('Fruit sold');
      expect(svg).not.toContain('NaN');
    }
  });

  it('is saved as a ```chart block', () => {
    const md = '```chart\n' + SAMPLE + '\n```\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].code).toEqual({ lang: 'chart', text: SAMPLE });
    expect(toMarkdown(doc)).toBe(md.trimEnd() + '\n');
  });

  it('goes to Word as a real chart, and comes back', async () => {
    for (const type of ['column', 'bar', 'line', 'pie']) {
      const doc = fromMarkdown('Before\n\n```chart\n' + SAMPLE.replace('bar', type) + '\n```\n\nAfter\n');
      const bytes = await toDocx([{ doc }], { title: 'T' });
      const files = await readZip(bytes);
      expect(files.has('word/charts/chart1.xml')).toBe(true);
      expect(new TextDecoder().decode(files.get('[Content_Types].xml'))).toContain('/word/charts/chart1.xml');
      expect(new TextDecoder().decode(files.get('word/_rels/document.xml.rels'))).toContain('charts/chart1.xml');
      const back = await fromDocx(bytes);
      const chart = back.doc.blocks.find((b) => b.type === 'code');
      const c = parseChart(chart?.code?.text ?? '');
      expect(c.type).toBe(type);
      expect(c.title).toBe('Fruit sold');
      expect(c.categories).toEqual(['Apples', 'Pears']);
      expect(c.series[0]).toEqual({ name: '2024', values: [3, 4] });
    }
  });

  it('a web page download draws it', async () => {
    expect(await toHtml('T', [{ doc: fromMarkdown('```chart\n' + SAMPLE + '\n```\n') }])).toContain('<svg class="chart-svg"');
  });
});

describe('online video', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=1m30s', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90'],
    ['https://www.youtube.com/shorts/abcdefghijk', 'https://www.youtube-nocookie.com/embed/abcdefghijk'],
    ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
    ['https://example.com/watch?v=x', null],
    ['not a link', null],
  ])('%s', (src, embed) => expect(videoEmbed(src)).toBe(embed));

  it('is saved as a link marked .video, and plain links stay links', () => {
    const md = '[A talk](https://youtu.be/dQw4w9WgXcQ) {.video}\n\n[Just a link](https://youtu.be/dQw4w9WgXcQ)\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0]).toMatchObject({ type: 'file', src: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(doc.blocks[1].type).toBe('paragraph');
    expect(toMarkdown(doc)).toBe(md);
  });

  it('attached video and sound play', () => {
    expect(playable('Attachments/clip.mp4')).toBe('video');
    expect(playable('Attachments/song.MP3')).toBe('audio');
    expect(playable('Attachments/a.pdf')).toBeNull();
  });

  it('goes to Word as a link', async () => {
    const bytes = await toDocx([{ doc: fromMarkdown('[A talk](https://youtu.be/dQw4w9WgXcQ) {.video}\n') }], { title: 'T' });
    const files = await readZip(bytes);
    expect(new TextDecoder().decode(files.get('word/document.xml'))).toContain('▶ A talk');
    expect(new TextDecoder().decode(files.get('word/_rels/document.xml.rels'))).toContain('https://youtu.be/dQw4w9WgXcQ');
  });
});
