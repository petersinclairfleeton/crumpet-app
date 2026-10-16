// Word's Insert Chart, Online Video and Screenshot, for the formatting bar.
// A chart is a ```chart block of numbers (the editor's chart.ts draws it);
// a video is a YouTube or Vimeo link played in the text; a screenshot is a
// picture of a window, tab or screen the browser lets you choose.

import { useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { videoEmbed } from '@crumpet/editor/video';
import { insertFiles } from './editing';
import { addFile } from '../data/files';
import { Popover } from './Sidebar';
import { type ToolItem, closeMore } from './toolbar';

const svg = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON_CHART = svg('M4 20V10M10 20V4M16 20v-7M22 20H2');
const ICON_VIDEO = svg('M3 6h13v12H3zM16 10l5-3v10l-5-3');
const ICON_SHOT = svg('M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z');

function VideoTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const ok = !!videoEmbed(url.trim());
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Online video" title="Online video" aria-expanded={open} disabled={off} onClick={() => setOpen(!open)}>
        {ICON_VIDEO}
      </button>
      {open && (
        <Popover label="Online video" onClose={() => setOpen(false)}>
          <form
            className="menu-list video-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ok || !ed) return;
              setOpen(false);
              closeMore();
              ed.focus();
              ed.insertMedia('file', url.trim(), title.trim());
              setUrl('');
              setTitle('');
            }}
          >
            <span className="menu-head">Online video</span>
            <label className="field">
              <span>YouTube or Vimeo link</span>
              <input aria-label="Video link" placeholder="https://www.youtube.com/watch?v=…" value={url} autoFocus onChange={(e) => setUrl(e.target.value)} />
            </label>
            <label className="field">
              <span>Title (if you like)</span>
              <input aria-label="Video title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            {url.trim() && !ok && <p className="error">That isn’t a YouTube or Vimeo video link.</p>}
            <button type="submit" className="btn small primary" disabled={!ok}>
              Insert
            </button>
            <p className="menu-note">It plays in the text (online). Word gets a link to it.</p>
          </form>
        </Popover>
      )}
    </span>
  );
}

/** A picture of a window, tab or screen, chosen in the browser's own window. */
export async function takeScreenshot(): Promise<File | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    alert('This browser can’t take screenshots. (Chrome, Edge and Firefox on a computer can.)');
    return null;
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch {
    return null; // Cancelled.
  }
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // A moment for the first real frame.
    await new Promise((r) => setTimeout(r, 250));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return null;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    return new File([blob], `Screenshot ${stamp}.png`, { type: 'image/png' });
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/** Chooses a file and puts it in the text: a PDF or web page shown inside the page (Object), or a 3D model. */
function chooseInto(ed: Editor, accept: string, embed: boolean): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const { type, src, caption } = await addFile(file);
      ed.focus();
      ed.insertMedia(type, src, caption, embed && type === 'file' ? 'embed' : undefined);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'That file couldn’t be added.');
    }
  });
  input.click();
}

const ICON_OBJECT = svg('M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6');
const ICON_MODEL = svg('M12 2l9 5v10l-9 5-9-5V7zM12 22V12M21 7l-9 5-9-5');

export function mediaItems(ed: Editor | null, off: boolean): ToolItem[] {
  const chart = () => {
    closeMore();
    ed?.focus();
    ed?.insertChart();
  };
  const shot = async () => {
    closeMore();
    const file = await takeScreenshot();
    if (file && ed) {
      ed.focus();
      await insertFiles(ed, [file]);
    }
  };
  return [
    {
      key: 'chart',
      pri: 1,
      node: (
        <button type="button" aria-label="Chart" title="Chart (or a table’s menu → Make a chart)" disabled={off} onClick={chart}>
          {ICON_CHART}
        </button>
      ),
      menu: (
        <button type="button" className="menu-item" disabled={off} onClick={chart}>
          <span className="menu-glyph">{ICON_CHART}</span> Chart
        </button>
      ),
    },
    { key: 'video', label: 'Online video', pri: 1, node: <VideoTool ed={ed} off={off} /> },
    {
      key: 'object',
      pri: 1,
      node: (
        <button type="button" aria-label="Object" title="Object: a PDF or web page shown inside the page" disabled={off} onClick={() => (closeMore(), ed && chooseInto(ed, '.pdf,.html,.htm,application/pdf,text/html', true))}>
          {ICON_OBJECT}
        </button>
      ),
      menu: (
        <button type="button" className="menu-item" disabled={off} onClick={() => (closeMore(), ed && chooseInto(ed, '.pdf,.html,.htm,application/pdf,text/html', true))}>
          <span className="menu-glyph">{ICON_OBJECT}</span> Object (a PDF shown inside)
        </button>
      ),
    },
    {
      key: 'model3d',
      pri: 1,
      node: (
        <button type="button" aria-label="3D model" title="3D model (.glb or .gltf): turn it with a finger or the mouse" disabled={off} onClick={() => (closeMore(), ed && chooseInto(ed, '.glb,.gltf,model/gltf-binary,model/gltf+json', false))}>
          {ICON_MODEL}
        </button>
      ),
      menu: (
        <button type="button" className="menu-item" disabled={off} onClick={() => (closeMore(), ed && chooseInto(ed, '.glb,.gltf,model/gltf-binary,model/gltf+json', false))}>
          <span className="menu-glyph">{ICON_MODEL}</span> 3D model
        </button>
      ),
    },
    {
      key: 'screenshot',
      pri: 1,
      node: (
        <button type="button" aria-label="Screenshot" title="Screenshot: a picture of a window, tab or screen" disabled={off} onClick={() => void shot()}>
          {ICON_SHOT}
        </button>
      ),
      menu: (
        <button type="button" className="menu-item" disabled={off} onClick={() => void shot()}>
          <span className="menu-glyph">{ICON_SHOT}</span> Screenshot
        </button>
      ),
    },
  ];
}
