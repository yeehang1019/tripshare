const VERSION = "tripshare-v1";
const APP_ASSETS = [
  "/favicon.svg",
  "/app-icon-180.png",
  "/app-icon-192.png",
  "/app-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.destination === "image") {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
