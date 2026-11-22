// Personal time curve: how long a move takes you, from which technique it needed and how many places there were to find it.
//   time ≈ a · L^k · n^b      (L = technique level 1–11, n = number of possible moves at that level)
// a, k and b are fitted to your own moves. The starting values (priors) come from one real player's 838 Suguru moves (Nov. 2026), so
// the curve is sensible from the first game and moves towards your own numbers as data comes in. A game can give
// its own starting values (GAME.calPrior); Sudoku does, because a move there takes longer to find.
// On top of the curve each technique gets its own deviation (r), damped when there are few moves. The deviation is what the focus area shows.

const CAL_PRIOR = Object.assign({ c: Math.log(3.1), k: 2.0, b: -0.31 }, GAME.calPrior || {});
const CAL_STRENGTH = { c: 3, k: 25, b: 25 }; // how many "moves" the priors count as
const CAL_SHRINK = 4; // a technique with n moves gets n/(n+4) of its measured deviation

// Moves that can be used for the curve: timed, not a hint, not an error and not placed while an error stood on the board
function calibRows(gs) {
  const rows = [];
  gs.forEach((g) => {
    // The summary (route.ctx) has the same moves and survives when the route analysis is cleared away
    if (g.route && g.route.ctx) {
      g.route.ctx.forEach(([L, ds, n]) => {
        if (L > 11 || !(ds > 0)) return;
        rows.push({ L, y: Math.log(Math.max(0.5, ds / 10)), ln: Math.log(Math.max(1, n || 1)), dt: ds / 10, one: (n || 1) <= 1 });
      });
      return;
    }
    if (!g.moves) return;
    markErrors(g.moves);
    g.moves.forEach((m) => {
      if (!judged(m) || m.cls === "wrong" || m.cls === "hint" || !(m.dt > 0)) return;
      const L = moveLevel(m);
      if (!L || L > 11) return;
      rows.push({ L, y: Math.log(Math.max(0.5, m.dt / 1000)), ln: Math.log(Math.max(1, m.nAvail || 1)), dt: m.dt / 1000, one: (m.nAvail || 1) <= 1 });
    });
  });
  return rows;
}

// Least squares with priors (ridge towards the starting values)
function fitCalib(rows) {
  const P = [CAL_PRIOR.c, CAL_PRIOR.k, CAL_PRIOR.b],
    lam = [CAL_STRENGTH.c, CAL_STRENGTH.k, CAL_STRENGTH.b];
  const A = [0, 1, 2].map(() => [0, 0, 0, 0]);
  rows.forEach((r) => {
    const x = [1, Math.log(r.L), r.ln];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) A[i][j] += x[i] * x[j];
      A[i][3] += x[i] * r.y;
    }
  });
  // The prior on k and b is weighted by the spread they normally have in the data, so "25 moves" means the same for all three
  const sx = [1, 0.5, 0.6];
  for (let i = 0; i < 3; i++) {
    const w = lam[i] * sx[i] * sx[i];
    A[i][i] += w;
    A[i][3] += w * P[i];
  }
  for (let i = 0; i < 3; i++)
    for (let r = 0; r < 3; r++)
      if (r !== i) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < 4; c++) A[r][c] -= f * A[i][c];
      }
  const [c, k, b] = A.map((r, i) => r[3] / r[i]);
  const lvl = {};
  rows.forEach((r) => {
    const e = (lvl[r.L] = lvl[r.L] || { n: 0, sum: 0, n1: 0 });
    e.n++;
    if (r.one) e.n1++;
    e.sum += r.y - (c + k * Math.log(r.L) + b * r.ln);
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
    const g = r.L === 1 ? 0 : 2,
      d = r.y - (c + k * Math.log(r.L) + b * r.ln + (lvl[r.L] ? lvl[r.L].r : 0));
    sq[g] += d * d;
    sq[g + 1]++;
  });
  const s2 = (i, prior) => (sq[i] + 10 * prior) / (sq[i + 1] + 10);
  return { c, k, b, lvl, n: rows.length, s2: [s2(0, 0.6), s2(2, 1.3)] };
}

