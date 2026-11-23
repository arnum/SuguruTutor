// Practice drills: short rounds of five boards where one technique is the next step. Find the pattern, then use it.
// The boards come from drillgen.js (in the background worker). While you play, the screen shows only the board and the task:
// no clock, no level, no nudges. The level adapts quietly after each board, in small steps (quicker than your curve moves it
// up, slower moves it down), and what it means comes after the round: the score, your level over the last two weeks, and all
// your techniques.
// Fun without pull: no badges or streaks, and the round always ends after five boards with going back as the main button.
// The practice games (games.js) use the same rounds, levels and screens; D.L is then the game's name instead of a level.

const DRILL_ROUND = 5,
  DRILL_MAX = 6, // board levels per drill (GAME.drillLevels)
  DRILL_TOP = 7; // stored as 1.0 to 7.0: the whole part picks the board level (1 to 6), the decimals move inside it
// Shown as 0.0 to 6.0 (stored minus one), so the start is an empty bar and 6 means all six board levels mastered.
let D = null; // the round in progress: { L, lv0, res: [], cur, next, nextLv, token, over }

// ---------- stored per drill: the level (1.0 to 7.0, shown as 0 to 6), the level at the end of each day, and a log of boards
const drillAll = () => store.get("drills", {});
function drillOf(L) {
  const s = drillAll()[L];
  return s ? Object.assign({ lv: 1, days: {}, log: [] }, s) : { lv: 1, days: {}, log: [] };
}
function drillPut(L, s) {
  const all = Object.assign({}, drillAll());
  all[L] = s;
  store.set("drills", all);
}
const drillWhole = (lv) => Math.max(1, Math.min(DRILL_MAX, Math.floor(lv + 1e-9)));
// The board level from the whole part; the decimals move the position later into the empty cells (more empty cells to scan),
// up to half the level's range at .9
function drillSpec(L, lv) {
  const base = (isGame(L) ? GAME.games[L] : L === 1 ? GAME.drillSingles : GAME.drillLevels)[drillWhole(lv) - 1],
    f = Math.max(0, Math.min(0.9, lv - drillWhole(lv))),
    [lo, hi] = base.empty,
    sh = f * 0.5 * (hi - lo);
  return Object.assign({}, base, { empty: [Math.min(0.9, lo + sh), Math.min(0.95, hi + sh)] });
}
const lvTxt = (lv) => dec(Math.floor((lv - 1) * 10 + 1e-6) / 10);
const drillName = (L) => (isGame(L) ? PG[L].name() : cap(LEVEL_TECH[L]));
const roundLen = (L) => (isGame(L) && PG[L].round) || DRILL_ROUND;
// a drill or game from a data-drill attribute: "3" is a technique, "cascade" a game
const drillKey = (v) => (/^\d$/.test(v) ? +v : v);

// ---------- boards from the background worker (in the page if it cannot start)
let drillWorker = null,
  drillWait = {};
function drillFetch(L, lv) {
  const req = { type: isGame(L) ? "game" : "drill", id: Math.random().toString(36).slice(2), L, game: L, spec: drillSpec(L, lv), seed: (Math.random() * 1e9) >>> 0, budget: 2500 };
  const inPage = (r) => (r.type === "game" ? findGame(E, r) : findDrill(E, r));
  return new Promise((resolve) => {
    const local = () => setTimeout(() => resolve(inPage(req)), 30);
    try {
      if (!drillWorker) {
        drillWorker = newWorker();
        drillWorker.onmessage = (e) => {
          const w = drillWait[e.data.id];
          if (!w) return;
          delete drillWait[e.data.id];
          w.resolve(e.data.board);
        };
        drillWorker.onerror = () => {
          drillWorker = null;
          const ws = drillWait;
          drillWait = {};
          Object.values(ws).forEach((w) => w.resolve(inPage(w.req)));
        };
      }
      drillWait[req.id] = { req, resolve };
      drillWorker.postMessage(req);
    } catch (e) {
      local();
    }
  });
}

