import { describe, expect, it } from 'vitest';
import { matchCase, tidyLookUp } from '../../src/data/thesaurus';

describe('thesaurus', () => {
  it('puts definitions and synonyms together without repeats', () => {
    const r = tidyLookUp(
      'dark',
      [{ meanings: [{ partOfSpeech: 'adjective', definitions: [{ definition: 'Having little light.', example: 'a dark room', synonyms: ['dim'] }], synonyms: ['gloomy', 'Dim'], antonyms: ['light'] }] }],
      [{ word: 'dim' }, { word: 'shadowy' }, { word: 'dark' }],
      [{ word: 'gloomy' }, { word: 'black' }, { word: 'pitch_black' }],
      [{ word: 'bright' }],
    );
    expect(r.senses).toEqual([{ pos: 'adjective', definition: 'Having little light.', example: 'a dark room' }]);
    expect(r.synonyms).toEqual(['dim', 'shadowy', 'gloomy']);
    expect(r.similar).toEqual(['black']);
    expect(r.antonyms).toEqual(['bright', 'light']);
  });

  it('keeps the case of the word it replaces', () => {
    expect(matchCase('Dark', 'dim')).toBe('Dim');
    expect(matchCase('DARK', 'dim')).toBe('DIM');
    expect(matchCase('dark', 'dim')).toBe('dim');
  });
});
