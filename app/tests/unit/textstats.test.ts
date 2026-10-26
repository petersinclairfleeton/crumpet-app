import { describe, expect, it } from 'vitest';
import { findFocus, textStats, wordFrequency } from '../../src/data/textstats';

const pick = (text: string, f: Parameters<typeof findFocus>[1]) => findFocus(text, f).map((r) => text.slice(r.from, r.to));

describe('text statistics', () => {
  it('counts words, sentences and paragraphs', () => {
    const s = textStats(['The lamp was dark. Mara climbed the stairs! Was it lit?', '“Not yet,” she said.', '']);
    expect(s.words).toBe(15);
    expect(s.sentences).toBe(4);
    expect(s.paragraphs).toBe(2);
    expect(s.perSentence).toBe(3.8);
    expect(s.reading).toBe(1);
  });

  it('lists the words used most, leaving out everyday ones', () => {
    expect(wordFrequency(['The lamp, the lamp, the LAMP and the sea.', 'Sea and lamp.'])).toEqual([
      { word: 'lamp', count: 4 },
      { word: 'sea', count: 2 },
    ]);
  });
});

describe('linguistic focus', () => {
  it('finds dialogue, including a quote running to the end of the paragraph', () => {
    expect(pick('“Not yet,” she said. "Soon," he said, “or never', 'dialogue')).toEqual(['“Not yet,”', '"Soon,"', '“or never']);
  });

  it('finds -ly adverbs but not words like only or family', () => {
    expect(pick('She quickly ran, only to find her family slowly leaving early.', 'adverbs')).toEqual(['quickly', 'slowly']);
  });

  it('finds filler words and likely passive voice', () => {
    expect(pick('It was just really very dark, and she started to run.', 'filler')).toEqual(['just', 'really', 'very', 'started to']);
    expect(pick('The door was opened. The lamp had been quickly broken. She was happy.', 'passive')).toEqual(['was opened', 'been quickly broken']);
  });

  it('finds one word, whatever its case', () => {
    expect(pick('Lamp, lamp! The lamplight.', { word: 'lamp' })).toEqual(['Lamp', 'lamp']);
  });

  it('finds echoes: a word used again soon after, but not everyday words, names or a word used again much later', () => {
    expect(pick('The lamp flickered. She trimmed the lamp and the wick, and the wick caught.', 'echoes')).toEqual(['lamp', 'lamp', 'wick', 'wick']);
    expect(pick('Mara looked. Mara waited, and then she waited again.', 'echoes')).toEqual(['waited', 'waited']);
    const filler = 'gulls wheeled above rocks while boats rocked gently beside weathered piers; fishermen mended nets, children chased dogs, smoke curled from chimneys, bells rang somewhere inland, carts rattled along cobbles toward market stalls selling bread, cheese, apples';
    const far = `The harbour was quiet. ${filler}. The harbour slept.`;
    expect(pick(far, 'echoes')).toEqual([]);
  });

  it('finds sentences over 35 words', () => {
    const long = `She walked ${'and walked '.repeat(20)}until the lighthouse rose out of the fog at last.`;
    expect(pick(`Short one. ${long} Another short one.`, 'long')).toEqual([long]);
  });
});

