const CACHE = "perrustingo-v1";
const PRECACHE = ["/", "/reserva", "/login", "/registro", "/offline"];
const STATIC = ["/logo.png", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([...PRECACHE, ...STATIC]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  // Nunca interceptar los assets del framework — sus hashes cambian por build
  // y servirlos desde caché rompe la hidratación (reloads infinitos).
  if (url.pathname.startsWith("/_next/")) return;

  const network = () =>
    fetch(e.request).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return res;
    });

  // Navegaciones: red primero (HTML siempre fresco), caché solo si no hay conexión
  if (e.request.mode === "navigate") {
    e.respondWith(
      network().catch(() =>
        caches
          .match(e.request)
          .then((r) => r ?? caches.match("/offline"))
          .then((r) => r ?? Response.error())
      )
    );
    return;
  }

  // Assets: caché primero con actualización en segundo plano
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = network().catch(
        () => cached ?? Response.error()
      );
      return cached ?? fresh;
    })
  );
});
