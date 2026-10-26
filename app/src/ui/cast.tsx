// Characters and places: a list under a project's outline, a card for each
// (opened beside the writing), and their names spotted in the chapters with
// a faint underline that shows the card when hovered.

import { KINDS, byKind, cardDetails, kindInfo, setField } from '../data/world';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { type CastMatcher, appearances, castMatcher, findMentions } from '../data/cast';
import { addFile, mediaUrl } from '../data/files';
import { projectChapters } from '../data/selectors';
import type { CastMember, Project } from '../data/types';
import { useAppState, useAppStore } from './hooks';
import { NameGenerator } from './names';
import { IconBack, IconChevron, IconClose, IconPlus, IconTrash } from './icons';
import { tabDrag } from './tabdrag';
import { InlineInput, Popover } from './Sidebar';
import { Item, MenuAtPoint, Rule } from './contextmenu';
import { usePanes } from './panes';
import { FamilyTreeDialog, Relationships } from './family';
import { bookCast, seriesBooks, seriesCast } from '../data/series';

const KIND = (k: CastMember['kind']) => kindInfo(k).name;

/** The address of a picture kept in Attachments (or on the web). */
export function useMedia(src: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return setUrl(null);
    let live = true;
    Promise.resolve(mediaUrl(src)).then(
      (u) => live && setUrl(u),
      () => live && setUrl(null),
    );
    return () => {
      live = false;
    };
  }, [src]);
  return url;
}

/** A small round picture, or the first letter of the name. */
function Avatar({ member, size = 24 }: { member: CastMember; size?: number }) {
  const url = useMedia(member.picture);
  return (
    <span className={`cast-avatar ${member.kind}`} style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {url ? <img src={url} alt="" /> : (member.name.trim()[0] ?? kindInfo(member.kind).glyph).toUpperCase()}
    </span>
  );
}

/** The right-click menu on a character or place: open it, rename it, make it the other kind, or delete it. */
function CastMenu({ project, id, x, y, onClose }: { project: Project; id: string; x: number; y: number; onClose(): void }) {
  const store = useAppStore();
  const panes = usePanes();
  const [renaming, setRenaming] = useState(false);
  const m = project.cast?.find((c) => c.id === id);
  if (!m) return null;
  const tab = { kind: 'cast' as const, project: project.id, id };
  const done = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const other = m.kind === 'character' ? 'place' : 'character';
  return (
    <MenuAtPoint x={x} y={y} label={`${m.name || KIND(m.kind)}: options`} onClose={onClose}>
      {renaming ? (
        <InlineInput
          label={`${KIND(m.kind)}’s name`}
          initial={m.name}
          placeholder="Name"
          onDone={(name) => {
            if (name !== null && name.trim()) store.updateCastMember(project.id, id, { name: name.trim() });
            onClose();
          }}
        />
      ) : (
        <>
          <Item label="Open" onPick={done(() => store.openCast(id))} />
          <Item label="Open in a new tab" onPick={done(() => panes.open(tab, 'tab'))} />
          <Item label="Open to the side" onPick={done(() => panes.split(tab, 'right'))} />
          <Rule />
          <Item label="Rename…" onPick={() => setRenaming(true)} />
          <Item label={`Make it a ${KIND(other).toLowerCase()}`} onPick={done(() => store.updateCastMember(project.id, id, { kind: other }))} />
          <Rule />
          <Item
            label="Delete"
            danger
            onPick={done(() => {
              if (confirm(`Delete ${m.name || 'this card'}? Your chapters stay as they are.`)) store.deleteCastMember(project.id, id);
            })}
          />
        </>
      )}
    </MenuAtPoint>
  );
}

