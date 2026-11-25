// Timed trial (25 Nov. 2026): boards against the clock, without pencil, kept apart from the statistics in a store of their own.
// Two flavours, each with its own level and index:
//  - soft: erase and correct as you like;
//  - hardcore: the first wrong number ends the board.
// The board is always 6×6 (Sudoku: 9×9, its only size). The difficulty follows your results: solved in time, the next is
// harder; time out or give up, it is easier; a wrong number (hardcore) leaves it as it is. The time limit and the index are
// measured against a fixed point, not your own curve, so the index shows real change: 100 = a board of grade 3.0 solved
// within the fixed time.

const TRIAL_START = 3.0, // the grade a flavour starts at
  TRIAL_STEP = 0.25, // the change after each board
  TRIAL_STEP0 = 0.5, // ... during the first boards, to find your level quickly
  TRIAL_FIRST = 5,
  TRIAL_PER_GRADE = 1.35, // the index per grade: about 35 % more work per grade, so grade 4.0 = index 135
  TRIAL_SLACK = 1.0; // the time limit as a share of the fixed time
const TRIAL_FLAVOURS = ["soft", "hard"];
const trialName = (f) => (f === "hard" ? tr("Hardcore") : tr("Soft"));
// The fixed time for a board: the time model's starting point (the same for everybody, not fitted to you), for its moves
let TRIAL_CAL = null;
function trialLimit(p) {
  if (!TRIAL_CAL) TRIAL_CAL = fitCalib([]);
  const lv = p.grade && p.grade.lv;
  return lv && lv.length ? Math.round(sumOfMeans(TRIAL_CAL, lv, p.rows * p.cols) * TRIAL_SLACK) : 300;
}
const trialIndex = (T) => Math.round(100 * Math.pow(TRIAL_PER_GRADE, T - TRIAL_START));
function trialState() {
  const s = store.get("trials", null) || {};
  const one = (x) => Object.assign({ T: TRIAL_START, n: 0, hist: [] }, x || {});
  return { fl: s.fl === "hard" ? "hard" : "soft", soft: one(s.soft), hard: one(s.hard), boards: s.boards || [] };
}
function trialSave(t) {
  // the latest boards keep their route analysis (the latest 5 with their moves), as the campaign
  const boards = t.boards.slice(-20).map((b, i, a) => {
    if (i >= a.length - 5 || !b.moves) return b;
    const o = Object.assign({}, b);
    delete o.moves;
    return o;
  });
  store.set("trials", { fl: t.fl, soft: Object.assign({}, t.soft, { hist: t.soft.hist.slice(-300) }), hard: Object.assign({}, t.hard, { hist: t.hard.hist.slice(-300) }), boards });
}
function trialKeep(rec) {
  const t = trialState();
  t.boards = t.boards.filter((b) => b.id !== rec.id).concat([rec]);
  trialSave(t);
}
const trialSizeText = () => trialSize().c + "×" + trialSize().r;
function trialSize() {
  return SIZES.find((s) => s.r === 6 && s.c === 6) || SIZES.find((s) => s.r * s.c > 16) || SIZES[0];
}

