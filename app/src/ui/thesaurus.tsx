// The right sidebar's Thesaurus tab, like Word's (Shift+F7): the word at the
// caret, its meanings and synonyms. Click a synonym to put it in place of the
// word (in the same case); look up another word in the box at the top.

import { useEffect, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { type Selection, runsText } from '@crumpet/editor/model';
import { type LookUp, lookUp, matchCase } from '../data/thesaurus';

/** The word at the caret (or the selected words), and where it is. */
export function wordAtCaret(ed: Editor): { word: string; sel: Selection } | null {
  const sel = ed.state.selection;
  const block = ed.state.doc.blocks.find((b) => b.id === sel.focus.block);
  if (!block) return null;
  const text = runsText(block.runs);
  if (sel.anchor.block === sel.focus.block && sel.anchor.offset !== sel.focus.offset) {
    const [a, b] = sel.anchor.offset < sel.focus.offset ? [sel.anchor.offset, sel.focus.offset] : [sel.focus.offset, sel.anchor.offset];
    const word = text.slice(a, b).trim();
    return word && word.length < 40 ? { word, sel: { anchor: { block: block.id, offset: a }, focus: { block: block.id, offset: b } } } : null;
  }
  if (sel.anchor.block !== sel.focus.block) return null;
  const isWord = (ch: string | undefined) => !!ch && /[\p{L}\p{N}'’-]/u.test(ch);
  let a = sel.focus.offset;
  let b = sel.focus.offset;
  while (a > 0 && isWord(text[a - 1])) a--;
  while (b < text.length && isWord(text[b])) b++;
  const word = text.slice(a, b).replace(/^['’-]+|['’-]+$/g, '');
  if (!word || !/\p{L}/u.test(word)) return null;
  const start = a + text.slice(a, b).indexOf(word);
  return { word, sel: { anchor: { block: block.id, offset: start }, focus: { block: block.id, offset: start + word.length } } };
}

export function ThesaurusTab({ editor }: { editor: Editor }) {
  const [query, setQuery] = useState('');
  const [typed, setTyped] = useState(false);
  const [result, setResult] = useState<LookUp | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'offline' | 'none'>('idle');
  const [here, setHere] = useState<{ word: string; sel: Selection } | null>(null);

  // Follow the caret: the word it's in is looked up (unless a word was typed in the box since).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const follow = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!editor.view.root.contains(document.activeElement) && document.activeElement !== document.body) return;
        editor.currentSelection();
        const w = wordAtCaret(editor);
        setHere(w);
        if (w) {
          setTyped(false);
          setQuery((q) => (q.toLowerCase() === w.word.toLowerCase() ? q : w.word));
        }
      }, 250);
    };
    follow();
    document.addEventListener('selectionchange', follow);
    return () => {
      clearTimeout(t);
      document.removeEventListener('selectionchange', follow);
    };
  }, [editor]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResult(null);
      setState('idle');
      return;
    }
    let live = true;
    setState('loading');
    const t = setTimeout(
      () =>
        lookUp(q).then(
          (r) => {
            if (!live) return;
            setResult(r);
            setState(r.senses.length || r.synonyms.length || r.similar.length ? 'idle' : 'none');
          },
          () => live && setState('offline'),
        ),
      typed ? 350 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, typed]);

  /** Puts a word in place of the one at the caret. */
  const use = (word: string) => {
    if (!here) return;
    editor.select(here.sel);
    editor.focus();
    editor.typeText(matchCase(here.word, word));
  };
  const canReplace = !!here && !typed;
  const words = (list: string[], label: string) =>
    list.length > 0 && (
      <>
        <h3>{label}</h3>
        <div className="syn-list">
          {list.map((w) => (
            <button key={w} type="button" title={canReplace ? `Put “${w}” in place of “${here!.word}”` : `Look up “${w}”`} onMouseDown={(e) => e.preventDefault()} onClick={() => (canReplace ? use(w) : (setTyped(true), setQuery(w)))}>
              {w}
            </button>
          ))}
        </div>
      </>
    );
  return (
    <div className="thesaurus">
      <input
        type="search"
        className="thesaurus-search"
        aria-label="Look up a word"
        placeholder="Look up a word"
        value={query}
        onChange={(e) => {
          setTyped(true);
          setQuery(e.target.value);
        }}
      />
      {canReplace && <p className="right-empty thesaurus-hint">Click a word to use it instead of “{here!.word}”.</p>}
      {state === 'loading' && !result && <p className="right-empty">Looking up…</p>}
      {state === 'offline' && <p className="right-empty">The thesaurus needs an internet connection.</p>}
      {state === 'none' && <p className="right-empty">Nothing found for “{query.trim()}”.</p>}
      {!query.trim() && <p className="right-empty">Put the caret in a word, or type one above, to see its meanings and other words for it.</p>}
      {result && state !== 'offline' && state !== 'none' && result.word === query.trim().toLowerCase() && (
        <>
          {words(result.synonyms, 'Synonyms')}
          {words(result.similar, 'Similar')}
          {words(result.antonyms, 'Opposites')}
          {result.senses.length > 0 && (
            <>
              <h3>Meanings</h3>
              <ol className="senses">
                {result.senses.map((s, i) => (
                  <li key={i}>
                    {s.pos && <em>{s.pos} </em>}
                    {s.definition}
                    {s.example && <span className="sense-example"> “{s.example}”</span>}
                  </li>
                ))}
              </ol>
            </>
          )}
          <p className="thesaurus-credit">From Datamuse and the Free Dictionary API.</p>
        </>
      )}
    </div>
  );
}
