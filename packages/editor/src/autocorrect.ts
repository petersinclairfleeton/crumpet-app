// AutoCorrect, like Word's: while typing, straight quotes become curly ones,
// two hyphens a dash, three dots an ellipsis, (c) a ©, common typos are put
// right and a sentence starts with a capital. Each correction is a step of
// its own, so Ctrl+Z straight after it takes just the correction back.

import { type Run, getBlock, isCollapsed, runsText, sliceRuns } from './model';
import type { EditorState, Transaction } from './commands';

export interface AutoCorrectOptions {
  /** "straight" quotes → “curly” ones. */
  quotes?: boolean;
  /** word--word → word—word, and " - " → " – ". */
  dashes?: boolean;
  /** ... → … and (c) → ©, (r) → ®, (tm) → ™, -> → →, <- ← and => ⇒. */
  symbols?: boolean;
  /** Common typos put right (teh → the), from TYPOS and `words`. */
  typos?: boolean;
  /** A capital at a sentence's start, and "i" on its own as "I". */
  capitals?: boolean;
  /** Replacements of the person's own, typo → right, used with `typos`. */
  words?: Record<string, string>;
}

/** On unless turned off. */
export const AUTOCORRECT_DEFAULTS: Required<Omit<AutoCorrectOptions, 'words'>> = { quotes: true, dashes: true, symbols: true, typos: true, capitals: true };

/** Word's best-known AutoCorrect entries (in small letters; capitals are kept). */
export const TYPOS: Record<string, string> = {
  teh: 'the',
  adn: 'and',
  nad: 'and',
  taht: 'that',
  thier: 'their',
  recieve: 'receive',
  recieved: 'received',
  beleive: 'believe',
  beleived: 'believed',
  definately: 'definitely',
  seperate: 'separate',
  occured: 'occurred',
  occurence: 'occurrence',
  untill: 'until',
  wich: 'which',
  whcih: 'which',
  becuase: 'because',
  becasue: 'because',
  thsi: 'this',
  waht: 'what',
  hte: 'the',
  yuo: 'you',
  jsut: 'just',
  knwo: 'know',
  konw: 'know',
  ahve: 'have',
  hvae: 'have',
  woudl: 'would',
  coudl: 'could',
  shoudl: 'should',
  dont: 'don’t',
  doesnt: 'doesn’t',
  didnt: 'didn’t',
  cant: 'can’t',
  isnt: 'isn’t',
  wasnt: 'wasn’t',
  couldnt: 'couldn’t',
  wouldnt: 'wouldn’t',
  shouldnt: 'shouldn’t',
  im: 'I’m',
  ive: 'I’ve',
  alot: 'a lot',
  accomodate: 'accommodate',
  acheive: 'achieve',
  apparantly: 'apparently',
  arguement: 'argument',
  basicly: 'basically',
  begining: 'beginning',
  calender: 'calendar',
  comming: 'coming',
  embarass: 'embarrass',
  enviroment: 'environment',
  existance: 'existence',
  foriegn: 'foreign',
  freind: 'friend',
  goverment: 'government',
  happend: 'happened',
  harrass: 'harass',
  independant: 'independent',
  knowlege: 'knowledge',
  neccessary: 'necessary',
  noticable: 'noticeable',
  persistant: 'persistent',
  posession: 'possession',
  prefered: 'preferred',
  publically: 'publicly',
  realy: 'really',
  rember: 'remember',
  succesful: 'successful',
  suprise: 'surprise',
  tommorow: 'tomorrow',
  tomorow: 'tomorrow',
  tounge: 'tongue',
  truely: 'truly',
  wierd: 'weird',
};

/** Typed straight after these, a capital isn't wanted (e.g. "e.g. this"). */
const ABBREVIATIONS = new Set(['e.g.', 'i.e.', 'etc.', 'vs.', 'cf.', 'mr.', 'mrs.', 'ms.', 'dr.', 'st.', 'no.', 'p.', 'pp.', 'vol.', 'ch.', 'fig.', 'approx.', 'ca.', 'jr.', 'sr.', 'prof.', 'mt.']);

const SYMBOLS: [string, string][] = [
  ['...', '…'],
  ['(c)', '©'],
  ['(C)', '©'],
  ['(r)', '®'],
  ['(R)', '®'],
  ['(tm)', '™'],
  ['(TM)', '™'],
  ['->', '→'],
  ['<-', '←'],
  ['=>', '⇒'],
];

