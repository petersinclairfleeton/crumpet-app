// The right sidebar's Check tab, like Word's Review tools: accessibility,
// compatibility with Word, Inspect Document (comments, changes, people,
// hidden text), a spelling pass with suggestions, clarity and inclusive
// language. Each issue can be gone to, and fixed when there's a better word.

import { useEffect, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { comments } from '@crumpet/editor/model';
import { type Issue, accessibility, clarity, compatibility, inclusive, inspect, wordsToSpell } from '../data/checks';
import { misspellings } from '../data/spell';
import { useAppState, useAppStore } from './hooks';

type Kind = 'access' | 'compat' | 'inspect' | 'spelling' | 'clarity' | 'inclusive';
const KINDS: [Kind, string][] = [
  ['access', 'Accessibility'],
  ['compat', 'Word'],
  ['inspect', 'Inspect'],
  ['spelling', 'Spelling'],
  ['clarity', 'Clarity'],
  ['inclusive', 'Inclusive'],
];

/** Redraws when the text changes. */
function useEdits(editor: Editor): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const off = editor.onChange(() => setN((x) => x + 1));
    // Catch a change made between drawing and listening (a document loaded just as the tab opened).
    setN((x) => x + 1);
    return off;
  }, [editor]);
  return n;
}

/** Selects an issue's words (or its block) and brings it into view. */
function goTo(editor: Editor, i: { block: string; from?: number; to?: number }): void {
  editor.goToBlock(i.block);
  if (i.from !== undefined) editor.select({ anchor: { block: i.block, offset: i.from }, focus: { block: i.block, offset: i.to ?? i.from } });
}

export function CheckTab({ editor }: { editor: Editor }) {
  const [kind, setKind] = useState<Kind>('access');
  useEdits(editor);
  return (
    <div className="check-tab">
      <div className="check-kinds" role="tablist" aria-label="Checks">
        {KINDS.map(([k, name]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            {name}
          </button>
        ))}
      </div>
      {kind === 'inspect' ? <Inspector editor={editor} /> : kind === 'spelling' ? <SpellingPass editor={editor} /> : <IssueList editor={editor} kind={kind} />}
    </div>
  );
}

const INTRO: Record<'access' | 'compat' | 'clarity' | 'inclusive', [string, string]> = {
  access: ['Accessibility', 'Things that make the document harder to read with a screen reader or for people with low vision.'],
  compat: ['Compatibility with Word', 'What a Word download won’t keep, or shows differently.'],
  clarity: ['Clarity', 'Wordy phrases with plainer ones. (The Writing tab lights up -ly adverbs, filler words and passive verbs too.)'],
  inclusive: ['Inclusive language', 'Words with fairer alternatives that include everyone.'],
};

