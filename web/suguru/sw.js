// Service worker: makes the app available offline.
// Its own files are fetched from the network first (at most 3 seconds), so changes show at once; without a network the stored copy is used.
// The build comes in the address (sw.js?b=<build>, from shared/js/build.js), and the offline storage is named after it.
// A new build is a new address, so the browser installs this worker again and stores a fresh copy of every file.
const BUILD = new URL(location.href).searchParams.get("b") || "dev";
const CACHE = "suguru-" + BUILD;
const FONTS = "suguru-fonts";
const SHELL = [
  "./",
  "./index.html",
  "./guide.html",
  "./guide-da.html",
  "./manifest.webmanifest",
  "../shared/css/app.css",
  "./js/app.js",
  "../shared/js/build.js",
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
  "../shared/js/draw.js",
  "../shared/js/play.js",
  "../shared/js/stats.js",
  "../shared/js/analysis.js",
  "../shared/js/takeaway.js",
  "../shared/js/progress.js",
  "../shared/js/drillgen.js",
  "../shared/js/games.js",
  "../shared/js/drill.js",
  "../shared/js/campaign.js",
  "../shared/js/trial.js",
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
      // only Suguru's own old caches (also those from before the move to suguru/): Sudoku has its own (sudoku-…)
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("suguru-") && k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
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

  e.respondWith(
    (async () => {
      const c = await caches.open(CACHE);
      try {
        // revalidated with the server (no-cache), so a new build.js is seen at once rather than after the browser's own cache
        const fresh = req.mode === "navigate" ? req : new Request(req, { cache: "no-cache" });
        const r = await Promise.race([fetch(fresh), timeout(3000)]);
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
