// Grammar checking: the Check tab's Grammar pass (each finding with its fixes,
// Go to, Ignore and Turn off this rule), blue wavy lines under what it finds,
// and, with Settings → Writing → Check grammar as you write, the same lines
// while you write. Harper does the checking on this device (grammarengine.ts).

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { Pos } from '@crumpet/editor/model';
import { type GrammarIssue, KIND_NAMES, grammarIssues, grammarText, issueKey } from '../data/grammar';
import type { AppState } from '../data/store';
import { grammarEngine } from './grammarengine';
import { useAppState, useAppStore } from './hooks';
import { SettingGroup, Switch } from './settingrows';
import { passedWords } from './spelling';

const canHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

// Ignore: findings passed over until Crumpet is closed (as Word's Ignore does).
let ignored = new Set<string>();

// What each editor's latest check found, for the lines under the words, the Check tab and the right-click menu.
const found = new Map<Editor, GrammarIssue[]>();
const listeners = new Set<() => void>();
let version = 0;
let frame = 0;

function changed(): void {
  version++;
  listeners.forEach((f) => f());
  repaint();
}

/** What an editor's latest check found (null before one has run), kept up to date. */
function useFound(editor: Editor): GrammarIssue[] | null {
  useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => version,
  );
  return found.get(editor) ?? null;
}

/** Draws the lines under every open editor's findings (one highlight for them all). */
function repaint(): void {
  if (!canHighlight) return;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const ranges: Range[] = [];
    for (const [editor, issues] of found) {
      if (!editor.view.root.isConnected) continue;
      for (const i of issues) {
        if (ignored.has(issueKey(i)) || i.to <= i.from) continue;
        const r = editor.rangeOf({ block: i.block, from: i.from, to: i.to });
        if (r) ranges.push(r);
      }
    }
    if (ranges.length) CSS.highlights.set('crumpet-grammar', new Highlight(...ranges));
    else CSS.highlights.delete('crumpet-grammar');
  });
}

function show(editor: Editor, issues: GrammarIssue[] | null): void {
  if (issues) found.set(editor, issues);
  else found.delete(editor);
  changed();
}

/** The finding under a place in an editor's text (for the right-click menu). */
export function grammarAt(editor: Editor, pos: Pos): GrammarIssue | null {
  return found.get(editor)?.find((i) => i.block === pos.block && i.from <= pos.offset && pos.offset <= i.to && !ignored.has(issueKey(i))) ?? null;
}

/** Leaves a finding out from now on (until Crumpet is closed). */
export function ignoreIssue(i: GrammarIssue): void {
  ignored = new Set(ignored).add(issueKey(i));
  changed();
}

/** Puts a fix in, as one step to undo. */
export function applyFix(editor: Editor, i: GrammarIssue, fix: GrammarIssue['fixes'][number]): void {
  editor.replace([{ block: i.block, from: fix.from, to: fix.to }], fix.text);
  // The rest are worked out again straight after the change.
  found.set(
    editor,
    (found.get(editor) ?? []).filter((x) => x !== i),
  );
  changed();
}

/** What the engine needs from Settings: the language, words it should know, and rules turned off. */
function engineOptions(state: AppState) {
  return { lang: state.settings.spelling?.lang || navigator.language, words: passedWords(state), off: state.settings.grammar?.off ?? [] };
}

/** Checks an editor's text: what Harper finds, as places in it. */
async function check(editor: Editor, state: AppState): Promise<GrammarIssue[]> {
  const opts = engineOptions(state);
  const engine = await grammarEngine(opts);
  const source = grammarText(editor.state.doc);
  return grammarIssues(source, await engine.lint(source.text), opts.off);
}

/** Checks an editor again a moment after each change while `on`, and lines what it finds. */
function useRecheck(editor: Editor | null, on: boolean, onFailed?: (failed: boolean) => void): void {
  const state = useAppState();
  const stateRef = useRef(state);
  stateRef.current = state;
  const opts = useMemo(() => JSON.stringify(engineOptions(state)), [state.settings.spelling, state.settings.grammar, state.projects]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editor || !on) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;
    let again = false;
    const run = async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        const issues = await check(editor, stateRef.current);
        if (live) {
          show(editor, issues);
          onFailed?.(false);
        }
      } catch {
        if (live) onFailed?.(true);
      }
      running = false;
      if (again && live) {
        again = false;
        void run();
      }
    };
    void run();
    const off = editor.onChange(() => {
      // Lines move with the text straight away; the findings are worked out again once typing pauses.
      repaint();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), 900);
    });
    return () => {
      live = false;
      off();
      if (timer) clearTimeout(timer);
      show(editor, null);
    };
  }, [editor, on, opts]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Settings → Writing → Check grammar as you write: lines under what Harper finds, in every note and chapter. */
