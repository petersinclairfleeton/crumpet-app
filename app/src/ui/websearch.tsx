// Web search in the right sidebar (Word's Researcher and Smart Lookup):
// Wikipedia's articles for what's typed, each with its first lines, to open,
// save as a research note (in a project's Research, or as a note), cite as a
// source, or link to. "Search the web" opens the words in a search engine.

import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { makeBlock } from '@crumpet/editor/model';
import { useAppState, useAppStore } from './hooks';
import { sourceKey } from '../data/citations';

interface Hit {
  title: string;
  snippet: string;
}

const WIKI = 'https://en.wikipedia.org';
const plain = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
};

/** Wikipedia's articles for `q`, with a little of each. */
export async function searchWikipedia(q: string): Promise<Hit[]> {
  const res = await fetch(`${WIKI}/w/api.php?action=query&list=search&format=json&origin=*&utf8=1&srlimit=10&srsearch=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Wikipedia didn’t answer.');
  const data = (await res.json()) as { query?: { search?: { title: string; snippet: string }[] } };
  return (data.query?.search ?? []).map((h) => ({ title: h.title, snippet: plain(h.snippet) }));
}

/** An article's opening paragraph. */
async function summary(title: string): Promise<string> {
  const res = await fetch(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  if (!res.ok) return '';
  const data = (await res.json()) as { extract?: string };
  return data.extract ?? '';
}

export function WebSearchTab({ editor, docId }: { editor: Editor; docId: string }) {
  const state = useAppState();
  const store = useAppStore();
  const [q, setQ] = useState(() => (window.getSelection()?.toString() ?? '').trim().slice(0, 80));
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Record<string, string>>({});
  // A chapter or research note belongs to a project: what's saved goes into its Research.
  const projectId = state.chapters.find((c) => c.id === docId)?.projectId ?? state.notes.find((n) => n.id === docId)?.projectId ?? null;
  const go = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setError('');
    try {
      setHits(await searchWikipedia(q.trim()));
    } catch {
      setError('Couldn’t reach Wikipedia. Are you online?');
      setHits(null);
    } finally {
      setBusy(false);
    }
  };
  const url = (title: string) => `${WIKI}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const save = async (h: Hit) => {
    const text = (await summary(h.title).catch(() => '')) || h.snippet;
    const doc = { blocks: [makeBlock('paragraph', text), makeBlock('paragraph', '', [], { runs: [{ text: 'From Wikipedia: ', marks: [] }, { text: h.title, marks: [], link: url(h.title) }] })] };
    if (projectId) store.addResearchNote(projectId, { title: h.title, doc, tags: ['web'] }, false);
    else store.createNote({ title: h.title, doc, tags: ['web'] }, false);
    setDone({ ...done, [h.title]: projectId ? 'Saved to Research' : 'Saved as a note' });
  };
  const cite = (h: Hit) => {
    const sources = state.settings.sources ?? [];
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let key = sources.find((s) => s.url === url(h.title))?.key;
    if (!key) {
      const draft = { type: 'web' as const, authors: 'Wikipedia contributors', title: h.title, container: 'Wikipedia', year: String(today.getFullYear()), url: url(h.title), accessed: iso };
      key = sourceKey(draft, sources.map((s) => s.key));
      store.updateSettings({ sources: [...sources, { ...draft, key }] });
    }
    editor.focus();
    editor.insertField(`cite:${key}`);
    setDone({ ...done, [h.title]: 'Cited' });
  };
  const link = (h: Hit) => {
    editor.focus();
    editor.paste({ text: h.title, md: `[${h.title.replace(/([[\]\\])/g, '\\$1')}](${url(h.title)})` });
  };
  return (
    <div className="web-search">
      <form
        className="web-search-box"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
      >
        <input type="search" aria-label="Search Wikipedia" placeholder="Search Wikipedia" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn small" disabled={busy || !q.trim()}>
          {busy ? '…' : 'Search'}
        </button>
      </form>
      {q.trim() && (
        <a className="web-search-more" href={`https://duckduckgo.com/?q=${encodeURIComponent(q.trim())}`} target="_blank" rel="noopener noreferrer">
          Search the whole web for “{q.trim()}” ↗
        </a>
      )}
      {error && <p className="error">{error}</p>}
      {hits && !hits.length && <p className="right-empty">Nothing found on Wikipedia.</p>}
      {hits && hits.length > 0 && (
        <ul className="web-hits" aria-label="Results">
          {hits.map((h) => (
            <li key={h.title}>
              <a href={url(h.title)} target="_blank" rel="noopener noreferrer" className="web-hit-title">
                {h.title}
              </a>
              <p className="web-hit-text">{h.snippet}</p>
              <div className="web-hit-actions">
                {done[h.title] ? (
                  <span className="web-done" role="status">
                    ✓ {done[h.title]}
                  </span>
                ) : (
                  <>
                    <button type="button" className="btn small quiet" onClick={() => void save(h)}>
                      Save to research
                    </button>
                    <button type="button" className="btn small quiet" onClick={() => cite(h)}>
                      Cite
                    </button>
                    <button type="button" className="btn small quiet" onClick={() => link(h)}>
                      Link
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!hits && !error && <p className="right-empty">Look something up without leaving your writing: articles from Wikipedia, to save as research, cite or link to.</p>}
    </div>
  );
}
