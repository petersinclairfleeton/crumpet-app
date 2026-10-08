// Thesaurus and definitions, like Word's: synonyms from Datamuse and
// definitions from the Free Dictionary API (both free, no account; only the
// word looked up is sent). Answers are remembered for the session.

export interface Sense {
  /** noun, verb, adjective... */
  pos: string;
  definition: string;
  example?: string;
}

export interface LookUp {
  word: string;
  senses: Sense[];
  synonyms: string[];
  /** Words with a similar meaning, when there are few true synonyms. */
  similar: string[];
  antonyms: string[];
}

const cache = new Map<string, Promise<LookUp>>();

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

type DictEntry = { meanings?: { partOfSpeech?: string; definitions?: { definition?: string; example?: string; synonyms?: string[]; antonyms?: string[] }[]; synonyms?: string[]; antonyms?: string[] }[] };

/** Looks a word up; rejects when offline (both services unreachable). */
export function lookUp(raw: string): Promise<LookUp> {
  const word = raw.trim().toLowerCase();
  const hit = cache.get(word);
  if (hit) return hit;
  const job = (async () => {
    const q = encodeURIComponent(word);
    const [dict, syn, ml, ant] = await Promise.all([
      json<DictEntry[]>(`https://api.dictionaryapi.dev/api/v2/entries/en/${q}`),
      json<{ word: string }[]>(`https://api.datamuse.com/words?rel_syn=${q}&max=30`),
      json<{ word: string }[]>(`https://api.datamuse.com/words?ml=${q}&max=20`),
      json<{ word: string }[]>(`https://api.datamuse.com/words?rel_ant=${q}&max=10`),
    ]);
    if (dict === null && syn === null && ml === null) throw new Error('offline');
    return tidyLookUp(word, dict ?? [], syn ?? [], ml ?? [], ant ?? []);
  })();
  cache.set(word, job);
  job.catch(() => cache.delete(word));
  return job;
}

/** The answers put together: definitions by part of speech, synonyms without repeats. */
export function tidyLookUp(word: string, dict: DictEntry[], syn: { word: string }[], ml: { word: string }[], ant: { word: string }[]): LookUp {
  const senses: Sense[] = [];
  const fromDict: string[] = [];
  const antonyms: string[] = [];
  for (const e of dict) {
    for (const m of e.meanings ?? []) {
      fromDict.push(...(m.synonyms ?? []));
      antonyms.push(...(m.antonyms ?? []));
      for (const d of (m.definitions ?? []).slice(0, 3)) {
        if (d.definition) senses.push({ pos: m.partOfSpeech ?? '', definition: d.definition, ...(d.example ? { example: d.example } : {}) });
        fromDict.push(...(d.synonyms ?? []));
        antonyms.push(...(d.antonyms ?? []));
      }
    }
  }
  const uniq = (xs: string[], not: Set<string> = new Set()) => {
    const seen = new Set<string>([word, ...not]);
    return xs.filter((x) => x && !x.includes('_') && !seen.has(x.toLowerCase()) && (seen.add(x.toLowerCase()), true));
  };
  const synonyms = uniq([...syn.map((s) => s.word), ...fromDict]).slice(0, 30);
  const similar = uniq(ml.map((s) => s.word), new Set(synonyms.map((s) => s.toLowerCase()))).slice(0, 15);
  return { word, senses: senses.slice(0, 8), synonyms, similar, antonyms: uniq([...ant.map((a) => a.word), ...antonyms]).slice(0, 10) };
}

/** A replacement word in the same case as the word it replaces. */
export function matchCase(original: string, word: string): string {
  if (original.length > 1 && original === original.toUpperCase()) return word.toUpperCase();
  if (original[0] && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) return word[0].toUpperCase() + word.slice(1);
  return word;
}
