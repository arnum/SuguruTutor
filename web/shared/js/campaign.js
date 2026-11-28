// Campaign: a path through the techniques, one step per technique, in order. The first CAMP_PART boards of a step start
// part-solved, where its technique is the next step; after that, seeing when it is needed is part of the lesson. Each
// board moves a rating for the step (Glicko,
// below), shown as a bar; a full bar passes the step. A step you already master goes in a board or two; when a board does
// not go well you practise outside the campaign before you try again. The practice in between is not part of the
// campaign: normal games and the practice drills count. A step opens with an example board of its technique (open when
// the technique is new to you, folded away when you know it).
// Campaign boards have no hints (the button is simply not there) and stay out of the statistics: they are kept in the
// store "campaign", the latest with their route analysis, so the sheet after a board can show it as after any game.
// First version 25 Nov. 2026, the rating 27 Nov. 2026; the numbers below are a first guess, to be tuned.

// The rating per step (Glicko-1, Glickman 1999). Each board is a game against a standard board of the technique (rating
// CAMP_OPP, no uncertainty). The score is how it went: 1 within your usual time (the estimate), falling to 0 at CAMP_ZERO
// times it, and 0 when it was not solved without help. The rating moves a lot while it is uncertain (rd) and little once
// it has settled, and the uncertainty grows again after a break. A step is passed when rating - rd reaches CAMP_BAR: with
// nothing known, two quick clean boards; slower boards need more. The bar shows rating - rd from where it started to CAMP_BAR.
const CAMP_OPP = 1500,
  CAMP_R0 = 1500, // the start when the technique is new to you...
  CAMP_RD0 = 350,
  CAMP_RK = 1600, // ... and when you have solved CAMP_KNOWN games that need it (one quick board can then pass the step)
  CAMP_RDK = 250,
  CAMP_KNOWN = 3,
  CAMP_BAR = 1450,
  CAMP_DAY = 30, // rd grows by this per day without a board (added as squares), up to CAMP_RD0
  CAMP_FAST = 1.0, // score 1 up to this many times your usual time ...
  CAMP_ZERO = 2.5, // ... falling to 0 here
  CAMP_SLOW = 2.0, // slower than this, or not solved without help: practise outside the campaign first
  CAMP_GQ = Math.log(10) / 400;
const CAMP_PART = 2; // the first boards of a step (over all its tries) start part-solved, where the technique is the next step
const CAMP_PRACTICE = 3; // after a board that did not go well: this many puzzles that need the technique, outside the campaign
const CAMP_DRILLS = 15; // ... or this many practice boards of it (techniques with a practice drill)
const CAMP_TRAIN = 5; // ... or, for the chains and what-ifs (no drill), this many training boards where you find it without a hint
const CAMP_KEEP = 20, // campaign boards kept (for the sheet afterwards, the route analysis and the export)
  CAMP_KEEP_MOVES = 5; // of which the latest keep their moves

