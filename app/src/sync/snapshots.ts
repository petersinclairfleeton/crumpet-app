// Snapshots to and from the notes folder: one file each in
// `.crumpet/snapshots/`. A snapshot never changes once taken, so a sync only
// copies new ones each way and removes deleted ones (see data/snapshots.ts).

import type { Entry, Provider } from './provider';
import { SNAPSHOT_DIR, type Snapshot, mergeSnapshots, readSnapshot, snapshotPath, writeSnapshot } from '../data/snapshots';

/** Returns the snapshots after the sync, and the ids now in the folder (for next time). */
export async function syncSnapshots(provider: Provider, entries: Entry[], known: string[], local: Snapshot[], gone: string[]): Promise<{ list: Snapshot[]; known: string[] }> {
  const files = entries.filter((e) => e.kind === 'file' && e.path.startsWith(`${SNAPSHOT_DIR}/`) && e.path.endsWith('.md'));
  const mine = new Map(local.map((s) => [snapshotPath(s.id), s]));
  const remote: Snapshot[] = [];
  for (const e of files) {
    const have = mine.get(e.path);
    if (have) remote.push(have);
    else {
      // Only new ones are read (the rest are here already).
      const s = readSnapshot((await provider.read(e.path)).text);
      if (s && snapshotPath(s.id) === e.path) remote.push(s);
    }
  }
  const { list, upload, remove } = mergeSnapshots(local, remote, gone, known);
  for (const s of upload) await provider.write(snapshotPath(s.id), writeSnapshot(s));
  for (const id of remove) await provider.remove(snapshotPath(id));
  return { list, known: list.map((s) => s.id) };
}
