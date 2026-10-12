import { describe, expect, it } from 'vitest';
import { comments } from '../src/model';
import { fromMarkdown, toMarkdown } from '../src/markdown';

describe('resolved comments', () => {
  it('are saved with a tick at the end, and read back', () => {
    const md = 'The {==castle==}{>>Robin (2026-10-07 09:32Z): Which one?<<}{>>Sam (2026-10-07 09:40Z): The old one.<<}{>>✓<<} stood.\n';
    const doc = fromMarkdown(md);
    const [c] = comments(doc);
    expect(c.comment).toMatchObject({ author: 'Robin', text: 'Which one?', resolved: true });
    expect(c.comment.replies).toHaveLength(1);
    expect(toMarkdown(doc)).toBe(md);
  });

  it('a comment that only says ✓ is a comment, not resolved', () => {
    const [c] = comments(fromMarkdown('A {==b==}{>>✓<<} c.\n'));
    expect(c.comment.text).toBe('✓');
    expect(c.comment.resolved).toBeUndefined();
  });
});

describe('tracking for everyone, locked', () => {
  it('is kept on the first paragraph, and not carried to the next', async () => {
    const md = 'First line. {track=all lock=0123456789abcdef0123456789abcdef}\n\nSecond.\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].para).toEqual({ track: 'all', lock: '0123456789abcdef0123456789abcdef' });
    expect(toMarkdown(doc)).toBe(md);
    expect(fromMarkdown('A {track=all lock=open}\n').blocks[0].para).toEqual({ track: 'all', lock: 'open' });
    const { splitBlock } = await import('../src/commands');
    const { caret } = await import('../src/model');
    const { applyOps } = await import('../src/ops');
    const s = { doc, selection: caret({ block: doc.blocks[0].id, offset: 11 }), storedMarks: null };
    const after = applyOps(doc, splitBlock(s).ops);
    expect(after.blocks[1].para).toBeUndefined();
  });
});
