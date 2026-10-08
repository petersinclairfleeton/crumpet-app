import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../src/data/db';
import { addFile, mediaUrl, safeFileName, setFileStorage, setRemoteFiles, uploadFiles } from '../../src/data/files';
import { MemoryProvider } from '../../src/sync/provider';

describe('attached files', () => {
  it('get safe names in the Attachments folder', () => {
    expect(safeFileName('My photo (1).JPG')).toBe('My-photo-1.JPG');
    expect(safeFileName('../../etc/passwd')).toBe('etc-passwd');
    expect(safeFileName('')).toBe('file');
  });

  it('are kept on the device, copied to the folder, and fetched on another device', async () => {
    const mine = new MemoryStorage();
    setFileStorage(mine);
    const added = await addFile(new File(['png bytes'], 'lamp.png', { type: 'image/png' }));
    expect(added.type).toBe('image');
    expect(added.src).toMatch(/^Attachments\/[a-z0-9]{7}-lamp\.png$/);
    const pdf = await addFile(new File(['%PDF'], 'Ferry timetable.pdf', { type: 'application/pdf' }));
    expect(pdf).toMatchObject({ type: 'file', caption: 'Ferry timetable.pdf' });
    const cloud = new MemoryProvider();
    expect(await uploadFiles(cloud)).toBe(2);
    expect(await uploadFiles(cloud)).toBe(0);
    expect(await (await cloud.readBytes(added.src)).text()).toBe('png bytes');
    // Another device: not stored there, so it comes from the folder.
    const theirs = new MemoryStorage();
    setFileStorage(theirs);
    setRemoteFiles(() => cloud);
    await cloud.writeBytes('Attachments/zzzzzzz-map.png', new Blob(['map'], { type: 'image/png' }));
    const url = await mediaUrl('Attachments/zzzzzzz-map.png');
    expect(url).toMatch(/^blob:/);
    expect((await theirs.getFile('Attachments/zzzzzzz-map.png'))?.synced).toBe(true);
    expect(mediaUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
  });
});

describe('deleting notes', () => {
  it('deletes the pictures only they used, here and in the cloud folder', async () => {
    const { AppStore } = await import('../../src/data/store');
    const { makeBlock } = await import('@crumpet/editor/model');
    const storage = new MemoryStorage();
    setFileStorage(storage);
    const store = new AppStore(storage);
    await store.load();
    const a = await addFile(new File(['a'], 'a.png', { type: 'image/png' }));
    const shared = await addFile(new File(['s'], 'shared.png', { type: 'image/png' }));
    const local = await addFile(new File(['l'], 'local.png', { type: 'image/png' }));
    const cloud = new MemoryProvider();
    await uploadFiles(cloud);
    // Added after the last sync: never reached the cloud.
    const late = await addFile(new File(['z'], 'late.png', { type: 'image/png' }));
    const pic = (src: string) => makeBlock('image', '', [], { src });
    const one = store.createNote({ title: 'One', doc: { blocks: [pic(a.src), pic(shared.src), pic(late.src)] } });
    store.createNote({ title: 'Two', doc: { blocks: [pic(shared.src), pic(local.src)] } });
    store.trashNote(one.id);
    store.deleteForever(one.id);
    await store.flush();
    await new Promise((r) => setTimeout(r, 0));
    expect(await storage.getFile(late.src)).toBeNull();
    expect((await storage.getFile(a.src))?.gone).toBe(true);
    expect((await storage.getFile(shared.src))?.gone).toBeFalsy();
    expect(mediaUrl(a.src)).toBeInstanceOf(Promise);
    await uploadFiles(cloud);
    expect(await storage.getFile(a.src)).toBeNull();
    await expect(cloud.readBytes(a.src)).rejects.toThrow();
    expect(await (await cloud.readBytes(shared.src)).text()).toBe('s');
  });
});
