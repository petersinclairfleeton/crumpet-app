// A board, like Obsidian's Canvas: cards on an open surface (text you type,
// notes dragged in from the list or sidebar, and groups to gather them),
// with arrows between them.
// - Double-click empty space for a text card; double-click a card to edit it
//   (or, for a note, to open it).
// - Drag a card to move it, its corner to resize it, a dot on its edge to
//   draw an arrow to another card.
// - Drag the background to move round; scroll (or the buttons) to zoom.
// - Delete removes what's selected; a selected card's bar sets its colour.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fillCell } from '@crumpet/editor/cells';
import { useAppState, useAppStore } from './hooks';
import { type Arrow, type Board, type Card, CARD_COLORS, type CardColor, boardDoc, boardOf, writeBoard } from '../data/board';
import { newId } from '../data/store';
import { displayTitle, preview } from '../data/selectors';
import type { Note } from '../data/types';
import { usePanes } from './panes';
import { dragged } from './tabdrag';

type Side = NonNullable<Arrow['fromSide']>;
type Drag =
  | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'move'; ids: string[]; sx: number; sy: number; start: Map<string, { x: number; y: number }>; moved: boolean }
  | { kind: 'resize'; id: string; sx: number; sy: number; w: number; h: number }
  | { kind: 'link'; from: string; side: Side; x: number; y: number };

const anchor = (c: Card, s: Side) => (s === 'top' ? { x: c.x + c.width / 2, y: c.y } : s === 'bottom' ? { x: c.x + c.width / 2, y: c.y + c.height } : s === 'left' ? { x: c.x, y: c.y + c.height / 2 } : { x: c.x + c.width, y: c.y + c.height / 2 });
const normal = (s: Side) => (s === 'top' ? { x: 0, y: -1 } : s === 'bottom' ? { x: 0, y: 1 } : s === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 });

/** The sides an arrow leaves and arrives by, facing each other. */
function sidesFor(a: Card, b: Card): [Side, Side] {
  const dx = b.x + b.width / 2 - (a.x + a.width / 2);
  const dy = b.y + b.height / 2 - (a.y + a.height / 2);
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? ['right', 'left'] : ['left', 'right']) : dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

function curve(p: { x: number; y: number }, ps: Side, q: { x: number; y: number }, qs: Side): string {
  const d = Math.max(40, Math.hypot(q.x - p.x, q.y - p.y) / 3);
  const n1 = normal(ps);
  const n2 = normal(qs);
  return `M${p.x},${p.y} C${p.x + n1.x * d},${p.y + n1.y * d} ${q.x + n2.x * d},${q.y + n2.y * d} ${q.x},${q.y}`;
}

/** A text card's words, drawn with their formatting (one line of Markdown per line). */
function CardText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = '';
    for (const line of text.split('\n')) {
      const p = document.createElement('div');
      p.className = line.startsWith('# ') ? 'card-line card-h' : 'card-line';
      fillCell(p, line.replace(/^#+\s+/, ''));
      if (!line) p.innerHTML = '&nbsp;';
      el.appendChild(p);
    }
  }, [text]);
  return <div ref={ref} className="card-text" />;
}

