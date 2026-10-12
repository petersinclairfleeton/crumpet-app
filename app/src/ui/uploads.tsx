// Uploading documents: the Upload button, files dropped from the computer
// (on a notebook, the note list or a pane), how an uploaded file is shown,
// and Word documents saved back to their files as they're edited.

import { useEffect, useState } from 'react';
import { type FileKind, KIND_NAME, fileKind, fileLabel, readUpload, saveWordFile } from '../data/documents';
import { fileBlob, mediaUrl } from '../data/files';
import type { AppStore } from '../data/store';
import type { Note } from '../data/types';
import { useAppStore } from './hooks';
import { IconDownload } from './icons';

/** Whether something being dragged is files from the computer. */
export function hasFiles(e: React.DragEvent | DragEvent): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
}

/**
 * Makes a note of each file, in a notebook (null: none) or a project's
 * research. Returns the notes made; files that couldn't be read are named in
 * one message.
 */
export async function uploadFiles(store: AppStore, files: File[], where: { notebookId?: string | null; projectId?: string } = {}): Promise<Note[]> {
  const made: Note[] = [];
  const failed: string[] = [];
  for (const f of files) {
    try {
      const u = await readUpload(f);
      made.push(where.projectId ? store.addResearchNote(where.projectId, u, false) : store.createNote({ ...u, ...(where.notebookId !== undefined ? { notebookId: where.notebookId } : {}) }));
    } catch (err) {
      failed.push(err instanceof Error ? err.message : `${f.name} couldn’t be added.`);
    }
  }
  if (failed.length) alert(failed.join('\n'));
  return made;
}

/** Asks for files from this device. */
export function chooseUploads(onFiles: (files: File[]) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length) onFiles(files);
  };
  input.click();
}

/** Word documents waiting to be saved back to their files, by path: saving now. */
const pending = new Map<string, () => Promise<void>>();

/**
 * Keeps Word documents' files up to date: a few seconds after one is edited
 * here (or changed by a sync), its .docx is written again.
 */
export function useWordSaving(): void {
  const store = useAppStore();
  useEffect(() => {
    const seen = new Map<string, unknown>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const look = () => {
      for (const n of store.getState().notes) {
        if (!n.file || fileKind(n.file) !== 'word') continue;
        const was = seen.get(n.id);
        seen.set(n.id, n.doc);
        // The first look only notes where things are: an untouched file stays exactly as it came.
        if (was === undefined || was === n.doc) continue;
        const path = n.file;
        const save = async () => {
          clearTimeout(timers.get(n.id));
          timers.delete(n.id);
          pending.delete(path);
          const now = store.note(n.id);
          if (now) await saveWordFile(now).catch((err) => console.warn('[crumpet] Couldn’t save the Word document', err));
        };
        clearTimeout(timers.get(n.id));
        timers.set(n.id, setTimeout(save, 1500));
        pending.set(path, save);
      }
    };
    look();
    const off = store.subscribe(look);
    return () => {
      off();
      timers.forEach(clearTimeout);
    };
  }, [store]);
}

/** Downloads a note's file as it's kept (a Word document as last saved). */
export async function downloadFile(path: string): Promise<void> {
  // A Word document just edited: saved first.
  await pending.get(path)?.();
  const blob = await fileBlob(path);
  const url = blob ? URL.createObjectURL(blob) : await mediaUrl(path);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileLabel(path);
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (blob) setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** The address of a kept file, once it's ready. */
function useFileUrl(path: string): { url: string | null; failed: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setUrl(null);
    setFailed(false);
    Promise.resolve(mediaUrl(path)).then(
      (u) => live && setUrl(u),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [path]);
  return { url, failed };
}

/** An uploaded file, shown as what it is. */
export function FileView({ path }: { path: string }) {
  const kind: FileKind = fileKind(path);
  const { url, failed } = useFileUrl(path);
  const name = fileLabel(path);
  if (failed) return <p className="file-missing">This file isn’t on this device yet. It will be once the device has synced.</p>;
  if (!url) return <p className="file-missing">Opening…</p>;
  return (
    <div className={`file-view ${kind}`}>
      {kind === 'image' && <img src={url} alt={name} />}
      {kind === 'pdf' && <iframe title="PDF" src={url} />}
      {kind === 'video' && <video src={url} controls aria-label={name} />}
      {kind === 'audio' && <audio src={url} controls aria-label={name} />}
      {kind === 'other' && (
        <div className="file-other">
          <span className="file-glyph" aria-hidden="true">
            {(/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? 'file').toUpperCase().slice(0, 4)}
          </span>
          <p>Crumpet can’t show this kind of file, but it’s kept here with your notes. Download it to open it in another app.</p>
        </div>
      )}
      <p className="file-bar">
        <span className="ellipsis">
          {KIND_NAME[kind]} · {name}
        </span>
        <button type="button" className="link-btn" onClick={() => downloadFile(path)}>
          <IconDownload size={13} /> Download
        </button>
        {kind !== 'other' && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="link-btn">
            Open in a new tab
          </a>
        )}
      </p>
    </div>
  );
}

/** Under a Word document's title: what it is, and its file. */
export function WordBanner({ path }: { path: string }) {
  return (
    <p className="word-banner">
      <span className="word-glyph" aria-hidden="true">
        W
      </span>
      <span className="ellipsis">Word document · saved back to {fileLabel(path)} as you write</span>
      <button type="button" className="link-btn" onClick={() => downloadFile(path)}>
        <IconDownload size={13} /> Download
      </button>
    </p>
  );
}
