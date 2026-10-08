// Crumpet's service worker: keeps the app itself on this device so it opens
// without the internet. (Notes are kept on the device by the app already.)
//
// - The page: from the network when there is one (so updates arrive), else
//   the copy kept here.
// - Scripts, styles, icons and fonts: from the copy kept here, fetched and
//   kept the first time they're needed.

const CACHE = 'crumpet-app-v1';
const FONTS = 'crumpet-fonts-v1';
const scope = new URL(self.registration.scope);
const INDEX = new URL('./', scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // The page, and everything it loads, kept straight away.
      const res = await fetch(INDEX, { cache: 'no-cache' });
      const html = await res.clone().text();
      await cache.put(INDEX, res);
      const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => new URL(m[1], INDEX)).filter((u) => u.origin === scope.origin && !u.pathname.endsWith('/'));
      await Promise.all(urls.map((u) => cache.add(u.href).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE && key !== FONTS) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google sign-in, Drive and the like always go to the network.
  if (url.origin !== scope.origin && url.hostname !== 'fonts.googleapis.com' && url.hostname !== 'fonts.gstatic.com') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && url.href.split('#')[0].split('?')[0] === INDEX) event.waitUntil(keepPage(res.clone()));
          return res;
        } catch {
          return (await caches.match(INDEX)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  const fonts = url.origin !== scope.origin;
  event.respondWith(
    (async () => {
      const cache = await caches.open(fonts ? FONTS : CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      // Built files have their contents in their names, so a kept copy never goes stale.
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })(),
  );
});

/** Keeps a new copy of the page, and lets go of built files it no longer uses. */
async function keepPage(res) {
  const cache = await caches.open(CACHE);
  const html = await res.clone().text();
  await cache.put(INDEX, res);
  const used = new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => new URL(m[1], INDEX).href));
  for (const req of await cache.keys()) {
    if (new URL(req.url).pathname.includes('/assets/') && !used.has(req.url) && !html.includes(new URL(req.url).pathname.split('/').pop())) await cache.delete(req);
  }
}
