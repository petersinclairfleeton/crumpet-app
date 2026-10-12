// Comparing two documents, like Word's Compare: what was taken out and what
// was added, either shown side by side or as a new document with the
// differences as tracked changes (to accept or reject one by one).

import { type Block, type Change, type Doc, makeBlock, makeChange, runsText } from '@crumpet/editor/model';
import { compareTexts } from './snapshots';

/** The text of a document, one paragraph per line (tables row by row). */
export function plainText(doc: Doc): string {
  return doc.blocks
    .flatMap((b) => (b.type === 'table' ? (b.rows ?? []).map((r) => r.join(' | ')) : b.type === 'code' ? (b.code?.text ?? '').split('\n') : b.type === 'image' || b.type === 'file' || b.type === 'toc' || b.type === 'shape' ? [] : [runsText(b.runs.filter((r) => r.change?.kind !== 'del' && !r.footnote))]))
    .join('\n');
}

/** Writes text into blocks, a new paragraph at each line break (a tracked paragraph break when the text is a change). */
function emitter(): { blocks: Block[]; emit(text: string, change?: Change): void } {
  const blocks: Block[] = [makeBlock('paragraph')];
  return {
    blocks,
    emit(text, change) {
      text.split('\n').forEach((line, i) => {
        if (i > 0) {
          const b = makeBlock('paragraph');
          if (change) b.brk = change;
          blocks.push(b);
        }
        if (line) {
          const runs = blocks[blocks.length - 1].runs;
          const last = runs[runs.length - 1];
          if (last && last.change === change) last.text += line;
          else runs.push({ text: line, marks: [], ...(change ? { change } : {}) });
        }
      });
    },
  };
}

/**
 * Word's Combine: the original, with what each reviewer changed in their
 * copy as tracked changes in their name, all in one document. Where two
 * reviewers took out the same words, the first one listed is named.
 */
export function combinedComparison(original: Doc, copies: { doc: Doc; author: string }[], at = Date.now()): Doc {
  const base = plainText(original);
  const deletedBy: (string | undefined)[] = new Array(base.length);
  const added = new Map<number, { text: string; author: string }[]>();
  for (const { doc, author } of copies) {
    let pos = 0;
    for (const part of compareTexts(base, plainText(doc))) {
      if (part.kind === 'add') {
        const list = added.get(pos) ?? [];
        list.push({ text: part.text, author });
        added.set(pos, list);
        continue;
      }
      if (part.kind === 'del') for (let i = pos; i < pos + part.text.length; i++) deletedBy[i] ??= author;
      pos += part.text.length;
    }
  }
  const made = new Map<string, Change>();
  const change = (kind: 'ins' | 'del', author: string) => {
    const key = `${kind}:${author}`;
    if (!made.has(key)) made.set(key, makeChange(kind, author, at));
    return made.get(key)!;
  };
  const out = emitter();
  let i = 0;
  while (i <= base.length) {
    for (const a of added.get(i) ?? []) out.emit(a.text, change('ins', a.author));
    if (i === base.length) break;
    // A stretch of the original that's kept, or taken out by one reviewer.
    const who = deletedBy[i];
    let j = i + 1;
    while (j < base.length && deletedBy[j] === who && !added.has(j)) j++;
    out.emit(base.slice(i, j), who ? change('del', who) : undefined);
    i = j;
  }
  return { blocks: out.blocks };
}

/** The later version, with what changed since the earlier one as tracked changes by `author`. */
export function trackedComparison(before: Doc, after: Doc, author: string, at = Date.now()): Doc {
  const ins = makeChange('ins', author, at);
  const del = makeChange('del', author, at);
  const blocks: Block[] = [makeBlock('paragraph')];
  for (const part of compareTexts(plainText(before), plainText(after))) {
    const change = part.kind === 'add' ? ins : part.kind === 'del' ? del : undefined;
    part.text.split('\n').forEach((line, i) => {
      if (i > 0) {
        const b = makeBlock('paragraph');
        if (change) b.brk = change;
        blocks.push(b);
      }
      if (line) blocks[blocks.length - 1].runs.push({ text: line, marks: [], ...(change ? { change } : {}) });
    });
  }
  return { blocks };
}