export function BoardView({ note }: { note: Note }) {
  const store = useAppStore();
  const state = useAppState();
  const panes = usePanes();
  const [board, setBoard] = useState<Board>(() => boardOf(note));
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<{ kind: 'card' | 'arrow'; id: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [link, setLink] = useState<{ from: string; side: Side; x: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const saved = useRef(writeBoard(board));
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Changes are saved a moment after they're made; changes from elsewhere (another device) come in when nothing's being edited.
  const commit = useCallback(
    (next: Board) => {
      setBoard(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const json = writeBoard(next);
        if (json === saved.current) return;
        saved.current = json;
        store.setDoc(note.id, boardDoc(next));
      }, 300);
    },
    [store, note.id],
  );
  useEffect(() => {
    const json = writeBoard(boardOf(note));
    if (json !== saved.current && !drag.current && !editing) {
      saved.current = json;
      setBoard(boardOf(note));
    }
  }, [note]); // eslint-disable-line react-hooks/exhaustive-deps
  // Leaving the board: what's not saved yet is saved at once.
  const latest = useRef(board);
  latest.current = board;
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      const json = writeBoard(latest.current);
      if (json !== saved.current) store.setDoc(note.id, boardDoc(latest.current));
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const notes = useMemo(() => new Map(state.notes.map((n) => [n.id, n])), [state.notes]);
  const byId = useMemo(() => new Map(board.nodes.map((n) => [n.id, n])), [board.nodes]);

  /** A point on the board from a point on the screen. */
  const toBoard = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
  };
  const addCard = (card: Omit<Card, 'id'>, edit = false, free = false) => {
    const c = { ...card, id: newId().slice(0, 16) } as Card;
    // From the toolbar: step right until it doesn't sit on another card.
    const overlaps = () => board.nodes.some((n) => n.type !== 'group' && c.x < n.x + n.width && n.x < c.x + c.width && c.y < n.y + n.height && n.y < c.y + c.height);
    for (let i = 0; free && c.type !== 'group' && i < 30 && overlaps(); i++) c.x += 40;
    commit({ ...board, nodes: card.type === 'group' ? [c, ...board.nodes] : [...board.nodes, c] });
    setSelected({ kind: 'card', id: c.id });
    if (edit) setEditing(c.id);
    return c;
  };
  const update = (id: string, patch: Partial<Card>) => commit({ ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  const remove = () => {
    if (!selected) return;
    if (selected.kind === 'arrow') commit({ ...board, edges: board.edges.filter((e) => e.id !== selected.id) });
    else commit({ nodes: board.nodes.filter((n) => n.id !== selected.id), edges: board.edges.filter((e) => e.fromNode !== selected.id && e.toNode !== selected.id) });
    setSelected(null);
  };
  /** The middle of what's showing, on the board. */
  const centre = () => {
    const r = box.current!.getBoundingClientRect();
    return toBoard(r.left + r.width / 2, r.top + r.height / 2);
  };
  const fit = () => {
    const el = box.current;
    if (!el || !board.nodes.length) return setView({ x: el ? el.clientWidth / 2 : 0, y: el ? el.clientHeight / 2 : 0, k: 1 });
    const minX = Math.min(...board.nodes.map((n) => n.x)) - 40;
    const minY = Math.min(...board.nodes.map((n) => n.y)) - 40;
    const maxX = Math.max(...board.nodes.map((n) => n.x + n.width)) + 40;
    const maxY = Math.max(...board.nodes.map((n) => n.y + n.height)) + 40;
    const k = Math.min(1.5, Math.max(0.2, Math.min(el.clientWidth / (maxX - minX), el.clientHeight / (maxY - minY))));
    setView({ k, x: (el.clientWidth - (maxX - minX) * k) / 2 - minX * k, y: (el.clientHeight - (maxY - minY) * k) / 2 - minY * k });
  };
  // Opens fitted to what's on it.
  useEffect(() => fit(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const zoom = (f: number, cx?: number, cy?: number) => {
    const el = box.current!;
    const px = cx ?? el.clientWidth / 2;
    const py = cy ?? el.clientHeight / 2;
    const k = Math.min(3, Math.max(0.15, view.k * f));
    setView({ k, x: px - ((px - view.x) * k) / view.k, y: py - ((py - view.y) * k) / view.k });
  };

  // Delete removes the selection; Esc lets go of it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || !box.current?.contains(document.activeElement)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault();
        remove();
      } else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pan') setView((v) => ({ ...v, x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }));
    else if (d.kind === 'move') {
      const dx = (e.clientX - d.sx) / view.k;
      const dy = (e.clientY - d.sy) / view.k;
      if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
      setBoard((b) => ({ ...b, nodes: b.nodes.map((n) => (d.start.has(n.id) ? { ...n, x: d.start.get(n.id)!.x + dx, y: d.start.get(n.id)!.y + dy } : n)) }));
    } else if (d.kind === 'resize') {
      const w = Math.max(80, d.w + (e.clientX - d.sx) / view.k);
      const h = Math.max(50, d.h + (e.clientY - d.sy) / view.k);
      setBoard((b) => ({ ...b, nodes: b.nodes.map((n) => (n.id === d.id ? { ...n, width: w, height: h } : n)) }));
    } else if (d.kind === 'link') {
      const p = toBoard(e.clientX, e.clientY);
      setLink({ from: d.from, side: d.side, x: p.x, y: p.y });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'move' || d.kind === 'resize') commit(board);
    if (d.kind === 'link') {
      setLink(null);
      const target = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-card]')?.dataset.card;
      const a = byId.get(d.from);
      const b = target ? byId.get(target) : undefined;
      if (a && b && a.id !== b.id) {
        const [, to] = sidesFor(a, b);
        commit({ ...board, edges: [...board.edges, { id: newId().slice(0, 16), fromNode: a.id, fromSide: d.side, toNode: b.id, toSide: to }] });
      }
    }
  };

  const startMove = (e: React.PointerEvent, c: Card) => {
    if (editing === c.id) return;
    e.stopPropagation();
    box.current?.focus({ preventScroll: true });
    setSelected({ kind: 'card', id: c.id });
    // A group carries the cards inside it.
    const inside = c.type === 'group' ? board.nodes.filter((n) => n.id !== c.id && n.x >= c.x && n.y >= c.y && n.x + n.width <= c.x + c.width && n.y + n.height <= c.y + c.height) : [];
    const ids = [c.id, ...inside.map((n) => n.id)];
    drag.current = { kind: 'move', ids, sx: e.clientX, sy: e.clientY, start: new Map(board.nodes.filter((n) => ids.includes(n.id)).map((n) => [n.id, { x: n.x, y: n.y }])), moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const selCard = selected?.kind === 'card' ? byId.get(selected.id) : undefined;
  const groups = board.nodes.filter((n) => n.type === 'group');
  const cards = board.nodes.filter((n) => n.type !== 'group');

  return (
    <div className="board">
      <div className="board-tools" role="toolbar" aria-label="Board">
        <button type="button" className="btn small" onClick={() => {
          const p = centre();
          addCard({ type: 'text', x: p.x - 125, y: p.y - 60, width: 250, height: 120, text: '' }, true, true);
        }}>
          + Text card
        </button>
        <NotePicker
          notes={state.notes.filter((n) => n.trashedAt === null && n.id !== note.id && !n.projectId)}
          onPick={(n) => {
            const p = centre();
            addCard({ type: 'file', x: p.x - 125, y: p.y - 70, width: 260, height: 140, file: displayTitle(n), note: n.id }, false, true);
          }}
        />
        <button type="button" className="btn quiet small" onClick={() => {
          const p = centre();
          addCard({ type: 'group', x: p.x - 250, y: p.y - 150, width: 500, height: 300, label: 'Group' }, true);
        }}>
          + Group
        </button>
        <span className="grow" />
        <button type="button" className="icon-btn" aria-label="Zoom out" onClick={() => zoom(1 / 1.25)}>
          −
        </button>
        <span className="board-zoom">{Math.round(view.k * 100)}%</span>
        <button type="button" className="icon-btn" aria-label="Zoom in" onClick={() => zoom(1.25)}>
          +
        </button>
        <button type="button" className="btn quiet small" onClick={fit}>
          Fit
        </button>
      </div>
      <div
        ref={box}
        className="board-surface"
        tabIndex={0}
        aria-label="Board surface"
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget && !(e.target as Element).classList.contains('board-layer')) return;
          setSelected(null);
          setEditing(null);
          drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget && !(e.target as Element).classList.contains('board-layer')) return;
          const p = toBoard(e.clientX, e.clientY);
          addCard({ type: 'text', x: p.x - 125, y: p.y - 40, width: 250, height: 100, text: '' }, true);
        }}
        onWheel={(e) => {
          const r = box.current!.getBoundingClientRect();
          if (e.ctrlKey || e.metaKey || !e.shiftKey) zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
        }}
        onDragOver={(e) => {
          if (dragged?.tab.kind === 'note') e.preventDefault();
        }}
        onDrop={(e) => {
          const t = dragged?.tab;
          if (t?.kind !== 'note') return;
          e.preventDefault();
          e.stopPropagation();
          const n = notes.get(t.id);
          if (!n || n.id === note.id) return;
          const p = toBoard(e.clientX, e.clientY);
          addCard({ type: 'file', x: p.x - 130, y: p.y - 70, width: 260, height: 140, file: displayTitle(n), note: n.id });
        }}
      >
        <div className="board-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          {groups.map((g) => (
            <div key={g.id} data-card={g.id} className={`board-group${selected?.id === g.id ? ' on' : ''}`} style={{ left: g.x, top: g.y, width: g.width, height: g.height, ...(g.color ? { '--card': CARD_COLORS[g.color] } : {}) } as React.CSSProperties} onPointerDown={(e) => startMove(e, g)} onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(g.id);
            }}>
              {editing === g.id ? (
                <input className="group-label-edit" autoFocus aria-label="Group name" defaultValue={g.label ?? ''} onPointerDown={(e) => e.stopPropagation()} onBlur={(e) => {
                  update(g.id, { label: e.target.value });
                  setEditing(null);
                }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
              ) : (
                <span className="group-label">{g.label || 'Group'}</span>
              )}
              {selected?.id === g.id && <span className="card-resize" onPointerDown={(e) => {
                e.stopPropagation();
                drag.current = { kind: 'resize', id: g.id, sx: e.clientX, sy: e.clientY, w: g.width, h: g.height };
              }} />}
            </div>
          ))}
          <svg className="board-arrows" aria-hidden="true">
            <defs>
              <marker id={`head-${note.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
              </marker>
            </defs>
            {board.edges.map((a) => {
              const from = byId.get(a.fromNode);
              const to = byId.get(a.toNode);
              if (!from || !to) return null;
              const [fs, ts] = sidesFor(from, to);
              const path = curve(anchor(from, a.fromSide ?? fs), a.fromSide ?? fs, anchor(to, a.toSide ?? ts), a.toSide ?? ts);
              const on = selected?.kind === 'arrow' && selected.id === a.id;
              const p = anchor(from, a.fromSide ?? fs);
              const q = anchor(to, a.toSide ?? ts);
              return (
                <g key={a.id} className={`board-arrow${on ? ' on' : ''}`} style={a.color ? { color: CARD_COLORS[a.color] } : undefined}>
                  <path d={path} className="arrow-hit" onPointerDown={(e) => {
                    e.stopPropagation();
                    box.current?.focus({ preventScroll: true });
                    setSelected({ kind: 'arrow', id: a.id });
                  }} />
                  <path d={path} className="arrow-line" markerEnd={`url(#head-${note.id})`} />
                  {a.label && (
                    <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 6} textAnchor="middle">
                      {a.label}
                    </text>
                  )}
                </g>
              );
            })}
            {link && byId.get(link.from) && <path className="arrow-line drawing" d={curve(anchor(byId.get(link.from)!, link.side), link.side, { x: link.x, y: link.y }, 'left')} markerEnd={`url(#head-${note.id})`} />}
          </svg>
          {cards.map((c) => {
            const linked = c.type === 'file' ? (c.note ? notes.get(c.note) : undefined) ?? state.notes.find((n) => displayTitle(n) === c.file) : undefined;
            const on = selected?.id === c.id;
            return (
              <div
                key={c.id}
                data-card={c.id}
                className={`board-card ${c.type}${on ? ' on' : ''}${editing === c.id ? ' editing' : ''}`}
                style={{ left: c.x, top: c.y, width: c.width, height: c.height, ...(c.color ? { '--card': CARD_COLORS[c.color] } : {}) } as React.CSSProperties}
                onPointerDown={(e) => startMove(e, c)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (c.type === 'text') setEditing(c.id);
                  else if (linked) panes.open({ kind: 'note', id: linked.id }, 'tab');
                }}
              >
                {c.type === 'text' ? (
                  editing === c.id ? (
                    <textarea
                      className="card-edit"
                      autoFocus
                      aria-label="Card text"
                      defaultValue={c.text ?? ''}
                      placeholder="Type here (Markdown: **bold**, *italic*, # heading)"
                      onPointerDown={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        update(c.id, { text: e.target.value });
                        setEditing(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
                      }}
                    />
                  ) : c.text ? (
                    <CardText text={c.text} />
                  ) : (
                    <div className="card-text card-placeholder">Double-click to write</div>
                  )
                ) : linked ? (
                  <div className="card-note">
                    <div className="card-note-title">{displayTitle(linked)}</div>
                    <div className="card-note-preview">{preview(linked, 400)}</div>
                  </div>
                ) : (
                  <div className="card-note gone">“{c.file}” isn’t here any more.</div>
                )}
                {on && editing !== c.id && (
                  <>
                    {(['top', 'right', 'bottom', 'left'] as Side[]).map((s) => (
                      <span key={s} className={`card-port ${s}`} title="Drag to another card to draw an arrow" onPointerDown={(e) => {
                        e.stopPropagation();
                        const p = anchor(c, s);
                        drag.current = { kind: 'link', from: c.id, side: s, x: p.x, y: p.y };
                        box.current?.setPointerCapture(e.pointerId);
                      }} />
                    ))}
                    <span className="card-resize" onPointerDown={(e) => {
                      e.stopPropagation();
                      drag.current = { kind: 'resize', id: c.id, sx: e.clientX, sy: e.clientY, w: c.width, h: c.height };
                      box.current?.setPointerCapture(e.pointerId);
                    }} />
                  </>
                )}
              </div>
            );
          })}
        </div>
        {!board.nodes.length && <p className="board-empty">Double-click anywhere to add a card, or drag notes here from the list.</p>}
      </div>
      {(selCard || selected?.kind === 'arrow') && (
        <div className="board-sel" role="toolbar" aria-label="Selected">
          {(['1', '2', '3', '4', '5', '6'] as CardColor[]).map((k) => (
            <button key={k} type="button" className="board-swatch" style={{ background: CARD_COLORS[k] }} aria-label={`Colour ${k}`} onClick={() => {
              if (selCard) update(selCard.id, { color: k });
              else commit({ ...board, edges: board.edges.map((e) => (e.id === selected!.id ? { ...e, color: k } : e)) });
            }} />
          ))}
          <button type="button" className="board-swatch none" aria-label="No colour" onClick={() => {
            if (selCard) update(selCard.id, { color: undefined });
            else commit({ ...board, edges: board.edges.map((e) => (e.id === selected!.id ? { ...e, color: undefined } : e)) });
          }} />
          {selected?.kind === 'arrow' && (
            <button type="button" className="btn quiet small" onClick={() => {
              const a = board.edges.find((e) => e.id === selected.id);
              const label = window.prompt('Label for the arrow', a?.label ?? '');
              if (label !== null) commit({ ...board, edges: board.edges.map((e) => (e.id === selected.id ? { ...e, label: label || undefined } : e)) });
            }}>
              Label…
            </button>
          )}
          {selCard?.type === 'file' && selCard.note && notes.get(selCard.note) && (
            <button type="button" className="btn quiet small" onClick={() => panes.open({ kind: 'note', id: selCard.note! }, 'tab')}>
              Open note
            </button>
          )}
          <button type="button" className="btn quiet small danger" onClick={remove}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/** "+ Note": a note to put on the board, found by typing. */
function NotePicker({ notes, onPick }: { notes: Note[]; onPick(n: Note): void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const found = notes.filter((n) => displayTitle(n).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <span className="tool-drop">
      <button type="button" className="btn quiet small" aria-expanded={open} onClick={() => setOpen(!open)}>
        + Note
      </button>
      {open && (
        <div className="popover board-picker" role="dialog" aria-label="Add a note">
          <input autoFocus type="search" placeholder="Find a note" aria-label="Find a note" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && found[0]) {
              onPick(found[0]);
              setOpen(false);
            }
          }} />
          {found.map((n) => (
            <button key={n.id} type="button" className="menu-item" onClick={() => {
              onPick(n);
              setOpen(false);
            }}>
              {displayTitle(n)}
            </button>
          ))}
          {!found.length && <p className="right-empty">No notes match.</p>}
        </div>
      )}
    </span>
  );
}
