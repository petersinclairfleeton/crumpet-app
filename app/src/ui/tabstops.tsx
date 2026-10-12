// Word's Tabs window: the selected paragraphs' tab stops (where text after a
// tab goes: left, centred, right or on its decimal point), with dots,
// dashes or a line to fill the gap. Default stops every half inch follow.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { type TabStop, tidyTabs } from '@crumpet/editor/model';
import { IconClose } from './icons';

export const TAB_ALIGN_NAMES: Record<TabStop['align'], string> = { left: 'Left', center: 'Centre', right: 'Right', decimal: 'Decimal' };
const LEADER_NAMES: [TabStop['leader'] | '', string][] = [
  ['', 'None'],
  ['dot', '.......'],
  ['dash', '-------'],
  ['line', '_______'],
];

export function TabsDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const [stops, setStops] = useState<TabStop[]>(editor.paraValue('tabs') ?? []);
  const [pos, setPos] = useState('');
  const [align, setAlign] = useState<TabStop['align']>('left');
  const [leader, setLeader] = useState<TabStop['leader'] | ''>('');
  const panel = useRef<HTMLFormElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    panel.current?.querySelector('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const at = Number(pos);
  const valid = pos.trim() !== '' && Number.isFinite(at) && at >= 0 && at <= 22;
  const set = () => {
    if (!valid) return;
    const stop: TabStop = { at, align, ...(leader ? { leader } : {}) };
    setStops(tidyTabs([...stops.filter((s) => Math.abs(s.at - at) >= 0.01), stop]) ?? []);
  };
  const pick = (s: TabStop) => {
    setPos(String(s.at));
    setAlign(s.align);
    setLeader(s.leader ?? '');
  };
  const apply = () => {
    // A position typed but not yet set is set too, as in Word.
    const final = valid && !stops.some((s) => Math.abs(s.at - at) < 0.01) ? tidyTabs([...stops, { at, align, ...(leader ? { leader } : {}) }]) : tidyTabs(stops);
    editor.setPara({ tabs: final });
    onClose();
    editor.focus();
  };

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        ref={panel}
        className="dialog para-dialog tabs-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Tabs"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <header className="dialog-head">
          <h2>Tabs</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <div className="tabs-grid">
            <div className="tabs-left">
              <label className="para-field">
                <span>Tab stop position</span>
                <span className="para-input">
                  <input
                    type="number"
                    aria-label="Tab stop position"
                    step={0.25}
                    min={0}
                    value={pos}
                    onChange={(e) => setPos(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && valid && !stops.some((s) => Math.abs(s.at - at) < 0.01)) {
                        e.preventDefault();
                        set();
                      }
                    }}
                  />
                  <small>in</small>
                </span>
              </label>
              <ul className="tabs-list" aria-label="Tab stops">
                {stops.map((s) => (
                  <li key={s.at}>
                    <button type="button" className={`menu-item${Math.abs(s.at - at) < 0.01 ? ' on' : ''}`} onClick={() => pick(s)}>
                      {s.at}″ <small>{TAB_ALIGN_NAMES[s.align]}{s.leader ? `, ${s.leader === 'dot' ? 'dots' : s.leader === 'dash' ? 'dashes' : 'line'}` : ''}</small>
                    </button>
                  </li>
                ))}
                {!stops.length && <li className="sync-hint">None: tabs go every half inch.</li>}
              </ul>
            </div>
            <div className="tabs-right">
              <fieldset>
                <legend>Alignment</legend>
                {(Object.keys(TAB_ALIGN_NAMES) as TabStop['align'][]).map((a) => (
                  <label key={a} className="check-row">
                    <input type="radio" name="tab-align" checked={align === a} onChange={() => setAlign(a)} /> {TAB_ALIGN_NAMES[a]}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Leader</legend>
                {LEADER_NAMES.map(([l, name]) => (
                  <label key={name} className="check-row">
                    <input type="radio" name="tab-leader" aria-label={l ? `Leader ${l === 'dot' ? 'dots' : l === 'dash' ? 'dashes' : 'line'}` : 'No leader'} checked={leader === l} onChange={() => setLeader(l)} /> {name}
                  </label>
                ))}
              </fieldset>
            </div>
          </div>
          <div className="para-foot">
            <button type="button" className="btn" disabled={!valid} onClick={set}>
              Set
            </button>
            <button type="button" className="btn" disabled={!stops.some((s) => Math.abs(s.at - at) < 0.01)} onClick={() => setStops(stops.filter((s) => Math.abs(s.at - at) >= 0.01))}>
              Clear
            </button>
            <button type="button" className="btn quiet" disabled={!stops.length} onClick={() => setStops([])}>
              Clear all
            </button>
            <span className="grow" />
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              OK
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
