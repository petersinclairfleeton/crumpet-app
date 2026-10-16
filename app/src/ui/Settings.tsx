import { AccountSettings } from './account';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipperSettings } from './clipper';
import { InstallSettings } from './install';
import { ACCENTS, DEFAULT_NOTE_SIZE, type NoteFont } from '../data/types';
import { DEFAULT_FONT, type FontChoice, canListAllSystemFonts, fontStack, googleFonts, loadGoogleFont, systemFonts } from './fonts';
import { useAppState, useAppStore } from './hooks';
import { IconChevronDown, IconClose } from './icons';
import { openCustomise } from './customise';
import { SyncSettings } from './SyncSettings';
import { THEMES, themeInfo } from './themes';
import { PaperSwatches } from './paper';
import { AutoCorrectSettings } from './autocorrect';
import { SpellingSettings } from './spelling';

const SECTIONS = [
  { id: 'account', label: 'Account & sync' },
  { id: 'look', label: 'Appearance' },
  { id: 'writing', label: 'Writing' },
  { id: 'app', label: 'Clipper & app' },
] as const;
/** The calm look's sections (design 13): Appearance first, sync and the account apart, Advanced at the foot. */
const CALM_SECTIONS = [
  { id: 'look', label: 'Appearance' },
  { id: 'writing', label: 'Writing' },
  { id: 'bar', label: 'Formatting bar' },
  { id: 'sync', label: 'Sync and storage' },
  { id: 'profile', label: 'Account' },
  { id: 'app', label: 'Clipper and Mac app' },
] as const;
export type SettingsSection = (typeof SECTIONS)[number]['id'] | (typeof CALM_SECTIONS)[number]['id'] | 'advanced';
/** The calm look's four themes, named as the design names them. */
const CALM_THEMES: [string, string][] = [
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['system', 'Match my device'],
  ['paper', 'Paper and ink'],
];

