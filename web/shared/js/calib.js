// Personal time curve: how long a move takes you, from which technique it needed, how many places there were to find it,
// and how big the board is.
//   time ≈ a · R^k · n^b · (cells/ref)^s      (R = the rung of the technique level, calL; n = number of possible moves at that level)
// A bigger board takes longer to scan for every move: in one player's 3,900 moves (Nov. 2026) about √cells (s ≈ 0.45),
// from 0.6 of the 6×6 time on 4×4 to 1.3 times on 10×8. ref is the board the starting values are for (6×6, Sudoku 9×9).
// a, k, b and s are fitted to your own moves. The starting values (priors) come from one real player's 838 Suguru moves (Nov. 2026), so
// the curve is sensible from the first game and moves towards your own numbers as data comes in. A game can give
// its own starting values (GAME.calPrior); Sudoku does, because a move there takes longer to find.
// On top of the curve each technique gets its own deviation (r), damped when there are few moves. The deviation is what the focus area shows.

const CAL_PRIOR = Object.assign({ c: Math.log(3.1), k: 2.0, b: -0.31, s: 0.45, cells: 36 }, GAME.calPrior || {});
const CAL_STRENGTH = { c: 3, k: 25, b: 25, s: 50 }; // how many "moves" the priors count as
const calCells = (cells) => Math.log((cells || CAL_PRIOR.cells) / CAL_PRIOR.cells);
const CAL_SHRINK = 4; // a technique with n moves gets n/(n+4) of its measured deviation
// The rung on the time ladder per technique: the table's rung (tools/grade/techniques.json). The mixed pair came in on
// 26 Nov. 2026 between pairs and triples (rung 3.5), so the curve for the other techniques is the same as before.
const calL = (L) => TT.rung(L);

// Moves that can be used for the curve: timed, not a hint, not an error and not placed while an error stood on the board
function calibRows(gs) {
  const rows = [];
  gs.forEach((g) => {
    // The summary (route.ctx) has the same moves and survives when the route analysis is cleared away
    if (g.route && g.route.ctx) {
      const lc = calCells(g.rows * g.cols),
        t = +new Date(g.end) || 0;
      g.route.ctx.forEach(([L, ds, n]) => {
        if (!TT.known(L) || !(ds > 0)) return;
        rows.push({ L, y: Math.log(Math.max(0.5, ds / 10)), ln: Math.log(Math.max(1, n || 1)), lc, t, dt: ds / 10, one: (n || 1) <= 1 });
      });
      return;
    }
    if (!g.moves) return;
    markErrors(g.moves);
    const lc = calCells(g.rows * g.cols),
      t = +new Date(g.end) || 0;
    g.moves.forEach((m) => {
      if (!judged(m) || m.cls === "wrong" || m.cls === "hint" || !(m.dt > 0)) return;
      const L = moveLevel(m);
      if (!TT.known(L)) return;
      rows.push({ L, y: Math.log(Math.max(0.5, m.dt / 1000)), ln: Math.log(Math.max(1, m.nAvail || 1)), lc, t, dt: m.dt / 1000, one: (m.nAvail || 1) <= 1 });
    });
  });
  return rows;
}

