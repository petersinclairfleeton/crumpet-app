// Checking a document, like Word's Review tools: Check Accessibility, Check
// Compatibility (what won't survive in Word), Inspect Document (comments,
// changes, people, hidden text), clarity (wordy phrases, and the Writing
// tab's highlights) and inclusive language. Each finds issues in the text,
// each with where it is and, when there is one, a better word.

import type { Block, Doc } from '@crumpet/editor/model';
import { FIELD, FOOTNOTE, comments, changes, isHeading } from '@crumpet/editor/model';
import { luminance } from './paper';

export interface Issue {
  /** Which check found it. */
  kind: 'access' | 'compat' | 'inspect' | 'clarity' | 'inclusive';
  block: string;
  /** Where in the block's text (for a word or phrase). */
  from?: number;
  to?: number;
  /** What's found, and what to do. */
  title: string;
  hint: string;
  /** A replacement for the words found. */
  fix?: string;
}

const text = (b: Block) => b.runs.map((r) => r.text).join('');
const plain = (b: Block) => text(b).replaceAll(FIELD, ' ').replaceAll(FOOTNOTE, ' ');

/** Check Accessibility: pictures without alt text, tables without a heading row, headings that skip a level, hard-to-read text colours, unclear link text. */
export function accessibility(doc: Doc): Issue[] {
  const out: Issue[] = [];
  let lastLevel = 0;
  for (const b of doc.blocks) {
    if (b.type === 'image' && !b.pic?.alt?.trim() && !b.pic?.hide) out.push({ kind: 'access', block: b.id, title: 'Picture without alt text', hint: 'Describe it for people who can’t see it: its menu’s Alt text… (or mark it decorative by hiding it).' });
    if (b.type === 'shape' && b.shape?.kind === 'path' && !b.shape.text) out.push({ kind: 'access', block: b.id, title: 'Icon or drawing without words', hint: 'If it carries meaning, say it in the text beside it.' });
    if (b.type === 'table' && b.tbl?.noHeader) out.push({ kind: 'access', block: b.id, title: 'Table without a heading row', hint: 'Turn on Heading row in the Table menu, so screen readers can name each column.' });
    if (isHeading(b.type)) {
      const level = Number(b.type.slice(-1));
      if (!plain(b).trim()) out.push({ kind: 'access', block: b.id, title: 'Empty heading', hint: 'Give it words, or make it ordinary text.' });
      else if (lastLevel && level > lastLevel + 1) out.push({ kind: 'access', block: b.id, title: `Heading ${level} after Heading ${lastLevel}`, hint: `A level is skipped: make it Heading ${lastLevel + 1}, so the outline reads in order.` });
      lastLevel = level;
    }
    let at = 0;
    for (const r of b.runs) {
      const len = r.text.length;
      if (r.look?.color && r.text.trim() && contrast(r.look.color, r.look.highlight ?? '#ffffff') < 3) out.push({ kind: 'access', block: b.id, from: at, to: at + len, title: 'Hard-to-read text colour', hint: `${r.text.trim().slice(0, 30)}: the colour is too close to its background. Choose a darker (or lighter) one.` });
      if (r.link && /^(click here|here|link|this|read more|more)$/i.test(r.text.trim())) out.push({ kind: 'access', block: b.id, from: at, to: at + len, title: 'Unclear link text', hint: `“${r.text.trim()}” doesn’t say where it goes: link words that do.` });
      if (r.link && /^https?:\/\//.test(r.text.trim()) && r.text.trim().length > 40) out.push({ kind: 'access', block: b.id, from: at, to: at + len, title: 'Long web address as link text', hint: 'Screen readers spell it out: link a few words that say where it goes.' });
      at += len;
    }
  }
  return out;
}

/** How far apart two colours are to read (WCAG's contrast ratio, 1 to 21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Check Compatibility: what Word doesn't keep, or shows differently. */
export function compatibility(doc: Doc): Issue[] {
  const out: Issue[] = [];
  const add = (b: Block, title: string, hint: string, from?: number, to?: number) => out.push({ kind: 'compat', block: b.id, title, hint, ...(from !== undefined ? { from, to } : {}) });
  for (const b of doc.blocks) {
    if (b.type === 'code') {
      if (b.code?.lang === 'math') add(b, 'Maths', 'Goes to Word as its LaTeX text, not as a Word equation.');
      else if (b.code?.lang === 'mermaid') add(b, 'Diagram', 'Goes to Word as its text, not as a picture.');
      else add(b, 'Board', 'Boards stay in Crumpet: Word gets their text.');
    }
    if (b.style === 'toggle' || b.folded) add(b, 'Folded section', 'Word shows everything, unfolded.');
    if (b.style && ['note', 'tip', 'warning', 'important'].includes(b.style)) add(b, 'Callout', 'Goes to Word as a quote with a coloured bar, without its icon.');
    if (b.pic && ['sepia', 'washout', 'vintage', 'blur', 'negative'].includes(String(b.pic.effect))) add(b, 'Picture effect', `The ${b.pic.effect} effect isn’t one Word has: the picture goes as it was.`);
    if (b.shape?.grp) add(b, 'Grouped shapes', 'Word gets the shapes one by one, not as a group.');
    if (b.shape?.fx === 'soft' || b.shape?.fx === 'bevel') add(b, 'Shape effect', 'Word draws its own version of this effect.');
    let at = 0;
    for (const r of b.runs) {
      const len = r.text.length;
      if (r.look?.fx === 'glow' || r.look?.fx === 'reflect') add(b, 'Text effect', `${r.look.fx === 'glow' ? 'Glow' : 'Reflection'} on text isn’t kept in Word.`, at, at + len);
      if (r.link?.startsWith('note:')) add(b, 'Link to a note', 'Word gets the words, not the link (the note isn’t in the Word file).', at, at + len);
      if (r.field?.startsWith('cite:')) add(b, 'Citation', 'Goes to Word as plain text, not as a Word citation.', at, at + len);
      at += len;
    }
  }
  const p0 = doc.blocks[0]?.para;
  if (p0?.thx) out.push({ kind: 'compat', block: doc.blocks[0].id, title: 'Theme effects', hint: 'The theme’s shadows on shapes and pictures stay in Crumpet.' });
  return out;
}

export interface Inspection {
  comments: number;
  changes: number;
  people: string[];
  hiddenText: number;
  hiddenObjects: number;
}

/** Inspect Document: what's in the document besides its text, to take out before sharing. */
export function inspect(doc: Doc): Inspection {
  const people = new Set<string>();
  const cs = comments(doc);
  for (const c of cs) {
    if (c.comment.author) people.add(c.comment.author);
    for (const r of c.comment.replies ?? []) if (r.author) people.add(r.author);
  }
  const ch = changes(doc);
  for (const c of ch) if (c.change.author) people.add(c.change.author);
  let hiddenText = 0;
  for (const b of doc.blocks) for (const r of b.runs) if (r.look?.hidden && r.text.trim()) hiddenText++;
  const hiddenObjects = doc.blocks.filter((b) => b.pic?.hide || b.shape?.hide).length;
  return { comments: cs.length, changes: ch.length, people: [...people].sort(), hiddenText, hiddenObjects };
}

/** Wordy phrases and plainer words for them (Word's clarity and conciseness suggestions). */
export const WORDY: [string, string][] = [
  ['in order to', 'to'],
  ['due to the fact that', 'because'],
  ['owing to the fact that', 'because'],
  ['in spite of the fact that', 'although'],
  ['at this point in time', 'now'],
  ['at the present time', 'now'],
  ['in the event that', 'if'],
  ['for the purpose of', 'for'],
  ['with regard to', 'about'],
  ['in regard to', 'about'],
  ['with reference to', 'about'],
  ['a large number of', 'many'],
  ['a majority of', 'most'],
  ['in the near future', 'soon'],
  ['is able to', 'can'],
  ['are able to', 'can'],
  ['has the ability to', 'can'],
  ['make a decision', 'decide'],
  ['come to the conclusion', 'conclude'],
  ['give consideration to', 'consider'],
  ['take into consideration', 'consider'],
  ['until such time as', 'until'],
  ['prior to', 'before'],
  ['subsequent to', 'after'],
  ['each and every', 'every'],
  ['first and foremost', 'first'],
  ['the reason why is that', 'because'],
  ['in close proximity to', 'near'],
  ['completely finished', 'finished'],
  ['absolutely essential', 'essential'],
  ['end result', 'result'],
  ['past history', 'history'],
  ['free gift', 'gift'],
  ['very unique', 'unique'],
];

/** Words with fairer, more inclusive alternatives (Word's inclusiveness suggestions). */
export const INCLUSIVE: [string, string][] = [
  ['chairman', 'chair'],
  ['chairwoman', 'chair'],
  ['mankind', 'humanity'],
  ['manpower', 'workforce'],
  ['man-made', 'artificial'],
  ['manmade', 'artificial'],
  ['policeman', 'police officer'],
  ['policemen', 'police officers'],
  ['fireman', 'firefighter'],
  ['firemen', 'firefighters'],
  ['businessman', 'businessperson'],
  ['businessmen', 'businesspeople'],
  ['salesman', 'salesperson'],
  ['spokesman', 'spokesperson'],
  ['stewardess', 'flight attendant'],
  ['headmaster', 'head teacher'],
  ['headmistress', 'head teacher'],
  ['housewife', 'homemaker'],
  ['blacklist', 'blocklist'],
  ['whitelist', 'allowlist'],
  ['master copy', 'original copy'],
  ['manhole', 'maintenance hole'],
  ['crippled', 'disabled'],
  ['wheelchair-bound', 'wheelchair user'],
  ['confined to a wheelchair', 'uses a wheelchair'],
  ['the elderly', 'older people'],
  ['senile', 'confused'],
];

/** Every place a phrase in `list` appears (whole words, any case), as issues with its replacement. */
function phrases(doc: Doc, list: [string, string][], kind: Issue['kind'], title: (from: string) => string, hint: (from: string, to: string) => string): Issue[] {
  const out: Issue[] = [];
  const res = list.map(([from, to]) => ({ re: new RegExp(`(?<![\\p{L}\\p{N}])${from.replace(/ /g, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu'), to }));
  for (const b of doc.blocks) {
    if (b.type === 'code' || b.type === 'table') continue;
    const t = plain(b);
    for (const { re, to } of res) {
      for (const m of t.matchAll(re)) {
        const found = m[0];
        // Keep a capital at the start.
        const fix = /^[A-Z]/.test(found) ? to[0].toUpperCase() + to.slice(1) : to;
        out.push({ kind, block: b.id, from: m.index!, to: m.index! + found.length, title: title(found), hint: hint(found, fix), fix });
      }
    }
  }
  return out.sort((a, b) => doc.blocks.findIndex((x) => x.id === a.block) - doc.blocks.findIndex((x) => x.id === b.block) || (a.from ?? 0) - (b.from ?? 0));
}

export function clarity(doc: Doc): Issue[] {
  return phrases(doc, WORDY, 'clarity', (f) => `“${f}”`, (_, t) => `Wordy: “${t}” says the same.`);
}

export function inclusive(doc: Doc): Issue[] {
  return phrases(doc, INCLUSIVE, 'inclusive', (f) => `“${f}”`, (_, t) => `Consider “${t}”, which includes everyone.`);
}

/** The words of a document to check the spelling of: each with where it is (not in code, links, or words with figures). */
export function wordsToSpell(doc: Doc): { block: string; from: number; to: number; word: string }[] {
  const out: { block: string; from: number; to: number; word: string }[] = [];
  for (const b of doc.blocks) {
    if (b.type === 'code' || b.type === 'toc') continue;
    let at = 0;
    for (const r of b.runs) {
      if (!r.link && !r.marks.includes('code') && r.change?.kind !== 'del' && r.field === undefined && r.footnote === undefined) {
        for (const m of r.text.matchAll(/\p{L}+(?:['’]\p{L}+)*/gu)) {
          const w = m[0];
          if (w.length < 2 || /\d/.test(w)) continue;
          out.push({ block: b.id, from: at + m.index!, to: at + m.index! + w.length, word: w });
        }
      }
      at += r.text.length;
    }
  }
  return out;
}
