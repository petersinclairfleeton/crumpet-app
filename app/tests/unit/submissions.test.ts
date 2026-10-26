import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../src/data/db';
import { AppStore } from '../../src/data/store';
import {
  type Submission,
  cleanSubmissions,
  daysOut,
  isOut,
  overdue,
  pieceSummary,
  replyTime,
  sentBefore,
  sortSubmissions,
  stillOutAfterOffer,
  submissionsCsv,
  withStatus,
} from '../../src/data/submissions';
import { SyncEngine, type SyncState } from '../../src/sync/engine';
import { MemoryProvider } from '../../src/sync/provider';

const book = { kind: 'project' as const, id: 'p1' };
const sub = (id: string, to: string, extra: Partial<Submission> = {}): Submission => ({ id, title: 'The Lighthouse', of: book, to, kind: 'agent', sent: '2026-09-01', status: 'sent', ...extra });

describe('submissions', () => {
  it('counts days out from sending, or from when they asked for more, and flags what’s past their reply time', () => {
    const s = sub('a', 'Jane Doe, Doe Literary', { wait: 42 });
    expect(daysOut(s, '2026-10-01')).toBe(30);
    expect(overdue(s, '2026-10-01')).toBe(false);
    expect(overdue(s, '2026-10-26')).toBe(true);
    // Asked for the full manuscript on 1 October: the clock starts again.
    const full = withStatus(s, 'full', '2026-10-01');
    expect(full.replied).toBe('2026-10-01');
    expect(daysOut(full, '2026-10-26')).toBe(25);
    expect(overdue(full, '2026-10-26')).toBe(false);
    // Declined: not out, never overdue.
    const no = withStatus(s, 'declined', '2026-10-20');
    expect(isOut(no)).toBe(false);
    expect(overdue(no, '2027-01-01')).toBe(false);
    // Back to waiting: the reply date goes.
    expect(withStatus(no, 'sent', '2026-10-21').replied).toBeUndefined();
  });

  it('lists the other places still holding a piece once it has an offer', () => {
    const list = [sub('a', 'Agent A', { status: 'offer', replied: '2026-10-20' }), sub('b', 'Agent B'), sub('c', 'Agent C', { status: 'declined' }), sub('d', 'Agent D', { status: 'full' }), sub('e', 'Agent E', { title: 'Another book', of: { kind: 'project', id: 'p2' } })];
    const offers = stillOutAfterOffer(list);
    expect(offers).toHaveLength(1);
    expect(offers[0].offer.to).toBe('Agent A');
    expect(offers[0].others.map((s) => s.to)).toEqual(['Agent B', 'Agent D']);
  });

  it('warns before sending a piece to the same place twice (by the book, or by title for pieces of their own)', () => {
    const list = [sub('a', 'Agent A', { status: 'declined' }), { ...sub('b', 'The Paris Review', { kind: 'magazine' }), title: 'Small Hours', of: undefined }];
    expect(sentBefore(list, { title: 'Renamed book', of: book, to: ' agent a ' })?.id).toBe('a');
    expect(sentBefore(list, { title: 'small hours', to: 'The Paris Review' })?.id).toBe('b');
    expect(sentBefore(list, { title: 'Small Hours', to: 'Granta' })).toBeUndefined();
  });

  it('sums up each piece, and how long a place took to reply before', () => {
    const list = [
      sub('a', 'Agent A', { status: 'declined', replied: '2026-09-11' }),
      sub('b', 'Agent B', { status: 'partial', replied: '2026-09-21' }),
      sub('c', 'Agent C', { status: 'offer', replied: '2026-10-01' }),
      sub('d', 'Agent D'),
      sub('e', 'Agent A', { title: 'Another', of: undefined, sent: '2026-10-01', status: 'declined', replied: '2026-10-31' }),
    ];
    const [p, q] = pieceSummary(list);
    expect(p).toMatchObject({ title: 'The Lighthouse', sent: 4, more: 2, offers: 1, declined: 1, out: 2 });
    expect(q).toMatchObject({ title: 'Another', sent: 1, declined: 1, out: 0 });
    expect(replyTime(list, 'agent a')).toBe(20);
    expect(replyTime(list, 'Agent D')).toBeNull();
    // Still out first, newest first.
    expect(sortSubmissions(list).map((s) => s.id)).toEqual(['b', 'd', 'e', 'a', 'c']);
  });

  it('keeps only well-formed submissions from the file, and writes a spreadsheet', () => {
    const clean = cleanSubmissions([sub('a', 'Agent A', { wait: 30.4, fee: 0, notes: '' }), { id: 'x', title: 'No date', to: 'Y' }, null, { ...sub('b', 'B'), status: 'lost', kind: 'pigeon', of: { kind: 'chapter', id: 'c' } }]);
    expect(clean.map((s) => s.id)).toEqual(['a', 'b']);
    expect(clean[0].wait).toBe(30);
    expect(clean[0]).not.toHaveProperty('fee');
    expect(clean[1]).toMatchObject({ status: 'sent', kind: 'other' });
    expect(clean[1]).not.toHaveProperty('of');
    const csv = submissionsCsv([sub('a', 'Doe, Jane', { status: 'declined', replied: '2026-09-11', notes: 'Said "not for me"' })]);
    expect(csv.split('\r\n')[0]).toBe('What,Sent to,Kind,Sent,Status,Reply,Days,Fee,Notes');
    expect(csv.split('\r\n')[1]).toBe('The Lighthouse,"Doe, Jane",Agent,2026-09-01,Declined,2026-09-11,10,,"Said ""not for me"""');
  });
});

