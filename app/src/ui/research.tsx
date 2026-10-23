// A project's research: notes, web clippings, pictures and PDFs kept with
// the project, listed under its outline and opened beside the writing; and
// notes linked in from the notebooks, which stay where they are.

import { useEffect, useMemo, useRef, useState } from 'react';
import { type Doc, makeBlock } from '@crumpet/editor/model';
import { isBoard } from '../data/board';
import { addFile, mediaUrl } from '../data/files';
import { isLocked } from '../data/lock';
import { fullSheet } from '../data/styles';
import type { Note, Project } from '../data/types';
import { displayTitle } from '../data/selectors';
import { useAppState, useAppStore, useAutoHeight } from './hooks';
import { EditorHost } from './EditorHost';
import { IconChevron, IconClose, IconLink, IconMore, IconNote, IconPlus } from './icons';
import { tabDrag } from './tabdrag';
import { Popover } from './Sidebar';

type Kind = 'note' | 'picture' | 'pdf' | 'file' | 'clipping';

/** What a research item is, from what's in it. */
export function researchKind(n: Note): Kind {
  const first = n.doc.blocks.find((b) => b.type !== 'paragraph' || b.runs.length);
  if (n.tags.includes('clipped')) return 'clipping';
  if (n.doc.blocks.length <= 2 && first?.type === 'image') return 'picture';
  if (n.doc.blocks.length <= 2 && first?.type === 'file') return /\.pdf$/i.test(first.src ?? '') ? 'pdf' : 'file';
  return 'note';
}

const KIND_LABEL: Record<Kind, string> = { note: 'Note', picture: 'Picture', pdf: 'PDF', file: 'File', clipping: 'Web clipping' };
const KIND_GLYPH: Record<Kind, string> = { note: '¶', picture: '▣', pdf: 'PDF', file: '⎙', clipping: '✂' };

/** Picks pictures and PDFs (or any file) and adds each to the project's research. */
export function addResearchFiles(store: ReturnType<typeof useAppStore>, projectId: string): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*,application/pdf,.pdf';
  input.onchange = async () => {
    const files = Array.from(input.files ?? []);
    let last: Note | null = null;
    for (const f of files) {
      try {
        const added = await addFile(f);
        const doc: Doc = { blocks: [makeBlock(added.type, added.type === 'file' ? added.caption : '', [], { src: added.src })] };
        last = store.addResearchNote(projectId, { title: f.name.replace(/\.[^.]+$/, ''), doc }, false);
      } catch (err) {
        alert(err instanceof Error ? err.message : `${f.name} couldn’t be added.`);
      }
    }
    if (last) store.openResearch(last.id);
  };
  input.click();
}

/** Can a note be linked into a book? Not a locked note or a board, which need their own view. */
export const linkable = (n: Note) => !n.projectId && n.trashedAt === null && !isLocked(n.doc) && !isBoard(n);

/** Picks a note from the notebooks to link into a book: a search box over the notes not linked yet. */
function LinkPicker({ project, onDone }: { project: Project; onDone(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const [query, setQuery] = useState('');
  const linked = new Set(project.linked ?? []);
  const q = query.trim().toLowerCase();
  const found = state.notes
    .filter((n) => linkable(n) && !linked.has(n.id) && (!q || displayTitle(n).toLowerCase().includes(q)))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);
  return (
    <>
      <input className="link-search" autoFocus aria-label="Find a note to link" placeholder="Find a note…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && found[0] && (store.linkNote(project.id, found[0].id), onDone())} />
      {found.map((n) => (
        <button
          key={n.id}
          type="button"
          className="menu-item"
          onClick={() => {
            store.linkNote(project.id, n.id);
            onDone();
          }}
        >
          <span className="ellipsis">{displayTitle(n)}</span>
        </button>
      ))}
      {!found.length && <p className="menu-hint">{q ? 'No notes match.' : 'Every note is linked already.'}</p>}
    </>
  );
}

/** The research list under a project's outline. */
/** `phone`: in a phone's book, under its Research tab: a heading and rows like the library's, always open. */
export function ResearchList({ project, phone = false }: { project: Project; phone?: boolean }) {
  const state = useAppState();
  const store = useAppStore();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState<'menu' | 'link' | null>(null);
  const items = useMemo(() => state.notes.filter((n) => n.projectId === project.id && n.trashedAt === null).sort((a, b) => a.title.localeCompare(b.title)), [state.notes, project.id]);
  const linked = store.linkedNotes(project.id);
  // A linked note drags out as the note it is.
  const row = (n: Note, glyph: React.ReactNode) => (
    <li key={n.id}>
      <button type="button" className={`research-item${state.researchId === n.id ? ' selected' : ''}`} aria-current={state.researchId === n.id ? 'true' : undefined} onClick={() => store.openResearch(state.researchId === n.id ? null : n.id)} {...tabDrag({ kind: n.projectId ? 'research' : 'note', id: n.id })}>
        {glyph}
        <span className="grow ellipsis">{displayTitle(n)}</span>
      </button>
    </li>
  );
  return (
    <section className="research" aria-label="Research">
      <div className="research-head">
        {phone ? (
          <h2 className="research-title">Research</h2>
        ) : (
          <button type="button" className="research-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            <IconChevron size={10} className={open ? 'rot90' : ''} />
            Research
            <span className="count">{items.length + linked.length}</span>
          </button>
        )}
        <span className="grow" />
        <span className="note-actions">
          <button type="button" className="icon-btn" aria-label="Add research" aria-expanded={!!adding} onClick={() => setAdding(adding ? null : 'menu')}>
            <IconPlus size={phone ? 20 : 14} />
          </button>
          {adding === 'link' && (
            <Popover label="Link a note" onClose={() => setAdding(null)}>
              <LinkPicker project={project} onDone={() => setAdding(null)} />
            </Popover>
          )}
          {adding === 'menu' && (
            <Popover label="Add research" onClose={() => setAdding(null)}>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setAdding(null);
                  store.addResearchNote(project.id);
                }}
              >
                New research note
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setAdding(null);
                  addResearchFiles(store, project.id);
                }}
              >
                Pictures or PDFs…
              </button>
              <button type="button" className="menu-item" onClick={() => setAdding('link')}>
                Link a note…
              </button>
              <p className="menu-hint">Web pages: use the web clipper and choose this project.</p>
            </Popover>
          )}
        </span>
      </div>
      {(open || phone) && (
        <ul className="research-items">
          {items.length + linked.length === 0 && <li className="research-empty">Notes, web clippings, pictures and PDFs for this project, and notes linked from your notebooks.</li>}
          {items.map((n) => {
            const kind = researchKind(n);
            return row(
              n,
              <span className={`research-glyph ${kind}`} aria-label={KIND_LABEL[kind]}>
                {KIND_GLYPH[kind]}
              </span>,
            );
          })}
          {items.length > 0 && linked.length > 0 && <li className="cast-divider" aria-hidden="true" />}
          {linked.map((n) =>
            row(
              n,
              <span className="research-glyph linked" aria-label="Linked note" title="Linked from your notes">
                <IconLink size={11} />
              </span>,
            ),
          )}
        </ul>
      )}
    </section>
  );
}

