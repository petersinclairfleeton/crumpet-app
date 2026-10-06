// Two editors on one page, each acting as a separate device with its own
// sync client, talking to one in-page server. Network delay is simulated so
// you can see edits arrive.

import { type Doc, makeBlock } from '@crumpet/editor/model';
import { Editor } from '@crumpet/editor/editor';
import { SyncClient, SyncServer } from '@crumpet/editor/sync/collab';

const DELAY_MS = 250;

const initial: Doc = {
  blocks: [
    makeBlock('heading1', 'Shopping for the island trip'),
    makeBlock('paragraph', 'Ferry leaves at 7:40, so pack the night before.'),
    makeBlock('todo', 'Torch and spare batteries'),
    makeBlock('todo', 'Waterproofs'),
    makeBlock('todo', 'Tide tables'),
  ],
};

const server = new SyncServer(initial);
const serverEl = document.getElementById('server')!;

interface Device {
  name: string;
  editor: Editor;
  client: SyncClient;
  stateEl: HTMLElement;
  timer: number | null;
}

const devices: Device[] = ['mac', 'phone'].map((id) => {
  const section = document.getElementById(id)!;
  const client = new SyncClient(id, server);
  const editor = new Editor(section.querySelector<HTMLElement>('[data-editor]')!, client.doc);
  const device: Device = { name: id, editor, client, stateEl: section.querySelector('[data-state]')!, timer: null };
  const toggle = section.querySelector<HTMLInputElement>('[data-online]')!;
  toggle.addEventListener('change', () => {
    client.online = toggle.checked;
    if (client.online) scheduleSync(device);
    render();
  });
  editor.onChange((state, change) => {
    if (!change || change.source === 'remote' || !change.ops.length) return;
    client.local(change.ops, state.doc);
    scheduleSync(device);
    render();
  });
  return device;
});
(window as unknown as { devices: Device[]; server: SyncServer }).devices = devices;
(window as unknown as { server: SyncServer }).server = server;

function scheduleSync(d: Device): void {
  if (d.timer !== null || !d.client.online) return;
  d.timer = window.setTimeout(() => {
    d.timer = null;
    syncDevice(d);
  }, DELAY_MS);
}

function syncDevice(d: Device): void {
  if (!d.client.online) return;
  // Never redraw a note mid-composition (IME); try again shortly.
  if (d.editor.isComposing) return scheduleSync(d);
  const before = server.version;
  const steps = d.client.sync();
  if (steps) d.editor.applyRemote(d.client.doc, steps);
  if (server.version !== before) {
    // Tell the other online devices there's something new, as a push notification would.
    for (const other of devices) if (other !== d) scheduleSync(other);
  }
  render();
}

function render(): void {
  serverEl.textContent = `Server: version ${server.version} · ${server.log.length} edits stored`;
  for (const d of devices) {
    const waiting = d.client.pending.length;
    d.stateEl.classList.toggle('offline', !d.client.online);
    d.stateEl.textContent = !d.client.online
      ? `Offline · ${waiting} edit${waiting === 1 ? '' : 's'} waiting`
      : waiting
        ? `Syncing ${waiting} edit${waiting === 1 ? '' : 's'}…`
        : `Up to date · version ${d.client.version}`;
  }
}

render();
