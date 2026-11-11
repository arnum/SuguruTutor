// Service worker til Suguru: gør appen tilgængelig offline.
// HTML hentes fra nettet først (så opdateringer slår igennem), alt andet fra cachen først.
const VERSION = "suguru-6575c3d3f3";
const FONTS = "suguru-fonts";
const SHELL = ["./", "./index.html", "./guide.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Skrifttyper fra Google: brug cachen, opdatér i baggrunden
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // Sider: nettet først (højst 3 sekunder), ellers cachen
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const r = await Promise.race([fetch(req), timeout(3000)]);
        if (r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        return (await c.match(req, { ignoreSearch: true })) || (await c.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Alt andet: cachen først
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
    if (r.ok) caches.open(VERSION).then(c => c.put(req, r.clone()));
    return r;
  })));
});
