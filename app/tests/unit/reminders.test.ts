import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { MemoryStorage } from '../../src/data/db';
import { AppStore, visibleIn } from '../../src/data/store';
import { decodeReminder, dueReminders, encodeReminder, quickTimes, reminderGroups, reminderText } from '../../src/data/reminders';
import { SyncEngine, type SyncState } from '../../src/sync/engine';
import { parseNoteFile, writeNoteFile } from '../../src/sync/notefile';
import { MemoryProvider } from '../../src/sync/provider';

const HOUR = 3_600_000;

describe('reminders', () => {
  it('are kept in the note’s file', () => {
    const at = Date.UTC(2026, 9, 10, 9);
    const file = writeNoteFile({ id: 'n1', title: 'Call Ann', tags: [], favorite: false, reminder: encodeReminder({ at, done: true }), created: 1, updated: 2, trashed: null, from: null, extra: '', body: 'Hi\n' });
    expect(file).toContain('reminder: 2026-10-10T09:00:00.000Z\nreminder-done: true\n');
    expect(decodeReminder(parseNoteFile(file).reminder)).toEqual({ at, done: true });
    // Written by hand, in any order, and "done" alone isn't a reminder.
    expect(decodeReminder(parseNoteFile('---\nreminder-done: yes\nreminder: 2026-10-10T09:00:00Z\n---\n').reminder)).toEqual({ at, done: true });
    expect(parseNoteFile('---\nreminder-done: true\n---\n').reminder).toBeUndefined();
  });

  it('are listed overdue, today, coming up and done, and say when in words', () => {
    const now = new Date(2026, 9, 9, 12).getTime();
    const note = (title: string, at: number, done = false) => ({ id: title, notebookId: null, title, doc: fromMarkdown(''), tags: [], favorite: false, createdAt: 0, updatedAt: 0, trashedAt: null, reminder: done ? { at, done } : { at } });
    const notes = [note('Later', now + 2 * HOUR), note('Late', now - HOUR), note('Next week', now + 7 * 24 * HOUR), note('Old', now - 48 * HOUR, true)];
    expect(reminderGroups(notes, now).map((g) => [g.label, g.notes.map((n) => n.title)])).toEqual([
      ['Overdue', ['Late']],
      ['Today', ['Later']],
      ['Coming up', ['Next week']],
      ['Done', ['Old']],
    ]);
    expect(dueReminders(notes, now).map((n) => n.title)).toEqual(['Late']);
    expect(reminderText(now + 2 * HOUR, now)).toMatch(/^Today, /);
    expect(reminderText(now + 24 * HOUR, now)).toMatch(/^Tomorrow, /);
    const quick = quickTimes(now);
    expect(quick.map((q) => q.label)).toEqual(['Later today', 'Tomorrow morning', 'Next week']);
    expect(new Date(quick[1].at).getHours()).toBe(9);
    expect(new Date(quick[2].at).getDay()).toBe(1);
    // Late at night there's no "later today".
    expect(quickTimes(new Date(2026, 9, 9, 22, 30).getTime()).map((q) => q.label)).toEqual(['Tomorrow morning', 'Next week']);
  });

  it('are set, done and taken off in the store, and sync to another device', async () => {
    let clock = 1_700_000_000_000;
    const now = () => (clock += 1000);
    const cloud = new MemoryProvider(now);
    const device = async () => {
      const store = new AppStore(new MemoryStorage(), now);
      await store.load();
      let saved: SyncState | null = null;
      const engine = new SyncEngine(store, cloud, { load: async () => saved, save: async (s) => void (saved = structuredClone(s)) }, { now });
      return { store, engine };
    };
    const mac = await device();
    const phone = await device();
    const n = mac.store.createNote({ title: 'Call Ann' });
    const at = Date.UTC(2026, 9, 10, 9);
    mac.store.setReminder(n.id, { at });
    expect(visibleIn(mac.store.getState(), { kind: 'reminders' }).map((x) => x.title)).toEqual(['Call Ann']);
    mac.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    expect(phone.store.note(n.id)?.reminder).toEqual({ at });
    phone.store.setReminder(n.id, { at, done: true });
    phone.store.flush();
    await phone.engine.sync();
    await mac.engine.sync();
    expect(mac.store.note(n.id)?.reminder).toEqual({ at, done: true });
    mac.store.setReminder(n.id, null);
    mac.store.flush();
    await mac.engine.sync();
    await phone.engine.sync();
    expect(phone.store.note(n.id)?.reminder).toBeUndefined();
  });
});
