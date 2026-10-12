// Styles in the interface: the style menu in the toolbar, the window for
// changing styles, and applying a style sheet to the page.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import type { Align } from '@crumpet/editor/model';
import { BASE_STYLES, PRESETS, type PresetId, type StyleDef, customStyleId, type StyleKey, type StyleSheet, blockStyleKey, fullSheet, presetSheet, sheetCss, sheetId, sheetStyles, styleNameIn } from '../data/styles';
import { DEFAULT_FONT, fontStack, loadGoogleFont } from './fonts';
import { IconClose } from './icons';
import { FontPicker } from './Settings';
import type { PageSetup } from '../data/styles';
import { PageSetupForm } from './pages';
import { Popover } from './Sidebar';
import { useAppState } from './hooks';

const injected = new Set<string>();

/** Other places' style sheets to copy from (notes and each project), leaving out `except`. */
export function useStyleSources(except: string): { label: string; sheet: StyleSheet }[] {
  const state = useAppState();
  return useMemo(
    () => [
      ...(except === 'notes' ? [] : [{ label: 'Notes', sheet: fullSheet(state.settings.noteStyles, 'crumpet') }]),
      ...state.projects.filter((p) => p.id !== except).map((p) => ({ label: p.name || 'Untitled project', sheet: fullSheet(p.styles, 'manuscript') })),
    ],
    [state.settings.noteStyles, state.projects, except],
  );
}

/** Puts a style sheet's CSS on the page (once) and returns the class to scope it to. */
export function useSheetClass(sheet: StyleSheet): string {
  const id = useMemo(() => sheetId(sheet), [sheet]);
  const cls = `styles-${id}`;
  useEffect(() => {
    for (const d of [...Object.values(sheet.styles), ...(sheet.custom ?? []).map((c) => c.def)]) if (d.font?.source === 'google') loadGoogleFont(d.font.family, d.font.styles);
    if (injected.has(id)) return;
    injected.add(id);
    const el = document.createElement('style');
    el.dataset.styles = id;
    el.textContent = sheetCss(sheet, `.${cls}`, fontStack);
    document.head.appendChild(el);
  }, [id, cls, sheet]);
  return cls;
}

/** How a style looks in the menu: its font, weight and slant, at a size that fits. */
export function previewCss(d: StyleDef): React.CSSProperties {
  return {
    fontFamily: d.font ? fontStack(d.font) : 'var(--note-font, inherit)',
    fontSize: d.size ? `${Math.min(Math.max(d.size, 9), 17)}pt` : '13px',
    fontWeight: d.bold ? 700 : 400,
    fontStyle: d.italic ? 'italic' : 'normal',
    textTransform: d.caps ? 'uppercase' : 'none',
  };
}

/** The style menu: shows the style at the caret; choosing one applies it. */
export function StylePicker({ editor, sheet, disabled, onEditStyles }: { editor: Editor | null; sheet: StyleSheet; disabled: boolean; onEditStyles?(): void }) {
  const [open, setOpen] = useState(false);
  const key = editor ? blockStyleKey(sheet, editor.currentBlock()) : 'normal';
  return (
    <span className="style-picker note-actions">
      <button type="button" className="style-current" aria-label="Style" aria-haspopup="menu" aria-expanded={open} disabled={disabled} title="Paragraph style" onClick={() => setOpen(!open)}>
        <span>{styleNameIn(sheet, key)}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)} label="Styles">
          <div role="menu" className="style-menu">
            {sheetStyles(sheet).filter((s) => s.inMenu).map((s) => (
              <button
                key={s.key}
                type="button"
                role="menuitemradio"
                aria-checked={s.key === key}
                className="menu-item style-item"
                onClick={() => {
                  setOpen(false);
                  editor?.setBlockStyle(s.type, s.style);
                }}
              >
                <span style={previewCss(s.def)}>{s.name}</span>
              </button>
            ))}
            {onEditStyles && (
              <button
                type="button"
                className="menu-item style-edit"
                onClick={() => {
                  setOpen(false);
                  onEditStyles();
                }}
              >
                Modify styles…
              </button>
            )}
          </div>
        </Popover>
      )}
    </span>
  );
}

