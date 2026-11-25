// Practice drills: finding a position where one technique is the next step. Runs in the background worker (js/worker.js),
// and in the page if the worker cannot start. No DOM here; the drill screens are in drill.js.
//
// A drill is one of four technique levels: 1 singles, 2 neighbour elimination (Suguru) or locked candidates (Sudoku),
// 3 pairs, 4 triples. Each has six difficulty levels, described per game in GAME.drillLevels (GAME.drillSingles for singles):
// board size, whether pencil marks are shown, and how far into the puzzle the position is (the share of empty cells).

const DRILL_TECHS = [1, 2, 3, 4];

// d = { L, spec: { size: [rows, cols], maxRegion, empty: [lo, hi], opts }, seed, budget (ms) }
// Generates puzzles that need technique level L and walks their solution with the tutor (always the easiest next number).
// A position fits when the next number needs exactly one pattern at level L and nothing harder (singles: any position, with
// at most spec.opts easy numbers to find). When no exact fit turns up in half the time, a position where an easier pattern
// would do too is accepted, as long as one pattern at level L gives a number on its own (rare patterns: triples in Sudoku). Among the fitting positions,
// one inside the wanted range of empty cells is picked at random (the exact fits first); otherwise the nearest.
function findDrill(SE, d) {
  const t0 = Date.now(),
    [rows, cols] = d.spec.size,
    total = rows * cols,
    [lo, hi] = d.spec.empty;
  let seed = d.seed >>> 0,
    rnd = seed || 1,
    best = null,
    bestDist = Infinity;
  const rand = () => ((rnd = (rnd * 1103515245 + 12345) >>> 0) % 100000) / 100000;
  for (let round = 0; round < 40; round++) {
    const p = SE.generate(rows, cols, Math.max(1, d.L), seed++, 1500, null, d.spec.maxRegion || 5);
    if (!p) continue;
    const region = Array.from(p.region),
      tu = createTutor(SE.makeGeometry(rows, cols), region),
      known = Array.from(p.givens),
      inRange = [],
      loose = [];
    for (let guard = 0; guard < total; guard++) {
      const h = tu.easiest(known);
      if (!h) break;
      const empty = known.filter((v) => !v).length / total;
      let fits = false,
        near = false;
      if (d.L === 1) fits = h.hardestLevel === 1 && (!d.spec.opts || h.opts <= d.spec.opts);
      else if (h.hardestLevel >= 2 && h.hardestLevel <= d.L) {
        const gives = tu.drillApps(known, d.L).some((a) => a.gives.length);
        fits = gives && h.hardestLevel === d.L && h.support.length === 1;
        near = gives && !fits;
      }
      if (fits || near) {
        const dist = empty < lo ? lo - empty : empty > hi ? empty - hi : 0;
        const pos = { L: d.L, rows, cols, region, givens: Array.from(p.givens), sol: Array.from(p.solution), known: known.slice(), empty };
        if (dist === 0) (fits ? inRange : loose).push(pos);
        else if (dist < bestDist) (bestDist = dist), (best = pos);
      }
      known[h.cell] = h.v;
    }
    if (inRange.length) return inRange[Math.floor(rand() * inRange.length)];
    // a position where an easier pattern would also do only when no exact one turns up in half the time (it runs ahead of
    // play, so the wait is hidden: drill.js fetches the next board, and the first of the next round, in advance)
    if (loose.length && Date.now() - t0 > d.budget / 2) return loose[Math.floor(rand() * loose.length)];
    if (best && Date.now() - t0 > d.budget) return best;
    if (Date.now() - t0 > 3 * d.budget) break;
  }
  return best;
}


