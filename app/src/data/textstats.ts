// Text statistics and linguistic focus, like Scrivener's: counts, how long
// sentences run, the words used most, and finding dialogue, -ly adverbs,
// filler words and (likely) passive voice to highlight.

export interface TextStats {
  words: number;
  characters: number;
  sentences: number;
  paragraphs: number;
  /** Average words per sentence. */
  perSentence: number;
  /** Minutes, at a usual reading (238 words a minute) and speaking (150) pace. */
  reading: number;
  speaking: number;
}

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

export function wordsOf(text: string): string[] {
  return text.match(WORD) ?? [];
}

/** Statistics for some text, one paragraph per item. */
export function textStats(paragraphs: string[]): TextStats {
  const paras = paragraphs.map((p) => p.trim()).filter(Boolean);
  let words = 0;
  let sentences = 0;
  let characters = 0;
  for (const p of paras) {
    words += wordsOf(p).length;
    characters += p.length;
    // A sentence ends at . ! ? or … (with any closing quotes), or at the end of the paragraph.
    const parts = p.split(/(?<=[.!?…]['"’”)\]]*)\s+(?=["'“‘(\[]*[\p{Lu}\p{N}])/u).filter((s) => wordsOf(s).length);
    sentences += parts.length;
  }
  return { words, characters, sentences, paragraphs: paras.length, perSentence: sentences ? Math.round((words / sentences) * 10) / 10 : 0, reading: Math.max(words ? 1 : 0, Math.round(words / 238)), speaking: Math.max(words ? 1 : 0, Math.round(words / 150)) };
}

/** Everyday words that say little about style, left out of the word counts. */
const COMMON = new Set(
  'a an and the of to in on at by for from with as is was were be been being am are it its it’s it\'s i me my mine we us our you your he him his she her hers they them their theirs this that these those there here what which who whom whose when where why how not no nor or but if then so than too also into onto over under up down out off about after before again all any both each few more most other some such only own same can will just do does did doing have has had having would should could may might must shall said says say one two'.split(' '),
);

/** The words used most (leaving out everyday ones), with how often. */
export function wordFrequency(paragraphs: string[], limit = 20): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of paragraphs) for (const w of wordsOf(p)) {
    const k = w.toLowerCase().replace(/’/g, "'");
    if (k.length < 3 || COMMON.has(k) || /^\d+$/.test(k)) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export type Focus = 'dialogue' | 'adverbs' | 'filler' | 'passive' | { word: string };

export const FOCUS_LABELS: Record<Exclude<Focus, { word: string }>, string> = {
  dialogue: 'Dialogue',
  adverbs: '-ly adverbs',
  filler: 'Filler words',
  passive: 'Passive voice',
};

/** Words ending in -ly that aren't adverbs. */
const NOT_ADVERBS = new Set('only family early reply holy ugly supply apply july italy fly belly rely ally bully jelly lily silly friendly lonely lovely likely daily weekly monthly yearly hourly elderly costly deadly lively ghostly orderly kindly curly hilly chilly woolly comply anomaly emily molly sally holly polly billy willy dolly folly rally tally gully bully wily oily ply sly unruly burly surly melancholy assembly butterfly dragonfly firefly'.split(' '));
const FILLER = ['just', 'really', 'very', 'quite', 'rather', 'somewhat', 'actually', 'basically', 'literally', 'totally', 'simply', 'definitely', 'certainly', 'suddenly', 'started to', 'began to', 'kind of', 'sort of', 'a bit', 'a little'];
const PARTICIPLE = '(?:\\w+ed|\\w+en|made|done|seen|known|given|taken|built|found|told|left|kept|held|brought|bought|caught|taught|thought|sent|spent|lost|won|set|put|cut|hit|shut|read|hung|led|met|paid|said|sold|struck|stuck|torn|worn|born|drawn|thrown|shown|grown|blown|flown|hidden|bitten|written|forgotten|chosen|frozen|stolen|woken|broken|spoken)';
const PASSIVE = new RegExp(`\\b(?:am|is|are|was|were|be|been|being|get|got|gets|getting)\\s+(?:\\w+ly\\s+)?${PARTICIPLE}\\b`, 'gi');

/** Where in a paragraph's text the focus finds something: [from, to) offsets. */
export function findFocus(text: string, focus: Focus): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  const all = (re: RegExp, ok: (m: RegExpExecArray) => boolean = () => true) => {
    for (const m of text.matchAll(re)) if (ok(m as RegExpExecArray)) out.push({ from: m.index!, to: m.index! + m[0].length });
  };
  if (typeof focus === 'object') {
    const w = focus.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]");
    all(new RegExp(`(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`, 'giu'));
  } else if (focus === 'dialogue') {
    // From an opening quote to its closing one, or to the end of the paragraph.
    all(/“[^”]*”?|"[^"]*"?|«[^»]*»?/g);
  } else if (focus === 'adverbs') {
    all(/\b[\p{L}]+ly\b/giu, (m) => !NOT_ADVERBS.has(m[0].toLowerCase()) && m[0].length > 4);
  } else if (focus === 'filler') {
    all(new RegExp(`\\b(?:${FILLER.map((f) => f.replace(/ /g, '\\s+')).join('|')})\\b`, 'gi'));
  } else if (focus === 'passive') {
    all(PASSIVE, (m) => !/^(?:get|got|gets|getting)\s+(?:even|seven|heaven|garden|kitten|token|often|open|oven|eleven)\b/i.test(m[0]));
  }
  return out.sort((a, b) => a.from - b.from);
}
