import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { Doc } from '@crumpet/editor/model';
import { FormatTools, LinkBar, SelectionBar, useDocEditor } from './editing';
import { useAppState, useAppStore, useMedia } from './hooks';
import { type PageSetup, type StyleSheet, defaultPage } from '../data/styles';
import { type PageFields, type PagePlacement, PageView } from './pages';
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
  /** Headers and footers: saving changes, what their fields show, and where these pages sit. */
  onPage?(p: PageSetup): void;
  pageFields?: PageFields;
  pagePlace?: PagePlacement;
  chapters?: boolean;
  onPages?(n: number): void;
}

/** One document with its toolbar: our editor engine, mounted once and re-loaded when a different document opens. */
export function EditorHost({ docId, doc, onDoc, readOnly, lead, trail, header, footer, reading = false, label = 'Note text', sheet, onEditStyles, page = null, onEditor, onPage, pageFields, pagePlace, chapters, onPages }: Props) {
  const store = useAppStore();
  const state = useAppState();
  const narrow = useMedia('(max-width: 759px)');
  const [linkOpen, setLinkOpen] = useState(false);
  // The formatting bar floats above selected text, unless pinned (phones keep it in place).
  const floating = !narrow && !readOnly && !reading && (state.focusMode || state.settings.toolbar !== 'always');
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
        {!floating && <FormatTools editor={ed} readOnly={readOnly} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={onEditStyles} />}
        <span className="grow" />
        {!narrow && !readOnly && !reading && (
          <button
            type="button"
            className={`icon-btn pin-tools${floating ? '' : ' on'}`}
            aria-pressed={!floating}
            aria-label="Formatting bar"
            title={floating ? 'Show the formatting bar (it also appears when you select text)' : 'Hide the formatting bar until you select text'}
            onClick={() => store.updateSettings({ toolbar: floating ? 'always' : 'selection' })}
          >
            Aa
          </button>
        )}
        {trail}
      </div>
      {floating && ed && (
        <SelectionBar host={host}>
          <FormatTools compact editor={ed} readOnly={readOnly} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={onEditStyles} />
        </SelectionBar>
      )}
      {linkOpen && ed && <LinkBar editor={ed} onClose={() => setLinkOpen(false)} />}
      <div className="note-scroll">
        <article className={`note-body${paged ? ' paged' : ''}`}>
          {header}
          <PageView enabled={paged} editor={ed} page={page ?? defaultPage()} sheetClass={styles} onPage={onPage} fields={pageFields} place={pagePlace} chapters={chapters} onPages={onPages}>
            <div ref={host} className="note-editor" aria-label={label} />
          </PageView>
          {footer}
        </article>
      </div>
    </div>
  );
}