// ---------- practice games (games.js)
// d = { game, spec, seed, budget }. Like findDrill: generate puzzles, walk their solution with the tutor and keep the positions
// that fit the game; one inside the wanted range of empty cells at random, otherwise the nearest.
//  cascade: the next spec.n numbers can all be found as easy numbers, one after the other
//  changed: placing the next number makes spec.fresh new easy numbers elsewhere (b.move is that number)
//  sweep: a pattern at one of spec.techs removes options from at least spec.minT cells (b.L and b.cells name it)
//  count: there are spec.count easy numbers on the board
const GAME_GEN = { cascade: 1, changed: 2, sweep: 3, count: 2, quick: 3 };
function findGame(SE, d) {
  if (d.game === "quick") return findQuick(SE, d);
  const t0 = Date.now(),
    sp = d.spec,
    [rows, cols] = sp.size,
    total = rows * cols,
    [lo, hi] = sp.empty;
  let seed = d.seed >>> 0,
    rnd = seed || 1,
    best = null,
    bestDist = Infinity;
  const rand = () => ((rnd = (rnd * 1103515245 + 12345) >>> 0) % 100000) / 100000;
  const genLevel = d.game === "sweep" ? Math.max(...sp.techs) : GAME_GEN[d.game];
  const inRange = [];
  for (let round = 0; round < 40; round++) {
    const p = SE.generate(rows, cols, genLevel, seed++, 1500, null, sp.maxRegion || 5);
    if (!p) continue;
    const region = Array.from(p.region),
      tu = createTutor(SE.makeGeometry(rows, cols), region),
      known = Array.from(p.givens),
      steps = [];
    for (let guard = 0; guard < total; guard++) {
      const h = tu.easiest(known);
      if (!h) break;
      steps.push({ known: known.slice(), h });
      known[h.cell] = h.v;
    }
    const base = { game: d.game, rows, cols, region, givens: Array.from(p.givens), sol: Array.from(p.solution) };
    steps.forEach((st, i) => {
      const empty = st.known.filter((v) => !v).length / total;
      const dist = empty < lo ? lo - empty : empty > hi ? empty - hi : 0;
      if (dist > 0 && dist >= bestDist) return;
      let extra = null;
      if (d.game === "cascade") {
        if (i + sp.n <= steps.length && steps.slice(i, i + sp.n).every((x) => x.h.hardestLevel === 1)) extra = {};
      } else if (d.game === "count") {
        const n = tu.easyList(st.known).length;
        if (n >= sp.count[0] && n <= sp.count[1]) extra = {};
      } else if (d.game === "changed") {
        const before = new Set(tu.easyList(st.known).map(([c]) => c)),
          after = st.known.slice();
        after[st.h.cell] = st.h.v;
        const fresh = tu.easyList(after).filter(([c]) => !before.has(c) && c !== st.h.cell);
        if (fresh.length >= sp.fresh[0] && fresh.length <= sp.fresh[1]) extra = { move: { cell: st.h.cell, v: st.h.v } };
      } else if (d.game === "sweep") {
        const opts = [];
        for (const L of sp.techs)
          for (const g of tu.drillApps(st.known, L)) if (g.targets.length >= sp.minT) opts.push({ L, cells: g.cells, gives: g.gives.length > 0 });
        // a pattern that also gives a number is the nicer end of a sweep
        const pick = opts.filter((o) => o.gives).length ? opts.filter((o) => o.gives) : opts;
        if (pick.length) {
          const o = pick[Math.floor(rand() * pick.length)];
          extra = { L: o.L, cells: o.cells };
        }
      }
      if (!extra) return;
      const pos = Object.assign({}, base, { known: st.known.slice(), empty }, extra);
      if (dist === 0) inRange.push(pos);
      else (bestDist = dist), (best = pos);
    });
    if (inRange.length) return inRange[Math.floor(rand() * inRange.length)];
    if (best && Date.now() - t0 > d.budget) return best;
    if (Date.now() - t0 > 3 * d.budget) break;
  }
  return best;
}
// Quick call needs many boards at once: one position from each of spec.batch puzzles (different boards keep it fresh),
// inside the wanted range of empty cells. The claims about them are made in the page (games.js).
function findQuick(SE, d) {
  const t0 = Date.now(),
    sp = d.spec,
    [rows, cols] = sp.size,
    total = rows * cols,
    [lo, hi] = sp.empty,
    out = [];
  let seed = d.seed >>> 0,
    rnd = seed || 1;
  const rand = () => ((rnd = (rnd * 1103515245 + 12345) >>> 0) % 100000) / 100000;
  for (let round = 0; round < 40 && out.length < (sp.batch || 8); round++) {
    const p = SE.generate(rows, cols, GAME_GEN.quick, seed++, 1500, null, sp.maxRegion || 5);
    if (!p) continue;
    const region = Array.from(p.region),
      tu = createTutor(SE.makeGeometry(rows, cols), region),
      known = Array.from(p.givens),
      fit = [];
    for (let guard = 0; guard < total; guard++) {
      const empty = known.filter((v) => !v).length / total;
      if (empty >= lo && empty <= hi) fit.push(known.slice());
      const h = tu.easiest(known);
      if (!h) break;
      known[h.cell] = h.v;
    }
    if (fit.length)
      out.push({ game: "quick", rows, cols, region, givens: Array.from(p.givens), sol: Array.from(p.solution), known: fit[Math.floor(rand() * fit.length)] });
    if (out.length && Date.now() - t0 > 2 * d.budget) break;
  }
  return out.length ? Object.assign({}, out[0], { batch: out }) : null;
}
