import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { Doc } from '@crumpet/editor/model';
import { FormatTools, LinkBar, useDocEditor } from './editing';
import { useAppStore } from './hooks';

interface Props {
  /** The document shown (a note or a chapter) and where its edits go. */
  docId: string;
  doc: Doc;
  onDoc(doc: Doc): void;
  readOnly: boolean;
  /** Toolbar slot rendered before the formatting buttons (e.g. a back button). */
  lead?: React.ReactNode;
  /** Toolbar slot rendered after them (star, more menu). */
  trail?: React.ReactNode;
  /** Rendered above the body (title, notebook, tags). */
  header: React.ReactNode;
  footer: React.ReactNode;
  /** Reading view: a book-like page without editing tools. */
  reading?: boolean;
  /** Accessible name of the text area. */
  label?: string;
  onEditor?(editor: Editor | null): void;
}

/** One document with its toolbar: our editor engine, mounted once and re-loaded when a different document opens. */
export function EditorHost({ docId, doc, onDoc, readOnly, lead, trail, header, footer, reading = false, label = 'Note text', onEditor }: Props) {
  const store = useAppStore();
  const [linkOpen, setLinkOpen] = useState(false);
  const { host, editor: ed } = useDocEditor({
    docId,
    doc,
    readOnly,
    onDoc,
    onSwitch: () => {
      store.flush();
      setLinkOpen(false);
    },
    onReady: onEditor,
    onLinkKey: () => setLinkOpen(true),
  });

  return (
    <div className={`note-pane${reading ? ' reading' : ''}`}>
      <div className="note-toolbar" role="toolbar" aria-label="Formatting">
        {lead}
        <FormatTools editor={ed} readOnly={readOnly} onLink={() => setLinkOpen(true)} />
        <span className="grow" />
        {trail}
      </div>
      {linkOpen && ed && <LinkBar editor={ed} onClose={() => setLinkOpen(false)} />}
      <div className="note-scroll">
        <article className="note-body">
          {header}
          <div ref={host} className="note-editor" aria-label={label} />
          {footer}
        </article>
      </div>
    </div>
  );
}
