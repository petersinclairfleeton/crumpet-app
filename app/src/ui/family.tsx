// Characters' relationships, on their cards (parent, partner, sibling, friend,
// rival, mentor, works with, or your own words), and the family tree drawn
// from them: generations in rows, partners side by side, children under
// their parents. Click someone in the tree to open their card.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FAMILY, TIE_KINDS, type Tie, type TieKind, familyTree, tiesOf } from '../data/family';
import type { CastMember, Project } from '../data/types';
import { useAppStore } from './hooks';
import { IconClose } from './icons';

/** A character's ties, on their card: each with the other person (click to open), and a row to add one. */
export function Relationships({ project, member }: { project: Project; member: CastMember }) {
  const store = useAppStore();
  const people = (project.cast ?? []).filter((m) => m.kind === 'character');
  const ties = tiesOf(member.id, people);
  const [kind, setKind] = useState<TieKind | 'child'>('friend');
  const [other, setOther] = useState('');
  const [note, setNote] = useState('');
  const nameOf = (id: string) => people.find((m) => m.id === id)?.name || 'Unnamed';
  const others = people.filter((m) => m.id !== member.id);
  const setTies = (owner: string, next: Tie[]) => store.updateCastMember(project.id, owner, { ties: next.length ? next : undefined });
  const add = () => {
    if (!other) return;
    // "Child of" is kept as the parent's tie, so the tree reads it the same way.
    const back = kind === 'child';
    const owner = back ? other : member.id;
    const to = back ? member.id : other;
    const k: TieKind = back ? 'parent' : kind;
    const mine = people.find((m) => m.id === owner)?.ties ?? [];
    if (mine.some((t) => t.to === to && t.kind === k)) return;
    setTies(owner, [...mine, { to, kind: k, ...(note.trim() ? { note: note.trim() } : {}) }]);
    setOther('');
    setNote('');
  };
  const remove = (owner: string, index: number) => {
    const list = people.find((m) => m.id === owner)?.ties ?? [];
    setTies(owner, list.filter((_, i) => i !== index));
  };
  return (
    <div className="cast-field relationships">
      <span>Relationships</span>
      {ties.length > 0 && (
        <ul className="ties">
          {ties.map((t) => (
            <li key={`${t.owner}-${t.index}`}>
              <span className="tie-kind">{t.label}</span>
              <button type="button" className="link-btn" onClick={() => store.openCast(t.other)}>
                {nameOf(t.other)}
              </button>
              {t.note && t.kind !== 'other' && <small>{t.note}</small>}
              <button type="button" className="icon-btn" aria-label={`Remove: ${t.label} ${nameOf(t.other)}`} onClick={() => remove(t.owner, t.index)}>
                <IconClose size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 ? (
        <div className="tie-add">
          <select aria-label="Relationship" value={kind} onChange={(e) => setKind(e.target.value as TieKind | 'child')}>
            {TIE_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.from}
              </option>
            ))}
            <option value="child">Child of</option>
          </select>
          <select aria-label="Who" value={other} onChange={(e) => setOther(e.target.value)}>
            <option value="">Who?</option>
            {others.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || 'Unnamed'}
              </option>
            ))}
          </select>
          {kind === 'other' && <input aria-label="In your own words" placeholder="Old flame of" value={note} onChange={(e) => setNote(e.target.value)} />}
          <button type="button" className="btn small" disabled={!other} onClick={add}>
            Add
          </button>
        </div>
      ) : (
        <small className="research-empty">Add another character to say how they’re connected.</small>
      )}
    </div>
  );
}

const W = 128;
const H = 44;
const GAP_X = 28;
const GAP_Y = 64;

/** The family tree, drawn from the characters' family ties. */
export function FamilyTreeDialog({ project, onClose }: { project: Project; onClose(): void }) {
  const store = useAppStore();
  const people = (project.cast ?? []).filter((m) => m.kind === 'character');
  const tree = familyTree(people);
  const at = new Map(tree.nodes.map((n) => [n.id, n]));
  const left = (x: number) => 16 + x * (W + GAP_X);
  const top = (g: number) => 16 + g * (H + GAP_Y);
  const width = Math.max(320, ...tree.nodes.map((n) => left(n.x) + W + 16));
  const height = Math.max(120, top(tree.gens) - GAP_Y + 16);
  const others = people.some((m) => (m.ties ?? []).some((t) => !FAMILY.includes(t.kind)));
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog family-dialog" role="dialog" aria-modal="true" aria-label="Family tree" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <header className="dialog-head">
          <h2>Family tree</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        {tree.nodes.length === 0 ? (
          <p className="plan-empty family-empty">Give your characters parents, partners or siblings (Relationships, on each character’s card) and their family tree draws itself here.</p>
        ) : (
          <div className="family-scroll">
            <svg className="family-tree" width={width} height={height} role="img" aria-label={`The family tree: ${tree.nodes.length} people`}>
              {tree.couples.map(([a, b]) => {
                const p = at.get(a)!;
                const q = at.get(b)!;
                const y = top(p.gen) + H / 2;
                const [l, r] = p.x < q.x ? [p, q] : [q, p];
                return <line key={`${a}-${b}`} className="tree-couple" x1={left(l.x) + W} y1={y} x2={left(r.x)} y2={y} />;
              })}
              {tree.births.map(({ child, parents }) => {
                const c = at.get(child);
                const ps = parents.map((id) => at.get(id)).filter((n): n is NonNullable<typeof n> => !!n);
                if (!c || !ps.length) return null;
                const px = ps.reduce((n, p) => n + left(p.x) + W / 2, 0) / ps.length;
                const py = ps.length > 1 ? top(ps[0].gen) + H / 2 : top(ps[0].gen) + H;
                const mid = top(c.gen) - GAP_Y / 2;
                const cx = left(c.x) + W / 2;
                return <path key={child} className="tree-line" d={`M ${px} ${py} V ${mid} H ${cx} V ${top(c.gen)}`} />;
              })}
              {tree.siblings.map(([a, b]) => {
                const p = at.get(a)!;
                const q = at.get(b)!;
                const y = top(p.gen) - 10;
                return <path key={`${a}~${b}`} className="tree-line" d={`M ${left(p.x) + W / 2} ${top(p.gen)} V ${y} H ${left(q.x) + W / 2} V ${top(q.gen)}`} />;
              })}
              {tree.nodes.map((n) => (
                <g
                  key={n.id}
                  className="tree-person"
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.name || 'Unnamed'}: open the card`}
                  onClick={() => (store.openCast(n.id), onClose())}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (store.openCast(n.id), onClose())}
                >
                  <rect x={left(n.x)} y={top(n.gen)} width={W} height={H} rx={10} />
                  <text x={left(n.x) + W / 2} y={top(n.gen) + H / 2 + 5} textAnchor="middle">
                    {(n.name || 'Unnamed').length > 16 ? `${(n.name || 'Unnamed').slice(0, 15)}…` : n.name || 'Unnamed'}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
        {others && <p className="sync-hint family-hint">Friends, rivals and the rest are on each character’s card.</p>}
      </div>
    </div>,
    document.body,
  );
}
