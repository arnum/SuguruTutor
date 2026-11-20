// Opstart: ure, automatisk gemning, links med opgavekode og service worker.

setInterval(() => {
  if (view !== "game" || !P || solved) return;
  const t = $("timer");
  if (t) t.textContent = fmt(elapsed());
}, 1000);
setInterval(() => {
  if (view === "game" && P && !solved) saveCurrent();
}, 10000);
document.addEventListener("visibilitychange", () => {
  syncClock();
  if (document.visibilityState === "hidden") saveCurrent();
});
window.addEventListener("pagehide", saveCurrent);
window.addEventListener("hashchange", () => {
  if (/^#SU1/i.test(location.hash)) openFromHash();
});
function openFromHash() {
  const code = decodeURIComponent(location.hash.slice(1));
  try {
    history.replaceState(null, "", location.pathname + location.search);
  } catch (e) {}
  replaceGame(() => importCode(code));
}
window.claude?.hot?.snapshot?.(() => (P ? { current: { puzzle: P, entries, notes, elapsed: elapsed(), solved, meta }, view } : {}));

// Gamle spil regnes om til den nyeste skala ud fra opgavekoden, lidt ad gangen, så statistikken ikke blander skalaer
function regradeOld() {
  // Alle på én gang i baggrunden (40 ms ad gangen); nyeste først, og der gemmes undervejs for hver 500 spil
  const todo = games.filter((g) => (g.fit !== GW.fit || (!g.lv && !g.arc)) && g.code && !g.noRegrade).reverse();
  if (!todo.length) return;
  let i = 0,
    lastSave = 0;
  const step = () => {
    const t0 = Date.now();
    while (i < todo.length && Date.now() - t0 < 40) {
      const g = todo[i++];
      try {
        const d = decodePuzzle(g.code),
          G2 = E.makeGeometry(d.rows, d.cols);
        const st = solveProfile(createTutor(G2, d.region), d.givens),
          gr = st && gradeFromSteps(st);
        if (gr) {
          if (g.oldValue == null) g.oldValue = g.value;
          if (g.felt != null && Math.abs(gr.value - g.value) >= 0.3) {
            g.feltOld = g.felt;
            delete g.felt;
          }
          g.value = gr.value;
          g.level = gr.band;
          g.tech = gr.tech;
          g.peak = gr.peak;
          g.load = gr.load;
          g.nHard = gr.nHard;
          g.scale = 2;
          g.fit = GW.fit;
          g.np = gr.np ? gr.np.value : g.value;
          g.npk = gr.np ? gr.np.peak : g.peak;
          g.npl = gr.np ? gr.np.load : g.load;
          if (g.pen == null) {
            // spil fra før blyant blev registreret: graden som du plejede (den, vægtene er tilpasset)
            const tg = gradeFromSteps(st, null);
            g.tg = tg.value;
            g.tgk = tg.peak;
            g.tgl = tg.load;
          }
          g.lv = gr.lv;
        } else g.noRegrade = 1;
      } catch (e) {
        g.noRegrade = 1;
      }
    }
    if (i < todo.length) {
      if (i - lastSave >= 500) {
        lastSave = i;
        saveGames(todo.slice(0, i).some((g) => g.arc));
      }
      setTimeout(step, 30);
    } else {
      saveGames(todo.some((g) => g.arc)); // ældre spil i arkivet er ændret
      if (view === "home") renderHome();
      if (view === "stats") renderStats();
    }
  };
  setTimeout(step, 800);
}
function start(hot) {
  translateDom(document.body);
  applyTheme();
  regradeOld();
  refreshRouteSummaries();
  upgradeAheadVia();
  const cur = store.get("current", null) || (hot && hot.current) || null;
  if (cur && cur.puzzle) {
    try {
      loadPuzzle(cur.puzzle, cur);
    } catch (e) {
      P = null;
    }
  }
  if (/^#SU1/i.test(location.hash)) {
    go("home");
    openFromHash();
  } else go(hot && hot.view === "game" && P ? "game" : "home");
  if ("serviceWorker" in navigator && !FRAMED && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
