import { describe, expect, it } from 'vitest';
import { blockStyleKey, customStyleId, fullSheet, presetSheet, sheetCss, sheetStyles, styleDefFor } from '../../src/data/styles';

describe('styles of your own, hiding and ordering', () => {
  const base = presetSheet('crumpet');
  const sheet = fullSheet({ ...base, custom: [{ id: 'c-letter', name: 'Letter', base: 'normal', def: { ...base.styles.normal, italic: true } }], hidden: ['epigraph'], order: ['c-letter', 'heading1'] }, 'crumpet');

  it('list them in the menu order, leaving hidden ones out of the menu', () => {
    const all = sheetStyles(sheet);
    expect(all.slice(0, 3).map((s) => s.key)).toEqual(['c-letter', 'heading1', 'normal']);
    expect(all.find((s) => s.key === 'epigraph')?.inMenu).toBe(false);
    expect(all.find((s) => s.key === 'c-letter')).toMatchObject({ name: 'Letter', type: 'paragraph', style: 'c-letter', inMenu: true, custom: true });
  });

  it('know a block in a style of its own, and fall back when the style is gone', () => {
    expect(blockStyleKey(sheet, { type: 'paragraph', style: 'c-letter' })).toBe('c-letter');
    expect(blockStyleKey(sheet, { type: 'paragraph', style: 'c-gone' })).toBe('normal');
    expect(styleDefFor(sheet, 'c-letter').italic).toBe(true);
  });

  it('make a key unlike any other, and CSS for the style', () => {
    expect(customStyleId('Letter', sheet)).toBe('c-letter-2');
    expect(customStyleId('Pull Quote!', sheet)).toBe('c-pull-quote');
    expect(sheetCss(sheet, '.s', () => 'serif')).toContain(".s .blk[data-style='c-letter'] { font-family: var(--note-font, inherit);");
  });
});
