// Submissions (like QueryTracker or Duotrope, kept with your own writing):
// where each book, story or poem has been sent (agents, magazines, contests,
// publishers), when, and what came back. Shared by every device (a shared
// setting, merged one submission at a time), so a reply logged on the phone
// shows on the computer.

export type SubKind = 'agent' | 'magazine' | 'contest' | 'publisher' | 'other';
export const SUB_KINDS: { id: SubKind; name: string }[] = [
  { id: 'agent', name: 'Agent' },
  { id: 'magazine', name: 'Magazine or journal' },
  { id: 'contest', name: 'Contest or prize' },
  { id: 'publisher', name: 'Publisher' },
  { id: 'other', name: 'Something else' },
];

export type SubStatus = 'sent' | 'partial' | 'full' | 'held' | 'offer' | 'declined' | 'noreply' | 'withdrawn';
export const SUB_STATUSES: { id: SubStatus; name: string; out: boolean }[] = [
  { id: 'sent', name: 'Sent, waiting', out: true },
  { id: 'partial', name: 'Asked for pages', out: true },
  { id: 'full', name: 'Asked for the full manuscript', out: true },
  { id: 'held', name: 'Shortlisted or held', out: true },
  { id: 'offer', name: 'Offer or accepted', out: false },
  { id: 'declined', name: 'Declined', out: false },
  { id: 'noreply', name: 'No reply (closed)', out: false },
  { id: 'withdrawn', name: 'Withdrawn', out: false },
];

/** A piece sent somewhere. */
export interface Submission {
  id: string;
  /** What was sent: its title as written, and the book or note it is (so a rename follows). */
  title: string;
  of?: { kind: 'project' | 'note'; id: string };
  /** Where it went: the agent and agency, the magazine, the contest. */
  to: string;
  kind: SubKind;
  /** When it was sent (YYYY-MM-DD). */
  sent: string;
  status: SubStatus;
  /** When the latest reply came (YYYY-MM-DD). */
  replied?: string;
  /** How many days they say they take to reply. */
  wait?: number;
  /** A fee paid (contests, some magazines), in your own currency. */
  fee?: number;
  notes?: string;
}

export const isOut = (s: Pick<Submission, 'status'>) => SUB_STATUSES.find((x) => x.id === s.status)?.out ?? false;
export const statusName = (id: SubStatus) => SUB_STATUSES.find((x) => x.id === id)?.name ?? id;
export const kindName = (id: SubKind) => SUB_KINDS.find((x) => x.id === id)?.name ?? id;

/** Whole days from one date to another (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const at = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((at(to) - at(from)) / 86400000);
}

/** How long it's been out: since it was sent, or since they last asked for more. */
export function daysOut(s: Submission, today: string): number {
  return Math.max(0, daysBetween(s.status === 'sent' ? s.sent : (s.replied ?? s.sent), today));
}

/** Still out and past the time they said they'd take (a nudge, or time to close it as no reply). */
export function overdue(s: Submission, today: string): boolean {
  return isOut(s) && !!s.wait && daysOut(s, today) > s.wait;
}

/** The same piece: the same book or note, or else the same title. */
export function samePiece(a: Pick<Submission, 'title' | 'of'>, b: Pick<Submission, 'title' | 'of'>): boolean {
  if (a.of && b.of) return a.of.kind === b.of.kind && a.of.id === b.of.id;
  return a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
}

/** A piece's other submissions still out once it has an offer: they need telling (simultaneous submissions). */
export function stillOutAfterOffer(list: Submission[]): { offer: Submission; others: Submission[] }[] {
  const out: { offer: Submission; others: Submission[] }[] = [];
  for (const offer of list.filter((s) => s.status === 'offer')) {
    if (out.some((o) => samePiece(o.offer, offer))) continue;
    const others = list.filter((s) => s.id !== offer.id && isOut(s) && samePiece(s, offer));
    if (others.length) out.push({ offer, others });
  }
  return out;
}

