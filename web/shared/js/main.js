// Startup: clocks, automatic saving, links with a puzzle code and the service worker.

setInterval(() => {
  if (view !== "game" || !P || solved) return;
  if (meta && meta.trial) return trialTick();
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
if (GUEST_ENDED) setTimeout(() => toast(tr("Guest mode ended after 30 minutes away. Welcome back.")), 600);
// a shared link is the app's address + "#" + the puzzle code (SU1-… in Suguru, SD1-… in Sudoku)
const CODE_HASH = new RegExp("^#" + GAME.codePrefix, "i");
window.addEventListener("hashchange", () => {
  if (CODE_HASH.test(location.hash)) openFromHash();
});
function openFromHash() {
  const code = decodeURIComponent(location.hash.slice(1));
  try {
    history.replaceState(null, "", location.pathname + location.search);
  } catch (e) {}
  replaceGame(() => importCode(code));
}
window.claude?.hot?.snapshot?.(() => (P ? { current: { puzzle: P, entries, notes, elapsed: elapsed(), solved, meta }, view } : {}));

// Old games are recomputed to the newest scale from the puzzle code, a little at a time, so the statistics do not mix scales
function regradeOld() {
  // All at once in the background (40 ms at a time); newest first, saving along the way every 500 games
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
            // games from before pencil use was recorded: the grade as you used to play (the one the weights are fitted to)
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
      saveGames(todo.some((g) => g.arc)); // older games in the archive have changed
      if (view === "home") renderHome();
      if (view === "stats") renderStats();
    }
  };
  setTimeout(step, 800);
}
// ---------- Levels renumbered (26 Nov. 2026): the mixed pair came in as level 4, so the levels from triples up (old 4-12) moved
// one up (5-13). Everything stored that names a level is moved along once (store "levelsV"); the grades and step codes are
// recomputed anyway by regradeOld (fit 12). An export from before is moved the same way when it is imported (settings.js).
const LEVELS_V = 2;
const upL = (L) => (typeof L === "number" && L >= 4 ? L + 1 : L);
const upLv = (x) => (typeof x === "number" && Math.floor(x / 100) >= 4 ? x + 100 : x);
const upKeys = (o) => {
  const n = {};
  for (const k in o || {}) n[/^\d+$/.test(k) ? upL(+k) : k] = o[k];
  return n;
};
function levelsGame(g) {
  if (!g || typeof g !== "object") return g;
  if (typeof g.tech === "number") g.tech = upL(g.tech);
  if (Array.isArray(g.lv)) g.lv = g.lv.map(upLv);
  if (Array.isArray(g.moves))
    g.moves.forEach((m) => {
      for (const k of ["direct", "avail", "ahead"]) if (typeof m[k] === "number") m[k] = upL(m[k]);
    });
  if (g.route) {
    if (Array.isArray(g.route.ctx)) g.route.ctx.forEach((x) => (x[0] = upL(x[0])));
    if (g.route.times) g.route.times = upKeys(g.route.times);
  }
  if (g.camp && typeof g.camp.L === "number") g.camp.L = upL(g.camp.L);
  if (g.train && typeof g.train.L === "number") g.train.L = upL(g.train.L);
  return g;
}
// The other stores, as plain data (also used for an import): drills, the practice log, the campaign, the trials, training
const levelsDrills = (d) => upKeys(d);
const levelsPlog = (l) => (l || []).map((e) => (typeof e.k === "number" ? Object.assign({}, e, { k: upL(e.k) }) : e));
function levelsCampaign(c) {
  if (!c) return c;
  return Object.assign({}, c, {
    passed: upKeys(c.passed),
    practice: upKeys(c.practice),
    run: c.run ? Object.assign({}, c.run, { L: upL(c.run.L) }) : c.run,
    log: (c.log || []).map((e) => Object.assign({}, e, { L: upL(e.L) })),
    boards: (c.boards || []).map(levelsGame),
  });
}
const levelsTrials = (t) => (t ? Object.assign({}, t, { boards: (t.boards || []).map(levelsGame) }) : t);
const levelsTraining = (l) => (l || []).map((e) => Object.assign({}, e, { L: upL(e.L) }));
function migrateLevels() {
  if (store.get("levelsV", 1) >= LEVELS_V) return;
  games.forEach(levelsGame);
  saveGames(true);
  store.set("drills", levelsDrills(store.get("drills", {})));
  store.set("practicelog", levelsPlog(store.get("practicelog", [])));
  const c = store.get("campaign", null);
  if (c) store.set("campaign", levelsCampaign(c));
  const t = store.get("trials", null);
  if (t) store.set("trials", levelsTrials(t));
  store.set("training", levelsTraining(store.get("training", [])));
  const cur = store.get("current", null);
  if (cur && cur.puzzle) {
    if (cur.puzzle.rating) cur.puzzle.rating.level = upL(cur.puzzle.rating.level);
    if (typeof cur.puzzle.startAt === "number") cur.puzzle.startAt = upL(cur.puzzle.startAt);
    if (cur.meta) levelsGame(cur.meta);
    store.set("current", cur);
  }
  if (typeof ui.must === "number" && ui.must) {
    ui.must = upL(ui.must);
    saveUi();
  }
  store.set("daily", null); // the cached daily puzzle and the stash of practice boards are made again
  store.set("drillstash", {});
  store.set("levelsV", LEVELS_V);
}
// 27 Nov. 2026: the route analysis is kept for 200 games instead of 40, to collect data for the grading experiments. A
// setting of 40 (the old default and maximum) is raised once; a smaller choice is kept.
function raiseKeepMoves() {
  if (store.get("keepV", 1) >= 2) return;
  if (settings.keepMoves === 40) {
    settings.keepMoves = KEEP_MOVES;
    saveSettings();
  }
  store.set("keepV", 2);
}
function start(hot) {
  translateDom(document.body);
  applyTheme();
  migrateLevels();
  raiseKeepMoves();
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
  if (CODE_HASH.test(location.hash)) {
    go("home");
    openFromHash();
  } else go(hot && hot.view === "game" && P ? "game" : "home");
  if ("serviceWorker" in navigator && !FRAMED && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js?b=" + encodeURIComponent(APP_BUILD)).catch(() => {}); // a new build = a new address = a fresh install (sw.js)
  }
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
