// Clean self-unregistering service worker to ensure fresh public builds load seamlessly
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// Pass-through without trapping or breaking module fetches
self.addEventListener('fetch', () => {
  // Let network handle directly
});
