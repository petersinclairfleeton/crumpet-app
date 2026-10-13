import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { accessibility, clarity, compatibility, contrast, inclusive, inspect, wordsToSpell } from '../../src/data/checks';
import { misspellings } from '../../src/data/spell';

describe('checking a document', () => {
  it('finds accessibility problems: no alt text, a skipped heading level, pale text, unclear links', () => {
    const doc = fromMarkdown('# Title\n\n### Too deep\n\n![](Attachments/a.png)\n\n[Pale]{color=#eeeeee} words and [click here](https://example.com).\n');
    const titles = accessibility(doc).map((i) => i.title);
    expect(titles).toEqual(expect.arrayContaining(['Heading 3 after Heading 1', 'Picture without alt text', 'Hard-to-read text colour', 'Unclear link text']));
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('lists what Word won’t keep', () => {
    const doc = fromMarkdown('A [[Other note]] link.\n\n```math\nE = mc^2\n```\n\n> Note text {.note}\n');
    const titles = compatibility(doc).map((i) => i.title);
    expect(titles).toEqual(expect.arrayContaining(['Link to a note', 'Maths', 'Callout']));
  });

  it('inspects comments, changes, people and hidden text', () => {
    const doc = fromMarkdown('Some {==text==}{>>Ann (2026-01-01 09:30Z): Check this<<} and {++added++} and [secret]{hidden=1}.\n');
    const r = inspect(doc);
    expect(r.comments).toBe(1);
    expect(r.changes).toBe(1);
    expect(r.people).toContain('Ann');
    expect(r.hiddenText).toBe(1);
  });

  it('suggests plainer words and inclusive ones, keeping a capital', () => {
    const doc = fromMarkdown('In order to win, the chairman spoke. Mankind waited due to the fact that it rained.\n');
    expect(clarity(doc).map((i) => i.fix)).toEqual(['To', 'because']);
    expect(inclusive(doc).map((i) => i.fix)).toEqual(['chair', 'Humanity']);
    const i = clarity(doc)[0];
    expect(doc.blocks[0].runs.map((r) => r.text).join('').slice(i.from, i.to)).toBe('In order to');
  });

  it('checks spelling with British English, the person’s own words, and suggestions', async () => {
    const doc = fromMarkdown('The colour of the lighthuose was grey. Crumpet is a word of mine.\n');
    const found = await misspellings(wordsToSpell(doc), 'en-GB', ['Crumpet']);
    expect(found.map((f) => f.word)).toEqual(['lighthuose']);
    expect(found[0].suggestions).toContain('lighthouse');
    const us = await misspellings(wordsToSpell(doc), 'en-US', ['Crumpet']);
    expect(us.map((f) => f.word)).toEqual(expect.arrayContaining(['colour']));
  }, 30000);
});