const campLevels = () => TT.list();
function campState() {
  const s = store.get("campaign", null) || {};
  const c = { passed: s.passed || {}, run: s.run || null, practice: s.practice || {}, rate: s.rate || {}, log: s.log || [], boards: s.boards || [] };
  // Boards played before the rating (27 Nov. 2026, logged without a score) are replayed into it once, by the new rule: a
  // step whose bar they fill is passed on the board that filled it ("ok" then meant solved without help within 1.5 times
  // your usual time). In build 2026-11-27a the replay was only shown and did not pass the step, so a full bar could
  // stand on a step not passed.
  let moved = false;
  for (const L of new Set(c.log.filter((e) => e.s === undefined).map((e) => e.L))) {
    if (c.rate[L] || c.passed[L] || !TT.known(L)) continue;
    let rt = campFresh(L);
    for (const e of c.log) {
      if (e.L !== L || e.s !== undefined) continue;
      const r = e.est ? e.ms / 1000 / e.est : null;
      rt = Object.assign(campGlicko(campAged(rt, +new Date(e.end)), campScore(e.solved && (e.ok || (r != null && r > 1.5)), r)), { t: e.end });
      if (campDone(rt)) {
        c.passed[L] = e.end;
        delete c.practice[L];
        if (c.run && c.run.L === L) c.run = null;
        break;
      }
    }
    c.rate[L] = rt;
    moved = true;
  }
  if (moved) campSave(c);
  return c;
}
function campSave(c) {
  const boards = c.boards.slice(-CAMP_KEEP).map((b, i, a) => {
    if (i >= a.length - CAMP_KEEP_MOVES || !b.moves) return b;
    const o = Object.assign({}, b);
    delete o.moves; // older boards keep the summary only
    return o;
  });
  store.set("campaign", { passed: c.passed, run: c.run, practice: c.practice, rate: c.rate, log: c.log.slice(-300), boards });
}
// A board's record with its route analysis, once that is done
function campKeep(rec) {
  const c = campState();
  c.boards = c.boards.filter((b) => b.id !== rec.id).concat([rec]);
  campSave(c);
}
// The step you are on: the first technique not passed (null when all are)
const campStep = (c = campState()) => campLevels().find((L) => !c.passed[L]) || null;
// The grade band where a technique is typical (the generator's starting technique per band, GAME.gradeStart)
function campBand(L) {
  const START = GAME.gradeStart || [0, 1, 2, 2, 3, 6, 7, 9, 10, 11];
  let b = 1;
  for (let k = 1; k <= 9; k++) if (START[k] <= L) b = k;
  return b;
}
// The board size: the one chosen in New game, but not 4×4 (the campaign needs room for the techniques): then the game's
// usual size
function campSize() {
  const s = SIZES[ui.sizeIdx] || SIZES[0],
    home = SIZES.find((x) => x.r + "x" + x.c === (GAME.ui || {}).size); // the game's usual size (Sudoku: 9×9)
  return s.r * s.c > 16 ? s : home || SIZES.find((x) => x.r * x.c > 16) || s;
}
// Practice since a board did not go well: puzzles outside the campaign that needed the technique (solved without help),
// and practice boards of it
function campPracticeDone(L, since) {
  const lvOf = (x) => Math.floor(x / 100);
  const n = games.filter((g) => g.end > since && g.solved && !g.hints && !g.revealed && (g.lv || []).some((x) => lvOf(x) === L)).length;
  const d = store.get("practicelog", []).filter((e) => e.d > since && e.k === L && e.r !== "miss").length;
  const t = DRILL_TECHS.includes(L) ? 0 : trainFound(L, since);
  return { n, d, t, ok: n >= CAMP_PRACTICE || (DRILL_TECHS.includes(L) ? d >= CAMP_DRILLS : t >= CAMP_TRAIN) };
}
// Practice for a step: the drill (the techniques with a drill), or training boards that start where the technique is next (train.js)
const campCanPractise = (L) => (DRILL_TECHS.includes(L) ? typeof startDrill === "function" : TT.known(L) && TT.beyond(L));
const campPractise = (L) => (DRILL_TECHS.includes(L) ? startDrill(L) : trainStart(L, "practice"));
// Where a step stands: passed, practise first, ready (to start or go on)
function campStatus(L, c = campState()) {
  if (c.passed[L]) return { kind: "passed", when: c.passed[L] };
  const pr = c.practice[L];
  if (pr) {
    const done = campPracticeDone(L, pr.since);
    if (!done.ok) return { kind: "practice", ...done };
  }
  const run = c.run && c.run.L === L ? c.run : null;
  return { kind: "ready", board: run ? run.board : 0, pct: campPct(campRating(L, c)) };
}