let clock = 1_700_000_000_000;
const now = () => (clock += 1000);
let ids = 0;
const newId = () => `id-${++ids}`;
async function device(provider: MemoryProvider) {
  const store = new AppStore(new MemoryStorage(), now);
  await store.load();
  let saved: SyncState | null = null;
  const engine = new SyncEngine(store, provider, { load: async () => (saved ? structuredClone(saved) : null), save: async (s) => void (saved = structuredClone(s)) }, { now, newId });
  return { store, engine };
}

describe('submissions across devices', () => {
  it('reach the other device, and replies logged on both are kept', async () => {
    const cloud = new MemoryProvider();
    const mac = await device(cloud);
    const phone = await device(cloud);
    mac.store.createNote({ title: 'Hello' });
    mac.store.updateSettings({ submissions: [sub('a', 'Agent A'), sub('b', 'Agent B')] });
    await mac.engine.sync();
    expect(cloud.files.get('.crumpet/vault.json')!.text).toContain('"submissions"');
    await phone.engine.sync();
    expect(phone.store.getState().settings.submissions?.map((s) => s.to)).toEqual(['Agent A', 'Agent B']);
    // A reply logged on each before they sync: both kept.
    const list = (d: typeof mac) => d.store.getState().settings.submissions!;
    mac.store.updateSettings({ submissions: list(mac).map((s) => (s.id === 'a' ? withStatus(s, 'declined', '2026-10-20') : s)) });
    phone.store.updateSettings({ submissions: [...list(phone).map((s) => (s.id === 'b' ? withStatus(s, 'full', '2026-10-21') : s)), sub('c', 'Agent C')] });
    await mac.engine.sync();
    await phone.engine.sync();
    await mac.engine.sync();
    for (const d of [mac, phone]) expect(list(d).map((s) => `${s.to}: ${s.status}`)).toEqual(['Agent A: declined', 'Agent B: full', 'Agent C: sent']);
    // Deleted on one device: gone from both.
    phone.store.updateSettings({ submissions: list(phone).filter((s) => s.id !== 'c') });
    await phone.engine.sync();
    await mac.engine.sync();
    expect(list(mac).map((s) => s.id)).toEqual(['a', 'b']);
  });
});
