// Snapshots, like Scrivener's: a copy of a note or chapter as it was, kept
// before a big rewrite, to compare with or go back to. Each is a Markdown file
// of its own in the notes folder (`.crumpet/snapshots/<id>.md`), so they reach
// every device; none is ever changed after it's taken.

import { diff_match_patch } from 'diff-match-patch';

export interface Snapshot {
  id: string;
  /** The note or chapter it's a copy of. */
  docId: string;
  kind: 'note' | 'chapter';
  /** What it was called when taken (its title), and a name for the snapshot, if given. */
  title: string;
  name: string;
  at: number;
  words: number;
  /** The text, as Markdown. */
  md: string;
}

export const SNAPSHOT_DIR = '.crumpet/snapshots';

export function snapshotPath(id: string): string {
  return `${SNAPSHOT_DIR}/${id.replace(/[^\w-]/g, '')}.md`;
}

/** The file for a snapshot: a few lines about it, then its text. */
export function writeSnapshot(s: Snapshot): string {
  const meta = { id: s.id, doc: s.docId, kind: s.kind, title: s.title, name: s.name, at: new Date(s.at).toISOString(), words: s.words };
  return `---\n${Object.entries(meta)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n')}\n---\n${s.md}`;
}

export function readSnapshot(text: string): Snapshot | null {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return null;
  const meta: Record<string, unknown> = {};
  for (const line of m[1].split('\n')) {
    const at = line.indexOf(':');
    if (at < 0) continue;
    try {
      meta[line.slice(0, at).trim()] = JSON.parse(line.slice(at + 1).trim());
    } catch {
      // A line that isn't ours.
    }
  }
  const time = Date.parse(String(meta.at));
  if (typeof meta.id !== 'string' || typeof meta.doc !== 'string' || !Number.isFinite(time)) return null;
  return {
    id: meta.id,
    docId: meta.doc,
    kind: meta.kind === 'chapter' ? 'chapter' : 'note',
    title: typeof meta.title === 'string' ? meta.title : '',
    name: typeof meta.name === 'string' ? meta.name : '',
    at: time,
    words: typeof meta.words === 'number' ? meta.words : 0,
    md: m[2],
  };
}

/** Pictures and files a snapshot's text uses (so they're kept while it is). */
export function snapshotAttachments(s: Snapshot): string[] {
  return [...s.md.matchAll(/Attachments\/[^)\s"'\]]+/g)].map((x) => x[0]);
}

export type DiffPart = { kind: 'same' | 'add' | 'del'; text: string };

/** What changed between two texts, in words people would see: kept, added and taken out. */
export function compareTexts(before: string, after: string): DiffPart[] {
  const dmp = new diff_match_patch();
  dmp.Diff_Timeout = 2;
  const diffs = dmp.diff_main(before, after);
  dmp.diff_cleanupSemantic(diffs);
  return diffs.map(([op, text]) => ({ kind: op === 0 ? 'same' : op > 0 ? 'add' : 'del', text }));
}

/**
 * Snapshots after a sync: this device's and the folder's put together. A
 * snapshot deleted here is removed from the folder; one that was in the folder
 * before and has gone was deleted on another device, so it goes here too.
 */
export function mergeSnapshots(local: Snapshot[], remote: Snapshot[], gone: string[], known: string[]): { list: Snapshot[]; upload: Snapshot[]; remove: string[] } {
  const there = new Map(remote.map((s) => [s.id, s]));
  const removed = new Set(gone);
  const seen = new Set(known);
  const list: Snapshot[] = [];
  const upload: Snapshot[] = [];
  for (const s of local) {
    if (there.has(s.id)) list.push(s);
    // In the folder last time, not now: deleted elsewhere.
    else if (seen.has(s.id)) continue;
    else {
      list.push(s);
      upload.push(s);
    }
  }
  for (const s of remote) if (!removed.has(s.id) && !local.some((x) => x.id === s.id)) list.push(s);
  return { list: list.sort((a, b) => b.at - a.at), upload, remove: remote.filter((s) => removed.has(s.id)).map((s) => s.id) };
}