/** Characters that end a word, so the word before can be checked. */
const BOUNDARY = /[\s.,;:!?)\]}"”'’]/;
const OPENS_BEFORE = /[\s([{<—–“‘"']/;

interface Fix {
  from: number;
  to: number;
  text: string;
}

/**
 * The correction wanted after `typed` was typed (the caret is just after it),
 * or null. Corrections only apply in lines of text, never in a link; with
 * track changes on (`tracked`), only in text marked as added.
 */
export function autoCorrect(state: EditorState, typed: string, opts: AutoCorrectOptions, tracked = false): Transaction | null {
  if (!isCollapsed(state.selection) || typed.length !== 1) return null;
  const at = state.selection.focus;
  const block = getBlock(state.doc, at.block);
  if (!/^(paragraph|heading\d|quote|bullet|numbered|todo)$/.test(block.type)) return null;
  const text = runsText(block.runs);
  const before = text.slice(0, at.offset);
  if (!before.endsWith(typed)) return null;
  const fix = findFix(before, typed, { ...AUTOCORRECT_DEFAULTS, ...opts });
  if (!fix) return null;
  return replaceText(state, at.block, fix, tracked);
}

function findFix(before: string, typed: string, o: AutoCorrectOptions): Fix | null {
  const end = before.length;
  const prev = before[end - 2] ?? '';
  if (o.quotes && (typed === '"' || typed === "'")) {
    const open = !prev || OPENS_BEFORE.test(prev);
    const curly = typed === '"' ? (open ? '“' : '”') : open ? '‘' : '’';
    return { from: end - 1, to: end, text: curly };
  }
  if (o.dashes) {
    // word-- → word— as soon as the second hyphen is typed.
    if (typed === '-' && prev === '-' && /[^\s-]/.test(before[end - 3] ?? ' ')) return { from: end - 2, to: end, text: '—' };
    // " - " or " -- " between words → an en dash.
    const m = /[^\s]( --? )$/.exec(before);
    if (typed === ' ' && m) return { from: end - m[1].length + 1, to: end - 1, text: '–' };
  }
  if (o.symbols) {
    for (const [from, to] of SYMBOLS) {
      if (!before.endsWith(from)) continue;
      // "<-" waits for what comes next, so "<--" and "<-x" can still be typed; it's taken on a space.
      if (from === '<-') continue;
      if (from === '->' && before.endsWith('<->')) continue;
      return { from: end - from.length, to: end, text: to };
    }
    if (typed === ' ' && before.endsWith('<- ')) return { from: end - 3, to: end - 1, text: '←' };
  }
  if (!BOUNDARY.test(typed)) return null;
  // The word just finished.
  const word = /([\p{L}\p{N}'’.]+)$/u.exec(before.slice(0, -1))?.[1]?.replace(/^['’.]+/, '');
  if (!word) return null;
  const wordStart = end - 1 - word.length;
  if (o.typos) {
    const bare = word.replace(/[.'’]+$/, '');
    const lower = bare.toLowerCase();
    const right = o.words?.[lower] ?? o.words?.[bare] ?? TYPOS[lower];
    if (right && right !== bare && /^\p{L}+$/u.test(bare)) {
      const upper = bare[0] !== lower[0] || (o.capitals && startsSentence(before.slice(0, wordStart)));
      const cased = bare === bare.toUpperCase() && bare.length > 1 ? right.toUpperCase() : upper ? right[0].toUpperCase() + right.slice(1) : right;
      return { from: wordStart, to: wordStart + bare.length, text: cased };
    }
  }
  if (o.capitals) {
    if ((word === 'i' && /[\s,;:!?]/.test(typed)) || /^i['’](m|ve|ll|d)$/.test(word)) return { from: wordStart, to: wordStart + 1, text: 'I' };
    if (/^\p{Ll}[\p{Ll}'’]*$/u.test(word.replace(/\.$/, '')) && startsSentence(before.slice(0, wordStart))) {
      return { from: wordStart, to: wordStart + 1, text: word[0].toUpperCase() };
    }
  }
  return null;
}

/** Whether a word after `text` starts a sentence: the start of the line, or after . ! or ? (not an abbreviation). */
function startsSentence(text: string): boolean {
  const t = text.replace(/[“‘"'(]+$/, '');
  if (!t.trim()) return true;
  if (!/\s$/.test(t)) return false;
  const last = /(\S+)\s+$/.exec(t)?.[1] ?? '';
  const bare = last.replace(/[”’"')\]]+$/, '');
  if (!/[.!?]$/.test(bare) || /\.\.$/.test(bare)) return false;
  if (ABBREVIATIONS.has(bare.toLowerCase())) return false;
  // A single letter and a full stop is an initial ("J. Smith").
  if (/^\p{L}\.$/u.test(bare)) return false;
  return true;
}

/** Replaces one stretch of a paragraph with `text`, formatted as the first character it replaces. */
function replaceText(state: EditorState, blockId: string, fix: Fix, tracked: boolean): Transaction | null {
  const block = getBlock(state.doc, blockId);
  const old = sliceRuns(block.runs, fix.from, fix.to);
  if (!old.length || old.some((r) => r.link || r.footnote !== undefined || r.change?.kind === 'del')) return null;
  // Only within text of one kind: all added by the same tracked change, or none.
  const change = old[0].change;
  // With track changes on, only text just added (and so already marked) is put right.
  if (tracked && change?.kind !== 'ins') return null;
  if (old.some((r) => r.change?.kind !== change?.kind || r.change?.author !== change?.author)) return null;
  const { text: _old, ...rest } = old[0];
  const run: Run = { ...rest, text: fix.text };
  const caretAt = state.selection.focus.offset + fix.text.length - (fix.to - fix.from);
  return {
    ops: [
      { type: 'remove', block: blockId, offset: fix.from, runs: old },
      { type: 'insert', block: blockId, offset: fix.from, runs: [run] },
    ],
    selectionBefore: state.selection,
    selectionAfter: { anchor: { block: blockId, offset: caretAt }, focus: { block: blockId, offset: caretAt } },
    kind: 'other',
  };
}
