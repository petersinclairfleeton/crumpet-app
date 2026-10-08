// Characters and places: a list under a project's outline, a card for each
// (opened beside the writing), and their names spotted in the chapters with
// a faint underline that shows the card when hovered.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { type CastMatcher, appearances, castMatcher, findMentions } from '../data/cast';
import { addFile, mediaUrl } from '../data/files';
import { projectChapters } from '../data/selectors';
import type { CastMember, Project } from '../data/types';
import { useAppState, useAppStore } from './hooks';
import { IconChevron, IconClose, IconPlus } from './icons';
import { Popover } from './Sidebar';

const KIND: Record<CastMember['kind'], string> = { character: 'Character', place: 'Place' };

/** The address of a picture kept in Attachments (or on the web). */
function useMedia(src: string | undefined): string | null {
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
      {url ? <img src={url} alt="" /> : (member.name.trim()[0] ?? (member.kind === 'place' ? '⌖' : '?')).toUpperCase()}
    </span>
  );
}

/** The characters and places under a project's outline. */
export function CastList({ project }: { project: Project }) {
  const state = useAppState();
  const store = useAppStore();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const cast = project.cast ?? [];
  const group = (kind: CastMember['kind']) => cast.filter((m) => m.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
  const row = (m: CastMember) => (
    <li key={m.id}>
      <button type="button" className={`research-item${state.castId === m.id ? ' selected' : ''}`} aria-current={state.castId === m.id ? 'true' : undefined} onClick={() => store.openCast(state.castId === m.id ? null : m.id)}>
        <Avatar member={m} size={20} />
        <span className="grow ellipsis">{m.name || `Unnamed ${KIND[m.kind].toLowerCase()}`}</span>
      </button>
    </li>
  );
  return (
    <section className="research" aria-label="Characters and places">
      <div className="research-head">
        <button type="button" className="research-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <IconChevron size={10} className={open ? 'rot90' : ''} />
          Characters &amp; places
          <span className="count">{cast.length}</span>
        </button>
        <span className="grow" />
        <span className="note-actions">
          <button type="button" className="icon-btn" aria-label="Add a character or place" aria-expanded={adding} onClick={() => setAdding(!adding)}>
            <IconPlus size={14} />
          </button>
          {adding && (
            <Popover label="Add a character or place" onClose={() => setAdding(false)}>
              {(['character', 'place'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setAdding(false);
                    store.addCastMember(project.id, k);
                  }}
                >
                  New {KIND[k].toLowerCase()}
                </button>
              ))}
            </Popover>
          )}
        </span>
      </div>
      {open && (
        <ul className="research-items">
          {cast.length === 0 && <li className="research-empty">People and places in the book. Their names are spotted in your chapters.</li>}
          {group('character').map(row)}
          {group('place').length > 0 && group('character').length > 0 && <li className="cast-divider" aria-hidden="true" />}
          {group('place').map(row)}
        </ul>
      )}
    </section>
  );
}

/** A character's or place's card, open beside the writing. */
export function CastPane({ project, member, onClose }: { project: Project; member: CastMember; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const name = useRef<HTMLInputElement>(null);
  const picture = useMedia(member.picture);
  const [aliases, setAliases] = useState(member.aliases.join(', '));
  const update = (patch: Partial<Omit<CastMember, 'id'>>) => store.updateCastMember(project.id, member.id, patch);
  const chapters = useMemo(() => projectChapters(project, state.chapters), [project, state.chapters]);
  const seen = useMemo(() => appearances(project.cast, chapters.map((c) => c.chapter)).get(member.id) ?? [], [project.cast, chapters, member.id]);
  const number = new Map(chapters.map((c) => [c.chapter.id, c.number]));

  useEffect(() => {
    setAliases(member.aliases.join(', '));
    if (!member.name) name.current?.focus();
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
    <section className="research-pane cast-pane" aria-label={`${KIND[member.kind]} card`}>
      <div className="note-toolbar" role="toolbar" aria-label="Card">
        <div className="segmented small" role="group" aria-label="Kind">
          {(['character', 'place'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={member.kind === k} onClick={() => update({ kind: k })}>
              {KIND[k]}
            </button>
          ))}
        </div>
        <span className="grow" />
        <button
          type="button"
          className="btn quiet danger-text"
          onClick={() => {
            if (confirm(`Delete ${member.name || 'this card'}? Your chapters stay as they are.`)) store.deleteCastMember(project.id, member.id);
          }}
        >
          Delete
        </button>
        <button type="button" className="icon-btn" aria-label="Close card" title="Close" onClick={onClose}>
          <IconClose size={15} />
        </button>
      </div>
      <div className="note-scroll">
        <div className="cast-card">
          <div className="cast-top">
            <button type="button" className="cast-picture" onClick={choosePicture} title={picture ? 'Change the picture' : 'Add a picture'} aria-label={picture ? 'Change the picture' : 'Add a picture'}>
              {picture ? <img src={picture} alt="" /> : <span>+ Picture</span>}
            </button>
            <div className="cast-names">
              <input ref={name} className="note-title cast-name" aria-label="Name" placeholder={member.kind === 'place' ? 'Name of the place' : 'Name'} value={member.name} onChange={(e) => update({ name: e.target.value })} />
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
            <textarea rows={2} aria-label="Description" placeholder={member.kind === 'place' ? 'What it’s like, in a line or two' : 'Who they are, in a line or two'} value={member.description} onChange={(e) => update({ description: e.target.value })} />
          </label>
          <label className="cast-field">
            <span>Notes</span>
            <textarea rows={8} aria-label="Notes" placeholder="Anything worth remembering" value={member.notes} onChange={(e) => update({ notes: e.target.value })} />
          </label>
          <div className="cast-field">
            <span>Appears in</span>
            {seen.length ? (
              <ul className="cast-seen">
                {seen.map(({ chapter, count }) => (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        store.selectChapter(chapter.id);
                        store.setProjectMode('chapter');
                      }}
                    >
                      {number.get(chapter.id)}. {chapter.title || 'Untitled chapter'}
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
  for (const block of Array.from(root.children) as HTMLElement[]) {
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
  const matcher = useMemo(() => castMatcher(project.cast), [project.cast]);
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

  const member = hover && project.cast?.find((m) => m.id === hover.id);
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
          <small>{KIND[member.kind]}</small>
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
