import { describe, expect, it } from 'vitest';
import { type Source, bibliography, inText, listEntry, people, sourceKey } from '../../src/data/citations';

const book: Source = { key: 'Quinn2021', type: 'book', authors: 'Quinn, Mara Jane; Hale, Tom', year: '2021', title: 'The Lighthouse Keepers', publisher: 'Harbour Press', city: 'Bristol' };
const article: Source = { key: 'Hale2019', type: 'article', authors: 'Tom Hale', year: '2019', title: 'Lamps at sea', container: 'Maritime History', volume: '12', issue: '3', pages: '45–67' };
const web: Source = { key: 'Trust', type: 'web', authors: 'Lighthouse Trust', title: 'Our lights', container: 'Lighthouse Trust', url: 'https://example.org/lights', accessed: '2026-10-01' };

describe('citations', () => {
  it('reads people', () => {
    expect(people('Quinn, Mara; Tom Hale')).toEqual([
      { last: 'Quinn', first: 'Mara' },
      { last: 'Hale', first: 'Tom' },
    ]);
    expect(sourceKey(book, ['Quinn2021'])).toBe('Quinn2021a');
  });

  it('cites in the text in each style', () => {
    expect(inText(book, 'apa')).toBe('(Quinn & Hale, 2021)');
    expect(inText(book, 'mla', '12')).toBe('(Quinn and Hale 12)');
    expect(inText(article, 'chicago')).toBe('(Hale 2019)');
    expect(inText(web, 'apa')).toBe('(Trust, n.d.)');
  });

  it('writes each source in the bibliography in each style', () => {
    expect(listEntry(book, 'apa')).toBe('Quinn, M. J., & Hale, T. (2021). The Lighthouse Keepers. Harbour Press.');
    expect(listEntry(book, 'mla')).toBe('Quinn, Mara Jane, and Tom Hale. The Lighthouse Keepers. Harbour Press, 2021.');
    expect(listEntry(book, 'chicago')).toBe('Quinn, Mara Jane, and Tom Hale. 2021. The Lighthouse Keepers. Bristol: Harbour Press.');
    expect(listEntry(article, 'apa')).toBe('Hale, T. (2019). Lamps at sea. Maritime History, 12(3), 45–67.');
    expect(listEntry(article, 'mla')).toBe('Hale, Tom. “Lamps at sea.” Maritime History, vol. 12, no. 3, 2019, pp. 45–67.');
    expect(listEntry(article, 'chicago')).toBe('Hale, Tom. 2019. “Lamps at sea.” Maritime History 12(3): 45–67.');
    expect(bibliography([book, article, web], ['Quinn2021', 'Hale2019', 'nope'], 'apa').map((l) => l.slice(0, 5))).toEqual(['Hale,', 'Quinn']);
  });
});
