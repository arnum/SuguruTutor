// Campaign: a path through the techniques, one step per technique, in order. A step you already master is passed on its
// first board; one you don't is a real test, and when a board does not go well you practise outside the campaign before
// you try again. The practice in between is not part of the campaign: normal games and the practice drills count.
// Campaign boards have no hints (the button is simply not there) and stay out of the statistics: they are kept in the
// store "campaign", the latest with their route analysis, so the sheet after a board can show it as after any game.
// First version 25 Nov. 2026; the numbers below are a first guess, to be tuned.

const CAMP_BOARDS = 3; // boards in a row within CAMP_PASS to pass a step
const CAMP_FAST = 1.0; // the first board within your usual time (the estimate): the step is passed at once
const CAMP_PASS = 1.5; // a board counts when solved without help within 1.5 x your usual time
const CAMP_PART = 2; // the first boards of a step start part-solved, where the technique is the next step
const CAMP_PRACTICE = 3; // after a board that did not go well: this many puzzles that need the technique, outside the campaign
const CAMP_DRILLS = 15; // ... or this many practice boards of it (techniques with a practice drill)
const CAMP_KEEP = 20, // campaign boards kept (for the sheet afterwards, the route analysis and the export)
  CAMP_KEEP_MOVES = 5; // of which the latest keep their moves

