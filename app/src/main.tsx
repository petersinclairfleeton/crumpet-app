import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { openStorage } from './data/db';
import { AppStore } from './data/store';
import { App } from './ui/App';
import { StoreContext, SyncContext } from './ui/hooks';
import { SyncConnection } from './sync/connection';
import { mediaUrl, setFileStorage, setRemoteFiles } from './data/files';
import { setMediaResolver } from '@crumpet/editor/view';
import './ui/app.css';

async function start() {
  const storage = await openStorage();
  const store = new AppStore(storage);
  await store.load();
  const sync = new SyncConnection(store, storage);
  // Pictures and files in notes: kept on this device, fetched from the cloud folder when missing.
  setFileStorage(storage);
  setRemoteFiles(() => sync.provider);
  setMediaResolver(mediaUrl);
  sync.init().catch((err) => console.error('[crumpet] Sync could not start', err));
  // Save anything still waiting when the page is hidden or closed (phones rarely fire unload).
  // rescue() first: it keeps a copy that survives even if the save is cut short.
  const flush = () => {
    store.rescue();
    store.flush();
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  Object.assign(window, { crumpet: store, crumpetSync: sync });
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <StoreContext.Provider value={store}>
        <SyncContext.Provider value={sync}>
          <App />
        </SyncContext.Provider>
      </StoreContext.Provider>
    </StrictMode>,
  );
}

start();
