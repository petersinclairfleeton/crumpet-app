// Pasting a long piece into an empty note: its first line can be the note's
// title. This splits what's pasted into that line and the rest; the app
// decides whether the line looks like a title (and takes it).

import { type Block, type Doc, isHeading, isMedia, isWidget, runsText } from './model';

export interface TitleSplit<T> {
  /** The first line, as plain text, without a Markdown heading's #s. */
  title: string;
  /** It was a heading (or written as one, `# Title`). */
  heading: boolean;
  /** The rest's plain text, to judge how long it is. */
  restText: string;
  /** What's left to paste. */
  rest: T;
}

const blank = (b: Block) => !isMedia(b.type) && !isWidget(b.type) && !runsText(b.runs).trim();

/** The first paragraph of pasted blocks, and the rest; null if there's no text paragraph first or nothing after it. */
export function splitTitleBlocks(blocks: Block[]): TitleSplit<Block[]> | null {
  let i = 0;
  while (i < blocks.length && blank(blocks[i])) i++;
  const first = blocks[i];
  if (!first || isMedia(first.type) || isWidget(first.type) || first.type === 'todo') return null;
  let j = i + 1;
  while (j < blocks.length && blank(blocks[j])) j++;
  const rest = blocks.slice(j);
  if (!rest.length) return null;
  const title = runsText(first.runs).replace(/\s+/g, ' ').trim();
  const restText = rest.map((b) => runsText(b.runs)).join('\n');
  return { title, heading: isHeading(first.type) || first.style === 'title', restText, rest };
}

/** The first line of pasted plain text, and the rest; null if there's only one line. */
export function splitTitleText(text: string): TitleSplit<string> | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length) return null;
  let j = i + 1;
  while (j < lines.length && !lines[j].trim()) j++;
  const rest = lines.slice(j).join('\n');
  if (!rest.trim()) return null;
  const m = /^\s*#{1,6}\s+(.*)$/.exec(lines[i]);
  const title = (m ? m[1].replace(/\s+#+\s*$/, '') : lines[i]).replace(/\s+/g, ' ').trim();
  return { title, heading: !!m, restText: rest, rest };
}

/** The document has nothing in it yet: one empty paragraph (or only empty paragraphs). */
export function isBlankDoc(doc: Doc): boolean {
  return doc.blocks.every((b) => b.type === 'paragraph' && !b.style && !runsText(b.runs).length);
}
