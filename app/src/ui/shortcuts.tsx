// Keyboard shortcuts at work: the keys that run commands (ShortcutKeys, always
// listening), and Settings → Shortcuts, where each one is changed or cleared.
// The list of commands is ui/shortcutlist.ts; the rules are data/shortcuts.ts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { type ShortcutDef, SHORTCUT_GROUPS, assignShortcut, bindingsFor, comboOf, commandFor, keptKey, plainKey, showCombo, standardKeys } from '../data/shortcuts';
import type { Settings } from '../data/types';
import { shortcutDefs } from './shortcutlist';
import { useAppState, useAppStore } from './hooks';
import { currentHelped } from './helpers';
import { IconClose, IconSearch } from './icons';

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Each command's shortcut now, for these settings. */
export function shortcutBindings(settings: Pick<Settings, 'shortcuts' | 'macros'>): Map<string, string | null> {
  return bindingsFor(shortcutDefs(settings), settings.shortcuts, isMac);
}

/** A command's shortcut as people read it (⌘K, Ctrl+K), or undefined if it has none. */
export function shortcutText(bindings: Map<string, string | null>, id: string): string | undefined {
  const c = bindings.get(id);
  return c ? showCombo(c, isMac) : undefined;
}

/** While a new shortcut is being pressed in Settings, keys aren't commands. */
let recording = false;

/** A command the keys can run: the command palette's commands. */
export interface KeyCommand {
  id?: string;
  run(how: 'here'): void;
}

/** Runs commands from their shortcuts, wherever the person is in the app. */
export function ShortcutKeys({ build }: { build(): KeyCommand[] }) {
  const store = useAppStore();
  const latest = useRef(build);
  latest.current = build;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (recording || e.isComposing) return;
      const combo = comboOf(e, isMac);
      if (!combo) return;
      const settings = store.getState().settings;
      const defs = shortcutDefs(settings);
      // Key presses played by the desktop apps' menu bar mean their standard command.
      const binds = bindingsFor(defs, e.isTrusted ? settings.shortcuts : undefined, isMac);
      const el = e.target instanceof HTMLElement ? e.target : null;
      const field = !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
      const typing = field || !!el?.isContentEditable;
      let id = commandFor(binds, combo);
      if (!id) id = defs.find((d) => !d.builtin && d.also?.includes(combo) && binds.get(d.id) === standardKeys(d, isMac))?.id ?? null;
      if (id) {
        const def = defs.find((d) => d.id === id)!;
        // The text does it itself.
        if (def.builtin && binds.get(id) === standardKeys(def, isMac)) return;
        // A key alone doesn't interrupt typing; nor do keys while a window is open over the app.
        if (plainKey(combo) && typing) return;
        if (document.querySelector('[aria-modal="true"]')) return;
        // ⌘K on selected text, or in a link, edits the link (ui/editing.tsx).
        if (id === 'find.anything' && combo === 'Mod+K' && el?.closest('.editor') && wantsLink()) return;
        const cmd = latest.current().find((c) => c.id === id);
        if (!cmd) return;
        e.preventDefault();
        e.stopPropagation();
        cmd.run('here');
        return;
      }
      // A key the text answers to for a command that now has another: let go of it.
      if (!e.isTrusted || field) return;
      const was = defs.find((d) => d.builtin && binds.get(d.id) !== standardKeys(d, isMac) && (standardKeys(d, isMac) === combo || d.also?.includes(combo)));
      if (was) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [store]);
  return null;
}

function wantsLink(): boolean {
  const ed = currentHelped()?.editor;
  if (!ed) return false;
  const sel = ed.currentSelection();
  return !(sel.anchor.block === sel.focus.block && sel.anchor.offset === sel.focus.offset) || !!ed.currentLink();
}

