// Headers and footers of a section of its own (Word's Link to Previous turned
// off), kept in the document on the paragraph its section starts with
// (`para.hdr`, `para.ftr`), written short: "left|centre|right", with fields
// as %page%, **bold**, *italic* and __underlined__. A section with none of
// its own has the same as the one before (the first: the page setup's).
// Sections can also leave their first page blank, and start their page
// numbers again.

import type { Block, Doc, ParaLook } from '@crumpet/editor/model';
import { FIELDS, type HFBand, type HFField, type HFRun, type HFSet, type HeadersFooters, type NumberFormat, SLOTS, emptyBand, setFor, tidyRuns, variantFor, variantName } from './headers';

const FIELD_IDS = new Set<string>(FIELDS.map((f) => f.id));

/** A band written short (for the file). */
export function encodeBand(band: HFBand): string {
  return SLOTS.map((slot) => {
    let out = '';
    for (const r of band[slot]) {
      const body = r.field ? `%${r.field}${r.fmt ? `:${r.fmt}` : ''}%` : (r.text ?? '').replace(/[\\|%*_]/g, (c) => `\\${c}`).replace(/["{}\n]/g, (c) => (c === '"' ? '”' : c === '\n' ? ' ' : c === '{' ? '(' : ')'));
      const open = (r.b ? '**' : '') + (r.i ? '*' : '') + (r.u ? '__' : '');
      const close = (r.u ? '__' : '') + (r.i ? '*' : '') + (r.b ? '**' : '');
      out += open + body + close;
    }
    return out;
  }).join('|');
}

/** A band from its short form. */
export function decodeBand(text: string): HFBand {
  const band = emptyBand();
  let slot = 0;
  let b = false;
  let i = false;
  let u = false;
  let runs: HFRun[] = [];
  let buf = '';
  const flush = () => {
    if (buf) runs.push({ text: buf, ...(b ? { b } : {}), ...(i ? { i } : {}), ...(u ? { u } : {}) });
    buf = '';
  };
  const finish = () => {
    flush();
    if (slot < 3) band[SLOTS[slot]] = tidyRuns(runs);
    runs = [];
  };
  for (let k = 0; k < text.length; k++) {
    const c = text[k];
    if (c === '\\' && k + 1 < text.length) {
      buf += text[++k];
    } else if (c === '|') {
      finish();
      slot++;
    } else if (c === '*' && text[k + 1] === '*') {
      flush();
      b = !b;
      k++;
    } else if (c === '*') {
      flush();
      i = !i;
    } else if (c === '_' && text[k + 1] === '_') {
      flush();
      u = !u;
      k++;
    } else if (c === '%') {
      const end = text.indexOf('%', k + 1);
      const [id, fmt] = end > k ? text.slice(k + 1, end).split(':') : [''];
      if (end > k && FIELD_IDS.has(id)) {
        flush();
        runs.push({ field: id as HFField, ...(fmt === 'long' || fmt === 'short' || fmt === 'iso' || fmt === 'month' ? { fmt } : {}), ...(b ? { b } : {}), ...(i ? { i } : {}), ...(u ? { u } : {}) });
        k = end;
      } else buf += c;
    } else buf += c;
  }
  finish();
  return band;
}

/** The blocks each section starts with, in order (the first is the document's first block). */
export function sectionStarts(doc: Doc): Block[] {
  return doc.blocks.filter((b, i) => i === 0 || !!b.para?.sect);
}

export interface PageBoxLike {
  sectionBlock?: string;
  sectionFirst?: boolean;
}

/** What one page shows: its header and footer, its page number and how it's written. */
export interface PageHF {
  set: HFSet;
  /** The section (from 0) and how many there are. */
  section: number;
  sections: number;
  number: number;
  format: NumberFormat;
  /** Where the header and footer come from: a section's own (its index), or the page setup's (-1). */
  headerFrom: number;
  footerFrom: number;
  /** A name for what's being edited. */
  label: string;
  blankFirst: boolean;
}

/**
 * The header, footer and page number of page `i` (of `boxes`, after `offset`
 * pages before them), from the page setup and the sections' own.
 */
export function pageHF(hf: HeadersFooters, doc: Doc | null, boxes: PageBoxLike[], i: number, offset: number, chapterStart: boolean): PageHF {
  const starts = doc ? sectionStarts(doc) : [];
  const box = boxes[i];
  const k = Math.max(0, starts.findIndex((b) => b.id === box?.sectionBlock));
  const paras: (ParaLook | undefined)[] = starts.map((b) => b.para);
  const index = offset + i;
  const v = variantFor(hf, { index, chapterStart });
  const base = setFor(hf, v);
  const own = (key: 'hdr' | 'ftr') => {
    for (let j = k; j >= 0; j--) if (paras[j]?.[key] !== undefined) return j;
    return -1;
  };
  const hj = own('hdr');
  const fj = own('ftr');
  const blankFirst = !!box?.sectionFirst && !!paras[k]?.hfirst;
  const set: HFSet = blankFirst
    ? { header: emptyBand(), footer: emptyBand() }
    : { header: hj >= 0 ? decodeBand(paras[hj]!.hdr!) : base.header, footer: fj >= 0 ? decodeBand(paras[fj]!.ftr!) : base.footer };
  // Page numbers: from the last section before that starts them again.
  let number = hf.startAt + index;
  let format = hf.numberFormat;
  for (let j = k; j >= 0; j--) {
    const p = paras[j];
    if (p?.pstart !== undefined) {
      const firstPage = boxes.findIndex((b) => b.sectionBlock === starts[j].id);
      if (firstPage >= 0) number = p.pstart + (i - firstPage);
      break;
    }
  }
  for (let j = k; j >= 0; j--) {
    if (paras[j]?.pfmt) {
      format = paras[j]!.pfmt!;
      break;
    }
  }
  const sectionName = starts.length > 1 ? `Section ${k + 1}` : '';
  const label = [sectionName, blankFirst ? 'first page (blank)' : hj < 0 || fj < 0 ? variantName(hf, v) : ''].filter(Boolean).join(' · ') || variantName(hf, v);
  return { set, section: k, sections: starts.length, number, format, headerFrom: hj, footerFrom: fj, label, blankFirst };
}
