// The spelling pass's dictionary: Hunspell's English word lists (British or
// American) read by nspell, fetched only when a spelling check starts.

export interface Speller {
  correct(word: string): boolean;
  suggest(word: string): string[];
}

const engines = new Map<string, Promise<Speller>>();

/** The speller for a language ('en-GB' unless it's American English). */
export function speller(lang = 'en-GB'): Promise<Speller> {
  const us = /^en-US$/i.test(lang);
  const key = us ? 'us' : 'gb';
  let job = engines.get(key);
  if (!job) {
    job = (async () => {
      const [{ default: nspell }, aff, dic] = await Promise.all([
        import('nspell'),
        us ? import('../../node_modules/dictionary-en/index.aff?raw') : import('../../node_modules/dictionary-en-gb/index.aff?raw'),
        us ? import('../../node_modules/dictionary-en/index.dic?raw') : import('../../node_modules/dictionary-en-gb/index.dic?raw'),
      ]);
      return nspell(aff.default, dic.default) as Speller;
    })();
    engines.set(key, job);
    job.catch(() => engines.delete(key));
  }
  return job;
}

/** Misspelt words, once each, with their places and suggestions (words in `known` are fine, in any case). */
export async function misspellings(words: { block: string; from: number; to: number; word: string }[], lang: string | undefined, known: string[]): Promise<{ word: string; places: { block: string; from: number; to: number }[]; suggestions: string[] }[]> {
  const sp = await speller(lang);
  const ok = new Set(known.map((w) => w.toLowerCase()));
  const found = new Map<string, { word: string; places: { block: string; from: number; to: number }[]; suggestions: string[] }>();
  for (const w of words) {
    const word = w.word.replace(/’/g, "'");
    if (ok.has(word.toLowerCase())) continue;
    // Names and words in capitals at the start of a sentence are checked as written and in small letters.
    if (sp.correct(word) || sp.correct(word.toLowerCase()) || (/^[A-Z]+$/.test(word) && word.length <= 5)) continue;
    const hit = found.get(word);
    if (hit) hit.places.push(w);
    else found.set(word, { word: w.word, places: [w], suggestions: [] });
  }
  for (const f of found.values()) f.suggestions = sp.suggest(f.word.replace(/’/g, "'")).slice(0, 5);
  return [...found.values()];
}
