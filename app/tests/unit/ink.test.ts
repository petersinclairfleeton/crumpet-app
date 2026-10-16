// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { type Stroke, inkSvg, inkText, insideLasso, parseInk, recognizeShape, strokeNear } from '@crumpet/editor/ink';
import { toHtml, toText } from '../../src/data/exports';
import { toDocx } from '../../src/data/docx';
import { readZip } from '../../src/data/zip';

const stroke = (p: [number, number][]): Stroke => ({ t: 'pen', c: '#1f1f1f', w: 3, p });
const circle = (cx: number, cy: number, r: number, n = 40): [number, number][] => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)]);
const along = (pts: [number, number][], steps = 8): [number, number][] =>
  pts.slice(1).flatMap((b, i) => Array.from({ length: steps }, (_, k) => [pts[i][0] + ((b[0] - pts[i][0]) * k) / steps + (k % 2 ? 1.5 : -1.5), pts[i][1] + ((b[1] - pts[i][1]) * k) / steps] as [number, number]));

describe('drawings', () => {
  it('read and write their strokes, and tidy bad ones', () => {
    const ink = parseInk('{"w":500,"h":200,"strokes":[{"t":"pencil","c":"#ff0000","w":4,"p":[[1,2],[3,4,0.5]]},{"t":"x","c":"bad","p":[[5,6]]},{"p":"no"}]}');
    expect(ink.strokes).toEqual([{ t: 'pencil', c: '#ff0000', w: 4, p: [[1, 2], [3, 4, 0.5]] }, { t: 'pen', c: '#1f1f1f', w: 3, p: [[5, 6]] }]);
    expect(parseInk(inkText(ink))).toEqual(ink);
    expect(parseInk('nonsense')).toEqual({ w: 600, h: 300, strokes: [] });
    expect(inkSvg(ink)).toMatch(/^<svg[^>]*viewBox="0 0 500 200"/);
  });

  it('are saved as ```ink blocks', () => {
    const md = '```ink\n{"w":600,"h":300,"strokes":[]}\n```\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].code?.lang).toBe('ink');
    expect(toMarkdown(doc)).toBe(md);
  });

  it('Ink to Shape: a line, a box, an oval and a triangle; a scribble stays as it is', () => {
    expect(recognizeShape(stroke(along([[10, 10], [200, 60]])))?.s).toBe('line');
    expect(recognizeShape(stroke(along([[10, 10], [200, 10], [200, 120], [10, 120], [10, 12]])))?.s).toBe('rect');
    expect(recognizeShape(stroke(circle(100, 100, 60)))?.s).toBe('oval');
    expect(recognizeShape(stroke(along([[100, 10], [190, 160], [10, 160], [99, 12]])))?.s).toBe('tri');
    const scribble = stroke(Array.from({ length: 40 }, (_, i) => [i * 5, (i % 2) * 40 + (i % 7) * 3] as [number, number]));
    expect(recognizeShape(scribble)).toBeNull();
  });

  it('the eraser and the lasso find strokes', () => {
    const s = stroke([[0, 0], [100, 0]]);
    expect(strokeNear(s, 50, 3, 4)).toBe(true);
    expect(strokeNear(s, 50, 30, 4)).toBe(false);
    expect(insideLasso([[0, 0], [10, 0], [10, 10], [0, 10]], 5, 5)).toBe(true);
    expect(insideLasso([[0, 0], [10, 0], [10, 10], [0, 10]], 15, 5)).toBe(false);
  });

  it('web pages show them; text downloads say a drawing is there; Word gets a placeholder where no picture can be made', async () => {
    const doc = fromMarkdown('```ink\n{"w":600,"h":300,"strokes":[{"t":"pen","c":"#000000","w":3,"p":[[1,1],[50,50]]}]}\n```\n');
    expect(await toHtml('T', [{ doc }])).toContain('<svg class="ink-svg"');
    expect(toText('T', [{ doc }])).toContain('[Drawing]');
    const xml = new TextDecoder().decode((await readZip(await toDocx([{ doc }], { title: 'T' }))).get('word/document.xml'));
    expect(xml).toContain('[Drawing]');
  });
});
