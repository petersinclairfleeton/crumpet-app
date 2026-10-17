import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { defaultPage, fullSheet } from '../data/styles';
import { PageToggle } from './pages';
import { ExportItems } from './exportmenu';
import { LockedNote, PasswordDialog, removePassword, useOpened } from './locked';
import { isLocked } from '../data/lock';
import { StylesDialog, useStyleSources } from './styles-ui';
import type { Editor } from '@crumpet/editor/editor';
import { useAppState, useAppStore, useNav, useSync } from './hooks';
import { recentNotes, viewTitle, allTags, displayTitle, docWords, editedText, longTime, notebookTree, wordCount } from '../data/selectors';
import { backlinks } from '../data/links';
import { EditorHost } from './EditorHost';
import { chooseFiles, isMac } from './editing';
import { FindBar, useFindKey } from './find';
import { Tour } from './Tour';
import { openGuide } from './guide';
import { DOCX_TYPE, EPUB_TYPE, docxName, download, fileName, noteDocx, noteEpub } from '../data/wordfiles';
import { PrintJob } from './print';
import { makeBlock } from '@crumpet/editor/model';
import { ReminderButton } from './reminders';
import { IconInbox, IconPlus, IconBack, IconBell, IconSearch, IconCopy, IconDownload, IconLock, IconFocus, IconPage, IconPicture, IconPrint, IconBook, IconMore, IconNotebook, IconPen, IconRestore, IconRightPanel, IconShare, IconStar, IconStarFilled, IconTag, IconTrash, NotebookIcon } from './icons';
import { BoardView } from './board';
import { FileView, WordBanner, chooseUploads, downloadFile, uploadFiles } from './uploads';
import { fileKind } from '../data/documents';
import { boardOf, isBoard } from '../data/board';
import { InlineInput, Popover } from './Sidebar';
import { ShowButton } from './fold';
import { tagColour } from '../data/selectors';
import { toMarkdown } from '@crumpet/editor/markdown';

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
  // On a phone the menu's download formats wait behind one row, like a submenu.
  const [downloads, setDownloads] = useState(false);
  const [remind, setRemind] = useState(0);
  const [addingTag, setAddingTag] = useState(false);
  // On the calm phone the notebook and tags wait in the menu (design 5).
  const [showMeta, setShowMeta] = useState(false);
  const [reading, setReading] = useState(false);
  const [stylesOpen, setStylesOpen] = useState<string | boolean>(false);
  const [printing, setPrinting] = useState(false);
  const [finding, setFinding] = useState(false);
  const [protecting, setProtecting] = useState(false);
  // A note with a password: its text once opened (in memory only), saved locked again as it changes.
  const opened = useOpened(note?.id ?? '');
  const onFindKey = useFindKey(() => setFinding(true));
  const sheet = useMemo(() => fullSheet(state.settings.noteStyles, 'crumpet'), [state.settings.noteStyles]);
  const styleSources = useStyleSources('notes');
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
  const locked = isLocked(note.doc);
  // What the note shows: its text, or a locked note's opened text.
  const shownDoc = locked ? opened.doc : note.doc;
  const nb = store.notebook(note.notebookId);
  const { loose, stacks } = notebookTree(state.stacks, state.notebooks);
  const knownTags = allTags(state.notes).map((t) => t.tag).filter((t) => !note.tags.includes(t));

  // The writing room: the calm sidebar folded to its strip and the list away. The page's top shows
  // where the note is and its words, and the tools float over selected text.
  const room = !state.settings.toolbarAll && !narrow && state.settings.layout?.list === false && !paged && !reading;
  const noteWords = docWords(note.doc);
  const lead = narrow ? (
    <button type="button" className="icon-btn back" aria-label="Back to notes" onClick={onBack}>
      <IconBack size={18} />
      <span className="back-label">Notes</span>
    </button>
  ) : room ? (
    <>
      <button type="button" className="icon-btn back" aria-label="Back to the list" onClick={() => store.updateLayout({ list: true })}>
        <IconBack size={18} />
      </button>
      <p className="room-crumbs">
        <span>{state.query.trim() ? 'Search' : viewTitle(state.view, state)}</span>
        <span aria-hidden="true">/</span>
        <span className="here">{displayTitle(note)}</span>
      </p>
    </>
  ) : null;

  const togglePage = () => store.updateSettings({ pageView: { ...state.settings.pageView, notes: !paged } });
  // The calm look keeps the corner to the star and the menu: the views wait in the menu.
  const calm = !state.settings.toolbarAll;
  const viewsInMenu = narrow || calm;
  // The calm phone (designs 5 and 10): Share beside the menu; the star, notebook and tags inside it.
  const phone = calm && narrow;
  const share = async () => {
    const text = toMarkdown(note.doc);
    if (navigator.share) await navigator.share({ title: displayTitle(note), text }).catch(() => {});
    else await navigator.clipboard?.writeText(text).catch(() => {});
  };
  // Word, e-book, the other formats and printing: in the menu on a computer, behind Download a copy… on a phone.
  const downloadItems = () => (
    <>
      <button
        type="button"
        className="menu-item"
        aria-label="Download as Word document"
        onClick={async () => {
          setMenu(false);
          // An uploaded Word document: its own file.
          if (note.file && fileKind(note.file) === 'word') await downloadFile(note.file);
          else download(await noteDocx(store.getState(), { ...note, doc: shownDoc ?? note.doc }), docxName(note.title), DOCX_TYPE);
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
          download(await noteEpub(store.getState(), { ...note, doc: shownDoc ?? note.doc }), fileName(note.title, 'epub'), EPUB_TYPE);
        }}
      >
        <IconDownload size={14} /> E-book <small className="menu-hint">.epub</small>
      </button>
      <ExportItems title={note.title} parts={() => [{ doc: shownDoc ?? note.doc }]} onDone={() => setMenu(false)} />
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
    </>
  );
  // The calm look keeps its five tools on show at the top of the page, unless asked to float them over selected text.
  const toolsAtRest = state.settings.toolbar !== 'selection';
  const trail = trashed ? null : (
    <div className="note-actions">
      {calm && paged && !narrow && (
        <button type="button" className="btn small back-to-writing" onClick={togglePage}>
          Back to writing view
        </button>
      )}
      {!viewsInMenu && (
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
      {viewsInMenu && reading && (
        <button type="button" className="icon-btn read-toggle on" aria-pressed="true" aria-label="Back to editing" onClick={() => setReading(false)}>
          <IconPen size={16} />
        </button>
      )}
      {room && (
        <>
          <span className="room-words">
            {noteWords.toLocaleString()} word{noteWords === 1 ? '' : 's'}
          </span>
          <button type="button" className="btn quiet small room-focus" onClick={() => store.setFocusMode(true)}>
            Focus
          </button>
        </>
      )}
      {!note.projectId && <ReminderButton note={note} quiet={calm} ask={remind} />}
      {phone ? (
        <button type="button" className="icon-btn" aria-label="Share" onClick={share}>
          <IconShare size={18} />
        </button>
      ) : (
      <button type="button" className={`icon-btn${note.favorite ? ' on' : ''}`} aria-pressed={note.favorite} aria-label={note.favorite ? 'Remove from Favourites' : 'Add to Favourites'} data-tip={note.favorite ? 'Remove from Favourites' : 'Add to Favourites'} onClick={() => store.toggleFavorite(note.id)}>
        {note.favorite ? <IconStarFilled size={16} /> : <IconStar size={16} />}
      </button>
      )}
      {/* The inspector's one switch, on the page: open, it stays here to close it (as beside a chapter). */}
      {calm && !narrow && !state.settings.layout?.right && <ShowButton what="right" />}
      {calm && !narrow && state.settings.layout?.right && (
        <button type="button" className="icon-btn on" aria-pressed="true" aria-label="Close the inspector" data-tip="Close the inspector" onClick={() => store.updateLayout({ right: false })}>
          <IconRightPanel size={17} />
        </button>
      )}
      <button type="button" className="icon-btn" aria-label="More" data-tip="More" aria-expanded={menu} onClick={() => (setDownloads(false), setMenu(!menu))}>
        <IconMore size={16} />
      </button>
      {menu && (
        <Popover onClose={() => setMenu(false)} label="Note options">
          {phone && downloads ? (
            <>
              <button type="button" className="menu-item menu-back" onClick={() => setDownloads(false)}>
                <IconBack size={14} /> Download a copy
              </button>
              <hr className="menu-sep" />
              {downloadItems()}
            </>
          ) : (
          <>
          {phone && (
            <>
              <button type="button" className="menu-item" aria-pressed={note.favorite} onClick={() => (setMenu(false), store.toggleFavorite(note.id))}>
                {note.favorite ? <IconStarFilled size={14} /> : <IconStar size={14} />} {note.favorite ? 'Remove from Favourites' : 'Add to Favourites'}
              </button>
              <button type="button" className="menu-item" aria-pressed={showMeta} onClick={() => (setMenu(false), setShowMeta(!showMeta))}>
                <IconTag size={14} /> {showMeta ? 'Hide notebook and tags' : 'Notebook and tags…'}
              </button>
              <hr className="menu-sep" />
            </>
          )}
          {viewsInMenu && (
            <>
              {!phone && <p className="menu-label">View</p>}
              <button type="button" className="menu-item" onClick={() => (setMenu(false), setReading(!reading))}>
                <IconBook size={14} /> {reading ? 'Back to editing' : 'Reading view'}
              </button>
              {/* A phone's screen is already the page, and already quiet. */}
              {!phone && (
                <>
                  <button type="button" className="menu-item" aria-pressed={paged} onClick={() => (setMenu(false), togglePage())}>
                    <IconPage size={14} /> {paged ? 'Page view: on' : 'Page view'}
                  </button>
                  <button type="button" className="menu-item" onClick={() => (setMenu(false), store.setFocusMode(true))}>
                    <IconFocus size={14} /> Focus mode
                  </button>
                </>
              )}
              {calm && !narrow && (
                <button type="button" className="menu-item" aria-pressed={toolsAtRest} onClick={() => (setMenu(false), store.updateSettings({ toolbar: toolsAtRest ? 'selection' : 'always' }))}>
                  <span className="menu-aa" aria-hidden="true">Aa</span> {toolsAtRest ? 'Formatting only on selected text' : 'Formatting bar always on show'}
                </button>
              )}
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
            <IconSearch size={14} /> Find and replace {!phone && <small className="menu-hint">{isMac ? '⌘F' : 'Ctrl+F'}</small>}
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
          {calm && !note.projectId && !note.reminder && (
            <button type="button" className="menu-item" onClick={() => (setMenu(false), setRemind((n) => n + 1))}>
              <IconBell size={14} /> Add a reminder…
            </button>
          )}
          {!phone && (
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
          )}
          <hr className="menu-sep" />
          {!trashed && !locked && (
            <button type="button" className="menu-item" onClick={() => (setMenu(false), setProtecting(true))}>
              <IconLock size={14} /> Protect with a password…
            </button>
          )}
          {locked && shownDoc && (
            <>
              <button type="button" className="menu-item" onClick={() => (setMenu(false), opened.forget())}>
                <IconLock size={14} /> Lock now
              </button>
              <button type="button" className="menu-item" onClick={() => (setMenu(false), removePassword(note.id, store))}>
                Remove the password
              </button>
            </>
          )}
          {phone ? (
            <button type="button" className="menu-item keep-open" onClick={() => setDownloads(true)}>
              <IconDownload size={14} /> Download a copy…
            </button>
          ) : (
            <>
              {(!locked || shownDoc) && <p className="menu-label">Download or print</p>}
              {downloadItems()}
            </>
          )}
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
          </>
          )}
        </Popover>
      )}
      {printing && (
        <PrintJob
          title={displayTitle(note)}
          parts={[{ id: note.id, doc: note.title.trim() ? { blocks: [makeBlock('paragraph', note.title, [], { style: 'title' }), ...(shownDoc ?? note.doc).blocks] } : (shownDoc ?? note.doc), fields: { title: displayTitle(note), words: docWords(shownDoc ?? note.doc), created: note.createdAt, updated: note.updatedAt } }]}
          page={pageSetup}
          sheet={sheet}
          onDone={() => setPrinting(false)}
        />
      )}
    </div>
  );

  // Back from a board with the window to itself: the note you were on before it, or your notes.
  const leaveBoard = () => {
    const before = recentNotes(state.notes, 6).find((n) => n.id !== note.id && !isBoard(n));
    if (before) nav.openNote(before.id);
    else store.select(null);
  };

  const nbSelect = (
    <select value={note.notebookId ?? ''} disabled={trashed} onChange={(e) => store.moveNote(note.id, e.target.value || null)}>
      <option value="">No notebook (Inbox)</option>
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
  );

  const kicker = (
    <>
        {calm && !narrow ? (
          <p className="note-kicker calm">
            <label className="kicker-nb" title="Notebook">
              {nb ? <span className="kicker-mark" style={{ background: nb.color }} aria-hidden="true" /> : <IconInbox size={13} />}
              <span className="visually-hidden">Notebook</span>
              {nbSelect}
              <span aria-hidden="true">{nb?.name ?? 'Inbox'}</span>
            </label>
            <span aria-hidden="true">·</span>
            <span>{editedText(note.updatedAt, Date.now())}</span>
          </p>
        ) : (
          <p className="note-kicker">{phone ? `${nb?.name ?? 'Inbox'} · ${editedText(note.updatedAt, Date.now())}` : editedText(note.updatedAt, Date.now())}</p>
        )}
    </>
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
      {!room && kicker}
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
      {room && kicker}
      <p className="reading-meta">
        {[nb?.name, longTime(note.updatedAt), `${wordCount(note)} words`].filter(Boolean).join(' · ')}
      </p>
      {!(phone && !showMeta) && <div className={`note-meta${calm && !narrow ? ' calm' : ''}`}>
        {!(calm && !narrow) && (
          <label className="nb-picker" title="Notebook">
            {nb ? <NotebookIcon color={nb.color} size={11} cut="var(--chip)" /> : <IconNotebook size={12} />}
            <span className="visually-hidden">Notebook</span>
            {nbSelect}
          </label>
        )}
        {note.tags.map((t) => (
          <span key={t} className="tag-chip">
            {calm && !narrow ? <span className="tag-dot" style={{ background: tagColour(t) }} aria-hidden="true" /> : '#'}
            {t}
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
            <button type="button" className="add-tag" aria-label={calm && !narrow ? 'Add tag' : undefined} title={calm && !narrow ? 'Add tag' : undefined} onClick={() => setAddingTag(true)}>
              {calm && !narrow ? <IconPlus size={12} /> : <><IconTag size={12} /> Add tag</>}
            </button>
          ))}
      </div>}
      {note.file && fileKind(note.file) === 'word' && <WordBanner path={note.file} />}
    </>
  );

  const words = docWords(note.doc);
  const linkedFrom = backlinks(note, state.notes);
  // The calm look: just the notes that link here, as one quiet line (its own "Edited" line is at the top).
  const footer = calm ? (
    linkedFrom.length > 0 && (
      <section className="backlinks quiet" aria-label="Linked from">
        <h2>Linked from</h2>
        <div className="backlink-list">
          {linkedFrom.map((n) => (
            <button key={n.id} type="button" className="backlink" onClick={() => nav.openNote(n.id)}>
              {displayTitle(n)}
            </button>
          ))}
        </div>
      </section>
    )
  ) : (
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

  // An uploaded picture, PDF, video, sound or other file: shown as what it is.
  const shownFile = note.file && !['word', 'text'].includes(fileKind(note.file)) ? note.file : null;

  return (
    shownFile ? (
      <section className="pane file-pane" aria-label="File">
        <div className="note-toolbar" role="toolbar" aria-label="File options">
          {lead}
          <span className="grow" />
          {trail}
        </div>
        <div className="board-header">{header}</div>
        <FileView key={shownFile} path={shownFile} />
      </section>
    ) : locked && !shownDoc ? (
      <section className="pane board-pane" aria-label="Locked note">
        <div className="note-toolbar" role="toolbar" aria-label="Note options">
          {lead}
          <span className="grow" />
        </div>
        <LockedNote key={note.id} id={note.id} title={note.title} doc={note.doc} />
      </section>
    ) : isBoard(note) && calm && !narrow ? (
      // The calm look (design 20): the board has the window, its name on a small floating card.
      <section className="pane board-pane calm" aria-label="Board">
        <div className="board-float" role="toolbar" aria-label="Board options">
          <button type="button" className="icon-btn" aria-label="Back to your notes" title="Back to your notes" onClick={leaveBoard}>
            <IconBack size={18} />
          </button>
          <input className="board-title" aria-label="Title" placeholder="Untitled board" value={note.title} onChange={(e) => store.setTitle(note.id, e.target.value)} />
          <span className="board-count">
            Board · {boardOf(note).nodes.length} card{boardOf(note).nodes.length === 1 ? '' : 's'}
          </span>
          {trail}
        </div>
        <BoardView key={note.id} note={note} />
      </section>
    ) : isBoard(note) ? (
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
          targets={[{ id: note.id, doc: shownDoc ?? note.doc, editor: editorRef.current }]}
          onReplaceDoc={(id, doc) => (locked ? opened.save(doc) : store.setDoc(id, doc))}
          author={state.settings.trackChanges ? state.settings.name.trim() || 'You' : null}
          sheet={sheet}
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
          sources={styleSources}
          onDefault={() => store.updateSettings({ defaultStyles: sheet })}
        />
      )}
      {protecting && <PasswordDialog id={note.id} doc={note.doc} onClose={() => setProtecting(false)} />}
      <EditorHost
        sheet={sheet}
        page={paged ? pageSetup : null}
        onPage={(notePage) => store.updateSettings({ notePage })}
        pageFields={{ title: note.title, words, created: note.createdAt, updated: note.updatedAt }}
        onEditStyles={(key) => setStylesOpen(key ?? true)}
        onSheet={(noteStyles) => store.updateSettings({ noteStyles })}
        docId={note.id}
        doc={shownDoc ?? note.doc}
        onDoc={(doc) => (locked ? opened.save(doc) : store.setDoc(note.id, doc))}
        readOnly={trashed || reading}
        reading={reading && !trashed}
        lead={calm && paged && !narrow ? <span className="paged-title">{displayTitle(note)}</span> : lead}
        trail={trail}
        floatTools={room}
        header={calm && paged && !narrow && !trashed ? null : header}
        footer={footer}
        onEditor={(ed) => {
          editorRef.current = ed;
        }}
      />
    </section>
  );
}

/** The first visit: a clean page, and ways to start. */
function Welcome({ onNewNote, onNewProject }: { onNewNote(): void; onNewProject(): void }) {
  const [touring, setTouring] = useState(false);
  const store = useAppStore();
  const nav = useNav();
  // Plain files only once a folder or Google Drive is connected; until then, this browser keeps them.
  const lede = useSync().state.config ? 'Your notes stay in plain files you own. Start however suits you.' : 'Your notes stay on this device. Connect Google Drive or a folder any time to have them everywhere, as plain files you own.';
  const bringIn = () =>
    chooseUploads(async (files) => {
      const made = await uploadFiles(store, files);
      const last = made[made.length - 1];
      if (last) nav.openNote(last.id);
    });
  // The calm look (design 6): three ways to start, each with its picture, and one line about ⌘K and the tour.
  if (!store.getState().settings.toolbarAll)
    return (
      <div className="welcome calm">
        {touring && <Tour onDone={() => setTouring(false)} />}
        <h2>A clean page.</h2>
        <p className="lede">{lede}</p>
        <ol>
          <li>
            <button type="button" onClick={onNewNote}>
              <span className="welcome-icon" aria-hidden="true">
                <IconPen size={18} />
              </span>
              <span>
                <b>Write a note</b>
                <small>Just start typing. File it later.</small>
              </span>
            </button>
          </li>
          <li>
            <button type="button" onClick={onNewProject}>
              <span className="welcome-icon" aria-hidden="true">
                <IconBook size={18} />
              </span>
              <span>
                <b>Start a book</b>
                <small>Chapters, an outline, characters and research.</small>
              </span>
            </button>
          </li>
          <li>
            <button type="button" onClick={bringIn}>
              <span className="welcome-icon" aria-hidden="true">
                <IconDownload size={18} />
              </span>
              <span>
                <b>Bring in your writing</b>
                <small>Word files, Markdown, or a folder.</small>
              </span>
            </button>
          </li>
        </ol>
        <p className="welcome-keys">
          Press <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd> any time to find a note or a command.{' '}
          <button type="button" className="link-btn" onClick={() => setTouring(true)}>
            Take the two-minute tour
          </button>
        </p>
      </div>
    );
  return (
    <div className="welcome">
      {touring && <Tour onDone={() => setTouring(false)} />}
      <h2>A clean page.</h2>
      <p className="lede">{lede}</p>
      <ol>
        <li>
          <button type="button" onClick={onNewNote}>
            <span>
              <b>Write a note</b>
              <small>Just start typing. File it later.</small>
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={onNewProject}>
            <span>
              <b>Start a book</b>
              <small>Chapters, an outline, characters and research, in manuscript format.</small>
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={bringIn}>
            <span>
              <b>Bring in your writing</b>
              <small>Word documents, Markdown, text, PDFs and pictures.</small>
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
      <p className="welcome-keys">
        Press <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd> any time to find a note, or <kbd>{isMac ? '⌘' : 'Ctrl'} P</kbd> for every command.
      </p>
      <p className="welcome-tour">
        New here?{' '}
        <button type="button" className="link-btn" onClick={openGuide}>
          Read the guide
        </button>{' '}
        or{' '}
        <button type="button" className="link-btn" onClick={() => setTouring(true)}>
          take a quick tour
        </button>
      </p>
    </div>
  );
}
