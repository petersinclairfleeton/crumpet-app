import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fullSheet } from '../data/styles';
import { StylesDialog } from './styles-ui';
import type { Editor } from '@crumpet/editor/editor';
import { useAppState, useAppStore } from './hooks';
import { allTags, longTime, notebookTree, wordCount } from '../data/selectors';
import { EditorHost } from './EditorHost';
import { IconBack, IconBook, IconMore, IconNotebook, IconPen, IconRestore, IconStar, IconStarFilled, IconTag, IconTrash, NotebookIcon } from './icons';
import { InlineInput, Popover } from './Sidebar';

export function NotePane({ onBack, narrow }: { onBack(): void; narrow: boolean }) {
  const state = useAppState();
  const store = useAppStore();
  const note = store.note(state.selectedId);
  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [reading, setReading] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);
  const sheet = useMemo(() => fullSheet(state.settings.noteStyles, 'crumpet'), [state.settings.noteStyles]);

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

  const trail = trashed ? null : (
    <div className="note-actions">
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

  const words = wordCount(note);
  const footer = (
    <p className="note-foot">
      {words} word{words === 1 ? '' : 's'} · Edited {longTime(note.updatedAt)} · Created {longTime(note.createdAt)}
    </p>
  );

  return (
    <section className="pane" aria-label="Note">
      {stylesOpen && <StylesDialog title="Styles for notes" sheet={sheet} onChange={(noteStyles) => store.updateSettings({ noteStyles })} onClose={() => setStylesOpen(false)} />}
      <EditorHost
        sheet={sheet}
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
