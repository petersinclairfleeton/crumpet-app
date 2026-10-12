// Find and replace: a small bar over the writing. It searches one note, one
// chapter, or every chapter of a book; matches in the open writing are
// highlighted (without touching the text), and replacing goes through the
// editor so it can be undone.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { Doc } from '@crumpet/editor/model';
import { caret } from '@crumpet/editor/model';
import { applyOps } from '@crumpet/editor/ops';
import { type FindFormat, type FindOptions, type Match, findMatches, replaceMatches } from '@crumpet/editor/find';
import type { Mark } from '@crumpet/editor/model';
import { type StyleSheet, blockStyleKey, sheetStyles } from '../data/styles';
import { IconChevronDown, IconClose } from './icons';
import { Popover } from './Sidebar';

/** Something to search: a note or chapter, with its editor if it's open. */
export interface FindTarget {
  id: string;
  doc: Doc;
  editor: Editor | null;
  /** Its name, for the list of results (a chapter's title). */
  label?: string;
}

interface Props {
  targets: FindTarget[];
  /** Saves a document changed by Replace all when it isn't open in an editor. */
  onReplaceDoc(id: string, doc: Doc): void;
  /** Opens a target that isn't open, to show a match in it. */
  onGoTo?(id: string): void;
  /** Who's tracking changes, if track changes is on. */
  author: string | null;
  /** A choice of where to look (this chapter or the whole book). */
  scopes?: { id: string; label: string }[];
  scope?: string;
  onScope?(id: string): void;
  /** The styles in use, to find text in one paragraph style. */
  sheet?: StyleSheet;
  onClose(): void;
}

/** Word's special characters, for the Special menu. */
const SPECIALS: [string, string, boolean][] = [
  ['^t', 'Tab character', true],
  ['^l', 'Line break', true],
  ['^?', 'Any character', false],
  ['^#', 'Any digit', false],
  ['^$', 'Any letter', false],
  ['^w', 'White space', false],
  ['^s', 'No-break space', true],
  ['^+', 'Em dash', true],
  ['^=', 'En dash', true],
  ['^f', 'Footnote mark', false],
  ['^&', 'What was found', true],
  ['^^', 'Caret character', true],
];

const MARK_NAMES: [Mark, string][] = [
  ['bold', 'Bold'],
  ['italic', 'Italic'],
  ['underline', 'Underline'],
  ['strike', 'Strikethrough'],
];

/** A match's words with a little of what's round them, for the list of results. */
export function matchContext(doc: Doc, m: Match, room = 28): [string, string, string] {
  const b = doc.blocks.find((x) => x.id === m.block);
  const text = (b?.runs.map((r) => r.text).join('') ?? '').replace(/[\u2063\ufffc]/g, ' ');
  let before = text.slice(Math.max(0, m.from - room), m.from);
  let after = text.slice(m.to, m.to + room);
  if (m.from > room) before = `…${before.replace(/^\S*\s/, '')}`;
  if (m.to + room < text.length) after = `${after.replace(/\s\S*$/, '')}…`;
  return [before, text.slice(m.from, m.to), after];
}

const canHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

/** Opens find with Ctrl/⌘+F (or Ctrl+H, for replace) while working inside `el`. */
export function useFindKey(onOpen: (replace: boolean) => void) {
  return (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'f' || (e.ctrlKey && e.key.toLowerCase() === 'h'))) {
      e.preventDefault();
      onOpen(e.key.toLowerCase() === 'h');
    }
  };
}

