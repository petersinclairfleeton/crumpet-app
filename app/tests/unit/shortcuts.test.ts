import { describe, expect, it } from 'vitest';
import { assignShortcut, bindingsFor, comboOf, commandFor, keptKey, plainKey, showCombo, standardKeys } from '../../src/data/shortcuts';
import { shortcutDefs } from '../../src/ui/shortcutlist';

const press = (code: string, key: string, mods: { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) => ({ code, key, metaKey: !!mods.meta, ctrlKey: !!mods.ctrl, altKey: !!mods.alt, shiftKey: !!mods.shift });

describe('keyboard shortcuts', () => {
  it('reads a key press by the key’s place, so Alt and Shift don’t change it', () => {
    expect(comboOf(press('KeyN', '˜', { meta: true, alt: true, shift: true }), true)).toBe('Mod+Alt+Shift+N');
    expect(comboOf(press('KeyN', 'n', { ctrl: true, alt: true, shift: true }), false)).toBe('Mod+Alt+Shift+N');
    // Control on a Mac is Control, not ⌘.
    expect(comboOf(press('KeyM', 'm', { ctrl: true }), true)).toBe('Ctrl+M');
    expect(comboOf(press('Backslash', '\\', { ctrl: true, shift: true }), false)).toBe('Mod+Shift+\\');
    expect(comboOf(press('Digit8', '*', { ctrl: true, shift: true }), false)).toBe('Mod+Shift+8');
    expect(comboOf(press('F5', 'F5'), false)).toBe('F5');
    expect(comboOf(press('ShiftLeft', 'Shift', { shift: true }), false)).toBeNull();
    expect(comboOf(press('Escape', 'Escape'), false)).toBeNull();
  });

  it('shows a shortcut as people read it on each computer', () => {
    expect(showCombo('Mod+Alt+Shift+N', true)).toBe('⌥⇧⌘N');
    expect(showCombo('Mod+Alt+Shift+N', false)).toBe('Ctrl+Alt+Shift+N');
    expect(showCombo('Ctrl+M', true)).toBe('⌃M');
    expect(showCombo('Alt+Shift+Up', true)).toBe('⌥⇧↑');
  });

  it('knows keys alone, and keys the browser keeps', () => {
    expect(plainKey('N')).toBe(true);
    expect(plainKey('Shift+N')).toBe(true);
    expect(plainKey('F5')).toBe(false);
    expect(plainKey('Mod+K')).toBe(false);
    expect(keptKey('Mod+N')).toMatch(/browser/);
    expect(keptKey('Mod+C')).toBe('Copy');
    expect(keptKey('Mod+Alt+Shift+N')).toBeNull();
  });

  it('gives every command a place, the New menu’s each a shortcut, and no two the same shortcut', () => {
    const defs = shortcutDefs({ macros: [{ id: 'm1', name: 'Tidy', steps: [], key: 1 }] });
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['new.upload', 'new.note', 'new.notebook', 'new.stack', 'new.manuscript']) expect(defs.find((d) => d.id === id)?.keys).toBeTruthy();
    expect(ids).toContain('theme:dark');
    expect(ids).toContain('insert:table');
    expect(ids).toContain('macro:m1');
    for (const mac of [true, false]) {
      const keys = defs.map((d) => standardKeys(d, mac)).filter(Boolean);
      expect(new Set(keys).size).toBe(keys.length);
      for (const k of keys) expect(keptKey(k!)).toBeNull();
    }
    expect(defs.filter((d) => d.keys).length).toBeGreaterThan(60);
  });

  it('changes a shortcut, taking it from the command that had it, and forgets changes back to the standard', () => {
    const defs = shortcutDefs({});
    let changed = assignShortcut(defs, undefined, false, 'go.trash', 'Mod+G');
    expect(changed).toEqual({ 'go.trash': 'Mod+G', 'go.graph': null });
    const b = bindingsFor(defs, changed, false);
    expect(commandFor(b, 'Mod+G')).toBe('go.trash');
    expect(b.get('go.graph')).toBeNull();
    // Back to the standard: Trash had none, so nothing is left changed.
    changed = assignShortcut(defs, changed, false, 'go.graph', 'Mod+G');
    expect(changed).toEqual({});
  });
});