// ---------- The rating
// Solved games outside the campaign that needed the technique, without help: your history with it
function campHistory(L) {
  return games.filter((g) => g.solved && !g.hints && !g.revealed && (g.lv || []).some((x) => Math.floor(x / 100) === L)).length;
}
const campKnows = (L, c = campState()) => campHistory(L) >= CAMP_KNOWN || (c.rate[L] && c.rate[L].n > 0) || !!c.passed[L];
function campFresh(L) {
  const k = campHistory(L) >= CAMP_KNOWN,
    r = k ? CAMP_RK : CAMP_R0,
    rd = k ? CAMP_RDK : CAMP_RD0;
  return { r, rd, n: 0, t: null, lb0: r - rd };
}
// One board: s from 0 to 1 against the standard board
function campGlicko(rt, s) {
  const E = 1 / (1 + Math.pow(10, -(rt.r - CAMP_OPP) / 400)),
    inv = 1 / (rt.rd * rt.rd) + CAMP_GQ * CAMP_GQ * E * (1 - E);
  return Object.assign({}, rt, { r: rt.r + (CAMP_GQ / inv) * (s - E), rd: Math.sqrt(1 / inv), n: (rt.n || 0) + 1 });
}
// The uncertainty grows with the days since the last board
function campAged(rt, now = Date.now()) {
  if (!rt.t) return rt;
  const days = Math.max(0, (now - Date.parse(rt.t)) / 864e5);
  return Object.assign({}, rt, { rd: Math.min(CAMP_RD0, Math.sqrt(rt.rd * rt.rd + CAMP_DAY * CAMP_DAY * days)) });
}
const campScore = (clean, r) => (!clean ? 0 : r == null ? 0.75 : Math.max(0, Math.min(1, (CAMP_ZERO - r) / (CAMP_ZERO - CAMP_FAST))));
// The step's rating now. A step without one starts fresh, after the boards played before the rating came in (27 Nov.
// 2026, logged without a score) are replayed: "ok" then meant solved without help within 1.5 times your usual time.
// The step's rating now (boards from before the rating are replayed into it by campState)
function campRating(L, c = campState(), now = Date.now()) {
  return campAged(c.rate[L] || campFresh(L), now);
}
const campDone = (rt) => rt.r - rt.rd >= CAMP_BAR;
const campPct = (rt) => Math.max(0, Math.min(1, (rt.r - rt.rd - rt.lb0) / (CAMP_BAR - rt.lb0)));
// How many quick clean boards would pass the step from here (at least that many more)
function campMore(rt) {
  let x = rt,
    n = 0;
  while (!campDone(x) && n < 20) (x = campGlicko(x, 1)), n++;
  return n;
}
// The bar: how far the step has come; with from, the change one board made (lighter: gained, red: lost)
function campBarHtml(L, to, from = to) {
  const a = Math.min(from, to),
    b = Math.max(from, to),
    w = (x) => (100 * x).toFixed(1) + "%",
    p = Math.round(100 * to);
  const label = tr("{tech}: {p} % of the way to passing", { tech: cap(LEVEL_TECH[L]), p });
  return (
    `<div class="campbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${esc(label)}" data-tip="${esc(label)}">` +
    `<span class="cb-track"><span class="cb-fill" style="width:${w(a)}"></span>` +
    (b - a > 0.004 ? `<span class="cb-${to >= from ? "gain" : "loss"}" style="left:${w(a)};width:${w(b - a)}"></span>` : "") +
    `</span><b class="cb-p">${p} %</b></div>`
  );
}

// ---------- The example board at the start of a step: a board where the technique is the next step, found in the
// background the first time (drillgen.js, findExample) and kept. At a glance: the step that decides it (keyView), with
// the legend; "Step by step" has the whole explanation. Open when the technique is new to you, folded away when you know it.
const CAMP_EX_V = 1;
let campExBusy = {},
  campExMemo = {};