// ---------- a round
function startDrill(L) {
  const s = drillOf(L);
  D = { L, lv0: s.lv, res: [], cur: null, next: drillFetch(L, s.lv), nextLv: s.lv, token: 0, over: false };
  go("drill");
  drillNext();
}
function drillNext() {
  const s = drillOf(D.L);
  // the board fetched in advance fits unless the whole level changed since (a few tenths only move the position a little)
  const p = D.next && drillWhole(D.nextLv) === drillWhole(s.lv) ? D.next : drillFetch(D.L, s.lv);
  D.cur = null;
  const tok = ++D.token;
  renderDrill();
  p.then((b) => {
    if (!D || D.token !== tok) return;
    if (!b) {
      D.cur = { failed: true };
      renderDrill();
      return;
    }
    D.cur = drillBoard(b, s.lv);
    if (D.res.length + 1 < roundLen(D.L)) {
      D.next = drillFetch(D.L, s.lv);
      D.nextLv = s.lv;
    } else D.next = null;
    renderDrill();
  });
}
function drillBoard(b, lv) {
  const tu = createTutor(E.makeGeometry(b.rows, b.cols), b.region);
  const size = {};
  b.region.forEach((r) => (size[r] = (size[r] || 0) + 1));
  const P2 = { d: { rows: b.rows, cols: b.cols, region: b.region, givens: b.givens }, maxR: Math.max(...Object.values(size)), sol: b.sol };
  const known = b.known.slice();
  const game = isGame(D.L);
  const c = {
    b,
    lv,
    spec: drillSpec(D.L, lv),
    P2,
    tu,
    known,
    cand: tu.fromKnown(known).cand,
    apps: !game && D.L >= 2 ? tu.drillApps(known, D.L) : [],
    easy: D.L === 1 ? tu.easyList(known).map(([cell, v]) => ({ cell, v })) : [],
    phase: D.L === 1 ? "use" : "find",
    sel: [],
    wrong: 0,
    penalty: 0,
    app: null,
    placed: null,
    t0: performance.now(),
    hiddenMs: 0,
    flash: null,
    msg: "",
  };
  if (game) PG[D.L].init(c);
  return c.failed ? { failed: true } : c;
}
// a wrong tap: the cells flash red for a moment and it costs a quarter of the expected time
function drillFlash(c, cells) {
  c.wrong++;
  c.flash = cells;
  renderDrill();
  setTimeout(() => {
    if (c.flash === cells) (c.flash = null), renderDrill();
  }, 650);
}
// the time you spend away from the app does not count
let drillHiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) drillHiddenAt = performance.now();
  else if (drillHiddenAt && D && D.cur && D.cur.phase && D.cur.phase !== "done") D.cur.hiddenMs += performance.now() - drillHiddenAt;
});

