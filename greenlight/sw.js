// Bump the cache name to force clients to fetch the latest assets
const CACHE = 'greenlight-v4';
const FILES = [
  './',
  './index.html',
  './partner-notes/index.html',
  './shared-scheduler/index.html',
  './css/style.css',
  './js/script.js',
  './manifest.json',
  './greenlightduck.png'
];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
