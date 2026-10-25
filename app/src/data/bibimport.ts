// Sources from a reference manager (Zotero, Mendeley, EndNote, JabRef...):
// BibTeX (.bib), RIS (.ris) or CSL JSON (.json), as they export them, read
// into Crumpet's sources for citations. Each keeps its citation key where the
// file has one, and sources already in the list aren't added twice.

import { type Source, type SourceType, sourceKey } from './citations';

export type BibFormat = 'bibtex' | 'ris' | 'csl';

/** Which format a file's text is in (null when it's none of them). */
export function bibFormat(text: string): BibFormat | null {
  const t = text.trim();
  if (t.startsWith('[') || t.startsWith('{')) return 'csl';
  if (/^TY {2}- /m.test(t)) return 'ris';
  if (/@\w+\s*[{(]/.test(t)) return 'bibtex';
  return null;
}

/** The sources in a file's text, keyed so as not to clash with `taken` (or each other). */
export function readSources(text: string, taken: string[] = []): Source[] {
  const format = bibFormat(text);
  const raw = format === 'bibtex' ? fromBibtex(text) : format === 'ris' ? fromRis(text) : format === 'csl' ? fromCsl(text) : [];
  const keys = [...taken];
  return raw
    .filter((s) => s.title || s.authors)
    .map(({ key, ...s }) => {
      const k = key && /^[A-Za-z][\w:.-]*$/.test(key) && !keys.includes(key) ? key : sourceKey(s, keys);
      keys.push(k);
      return { key: k, ...s };
    });
}

/** The same work: the same title (ignoring case and punctuation) and year. */
export function sameSource(a: Source, b: Source): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return norm(a.title) === norm(b.title) && (a.year ?? '') === (b.year ?? '');
}

/** Sources from a file added to a list: new ones only, and how many were already there. */
export function addSources(list: Source[], text: string): { sources: Source[]; added: number; already: number } {
  const found = readSources(text, list.map((s) => s.key));
  const fresh = found.filter((s, i) => !list.some((x) => sameSource(x, s)) && !found.slice(0, i).some((x) => sameSource(x, s)));
  return { sources: [...list, ...fresh], added: fresh.length, already: found.length - fresh.length };
}

type Raw = Omit<Source, 'key'> & { key?: string };

const clean = (o: Raw): Raw => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Raw;

// ---------------------------------------------------------------- BibTeX

const ACCENTS: Record<string, Record<string, string>> = {
  "'": { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', y: 'ý', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', c: 'ć', n: 'ń', s: 'ś', z: 'ź' },
  '`': { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù', A: 'À', E: 'È', O: 'Ò' },
  '"': { a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü', A: 'Ä', E: 'Ë', O: 'Ö', U: 'Ü', y: 'ÿ' },
  '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û', A: 'Â', E: 'Ê', O: 'Ô' },
  '~': { a: 'ã', n: 'ñ', o: 'õ', A: 'Ã', N: 'Ñ', O: 'Õ' },
  c: { c: 'ç', C: 'Ç', s: 'ş' },
  v: { c: 'č', s: 'š', z: 'ž', r: 'ř', e: 'ě', C: 'Č', S: 'Š', Z: 'Ž' },
};

/** LaTeX in a field as plain text: accents, escaped characters, dashes, and braces gone. */
export function latexText(s: string): string {
  return s
    .replace(/\\([`'"^~cv])\s*\{?\\?([A-Za-z])\}?/g, (_m, acc: string, ch: string) => ACCENTS[acc]?.[ch] ?? ch)
    .replace(/\\ss\b\{?\}?/g, 'ß')
    .replace(/\\(?:o|O)\b\{?\}?/g, (m) => (m.includes('O') ? 'Ø' : 'ø'))
    .replace(/\\(?:aa|AA)\b\{?\}?/g, (m) => (m.includes('AA') ? 'Å' : 'å'))
    .replace(/\\([&%$#_{}])/g, '$1')
    .replace(/\\textit\{([^}]*)\}|\\emph\{([^}]*)\}|\\textbf\{([^}]*)\}/g, (_m, a, b, c) => a ?? b ?? c ?? '')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/~/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Austen, Jane and Charles Dickens" as "Austen, Jane; Dickens, Charles". */
function bibAuthors(s: string): string {
  return s
    .split(/\s+and\s+/)
    .map((a) => latexText(a))
    .filter(Boolean)
    .map((a) => {
      if (a.includes(',') || !a.includes(' ')) return a;
      const parts = a.split(' ');
      return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
    })
    .join('; ');
}

/** The entries of a .bib file: type, key and fields (names in lower case, values as written). */
export function bibEntries(text: string): { type: string; key: string; fields: Record<string, string> }[] {
  const out: { type: string; key: string; fields: Record<string, string> }[] = [];
  const re = /@(\w+)\s*([{(])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const type = m[1].toLowerCase();
    const close = m[2] === '{' ? '}' : ')';
    let i = re.lastIndex;
    if (type === 'comment' || type === 'preamble' || type === 'string') continue;
    const keyEnd = text.indexOf(',', i);
    if (keyEnd < 0) break;
    const key = text.slice(i, keyEnd).trim();
    i = keyEnd + 1;
    const fields: Record<string, string> = {};
    while (i < text.length) {
      while (/[\s,]/.test(text[i] ?? '')) i++;
      if (text[i] === close || i >= text.length) break;
      const name = /^([\w-]+)\s*=\s*/.exec(text.slice(i));
      if (!name) break;
      i += name[0].length;
      let value = '';
      if (text[i] === '{') {
        let depth = 0;
        const start = i;
        for (; i < text.length; i++) {
          if (text[i] === '{' && text[i - 1] !== '\\') depth++;
          else if (text[i] === '}' && text[i - 1] !== '\\' && --depth === 0) break;
        }
        value = text.slice(start + 1, i);
        i++;
      } else if (text[i] === '"') {
        const start = ++i;
        while (i < text.length && !(text[i] === '"' && text[i - 1] !== '\\')) i++;
        value = text.slice(start, i);
        i++;
      } else {
        const bare = /^[^,}\s)]+/.exec(text.slice(i));
        value = bare?.[0] ?? '';
        i += value.length;
      }
      fields[name[1].toLowerCase()] = value;
    }
    re.lastIndex = i;
    out.push({ type, key, fields });
  }
  return out;
}

function fromBibtex(text: string): Raw[] {
  return bibEntries(text).map(({ type, key, fields: f }) => {
    const t: SourceType = type === 'article' ? 'article' : type === 'incollection' || type === 'inbook' || type === 'inproceedings' ? 'chapter' : (type === 'online' || type === 'misc' || type === 'electronic' || type === 'webpage') && f.url ? 'web' : 'book';
    const field = (k: string) => (f[k] ? latexText(f[k]) : undefined);
    return clean({
      key,
      type: t,
      authors: f.author ? bibAuthors(f.author) : f.editor ? bibAuthors(f.editor) : '',
      year: field('year') ?? field('date')?.slice(0, 4),
      title: field('title') ?? '',
      publisher: field('publisher') ?? field('institution') ?? field('organization'),
      city: field('address') ?? field('location'),
      container: field('journal') ?? field('journaltitle') ?? field('booktitle'),
      volume: field('volume'),
      issue: field('number') ?? field('issue'),
      pages: field('pages'),
      url: f.url?.trim() || (f.doi ? `https://doi.org/${f.doi.trim()}` : undefined),
      accessed: field('urldate')?.slice(0, 10),
    });
  });
}

// ---------------------------------------------------------------- RIS

const RIS_TYPES: Record<string, SourceType> = { JOUR: 'article', JFULL: 'article', MGZN: 'article', NEWS: 'article', BOOK: 'book', CHAP: 'chapter', ELEC: 'web', WEB: 'web', BLOG: 'web' };

function fromRis(text: string): Raw[] {
  const out: Raw[] = [];
  let cur: Record<string, string[]> | null = null;
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9])\s{2}-\s?(.*)$/.exec(line);
    if (!m) continue;
    const [, tag, value] = m;
    if (tag === 'TY') cur = { TY: [value.trim()] };
    else if (tag === 'ER' && cur) {
      const one = (...tags: string[]) => tags.map((t) => cur![t]?.[0]?.trim()).find(Boolean);
      const pages = [one('SP'), one('EP')].filter(Boolean).join('–');
      out.push(
        clean({
          key: one('ID'),
          type: RIS_TYPES[cur.TY[0]] ?? 'book',
          authors: [...(cur.AU ?? []), ...(cur.A1 ?? [])].map((a) => a.trim()).filter(Boolean).join('; '),
          year: one('PY', 'Y1', 'DA')?.match(/\d{4}/)?.[0],
          title: one('TI', 'T1') ?? '',
          publisher: one('PB'),
          city: one('CY'),
          container: one('T2', 'JO', 'JF', 'JA', 'BT'),
          volume: one('VL'),
          issue: one('IS'),
          pages: pages || undefined,
          url: one('UR') ?? (one('DO') ? `https://doi.org/${one('DO')}` : undefined),
          accessed: one('Y2')?.replace(/\//g, '-').slice(0, 10),
        }),
      );
      cur = null;
    } else if (cur) (cur[tag] ??= []).push(value);
  }
  return out;
}

