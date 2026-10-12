// The app's part of a picture's menu (the rest is in the editor): Alt text
// opens a box to describe the picture; Change picture opens the file chooser
// and puts the new picture in the old one's place, keeping its size and look.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { addFile } from '../data/files';
import { IconClose } from './icons';

const OPEN = 'crumpet-picture-alt';

/** Lets an editor's pictures ask for alt text and a new picture. */
export function usePictureActions(editor: Editor | null): void {
  useEffect(() => {
    if (!editor) return;
    editor.onPictureAction = (id, action) => {
      if (action === 'alt') window.dispatchEvent(new CustomEvent(OPEN, { detail: { editor, id } }));
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
  const [open, setOpen] = useState<{ editor: Editor; id: string } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setOpen((e as CustomEvent<{ editor: Editor; id: string }>).detail);
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  return open ? <AltDialog {...open} onClose={() => setOpen(null)} /> : null;
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
