// A project (a book, an essay, a thesis): its outline of parts and chapters,
// and the writing, one chapter at a time or as one long manuscript.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fullSheet, manuscriptPage } from '../data/styles';
import { chapterPages, rememberPages } from '../data/pagecount';
import { type PageFields, PageToggle, PageView } from './pages';
import { StylesDialog, useSheetClass } from './styles-ui';
import type { Editor } from '@crumpet/editor/editor';
import { chapterWords, projectChapters, projectGoal, projectWords } from '../data/selectors';
import { dayKey, wordsToday } from '../data/stats';
import { pace } from '../data/deadline';
import type { Chapter, ChapterStatus, Project } from '../data/types';
import type { PageSetup, StyleKey, StyleSheet } from '../data/styles';
import { useOfferHelped } from './helpers';
import { bookEntries, goToLater, useBookToc } from './booktoc';
import type { TocEntry } from '@crumpet/editor/view';
import { EditorHost } from './EditorHost';
import { FormatTools, KeyboardBar, LinkBar, SelectionBar, isMac, useDocEditor } from './editing';
import { FindBar, useFindKey } from './find';
import { useTypewriter } from './typewriter';
import { useDocFontsLoaded, useFontKeys } from './fonttools';
import { useParaKeys } from './paratools';
import { StatusBar } from './statusbar';
import { useAppState, useAppStore, useNav } from './hooks';
import { IconBack, IconFocus, IconMore, IconPlus, IconSearch } from './icons';
import { InlineInput, Popover } from './Sidebar';
import { SlashMenu } from './slash';
import { FootnoteCard, FootnoteList } from './footnotes';
import { CommentCard, CommentList } from './comments';
import { ChangeCard, ChangesBar, TrackToggle, useTracking } from './changes';
import { DOCX_TYPE, EPUB_TYPE, docxName, download, fileName, projectDocx, projectEpub } from '../data/wordfiles';
import { PrintJob } from './print';
import { ResearchList, ResearchPane } from './research';
import { Corkboard } from './corkboard';
import { CastList, CastPane, CastSpotting } from './cast';
import { FoldButton } from './fold';
import { startTabDrag } from './tabdrag';
import { makeBlock } from '@crumpet/editor/model';

export const STATUSES: { id: ChapterStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'draft', label: 'Draft' },
  { id: 'revised', label: 'Revised' },
  { id: 'done', label: 'Done' },
];

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

