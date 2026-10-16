// Word's content controls, for forms: tick boxes, drop-down lists, date
// pickers and fill-in boxes in the text (fields: see the editor's fields.ts).
// The formatting bar's Form control button puts one in; clicking one opens
// its card here: choose, pick a date, or type, and (while the document can
// be changed) set its choices or prompt. Restrict editing → Filling in forms
// lets people do only this.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { Pos } from '@crumpet/editor/model';
import { type FormControl, formName, readForm } from '@crumpet/editor/fields';
import { Popover } from './Sidebar';
import { type ToolItem, closeMore } from './toolbar';

/** The card for the form control clicked. `design`: its choices or prompt can be changed too. */
export function FormCard({ editor, design }: { editor: Editor | null; design: boolean }) {
  const [open, setOpen] = useState<{ at: Pos; form: FormControl; el: HTMLElement } | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const [value, setValue] = useState('');
  const [choices, setChoices] = useState('');
  const [prompt, setPrompt] = useState('');
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    editor.onFormClick = (at, name, el) => {
      const form = readForm(name);
      if (!form) return;
      setOpen({ at, form, el });
      setValue(form.kind === 'fill' ? form.value : form.kind === 'pick' ? form.date : '');
      setChoices(form.kind === 'drop' ? form.choices.join('\n') : '');
      setPrompt(form.kind === 'fill' ? form.prompt : '');
    };
    return () => {
      editor.onFormClick = null;
    };
  }, [editor]);

  useLayoutEffect(() => {
    if (!open) return setPlace(null);
    const r = open.el.getBoundingClientRect();
    const h = card.current?.offsetHeight ?? 200;
    const below = r.bottom + 6 + h < window.innerHeight;
    setPlace({ top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - h), left: Math.min(window.innerWidth - 290, Math.max(8, r.left)) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (card.current && !card.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open]);

  if (!open || !editor) return null;
  const save = (form: FormControl) => {
    editor.setForm(open.at, formName(form));
    setOpen(null);
  };
  const f = open.form;
  return (
    <div
      ref={card}
      className="form-card"
      role="dialog"
      aria-label={f.kind === 'drop' ? 'Choose an item' : f.kind === 'pick' ? 'Pick a date' : 'Fill in'}
      style={place ? { top: place.top, left: place.left } : { visibility: 'hidden' }}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(null)}
    >
      {f.kind === 'drop' && (
        <>
          <div className="menu-list" role="listbox" aria-label="Choices">
            {f.choices.map((c, i) => (
              <button key={i} type="button" role="option" aria-selected={i === f.chosen} className={`menu-item${i === f.chosen ? ' on' : ''}`} onClick={() => save({ ...f, chosen: i })}>
                {c}
              </button>
            ))}
            {f.chosen >= 0 && (
              <button type="button" className="menu-item quiet" onClick={() => save({ ...f, chosen: -1 })}>
                (None)
              </button>
            )}
          </div>
          {design && (
            <details className="form-design">
              <summary>Change the choices</summary>
              <textarea aria-label="Choices, one a line" rows={4} value={choices} onChange={(e) => setChoices(e.target.value)} />
              <button type="button" className="btn small" onClick={() => save({ kind: 'drop', chosen: f.chosen, choices: choices.split('\n') })}>
                Save choices
              </button>
            </details>
          )}
        </>
      )}
      {f.kind === 'pick' && (
        <form
          className="form-fill"
          onSubmit={(e) => {
            e.preventDefault();
            save({ kind: 'pick', date: value });
          }}
        >
          <input type="date" aria-label="Date" value={value} autoFocus onChange={(e) => setValue(e.target.value)} />
          <div className="form-buttons">
            <button type="button" className="btn quiet small" onClick={() => save({ kind: 'pick', date: '' })}>
              Clear
            </button>
            <button type="button" className="btn quiet small" onClick={() => save({ kind: 'pick', date: new Date().toISOString().slice(0, 10) })}>
              Today
            </button>
            <button type="submit" className="btn primary small">
              Done
            </button>
          </div>
        </form>
      )}
      {f.kind === 'fill' && (
        <form
          className="form-fill"
          onSubmit={(e) => {
            e.preventDefault();
            save({ kind: 'fill', prompt: design ? prompt : f.prompt, value });
          }}
        >
          <input aria-label="Fill in" placeholder={f.prompt} value={value} autoFocus onChange={(e) => setValue(e.target.value)} />
          {design && (
            <label className="field">
              <span>Prompt (shown until it’s filled in)</span>
              <input aria-label="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </label>
          )}
          <div className="form-buttons">
            <button type="submit" className="btn primary small">
              Done
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const ICON_FORM = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5h6v6H4zM6 8l1.5 1.5L10 6M13 8h7M4 15h16v4H4z" />
  </svg>
);

function FormTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  const put = (name: string) => {
    setOpen(false);
    closeMore();
    ed?.focus();
    ed?.insertField(name);
  };
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Form control" title="Form control" aria-expanded={open} disabled={off} onClick={() => setOpen(!open)}>
        {ICON_FORM}
        <span aria-hidden="true" className="caret">
          ▾
        </span>
      </button>
      {open && (
        <Popover label="Form control" onClose={() => setOpen(false)}>
          <div className="menu-list">
            <button type="button" className="menu-item" onClick={() => put('chk:0')}>
              <span className="menu-glyph">☐</span> Tick box
            </button>
            <button type="button" className="menu-item" onClick={() => put('drop:-1:Choice 1|Choice 2|Choice 3')}>
              <span className="menu-glyph">▾</span> Drop-down list
            </button>
            <button type="button" className="menu-item" onClick={() => put('pick:')}>
              <span className="menu-glyph">📅</span> Date picker
            </button>
            <button type="button" className="menu-item" onClick={() => put('fill:Click to type|')}>
              <span className="menu-glyph">▭</span> Fill-in box
            </button>
            <p className="menu-note">Click one to change its choices or prompt. Protect document → Filling in forms lets others only fill them in. They go to Word as Word’s content controls.</p>
          </div>
        </Popover>
      )}
    </span>
  );
}

export function formItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [{ key: 'form', label: 'Form control', pri: 1, node: <FormTool ed={ed} off={off} /> }];
}
