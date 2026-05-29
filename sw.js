// Bump CACHE whenever you deploy a new version of index.html so that all
// clients discard the old cached shell and fetch fresh resources.
const CACHE = 'jot-v1';

self.addEventListener('install', e => {
  // Pre-cache the app shell so the first offline load works immediately.
  e.waitUntil(
    caches.open(CACHE).then(c => c.add('./index.html'))
  );
  // Skip the waiting phase so the new SW activates right away.
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete caches left behind by older versions.
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  // Take control of already-open tabs without requiring a reload.
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only intercept navigation requests (loading the app itself).
  // Sub-resources like the GitHub-hosted icon are left to the browser.
  if (e.request.mode !== 'navigate') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Network succeeded — update the cache so the next offline visit
        // gets the latest version of index.html.
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() =>
        // Network failed — serve the cached shell.
        caches.match('./index.html')
      )
  );
});
