// Service Worker mínimo para Consejo Sinérgico
// - Cachea el shell estático (index, assets) para carga rápida
// - Fallback informativo cuando no hay red
// - No cachea API (/api/trpc) — siempre va a red
const CACHE_VERSION = "v1";
const CACHE_NAME = `consejo-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = ["/", "/offline.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear APIs
  if (url.pathname.startsWith("/api/")) return;

  // Navegaciones: network-first con fallback offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        return cached || cache.match(OFFLINE_URL) || new Response("Sin conexión", { status: 503 });
      })
    );
    return;
  }

  // Assets: cache-first
  if (/\.(js|css|webp|png|svg|woff2?|ico|json)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return cached || new Response("", { status: 504 });
        }
      })
    );
  }
});