function campExample(L) {
  const ex = store.get("campex", {})[L];
  return ex && ex.v === CAMP_EX_V ? ex : null;
}
function campExampleFetch(L) {
  if (campExBusy[L] || typeof askWorker !== "function") return;
  campExBusy[L] = 1;
  const s = campSize();
  askWorker(
    { type: "example", L, rows: s.r, cols: s.c, band: campBand(L), maxRegion: ui.maxRegion, seed: (Math.random() * 1e9) >>> 0, budget: 8000 },
    (r) => findExample(E, r),
  ).then((b) => {
    if (!b) return; // none found in the time: tried again next time the app starts
    const all = store.get("campex", {});
    all[L] = Object.assign({ v: CAMP_EX_V }, b);
    store.set("campex", all);
    campExBusy[L] = 0;
    document.querySelectorAll(`[data-cex="${L}"]`).forEach((x) => (x.outerHTML = campExampleHtml(L)));
  });
}
function campExampleHtml(L) {
  const ex = campExample(L);
  if (!ex) {
    campExampleFetch(L);
    return `<div class="campex" data-cex="${L}" hidden></div>`;
  }
  const key = ex.givens.join("");
  let m = campExMemo[L];
  if (!m || m.key !== key) {
    const size = {};
    ex.region.forEach((r) => (size[r] = (size[r] || 0) + 1));
    m = campExMemo[L] = {
      key,
      h: createTutor(E.makeGeometry(ex.rows, ex.cols), ex.region).easiest(ex.givens),
      P2: { d: { rows: ex.rows, cols: ex.cols, region: ex.region, givens: ex.givens }, maxR: Math.max(...Object.values(size)) },
    };
  }
  if (!m.h || m.h.hardestLevel !== L) return "";
  const kv = keyView(m.h),
    mark = { c: m.h.cell, v: m.h.v, col: "var(--indigo)" };
  return (
    `<details class="campex" data-cex="${L}"${campKnows(L) ? "" : " open"}><summary>${esc(tr("Example: {tech}", { tech: LEVEL_TECH[L] }))}</summary>` +
    `<div class="campexb">${miniBoard(m.P2, ex.givens, kv, null)}${viewLegend(kv)}</div>` +
    `<details class="campsteps"><summary>${tr("Step by step")}</summary>${stepsHtml(m.P2, ex.givens, m.h, mark)}</details></details>`
  );
}