// ---------- A board
function trialStart(fl) {
  const t = trialState();
  fl = fl || t.fl;
  const T = t[fl].T,
    band = Math.max(1, Math.min(9, Math.floor(T))),
    d = Math.round((T - band) * 10),
    s = trialSize();
  replaceGame(() =>
    generate(
      {
        rows: s.r,
        cols: s.c,
        level: band,
        must: 0,
        seed: (Math.random() * 1e9) >>> 0,
        budget: 20000,
        lo: Math.max(0, d - 2),
        hi: Math.min(9, d + 2),
        nuance: "alle",
        kind: "alle",
        maxRegion: 5,
        np: true, // no pencil: the grade without pencil is the one that counts
      },
      tr("Timed trial: looking for grade {g} …", { g: dec(T) }),
      (p) => {
        const lim = trialLimit(p);
        loadPuzzle(p, null, { trial: { fl, T, lim } });
        noteMode = false;
        go("game");
        setMsg(
          fl === "hard"
            ? tr("{flavour}: {time} for the board. The first wrong number ends it.", { flavour: trialName(fl), time: fmt(lim * 1000) })
            : tr("{flavour}: {time} for the board.", { flavour: trialName(fl), time: fmt(lim * 1000) }),
          "",
        );
      },
    ),
  );
}
// The clock, every second: the time left, and the end when it is up
function trialTick() {
  if (!P || !meta || !meta.trial || solved) return;
  const left = meta.trial.lim * 1000 - elapsed(),
    el = $("timer");
  if (el) {
    el.hidden = false;
    el.textContent = fmt(Math.max(0, left));
    el.classList.toggle("short", left < 30000);
  }
  if (left <= 0) trialEnd("timeout");
}
// Hardcore: a wrong number ends the board at once (called after the number is placed)
function trialWrong(cell, d) {
  if (!meta || !meta.trial || meta.trial.fl !== "hard" || d === P.solution[cell]) return false;
  checked = true; // show it
  trialEnd("wrong");
  return true;
}
// The board ends: solved, timeout, giveup or wrong
function trialEnd(out) {
  if (!meta || !meta.trial || meta.trialOut) return;
  syncClock();
  clockAcc = elapsed();
  clockSince = null;
  meta.trialOut = out;
  solved = true; // the board is locked
  selected = -1;
  const rec = recordGame(out === "solved");
  saveCurrent();
  renderAll();
  if (!rec) return;
  startRoute(rec);
  setTimeout(() => trialResult(rec), out === "solved" ? 650 : 300);
}
// Called from recordGame instead of storing the game in the statistics
function trialRecord(rec) {
  const t = trialState(),
    tr0 = meta.trial,
    f = t[tr0.fl];
  let out = meta.trialOut || (rec.solved ? "solved" : "giveup");
  if (out === "solved" && rec.ms > tr0.lim * 1000) out = "timeout";
  const step = f.n < TRIAL_FIRST ? TRIAL_STEP0 : TRIAL_STEP,
    T0 = f.T,
    T1 = out === "solved" ? T0 + step : out === "wrong" ? T0 : T0 - step;
  f.T = Math.round(Math.max(1, Math.min(9.5, T1)) * 100) / 100;
  f.n++;
  f.hist.push({ d: rec.end, g: gradeFor(rec), T0, T1: f.T, out, ms: rec.ms, lim: tr0.lim });
  t.fl = tr0.fl;
  rec.trial = tr0;
  rec.trialOut = out;
  rec.trialT = [T0, f.T];
  t.boards = t.boards.filter((b) => b.id !== rec.id).concat([rec]);
  trialSave(t);
}
function trialGiveUp() {
  confirmSheet({
    title: tr("Give up this board?"),
    text: tr("It counts as a time out: the next board is easier."),
    ok: tr("Give up"),
    cancel: tr("Keep trying"),
    onOk: () => trialEnd("giveup"),
  });
}
function trialHead(rec) {
  const [a, b] = rec.trialT.map(trialIndex);
  return rec.trialOut === "solved"
    ? tr("Solved in time: index {a} → {b}", { a, b })
    : rec.trialOut === "timeout"
      ? tr("Time is up: index {a} → {b}", { a, b })
      : rec.trialOut === "giveup"
        ? tr("Given up: index {a} → {b}", { a, b })
        : tr("Wrong number: the board ends, index stays {a}", { a });
}
function trialResult(rec) {
  const fl = rec.trial.fl,
    analysed = rec.moves && !rec.routePending;
  const facts = [
    trialName(fl),
    esc(BAND[gBand(rec)]) + " " + dec(gradeFor(rec)),
    rec.cols + "×" + rec.rows,
    tr("{t} of {lim}", { t: fmt(Math.min(rec.ms, rec.trial.lim * 1000)), lim: fmt(rec.trial.lim * 1000) }),
  ];
  const why =
    rec.trialOut === "solved"
      ? tr("The next board is harder.")
      : rec.trialOut === "wrong"
        ? tr("A wrong number does not change the difficulty.")
        : tr("The next board is easier.");
  openSheet(
    `<div class="solved v2 trialres"><div class="shead"><div class="smallstamp" aria-hidden="true">${rec.trialOut === "solved" ? "解" : "時"}</div>` +
      `<div><h2>${esc(trialHead(rec))}</h2><p class="sub">${facts.join(" · ")}</p></div></div>` +
      `<p class="sub campwhy">${esc(why)}</p>` +
      `<div id="takeaway">${analysed ? afterGameHtml(rec) : rec.routePending ? `<p class="sub mwait">${tr("Finding the moments worth a second look …")}</p>` : ""}</div>` +
      `<div class="actions sbtns"><button class="primary big" type="button" id="tNext">${tr("Next board")}</button></div>` +
      `<button class="routeline" type="button" id="routeLine">${routeLineHtml(rec)}</button>` +
      `<div id="concLine">${concWarnHtml(rec)}</div>` +
      `<div class="actions row2"><button class="secondary" type="button" id="sFinal">${tr("See board")}</button><button class="secondary" type="button" id="tView">${tr("Timed trial")}</button><button class="secondary" type="button" id="sHome">${tr("Home")}</button></div></div>`,
    (b) => {
      if (analysed) bindAfterGame(b, rec);
      const on = (id, f) => {
        const x = b.querySelector("#" + id);
        if (x) x.onclick = f;
      };
      on("tNext", () => {
        closeSheet();
        trialStart(fl);
      });
      on("routeLine", () => {
        if (!rec.moves) return;
        closeSheet();
        setTimeout(() => showRoute(rec, () => trialResult(rec)), 280);
      });
      on("sFinal", () => showFinal(rec, () => trialResult(rec)));
      on("tView", () => {
        closeSheet();
        go("trial");
      });
      on("sHome", () => {
        closeSheet();
        go("home", { back: true });
      });
    },
  );
}