// Least squares with priors (ridge towards the starting values)
function fitCalib(rows) {
  const N = 4,
    P = [CAL_PRIOR.c, CAL_PRIOR.k, CAL_PRIOR.b, CAL_PRIOR.s],
    lam = [CAL_STRENGTH.c, CAL_STRENGTH.k, CAL_STRENGTH.b, CAL_STRENGTH.s];
  const A = [0, 1, 2, 3].map(() => [0, 0, 0, 0, 0]);
  rows.forEach((r) => {
    const x = [1, Math.log(calL(r.L)), r.ln, r.lc || 0];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) A[i][j] += x[i] * x[j];
      A[i][N] += x[i] * r.y;
    }
  });
  // The prior on k, b and s is weighted by the spread they normally have in the data, so "25 moves" means the same for all
  const sx = [1, 0.5, 0.6, 0.3];
  for (let i = 0; i < N; i++) {
    const w = lam[i] * sx[i] * sx[i];
    A[i][i] += w;
    A[i][N] += w * P[i];
  }
  for (let i = 0; i < N; i++)
    for (let r = 0; r < N; r++)
      if (r !== i) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c <= N; c++) A[r][c] -= f * A[i][c];
      }
  const [c, k, b, s] = A.map((r, i) => r[N] / r[i]);
  const lvl = {};
  rows.forEach((r) => {
    const e = (lvl[r.L] = lvl[r.L] || { n: 0, sum: 0, n1: 0 });
    e.n++;
    if (r.one) e.n1++;
    e.sum += r.y - (c + k * Math.log(calL(r.L)) + b * r.ln + s * (r.lc || 0));
  });
  for (const L in lvl) {
    const e = lvl[L];
    e.raw = e.sum / e.n;
    e.r = e.sum / (e.n + CAL_SHRINK);
  }
  // Spread: the times are skewed (some moves take much longer than the typical one). The curve gives the typical move (the median);
  // a sum of many moves must use the mean, which is exp(s2/2) times larger. s2 is measured for easy (1) and harder (2+) moves separately.
  const sq = [0, 0, 0, 0];
  rows.forEach((r) => {
    const g = r.L === TT.SINGLES ? 0 : 2,
      d = r.y - (c + k * Math.log(calL(r.L)) + b * r.ln + s * (r.lc || 0) + (lvl[r.L] ? lvl[r.L].r : 0));
    sq[g] += d * d;
    sq[g + 1]++;
  });
  const s2 = (i, prior) => (sq[i] + 10 * prior) / (sq[i + 1] + 10);
  return { c, k, b, s, lvl, n: rows.length, s2: [s2(0, 0.6), s2(2, 1.3)] };
}

// Expected time (seconds) for a move at level L with n options on a board of that many cells (default: the reference board).
// own=true adds your own deviation for the technique on top.
function calTime(cal, L, n = 1, own = true, cells) {
  const r = own && cal.lvl[L] ? cal.lvl[L].r : 0;
  return Math.exp(cal.c + cal.k * Math.log(calL(L)) + cal.b * Math.log(Math.max(1, n)) + (cal.s || 0) * calCells(cells) + r);
}
// How much more each rung on the ladder costs (from technique L to the next), as a number to show
const calStep = (cal, L) => Math.pow(calL(TT.next(L)) / calL(L), cal.k);

// Your curve from your latest moves of each technique: the latest 1,000 easy numbers and the latest 60 moves of every other
// technique, recomputed when new games come in. Not the latest games: after a spell of easy games those would hold
// almost no pairs or chains, and the curve would forget your speed with them.
const CAL_KEEP = (L) => (L === TT.SINGLES ? 1000 : 60);
let CAL = null;
function myCal() {
  const own = ownGames(),
    key = (microNow() ? "4x4:" : "") + own.length + ":" + (own.length ? own[own.length - 1].id : "");
  if (!CAL || CAL.key !== key) {
    const rows = calibRows(ownGames()),
      seen = {},
      keep = [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const L = rows[i].L;
      seen[L] = (seen[L] || 0) + 1;
      if (seen[L] <= CAL_KEEP(L)) keep.push(rows[i]);
    }
    CAL = fitCalib(keep.reverse());
    CAL.key = key;
  }
  return CAL;
}
// The puzzle's steps in short form: L*100 + number of options, one number per number to be placed
function stepCodes(steps) {
  return steps.map((s) => s.L * 100 + Math.min(99, s.opts || 1));
}
// The sum of the average move for each step of a puzzle on a board of that many cells (seconds)
function sumOfMeans(cal, lv, cells) {
  return lv.reduce((a, x) => {
    const L = Math.floor(x / 100);
    return a + calTime(cal, L, x % 100, true, cells) * Math.exp((L === TT.SINGLES ? cal.s2[0] : cal.s2[1]) / 2);
  }, 0);
}
// Puzzle times are skewed: a few long searches pull the average up, so most puzzles come in under the sum of the average
// moves (in one player's latest 60 puzzles, 0.82 of it). The estimate is therefore the typical puzzle: that sum times how
// your latest 60 puzzles have come out against it (the median). Faster than the estimate is then as common as slower.
let SKEW = null;
function calSkew(cal) {
  if (SKEW && SKEW.cal === cal) return SKEW.q;
  const r = ownGames()
    .filter((g) => g.solved && !g.hints && !g.replay && g.lv && g.lv.length && g.ms > 0)
    .slice(-60)
    .map((g) => g.ms / 1000 / sumOfMeans(cal, g.lv, g.rows * g.cols))
    .filter((x) => isFinite(x) && x > 0)
    .sort((a, b) => a - b);
  const q = r.length >= 10 ? Math.max(0.6, Math.min(1.2, r[Math.floor(r.length / 2)])) : 1;
  SKEW = { cal, q };
  return q;
}
// Personal time estimate (seconds) for a whole puzzle on a board of that many cells: what a puzzle with these steps
// typically takes you
function estimateSec(cal, lv, cells) {
  if (!cal || !lv || !lv.length) return null;
  return sumOfMeans(cal, lv, cells) * calSkew(cal);
}

