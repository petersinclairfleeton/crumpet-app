// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { drawingMLToShape, normalizePath, pathToDrawingML, svgToShapeLook } from '../../src/data/svgpath';

describe('SVG drawings as shapes', () => {
  it('makes every command absolute: lines, curves, quadratic curves and arcs as cubic curves', () => {
    const segs = normalizePath('m2 2 h4 v4 q2 2 4 0 a2 2 0 0 1 4 0 z');
    expect(segs.map((s) => s.op)).toEqual(['M', 'L', 'L', 'C', 'C', 'C', 'Z']);
    expect(segs[2]).toEqual({ op: 'L', x: 6, y: 6 });
    const last = segs[segs.length - 2];
    expect(last.op === 'C' && Math.round(last.x)).toBe(14);
  });

  it('reads an SVG file’s outlines into one drawing, from its box’s corner, with its colour', () => {
    const look = svgToShapeLook('<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 20 20"><rect x="10" y="10" width="5" height="5" fill="#c00"/><circle cx="20" cy="20" r="4"/></svg>')!;
    expect(look.vb).toEqual([20, 20]);
    expect(look.fill).toBe('#cc0000');
    expect(look.d).toMatch(/^M0 0L5 0L5 5L0 5Z/);
    expect(svgToShapeLook('<svg xmlns="http://www.w3.org/2000/svg"><text>Hi</text></svg>')).toBeNull();
  });

  it('writes a drawing in Word’s way and reads it back (straight lines as a freeform)', () => {
    const xml = pathToDrawingML('M0 0L1 0L0.5 1Z', [1, 1]);
    expect(xml).toContain('<a:path w="1000" h="1000"><a:moveTo><a:pt x="0" y="0"/></a:moveTo>');
    const geom = new DOMParser().parseFromString(`<root xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${xml}</root>`, 'application/xml').documentElement.firstElementChild!;
    expect(drawingMLToShape(geom)).toEqual({ kind: 'freeform', pts: [[0, 0], [1, 0], [0.5, 1]] });
    const curved = new DOMParser().parseFromString(`<root xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${pathToDrawingML('M0 0C1 0 1 1 0 1Z', [2, 2])}</root>`, 'application/xml').documentElement.firstElementChild!;
    expect(drawingMLToShape(curved)).toMatchObject({ kind: 'path', vb: [2000, 2000] });
  });
});