// ---------------------------------------------------------------- CSL JSON

interface CslName {
  family?: string;
  given?: string;
  literal?: string;
}
interface CslItem {
  id?: string | number;
  'citation-key'?: string;
  type?: string;
  title?: string;
  author?: CslName[];
  editor?: CslName[];
  issued?: { 'date-parts'?: (number | string)[][]; raw?: string };
  accessed?: { 'date-parts'?: (number | string)[][] };
  'container-title'?: string;
  volume?: string | number;
  issue?: string | number;
  page?: string;
  publisher?: string;
  'publisher-place'?: string;
  URL?: string;
  DOI?: string;
}

const CSL_TYPES: Record<string, SourceType> = { 'article-journal': 'article', 'article-magazine': 'article', 'article-newspaper': 'article', article: 'article', book: 'book', chapter: 'chapter', 'paper-conference': 'chapter', webpage: 'web', 'post-weblog': 'web', post: 'web' };

function fromCsl(text: string): Raw[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const items = (Array.isArray(data) ? data : [data]) as CslItem[];
  const names = (list?: CslName[]) => (list ?? []).map((n) => n.literal ?? [n.family, n.given].filter(Boolean).join(', ')).filter(Boolean).join('; ');
  const day = (d?: { 'date-parts'?: (number | string)[][] }) => {
    const p = d?.['date-parts']?.[0];
    return p?.length ? p.map((x, i) => (i ? String(x).padStart(2, '0') : String(x))).join('-') : undefined;
  };
  return items
    .filter((x) => x && typeof x === 'object')
    .map((x) =>
      clean({
        key: x['citation-key'] ?? (typeof x.id === 'string' ? x.id : undefined),
        type: CSL_TYPES[x.type ?? ''] ?? 'book',
        authors: names(x.author) || names(x.editor),
        year: day(x.issued)?.slice(0, 4) ?? x.issued?.raw?.match(/\d{4}/)?.[0],
        title: x.title ?? '',
        publisher: x.publisher,
        city: x['publisher-place'],
        container: x['container-title'],
        volume: x.volume !== undefined ? String(x.volume) : undefined,
        issue: x.issue !== undefined ? String(x.issue) : undefined,
        pages: x.page?.replace(/-/g, '–'),
        url: x.URL ?? (x.DOI ? `https://doi.org/${x.DOI}` : undefined),
        accessed: day(x.accessed),
      }),
    );
}
