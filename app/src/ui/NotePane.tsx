import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { defaultPage, fullSheet } from '../data/styles';
import { PageToggle } from './pages';
import { StylesDialog } from './styles-ui';
import type { StyleKey } from '../data/styles';
import type { Editor } from '@crumpet/editor/editor';
import { useAppState, useAppStore, useNav } from './hooks';
import { allTags, displayTitle, docWords, longTime, notebookTree, wordCount } from '../data/selectors';
import { backlinks } from '../data/links';
import { EditorHost } from './EditorHost';
import { chooseFiles, isMac } from './editing';
import { FindBar, useFindKey } from './find';
import { Tour } from './Tour';
import { DOCX_TYPE, EPUB_TYPE, docxName, download, fileName, noteDocx, noteEpub } from '../data/wordfiles';
import { PrintJob } from './print';
import { makeBlock } from '@crumpet/editor/model';
import { ReminderButton } from './reminders';
import { IconBack, IconSearch, IconCopy, IconDownload, IconFocus, IconPage, IconPicture, IconPrint, IconBook, IconMore, IconNotebook, IconPen, IconRestore, IconStar, IconStarFilled, IconTag, IconTrash, Logo, NotebookIcon } from './icons';
import { BoardView } from './board';
import { isBoard } from '../data/board';
import { InlineInput, Popover } from './Sidebar';

interface PaneProps {
  onBack(): void;
  narrow: boolean;
  onNewNote(): void;
  onNewProject(): void;
  /** The note it shows (in a pane's tab); otherwise the selected note. */
  noteId?: string | null;
}