export function FindBar({ targets, onReplaceDoc, onGoTo, author, scopes, scope, onScope, sheet, onClose }: Props) {
  const [query, setQuery] = useState(() => window.getSelection()?.toString().split('\n')[0].slice(0, 200) ?? '');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [wildcards, setWildcards] = useState(false);
  const [more, setMore] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [highlighted, setHighlighted] = useState(false);
  const [styleKey, setStyleKey] = useState('');
  const [menu, setMenu] = useState<'format' | 'special' | null>(null);
  const [results, setResults] = useState(false);
  const lastField = useRef<'find' | 'replace'>('find');
  const replaceInput = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  // Look again whenever an open document changes.
  const editors = targets.map((t) => t.editor).filter((e): e is Editor => !!e);
  const editorsNow = useRef(editors);
  editorsNow.current = editors;
  const editorKey = targets.map((t) => `${t.id}${t.editor ? '+' : ''}`).join();
  useEffect(() => {
    const offs = editorsNow.current.map((ed) => ed.onChange(() => setTick((t) => t + 1)));
    return () => offs.forEach((off) => off());
  }, [editorKey]);

  const format = useMemo<FindFormat | undefined>(() => {
    if (!marks.length && !highlighted && !styleKey) return undefined;
    return { ...(marks.length ? { marks } : {}), ...(highlighted ? { highlight: true } : {}), ...(styleKey && sheet ? { block: (b) => blockStyleKey(sheet, b) === styleKey } : {}) };
  }, [marks, highlighted, styleKey, sheet]);
  const opts = useMemo<FindOptions>(() => ({ matchCase, wholeWord, wildcards, ...(format ? { format } : {}) }), [matchCase, wholeWord, wildcards, format]);
  const looking = !!query || !!format;
  const found = useMemo(
    () => targets.map((t) => ({ target: t, matches: t.editor ? t.editor.find(query, opts) : findMatches(t.doc, query, opts) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targets, query, opts, tick],
  );
  const all = found.flatMap((f) => f.matches.map((m) => ({ target: f.target, match: m })));
  const at = all.length ? Math.min(index, all.length - 1) : -1;
  const current = at >= 0 ? all[at] : null;

  // Highlight every match in the open writing, and the current one more strongly.
  useLayoutEffect(() => {
    if (!canHighlight) return;
    const ranges: Range[] = [];
    let now: Range | null = null;
    for (const { target, match } of all) {
      const r = target.editor?.rangeOf(match);
      if (!r) continue;
      if (current && target.id === current.target.id && match === current.match) now = r;
      else ranges.push(r);
    }
    if (ranges.length) CSS.highlights.set('crumpet-find', new Highlight(...ranges));
    else CSS.highlights.delete('crumpet-find');
    if (now) CSS.highlights.set('crumpet-find-now', new Highlight(now));
    else CSS.highlights.delete('crumpet-find-now');
  });
  useEffect(
    () => () => {
      if (!canHighlight) return;
      CSS.highlights.delete('crumpet-find');
      CSS.highlights.delete('crumpet-find-now');
    },
    [],
  );

  // Bring the current match into view (opening its chapter if need be).
  const shown = current ? `${current.target.id}:${current.match.block}:${current.match.from}:${current.target.editor ? 'open' : ''}` : '';
  useEffect(() => {
    if (!current) return;
    if (!current.target.editor) {
      onGoTo?.(current.target.id);
      return;
    }
    const r = current.target.editor.rangeOf(current.match);
    const box = r?.getBoundingClientRect();
    const scroller = (r?.startContainer.parentElement ?? null)?.closest<HTMLElement>('.note-scroll');
    if (!box || !scroller) return;
    const view = scroller.getBoundingClientRect();
    if (box.top < view.top + 60 || box.bottom > view.bottom - 40) scroller.scrollTo({ top: scroller.scrollTop + box.top - view.top - view.height / 3 });
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = (d: number) => all.length && setIndex((at + d + all.length) % all.length);

  const replaceOne = () => {
    if (!current) return;
    const { target, match } = current;
    if (target.editor) target.editor.replace([match], replacement);
    else onReplaceDoc(target.id, replaced(target.doc, [match]));
    // The next match moves up into this place; with tracked changes the old text stays, so step on.
    if (author) setIndex(at + 1);
  };

  const replaced = (doc: Doc, matches: Match[]) => {
    const t = replaceMatches({ doc, selection: caret({ block: doc.blocks[0].id, offset: 0 }), storedMarks: null }, matches, replacement, author);
    return t ? applyOps(doc, t.ops) : doc;
  };

  const replaceAll = () => {
    for (const { target, matches } of found) {
      if (!matches.length) continue;
      if (target.editor) target.editor.replace(matches, replacement);
      else onReplaceDoc(target.id, replaced(target.doc, matches));
    }
    setIndex(0);
  };

  const close = () => {
    onClose();
    current?.target.editor?.focus();
  };

  return (
    <div className="find-bar" role="search" aria-label="Find and replace" onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), close())}>
      <div className="find-row">
        <input
          ref={input}
          type="search"
          aria-label="Find"
          placeholder="Find"
          value={query}
          onFocus={() => (lastField.current = 'find')}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            }
          }}
        />
        <span className="find-count" aria-live="polite">
          {looking ? (all.length ? `${at + 1} of ${all.length}` : 'None') : ''}
        </span>
        <button type="button" className="icon-btn" aria-label="Previous match" data-tip="Previous (Shift+Enter)" disabled={!all.length} onClick={() => step(-1)}>
          <IconChevronDown size={14} className="flip" />
        </button>
        <button type="button" className="icon-btn" aria-label="Next match" data-tip="Next (Enter)" disabled={!all.length} onClick={() => step(1)}>
          <IconChevronDown size={14} />
        </button>
        <button type="button" className="icon-btn" aria-label="Close find" data-tip="Close (Esc)" onClick={close}>
          <IconClose size={14} />
        </button>
      </div>
      <div className="find-row">
        <input
          ref={replaceInput}
          onFocus={() => (lastField.current = 'replace')}
          type="text"
          aria-label="Replace with"
          placeholder="Replace with"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              replaceOne();
            }
          }}
        />
        <button type="button" className="btn small" disabled={!current} onClick={replaceOne}>
          Replace
        </button>
        <button type="button" className="btn small" aria-label="Replace all" disabled={!all.length} onClick={replaceAll}>
          All
        </button>
      </div>
      <div className="find-row find-options">
        <label>
          <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Match case
        </label>
        <label>
          <input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} /> Whole words
        </label>
        <button type="button" className="link-btn" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? 'Fewer options' : 'More options'}
        </button>
        {scopes && onScope && (
          <span className="segmented small" role="group" aria-label="Look in">
            {scopes.map((s) => (
              <button key={s.id} type="button" aria-pressed={scope === s.id} onClick={() => (onScope(s.id), setIndex(0))}>
                {s.label}
              </button>
            ))}
          </span>
        )}
      </div>
      {more && (
        <div className="find-row find-options">
          <label>
            <input type="checkbox" checked={wildcards} onChange={(e) => (setWildcards(e.target.checked), setIndex(0))} /> Use wildcards
          </label>
          <span className="tool-drop">
            <button type="button" className={`btn small${format ? ' on' : ''}`} aria-expanded={menu === 'format'} onClick={() => setMenu(menu === 'format' ? null : 'format')}>
              Format ▾
            </button>
            {menu === 'format' && (
              <Popover label="Find formatting" onClose={() => setMenu(null)}>
                <div className="find-format" role="group" aria-label="Find formatting">
                  {MARK_NAMES.map(([m, name]) => (
                    <label key={m} className="check-row">
                      <input type="checkbox" checked={marks.includes(m)} onChange={(e) => (setMarks(e.target.checked ? [...marks, m] : marks.filter((x) => x !== m)), setIndex(0))} /> {name}
                    </label>
                  ))}
                  <label className="check-row">
                    <input type="checkbox" checked={highlighted} onChange={(e) => (setHighlighted(e.target.checked), setIndex(0))} /> Highlighted
                  </label>
                  {sheet && (
                    <label className="field">
                      <span>Paragraph style</span>
                      <select aria-label="In paragraph style" value={styleKey} onChange={(e) => (setStyleKey(e.target.value), setIndex(0))}>
                        <option value="">Any</option>
                        {sheetStyles(sheet).map((x) => (
                          <option key={x.key} value={x.key}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {format && (
                    <button type="button" className="btn quiet small" onClick={() => (setMarks([]), setHighlighted(false), setStyleKey(''))}>
                      No formatting
                    </button>
                  )}
                </div>
              </Popover>
            )}
          </span>
          <span className="tool-drop">
            <button type="button" className="btn small" aria-expanded={menu === 'special'} onClick={() => setMenu(menu === 'special' ? null : 'special')}>
              Special ▾
            </button>
            {menu === 'special' && (
              <Popover label="Special characters" onClose={() => setMenu(null)}>
                <div className="find-special" role="menu">
                  {SPECIALS.filter(([code, , both]) => both || lastField.current === 'find' || code !== '^&').map(([code, name]) => (
                    <button
                      key={code}
                      type="button"
                      role="menuitem"
                      className="menu-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setMenu(null);
                        if (lastField.current === 'replace') {
                          setReplacement(replacement + code);
                          replaceInput.current?.focus();
                        } else {
                          setQuery(query + code);
                          setIndex(0);
                          input.current?.focus();
                        }
                      }}
                    >
                      <span className="grow">{name}</span>
                      <kbd>{code}</kbd>
                    </button>
                  ))}
                </div>
              </Popover>
            )}
          </span>
          <label>
            <input type="checkbox" checked={results} onChange={(e) => setResults(e.target.checked)} /> List results
          </label>
        </div>
      )}
      {more && results && looking && (
        <ol className="find-results" aria-label="Results">
          {all.slice(0, 500).map(({ target, match }, i) => {
            const [before, word, after] = matchContext(target.editor?.state.doc ?? target.doc, match);
            return (
              <li key={`${target.id}:${match.block}:${match.from}`}>
                <button type="button" aria-current={i === at} onClick={() => setIndex(i)}>
                  {targets.length > 1 && target.label && <span className="find-result-where">{target.label}</span>}
                  <span className="find-result-text">
                    {before}
                    <mark>{word}</mark>
                    {after}
                  </span>
                </button>
              </li>
            );
          })}
          {all.length > 500 && <li className="muted">And {all.length - 500} more</li>}
        </ol>
      )}
    </div>
  );
}

