// Bump CACHE whenever you deploy a new version of index.html so that all
// clients discard the old cached shell and fetch fresh resources.
const CACHE = 'jot-v2';

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

  // Cache-first strategy: serve the cached shell immediately (no white
  // screen on slow connections), then refresh the cache in the background.
  // The user sees the newest version on their next page load.
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match('./index.html').then(cached => {
        const networkFetch = fetch(e.request).then(res => {
          cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached); // network failed and we already have a cached copy — use it
        // Serve cache immediately; if nothing cached yet, wait for network.
        return cached || networkFetch;
      })
    )
  );
});
