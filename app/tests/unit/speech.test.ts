// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { dictated } from '../../src/ui/speech';

describe('dictation', () => {
  it('turns spoken punctuation into marks and starts sentences with a capital', () => {
    expect(dictated('the lamp was dark full stop it lit itself', '')).toBe('The lamp was dark. It lit itself');
    expect(dictated('and then comma she ran question mark', 'It was late.')).toBe(' And then, she ran?');
    expect(dictated('more words', 'Some')).toBe(' more words');
    expect(dictated('new paragraph next one', 'End.')).toBe('\nNext one');
  });
});