function IssueList({ editor, kind }: { editor: Editor; kind: 'access' | 'compat' | 'clarity' | 'inclusive' }) {
  const [ignored, setIgnored] = useState<string[]>([]);
  const doc = editor.state.doc;
  const all = kind === 'access' ? accessibility(doc) : kind === 'compat' ? compatibility(doc) : kind === 'clarity' ? clarity(doc) : inclusive(doc);
  const key = (i: Issue) => `${i.block}:${i.from ?? ''}:${i.title}`;
  const issues = all.filter((i) => !ignored.includes(key(i)));
  const [title, intro] = INTRO[kind];
  return (
    <section className="check-list" aria-label={title}>
      <p className="right-empty">{intro}</p>
      {issues.length === 0 ? (
        <p className="check-clear">✓ Nothing to look at.</p>
      ) : (
        <ul>
          {issues.map((i) => (
            <li key={key(i)} className="check-issue">
              <strong>{i.title}</strong>
              <span>{i.hint}</span>
              <span className="check-actions">
                <button type="button" className="btn quiet small" onClick={() => goTo(editor, i)}>
                  Go to
                </button>
                {i.fix !== undefined && i.from !== undefined && (
                  <button type="button" className="btn small" onClick={() => editor.replace([{ block: i.block, from: i.from!, to: i.to! }], i.fix!)}>
                    Use “{i.fix}”
                  </button>
                )}
                <button type="button" className="btn quiet small" onClick={() => setIgnored([...ignored, key(i)])}>
                  Ignore
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Inspect Document: what's there besides the text, and taking it out. */
function Inspector({ editor }: { editor: Editor }) {
  const doc = editor.state.doc;
  const r = inspect(doc);
  const removeComments = () => {
    for (const c of comments(editor.state.doc)) editor.setComment(c.comment.id, null);
  };
  const removeHidden = () => {
    const matches: { block: string; from: number; to: number }[] = [];
    for (const b of editor.state.doc.blocks) {
      let at = 0;
      for (const run of b.runs) {
        if (run.look?.hidden) matches.push({ block: b.id, from: at, to: at + run.text.length });
        at += run.text.length;
      }
    }
    if (matches.length) editor.replace(matches, '');
  };
  const row = (label: string, n: number, what: string, action?: [string, () => void]) => (
    <li className="check-issue">
      <strong>{label}</strong>
      <span>{n ? what : 'None.'}</span>
      {n > 0 && action && (
        <span className="check-actions">
          <button type="button" className="btn small" onClick={action[1]}>
            {action[0]}
          </button>
        </span>
      )}
    </li>
  );
  return (
    <section className="check-list" aria-label="Inspect document">
      <p className="right-empty">What’s in the document besides its text: worth looking at before you share it.</p>
      <ul>
        {row('Comments', r.comments, `${r.comments} comment${r.comments === 1 ? '' : 's'}.`, ['Remove all comments', removeComments])}
        {row('Tracked changes', r.changes, `${r.changes} change${r.changes === 1 ? '' : 's'} not yet accepted or rejected.`, ['Accept all changes', () => editor.resolveChanges(true)])}
        {row('People', r.people.length, `Names in comments and changes: ${r.people.join(', ')}.`)}
        {row('Hidden text', r.hiddenText, `${r.hiddenText} piece${r.hiddenText === 1 ? '' : 's'} of hidden text (shown only with Show/hide ¶).`, ['Remove hidden text', removeHidden])}
        {row('Hidden pictures and shapes', r.hiddenObjects, `${r.hiddenObjects} hidden in the Selection pane (still in the document and in Word).`)}
      </ul>
    </section>
  );
}

/** A spelling pass: each misspelt word once, with suggestions, Change, Change all, Ignore and Add to dictionary. */
function SpellingPass({ editor }: { editor: Editor }) {
  const { settings } = useAppState();
  const store = useAppStore();
  const known = settings.spelling?.words ?? [];
  const [found, setFound] = useState<Awaited<ReturnType<typeof misspellings>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ignored, setIgnored] = useState<string[]>([]);
  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setFound(await misspellings(wordsToSpell(editor.state.doc), settings.spelling?.lang, known));
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };
  const left = (found ?? []).filter((f) => !ignored.includes(f.word) && !known.includes(f.word));
  const change = (f: (typeof left)[number], to: string, all: boolean) => {
    // The places as they are now (the text may have moved): the same word found again.
    const now = wordsToSpell(editor.state.doc).filter((w) => w.word === f.word);
    const targets = all ? now : now.slice(0, 1);
    if (targets.length) editor.replace(targets, to);
    if (all || now.length <= 1) setIgnored([...ignored, f.word]);
  };
  return (
    <section className="check-list" aria-label="Spelling">
      <p className="right-empty">Goes through the document word by word ({/^en-US$/i.test(settings.spelling?.lang ?? '') ? 'American' : 'British'} English, with your own dictionary from Settings → Writing).</p>
      <button type="button" className="btn primary small" disabled={busy} onClick={() => void run()}>
        {busy ? 'Checking…' : found ? 'Check again' : 'Check spelling'}
      </button>
      {failed && <p className="sync-hint">The dictionary couldn’t be loaded (are you offline the first time?).</p>}
      {found && left.length === 0 && <p className="check-clear">✓ No spelling mistakes found.</p>}
      {left.length > 0 && (
        <ul>
          {left.map((f) => (
            <li key={f.word} className="check-issue spelling-issue">
              <strong>{f.word}</strong>
              <span>{f.places.length > 1 ? `${f.places.length} times` : 'Not in the dictionary'}</span>
              <span className="check-actions">
                {f.suggestions.map((s) => (
                  <button key={s} type="button" className="btn small" title={`Change to “${s}”${f.places.length > 1 ? ' (here; Change all for every place)' : ''}`} onClick={() => change(f, s, false)}>
                    {s}
                  </button>
                ))}
                {f.suggestions[0] && f.places.length > 1 && (
                  <button type="button" className="btn quiet small" onClick={() => change(f, f.suggestions[0], true)}>
                    Change all to “{f.suggestions[0]}”
                  </button>
                )}
                <button type="button" className="btn quiet small" onClick={() => goTo(editor, f.places[0])}>
                  Go to
                </button>
                <button type="button" className="btn quiet small" onClick={() => setIgnored([...ignored, f.word])}>
                  Ignore
                </button>
                <button type="button" className="btn quiet small" onClick={() => store.updateSettings({ spelling: { ...settings.spelling, words: [...known, f.word] } })}>
                  Add to dictionary
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