/** Settings, as a window over the app, in a few sections. */
export function SettingsDialog({ onClose, section: asked }: { onClose(): void; section?: SettingsSection }) {
  const state = useAppState();
  const store = useAppStore();
  const s = state.settings;
  const panel = useRef<HTMLDivElement>(null);
  const calm = !s.toolbarAll;
  const [section, setSection] = useState<SettingsSection>(asked ?? (calm ? 'look' : 'account'));
  const [fontOpen, setFontOpen] = useState(false);
  // Four themes up front; the rest wait under More themes (open while one of them is chosen).
  const [allThemes, setAllThemes] = useState(false);
  const shownThemes = allThemes || !MAIN_THEMES.includes(s.theme) ? THEMES : THEMES.filter((t) => MAIN_THEMES.includes(t.id));
  const size = s.noteSize ?? DEFAULT_NOTE_SIZE;

  // The window takes the focus once, when it opens: the app redraws on every
  // change (each letter of your name), and taking it again would pull the
  // caret out of the box being typed in.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const ownAccent = themeInfo(s.theme).accent;

  if (calm) {
    const title = section === 'advanced' ? 'Advanced' : (CALM_SECTIONS.find((x) => x.id === section)?.label ?? 'Appearance');
    const shown: SettingsSection = section === 'account' ? 'profile' : section;
    return createPortal(
      <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="dialog settings-dialog calm" role="dialog" aria-modal="true" aria-label="Settings" tabIndex={-1} ref={panel}>
          <nav className="settings-nav">
            <h2>Settings</h2>
            <div className="settings-tabs" role="tablist" aria-label="Sections" aria-orientation="vertical">
              {CALM_SECTIONS.map((x) => (
                <button key={x.id} type="button" role="tab" id={`settings-${x.id}`} aria-selected={shown === x.id} aria-controls="settings-panel" onClick={() => setSection(x.id)}>
                  {x.label}
                </button>
              ))}
            </div>
            <span className="grow" />
            <button type="button" role="tab" id="settings-advanced" className="settings-advanced" aria-selected={shown === 'advanced'} aria-controls="settings-panel" onClick={() => setSection('advanced')}>
              Advanced
            </button>
          </nav>
          <div className="settings-main">
            <header className="settings-head">
              <h3>{title}</h3>
              <button type="button" className="icon-btn" aria-label="Close settings" onClick={onClose}>
                <IconClose size={18} />
              </button>
            </header>
            <div className="settings" role="tabpanel" id="settings-panel" aria-labelledby={`settings-${shown}`}>
              {shown === 'look' && (
                <>
                  <div className="field" role="group" aria-label="Theme">
                    <span className="settings-label">Theme</span>
                    <div className="theme-row">
                      {(allThemes || !CALM_THEMES.some(([id]) => id === s.theme) ? THEMES.map((t) => [t.id, t.name] as [string, string]) : CALM_THEMES).map(([id, name]) => (
                        <button key={id} type="button" className="theme-pick" aria-pressed={s.theme === id} aria-label={name} title={themeInfo(id as typeof s.theme).hint} onClick={() => store.updateSettings({ theme: id as typeof s.theme })}>
                          <span className={`theme-pic ${id}`} aria-hidden="true">
                            <i />
                            <i />
                          </span>
                          {name}
                        </button>
                      ))}
                    </div>
                    {!allThemes && CALM_THEMES.some(([id]) => id === s.theme) && (
                      <button type="button" className="link-btn more-themes" onClick={() => setAllThemes(true)}>
                        More themes ({THEMES.length - CALM_THEMES.length})
                      </button>
                    )}
                  </div>
                  <div className="settings-row" role="group" aria-label="Accent colour">
                    <span>
                      <b>Accent</b>
                      <small>{ownAccent ? 'This theme has its own colours.' : 'Used once per screen: the New note button, the chosen dot.'}</small>
                    </span>
                    {!ownAccent && (
                      <span className="accents">
                        {ACCENTS.map((a) => (
                          <button key={a.hex} type="button" className={`swatch big${s.accent === a.hex ? ' on' : ''}`} style={{ background: a.hex }} aria-label={a.name} aria-pressed={s.accent === a.hex} title={a.name} onClick={() => store.updateSettings({ accent: a.hex })} />
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="settings-row">
                    <span>
                      <b>Writing font</b>
                      <small>For titles and your text. Menus stay in Onest.</small>
                    </span>
                    <button type="button" className="font-choose" aria-expanded={fontOpen} onClick={() => setFontOpen(!fontOpen)} style={{ fontFamily: fontStack(s.noteFont ?? DEFAULT_FONT) }}>
                      {(s.noteFont ?? DEFAULT_FONT).family}
                      <IconChevronDown size={14} />
                    </button>
                  </div>
                  {fontOpen && <FontPicker value={s.noteFont ?? DEFAULT_FONT} onChange={(f) => store.updateSettings({ noteFont: f })} />}
                  <label className="settings-row">
                    <span>
                      <b>Text size</b>
                      <small>The writing only. The interface follows your device.</small>
                    </span>
                    <span className="size-pick">
                      <small aria-hidden="true">A</small>
                      <input className="range" type="range" aria-label={`Text size, ${size}px`} min={13} max={24} step={1} value={size} style={{ '--pct': `${((size - 13) / 11) * 100}%` } as React.CSSProperties} onChange={(e) => store.updateSettings({ noteSize: Number(e.target.value) })} />
                      <big aria-hidden="true">A</big>
                    </span>
                  </label>
                  <Switch label="Show every formatting tool" hint="Off keeps the bar to five tools and puts the rest under More." on={!!s.toolbarAll} onChange={(v) => store.updateSettings({ toolbarAll: v })} />
                  <Switch label="Open the inspector with every note" hint="Off means it opens only when you ask." on={!!s.layout?.right} onChange={(v) => store.updateLayout({ right: v })} />
                  <Switch label="Reduce motion" hint="Turns off sliding and fading." on={!!s.reduceMotion} onChange={(v) => store.updateSettings({ reduceMotion: v })} />
                </>
              )}
              {shown === 'writing' && (
                <>
                  <div className="field" role="group" aria-label="Paper">
                    <span className="settings-label">Paper</span>
                    <p className="sync-hint">The colour of the page you write on, in notes and chapters (printing stays white).</p>
                    <PaperSwatches />
                  </div>
                  <div className="field" role="group" aria-label="Typewriter">
                    <span className="settings-label">Typewriter</span>
                    {TYPEWRITER.map(([key, label]) => (
                      <label key={key} className="check-row">
                        <input type="checkbox" checked={!!s.typewriter?.[key]} onChange={(e) => store.updateSettings({ typewriter: { ...s.typewriter, [key]: e.target.checked } })} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <AutoCorrectSettings />
                  <SpellingSettings />
                </>
              )}
              {shown === 'bar' && (
                <>
                  <Switch label="Show every formatting tool" hint="Off keeps the bar to five tools and puts the rest under More." on={!!s.toolbarAll} onChange={(v) => store.updateSettings({ toolbarAll: v })} />
                  <Switch label="Tools only over selected text" hint="Off keeps the five tools at the top of the page; on, they float over the words you select." on={s.toolbar === 'selection'} onChange={(v) => store.updateSettings({ toolbar: v ? 'selection' : 'always' })} />
                  <div className="settings-row">
                    <span>
                      <b>Choose the buttons</b>
                      <small>Hide the ones you never use, keep the ones you do on the bar.</small>
                    </span>
                    <button type="button" className="btn" onClick={() => (onClose(), openCustomise())}>
                      Customise the bar…
                    </button>
                  </div>
                </>
              )}
              {shown === 'sync' && <SyncSettings />}
              {shown === 'profile' && (
                <>
                  <label className="field">
                    <span className="settings-label">Your name</span>
                    <input value={s.name} placeholder="On manuscripts, comments and changes" onChange={(e) => store.updateSettings({ name: e.target.value })} />
                  </label>
                  <AccountSettings />
                </>
              )}
              {shown === 'app' && (
                <>
                  <ClipperSettings />
                  <InstallSettings />
                </>
              )}
              {shown === 'advanced' && (
                <>
                  <Switch label="Keep earlier versions as you write" hint="Crumpet keeps the text as it was, at most every ten minutes, to compare and go back to." on={s.autoVersions !== false} onChange={(v) => store.updateSettings({ autoVersions: v })} />
                  <Switch label="Keep the right sidebar open" hint="Outline, review, styles and more beside the writing." on={!!s.layout?.right} onChange={(v) => store.updateLayout({ right: v })} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // Drawn at the top of the page, so no panel's effects (like Glass's blur) can clip it.
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog settings-dialog" role="dialog" aria-modal="true" aria-label="Settings" tabIndex={-1} ref={panel}>
        <header className="dialog-head">
          <h2>Settings</h2>
          <button type="button" className="icon-btn" aria-label="Close settings" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings-tabs" role="tablist" aria-label="Sections" aria-orientation="vertical">
          {SECTIONS.map((x) => (
            <button key={x.id} type="button" role="tab" id={`settings-${x.id}`} aria-selected={section === x.id} aria-controls="settings-panel" onClick={() => setSection(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="settings" role="tabpanel" id="settings-panel" aria-labelledby={`settings-${section}`}>
          {section === 'account' && (
            <>
              <label className="field">
                <span>Your name</span>
                <input value={s.name} placeholder="Shown at the top of the sidebar, and on manuscripts" onChange={(e) => store.updateSettings({ name: e.target.value })} />
              </label>
              <AccountSettings />
              <SyncSettings />
            </>
          )}

          {section === 'look' && (
            <>
              <div className="field" role="group" aria-label="Theme">
                <span>Theme</span>
                <div className="theme-grid">
                  {shownThemes.map((t) => (
                    <button key={t.id} type="button" className="theme-card" aria-pressed={s.theme === t.id} aria-label={t.name} title={t.hint} onClick={() => store.updateSettings({ theme: t.id })}>
                      <span className={`theme-preview${t.id === 'glass' ? ' glassy' : ''}${['system', 'light', 'dark'].includes(t.id) ? ' quiet' : ''}${t.id === 'dark' ? ' dark' : ''}`} aria-hidden="true">
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
                {shownThemes.length < THEMES.length && (
                  <button type="button" className="link-btn more-themes" onClick={() => setAllThemes(true)}>
                    More themes ({THEMES.length - shownThemes.length})
                  </button>
                )}
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

              <div className="field" role="group" aria-label="Paper">
                <span>Paper</span>
                <p className="sync-hint">The colour of the page you write on, in notes and chapters (printing stays white).</p>
                <PaperSwatches />
              </div>

              <div className="field" role="group" aria-label="Calm">
                <span>Calm</span>
                <Switch label="Show every formatting tool" hint="Off keeps the bar to five tools and puts the rest under More." on={!!s.toolbarAll} onChange={(v) => store.updateSettings({ toolbarAll: v })} />
                <Switch label="Keep the right sidebar open" hint="Outline, review, styles and more beside the writing. Off means it opens when you ask." on={!!s.layout?.right} onChange={(v) => store.updateLayout({ right: v })} />
                <Switch label="Reduce motion" hint="Turns off sliding and fading." on={!!s.reduceMotion} onChange={(v) => store.updateSettings({ reduceMotion: v })} />
              </div>
            </>
          )}

          {section === 'writing' && (
            <>
              <FontPicker value={s.noteFont ?? DEFAULT_FONT} onChange={(f) => store.updateSettings({ noteFont: f })} />
              <label className="field">
                <span>Text size · {size}px</span>
                <input className="range" type="range" min={13} max={24} step={1} value={size} style={{ '--pct': `${((size - 13) / 11) * 100}%` } as React.CSSProperties} onChange={(e) => store.updateSettings({ noteSize: Number(e.target.value) })} />
              </label>
              <div className="field" role="group" aria-label="Typewriter">
                <span>Typewriter</span>
                {(
                  [
                    ['scroll', 'Keep the line you’re typing in the middle of the screen'],
                    ['fade', 'Fade the other paragraphs'],
                    ['sound', 'Typing sounds'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="check-row">
                    <input type="checkbox" checked={!!s.typewriter?.[key]} onChange={(e) => store.updateSettings({ typewriter: { ...s.typewriter, [key]: e.target.checked } })} />
                    {label}
                  </label>
                ))}
              </div>
              <AutoCorrectSettings />
              <SpellingSettings />
            </>
          )}

          {section === 'app' && (
            <>
              <ClipperSettings />
              <InstallSettings />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const MAIN_THEMES = ['system', 'light', 'dark', 'paper'];
const TYPEWRITER = [
  ['scroll', 'Keep the line you’re typing in the middle of the screen'],
  ['fade', 'Fade the other paragraphs'],
  ['sound', 'Typing sounds'],
] as const;

/** An on/off setting: its name and a line about it, with a switch at the end. */
function Switch({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange(v: boolean): void }) {
  return (
    <label className="switch-row">
      <span>
        <b>{label}</b>
        <small>{hint}</small>
      </span>
      <input type="checkbox" role="switch" className="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
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
