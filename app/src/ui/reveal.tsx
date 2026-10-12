// Word's Reveal Formatting (and Style Inspector): what the text at the caret
// looks like and where each part comes from, its paragraph style or set by
// hand on the text. Shown at the foot of the Styles pane.

import type { Editor } from '@crumpet/editor/editor';
import { type StyleSheet, blockStyleKey, styleDefFor, styleNameIn } from '../data/styles';

const pt = (n: number) => `${Math.round(n * 10) / 10} pt`;
const inch = (n: number) => `${Math.round(n * 100) / 100} in`;

/** The lines Reveal Formatting shows: [heading, [label, value, set by hand?][]] per section. */
export function revealLines(editor: Editor, sheet: StyleSheet): [string, [string, string, boolean][]][] {
  const blk = editor.currentBlock();
  const key = blockStyleKey(sheet, blk);
  const def = styleDefFor(sheet, key);
  const font: [string, string, boolean][] = [];
  const family = editor.lookValue('font');
  font.push(['Font', family ?? (def.font?.family || 'Your writing font'), !!family]);
  const size = editor.lookValue('size');
  font.push(['Size', size ? pt(size) : def.size ? pt(def.size) : 'Your text size', !!size]);
  const marks = (['bold', 'italic', 'underline', 'strike'] as const).filter((m) => editor.isMarkActive(m));
  const fromStyle = [def.bold ? 'bold' : '', def.italic ? 'italic' : '', def.caps ? 'capitals' : ''].filter(Boolean);
  if (fromStyle.length) font.push(['Style', fromStyle.join(', '), false]);
  if (marks.length) font.push(['Emphasis', marks.join(', '), true]);
  const color = editor.lookValue('color');
  if (color) font.push(['Colour', color, true]);
  const hl = editor.lookValue('highlight');
  if (hl) font.push(['Highlight', hl, true]);
  const va = editor.lookValue('va');
  if (va) font.push(['Position', va === 'super' ? 'Superscript' : 'Subscript', true]);
  const caps = editor.lookValue('caps');
  if (caps) font.push(['Capitals', caps === 'small' ? 'Small caps' : 'All caps', true]);
  const ul = editor.lookValue('ul');
  if (ul) font.push(['Underline', ul, true]);
  const sp = editor.lookValue('sp');
  if (sp) font.push(['Spacing', `${sp > 0 ? 'Expanded' : 'Condensed'} by ${pt(Math.abs(sp))}`, true]);
  const fx = editor.lookValue('fx');
  if (fx) font.push(['Effect', fx, true]);

  const p = blk.para ?? {};
  const para: [string, string, boolean][] = [];
  para.push(['Style', styleNameIn(sheet, key), false]);
  const ALIGN: Record<string, string> = { left: 'Left', center: 'Centred', right: 'Right', justify: 'Justified' };
  para.push(['Alignment', ALIGN[blk.align ?? def.align] ?? 'Left', !!blk.align]);
  para.push(['Space before', pt(p.before ?? def.spaceBefore), p.before !== undefined]);
  para.push(['Space after', pt(p.after ?? def.spaceAfter), p.after !== undefined]);
  para.push(['Line spacing', p.line !== undefined ? `${p.line} lines` : `${def.lineSpacing}× the size`, p.line !== undefined]);
  if (p.left ?? def.leftIndent) para.push(['Left indent', inch(p.left ?? def.leftIndent), p.left !== undefined]);
  if (p.right) para.push(['Right indent', inch(p.right), true]);
  const first = p.first ?? def.firstIndent;
  if (first) para.push([first < 0 ? 'Hanging' : 'First line', inch(Math.abs(first)), p.first !== undefined]);
  if (blk.type === 'bullet' || blk.type === 'numbered' || blk.type === 'todo') para.push(['List', `${blk.type === 'numbered' ? `Numbered (${p.num ?? 'usual'})` : blk.type === 'todo' ? 'Checklist' : `Bullets (${p.bullet ?? 'usual'})`}, level ${(blk.indent ?? 0) + 1}`, true]);
  if (p.border) para.push(['Border', `${{ t: 'top', b: 'bottom', l: 'left', r: 'right' }[p.border] ?? (p.border === 'tblr' ? 'box' : p.border)}${p.bstyle ? `, ${p.bstyle}` : ''}${p.bcolor ? `, ${p.bcolor}` : ''}`, true]);
  if (p.shade) para.push(['Shading', p.shade, true]);
  const flow = [p.pageBefore && 'page break before', p.keepNext && 'keep with next', p.keepLines && 'keep lines together', p.nowidow && 'widow control off'].filter(Boolean);
  if (flow.length) para.push(['Pages', flow.join(', '), true]);
  if (p.tabs?.length) para.push(['Tab stops', p.tabs.map((t) => `${inch(t.at)} ${t.align}`).join('; '), true]);
  return [
    ['Font', font],
    ['Paragraph', para],
  ];
}

export function RevealFormatting({ editor, sheet }: { editor: Editor; sheet: StyleSheet }) {
  const sections = revealLines(editor, sheet);
  return (
    <section className="reveal" aria-label="Reveal formatting">
      <h3>Reveal formatting</h3>
      {sections.map(([head, lines]) => (
        <div key={head} className="reveal-part">
          <h4>{head}</h4>
          <dl>
            {lines.map(([label, value, own]) => (
              <div key={label} className={own ? 'own' : ''} title={own ? 'Set by hand on the text' : 'From the paragraph’s style'}>
                <dt>{label}</dt>
                <dd>
                  {value.startsWith('#') && <span className="reveal-swatch" style={{ background: value }} />}
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <p className="reveal-key">
        <span className="own-dot" /> set by hand, the rest from the style
      </p>
    </section>
  );
}
