import { describe, expect, it } from 'vitest';

describe('editedText', () => {
  it('says today, yesterday, or the date', async () => {
    const { editedText } = await import('../../src/data/selectors');
    const now = new Date(2026, 9, 16, 15, 0).getTime();
    expect(editedText(new Date(2026, 9, 16, 11, 25).getTime(), now)).toMatch(/^Edited today at 11:25/);
    expect(editedText(new Date(2026, 9, 15, 9, 2).getTime(), now)).toMatch(/^Edited yesterday at 9:02/);
    expect(editedText(new Date(2026, 9, 3, 9, 2).getTime(), now)).toMatch(/^Edited 3 October|^Edited October 3/);
    expect(editedText(new Date(2025, 9, 3).getTime(), now)).toMatch(/2025/);
  });
});
