import { describe, expect, it } from 'vitest';
import { looksLikeTitle } from '../../src/data/pastetitle';

const long = 'The rain came down over the hills all night, and in the morning the river had climbed its banks and taken the old bridge with it. Nobody in the village had seen anything like it.';

describe('does a pasted first line look like a title', () => {
  it('takes a short line before a long piece', () => {
    expect(looksLikeTitle('The night the bridge went', long, false)).toBe(true);
    expect(looksLikeTitle('Why did the bridge go?', long, false)).toBe(true);
  });
  it('not a sentence, a list item, a link, a long line, or before only a little text', () => {
    expect(looksLikeTitle('It rained all night.', long, false)).toBe(false);
    expect(looksLikeTitle('Dear Sam,', long, false)).toBe(false);
    expect(looksLikeTitle('- milk', long, false)).toBe(false);
    expect(looksLikeTitle('https://example.com/story', long, false)).toBe(false);
    expect(looksLikeTitle('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen', long, false)).toBe(false);
    expect(looksLikeTitle('Shopping', 'eggs and milk', false)).toBe(false);
  });
  it('a heading is a title even ending in a full stop', () => {
    expect(looksLikeTitle('The end.', long, true)).toBe(true);
  });
});
