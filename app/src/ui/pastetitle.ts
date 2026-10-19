// A note's (or chapter's) title from what's pasted: a long piece pasted into
// an empty note gives its first line to the title, if it looks like one; and
// several lines pasted into an empty title box keep the first there and send
// the rest to the text. Paste Options can put the line back in the text.

import { useCallback, useRef } from 'react';
import type { ClipboardEvent, RefObject } from 'react';
import { Editor } from '@crumpet/editor/editor';
import { isBlankDoc } from '@crumpet/editor/pastetitle';
import { looksLikeTitle } from '../data/pastetitle';

export function usePasteTitle(editorRef: RefObject<Editor | null>, title: string, setTitle: (title: string) => void) {
  const now = useRef({ title, setTitle });
  now.current = { title, setTitle };
  // Pasting into the title box: the first line goes to the title whatever it looks like.
  const fromBox = useRef(false);

  /** Lets the editor offer pasted first lines to the title. */
  const attach = useCallback((ed: Editor | null) => {
    if (!ed) return;
    let before = '';
    // The line last taken: pasting again another way (Paste Options) takes it again.
    let taken = '';
    const set = (t: string) => {
      now.current.title = t;
      now.current.setTitle(t);
    };
    ed.pasteTitle = {
      take(t, rest, heading) {
        const again = t === taken && !now.current.title.trim();
        if (!again && (fromBox.current ? t.length > 200 : now.current.title.trim() || !looksLikeTitle(t, rest, heading))) return false;
        before = now.current.title;
        taken = t;
        set(t);
        return true;
      },
      giveBack: () => set(before),
    };
  }, []);

  /** The title box's paste: several lines into an empty title (and an empty note) split between the title and the text. */
  const onTitlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const ed = editorRef.current;
      const box = e.currentTarget;
      const text = e.clipboardData.getData('text/plain');
      if (!ed || box.readOnly || !/\S[^\n]*\n[\s\S]*\S/.test(text)) return;
      if (box.value.trim() && !(box.selectionStart === 0 && box.selectionEnd === box.value.length)) return;
      if (!isBlankDoc(ed.state.doc)) return;
      e.preventDefault();
      fromBox.current = true;
      try {
        ed.focusAt('start');
        ed.paste({ text, md: e.clipboardData.getData(Editor.CLIPBOARD_TYPE), html: e.clipboardData.getData('text/html') });
      } finally {
        fromBox.current = false;
      }
    },
    [editorRef],
  );

  return { attach, onTitlePaste };
}
