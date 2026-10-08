// Writing stats across devices. Each device keeps its own words-per-day in a
// file of its own, `.crumpet/stats/<device>.json`, written only by that
// device, so there is never anything to merge: every device reads the
// others' files and adds their days to its own.

import type { Entry, Provider } from './provider';
import { META_DIR } from './layout';

export const STATS_DIR = `${META_DIR}/stats`;

/** Stats files as last read or written: path → revision and text. */
export type StatsCache = Record<string, { rev: string; text: string }>;

export interface StatsFile {
  device: string;
  /** Words written each day (YYYY-MM-DD). */
  days: Record<string, number>;
}

export function statsPath(device: string): string {
  return `${STATS_DIR}/${device.replace(/[^\w-]/g, '')}.json`;
}

export function writeStats(device: string, days: Record<string, number>): string {
  const sorted = Object.fromEntries(Object.entries(days).filter(([, n]) => n > 0).sort(([a], [b]) => (a < b ? -1 : 1)));
  return `${JSON.stringify({ device, days: sorted } satisfies StatsFile, null, 2)}\n`;
}

/** A stats file's days, tidied (it may have been edited by hand). */
export function parseStats(text: string): Record<string, number> {
  try {
    const j = JSON.parse(text) as Partial<StatsFile>;
    const out: Record<string, number> = {};
    for (const [day, n] of Object.entries(j?.days ?? {})) if (/^\d{4}-\d{2}-\d{2}$/.test(day) && typeof n === 'number' && n > 0) out[day] = Math.round(n);
    return out;
  } catch {
    return {};
  }
}

/**
 * Writes this device's file if its days changed, and reads every other
 * device's (only those changed since last time). Returns the other devices'
 * days, by device id, and the cache for next time.
 */
export async function syncStats(provider: Provider, entries: Entry[], cache: StatsCache, device: string, days: Record<string, number>): Promise<{ others: Record<string, Record<string, number>>; cache: StatsCache }> {
  const own = statsPath(device);
  const next: StatsCache = {};
  const text = writeStats(device, days);
  const listed = entries.find((e) => e.path === own);
  const nothing = !Object.values(days).some((n) => n > 0);
  // A device that hasn't written anything yet needs no file.
  if (nothing && !listed) {
    // Nothing to write.
  } else if (!listed || cache[own]?.text !== text || cache[own]?.rev !== listed.rev) {
    const e = await provider.write(own, text);
    next[own] = { rev: e.rev, text };
  } else if (cache[own]) next[own] = cache[own];

  const others: Record<string, Record<string, number>> = {};
  for (const e of entries) {
    if (e.kind !== 'file' || e.path === own || !e.path.startsWith(`${STATS_DIR}/`) || !e.path.endsWith('.json')) continue;
    const cached = cache[e.path];
    const t = cached && cached.rev === e.rev ? cached.text : (await provider.read(e.path)).text;
    next[e.path] = { rev: e.rev, text: t };
    const id = e.path.slice(STATS_DIR.length + 1, -'.json'.length);
    others[id] = parseStats(t);
  }
  return { others, cache: next };
}
