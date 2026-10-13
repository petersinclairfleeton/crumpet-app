// The immersive reader's helpers (Word's Immersive Reader): the document's
// text as simple blocks of words, words split into syllables, and a rough
// guess at each word's part of speech (noun, verb, adjective, adverb) from a
// small word list and endings: good enough to help reading, not grammar.

import type { Doc } from '@crumpet/editor/model';
import { isHeading, isList, FOOTNOTE, FIELD } from '@crumpet/editor/model';

export interface ReadBlock {
  kind: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'quote';
  text: string;
}

/** The document's text for reading: headings, paragraphs, list items and quotes (tables and pictures left out). */
export function readBlocks(doc: Doc): ReadBlock[] {
  const out: ReadBlock[] = [];
  for (const b of doc.blocks) {
    const text = b.runs
      .filter((r) => r.change?.kind !== 'del' && r.footnote === undefined)
      .map((r) => r.text.replaceAll(FOOTNOTE, '').replaceAll(FIELD, ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;
    if (isHeading(b.type)) out.push({ kind: b.type === 'heading1' ? 'h1' : b.type === 'heading2' ? 'h2' : 'h3', text });
    else if (isList(b.type)) out.push({ kind: 'li', text });
    else if (b.type === 'quote') out.push({ kind: 'quote', text });
    else if (b.type === 'paragraph') out.push({ kind: 'p', text });
  }
  return out;
}

/** Words and the bits between them. */
export function tokens(text: string): { word: boolean; text: string; at: number }[] {
  const out: { word: boolean; text: string; at: number }[] = [];
  const re = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ word: false, text: text.slice(last, m.index), at: last });
    out.push({ word: true, text: m[0], at: m.index! });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ word: false, text: text.slice(last), at: last });
  return out;
}

const VOWEL = /[aeiouy]/;
const DIGRAPHS = new Set(['th', 'sh', 'ch', 'ph', 'wh', 'gh', 'ck', 'ng', 'qu']);
const BLENDS = new Set(['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw', 'wr', 'th', 'sh', 'ch', 'ph']);

/** A word split into syllables (English, by rule: right most of the time). */
export function syllables(word: string): string[] {
  const w = word.toLowerCase();
  if (w.length <= 3 || !/^[a-z]+$/.test(w)) return [word];
  const isV = (i: number) => VOWEL.test(w[i]) && !(w[i] === 'y' && i === 0);
  // Runs of vowels.
  const groups: [number, number][] = [];
  for (let i = 0; i < w.length; i++) {
    if (!isV(i)) continue;
    const s = i;
    while (i + 1 < w.length && isV(i + 1)) i++;
    groups.push([s, i + 1]);
  }
  // A silent e at the end (but not -le after a consonant), and -ed after anything but t or d.
  const lastG = groups[groups.length - 1];
  if (groups.length > 1 && lastG[0] === w.length - 1 && w.endsWith('e') && !(w.endsWith('le') && !isV(w.length - 3))) groups.pop();
  else if (groups.length > 1 && w.endsWith('ed') && lastG[0] === w.length - 2 && !/[td]ed$/.test(w)) groups.pop();
  else if (groups.length > 1 && w.endsWith('es') && lastG[0] === w.length - 2 && !/(s|x|z|ch|sh|ce|ge)es$/.test(w)) groups.pop();
  if (groups.length < 2) return [word];
  const cuts: number[] = [];
  // A word ending in a consonant and -le keeps them together (ta-ble); endings like -ing, -er, -ful are syllables of their own.
  const cle = /[^aeiouy]le$/.test(w) ? w.length - 3 : -1;
  // (-er and -est only after a long vowel and one consonant: keep-er, but fa-ther, win-ter.)
  const suffix = /(ing|ful|ness|less)$/.exec(w) ?? (/[aeiou]{2}[^aeiouy](er|est)$/.test(w) ? /(er|est)$/.exec(w) : null);
  const suffixAt = suffix && w.length - suffix[0].length > 2 ? w.length - suffix[0].length : -1;
  for (let g = 0; g + 1 < groups.length; g++) {
    const e = groups[g][1];
    const s = groups[g + 1][0];
    const cons = w.slice(e, s);
    let cut: number;
    if (g + 1 === groups.length - 1 && cle > 0 && s === w.length - 1) cut = cle;
    else if (g + 1 === groups.length - 1 && suffixAt > e && suffixAt <= s && !(cons.length === 2 && cons[0] === cons[1])) cut = suffixAt;
    else if (cons.length <= 1) cut = e;
    else if (cons.length === 2) cut = DIGRAPHS.has(cons) ? (cons === 'ck' || cons === 'ng' ? s : e) : e + 1;
    else cut = BLENDS.has(cons.slice(-2)) ? s - 2 : s - 1;
    cuts.push(cut);
  }
  const out: string[] = [];
  let from = 0;
  for (const c of cuts) {
    if (c <= from || c >= word.length) continue;
    out.push(word.slice(from, c));
    from = c;
  }
  out.push(word.slice(from));
  return out;
}

