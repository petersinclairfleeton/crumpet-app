import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { openStorage } from './data/db';
import { AppStore } from './data/store';
import { seed } from './data/seed';
import { App } from './ui/App';
import { StoreContext } from './ui/hooks';
import './ui/app.css';

async function start() {
  const store = new AppStore(await openStorage());
  await store.load((s) => seed(s));
  // Save anything still waiting when the page is hidden or closed (phones rarely fire unload).
  const flush = () => store.flush();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  (window as unknown as { crumpet: AppStore }).crumpet = store;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <StoreContext.Provider value={store}>
        <App />
      </StoreContext.Provider>
    </StrictMode>,
  );
}

start();
