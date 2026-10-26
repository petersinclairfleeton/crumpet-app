// A project (a book, an essay, a thesis): its outline of parts and chapters,
// and the writing, one chapter at a time or as one long manuscript.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fullSheet, manuscriptPage } from '../data/styles';
import { chapterPages, rememberPages } from '../data/pagecount';
import { type PageFields, PageToggle, PageView } from './pages';
import { StylesDialog, useSheetClass, useStyleSources } from './styles-ui';
import type { Editor } from '@crumpet/editor/editor';
import { chapterWords, docWords, numberInWords, projectChapters, projectGoal, projectWords } from '../data/selectors';
import { dayKey, wordsToday } from '../data/stats';
import { pace } from '../data/deadline';
import type { Chapter, ChapterStatus, Project } from '../data/types';
import type { PageSetup, StyleSheet } from '../data/styles';
import { useOfferHelped } from './helpers';
import { bookEntries, footnotesBefore, goToLater, useBookToc, useFootnoteStart } from './booktoc';
import type { TocEntry } from '@crumpet/editor/view';
import { EditorHost } from './EditorHost';
import { usePasteTitle } from './pastetitle';
import { FormatTools, KeyboardBar, LinkBar, SelectionBar, isMac, useDocEditor } from './editing';
import { FindBar, useFindKey } from './find';
import { useTypewriter } from './typewriter';
import { useDocFontsLoaded, useFontKeys } from './fonttools';
import { useParaKeys } from './paratools';
import { StatusBar } from './statusbar';
import { useAppState, useAppStore, useAutoHeight, useMedia, useNav } from './hooks';
import { TextSizeRow } from './iphone';
import { IconBack, IconBox, IconChevron, IconRightPanel, IconSidebar, IconFocus, IconMore, IconPeople, IconPlus, IconSearch } from './icons';
import { InlineInput, Popover } from './Sidebar';
import { SlashMenu } from './slash';
import { EndnoteList, FootnoteCard, FootnoteList } from './footnotes';
import { CommentCard, CommentList } from './comments';
import { ChangeCard, ChangesBar, RevisionChip, TrackToggle, useTracking } from './changes';
import { type PrintPart, PrintJob } from './print';
import { type BookOptions, bookParts, finalDoc } from '../data/wordfiles';
import { ExportBook } from './exportbook';
import { type BookDesign, chapterOpening, designDoc, estimatePages, printPage, titlePage } from '../data/bookdesign';
import { ShareDialog } from './share';
import { openSubmissions } from './submissions';
import { ResearchList, ResearchPane } from './research';
import { Corkboard } from './corkboard';
import { PlanView } from './plan';
import { findMember, seriesBooks, seriesLine, seriesNames } from '../data/series';
import { CastList, CastPane, CastSpotting } from './cast';
import { FoldButton } from './fold';
import { startTabDrag } from './tabdrag';
import { KeywordChips, KeywordEditor, KeywordFilter, hasKeyword } from './keywords';
import { type Doc, makeBlock } from '@crumpet/editor/model';
import { chapterDraft, draftDocId, draftInUse } from '../data/drafts';
import { usePanes } from './panes';
import { MenuAtPoint } from './contextmenu';
import { BookDraftForm, BookProgress, DraftBadge, DraftTabs, NewDraftChoices } from './drafts';

export const STATUSES: { id: ChapterStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'draft', label: 'Draft' },
  { id: 'revised', label: 'Revised' },
  { id: 'done', label: 'Done' },
];

