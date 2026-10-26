import { describe, expect, it } from 'vitest';
import { cleanMaps, mapDistance, measure, scaleFrom, travelTime } from '../../src/data/maps';
import { cleanPlan } from '../../src/data/plan';

describe('maps', () => {
  it('measures across a map by its shape, once its scale is set', () => {
    // A map twice as wide as it is tall: a line down its whole height is half its width.
    expect(mapDistance({ x: 0.5, y: 0 }, { x: 0.5, y: 1 }, 0.5)).toBeCloseTo(0.5);
    const scale = scaleFrom({ x: 0.1, y: 0.5 }, { x: 0.3, y: 0.5 }, 0.5, 20, 'miles');
    expect(scale).toEqual({ perWidth: 100, unit: 'miles' });
    const m = measure({ aspect: 0.5, scale }, { x: 0.1, y: 0.2 }, { x: 0.4, y: 0.2 });
    // 30 miles: 48 km, about 9.5 hours on foot, about 5 hours on horseback, about 50 minutes by car.
    expect(m).toEqual({ length: '30 miles', travel: ['about 9.5 hours on foot', 'about 5 hours on horseback', 'about 50 minutes by car'] });
    expect(measure({ aspect: 0.5 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
    expect(measure({ scale: { perWidth: 12, unit: 'days' } }, { x: 0, y: 0 }, { x: 0.5, y: 0 })).toEqual({ length: '6.0 days’ travel', travel: [] });
  });

  it('says long journeys in days of eight hours’ travel', () => {
    expect([travelTime(0.2), travelTime(3.2), travelTime(40)]).toEqual(['about 10 minutes', 'about 3 hours', 'about 5 days']);
  });

  it('keeps well-formed maps from project.json', () => {
    const maps = cleanMaps([
      { id: 'm', name: 'The Coast', src: 'Attachments/coast.png', aspect: 0.7, pins: [{ id: 'p', x: 0.2, y: 1.4, castId: 'rock' }, { id: 'q', x: 'no' }], scale: { perWidth: 50, unit: 'km' } },
      { id: 'n', name: 'No picture' },
    ]);
    expect(maps).toEqual([{ id: 'm', name: 'The Coast', src: 'Attachments/coast.png', aspect: 0.7, pins: [{ id: 'p', x: 0.2, y: 1, castId: 'rock' }], scale: { perWidth: 50, unit: 'km' } }]);
    expect(cleanPlan({ maps: [{ id: 'm', name: '', src: 'a.png', pins: [] }] })).toEqual({ maps: [{ id: 'm', name: '', src: 'a.png', pins: [] }] });
  });
});
