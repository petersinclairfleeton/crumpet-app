import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { decodeBand, encodeBand, pageHF } from '../../src/data/sectionhf';
import { pageNumberFooter } from '../../src/data/headers';

describe('sections’ own headers and footers', () => {
  it('write a band short and read it back, with fields, bold and characters that need escaping', () => {
    const band = { left: [{ text: 'Part ', b: true }, { field: 'chapter' as const, b: true }], center: [], right: [{ text: 'A | 50% *off*' }, { field: 'date' as const, fmt: 'iso' as const }] };
    const s = encodeBand(band);
    expect(s).toBe('**Part ****%chapter%**||A \\| 50\\% \\*off\\*%date:iso%');
    expect(decodeBand(s)).toEqual({ left: [{ text: 'Part ', b: true }, { field: 'chapter', b: true }], center: [], right: [{ text: 'A | 50% *off*' }, { field: 'date', fmt: 'iso' }] });
  });

  it('link sections to the one before, leave a first page blank, and start page numbers again', () => {
    const doc = fromMarkdown('One\n\nTwo {sect=page hdr="Two||" pstart=1 pfmt="i"}\n\nThree {sect=page .hfirst}\n');
    const [a, b, c] = doc.blocks.map((x) => x.id);
    const boxes = [
      { sectionBlock: a, sectionFirst: true },
      { sectionBlock: b, sectionFirst: true },
      { sectionBlock: b, sectionFirst: false },
      { sectionBlock: c, sectionFirst: true },
      { sectionBlock: c, sectionFirst: false },
    ];
    const hf = pageNumberFooter();
    const at = (i: number) => pageHF(hf, doc, boxes, i, 0, false);
    expect(at(0)).toMatchObject({ section: 0, number: 1, format: '1', headerFrom: -1 });
    expect(at(1)).toMatchObject({ section: 1, number: 1, format: 'i', headerFrom: 1 });
    expect(at(1).set.header.left).toEqual([{ text: 'Two' }]);
    expect(at(2).number).toBe(2);
    // Section three: linked to two's header, its first page blank, numbers carrying on.
    expect(at(3)).toMatchObject({ blankFirst: true, number: 3 });
    expect(at(3).set.footer.center).toEqual([]);
    expect(at(4).set.header.left).toEqual([{ text: 'Two' }]);
    expect(at(4).set.footer.center).toEqual([{ field: 'page' }]);
  });
});
