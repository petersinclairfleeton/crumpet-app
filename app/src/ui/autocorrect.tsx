// Settings → Writing → AutoCorrect: which corrections are made while typing,
// and replacements of the person's own (like Word's AutoCorrect list).

import { useState } from 'react';
import { AUTOCORRECT_DEFAULTS, type AutoCorrectOptions } from '@crumpet/editor/autocorrect';
import { useAppState, useAppStore } from './hooks';
import { IconClose } from './icons';

const KINDS: [keyof typeof AUTOCORRECT_DEFAULTS, string][] = [
  ['quotes', '“Curly” quotes and apostrophes'],
  ['dashes', 'Dashes: word--word to word—word, and 1 - 5 to 1 – 5'],
  ['symbols', 'Symbols: ... to …, (c) to ©, (tm) to ™, -> to →'],
  ['capitals', 'A capital at the start of each sentence, and I'],
  ['typos', 'Put common typos right (teh to the, dont to don’t)'],
];

export function AutoCorrectSettings() {
  const state = useAppState();
  const store = useAppStore();
  const ac: AutoCorrectOptions = state.settings.autocorrect ?? {};
  const set = (patch: AutoCorrectOptions) => store.updateSettings({ autocorrect: { ...ac, ...patch } });
  const words = Object.entries(ac.words ?? {});
  const [typo, setTypo] = useState('');
  const [right, setRight] = useState('');
  const add = () => {
    const t = typo.trim().toLowerCase();
    if (!t || !right.trim() || /\s/.test(t)) return;
    set({ words: { ...ac.words, [t]: right.trim() } });
    setTypo('');
    setRight('');
  };
  const remove = (t: string) => {
    const next = { ...ac.words };
    delete next[t];
    set({ words: next });
  };
  return (
    <div className="field" role="group" aria-label="AutoCorrect">
      <span>AutoCorrect</span>
      <p className="sync-hint">Put right as you type. Press Ctrl+Z straight after a correction to take it back.</p>
      {KINDS.map(([key, label]) => (
        <label key={key} className="check-row">
          <input type="checkbox" checked={ac[key] ?? AUTOCORRECT_DEFAULTS[key]} onChange={(e) => set({ [key]: e.target.checked })} />
          {label}
        </label>
      ))}
      <div className="ac-words" role="group" aria-label="Your own replacements">
        {words.map(([t, r]) => (
          <div key={t} className="ac-word">
            <code>{t}</code>
            <span aria-hidden="true">→</span>
            <span className="grow">{r}</span>
            <button type="button" className="icon-btn" aria-label={`Remove ${t}`} onClick={() => remove(t)}>
              <IconClose size={12} />
            </button>
          </div>
        ))}
        <form
          className="ac-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input aria-label="Replace" placeholder="Replace (e.g. lizzy)" value={typo} onChange={(e) => setTypo(e.target.value)} />
          <span aria-hidden="true">→</span>
          <input aria-label="With" placeholder="With (e.g. Elizabeth)" value={right} onChange={(e) => setRight(e.target.value)} />
          <button type="submit" className="btn" aria-label="Add replacement" disabled={!typo.trim() || !right.trim()}>
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
