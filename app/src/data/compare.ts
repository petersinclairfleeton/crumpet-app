// Comparing two documents, like Word's Compare: what was taken out and what
// was added, either shown side by side or as a new document with the
// differences as tracked changes (to accept or reject one by one).

import { type Block, type Doc, makeBlock, makeChange, runsText } from '@crumpet/editor/model';
import { compareTexts } from './snapshots';

/** The text of a document, one paragraph per line (tables row by row). */
export function plainText(doc: Doc): string {
  return doc.blocks
    .flatMap((b) => (b.type === 'table' ? (b.rows ?? []).map((r) => r.join(' | ')) : b.type === 'image' || b.type === 'file' || b.type === 'toc' || b.type === 'shape' ? [] : [runsText(b.runs.filter((r) => r.change?.kind !== 'del' && !r.footnote))]))
    .join('\n');
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