export type Pos = 'noun' | 'verb' | 'adj' | 'adv' | null;

const DET = new Set('the a an this that these those my your his her its our their some any each every no another such what which whose'.split(' '));
const PRON = new Set('i you he she it we they me him us them who'.split(' '));
const MODAL = new Set('to will would can could shall should may might must do does did not never'.split(' '));
const BE = new Set('is am are was were be been being has have had'.split(' '));
const FUNCTION = new Set('and or but if so as of in on at by for with from into onto over under about after before than then there here when where while because although though up down out off through again also just very too quite yet still even only'.split(' '));
const VERBS = new Set('go goes went gone come came see saw seen say said know knew think thought take took make made get got give gave find found tell told ask asked feel felt leave left keep kept let begin began seem seemed help helped show showed hear heard play run ran move live believe bring brought happen write wrote sit sat stand stood lose lost pay paid meet met include continue set learn change lead understand watch follow stop create speak spoke read spend grow open walk win offer remember love consider appear buy wait serve die send expect build stay fall cut reach kill remain suggest raise pass sell require report decide pull climb climbed lit light carry carried hold held turn turned look looked want wanted use used work worked call called try tried need needed become became put mean meant like liked'.split(' '));
const ADJ = new Set('good new first last long great little own other old right big high different small large next early young important few public bad same able dark light cold warm hot quiet loud slow fast happy sad bright soft hard empty full deep tall short strong weak red blue green white black grey gray yellow brown wide narrow'.split(' '));
const ADV = new Set('now soon often always sometimes never once twice almost already rather perhaps maybe away back far near together'.split(' '));

/** Rough parts of speech for a run of words (in order, so a word after "the" or "to" is read in its place). */
export function tagWords(words: string[]): Pos[] {
  const out: Pos[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase().replace(/['’]s$/, '');
    const prev = words[i - 1]?.toLowerCase() ?? '';
    let pos: Pos = null;
    if (DET.has(w) || PRON.has(w) || MODAL.has(w) || BE.has(w) || FUNCTION.has(w) || /^\d+$/.test(w)) pos = null;
    else if (ADV.has(w) || (/ly$/.test(w) && w.length > 4 && !/^(reply|supply|apply|family|holy|ugly|early|daily|lonely|lovely|friendly|only|silly|jolly|belly)$/.test(w))) pos = 'adv';
    else if (ADJ.has(w) || /(ous|ful|ive|able|ible|less|ish|ic|ical|ary|est)$/.test(w)) pos = 'adj';
    else if (VERBS.has(w) || ((MODAL.has(prev) || PRON.has(prev)) && !/(tion|ness|ment|ity)$/.test(w)) || (/(ed|ing)$/.test(w) && (BE.has(prev) || PRON.has(prev)))) pos = 'verb';
    else if (/(tion|sion|ness|ment|ity|ship|hood|dom|ance|ence|er|or|ist)$/.test(w) || DET.has(prev) || ADJ.has(prev) || out[i - 1] === 'adj' || /^[A-Z]/.test(words[i])) pos = 'noun';
    else if (/(ed|ing|ize|ise|ify|ate)$/.test(w)) pos = 'verb';
    else if (w.length > 2) pos = 'noun';
    out.push(pos);
  }
  return out;
}

/** A picture and short description of a word from Wikipedia (for the picture dictionary), if it has one. */
export async function wordPicture(word: string): Promise<{ src: string; title: string } | null> {
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word.toLowerCase())}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { thumbnail?: { source?: string }; title?: string; type?: string };
    return j.thumbnail?.source && j.type !== 'disambiguation' ? { src: j.thumbnail.source, title: j.title ?? word } : null;
  } catch {
    return null;
  }
}
