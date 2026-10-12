// Citations and a bibliography, like Word's: sources kept in one list (Word's
// Master List, shared by every note and project), cited in the text as a
// field ({{cite:key}}), and written in APA, MLA or Chicago (author-date)
// style, in the text and in the bibliography.

export type SourceType = 'book' | 'article' | 'web' | 'chapter';
export type CiteStyle = 'apa' | 'mla' | 'chicago';

export interface Source {
  /** What it's cited by in the text (made from the first author and year). */
  key: string;
  type: SourceType;
  /** People, one per line or parted by semicolons, as "Last, First" (or one name, for an organisation). */
  authors: string;
  year?: string;
  title: string;
  /** A book's publisher and city; a chapter's book and editors. */
  publisher?: string;
  city?: string;
  /** A journal's (or a website's, or a book's for a chapter) name, volume, issue and pages. */
  container?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  /** When a web page was read, as yyyy-mm-dd. */
  accessed?: string;
}

export const SOURCE_TYPES: [SourceType, string][] = [
  ['book', 'Book'],
  ['chapter', 'Chapter in a book'],
  ['article', 'Journal article'],
  ['web', 'Web page'],
];

export const CITE_STYLES: [CiteStyle, string][] = [
  ['apa', 'APA (7th)'],
  ['mla', 'MLA (9th)'],
  ['chicago', 'Chicago (author-date)'],
];

interface Name {
  last: string;
  first: string;
}

/** The people, as last and first names. */
export function people(authors: string): Name[] {
  return authors
    .split(/\s*[;\n]\s*/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      if (a.includes(',')) {
        const [last, ...rest] = a.split(',');
        return { last: last.trim(), first: rest.join(',').trim() };
      }
      // "First Last" (an organisation of several words stays whole if it has no comma… but most names are two words).
      const parts = a.split(/\s+/);
      return parts.length === 1 ? { last: a, first: '' } : { last: parts[parts.length - 1], first: parts.slice(0, -1).join(' ') };
    });
}

const initials = (first: string) =>
  first
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => `${w[0].toUpperCase()}.`)
    .join(' ');

/** A key for a new source: the first author's last name and the year (with a, b… when it's taken). */
export function sourceKey(s: Pick<Source, 'authors' | 'year' | 'title'>, taken: string[]): string {
  const who = people(s.authors)[0]?.last || s.title.split(/\s+/)[0] || 'source';
  const base = `${who.normalize('NFKD').replace(/[^A-Za-z0-9]/g, '')}${(s.year ?? '').replace(/\D/g, '')}` || 'source';
  if (!taken.includes(base)) return base;
  for (let i = 0; i < 26; i++) if (!taken.includes(base + String.fromCharCode(97 + i))) return base + String.fromCharCode(97 + i);
  return `${base}${Date.now() % 1000}`;
}

/** The names in the text: "Quinn", "Quinn & Hale" (APA) or "Quinn and Hale", "Quinn et al.". */
function textNames(authors: Name[], style: CiteStyle, fallback: string): string {
  if (!authors.length) return fallback;
  if (authors.length === 1) return authors[0].last;
  if (authors.length === 2) return `${authors[0].last} ${style === 'apa' ? '&' : 'and'} ${authors[1].last}`;
  if (style === 'chicago' && authors.length === 3) return `${authors[0].last}, ${authors[1].last}, and ${authors[2].last}`;
  return `${authors[0].last} et al.`;
}

/** A citation in the text: (Quinn, 2021) in APA, (Quinn) in MLA, (Quinn 2021) in Chicago; `page` after it when given. */
export function inText(s: Source, style: CiteStyle, page?: string): string {
  const names = textNames(people(s.authors), style, `“${s.title}”`);
  const year = s.year || 'n.d.';
  if (style === 'mla') return `(${names}${page ? ` ${page}` : ''})`;
  if (style === 'apa') return `(${names}, ${year}${page ? `, p. ${page}` : ''})`;
  return `(${names} ${year}${page ? `, ${page}` : ''})`;
}

