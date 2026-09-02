// Bump CACHE whenever you deploy a new version of index.html so that all
// clients discard the old cached shell and fetch fresh resources.
const CACHE = 'jot-v3';

// Resolve the shell URL once, relative to this SW script's location, so
// cache.add / cache.match / cache.put all use the same absolute URL key.
const SHELL_URL = new URL('./index.html', self.location).href;

self.addEventListener('install', e => {
  // Always skip waiting so this SW activates immediately.
  self.skipWaiting();
  // Pre-cache the app shell. Wrap in a catch so a network hiccup during
  // install never blocks the SW from installing — we'll pick it up on the
  // first successful navigation instead.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.add(SHELL_URL))
      .catch(() => {})
  );
});

self.addEventListener('activate', e => {
  // Delete stale caches then take control of all open tabs.
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only intercept top-level navigation requests (loading the app itself).
  if (e.request.mode !== 'navigate') return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(SHELL_URL).then(cached => {
        if (cached) {
          // Cache hit: respond immediately from cache, then refresh it in
          // the background so the next load gets the latest version.
          fetch(e.request)
            .then(res => cache.put(SHELL_URL, res))
            .catch(() => {}); // network down — silent; cached copy is fine
          return cached;
        }

        // Cache miss (first visit or install pre-cache failed): fetch from
        // network, cache the result for future loads, then serve it.
        return fetch(e.request).then(res => {
          cache.put(SHELL_URL, res.clone()); // clone before body is consumed
          return res;
        });
      })
    )
  );
});
