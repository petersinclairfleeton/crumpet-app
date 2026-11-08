// Every command Crumpet has, for Settings → Shortcuts and the keys that run them
// (ui/shortcuts.tsx). The command palette's commands carry the same ids, so a
// shortcut and the palette always do the same thing. Shortcuts are written as
// in data/shortcuts.ts ("Mod" is ⌘ on a Mac and Ctrl elsewhere).

import { FIXED_COMMANDS, INSERT_KEYS, type ShortcutDef, TURN_INTO } from '../data/shortcuts';
import type { Settings } from '../data/types';
import { THEMES } from './themes';
import { SLASH_ITEMS } from './slash';
import { REVISIONS } from '../data/revisions';
import { SPRINT_LENGTHS } from '../data/sprints';
import { MARKUP_VIEWS } from './review';

export { TURN_INTO };

/** Every command, with its standard shortcut (some only while writing, or only now and then). */
export function shortcutDefs(settings: Pick<Settings, 'macros'>): ShortcutDef[] {
  const insert = SLASH_ITEMS.map((i): ShortcutDef => {
    const keys = INSERT_KEYS[i.id];
    return { id: `insert:${i.id}`, name: `${TURN_INTO.test(i.id) ? 'Turn into' : 'Insert'}: ${i.label}`, group: 'Turn into or insert', text: true, ...(keys ? { keys, builtin: true } : {}) };
  });
  const at = FIXED_COMMANDS.findIndex((d) => d.group === 'Review and check');
  const list = [...FIXED_COMMANDS.slice(0, at), ...insert, ...FIXED_COMMANDS.slice(at)];
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
