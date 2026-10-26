// Fountain (fountain.io): the plain-text screenplay format that Highland,
// WriterDuet, Fade In, Final Draft and others open. A script's elements are
// written so that they read back as the same elements, and a .fountain file
// opens as a script.

import { type Block, type Doc, makeBlock, runsText } from '@crumpet/editor/model';
import { type ScriptStyle, isScript } from '@crumpet/editor/script';

const SCENE = /^(?:INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i;
const TRANSITION = /^[A-Z0-9 .'’-]+TO:$/;
const upper = (s: string) => s === s.toUpperCase() && /\p{L}/u.test(s);

/** A script (or any text) as Fountain: each part under its heading as a section. */
export function toFountain(title: string, parts: { heading?: string; doc: Doc }[], author = ''): string {
  const out: string[] = [`Title: ${title}`, ...(author ? [`Author: ${author}`] : []), ''];
  let last: ScriptStyle | 'other' | null = null;
  const line = (text: string, kind: ScriptStyle | 'other') => {
    // Dialogue keeps together: a character, their parenthetical and lines with no blank line between.
    const together = (last === 'sc-char' || last === 'sc-paren' || last === 'sc-dial') && (kind === 'sc-paren' || kind === 'sc-dial');
    if (!together && out[out.length - 1] !== '') out.push('');
    out.push(text);
    last = kind;
  };
  for (const part of parts) {
    if (part.heading) line(`# ${part.heading}`, 'other');
    for (const b of part.doc.blocks) {
      const text = runsText(b.runs.filter((r) => r.change?.kind !== 'del' && !r.footnote)).replace(/\n/g, ' ').trim();
      const style = b.type === 'paragraph' && isScript(b.style) ? b.style : null;
      if (!text && style !== 'sc-dial') {
        last = null;
        continue;
      }
      if (style === 'sc-scene') line(SCENE.test(text) ? text.toUpperCase() : `.${text.toUpperCase()}`, style);
      else if (style === 'sc-char') line(upper(text) ? text : `@${text}`, style);
      else if (style === 'sc-paren') line(/^\(.*\)$/.test(text) ? text : `(${text})`, style);
      else if (style === 'sc-dial') line(text, style);
      else if (style === 'sc-trans') line(TRANSITION.test(text.toUpperCase()) ? text.toUpperCase() : `> ${text.toUpperCase()}`, style);
      else if (b.type.startsWith('heading')) line(`${'#'.repeat(Math.min(3, Number(b.type.slice(-1)) || 1))} ${text}`, 'other');
      // Action: forced when it would read as something else (a line in capitals, or one that looks like a scene heading).
      else line(upper(text) || SCENE.test(text) ? `!${text}` : text, 'sc-action');
    }
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/** A Fountain file read as a script's paragraphs (its title page, notes and boneyard left out). */
export function fromFountain(text: string): { title: string; blocks: Block[] } {
  let src = text.replace(/\r\n?/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\[\[[\s\S]*?\]\]/g, '');
  let title = '';
  // The title page: key: value lines before the first blank line.
  const firstBlank = src.indexOf('\n\n');
  const head = firstBlank < 0 ? src : src.slice(0, firstBlank);
  if (/^[A-Za-z ]+:/.test(head) && head.split('\n').every((l) => /^[A-Za-z ]+:|^\s+\S/.test(l) || !l.trim())) {
    title = /^Title:\s*(.*)$/im.exec(head)?.[1]?.trim() ?? '';
    src = firstBlank < 0 ? '' : src.slice(firstBlank + 2);
  }
  const lines = src.split('\n');
  const blocks: Block[] = [];
  const add = (style: ScriptStyle, t: string) => blocks.push(makeBlock('paragraph', t, [], { style }));
  let inDialogue = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    const blankBefore = i === 0 || !lines[i - 1].trim();
    const next = lines[i + 1]?.trim() ?? '';
    if (!t) {
      inDialogue = false;
      continue;
    }
    if (inDialogue) {
      if (/^\(.*\)$/.test(t)) add('sc-paren', t);
      else add('sc-dial', t);
      continue;
    }
    // Sections and synopses are the writer's outline: left out.
    if (/^#|^=(?!=)/.test(t)) continue;
    if (t.startsWith('!')) {
      add('sc-action', t.slice(1).trim());
    } else if (blankBefore && (/^\.(?!\.)/.test(t) || SCENE.test(t))) {
      add('sc-scene', (t.startsWith('.') ? t.slice(1) : t).trim());
    } else if (t.startsWith('>') && !t.endsWith('<')) {
      add('sc-trans', t.slice(1).trim());
    } else if (blankBefore && TRANSITION.test(t) && !next) {
      add('sc-trans', t);
    } else if (blankBefore && next && (t.startsWith('@') || (upper(t.replace(/\(.*?\)/g, '')) && !/^\d+$/.test(t)))) {
      add('sc-char', (t.startsWith('@') ? t.slice(1) : t).replace(/\s*\^$/, '').trim());
      inDialogue = true;
    } else {
      add('sc-action', t.replace(/^>\s*|\s*<$/g, ''));
    }
  }
  return { title, blocks: blocks.length ? blocks : [makeBlock('paragraph', '', [], { style: 'sc-scene' })] };
}

/** True when a document has a script's elements in it. */
export function isScriptDoc(doc: Doc): boolean {
  return doc.blocks.some((b) => b.type === 'paragraph' && isScript(b.style));
}
