// Word's macros: record typing, Enter, Backspace, caret moves and the
// formatting commands once (the editor keeps them as steps), then play them
// back wherever the caret is: from the Macros menu, the command palette, or
// Alt+Shift and the macro's number. Kept in settings.macros, so they go with
// the folder to the other devices.

import { useEffect, useState } from 'react';
import type { Editor, MacroStep } from '@crumpet/editor/editor';
import { Popover } from './Sidebar';
import { type ToolItem, closeMore } from './toolbar';
import { useAppState, useAppStore } from './hooks';
import { currentHelped } from './helpers';

/** The macro being recorded, in which editor (one at a time, app-wide). */
let recording: { ed: Editor; name: string } | null = null;
const CHANGED = 'crumpet:macro-recording';
const changed = () => window.dispatchEvent(new Event(CHANGED));

function useRecording() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(CHANGED, on);
    return () => window.removeEventListener(CHANGED, on);
  }, []);
  return recording;
}

/** A short description of a macro's steps. */
export function describeMacro(steps: MacroStep[]): string {
  const words = steps.map((s) => (s.k === 'text' ? `“${s.v.length > 18 ? `${s.v.slice(0, 18)}…` : s.v}”` : s.k === 'enter' ? 'Enter' : s.k === 'del' ? (s.v < 0 ? 'Backspace' : 'Delete') : s.k === 'move' ? s.v.replace('Arrow', '') : s.m.replace(/([A-Z])/g, ' $1').toLowerCase()));
  return words.slice(0, 6).join(', ') + (words.length > 6 ? `, and ${words.length - 6} more` : '');
}

function MacroMenu({ ed, close }: { ed: Editor; close(): void }) {
  const { settings } = useAppState();
  const store = useAppStore();
  const macros = settings.macros ?? [];
  const [name, setName] = useState('');
  const save = (list: typeof macros) => store.updateSettings({ macros: list });
  return (
    <div className="menu-list macro-menu">
      <span className="menu-head">Record a macro</span>
      <form
        className="macro-new"
        onSubmit={(e) => {
          e.preventDefault();
          recording = { ed, name: name.trim() || `Macro ${macros.length + 1}` };
          ed.startMacro();
          changed();
          close();
          ed.focus();
        }}
      >
        <input aria-label="Macro name" placeholder={`Macro ${macros.length + 1}`} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn small primary">
          ● Record
        </button>
      </form>
      {macros.length > 0 && <span className="menu-head">Your macros</span>}
      {macros.map((m) => (
        <div key={m.id} className="macro-row">
          <button
            type="button"
            className="menu-item"
            title={describeMacro(m.steps)}
            onClick={() => {
              close();
              ed.focus();
              ed.playMacro(m.steps);
            }}
          >
            ▶ {m.name}
            {m.key && <small className="menu-key">Alt+Shift+{m.key}</small>}
          </button>
          <select
            aria-label={`Shortcut for ${m.name}`}
            value={m.key ?? ''}
            onChange={(e) => {
              const key = e.target.value ? Number(e.target.value) : undefined;
              save(macros.map((x) => (x.id === m.id ? { ...x, key } : key && x.key === key ? { ...x, key: undefined } : x)));
            }}
          >
            <option value="">No key</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                Alt+Shift+{n}
              </option>
            ))}
          </select>
          <button type="button" className="btn quiet small" aria-label={`Delete ${m.name}`} onClick={() => save(macros.filter((x) => x.id !== m.id))}>
            ✕
          </button>
        </div>
      ))}
      <p className="menu-note">Records what you type, Enter, Backspace, moving with the arrow keys, Home and End, and the formatting bar’s commands; plays them back at the caret.</p>
    </div>
  );
}

const ICON_MACRO = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5v7l6-3.5z" />
  </svg>
);

function MacroTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Macros" title="Macros: record and play back" aria-expanded={open} disabled={off} onClick={() => setOpen(!open)}>
        {ICON_MACRO}
        <span aria-hidden="true" className="caret">
          ▾
        </span>
      </button>
      {open && ed && (
        <Popover label="Macros" onClose={() => setOpen(false)}>
          <MacroMenu
            ed={ed}
            close={() => {
              setOpen(false);
              closeMore();
            }}
          />
        </Popover>
      )}
    </span>
  );
}

export function macroItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [{ key: 'macros', label: 'Macros', pri: 1, node: <MacroTool ed={ed} off={off} /> }];
}

/** The strip shown while a macro is recorded, with Stop; and Alt+Shift+number to play one. */
export function MacroHost() {
  const rec = useRecording();
  const { settings } = useAppState();
  const store = useAppStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey || !/^Digit[1-9]$/.test(e.code)) return;
      const m = settings.macros?.find((x) => x.key === Number(e.code.slice(5)));
      // The editor last typed in.
      const ed = currentHelped()?.editor;
      if (!m || !ed || recording) return;
      e.preventDefault();
      ed.playMacro(m.steps);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [settings.macros]);
  if (!rec) return null;
  const stop = () => {
    const steps = rec.ed.stopMacro();
    recording = null;
    changed();
    if (steps.length) store.updateSettings({ macros: [...(settings.macros ?? []), { id: Math.random().toString(36).slice(2, 10), name: rec.name, steps }] });
  };
  return (
    <div className="macro-bar" role="status" aria-label="Recording a macro">
      <span className="rec-dot" aria-hidden="true" /> Recording “{rec.name}”: type and format as usual.
      <button type="button" className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={stop}>
        Stop recording
      </button>
      <button
        type="button"
        className="btn quiet small"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          rec.ed.stopMacro();
          recording = null;
          changed();
        }}
      >
        Cancel
      </button>
    </div>
  );
}
