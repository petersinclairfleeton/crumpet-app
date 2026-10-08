// The right sidebar's Writing tab, like Scrivener's Text Statistics,
// Linguistic Focus and session target: how much you've written this session
// and today, counts for the note or chapter, the words you use most, and
// highlighting dialogue, adverbs, filler words or passive voice (the rest of
// the text fades) or every use of one word.

import { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { runsText } from '@crumpet/editor/model';
import { useAppState, useAppStore } from './hooks';
import { useTodayWords } from './stats-ui';
import { FOCUS_LABELS, type Focus, findFocus, textStats, wordFrequency } from '../data/textstats';

// ---------------------------------------------------------------- this session

let sessionBase: { day: string; words: number } | null = null;
const today = () => new Date().toDateString();

/** Words written since Crumpet was opened (or since midnight). Call once the app has loaded. */
export function startSession(todayWords: number): void {
  if (!sessionBase || sessionBase.day !== today()) sessionBase = { day: today(), words: todayWords };
}

function sessionWords(todayWords: number): number {
  if (!sessionBase || sessionBase.day !== today()) startSession(0);
  return Math.max(0, todayWords - sessionBase!.words);
}

// ---------------------------------------------------------------- highlighting

const canHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

/** Ranges in the editor's text where the focus finds something. */
function focusRanges(root: HTMLElement, focus: Focus): Range[] {
  const out: Range[] = [];
  for (const block of Array.from(root.querySelectorAll<HTMLElement>(':scope > [data-block], :scope > .pg > .pg-band > .pg-col > [data-block]'))) {
    const text = block.querySelector<HTMLElement>(':scope > .text');
    if (!text) continue;
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    if (!nodes.length) continue;
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
    for (const m of findFocus(all, focus)) {
      const r = document.createRange();
      r.setStart(...at(m.from, false));
      r.setEnd(...at(m.to, true));
      out.push(r);
    }
  }
  return out;
}

/** Highlights the focus in an editor, fading the rest, until it's turned off. */
function useFocusHighlight(editor: Editor | null, focus: Focus | null): number {
  const [count, setCount] = useState(0);
  const key = focus === null ? '' : typeof focus === 'object' ? `w:${focus.word}` : focus;
  useEffect(() => {
    if (!editor || !focus || !canHighlight) {
      setCount(0);
      return;
    }
    const root = editor.view.root;
    root.classList.add('ling-dim');
    let frame = 0;
    const paint = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const ranges = focusRanges(root, focus);
        setCount(ranges.length);
        if (ranges.length) CSS.highlights.set('crumpet-focus', new Highlight(...ranges));
        else CSS.highlights.delete('crumpet-focus');
      });
    };
    paint();
    const off = editor.onChange(paint);
    return () => {
      off();
      cancelAnimationFrame(frame);
      root.classList.remove('ling-dim');
      CSS.highlights.delete('crumpet-focus');
    };
  }, [editor, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return count;
}

// ---------------------------------------------------------------- the tab

const n = (x: number) => x.toLocaleString();

export function WritingTab({ editor, docId }: { editor: Editor; docId: string }) {
  const state = useAppState();
  const store = useAppStore();
  const todayWords = useTodayWords();
  const [focus, setFocus] = useState<Focus | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => editor.onChange(() => setTick((t) => t + 1)), [editor]);
  const found = useFocusHighlight(editor, focus);
  const paragraphs = editor.state.doc.blocks.filter((b) => b.type !== 'table' && b.type !== 'image' && b.type !== 'file' && b.type !== 'toc').map((b) => runsText(b.runs.filter((r) => r.change?.kind !== 'del' && !r.footnote)));
  const stats = useMemo(() => textStats(paragraphs), [paragraphs.join('\n')]); // eslint-disable-line react-hooks/exhaustive-deps
  const often = useMemo(() => wordFrequency(paragraphs, 15), [paragraphs.join('\n')]); // eslint-disable-line react-hooks/exhaustive-deps
  const session = sessionWords(todayWords);
  const target = state.settings.sessionTarget ?? 0;
  const goal = state.settings.dailyGoal ?? 0;
  const same = (f: Focus | null) => JSON.stringify(f) === JSON.stringify(focus);

  return (
    <div className="writing-tab">
      <section aria-label="This session">
        <h3>This session</h3>
        <div className="target-line">
          <b>{n(session)}</b> word{session === 1 ? '' : 's'}
          {target > 0 && <span> of {n(target)}</span>}
          {target > 0 && session >= target && <span className="target-met">Target reached</span>}
        </div>
        {target > 0 && (
          <div className="target-bar" role="progressbar" aria-label="Session target" aria-valuenow={Math.min(session, target)} aria-valuemax={target}>
            <i style={{ width: `${Math.min(100, (session / target) * 100)}%` }} />
          </div>
        )}
        <label className="target-set">
          Session target
          <input type="number" min={0} step={50} value={target || ''} placeholder="None" aria-label="Session target in words" onChange={(e) => store.updateSettings({ sessionTarget: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
        </label>
        <p className="target-today">
          Today: {n(todayWords)} word{todayWords === 1 ? '' : 's'}
          {goal ? ` of your ${n(goal)} daily goal` : ''}
        </p>
      </section>

      <section aria-label="Text statistics">
        <h3>This {state.notes.some((x) => x.id === docId) ? 'note' : state.chapters.some((x) => x.id === docId) ? 'chapter' : 'text'}</h3>
        <dl className="text-stats">
          <dt>Words</dt>
          <dd>{n(stats.words)}</dd>
          <dt>Characters</dt>
          <dd>{n(stats.characters)}</dd>
          <dt>Sentences</dt>
          <dd>{n(stats.sentences)}</dd>
          <dt>Paragraphs</dt>
          <dd>{n(stats.paragraphs)}</dd>
          <dt>Words per sentence</dt>
          <dd>{stats.perSentence}</dd>
          <dt>Reading time</dt>
          <dd>{stats.reading} min</dd>
          <dt>Read aloud</dt>
          <dd>{stats.speaking} min</dd>
        </dl>
      </section>

      <section aria-label="Linguistic focus">
        <h3>Highlight</h3>
        <div className="focus-choices" role="group" aria-label="Highlight in the text">
          {(Object.keys(FOCUS_LABELS) as (keyof typeof FOCUS_LABELS)[]).map((f) => (
            <button key={f} type="button" aria-pressed={same(f)} onClick={() => setFocus(same(f) ? null : f)}>
              {FOCUS_LABELS[f]}
            </button>
          ))}
        </div>
        {focus && (
          <p className="focus-found">
            {found ? `${n(found)} found` : 'None found'}
            {typeof focus === 'object' ? ` of “${focus.word}”` : ''} ·{' '}
            <button type="button" className="link-btn" onClick={() => setFocus(null)}>
              Stop highlighting
            </button>
          </p>
        )}
        {!canHighlight && <p className="right-empty">This browser can’t highlight text this way.</p>}
      </section>

      <section aria-label="Words used most">
        <h3>Words used most</h3>
        {often.length === 0 ? (
          <p className="right-empty">Nothing repeated yet.</p>
        ) : (
          <ul className="word-freq">
            {often.map(({ word, count }) => (
              <li key={word}>
                <button type="button" aria-pressed={same({ word })} title={`Highlight “${word}” in the text`} onClick={() => setFocus(same({ word }) ? null : { word })}>
                  <span className="grow">{word}</span>
                  <span className="word-count">{count}</span>
                  <i style={{ width: `${(count / often[0].count) * 100}%` }} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
