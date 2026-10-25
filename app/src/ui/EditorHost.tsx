import { useOfferHelped } from './helpers';
import { MathBlockBar, MathCard } from './mathtools';
import { FormCard } from './formtools';
import { InkHost } from './inktools';
import { ProtectBanner } from './protecttools';
import { useEffect, useMemo, useRef, useState } from 'react';
import { noteLinkTitle } from '@crumpet/editor/markdown';
import type { Editor } from '@crumpet/editor/editor';
import type { Doc } from '@crumpet/editor/model';
import { FormatTools, KeyboardBar, LinkBar, SelectionBar, useDocEditor } from './editing';
import { useAppState, useAppStore, useMedia, useNav } from './hooks';
import { findByTitle } from '../data/links';
import { type PageSetup, type StyleKey, type StyleSheet, defaultPage } from '../data/styles';
import { type PageFields, type PagePlacement, PageView } from './pages';
import { useSheetClass } from './styles-ui';
import { SlashMenu } from './slash';
import { EndnoteList, FootnoteCard, FootnoteList } from './footnotes';
import { CommentCard, CommentList } from './comments';
import { ChangeCard, ChangesBar, RevisionChip, TrackToggle, useTracking } from './changes';
import { useTypewriter } from './typewriter';
import { useDocFontsLoaded, useFontKeys } from './fonttools';
import { useParaKeys } from './paratools';
import { StatusBar } from './statusbar';

interface Props {
  /** The document shown (a note or a chapter) and where its edits go. */
  docId: string;
  /** Which text is loaded, when that can change without `docId` changing (a chapter's drafts). */
  loadKey?: string;
  doc: Doc;
  onDoc(doc: Doc): void;
  readOnly: boolean;
  /** Toolbar slot rendered before the formatting buttons (e.g. a back button). */
  lead?: React.ReactNode;
  /** Toolbar slot rendered after them (star, more menu). */
  trail?: React.ReactNode;
  /** The tools float over selected text (the calm look's writing room), whatever the setting. */
  floatTools?: boolean;
  /** Rendered above the body (title, notebook, tags). */
  header: React.ReactNode;
  footer: React.ReactNode;
  /** Reading view: a book-like page without editing tools. */
  reading?: boolean;
  /** Accessible name of the text area. */
  label?: string;
  /** The named styles the document uses, and opening the window to change them. */
  sheet: StyleSheet;
  onEditStyles?(key?: string): void;
  /** Changing the style sheet (the Styles pane's Update to Match). */
  onSheet?(s: StyleSheet): void;
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
export function EditorHost({ docId, loadKey, doc, onDoc, readOnly: readOnlyProp, lead, trail, floatTools = false, header, footer, reading = false, label = 'Note text', sheet, onEditStyles, onSheet, page = null, onEditor, onPage, pageFields, pagePlace, chapters, onPages }: Props) {
  const store = useAppStore();
  const state = useAppState();
  // Marked as final, or editing restricted (Word's Protect Document): read only, but comments still allowed when only comments are.
  const p0 = doc.blocks[0]?.para;
  const prot = readOnlyProp ? undefined : p0?.final ? 'final' : p0?.restrict;
  const readOnly = !!readOnlyProp || !!prot;
  const commenting = prot === 'comments';
  const formsOnly = prot === 'forms';
  const narrow = useMedia('(max-width: 759px)');
  const nav = useNav();
  const [linkOpen, setLinkOpen] = useState(false);
  // The formatting bar floats above selected text, unless pinned (phones keep it in place).
  // The calm look keeps them on show at the top unless asked to float them; the full bar floats unless pinned.
  const calm = !state.settings.toolbarAll;
  // A touch screen big enough for the computer layout (an iPad, design 14): the tools float in a
  // small bar at the foot of the page, the same few as above a phone's keyboard.
  const touch = useMedia('(pointer: coarse)');
  const tablet = calm && touch && !narrow && !readOnly && !reading;
  const floating = !tablet && !narrow && !readOnly && !reading && (state.focusMode || floatTools || (calm ? state.settings.toolbar === 'selection' : state.settings.toolbar !== 'always'));
  const styles = useSheetClass(sheet);
  const paged = !!page && !reading;
  const { host, editor: ed } = useDocEditor({
    docId: loadKey ?? docId,
    doc,
    readOnly,
    onDoc,
    onSwitch: () => {
      store.flush();
      setLinkOpen(false);
    },
    onReady: onEditor,
    onLinkKey: () => setLinkOpen(true),
    onNoteLink: (title) => nav.openTitle(title),
  });

  // A tap or click in the empty space below the writing carries on at its end, as in a notebook (and brings up a phone's keyboard).
  // Only when it was pressed there too: a click inside the text can end up on the page when the text redraws under it (a table's cell).
  const pressedBelow = useRef(false);
  const below = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    return !!ed && !readOnly && !reading && !paged && t.matches('.note-main, .note-scroll, .note-body') && e.clientY > ed.view.root.getBoundingClientRect().bottom;
  };
  const carryOn = (e: React.MouseEvent) => {
    const go = pressedBelow.current && below(e) && !!document.getSelection()?.isCollapsed;
    pressedBelow.current = false;
    if (go) ed?.focusAt('end');
  };

