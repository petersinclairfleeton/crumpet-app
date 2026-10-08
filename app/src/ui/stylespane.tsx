// Word's Styles pane: every style, as it looks, with how often it's used.
// Click one to apply it; its menu updates it to match the selection,
// modifies it, or finds the next paragraph in it.

import { useEffect, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { type StyleDef, type StyleKey, STYLE_LIST, type StyleSheet, styleKeyOf } from '../data/styles';
import type { NoteFont } from '../data/types';
import { googleFonts } from './fonts';
import { IconClose } from './icons';
import { previewCss } from './styles-ui';
import { Popover } from './Sidebar';

/** The style definition a paragraph's own formatting comes to (Word's Update to Match Selection). */
export async function matchSelection(editor: Editor, def: StyleDef): Promise<StyleDef> {
  const blk = editor.currentBlock();
  const p = blk.para ?? {};
  const family = editor.lookValue('font');
  let font: NoteFont | null = def.font;
  if (family) {
    const google = (await googleFonts()).find((f) => f.family === family);
    font = google ?? { family, source: 'system' };
  }
  return {
    ...def,
    font,
    size: editor.lookValue('size') ?? def.size,
    bold: editor.isMarkActive('bold'),
    italic: editor.isMarkActive('italic'),
    align: blk.align ?? def.align,
    spaceBefore: p.before ?? def.spaceBefore,
    spaceAfter: p.after ?? def.spaceAfter,
    lineSpacing: p.line !== undefined ? Math.round(p.line * 1.15 * 100) / 100 : def.lineSpacing,
    firstIndent: p.first ?? def.firstIndent,
    leftIndent: p.left ?? def.leftIndent,
  };
}

export function StylesPane({ editor, sheet, onSheet, onEditStyles, onClose }: { editor: Editor | null; sheet: StyleSheet; onSheet?(s: StyleSheet): void; onEditStyles?(key?: StyleKey): void; onClose(): void }) {
  const [, setTick] = useState(0);
  const [preview, setPreview] = useState(true);
  const [menu, setMenu] = useState<StyleKey | null>(null);
  useEffect(() => {
    if (!editor) return;
    const again = () => setTick((t) => t + 1);
    const off = editor.onChange(again);
    document.addEventListener('selectionchange', again);
    return () => {
      off();
      document.removeEventListener('selectionchange', again);
    };
  }, [editor]);

  const blocks = editor?.state.doc.blocks ?? [];
  const counts = new Map<StyleKey, number>();
  for (const b of blocks) if (b.type !== 'image' && b.type !== 'file' && b.type !== 'table' && b.type !== 'toc') counts.set(styleKeyOf(b), (counts.get(styleKeyOf(b)) ?? 0) + 1);
  const current = editor ? styleKeyOf(editor.currentBlock()) : 'normal';
  const shown = STYLE_LIST.filter((s) => s.inMenu || (counts.get(s.key) ?? 0) > 0);

  const apply = (key: StyleKey) => {
    const s = STYLE_LIST.find((x) => x.key === key)!;
    editor?.focus();
    if (key === 'list') editor?.setBlockType('bullet');
    else editor?.setBlockStyle(s.type, s.style);
  };
  const findNext = (key: StyleKey) => {
    if (!editor) return;
    const at = blocks.findIndex((b) => b.id === editor.currentBlock().id);
    const order = [...blocks.slice(at + 1), ...blocks.slice(0, at + 1)];
    const next = order.find((b) => styleKeyOf(b) === key && b.type !== 'table' && b.type !== 'image' && b.type !== 'file' && b.type !== 'toc');
    if (next) editor.goToBlock(next.id);
  };
  const update = async (key: StyleKey) => {
    if (!editor || !onSheet) return;
    const next = await matchSelection(editor, sheet.styles[key]);
    onSheet({ ...sheet, styles: { ...sheet.styles, [key]: next } });
    // The paragraph's own spacing and indents are the style's now.
    editor.setPara({ before: undefined, after: undefined, line: undefined, first: undefined, left: undefined });
  };

  return (
    <aside className="styles-pane" aria-label="Styles">
      <header className="styles-pane-head">
        <h2>Styles</h2>
        <button type="button" className="icon-btn" aria-label="Close styles pane" onClick={onClose}>
          <IconClose size={14} />
        </button>
      </header>
      <div className="styles-pane-list" role="list">
        {shown.map((s) => {
          const n = counts.get(s.key) ?? 0;
          return (
            <div key={s.key} role="listitem" className={`styles-pane-row${s.key === current ? ' on' : ''}`}>
              <button type="button" className="styles-pane-apply" aria-pressed={s.key === current} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(s.key)} title={`Apply ${s.name}`}>
                <span className="styles-pane-name" style={preview ? { ...previewCss(sheet.styles[s.key]), textAlign: 'left' } : undefined}>
                  {s.name}
                </span>
              </button>
              <span className="styles-pane-count" title={`${n} paragraph${n === 1 ? '' : 's'} in this style`}>
                {n || ''}
              </span>
              <span className="tool-drop">
                <button type="button" className="styles-pane-more" aria-label={`${s.name} options`} aria-expanded={menu === s.key} onMouseDown={(e) => e.preventDefault()} onClick={() => setMenu(menu === s.key ? null : s.key)}>
                  ⋯
                </button>
                {menu === s.key && (
                  <Popover label={`${s.name} options`} onClose={() => setMenu(null)}>
                    {onSheet && (
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => {
                          setMenu(null);
                          void update(s.key);
                        }}
                      >
                        Update {s.name} to match selection
                      </button>
                    )}
                    {onEditStyles && (
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => {
                          setMenu(null);
                          onEditStyles(s.key);
                        }}
                      >
                        Modify…
                      </button>
                    )}
                    <button
                      type="button"
                      className="menu-item"
                      disabled={!n}
                      onClick={() => {
                        setMenu(null);
                        findNext(s.key);
                      }}
                    >
                      Find next ({n})
                    </button>
                  </Popover>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <footer className="styles-pane-foot">
        <label className="check-row">
          <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> Show preview
        </label>
        <button
          type="button"
          className="btn quiet"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            editor?.clearFormatting();
            editor?.setPara({ before: undefined, after: undefined, line: undefined, first: undefined, left: undefined, right: undefined });
            editor?.setBlockStyle('paragraph');
          }}
        >
          Clear all formatting
        </button>
        {onEditStyles && (
          <button type="button" className="btn quiet" onClick={() => onEditStyles()}>
            Manage styles…
          </button>
        )}
      </footer>
    </aside>
  );
}
