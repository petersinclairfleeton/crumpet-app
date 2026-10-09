import { describe, expect, it } from 'vitest';
import { type Snapshot, compareTexts, mergeSnapshots, pruneVersions, readSnapshot, snapshotAttachments, writeSnapshot } from '../../src/data/snapshots';

const snap = (id: string, at = 1): Snapshot => ({ id, docId: 'c1', kind: 'chapter', title: 'Salt', name: 'Before the rewrite: "big" one', at, words: 3, md: '# Salt\n\nThe lamp ![x](Attachments/abc-lamp.png)\n' });

describe('snapshots', () => {
  it('writes a file and reads it back the same', () => {
    const s = snap('s1', Date.UTC(2026, 9, 8, 12));
    expect(readSnapshot(writeSnapshot(s))).toEqual(s);
    expect(readSnapshot('no front matter')).toBeNull();
    expect(snapshotAttachments(s)).toEqual(['Attachments/abc-lamp.png']);
  });

  it('compares texts as kept, added and taken out', () => {
    const parts = compareTexts('The lamp was dark.', 'The lamp was bright.');
    expect(parts.filter((p) => p.kind === 'del').map((p) => p.text).join('')).toContain('dark');
    expect(parts.filter((p) => p.kind === 'add').map((p) => p.text).join('')).toContain('bright');
    expect(parts.filter((p) => p.kind !== 'del').map((p) => p.text).join('')).toBe('The lamp was bright.');
  });

  it('merges this device’s snapshots with the folder’s, including deletions both ways', () => {
    const a = snap('a', 1);
    const b = snap('b', 2);
    const c = snap('c', 3);
    // a: new here; b: in both; c: new in the folder.
    let r = mergeSnapshots([a, b], [b, c], [], ['b']);
    expect(r.list.map((s) => s.id)).toEqual(['c', 'b', 'a']);
    expect(r.upload.map((s) => s.id)).toEqual(['a']);
    // b deleted here: removed from the folder. c deleted elsewhere (known before, gone now): goes here.
    r = mergeSnapshots([a, c], [a, b], ['b'], ['a', 'b', 'c']);
    expect(r.list.map((s) => s.id)).toEqual(['a']);
    expect(r.remove).toEqual(['b']);
  });

  it('thins out automatic versions: all of today, one a day for a month, one a week for three months', () => {
    const HOUR = 3_600_000;
    const now = Date.UTC(2026, 9, 9, 12);
    const v = (id: string, ago: number, auto = true): Snapshot => ({ ...snap(id, now - ago), auto: auto || undefined });
    const list = [
      v('a', 1 * HOUR),
      v('b', 2 * HOUR),
      v('c', 3 * 24 * HOUR), // two on the same day, three days ago: the later kept
      v('d', 3 * 24 * HOUR + 10 * 60_000),
      v('e', 60 * 24 * HOUR),
      v('f', 61 * 24 * HOUR), // same week as e (or the next): at most one each
      v('g', 200 * 24 * HOUR), // too old
      v('h', 400 * 24 * HOUR, false), // taken by hand: always kept
    ];
    const drop = pruneVersions(list, now);
    expect(drop).not.toContain('a');
    expect(drop).not.toContain('b');
    expect(drop).not.toContain('c');
    expect(drop).toContain('d');
    expect(drop).not.toContain('e');
    expect(drop).toContain('g');
    expect(drop).not.toContain('h');
  });
});