// ---------- A board
function campStart() {
  const c = campState(),
    L = campStep(c);
  if (!L) return;
  if (campStatus(L, c).kind === "practice") return;
  if (c.practice[L]) {
    delete c.practice[L]; // practised: a new try
    campSave(c);
  }
  const run = c.run && c.run.L === L ? c.run : { L, board: 0, results: [] };
  c.run = run;
  campSave(c);
  const k = run.board,
    part = TT.beyond(L) && campRating(L, c).n < CAMP_PART,
    s = campSize();
  const go2 = () =>
    generate(
      {
        rows: s.r,
        cols: s.c,
        level: campBand(L),
        must: L,
        seed: (Math.random() * 1e9) >>> 0,
        budget: 20000,
        lo: 0,
        hi: 9,
        nuance: "alle",
        kind: "alle",
        maxRegion: ui.maxRegion,
        np: noPen(),
        startAt: part ? L : 0,
      },
      tr("Campaign: looking for a board with {tech} …", { tech: LEVEL_TECH[L] }),
      (p) => {
        loadPuzzle(p, null, { camp: { L, board: k, part: !!p.startAt } });
        go("game");
        setMsg(
          (p.startAt
            ? tr("Campaign · {tech}, board {k}. The board starts where {tech} is the next step.", { tech: LEVEL_TECH[L], k: k + 1 })
            : tr("Campaign · {tech}, board {k}.", { tech: LEVEL_TECH[L], k: k + 1 })) +
            (p.rating.level !== L ? " " + tr("No board that needs {tech} turned up in time; this one needs {got}.", { tech: LEVEL_TECH[L], got: LEVEL_TECH[p.rating.level] }) : ""),
          "",
        );
      },
    );
  replaceGame(go2);
}
// A board has ended (solved, given up or left): what it means for the step. Called from recordGame instead of storing the
// game in the statistics.
function campRecord(rec) {
  const c = campState(),
    { L } = rec.camp;
  const run = c.run && c.run.L === L ? c.run : { L, board: rec.camp.board || 0, results: [] };
  const clean = rec.solved && !rec.hints && !rec.checks && !rec.revealed,
    r = rec.est ? rec.ms / 1000 / rec.est : null,
    s = campScore(clean, r),
    bad = !clean || (r != null && r > CAMP_SLOW);
  const before = campRating(L, c, +new Date(rec.end)),
    after = Object.assign(campGlicko(before, s), { t: rec.end });
  c.rate[L] = after;
  run.results.push({ ms: rec.ms, est: rec.est, s, part: !!rec.camp.part });
  c.log.push({ L, board: run.board, s: Math.round(s * 100) / 100, ok: !bad, solved: !!rec.solved, ms: rec.ms, est: rec.est, end: rec.end, code: rec.code, r: Math.round(after.r), rd: Math.round(after.rd) });
  rec.campProg = { from: campPct(before), to: campPct(after), more: campMore(after), s };
  let out;
  if (campDone(after)) {
    c.passed[L] = rec.end;
    c.run = null;
    out = "passed";
    const next = campLevels().find((x) => !c.passed[x]);
    if (next) setTimeout(() => campExampleFetch(next), 0); // the next step's example, for the sheet
  } else if (bad) {
    c.practice[L] = { since: rec.end };
    c.run = null;
    out = "practice";
  } else {
    run.board++;
    c.run = run;
    out = "next";
  }
  rec.campOut = out;
  rec.campRatio = r;
  c.boards = c.boards.filter((b) => b.id !== rec.id).concat([rec]);
  campSave(c);
}
// Giving up a campaign board ends it at once (the solution is not shown first: you may want to try it again later)
function campGiveUp() {
  confirmSheet({
    title: tr("Give up this board?"),
    text: tr("The step then needs practice outside the campaign before you can try again."),
    ok: tr("Give up"),
    cancel: tr("Keep trying"),
    onOk: () => {
      meta.revealed = true;
      const rec = recordGame(false);
      solved = true;
      saveCurrent();
      renderAll();
      if (rec) {
        startRoute(rec); // the moves so far, as the lesson
        campResult(rec);
      }
    },
  });
}
// After a campaign board: the conclusion as the heading, then the same analysis as after any game (the moments worth a
// second look and the route), then what to do next
function campHead(rec) {
  const tech = LEVEL_TECH[rec.camp.L],
    out = rec.campOut;
  const pg = rec.campProg || {};
  return out === "fast" || out === "passed"
    ? tr("{tech} passed", { tech: cap(tech) })
    : out === "next"
      ? pg.s >= 0.6
        ? pg.more === 1
          ? tr("Good board: one more quick board can pass {tech}", { tech })
          : tr("Good board: at least {n} more to pass {tech}", { n: pg.more, tech })
        : pg.more === 1
          ? tr("Slow board: one more quick board can pass {tech}", { tech })
          : tr("Slow board: at least {n} more to pass {tech}", { n: pg.more, tech })
      : !rec.solved
        ? tr("Given up: practise {tech} first", { tech })
        : tr("Too slow to pass: practise {tech} first", { tech });
}
function campResult(rec) {
  const L = rec.camp.L,
    tech = LEVEL_TECH[rec.camp.L],
    out = rec.campOut,
    next = campStep();
  const facts = [
    esc(BAND[gBand(rec)]) + " " + dec(gradeFor(rec)),
    rec.cols + "×" + rec.rows,
    rec.solved && !rec.est ? fmt(rec.ms) : "",
  ].filter(Boolean);
  const pg = rec.campProg;
  const why =
    out === "fast"
      ? tr("Within your usual time on the first board, so the step is done.")
      : out === "passed"
        ? tr("The bar is full: the boards show that you master it.")
        : out === "next"
          ? pg && pg.to < pg.from
            ? tr("Slower than usual, so the bar went down a little.")
            : tr("Quick boards count most.")
          : !rec.solved
            ? ""
            : rec.campRatio != null && rec.campRatio > CAMP_SLOW
              ? tr("It took {r} times your usual time; over {x} times means practising first.", { r: dec(rec.campRatio), x: dec(CAMP_SLOW) })
              : tr("Help was used.");
  const after =
    out === "practice"
      ? DRILL_TECHS.includes(L)
        ? tr("Then try again: {n} puzzles that need {tech}, solved without hints, or {d} practice boards of it.", { n: CAMP_PRACTICE, tech, d: CAMP_DRILLS })
        : tr("Then try again: {n} puzzles that need {tech}, solved without hints, or {d} training boards where you find it without a hint.", { n: CAMP_PRACTICE, tech, d: CAMP_TRAIN })
      : (out === "fast" || out === "passed") && !next
        ? tr("That was the last step. All techniques are passed.")
        : "";
  const primary =
    out === "practice"
      ? `<button class="primary big" type="button" id="cPlay">${esc(tr("Play a puzzle with {tech}", { tech }))}</button>` +
        (campCanPractise(L) ? `<button class="secondary" type="button" id="cDrill">${esc(tr("Practise {tech}", { tech }))}</button>` : "")
      : next
        ? `<button class="primary big" type="button" id="cNext">${esc(out === "next" ? tr("Next board") : tr("Next step: {tech}", { tech: LEVEL_TECH[next] }))}</button>`
        : "";
  const analysed = rec.moves && !rec.routePending;
  openSheet(
    `<div class="solved v2 campres"><div class="shead"><div class="smallstamp" aria-hidden="true">${out === "practice" ? "練" : "解"}</div>` +
      `<div><h2>${esc(campHead(rec))}</h2><p class="sub">${facts.join(" · ")}</p></div></div>` +
      (rec.solved && rec.est ? timeMeterHtml(rec.ms, rec.est, tr("expected")) : "") +
      (pg ? campBarHtml(L, pg.to, pg.from) : "") +
      (why || after ? `<p class="sub campwhy">${esc([why, after].filter(Boolean).join(" "))}</p>` : "") +
      `<div id="takeaway">${analysed ? afterGameHtml(rec) : rec.routePending ? `<p class="sub mwait">${tr("Finding the moments worth a second look …")}</p>` : ""}</div>` +
      (out === "passed" && next ? `<div class="campnext">${campExampleHtml(next)}</div>` : "") + // the next step's example, by its button
      `<div class="actions sbtns">${primary}</div>` +
      `<button class="routeline" type="button" id="routeLine">${routeLineHtml(rec)}</button>` +
      `<div id="concLine">${concWarnHtml(rec)}</div>` +
      `<div class="actions row2"><button class="secondary" type="button" id="sFinal">${tr("See board")}</button><button class="secondary" type="button" id="cPath">${tr("The campaign")}</button><button class="secondary" type="button" id="sHome">${tr("Home")}</button></div></div>`,
    (b) => {
      if (analysed) bindAfterGame(b, rec);
      const on = (id, f) => {
        const x = b.querySelector("#" + id);
        if (x) x.onclick = f;
      };
      on("cNext", () => {
        closeSheet();
        campStart();
      });
      on("cPlay", () => {
        closeSheet();
        campPracticeGame(L);
      });
      on("cDrill", () => {
        closeSheet();
        campPractise(L);
      });
      on("routeLine", () => {
        if (!rec.moves) return;
        closeSheet();
        setTimeout(() => showRoute(rec, () => campResult(rec)), 280);
      });
      on("sFinal", () => showFinal(rec, () => campResult(rec)));
      on("cPath", () => {
        closeSheet();
        go("camp");
      });
      on("sHome", () => {
        closeSheet();
        go("home", { back: true });
      });
    },
  );
}
// A normal game (it counts in the statistics) that needs the technique: practice between campaign tries
function campPracticeGame(L) {
  const s = campSize();
  replaceGame(() =>
    generate(
      { rows: s.r, cols: s.c, level: campBand(L), must: L, seed: (Math.random() * 1e9) >>> 0, budget: 20000, lo: 0, hi: 9, nuance: "alle", kind: "alle", maxRegion: ui.maxRegion, np: noPen() },
      tr("Looking for a puzzle with {tech} …", { tech: LEVEL_TECH[L] }),
      (p) => {
        loadPuzzle(p, null, {});
        go("game");
        setMsg(tr("Practice for the campaign: a normal game with {tech}. It counts in your statistics.", { tech: LEVEL_TECH[L] }), "");
      },
    ),
  );
}

