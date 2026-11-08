// How one document is shown while you write it, from its own ··· menu: its
// text size (a zoom kept per note or chapter on this device, like Word's) and
// the typewriter's three switches (they apply to every note and chapter).

import { useAppState, useAppStore } from './hooks';

/** Text sizes a document can be shown at, in per cent. */
export const DOC_SIZES = [70, 80, 90, 100, 110, 125, 150, 175, 200];

/** This document's text size as a scale (1 = as written). */
export function useDocScale(docId: string): number {
  const pct = useAppState().settings.docSizes?.[docId];
  return pct && pct !== 100 ? pct / 100 : 1;
}

export function DocViewItems({ docId }: { docId: string }) {
  const state = useAppState();
  const store = useAppStore();
  const pct = state.settings.docSizes?.[docId] ?? 100;
  const at = DOC_SIZES.indexOf(pct);
  const set = (next: number) => {
    const sizes = { ...state.settings.docSizes };
    if (next === 100) delete sizes[docId];
    else sizes[docId] = next;
    store.updateSettings({ docSizes: sizes });
  };
  const step = (d: number) => {
    const i = at >= 0 ? at : DOC_SIZES.findIndex((x) => x >= pct);
    set(DOC_SIZES[Math.max(0, Math.min(DOC_SIZES.length - 1, i + d))]);
  };
  const tw = state.settings.typewriter ?? {};
  const toggle = (k: 'scroll' | 'fade' | 'sound') => store.updateSettings({ typewriter: { ...tw, [k]: !tw[k] } });
  return (
    <>
      <div className="menu-line text-size-row" role="group" aria-label="Text size of this document">
        <span className="grow">Text size</span>
        <button type="button" className="icon-btn" aria-label="Smaller text" disabled={pct <= DOC_SIZES[0]} onClick={() => step(-1)}>
          <small>A</small>−
        </button>
        <button type="button" className="text-size-now" aria-live="polite" title="Back to 100%" onClick={() => set(100)}>
          {pct}%
        </button>
        <button type="button" className="icon-btn" aria-label="Bigger text" disabled={pct >= DOC_SIZES[DOC_SIZES.length - 1]} onClick={() => step(1)}>
          A+
        </button>
      </div>
      <p className="menu-label">Typewriter</p>
      <button type="button" className="menu-item" role="menuitemcheckbox" aria-checked={!!tw.scroll} onClick={() => toggle('scroll')}>
        <span className="menu-on" aria-hidden="true">{tw.scroll ? '✓' : ''}</span> Keep the line in the middle
      </button>
      <button type="button" className="menu-item" role="menuitemcheckbox" aria-checked={!!tw.fade} onClick={() => toggle('fade')}>
        <span className="menu-on" aria-hidden="true">{tw.fade ? '✓' : ''}</span> Fade the other paragraphs
      </button>
      <button type="button" className="menu-item" role="menuitemcheckbox" aria-checked={!!tw.sound} onClick={() => toggle('sound')}>
        <span className="menu-on" aria-hidden="true">{tw.sound ? '✓' : ''}</span> Typing sounds
      </button>
    </>
  );
}