/** Settings → Shortcuts: every command, its shortcut, and a way to change it. */
export function ShortcutSettings() {
  const state = useAppState();
  const store = useAppStore();
  const s = state.settings;
  const defs = useMemo(() => shortcutDefs(s), [s.macros]); // eslint-disable-line react-hooks/exhaustive-deps
  const binds = useMemo(() => bindingsFor(defs, s.shortcuts, isMac), [defs, s.shortcuts]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const changed = Object.keys(s.shortcuts ?? {}).length > 0;
  const q = query.trim().toLowerCase();
  const shown = defs.filter((d) => !q || d.name.toLowerCase().includes(q) || (binds.get(d.id) && showCombo(binds.get(d.id)!, isMac).toLowerCase().includes(q)) || d.group.toLowerCase().includes(q));
  const set = (id: string, combo: string | null) => store.updateSettings({ shortcuts: tidy(assignShortcut(defs, s.shortcuts, isMac, id, combo)) });
  return (
    <div className="shortcut-settings">
      <p className="setting-group-hint">
        Every command has a place here. Click a shortcut to give it a new one (press the keys), or clear it. {isMac ? '⌘ is Command, ⌥ Option, ⇧ Shift and ⌃ Control.' : ''}
      </p>
      <div className="shortcut-tools">
        <label className="shortcut-search">
          <IconSearch size={16} />
          <input type="search" placeholder="Find a command or a shortcut" aria-label="Find a command or a shortcut" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="button" className="btn quiet" disabled={!changed} onClick={() => store.updateSettings({ shortcuts: undefined })}>
          Put every shortcut back
        </button>
      </div>
      {shown.length === 0 && <p className="side-empty">No command matches.</p>}
      {SHORTCUT_GROUPS.map((g) => {
        const rows = shown.filter((d) => d.group === g);
        if (!rows.length) return null;
        return (
          <section key={g} className="setting-group shortcut-group" role="group" aria-label={g}>
            <h4 className="setting-group-title">{g}</h4>
            {rows.map((d) => (
              <ShortcutRow key={d.id} def={d} combo={binds.get(d.id) ?? null} binds={binds} defs={defs} editing={editing === d.id} onEdit={(on) => setEditing(on ? d.id : null)} onSet={(c) => (set(d.id, c), setEditing(null))} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** Drops nothing-changed settings, so "no changes" is no setting at all. */
function tidy(changed: Record<string, string | null>): Record<string, string | null> | undefined {
  return Object.keys(changed).length ? changed : undefined;
}

function ShortcutRow({ def, combo, binds, defs, editing, onEdit, onSet }: { def: ShortcutDef; combo: string | null; binds: Map<string, string | null>; defs: ShortcutDef[]; editing: boolean; onEdit(on: boolean): void; onSet(combo: string | null): void }) {
  const standard = standardKeys(def, isMac);
  const isChanged = combo !== standard;
  return (
    <div className={`settings-row shortcut-row${editing ? ' editing' : ''}`}>
      <span>
        <b>{def.name}</b>
        {def.text && <small>While writing</small>}
      </span>
      <span className="settings-row-end shortcut-end">
        {editing ? (
          <KeyRecorder name={def.name} id={def.id} binds={binds} defs={defs} onDone={onSet} onCancel={() => onEdit(false)} />
        ) : (
          <>
            <button type="button" className={`shortcut-key${combo ? '' : ' none'}`} aria-label={`${def.name}: ${combo ? showCombo(combo, isMac) : 'no shortcut'}. Change`} onClick={() => onEdit(true)}>
              {combo ? <kbd>{showCombo(combo, isMac)}</kbd> : 'Add a shortcut'}
            </button>
            {combo && (
              <button type="button" className="icon-btn" aria-label={`Clear the shortcut for ${def.name}`} title="No shortcut" onClick={() => onSet(null)}>
                <IconClose size={14} />
              </button>
            )}
            {isChanged && (
              <button type="button" className="link-btn shortcut-reset" title={standard ? `Back to ${showCombo(standard, isMac)}` : 'Back to none'} onClick={() => onSet(standard)}>
                Standard
              </button>
            )}
          </>
        )}
      </span>
    </div>
  );
}

/** Waits for a shortcut to be pressed, says if another command has it, and keeps it. */
function KeyRecorder({ name, id, binds, defs, onDone, onCancel }: { name: string; id: string; binds: Map<string, string | null>; defs: ShortcutDef[]; onDone(combo: string): void; onCancel(): void }) {
  const [combo, setCombo] = useState<string | null>(null);
  const box = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    recording = true;
    box.current?.focus();
    return () => {
      recording = false;
    };
  }, []);
  const kept = combo ? keptKey(combo) : null;
  const other = combo ? commandFor(binds, combo) : null;
  const taken = other && other !== id ? defs.find((d) => d.id === other) : undefined;
  return (
    <span className="key-recorder">
      <button
        ref={box}
        type="button"
        className="shortcut-key listening"
        aria-label={`New shortcut for ${name}: press the keys`}
        onKeyDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === 'Escape') return onCancel();
          const c = comboOf(e.nativeEvent, isMac);
          if (c) setCombo(c);
        }}
        onBlur={(e) => !e.currentTarget.parentElement?.contains(e.relatedTarget as Node) && onCancel()}
      >
        {combo ? <kbd>{showCombo(combo, isMac)}</kbd> : 'Press the keys…'}
      </button>
      {combo && (kept ? (
        <small className="shortcut-note" role="alert">{/^(Copy|Cut|Paste|Select all|Paste as plain text)$/.test(kept) ? `Crumpet needs this one for ${kept.toLowerCase()}.` : kept}</small>
      ) : (
        <>
          {taken && <small className="shortcut-note" role="status">Now for “{taken.name}”; that one will have none.</small>}
          {!taken && plainKey(combo) && <small className="shortcut-note" role="status">Works when you aren’t typing.</small>}
          <button type="button" className="btn primary small" onMouseDown={(e) => e.preventDefault()} onClick={() => onDone(combo)}>
            Use it
          </button>
        </>
      ))}
      <button type="button" className="btn quiet small" onMouseDown={(e) => e.preventDefault()} onClick={onCancel}>
        Cancel
      </button>
    </span>
  );
}
