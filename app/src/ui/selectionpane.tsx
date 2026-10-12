// Word's Selection Pane: the pictures, shapes, text boxes, maths and
// diagrams in what you're writing, listed in order. Click one to go to it;
// the eye hides it from view (it stays in the document) or shows it again.

import type { Editor } from '@crumpet/editor/editor';
import type { Block } from '@crumpet/editor/model';

const SHAPE_NAMES: Record<string, string> = { rect: 'Rectangle', rounded: 'Rounded rectangle', ellipse: 'Oval', line: 'Line', arrow: 'Arrow' };

/** What an object is called in the list. */
export function objectName(b: Block): { kind: string; name: string } {
  if (b.type === 'image') {
    const caption = b.runs.map((r) => r.text).join('').trim();
    const file = (b.src ?? '').replace(/^.*\//, '').replace(/^[a-z0-9]{7}-/, '');
    return { kind: 'Picture', name: b.pic?.alt || caption || file || 'Picture' };
  }
  if (b.type === 'shape') {
    const s = b.shape;
    const text = (s?.text ?? '').replace(/[*_`~[\]{}]|\(.*?\)|=[^\s}]*/g, '').trim();
    const box = s?.kind === 'rect' && s.fill === '#ffffff';
    return { kind: box ? 'Text box' : (SHAPE_NAMES[s?.kind ?? 'rect'] ?? 'Shape'), name: text };
  }
  return { kind: b.code?.lang === 'mermaid' ? 'Diagram' : 'Maths', name: (b.code?.text ?? '').split('\n')[0].slice(0, 40) };
}

const EYE = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EYE_OFF = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

const isObject = (b: Block) => b.type === 'image' || b.type === 'shape' || (b.type === 'code' && b.code?.lang !== 'canvas');
const hidden = (b: Block) => !!(b.pic?.hide || b.shape?.hide);

export function SelectionPane({ editor }: { editor: Editor }) {
  const objects = editor.state.doc.blocks.filter(isObject);
  if (!objects.length) return <p className="right-empty">No pictures, shapes or text boxes yet. Those you add are listed here, to go to, hide or show.</p>;
  const setHidden = (b: Block, hide: boolean) => {
    if (b.type === 'image') editor.setPicture(b.id, { hide: hide || undefined });
    else if (b.type === 'shape') editor.setShapeLook(b.id, { hide: hide || undefined });
  };
  const hideable = objects.filter((b) => b.type !== 'code');
  return (
    <div className="selection-pane">
      <ul aria-label="Objects">
        {objects.map((b) => {
          const { kind, name } = objectName(b);
          const off = hidden(b);
          return (
            <li key={b.id} className={off ? 'off' : ''}>
              <button type="button" className="sel-go" disabled={off} title={off ? 'Hidden: show it to go to it' : 'Go to it'} onClick={() => editor.goToBlock(b.id)}>
                <span className="sel-kind">{kind}</span>
                {name && <span className="sel-name">{name}</span>}
              </button>
              {b.type !== 'code' && (
                <button type="button" className="icon-btn sel-eye" aria-pressed={!off} aria-label={`${off ? 'Show' : 'Hide'} ${kind.toLowerCase()}${name ? ` ${name}` : ''}`} title={off ? 'Show' : 'Hide'} onClick={() => setHidden(b, !off)}>
                  {off ? EYE_OFF : EYE}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {hideable.length > 0 && (
        <div className="sel-all">
          <button type="button" className="btn quiet small" disabled={!hideable.some(hidden)} onClick={() => hideable.filter(hidden).forEach((b) => setHidden(b, false))}>
            Show all
          </button>
          <button type="button" className="btn quiet small" disabled={hideable.every(hidden)} onClick={() => hideable.filter((b) => !hidden(b)).forEach((b) => setHidden(b, true))}>
            Hide all
          </button>
        </div>
      )}
    </div>
  );
}
