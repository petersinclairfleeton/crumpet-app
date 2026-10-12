// Word's Select Text with Similar Formatting (and the Styles pane's Select
// All Instances): every place formatted like the caret's text, lit up, with
// a small bar to format them all at once, as one step to undo.

import { useEffect, useLayoutEffect, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { clearFormatting, setBlockStyle, setLook, toggleMark } from '@crumpet/editor/commands';
import { type Match, findMatches, similarFormat } from '@crumpet/editor/find';
import type { Block } from '@crumpet/editor/model';
import { type StyleSheet, sheetStyles } from '../data/styles';

const EVENT = 'crumpet:select-similar';

interface Picked {
  editor: Editor;
  matches: Match[];
  /** What was picked: "text like this" or a style's name. */
  what: string;
  sheet?: StyleSheet;
}

/** Selects every stretch of text formatted exactly like the text at the caret. */
export function selectSimilar(editor: Editor, sheet?: StyleSheet): number {
  const { marks, look } = editor.formatAtCaret();
  const matches = findMatches(editor.state.doc, '', { format: similarFormat(marks, look) });
  window.dispatchEvent(new CustomEvent<Picked>(EVENT, { detail: { editor, matches, what: 'text formatted like this', sheet } }));
  return matches.length;
}

/** Selects every paragraph that passes `test` (the paragraphs in one style). */
export function selectParagraphs(editor: Editor, test: (b: Block) => boolean, what: string, sheet?: StyleSheet): number {
  const matches = editor.state.doc.blocks.filter((b) => test(b) && b.runs.length).map((b) => ({ block: b.id, from: 0, to: b.runs.reduce((n, r) => n + r.text.length, 0) }));
  window.dispatchEvent(new CustomEvent<Picked>(EVENT, { detail: { editor, matches, what, sheet } }));
  return matches.length;
}

const canHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

export function SimilarHost() {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = (e: Event) => setPicked((e as CustomEvent<Picked>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!picked) return;
    const off = picked.editor.onChange(() => setTick((t) => t + 1));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicked(null);
    document.addEventListener('keydown', onKey);
    return () => {
      off();
      document.removeEventListener('keydown', onKey);
    };
  }, [picked]);
  // The picked places, lit up in the text.
  useLayoutEffect(() => {
    if (!canHighlight) return;
    if (!picked) return void CSS.highlights.delete('crumpet-similar');
    const ranges = picked.matches.map((m) => picked.editor.rangeOf(m)).filter((r): r is Range => !!r);
    if (ranges.length) CSS.highlights.set('crumpet-similar', new Highlight(...ranges));
    else CSS.highlights.delete('crumpet-similar');
  });
  useEffect(() => () => void (canHighlight && CSS.highlights.delete('crumpet-similar')), []);
  if (!picked) return null;
  const { editor, matches } = picked;
  const all = (cmd: Parameters<Editor['applyToAll']>[1]) => {
    // Places in paragraphs since removed are left out.
    const live = matches.filter((m) => editor.state.doc.blocks.some((b) => b.id === m.block));
    editor.applyToAll(live, cmd);
  };
  const n = matches.length;
  return (
    <div className="similar-bar" role="toolbar" aria-label="Selected places">
      <span className="similar-count">
        {n ? `${n} place${n === 1 ? '' : 's'} selected` : 'Nothing else like it'} <small>({picked.what})</small>
      </span>
      {n > 0 && (
        <>
          <button type="button" className="btn small" aria-label="Bold them all" onClick={() => all((s) => toggleMark(s, 'bold'))}>
            <b>B</b>
          </button>
          <button type="button" className="btn small" aria-label="Italic them all" onClick={() => all((s) => toggleMark(s, 'italic'))}>
            <i>I</i>
          </button>
          <button type="button" className="btn small" aria-label="Underline them all" onClick={() => all((s) => toggleMark(s, 'underline'))}>
            <u>U</u>
          </button>
          <button type="button" className="btn small" aria-label="Highlight them all" onClick={() => all((s) => setLook(s, 'highlight', '#ffff00'))}>
            <span className="similar-hl">ab</span>
          </button>
          <button type="button" className="btn small" onClick={() => all((s) => clearFormatting(s))}>
            Clear formatting
          </button>
          {picked.sheet && (
            <select
              aria-label="Apply a style to them all"
              value=""
              onChange={(e) => {
                const st = sheetStyles(picked.sheet!).find((x) => x.key === e.target.value);
                if (st && st.key !== 'list') all((s) => setBlockStyle(s, st.type, st.style));
              }}
            >
              <option value="">Style…</option>
              {sheetStyles(picked.sheet)
                .filter((x) => x.inMenu)
                .map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.name}
                  </option>
                ))}
            </select>
          )}
        </>
      )}
      <button type="button" className="btn small" onClick={() => setPicked(null)}>
        Done
      </button>
    </div>
  );
}
