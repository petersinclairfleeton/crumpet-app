// Every command Crumpet has, for Settings → Shortcuts and the keys that run them
// (ui/shortcuts.tsx). The command palette's commands carry the same ids, so a
// shortcut and the palette always do the same thing. Shortcuts are written as
// in data/shortcuts.ts ("Mod" is ⌘ on a Mac and Ctrl elsewhere).

import type { ShortcutDef, ShortcutGroup } from '../data/shortcuts';
import type { Settings } from '../data/types';
import { THEMES } from './themes';
import { SLASH_ITEMS } from './slash';
import { REVISIONS } from '../data/revisions';
import { SPRINT_LENGTHS } from '../data/sprints';
import { MARKUP_VIEWS } from './review';

type Def = Omit<ShortcutDef, 'group'>;
const group = (g: ShortcutGroup, defs: Def[]): ShortcutDef[] => defs.map((d) => ({ ...d, group: g }));
/** Done by the text itself, while writing. */
const own = (id: string, name: string, keys: ShortcutDef['keys'], also?: string[]): Def => ({ id, name, keys, also, builtin: true, text: true });
const text = (id: string, name: string, keys?: ShortcutDef['keys']): Def => ({ id, name, keys, text: true });

/** The heading styles and lists the text already has keys for (the editor's own). */
const INSERT_KEYS: Record<string, string> = {
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

const FIXED: ShortcutDef[] = [
  ...group('Make something new', [
    { id: 'new.upload', name: 'Upload files', keys: 'Mod+Alt+Shift+U' },
    { id: 'new.note', name: 'New note', keys: 'Mod+Alt+Shift+N' },
    { id: 'new.notebook', name: 'New notebook', keys: 'Mod+Alt+Shift+B' },
    { id: 'new.stack', name: 'New notebook stack', keys: 'Mod+Alt+Shift+K' },
    { id: 'new.manuscript', name: 'New manuscript', keys: 'Mod+Alt+Shift+M' },
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

/** Every command, with its standard shortcut (some only while writing, or only now and then). */
export function shortcutDefs(settings: Pick<Settings, 'macros'>): ShortcutDef[] {
  const insert = SLASH_ITEMS.map((i): ShortcutDef => {
    const keys = INSERT_KEYS[i.id];
    return { id: `insert:${i.id}`, name: `${TURN_INTO.test(i.id) ? 'Turn into' : 'Insert'}: ${i.label}`, group: 'Turn into or insert', text: true, ...(keys ? { keys, builtin: true } : {}) };
  });
  const at = FIXED.findIndex((d) => d.group === 'Review and check');
  const list = [...FIXED.slice(0, at), ...insert, ...FIXED.slice(at)];
  const review = list.findIndex((d) => d.id === 'revision.off');
  list.splice(review, 0, ...REVISIONS.map((r, i): ShortcutDef => ({ id: `revision:${i + 1}`, name: `Revision mode: ${r.name.toLowerCase()} round`, group: 'Review and check' })));
  list.splice(list.findIndex((d) => d.id === 'revision.off') + 1, 0, ...MARKUP_VIEWS.map(([v, name]): ShortcutDef => ({ id: `markup:${v}`, name: `Show ${name.toLowerCase()}`, group: 'Review and check' })));
  const tools = list.findIndex((d) => d.id === 'sprint.stop');
  list.splice(tools, 0, ...SPRINT_LENGTHS.map((m): ShortcutDef => ({ id: `sprint:${m}`, name: `Start a ${m}-minute writing sprint`, group: 'Tools' })));
  // Macros play with Alt+Shift and their number (Macros ▾), unless changed here.
  const macros = (settings.macros ?? []).map((m): ShortcutDef => ({ id: `macro:${m.id}`, name: `Run macro: ${m.name}`, group: 'Tools', text: true, ...(m.key ? { keys: `Alt+Shift+${m.key}` } : {}) }));
  const settingsAt = list.findIndex((d) => d.id === 'app.settings');
  list.splice(settingsAt, 0, ...macros);
  const themes = THEMES.map((t): ShortcutDef => ({ id: `theme:${t.id}`, name: `Theme: ${t.name}`, group: 'Themes' }));
  const help = list.findIndex((d) => d.group === 'Help');
  list.splice(help, 0, ...themes);
  return list;
}