const ALIGNS: { align: Align; label: string; d: string }[] = [
  { align: 'left', label: 'Align left', d: 'M4 6h16M4 10h10M4 14h16M4 18h10' },
  { align: 'center', label: 'Centre', d: 'M4 6h16M7 10h10M4 14h16M7 18h10' },
  { align: 'right', label: 'Align right', d: 'M4 6h16M10 10h10M4 14h16M10 18h10' },
  { align: 'justify', label: 'Justify', d: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
];

export function AlignTools({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const current = editor?.currentBlock().align ?? 'left';
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘⇧' : 'Ctrl+Shift+';
  const keys: Record<Align, string> = { left: 'L', center: 'E', right: 'R', justify: 'J' };
  const icon = (d: string) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
  const now = ALIGNS.find((a) => a.align === current) ?? ALIGNS[0];
  return (
    <span className="note-actions align-tools">
      <button type="button" className={current !== 'left' ? 'active' : ''} aria-label={`Alignment: ${now.label}`} aria-haspopup="menu" aria-expanded={open} title="Alignment" disabled={disabled} onClick={() => setOpen(!open)}>
        {icon(now.d)}
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)} label="Alignment">
          <div role="menu" className="style-menu">
            {ALIGNS.map((a) => (
              <button
                key={a.align}
                type="button"
                role="menuitemradio"
                aria-checked={current === a.align}
                className="menu-item style-item"
                onClick={() => {
                  setOpen(false);
                  editor?.setAlign(a.align);
                }}
              >
                {icon(a.d)}
                <span className="grow">{a.label}</span>
                <kbd>{`${mod}${keys[a.align]}`}</kbd>
              </button>
            ))}
          </div>
        </Popover>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- the styles window

/** Inches or centimetres, by where the person is. */
const metric = typeof navigator !== 'undefined' && !/^en-(US|CA)|^es-(US|MX)/.test(navigator.language || 'en-US');
const toUnit = (inches: number) => Math.round((metric ? inches * 2.54 : inches) * 100) / 100;
const fromUnit = (v: number) => (metric ? v / 2.54 : v);
const unit = metric ? 'cm' : 'in';

const SPACINGS: [number, string][] = [
  [1, 'Single'],
  [1.15, '1.15'],
  [1.5, '1.5 lines'],
  [1.75, '1.75'],
  [2, 'Double'],
];

export function StylesDialog({ title, sheet, onChange, page, onPage, onClose, chapters = false, initial = 'normal', sources, onDefault }: { title: string; sheet: StyleSheet; onChange(sheet: StyleSheet): void; page?: PageSetup; onPage?(p: PageSetup): void; onClose(): void; chapters?: boolean; initial?: string; sources?: { label: string; sheet: StyleSheet }[]; onDefault?(): void }) {
  const [key, setKey] = useState<string>(initial);
  const [tab, setTab] = useState<'styles' | 'page'>('styles');
  const [madeDefault, setMadeDefault] = useState(false);
  const entries = sheetStyles(sheet);
  const item = entries.find((x) => x.key === key) ?? entries[0];
  const own = sheet.custom?.find((c) => c.id === item.key);
  const d = item.def;
  const set = (patch: Partial<StyleDef>) =>
    own ? onChange({ ...sheet, custom: sheet.custom!.map((c) => (c.id === own.id ? { ...c, def: { ...c.def, ...patch } } : c)) }) : onChange({ ...sheet, styles: { ...sheet.styles, [item.key]: { ...d, ...patch } } });
  const cls = useSheetClass(sheet);
  const inMenuKeys = entries.filter((x) => x.key !== 'list' && x.key !== 'header' && x.key !== 'footer');
  const move = (by: number) => {
    const keys = inMenuKeys.map((x) => x.key);
    const at = keys.indexOf(item.key);
    const to = at + by;
    if (at < 0 || to < 0 || to >= keys.length) return;
    [keys[at], keys[to]] = [keys[to], keys[at]];
    onChange({ ...sheet, order: keys });
  };
  const newStyle = () => {
    const base = (own ? own.base : (['list', 'header', 'footer', 'nospacing', 'intense', 'scenebreak'].includes(item.key) ? 'normal' : item.key)) as StyleKey;
    const n = (sheet.custom?.length ?? 0) + 1;
    const name = `My style ${n}`;
    const id = customStyleId(name, sheet);
    onChange({ ...sheet, custom: [...(sheet.custom ?? []), { id, name, base, def: { ...d } }] });
    setKey(id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const num = (label: string, value: number, apply: (v: number) => void, step = 1, suffix = 'pt') => (
    <label className="style-num">
      <span>{label}</span>
      <span className="with-unit">
        <input type="number" step={step} min={0} value={value} onChange={(e) => e.target.value !== '' && apply(Math.max(0, Number(e.target.value)))} />
        <small>{suffix}</small>
      </span>
    </label>
  );

  // Headers and footers: placed left, centre and right on the page, so no alignment or indents.
  const band = key === 'header' || key === 'footer';

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog styles-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close styles" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="styles-body">
          {page && onPage && (
            <div className="segmented small styles-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'styles'} aria-pressed={tab === 'styles'} onClick={() => setTab('styles')}>
                Styles
              </button>
              <button type="button" role="tab" aria-selected={tab === 'page'} aria-pressed={tab === 'page'} onClick={() => setTab('page')}>
                Page
              </button>
            </div>
          )}
          {tab === 'page' && page && onPage ? (
            <PageSetupForm page={page} onChange={onPage} chapters={chapters} />
          ) : (
          <>
          <label className="field">
            <span>Start from</span>
            <select
              aria-label="Style set"
              value={sheet.preset}
              onChange={(e) => {
                const id = e.target.value as PresetId;
                if (confirm(`Replace every style with the ${PRESETS.find((p) => p.id === id)?.name} set? Changes you made to styles here are lost (your own styles stay).`)) onChange({ ...presetSheet(id), custom: sheet.custom, hidden: sheet.hidden, order: sheet.order });
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id} title={p.hint}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {(sources?.length || onDefault) && (
            <div className="style-row styles-share">
              {!!sources?.length && (
                <label className="field">
                  <span>Copy styles from</span>
                  <select
                    aria-label="Copy styles from"
                    value=""
                    onChange={(e) => {
                      const src = sources[Number(e.target.value)];
                      if (src && confirm(`Use the styles of ${src.label} here? The styles here now are replaced.`)) onChange(structuredClone(src.sheet));
                    }}
                  >
                    <option value="">Choose…</option>
                    {sources.map((x, i) => (
                      <option key={i} value={i}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {onDefault && (
                <button
                  type="button"
                  className="btn quiet"
                  onClick={() => {
                    onDefault();
                    setMadeDefault(true);
                  }}
                >
                  {madeDefault ? 'Set as default ✓' : 'Set as default for new projects'}
                </button>
              )}
            </div>
          )}
          <div className="styles-cols">
            <div className="styles-list-col">
              <div className="styles-list" role="listbox" aria-label="Styles">
                {entries.map((s) => (
                  <button key={s.key} type="button" role="option" aria-selected={s.key === item.key} className={s.inMenu || s.key === 'list' || s.key === 'header' || s.key === 'footer' ? '' : 'hidden-style'} onClick={() => setKey(s.key)}>
                    {s.name}
                  </button>
                ))}
              </div>
              <button type="button" className="btn quiet small" onClick={newStyle}>
                + New style
              </button>
            </div>
            <div className="style-form" role="group" aria-label={`${item.name} style`}>
              {own && (
                <div className="style-row">
                  <label className="field grow">
                    <span>Name</span>
                    <input aria-label="Style name" value={own.name} onChange={(e) => onChange({ ...sheet, custom: sheet.custom!.map((c) => (c.id === own.id ? { ...c, name: e.target.value.slice(0, 40) || c.name } : c)) })} />
                  </label>
                  <label className="field">
                    <span>Based on</span>
                    <select aria-label="Based on" value={own.base} onChange={(e) => onChange({ ...sheet, custom: sheet.custom!.map((c) => (c.id === own.id ? { ...c, base: e.target.value as StyleKey } : c)) })}>
                      {BASE_STYLES.map((k) => (
                        <option key={k} value={k}>
                          {styleNameIn(sheet, k)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className="field">
                <span>Font</span>
                <label className="check">
                  <input type="checkbox" checked={!d.font} onChange={(e) => set({ font: e.target.checked ? null : DEFAULT_FONT })} /> Your writing font
                </label>
                {d.font && <FontPicker label={`Font for ${item.name}`} value={d.font} onChange={(font) => set({ font })} />}
              </div>
              <div className="style-row">
                <label className="style-num">
                  <span>Size</span>
                  <span className="with-unit">
                    <input type="number" step={0.5} min={6} placeholder="Text size" value={d.size ?? ''} onChange={(e) => set({ size: e.target.value === '' ? null : Math.max(6, Number(e.target.value)) })} />
                    <small>pt</small>
                  </span>
                </label>
                <div className="style-toggles" role="group" aria-label="Font style">
                  <button type="button" aria-pressed={d.bold} onClick={() => set({ bold: !d.bold })}>
                    <b>Bold</b>
                  </button>
                  <button type="button" aria-pressed={d.italic} onClick={() => set({ italic: !d.italic })}>
                    <i>Italic</i>
                  </button>
                  <button type="button" aria-pressed={d.caps} onClick={() => set({ caps: !d.caps })}>
                    CAPS
                  </button>
                </div>
              </div>
              {!band && (
                <div className="field">
                <span>Alignment</span>
                <div className="segmented small" role="group" aria-label="Alignment">
                  {(['left', 'center', 'right', 'justify'] as Align[]).map((a) => (
                    <button key={a} type="button" aria-pressed={d.align === a} onClick={() => set({ align: a })}>
                      {a === 'center' ? 'Centre' : a[0].toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              )}
              {!band && <div className="style-row">
                {num('Space before', d.spaceBefore, (v) => set({ spaceBefore: v }))}
                {num('Space after', d.spaceAfter, (v) => set({ spaceAfter: v }))}
                <label className="style-num">
                  <span>Line spacing</span>
                  <select value={SPACINGS.some(([v]) => v === d.lineSpacing) ? d.lineSpacing : 'custom'} onChange={(e) => e.target.value !== 'custom' && set({ lineSpacing: Number(e.target.value) })}>
                    {SPACINGS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                    {!SPACINGS.some(([v]) => v === d.lineSpacing) && <option value="custom">{d.lineSpacing}</option>}
                  </select>
                </label>
              </div>}
              {!band && <div className="style-row">
                {num('First line indent', toUnit(d.firstIndent), (v) => set({ firstIndent: fromUnit(v) }), 0.1, unit)}
                {num('Left indent', toUnit(d.leftIndent), (v) => set({ leftIndent: fromUnit(v) }), 0.1, unit)}
              </div>}
              {key === 'normal' && d.firstIndent > 0 && (
                <label className="check-row">
                  <input type="checkbox" checked={!!sheet.indentFirst} onChange={(e) => onChange({ ...sheet, indentFirst: e.target.checked || undefined })} />
                  Indent opening paragraphs too (a chapter’s first, and the first after a heading, scene break or blank line)
                </label>
              )}
              <div className={`style-preview ${cls}`} aria-label="Preview">
                {band ? (
                  <div className={`hf-band hf-${key}`}>
                    <div className="hf-slot left">Mara Quinn</div>
                    <div className="hf-slot center">The Lighthouse</div>
                    <div className="hf-slot right">7</div>
                  </div>
                ) : (
                <p className={`blk ${item.type.startsWith('heading') ? `blk-${item.type}` : item.type === 'quote' ? 'blk-quote' : item.type === 'bullet' ? 'blk-list blk-bullet' : 'blk-paragraph'}`} data-style={item.style}>
                  {key === 'scenebreak' ? '* * *' : 'The lamp had not been lit for eleven years, and still the boats steered by it. Mara climbed the hundred and twelve steps with her grandfather’s key in her pocket.'}
                </p>
                )}
              </div>
              <div className="style-manage">
                {inMenuKeys.some((x) => x.key === item.key) && (
                  <>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={!sheet.hidden?.includes(item.key)}
                        onChange={(e) => {
                          const hidden = (sheet.hidden ?? []).filter((k) => k !== item.key);
                          onChange({ ...sheet, hidden: e.target.checked ? hidden : [...hidden, item.key] });
                        }}
                      />
                      Show in the style menu
                    </label>
                    <button type="button" className="icon-btn" aria-label="Move up in the menu" title="Move up" onClick={() => move(-1)}>
                      ↑
                    </button>
                    <button type="button" className="icon-btn" aria-label="Move down in the menu" title="Move down" onClick={() => move(1)}>
                      ↓
                    </button>
                  </>
                )}
                <span className="grow" />
                {own ? (
                  <button
                    type="button"
                    className="btn quiet danger"
                    onClick={() => {
                      if (!confirm(`Delete the style “${own.name}”? Paragraphs in it go back to ${styleNameIn(sheet, own.base)}.`)) return;
                      onChange({ ...sheet, custom: sheet.custom!.filter((c) => c.id !== own.id), hidden: sheet.hidden?.filter((k) => k !== own.id), order: sheet.order?.filter((k) => k !== own.id) });
                      setKey(own.base);
                    }}
                  >
                    Delete {own.name}
                  </button>
                ) : (
                  <button type="button" className="btn quiet" onClick={() => set(presetSheet(sheet.preset).styles[item.key as StyleKey])}>
                    Reset {item.name}
                  </button>
                )}
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