// ---------- The trial screen: its own statistics
function trialLine() {
  const t = trialState(),
    f = t[t.fl];
  return {
    title: f.n ? tr("{flavour} · index {i}", { flavour: trialName(t.fl), i: trialIndex(f.T) }) : tr("Against the clock, without pencil"),
    sub: f.n ? tr("Grade {g} · {n} boards", { g: dec(f.T), n: f.n }) : tr("Soft or hardcore, on {size}", { size: trialSizeText() }),
  };
}
function trialChart(hist) {
  const pts = hist.slice(-40);
  if (pts.length < 2) return "";
  const W = 340,
    H = 150,
    L = 34,
    R = 8,
    Tp = 10,
    B = 22;
  const ys = pts.map((h) => trialIndex(h.T1)).concat([100]);
  const lo = Math.min(...ys),
    hi = Math.max(...ys),
    pad = Math.max(5, (hi - lo) * 0.1),
    y0 = lo - pad,
    y1 = hi + pad;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, pts.length - 1),
    y = (v) => Tp + ((y1 - v) * (H - Tp - B)) / (y1 - y0);
  const ticks = [lo, 100, hi].filter((v, i, a) => a.indexOf(v) === i);
  let s = `<svg class="trialchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tr("Index after each board"))}">`;
  ticks.forEach((v) => (s += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ax">${Math.round(v)}</text>`));
  s += `<line x1="${L}" x2="${W - R}" y1="${y(100)}" y2="${y(100)}" class="fixed"/>`;
  s += `<polyline points="${pts.map((h, i) => x(i) + "," + y(trialIndex(h.T1))).join(" ")}" fill="none" stroke="var(--indigo)" stroke-width="2" stroke-linejoin="round"/>`;
  const outName = { solved: tr("in time"), timeout: tr("time out"), giveup: tr("given up"), wrong: tr("wrong number") };
  pts.forEach((h, i) => {
    const ok = h.out === "solved";
    s +=
      `<circle cx="${x(i)}" cy="${y(trialIndex(h.T1))}" r="4" fill="${ok ? "var(--indigo)" : "var(--paper)"}" stroke="var(--indigo)" stroke-width="2"/>` +
      `<circle cx="${x(i)}" cy="${y(trialIndex(h.T1))}" r="12" fill="transparent" data-tip="${esc(new Date(h.d).toLocaleDateString(LOCALE, { day: "numeric", month: "short" }) + " · " + dec(h.g) + " · " + outName[h.out] + " · " + fmt(Math.min(h.ms, h.lim * 1000)) + " / " + fmt(h.lim * 1000) + " · " + tr("index {i}", { i: trialIndex(h.T1) }))}"/>`;
  });
  // the dashed line: what 100 means
  s += `<text x="${W - R}" y="${y(100) - 5}" text-anchor="end" class="ax">${tr("100 = grade {g}", { g: dec(TRIAL_START) })}</text></svg>`;
  return s;
}
function renderTrial() {
  const t = trialState(),
    fl = t.fl,
    f = t[fl];
  const outName = { solved: tr("in time"), timeout: tr("time out"), giveup: tr("given up"), wrong: tr("wrong number") };
  const recent = f.hist
    .slice(-8)
    .reverse()
    .map(
      (h) =>
        `<tr><td>${new Date(h.d).toLocaleDateString(LOCALE, { day: "numeric", month: "short" })}</td><td>${dec(h.g)}</td><td>${esc(outName[h.out])}</td>` +
        `<td style="text-align:right">${fmt(Math.min(h.ms, h.lim * 1000))} / ${fmt(h.lim * 1000)}</td><td style="text-align:right">${trialIndex(h.T1)}</td></tr>`,
    )
    .join("");
  $("trialBody").innerHTML =
    `<div class="seg" id="trialSeg">${TRIAL_FLAVOURS.map((k) => `<button type="button" data-f="${k}" aria-pressed="${k === fl}">${trialName(k)}</button>`).join("")}</div>` +
    `<p class="about">${
      fl === "hard"
        ? tr("Hardcore: the first wrong number ends the board. No pencil, no hints.")
        : tr("Soft: erase and correct as you like. No pencil, no hints.")
    } ${tr("Solve the board within the time and the next one is harder; run out of time or give up and it is easier. A wrong number does not change the difficulty. Boards are {size} and kept apart from your statistics.", { size: trialSizeText() })}</p>` +
    `<div class="kpis three"><div class="kpi"><b>${trialIndex(f.T)}</b><span>${tr("Index")}</span></div><div class="kpi"><b>${dec(f.T)}</b><span>${tr("Grade now")}</span></div><div class="kpi"><b>${f.n}</b><span>${tr("Boards")}</span></div></div>` +
    `<p class="caveat">${tr("The index does not move with your own curve: 100 is a {size} board of grade 3.0 solved within a time that is the same for everybody, and each grade more is about 35 % more work.", { size: trialSizeText() })}</p>` +
    trialChart(f.hist) +
    (recent ? `<table class="data trialtab"><tr><th>${tr("Date")}</th><th>${tr("Grade")}</th><th>${tr("Result")}</th><th style="text-align:right">${tr("Time")}</th><th style="text-align:right">${tr("Index")}</th></tr>${recent}</table>` : "") +
    `<div class="actions"><button class="primary big" type="button" id="trialGo">${tr("Start a board")}</button></div>`;
  $("trialBody")
    .querySelectorAll("#trialSeg button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const s = trialState();
          s.fl = b.dataset.f;
          trialSave(s);
          renderTrial();
        }),
    );
  $("trialGo").onclick = () => trialStart(fl);
}