// Estimate and comparison as text (used in the "why" sheet, after solving and in the statistics)
const estFmt = (sec) => fmt(Math.max(10, Math.round(sec / 10) * 10) * 1000);
// After a game: your time against the expectation in one quiet line (26 Nov. 2026): the time, a thin bar with a tick at
// the expected time, and the percentage of it. refLabel names the tick ("expected", or "limit" in a timed trial).
function timeMeterHtml(ms, refSec, refLabel) {
  const t = ms / 1000,
    pct = Math.round((100 * t) / refSec),
    max = Math.max(t, refSec) * 1.12,
    at = (x) => Math.min(100, (100 * x) / max);
  const tick = at(refSec),
    // the label under the tick stays inside the bar: right-aligned to the tick when it sits far right
    align = tick > 62 ? "translateX(-100%)" : tick < 38 ? "none" : "translateX(-50%)";
  const tip = tr("{t} · {pct} % of {label} {ref}", { t: fmt(ms), pct, label: refLabel, ref: estFmt(refSec) });
  return (
    `<div class="tmeter" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}">` +
    `<b class="tm-t">${fmt(ms)}</b>` +
    `<span class="tm-bar"><span class="tm-track"><span class="tm-fill" style="width:${at(t).toFixed(1)}%"></span>` +
    `<span class="tm-ref" style="left:${tick.toFixed(1)}%"></span></span>` +
    `<span class="tm-lab" style="left:${tick.toFixed(1)}%;transform:${align}">${esc(refLabel)} ${estFmt(refSec)}</span></span>` +
    `<b class="tm-p">${pct} %</b></div>`
  );
}
function estLineHtml(lv, cells) {
  const cal = myCal(),
    est = estimateSec(cal, lv, cells);
  if (!est) return "";
  return (
    `<p class="estline"><b>${tr("Your time estimate: about {t}.", { t: estFmt(est) })}</b> ` +
    tr("Your time for each step in the puzzle, on this board size, from {n} of your moves, scaled to how your puzzles usually turn out.", { n: cal.n }) +
    (cal.n < 100 ? " " + tr("Until you have played a bit more, it relies mostly on starting values.") : "") +
    `</p>`
  );
}
// How well does the estimate hit? Your latest solved puzzles with an estimate
function estStats(k = 12) {
  const cal = myCal();
  const r = ownGames()
    .filter((g) => g.solved && g.lv && g.lv.length)
    .slice(-k)
    .map((g) => g.ms / 1000 / (g.est || estimateSec(cal, g.lv, g.rows * g.cols)))
    .filter((x) => isFinite(x) && x > 0)
    .sort((a, b) => a - b);
  if (r.length < 4) return null;
  const q = (p) => r[Math.min(r.length - 1, Math.floor(p * r.length))];
  return { n: r.length, med: q(0.5), lo: q(0.25), hi: q(0.75) };
}

