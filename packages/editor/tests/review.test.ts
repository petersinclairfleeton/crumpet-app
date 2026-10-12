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