/** The names in the bibliography, as each style writes them. */
function listNames(authors: Name[], style: CiteStyle): string {
  if (!authors.length) return '';
  if (style === 'apa') {
    const one = (n: Name) => (n.first ? `${n.last}, ${initials(n.first)}` : n.last);
    if (authors.length === 1) return one(authors[0]);
    if (authors.length <= 20) return `${authors.slice(0, -1).map(one).join(', ')}, & ${one(authors[authors.length - 1])}`;
    return `${authors.slice(0, 19).map(one).join(', ')}, … ${one(authors[authors.length - 1])}`;
  }
  const first = (n: Name) => (n.first ? `${n.last}, ${n.first}` : n.last);
  const rest = (n: Name) => (n.first ? `${n.first} ${n.last}` : n.last);
  if (style === 'mla') {
    if (authors.length === 1) return first(authors[0]);
    if (authors.length === 2) return `${first(authors[0])}, and ${rest(authors[1])}`;
    return `${first(authors[0])}, et al.`;
  }
  if (authors.length === 1) return first(authors[0]);
  if (authors.length <= 10) return `${first(authors[0])}, ${authors.slice(1, -1).map(rest).join(', ')}${authors.length > 2 ? ',' : ''} and ${rest(authors[authors.length - 1])}`;
  return `${first(authors[0])}, ${authors.slice(1, 7).map(rest).join(', ')}, et al.`;
}

const end = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);

/** The source's line in the bibliography, in the citation style. */
export function listEntry(s: Source, style: CiteStyle): string {
  const names = listNames(people(s.authors), style);
  const year = s.year || 'n.d.';
  const vol = s.volume ? (s.issue ? `${s.volume}(${s.issue})` : s.volume) : '';
  const parts: string[] = [];
  if (style === 'apa') {
    parts.push(names ? `${end(names)} (${year}).` : `${end(s.title)} (${year}).`);
    if (names) parts.push(end(s.title));
    if (s.type === 'article') parts.push(`${[s.container, vol].filter(Boolean).join(', ')}${s.pages ? `, ${s.pages}` : ''}.`);
    else if (s.type === 'chapter') parts.push(`In ${s.container ?? ''}${s.pages ? ` (pp. ${s.pages})` : ''}.${s.publisher ? ` ${end(s.publisher)}` : ''}`);
    else if (s.type === 'web') {
      if (s.container) parts.push(end(s.container));
    } else if (s.publisher) parts.push(end(s.publisher));
    if (s.url) parts.push(s.url);
  } else if (style === 'mla') {
    if (names) parts.push(end(names));
    const quoted = s.type === 'book' ? end(s.title) : `“${end(s.title)}”`;
    parts.push(quoted);
    if (s.type === 'article') parts.push(`${[s.container, s.volume ? `vol. ${s.volume}` : '', s.issue ? `no. ${s.issue}` : '', s.year, s.pages ? `pp. ${s.pages}` : ''].filter(Boolean).join(', ')}.`);
    else if (s.type === 'chapter') parts.push(`${[s.container, s.publisher, s.year, s.pages ? `pp. ${s.pages}` : ''].filter(Boolean).join(', ')}.`);
    else if (s.type === 'web') parts.push(`${[s.container, s.year, s.url].filter(Boolean).join(', ')}.`);
    else parts.push(`${[s.publisher, s.year].filter(Boolean).join(', ')}.`);
    if (s.type === 'web' && s.accessed) parts.push(`Accessed ${new Date(`${s.accessed}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`);
  } else {
    parts.push(names ? `${end(names)} ${year}.` : `${end(s.title)} ${year}.`);
    if (names) parts.push(s.type === 'book' ? end(s.title) : `“${end(s.title)}”`);
    if (s.type === 'article') parts.push(`${[s.container, vol].filter(Boolean).join(' ')}${s.pages ? `: ${s.pages}` : ''}.`);
    else if (s.type === 'chapter') parts.push(`In ${s.container ?? ''}${s.pages ? `, ${s.pages}` : ''}.${s.city || s.publisher ? ` ${[s.city, s.publisher].filter(Boolean).join(': ')}.` : ''}`);
    else if (s.type === 'web') {
      if (s.container) parts.push(end(s.container));
      if (s.url) parts.push(s.url);
    } else if (s.city || s.publisher) parts.push(`${[s.city, s.publisher].filter(Boolean).join(': ')}.`);
  }
  return parts.join(' ').replace(/\s+/g, ' ').replace(/\.\./g, '.').trim();
}

/** A bibliography: the sources cited, as lines in the style, A to Z by author. */
export function bibliography(sources: Source[], keys: string[], style: CiteStyle): string[] {
  return keys
    .map((k) => sources.find((s) => s.key === k))
    .filter((s): s is Source => !!s)
    .map((s) => listEntry(s, style))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