function drillTap(cell) {
  const c = D && D.cur;
  if (!c || !c.phase || c.phase === "done") return;
  if (isGame(D.L)) return PG[D.L].tap(c, cell);
  if (c.known[cell]) return;
  const flash = (cells) => drillFlash(c, cells);
  if (c.phase === "find") {
    const at = c.sel.indexOf(cell);
    c.msg = "";
    if (at >= 0) {
      c.sel.splice(at, 1);
      renderDrill();
      return;
    }
    c.sel.push(cell);
    const key = (cells) => cells.slice().sort((x, y) => x - y).join(",");
    const k = key(c.sel),
      same = c.apps.filter((a) => key(a.cells) === k),
      useful = same.find((a) => a.gives.length);
    if (useful) {
      c.app = useful;
      c.phase = "use";
      c.pop = true;
      renderDrill();
      return;
    }
    // a real pattern that gives nothing: say so, unless a bigger useful one starts with the same cells
    if (same.length && !c.apps.some((a) => a.gives.length && a.cells.length > c.sel.length && c.sel.every((x) => a.cells.includes(x)))) {
      c.msg = tr("That pattern is real, but it gives no number here. Find another.");
      c.sel = [];
      renderDrill();
      return;
    }
    // no pattern starts with these cells: a miss-tap
    if (!c.apps.some((a) => c.sel.every((x) => a.cells.includes(x)))) {
      const cells = c.sel.slice();
      c.sel = [];
      flash(cells);
      return;
    }
    renderDrill();
    return;
  }
  const gives = D.L === 1 ? c.easy : c.app.gives;
  const g = gives.find((x) => x.cell === cell);
  if (g) {
    c.placed = g;
    drillFinish(false);
    return;
  }
  // a number one step later (it needs one of the right ones first) is not wrong, just not yet: say so, no cost
  if (followOn(c, gives, cell)) {
    c.msg = tr("{cell} comes one step later: it needs one of the other numbers first.", { cell: drillNm(c, cell) });
    renderDrill();
    return;
  }
  flash([cell]);
}
const drillNm = (c, i) => "abcdefghij"[i % c.b.cols] + (Math.floor(i / c.b.cols) + 1);
// Does the cell become easy once the given numbers are placed? (with the pattern's eliminations, when there is one)
function followOn(c, gives, cell) {
  if (c.known[cell]) return false;
  const after = c.known.slice();
  gives.forEach((x) => (after[x.cell] = x.v));
  return c.tu.easyList(after).some(([i]) => i === cell);
}
function drillShow() {
  const c = D && D.cur;
  if (!c || !c.phase || c.phase === "done") return;
  if (isGame(D.L)) return PG[D.L].show(c);
  const h = c.tu.easiest(c.known);
  c.shown = h;
  c.placed = h ? { cell: h.cell, v: h.v } : null;
  drillFinish(true);
}
function drillSkip() {
  const c = D && D.cur;
  if (!c || !c.phase || c.phase === "done") return;
  D.res.push({ verdict: "skip" });
  if (D.res.length >= roundLen(D.L)) D.over = true;
  D.over ? renderDrill() : drillNext();
}
// Each board: time against what your personal time curve expects for the technique; a miss-tap adds a quarter.
// The level moves in small steps: half the curve's time gives +0.3, the curve's time 0, twice the time -0.3 (in between on a
// log scale, so a little faster than the curve still gives a little), and "Show me" -0.4. Over a round: up to 1.5 levels.
function drillFinish(miss) {
  const c = D.cur;
  c.phase = "done";
  c.pop = true;
  let sec = Math.max(0.5, (performance.now() - c.t0 - c.hiddenMs) / 1000);
  const exp = isGame(D.L) ? PG[D.L].expected(c) : calTime(myCal(), D.L, 1, true);
  const pg = isGame(D.L) ? PG[D.L] : {};
  // a game can leave finger work out of the time (Cascade: choosing the number after the cell)
  if (pg.measured) sec = pg.measured(c, sec);
  const score = pg.score ? pg.score(c) : (sec * (1 + 0.25 * c.wrong + (c.penalty || 0))) / exp;
  const verdict = miss ? "miss" : score < 0.7 ? "quick" : score > 1.6 ? "slow" : "ok";
  const s = drillOf(D.L);
  // a game with one long board per round (Quick call) moves the level more per board
  const sc = pg.stepScale || 1;
  const step = miss ? -0.4 * Math.min(sc, 1.5) : sc * Math.max(-0.3, Math.min(0.3, -0.3 * Math.log2(score)));
  s.lv = Math.round(Math.max(1, Math.min(DRILL_TOP, s.lv + step)) * 100) / 100;
  delete s.up;
  const day = dayKey(new Date());
  s.days = Object.assign({}, s.days, { [day]: s.lv });
  s.log = (s.log || []).concat([{ d: day, lv: c.lv, s: Math.round(sec * 10) / 10, w: c.wrong, r: verdict }]).slice(-400);
  drillPut(D.L, s);
  D.res.push({ verdict, sec, exp, wrong: c.wrong, lv: c.lv, board: c });
  renderDrill();
}

