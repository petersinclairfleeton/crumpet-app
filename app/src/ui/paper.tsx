// Choosing the paper colour: swatches for the ready-made papers, the theme's
// own, and a colour picker for any other. In Settings → Look, and under
// Page colour in the formatting bar.

import { PAPERS, isHex, paperName } from '../data/paper';
import { useAppState, useAppStore } from './hooks';

export function PaperSwatches({ onPicked }: { onPicked?(): void }) {
  const { settings } = useAppState();
  const store = useAppStore();
  const current = isHex(settings.paper) ? settings.paper.toLowerCase() : null;
  const set = (paper: string | undefined) => {
    store.updateSettings({ paper });
    onPicked?.();
  };
  return (
    <div className="paper-swatches" role="group" aria-label="Paper colour">
      <button type="button" className={`paper-swatch theme-own${current ? '' : ' on'}`} aria-pressed={!current} aria-label="The theme’s own" title="The theme’s own" onClick={() => set(undefined)}>
        <span aria-hidden="true">A</span>
      </button>
      {PAPERS.map((p) => (
        <button key={p.hex} type="button" className={`paper-swatch${current === p.hex ? ' on' : ''}`} style={{ background: p.hex }} aria-pressed={current === p.hex} aria-label={`${p.name} paper`} title={p.name} onClick={() => set(p.hex)} />
      ))}
      <label className={`paper-swatch custom${current && paperName(current) === 'Custom' ? ' on' : ''}`} title="Any colour" style={current && paperName(current) === 'Custom' ? { background: current } : undefined}>
        <span aria-hidden="true">+</span>
        <input type="color" aria-label="Any colour" value={current ?? '#ffffff'} onChange={(e) => store.updateSettings({ paper: e.target.value })} />
      </label>
    </div>
  );
}
