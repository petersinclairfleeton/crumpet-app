import { describe, expect, it } from 'vitest';
import { matchSlash } from '../../src/ui/slash';

describe('the / menu', () => {
  it('finds items by the start of their name first, then by other words', () => {
    expect(matchSlash('').length).toBeGreaterThan(10);
    expect(matchSlash('head').map((i) => i.id).slice(0, 4)).toEqual(['h1', 'h2', 'h3', 'h4']);
    expect(matchSlash('todo').map((i) => i.id)).toEqual(['todo']);
    expect(matchSlash('image').map((i) => i.id)).toEqual(['picture']);
    expect(matchSlash('zq')).toEqual([]);
  });
});