export function ProjectOutline({ project, onOpenChapter }: { project: Project; onOpenChapter(id: string): void }) {
  const state = useAppState();
  const store = useAppStore();
  const [menu, setMenu] = useState<null | 'menu' | 'rename' | 'goal' | 'deadline' | 'delete'>(null);
  const [itemMenu, setItemMenu] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const printParts = useMemo(
    () =>
      printing
        ? projectChapters(project, state.chapters).map(({ chapter, number, part }) => ({
            id: chapter.id,
            doc: { blocks: [makeBlock('heading1', chapter.title || `Chapter ${number}`), ...chapter.doc.blocks] },
            fields: { title: project.name, chapter: number, chapterTitle: chapter.title, part: part?.title, words: chapterWords(chapter) },
          }))
        : [],
    [printing, project, state.chapters],
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const chapters = new Map(projectChapters(project, state.chapters).map((x) => [x.chapter.id, x]));
  const total = projectWords(project, state.chapters);
  const goal = projectGoal(project, state.chapters);
  const mode = state.projectMode;

  const drop = () => {
    if (dragging && dropAt !== null) store.moveOutlineItem(project.id, dragging, dropAt);
    setDragging(null);
    setDropAt(null);
  };

  return (
    <section className="list outline" aria-label="Outline">
      {printing && <PrintJob title={project.name} parts={printParts} page={project.page ?? manuscriptPage()} sheet={fullSheet(project.styles, 'manuscript')} chapters onDone={() => setPrinting(false)} />}
      <header className="list-head">
        <div className="list-title">
          {menu === 'rename' ? (
            <InlineInput
              label="Project name"
              initial={project.name}
              onDone={(name) => {
                setMenu(null);
                if (name) store.renameProject(project.id, name);
              }}
            />
          ) : (
            <h1>{project.name}</h1>
          )}
          <span className="grow" />
          <div className="note-actions">
            <button type="button" className="icon-btn" aria-label="Project options" aria-expanded={menu === 'menu'} onClick={() => setMenu(menu ? null : 'menu')}>
              <IconMore size={16} />
            </button>
            {(menu === 'menu' || menu === 'delete' || menu === 'goal' || menu === 'deadline') && (
              <Popover onClose={() => setMenu(null)} label="Project options">
                {menu === 'menu' && (
                  <>
                    <button type="button" className="menu-item" onClick={() => setMenu('rename')}>
                      Rename project
                    </button>
                    <button type="button" className="menu-item" onClick={() => setMenu('goal')}>
                      Word goal…
                    </button>
                    <button type="button" className="menu-item" onClick={() => setMenu('deadline')}>
                      Deadline…
                    </button>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={async () => {
                        setMenu(null);
                        download(await projectDocx(store.getState(), project), docxName(project.name), DOCX_TYPE);
                      }}
                    >
                      Download as Word document
                    </button>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        setMenu(null);
                        setPrinting(true);
                      }}
                    >
                      Print or save as PDF
                    </button>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={async () => {
                        setMenu(null);
                        download(await projectEpub(store.getState(), project), fileName(project.name, 'epub'), EPUB_TYPE);
                      }}
                    >
                      Download as e-book (ePub)
                    </button>
                    <button type="button" className="menu-item danger" onClick={() => setMenu('delete')}>
                      Delete project
                    </button>
                  </>
                )}
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
                      Delete project
                    </button>
                  </div>
                )}
              </Popover>
            )}
          </div>
          <FoldButton what="list" />
        </div>
        <div className="list-sub">
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
          </div>
        </div>
        <Progress value={total} goal={goal} label="Project progress" />
        {project.deadline && goal ? <DeadlineLine project={project} goal={goal} total={total} onEdit={() => setMenu('deadline')} /> : null}
      </header>

      <ol className="outline-items" onDragOver={(e) => dragging && e.preventDefault()} onDrop={drop}>
        {project.outline.map((item, index) => {
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
                  <span className="outline-num">{number}.</span>
                  <span className="grow ellipsis outline-title">{c.title || 'Untitled chapter'}</span>
                  <span className="outline-words">{c.goal ? `${n.toLocaleString()} / ${c.goal.toLocaleString()}` : n.toLocaleString()}</span>
                </span>
                {c.synopsis && <span className="outline-synopsis">{c.synopsis}</span>}
                {c.goal ? <Progress value={n} goal={c.goal} label={`Progress of ${c.title || 'chapter'}`} /> : null}
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

      <div className="outline-add">
        <button type="button" className="btn" aria-label="Add chapter" onClick={() => store.addChapter(project.id)}>
          <IconPlus size={13} /> Chapter
        </button>
        <button type="button" className="btn quiet" aria-label="Add part" onClick={() => setRenaming(store.addPart(project.id) ?? null)}>
          <IconPlus size={13} /> Part
        </button>
      </div>
      {chapters.size > 1 && (
        <ul className="status-key" aria-label="What the dots mean">
          {STATUSES.map((s) => (
            <li key={s.id}>
              <span className={`status-dot ${s.id}`} aria-hidden="true" /> {s.label}
            </li>
          ))}
        </ul>
      )}
      <CastList project={project} />
      <ResearchList project={project} />
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
  const research = state.notes.find((n) => n.id === state.researchId && n.projectId === project.id && n.trashedAt === null);
  const member = project.cast?.find((m) => m.id === state.castId);
  if (!research && !member) return <ProjectWriting project={project} narrow={narrow} onBack={onBack} />;
  // On a phone, closing a card or research note goes back to the book's outline.
  const close = (clear: () => void) => () => {
    clear();
    if (narrow) onBack();
  };
  const pane = member ? <CastPane key={member.id} project={project} member={member} narrow={narrow} onClose={close(() => store.openCast(null))} /> : <ResearchPane key={research!.id} note={research!} onClose={close(() => store.openResearch(null))} />;
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
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  });
  return <textarea ref={ref} rows={1} {...props} />;
}