/** Sent this piece to this place before (so you don't send twice, or resend after a no). */
export function sentBefore(list: Submission[], draft: Pick<Submission, 'title' | 'of' | 'to'>): Submission | undefined {
  const to = draft.to.trim().toLowerCase();
  if (!to || !draft.title.trim()) return undefined;
  return list.find((s) => s.to.trim().toLowerCase() === to && samePiece(s, draft));
}

/** For each piece: how many times sent, how many asked for more (pages, the whole, a shortlist, an offer), declined, still out. */
export function pieceSummary(list: Submission[]): { title: string; of?: Submission['of']; sent: number; more: number; offers: number; declined: number; out: number }[] {
  const out: ReturnType<typeof pieceSummary> = [];
  for (const s of list) {
    let p = out.find((x) => samePiece(x, s));
    if (!p) out.push((p = { title: s.title, of: s.of, sent: 0, more: 0, offers: 0, declined: 0, out: 0 }));
    p.sent++;
    if (s.status === 'partial' || s.status === 'full' || s.status === 'held' || s.status === 'offer') p.more++;
    if (s.status === 'offer') p.offers++;
    if (s.status === 'declined' || s.status === 'noreply') p.declined++;
    if (isOut(s)) p.out++;
  }
  return out;
}

/** How long a place took to reply before (its answered submissions' average, in days). */
export function replyTime(list: Submission[], to: string): number | null {
  const key = to.trim().toLowerCase();
  const times = list.filter((s) => s.to.trim().toLowerCase() === key && s.replied && s.status !== 'withdrawn').map((s) => daysBetween(s.sent, s.replied!));
  return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
}

/** A change of status, dating the reply (today) when it's one from them. */
export function withStatus(s: Submission, status: SubStatus, today: string): Submission {
  if (status === s.status) return s;
  const { replied: _r, ...rest } = s;
  return status === 'sent' ? rest : { ...rest, status, replied: today };
}

/** The list newest first, those still out before the rest. */
export function sortSubmissions(list: Submission[]): Submission[] {
  return [...list].sort((a, b) => Number(isOut(b)) - Number(isOut(a)) || b.sent.localeCompare(a.sent) || a.to.localeCompare(b.to));
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Submissions from the shared settings file, only what's well formed. */
export function cleanSubmissions(raw: unknown): Submission[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    const s = x as Partial<Submission>;
    if (!s || typeof s.id !== 'string' || typeof s.title !== 'string' || typeof s.to !== 'string' || typeof s.sent !== 'string' || !DAY.test(s.sent)) return [];
    const out: Submission = {
      id: s.id,
      title: s.title,
      to: s.to,
      kind: SUB_KINDS.some((k) => k.id === s.kind) ? s.kind! : 'other',
      sent: s.sent,
      status: SUB_STATUSES.some((k) => k.id === s.status) ? s.status! : 'sent',
    };
    if (s.of && (s.of.kind === 'project' || s.of.kind === 'note') && typeof s.of.id === 'string') out.of = { kind: s.of.kind, id: s.of.id };
    if (typeof s.replied === 'string' && DAY.test(s.replied)) out.replied = s.replied;
    if (typeof s.wait === 'number' && s.wait > 0 && s.wait < 3650) out.wait = Math.round(s.wait);
    if (typeof s.fee === 'number' && s.fee > 0) out.fee = s.fee;
    if (typeof s.notes === 'string' && s.notes) out.notes = s.notes;
    return [out];
  });
}

const csvCell = (v: string | number | undefined) => {
  const t = v === undefined ? '' : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** The list as a spreadsheet (CSV), for keeping elsewhere or sharing with an agent. */
export function submissionsCsv(list: Submission[], titleOf: (s: Submission) => string = (s) => s.title): string {
  const rows = [['What', 'Sent to', 'Kind', 'Sent', 'Status', 'Reply', 'Days', 'Fee', 'Notes']];
  for (const s of list) rows.push([titleOf(s), s.to, kindName(s.kind), s.sent, statusName(s.status), s.replied ?? '', String(s.replied ? daysBetween(s.sent, s.replied) : ''), s.fee ? String(s.fee) : '', s.notes ?? '']);
  return `${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
