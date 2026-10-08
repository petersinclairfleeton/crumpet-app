import { describe, expect, it } from 'vitest';
import { type Snapshot, compareTexts, mergeSnapshots, readSnapshot, snapshotAttachments, writeSnapshot } from '../../src/data/snapshots';

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
});
