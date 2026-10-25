// Exporting a book: one window with the three usual ways out (a manuscript for
// Word, an e-book, a PDF), the other formats, what's included, and a little
// picture of the first page. The project itself isn't changed.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '../data/types';
import type { AppState } from '../data/store';
import { useAppStore } from './hooks';
import { blockText, chapterWords, numberInWords, projectChapters } from '../data/selectors';
import { type BookOptions, DOCX_TYPE, EPUB_TYPE, docxName, download, exportAs, fileName, projectDocx, projectEpub, projectParts } from '../data/wordfiles';
import { IconClose } from './icons';
import { BOOK_FONTS, type BookDesign, type BookFont, DEFAULT_DESIGN, HEADING_DESIGNS, OUTSIDE, SCENE_BREAKS, type SceneBreak, TRIMS, type TrimSize, estimatePages, insideMargin, trimOf } from '../data/bookdesign';
import { loadGoogleFont } from './fonts';

type Way = 'docx' | 'epub' | 'pdf' | 'book' | 'odt' | 'rtf' | 'html' | 'txt';

const WAYS: { id: Way; badge: string; name: string; hint: string; action: string }[] = [
  { id: 'docx', badge: 'DOCX', name: 'Manuscript for Word', hint: 'In your manuscript format, with page numbers and headers.', action: 'Download as Word document' },
  { id: 'epub', badge: 'EPUB', name: 'E-book', hint: 'For Apple Books, Kobo and Kindle, with a contents page.', action: 'Download as e-book (ePub)' },
  { id: 'pdf', badge: 'PDF', name: 'PDF to print or share', hint: 'Laid out as page view shows it.', action: 'Print or save as PDF' },
  { id: 'book', badge: 'BOOK', name: 'Print-ready book', hint: 'A paperback’s pages for Amazon KDP, IngramSpark or a printer.', action: 'Make a print-ready PDF' },
];
const OTHERS: { id: Way; name: string }[] = [
  { id: 'odt', name: 'OpenDocument (LibreOffice)' },
  { id: 'rtf', name: 'Rich Text' },
  { id: 'html', name: 'Web page' },
  { id: 'txt', name: 'Plain text' },
];


/** The state as the export sees it: without the chapters marked To do, if asked. */
function exportState(state: AppState, skipTodo: boolean): AppState {
  return skipTodo ? { ...state, chapters: state.chapters.filter((c) => c.status !== 'todo') } : state;
}

