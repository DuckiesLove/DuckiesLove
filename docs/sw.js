const CACHE_VER  = 'ks-20241020a';
const CACHE_NAME = `tk-ks-${CACHE_VER}`;

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// IMPORTANT: ignoreSearch:false so ?v=ks-20241020a actually busts cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: false }).then(res => {
      return res || fetch(event.request).then(networkRes => {
        try {
          const reqURL = new URL(event.request.url);
          const isOK = event.request.method === 'GET' && networkRes.ok && reqURL.origin === location.origin;
          if (isOK) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(() => {});
          }
        } catch (_) {}
        return networkRes;
      });
    })
  );
});
