// Choosing a folder in Google Drive with Google's own picker. Picking a folder
// there is also what gives Crumpet access to it: Crumpet never browses your
// Drive itself.

const FOLDER = 'application/vnd.google-apps.folder';

/** Set when Crumpet is built (see docs/google-drive-setup.md). Both are public values. */
const API_KEY: string = (import.meta.env?.VITE_GOOGLE_API_KEY as string | undefined) ?? '';
const APP_ID: string = (import.meta.env?.VITE_GOOGLE_APP_ID as string | undefined) ?? '';

// The project number is what lets picking a folder grant Crumpet access to it.
export const canPickFolder = !!API_KEY && !!APP_ID;

interface PickerBuilder {
  addView(v: unknown): PickerBuilder;
  setOAuthToken(t: string): PickerBuilder;
  setDeveloperKey(k: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setOrigin(o: string): PickerBuilder;
  setTitle(t: string): PickerBuilder;
  setCallback(fn: (data: PickerResult) => void): PickerBuilder;
  build(): { setVisible(v: boolean): void };
}

interface PickerResult {
  action: string;
  docs?: { id: string; name: string; mimeType: string }[];
}

interface GooglePicker {
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId?: unknown) => {
      setIncludeFolders(v: boolean): unknown;
      setSelectFolderEnabled(v: boolean): unknown;
      setMimeTypes(m: string): unknown;
      setParent(p: string): unknown;
    };
    ViewId: { FOLDERS: unknown };
    Action: { PICKED: string; CANCEL: string };
  };
}

let loading: Promise<GooglePicker> | null = null;

function loadPicker(): Promise<GooglePicker> {
  loading ??= new Promise<GooglePicker>((resolve, reject) => {
    const done = () => {
      const w = window as unknown as { gapi: { load(name: string, cb: () => void): void }; google: GooglePicker };
      w.gapi.load('picker', () => resolve(w.google));
    };
    if ((window as unknown as { gapi?: unknown }).gapi) return done();
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.async = true;
    s.onload = done;
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load Google's folder picker. Are you online?"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Shows Google's folder picker. Resolves with the chosen folder, or null if closed. */
export async function pickFolder(token: string): Promise<{ id: string; name: string } | null> {
  const g = await loadPicker();
  return new Promise((resolve) => {
    const view = new g.picker.DocsView(g.picker.ViewId.FOLDERS);
    view.setIncludeFolders(true);
    view.setSelectFolderEnabled(true);
    view.setMimeTypes(FOLDER);
    view.setParent('root');
    const builder = new g.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID)
      .setOrigin(`${location.protocol}//${location.host}`)
      .setTitle('Choose a folder for your Crumpet notes')
      .setCallback((data) => {
        if (data.action === g.picker.Action.PICKED && data.docs?.[0]) resolve({ id: data.docs[0].id, name: data.docs[0].name });
        else if (data.action === g.picker.Action.CANCEL) resolve(null);
      });
    builder.build().setVisible(true);
  });
}
