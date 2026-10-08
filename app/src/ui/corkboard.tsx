// The corkboard: a project's chapters as index cards, each with its title,
// synopsis and status, to see the shape of the book and drag it around.

import { useState } from 'react';
import { chapterWords, projectChapters } from '../data/selectors';
import type { Project } from '../data/types';
import { useAppState, useAppStore } from './hooks';
import { IconBack, IconPlus } from './icons';
import { STATUSES, shownOutline } from './Project';
import { KeywordChips } from './keywords';

export function Corkboard({ project, narrow, onBack }: { project: Project; narrow: boolean; onBack(): void }) {
  const state = useAppState();
  const shown = shownOutline(project, state.chapters, state.keywordFilter);
  const store = useAppStore();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const chapters = new Map(projectChapters(project, state.chapters).map((x) => [x.chapter.id, x]));

  const drop = () => {
    if (dragging && dropAt !== null) store.moveOutlineItem(project.id, dragging, dropAt);
    setDragging(null);
    setDropAt(null);
  };
  const open = (id: string) => {
    store.selectChapter(id);
    store.setProjectMode('chapter');
  };

  return (
    <section className="pane corkboard-pane" aria-label="Corkboard">
      <div className="note-toolbar" role="toolbar" aria-label="Corkboard">
        {narrow && (
          <button type="button" className="icon-btn back" aria-label="Back to outline" onClick={onBack}>
            <IconBack size={18} />
          </button>
        )}
        <span className="corkboard-hint">Drag the cards to reorder. Click a title to write.</span>
        <span className="grow" />
        <button type="button" className="btn quiet" onClick={() => store.addChapter(project.id)}>
          <IconPlus size={13} /> Card
        </button>
      </div>
      <div className="corkboard" onDragOver={(e) => dragging && e.preventDefault()} onDrop={drop}>
        {project.outline.map((item, index) => {
          if (!shown.has(item.id)) return null;
          const dropClass = dropAt === index ? ' drop-before' : dropAt === index + 1 && index === project.outline.length - 1 ? ' drop-after' : '';
          const drag = {
            draggable: true,
            onDragStart: (e: React.DragEvent) => {
              // Typing in a card's fields shouldn't start a drag.
              if ((e.target as HTMLElement).closest('input, textarea, select')) return e.preventDefault();
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', item.id);
              setDragging(item.id);
            },
            onDragEnd: () => {
              setDragging(null);
              setDropAt(null);
            },
            onDragOver: (e: React.DragEvent) => {
              if (!dragging) return;
              e.preventDefault();
              const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const before = item.type === 'part' ? e.clientY < box.top + box.height / 2 : e.clientX < box.left + box.width / 2;
              setDropAt(before ? index : index + 1);
            },
          };
          if (item.type === 'part') {
            return (
              <h2 key={item.id} className={`cork-part${dragging === item.id ? ' dragging' : ''}${dropClass}`} {...drag}>
                {item.title}
              </h2>
            );
          }
          const entry = chapters.get(item.id);
          if (!entry) return null;
          const { chapter: c, number } = entry;
          const n = chapterWords(c);
          return (
            <article key={c.id} className={`cork-card status-${c.status}${dragging === c.id ? ' dragging' : ''}${dropClass}`} aria-label={`Chapter ${number}: ${c.title || 'Untitled'}`} {...drag}>
              <header>
                <span className="cork-num">{number}</span>
                <button type="button" className="cork-title" onClick={() => open(c.id)} title="Open this chapter">
                  {c.title || 'Untitled chapter'}
                </button>
              </header>
              <textarea className="cork-synopsis" aria-label={`Synopsis of chapter ${number}`} placeholder="What happens…" value={c.synopsis} onChange={(e) => store.setChapterSynopsis(c.id, e.target.value)} />
              <KeywordChips chapter={c} />
              <footer>
                <select aria-label={`Status of chapter ${number}`} value={c.status} onChange={(e) => store.setChapterStatus(c.id, e.target.value as typeof c.status)}>
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <span className="cork-words">{c.goal ? `${n.toLocaleString()} / ${c.goal.toLocaleString()}` : `${n.toLocaleString()} words`}</span>
              </footer>
            </article>
          );
        })}
        {!project.outline.length && <p className="cork-empty">No chapters yet. Add a card to start.</p>}
      </div>
    </section>
  );
}