/** A PDF shown in the page, from wherever it's kept. */
function PdfView({ src }: { src: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.resolve(mediaUrl(src)).then(
      (u) => live && setUrl(u),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [src]);
  if (failed) return <p className="research-missing">This PDF isn’t on this device yet.</p>;
  if (!url) return null;
  return (
    <div className="pdf-view">
      <iframe title="PDF" src={url} />
      <a href={url} target="_blank" rel="noopener noreferrer" className="link-btn">
        Open in a new tab
      </a>
    </div>
  );
}

/** A research note, open beside the writing. `linkedTo`: the book a note from the notebooks is linked into. */
export function ResearchPane({ note, linkedTo, onClose }: { note: Note; linkedTo?: string; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const sheet = useMemo(() => fullSheet(state.settings.noteStyles, 'crumpet'), [state.settings.noteStyles]);
  const [menu, setMenu] = useState(false);
  const title = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(title);
  const kind = researchKind(note);
  const pdf = kind === 'pdf' ? note.doc.blocks.find((b) => b.type === 'file')?.src : undefined;

  // A new, empty note starts with the cursor in its title.
  useEffect(() => {
    if (!note.title && Date.now() - note.createdAt < 2000) title.current?.focus();
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="research-pane" aria-label="Research note">
      <EditorHost
        docId={note.id}
        doc={note.doc}
        onDoc={(doc) => store.setDoc(note.id, doc)}
        readOnly={false}
        sheet={sheet}
        label="Research note text"
        lead={
          <span className="research-kind">
            {linkedTo ? (
              <>
                <IconLink size={13} /> Linked note
              </>
            ) : (
              <>
                <IconNote size={13} /> Research
              </>
            )}
          </span>
        }
        trail={
          <div className="note-actions">
            <button type="button" className="icon-btn" aria-label="Research options" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <IconMore size={16} />
            </button>
            {menu && (
              <Popover label="Research options" onClose={() => setMenu(false)}>
                {linkedTo ? (
                  <>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        setMenu(false);
                        store.setView({ kind: 'all' });
                        store.select(note.id);
                      }}
                    >
                      Show in notes
                    </button>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        setMenu(false);
                        store.unlinkNote(linkedTo, note.id);
                        onClose();
                      }}
                    >
                      Unlink from this book
                    </button>
                    <p className="menu-hint">Unlinking keeps the note in your notes.</p>
                  </>
                ) : (
                  <>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setMenu(false);
                    store.setResearchProject(note.id, null);
                    onClose();
                  }}
                >
                  Move to notes
                </button>
                <button
                  type="button"
                  className="menu-item danger"
                  onClick={() => {
                    setMenu(false);
                    store.trashNote(note.id);
                    onClose();
                  }}
                >
                  Move to Trash
                </button>
                  </>
                )}
              </Popover>
            )}
            <button type="button" className="icon-btn" aria-label="Close research" title="Close" onClick={onClose}>
              <IconClose size={15} />
            </button>
          </div>
        }
        header={
          <>
            <textarea ref={title} rows={1} className="note-title research-title" aria-label="Title" placeholder="Untitled" value={note.title} onChange={(e) => store.setTitle(note.id, e.target.value.replace(/\n/g, ' '))} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
            {pdf && <PdfView src={pdf} />}
          </>
        }
        footer={null}
      />
    </section>
  );
}