// ---------- Personal grade: how a puzzle will probably feel to you
// From your solved puzzles without hints: how long per empty cell each grade usually takes you, and how much puzzles with
// the same hardest technique have been above or below their grade. The deviation is damped when there are few puzzles of that kind.
// Tested on 46 real puzzles (Nov. 2026): 0.80 against 0.72. A forward test on 40 new puzzles gave no gain, so
// the deviation is now strongly damped (n + 12) and needs at least 5 puzzles with the same hardest technique.
let PGM = null;
// The personal grade's groups: each technique on its own, but bivalue chains and everything harder in one group (few puzzles each)
const calGroup = (tech) => TT.min(tech, TT.code("chain2"));
function personalModel() {
  const key = (microNow() ? "4x4:" : "") + games.length + ":" + (games.length ? games[games.length - 1].id : "");
  if (PGM && PGM.key === key) return PGM.m;
  const hist = ownGames().filter((g) => g.solved && !g.hints && g.empty > 0 && g.ms > 0 && g.value && g.tech).slice(-80);
  let m = null;
  if (hist.length >= 10) {
    const x = hist.map(gradeFor),
      y = hist.map((g) => Math.log(g.ms / 1000 / g.empty));
    const n = x.length,
      mx = x.reduce((a, b) => a + b) / n,
      my = y.reduce((a, b) => a + b) / n;
    let sxy = 0,
      sxx = 0;
    for (let i = 0; i < n; i++) {
      sxy += (x[i] - mx) * (y[i] - my);
      sxx += (x[i] - mx) ** 2;
    }
    const b = sxx ? sxy / sxx : 0,
      a = my - b * mx;
    if (b >= 0.15) {
      const grp = {};
      hist.forEach((g, i) => {
        const k = calGroup(g.tech),
          e = (grp[k] = grp[k] || { n: 0, sum: 0 });
        e.n++;
        e.sum += (y[i] - a) / b - x[i]; // how many grades the puzzle felt above or below its grade (measured in time)
      });
      // Cautious: a technique must have shown the same pattern in many puzzles before it moves the grade much
      for (const k in grp) grp[k].adj = grp[k].sum / (grp[k].n + 12);
      m = { a, b, n, grp, step: Math.exp(b) };
    }
  }
  PGM = { key, m };
  return m;
}
function personalGrade(value, tech) {
  const m = personalModel();
  if (!m || !tech) return null;
  const e = m.grp[calGroup(tech)];
  if (!e || e.n < 5) return null;
  return { value: Math.max(1, Math.min(GW.cap, Math.round((value + e.adj) * 10) / 10)), adj: e.adj, n: e.n };
}
function personalLineHtml(value, tech) {
  const pg = personalGrade(value, tech);
  if (!pg) {
    const solvedClean = games.filter((g) => g.solved && !g.hints).length;
    return solvedClean < 10
      ? `<p class="estline">${tr("After 10 puzzles solved without hints, the app can tell how a puzzle will probably feel for you ({n} so far).", { n: solvedClean })}</p>`
      : "";
  }
  const name = LEVEL_TECH[calGroup(tech)] + (calGroup(tech) === TT.code("chain2") ? " " + tr("or harder") : "");
  const why =
    pg.adj >= 0.2
      ? tr("Puzzles where {tech} is the hardest technique have taken you longer than their grade says ({n} puzzles).", { tech: name, n: pg.n })
      : pg.adj <= -0.2
        ? tr("Puzzles where {tech} is the hardest technique have gone faster for you than their grade says ({n} puzzles).", { tech: name, n: pg.n })
        : tr("Puzzles where {tech} is the hardest technique have matched their grade for you ({n} puzzles).", { tech: name, n: pg.n });
  return `<p class="estline"><b>${tr("Based on your history, this will probably feel like a {v}.", { v: dec(pg.value) })}</b> ${why}</p>`;
}
