import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipperSettings } from './clipper';
import { InstallSettings } from './install';
import { ACCENTS, DEFAULT_NOTE_SIZE, type NoteFont } from '../data/types';
import { DEFAULT_FONT, type FontChoice, canListAllSystemFonts, fontStack, googleFonts, loadGoogleFont, systemFonts } from './fonts';
import { useAppState, useAppStore } from './hooks';
import { IconClose } from './icons';
import { SyncSettings } from './SyncSettings';
import { THEMES, themeInfo } from './themes';

/** Settings, as a window over the app. */
export function SettingsDialog({ onClose }: { onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const s = state.settings;
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ownAccent = themeInfo(s.theme).accent;

  // Drawn at the top of the page, so no panel's effects (like Glass's blur) can clip it.
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Settings" tabIndex={-1} ref={panel}>
        <header className="dialog-head">
          <h2>Settings</h2>
          <button type="button" className="icon-btn" aria-label="Close settings" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <label className="field">
            <span>Your name</span>
            <input value={s.name} placeholder="Shown at the top of the sidebar" onChange={(e) => store.updateSettings({ name: e.target.value })} />
          </label>

          <div className="field" role="group" aria-label="Theme">
            <span>Theme</span>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button key={t.id} type="button" className="theme-card" aria-pressed={s.theme === t.id} aria-label={t.name} title={t.hint} onClick={() => store.updateSettings({ theme: t.id })}>
                  <span className={`theme-preview${t.id === 'glass' ? ' glassy' : ''}`} aria-hidden="true">
                    <i style={{ background: t.preview[0] }} />
                    <i style={{ background: t.preview[1] }} />
                    <i style={{ background: t.preview[2] }}>
                      <b style={{ background: t.accent ?? s.accent }} />
                    </i>
                  </span>
                  <span className="theme-name">{t.name}</span>
                  <span className="theme-hint">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field" role="group" aria-label="Accent colour">
            <span>Accent</span>
            {ownAccent ? (
              <p className="sync-hint">This theme has its own colours.</p>
            ) : (
              <div className="accents">
                {ACCENTS.map((a) => (
                  <button key={a.hex} type="button" className={`swatch big${s.accent === a.hex ? ' on' : ''}`} style={{ background: a.hex }} aria-label={a.name} aria-pressed={s.accent === a.hex} title={a.name} onClick={() => store.updateSettings({ accent: a.hex })} />
                ))}
              </div>
            )}
          </div>

          <FontPicker value={s.noteFont ?? DEFAULT_FONT} onChange={(f) => store.updateSettings({ noteFont: f })} />

          <label className="field">
            <span>Text size · {s.noteSize ?? DEFAULT_NOTE_SIZE}px</span>
            <input className="range" type="range" min={13} max={24} step={1} value={s.noteSize ?? DEFAULT_NOTE_SIZE} onChange={(e) => store.updateSettings({ noteSize: Number(e.target.value) })} />
          </label>

          <InstallSettings />

          <ClipperSettings />

          <SyncSettings />
        </div>
      </div>
    </div>,
    document.body,
  );
}

const SAMPLE = 'The quick brown fox jumps over the lazy dog. 1234567890';
const CATEGORIES: [string, string][] = [
  ['', 'All'],
  ['serif', 'Serif'],
  ['sans-serif', 'Sans'],
  ['monospace', 'Mono'],
  ['handwriting', 'Handwriting'],
  ['display', 'Display'],
];
const SHOWN = 60;

/** Choosing the font notes are written in: any Google font, or one on this device. */
export function FontPicker({ value, onChange, label = 'Writing font' }: { value: NoteFont; onChange(f: NoteFont): void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'google' | 'system'>('google');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [google, setGoogle] = useState<FontChoice[] | null>(null);
  const [local, setLocal] = useState<FontChoice[] | null>(null);

  useEffect(() => {
    if (!open) return;
    if (tab === 'google' && !google) googleFonts().then(setGoogle, () => setGoogle([]));
    if (tab === 'system' && !local) systemFonts().then(setLocal, () => setLocal([]));
  }, [open, tab, google, local]);

  const list = tab === 'google' ? google : local;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list ?? []).filter((f) => (!q || f.family.toLowerCase().includes(q)) && (tab !== 'google' || !category || f.category === category));
  }, [list, query, category, tab]);
  const shown = matches.slice(0, SHOWN);

  // Each name is shown in its own font; for Google fonts only the letters of the name are fetched.
  useEffect(() => {
    if (tab === 'google') for (const f of shown) loadGoogleFont(f.family, f.styles, f.family);
  }, [shown, tab]);

  const name = value.source === 'default' ? `${DEFAULT_FONT.family} (Crumpet’s own)` : value.family;

  return (
    <div className="field font-field" role="group" aria-label={label}>
      {label === 'Writing font' && <span>{label}</span>}
      <button type="button" className="font-current" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span style={{ fontFamily: fontStack(value) }}>{name}</span>
        <small>{open ? 'Done' : 'Change'}</small>
      </button>
      <p className="font-sample" style={{ fontFamily: fontStack(value) }}>
        {SAMPLE}
      </p>
      {open && (
        <div className="font-picker">
          <div className="segmented small" role="tablist">
            <button type="button" role="tab" aria-pressed={tab === 'google'} aria-selected={tab === 'google'} onClick={() => setTab('google')}>
              Google Fonts
            </button>
            <button type="button" role="tab" aria-pressed={tab === 'system'} aria-selected={tab === 'system'} onClick={() => setTab('system')}>
              On this device
            </button>
          </div>
          <input className="font-search" type="search" placeholder={tab === 'google' ? 'Search 1,900 fonts' : 'Search your fonts'} aria-label="Search fonts" value={query} onChange={(e) => setQuery(e.target.value)} />
          {tab === 'google' && (
            <div className="chips">
              {CATEGORIES.map(([c, label]) => (
                <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="font-list" role="listbox" aria-label="Fonts">
            {list === null && <p className="sync-hint">Loading fonts…</p>}
            {value.source !== 'default' && !query && (
              <button type="button" role="option" aria-selected={false} className="font-option" onClick={() => onChange(DEFAULT_FONT)}>
                <span style={{ fontFamily: fontStack(DEFAULT_FONT) }}>{DEFAULT_FONT.family}</span>
                <small>Crumpet’s own</small>
              </button>
            )}
            {shown.map((f) => {
              const selected = value.source === f.source && value.family === f.family;
              return (
                <button
                  key={`${f.source}:${f.family}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="font-option"
                  onClick={() => onChange({ family: f.family, source: f.source, styles: f.styles, category: f.category })}
                >
                  <span style={{ fontFamily: fontStack(f) }}>{f.family}</span>
                  <small>{f.category === 'sans-serif' ? 'sans' : f.category}</small>
                </button>
              );
            })}
            {list !== null && !matches.length && <p className="sync-hint">No fonts match.</p>}
            {matches.length > SHOWN && <p className="sync-hint">Showing {SHOWN} of {matches.length.toLocaleString()}. Type to find more.</p>}
          </div>
          {tab === 'system' && canListAllSystemFonts && (
            <button type="button" className="btn quiet" onClick={() => systemFonts(true).then(setLocal)}>
              Show every font on this computer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
