import { describe, expect, it } from 'vitest';
import { addSources, bibFormat, latexText, readSources } from '../../src/data/bibimport';

const BIB = `% Exported from Zotero
@article{woolf1925,
  author = {Woolf, Virginia and E. M. Forster},
  title = {{Modern} Fiction: an Essay on {Br\\"{o}nte}},
  journal = "The Times Literary Supplement",
  year = 1925,
  volume = {12}, number = {3},
  pages = {10--15},
  doi = {10.1000/xyz}
}
@book{austen_pride_1813,
  author = {Austen, Jane},
  title = {Pride and Prejudice},
  publisher = {T. Egerton},
  address = {London},
  date = {1813-01-28}
}
@incollection{eliot1920,
  author = {Eliot, T. S.},
  title = {Tradition and the Individual Talent},
  booktitle = {The Sacred Wood},
  publisher = {Methuen},
  year = {1920}
}
@online{bbc,
  title = {Writing Tips \\& Tricks},
  url = {https://example.com/tips},
  urldate = {2026-10-01},
  year = {2024}
}`;

const RIS = `TY  - JOUR
AU  - Smith, Zadie
AU  - Wood, James
TI  - Two Paths for the Novel
JO  - New York Review of Books
PY  - 2008///
VL  - 55
IS  - 18
SP  - 40
EP  - 44
ER  -
TY  - BOOK
AU  - Morrison, Toni
TI  - Beloved
PB  - Knopf
CY  - New York
PY  - 1987
ER  - `;

const CSL = JSON.stringify([
  { id: 'http://zotero.org/1', 'citation-key': 'hemingway1952', type: 'book', title: 'The Old Man and the Sea', author: [{ family: 'Hemingway', given: 'Ernest' }], issued: { 'date-parts': [[1952]] }, publisher: 'Scribner' },
  { id: 2, type: 'webpage', title: 'Style Guide', author: [{ literal: 'The Guardian' }], URL: 'https://example.com/style', accessed: { 'date-parts': [[2026, 9, 3]] }, issued: { 'date-parts': [[2020, 1]] } },
]);

describe('importing sources', () => {
  it('knows the formats', () => {
    expect(bibFormat(BIB)).toBe('bibtex');
    expect(bibFormat(RIS)).toBe('ris');
    expect(bibFormat(CSL)).toBe('csl');
    expect(bibFormat('Just some notes')).toBeNull();
  });

  it('reads BibTeX: types, people, LaTeX and keys', () => {
    const s = readSources(BIB);
    expect(s.map((x) => [x.key, x.type])).toEqual([
      ['woolf1925', 'article'],
      ['austen_pride_1813', 'book'],
      ['eliot1920', 'chapter'],
      ['bbc', 'web'],
    ]);
    expect(s[0]).toMatchObject({ authors: 'Woolf, Virginia; Forster, E. M.', title: 'Modern Fiction: an Essay on Brönte', container: 'The Times Literary Supplement', year: '1925', volume: '12', issue: '3', pages: '10–15', url: 'https://doi.org/10.1000/xyz' });
    expect(s[1]).toMatchObject({ year: '1813', publisher: 'T. Egerton', city: 'London' });
    expect(s[2]).toMatchObject({ container: 'The Sacred Wood', publisher: 'Methuen' });
    expect(s[3]).toMatchObject({ title: 'Writing Tips & Tricks', url: 'https://example.com/tips', accessed: '2026-10-01' });
    expect(latexText("Caf\\'e ---  na\\\"ive")).toBe('Café — naïve');
  });

  it('reads RIS and CSL JSON, making keys where there are none', () => {
    const r = readSources(RIS);
    expect(r[0]).toMatchObject({ key: 'Smith2008', type: 'article', authors: 'Smith, Zadie; Wood, James', container: 'New York Review of Books', pages: '40–44', volume: '55', issue: '18' });
    expect(r[1]).toMatchObject({ key: 'Morrison1987', type: 'book', publisher: 'Knopf', city: 'New York' });
    const c = readSources(CSL);
    expect(c[0]).toMatchObject({ key: 'hemingway1952', authors: 'Hemingway, Ernest', year: '1952', publisher: 'Scribner' });
    expect(c[1]).toMatchObject({ key: 'Guardian2020', type: 'web', authors: 'The Guardian', accessed: '2026-09-03', url: 'https://example.com/style' });
  });

  it('adds only new sources, and keys never clash', () => {
    const first = addSources([], RIS);
    expect(first).toMatchObject({ added: 2, already: 0 });
    const again = addSources(first.sources, RIS);
    expect(again).toMatchObject({ added: 0, already: 2 });
    const other = addSources(first.sources, 'TY  - BOOK\nAU  - Smith, Ali\nTI  - Autumn\nPY  - 2008\nER  - ');
    expect(other.sources.map((s) => s.key)).toEqual(['Smith2008', 'Morrison1987', 'Smith2008a']);
  });

  it('reads Zotero’s own BibTeX and EndNote’s RIS as they come', () => {
    const zotero = `
@book{austen_pride_1813,
	address = {London},
	title = {Pride and {Prejudice}},
	publisher = {T. Egerton},
	author = {Austen, Jane},
	year = {1813},
}

@article{woolf_modern_1925,
	title = {Modern {Fiction}},
	volume = {12},
	url = {https://example.org/woolf},
	urldate = {2024-01-03},
	journal = {The Times Literary Supplement},
	author = {Woolf, Virginia and Bell, Vanessa},
	month = apr,
	year = {1925},
	pages = {10--15},
	file = {Full Text:/Users/x/Zotero/storage/ABC/woolf.pdf:application/pdf},
}
`;
    expect(readSources(zotero)).toMatchObject([
      { key: 'austen_pride_1813', type: 'book', authors: 'Austen, Jane', year: '1813', title: 'Pride and Prejudice', publisher: 'T. Egerton', city: 'London' },
      { key: 'woolf_modern_1925', type: 'article', authors: 'Woolf, Virginia; Bell, Vanessa', year: '1925', title: 'Modern Fiction', container: 'The Times Literary Supplement', volume: '12', pages: '10–15', url: 'https://example.org/woolf' },
    ]);
    const endnote = 'TY  - JOUR\r\nAU  - Woolf, Virginia\r\nTI  - Modern Fiction\r\nT2  - The Times Literary Supplement\r\nPY  - 1925/04//\r\nSP  - 10\r\nEP  - 15\r\nDO  - 10.1000/xyz\r\nER  - \r\n';
    expect(readSources(endnote)).toMatchObject([{ type: 'article', authors: 'Woolf, Virginia', year: '1925', title: 'Modern Fiction', container: 'The Times Literary Supplement', pages: '10–15', url: 'https://doi.org/10.1000/xyz' }]);
  });
});
