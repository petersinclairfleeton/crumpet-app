// Suggesting names for characters and places: pick a region and era, then
// click a name to add it to the book's cast.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ERAS, type Era, type Gender, REGIONS, type Region, suggestNames } from '../data/names';
import { IconClose } from './icons';

const KEY = 'crumpet.names';

function remembered(): { region: Region; era: Era; gender: Gender } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { region?: Region; era?: Era; gender?: Gender } | null;
    return { region: REGIONS.some((r) => r.id === v?.region) ? v!.region! : 'british', era: ERAS.some((e) => e.id === v?.era) ? v!.era! : 'modern', gender: v?.gender ?? 'any' };
  } catch {
    return { region: 'british', era: 'modern', gender: 'any' };
  }
}

export function NameGenerator({ initialKind = 'character', taken, onPick, onClose }: { initialKind?: 'character' | 'place'; taken: string[]; onPick(kind: 'character' | 'place', name: string): void; onClose(): void }) {
  const [kind, setKind] = useState(initialKind);
  const [{ region, era, gender }, setChoice] = useState(remembered);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ region, era, gender }));
    } catch {
      // Remembering is only a convenience.
    }
  }, [region, era, gender]);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const used = new Set(taken.map((t) => t.toLowerCase()));
  const names = suggestNames(kind, region, era, gender, seed).filter((n) => !used.has(n.toLowerCase()));
  const set = (patch: Partial<{ region: Region; era: Era; gender: Gender }>) => setChoice((c) => ({ ...c, ...patch }));

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog names-dialog" role="dialog" aria-modal="true" aria-label="Suggest a name" tabIndex={-1} ref={panel}>
        <header className="dialog-head">
          <h2>Suggest a name</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <div className="names-choices">
            <span className="segmented small" role="group" aria-label="For">
              {(['character', 'place'] as const).map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {k === 'character' ? 'Character' : 'Place'}
                </button>
              ))}
            </span>
            <label>
              <span>Region</span>
              <select value={region} onChange={(e) => set({ region: e.target.value as Region })}>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            {kind === 'character' && (
              <>
                <label>
                  <span>Era</span>
                  <select value={era} onChange={(e) => set({ era: e.target.value as Era })}>
                    {ERAS.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Name for</span>
                  <select value={gender} onChange={(e) => set({ gender: e.target.value as Gender })}>
                    <option value="any">Anyone</option>
                    <option value="female">A woman</option>
                    <option value="male">A man</option>
                  </select>
                </label>
              </>
            )}
          </div>
          <div className="names-list" role="list" aria-label="Names">
            {names.map((n) => (
              <button key={n} type="button" role="listitem" className="names-item" title={`Add ${n} to the book`} onClick={() => onPick(kind, n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="names-foot">
            <button type="button" className="btn" onClick={() => setSeed((s) => s + 7919)}>
              More names
            </button>
            <span className="sync-hint">Click a name to add it to the book.</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