export function useLiveGrammar(editor: Editor | null): void {
  const on = !!useAppState().settings.grammar?.live;
  useRecheck(editor, on);
}

/** The Check tab's Grammar pass. */
export function GrammarPass({ editor }: { editor: Editor }) {
  const state = useAppState();
  const store = useAppStore();
  const g = state.settings.grammar ?? {};
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  // With checking as you write on, the findings are already there.
  useRecheck(editor, started && !g.live, setFailed);
  const issues = useFound(editor);
  const left = (issues ?? []).filter((i) => !ignored.has(issueKey(i)));
  const busy = (started || g.live) && issues === null && !failed;
  const turnOff = (rule: string) => store.updateSettings({ grammar: { ...g, off: [...new Set([...(g.off ?? []), rule])] } });
  const goTo = (i: GrammarIssue) => {
    editor.goToBlock(i.block);
    editor.select({ anchor: { block: i.block, offset: i.from }, focus: { block: i.block, offset: i.to } });
  };
  return (
    <section className="check-list grammar-pass" aria-label="Grammar">
      <p className="right-empty">Grammar, punctuation and word choice, checked on this device by Harper: your writing never leaves it. The first check fetches the checker (about 8 MB), then it works offline.</p>
      {!g.live && !started && (
        <button type="button" className="btn primary small" onClick={() => setStarted(true)}>
          Check grammar
        </button>
      )}
      {busy && <p className="sync-hint">Checking…</p>}
      {failed && <p className="sync-hint">The grammar checker couldn’t be loaded (are you offline the first time?).</p>}
      {issues && left.length === 0 && <p className="check-clear">✓ Nothing to look at.</p>}
      {left.length > 0 && (
        <ul>
          {left.map((i) => (
            <li key={`${i.block}:${i.from}:${i.rule}`} className="check-issue grammar-issue">
              <strong>{KIND_NAMES[i.kind] ?? i.kind}</strong>
              <span>
                <q>{i.text.length > 40 ? `${i.text.slice(0, 40)}…` : i.text}</q> {i.message}
              </span>
              <span className="check-actions">
                {i.fixes.map((f) => (
                  <button key={`${f.from}:${f.text}`} type="button" className="btn small" title={f.text ? `Change to “${f.text}”` : 'Take it out'} onClick={() => applyFix(editor, i, f)}>
                    {f.label}
                  </button>
                ))}
                <button type="button" className="btn quiet small" onClick={() => goTo(i)}>
                  Go to
                </button>
                <button type="button" className="btn quiet small" onClick={() => ignoreIssue(i)}>
                  Ignore
                </button>
                <button type="button" className="btn quiet small" title="Don’t check for this again (Settings → Writing → Grammar turns rules back on)" onClick={() => turnOff(i.rule)}>
                  Turn off this rule
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Settings → Writing → Grammar. */
export function GrammarSettings() {
  const state = useAppState();
  const store = useAppStore();
  const g = state.settings.grammar ?? {};
  const off = g.off ?? [];
  return (
    <SettingGroup title="Grammar">
      <Switch
        label="Check grammar as you write"
        hint="Blue wavy lines under grammar, punctuation and word choice to look at (right-click one for fixes). Checked on this device: the first time fetches the checker (about 8 MB)."
        on={!!g.live}
        onChange={(v) => store.updateSettings({ grammar: { ...g, live: v || undefined } })}
      />
      {off.length > 0 && (
        <div className="settings-row">
          <span>
            <b>Rules turned off</b>
            <small>{off.map((r) => r.replace(/([a-z])([A-Z])/g, '$1 $2')).join(', ')}</small>
          </span>
          <button type="button" className="btn" onClick={() => store.updateSettings({ grammar: { ...g, off: undefined } })}>
            Turn them back on
          </button>
        </div>
      )}
    </SettingGroup>
  );
}
