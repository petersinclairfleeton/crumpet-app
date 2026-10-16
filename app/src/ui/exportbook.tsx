// Exporting a book: one window with the three usual ways out (a manuscript for
// Word, an e-book, a PDF), the other formats, what's included, and a little
// picture of the first page. The project itself isn't changed.

import { useEffect, useState } from 'react';
import type { Project } from '../data/types';
import type { AppState } from '../data/store';
import { useAppStore } from './hooks';
import { blockText, chapterWords, projectChapters } from '../data/selectors';
import { DOCX_TYPE, EPUB_TYPE, docxName, download, exportAs, fileName, projectDocx, projectEpub, projectParts } from '../data/wordfiles';
import { IconClose } from './icons';

type Way = 'docx' | 'epub' | 'pdf' | 'odt' | 'rtf' | 'html' | 'txt';

const WAYS: { id: Way; badge: string; name: string; hint: string; action: string }[] = [
  { id: 'docx', badge: 'DOCX', name: 'Manuscript for Word', hint: 'In your manuscript format, with page numbers and headers.', action: 'Download as Word document' },
  { id: 'epub', badge: 'EPUB', name: 'E-book', hint: 'For Apple Books, Kobo and Kindle, with a contents page.', action: 'Download as e-book (ePub)' },
  { id: 'pdf', badge: 'PDF', name: 'PDF to print or share', hint: 'Laid out as page view shows it.', action: 'Print or save as PDF' },
];
const OTHERS: { id: Way; name: string }[] = [
  { id: 'odt', name: 'OpenDocument (LibreOffice)' },
  { id: 'rtf', name: 'Rich Text' },
  { id: 'html', name: 'Web page' },
  { id: 'txt', name: 'Plain text' },
];

const NUMBERS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const inWords = (n: number) => NUMBERS[n] ?? String(n);

/** The state as the export sees it: without the chapters marked To do, if asked. */
function exportState(state: AppState, skipTodo: boolean): AppState {
  return skipTodo ? { ...state, chapters: state.chapters.filter((c) => c.status !== 'todo') } : state;
}

export function ExportBook({ project, onClose, onPrint }: { project: Project; onClose(): void; onPrint(skipTodo: boolean): void }) {
  const store = useAppStore();
  const [way, setWay] = useState<Way>('docx');
  const [skipTodo, setSkipTodo] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = exportState(store.getState(), skipTodo);
  const list = projectChapters(project, state.chapters);
  const words = list.reduce((n, x) => n + chapterWords(x.chapter), 0);
  const todo = projectChapters(project, store.getState().chapters).filter((x) => x.chapter.status === 'todo').length;
  const first = list[0];
  const author = (state.settings.name || '').trim();
  const action = WAYS.find((w) => w.id === way)?.action ?? `Download as ${OTHERS.find((o) => o.id === way)?.name}`;

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const go = async () => {
    if (way === 'pdf') {
      onClose();
      onPrint(skipTodo);
      return;
    }
    setBusy(true);
    try {
      if (way === 'docx') download(await projectDocx(state, project), docxName(project.name), DOCX_TYPE);
      else if (way === 'epub') download(await projectEpub(state, project), fileName(project.name, 'epub'), EPUB_TYPE);
      else await exportAs(way, project.name, projectParts(state, project));
    } finally {
      setBusy(false);
    }
    onClose();
  };

  return (
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
          <p className="menu-label">Included</p>
          <label className="check-row">
            <input type="checkbox" checked={!skipTodo} disabled={!todo} onChange={(e) => setSkipTodo(!e.target.checked)} />
            Chapters marked To do{todo ? ` (${todo})` : ' (none)'}
          </label>
          <footer className="export-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn primary" aria-label={action} disabled={busy || !list.length} onClick={go}>
              {way === 'pdf' ? 'Print or save as PDF…' : `Export .${way}`}
            </button>
          </footer>
        </div>
        <aside className="export-preview" aria-label="Preview of page 1">
          <div className="export-page" aria-hidden="true">
            <div className="export-page-head">{[author.split(/\s+/).pop(), (project.name || 'Untitled').toUpperCase(), '1'].filter(Boolean).join(' / ')}</div>
            {first ? (
              <>
                <div className="export-page-title">
                  Chapter {inWords(first.number)}
                  <br />
                  {first.chapter.title}
                </div>
                <p>{first.chapter.doc.blocks.map(blockText).join(' ').slice(0, 420)}</p>
              </>
            ) : (
              <p>No chapters to export.</p>
            )}
          </div>
          <small>Page 1</small>
        </aside>
      </div>
    </div>
  );
}
