const CACHE = "nawaratt-v9";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/manifest.webmanifest", "/app-icon-192.png", "/app-icon-512.png", "/app-icon-maskable-512.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const safeAsset = ["/manifest.webmanifest", "/app-icon-192.png", "/app-icon-512.png", "/app-icon-maskable-512.png"].includes(url.pathname);
  if (!safeAsset) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