  // The right sidebar's helpers work on this editor once it's clicked or typed in.
  const paneRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onSheet, onEditStyles });
  callbacks.current = { onSheet, onEditStyles };
  const helped = useMemo(
    () => (ed && !readOnly && !reading ? { editor: ed, docId, sheet, onSheet: onSheet && ((s: StyleSheet) => callbacks.current.onSheet?.(s)), onEditStyles: onEditStyles && ((k?: StyleKey) => callbacks.current.onEditStyles?.(k)) } : null),
    [ed, docId, sheet, readOnly, reading, !!onSheet, !!onEditStyles], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useOfferHelped(helped, paneRef);

  useTracking(readOnly || reading ? null : ed);
  // Fields the app fills in: the title, author and dates.
  const author = state.settings.name;
  // Restrict editing → Filling in forms: the form controls stay usable.
  useEffect(() => {
    if (ed) ed.formsOnly = formsOnly;
  }, [ed, formsOnly]);
  useEffect(() => {
    if (!ed) return;
    const day = (t?: number) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '');
    ed.setFieldValues((name) => (name === 'title' ? (pageFields?.title ?? '') : name === 'author' ? author || '' : name === 'created' ? day(pageFields?.created) : name === 'saved' ? day(pageFields?.updated) : null));
  }, [ed, pageFields?.title, pageFields?.created, pageFields?.updated, author]);
  useFontKeys(readOnly || reading ? null : ed, sheet);
  useDocFontsLoaded(ed);
  useParaKeys(readOnly || reading ? null : ed);
  const scrollBox = useRef<HTMLDivElement>(null);
  const statusEditors = useMemo(() => (ed ? [ed] : []), [ed]);
  useTypewriter(readOnly || reading ? null : ed);
  // While typing, the bar above the note fades away; moving the pointer brings it back.
  useEffect(() => {
    const pane = paneRef.current;
    const el = host.current;
    // Only with a mouse or trackpad: on a touch screen nothing would bring it back.
    if (!pane || !el || readOnly || reading || !window.matchMedia?.('(pointer: fine)').matches) return;
    const typing = (e: KeyboardEvent) => {
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) pane.classList.add('typing');
    };
    const awake = () => pane.classList.remove('typing');
    el.addEventListener('keydown', typing);
    window.addEventListener('pointermove', awake);
    return () => {
      el.removeEventListener('keydown', typing);
      window.removeEventListener('pointermove', awake);
      awake();
    };
  }, [readOnly, reading]);

  // Links to notes that don't exist (yet) look different; clicking one makes the note.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    for (const a of el.querySelectorAll<HTMLAnchorElement>('a[href^="note:"]')) {
      const title = noteLinkTitle(a.getAttribute('href') ?? '');
      const there = !!findByTitle(state.notes, title);
      a.classList.toggle('missing-note', !there);
      a.title = there ? `Open “${title}”` : `“${title}” doesn’t exist yet: click to make it`;
    }
  });

  return (
    <div ref={paneRef} className={`note-pane ${styles}${reading ? ' reading' : ''}${floatTools ? ' room' : ''}`}>
      <div className="note-toolbar" role="toolbar" aria-label="Formatting">
        {lead}
        {!floating && !narrow && !tablet && <FormatTools fit menus={paged} editor={ed} readOnly={readOnly} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={onEditStyles} page={page} onPage={onPage} chapters={chapters} />}
        <span className="grow" />
        {!readOnly && !reading && <RevisionChip />}
        {!readOnly && !reading && <TrackToggle editor={ed} />}
        {!narrow && !readOnly && !reading && !calm && (
          <button
            type="button"
            className={`icon-btn pin-tools${floating ? '' : ' on'}`}
            aria-pressed={!floating}
            aria-label="Formatting bar"
            data-tip={floating ? 'Show the formatting bar' : 'Hide the formatting bar'}
            onClick={() => store.updateSettings({ toolbar: floating ? 'always' : 'selection' })}
          >
            Aa
          </button>
        )}
        {trail}
      </div>
      {tablet && ed && (
        <div className="float-tools" role="toolbar" aria-label="Formatting" onMouseDown={(e) => e.preventDefault()}>
          <FormatTools compact keyboard tablet editor={ed} readOnly={readOnly} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={onEditStyles} page={page} onPage={onPage} chapters={chapters} />
        </div>
      )}
      {narrow && ed && !readOnly && !reading && (
        <KeyboardBar host={host}>
          <FormatTools compact keyboard editor={ed} readOnly={readOnly} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={onEditStyles} page={page} onPage={onPage} chapters={chapters} />
        </KeyboardBar>
      )}
      {!readOnly && !reading && <SlashMenu editor={ed} host={host} notes={state.notes} />}
      {!readOnly && !reading && <MathCard editor={ed} />}
      {!readOnly && !reading && <InkHost editor={ed} />}
      {(!readOnly || prot === 'forms') && !reading && <FormCard editor={ed} design={!readOnly} />}
      {!readOnly && !reading && <MathBlockBar host={host} />}
      {floating && ed && (
        <SelectionBar host={host}>
          <FormatTools compact attach={false} editor={ed} readOnly={readOnly} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={onEditStyles} page={page} onPage={onPage} chapters={chapters} />
        </SelectionBar>
      )}
      {!readOnly && !reading && <FootnoteCard editor={ed} />}
      {(!readOnly || commenting) && !reading && <CommentCard editor={ed} />}
      {!readOnly && !reading && <ChangeCard editor={ed} />}
      {linkOpen && ed && <LinkBar editor={ed} onClose={() => setLinkOpen(false)} />}
      {!readOnly && !reading && <ChangesBar doc={doc} editor={ed} />}
      {prot && ed && !reading && <ProtectBanner editor={ed} kind={prot} lock={p0?.plock} />}
      <div className="note-main" onMouseDown={(e) => (pressedBelow.current = below(e))} onClick={carryOn}>
      <div className="note-scroll" ref={scrollBox}>
        <article className={`note-body${paged ? ' paged' : ''}`}>
          {header}
          <PageView enabled={paged} editor={ed} page={page ?? defaultPage()} sheetClass={styles} onPage={onPage} fields={pageFields} place={pagePlace} chapters={chapters} onPages={onPages} sheet={sheet}>
            <div ref={host} className="note-editor" aria-label={label} />
          </PageView>
          {!paged && <FootnoteList doc={doc} editor={readOnly || reading ? null : ed} />}
          <EndnoteList doc={doc} editor={readOnly || reading ? null : ed} />
          {!reading && <CommentList doc={doc} editor={readOnly && !commenting ? null : ed} />}
          {footer}
        </article>
      </div>
      </div>
      {paged && ed && !reading && <StatusBar editors={statusEditors} scroller={scrollBox} pageOffset={pagePlace?.offset ?? 0} pageTotal={pagePlace?.total} />}
    </div>
  );
}