/** The characters and places under a project's outline. */
/** `phone`: in a phone's book, under its Cast tab: a heading and rows like the library's, always open. */
export function CastList({ project, phone = false }: { project: Project; phone?: boolean }) {
  const state = useAppState();
  const store = useAppStore();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [naming, setNaming] = useState(false);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [tree, setTree] = useState(false);
  const cast = project.cast ?? [];
  const series = seriesCast(state.projects, project);
  const groups = byKind(cast);
  const worldly = groups.some((g) => g.info.kind !== 'character' && g.info.kind !== 'place');
  const row = (m: CastMember) => (
    <li key={m.id}>
      <button type="button" className={`research-item${state.castId === m.id ? ' selected' : ''}`} aria-current={state.castId === m.id ? 'true' : undefined} onClick={() => store.openCast(state.castId === m.id ? null : m.id)} onContextMenu={(e) => (e.preventDefault(), setMenu({ id: m.id, x: e.clientX, y: e.clientY }))} {...tabDrag({ kind: 'cast', project: project.id, id: m.id })}>
        <Avatar member={m} size={20} />
        <span className="grow ellipsis">{m.name || `Unnamed ${KIND(m.kind).toLowerCase()}`}</span>
      </button>
    </li>
  );
  return (
    <section className="research" aria-label="Characters and places">
      <div className="research-head">
        {phone ? (
          <h2 className="research-title">Characters &amp; places</h2>
        ) : (
          <button type="button" className="research-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            <IconChevron size={10} className={open ? 'rot90' : ''} />
            Characters &amp; places
            <span className="count">{cast.length}</span>
          </button>
        )}
        <span className="grow" />
        <span className="note-actions">
          {cast.filter((m) => m.kind === 'character').length > 1 && (
            <button type="button" className="btn small quiet family-btn" onClick={() => setTree(true)}>
              Family tree
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="Add a character or place" aria-expanded={adding} onClick={() => setAdding(!adding)}>
            <IconPlus size={phone ? 20 : 14} />
          </button>
          {adding && (
            <Popover label="Add a character or place" onClose={() => setAdding(false)}>
              {KINDS.map(({ kind: k, name: label }, i) => (
                <Fragment key={k}>
                  {i === 2 && <p className="menu-label">Your world</p>}
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setAdding(false);
                      store.addCastMember(project.id, k);
                    }}
                  >
                    New {label.toLowerCase()}
                  </button>
                </Fragment>
              ))}
              <hr className="menu-sep" />
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setAdding(false);
                  setNaming(true);
                }}
              >
                Suggest a name…
              </button>
            </Popover>
          )}
          {naming && (
            <NameGenerator
              taken={cast.map((m) => m.name)}
              onPick={(kind, name) => {
                setNaming(false);
                store.addCastMember(project.id, kind, name);
              }}
              onClose={() => setNaming(false)}
            />
          )}
        </span>
      </div>
      {(open || phone) && (
        <ul className="research-items">
          {cast.length === 0 && <li className="research-empty">People, places and the rest of the book’s world. Their names are spotted in your chapters.</li>}
          {groups.map((g, i) =>
            // Only characters and places: a line between them; with more of the world, each kind under its name.
            worldly ? (
              <Fragment key={g.info.kind}>
                <li className="cast-kind">{g.info.plural}</li>
                {g.members.map(row)}
              </Fragment>
            ) : (
              <Fragment key={g.info.kind}>
                {i > 0 && <li className="cast-divider" aria-hidden="true" />}
                {g.members.map(row)}
              </Fragment>
            ),
          )}
          {series.length > 0 && <li className="research-from">From the series</li>}
          {series.map(({ member: m, book }) => (
            <li key={m.id}>
              <button type="button" className={`research-item${state.castId === m.id ? ' selected' : ''}`} title={`From ${book.name}`} onClick={() => store.openCast(state.castId === m.id ? null : m.id)} {...tabDrag({ kind: 'cast', project: book.id, id: m.id })}>
                <Avatar member={m} size={20} />
                <span className="grow ellipsis">{m.name || `Unnamed ${KIND(m.kind).toLowerCase()}`}</span>
                <small className="research-book">{book.name}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {menu && <CastMenu project={project} id={menu.id} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
      {tree && <FamilyTreeDialog project={project} onClose={() => setTree(false)} />}
    </section>
  );
}

/** A card's details: its kind's questions to answer, then fields of your own (add one, or take it off). */
function Details({ member, onChange }: { member: CastMember; onChange(fields: NonNullable<CastMember['fields']>): void }) {
  const [label, setLabel] = useState('');
  const rows = cardDetails(member);
  const add = () => {
    const l = label.trim();
    if (!l || rows.some((r) => r.label.toLowerCase() === l.toLowerCase())) return;
    onChange([...(member.fields ?? []), { label: l, value: '' }]);
    setLabel('');
  };
  return (
    <div className="cast-field cast-details" role="group" aria-label="Details">
      <span>Details</span>
      {rows.map((r) => (
        <div key={r.label} className="cast-detail">
          <label>
            <span>{r.label}</span>
            <textarea rows={1} aria-label={r.label} value={r.value} placeholder={r.asked ? '…' : ''} onChange={(e) => onChange(setField(member, r.label, e.target.value))} />
          </label>
          {!r.asked && (
            <button type="button" className="icon-btn" aria-label={`Remove the field ${r.label}`} onClick={() => onChange((member.fields ?? []).filter((f) => f.label !== r.label))}>
              <IconClose size={11} />
            </button>
          )}
        </div>
      ))}
      <form
        className="cast-add-field"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input aria-label="New field" placeholder="Add a field of your own (Motto, Height…)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="submit" className="btn small" aria-label="Add the field" disabled={!label.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}

/** A card, open beside the writing: a character, a place or another part of the book's world. */
export function CastPane({ project, member, narrow = false, onClose }: { project: Project; member: CastMember; narrow?: boolean; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const name = useRef<HTMLInputElement>(null);
  const picture = useMedia(member.picture);
  const [aliases, setAliases] = useState(member.aliases.join(', '));
  const update = (patch: Partial<Omit<CastMember, 'id'>>) => store.updateCastMember(project.id, member.id, patch);
  // Where they appear: in their book, and in the rest of its series.
  const books = useMemo(() => seriesBooks(state.projects, project), [state.projects, project]);
  const seen = useMemo(
    () =>
      books.flatMap((book) => {
        const chapters = projectChapters(book, state.chapters);
        const number = new Map(chapters.map((c) => [c.chapter.id, c.number]));
        return (appearances(bookCast(state.projects, book), chapters.map((c) => c.chapter)).get(member.id) ?? []).map((x) => ({ ...x, book, number: number.get(x.chapter.id) }));
      }),
    [books, state.projects, state.chapters, member.id],
  );

  useEffect(() => {
    setAliases(member.aliases.join(', '));
    // On a phone the card comes on screen a moment after it opens: try again until it can take focus.
    if (member.name) return;
    let tries = 0;
    let frame = 0;
    const focus = () => {
      name.current?.focus();
      if (document.activeElement !== name.current && ++tries < 20) frame = requestAnimationFrame(focus);
    };
    focus();
    return () => cancelAnimationFrame(frame);
  }, [member.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const choosePicture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        update({ picture: (await addFile(f)).src });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'That picture couldn’t be added.');
      }
    };
    input.click();
  };

  return (
    <section className="research-pane cast-pane" aria-label={`${KIND(member.kind)} card`}>
      <div className="note-toolbar" role="toolbar" aria-label="Card">
        {narrow && (
          <button type="button" className="back-link" onClick={onClose}>
            <IconBack size={16} /> <span className="ellipsis">{project.name}</span>
          </button>
        )}
        <label className="cast-kind-pick">
          <select aria-label="Kind" value={member.kind} onChange={(e) => update({ kind: e.target.value as CastMember['kind'] })}>
            {KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
        <span className="grow" />
        {!narrow && (
          <button type="button" className="icon-btn" aria-label="Close card" data-tip="Close" onClick={onClose}>
            <IconClose size={15} />
          </button>
        )}
      </div>
      <div className="note-scroll">
        <div className="cast-card">
          <div className="cast-top">
            <button type="button" className="cast-picture" onClick={choosePicture} title={picture ? 'Change the picture' : 'Add a picture'} aria-label={picture ? 'Change the picture' : 'Add a picture'}>
              {picture ? <img src={picture} alt="" /> : <span>+ Picture</span>}
            </button>
            <div className="cast-names">
              <input ref={name} className="note-title cast-name" aria-label="Name" placeholder={member.kind === 'place' ? 'Name of the place' : member.kind === 'character' ? 'Name' : `Name of the ${KIND(member.kind).toLowerCase()}`} value={member.name} onChange={(e) => update({ name: e.target.value })} />
              <label className="cast-field">
                <span>Also called</span>
                <input
                  aria-label="Also called"
                  placeholder="Nicknames, separated by commas"
                  value={aliases}
                  onChange={(e) => {
                    setAliases(e.target.value);
                    update({ aliases: e.target.value.split(',').map((a) => a.trim()).filter(Boolean) });
                  }}
                />
              </label>
              {member.picture && (
                <button type="button" className="link-btn" onClick={() => update({ picture: undefined })}>
                  Remove picture
                </button>
              )}
            </div>
          </div>
          <label className="cast-field">
            <span>Description</span>
            <textarea rows={2} aria-label="Description" placeholder={kindInfo(member.kind).hint} value={member.description} onChange={(e) => update({ description: e.target.value })} />
          </label>
          {member.kind === 'character' && <Relationships project={project} member={member} />}
          <Details member={member} onChange={(fields) => update({ fields: fields.length ? fields : undefined })} />
          <label className="cast-field">
            <span>Notes</span>
            <textarea rows={8} aria-label="Notes" placeholder="Anything worth remembering" value={member.notes} onChange={(e) => update({ notes: e.target.value })} />
          </label>
          <div className="cast-field">
            <span>Appears in</span>
            {seen.length ? (
              <ul className="cast-seen">
                {seen.map(({ chapter, count, book, number }) => (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        if (state.view.kind === 'project' && state.view.id === book.id) store.selectChapter(chapter.id);
                        else store.openProject(book.id, chapter.id);
                        store.setProjectMode('chapter');
                      }}
                    >
                      {books.length > 1 && `${book.name}: `}
                      {number}. {chapter.title || 'Untitled chapter'}
                    </button>
                    <small>
                      {count} mention{count === 1 ? '' : 's'}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="research-empty">{member.name ? 'Not mentioned in any chapter yet.' : 'Give a name to find where they appear.'}</p>
            )}
          </div>
          <div className="cast-foot">
            <button
              type="button"
              className="btn quiet danger-text"
              onClick={() => {
                if (confirm(`Delete ${member.name || 'this card'}? Your chapters stay as they are.`)) store.deleteCastMember(project.id, member.id);
              }}
            >
              <IconTrash size={13} /> Delete this card
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ spotting names

/** Every editor's underlined names, shown together as one highlight (no change to the text itself). */
const registry = new Map<HTMLElement, { range: Range; id: string }[]>();
const canHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

function publish(): void {
  if (!canHighlight) return;
  const ranges = [...registry.values()].flat().map((m) => m.range);
  if (ranges.length) CSS.highlights.set('crumpet-cast', new Highlight(...ranges));
  else CSS.highlights.delete('crumpet-cast');
}

/** The names in an editor's text, as ranges of the page. */
function scan(root: HTMLElement, matcher: CastMatcher | null): { range: Range; id: string }[] {
  const out: { range: Range; id: string }[] = [];
  if (!matcher) return out;
  // Each block, or (in page view) each part of one on its page and column.
  for (const block of Array.from(root.querySelectorAll<HTMLElement>(':scope > [data-block], :scope > .pg > .pg-band > .pg-col > [data-block]'))) {
    const text = block.querySelector<HTMLElement>(':scope > .text');
    if (!text) continue;
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    const starts: number[] = [];
    let all = '';
    for (const n of nodes) {
      starts.push(all.length);
      all += n.data;
    }
    const at = (offset: number, end: boolean): [Text, number] => {
      let i = nodes.length - 1;
      while (i > 0 && (starts[i] > offset || (end && starts[i] === offset))) i--;
      return [nodes[i], offset - starts[i]];
    };
    for (const m of findMentions(all, matcher)) {
      const range = document.createRange();
      range.setStart(...at(m.from, false));
      range.setEnd(...at(m.to, true));
      out.push({ range, id: m.id });
    }
  }
  return out;
}

/** Underlines the cast's names in an editor and shows a card when one is hovered. */
export function CastSpotting({ editor, project }: { editor: Editor | null; project: Project }) {
  const store = useAppStore();
  const state = useAppState();
  // The series' characters and places too.
  const everyone = useMemo(() => bookCast(state.projects, project), [state.projects, project]);
  const matcher = useMemo(() => castMatcher(everyone), [everyone]);
  const found = useRef<{ range: Range; id: string }[]>([]);
  const [hover, setHover] = useState<{ id: string; rect: DOMRect } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!editor) return;
    const root = editor.view.root;
    let frame = 0;
    const rescan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        found.current = scan(root, matcher);
        registry.set(root, found.current);
        publish();
      });
    };
    rescan();
    const off = editor.onChange(() => rescan());
    return () => {
      off();
      cancelAnimationFrame(frame);
      registry.delete(root);
      publish();
    };
  }, [editor, matcher]);

  // Hovering over a name shows its card.
  useEffect(() => {
    if (!editor || !matcher) return;
    const root = editor.view.root;
    const onMove = (e: MouseEvent) => {
      const hit = found.current.find(({ range }) => Array.from(range.getClientRects()).some((r) => e.clientX >= r.left - 1 && e.clientX <= r.right + 1 && e.clientY >= r.top - 1 && e.clientY <= r.bottom + 1));
      if (hit) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = null;
        setHover((h) => (h?.id === hit.id ? h : { id: hit.id, rect: hit.range.getBoundingClientRect() }));
      } else if (!hideTimer.current) {
        hideTimer.current = setTimeout(() => {
          hideTimer.current = null;
          setHover(null);
        }, 350);
      }
    };
    root.addEventListener('mousemove', onMove);
    root.addEventListener('mouseleave', onMove);
    return () => {
      root.removeEventListener('mousemove', onMove);
      root.removeEventListener('mouseleave', onMove);
    };
  }, [editor, matcher]);

  useLayoutEffect(() => {
    if (!hover) return setAt(null);
    const w = 280;
    const h = card.current?.offsetHeight ?? 120;
    const below = hover.rect.bottom + 8 + h < window.innerHeight;
    setAt({ top: below ? hover.rect.bottom + 6 : hover.rect.top - 6 - h, left: Math.min(window.innerWidth - w - 8, Math.max(8, hover.rect.left)) });
  }, [hover]);

  const member = hover && everyone.find((m) => m.id === hover.id);
  if (!member) return null;
  return createPortal(
    <div
      ref={card}
      className="cast-hover"
      role="tooltip"
      style={at ? { top: at.top, left: at.left } : { visibility: 'hidden', top: 0, left: 0 }}
      onMouseEnter={() => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }}
      onMouseLeave={() => setHover(null)}
    >
      <div className="cast-hover-top">
        <Avatar member={member} size={40} />
        <div>
          <b>{member.name}</b>
          <small>{KIND(member.kind)}</small>
        </div>
      </div>
      {member.description && <p>{member.description}</p>}
      <button
        type="button"
        className="link-btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setHover(null);
          store.openCast(member.id);
        }}
      >
        Open card
      </button>
    </div>,
    document.body,
  );
}
