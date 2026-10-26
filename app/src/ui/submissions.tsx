// Submissions: where each book, story or poem has been sent and what came
// back (data/submissions.ts), in a window opened from the sidebar's menu, a
// book's or a note's menu, or the command palette.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { displayTitle } from '../data/selectors';
import { dayKey } from '../data/stats';
import { newId } from '../data/store';
import {
  SUB_KINDS,
  SUB_STATUSES,
  type SubKind,
  type Submission,
  cleanSubmissions,
  daysBetween,
  daysOut,
  isOut,
  kindName,
  overdue,
  pieceSummary,
  replyTime,
  sentBefore,
  sortSubmissions,
  statusName,
  stillOutAfterOffer,
  submissionsCsv,
  withStatus,
} from '../data/submissions';
import { download } from '../data/wordfiles';
import { useAppState, useAppStore } from './hooks';
import { IconClose, IconDownload, IconPlus, IconTrash } from './icons';

const OPEN = 'crumpet:submissions';
type Of = NonNullable<Submission['of']>;

/** Opens the Submissions window, on one book's or note's submissions if given. */
export const openSubmissions = (of?: Of) => window.dispatchEvent(new CustomEvent(OPEN, { detail: of ?? null }));

export function SubmissionsHost() {
  const [open, setOpen] = useState<{ of: Of | null } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setOpen({ of: ((e as CustomEvent).detail as Of | null) ?? null });
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  return open ? <SubmissionsDialog of={open.of ?? undefined} onClose={() => setOpen(null)} /> : null;
}

