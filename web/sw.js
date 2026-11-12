// Service worker: gør appen tilgængelig offline.
// Egne filer hentes fra nettet først (højst 3 sekunder), så en ny version slår igennem med det samme; uden net bruges den gemte kopi.
// Der er derfor ikke noget versionsnummer, der skal rettes, når filerne opdateres.
const CACHE = "suguru-v2";
const FONTS = "suguru-fonts";
const SHELL = [
  "./",
  "./index.html",
  "./guide.html",
  "./guide-en.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/lang/en.js",
  "./js/i18n.js",
  "./js/engine.js",
  "./js/tutor.js",
  "./js/grade.js",
  "./js/code.js",
  "./js/route.js",
  "./js/core.js",
  "./js/home.js",
  "./js/newgame.js",
  "./js/store.js",
  "./js/board.js",
  "./js/play.js",
  "./js/stats.js",
  "./js/analysis.js",
  "./js/settings.js",
  "./js/main.js",
  "./js/worker.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Skrifttyper fra Google: brug den gemte kopi, og opdatér i baggrunden
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONTS).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req)
          .then((r) => {
            if (r.ok || r.type === "opaque") c.put(req, r.clone());
            return r;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }
  if (url.origin !== location.origin) return;

  e.respondWith(
    (async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await Promise.race([fetch(req), timeout(3000)]);
        if (r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        return (
          (await c.match(req, { ignoreSearch: true })) ||
          (req.mode === "navigate" ? await c.match("./index.html") : null) ||
          Response.error()
        );
      }
    })(),
  );
});
