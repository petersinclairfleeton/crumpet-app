// Word's Design tab for the formatting bar: a watermark, page borders, and
// (from the Insert tab) cover pages. They belong to the document: kept on its
// first paragraph, printed, and sent to Word.

import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { ParaLook } from '@crumpet/editor/model';
import { COVER_DESIGNS, type CoverDesign } from '@crumpet/editor/cover';
import { Popover } from './Sidebar';
import { type ToolItem, closeMore } from './toolbar';
import { addFile, isImage } from '../data/files';
import { useAppState } from './hooks';
import { formatDate } from '../data/headers';
import { COLOUR_SETS, DOC_THEMES, EFFECTS, FONT_PAIRS, SPACINGS, colourSet, fontPair, themeCss, themeOf } from '../data/doctheme';
import { loadGoogleFont } from './fonts';

const svg = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON_WATERMARK = svg('M6 3h9l4 4v14H6zM9 17l6-8');
const ICON_BORDER = svg('M4 4h16v16H4zM7 7h10v10H7z');
const ICON_COVER = svg('M6 3h12v18H6zM9 8h6M9 11h6M10 16h4');
const ICON_THEME = svg('M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11h.01M10 7h.01M15 7h.01');
const ICON_COLOURS = svg('M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z');
const ICON_FONTS = svg('M4 19l5-14 5 14M6 14h6M15 19l3-8 3 8M16 16h4');
const ICON_SPACING = svg('M8 6h12M8 12h12M8 18h12M4 4v4M4 16v4M3 6l1-2 1 2M3 18l1 2 1-2');
const ICON_EFFECTS = svg('M5 7h10v10H5zM9 21h10V11');

/** The rules for the document themes, and the theme's fonts fetched (once each). */
let themeStyle: HTMLStyleElement | null = null;
export function applyThemeLook(thf: string | undefined): void {
  if (typeof document === 'undefined') return;
  if (!themeStyle) {
    themeStyle = document.createElement('style');
    themeStyle.dataset.themes = '';
    themeStyle.textContent = themeCss();
    document.head.appendChild(themeStyle);
  }
  for (const family of fontPair(thf)?.google ?? []) loadGoogleFont(family, 15);
}

function Drop({ label, glyph, off, children }: { label: string; glyph: React.ReactNode; off: boolean; children(close: () => void): React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tool-drop">
      <button type="button" aria-label={label} aria-expanded={open} title={label} disabled={off} onClick={() => setOpen(!open)}>
        {glyph}
        <span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <Popover label={label} onClose={() => setOpen(false)}>
          {children(() => {
            setOpen(false);
            closeMore();
          })}
        </Popover>
      )}
    </span>
  );
}

/** Word's ready-made watermarks. */
const WATERMARKS = ['DRAFT', 'CONFIDENTIAL', 'DO NOT COPY', 'SAMPLE', 'URGENT'];
const WM_COLOURS: [string, string][] = [
  ['#c0c0c0', 'Silver'],
  ['#d99594', 'Rose'],
  ['#95b3d7', 'Blue'],
  ['#c2d69b', 'Green'],
];
const BORDER_STYLES: [NonNullable<ParaLook['pgb']>, string][] = [
  ['single', 'Single line'],
  ['double', 'Double line'],
  ['thick', 'Thick line'],
  ['dotted', 'Dotted'],
  ['dashed', 'Dashed'],
];
const BORDER_COLOURS: [string, string][] = [
  ['#333333', 'Black'],
  ['#2f5d8a', 'Blue'],
  ['#8a2f3c', 'Red'],
  ['#3c6e47', 'Green'],
  ['#b38a2e', 'Gold'],
];

