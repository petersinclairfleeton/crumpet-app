// The app's part of a picture's menu (the rest is in the editor): Alt text
// opens a box to describe the picture; Change picture opens the file chooser
// and puts the new picture in the old one's place, keeping its size and look;
// Corrections and effects opens Word's Format Picture choices (brightness,
// contrast, colour, see-through, artistic effects, a border) with a preview;
// Remove background and Compress make a new file (the original is kept, for
// Reset picture).

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { addFile, fileBlob, mediaUrl } from '../data/files';
import { svgToShapeLook } from '../data/svgpath';
import { type PicEffect, type PicLook, picFilter } from '@crumpet/editor/picture';
import { backgroundPreview, compressPicture, fileSize, loadPicture, withoutBackground } from '../data/picedit';
import { IconClose } from './icons';

const OPEN = 'crumpet-picture-alt';

/** Lets an editor's pictures ask for alt text and a new picture. */
export function usePictureActions(editor: Editor | null): void {
  useEffect(() => {
    if (!editor) return;
    editor.onPictureAction = (id, action) => {
      if (action !== 'change') window.dispatchEvent(new CustomEvent(OPEN, { detail: { editor, id, kind: action } }));
      else choosePicture(editor, id);
    };
    // Convert to Shape: the SVG file's outlines as a drawing shape.
    editor.onSvgToShape = async (src) => {
      try {
        const blob = (await fileBlob(src)) ?? (await (await fetch(await mediaUrl(src))).blob());
        const look = svgToShapeLook(await blob.text());
        if (!look) alert('This drawing couldn’t be made a shape (it may hold pictures or text rather than outlines).');
        return look;
      } catch {
        alert('The drawing couldn’t be read.');
        return null;
      }
    };
    return () => {
      editor.onPictureAction = null;
      editor.onSvgToShape = null;
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
  const [open, setOpen] = useState<{ editor: Editor; id: string; kind: Kind } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setOpen((e as CustomEvent<{ editor: Editor; id: string; kind: Kind }>).detail);
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  if (!open) return null;
  const props = { editor: open.editor, id: open.id, onClose: () => setOpen(null) };
  if (open.kind === 'format') return <FormatDialog {...props} />;
  if (open.kind === 'background') return <BackgroundDialog {...props} />;
  if (open.kind === 'compress') return <CompressDialog {...props} />;
  return <AltDialog {...props} />;
}

type Kind = 'alt' | 'format' | 'background' | 'compress';

/** The picture's file as shown now (its address in this browser). */
function shownSrc(editor: Editor, id: string): string {
  return editor.view.blockElement(id)?.querySelector<HTMLImageElement>('.pic-box img')?.src ?? '';
}

/** Keeps a new file for a picture and puts it in place, remembering the first file it had (for Reset picture). */
async function replaceFile(editor: Editor, id: string, blob: Blob, name: string, patch: Partial<PicLook> = {}): Promise<void> {
  const blk = editor.state.doc.blocks.find((b) => b.id === id);
  if (!blk) return;
  const { src } = await addFile(new File([blob], name, { type: blob.type }));
  editor.setPicture(id, { ...patch, orig: blk.pic?.orig ?? blk.src }, false, src);
}

/** A file name for the changed picture, from the old one. */
function changedName(blk: { src?: string } | undefined, suffix: string, ext: string): string {
  const base = (blk?.src ?? 'picture').replace(/^.*\//, '').replace(/^[a-z0-9]{7}-/, '').replace(/\.[a-z0-9]+$/i, '') || 'picture';
  return `${base}-${suffix}.${ext}`;
}

/** A small window round one of the picture tools. */
function ToolDialog({ title, onClose, onSubmit, busy, children, ok = 'OK' }: { title: string; onClose(): void; onSubmit(): void; busy?: boolean; children: React.ReactNode; ok?: string }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="dialog para-dialog pic-format"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <header className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </header>
        <div className="settings">
          {children}
          <div className="para-foot">
            <span className="grow" />
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {ok}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** Word's Remove Background: a plain background round the picture taken away, how much by a slider, with a preview. */
function BackgroundDialog({ editor, id, onClose }: { editor: Editor; id: string; onClose(): void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [amount, setAmount] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    loadPicture(shownSrc(editor, id)).then(setImg, (e: Error) => setError(e.message));
  }, [editor, id]);
  useEffect(() => {
    if (!img || !box.current) return;
    try {
      const c = backgroundPreview(img, amount);
      c.setAttribute('aria-label', 'Preview');
      box.current.replaceChildren(c);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [img, amount]);
  const apply = async () => {
    if (!img) return;
    setBusy(true);
    try {
      const blob = await withoutBackground(img, amount);
      await replaceFile(editor, id, blob, changedName(editor.state.doc.blocks.find((b) => b.id === id), 'cut-out', 'png'));
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <ToolDialog title="Remove background" onClose={onClose} onSubmit={() => void apply()} busy={busy || !img || !!error} ok="Remove background">
      <p className="sync-hint">Takes away the colour round the picture’s edges and what joins it. Best for a plain background; Reset picture brings the original back.</p>
      <div className="pic-preview pic-preview-big" ref={box} />
      <label className="field pic-slider">
        <span>How much · {amount}</span>
        <input className="range" type="range" min={0} max={100} step={1} value={amount} aria-label="How much of the background" style={{ '--pct': `${amount}%` } as React.CSSProperties} onChange={(e) => setAmount(Number(e.target.value))} />
      </label>
      {error && (
        <p className="sync-hint goto-error" role="status">
          {error}
        </p>
      )}
    </ToolDialog>
  );
}

const RESOLUTIONS: [number, string][] = [
  [220, 'Print (220 ppi): good for printing'],
  [150, 'Web (150 ppi): good for screens'],
  [96, 'Email (96 ppi): the smallest file'],
];

/** Word's Compress Pictures: fewer pixels for how big it's shown, and cropped parts thrown away. */
function CompressDialog({ editor, id, onClose }: { editor: Editor; id: string; onClose(): void }) {
  const blk = editor.state.doc.blocks.find((b) => b.id === id);
  const [ppi, setPpi] = useState(150);
  const [dropCrop, setDropCrop] = useState(true);
  const [size, setSize] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const src = shownSrc(editor, id);
  useEffect(() => {
    fetch(src).then((r) => r.blob()).then((b) => setSize(b.size), () => setSize(null));
  }, [src]);
  const apply = async () => {
    setBusy(true);
    try {
      const img = await loadPicture(src);
      const el = editor.view.blockElement(id)?.querySelector<HTMLElement>('.pic-crop');
      const shown = blk?.pic?.w ?? (el ? el.getBoundingClientRect().width / 96 : img.naturalWidth / 96);
      const crop = dropCrop ? blk?.pic?.crop : undefined;
      const done = await compressPicture(img, { ppi, widthIn: shown, crop, size: size ?? Infinity });
      if (!done) {
        setResult('It’s already as small as that makes it.');
        setBusy(false);
        return;
      }
      await replaceFile(editor, id, done.blob, changedName(blk, 'small', done.blob.type === 'image/png' ? 'png' : 'jpg'), crop ? { crop: undefined } : {});
      onClose();
    } catch (e) {
      setResult((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <ToolDialog title="Compress picture" onClose={onClose} onSubmit={() => void apply()} busy={busy} ok="Compress">
      <p className="sync-hint">{size !== null ? `The file is ${fileSize(size)} now. ` : ''}Compressing keeps as many pixels as it needs for how big it’s shown; Reset picture brings the original back.</p>
      <fieldset>
        <legend>Resolution</legend>
        {RESOLUTIONS.map(([n, label]) => (
          <label key={n} className="check-row">
            <input type="radio" name="pic-ppi" checked={ppi === n} onChange={() => setPpi(n)} /> {label}
          </label>
        ))}
      </fieldset>
      {blk?.pic?.crop && (
        <label className="check-row">
          <input type="checkbox" checked={dropCrop} onChange={(e) => setDropCrop(e.target.checked)} /> Throw away the cropped parts
        </label>
      )}
      {result && (
        <p className="sync-hint goto-error" role="status">
          {result}
        </p>
      )}
    </ToolDialog>
  );
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
