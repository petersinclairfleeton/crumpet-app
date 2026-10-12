// Saved snippets (Word's AutoText and Building Blocks): bits of text kept
// with their formatting, dropped in from the Snippets menu, or by typing a
// snippet's name and pressing F3. And Word's Text from File: another
// document (Word, Markdown or plain text) poured in at the caret.

import { useEffect, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { toMarkdown } from '@crumpet/editor/markdown';
import { Popover } from './Sidebar';
import { type ToolItem, closeMore } from './toolbar';
import { useAppState, useAppStore } from './hooks';
import { readWordFile } from '../data/wordfiles';
import type { Snippet } from '../data/types';

/** Typing a snippet's name and pressing F3 puts the snippet in its place (set on each editor). */
export function useSnippets(editor: Editor | null): void {
  const snippets = useAppState().settings.snippets;
  useEffect(() => {
    if (!editor) return;
    const root = editor.view.root;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F3' || e.ctrlKey || e.metaKey || e.altKey) return;
      const at = editor.currentSelection().focus;
      const text = editor.currentBlock().runs.map((r) => r.text).join('').slice(0, at.offset);
      const word = /[\p{L}\p{N}_-]+$/u.exec(text)?.[0] ?? '';
      const snip = word && (snippets ?? []).find((x) => x.name.toLowerCase() === word.toLowerCase());
      if (!snip) return;
      e.preventDefault();
      editor.deleteBefore(word.length);
      editor.paste({ text: '', md: snip.md });
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [editor, snippets]);
}

function SnippetTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const state = useAppState();
  const store = useAppStore();
  const snippets = state.settings.snippets ?? [];
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);
  const [error, setError] = useState('');
  const put = (s: Snippet) => {
    setOpen(false);
    closeMore();
    ed?.focus();
    ed?.paste({ text: '', md: s.md });
  };
  const save = () => {
    const name = (naming ?? '').trim();
    const md = ed?.selectedMarkdown();
    if (!md?.trim()) return setError('Select the text to keep first.');
    if (!/^[\p{L}\p{N}_-]{1,30}$/u.test(name)) return setError('A name is one word (letters, figures, - and _).');
    store.updateSettings({ snippets: [...snippets.filter((x) => x.name.toLowerCase() !== name.toLowerCase()), { name, md }].sort((a, b) => a.name.localeCompare(b.name)) });
    setNaming(null);
    setError('');
  };
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Snippets" aria-expanded={open} title="Snippets (AutoText): saved bits of text to drop in" disabled={off} onClick={() => setOpen(!open)}>
        {ICON_SNIP}
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <Popover label="Snippets" onClose={() => (setOpen(false), setNaming(null), setError(''))}>
          {snippets.length ? (
            <div className="snippet-list" role="group" aria-label="Your snippets">
              {snippets.map((s) => (
                <div key={s.name} className="snippet-row">
                  <button type="button" className="menu-item" title={s.md.slice(0, 200)} onClick={() => put(s)}>
                    <strong>{s.name}</strong>
                    <span className="snippet-peek">{s.md.replace(/[*_#>`[\]{}]/g, '').replace(/\s+/g, ' ').slice(0, 50)}</span>
                  </button>
                  <button type="button" className="icon-btn keep-open" aria-label={`Delete snippet ${s.name}`} title="Delete" onClick={() => store.updateSettings({ snippets: snippets.filter((x) => x !== s) })}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="menu-note">No snippets yet. Select some text, then save it here to drop in again (or type its name and press F3).</p>
          )}
          <hr className="menu-sep" />
          {naming === null ? (
            <button type="button" className="menu-item keep-open" onClick={() => setNaming('')}>
              Save selection as a snippet…
            </button>
          ) : (
            <form
              className="snippet-name"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <input aria-label="Snippet name" autoFocus placeholder="A one-word name" value={naming} onChange={(e) => setNaming(e.target.value)} />
              <button type="submit" className="btn small primary">
                Save
              </button>
            </form>
          )}
          {error && <p className="error">{error}</p>}
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              closeMore();
              if (ed) chooseTextFile(ed);
            }}
          >
            Text from file…
          </button>
        </Popover>
      )}
    </span>
  );
}

/** Word's Text from File: a Word document, Markdown or plain text, poured in at the caret. */
export function chooseTextFile(ed: Editor): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.docx,.md,.markdown,.txt,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      ed.focus();
      if (/\.docx$/i.test(file.name)) ed.paste({ text: '', md: toMarkdown((await readWordFile(file)).doc) });
      else if (/\.(md|markdown)$/i.test(file.name)) ed.paste({ text: '', md: await file.text() });
      else ed.paste({ text: await file.text() }, 'text');
    } catch (err) {
      alert(err instanceof Error ? err.message : `${file.name} couldn’t be read.`);
    }
  };
  input.click();
}

export function snippetItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [{ key: 'snippets', label: 'Snippets', pri: 1, node: <SnippetTool ed={ed} off={off} /> }];
}

const ICON_SNIP = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M8 10h8M8 14h5" />
    <path d="M16 3v4M8 3v4" />
  </svg>
);