function WatermarkMenu({ ed, close }: { ed: Editor; close(): void }) {
  const p = ed.docPara();
  const [text, setText] = useState(p.wm ?? '');
  const set = (patch: Partial<ParaLook>) => ed.setDocPara(patch);
  const pickPicture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file || !isImage(file.type, file.name)) return;
      const { src } = await addFile(file);
      set({ wmimg: src, wm: undefined });
      close();
    });
    input.click();
  };
  return (
    <div className="menu-list watermark-menu">
      <span className="menu-head">Watermark</span>
      {WATERMARKS.map((w) => (
        <button key={w} type="button" role="menuitemradio" aria-checked={p.wm === w} className={`menu-item${p.wm === w ? ' on' : ''}`} onClick={() => (set({ wm: w, wmimg: undefined }), close())}>
          {w}
        </button>
      ))}
      <form
        className="menu-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) set({ wm: text.trim(), wmimg: undefined });
          close();
        }}
      >
        <input aria-label="Watermark words" placeholder="Words of your own" value={text} maxLength={80} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn small">
          Use
        </button>
      </form>
      <button type="button" className="menu-item" onClick={pickPicture}>
        A picture…
      </button>
      {(p.wm || p.wmimg) && (
        <>
          <span className="menu-head">Look</span>
          {p.wm && (
            <>
              <div className="segmented small" role="group" aria-label="Watermark layout">
                <button type="button" aria-pressed={!p.wmflat} onClick={() => set({ wmflat: undefined })}>
                  Diagonal
                </button>
                <button type="button" aria-pressed={!!p.wmflat} onClick={() => set({ wmflat: true })}>
                  Horizontal
                </button>
              </div>
              <div className="swatch-row" role="group" aria-label="Watermark colour">
                {WM_COLOURS.map(([hex, name]) => (
                  <button key={hex} type="button" className={`swatch${(p.wmc ?? '#c0c0c0') === hex ? ' on' : ''}`} style={{ background: hex }} aria-label={name} title={name} aria-pressed={(p.wmc ?? '#c0c0c0') === hex} onClick={() => set({ wmc: hex === '#c0c0c0' ? undefined : hex })} />
                ))}
              </div>
            </>
          )}
          <button type="button" className="menu-item" onClick={() => (set({ wm: undefined, wmimg: undefined, wmc: undefined, wmflat: undefined }), close())}>
            Remove watermark
          </button>
        </>
      )}
      <p className="menu-note">Shown faintly on every page in page view, printed, and sent to Word.</p>
    </div>
  );
}

function BorderMenu({ ed, close }: { ed: Editor; close(): void }) {
  const p = ed.docPara();
  return (
    <div className="menu-list">
      <span className="menu-head">Page borders</span>
      <button type="button" role="menuitemradio" aria-checked={!p.pgb} className={`menu-item${!p.pgb ? ' on' : ''}`} onClick={() => (ed.setDocPara({ pgb: undefined, pgbc: undefined }), close())}>
        None
      </button>
      {BORDER_STYLES.map(([id, name]) => (
        <button key={id} type="button" role="menuitemradio" aria-checked={p.pgb === id} className={`menu-item${p.pgb === id ? ' on' : ''}`} onClick={() => (ed.setDocPara({ pgb: id }), close())}>
          <span className={`border-sample b-${id}`} aria-hidden="true" /> {name}
        </button>
      ))}
      {p.pgb && (
        <div className="swatch-row" role="group" aria-label="Border colour">
          {BORDER_COLOURS.map(([hex, name]) => (
            <button key={hex} type="button" className={`swatch${(p.pgbc ?? '#333333') === hex ? ' on' : ''}`} style={{ background: hex }} aria-label={name} title={name} aria-pressed={(p.pgbc ?? '#333333') === hex} onClick={() => ed.setDocPara({ pgbc: hex === '#333333' ? undefined : hex })} />
          ))}
        </div>
      )}
      <p className="menu-note">A line round every page, in page view, printed and in Word.</p>
    </div>
  );
}

/** A guess at the document's title: a Title-styled line, the first heading, or the first line. */
function guessTitle(ed: Editor): string {
  const blocks = ed.state.doc.blocks.filter((b) => !b.para?.cover);
  const text = (b: (typeof blocks)[number]) => b.runs.map((r) => r.text).join('').replace(/[\u0000-\u001f￼]/g, '').trim();
  const pick = blocks.find((b) => b.style === 'title') ?? blocks.find((b) => b.type.startsWith('heading')) ?? blocks.find((b) => text(b));
  return pick ? text(pick).slice(0, 120) : '';
}

