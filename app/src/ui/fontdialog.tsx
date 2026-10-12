// Word's Font window (Ctrl+D, or the button at the end of the Font group):
// font, size and colour; underline style and colour; strikethrough, double
// strikethrough, superscript, subscript, small caps, all caps and hidden;
// a text effect; and, on its Advanced tab, character spacing, raised or
// lowered, kerning, ligatures, number forms and spacing and stylistic sets,
// with a preview. Only what's changed is applied, so mixed text keeps the rest.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import type { Look, LookKey } from '@crumpet/editor/model';
import { IconClose } from './icons';

const OPEN = 'crumpet-open-font';

/** Opens the Font window on an editor's selection. */
export function openFontDialog(editor: Editor): void {
  window.dispatchEvent(new CustomEvent(OPEN, { detail: editor }));
}

export function FontDialogHost() {
  const [editor, setEditor] = useState<Editor | null>(null);
  useEffect(() => {
    const on = (e: Event) => setEditor((e as CustomEvent<Editor>).detail);
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  return editor ? <FontDialog editor={editor} onClose={() => setEditor(null)} /> : null;
}

type Underline = 'none' | NonNullable<Look['ul']>;
type Effect = 'none' | NonNullable<Look['fx']>;

interface Form {
  font: string;
  size: string;
  color: string;
  underline: Underline;
  ulc: string;
  strike: boolean;
  dstrike: boolean;
  va: 'none' | 'super' | 'sub';
  caps: 'none' | 'small' | 'all';
  hidden: boolean;
  fx: Effect;
  sp: string;
  pos: string;
  kern: boolean;
  lig: 'default' | NonNullable<Look['lig']>;
  num: 'default' | NonNullable<Look['num']>;
  nsp: 'default' | NonNullable<Look['nsp']>;
  ss: string;
}

/** The form as the selection is now. */
function readForm(ed: Editor): Form {
  const v = <K extends LookKey>(k: K) => ed.lookValue(k);
  const under = ed.isMarkActive('underline');
  return {
    font: v('font') ?? '',
    size: v('size') !== undefined ? String(v('size')) : '',
    color: v('color') ?? '',
    underline: v('ul') ?? (under ? 'single' : 'none'),
    ulc: v('ulc') ?? '',
    strike: ed.isMarkActive('strike'),
    dstrike: v('dstrike') === 1,
    va: v('va') ?? 'none',
    caps: v('caps') ?? 'none',
    hidden: v('hidden') === 1,
    fx: v('fx') ?? 'none',
    sp: v('sp') !== undefined ? String(v('sp')) : '',
    pos: v('pos') !== undefined ? String(v('pos')) : '',
    kern: v('nokern') !== 1,
    lig: v('lig') ?? 'default',
    num: v('num') ?? 'default',
    nsp: v('nsp') ?? 'default',
    ss: v('ss') !== undefined ? String(v('ss')) : '',
  };
}

/** CSS for the preview. */
function previewStyle(f: Form): React.CSSProperties {
  const lines = [f.underline !== 'none' ? 'underline' : '', f.strike || f.dstrike ? 'line-through' : ''].filter(Boolean).join(' ');
  return {
    fontFamily: f.font ? `"${f.font}", var(--note-font, serif)` : undefined,
    fontSize: f.size ? `${Math.min(36, Number(f.size))}pt` : undefined,
    color: f.fx === 'outline' ? 'transparent' : f.color || undefined,
    WebkitTextStroke: f.fx === 'outline' ? '0.04em currentColor' : undefined,
    textDecorationLine: lines || undefined,
    textDecorationStyle: f.dstrike && f.underline === 'none' ? 'double' : f.underline === 'none' || f.underline === 'single' || f.underline === 'thick' ? 'solid' : f.underline,
    textDecorationColor: f.ulc || undefined,
    textDecorationThickness: f.underline === 'thick' ? '0.12em' : undefined,
    fontVariantCaps: f.caps === 'small' ? 'small-caps' : undefined,
    textTransform: f.caps === 'all' ? 'uppercase' : undefined,
    letterSpacing: f.sp ? `${f.sp}pt` : undefined,
    verticalAlign: f.va !== 'none' ? f.va : f.pos ? `${f.pos}pt` : undefined,
    fontKerning: f.kern ? undefined : 'none',
    fontVariantLigatures: f.lig === 'none' ? 'none' : f.lig === 'all' ? 'common-ligatures contextual discretionary-ligatures historical-ligatures' : undefined,
    fontVariantNumeric: [f.num === 'oldstyle' ? 'oldstyle-nums' : f.num === 'lining' ? 'lining-nums' : '', f.nsp === 'tabular' ? 'tabular-nums' : f.nsp === 'proportional' ? 'proportional-nums' : ''].filter(Boolean).join(' ') || undefined,
    textShadow: f.fx === 'shadow' ? '0.06em 0.06em 0.08em rgba(0,0,0,0.45)' : f.fx === 'glow' ? '0 0 0.25em rgba(245,197,66,0.95)' : f.fx === 'emboss' ? '-0.04em -0.04em 0 rgba(255,255,255,0.8), 0.04em 0.04em 0.04em rgba(0,0,0,0.35)' : undefined,
    opacity: f.hidden ? 0.5 : undefined,
  };
}

function FontDialog({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const start = useRef(readForm(editor));
  const [f, setF] = useState<Form>(start.current);
  const [tab, setTab] = useState<'font' | 'advanced'>('font');
  const set = (patch: Partial<Form>) => setF({ ...f, ...patch });
  const panel = useRef<HTMLFormElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    panel.current?.querySelector('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const apply = () => {
    const s = start.current;
    const patch: Partial<Record<LookKey, string | number | null>> = {};
    const num = (v: string) => (v.trim() === '' || !Number.isFinite(+v) || +v === 0 ? null : +v);
    if (f.font !== s.font) patch.font = f.font.trim() || null;
    if (f.size !== s.size) patch.size = num(f.size);
    if (f.color !== s.color) patch.color = f.color || null;
    if (f.underline !== s.underline || f.ulc !== s.ulc) {
      // A plain underline is the U button's; any other style, or a colour, is the look's own.
      const styled = f.underline !== 'none' && (f.underline !== 'single' || !!f.ulc);
      patch.ul = styled ? f.underline : null;
      patch.ulc = styled && f.ulc ? f.ulc : null;
      const want = f.underline === 'single' && !f.ulc;
      if (editor.isMarkActive('underline') !== want) editor.toggleMark('underline');
    }
    if (f.strike !== s.strike && editor.isMarkActive('strike') !== f.strike) editor.toggleMark('strike');
    if (f.dstrike !== s.dstrike) patch.dstrike = f.dstrike ? 1 : null;
    if (f.va !== s.va) patch.va = f.va === 'none' ? null : f.va;
    if (f.caps !== s.caps) patch.caps = f.caps === 'none' ? null : f.caps;
    if (f.hidden !== s.hidden) patch.hidden = f.hidden ? 1 : null;
    if (f.fx !== s.fx) patch.fx = f.fx === 'none' ? null : f.fx;
    if (f.sp !== s.sp) patch.sp = num(f.sp);
    if (f.pos !== s.pos) patch.pos = num(f.pos);
    if (f.kern !== s.kern) patch.nokern = f.kern ? null : 1;
    if (f.lig !== s.lig) patch.lig = f.lig === 'default' ? null : f.lig;
    if (f.num !== s.num) patch.num = f.num === 'default' ? null : f.num;
    if (f.nsp !== s.nsp) patch.nsp = f.nsp === 'default' ? null : f.nsp;
    if (f.ss !== s.ss) patch.ss = num(f.ss);
    if (Object.keys(patch).length) editor.setLooks(patch);
    onClose();
    editor.focus();
  };

  const check = (key: 'strike' | 'dstrike' | 'hidden', label: string) => (
    <label className="check-row">
      <input type="checkbox" checked={f[key]} onChange={(e) => set({ [key]: e.target.checked })} /> {label}
    </label>
  );
  const spacingKind = !f.sp || +f.sp === 0 ? 'normal' : +f.sp > 0 ? 'expanded' : 'condensed';
  const posKind = !f.pos || +f.pos === 0 ? 'normal' : +f.pos > 0 ? 'raised' : 'lowered';

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        ref={panel}
        className="dialog para-dialog font-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Font"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <header className="dialog-head">
          <h2>Font</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings-tabs" role="tablist" aria-label="Font settings">
          <button type="button" role="tab" aria-selected={tab === 'font'} onClick={() => setTab('font')}>
            Font
          </button>
          <button type="button" role="tab" aria-selected={tab === 'advanced'} onClick={() => setTab('advanced')}>
            Advanced
          </button>
        </div>
        <div className="settings">
          {tab === 'font' ? (
            <>
              <div className="para-row">
                <label className="para-field">
                  <span>Font</span>
                  <input aria-label="Font" value={f.font} placeholder="The paragraph’s own" onChange={(e) => set({ font: e.target.value })} />
                </label>
                <label className="para-field">
                  <span>Size</span>
                  <span className="para-input">
                    <input type="number" aria-label="Size" min={1} max={400} step={0.5} value={f.size} placeholder="—" onChange={(e) => set({ size: e.target.value })} />
                    <small>pt</small>
                  </span>
                </label>
                <label className="para-field">
                  <span>Colour</span>
                  <input type="color" aria-label="Font colour" value={f.color || '#000000'} onChange={(e) => set({ color: e.target.value })} />
                </label>
              </div>
              <div className="para-row">
                <label className="para-field">
                  <span>Underline style</span>
                  <select aria-label="Underline style" value={f.underline} onChange={(e) => set({ underline: e.target.value as Underline })}>
                    <option value="none">(none)</option>
                    <option value="single">Single</option>
                    <option value="double">Double</option>
                    <option value="thick">Thick</option>
                    <option value="dotted">Dotted</option>
                    <option value="dashed">Dashed</option>
                    <option value="wavy">Wavy</option>
                  </select>
                </label>
                <label className="para-field">
                  <span>Underline colour</span>
                  <input type="color" aria-label="Underline colour" value={f.ulc || '#000000'} disabled={f.underline === 'none'} onChange={(e) => set({ ulc: e.target.value })} />
                </label>
                <label className="para-field">
                  <span>Text effect</span>
                  <select aria-label="Text effect" value={f.fx} onChange={(e) => set({ fx: e.target.value as Effect })}>
                    <option value="none">(none)</option>
                    <option value="outline">Outline</option>
                    <option value="shadow">Shadow</option>
                    <option value="glow">Glow</option>
                    <option value="reflect">Reflection</option>
                    <option value="emboss">Emboss</option>
                    <option value="engrave">Engrave</option>
                  </select>
                </label>
              </div>
              <fieldset className="font-effects">
                <legend>Effects</legend>
                {check('strike', 'Strikethrough')}
                {check('dstrike', 'Double strikethrough')}
                <label className="check-row">
                  <input type="checkbox" checked={f.va === 'super'} onChange={(e) => set({ va: e.target.checked ? 'super' : 'none' })} /> Superscript
                </label>
                <label className="check-row">
                  <input type="checkbox" checked={f.va === 'sub'} onChange={(e) => set({ va: e.target.checked ? 'sub' : 'none' })} /> Subscript
                </label>
                <label className="check-row">
                  <input type="checkbox" checked={f.caps === 'small'} onChange={(e) => set({ caps: e.target.checked ? 'small' : 'none' })} /> Small caps
                </label>
                <label className="check-row">
                  <input type="checkbox" checked={f.caps === 'all'} onChange={(e) => set({ caps: e.target.checked ? 'all' : 'none' })} /> All caps
                </label>
                {check('hidden', 'Hidden (shown with ¶)')}
              </fieldset>
            </>
          ) : (
            <>
              <div className="para-row">
                <label className="para-field">
                  <span>Spacing</span>
                  <select aria-label="Spacing" value={spacingKind} onChange={(e) => set({ sp: e.target.value === 'normal' ? '' : e.target.value === 'expanded' ? String(Math.abs(+f.sp || 1)) : String(-Math.abs(+f.sp || 1)) })}>
                    <option value="normal">Normal</option>
                    <option value="expanded">Expanded</option>
                    <option value="condensed">Condensed</option>
                  </select>
                </label>
                <label className="para-field">
                  <span>By</span>
                  <span className="para-input">
                    <input type="number" aria-label="Spacing by" step={0.1} value={f.sp ? Math.abs(+f.sp) : ''} placeholder="—" disabled={spacingKind === 'normal'} onChange={(e) => set({ sp: String((spacingKind === 'condensed' ? -1 : 1) * Math.abs(+e.target.value)) })} />
                    <small>pt</small>
                  </span>
                </label>
                <label className="para-field">
                  <span>Position</span>
                  <select aria-label="Position" value={posKind} onChange={(e) => set({ pos: e.target.value === 'normal' ? '' : e.target.value === 'raised' ? String(Math.abs(+f.pos || 3)) : String(-Math.abs(+f.pos || 3)) })}>
                    <option value="normal">Normal</option>
                    <option value="raised">Raised</option>
                    <option value="lowered">Lowered</option>
                  </select>
                </label>
                <label className="para-field">
                  <span>By</span>
                  <span className="para-input">
                    <input type="number" aria-label="Position by" step={0.5} value={f.pos ? Math.abs(+f.pos) : ''} placeholder="—" disabled={posKind === 'normal'} onChange={(e) => set({ pos: String((posKind === 'lowered' ? -1 : 1) * Math.abs(+e.target.value)) })} />
                    <small>pt</small>
                  </span>
                </label>
              </div>
              <label className="check-row">
                <input type="checkbox" checked={f.kern} onChange={(e) => set({ kern: e.target.checked })} /> Kerning (letters fitted together as the font designer set)
              </label>
              <fieldset>
                <legend>OpenType features</legend>
                <div className="para-row">
                  <label className="para-field">
                    <span>Ligatures</span>
                    <select aria-label="Ligatures" value={f.lig} onChange={(e) => set({ lig: e.target.value as Form['lig'] })}>
                      <option value="default">Default</option>
                      <option value="none">None</option>
                      <option value="common">Standard only</option>
                      <option value="contextual">Standard and contextual</option>
                      <option value="all">All</option>
                    </select>
                  </label>
                  <label className="para-field">
                    <span>Number spacing</span>
                    <select aria-label="Number spacing" value={f.nsp} onChange={(e) => set({ nsp: e.target.value as Form['nsp'] })}>
                      <option value="default">Default</option>
                      <option value="proportional">Proportional</option>
                      <option value="tabular">Tabular</option>
                    </select>
                  </label>
                  <label className="para-field">
                    <span>Number forms</span>
                    <select aria-label="Number forms" value={f.num} onChange={(e) => set({ num: e.target.value as Form['num'] })}>
                      <option value="default">Default</option>
                      <option value="lining">Lining</option>
                      <option value="oldstyle">Old-style</option>
                    </select>
                  </label>
                  <label className="para-field">
                    <span>Stylistic set</span>
                    <select aria-label="Stylistic set" value={f.ss} onChange={(e) => set({ ss: e.target.value })}>
                      <option value="">Default</option>
                      {Array.from({ length: 20 }, (_, i) => (
                        <option key={i} value={String(i + 1)}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
            </>
          )}
          <div className="font-preview" aria-label="Preview">
            <span style={previewStyle(f)}>The quick brown fox 1234567890</span>
          </div>
          <div className="para-foot">
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