// Expected time (seconds) for a move at level L with n options. own=true adds your own deviation for the technique on top.
function calTime(cal, L, n = 1, own = true) {
  const r = own && cal.lvl[L] ? cal.lvl[L].r : 0;
  return Math.exp(cal.c + cal.k * Math.log(L) + cal.b * Math.log(Math.max(1, n)) + r);
}
// How much more each rung on the ladder costs (from level L to L+1), as a number to show
const calStep = (cal, L) => Math.pow((L + 1) / L, cal.k);

// Your curve from the latest 60 games, recomputed when new games come in
let CAL = null;
function myCal() {
  const key = games.length + ":" + (games.length ? games[games.length - 1].id : "");
  if (!CAL || CAL.key !== key) {
    CAL = fitCalib(calibRows(games.slice(-60)));
    CAL.key = key;
  }
  return CAL;
}
// The puzzle's steps in short form: L*100 + number of options, one number per number to be placed
function stepCodes(steps) {
  return steps.map((s) => s.L * 100 + Math.min(99, s.opts || 1));
}
// Personal time estimate (seconds) for a whole puzzle: the sum of the average move for each step
function estimateSec(cal, lv) {
  if (!cal || !lv || !lv.length) return null;
  return lv.reduce((a, x) => {
    const L = Math.floor(x / 100);
    return a + calTime(cal, L, x % 100) * Math.exp((L === 1 ? cal.s2[0] : cal.s2[1]) / 2);
  }, 0);
}

// Estimate and comparison as text (used in the "why" sheet, after solving and in the statistics)
const estFmt = (sec) => fmt(Math.max(10, Math.round(sec / 10) * 10) * 1000);
function estCompare(ms, est) {
  const r = ms / 1000 / est;
  if (r >= 1.15) return tr("You took {x} times as long.", { x: dec(r) });
  if (r <= 0.87) return tr("You were faster: {pct}% of the estimate.", { pct: Math.round(100 * r) });
  return tr("That was about right.");
}
function estLineHtml(lv) {
  const cal = myCal(),
    est = estimateSec(cal, lv);
  if (!est) return "";
  return (
    `<p class="estline"><b>${tr("Your time estimate: about {t}.", { t: estFmt(est) })}</b> ` +
    tr("The sum of your typical time for each step in the puzzle, based on {n} of your moves.", { n: cal.n }) +
    (cal.n < 100 ? " " + tr("Until you have played a bit more, it relies mostly on starting values.") : "") +
    `</p>`
  );
}
// How well does the estimate hit? Your latest solved puzzles with an estimate
function estStats(k = 12) {
  const cal = myCal();
  const r = games
    .filter((g) => g.solved && g.lv && g.lv.length)
    .slice(-k)
    .map((g) => g.ms / 1000 / (g.est || estimateSec(cal, g.lv)))
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
function personalModel() {
  const key = games.length + ":" + (games.length ? games[games.length - 1].id : "");
  if (PGM && PGM.key === key) return PGM.m;
  const hist = games.filter((g) => g.solved && !g.hints && g.empty > 0 && g.ms > 0 && g.value && g.tech).slice(-80);
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
        const k = Math.min(g.tech, 6),
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
  const e = m.grp[Math.min(tech, 6)];
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
  const name = LEVEL_TECH[Math.min(tech, 6)] + (tech >= 6 ? " " + tr("or harder") : "");
  const why =
    pg.adj >= 0.2
      ? tr("Puzzles where {tech} is the hardest technique have taken you longer than their grade says ({n} puzzles).", { tech: name, n: pg.n })
      : pg.adj <= -0.2
        ? tr("Puzzles where {tech} is the hardest technique have gone faster for you than their grade says ({n} puzzles).", { tech: name, n: pg.n })
        : tr("Puzzles where {tech} is the hardest technique have matched their grade for you ({n} puzzles).", { tech: name, n: pg.n });
  return `<p class="estline"><b>${tr("Based on your history, this will probably feel like a {v}.", { v: dec(pg.value) })}</b> ${why}</p>`;
}