function CoverMenu({ ed, close }: { ed: Editor; close(): void }) {
  const { settings } = useAppState();
  const [design, setDesign] = useState<CoverDesign>('classic');
  const [title, setTitle] = useState(() => guessTitle(ed));
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState(settings.name ?? '');
  const [date, setDate] = useState(() => formatDate(Date.now(), 'long'));
  return (
    <form
      className="menu-list cover-menu"
      onSubmit={(e) => {
        e.preventDefault();
        ed.insertCover(design, { title, subtitle, author, date });
        close();
      }}
    >
      <span className="menu-head">Cover page</span>
      <div className="cover-designs" role="radiogroup" aria-label="Cover design">
        {COVER_DESIGNS.map((d) => (
          <button key={d.id} type="button" role="radio" aria-checked={design === d.id} className={`cover-design c-${d.id}${design === d.id ? ' on' : ''}`} title={d.hint} onClick={() => setDesign(d.id)}>
            <span className="cover-thumb" aria-hidden="true">
              <i />
              <b />
              <i />
            </span>
            {d.name}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Title</span>
        <input aria-label="Cover title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        <span>Subtitle</span>
        <input aria-label="Cover subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
      </label>
      <label className="field">
        <span>Author</span>
        <input aria-label="Cover author" value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <label className="field">
        <span>Date</span>
        <input aria-label="Cover date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="menu-row">
        <button type="submit" className="btn primary small">
          {ed.hasCover ? 'Replace cover page' : 'Add cover page'}
        </button>
        {ed.hasCover && (
          <button type="button" className="btn small" onClick={() => (ed.removeCover(), close())}>
            Remove cover page
          </button>
        )}
      </div>
      <p className="menu-note">A page of its own at the start, with no header or footer. Change its words on the page like any text.</p>
    </form>
  );
}

function ThemesMenu({ ed, close }: { ed: Editor; close(): void }) {
  const p = ed.docPara();
  const now = themeOf(p);
  const custom = !now && (p.thc || p.thf || p.thx);
  return (
    <div className="menu-list theme-menu">
      <span className="menu-head">Document theme</span>
      <div className="theme-gallery" role="radiogroup" aria-label="Themes">
        {DOC_THEMES.map((t) => {
          const c = colourSet(t.thc)!;
          const f = fontPair(t.thf)!;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={now?.id === t.id} className={`theme-card${now?.id === t.id ? ' on' : ''}`} onMouseEnter={() => applyThemeLook(t.thf)} onClick={() => (ed.setDocPara({ thc: t.thc, thf: t.thf, thx: t.thx }), close())}>
              <span className="theme-aa" style={{ fontFamily: f.head, color: c.heading }}>Aa</span>
              <span className="theme-strip" aria-hidden="true">
                {c.accents.slice(0, 4).map((a) => (
                  <i key={a} style={{ background: a }} />
                ))}
              </span>
              <span className="theme-name">{t.name}</span>
            </button>
          );
        })}
      </div>
      {custom && <p className="menu-note">This document mixes its own colours, fonts or effects.</p>}
      <button type="button" className="menu-item" disabled={!p.thc && !p.thf && !p.thx} onClick={() => (ed.setDocPara({ thc: undefined, thf: undefined, thx: undefined }), close())}>
        Back to the styles’ own look
      </button>
    </div>
  );
}

function ColoursMenu({ ed, close }: { ed: Editor; close(): void }) {
  const p = ed.docPara();
  return (
    <div className="menu-list">
      <span className="menu-head">Theme colours</span>
      <button type="button" role="menuitemradio" aria-checked={!p.thc} className={`menu-item${!p.thc ? ' on' : ''}`} onClick={() => (ed.setDocPara({ thc: undefined }), close())}>
        The styles’ own
      </button>
      {COLOUR_SETS.map((c) => (
        <button key={c.id} type="button" role="menuitemradio" aria-checked={p.thc === c.id} className={`menu-item colour-set${p.thc === c.id ? ' on' : ''}`} onClick={() => (ed.setDocPara({ thc: c.id }), close())}>
          <span className="theme-strip" aria-hidden="true">
            {[c.heading, ...c.accents].map((a, i) => (
              <i key={i} style={{ background: a }} />
            ))}
          </span>
          {c.name}
        </button>
      ))}
      <p className="menu-note">Headings, the title and links take them; they head the Font colour menu too.</p>
    </div>
  );
}

function FontsMenu({ ed, close }: { ed: Editor; close(): void }) {
  const p = ed.docPara();
  for (const f of FONT_PAIRS) for (const g of f.google ?? []) loadGoogleFont(g, 1, `${f.name}AaBbHeadingsBody text`);
  return (
    <div className="menu-list">
      <span className="menu-head">Theme fonts</span>
      <button type="button" role="menuitemradio" aria-checked={!p.thf} className={`menu-item${!p.thf ? ' on' : ''}`} onClick={() => (ed.setDocPara({ thf: undefined }), close())}>
        The styles’ own
      </button>
      {FONT_PAIRS.map((f) => (
        <button key={f.id} type="button" role="menuitemradio" aria-checked={p.thf === f.id} className={`menu-item font-pair${p.thf === f.id ? ' on' : ''}`} onClick={() => (applyThemeLook(f.id), ed.setDocPara({ thf: f.id }), close())}>
          <span className="font-pair-name">{f.name}</span>
          <span style={{ fontFamily: f.head }}>Headings</span>
          <span style={{ fontFamily: f.body }}>Body text</span>
        </button>
      ))}
    </div>
  );
}

function SpacingMenu({ ed, close }: { ed: Editor; close(): void }) {
  const p = ed.docPara();
  return (
    <div className="menu-list">
      <span className="menu-head">Paragraph spacing</span>
      <button type="button" role="menuitemradio" aria-checked={!p.psp} className={`menu-item${!p.psp ? ' on' : ''}`} onClick={() => (ed.setDocPara({ psp: undefined }), close())}>
        The styles’ own
      </button>
      {SPACINGS.map((s) => (
        <button key={s.id} type="button" role="menuitemradio" aria-checked={p.psp === s.id} className={`menu-item${p.psp === s.id ? ' on' : ''}`} onClick={() => (ed.setDocPara({ psp: s.id }), close())}>
          {s.name} <small className="menu-key">{s.line === 1 ? 'single' : `${s.line}×`}, {s.after}pt after</small>
        </button>
      ))}
      <p className="menu-note">For the whole document. Spacing set on a paragraph by hand stays.</p>
    </div>
  );
}

function EffectsMenu({ ed, close }: { ed: Editor; close(): void }) {
  const p = ed.docPara();
  return (
    <div className="menu-list">
      <span className="menu-head">Theme effects</span>
      <button type="button" role="menuitemradio" aria-checked={!p.thx} className={`menu-item${!p.thx ? ' on' : ''}`} onClick={() => (ed.setDocPara({ thx: undefined }), close())}>
        The styles’ own
      </button>
      {EFFECTS.map((x) => (
        <button key={x.id} type="button" role="menuitemradio" aria-checked={p.thx === x.id} className={`menu-item${p.thx === x.id ? ' on' : ''}`} onClick={() => (ed.setDocPara({ thx: x.id }), close())}>
          <span className="effect-sample" style={{ boxShadow: x.shadow, borderRadius: x.radius ?? 0 }} aria-hidden="true" /> {x.name}
        </button>
      ))}
      <p className="menu-note">How shapes, text boxes and pictures stand off the page.</p>
    </div>
  );
}

/** Watermark, Page borders and Cover page, as toolbar items. */
export function designItems(ed: Editor | null, off: boolean): ToolItem[] {
  const drop = (key: string, label: string, glyph: React.ReactNode, Menu: (p: { ed: Editor; close(): void }) => React.ReactNode): ToolItem => ({
    key,
    label,
    pri: 1,
    node: (
      <Drop label={label} glyph={glyph} off={off}>
        {(close) => ed && <Menu ed={ed} close={close} />}
      </Drop>
    ),
  });
  return [
    drop('themes', 'Themes', ICON_THEME, ThemesMenu),
    drop('themecolours', 'Theme colours', ICON_COLOURS, ColoursMenu),
    drop('themefonts', 'Theme fonts', ICON_FONTS, FontsMenu),
    drop('paraspacing', 'Paragraph spacing', ICON_SPACING, SpacingMenu),
    drop('themeeffects', 'Theme effects', ICON_EFFECTS, EffectsMenu),
    {
      key: 'watermark',
      label: 'Watermark',
      pri: 1,
      node: (
        <Drop label="Watermark" glyph={ICON_WATERMARK} off={off}>
          {(close) => ed && <WatermarkMenu ed={ed} close={close} />}
        </Drop>
      ),
    },
    {
      key: 'pageborders',
      label: 'Page borders',
      pri: 1,
      node: (
        <Drop label="Page borders" glyph={ICON_BORDER} off={off}>
          {(close) => ed && <BorderMenu ed={ed} close={close} />}
        </Drop>
      ),
    },
    {
      key: 'cover',
      label: 'Cover page',
      pri: 1,
      node: (
        <Drop label="Cover page" glyph={ICON_COVER} off={off}>
          {(close) => ed && <CoverMenu ed={ed} close={close} />}
        </Drop>
      ),
    },
  ];
}
