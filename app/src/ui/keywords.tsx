// Keyword chips on chapters (in the chapter's header, the outline and the
// cards), adding and removing them, and the outline's filter by keyword.

import { useState } from 'react';
import type { Chapter, Project } from '../data/types';
import { hasKeyword, keywordColor, projectKeywords } from '../data/keywords';
import { useAppState, useAppStore } from './hooks';
import { InlineInput } from './Sidebar';
import { IconClose } from './icons';

/** A chapter's keywords, read-only and small (outline rows, cards). */
export function KeywordChips({ chapter }: { chapter: Chapter }) {
  const list = chapter.keywords ?? [];
  if (!list.length) return null;
  return (
    <span className="keyword-chips">
      {list.map((k) => (
        <span key={k} className="keyword-chip small" style={{ '--kw': keywordColor(k) } as React.CSSProperties}>
          {k}
        </span>
      ))}
    </span>
  );
}

/** A chapter's keywords with × to remove, and + Keyword to add one (suggesting the project's others). */
export function KeywordEditor({ chapter }: { chapter: Chapter }) {
  const state = useAppState();
  const store = useAppStore();
  const [adding, setAdding] = useState(false);
  const list = chapter.keywords ?? [];
  const others = projectKeywords(state.chapters, chapter.projectId).filter((k) => !list.some((x) => x.toLowerCase() === k.toLowerCase()));
  return (
    <span className="keyword-editor">
      {list.map((k) => (
        <span key={k} className="keyword-chip" style={{ '--kw': keywordColor(k) } as React.CSSProperties}>
          {k}
          <button type="button" aria-label={`Remove keyword ${k}`} title="Remove" onClick={() => store.setChapterKeywords(chapter.id, list.filter((x) => x !== k))}>
            <IconClose size={9} />
          </button>
        </span>
      ))}
      {adding ? (
        <InlineInput
          label="New keyword"
          placeholder="Keyword"
          list={others}
          onDone={(k) => {
            setAdding(false);
            if (k?.trim()) store.setChapterKeywords(chapter.id, [...list, k]);
          }}
        />
      ) : (
        <button type="button" className="add-tag" onClick={() => setAdding(true)} title="Keywords: a point of view, plot thread or place, to filter chapters by">
          + Keyword
        </button>
      )}
    </span>
  );
}

/** Shows only the chapters with one keyword, across the outline, cards and manuscript. */
export function KeywordFilter({ project }: { project: Project }) {
  const state = useAppState();
  const store = useAppStore();
  const words = projectKeywords(state.chapters, project.id);
  const current = state.keywordFilter;
  if (!words.length && !current) return null;
  return (
    <label className="keyword-filter">
      <span>Show</span>
      <select aria-label="Show chapters with keyword" value={current ?? ''} onChange={(e) => store.setKeywordFilter(e.target.value || null)}>
        <option value="">All chapters</option>
        {words.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      {current && <span className="keyword-filter-dot" style={{ background: keywordColor(current) }} aria-hidden="true" />}
    </label>
  );
}

export { hasKeyword };
