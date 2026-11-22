// Service worker for Sudoku (sudoku/): makes the app available offline. Built the same way as the other app's sw.js.
// Its own files are fetched from the network first (at most 3 seconds), so a new version takes effect at once; without a network the stored copy is used.
// So there is no version number to change when the files are updated.
const CACHE = "sudoku-v3";
const FONTS = "sudoku-fonts";
const SHELL = [
  "./",
  "./index.html",
  "./guide.html",
  "./guide-da.html",
  "./manifest.webmanifest",
  "../shared/css/app.css",
  "./css/sudoku.css",
  "./js/app.js",
  "./js/game.js",
  "./js/engine.js",
  "./js/gradew.js",
  "./js/code.js",
  "./js/worker.js",
  "../shared/js/lang/da.js",
  "../shared/js/i18n.js",
  "../shared/js/lz.js",
  "../shared/js/lzworker.js",
  "../shared/js/tutor.js",
  "../shared/js/grade.js",
  "../shared/js/route.js",
  "../shared/js/calib.js",
  "../shared/js/core.js",
  "../shared/js/home.js",
  "../shared/js/newgame.js",
  "../shared/js/store.js",
  "../shared/js/board.js",
  "../shared/js/play.js",
  "../shared/js/stats.js",
  "../shared/js/analysis.js",
  "../shared/js/takeaway.js",
  "../shared/js/progress.js",
  "../shared/js/debug.js",
  "../shared/js/settings.js",
  "../shared/js/main.js",
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
      // only Sudoku's own old caches: Suguru lives at the same address and has its own
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("sudoku-") && k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Fonts from Google: use the stored copy, and update in the background
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
  // only Sudoku's own files and the shared files (../shared/); the rest of the address belongs to the other app
  const own = new URL("./", self.registration.scope).pathname,
    shared = new URL("../shared/", self.registration.scope).pathname;
  if (!url.pathname.startsWith(own) && !url.pathname.startsWith(shared)) return;

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
