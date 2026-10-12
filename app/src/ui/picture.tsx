// The app's part of a picture's menu (the rest is in the editor): Alt text
// opens a box to describe the picture; Change picture opens the file chooser
// and puts the new picture in the old one's place, keeping its size and look;
// Corrections and effects opens Word's Format Picture choices (brightness,
// contrast, colour, see-through, artistic effects, a border) with a preview.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { addFile } from '../data/files';
import { type PicEffect, type PicLook, picFilter } from '@crumpet/editor/picture';
import { IconClose } from './icons';

const OPEN = 'crumpet-picture-alt';

/** Lets an editor's pictures ask for alt text and a new picture. */
export function usePictureActions(editor: Editor | null): void {
  useEffect(() => {
    if (!editor) return;
    editor.onPictureAction = (id, action) => {
      if (action === 'alt' || action === 'format') window.dispatchEvent(new CustomEvent(OPEN, { detail: { editor, id, kind: action } }));
      else choosePicture(editor, id);
    };
    return () => {
      editor.onPictureAction = null;
    };
  }, [editor]);
}

function choosePicture(editor: Editor, id: string): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const { type, src } = await addFile(file);
      if (type !== 'image') throw new Error('That isn’t a picture.');
      editor.setPicture(id, {}, false, src);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'That picture couldn’t be added.');
    }
  });
  input.click();
}

/** The Alt text box, when a picture asks for it. */
export function PictureAltHost() {
  const [open, setOpen] = useState<{ editor: Editor; id: string; kind: 'alt' | 'format' } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setOpen((e as CustomEvent<{ editor: Editor; id: string; kind: 'alt' | 'format' }>).detail);
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  if (!open) return null;
  return open.kind === 'format' ? <FormatDialog editor={open.editor} id={open.id} onClose={() => setOpen(null)} /> : <AltDialog editor={open.editor} id={open.id} onClose={() => setOpen(null)} />;
}

const EFFECT_NAMES: [PicEffect | '', string][] = [
  ['', 'None'],
  ['grey', 'Black and white'],
  ['sepia', 'Sepia'],
  ['washout', 'Washout'],
  ['vintage', 'Vintage'],
  ['blur', 'Blur'],
  ['invert', 'Negative'],
];
const BORDERS: [string, string][] = [
  ['', 'No border'],
  ['#222222', 'Black'],
  ['#ffffff', 'White'],
  ['#7a7a7a', 'Grey'],
  ['#2f6fd1', 'Blue'],
  ['#2e8b57', 'Green'],
  ['#c0392b', 'Red'],
  ['#d08a00', 'Gold'],
];

/** Word's Format Picture: corrections, colour, see-through, an artistic effect and a border, with a preview. */
function FormatDialog({ editor, id, onClose }: { editor: Editor; id: string; onClose(): void }) {
  const blk = editor.state.doc.blocks.find((b) => b.id === id);
  const src = editor.view.blockElement(id)?.querySelector<HTMLImageElement>('.pic-box img')?.src ?? '';
  const start = blk?.pic ?? {};
  const [look, setLook] = useState<PicLook>({ bright: start.bright, contrast: start.contrast, sat: start.sat, fade: start.fade, effect: start.effect, border: start.border });
  const set = (patch: Partial<PicLook>) => setLook({ ...look, ...patch });
  const panel = useRef<HTMLFormElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    panel.current?.querySelector('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const slider = (key: 'bright' | 'contrast' | 'sat' | 'fade', label: string, min: number, max: number) => {
    const v = look[key] ?? 0;
    return (
      <label className="field pic-slider">
        <span>
          {label} · {key === 'fade' ? `${v}%` : v > 0 ? `+${v}` : v}
        </span>
        <input className="range" type="range" min={min} max={max} step={1} value={v} style={{ '--pct': `${((v - min) / (max - min)) * 100}%` } as React.CSSProperties} onChange={(e) => set({ [key]: Number(e.target.value) || undefined })} />
      </label>
    );
  };
  const preview = (p: PicLook) => ({ filter: picFilter(p) || undefined, opacity: p.fade ? 1 - p.fade / 100 : undefined });
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        ref={panel}
        className="dialog para-dialog pic-format"
        role="dialog"
        aria-modal="true"
        aria-label="Corrections and effects"
        onSubmit={(e) => {
          e.preventDefault();
          // Each choice given, so one taken off (or Reset all) is cleared.
          editor.setPicture(id, { bright: look.bright, contrast: look.contrast, sat: look.sat, fade: look.fade, effect: look.effect, border: look.border });
          onClose();
        }}
      >
        <header className="dialog-head">
          <h2>Corrections and effects</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <div className="pic-format-grid">
            <div className="pic-preview" style={{ boxShadow: look.border ? `inset 0 0 0 3px ${look.border}` : undefined }}>
              {src && <img src={src} alt="" style={preview(look)} />}
            </div>
            <div className="pic-sliders">
              {slider('bright', 'Brightness', -100, 100)}
              {slider('contrast', 'Contrast', -100, 100)}
              {slider('sat', 'Colour', -100, 100)}
              {slider('fade', 'See-through', 0, 90)}
            </div>
          </div>
          <div className="field" role="group" aria-label="Artistic effect">
            <span>Effect</span>
            <div className="pic-effects">
              {EFFECT_NAMES.map(([e, name]) => (
                <button key={name} type="button" className={`pic-effect${(look.effect ?? '') === e ? ' on' : ''}`} aria-pressed={(look.effect ?? '') === e} onClick={() => set({ effect: e || undefined })}>
                  {src && <img src={src} alt="" style={preview({ effect: e || undefined })} />}
                  <small>{name}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="field" role="group" aria-label="Border">
            <span>Border</span>
            <div className="accents">
              {BORDERS.map(([c, name]) => (
                <button key={name} type="button" className={`swatch${(look.border ?? '') === c ? ' on' : ''}${c ? '' : ' none'}`} style={c ? { background: c, ...(c === '#ffffff' ? { borderColor: 'var(--line2)' } : {}) } : undefined} aria-label={name} aria-pressed={(look.border ?? '') === c} title={name} onClick={() => set({ border: c || undefined })} />
              ))}
            </div>
          </div>
          <div className="para-foot">
            <button type="button" className="btn quiet" onClick={() => setLook({})}>
              Reset all
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

function AltDialog({ editor, id, onClose }: { editor: Editor; id: string; onClose(): void }) {
  const blk = editor.state.doc.blocks.find((b) => b.id === id);
  const [text, setText] = useState(blk?.pic?.alt ?? '');
  const box = useRef<HTMLTextAreaElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const save = () => {
    editor.setPicture(id, { alt: text.trim() || undefined });
    onClose();
  };
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="dialog para-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Alt text"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <header className="dialog-head">
          <h2>Alt text</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          <p className="sync-hint">Describe what the picture shows, for people who can’t see it (screen readers, e-books, Word). Without it, the caption is used.</p>
          <textarea ref={box} className="alt-text" aria-label="Describe the picture" rows={4} value={text} placeholder="A gull standing on a wooden post by the harbour" onChange={(e) => setText(e.target.value)} />
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
