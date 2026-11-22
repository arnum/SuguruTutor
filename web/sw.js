// Service worker for the front page (index.html in the root) and nothing else: the games in suguru/ and sudoku/ each have their own.
//
// Until November 2026 Suguru lived in the root, and its service worker was registered here. Phones with the old Suguru app
// fetch this file instead of the old one on the next visit, and then:
// - the old Suguru's offline storage (suguru-v1 … suguru-v34) is cleared; the new Suguru uses suguru-v35 and up
// - the front page is stored, so the old app on the home screen can open without a network and forward to suguru/ (which has its own
//   offline storage once it has been opened with a network)
const CACHE = "front-v2";
const OLD_SUGURU = /^suguru-v(\d+)$/;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["./", "./index.html"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const old = keys.filter((k) => OLD_SUGURU.test(k) && +k.match(OLD_SUGURU)[1] <= 34);
      await Promise.all(keys.filter((k) => (k.startsWith("front-") && k !== CACHE) || old.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
      // If we came from the old Suguru, its page may still be open (or fetched from the browser's cache): open the front page
      // again, so it forwards to suguru/
      if (old.length) {
        const wins = await self.clients.matchAll({ type: "window" });
        for (const w of wins) if (new URL(w.url).pathname === new URL("./", self.registration.scope).pathname) w.navigate(w.url).catch(() => {});
      }
    })(),
  );
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url),
    root = new URL("./", self.registration.scope).pathname;
  // only the front page itself; everything else (the games, fonts) goes straight to the network or to the games' own service workers
  if (url.origin !== location.origin || (url.pathname !== root && url.pathname !== root + "index.html")) return;
  e.respondWith(
    (async () => {
      const c = await caches.open(CACHE);
      try {
        // always the newest front page (not an older copy from the browser's cache, e.g. the old Suguru)
        const r = await Promise.race([fetch(req.url, { cache: "no-cache", credentials: "same-origin" }), timeout(3000)]);
        if (r.ok) c.put("./index.html", r.clone());
        return r;
      } catch (err) {
        return (await c.match("./index.html")) || Response.error();
      }
    })(),
  );
});
