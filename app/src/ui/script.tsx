// The script bar: while the caret is in a script's element, which one it is,
// the others a click away, screenplay or stage play, and what Enter and Tab
// do. It sits at the foot of the page.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { SCRIPT_STYLES, type ScriptStyle, isScript } from '@crumpet/editor/script';

export const SCRIPT_NAMES: Record<ScriptStyle, string> = {
  'sc-scene': 'Scene heading',
  'sc-action': 'Action',
  'sc-char': 'Character',
  'sc-paren': 'Parenthetical',
  'sc-dial': 'Dialogue',
  'sc-trans': 'Transition',
};

export function ScriptBar({ editor, host }: { editor: Editor | null; host: React.RefObject<HTMLElement> }) {
  const [style, setStyle] = useState<ScriptStyle | null>(null);
  const [stage, setStage] = useState(false);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor) return;
    const check = () => {
      // Choosing in the bar (its Layout menu) keeps it open.
      if (bar.current?.contains(document.activeElement)) return;
      const root = editor.view.root;
      const sel = root.ownerDocument.getSelection();
      const inside = !!sel?.anchorNode && root.contains(sel.anchorNode);
      const b = editor.currentBlock();
      const now = inside && b.type === 'paragraph' && isScript(b.style) ? b.style : null;
      setStyle(now);
      setStage(editor.docPara().script === 'stage');
      const box = host.current?.getBoundingClientRect();
      // At the foot of the window, under the middle of the page.
      if (now && box) setAt({ left: Math.min(window.innerWidth - 8, Math.max(8, box.left + box.width / 2)), top: window.innerHeight - 58 });
    };
    const off = editor.onChange(check);
    document.addEventListener('selectionchange', check);
    window.addEventListener('resize', check);
    check();
    return () => {
      off();
      document.removeEventListener('selectionchange', check);
      window.removeEventListener('resize', check);
    };
  }, [editor, host]);
  // Kept inside the window.
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el || !at) return;
    const w = el.offsetWidth;
    const left = Math.min(window.innerWidth - w / 2 - 8, Math.max(w / 2 + 8, at.left));
    if (Math.abs(left - at.left) > 1) setAt({ ...at, left });
  }, [at, style]);
  // While it shows, the sprint bar sits above it (app.css).
  const shown = !!(editor && style && at);
  useEffect(() => {
    if (!shown) return;
    document.documentElement.setAttribute('data-script-bar', '1');
    return () => document.documentElement.removeAttribute('data-script-bar');
  }, [shown]);
  if (!editor || !style || !at) return null;
  return createPortal(
    <div ref={bar} className="script-bar" role="toolbar" aria-label="Script" title="Enter: what comes next · Tab: change" style={{ left: at.left, top: at.top }} onMouseDown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()}>
      {SCRIPT_STYLES.map((s) => (
        <button key={s} type="button" aria-pressed={s === style} onClick={() => editor.setBlockStyle('paragraph', s)}>
          {SCRIPT_NAMES[s]}
        </button>
      ))}
      <select
        aria-label="Layout"
        value={stage ? 'stage' : 'screen'}
        onChange={(e) => {
          editor.setDocPara({ script: e.target.value === 'stage' ? 'stage' : undefined });
          setStage(e.target.value === 'stage');
          editor.view.root.focus();
        }}
      >
        <option value="screen">Screenplay</option>
        <option value="stage">Stage play</option>
      </select>
    </div>,
    document.body,
  );
}