const campLevels = () => LEVEL_TECH.map((_, L) => L).filter((L) => L >= 1 && L <= 11 && LEVEL_TECH[L]);
function campState() {
  const c = store.get("campaign", null) || {};
  return { passed: c.passed || {}, run: c.run || null, practice: c.practice || {}, log: c.log || [], boards: c.boards || [] };
}
function campSave(c) {
  const boards = c.boards.slice(-CAMP_KEEP).map((b, i, a) => {
    if (i >= a.length - CAMP_KEEP_MOVES || !b.moves) return b;
    const o = Object.assign({}, b);
    delete o.moves; // older boards keep the summary only
    return o;
  });
  store.set("campaign", { passed: c.passed, run: c.run, practice: c.practice, log: c.log.slice(-300), boards });
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
  const START = GAME.gradeStart || [0, 1, 2, 2, 3, 5, 6, 8, 9, 10];
  let b = 1;
  for (let k = 1; k <= 9; k++) if (START[k] <= L) b = k;
  return b;
}
// The board size: the one chosen in New game, but not 4×4 (the campaign needs room for the techniques)
function campSize() {
  const s = SIZES[ui.sizeIdx] || SIZES[0];
  return s.r * s.c > 16 ? s : SIZES.find((x) => x.r * x.c > 16) || s;
}
// Practice since a board did not go well: puzzles outside the campaign that needed the technique (solved without help),
// and practice boards of it
function campPracticeDone(L, since) {
  const lvOf = (x) => Math.floor(x / 100);
  const n = games.filter((g) => g.end > since && g.solved && !g.hints && !g.revealed && (g.lv || []).some((x) => lvOf(x) === L)).length;
  const d = store.get("practicelog", []).filter((e) => e.d > since && e.k === L && e.r !== "miss").length;
  return { n, d, ok: n >= CAMP_PRACTICE || d >= CAMP_DRILLS };
}
// Where a step stands: passed, practise first, ready (to start or go on)
function campStatus(L, c = campState()) {
  if (c.passed[L]) return { kind: "passed", when: c.passed[L] };
  const pr = c.practice[L];
  if (pr) {
    const done = campPracticeDone(L, pr.since);
    if (!done.ok) return { kind: "practice", ...done };
  }
  const run = c.run && c.run.L === L ? c.run : null;
  return { kind: "ready", board: run ? run.board : 0, ok: run ? run.results.filter((r) => r.ok).length : 0 };
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
    part = L >= 2 && k < CAMP_PART,
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
        // the worker starts it where the technique is next; the fallback in the page does it here
        if (part && !p.startAt) p = startAtTechnique(E, p, L) || p;
        loadPuzzle(p, null, { camp: { L, board: k, part: !!p.startAt } });
        go("game");
        setMsg(
          (p.startAt
            ? tr("Campaign · {tech}, board {k} of {n}. The board starts where {tech} is the next step.", { tech: LEVEL_TECH[L], k: k + 1, n: CAMP_BOARDS })
            : tr("Campaign · {tech}, board {k} of {n}.", { tech: LEVEL_TECH[L], k: k + 1, n: CAMP_BOARDS })) +
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
    ok = clean && (r == null || r <= CAMP_PASS),
    fast = ok && r != null && r <= CAMP_FAST;
  run.results.push({ ms: rec.ms, est: rec.est, ok, fast, part: !!rec.camp.part });
  rec.campLeft = CAMP_BOARDS - run.results.filter((x) => x.ok).length;
  c.log.push({ L, board: run.board, ok, fast, solved: !!rec.solved, ms: rec.ms, est: rec.est, end: rec.end, code: rec.code });
  let out;
  if (!ok) {
    c.practice[L] = { since: rec.end };
    c.run = null;
    out = "practice";
  } else if (fast && run.board === 0) {
    c.passed[L] = rec.end;
    c.run = null;
    out = "fast";
  } else if (run.results.filter((x) => x.ok).length >= CAMP_BOARDS) {
    c.passed[L] = rec.end;
    c.run = null;
    out = "passed";
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
  return out === "fast" || out === "passed"
    ? tr("{tech} passed", { tech: cap(tech) })
    : out === "next"
      ? rec.campLeft === 1
        ? tr("Good board: 1 more to pass {tech}", { tech })
        : tr("Good board: {n} more to pass {tech}", { n: rec.campLeft, tech })
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
    rec.solved ? fmt(rec.ms) : "",
    rec.solved && rec.est ? tr("your usual time {t}", { t: estFmt(rec.est) }) : "",
  ].filter(Boolean);
  const why =
    out === "fast"
      ? tr("Within your usual time on the first board, so the step is done.")
      : out === "passed"
        ? tr("{n} boards in a row without help and in good time.", { n: CAMP_BOARDS })
        : out === "next"
          ? tr("Without help and within {x} times your usual time.", { x: dec(CAMP_PASS) })
          : !rec.solved
            ? ""
            : rec.campRatio != null
              ? tr("It took {r} times your usual time; a board counts up to {x} times.", { r: dec(rec.campRatio), x: dec(CAMP_PASS) })
              : tr("Help was used.");
  const after =
    out === "practice"
      ? tr("Then try again: {n} puzzles that need {tech}, solved without hints, or {d} practice boards of it.", { n: CAMP_PRACTICE, tech, d: CAMP_DRILLS })
      : (out === "fast" || out === "passed") && !next
        ? tr("That was the last step. All techniques are passed.")
        : "";
  const primary =
    out === "practice"
      ? `<button class="primary big" type="button" id="cPlay">${esc(tr("Play a puzzle with {tech}", { tech }))}</button>` +
        (L <= 4 && typeof startDrill === "function" ? `<button class="secondary" type="button" id="cDrill">${esc(tr("Practise {tech}", { tech }))}</button>` : "")
      : next
        ? `<button class="primary big" type="button" id="cNext">${esc(out === "next" ? tr("Next board") : tr("Next step: {tech}", { tech: LEVEL_TECH[next] }))}</button>`
        : "";
  const analysed = rec.moves && !rec.routePending;
  openSheet(
    `<div class="solved v2 campres"><div class="shead"><div class="smallstamp" aria-hidden="true">${out === "practice" ? "練" : "解"}</div>` +
      `<div><h2>${esc(campHead(rec))}</h2><p class="sub">${facts.join(" · ")}</p></div></div>` +
      (why || after ? `<p class="sub campwhy">${esc([why, after].filter(Boolean).join(" "))}</p>` : "") +
      `<div id="takeaway">${analysed ? afterGameHtml(rec) : rec.routePending ? `<p class="sub mwait">${tr("Finding the moments worth a second look …")}</p>` : ""}</div>` +
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
        startDrill(L);
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
function campLine() {
  const c = campState(),
    L = campStep(c);
  if (!L) return { title: tr("All techniques passed"), sub: "" };
  const st = campStatus(L, c),
    i = campLevels().indexOf(L) + 1,
    n = campLevels().length;
  return {
    title: tr("Step {i} of {n}: {tech}", { i, n, tech: cap(LEVEL_TECH[L]) }),
    sub:
      st.kind === "practice"
        ? tr("Practise first: {a} of {n} puzzles", { a: st.n, n: CAMP_PRACTICE }) + (L <= 4 ? " " + tr("or {a} of {n} practice boards", { a: st.d, n: CAMP_DRILLS }) : "")
        : st.board
          ? tr("Board {k} of {n}", { k: st.board + 1, n: CAMP_BOARDS })
          : Object.keys(c.passed).length
            ? tr("Ready for the next step")
            : tr("A path through the techniques, one at a time"),
  };
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
          (L <= 4 ? " " + tr("or {a} of {n} practice boards", { a: st.d, n: CAMP_DRILLS }) : "") +
          ".";
        act =
          `<button class="primary" type="button" data-cplay="${L}">${esc(tr("Play a puzzle with {tech}", { tech: LEVEL_TECH[L] }))}</button>` +
          (L <= 4 && typeof startDrill === "function" ? `<button class="secondary" type="button" data-cdrill="${L}">${esc(tr("Practise {tech}", { tech: LEVEL_TECH[L] }))}</button>` : "");
      } else if (isCur) {
        sub = st.board
          ? tr("Board {k} of {n}. Boards in a row without help and in good time pass the step.", { k: st.board + 1, n: CAMP_BOARDS })
          : L >= 2
            ? tr("The first boards start where {tech} is the next step. Within your usual time on the first board passes the step at once.", { tech: LEVEL_TECH[L] })
            : tr("Within your usual time on the first board passes the step at once.");
        act = `<button class="primary" type="button" id="campGo">${esc(st.board ? tr("Next board") : c.practice[L] ? tr("Try again") : tr("Start"))}</button>`;
      }
      return (
        `<li class="campstep ${st.kind === "passed" ? "done" : isCur ? "cur" : "later"}">` +
        `<span class="campn" aria-hidden="true">${st.kind === "passed" ? "✓" : i + 1}</span>` +
        `<div><strong>${esc(cap(LEVEL_TECH[L]))}</strong>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}${act ? `<div class="campact">${act}</div>` : ""}</div></li>`
      );
    })
    .join("");
  $("campBody").innerHTML =
    `<p class="about">${tr("One step per technique, in order. Boards have no hints and stay out of your statistics. A step you already master goes quickly; if a board does not go well, practise the technique in normal games or practice and come back.")}</p>` +
    `<ol class="campath">${rows}</ol>`;
  const g = $("campGo");
  if (g) g.onclick = campStart;
  $("campBody")
    .querySelectorAll("[data-cplay]")
    .forEach((b) => (b.onclick = () => campPracticeGame(+b.dataset.cplay)));
  $("campBody")
    .querySelectorAll("[data-cdrill]")
    .forEach((b) => (b.onclick = () => startDrill(+b.dataset.cdrill)));
}