// ---------- drawing
function drillBoardSvg(c) {
  if (isGame(D.L)) {
    const v = PG[D.L].view(c),
      color = v.color || {};
    if (!v.color) c.known.forEach((x, i) => x && !c.b.givens[i] && (color[i] = "var(--ink)"));
    return miniBoard(c.P2, c.known, v.hv, v.marks || null, v.head || {}, { color, label: tr("The practice board") });
  }
  const color = {};
  c.known.forEach((v, i) => {
    if (v && !c.b.givens[i]) color[i] = "var(--ink)";
  });
  const hv = { pattern: [], target: [], bad: c.flash || [], cand: {}, strike: {} };
  const showCand = D.L >= 2 && c.spec.pencil;
  if (showCand) c.known.forEach((v, i) => !v && (hv.cand[i] = c.cand[i]));
  let marks = null;
  if (c.phase === "find") hv.pattern = c.sel;
  if (c.phase === "use" && c.app) hv.pattern = c.app.cells;
  if (c.phase === "done") {
    if (c.shown) {
      const kv = keyView(c.shown);
      Object.assign(hv, { pattern: kv.pattern || [], target: kv.target || [], strike: kv.strike || {} });
      if (kv.cand) for (const k in kv.cand) hv.cand[k] = kv.cand[k];
    } else if (c.app) {
      hv.pattern = c.app.cells;
      c.app.targets.forEach((t) => {
        hv.target.push(t.cell);
        hv.cand[t.cell] = c.cand[t.cell];
        hv.strike[t.cell] = t.mask;
      });
    }
    if (c.placed) {
      hv.target = hv.target.concat([c.placed.cell]);
      delete hv.cand[c.placed.cell];
      marks = { c: c.placed.cell, v: c.placed.v, col: "var(--indigo)" };
    }
  }
  return miniBoard(c.P2, c.known, hv, marks, {}, { color, label: tr("The practice board") });
}
function drillSegs() {
  let s = "";
  for (let i = 0; i < roundLen(D.L); i++) {
    const r = D.res[i];
    s += `<i class="${r ? (r.verdict === "skip" ? "skip" : r.verdict === "miss" ? "miss" : "on") : i === D.res.length ? "now" : ""}"></i>`;
  }
  return `<div class="dsegs" aria-hidden="true">${s}</div>`;
}
function renderDrill() {
  if (!D) return;
  $("drillTitle").textContent = drillName(D.L);
  const at = D.res.length + (D.cur && D.cur.phase === "done" ? 0 : 1);
  const pg = isGame(D.L) ? PG[D.L] : {};
  $("drillCount").textContent = D.over ? "" : pg.count && D.cur && D.cur.phase ? pg.count(D.cur) : Math.min(roundLen(D.L), at) + " / " + roundLen(D.L);
  const body = $("drillBody");
  if (D.over) {
    body.innerHTML = drillSummaryHtml();
    bindDrillSummary(body);
    return;
  }
  const c = D.cur;
  if (!c) {
    body.innerHTML = drillSegs() + `<div class="dwait"><div class="spinner" aria-hidden="true">${esc((document.querySelector(".hero .stamp") || {}).textContent || "")}</div>${tr("Finding a board …")}</div>`;
    return;
  }
  if (c.failed) {
    body.innerHTML =
      drillSegs() +
      `<p class="dwait">${tr("No board turned up this time.")}</p><div class="actions"><button class="primary" type="button" id="dRetry">${tr("Try again")}</button></div>`;
    body.querySelector("#dRetry").onclick = () => drillNext();
    return;
  }
  const [title, line] = isGame(D.L) ? ["", ""] : GAME.drillFind[D.L];
  let task;
  if (isGame(D.L)) task = PG[D.L].task(c);
  else if (c.phase === "find") task = `<h3>${title}</h3><p>${line}</p>`;
  else if (c.phase === "use")
    task = D.L === 1 ? `<h3>${title}</h3><p>${line}</p>` : `<h3>${tr("Now use it")}</h3><p>${tr("Tap the cell that gets a number.")}</p>`;
  else {
    // the text explains what is on the board: the pattern you found (or the one "Show me" found)
    let text = "";
    if (c.app && !c.shown) text = c.app.text;
    else {
      const h = c.shown || (c.placed ? c.tu.explainMove(c.known, c.placed.cell, c.placed.v) : null),
        kv = h ? keyView(h) : null;
      text = kv && kv.text ? kv.text : "";
    }
    const nm = (i) => "abcdefghij"[i % c.b.cols] + (Math.floor(i / c.b.cols) + 1);
    task =
      `<h3 class="${c.shown ? "" : "ok"}">${c.shown ? tr("Here it is") : "✓ " + nm(c.placed.cell) + " = " + c.placed.v}</h3>` +
      (text ? `<p>${esc(text)}</p>` : "");
  }
  const fb = c.flashRight === true ? " okflash" : c.flashRight === false ? " badflash" : "";
  c.flashRight = null;
  body.innerHTML =
    (pg.top ? pg.top(c) : drillSegs()) +
    `<div class="drillboard${c.pop ? " pop" : ""}${fb}${c.phase === "ready" ? " wait" : ""}" id="drillBoard">${drillBoardSvg(c)}</div>` +
    `<div class="drilltask" aria-live="polite">${task}${c.msg ? `<p class="dmsg">${esc(c.msg)}</p>` : ""}</div>` +
    (isGame(D.L) && PG[D.L].pad ? PG[D.L].pad(c) : "") +
    (c.phase === "done"
      ? `<div class="actions"><button class="primary big" type="button" id="dNext">${D.res.length >= roundLen(D.L) ? tr("See how it went") : tr("Next board")}</button></div>`
      : pg.noHelp
        ? ""
        : `<div class="dhelp"><button type="button" class="link" id="dShow">${isGame(D.L) && PG[D.L].showLabel ? PG[D.L].showLabel() : tr("Show me")}</button><button type="button" class="link" id="dSkip">${tr("Skip board")}</button></div>`);
  c.pop = false;
  const st = body.querySelector("#dqStart");
  if (st) st.onclick = () => PG[D.L].start(c);
  const nx = body.querySelector("#dNext");
  if (nx) {
    const drawn = performance.now();
    nx.onclick = (e) => !ghost(e, drawn) && (D.res.length >= roundLen(D.L) ? ((D.over = true), renderDrill()) : drillNext());
  }
  const sh = body.querySelector("#dShow");
  if (sh) sh.onclick = drillShow;
  const sk = body.querySelector("#dSkip");
  if (sk) sk.onclick = drillSkip;
}

