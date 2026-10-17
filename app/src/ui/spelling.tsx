// Spelling settings, like Word's proofing options: the browser checks
// spelling as you type (in the language chosen, where the browser can), and
// passes over words in your own dictionary, the names of your characters and
// places, and words you've told it to ignore for now.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { AppState } from '../data/store';
import { useAppState, useAppStore } from './hooks';
import { IconChevronDown, IconClose } from './icons';
import { SettingGroup, Switch } from './settingrows';

export const SPELL_LANGS: [string, string][] = [
  ['', 'The browser’s own'],
  ['en-GB', 'English (UK)'],
  ['en-US', 'English (US)'],
  ['en-AU', 'English (Australia)'],
  ['en-CA', 'English (Canada)'],
  ['fr', 'French'],
  ['de', 'German'],
  ['es', 'Spanish'],
  ['it', 'Italian'],
  ['nl', 'Dutch'],
  ['pt', 'Portuguese'],
];

// Ignore all: words passed over until Crumpet is closed (as Word's Ignore All lasts while the document is open).
let ignored: string[] = [];
const listeners = new Set<() => void>();

export function ignoreWord(word: string): void {
  const w = word.trim().toLowerCase();
  if (!w || ignored.includes(w)) return;
  ignored = [...ignored, w];
  listeners.forEach((f) => f());
}

function useIgnored(): string[] {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => ignored,
    () => ignored,
  );
}

/** Every word the spelling check passes over: your dictionary, characters' and places' names (each word of them), and words ignored for now. */
export function passedWords(state: AppState, extra: string[] = []): string[] {
  const names = state.projects.flatMap((p) => p.cast ?? []).flatMap((m) => [m.name, ...m.aliases]);
  return [...(state.settings.spelling?.words ?? []), ...names.flatMap((n) => n.split(/[\s.,;:!?()"“”]+/)), ...extra].filter((w) => /\p{L}/u.test(w));
}

/** Keeps an editor's spelling check as Settings say. */
export function useSpelling(editor: Editor | null): void {
  const state = useAppState();
  const sp = state.settings.spelling;
  const ign = useIgnored();
  const words = useMemo(() => passedWords(state, ign), [state.settings.spelling?.words, state.projects, ign]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    editor?.setSpelling({ on: !sp?.off, lang: sp?.lang || undefined, words });
  }, [editor, sp?.off, sp?.lang, words]);
}

/** Adds a word to your dictionary. */
export function useAddWord(): (word: string) => void {
  const store = useAppStore();
  return (word) => {
    const w = word.trim();
    const sp = store.getState().settings.spelling ?? {};
    if (!w || (sp.words ?? []).some((x) => x.toLowerCase() === w.toLowerCase())) return;
    store.updateSettings({ spelling: { ...sp, words: [...(sp.words ?? []), w].sort((a, b) => a.localeCompare(b)) } });
  };
}

/** Settings → Writing → Spelling. */
export function SpellingSettings() {
  const state = useAppState();
  const store = useAppStore();
  const sp = state.settings.spelling ?? {};
  const add = useAddWord();
  const [word, setWord] = useState('');
  const names = state.projects.flatMap((p) => p.cast ?? []).length;
  return (
    <SettingGroup title="Spelling">
      <Switch
        label="Check spelling as you type"
        hint={names ? 'Your browser does the checking. Your characters’ and places’ names are never marked.' : 'Your browser does the checking. Names of characters and places in your books are never marked.'}
        on={!sp.off}
        onChange={(v) => store.updateSettings({ spelling: { ...sp, off: !v || undefined } })}
      />
      <label className="settings-row">
        <span>
          <b>Language</b>
          <small>In Chrome and Edge, add it in the browser’s own settings (Languages) too.</small>
        </span>
        <span className="select-wrap">
          <select value={sp.lang ?? ''} onChange={(e) => store.updateSettings({ spelling: { ...sp, lang: e.target.value || undefined } })}>
            {SPELL_LANGS.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <IconChevronDown size={14} />
        </span>
      </label>
      <div className="ac-words" role="group" aria-label="Your dictionary">
        <span className="ac-words-title">Your dictionary</span>
        {(sp.words ?? []).map((w) => (
          <div key={w} className="ac-word">
            <span className="grow">{w}</span>
            <button type="button" className="icon-btn" aria-label={`Remove ${w}`} onClick={() => store.updateSettings({ spelling: { ...sp, words: (sp.words ?? []).filter((x) => x !== w) } })}>
              <IconClose size={12} />
            </button>
          </div>
        ))}
        <form
          className="ac-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!word.trim() || /\s/.test(word.trim())) return;
            add(word);
            setWord('');
          }}
        >
          <input aria-label="Add a word to your dictionary" placeholder="Add a word to your dictionary" value={word} onChange={(e) => setWord(e.target.value)} />
          <button type="submit" className="btn" aria-label="Add word" disabled={!word.trim() || /\s/.test(word.trim())}>
            Add
          </button>
        </form>
      </div>
    </SettingGroup>
  );
}