export function ChapterPane({ project, chapter, narrow, onBack }: { project: Project; chapter: Chapter; narrow: boolean; onBack(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const editorRef = useRef<Editor | null>(null);
  const [chapterEditor, setChapterEditor] = useState<Editor | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState<StyleKey | boolean>(false);
  const [finding, setFinding] = useState(false);
  const [findScope, setFindScope] = useState<'chapter' | 'book'>('chapter');
  const onFindKey = useFindKey(() => setFinding(true));
  const sheet = useMemo(() => fullSheet(project.styles, 'manuscript'), [project.styles]);
  const pageSetup = project.page ?? manuscriptPage();
  const paged = state.settings.pageView?.projects ?? true;
  const list = projectChapters(project, state.chapters);
  const at = list.findIndex((x) => x.chapter.id === chapter.id);
  const prev = list[at - 1]?.chapter;
  const next = list[at + 1]?.chapter;
  const part = list[at]?.part;
  const n = chapterWords(chapter);
  const total = projectWords(project, state.chapters);
  const styles = useSheetClass(sheet);

  useEffect(() => setGoalOpen(false), [chapter.id]);

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

  const lead = narrow ? (
    <button type="button" className="icon-btn back" aria-label="Back to outline" onClick={onBack}>
      <IconBack size={18} />
    </button>
  ) : null;

  const trail = (
    <div className="note-actions">
      <button type="button" className="icon-btn focus-btn" aria-label="Focus mode" data-tip={`Focus mode · ${isMac ? '⌘⇧F' : 'Ctrl+Shift+F'}`} onClick={() => store.setFocusMode(true)}>
        <IconFocus size={16} />
      </button>
      <PageToggle on={paged} onChange={(on) => store.updateSettings({ pageView: { ...state.settings.pageView, projects: on } })} />
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
      <p className="chapter-kicker">{[part?.title, `Chapter ${at + 1}`].filter(Boolean).join(' · ')}</p>
      <AutoTextarea
        className="note-title"
        aria-label="Chapter title"
        placeholder="Chapter title"
        value={chapter.title}
        onChange={(e) => store.setChapterTitle(chapter.id, e.target.value.replace(/\n/g, ' '))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            editorRef.current?.focusAt('start');
          }
        }}
      />
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
      <AutoTextarea className="synopsis" aria-label="Synopsis" placeholder="Synopsis: what happens in this chapter" value={chapter.synopsis} onChange={(e) => store.setChapterSynopsis(chapter.id, e.target.value)} />
    </>
  );

  const footer = (
    <p className="note-foot">
      {words(n)} · {project.name}: {words(projectWords(project, state.chapters))}
    </p>
  );

  const bookTargets = list.map(({ chapter: c }) => ({ id: c.id, doc: c.doc, editor: c.id === chapter.id ? chapterEditor : null }));
  return (
    <section className="pane find-host" aria-label="Chapter" onKeyDown={onFindKey}>
      {finding && (
        <FindBar
          targets={findScope === 'book' ? bookTargets : bookTargets.filter((t) => t.id === chapter.id)}
          onReplaceDoc={(id, doc) => store.setChapterDoc(id, doc)}
          onGoTo={(id) => store.selectChapter(id)}
          author={state.settings.trackChanges ? state.settings.name.trim() || 'You' : null}
          scopes={[
            { id: 'chapter', label: 'This chapter' },
            { id: 'book', label: 'Whole book' },
          ]}
          scope={findScope}
          onScope={(id) => setFindScope(id as 'chapter' | 'book')}
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
        onEditStyles={(key?: StyleKey) => setStylesOpen(key ?? true)}
        onSheet={(styles) => store.setProjectStyles(project.id, styles)}
        docId={chapter.id}
        doc={chapter.doc}
        onDoc={(doc) => store.setChapterDoc(chapter.id, doc)}
        readOnly={false}
        label="Chapter text"
        lead={lead}
        trail={trail}
        header={header}
        footer={footer}
        onEditor={(ed) => {
          editorRef.current = ed;
          setChapterEditor(ed);
        }}
      />
      <CastSpotting editor={chapterEditor} project={project} />
      <BookToc editor={chapterEditor} chapterId={chapter.id} entries={tocEntries} offset={offset} onTarget={onTocTarget} />
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
  const helped = useMemo(() => (active ? { editor: active, docId: activeId, sheet: fullSheet(project.styles, 'manuscript'), onSheet: (styles: StyleSheet) => store.setProjectStyles(project.id, styles), onEditStyles: (key?: StyleKey) => setStylesOpen(key ?? true) } : null), [active, activeId, project.id, project.styles, store]);
  useOfferHelped(helped, msRef);
  const [linkOpen, setLinkOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState<StyleKey | boolean>(false);
  const sheet = useMemo(() => fullSheet(project.styles, 'manuscript'), [project.styles]);
  const styles = useSheetClass(sheet);
  const pageSetup = project.page ?? manuscriptPage();
  const paged = state.settings.pageView?.projects ?? true;
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
          targets={order.map((c) => ({ id: c.id, doc: c.doc, editor: editors[c.id] ?? null }))}
          onReplaceDoc={(id, doc) => store.setChapterDoc(id, doc)}
          author={state.settings.trackChanges ? state.settings.name.trim() || 'You' : null}
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
        />
      )}
      <div className={`note-pane manuscript ${styles}`}>
        <div className="note-toolbar" role="toolbar" aria-label="Formatting">
          {narrow && (
            <button type="button" className="icon-btn back" aria-label="Back to outline" onClick={onBack}>
              <IconBack size={18} />
            </button>
          )}
          {!floating && !narrow && <FormatTools fit editor={active} readOnly={false} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={(key?: StyleKey) => setStylesOpen(key ?? true)} page={pageSetup} onPage={(pg) => store.setProjectPage(project.id, pg)} chapters />}
          <span className="grow" />
          <span className="manuscript-count">{words(total)}</span>
          <TrackToggle />
          <button type="button" className="icon-btn" aria-label="Find and replace" data-tip={`Find and replace · ${isMac ? '⌘F' : 'Ctrl+F'}`} onClick={() => setFinding(true)}>
            <IconSearch size={16} />
          </button>
          <PageToggle on={paged} onChange={(on) => store.updateSettings({ pageView: { ...state.settings.pageView, projects: on } })} />
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
            <FormatTools compact editor={active} readOnly={false} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={(key?: StyleKey) => setStylesOpen(key ?? true)} page={pageSetup} onPage={(pg) => store.setProjectPage(project.id, pg)} chapters />
          </KeyboardBar>
        )}
        {floating && active && (
          <SelectionBar host={scroll}>
            <FormatTools compact attach={false} editor={active} readOnly={false} onLink={() => setLinkOpen(true)} sheet={sheet} onEditStyles={(key?: StyleKey) => setStylesOpen(key ?? true)} page={pageSetup} onPage={(pg) => store.setProjectPage(project.id, pg)} chapters />
          </SelectionBar>
        )}
        {linkOpen && active && <LinkBar editor={active} onClose={() => setLinkOpen(false)} />}
        <div className="note-main">
        <div className="note-scroll" ref={scroll}>
          <article className={`note-body manuscript-body${paged ? ' paged' : ''}`}>
            <h1 className="manuscript-title">{project.name}</h1>
            {project.outline.map((item) => {
              if (item.type === 'part') {
                part = item.title;
                return (
                  <h2 key={item.id} className="ms-part">
                    {item.title}
                  </h2>
                );
              }
              const c = chapters.get(item.id);
              if (!c) return null;
              number += 1;
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
  onLinkKey(): void;
  onPage(p: PageSetup): void;
  fields: PageFields;
  /** Pages before this chapter, and in the whole manuscript. */
  offset: number;
  total: number;
  onPages(chapterId: string, n: number): void;
}

function ManuscriptChapter({ chapter, number, page, sheetClass, onActive, onEditor, onLinkKey, onPage, fields, offset, total, onPages, toc, onTocTarget }: ManuscriptChapterProps) {
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
      <p className="chapter-kicker">Chapter {number}</p>
      <AutoTextarea className="note-title ms-title" aria-label={`Title of chapter ${number}`} placeholder="Chapter title" value={chapter.title} onChange={(e) => store.setChapterTitle(chapter.id, e.target.value.replace(/\n/g, ' '))} />
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
      <CommentList doc={chapter.doc} editor={editor} />
    </section>
  );
}

/** The book's contents for a chapter's editor (a component, so the chapter view can use the hook beside its editor). */
function BookToc({ editor, chapterId, entries, offset, onTarget }: { editor: Editor | null; chapterId: string; entries: TocEntry[]; offset: number; onTarget(t: { chapter: string; block?: string }): void }) {
  useBookToc(editor, chapterId, entries, offset, onTarget);
  return null;
}