// ---------- after the round
// The level at the end of each of the last 14 days, as steps, with a dot on the days you practised. The axis is always the
// whole range, shown as 0 to 6.
function drillChart(s) {
  const W = 308,
    x0 = 16,
    top = 8,
    bottom = 108,
    n = 14;
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(s.days[dayKey(d)] ?? null);
  }
  let cur = null;
  const earlier = Object.keys(s.days)
    .filter((k) => k < dayKey(new Date(Date.now() - (n - 1) * 864e5)))
    .sort();
  if (earlier.length) cur = s.days[earlier[earlier.length - 1]];
  const y = (l) => bottom - ((l - 1) / (DRILL_TOP - 1)) * (bottom - top);
  const step = (W - x0) / (n - 1);
  let line = cur != null ? `M ${x0} ${y(cur)}` : "",
    dots = "";
  days.forEach((v, i) => {
    const x = x0 + i * step;
    if (v == null) return;
    line += line ? ` H ${x} V ${y(v)}` : `M ${x} ${y(v)}`;
    dots += `M ${x} ${y(v)} h 0.01 `;
    cur = v;
  });
  if (line) line += ` H ${W}`;
  let grid = "";
  let labels = "";
  for (let l = 1; l <= DRILL_TOP; l++) {
    grid += `M ${x0} ${y(l)} H ${W} `;
    labels += `<text x="0" y="${y(l)}" font-size="11" fill="var(--mute)" dominant-baseline="middle">${l - 1}</text>`;
  }
  return (
    `<svg class="dchart" viewBox="0 0 316 132" role="img" aria-label="${esc(tr("Your level in {tech} at the end of each day over the last two weeks", { tech: isGame(D.L) ? drillName(D.L) : LEVEL_TECH[D.L] }))}">` +
    `<path d="${grid}" stroke="var(--grid)" stroke-width="1" fill="none"/>` +
    (line ? `<path d="${line}" stroke="var(--indigo)" stroke-width="2.5" fill="none" stroke-linejoin="round"/>` : "") +
    `<path d="${dots}" stroke="var(--indigo)" stroke-width="7" stroke-linecap="round" fill="none"/>` +
    labels +
    `<text x="${x0}" y="128" font-size="11" fill="var(--mute)">${tr("2 weeks ago")}</text>` +
    `<text x="316" y="128" font-size="11" fill="var(--mute)" text-anchor="end">${tr("today")}</text></svg>`
  );
}
// What the next round looks like
function drillLevelText(L, lv) {
  const sp = drillSpec(L, lv),
    parts = [];
  const sizes = new Set((L === 1 ? GAME.drillSingles : GAME.drillLevels).map((x) => x.size.join("x")));
  if (sizes.size > 1) parts.push(sp.size[1] + "×" + sp.size[0]);
  if (L >= 2) parts.push(sp.pencil ? tr("with pencil marks") : tr("without pencil marks"));
  const mid = (sp.empty[0] + sp.empty[1]) / 2;
  parts.push(mid < 0.45 ? tr("late in the puzzle") : mid < 0.62 ? tr("mid-puzzle") : tr("early in the puzzle"));
  if (L === 1 && sp.opts) parts.push(sp.opts === 1 ? tr("only one easy number to find") : tr("at most {n} easy numbers to find", { n: sp.opts }));
  return parts.join(", ");
}
// Faster at your current level than a week ago? Needs at least 3 boards at the level in each period.
function drillFaster(L, s) {
  if (isGame(L)) return "";
  const weekAgo = dayKey(new Date(Date.now() - 7 * 864e5));
  const at = (s.log || []).filter((x) => drillWhole(x.lv) === drillWhole(s.lv) && x.r !== "miss");
  const now = at.filter((x) => x.d > weekAgo).map((x) => x.s),
    before = at.filter((x) => x.d <= weekAgo).map((x) => x.s);
  if (now.length < 3 || before.length < 3) return "";
  const a = median(before),
    b = median(now);
  if (b > 0.85 * a) return "";
  return tr("At level {lv} you find {tech} faster than a week ago: {a} → {b}.", { lv: drillWhole(s.lv) - 1, tech: LEVEL_TECH[L], a: fmtS(a), b: fmtS(b) });
}
// six bars; the decimals fill part of the next one
function drillBars(lv) {
  let s = "";
  for (let i = 1; i <= DRILL_MAX; i++) {
    const f = Math.max(0, Math.min(1, lv - i));
    s += f >= 1 ? `<i class="on"></i>` : f > 0 ? `<i style="--f:${Math.round(f * 100)}%"></i>` : `<i></i>`;
  }
  return `<span class="dbar" aria-hidden="true">${s}</span>`;
}
// All drills with their level; each row starts a round
function drillListHtml(cur) {
  return DRILL_TECHS.map((L) => {
    const s = drillOf(L),
      started = s.log && s.log.length;
    return (
      `<button type="button" class="drow${L === cur ? " cur" : ""}" data-drill="${L}"><span class="dname">${esc(drillName(L))}</span>` +
      drillBars(started ? s.lv : 0) +
      `<span class="dlv">${started ? tr("level {n}", { n: lvTxt(s.lv) }) : tr("new")}</span></button>`
    );
  }).join("");
}
// Your typical time per board against what your curve expects: what it takes to move the level
function paceLine() {
  const rs = D.res.filter((r) => r.sec && r.exp && r.verdict !== "miss");
  if (!rs.length) return "";
  const note = isGame(D.L) && PG[D.L].paceNote ? " " + PG[D.L].paceNote() : "";
  return `<p class="dpace">${tr("Per board you took about {a}; your curve expects about {b}. Faster than that moves the level up.", { a: fmtS(median(rs.map((r) => r.sec))), b: fmtS(median(rs.map((r) => r.exp))) })}${note}</p>`;
}
function drillSummaryHtml() {
  const s = drillOf(D.L),
    done = D.res.filter((r) => r.verdict !== "miss" && r.verdict !== "skip").length,
    n = roundLen(D.L),
    game = isGame(D.L);
  const marks = D.res
    .map((r) => {
      const cls = { quick: "q", ok: "k", slow: "s", miss: "m", skip: "x" }[r.verdict];
      return `<span class="dmark ${cls}">${r.verdict === "miss" ? "×" : r.verdict === "skip" ? "–" : "✓"}</span>`;
    })
    .join("");
  const missAt = D.res.findIndex((r) => r.verdict === "miss");
  const now = lvTxt(s.lv),
    was = lvTxt(D.lv0);
  const change = now === was ? tr("same as before") : s.lv > D.lv0 ? tr("up from {n}", { n: was }) : tr("down from {n}", { n: was });
  const faster = drillFaster(D.L, s);
  const inGame = P && !solved && meta;
  return (
    `<div class="dsum">` +
    (game && PG[D.L].scoreHtml && D.res[0] && D.res[0].board
      ? `<div class="dscore">${PG[D.L].scoreHtml(D.res[0].board)}</div>` +
        (PG[D.L].misses(D.res[0].board).length
          ? `<button type="button" class="link dagain" id="dMisses">${tr("See what you got wrong ({n})", { n: PG[D.L].misses(D.res[0].board).length })}</button>`
          : "")
      : `<div class="dscore"><div><b>${tr("{k} of {n}", { k: done, n })}</b><span>${tr("this round")}</span></div>` +
        `<div class="dmarks" role="img" aria-label="${esc(tr("{k} of {n} boards found", { k: done, n }))}">${marks}</div></div>` +
        (missAt >= 0 ? `<button type="button" class="link dagain" id="dAgain">${tr("See board {k} again", { k: missAt + 1 })}</button>` : "") +
        paceLine()) +
    `<div class="panelcard dlevel"><div class="dlhead"><b>${tr("{tech}: level {n}", { tech: drillName(D.L), n: now })}</b><span>${change}</span></div>` +
    drillChart(s) +
    `<p>${faster ? esc(faster) + " " : ""}${esc(tr("Next round: {what}.", { what: game ? gameLevelText(D.L, s.lv) : drillLevelText(D.L, s.lv) }))}</p></div>` +
    (game
      ? `<h3 class="dhead">${tr("Your games")}</h3><div class="dlist">${gameListHtml(D.L)}</div>`
      : `<h3 class="dhead">${tr("Your techniques")}</h3><div class="dlist">${drillListHtml(D.L)}</div>`) +
    `<div class="actions"><button class="primary big" type="button" id="dBack">${inGame ? tr("Back to your puzzle") : tr("Done")}</button>` +
    `<button class="secondary" type="button" id="dAnother">${tr("Another round")}</button></div></div>`
  );
}
function bindDrillSummary(root) {
  root.querySelector("#dBack").onclick = () => {
    const inGame = P && !solved && meta;
    D = null;
    go(inGame ? "game" : "home", { back: true });
  };
  root.querySelector("#dAnother").onclick = () => startDrill(D.L);
  root.querySelectorAll("[data-drill]").forEach((b) => (b.onclick = () => startDrill(drillKey(b.dataset.drill))));
  const ms = root.querySelector("#dMisses");
  if (ms)
    ms.onclick = () => {
      const c = D.res[0].board,
        list = PG[D.L].misses(c);
      openSheet(
        `<h2>${tr("What you got wrong")}</h2>` +
          list.slice(0, 8).map((a) => PG[D.L].missHtml(a)).join("") +
          (list.length > 8 ? `<p class="sub">${tr("and {n} more", { n: list.length - 8 })}</p>` : "") +
          `<div class="actions"><button class="secondary" type="button" id="dClose">${tr("Close")}</button></div>`,
        (b) => (b.querySelector("#dClose").onclick = closeSheet),
      );
    };
  const ag = root.querySelector("#dAgain");
  if (ag)
    ag.onclick = () => {
      const r = D.res.find((x) => x.verdict === "miss");
      const c = r && r.board;
      if (!c) return;
      const h = isGame(D.L) ? null : c.shown,
        kv = h ? keyView(h) : null;
      openSheet(
        `<h2>${esc(isGame(D.L) ? drillName(D.L) : GAME.drillFind[D.L][0])}</h2><div class="drillboard">${drillBoardSvg(c)}</div>` +
          (isGame(D.L) ? `<div class="drilltask">${PG[D.L].task(c)}</div>` : kv && kv.text ? `<p>${esc(kv.text)}</p>` : "") +
          `<div class="actions"><button class="secondary" type="button" id="dClose">${tr("Close")}</button></div>`,
        (b) => (b.querySelector("#dClose").onclick = closeSheet),
      );
    };
}

