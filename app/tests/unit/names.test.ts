import { describe, expect, it } from 'vitest';
import { ERAS, REGIONS, suggestNames } from '../../src/data/names';

describe('name generator', () => {
  it('suggests different names for every region and era, the same for the same seed', () => {
    for (const r of REGIONS)
      for (const e of ERAS) {
        const names = suggestNames('character', r.id, e.id, 'any', 7);
        expect(names.length).toBeGreaterThanOrEqual(8);
        expect(new Set(names).size).toBe(names.length);
        for (const n of names) expect(n).toMatch(/^\S+ .+/);
        expect(suggestNames('character', r.id, e.id, 'any', 7)).toEqual(names);
      }
  });

  it('makes place names, and medieval bynames', () => {
    for (const r of REGIONS) expect(suggestNames('place', r.id, 'modern', 'any', 3).length).toBeGreaterThanOrEqual(8);
    const women = suggestNames('character', 'nordic', 'medieval', 'female', 1);
    expect(women.every((n) => n.endsWith('sdatter'))).toBe(true);
    expect(suggestNames('character', 'german', 'medieval', 'male', 2).every((n) => n.includes(' von '))).toBe(true);
  });
});
