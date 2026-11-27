// Sudoku engine: geometry, a fast solver (uniqueness and random full boards), a logical rating and
// generation towards a target level. The same interface as Suguru's js/engine.js, so the shared code can use both.
// The logical rating uses the shared tutor (shared/js/tutor.js), so the generator, hints and grade agree on
// which techniques a puzzle needs.

function engineFactory() {
  const TECH = [
    { label: TECH_LABELS[0], desc: tr("The cell has only one possible number left.") },
    { label: TECH_LABELS[1], desc: tr("A number can only go in one place in a row, column or box.") },
    {
      label: TECH_LABELS[2],
      desc: tr("All the places for a number in a box lie in the same row or column (or the other way round). Then the number cannot go anywhere else there."),
    },
    { label: TECH_LABELS[3], desc: tr("Two cells in the same house have only two possible numbers between them. The rest of the house cannot have them.") },
    { label: TECH_LABELS[4], desc: tr("Two numbers can only go in the same two cells of a house. Those cells cannot have other numbers.") },
    { label: TECH_LABELS[5], desc: tr("Like a naked pair, but with three cells and three numbers.") },
    { label: TECH_LABELS[6], desc: tr("Like a hidden pair, but with three numbers and three cells.") },
    {
      label: TECH_LABELS[7],
      desc: tr("Follow one number through houses where it has only two places (X-wing, skyscraper and the like). Cells that see both ends cannot have the number."),
    },
    {
      label: TECH_LABELS[8],
      desc: tr("Cells with only two options in a chain (XY-wing and longer): cells that see both ends cannot have the ends' shared number."),
    },
    { label: TECH_LABELS[9], desc: tr("A chain that mixes both kinds of links: cells with two options and numbers with two places in a house.") },
    { label: TECH_LABELS[10], desc: tr("Assume a number and follow only that number. If it ends in a contradiction, the assumption is wrong.") },
    { label: TECH_LABELS[11], desc: tr("Assume a number and follow it with simple moves until a contradiction appears.") },
    { label: TECH_LABELS[12], desc: tr("Try both options: whatever happens in both cases is true.") },
    { label: TECH_LABELS[13], desc: tr("Long assumptions where the hard techniques are used along the way too.") },
    { label: TECH_LABELS[14], desc: "" }, // the mixed pair: Suguru only (level 4 is empty in Sudoku)
  ];
  // each technique's unit (its "level") and weight come from the technique table (TT, tools/grade/techniques.json)
  TECH.forEach((t, m) => Object.assign(t, { level: TT.unitOf(m), weight: TT.method(m).weight }));
  const LEVELS = [
    "",
    tr("Easy"),
    tr("Medium"),
    tr("Hard"),
    "", // level 4, the mixed pair: not in Sudoku
    tr("Very hard"),
    tr("Chain: one number"),
    tr("Chain: two options"),
    tr("Chain: mixed"),
    tr("What-if: one number"),
    tr("What-if: singles"),
    tr("Both ways"),
    tr("What-if: techniques"),
    tr("Needs guessing"),
  ];

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pc = (x) => {
    let c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  };

  // The same geometry as Suguru (neighbours are not used in Sudoku, but do no harm)
  function makeGeometry(rows, cols) {
    const n = rows * cols,
      ortho = [],
      king = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const o = [],
          k = [];
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const rr = r + dr,
              cc = c + dc;
            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
            k.push(rr * cols + cc);
            if (!dr || !dc) o.push(rr * cols + cc);
          }
        ortho.push(o);
        king.push(k);
      }
    return { rows, cols, n, ortho, king };
  }
  // The boxes: 9×9 has 3×3 boxes, 6×6 has 2×3 (two rows, three columns) and 4×4 has 2×2
  function boxes(rows, cols) {
    const bh = rows === 6 ? 2 : Math.round(Math.sqrt(rows)), // box height
      bw = rows / bh; // box width (a box holds all the numbers 1..rows)
    return Array.from({ length: rows * cols }, (_, i) => Math.floor(Math.floor(i / cols) / bh) * (cols / bw) + Math.floor((i % cols) / bw));
  }

  // ---------- Solver: depth-first with bit masks; always picks the cell with the fewest options
  function createSolver(G, region) {
    const M = boardModel(G, region),
      n = G.n,
      N = G.rows,
      ALL = (1 << (N + 1)) - 2,
      U = M.unitsOf,
      nu = M.RC.length;
    let first = null;
    function count(givens, limit, maxNodes, rnd) {
      const val = Int32Array.from(givens),
        used = new Int32Array(nu);
      first = null;
      for (let c = 0; c < n; c++)
        if (val[c]) {
          const bit = 1 << val[c];
          for (const u of U[c]) {
            if (used[u] & bit) return 0;
            used[u] |= bit;
          }
        }
      let found = 0,
        nodes = 0,
        aborted = false;
      const rec = () => {
        if (++nodes > maxNodes) {
          aborted = true;
          return;
        }
        let best = -1,
          bestMask = 0,
          bestCnt = 99;
        for (let c = 0; c < n; c++) {
          if (val[c]) continue;
          const u = U[c];
          const m = ALL & ~(used[u[0]] | used[u[1]] | used[u[2]]);
          const k = pc(m);
          if (!k) return;
          if (k < bestCnt) {
            best = c;
            bestMask = m;
            bestCnt = k;
            if (k === 1) break;
          }
        }
        if (best < 0) {
          found++;
          if (found === 1) first = Array.from(val);
          return;
        }
        const ds = [];
        for (let d = 1; d <= N; d++) if (bestMask & (1 << d)) ds.push(d);
        if (rnd)
          for (let i = ds.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            [ds[i], ds[j]] = [ds[j], ds[i]];
          }
        const u = U[best];
        for (const d of ds) {
          const bit = 1 << d;
          val[best] = d;
          used[u[0]] |= bit;
          used[u[1]] |= bit;
          used[u[2]] |= bit;
          rec();
          val[best] = 0;
          used[u[0]] &= ~bit;
          used[u[1]] &= ~bit;
          used[u[2]] &= ~bit;
          if (found >= limit || aborted) return;
        }
      };
      rec();
      return aborted && found < limit ? limit : found; // interrupted: count it as "not unique"
    }
    return {
      count,
      randomSolution(rnd, limit) {
        return count(new Int32Array(n), 1, limit * 100, rnd) === 1 ? first : null;
      },
      uniqueSolution(givens) {
        const k = count(givens, 2, 2000000, null);
        return { count: k, solution: k === 1 ? first : null };
      },
    };
  }

  // ---------- Logical rating with the same techniques as hints (the shared tutor)
  function createRater(G, region) {
    const tu = createTutor(G, region);
    return {
      rate(givens, maxL = TT.last()) {
        const r = tu.rate(givens, maxL);
        // uses: moves per technique (as with the Suguru rater), so "About this puzzle" can show which techniques the puzzle uses
        return { level: r.solved ? r.level : TT.GUESS, score: 0, solved: r.solved, uses: r.tech, perLevel: r.uses };
      },
    };
  }

  // ---------- Generation towards a target level: remove given numbers in pairs (mirrored about the centre) as long as the puzzle can still
  // be solved with techniques up to the target. Logically solvable also means unique.
  function generate(rows, cols, target, seed, budgetMs, onProgress) {
    if (!SUDOKU_SIZES.includes(rows) || cols !== rows) rows = cols = 9; // 4×4, 6×6 and 9×9 (boxes 2×2, 2×3 and 3×3)
    const t0 = Date.now();
    const G = makeGeometry(rows, cols),
      region = boxes(rows, cols),
      n = G.n;
    const rand = mulberry32(seed >>> 0);
    const solver = createSolver(G, region),
      rater = createRater(G, region);
    let best = null,
      bestDist = Infinity,
      tries = 0;
    // The what-if levels (9+) are rare and expensive to hit by removing numbers one at a time. Instead make many
    // minimal puzzles (remove numbers as long as the solution is unique; without mirroring that gives fewer and harder givens),
    // rate each one once, and keep the nearest. Level 4 (the mixed pair) does not exist in Sudoku: aim at the pairs.
    while (!TT.here(target) && TT.rank(target) > 0) target = TT.below(target);
    if (TT.family(target) === "whatif") {
      while (true) {
        let solution = null;
        while (!solution) solution = solver.randomSolution(rand, 5000);
        const givens = solution.slice();
        const order = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        for (const c of order) {
          const s0 = givens[c];
          givens[c] = 0;
          if (solver.uniqueSolution(givens).count !== 1) givens[c] = s0;
        }
        tries++;
        const rating = rater.rate(givens, TT.last());
        const dist = rating.level === TT.GUESS ? 99 : Math.abs(TT.rank(rating.level) - TT.rank(target));
        if (dist < bestDist) {
          bestDist = dist;
          best = { rows, cols, region, solution, givens, rating, target, seed, tries, maxRegion: rows };
        }
        if (dist === 0 || Date.now() - t0 > budgetMs) return best;
        if (onProgress && tries % 20 === 0) onProgress(tries, best.rating.level);
      }
    }
    while (true) {
      let solution = null;
      while (!solution) solution = solver.randomSolution(rand, 5000);
      for (let o = 0; o < 3; o++) {
        tries++;
        const givens = solution.slice();
        const order = Array.from({ length: Math.ceil(n / 2) }, (_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        for (const c of order) {
          const d = n - 1 - c,
            sc = givens[c],
            sd = givens[d];
          givens[c] = 0;
          givens[d] = 0;
          if (!rater.rate(givens, target).solved) {
            givens[c] = sc;
            givens[d] = sd;
          }
        }
        const rating = rater.rate(givens, TT.last());
        const dist = Math.abs(TT.rank(rating.level) - TT.rank(target));
        if (dist < bestDist) {
          bestDist = dist;
          best = { rows, cols, region, solution, givens, rating, target, seed, tries, maxRegion: rows };
        }
        if (dist === 0 || Date.now() - t0 > budgetMs) return best;
      }
      if (onProgress) onProgress(tries, best ? best.rating.level : 0);
    }
  }

  const api = { TECH, LEVELS, makeGeometry, createRater, createSolver, generate, boxes };
  if (typeof self !== "undefined") self.SudokuEngine = api;
  return api;
}
