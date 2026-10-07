import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { defaultPage, fullSheet } from '../data/styles';
import { PageToggle } from './pages';
import { StylesDialog } from './styles-ui';
import type { Editor } from '@crumpet/editor/editor';
import { useAppState, useAppStore } from './hooks';
import { allTags, docWords, longTime, notebookTree, wordCount } from '../data/selectors';
import { EditorHost } from './EditorHost';
import { IconBack, IconFocus, IconBook, IconClose, IconMore, IconNotebook, IconPen, IconRestore, IconStar, IconStarFilled, IconTag, IconTrash, NotebookIcon } from './icons';
import { InlineInput, Popover } from './Sidebar';

interface PaneProps {
  onBack(): void;
  narrow: boolean;
  onNewNote(): void;
  onNewProject(): void;
  /** With two notes open: which side this is, the note it shows, and closing it. */
  side?: 'first' | 'second';
  noteId?: string | null;
  onCloseSide?(): void;
}

export function NotePane({ onBack, narrow, onNewNote, onNewProject, side, noteId, onCloseSide }: PaneProps) {
  const state = useAppState();
  const store = useAppStore();
  const note = store.note(noteId === undefined ? state.selectedId : noteId);
  // Clicking or typing in one of two notes makes it the side the next note opens in.
  const sideProps = side
    ? {
        'data-side': side,
        onMouseDownCapture: () => store.setActiveSide(side),
        onFocusCapture: () => store.setActiveSide(side),
      }
    : {};
  const closeSide = onCloseSide ? (
    <button type="button" className="icon-btn" aria-label="Close this side" title="Back to one note" onClick={onCloseSide}>
      <IconClose size={15} />
    </button>
  ) : null;
  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [reading, setReading] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);
  const sheet = useMemo(() => fullSheet(state.settings.noteStyles, 'crumpet'), [state.settings.noteStyles]);
  const pageSetup = state.settings.notePage ?? defaultPage();
  const paged = !!state.settings.pageView?.notes;

  // Escape leaves reading view.
  useEffect(() => {
    if (!reading) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setReading(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reading]);

  // The title wraps onto more lines as needed.
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  });

  // A brand-new, empty note starts with the cursor in its title.
  useEffect(() => {
    if (note && !note.title && Date.now() - note.createdAt < 2000 && note.createdAt === note.updatedAt) titleRef.current?.focus();
    setMenu(false);
    setAddingTag(false);
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!note && side === 'second') {
    return (
      <section {...sideProps} className={`pane-empty${state.activeSide === side ? ' side-active' : ''}`} aria-label="Second note">
        <div className="side-empty-pane">
          <p>Choose a note in the list to open it here.</p>
          {closeSide}
        </div>
      </section>
    );
  }

  if (!note && !state.notes.length && !state.projects.length) {
    return (
      <section className="pane-empty" aria-label="Welcome">
        <Welcome onNewNote={onNewNote} onNewProject={onNewProject} />
      </section>
    );
  }

  if (!note) {
    return (
      <section {...sideProps} className={`pane-empty${side && state.activeSide === side ? ' side-active' : ''}`} aria-label="Note">
        <p>Choose a note, or start a new one.</p>
      </section>
    );
  }

  const trashed = note.trashedAt !== null;
  const nb = store.notebook(note.notebookId);
  const { loose, stacks } = notebookTree(state.stacks, state.notebooks);
  const knownTags = allTags(state.notes).map((t) => t.tag).filter((t) => !note.tags.includes(t));

  const lead = narrow ? (
    <button type="button" className="icon-btn back" aria-label="Back to notes" onClick={onBack}>
      <IconBack size={18} />
    </button>
  ) : null;

  const trail = trashed ? closeSide : (
    <div className="note-actions">
      <button type="button" className="icon-btn focus-btn" aria-label="Focus mode" title="Focus mode (Ctrl+Shift+F)" onClick={() => store.setFocusMode(true)}>
        <IconFocus size={16} />
      </button>
      <PageToggle on={paged} onChange={(on) => store.updateSettings({ pageView: { ...state.settings.pageView, notes: on } })} />
      <button type="button" className={`icon-btn read-toggle${reading ? ' on' : ''}`} aria-pressed={reading} aria-label={reading ? 'Back to editing' : 'Reading view'} title={reading ? 'Back to editing (Esc)' : 'Reading view'} onClick={() => setReading(!reading)}>
        {reading ? <IconPen size={16} /> : <IconBook size={16} />}
      </button>
      <button type="button" className={`icon-btn${note.favorite ? ' on' : ''}`} aria-pressed={note.favorite} aria-label={note.favorite ? 'Remove from Favorites' : 'Add to Favorites'} title={note.favorite ? 'Remove from Favorites' : 'Add to Favorites'} onClick={() => store.toggleFavorite(note.id)}>
        {note.favorite ? <IconStarFilled size={16} /> : <IconStar size={16} />}
      </button>
      <button type="button" className="icon-btn" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>
        <IconMore size={16} />
      </button>
      {menu && (
        <Popover onClose={() => setMenu(false)} label="Note options">
          <button
            type="button"
            className="menu-item danger"
            onClick={() => {
              setMenu(false);
              store.trashNote(note.id);
              if (narrow) onBack();
            }}
          >
            <IconTrash size={14} /> Move to Trash
          </button>
        </Popover>
      )}
      {closeSide}
    </div>
  );

  const header = (
    <>
      {trashed && (
        <div className="trash-banner" role="status">
          <span>This note is in the Trash.</span>
          <button type="button" className="btn" onClick={() => store.restoreNote(note.id)}>
            <IconRestore size={14} /> Restore
          </button>
          <button type="button" className="btn danger" onClick={() => store.deleteForever(note.id)}>
            Delete forever
          </button>
        </div>
      )}
      <textarea
        ref={titleRef}
        className="note-title"
        aria-label="Title"
        placeholder="Title"
        rows={1}
        value={note.title}
        readOnly={trashed || reading}
        onChange={(e) => store.setTitle(note.id, e.target.value.replace(/\n/g, ' '))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || (e.key === 'ArrowDown' && !e.shiftKey)) {
            e.preventDefault();
            editorRef.current?.focusAt('start');
          }
        }}
      />
      <p className="reading-meta">
        {[nb?.name, longTime(note.updatedAt), `${wordCount(note)} words`].filter(Boolean).join(' · ')}
      </p>
      <div className="note-meta">
        <label className="nb-picker" title="Notebook">
          {nb ? <NotebookIcon color={nb.color} size={11} cut="var(--chip)" /> : <IconNotebook size={12} />}
          <span className="visually-hidden">Notebook</span>
          <select value={note.notebookId ?? ''} disabled={trashed} onChange={(e) => store.moveNote(note.id, e.target.value || null)}>
            <option value="">No notebook</option>
            {loose.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
            {stacks.filter((s) => s.notebooks.length).map((s) => (
              <optgroup key={s.stack.id} label={s.stack.name}>
                {s.notebooks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {note.tags.map((t) => (
          <span key={t} className="tag-chip">
            #{t}
            {!trashed && (
              <button type="button" aria-label={`Remove tag ${t}`} onClick={() => store.removeTag(note.id, t)}>
                ×
              </button>
            )}
          </span>
        ))}
        {!trashed &&
          (addingTag ? (
            <InlineInput
              label="New tag"
              placeholder="tag"
              list={knownTags}
              onDone={(tag) => {
                setAddingTag(false);
                if (tag) store.addTag(note.id, tag);
              }}
            />
          ) : (
            <button type="button" className="add-tag" onClick={() => setAddingTag(true)}>
              <IconTag size={12} /> Add tag
            </button>
          ))}
      </div>
    </>
  );

  const words = docWords(note.doc);
  const footer = (
    <p className="note-foot">
      {words} word{words === 1 ? '' : 's'} · Edited {longTime(note.updatedAt)} · Created {longTime(note.createdAt)}
    </p>
  );

  return (
    <section {...sideProps} className={`pane${side && state.activeSide === side ? ' side-active' : ''}`} aria-label={side === 'second' ? 'Second note' : 'Note'}>
      {stylesOpen && (
        <StylesDialog
          title="Styles for notes"
          sheet={sheet}
          onChange={(noteStyles) => store.updateSettings({ noteStyles })}
          page={pageSetup}
          onPage={(notePage) => store.updateSettings({ notePage })}
          onClose={() => setStylesOpen(false)}
        />
      )}
      <EditorHost
        sheet={sheet}
        page={paged ? pageSetup : null}
        onPage={(notePage) => store.updateSettings({ notePage })}
        pageFields={{ title: note.title, words, created: note.createdAt, updated: note.updatedAt }}
        onEditStyles={() => setStylesOpen(true)}
        docId={note.id}
        doc={note.doc}
        onDoc={(doc) => store.setDoc(note.id, doc)}
        readOnly={trashed || reading}
        reading={reading && !trashed}
        lead={lead}
        trail={trail}
        header={header}
        footer={footer}
        onEditor={(ed) => {
          editorRef.current = ed;
        }}
      />
    </section>
  );
}

/** The first visit: three ways to start. */
function Welcome({ onNewNote, onNewProject }: { onNewNote(): void; onNewProject(): void }) {
  return (
    <div className="welcome">
      <h2>Welcome to Crumpet</h2>
      <p className="lede">A quiet place for notes and long writing. Your words stay in files you own.</p>
      <ol>
        <li>
          <button type="button" onClick={onNewNote}>
            <span>
              <b>Write your first note</b>
              <small>Just start typing. You can file it later.</small>
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={onNewProject}>
            <span>
              <b>Start a book or long piece</b>
              <small>Chapters you can reorder, in manuscript format.</small>
            </span>
          </button>
        </li>
        <li>
          <a href="#connect">
            <span>
              <b>Keep your notes in Google Drive</b>
              <small>Sign in once and your notes follow you to every device.</small>
            </span>
          </a>
        </li>
      </ol>
    </div>
  );
}