const fmtDay = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function SubmissionsDialog({ of, onClose }: { of?: Of; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const panel = useRef<HTMLDivElement>(null);
  const list = useMemo(() => cleanSubmissions(state.settings.submissions), [state.settings.submissions]);
  const today = dayKey(Date.now());
  const save = (next: Submission[]) => store.updateSettings({ submissions: next.length ? next : undefined });

  // A piece's current name: the book's or note's, else the title written.
  const nameOf = (s: Pick<Submission, 'title' | 'of'>) => {
    if (s.of?.kind === 'project') return state.projects.find((p) => p.id === s.of!.id)?.name || s.title;
    if (s.of?.kind === 'note') {
      const n = state.notes.find((x) => x.id === s.of!.id);
      return n ? displayTitle(n) : s.title;
    }
    return s.title;
  };
  const pieces = pieceSummary(list);
  const [piece, setPiece] = useState<string>(() => (of ? `${of.kind}:${of.id}` : ''));
  const pieceKey = (p: Pick<Submission, 'title' | 'of'>) => (p.of ? `${p.of.kind}:${p.of.id}` : `t:${p.title.trim().toLowerCase()}`);
  const [show, setShow] = useState<'out' | 'all'>('all');
  const [editing, setEditing] = useState<Submission | 'new' | null>(() => (of && !list.some((s) => s.of?.kind === of.kind && s.of.id === of.id) ? 'new' : null));
  const shown = sortSubmissions(list.filter((s) => (!piece || pieceKey(s) === piece) && (show === 'all' || isOut(s))));
  const offers = stillOutAfterOffer(list).filter((o) => !piece || pieceKey(o.offer) === piece);
  const late = list.filter((s) => overdue(s, today)).length;
  const out = list.filter(isOut).length;

  // Focus once, on opening; Escape closes (or leaves the form first).
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    panel.current?.focus();
  }, []);

  const ofName = of ? nameOf({ title: '', of }) : '';
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="dialog subs-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Submissions"
        tabIndex={-1}
        ref={panel}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.stopPropagation();
          if (editing) setEditing(null);
          else close.current();
        }}
      >
        <header className="dialog-head">
          <h2>Submissions</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings subs-body">
          <p className="sync-hint">
            Where your books, stories and poems have been sent (agents, magazines, contests, publishers) and what came back. Change a submission’s status when they reply; Crumpet dates it and tells you what’s past their reply time.
          </p>
          {list.length > 0 && (
            <p className="subs-totals" role="status">
              {plural(list.length, 'submission')} · {out} still out
              {late > 0 && <> · <b className="subs-late">{late} past their reply time</b></>}
            </p>
          )}
          {offers.map(({ offer, others }) => (
            <div key={offer.id} className="subs-offer" role="alert">
              <p>
                <b>{nameOf(offer)}</b> has {offer.kind === 'agent' ? 'an offer' : 'been accepted'} from {offer.to}. {others.length === 1 ? 'One other place still has it' : `${others.length} other places still have it`}: {others.map((s) => s.to).join(', ')}. Let them know (most ask you to), then:
              </p>
              <button type="button" className="btn small" onClick={() => save(list.map((s) => (others.includes(s) ? withStatus(s, 'withdrawn', today) : s)))}>
                Mark {others.length === 1 ? 'it' : 'them'} withdrawn
              </button>
            </div>
          ))}
          <div className="subs-head">
            {pieces.length > 1 && (
              <select aria-label="Which piece" value={piece} onChange={(e) => setPiece(e.target.value)}>
                <option value="">Everything</option>
                {pieces.map((p) => (
                  <option key={pieceKey(p)} value={pieceKey(p)}>
                    {nameOf(p)}
                  </option>
                ))}
              </select>
            )}
            {list.length > 0 && (
              <div className="segmented" role="radiogroup" aria-label="Show">
                <button type="button" role="radio" aria-checked={show === 'all'} onClick={() => setShow('all')}>
                  All
                </button>
                <button type="button" role="radio" aria-checked={show === 'out'} onClick={() => setShow('out')}>
                  Still out
                </button>
              </div>
            )}
            <span className="grow" />
            {!editing && (
              <button type="button" className="btn small primary" onClick={() => setEditing('new')}>
                <IconPlus size={12} /> Add a submission
              </button>
            )}
          </div>
          {editing && (
            <SubForm
              key={editing === 'new' ? 'new' : editing.id}
              start={editing === 'new' ? undefined : editing}
              of={of}
              ofName={ofName}
              list={list}
              nameOf={nameOf}
              today={today}
              onCancel={() => setEditing(null)}
              onSave={(s) => {
                save(editing === 'new' ? [...list, s] : list.map((x) => (x.id === s.id ? s : x)));
                setEditing(null);
              }}
            />
          )}
          {piece && (() => {
            const p = pieces.find((x) => pieceKey(x) === piece);
            return p ? (
              <p className="subs-piece">
                <b>{nameOf(p)}</b>: sent to {plural(p.sent, 'place')}, {p.more} asked for more{p.offers ? ` (${plural(p.offers, 'offer')})` : ''}, {p.declined} no, {p.out} still out.
              </p>
            ) : null;
          })()}
          {shown.length > 0 ? (
            <ul className="subs-list" aria-label="Submissions">
              {shown.map((s) => {
                const late = overdue(s, today);
                const took = replyTime(list.filter((x) => x.id !== s.id), s.to);
                return (
                  <li key={s.id} className={`subs-row${isOut(s) ? ' out' : ''}${late ? ' late' : ''}`}>
                    <div className="subs-main">
                      <span className="subs-to">
                        <b>{s.to}</b> <small>{kindName(s.kind)}</small>
                      </span>
                      <span className="subs-what">
                        {!piece && <>{nameOf(s)} · </>}sent {fmtDay(s.sent)}
                        {isOut(s) ? ` · ${plural(daysOut(s, today), 'day')}${s.status === 'sent' ? ' out' : ' since they asked'}` : s.replied ? ` · ${s.status === 'withdrawn' ? 'withdrawn' : 'replied'} ${fmtDay(s.replied)} (${plural(daysBetween(s.sent, s.replied), 'day')})` : ''}
                        {s.fee ? ` · fee ${s.fee}` : ''}
                      </span>
                      {late && <span className="subs-flag">Past their reply time ({plural(s.wait!, 'day')}): nudge them, or close it as no reply.</span>}
                      {isOut(s) && !late && took !== null && <span className="subs-note">They took {plural(took, 'day')} to reply before.</span>}
                      {s.notes && <span className="subs-note">{s.notes}</span>}
                    </div>
                    <select className={`subs-status st-${s.status}`} aria-label={`Status: ${nameOf(s)} at ${s.to}`} value={s.status} onChange={(e) => save(list.map((x) => (x.id === s.id ? withStatus(x, e.target.value as Submission['status'], today) : x)))}>
                      {SUB_STATUSES.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                    <span className="subs-actions">
                      <button type="button" className="btn quiet small" onClick={() => setEditing(s)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Delete: ${nameOf(s)} at ${s.to}`}
                        onClick={() => {
                          if (confirm(`Delete the submission of “${nameOf(s)}” to ${s.to}?`)) save(list.filter((x) => x.id !== s.id));
                        }}
                      >
                        <IconTrash size={13} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            !editing && <p className="plan-empty">{list.length ? 'Nothing still out.' : 'No submissions yet. Add one when you send a query, a story or an entry.'}</p>
          )}
          {list.length > 0 && (
            <div className="subs-foot">
              <button type="button" className="btn quiet small" onClick={() => download(new TextEncoder().encode(submissionsCsv(sortSubmissions(list), nameOf)), 'Submissions.csv', 'text/csv')}>
                <IconDownload size={13} /> Download as a spreadsheet (.csv)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SubForm(props: {
  start?: Submission;
  of?: Of;
  ofName: string;
  list: Submission[];
  nameOf(s: Pick<Submission, 'title' | 'of'>): string;
  today: string;
  onCancel(): void;
  onSave(s: Submission): void;
}) {
  const state = useAppState();
  const { start, list, today } = props;
  const [title, setTitle] = useState(start ? props.nameOf(start) : props.ofName);
  const [to, setTo] = useState(start?.to ?? '');
  const [kind, setKind] = useState<SubKind>(start?.kind ?? (props.of?.kind === 'note' ? 'magazine' : 'agent'));
  const [sent, setSent] = useState(start?.sent ?? today);
  const [wait, setWait] = useState(start?.wait ? String(start.wait) : '');
  const [fee, setFee] = useState(start?.fee ? String(start.fee) : '');
  const [notes, setNotes] = useState(start?.notes ?? '');

  // What it is: a book or a note by name (so a rename follows), else a title of its own.
  const books = state.projects;
  const notes2 = state.notes.filter((n) => !n.trashedAt && !n.projectId);
  const ofFor = (t: string): Submission['of'] => {
    const key = t.trim().toLowerCase();
    if (start?.of && props.nameOf({ title: '', of: start.of }).trim().toLowerCase() === key) return start.of;
    if (props.of && props.ofName.trim().toLowerCase() === key) return props.of;
    const b = books.find((p) => p.name.trim().toLowerCase() === key);
    if (b) return { kind: 'project', id: b.id };
    const n = notes2.find((x) => displayTitle(x).trim().toLowerCase() === key);
    return n ? { kind: 'note', id: n.id } : undefined;
  };
  const draft = { title, of: ofFor(title), to };
  const before = sentBefore(
    list.filter((s) => s.id !== start?.id),
    draft,
  );
  const places = [...new Set(list.map((s) => s.to.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const ok = title.trim() && to.trim() && /^\d{4}-\d{2}-\d{2}$/.test(sent);

  const submit = () => {
    if (!ok) return;
    const n = Number(wait);
    const f = Number(fee.replace(',', '.'));
    const s: Submission = {
      ...(start ?? { status: 'sent' as const }),
      id: start?.id ?? newId(),
      title: title.trim(),
      to: to.trim(),
      kind,
      sent,
    };
    if (draft.of) s.of = draft.of;
    else delete s.of;
    if (n > 0) s.wait = Math.round(n);
    else delete s.wait;
    if (f > 0) s.fee = f;
    else delete s.fee;
    if (notes.trim()) s.notes = notes.trim();
    else delete s.notes;
    props.onSave(s);
  };

  return (
    <form
      className="subs-form"
      aria-label={start ? 'Change the submission' : 'Add a submission'}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label>
        <span>What</span>
        <input list="subs-works" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A book, story or poem" autoFocus={!props.ofName} required />
        <datalist id="subs-works">
          {books.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
          {notes2.slice(0, 200).map((n) => (
            <option key={n.id} value={displayTitle(n)} />
          ))}
        </datalist>
      </label>
      <label>
        <span>Sent to</span>
        <input list="subs-places" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Agent and agency, magazine, contest" autoFocus={!!props.ofName && !start} required />
        <datalist id="subs-places">
          {places.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>
      <label>
        <span>Kind</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as SubKind)}>
          {SUB_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Sent on</span>
        <input type="date" value={sent} max={today} onChange={(e) => setSent(e.target.value)} required />
      </label>
      <label>
        <span>They reply in (days)</span>
        <input inputMode="numeric" value={wait} onChange={(e) => setWait(e.target.value.replace(/\D/g, ''))} placeholder="90" />
      </label>
      <label>
        <span>Fee</span>
        <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="None" />
      </label>
      <label className="wide">
        <span>Notes</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who you addressed, what they asked for, the reply…" />
      </label>
      {before && (
        <p className="subs-before wide" role="status">
          You sent this to {before.to} on {fmtDay(before.sent)} ({statusName(before.status).toLowerCase()}).
        </p>
      )}
      <span className="subs-form-actions wide">
        <button type="submit" className="btn small primary" disabled={!ok}>
          {start ? 'Save' : 'Add'}
        </button>
        <button type="button" className="btn quiet small" onClick={props.onCancel}>
          Cancel
        </button>
      </span>
    </form>
  );
}

