import { describe, expect, it } from 'vitest';
import { syllables, tagWords, tokens } from '../../src/data/reading';

describe('the immersive reader’s helpers', () => {
  it('splits words into syllables', () => {
    const split = (w: string) => syllables(w).join('-');
    expect(['table', 'grandfather', 'reading', 'keeper', 'winter', 'happy', 'window', 'remember', 'beautiful', 'running'].map(split)).toEqual(['ta-ble', 'grand-fa-ther', 'read-ing', 'keep-er', 'win-ter', 'hap-py', 'win-dow', 're-mem-ber', 'beau-ti-ful', 'run-ning']);
    expect(syllables('climbed')).toEqual(['climbed']);
    expect(syllables('cat')).toEqual(['cat']);
  });

  it('guesses parts of speech well enough to colour them', () => {
    const words = 'The old keeper slowly climbed the dark stairs'.split(' ');
    expect(tagWords(words)).toEqual([null, 'adj', 'noun', 'adv', 'verb', null, 'adj', 'noun']);
  });

  it('splits text into words and the bits between', () => {
    expect(tokens('Mara’s key, lit.').filter((t) => t.word).map((t) => t.text)).toEqual(['Mara’s', 'key', 'lit']);
  });
});
