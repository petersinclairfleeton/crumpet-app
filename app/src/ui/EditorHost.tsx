import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { Doc } from '@crumpet/editor/model';
import { FormatTools, LinkBar, useDocEditor } from './editing';
import { useAppStore } from './hooks';
import { type PageSetup, type StyleSheet, defaultPage } from '../data/styles';
import { PageView } from './pages';
import { useSheetClass } from './styles-ui';

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
  /** The named styles the document uses, and opening the window to change them. */
  sheet: StyleSheet;
  onEditStyles?(): void;
  /** Page view: the page setup to lay the text out on, or null for one long page. */
  page?: PageSetup | null;
  onEditor?(editor: Editor | null): void;
}

/** One document with its toolbar: our editor engine, mounted once and re-loaded when a different document opens. */
export function EditorHost({ docId, doc, onDoc, readOnly, lead, trail, header, footer, reading = false, label = 'Note text', sheet, onEditStyles, page = null, onEditor }: Props) {
  const store = useAppStore();
  const [linkOpen, setLinkOpen] = useState(false);
  const styles = useSheetClass(sheet);
  const paged = !!page && !reading;
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
    <div className={`note-pane ${styles}${reading ? ' reading' : ''}`}>
      <div className="note-toolbar" role="toolbar" aria-label="Formatting">
        {lead}
        <FormatTools editor={ed} readOnly={readOnly} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={onEditStyles} />
        <span className="grow" />
        {trail}
      </div>
      {linkOpen && ed && <LinkBar editor={ed} onClose={() => setLinkOpen(false)} />}
      <div className="note-scroll">
        <article className={`note-body${paged ? ' paged' : ''}`}>
          {header}
          <PageView enabled={paged} editor={ed} page={page ?? defaultPage()} sheetClass={styles}>
            <div ref={host} className="note-editor" aria-label={label} />
          </PageView>
          {footer}
        </article>
      </div>
    </div>
  );
}