// ---------- The path
// One short line for the home screen
function campStat() {
  const c = campState(),
    L = campStep(c);
  if (!L) return tr("All passed");
  if (!Object.keys(c.passed).length && !c.run && !Object.keys(c.practice).length) return tr("Start");
  return campStatus(L, c).kind === "practice" ? tr("Practise {tech}", { tech: LEVEL_TECH[L] }) : tr("Step {i} of {n}", { i: campLevels().indexOf(L) + 1, n: campLevels().length });
}
function renderCamp() {
  const c = campState(),
    cur = campStep(c),
    day = (iso) => new Date(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  const rows = campLevels()
    .map((L, i) => {
      const st = campStatus(L, c),
        isCur = L === cur;
      let sub = "",
        act = "";
      if (st.kind === "passed") sub = tr("Passed {d}", { d: day(st.when) });
      else if (isCur && st.kind === "practice") {
        sub =
          tr("Practise first: {a} of {n} puzzles that need it", { a: st.n, n: CAMP_PRACTICE }) +
          (DRILL_TECHS.includes(L) ? " " + tr("or {a} of {n} practice boards", { a: st.d, n: CAMP_DRILLS }) : " " + tr("or {a} of {n} training boards", { a: st.t, n: CAMP_TRAIN })) +
          ".";
        act =
          `<button class="primary" type="button" data-cplay="${L}">${esc(tr("Play a puzzle with {tech}", { tech: LEVEL_TECH[L] }))}</button>` +
          (campCanPractise(L) ? `<button class="secondary" type="button" data-cdrill="${L}">${esc(tr("Practise {tech}", { tech: LEVEL_TECH[L] }))}</button>` : "");
      } else if (isCur) {
        // short; the rule in full is a tap away
        sub = tldr(
          esc(tr("Quick, clean boards fill the bar.")),
          esc(
            (TT.beyond(L) && campRating(L, c).n < CAMP_PART ? tr("The first boards start where {tech} is the next step.", { tech: LEVEL_TECH[L] }) + " " : "") +
              tr("Quick, clean boards fill the bar; a full bar passes the step."),
          ),
        );
        act = `<button class="primary" type="button" id="campGo">${esc(st.board ? tr("Next board") : c.practice[L] ? tr("Try again") : tr("Start"))}</button>`;
      }
      return (
        `<li class="campstep ${st.kind === "passed" ? "done" : isCur ? "cur" : "later"}">` +
        `<span class="campn" aria-hidden="true">${st.kind === "passed" ? "✓" : i + 1}</span>` +
        `<div><strong>${esc(cap(LEVEL_TECH[L]))}</strong>${sub ? (sub.startsWith("<details") ? sub : `<span class="sub">${esc(sub)}</span>`) : ""}` +
        (isCur ? campBarHtml(L, campPct(campRating(L, c))) + campExampleHtml(L) : "") +
        `${act ? `<div class="campact">${act}</div>` : ""}</div></li>`
      );
    })
    .join("");
  $("campBody").innerHTML =
    tldr(
      esc(tr("One step per technique. No hints.")),
      esc(tr("One step per technique, in order. Boards have no hints and stay out of your statistics. Quick, clean boards fill a step's bar, slow ones a little; after a long break it drops a little. If a board does not go well, practise the technique in normal games or practice and come back.")),
      "about",
    ) +
    `<ol class="campath">${rows}</ol>`;
  const g = $("campGo");
  if (g) g.onclick = campStart;
  $("campBody")
    .querySelectorAll("[data-cplay]")
    .forEach((b) => (b.onclick = () => campPracticeGame(+b.dataset.cplay)));
  $("campBody")
    .querySelectorAll("[data-cdrill]")
    .forEach((b) => (b.onclick = () => campPractise(+b.dataset.cdrill)));
}
