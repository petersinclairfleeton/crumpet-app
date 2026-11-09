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

type Def = Omit<ShortcutDef, 'group'>;
const group = (g: ShortcutGroup, defs: Def[]): ShortcutDef[] => defs.map((d) => ({ ...d, group: g }));
/** Done by the text itself, while writing. */
const own = (id: string, name: string, keys: ShortcutDef['keys'], also?: string[]): Def => ({ id, name, keys, also, builtin: true, text: true });
const text = (id: string, name: string, keys?: ShortcutDef['keys']): Def => ({ id, name, keys, text: true });

/** The heading styles and lists the text already has keys for (the editor's own). */
export const INSERT_KEYS: Record<string, string> = {
  text: 'Mod+Alt+0',
  h1: 'Mod+Alt+1',
  h2: 'Mod+Alt+2',
  h3: 'Mod+Alt+3',
  h4: 'Mod+Alt+4',
  bullet: 'Mod+Alt+L',
  numbered: 'Mod+Alt+N',
  todo: 'Mod+Alt+T',
  quote: 'Mod+Alt+Q',
  footnote: 'Mod+Alt+F',
};
/** The / menu's items that change the paragraph rather than add something. */
export const TURN_INTO = /^(h\d|text|bullet|numbered|todo|quote|title|toggle|note|tip|warning|important)$/;

