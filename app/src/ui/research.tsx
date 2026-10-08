// A project's research: notes, web clippings, pictures and PDFs kept with
// the project, listed under its outline and opened beside the writing.

import { useEffect, useMemo, useRef, useState } from 'react';
import { type Doc, makeBlock } from '@crumpet/editor/model';
import { addFile, mediaUrl } from '../data/files';
import { fullSheet } from '../data/styles';
import type { Note, Project } from '../data/types';
import { displayTitle } from '../data/selectors';
import { useAppState, useAppStore } from './hooks';
import { EditorHost } from './EditorHost';
import { IconChevron, IconClose, IconMore, IconNote, IconPlus } from './icons';
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

/** The research list under a project's outline. */
export function ResearchList({ project }: { project: Project }) {
  const state = useAppState();
  const store = useAppStore();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const items = useMemo(() => state.notes.filter((n) => n.projectId === project.id && n.trashedAt === null).sort((a, b) => a.title.localeCompare(b.title)), [state.notes, project.id]);
  return (
    <section className="research" aria-label="Research">
      <div className="research-head">
        <button type="button" className="research-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <IconChevron size={10} className={open ? 'rot90' : ''} />
          Research
          <span className="count">{items.length}</span>
        </button>
        <span className="grow" />
        <span className="note-actions">
          <button type="button" className="icon-btn" aria-label="Add research" aria-expanded={adding} onClick={() => setAdding(!adding)}>
            <IconPlus size={14} />
          </button>
          {adding && (
            <Popover label="Add research" onClose={() => setAdding(false)}>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setAdding(false);
                  store.addResearchNote(project.id);
                }}
              >
                New research note
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setAdding(false);
                  addResearchFiles(store, project.id);
                }}
              >
                Pictures or PDFs…
              </button>
              <p className="menu-hint">Web pages: use the web clipper and choose this project.</p>
            </Popover>
          )}
        </span>
      </div>
      {open && (
        <ul className="research-items">
          {items.length === 0 && <li className="research-empty">Notes, web clippings, pictures and PDFs for this project.</li>}
          {items.map((n) => {
            const kind = researchKind(n);
            return (
              <li key={n.id}>
                <button type="button" className={`research-item${state.researchId === n.id ? ' selected' : ''}`} aria-current={state.researchId === n.id ? 'true' : undefined} onClick={() => store.openResearch(state.researchId === n.id ? null : n.id)}>
                  <span className={`research-glyph ${kind}`} aria-label={KIND_LABEL[kind]}>
                    {KIND_GLYPH[kind]}
                  </span>
                  <span className="grow ellipsis">{displayTitle(n)}</span>
                </button>
              </li>
            );
          })}
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

/** A research note, open beside the writing. */
export function ResearchPane({ note, onClose }: { note: Note; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const sheet = useMemo(() => fullSheet(state.settings.noteStyles, 'crumpet'), [state.settings.noteStyles]);
  const [menu, setMenu] = useState(false);
  const title = useRef<HTMLInputElement>(null);
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
            <IconNote size={13} /> Research
          </span>
        }
        trail={
          <div className="note-actions">
            <button type="button" className="icon-btn" aria-label="Research options" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <IconMore size={16} />
            </button>
            {menu && (
              <Popover label="Research options" onClose={() => setMenu(false)}>
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
              </Popover>
            )}
            <button type="button" className="icon-btn" aria-label="Close research" title="Close" onClick={onClose}>
              <IconClose size={15} />
            </button>
          </div>
        }
        header={
          <>
            <input ref={title} className="note-title research-title" aria-label="Title" placeholder="Untitled" value={note.title} onChange={(e) => store.setTitle(note.id, e.target.value)} />
            {pdf && <PdfView src={pdf} />}
          </>
        }
        footer={null}
      />
    </section>
  );
}
