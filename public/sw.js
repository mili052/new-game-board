const CACHE_NAME = "new-game-board-v1";
const ASSETS = [
  "/new-game-board/",
  "/new-game-board/index.html",
  "/new-game-board/styles.css?v=11",
  "/new-game-board/app.js?v=11",
  "/new-game-board/manifest.webmanifest?v=1",
  "/new-game-board/icon-app.svg",
  "/new-game-board/icon-maskable.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match("/new-game-board/index.html")))
  );
});
