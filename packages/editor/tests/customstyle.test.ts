import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '../src/markdown';

describe('styles of your own', () => {
  it('keep a paragraph or heading in a style of its own through the file', () => {
    const md = 'A letter. {.c-letter}\n\n## Part {.c-part-head}\n\nPlain. {.c-Bad}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks.map((b) => [b.type, b.style])).toEqual([
      ['paragraph', 'c-letter'],
      ['heading2', 'c-part-head'],
      ['paragraph', undefined],
    ]);
    expect(toMarkdown(doc)).toBe('A letter. {.c-letter}\n\n## Part {.c-part-head}\n\nPlain. \\{.c-Bad}\n');
  });
});