// ---------- where practice starts: home, the solved sheet and the statistics
// The suggestion: the technique of the most important moment in your last game, otherwise the drill you practised last
function drillSuggest() {
  const last = games
    .slice()
    .reverse()
    .find((g) => g.moves && g.moves.length && !g.routePending);
  if (last) {
    try {
      const t = takeaway(last);
      const m = t && t.moments && t.moments.find((x) => x.L >= 1 && x.L <= 4);
      if (m) return { L: m.L, why: "game" };
    } catch (e) {}
  }
  let best = null;
  for (const L of DRILL_TECHS) {
    const lg = drillOf(L).log;
    const d = lg && lg.length ? lg[lg.length - 1].d : "";
    if (d && (!best || d > best.d)) best = { L, d };
  }
  return { L: best ? best.L : 3, why: best ? "last" : "start" };
}
function renderPracticeCard() {
  const slot = $("practiceSlot");
  if (!slot) return;
  const sg = drillSuggest();
  slot.innerHTML =
    `<button class="card practice" type="button" id="practiceGo">` +
    `<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>` +
    `<div><span class="eyebrow">${tr("Practice")}</span><strong>${esc(drillName(sg.L))}</strong>` +
    `<span class="sub">${sg.why === "game" ? tr("From your last game · 5 boards") : tr("5 boards, a few minutes")}</span></div>` +
    `<svg class="i chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>` +
    `<button class="link pother" type="button" id="practiceOther">${tr("More practice")}</button>`;
  $("practiceGo").onclick = () => startDrill(sg.L);
  $("practiceOther").onclick = drillChooser;
}
function drillChooser() {
  openSheet(
    `<h2>${tr("Practice")}</h2>` +
      `<h3 class="dhead">${tr("Techniques")}</h3><p class="sub">${tr("Five boards where one technique is the next step.")}</p>` +
      `<div class="dlist">${drillListHtml(null)}</div>` +
      `<h3 class="dhead">${tr("Games")}</h3><div class="dlist">${gameListHtml(null, true)}</div>` +
      `<div class="actions"><button class="secondary" type="button" id="dcClose">${tr("Cancel")}</button></div>`,
    (b) => {
      b.querySelectorAll("[data-drill]").forEach(
        (x) =>
          (x.onclick = () => {
            closeSheet();
            startDrill(drillKey(x.dataset.drill));
          }),
      );
      b.querySelector("#dcClose").onclick = closeSheet;
    },
  );
}
// For the statistics (Technique tab): the level per drill, once you have practised
function drillPanel() {
  const played = (k) => (drillOf(k).log || []).length > 0;
  if (!DRILL_TECHS.some(played) && !PRACTICE_GAMES.some(played)) return "";
  return (
    `<div class="panelcard"><h3>${tr("Practice")}</h3><p>${tr("Your level in each drill, from 0 to 6. It moves a little after each board: up when you find the pattern faster than your curve expects, down when it takes longer. Tap one to practise it.")}</p>` +
    `<div class="dlist">${drillListHtml(null)}</div>` +
    (PRACTICE_GAMES.some(played) ? `<h3 class="dhead">${tr("Games")}</h3><div class="dlist">${gameListHtml(null)}</div>` : "") +
    `</div>`
  );
}
function bindDrillPanel(root) {
  root.querySelectorAll(".dlist [data-drill]").forEach((b) => (b.onclick = () => startDrill(drillKey(b.dataset.drill))));
}
$("drillBack").onclick = () => {
  const inGame = P && !solved && meta;
  D = null;
  go(backTo === "game" && inGame ? "game" : "home", { back: true });
};
// Number keys on a keyboard, like the game: the pad's numbers (Cascade, Count them), Escape lets go of the cell
document.addEventListener("keydown", (e) => {
  if (view !== "drill" || !D || !D.cur || !D.cur.phase || D.cur.phase === "done" || !$("sheet").hidden || !isGame(D.L)) return;
  const b = e.key >= "1" && e.key <= "9" && document.querySelector(`#drillBody .dpad [data-d="${e.key}"]`);
  if (b && !b.disabled) {
    PG[D.L].padTap(D.cur, +e.key);
    e.preventDefault();
  } else if (e.key === "Escape" && D.L === "cascade" && D.cur.sel != null) {
    D.cur.sel = null;
    renderDrill();
  }
});
// Quick call on a keyboard: ← or F for false, → or T for true, Enter to start
document.addEventListener("keydown", (e) => {
  if (view !== "drill" || !D || D.L !== "quick" || !D.cur || !D.cur.phase || !$("sheet").hidden) return;
  const c = D.cur;
  if (c.phase === "ready" && e.key === "Enter") return PG.quick.start(c);
  if (c.phase !== "find") return;
  if (e.key === "ArrowLeft" || e.key === "f" || e.key === "F") PG.quick.answer(c, false), e.preventDefault();
  else if (e.key === "ArrowRight" || e.key === "t" || e.key === "T") PG.quick.answer(c, true), e.preventDefault();
});
// Taps on the board, the number pad and true/false react on touch, like the main game (fastTap in play.js), through one
// listener on the practice view that survives every redraw. A tap is never lost because the button under the finger was
// redrawn, and the board answers as the finger lands instead of when it lifts.
let lastFast = 0,
  downAt = 0;
document.addEventListener("pointerdown", () => (downAt = performance.now()), true);
// The click that ends a touch can land on a button that the touch itself drew there ("Next board" appears where the
// last number was tapped): a click whose press began before the button existed is ignored. Keyboard clicks (detail 0)
// always count.
const ghost = (e, drawn) => e && e.detail !== 0 && downAt < drawn;
fastTap($("drillBody"), (e) => {
  const c = D && D.cur;
  if (!c || !c.phase || D.over || !e.target.closest) return;
  const pad = e.target.closest(".dpad [data-d]");
  if (pad) {
    if (!pad.disabled) (lastFast = performance.now()), PG[D.L].padTap(c, +pad.dataset.d);
    return;
  }
  const tf = e.target.closest(".dtf [data-tf]");
  if (tf) {
    lastFast = performance.now();
    PG[D.L].answer(c, tf.dataset.tf === "1");
    return;
  }
  const svg = e.target.closest("#drillBoard svg");
  if (!svg || !c.b) return;
  const cell = svgCellAt(svg, c.b.cols, c.b.rows, e);
  if (cell < 0) return;
  lastFast = performance.now();
  drillTap(cell);
});
