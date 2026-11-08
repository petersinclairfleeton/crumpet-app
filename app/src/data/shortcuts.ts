// Keyboard shortcuts: every command has a place in Settings → Shortcuts, the
// everyday ones with a standard shortcut, and each can be changed or cleared
// (settings.shortcuts holds only the changes). A shortcut is written the same
// way on every computer: "Mod+Alt+Shift+N", where Mod is ⌘ on a Mac and Ctrl
// elsewhere, and "Ctrl" on a Mac is the Control key.

export interface ShortcutDef {
  /** The command's id (the command palette's commands carry the same). */
  id: string;
  name: string;
  group: ShortcutGroup;
  /** Its standard shortcut: one for every computer, or [Mac, Windows and others]. */
  keys?: string | [string, string];
  /** Other keys the text already answers to for it (Redo's Ctrl+Shift+Z…), let go when it's changed. */
  also?: string[];
  /** Done by the text itself (the editor's own keys): Crumpet steps in only when it's changed. */
  builtin?: boolean;
  /** Acts on the text being written: the key works with the cursor in it. */
  text?: boolean;
}

export const SHORTCUT_GROUPS = ['Make something new', 'Find and go', 'Show and hide', 'Writing', 'Text and paragraphs', 'Turn into or insert', 'Review and check', 'Tools', 'Themes', 'Help'] as const;
export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

/** Keys the browser or the computer keeps for itself, or Crumpet needs for copy and paste. */
const KEPT: Record<string, string> = {
  'Mod+N': 'Your browser keeps this one for a new window.',
  'Mod+Shift+N': 'Your browser keeps this one for a private window.',
  'Mod+T': 'Your browser keeps this one for a new tab.',
  'Mod+Shift+T': 'Your browser keeps this one to reopen a tab.',
  'Mod+W': 'Your browser keeps this one to close the tab.',
  'Mod+Shift+W': 'Your browser keeps this one to close the window.',
  'Mod+Q': 'Your computer keeps this one to quit.',
  'Mod+Tab': 'Your computer keeps this one to change windows.',
  'Mod+C': 'Copy',
  'Mod+X': 'Cut',
  'Mod+V': 'Paste',
  'Mod+A': 'Select all',
  'Mod+Shift+V': 'Paste as plain text',
};

/** Why a shortcut can't be used, or null if it can. */
export function keptKey(combo: string): string | null {
  return KEPT[combo] ?? null;
}

/** The key a press is for, by where it sits on the keyboard (so Alt and Shift don't change it). */
function keyName(code: string, key: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return code.slice(6);
  if (/^F\d{1,2}$/.test(code)) return code;
  const named: Record<string, string> = {
    Backslash: '\\', Slash: '/', Comma: ',', Period: '.', Semicolon: ';', Quote: "'", Backquote: '`', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=',
    Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Delete: 'Delete', Backspace: 'Backspace', Insert: 'Insert',
  };
  if (named[code]) return named[code];
  // A keyboard that reports no code: its character.
  if (key && key.length === 1 && key !== ' ') return key.toUpperCase();
  return null;
}

/** A key press as a shortcut ("Mod+Shift+K"), or null for a press of a modifier alone, Escape or Tab. */
export function comboOf(e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>, mac: boolean): string | null {
  if (['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Escape', 'Tab'].includes(e.key)) return null;
  const k = keyName(e.code, e.key);
  if (!k) return null;
  const parts: string[] = [];
  if (mac ? e.metaKey : e.ctrlKey) parts.push('Mod');
  if (mac && e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(k);
  return parts.join('+');
}

/** Whether a shortcut is a key alone or with only Shift (it shouldn't fire while typing). */
export function plainKey(combo: string): boolean {
  return !/(^|\+)(Mod|Ctrl|Alt)\+/.test(combo) && !/^(Shift\+)?F\d{1,2}$/.test(combo);
}

const MAC_SIGNS: Record<string, string> = { Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' };
const KEY_SIGNS: Record<string, string> = { Up: '↑', Down: '↓', Left: '←', Right: '→', Enter: '↵', Backspace: '⌫', Delete: '⌦' };

/** A shortcut as people read it: ⌃⌥⇧⌘K on a Mac, Ctrl+Alt+Shift+K elsewhere. */
export function showCombo(combo: string, mac: boolean): string {
  const bits = combo.split('+');
  const key = combo.endsWith('++') ? '+' : bits[bits.length - 1];
  const mods = bits.slice(0, combo.endsWith('++') ? -2 : -1);
  if (mac) {
    // Apple's order: Control, Option, Shift, Command.
    const order = ['Ctrl', 'Alt', 'Shift', 'Mod'];
    return order.filter((m) => mods.includes(m)).map((m) => MAC_SIGNS[m]).join('') + (KEY_SIGNS[key] ?? key);
  }
  return [...mods.map((m) => (m === 'Mod' ? 'Ctrl' : m)), key].join('+');
}

/** A command's standard shortcut on this computer. */
export function standardKeys(def: ShortcutDef, mac: boolean): string | null {
  if (!def.keys) return null;
  return typeof def.keys === 'string' ? def.keys : def.keys[mac ? 0 : 1];
}

/** Each command's shortcut now: the standard one unless changed (null: none). */
export function bindingsFor(defs: ShortcutDef[], changed: Record<string, string | null> | undefined, mac: boolean): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const d of defs) out.set(d.id, changed && d.id in changed ? changed[d.id] : standardKeys(d, mac));
  return out;
}

/** The command a shortcut belongs to now, if any. */
export function commandFor(bindings: Map<string, string | null>, combo: string): string | null {
  for (const [id, c] of bindings) if (c === combo) return id;
  return null;
}

/**
 * The change to settings.shortcuts that gives `id` the shortcut `combo` (or none, for null),
 * taking it from any command that had it. Changes back to the standard shortcut are dropped.
 */
export function assignShortcut(defs: ShortcutDef[], changed: Record<string, string | null> | undefined, mac: boolean, id: string, combo: string | null): Record<string, string | null> {
  const next: Record<string, string | null> = { ...(changed ?? {}) };
  const now = bindingsFor(defs, changed, mac);
  if (combo) for (const [other, c] of now) if (other !== id && c === combo) next[other] = null;
  next[id] = combo;
  for (const d of defs) if (d.id in next && next[d.id] === standardKeys(d, mac)) delete next[d.id];
  // Keep changes to commands no longer listed (a macro or theme that may come back) as they were.
  return next;
}