/** The commands that are always there (the rest, made from lists like the themes, are in ui/shortcutlist.ts). */
export const FIXED_COMMANDS: ShortcutDef[] = [
  ...group('Make something new', [
    { id: 'new.upload', name: 'Upload files', keys: 'Mod+Alt+Shift+U' },
    { id: 'new.note', name: 'New note', keys: 'Mod+Alt+Shift+N' },
    { id: 'new.notebook', name: 'New notebook', keys: 'Mod+Alt+Shift+B' },
    { id: 'new.stack', name: 'New notebook stack', keys: 'Mod+Alt+Shift+K' },
    { id: 'new.manuscript', name: 'New book', keys: 'Mod+Alt+Shift+M' },
    { id: 'new.daily', name: 'New daily note', keys: 'Mod+Alt+Shift+D' },
    { id: 'new.board', name: 'New board', keys: 'Mod+Alt+Shift+O' },
    { id: 'new.template', name: 'New note from a template', keys: 'Mod+Alt+Shift+T' },
    { id: 'new.dnotebook', name: 'New Distill notebook' },
    { id: 'new.dstack', name: 'New Distill stack' },
  ]),
  ...group('Find and go', [
    { id: 'find.anything', name: 'Find anything (notes, chapters, cards)', keys: 'Mod+K', also: ['Mod+O'] },
    { id: 'find.commands', name: 'Command palette', keys: 'Mod+P', also: ['Mod+Shift+P'] },
    { id: 'find.search', name: 'Search notes', keys: 'Mod+Alt+Shift+F' },
    own('find.text', 'Find in this document', 'Mod+F'),
    own('find.replace', 'Find and replace', ['Ctrl+H', 'Mod+H']),
    text('go.to', 'Go to page, heading, footnote or comment', 'F5'),
    { id: 'go.inbox', name: 'Go to Inbox', keys: 'Mod+Alt+Shift+I' },
    { id: 'go.all', name: 'Go to All notes', keys: 'Mod+Alt+Shift+A' },
    { id: 'go.today', name: 'Go to Today (daily notes)', keys: 'Mod+Alt+Shift+Y' },
    { id: 'go.favourites', name: 'Go to Favourites' },
    { id: 'go.reminders', name: 'Go to Reminders' },
    { id: 'go.trash', name: 'Go to Trash' },
    { id: 'go.graph', name: 'Open the graph of links', keys: 'Mod+G' },
    text('go.nextHeading', 'Next heading'),
    text('go.prevHeading', 'Previous heading'),
    text('go.nextFootnote', 'Next footnote'),
    text('go.prevFootnote', 'Previous footnote'),
    text('go.nextComment', 'Next comment'),
    text('go.prevComment', 'Previous comment'),
    text('go.nextChange', 'Next change'),
    text('go.prevChange', 'Previous change'),
    { id: 'tab.close', name: 'Close tab', keys: 'Mod+Alt+W' },
    { id: 'tab.splitRight', name: 'Split right' },
    { id: 'tab.splitDown', name: 'Split down' },
  ]),
  ...group('Show and hide', [
    { id: 'view.sidebar', name: 'Show or hide the sidebar', keys: 'Mod+\\' },
    { id: 'view.list', name: 'Show or hide the note list', keys: 'Mod+Shift+\\' },
    { id: 'view.right', name: 'Show or hide the right sidebar', keys: 'Mod+Alt+\\' },
    { id: 'view.focus', name: 'Focus mode', keys: 'Mod+Shift+F' },
    { id: 'view.pages', name: 'Notes as pages (page view)', keys: 'Mod+Alt+P' },
    { id: 'view.ruler', name: 'Show or hide the ruler' },
    { id: 'view.toolbar', name: 'Formatting bar always or over selected text' },
    { id: 'view.typewriter', name: 'Typewriter mode' },
    own('view.marks', 'Show or hide ¶ marks', 'Mod+Shift+8'),
    { id: 'tab.outline', name: 'Right sidebar: outline' },
    { id: 'tab.styles', name: 'Right sidebar: Styles pane' },
    { id: 'tab.links', name: 'Right sidebar: links' },
    { id: 'tab.snapshots', name: 'Right sidebar: snapshots' },
    { id: 'tab.writing', name: 'Right sidebar: text statistics and highlighting' },
    { id: 'tab.thesaurus', name: 'Thesaurus and definitions', keys: 'Shift+F7' },
    { id: 'tab.comments', name: 'Reviewing pane: every change and comment' },
  ]),
  ...group('Writing', [
    own('edit.undo', 'Undo', 'Mod+Z'),
    own('edit.redo', 'Redo', ['Mod+Shift+Z', 'Mod+Y'], ['Mod+Y', 'Mod+Shift+Z']),
    text('edit.painter', 'Format painter', 'Mod+Alt+Shift+C'),
    own('edit.pageBreak', 'Page break', 'Mod+Enter'),
    own('edit.columnBreak', 'Column break', 'Mod+Shift+Enter'),
    own('edit.equation', 'Equation within the line', 'Alt+='),
    own('edit.hyphen', 'Optional hyphen', 'Mod+-'),
    own('edit.moveUp', 'Move the paragraph up', 'Alt+Shift+Up'),
    own('edit.moveDown', 'Move the paragraph down', 'Alt+Shift+Down'),
    own('edit.promote', 'Promote (a heading up a level)', 'Alt+Shift+Left'),
    own('edit.demote', 'Demote (a heading down a level)', 'Alt+Shift+Right'),
  ]),
  ...group('Text and paragraphs', [
    own('fmt.bold', 'Bold', 'Mod+B'),
    own('fmt.italic', 'Italic', 'Mod+I'),
    own('fmt.underline', 'Underline', 'Mod+U'),
    own('fmt.strike', 'Strikethrough', 'Mod+Shift+X'),
    own('fmt.code', 'Code (typewriter letters)', 'Mod+E'),
    own('fmt.superscript', 'Superscript', 'Mod+Shift+='),
    own('fmt.subscript', 'Subscript', 'Mod+='),
    own('fmt.clear', 'Clear formatting', 'Mod+Space'),
    own('fmt.font', 'Font window', 'Mod+D'),
    own('para.left', 'Align left', 'Mod+Shift+L'),
    own('para.center', 'Centre', 'Mod+Shift+E'),
    own('para.right', 'Align right', 'Mod+Shift+R'),
    own('para.justify', 'Justify', 'Mod+Shift+J'),
    own('para.single', 'Single line spacing', 'Mod+1'),
    own('para.oneHalf', '1.5 line spacing', 'Mod+5'),
    own('para.double', 'Double line spacing', 'Mod+2'),
    own('para.indent', 'Indent more', ['Ctrl+M', 'Mod+M']),
    own('para.outdent', 'Indent less', ['Ctrl+Shift+M', 'Mod+Shift+M']),
  ]),
  ...group('Review and check', [
    text('review.comment', 'New comment', 'Mod+Alt+M'),
    { id: 'review.track', name: 'Track changes on or off', keys: 'Mod+Alt+Shift+E' },
    text('review.snapshot', 'Take a snapshot', 'Mod+Alt+S'),
    text('review.compare', 'Compare with another note or chapter'),
    text('review.combine', 'Combine reviewers’ copies'),
    text('spell.add', 'Spelling: add the word at the cursor to your dictionary'),
    text('spell.ignore', 'Spelling: ignore the word at the cursor everywhere for now'),
    text('review.removeRevisions', 'Remove revision colours'),
    { id: 'revision.off', name: 'Revision mode off' },
  ]),
  ...group('Tools', [
    text('tool.read', 'Read aloud', 'Mod+Alt+Space'),
    text('tool.dictate', 'Dictate', 'Mod+Alt+D'),
    { id: 'sprint.stop', name: 'Stop the writing sprint' },
    { id: 'tool.submissions', name: 'Submissions: where your writing has been sent' },
    { id: 'tool.customise', name: 'Customise the formatting bar' },
    text('bookmark.doc', 'Bookmark this note or chapter (or remove it)'),
    text('bookmark.heading', 'Bookmark this heading (or remove it)'),
    text('export.word', 'Download the note as a Word document'),
    text('export.epub', 'Download the note as an e-book (ePub)'),
    { id: 'app.settings', name: 'Settings', keys: 'Mod+,' },
  ]),
  ...group('Help', [
    { id: 'help.shortcuts', name: 'Keyboard shortcuts', keys: 'Mod+/' },
    { id: 'help.guide', name: 'Open the guide to Crumpet' },
    { id: 'help.whatsNew', name: 'What’s new in Crumpet' },
    { id: 'help.problem', name: 'Report a problem' },
    { id: 'help.idea', name: 'Send an idea or thanks' },
  ]),
];