export function NotePane({ onBack, narrow, onNewNote, onNewProject, noteId }: PaneProps) {
  const state = useAppState();
  const store = useAppStore();
  const nav = useNav();
  const note = store.note(noteId === undefined ? state.selectedId : noteId);
  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [reading, setReading] = useState(false);
  const [stylesOpen, setStylesOpen] = useState<StyleKey | boolean>(false);
  const [printing, setPrinting] = useState(false);
  const [finding, setFinding] = useState(false);
  const onFindKey = useFindKey(() => setFinding(true));
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

  if (!note && !state.notes.length && !state.projects.length) {
    return (
      <section className="pane-empty" aria-label="Welcome">
        <Welcome onNewNote={onNewNote} onNewProject={onNewProject} />
      </section>
    );
  }

  if (!note) {
    return (
      <section className="pane-empty" aria-label="Note">
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

  const togglePage = () => store.updateSettings({ pageView: { ...state.settings.pageView, notes: !paged } });
  const trail = trashed ? null : (
    <div className="note-actions">
      {!narrow && (
        <>
          <button type="button" className="icon-btn focus-btn" aria-label="Focus mode" data-tip={`Focus mode · ${isMac ? '⌘⇧F' : 'Ctrl+Shift+F'}`} onClick={() => store.setFocusMode(true)}>
            <IconFocus size={16} />
          </button>
          <PageToggle on={paged} onChange={togglePage} />
          <button type="button" className={`icon-btn read-toggle${reading ? ' on' : ''}`} aria-pressed={reading} aria-label={reading ? 'Back to editing' : 'Reading view'} data-tip={reading ? 'Back to editing (Esc)' : 'Reading view'} onClick={() => setReading(!reading)}>
            {reading ? <IconPen size={16} /> : <IconBook size={16} />}
          </button>
        </>
      )}
      {narrow && reading && (
        <button type="button" className="icon-btn read-toggle on" aria-pressed="true" aria-label="Back to editing" onClick={() => setReading(false)}>
          <IconPen size={16} />
        </button>
      )}
      {!note.projectId && <ReminderButton note={note} />}
      <button type="button" className={`icon-btn${note.favorite ? ' on' : ''}`} aria-pressed={note.favorite} aria-label={note.favorite ? 'Remove from Favorites' : 'Add to Favorites'} data-tip={note.favorite ? 'Remove from Favorites' : 'Add to Favorites'} onClick={() => store.toggleFavorite(note.id)}>
        {note.favorite ? <IconStarFilled size={16} /> : <IconStar size={16} />}
      </button>
      <button type="button" className="icon-btn" aria-label="More" data-tip="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>
        <IconMore size={16} />
      </button>
      {menu && (
        <Popover onClose={() => setMenu(false)} label="Note options">
          {narrow && (
            <>
              <p className="menu-label">View</p>
              <button type="button" className="menu-item" onClick={() => (setMenu(false), setReading(!reading))}>
                <IconBook size={14} /> {reading ? 'Back to editing' : 'Reading view'}
              </button>
              <button type="button" className="menu-item" aria-pressed={paged} onClick={() => (setMenu(false), togglePage())}>
                <IconPage size={14} /> {paged ? 'Page view: on' : 'Page view'}
              </button>
              <button type="button" className="menu-item" onClick={() => (setMenu(false), store.setFocusMode(true))}>
                <IconFocus size={14} /> Focus mode
              </button>
              <hr className="menu-sep" />
            </>
          )}
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setMenu(false);
              setFinding(true);
            }}
          >
            <IconSearch size={14} /> Find and replace <small className="menu-hint">{isMac ? '⌘F' : 'Ctrl+F'}</small>
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setMenu(false);
              if (editorRef.current) chooseFiles(editorRef.current);
            }}
          >
            <IconPicture size={14} /> Add a picture or file…
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setMenu(false);
              store.saveAsTemplate(note.id);
            }}
          >
            <IconCopy size={14} /> Save as template
          </button>
          <hr className="menu-sep" />
          <p className="menu-label">Download or print</p>
          <button
            type="button"
            className="menu-item"
            aria-label="Download as Word document"
            onClick={async () => {
              setMenu(false);
              download(await noteDocx(store.getState(), note), docxName(note.title), DOCX_TYPE);
            }}
          >
            <IconDownload size={14} /> Word document <small className="menu-hint">.docx</small>
          </button>
          <button
            type="button"
            className="menu-item"
            aria-label="Download as e-book (ePub)"
            onClick={async () => {
              setMenu(false);
              download(await noteEpub(store.getState(), note), fileName(note.title, 'epub'), EPUB_TYPE);
            }}
          >
            <IconDownload size={14} /> E-book <small className="menu-hint">.epub</small>
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setMenu(false);
              setPrinting(true);
            }}
          >
            <IconPrint size={14} /> Print or save as PDF
          </button>
          <hr className="menu-sep" />
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
      {printing && (
        <PrintJob
          title={displayTitle(note)}
          parts={[{ id: note.id, doc: note.title.trim() ? { blocks: [makeBlock('paragraph', note.title, [], { style: 'title' }), ...note.doc.blocks] } : note.doc, fields: { title: displayTitle(note), words: docWords(note.doc), created: note.createdAt, updated: note.updatedAt } }]}
          page={pageSetup}
          sheet={sheet}
          onDone={() => setPrinting(false)}
        />
      )}
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
  const linkedFrom = backlinks(note, state.notes);
  const footer = (
    <>
      {linkedFrom.length > 0 && (
        <section className="backlinks" aria-label="Linked from">
          <h2>
            Linked from {linkedFrom.length} note{linkedFrom.length === 1 ? '' : 's'}
          </h2>
          <div className="backlink-list">
            {linkedFrom.map((n) => (
              <button key={n.id} type="button" className="backlink" onClick={() => nav.openNote(n.id)}>
                {displayTitle(n)}
              </button>
            ))}
          </div>
        </section>
      )}
      <p className="note-foot">
        {words} word{words === 1 ? '' : 's'} · Edited {longTime(note.updatedAt)} · Created {longTime(note.createdAt)}
      </p>
    </>
  );

  return (
    isBoard(note) ? (
      <section className="pane board-pane" aria-label="Board">
        <div className="note-toolbar" role="toolbar" aria-label="Board options">
          {lead}
          <span className="grow" />
          {trail}
        </div>
        <div className="board-header">{header}</div>
        <BoardView key={note.id} note={note} />
      </section>
    ) :
    <section className="pane find-host" aria-label="Note" onKeyDown={trashed ? undefined : onFindKey}>
      {finding && !trashed && (
        <FindBar
          targets={[{ id: note.id, doc: note.doc, editor: editorRef.current }]}
          onReplaceDoc={(id, doc) => store.setDoc(id, doc)}
          author={state.settings.trackChanges ? state.settings.name.trim() || 'You' : null}
          onClose={() => setFinding(false)}
        />
      )}
      {stylesOpen && (
        <StylesDialog
          title="Styles for notes"
          sheet={sheet}
          onChange={(noteStyles) => store.updateSettings({ noteStyles })}
          page={pageSetup}
          onPage={(notePage) => store.updateSettings({ notePage })}
          onClose={() => setStylesOpen(false)}
          initial={typeof stylesOpen === 'string' ? stylesOpen : undefined}
        />
      )}
      <EditorHost
        sheet={sheet}
        page={paged ? pageSetup : null}
        onPage={(notePage) => store.updateSettings({ notePage })}
        pageFields={{ title: note.title, words, created: note.createdAt, updated: note.updatedAt }}
        onEditStyles={(key) => setStylesOpen(key ?? true)}
        onSheet={(noteStyles) => store.updateSettings({ noteStyles })}
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
  const [touring, setTouring] = useState(false);
  return (
    <div className="welcome">
      {touring && <Tour onDone={() => setTouring(false)} />}
      <Logo size={72} />
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
      <p className="welcome-tour">
        New here?{' '}
        <button type="button" className="link-btn" onClick={() => setTouring(true)}>
          Show me around
        </button>
      </p>
    </div>
  );
}