export function ExportBook({ project, onClose, onPrint }: { project: Project; onClose(): void; onPrint(skipTodo: boolean, opts: BookOptions, design?: BookDesign): void }) {
  const store = useAppStore();
  const [way, setWay] = useState<Way>('docx');
  const [skipTodo, setSkipTodo] = useState(false);
  // The design's Included: a title page and part pages on, comments and tracked changes left out.
  const [opts, setOpts] = useState<BookOptions>({ titlePage: true, partHeadings: true, notes: false });
  const [more, setMore] = useState(false);
  const hasParts = project.outline.some((x) => x.type === 'part');
  const [busy, setBusy] = useState(false);
  const state = exportState(store.getState(), skipTodo);
  const list = projectChapters(project, state.chapters);
  const words = list.reduce((n, x) => n + chapterWords(x.chapter), 0);
  const todo = projectChapters(project, store.getState().chapters).filter((x) => x.chapter.status === 'todo').length;
  const first = list[0];
  const author = (state.settings.name || '').trim();
  const action = WAYS.find((w) => w.id === way)?.action ?? `Download as ${OTHERS.find((o) => o.id === way)?.name}`;
  // A print-ready book's design, kept with the book.
  const [design, setDesign] = useState<BookDesign>(project.design ?? DEFAULT_DESIGN);
  const change = (patch: Partial<BookDesign>) => {
    const next = { ...design, ...patch };
    setDesign(next);
    store.setBookDesign(project.id, next);
  };
  const trim = trimOf(design);
  const pages = estimatePages(words, design) + list.length;
  useEffect(() => {
    if (way === 'book') loadGoogleFont(design.font, 1 | 2 | 4);
  }, [way, design.font]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const go = async () => {
    if (way === 'pdf' || way === 'book') {
      onClose();
      onPrint(skipTodo, opts, way === 'book' ? design : undefined);
      return;
    }
    setBusy(true);
    try {
      if (way === 'docx') download(await projectDocx(state, project, opts), docxName(project.name), DOCX_TYPE);
      else if (way === 'epub') download(await projectEpub(state, project, opts), fileName(project.name, 'epub'), EPUB_TYPE);
      else await exportAs(way, project.name, projectParts(state, project, opts));
    } finally {
      setBusy(false);
    }
    onClose();
  };

  // At the top of the page: a frosted panel around the button that opened it would hold it inside.
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog export-book" role="dialog" aria-modal="true" aria-label={`Export ${project.name}`}>
        <div className="export-main">
          <header className="dialog-head">
            <h2>Export {project.name || 'the book'}</h2>
            <button type="button" className="icon-btn" aria-label="Close export" onClick={onClose}>
              <IconClose size={16} />
            </button>
          </header>
          <p className="export-sum">
            {list.length} {list.length === 1 ? 'chapter' : 'chapters'} · {words.toLocaleString()} words. Your project isn’t changed.
          </p>
          <div className="export-ways" role="radiogroup" aria-label="Export as">
            {WAYS.map((w) => (
              <button key={w.id} type="button" role="radio" aria-checked={way === w.id} className="export-way" onClick={() => setWay(w.id)}>
                <span className="export-badge" aria-hidden="true">
                  {w.badge}
                </span>
                <span>
                  <b>{w.name}</b>
                  <small>{w.hint}</small>
                </span>
              </button>
            ))}
            <label className="export-other">
              <span>Another format</span>
              <select value={OTHERS.some((o) => o.id === way) ? way : ''} onChange={(e) => e.target.value && setWay(e.target.value as Way)}>
                <option value="">Choose…</option>
                {OTHERS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} (.{o.id})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {way === 'book' && (
            <div className="book-design-form" role="group" aria-label="Book design">
              <p className="menu-label">Book design</p>
              <label className="export-other">
                <span>Trim size</span>
                <select aria-label="Trim size" value={design.trim} onChange={(e) => change({ trim: e.target.value as TrimSize })}>
                  {TRIMS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.hint}
                    </option>
                  ))}
                </select>
              </label>
              <label className="export-other">
                <span>Typeface</span>
                <select aria-label="Typeface" value={design.font} onChange={(e) => change({ font: e.target.value as BookFont })}>
                  {BOOK_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.id} · {f.hint}
                    </option>
                  ))}
                </select>
              </label>
              <div className="export-other">
                <span>Chapters</span>
                <div className="segmented" role="radiogroup" aria-label="Chapter openings">
                  {HEADING_DESIGNS.map((h) => (
                    <button key={h.id} type="button" role="radio" aria-checked={design.headings === h.id} title={h.hint} onClick={() => change({ headings: h.id })}>
                      {h.name}
                    </button>
                  ))}
                </div>
              </div>
              <label className="export-other">
                <span>Scene breaks</span>
                <select aria-label="Scene breaks" value={design.sceneBreak} onChange={(e) => change({ sceneBreak: e.target.value as SceneBreak })}>
                  {SCENE_BREAKS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={design.dropCaps} onChange={(e) => change({ dropCaps: e.target.checked })} />
                A drop cap to open each chapter
              </label>
              <label className="check-row">
                <input type="checkbox" checked={design.recto} onChange={(e) => change({ recto: e.target.checked })} />
                Chapters start on a right-hand page
              </label>
              <p className="export-more-note">
                {trim.name} pages, about {pages.toLocaleString()} of them: {insideMargin(pages)} in at the spine, {OUTSIDE} in at the outside edge; your name over left-hand pages and the title over right-hand ones. Scene breaks are lines of {'*\u00a0*\u00a0*'} (or the Scene Break style). In the print window, choose Save as PDF: that’s the interior file to upload (on KDP, Paperback content → Manuscript, with the same trim size).
              </p>
            </div>
          )}
          <p className="menu-label">Included</p>
          <label className="check-row">
            <input type="checkbox" checked={way !== 'epub' && !!opts.titlePage} disabled={way === 'epub'} onChange={(e) => setOpts({ ...opts, titlePage: e.target.checked })} />
            Title page{way === 'epub' ? ' (an e-book always has one)' : ''}
          </label>
          <label className="check-row">
            <input type="checkbox" checked={hasParts && !!opts.partHeadings} disabled={!hasParts} onChange={(e) => setOpts({ ...opts, partHeadings: e.target.checked })} />
            Part headings{hasParts ? '' : ' (no parts)'}
          </label>
          <label className="check-row">
            <input type="checkbox" checked={!skipTodo} disabled={!todo} onChange={(e) => setSkipTodo(!e.target.checked)} />
            Chapters marked To do{todo ? ` (${todo})` : ' (none)'}
          </label>
          <label className="check-row">
            <input type="checkbox" checked={!!opts.notes} onChange={(e) => setOpts({ ...opts, notes: e.target.checked })} />
            Comments and tracked changes
          </label>
          <button type="button" className="link-btn export-more" aria-expanded={more} onClick={() => setMore(!more)}>
            More options: fonts, paper size, scene breaks
          </button>
          {more && (
            <p className="export-more-note">
              The manuscript follows the book’s own format. To change it, open a chapter and use Page setup (paper size, margins, headers and page numbers) and the paragraph styles (fonts, and the Scene break style) from the formatting bar’s More.
            </p>
          )}
          <footer className="export-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn primary" aria-label={action} disabled={busy || !list.length} onClick={go}>
              {way === 'pdf' ? 'Print or save as PDF…' : way === 'book' ? 'Make the PDF…' : `Export .${way}`}
            </button>
          </footer>
        </div>
        <aside className="export-preview" aria-label="Preview of page 1">
          {way === 'book' && first ? (
            <div className={`export-page book-page ${design.headings}`} aria-hidden="true" style={{ aspectRatio: `${trim.w} / ${trim.h}`, fontFamily: `'${design.font}', Georgia, serif` }}>
              {design.headings !== 'simple' && <div className="bp-num">{design.headings === 'classic' ? `Chapter ${numberInWords(first.number)}` : first.number}</div>}
              {first.chapter.title.trim() && first.chapter.title.trim() !== `Chapter ${first.number}` && <div className="bp-title">{first.chapter.title}</div>}
              <p className={design.dropCaps ? 'bp-drop' : undefined}>{first.chapter.doc.blocks.map(blockText).join(' ').slice(0, 520) || 'The first lines of the chapter.'}</p>
            </div>
          ) : (
          <div className="export-page" aria-hidden="true">
            <div className="export-page-head">{[author.split(/\s+/).pop(), (project.name || 'Untitled').toUpperCase(), '1'].filter(Boolean).join(' / ')}</div>
            {opts.titlePage && way !== 'epub' && first ? (
              <div className="export-page-cover">
                <b>{project.name || 'Untitled'}</b>
                {author && <span>by {author}</span>}
                <span>About {(words >= 1000 ? Math.round(words / 1000) * 1000 : Math.max(100, Math.round(words / 100) * 100)).toLocaleString('en-GB')} words</span>
              </div>
            ) : first ? (
              <>
                <div className="export-page-title">
                  Chapter {numberInWords(first.number)}
                  <br />
                  {first.chapter.title}
                </div>
                <p>{first.chapter.doc.blocks.map(blockText).join(' ').slice(0, 420)}</p>
              </>
            ) : (
              <p>No chapters to export.</p>
            )}
          </div>
          )}
          <small>{way === 'book' ? `A chapter’s first page, ${trim.name}` : 'Page 1'}</small>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
