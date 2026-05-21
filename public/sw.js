const CACHE_PREFIX = "new-game-board";

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX))
        .map(key => caches.delete(key))
    );
    await self.registration.unregister();
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", () => {
  // Intentionally no offline cache. We prefer fresh content for this site.
});