/** The right-click menu on a chapter or part in a book's outline. */
function OutlineItemMenu({ project, id, x, y, onOpenChapter, onRenamePart, onClose }: { project: Project; id: string; x: number; y: number; onOpenChapter(id: string): void; onRenamePart(id: string): void; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const panes = usePanes();
  const [renaming, setRenaming] = useState(false);
  const index = project.outline.findIndex((x) => x.id === id);
  const item = project.outline[index];
  if (!item) return null;
  const last = project.outline.length - 1;
  const chapter = item.type === 'chapter' ? state.chapters.find((c) => c.id === id) : undefined;
  const done = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const row = (label: string, fn: () => void, opts: { danger?: boolean; disabled?: boolean } = {}) => (
    <button type="button" role="menuitem" className={`menu-item${opts.danger ? ' danger' : ''}`} disabled={opts.disabled} onClick={done(fn)}>
      {label}
    </button>
  );
  const moves = (
    <>
      {row('Move up', () => store.moveOutlineItem(project.id, id, index - 1), { disabled: index === 0 })}
      {row('Move down', () => store.moveOutlineItem(project.id, id, index + 2), { disabled: index === last })}
    </>
  );
  const title = chapter ? chapter.title || 'Untitled chapter' : item.type === 'part' ? item.title : '';
  return (
    <MenuAtPoint x={x} y={y} label={`${title}: options`} onClose={onClose}>
      {renaming && chapter ? (
        <InlineInput
          label="Chapter title"
          initial={chapter.title}
          placeholder="Chapter title"
          onDone={(t) => {
            if (t !== null && t.trim()) store.setChapterTitle(chapter.id, t.trim());
            onClose();
          }}
        />
      ) : chapter ? (
        <>
          {row('Open', () => onOpenChapter(chapter.id))}
          {row('Open in a new tab', () => panes.open({ kind: 'chapter', id: chapter.id }, 'tab'))}
          {row('Open to the side', () => panes.split({ kind: 'chapter', id: chapter.id }, 'right'))}
          <hr className="menu-rule" />
          <button type="button" role="menuitem" className="menu-item" onClick={() => setRenaming(true)}>
            Rename…
          </button>
          <p className="menu-label">Status</p>
          <div className="menu-status" role="group" aria-label="Status">
            {STATUSES.map((st) => (
              <button key={st.id} type="button" role="menuitemradio" aria-checked={chapter.status === st.id} className={`menu-status-pick${chapter.status === st.id ? ' on' : ''}`} onClick={done(() => store.setChapterStatus(chapter.id, st.id))}>
                <span className={`status-dot ${st.id}`} aria-hidden="true" /> {st.label}
              </button>
            ))}
          </div>
          <hr className="menu-rule" />
          {row('New chapter after this', () => store.addChapter(project.id, chapter.id))}
          {moves}
          <hr className="menu-rule" />
          {row(
            'Delete chapter',
            () => {
              const n = chapterWords(chapter);
              if (n === 0 || confirm(`Delete “${chapter.title || 'Untitled chapter'}” and its ${n.toLocaleString()} ${n === 1 ? 'word' : 'words'}?`)) store.deleteChapter(chapter.id);
            },
            { danger: true },
          )}
        </>
      ) : (
        <>
          {row('Rename part', () => onRenamePart(id))}
          {row('New chapter at the start of this part', () => store.addChapter(project.id, id))}
          {moves}
          <hr className="menu-rule" />
          {row('Remove part (keeps its chapters)', () => store.deletePart(project.id, id), { danger: true })}
        </>
      )}
    </MenuAtPoint>
  );
}

function Progress({ value, goal, label }: { value: number; goal: number | null; label: string }) {
  if (!goal) return null;
  const pct = Math.min(100, Math.round((value / goal) * 100));
  return (
    <span className={`progress${value >= goal ? ' reached' : ''}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={value} title={`${pct}% of ${goal.toLocaleString()} words`}>
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}

const words = (n: number) => `${n.toLocaleString()} word${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------- outline

/** The outline items to show: everything, or with a keyword filter, its chapters and the parts they're in. */
export function shownOutline(project: Project, chapters: Chapter[], word: string | null): Set<string> {
  if (!word) return new Set(project.outline.map((x) => x.id));
  const byId = new Map(chapters.map((c) => [c.id, c]));
  const out = new Set<string>();
  let part: string | null = null;
  for (const item of project.outline) {
    if (item.type === 'part') part = item.id;
    else if (byId.get(item.id) && hasKeyword(byId.get(item.id)!, word)) {
      out.add(item.id);
      if (part) out.add(part);
    }
  }
  return out;
}

export function ProjectOutline({ project, onOpenChapter, onBack }: { project: Project; onOpenChapter(id: string): void; onBack?(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const [menu, setMenu] = useState<null | 'menu' | 'rename' | 'goal' | 'deadline' | 'delete' | 'draft' | 'draftnote' | 'series'>(null);
  const [itemMenu, setItemMenu] = useState<string | null>(null);
  // A chapter or part right-clicked in the outline: its menu where the pointer is.
  const [itemAt, setItemAt] = useState<{ id: string; x: number; y: number } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Printing from the Export window can leave out the chapters marked To do.
  const [printSkipTodo, setPrintSkipTodo] = useState(false);
  // And add a title page and part pages, or leave out comments and tracked changes (BookOptions).
  const [printOpts, setPrintOpts] = useState<BookOptions>({});
  // Or a print-ready book, in its design.
  const [printBook, setPrintBook] = useState<BookDesign | null>(null);
  const printParts = useMemo(() => {
    if (!printing) return [];
    const chapters = printSkipTodo ? state.chapters.filter((c) => c.status !== 'todo') : state.chapters;
    const out: PrintPart[] = [];
    // A printed book's title page is its title and author; a manuscript's adds its length.
    const author = project.page?.hf?.author || state.settings.name || '';
    if (printOpts.titlePage) out.push({ id: 'title-page', doc: printBook ? { blocks: titlePage(project.name, author) } : bookParts({ ...state, chapters }, project, { titlePage: true })[0].doc, fields: { title: project.name, words: 0 } });
    let partNow: string | null = null;
    for (const { chapter, number, part } of projectChapters(project, chapters)) {
      if (printOpts.partHeadings && part && part.id !== partNow) out.push({ id: part.id, doc: { blocks: [makeBlock('heading1', part.title || 'Part')] }, fields: { title: project.name, part: part.title, words: 0 } });
      partNow = part?.id ?? null;
      const text = printOpts.notes === false ? finalDoc(chapter.doc) : chapter.doc;
      const doc = printBook ? designDoc(text, printBook) : text;
      out.push({
        id: chapter.id,
        doc: { blocks: [...(printBook ? chapterOpening(printBook, number, chapter.title) : [makeBlock('heading1', chapter.title || `Chapter ${number}`)]), ...doc.blocks] },
        fields: { title: project.name, chapter: number, chapterTitle: chapter.title, part: part?.title, words: chapterWords(chapter) },
      });
    }
    return out;
  }, [printing, printSkipTodo, printOpts, printBook, project, state.chapters, state.settings.name]);
  // A print-ready book's pages: its trim size, margins for its length, and running heads.
  const bookPrint = useMemo(() => {
    if (!printBook) return null;
    const words = printParts.reduce((n, p) => n + (p.fields.words ?? 0), 0);
    const pages = estimatePages(words, printBook) + printParts.length;
    return { design: printBook, pages, page: printPage(printBook, pages, project.page?.hf?.author || state.settings.name || undefined) };
  }, [printBook, printParts, project.page, state.settings.name]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const chapters = new Map(projectChapters(project, state.chapters).map((x) => [x.chapter.id, x]));
  const total = projectWords(project, state.chapters);
  const goal = projectGoal(project, state.chapters);
  const mode = state.projectMode;
  const shownItems = shownOutline(project, state.chapters, state.keywordFilter);
  // The calm look (design 3): the outline is the book's sidebar, one line a chapter; cards, synopses
  // and keywords are for Cards, and the characters and research fold under two rows at its foot.
  const narrowScreen = useMedia('(max-width: 759px)');
  const calm = !state.settings.toolbarAll && !narrowScreen;
  // The calm phone (design 17): back to the library, a big title, the words against the goal,
  // then Chapters, Cast and Research side by side; chapters as cards with their synopses.
  const phone = !state.settings.toolbarAll && narrowScreen;
  const [phoneTab, setPhoneTab] = useState<'chapters' | 'cast' | 'research' | 'plan'>('chapters');
  const [footOpen, setFootOpen] = useState<null | 'cast' | 'research'>(null);
  const researchCount = state.notes.filter((n) => n.projectId === project.id && n.trashedAt === null).length + store.linkedNotes(project.id).length;
  const show = { synopsis: true, status: true, keywords: true, ...state.settings.cardShow };

  const drop = () => {
    if (dragging && dropAt !== null) store.moveOutlineItem(project.id, dragging, dropAt);
    setDragging(null);
    setDropAt(null);
  };

  return (
    <section className={`list outline${calm ? ' book-side' : ''}${phone ? ' phone-book' : ''}`} aria-label="Outline">
      {exporting && (
        <ExportBook
          project={project}
          onClose={() => setExporting(false)}
          onPrint={(skip, opts, design) => {
            setPrintSkipTodo(skip);
            setPrintOpts(opts);
            setPrintBook(design ?? null);
            setPrinting(true);
          }}
        />
      )}
      {sharing && <ShareDialog what={{ kind: 'book', id: project.id }} onClose={() => setSharing(false)} />}
      {printing && (
        <PrintJob
          title={project.name}
          parts={printParts}
          page={bookPrint?.page ?? project.page ?? manuscriptPage()}
          sheet={fullSheet(project.styles, 'manuscript')}
          chapters
          book={bookPrint ?? undefined}
          onDone={() => {
            setPrinting(false);
            setPrintBook(null);
          }}
        />
      )}
      <header className={`list-head${calm ? ' book-head' : ''}`}>
        {phone && (
          <div className="phone-bar">
            <button type="button" className="icon-btn back" aria-label="Back to the library" onClick={onBack}>
              <IconBack size={18} />
              <span className="back-label">Crumpet</span>
            </button>
          </div>
        )}
        <div className="list-title">
          {calm && (
            <button type="button" className="icon-btn" aria-label="Back to notes" title="Back to notes" onClick={() => store.setView({ kind: 'all' })}>
              <IconBack size={18} />
            </button>
          )}
          {menu === 'rename' ? (
            <InlineInput
              label="Project name"
              initial={project.name}
              onDone={(name) => {
                setMenu(null);
                if (name) store.renameProject(project.id, name);
              }}
            />
          ) : calm ? (
            <div className="book-name">
              <h1>{project.name}</h1>
              <p>
                {chapters.size} chapter{chapters.size === 1 ? '' : 's'}
                {project.series && <> · {seriesLine(state.projects, project)}</>}
              </p>
            </div>
          ) : (
            <div className="book-name">
              <h1>{project.name}</h1>
              {project.series && <p className="book-series">{seriesLine(state.projects, project)}</p>}
            </div>
          )}
          <span className="grow" />
          <div className="note-actions">
            <button type="button" className="icon-btn" aria-label="Project options" aria-expanded={menu === 'menu'} onClick={() => setMenu(menu ? null : 'menu')}>
              <IconMore size={16} />
            </button>
            {(menu === 'menu' || menu === 'delete' || menu === 'goal' || menu === 'deadline' || menu === 'draft' || menu === 'series') && (
              <Popover onClose={() => setMenu(null)} label="Project options">
                {menu === 'menu' && (
                  <>
                    <button type="button" className="menu-item" onClick={() => setMenu('rename')}>
                      {calm || phone ? 'Rename book' : 'Rename project'}
                    </button>
                    {(calm || phone) && (
                      <button type="button" className="menu-item" aria-label="Add part" onClick={() => (setMenu(null), setRenaming(store.addPart(project.id) ?? null))}>
                        Add a part
                      </button>
                    )}
                    <button type="button" className="menu-item" onClick={() => setMenu('goal')}>
                      Word goal…
                    </button>
                    <button type="button" className="menu-item" onClick={() => setMenu('deadline')}>
                      Deadline…
                    </button>
                    <button type="button" className="menu-item" onClick={() => setMenu('draft')}>
                      New draft of the book…
                    </button>
                    <button type="button" className="menu-item" onClick={() => setMenu('series')}>
                      {project.series ? `Series: ${project.series}…` : 'Part of a series…'}
                    </button>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        setMenu(null);
                        setExporting(true);
                      }}
                    >
                      Export: Word, e-book, PDF…
                    </button>
                    <button type="button" className="menu-item" onClick={() => (setMenu(null), setSharing(true))}>
                      Share with readers…
                    </button>
                    <button type="button" className="menu-item" onClick={() => (setMenu(null), openSubmissions({ kind: 'project', id: project.id }))}>
                      Submissions…
                    </button>
                    <button type="button" className="menu-item danger" onClick={() => setMenu('delete')}>
                      {calm || phone ? 'Delete book…' : 'Delete project'}
                    </button>
                  </>
                )}
                {menu === 'series' && (
                  <>
                    <p className="menu-label">The series’ name</p>
                    <InlineInput
                      label="Series"
                      placeholder="The Lighthouse Trilogy"
                      initial={project.series ?? ''}
                      list={seriesNames(state.projects)}
                      onDone={(name) => {
                        setMenu(null);
                        if (name !== null) store.setSeries(project.id, name);
                      }}
                    />
                    <p className="menu-hint">Books in the same series share their characters, places and research. Leave it empty to take this book out.</p>
                  </>
                )}
                {menu === 'draft' && <BookDraftForm project={project} chapters={[...chapters.values()].map((x) => x.chapter)} onDone={() => setMenu(null)} />}
                {menu === 'goal' && (
                  <GoalInput
                    label="Word goal for the project"
                    value={project.goal}
                    onDone={(g) => {
                      setMenu(null);
                      if (g !== undefined) store.setProjectGoal(project.id, g);
                    }}
                  />
                )}
                {menu === 'deadline' && (
                  <DeadlineInput
                    value={project.deadline?.date ?? null}
                    hasGoal={!!goal}
                    onDone={(date) => {
                      setMenu(null);
                      if (date !== undefined) store.setProjectDeadline(project.id, date);
                    }}
                  />
                )}
                {menu === 'delete' && (
                  <div className="menu-confirm">
                    <p>
                      Delete <b>{project.name}</b> and all {chapters.size} chapter{chapters.size === 1 ? '' : 's'}? This can’t be undone.
                    </p>
                    <button type="button" className="btn danger" onClick={() => store.deleteProject(project.id)}>
                      {calm || phone ? 'Delete book' : 'Delete project'}
                    </button>
                  </div>
                )}
              </Popover>
            )}
          </div>
          {!calm && <FoldButton what="list" />}
        </div>
        {project.draft &&
          (menu === 'draftnote' ? (
            <InlineInput
              label={`What ${project.draft.name} is for`}
              placeholder="Tighten the pacing, cut the subplot…"
              initial={project.draft.note}
              onDone={(v) => {
                setMenu(null);
                if (v !== null) store.setBookDraftNote(project.id, v);
              }}
            />
          ) : (
            <button type="button" className="book-draft" title={`Change what ${project.draft.name} is for`} onClick={() => setMenu('draftnote')}>
              <strong>{project.draft.name}</strong>
              {project.draft.note ? <span> · {project.draft.note}</span> : <span className="book-draft-add"> · what’s it for?</span>}
              <BookProgress chapters={[...chapters.values()].map((x) => x.chapter)} />
            </button>
          ))}
        {calm && (
          <>
            <div className="segmented book-modes" role="group" aria-label="Writing view">
              {(
                [
                  ['chapter', 'Write'],
                  ['corkboard', 'Cards'],
                  ['plan', 'Plan'],
                  ['manuscript', 'Read'],
                ] as const
              ).map(([m, label]) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => store.setProjectMode(m)}>
                  {label}
                </button>
              ))}
            </div>
            {mode !== 'corkboard' && <div className="book-progress">
              <div className="book-progress-words">
                <span>{words(total)}</span>
                {goal ? <span>of {goal.toLocaleString()}</span> : null}
              </div>
              {goal ? (
                <div className="book-bar" role="progressbar" aria-label="Project progress" aria-valuenow={total} aria-valuemin={0} aria-valuemax={goal}>
                  <i style={{ width: `${Math.min(100, (total / goal) * 100)}%` }} />
                </div>
              ) : null}
            </div>}
          </>
        )}
        {phone && (
          <>
            <div className="book-progress phone-progress">
              <div className="book-progress-words">
                <span>{words(total)}</span>
                {goal ? <span>{Math.round((total / goal) * 100)}% of {goal.toLocaleString()}</span> : null}
              </div>
              {goal ? (
                <div className="book-bar" role="progressbar" aria-label="Project progress" aria-valuenow={total} aria-valuemin={0} aria-valuemax={goal}>
                  <i style={{ width: `${Math.min(100, (total / goal) * 100)}%` }} />
                </div>
              ) : null}
            </div>
            <div className="segmented phone-tabs" role="group" aria-label="Show">
              {(
                [
                  ['chapters', 'Chapters'],
                  ['cast', 'Cast'],
                  ['research', 'Research'],
                  ['plan', 'Plan'],
                ] as const
              ).map(([t, label]) => (
                <button key={t} type="button" aria-pressed={phoneTab === t} onClick={() => setPhoneTab(t)}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
        {!calm && !phone && <div className="list-sub">
          <span>
            {words(total)}
            {goal ? ` of ${goal.toLocaleString()}` : ''}
          </span>
          <span className="grow" />
          <div className="segmented small" role="group" aria-label="Writing view">
            <button type="button" aria-pressed={mode === 'chapter'} onClick={() => store.setProjectMode('chapter')}>
              Chapter
            </button>
            <button type="button" aria-pressed={mode === 'manuscript'} onClick={() => store.setProjectMode('manuscript')}>
              Manuscript
            </button>
            <button type="button" aria-pressed={mode === 'corkboard'} title="Corkboard: chapters as index cards" onClick={() => store.setProjectMode('corkboard')}>
              Cards
            </button>
            <button type="button" aria-pressed={mode === 'plan'} title="Plan: the story's timeline, plotlines and structure" onClick={() => store.setProjectMode('plan')}>
              Plan
            </button>
          </div>
        </div>}
        {!calm && !phone && <Progress value={total} goal={goal} label="Project progress" />}
        <KeywordFilter project={project} />
        {project.deadline && goal ? <DeadlineLine project={project} goal={goal} total={total} onEdit={() => setMenu('deadline')} /> : null}
      </header>

      {phone && phoneTab !== 'chapters' ? (
        phoneTab === 'cast' ? <CastList project={project} phone /> : phoneTab === 'plan' ? <PlanView project={project} narrow inTab onBack={() => setPhoneTab('chapters')} /> : <ResearchList project={project} phone />
      ) : calm && mode === 'corkboard' ? (
        <div className="book-show" role="group" aria-label="Show on the cards">
          <p className="book-label">Show</p>
          {(
            [
              ['synopsis', 'Synopsis'],
              ['status', 'Status'],
              ['keywords', 'Keywords'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="check-row">
              <input type="checkbox" checked={show[key]} onChange={(e) => store.updateSettings({ cardShow: { ...state.settings.cardShow, [key]: e.target.checked } })} />
              {label}
            </label>
          ))}
        </div>
      ) : (
      <>
      {state.keywordFilter && shownItems.size === 0 && <p className="outline-filter-empty">No chapters have “{state.keywordFilter}” yet.</p>}
      <ol className="outline-items" onDragOver={(e) => dragging && e.preventDefault()} onDrop={drop}>
        {project.outline.map((item, index) => {
          // Filtered by a keyword: only its chapters, and the parts they're in.
          if (!shownItems.has(item.id)) return null;
          const dropLine = dropAt === index ? ' drop-before' : dropAt === index + 1 && index === project.outline.length - 1 ? ' drop-after' : '';
          const dragProps = {
            draggable: renaming !== item.id,
            onDragStart: (e: React.DragEvent) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', item.id);
              setDragging(item.id);
              // A chapter can also be dragged into a pane of its own.
              if (item.type === 'chapter') startTabDrag(e, { kind: 'chapter', id: item.id });
            },
            onDragEnd: () => {
              setDragging(null);
              setDropAt(null);
            },
            onDragOver: (e: React.DragEvent) => {
              if (!dragging) return;
              e.preventDefault();
              const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setDropAt(e.clientY < box.top + box.height / 2 ? index : index + 1);
            },
            onContextMenu: (e: React.MouseEvent) => {
              if ((e.target as Element).closest('input, textarea')) return;
              e.preventDefault();
              setItemMenu(null);
              setItemAt({ id: item.id, x: e.clientX, y: e.clientY });
            },
          };
          const move = (delta: number) => {
            setItemMenu(null);
            store.moveOutlineItem(project.id, item.id, delta < 0 ? index - 1 : index + 2);
          };
          const menuFor = (extra: React.ReactNode) =>
            itemMenu === item.id && (
              <Popover onClose={() => setItemMenu(null)} label="Options">
                <button type="button" className="menu-item" disabled={index === 0} onClick={() => move(-1)}>
                  Move up
                </button>
                <button type="button" className="menu-item" disabled={index === project.outline.length - 1} onClick={() => move(1)}>
                  Move down
                </button>
                {extra}
              </Popover>
            );

          if (item.type === 'part') {
            return (
              <li key={item.id} className={`outline-part${dragging === item.id ? ' dragging' : ''}${dropLine}`} {...dragProps}>
                {renaming === item.id ? (
                  <InlineInput
                    label="Part title"
                    initial={item.title}
                    onDone={(t) => {
                      setRenaming(null);
                      if (t) store.renamePart(project.id, item.id, t);
                    }}
                  />
                ) : (
                  <span className="grow ellipsis">{item.title}</span>
                )}
                <div className="note-actions">
                  <button type="button" className="icon-btn" aria-label={`Options for ${item.title}`} aria-expanded={itemMenu === item.id} onClick={() => setItemMenu(itemMenu === item.id ? null : item.id)}>
                    <IconMore size={14} />
                  </button>
                  {menuFor(
                    <>
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => {
                          setItemMenu(null);
                          setRenaming(item.id);
                        }}
                      >
                        Rename part
                      </button>
                      <button
                        type="button"
                        className="menu-item danger"
                        onClick={() => {
                          setItemMenu(null);
                          store.deletePart(project.id, item.id);
                        }}
                      >
                        Remove part (keeps its chapters)
                      </button>
                    </>,
                  )}
                </div>
              </li>
            );
          }
          const entry = chapters.get(item.id);
          if (!entry) return null;
          const { chapter: c, number } = entry;
          const n = chapterWords(c);
          return (
            <li key={item.id} className={`outline-chapter${state.chapterId === c.id ? ' selected' : ''}${dragging === item.id ? ' dragging' : ''}${dropLine}`} {...dragProps}>
              <button type="button" className="outline-open" aria-current={state.chapterId === c.id ? 'true' : undefined} onClick={() => onOpenChapter(c.id)}>
                <span className="outline-row">
                  <span className={`status-dot ${c.status}`} title={STATUSES.find((s) => s.id === c.status)?.label} />
                  {!phone && <span className="outline-num">{number}.</span>}
                  <span className="grow ellipsis outline-title">{phone && `${number}. `}{c.title || 'Untitled chapter'}</span>
                  {c.drafts?.length ? <DraftBadge chapter={c} /> : null}
                  <span className="outline-words">{c.goal ? `${n.toLocaleString()} / ${c.goal.toLocaleString()}` : n.toLocaleString()}</span>
                </span>
                {(!calm || phone) && c.synopsis && <span className="outline-synopsis">{c.synopsis}</span>}
                {!calm && !phone && <KeywordChips chapter={c} />}
                {!calm && !phone && c.goal ? <Progress value={n} goal={c.goal} label={`Progress of ${c.title || 'chapter'}`} /> : null}
              </button>
              <div className="note-actions">
                <button type="button" className="icon-btn" aria-label={`Options for ${c.title || 'chapter'}`} aria-expanded={itemMenu === item.id} onClick={() => setItemMenu(itemMenu === item.id ? null : item.id)}>
                  <IconMore size={14} />
                </button>
                {menuFor(
                  <button
                    type="button"
                    className="menu-item danger"
                    onClick={() => {
                      setItemMenu(null);
                      if (n === 0 || confirm(`Delete “${c.title || 'Untitled chapter'}” and its ${words(n)}?`)) store.deleteChapter(c.id);
                    }}
                  >
                    Delete chapter
                  </button>,
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {itemAt && (
        <OutlineItemMenu
          project={project}
          id={itemAt.id}
          x={itemAt.x}
          y={itemAt.y}
          onOpenChapter={onOpenChapter}
          onRenamePart={setRenaming}
          onClose={() => setItemAt(null)}
        />
      )}

      {phone ? null : calm ? (
        <button type="button" className="book-new" aria-label="Add chapter" onClick={() => store.addChapter(project.id)}>
          <IconPlus size={16} /> New chapter
        </button>
      ) : (
      <div className="outline-add">
        <button type="button" className="btn" aria-label="Add chapter" onClick={() => store.addChapter(project.id)}>
          <IconPlus size={13} /> Chapter
        </button>
        <button type="button" className="btn quiet" aria-label="Add part" onClick={() => setRenaming(store.addPart(project.id) ?? null)}>
          <IconPlus size={13} /> Part
        </button>
      </div>
      )}
      </>
      )}
      {calm ? (
        mode !== 'corkboard' && <div className="book-foot">
          {footOpen === 'cast' && <CastList project={project} />}
          {footOpen === 'research' && <ResearchList project={project} />}
          <button type="button" className="book-row" aria-expanded={footOpen === 'cast'} onClick={() => setFootOpen(footOpen === 'cast' ? null : 'cast')}>
            <IconPeople size={18} />
            <span className="grow">Characters &amp; places</span>
            <span className="count">{project.cast?.length ?? 0}</span>
          </button>
          <button type="button" className="book-row" aria-expanded={footOpen === 'research'} onClick={() => setFootOpen(footOpen === 'research' ? null : 'research')}>
            <IconBox size={18} />
            <span className="grow">Research</span>
            <span className="count">{researchCount}</span>
          </button>
        </div>
      ) : (
      <>
      {chapters.size > 1 && !phone && (
        <ul className="status-key" aria-label="What the dots mean">
          {STATUSES.map((s) => (
            <li key={s.id}>
              <span className={`status-dot ${s.id}`} aria-hidden="true" /> {s.label}
            </li>
          ))}
        </ul>
      )}
      {!phone && <CastList project={project} />}
      {!phone && <ResearchList project={project} />}
      </>
      )}
      {/* The round + adds a chapter; under Cast and Research, their own + beside the heading adds to them. */}
      {phone && phoneTab === 'chapters' && !state.focusMode && (
        <button type="button" className="fab" aria-label="New chapter" onClick={() => store.addChapter(project.id)}>
          <IconPlus size={26} />
        </button>
      )}
    </section>
  );
}

/** A small number field for a word goal; empty removes it. */
function GoalInput({ label, value, onDone }: { label: string; value: number | null; onDone(goal: number | null | undefined): void }) {
  const [text, setText] = useState(value ? String(value) : '');
  return (
    <form
      className="goal-form"
      onSubmit={(e) => {
        e.preventDefault();
        const n = parseInt(text.replace(/[^\d]/g, ''), 10);
        onDone(Number.isFinite(n) && n > 0 ? n : null);
      }}
    >
      <label>
        <span>{label}</span>
        <input autoFocus inputMode="numeric" placeholder="e.g. 80,000" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onDone(undefined)} />
      </label>
      <button type="submit" className="btn primary">
        Set
      </button>
    </form>
  );
}

/** Choosing a finish date. */
function DeadlineInput({ value, hasGoal, onDone }: { value: string | null; hasGoal: boolean; onDone(date: string | null | undefined): void }) {
  const [date, setDate] = useState(value ?? '');
  return (
    <form
      className="goal-form"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(date || null);
      }}
    >
      <label>
        <span>Finish by</span>
        <input autoFocus type="date" min={dayKey(Date.now())} value={date} onChange={(e) => setDate(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onDone(undefined)} />
      </label>
      <button type="submit" className="btn primary" disabled={!date}>
        Set
      </button>
      {!hasGoal && <p className="goal-hint">Set a word goal too: Crumpet shares it out over the days left.</p>}
      {value && (
        <button type="button" className="link-btn small" onClick={() => onDone(null)}>
          Remove the deadline
        </button>
      )}
    </form>
  );
}

/** Under the project's progress: the deadline, today's target, and whether the writing is keeping pace. */
function DeadlineLine({ project, goal, total, onEdit }: { project: Project; goal: number; total: number; onEdit(): void }) {
  const state = useAppState();
  const now = Date.now();
  const ids = state.chapters.filter((c) => c.projectId === project.id).map((c) => c.id);
  const p = pace(project.deadline!, goal, total, wordsToday(state.settings.stats, ids, now), dayKey(now));
  const due = new Date(`${project.deadline!.date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: new Date().getFullYear() === Number(project.deadline!.date.slice(0, 4)) ? undefined : 'numeric' });
  const status =
    p.state === 'done'
      ? 'Goal reached'
      : p.state === 'passed'
        ? `The date has passed · ${words(goal - total)} to go`
        : p.state === 'behind'
          ? `Behind by ${words(p.behindBy)}`
          : p.writtenToday >= p.todayTarget
            ? 'Today’s target met'
            : 'On track';
  return (
    <div className="deadline" aria-label="Deadline">
      <button type="button" className="deadline-due" onClick={onEdit} title="Change the deadline">
        Finish by {due}
        {p.daysLeft > 0 && p.state !== 'done' ? ` · ${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left` : ''}
      </button>
      {p.state !== 'done' && p.state !== 'passed' && (
        <span className="deadline-today">
          Today: {p.writtenToday.toLocaleString()} of {words(p.todayTarget)}
        </span>
      )}
      <span className={`deadline-state ${p.state}`}>{status}</span>
    </div>
  );
}

// ---------------------------------------------------------------- writing

export function ProjectPane({ project, narrow, onBack }: { project: Project; narrow: boolean; onBack(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const linked = !!state.researchId && !!project.linked?.includes(state.researchId);
  // Research and cards from the series' other books open here too (kept, and edited, in their own book).
  const fromSeries = seriesBooks(state.projects, project).map((p) => p.id);
  const research = state.notes.find((n) => n.id === state.researchId && ((n.projectId && fromSeries.includes(n.projectId)) || (linked && !n.projectId)) && n.trashedAt === null);
  const found = state.castId ? findMember(state.projects, project, state.castId) : null;
  const member = found?.member;
  if (!research && !member) return <ProjectWriting project={project} narrow={narrow} onBack={onBack} />;
  // On a phone, closing a card or research note goes back to the book's outline.
  const close = (clear: () => void) => () => {
    clear();
    if (narrow) onBack();
  };
  const pane = member ? <CastPane key={member.id} project={found!.book} member={member} narrow={narrow} onClose={close(() => store.openCast(null))} /> : <ResearchPane key={research!.id} note={research!} linkedTo={linked ? project.id : undefined} onClose={close(() => store.openResearch(null))} />;
  // Research opens beside the writing (on a phone, instead of it).
  if (narrow) return pane;
  return (
    <div className="project-split">
      <ProjectWriting project={project} narrow={narrow} onBack={onBack} />
      {pane}
    </div>
  );
}

function ProjectWriting({ project, narrow, onBack }: { project: Project; narrow: boolean; onBack(): void }) {
  const state = useAppState();
  if (state.projectMode === 'manuscript') return <Manuscript project={project} narrow={narrow} onBack={onBack} />;
  if (state.projectMode === 'corkboard') return <Corkboard project={project} narrow={narrow} onBack={onBack} />;
  if (state.projectMode === 'plan') return <PlanView project={project} narrow={narrow} onBack={onBack} />;
  const chapter = state.chapters.find((c) => c.id === state.chapterId && c.projectId === project.id);
  if (!chapter) {
    return (
      <section className="pane-empty" aria-label="Chapter">
        <p>Choose a chapter, or add one.</p>
      </section>
    );
  }
  return <ChapterPane project={project} chapter={chapter} narrow={narrow} onBack={onBack} />;
}

function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(ref);
  return <textarea ref={ref} rows={1} {...props} />;
}

export function ChapterPane({ project, chapter, narrow, onBack, draft }: { project: Project; chapter: Chapter; narrow: boolean; onBack(): void; draft?: string }) {
  const state = useAppState();
  const store = useAppStore();
  const editorRef = useRef<Editor | null>(null);
  const [chapterEditor, setChapterEditor] = useState<Editor | null>(null);
  const pasteTitle = usePasteTitle(editorRef, chapter.title, (title) => store.setChapterTitle(chapter.id, title));
  const [goalOpen, setGoalOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState<string | boolean>(false);
  const [finding, setFinding] = useState(false);
  const [findScope, setFindScope] = useState<'chapter' | 'book'>('chapter');
  const onFindKey = useFindKey(() => setFinding(true));
  const sheet = useMemo(() => fullSheet(project.styles, 'manuscript'), [project.styles]);
  const styleSources = useStyleSources(project.id);
  const pageSetup = project.page ?? manuscriptPage();
  // The calm look writes in the plain view, its tools over selected words; page view is a click away.
  const calm = !state.settings.toolbarAll && !narrow;
  // The calm look on a phone: a chapter reads like a note, its status and goal in the ··· menu.
  const phone = !state.settings.toolbarAll && narrow;
  // A phone writes in flowing text (a whole page shrunk to its width is too small to write in).
  const paged = !narrow && (state.settings.pageView?.projects ?? !calm);
  const [chapterMenu, setChapterMenu] = useState<null | 'menu' | 'goal' | 'keywords' | 'synopsis' | 'draft'>(null);
  // A phone writes without pages: Preview pages shows how the chapter falls on them.
  const [previewing, setPreviewing] = useState(false);
  const [sharing, setSharing] = useState(false);
  // An iPad held upright (design 15): the outline button and where you are, the chapters a menu away.
  const midWidth = useMedia('(max-width: 1099px)');
  const compact = calm && midWidth && !state.query.trim();
  // Status, words, page view and the inspector wait in the ··· menu.
  const menuHolds = compact || phone;
  const outlineOut = state.settings.layout?.list === true;
  const [jump, setJump] = useState(false);
  const list = projectChapters(project, state.chapters);
  const at = list.findIndex((x) => x.chapter.id === chapter.id);
  const prev = list[at - 1]?.chapter;
  const next = list[at + 1]?.chapter;
  const part = list[at]?.part;
  // The draft shown: the one the book uses unless another was picked from the tabs.
  // (A pane opened beside another shows the draft it was opened for.)
  const [viewId, setViewId] = useState(draft ?? '');
  const panes = usePanes();
  const openBeside = (id: string) => {
    panes.split({ kind: 'chapter', id: chapter.id, draft: id }, 'right');
    store.updateSettings({ syncScroll: true });
  };
  const shown = chapterDraft(chapter, viewId) ?? chapterDraft(chapter, draftInUse(chapter))!;
  const single = !chapter.drafts?.length;
  const [newDraftOpen, setNewDraftOpen] = useState(false);
  const onDoc = (doc: Doc) => (shown.inUse ? store.setChapterDoc(chapter.id, doc) : store.setDraftDoc(chapter.id, shown.id, doc));
  const n = docWords(shown.doc);
  const total = projectWords(project, state.chapters);
  const styles = useSheetClass(sheet);

  useEffect(() => {
    setGoalOpen(false);
    setViewId(draft ?? '');
  }, [chapter.id, draft]);

  // Page numbers carry on from the chapters before (as last laid out, or estimated from their words).
  const [pages, setPages] = useState(0);
  const onPages = useCallback(
    (count: number) => {
      setPages(count);
      rememberPages(chapter.id, pageSetup, styles, count);
    },
    [chapter.id, pageSetup, styles],
  );
  const perPage = pages && n >= 100 ? n / pages : undefined;
  const count = (c: Chapter) => chapterPages(c.id, chapterWords(c), pageSetup, styles, perPage);
  const offset = list.slice(0, Math.max(0, at)).reduce((sum, x) => sum + count(x.chapter), 0);
  // A table of contents here lists the whole book.
  const startOf = (c: Chapter) => list.slice(0, list.findIndex((x) => x.chapter.id === c.id)).reduce((sum, x) => sum + count(x.chapter), 0);
  const tocEntries = bookEntries(list, chapter.id, startOf, count);
  const onTocTarget = useCallback(
    (t: { chapter: string; block?: string }) => {
      goToLater(t);
      store.selectChapter(t.chapter);
    },
    [store],
  );
  const after = list.slice(at + 1).reduce((sum, x) => sum + count(x.chapter), 0);

  // The status's name as plain words, the menu laid invisibly over it (a menu
  // on its own is as wide as its longest choice, leaving a gap after "Draft").
  const statusPick = (
    <label className={`status-pick overlay ${chapter.status}`}>
      <span className={`status-dot ${chapter.status}`} aria-hidden="true" />
      <span className="status-name" aria-hidden="true">
        {STATUSES.find((x) => x.id === chapter.status)?.label}
      </span>
      <span className="visually-hidden">Status</span>
      <select value={chapter.status} onChange={(e) => store.setChapterStatus(chapter.id, e.target.value as ChapterStatus)}>
        {STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
  const lead = narrow ? (
    <button type="button" className="icon-btn back" aria-label="Back to outline" onClick={onBack}>
      <IconBack size={18} />
      <span className="back-label">Outline</span>
    </button>
  ) : compact ? (
    <>
      <button type="button" className={`icon-btn${outlineOut ? ' on' : ''}`} aria-label={outlineOut ? 'Hide the outline' : 'Show the outline'} aria-pressed={outlineOut} onClick={() => store.updateLayout({ list: outlineOut ? undefined : true })}>
        <IconSidebar size={18} />
      </button>
      <p className="room-crumbs book-crumbs">
        <span>{project.name}</span>
        <span aria-hidden="true">/</span>
        <span className="crumb-jump">
          <button type="button" className="here" aria-haspopup="menu" aria-expanded={jump} onClick={() => setJump(!jump)}>
            {at + 1}. {chapter.title || 'Untitled chapter'} <IconChevron size={14} className="rot90" />
          </button>
          {jump && (
            <Popover onClose={() => setJump(false)} label="Chapters">
              {list.map(({ chapter: c, number }) => (
                <button key={c.id} type="button" className={`menu-item${c.id === chapter.id ? ' on' : ''}`} onClick={() => (setJump(false), store.selectChapter(c.id))}>
                  <span className={`status-dot ${c.status}`} aria-hidden="true" /> {number}. {c.title || 'Untitled chapter'}
                </button>
              ))}
            </Popover>
          )}
        </span>
      </p>
    </>
  ) : calm ? (
    <p className="chapter-line">
      {statusPick}
      <span aria-hidden="true">·</span>
      <span className="chapter-words">{chapter.goal ? `${n.toLocaleString()} of ${chapter.goal.toLocaleString()} words` : words(n)}</span>
    </p>
  ) : null;

  const calmTrail = (
    <div className="note-actions">
      <button type="button" className="icon-btn" aria-label="Previous chapter" data-tip="Previous chapter" disabled={!prev} onClick={() => prev && store.selectChapter(prev.id)}>
        <IconBack size={18} />
      </button>
      <button type="button" className="icon-btn" aria-label="Next chapter" data-tip="Next chapter" disabled={!next} onClick={() => next && store.selectChapter(next.id)}>
        <IconChevron size={18} />
      </button>
      {!menuHolds && <PageToggle on={paged} onChange={(on) => store.updateSettings({ pageView: { ...state.settings.pageView, projects: on } })} />}
      {!menuHolds && <button type="button" className={`icon-btn${state.settings.layout?.right ? ' on' : ''}`} aria-label={state.settings.layout?.right ? 'Close the inspector' : 'Open the inspector'} aria-pressed={!!state.settings.layout?.right} data-tip="Inspector: who’s in this chapter, notes and comments" onClick={() => store.updateLayout({ right: !state.settings.layout?.right })}>
        <IconRightPanel size={18} />
      </button>}
      <button type="button" className="icon-btn" aria-label="Chapter options" aria-expanded={!!chapterMenu} onClick={() => setChapterMenu(chapterMenu ? null : 'menu')}>
        <IconMore size={16} />
      </button>
      {chapterMenu && (
        <Popover onClose={() => setChapterMenu(null)} label="Chapter options">
          {chapterMenu === 'menu' && (
            <>
              {menuHolds && (
                <>
                  {narrow && <TextSizeRow />}
                  {narrow && (
                    <button type="button" className="menu-item" onClick={() => (setChapterMenu(null), setPreviewing(true))}>
                      Preview pages
                    </button>
                  )}
                  <div className="menu-line">
                    {statusPick}
                    <span>{chapter.goal ? `${n.toLocaleString()} of ${chapter.goal.toLocaleString()} words` : words(n)}</span>
                  </div>
                  {/* A phone has no inspector (it would have no room); an iPad's slides in as a drawer. */}
                  {!phone && (
                    <button type="button" className="menu-item" aria-pressed={!!state.settings.layout?.right} onClick={() => (setChapterMenu(null), store.updateLayout({ right: !state.settings.layout?.right }))}>
                      <IconPeople size={14} /> {state.settings.layout?.right ? 'Close the inspector' : 'Open the inspector'}
                    </button>
                  )}
                  {!narrow && (
                    <button type="button" className="menu-item" aria-pressed={paged} onClick={() => (setChapterMenu(null), store.updateSettings({ pageView: { ...state.settings.pageView, projects: !paged } }))}>
                      {paged ? 'Page view: on' : 'Page view'}
                    </button>
                  )}
                  <hr className="menu-sep" />
                </>
              )}
              <button type="button" className="menu-item" onClick={() => (setChapterMenu(null), setFinding(true))}>
                <IconSearch size={14} /> Find and replace {!phone && <small className="menu-hint">{isMac ? '⌘F' : 'Ctrl+F'}</small>}
              </button>
              {!phone && (
                <button type="button" className="menu-item" onClick={() => (setChapterMenu(null), store.setFocusMode(true))}>
                  <IconFocus size={14} /> Focus mode
                </button>
              )}
              <hr className="menu-sep" />
              <button type="button" className="menu-item" onClick={() => setChapterMenu('goal')}>
                {chapter.goal ? 'Change word goal…' : 'Set word goal…'}
              </button>
              <button type="button" className="menu-item" onClick={() => setChapterMenu('keywords')}>
                Keywords…
              </button>
              <button type="button" className="menu-item" onClick={() => setChapterMenu('draft')}>
                New draft…
              </button>
              <button type="button" className="menu-item" onClick={() => (setChapterMenu(null), setSharing(true))}>
                Share with readers…
              </button>
              {phone && (
                <button type="button" className="menu-item" onClick={() => setChapterMenu('synopsis')}>
                  Synopsis…
                </button>
              )}
            </>
          )}
          {chapterMenu === 'goal' && (
            <GoalInput
              label="Word goal for this chapter"
              value={chapter.goal}
              onDone={(g) => {
                setChapterMenu(null);
                if (g !== undefined) store.setChapterGoal(chapter.id, g);
              }}
            />
          )}
          {chapterMenu === 'synopsis' && (
            <AutoTextarea className="synopsis" aria-label="Synopsis" placeholder="Synopsis: what happens in this chapter" value={chapter.synopsis} onChange={(e) => store.setChapterSynopsis(chapter.id, e.target.value)} />
          )}
          {chapterMenu === 'draft' && (
            <NewDraftChoices
              chapter={chapter}
              from={shown.id}
              onMade={(id) => {
                setChapterMenu(null);
                setViewId(id);
              }}
            />
          )}
          {chapterMenu === 'keywords' && (
            <div className="note-meta chapter-keywords">
              <KeywordEditor chapter={chapter} />
            </div>
          )}
        </Popover>
      )}
      {previewing && (
        <PrintJob
          title={chapter.title || `Chapter ${at + 1}`}
          parts={[{ id: chapter.id, doc: { blocks: [makeBlock('heading1', chapter.title || `Chapter ${at + 1}`), ...shown.doc.blocks] }, fields: { title: project.name, chapter: at + 1, chapterTitle: chapter.title, part: part?.title, words: n } }]}
          page={pageSetup}
          sheet={sheet}
          chapters
          preview
          onDone={() => setPreviewing(false)}
        />
      )}
      {sharing && <ShareDialog what={{ kind: 'chapter', id: chapter.id }} onClose={() => setSharing(false)} />}
    </div>
  );

  const trail = calm || phone ? calmTrail : (
    <div className="note-actions">
      <button type="button" className="icon-btn focus-btn" aria-label="Focus mode" data-tip={`Focus mode · ${isMac ? '⌘⇧F' : 'Ctrl+Shift+F'}`} onClick={() => store.setFocusMode(true)}>
        <IconFocus size={16} />
      </button>
      {!narrow && <PageToggle on={paged} onChange={(on) => store.updateSettings({ pageView: { ...state.settings.pageView, projects: on } })} />}
      <button type="button" className="icon-btn" aria-label="Find and replace" data-tip={`Find and replace · ${isMac ? '⌘F' : 'Ctrl+F'}`} onClick={() => setFinding(true)}>
        <IconSearch size={16} />
      </button>
      <button type="button" className="icon-btn" aria-label="Previous chapter" data-tip="Previous chapter" disabled={!prev} onClick={() => prev && store.selectChapter(prev.id)}>
        ‹
      </button>
      <button type="button" className="icon-btn" aria-label="Next chapter" data-tip="Next chapter" disabled={!next} onClick={() => next && store.selectChapter(next.id)}>
        ›
      </button>
    </div>
  );

  const header = (
    <>
      <DraftTabs chapter={chapter} viewing={shown.id} onView={setViewId} onBeside={openBeside} />
      <div className="chapter-opening">
      <p className="chapter-kicker">{[!calm && !phone && part?.title, `Chapter ${numberInWords(at + 1)}`].filter(Boolean).join(' · ')}</p>
      <AutoTextarea
        className="note-title"
        aria-label="Chapter title"
        placeholder="Chapter title"
        value={chapter.title}
        onChange={(e) => store.setChapterTitle(chapter.id, e.target.value.replace(/\n/g, ' '))}
        onPaste={pasteTitle.onTitlePaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            editorRef.current?.focusAt('start');
          }
        }}
      />
      <span className="chapter-rule" aria-hidden="true" />
      </div>
      {!calm && !phone && (
      <>
      <div className="note-meta chapter-meta">
        <label className={`status-pick ${chapter.status}`}>
          <span className={`status-dot ${chapter.status}`} aria-hidden="true" />
          <span className="visually-hidden">Status</span>
          <select value={chapter.status} onChange={(e) => store.setChapterStatus(chapter.id, e.target.value as ChapterStatus)}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <span className="chapter-words">
          {chapter.goal ? `${n.toLocaleString()} of ${chapter.goal.toLocaleString()} words` : words(n)}
        </span>
        <Progress value={n} goal={chapter.goal} label="Chapter progress" />
        <span className="note-actions">
          <button type="button" className="add-tag" aria-expanded={goalOpen} onClick={() => setGoalOpen(!goalOpen)}>
            {chapter.goal ? 'Change goal' : 'Set word goal'}
          </button>
          {single && (
            <button type="button" className="add-tag" aria-expanded={newDraftOpen} onClick={() => setNewDraftOpen(!newDraftOpen)}>
              New draft
            </button>
          )}
          {newDraftOpen && (
            <Popover onClose={() => setNewDraftOpen(false)} label="New draft">
              <NewDraftChoices
                chapter={chapter}
                from={shown.id}
                onMade={(id) => {
                  setNewDraftOpen(false);
                  setViewId(id);
                }}
              />
            </Popover>
          )}
          {goalOpen && (
            <Popover onClose={() => setGoalOpen(false)} label="Chapter word goal">
              <GoalInput
                label="Word goal for this chapter"
                value={chapter.goal}
                onDone={(g) => {
                  setGoalOpen(false);
                  if (g !== undefined) store.setChapterGoal(chapter.id, g);
                }}
              />
            </Popover>
          )}
        </span>
      </div>
      <div className="note-meta chapter-keywords">
        <KeywordEditor chapter={chapter} />
      </div>
      <AutoTextarea className="synopsis" aria-label="Synopsis" placeholder="Synopsis: what happens in this chapter" value={chapter.synopsis} onChange={(e) => store.setChapterSynopsis(chapter.id, e.target.value)} />
      </>
      )}
    </>
  );

  const footer = calm || phone ? null : (
    <p className="note-foot">
      {words(n)} · {project.name}: {words(projectWords(project, state.chapters))}
    </p>
  );

  const bookTargets = list.map(({ chapter: c }) => ({ id: c.id, doc: c.id === chapter.id ? shown.doc : c.doc, editor: c.id === chapter.id ? chapterEditor : null, label: c.title || 'Untitled chapter' }));
  return (
    <section className="pane find-host" aria-label="Chapter" onKeyDown={onFindKey}>
      {finding && (
        <FindBar
          targets={findScope === 'book' ? bookTargets : bookTargets.filter((t) => t.id === chapter.id)}
          onReplaceDoc={(id, doc) => (id === chapter.id ? onDoc(doc) : store.setChapterDoc(id, doc))}
          onGoTo={(id) => store.selectChapter(id)}
          author={state.settings.trackChanges ? state.settings.name.trim() || 'You' : null}
          scopes={[
            { id: 'chapter', label: 'This chapter' },
            { id: 'book', label: 'Whole book' },
          ]}
          scope={findScope}
          onScope={(id) => setFindScope(id as 'chapter' | 'book')}
          sheet={sheet}
          onClose={() => setFinding(false)}
        />
      )}
      {stylesOpen && (
        <StylesDialog
          title={`Styles for ${project.name}`}
          sheet={sheet}
          onChange={(styles) => store.setProjectStyles(project.id, styles)}
          page={pageSetup}
          onPage={(page) => store.setProjectPage(project.id, page)}
          onClose={() => setStylesOpen(false)}
          chapters
          initial={typeof stylesOpen === 'string' ? stylesOpen : undefined}
          sources={styleSources}
          onDefault={() => store.updateSettings({ defaultStyles: sheet })}
        />
      )}
      <EditorHost
        sheet={sheet}
        page={paged ? pageSetup : null}
        onPage={(page) => store.setProjectPage(project.id, page)}
        pageFields={{ title: project.name, chapter: at + 1, chapterTitle: chapter.title, part: part?.title, words: total, created: project.createdAt, updated: project.updatedAt }}
        pagePlace={{ offset, chapterStart: true, total: offset + (pages || 1) + after }}
        chapters
        onPages={onPages}
        onEditStyles={(key?: string) => setStylesOpen(key ?? true)}
        onSheet={(styles) => store.setProjectStyles(project.id, styles)}
        docId={draftDocId(chapter, shown.id)}
        loadKey={`${chapter.id}~${shown.id}`}
        doc={shown.doc}
        onDoc={onDoc}
        readOnly={false}
        label={single ? 'Chapter text' : `Chapter text, ${shown.name}`}
        lead={lead}
        trail={trail}
        floatTools={calm}
        header={header}
        footer={footer}
        onEditor={(ed) => {
          editorRef.current = ed;
          setChapterEditor(ed);
          pasteTitle.attach(ed);
        }}
      />
      <CastSpotting editor={chapterEditor} project={project} />
      <BookToc editor={chapterEditor} chapterId={chapter.id} entries={tocEntries} offset={offset} onTarget={onTocTarget} footnoteStart={footnotesBefore(list, chapter.id)} />
    </section>
  );
}

/** The whole project on one page: every chapter editable, sharing one toolbar. */
function Manuscript({ project, narrow, onBack }: { project: Project; narrow: boolean; onBack(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const [active, setActive] = useState<Editor | null>(null);
  // Each chapter's editor, for find and replace across the manuscript.
  const [editors, setEditors] = useState<Record<string, Editor>>({});
  const onEditor = useCallback((id: string, ed: Editor | null) => {
    setEditors((all) => {
      if ((all[id] ?? null) === ed) return all;
      const next = { ...all };
      if (ed) next[id] = ed;
      else delete next[id];
      return next;
    });
  }, []);
  const [finding, setFinding] = useState(false);
  const onFindKey = useFindKey(() => setFinding(true));
  const msEditors = useMemo(() => Object.values(editors), [editors]);
  // The right sidebar's helpers work on the chapter being written in.
  const msRef = useRef<HTMLElement>(null);
  const activeId = Object.keys(editors).find((id) => editors[id] === active) ?? project.id;
  const helped = useMemo(() => (active ? { editor: active, docId: activeId, sheet: fullSheet(project.styles, 'manuscript'), onSheet: (styles: StyleSheet) => store.setProjectStyles(project.id, styles), onEditStyles: (key?: string) => setStylesOpen(key ?? true) } : null), [active, activeId, project.id, project.styles, store]);
  useOfferHelped(helped, msRef);
  const [linkOpen, setLinkOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState<string | boolean>(false);
  const sheet = useMemo(() => fullSheet(project.styles, 'manuscript'), [project.styles]);
  const styleSources = useStyleSources(project.id);
  const styles = useSheetClass(sheet);
  const pageSetup = project.page ?? manuscriptPage();
  const paged = !narrow && (state.settings.pageView?.projects ?? true);
  const [, setTick] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  // The formatting bar floats above selected text, as in notes, unless pinned.
  const floating = !narrow && (state.focusMode || state.settings.toolbar !== 'always');
  const chapters = new Map(state.chapters.filter((c) => c.projectId === project.id).map((c) => [c.id, c]));
  const total = projectWords(project, state.chapters);
  // Pages each chapter takes, so page numbers run on through the manuscript.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const onPages = useCallback(
    (id: string, n: number) => {
      rememberPages(id, pageSetup, styles, n);
      setCounts((c) => (c[id] === n ? c : { ...c, [id]: n }));
    },
    [pageSetup, styles],
  );
  const order = project.outline.flatMap((x) => (x.type === 'chapter' && chapters.has(x.id) ? [chapters.get(x.id)!] : []));
  const pagesOf = (c: Chapter) => counts[c.id] ?? chapterPages(c.id, chapterWords(c), pageSetup, styles);
  const allPages = order.reduce((sum, c) => sum + pagesOf(c), 0);
  // The book's contents, for a table of contents in any chapter; a line goes to its chapter or heading.
  const numbered = order.map((chapter, i) => ({ chapter, number: i + 1 }));
  const msShown = shownOutline(project, state.chapters, state.keywordFilter);
  const startOf = (c: Chapter) => order.slice(0, order.indexOf(c)).reduce((sum, x) => sum + pagesOf(x), 0);
  const onTocTarget = useCallback(
    (t: { chapter: string; block?: string }) => {
      const ed = editors[t.chapter];
      if (ed && t.block) ed.goToBlock(t.block);
      else scroll.current?.querySelector(`[data-chapter="${t.chapter}"]`)?.scrollIntoView({ block: 'start' });
    },
    [editors],
  );

  // Choosing a chapter in the outline scrolls to it.
  const target = state.chapterId;
  useEffect(() => {
    if (!target) return;
    const box = scroll.current;
    const el = box?.querySelector<HTMLElement>(`[data-chapter="${target}"]`);
    // Scroll only the manuscript (scrollIntoView would move the whole window too).
    if (box && el && !el.contains(document.activeElement)) box.scrollTo({ top: box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - 8, behavior: 'smooth' });
  }, [target]);

  let number = 0;
  let offset = 0;
  let part: string | undefined;
  return (
    <section ref={msRef} className="pane find-host" aria-label="Manuscript" onKeyDown={onFindKey}>
      {finding && (
        <FindBar
          targets={order.map((c) => ({ id: c.id, doc: c.doc, editor: editors[c.id] ?? null, label: c.title || 'Untitled chapter' }))}
          onReplaceDoc={(id, doc) => store.setChapterDoc(id, doc)}
          author={state.settings.trackChanges ? state.settings.name.trim() || 'You' : null}
          sheet={sheet}
          onClose={() => setFinding(false)}
        />
      )}
      {stylesOpen && (
        <StylesDialog
          title={`Styles for ${project.name}`}
          sheet={sheet}
          onChange={(s) => store.setProjectStyles(project.id, s)}
          page={pageSetup}
          onPage={(page) => store.setProjectPage(project.id, page)}
          onClose={() => setStylesOpen(false)}
          chapters
          initial={typeof stylesOpen === 'string' ? stylesOpen : undefined}
          sources={styleSources}
          onDefault={() => store.updateSettings({ defaultStyles: sheet })}
        />
      )}
      <div className={`note-pane manuscript ${styles}`}>
        <div className="note-toolbar" role="toolbar" aria-label="Formatting">
          {narrow && (
            <button type="button" className="icon-btn back" aria-label="Back to outline" onClick={onBack}>
              <IconBack size={18} />
              <span className="back-label">Outline</span>
            </button>
          )}
          {!floating && !narrow && <FormatTools fit editor={active} readOnly={false} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={(key?: string) => setStylesOpen(key ?? true)} page={pageSetup} onPage={(pg) => store.setProjectPage(project.id, pg)} chapters />}
          <span className="grow" />
          <span className="manuscript-count">{words(total)}</span>
          <RevisionChip />
          <TrackToggle editor={active} />
          <button type="button" className="icon-btn" aria-label="Find and replace" data-tip={`Find and replace · ${isMac ? '⌘F' : 'Ctrl+F'}`} onClick={() => setFinding(true)}>
            <IconSearch size={16} />
          </button>
          {!narrow && <PageToggle on={paged} onChange={(on) => store.updateSettings({ pageView: { ...state.settings.pageView, projects: on } })} />}
          {!narrow && (
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
        </div>
        {narrow && active && (
          <KeyboardBar host={scroll}>
            <FormatTools compact editor={active} readOnly={false} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={(key?: string) => setStylesOpen(key ?? true)} page={pageSetup} onPage={(pg) => store.setProjectPage(project.id, pg)} chapters />
          </KeyboardBar>
        )}
        {floating && active && (
          <SelectionBar host={scroll}>
            <FormatTools compact attach={false} editor={active} readOnly={false} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={(key?: string) => setStylesOpen(key ?? true)} page={pageSetup} onPage={(pg) => store.setProjectPage(project.id, pg)} chapters />
          </SelectionBar>
        )}
        {linkOpen && active && <LinkBar editor={active} onClose={() => setLinkOpen(false)} />}
        <div className="note-main">
        <div className="note-scroll" ref={scroll}>
          <article className={`note-body manuscript-body${paged ? ' paged' : ''}`}>
            <h1 className="manuscript-title">{project.name}</h1>
            {state.keywordFilter && <p className="ms-filter">Showing the chapters with “{state.keywordFilter}”.</p>}
            {project.outline.map((item) => {
              if (item.type === 'part') {
                part = item.title;
                if (!msShown.has(item.id)) return null;
                return (
                  <h2 key={item.id} className="ms-part">
                    {item.title}
                  </h2>
                );
              }
              const c = chapters.get(item.id);
              if (!c) return null;
              number += 1;
              if (!msShown.has(item.id)) return null;
              const before = offset;
              offset += pagesOf(c);
              return (
                <ManuscriptChapter
                  key={c.id}
                  chapter={c}
                  number={number}
                  page={paged ? pageSetup : null}
                  sheetClass={styles}
                  onPage={(page) => store.setProjectPage(project.id, page)}
                  fields={{ title: project.name, chapter: number, chapterTitle: c.title, part, words: total, created: project.createdAt, updated: project.updatedAt }}
                  offset={before}
                  total={allPages}
                  onPages={onPages}
                  onActive={(ed) => {
                    setActive(ed);
                    setTick((t) => t + 1);
                    if (state.chapterId !== c.id) store.selectChapter(c.id);
                  }}
                  onEditor={onEditor}
                  onLinkKey={() => setLinkOpen(true)}
                  toc={bookEntries(numbered, c.id, startOf, pagesOf)}
                  footnoteStart={footnotesBefore(numbered, c.id)}
                  onTocTarget={onTocTarget}
                />
              );
            })}
            <button type="button" className="btn quiet ms-add" onClick={() => store.addChapter(project.id)}>
              <IconPlus size={13} /> Add a chapter
            </button>
          </article>
        </div>
        </div>
        {paged && msEditors.length > 0 && <StatusBar editors={msEditors} scroller={scroll} />}
      </div>
    </section>
  );
}

interface ManuscriptChapterProps {
  chapter: Chapter;
  number: number;
  page: PageSetup | null;
  sheetClass: string;
  onActive(ed: Editor): void;
  /** Tells the manuscript this chapter's editor (null when it goes). */
  onEditor(id: string, ed: Editor | null): void;
  toc: TocEntry[];
  onTocTarget(t: { chapter: string; block?: string }): void;
  /** Footnotes in the chapters before, so the numbers run on. */
  footnoteStart: number;
  onLinkKey(): void;
  onPage(p: PageSetup): void;
  fields: PageFields;
  /** Pages before this chapter, and in the whole manuscript. */
  offset: number;
  total: number;
  onPages(chapterId: string, n: number): void;
}

function ManuscriptChapter({ chapter, number, page, sheetClass, onActive, onEditor, onLinkKey, onPage, fields, offset, total, onPages, toc, onTocTarget, footnoteStart }: ManuscriptChapterProps) {
  const store = useAppStore();
  const reportPages = useCallback((n: number) => onPages(chapter.id, n), [onPages, chapter.id]);
  const nav = useNav();
  const owner = useAppState().projects.find((p) => p.id === chapter.projectId);
  const { host, editor } = useDocEditor({
    docId: chapter.id,
    doc: chapter.doc,
    readOnly: false,
    onDoc: (doc) => store.setChapterDoc(chapter.id, doc),
    onActive,
    onLinkKey,
    onNoteLink: (title) => nav.openTitle(title),
  });
  useTracking(editor);
  useTypewriter(editor);
  const msSheet = useMemo(() => fullSheet(owner?.styles, 'manuscript'), [owner?.styles]);
  useFontKeys(editor, msSheet);
  useDocFontsLoaded(editor);
  useParaKeys(editor);
  useBookToc(editor, chapter.id, toc, offset, onTocTarget);
  useFootnoteStart(editor, footnoteStart);
  useEffect(() => {
    if (!editor) return;
    onEditor(chapter.id, editor);
    return () => onEditor(chapter.id, null);
  }, [editor, chapter.id, onEditor]);
  return (
    <section className="ms-chapter" data-chapter={chapter.id} aria-label={chapter.title || `Chapter ${number}`}>
      <SlashMenu editor={editor} host={host} notes={store.getState().notes} />
      {owner && <CastSpotting editor={editor} project={owner} />}
      <FootnoteCard editor={editor} />
      <CommentCard editor={editor} />
      <ChangeCard editor={editor} />
      <ChangesBar doc={chapter.doc} editor={editor} />
      <p className="chapter-kicker">Chapter {numberInWords(number)}</p>
      <AutoTextarea className="note-title ms-title" aria-label={`Title of chapter ${number}`} placeholder="Chapter title" value={chapter.title} onChange={(e) => store.setChapterTitle(chapter.id, e.target.value.replace(/\n/g, ' '))} />
      <span className="chapter-rule" aria-hidden="true" />
      <PageView
        enabled={!!page}
        editor={editor}
        sheet={msSheet}
        page={page ?? manuscriptPage()}
        sheetClass={sheetClass}
        onPage={onPage}
        fields={fields}
        place={{ offset, chapterStart: true, total }}
        chapters
        onPages={reportPages}
      >
        <div ref={host} className="note-editor" aria-label={`Text of chapter ${number}`} />
      </PageView>
      {!page && <FootnoteList doc={chapter.doc} editor={editor} />}
      <EndnoteList doc={chapter.doc} editor={editor} />
      <CommentList doc={chapter.doc} editor={editor} />
    </section>
  );
}

/** The book's contents for a chapter's editor (a component, so the chapter view can use the hook beside its editor). */
function BookToc({ editor, chapterId, entries, offset, onTarget, footnoteStart }: { editor: Editor | null; chapterId: string; entries: TocEntry[]; offset: number; onTarget(t: { chapter: string; block?: string }): void; footnoteStart: number }) {
  useBookToc(editor, chapterId, entries, offset, onTarget);
  useFootnoteStart(editor, footnoteStart);
  return null;
}
