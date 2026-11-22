// Engine: geometry, regions, backtracking solver, technique rater and generator.
// Calling engineFactory() returns the API, and it is also put in self.SuguruEngine.

function engineFactory() {
  "use strict";
  const MAX_VALUE = 6; // the largest supported region size
  // Weighted distribution of the wanted region sizes for each max size
  const TARGET_SIZES = {
    4: [2, 3, 3, 4, 4, 4, 4],
    5: [2, 3, 3, 4, 4, 4, 5, 5, 5, 5],
    6: [2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6],
  };
  const TECH = [
    { level: 1, weight: 1, label: tr("Naked single"), desc: tr("The cell has only one possible number left.|suguru") },
    { level: 1, weight: 1, label: tr("Hidden single|suguru"), desc: tr("A number can only go in one place in its region.") },
    {
      level: 2,
      weight: 4,
      label: tr("Neighbour elimination"),
      desc: tr("Every possible place for a number in a region touches the same cell outside it. That cell cannot hold the number."),
    },
    {
      level: 3,
      weight: 8,
      label: tr("Naked pair"),
      desc: tr("Two cells that see each other have only two possible numbers between them. Cells that see both cannot hold them."),
    },
    {
      level: 3,
      weight: 10,
      label: tr("Hidden pair"),
      desc: tr("Two numbers in a region can only go in the same two cells. Those cells cannot hold any other number."),
    },
    { level: 4, weight: 15, label: tr("Naked triple"), desc: tr("Like a naked pair, but with three cells and three numbers.|suguru") },
    { level: 4, weight: 18, label: tr("Hidden triple"), desc: tr("Like a hidden pair, but with three numbers and three cells.|suguru") },
    {
      level: 5,
      weight: 20,
      label: tr("Single-number chain"),
      desc: tr("Follow one number: if x is not here, it must be there (two places in a region), and then x cannot be in the cells around it. Either the start or the end is x, so cells that see both cannot be x."),
    },
    {
      level: 6,
      weight: 22,
      label: tr("Bivalue chain"),
      desc: tr("A chain of cells with only two options: if the first cell is not a, the rest are forced until the last cell becomes a. Cells that see both ends cannot be a."),
    },
    {
      level: 7,
      weight: 24,
      label: tr("Mixed chain"),
      desc: tr("A chain that mixes both kinds of link: cells with two options and numbers with two places in a region."),
    },
    {
      level: 8,
      weight: 26,
      label: tr("Single-number what-if"),
      desc: tr("Assume a cell is x and follow only the number x: where can x go in the other regions? If a region has no room left for x, the assumption was wrong."),
    },
    {
      level: 9,
      weight: 30,
      label: tr("What-if with singles"),
      desc: tr("If the cell were v, simple moves with all numbers would lead to a contradiction. So it is not v."),
    },
    {
      level: 10,
      weight: 40,
      label: tr("Both ways"),
      desc: tr("A cell with two options (or a number with two places): try both ways with simple moves. If both give the same result, it is true."),
    },
    { level: 11, weight: 60, label: tr("What-if with techniques"), desc: tr("Like the what-if with singles, but the path to the contradiction needs harder techniques along the way, such as pairs or chains.") },
  ];
  const LEVELS = [
    "",
    tr("Easy"),
    tr("Medium"),
    tr("Hard"),
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
  const LIMIT = { limit: true };

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function popcount(x) {
    let c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  }
  function ctz(x) {
    return 31 - Math.clz32(x & -x);
  }

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

  function buildRegions(n, region) {
    const nr = Math.max(...region) + 1;
    const cells = Array.from({ length: nr }, () => []);
    for (let c = 0; c < n; c++) cells[region[c]].push(c);
    return cells;
  }

  // ------------------------------------------------------------- Regions
  function createRegionMaker(G, rand, maxRegion) {
    const SIZES = TARGET_SIZES[maxRegion] || TARGET_SIZES[5];
    const { rows, cols, n, ortho } = G;
    const rint = (k) => Math.floor(rand() * k);
    function shuffled() {
      const a = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = rint(i + 1);
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
      }
      return a;
    }
    function grow(reg, nextId) {
      for (const start of shuffled()) {
        if (reg[start] !== -1) continue;
        const target = SIZES[rint(SIZES.length)];
        const cells = [start];
        reg[start] = nextId;
        while (cells.length < target) {
          const frontier = [];
          for (const c of cells) for (const nb of ortho[c]) if (reg[nb] === -1) frontier.push(nb);
          if (!frontier.length) break;
          const pick = frontier[rint(frontier.length)];
          reg[pick] = nextId;
          cells.push(pick);
        }
        nextId++;
      }
      return nextId;
    }
    function sizes(reg, numIds) {
      const s = new Int32Array(numIds);
      for (const r of reg) s[r]++;
      return s;
    }
    function mergeSingletons(reg, numIds) {
      let changed = true;
      while (changed) {
        changed = false;
        const size = sizes(reg, numIds);
        for (const c of shuffled()) {
          if (size[reg[c]] !== 1) continue;
          let best = -1;
          for (const nb of ortho[c]) {
            const r = reg[nb];
            if (r !== reg[c] && size[r] < maxRegion && (best === -1 || size[r] < size[best])) best = r;
          }
          if (best !== -1) {
            size[reg[c]]--;
            reg[c] = best;
            size[best]++;
            changed = true;
          }
        }
      }
    }
    function windowSolvable(reg, size, r0, c0, h, w) {
      const cells = [];
      for (let i = 0; i < h * w; i++) cells.push((r0 + Math.floor(i / w)) * cols + c0 + (i % w));
      const vals = new Int32Array(cells.length);
      const rec = (i) => {
        if (i === cells.length) return true;
        const c = cells[i];
        for (let v = 1; v <= size[reg[c]]; v++) {
          let ok = true;
          for (let j = 0; j < i && ok; j++) {
            if (vals[j] !== v) continue;
            const o = cells[j];
            const touching = Math.abs(Math.floor(o / cols) - Math.floor(c / cols)) <= 1 && Math.abs((o % cols) - (c % cols)) <= 1;
            if (touching || reg[o] === reg[c]) ok = false;
          }
          if (ok) {
            vals[i] = v;
            if (rec(i + 1)) return true;
          }
        }
        vals[i] = 0;
        return false;
      };
      return rec(0);
    }
    function relabel(reg) {
      const map = new Map(),
        out = [];
      for (let c = 0; c < n; c++) {
        if (!map.has(reg[c])) map.set(reg[c], map.size);
        out.push(map.get(reg[c]));
      }
      return out;
    }
    // Make a partition and repair it locally: 2x2 blocks (Hall) and 3x3 windows solved in isolation.
    function generate() {
      const reg = new Int32Array(n).fill(-1);
      let nextId = grow(reg, 0);
      for (let iter = 0; iter < 10000; iter++) {
        mergeSingletons(reg, nextId);
        const dissolve = new Set();
        const size = sizes(reg, nextId);
        for (let r = 0; r + 1 < rows; r++)
          for (let c = 0; c + 1 < cols; c++) {
            const cs = [r * cols + c, r * cols + c + 1, (r + 1) * cols + c, (r + 1) * cols + c + 1];
            const s = cs.map((x) => size[reg[x]]).sort((a, b) => a - b);
            if (s.some((v, k) => v < k + 1)) cs.forEach((x) => dissolve.add(reg[x]));
          }
        if (!dissolve.size) {
          for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) {
              const h = Math.min(3, rows - r),
                w = Math.min(3, cols - c);
              if (h < 2 || w < 2) continue;
              if (!windowSolvable(reg, size, r, c, h, w))
                for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) dissolve.add(reg[(r + dr) * cols + c + dc]);
            }
        }
        if (!dissolve.size) return relabel(reg);
        for (let c = 0; c < n; c++) if (dissolve.has(reg[c])) reg[c] = -1;
        nextId = grow(reg, nextId);
      }
      return relabel(reg);
    }
    return { generate, shuffled };
  }

  // ------------------------------------------------------------- Backtracking solver (filling + uniqueness)
  function createSolver(G, region) {
    const { n, king } = G;
    const regionCells = buildRegions(n, region);
    const regionSize = new Int32Array(n),
      peers = [];
    for (let c = 0; c < n; c++) {
      regionSize[c] = regionCells[region[c]].length;
      const s = new Set(king[c]);
      for (const k of regionCells[region[c]]) if (k !== c) s.add(k);
      peers.push([...s]);
    }
    let nodes = 0,
      nodeLimit = 0,
      order = null,
      first = null;
    function place(dom, val, c, v) {
      const bit = 1 << v;
      if (!(dom[c] & bit)) return false;
      val[c] = v;
      dom[c] = bit;
      for (const p of peers[c])
        if (dom[p] & bit) {
          dom[p] &= ~bit;
          if (!dom[p]) return false;
        }
      return true;
    }
    function propagate(dom, val) {
      let changed = true;
      while (changed) {
        changed = false;
        for (let c = 0; c < n; c++) {
          if (val[c]) continue;
          const d = dom[c];
          if (!d) return false;
          if (!(d & (d - 1))) {
            if (!place(dom, val, c, ctz(d))) return false;
            changed = true;
          }
        }
        for (const cells of regionCells) {
          for (let v = 1; v <= cells.length; v++) {
            const bit = 1 << v;
            let count = 0,
              where = -1,
              placed = false;
            for (const c of cells) {
              if (val[c] === v) {
                placed = true;
                break;
              }
              if (!val[c] && dom[c] & bit) {
                count++;
                where = c;
              }
            }
            if (placed) continue;
            if (!count) return false;
            if (count === 1) {
              if (!place(dom, val, where, v)) return false;
              changed = true;
            }
          }
        }
      }
      return true;
    }
    function search(dom, val, limit) {
      if (++nodes > nodeLimit) throw LIMIT;
      if (!propagate(dom, val)) return 0;
      let best = -1,
        bestCount = 99;
      for (let c = 0; c < n; c++)
        if (!val[c]) {
          const k = popcount(dom[c]);
          if (k < bestCount) {
            best = c;
            bestCount = k;
          }
        }
      if (best === -1) {
        if (!first) first = Array.from(val);
        return 1;
      }
      const values = [];
      for (let v = 1; v <= MAX_VALUE; v++) if (dom[best] & (1 << v)) values.push(v);
      if (order)
        for (let i = values.length - 1; i > 0; i--) {
          const j = Math.floor(order() * (i + 1));
          [values[i], values[j]] = [values[j], values[i]];
        }
      let total = 0;
      for (const v of values) {
        const d2 = dom.slice(),
          v2 = val.slice();
        if (place(d2, v2, best, v)) {
          total += search(d2, v2, limit - total);
          if (total >= limit) return total;
        }
      }
      return total;
    }
    function count(givens, limit, nl, rnd) {
      nodes = 0;
      nodeLimit = nl;
      order = rnd || null;
      first = null;
      const dom = new Int32Array(n),
        val = new Int32Array(n);
      for (let c = 0; c < n; c++) dom[c] = (1 << (regionSize[c] + 1)) - 2;
      for (let c = 0; c < n; c++) if (givens[c] && !place(dom, val, c, givens[c])) return 0;
      try {
        return search(dom, val, limit);
      } catch (e) {
        if (e === LIMIT) return -1;
        throw e;
      }
    }
    return {
      count,
      randomSolution(rnd, limit) {
        return count(new Int32Array(n), 1, limit, rnd) === 1 ? first : null;
      },
      uniqueSolution(givens) {
        const k = count(givens, 2, 2000000, null);
        return { count: k, solution: k === 1 ? first : null };
      },
    };
  }

  // ------------------------------------------------------------- Human solver / difficulty rating
  function createRater(G, region) {
    const { n, cols } = G;
    const regionCells = buildRegions(n, region);
    const regionSize = new Int32Array(n),
      isPeer = new Uint8Array(n * n),
      peers = [];
    for (let c = 0; c < n; c++) {
      regionSize[c] = regionCells[region[c]].length;
      const r = Math.floor(c / cols),
        k = c % cols,
        p = [];
      for (let o = 0; o < n; o++) {
        if (o === c) continue;
        const touching = Math.abs(Math.floor(o / cols) - r) <= 1 && Math.abs((o % cols) - k) <= 1;
        if (touching || region[o] === region[c]) {
          isPeer[c * n + o] = 1;
          p.push(o);
        }
      }
      peers.push(p);
    }
    const P = (a, b) => isPeer[a * n + b] === 1;
    let lastUses = 0;

    function newState() {
      const cand = new Int32Array(n),
        val = new Int32Array(n);
      for (let c = 0; c < n; c++) cand[c] = (1 << (regionSize[c] + 1)) - 2;
      return { cand, val, broken: false };
    }
    const clone = (s) => ({ cand: s.cand.slice(), val: s.val.slice(), broken: s.broken });
    function isSolved(s) {
      for (let c = 0; c < n; c++) if (!s.val[c]) return false;
      return true;
    }
    function place(s, c, v) {
      const bit = 1 << v;
      if (!(s.cand[c] & bit)) {
        s.broken = true;
        return;
      }
      s.val[c] = v;
      s.cand[c] = bit;
      for (const p of peers[c])
        if (s.cand[p] & bit) {
          s.cand[p] &= ~bit;
          if (!s.cand[p]) s.broken = true;
        }
    }
    function eliminate(s, c, mask) {
      if (s.val[c] || !(s.cand[c] & mask)) return false;
      s.cand[c] &= ~mask;
      if (!s.cand[c]) s.broken = true;
      return true;
    }
    function nakedSingles(s) {
      let count = 0;
      for (let c = 0; c < n && !s.broken; c++)
        if (!s.val[c] && popcount(s.cand[c]) === 1) {
          place(s, c, ctz(s.cand[c]));
          count++;
        }
      return count;
    }
    function hiddenSingles(s) {
      let count = 0;
      for (const cells of regionCells) {
        for (let v = 1; v <= cells.length && !s.broken; v++) {
          const bit = 1 << v;
          let places = 0,
            where = -1,
            placed = false;
          for (const c of cells) {
            if (s.val[c] === v) {
              placed = true;
              break;
            }
            if (!s.val[c] && s.cand[c] & bit) {
              places++;
              where = c;
            }
          }
          if (placed) continue;
          if (!places) {
            s.broken = true;
            return Math.max(count, 1);
          }
          if (places === 1) {
            place(s, where, v);
            count++;
          }
        }
      }
      return count;
    }
    function neighborElimination(s) {
      for (const cells of regionCells) {
        for (let v = 1; v <= cells.length; v++) {
          const bit = 1 << v,
            spots = [];
          let placed = false;
          for (const c of cells) {
            if (s.val[c] === v) {
              placed = true;
              break;
            }
            if (!s.val[c] && s.cand[c] & bit) spots.push(c);
          }
          if (placed || spots.length < 2) continue;
          let progress = false;
          for (const x of peers[spots[0]]) {
            if (s.val[x] || !(s.cand[x] & bit) || spots.includes(x)) continue;
            if (spots.every((sp) => P(x, sp))) progress = eliminate(s, x, bit) || progress;
          }
          if (progress) return true;
        }
      }
      return false;
    }
    function nakedSubset(s, k) {
      const cs = [];
      for (let c = 0; c < n; c++) {
        const b = popcount(s.cand[c]);
        if (!s.val[c] && b >= 2 && b <= k) cs.push(c);
      }
      const chosen = new Array(k);
      const rec = (start, depth, mask) => {
        if (depth === k) {
          if (popcount(mask) !== k) return false;
          let progress = false;
          for (const p of peers[chosen[0]]) {
            let all = true;
            for (let i = 1; i < k; i++)
              if (!P(p, chosen[i])) {
                all = false;
                break;
              }
            if (all) progress = eliminate(s, p, mask) || progress;
          }
          return progress;
        }
        for (let i = start; i < cs.length; i++) {
          const c = cs[i],
            m2 = mask | s.cand[c];
          if (popcount(m2) > k) continue;
          let ok = true;
          for (let j = 0; j < depth; j++)
            if (!P(chosen[j], c)) {
              ok = false;
              break;
            }
          if (!ok) continue;
          chosen[depth] = c;
          if (rec(i + 1, depth + 1, m2)) return true;
        }
        return false;
      };
      return rec(0, 0, 0);
    }
    function hiddenSubset(s, k) {
      for (const cells of regionCells) {
        const full = (1 << (cells.length + 1)) - 2;
        let placedMask = 0;
        for (const c of cells) if (s.val[c]) placedMask |= 1 << s.val[c];
        const open = full & ~placedMask;
        if (popcount(open) <= k) continue;
        for (let m = open; m > 0; m = (m - 1) & open) {
          if (popcount(m) !== k) continue;
          let spots = 0;
          for (const c of cells) if (!s.val[c] && s.cand[c] & m) spots++;
          if (spots < k) {
            s.broken = true;
            return true;
          }
          if (spots > k) continue;
          let progress = false;
          for (const c of cells) if (!s.val[c] && s.cand[c] & m) progress = eliminate(s, c, ~m) || progress;
          if (progress) return true;
        }
      }
      return false;
    }
    // A chain of forced inferences with two kinds of strong links:
    //  - a cell with only two options: if it is not a, it is b
    //  - a number with only two places in a region: if it is not in x, it is in y
    // and weak links: if a cell is d, the cells that see it are not d, and the cell is no other number.
    // The chain starts and ends with a strong link, so either the first or the last candidate is true.
    // Candidates that contradict both ends can be crossed out.
    function chainElim(s, mode) {
      const key = (c, d) => c * 8 + d;
      const strong = new Map();
      const addS = (a, b) => {
        if (!strong.has(a)) strong.set(a, []);
        if (!strong.has(b)) strong.set(b, []);
        strong.get(a).push(b);
        strong.get(b).push(a);
      };
      if (mode !== "x")
        for (let c = 0; c < n; c++)
          if (!s.val[c] && popcount(s.cand[c]) === 2) {
            const lo = ctz(s.cand[c]),
              hi = ctz(s.cand[c] & ~(1 << lo));
            addS(key(c, lo), key(c, hi));
          }
      if (mode !== "xy")
        for (const cells of regionCells)
          for (let d = 1; d <= cells.length; d++) {
            if (cells.some((c) => s.val[c] === d)) continue;
            const sp = cells.filter((c) => !s.val[c] && s.cand[c] & (1 << d));
            if (sp.length === 2) addS(key(sp[0], d), key(sp[1], d));
          }
      if (strong.size < 4) return false;
      const sameCellOK = mode !== "x";
      const weak = (a, b) => {
        if (a === b) return false;
        const ca = a >> 3,
          cb = b >> 3;
        return ca === cb ? sameCellOK : (a & 7) === (b & 7) && P(ca, cb);
      };
      const weakNbrs = (k) => {
        const c = k >> 3,
          d = k & 7,
          out = [];
        if (sameCellOK) for (let e = 1; e <= MAX_VALUE; e++) if (e !== d && s.cand[c] & (1 << e)) out.push(key(c, e));
        for (const p of peers[c]) if (!s.val[p] && s.cand[p] & (1 << d)) out.push(key(p, d));
        return out;
      };
      const onPath = new Set();
      let budget = 20000,
        done = false;
      const tryEnd = (A, Y) => {
        let prog = false;
        for (const z of weakNbrs(A))
          if (!onPath.has(z) && weak(z, Y)) {
            eliminate(s, z >> 3, 1 << (z & 7));
            prog = true;
          }
        return prog;
      };
      const dfs = (A, Y, k) => {
        if (done || --budget < 0) return;
        if (k >= 2 && tryEnd(A, Y)) {
          done = true;
          return;
        }
        if (k >= 7) return;
        for (const W of weakNbrs(Y)) {
          if (onPath.has(W) || !strong.has(W)) continue;
          onPath.add(W);
          for (const Z of strong.get(W)) {
            if (onPath.has(Z)) continue;
            onPath.add(Z);
            dfs(A, Z, k + 1);
            onPath.delete(Z);
            if (done) return;
          }
          onPath.delete(W);
        }
      };
      for (const [A, list] of strong) {
        onPath.add(A);
        for (const B of list) {
          onPath.add(B);
          dfs(A, B, 1);
          onPath.delete(B);
          if (done) return true;
        }
        onPath.delete(A);
        if (budget < 0) break;
      }
      return done;
    }
    // Single-number what-if: assume cell c = x and follow only the number x (hidden single in the regions).
    // If a region that must have x has no room for x in the end, c is not x.
    function nishioFails(s, c0, x) {
      const has = new Uint8Array(n),
        placed = new Uint8Array(n);
      for (let c = 0; c < n; c++) has[c] = !s.val[c] && s.cand[c] & (1 << x) ? 1 : 0;
      const put = (c) => {
        placed[c] = 1;
        has[c] = 0;
        for (const p of peers[c]) has[p] = 0;
      };
      put(c0);
      let changed = true;
      while (changed) {
        changed = false;
        for (const cells of regionCells) {
          if (cells.length < x) continue;
          if (cells.some((c) => s.val[c] === x || placed[c])) continue;
          let spot = -1,
            cnt = 0;
          for (const c of cells)
            if (has[c]) {
              cnt++;
              spot = c;
            }
          if (cnt === 0) return true;
          if (cnt === 1) {
            put(spot);
            changed = true;
          }
        }
      }
      return false;
    }
    function nishio(s) {
      for (let size = 2; size <= MAX_VALUE; size++)
        for (let c = 0; c < n; c++) {
          if (s.val[c] || popcount(s.cand[c]) !== size) continue;
          for (let x = 1; x <= MAX_VALUE; x++) {
            if (!(s.cand[c] & (1 << x))) continue;
            if (nishioFails(s, c, x)) {
              eliminate(s, c, 1 << x);
              return true;
            }
          }
        }
      return false;
    }
    // Both ways: a cell with two options, or a number with two places in a region.
    // Follow both options with simple moves; whatever both ways remove can be removed.
    function singlesOnly(t) {
      while (!t.broken && !isSolved(t)) {
        if (nakedSingles(t) > 0) continue;
        if (hiddenSingles(t) > 0) continue;
        break;
      }
    }
    function bothWays(s) {
      const roots = [];
      for (let c = 0; c < n; c++)
        if (!s.val[c] && popcount(s.cand[c]) === 2) {
          const lo = ctz(s.cand[c]),
            hi = ctz(s.cand[c] & ~(1 << lo));
          roots.push([
            [c, lo],
            [c, hi],
          ]);
        }
      for (const cells of regionCells)
        for (let d = 1; d <= cells.length; d++) {
          if (cells.some((c) => s.val[c] === d)) continue;
          const sp = cells.filter((c) => !s.val[c] && s.cand[c] & (1 << d));
          if (sp.length === 2)
            roots.push([
              [sp[0], d],
              [sp[1], d],
            ]);
        }
      for (const [[c1, v1], [c2, v2]] of roots) {
        const A = clone(s);
        place(A, c1, v1);
        singlesOnly(A);
        if (A.broken) continue;
        const B = clone(s);
        place(B, c2, v2);
        singlesOnly(B);
        if (B.broken) continue;
        let prog = false;
        for (let c = 0; c < n; c++) {
          if (s.val[c]) continue;
          const gone = s.cand[c] & ~A.cand[c] & ~B.cand[c];
          if (gone) {
            eliminate(s, c, gone);
            prog = true;
          }
        }
        if (prog) return true;
      }
      return false;
    }
    function contradiction(s, innerLevel) {
      for (let size = 2; size <= MAX_VALUE; size++) {
        for (let c = 0; c < n; c++) {
          if (s.val[c] || popcount(s.cand[c]) !== size) continue;
          for (let v = 1; v <= MAX_VALUE; v++) {
            if (!(s.cand[c] & (1 << v))) continue;
            const t = clone(s);
            place(t, c, v);
            while (!t.broken && !isSolved(t)) if (step(t, innerLevel) < 0) break;
            if (t.broken) {
              eliminate(s, c, 1 << v);
              return true;
            }
          }
        }
      }
      return false;
    }
    function step(s, maxLevel) {
      let u;
      if ((u = nakedSingles(s)) > 0) {
        lastUses = u;
        return 0;
      }
      if ((u = hiddenSingles(s)) > 0) {
        lastUses = u;
        return 1;
      }
      if (maxLevel >= 2 && neighborElimination(s)) {
        lastUses = 1;
        return 2;
      }
      if (maxLevel >= 3 && nakedSubset(s, 2)) {
        lastUses = 1;
        return 3;
      }
      if (maxLevel >= 3 && hiddenSubset(s, 2)) {
        lastUses = 1;
        return 4;
      }
      if (maxLevel >= 4 && nakedSubset(s, 3)) {
        lastUses = 1;
        return 5;
      }
      if (maxLevel >= 4 && hiddenSubset(s, 3)) {
        lastUses = 1;
        return 6;
      }
      if (maxLevel >= 5 && chainElim(s, "x")) {
        lastUses = 1;
        return 7;
      }
      if (maxLevel >= 6 && chainElim(s, "xy")) {
        lastUses = 1;
        return 8;
      }
      if (maxLevel >= 7 && chainElim(s, "all")) {
        lastUses = 1;
        return 9;
      }
      if (maxLevel >= 8 && nishio(s)) {
        lastUses = 1;
        return 10;
      }
      if (maxLevel >= 9 && contradiction(s, 1)) {
        lastUses = 1;
        return 11;
      }
      if (maxLevel >= 10 && bothWays(s)) {
        lastUses = 1;
        return 12;
      }
      if (maxLevel >= 11 && contradiction(s, 8)) {
        lastUses = 1;
        return 13;
      }
      return -1;
    }
    function rate(givens, maxLevel = 11) {
      const s = newState();
      for (let c = 0; c < n; c++) if (givens[c]) place(s, c, givens[c]);
      const uses = new Array(TECH.length).fill(0);
      let score = 0,
        hardest = 1;
      while (!s.broken && !isSolved(s)) {
        const t = step(s, maxLevel);
        if (t < 0) break;
        uses[t] += lastUses;
        score += TECH[t].weight * lastUses;
        hardest = Math.max(hardest, TECH[t].level);
      }
      const solved = !s.broken && isSolved(s);
      return { level: solved ? hardest : 12, score, solved, uses };
    }
    // The next number a human solver can find from the current position + which techniques it took.
    function nextPlacement(known) {
      const s = newState();
      for (let c = 0; c < n; c++) if (known[c]) place(s, c, known[c]);
      if (s.broken) return null;
      const before = Array.from(s.val);
      const used = new Set();
      let hardest = 0;
      while (!s.broken && !isSolved(s)) {
        const t = step(s, 11);
        if (t < 0) return null;
        used.add(t);
        hardest = Math.max(hardest, TECH[t].level);
        for (let c = 0; c < n; c++) if (!before[c] && s.val[c]) return { cell: c, value: s.val[c], used: [...used], hardest };
      }
      return null;
    }
    return { rate, nextPlacement };
  }

  // ------------------------------------------------------------- Generation towards a target level
  function generate(rows, cols, target, seed, budgetMs, onProgress, maxRegion = 5) {
    const t0 = Date.now();
    const G = makeGeometry(rows, cols);
    const rand = mulberry32(seed >>> 0);
    const maker = createRegionMaker(G, rand, maxRegion);
    let best = null,
      bestDist = Infinity,
      tries = 0;
    while (true) {
      let region, solver, solution;
      do {
        region = maker.generate();
        solver = createSolver(G, region);
        solution = solver.randomSolution(rand, 5000);
      } while (!solution);
      const rater = createRater(G, region);
      for (let o = 0; o < 4; o++) {
        tries++;
        const givens = solution.slice();
        for (const c of maker.shuffled()) {
          const saved = givens[c];
          givens[c] = 0;
          if (!rater.rate(givens, target).solved) givens[c] = saved;
        }
        const rating = rater.rate(givens, 11);
        const dist = Math.abs(rating.level - target);
        if (dist < bestDist) {
          bestDist = dist;
          best = { rows, cols, region, solution, givens, rating, target, seed, tries, maxRegion };
        }
        if (dist === 0 || Date.now() - t0 > budgetMs) return best;
      }
      if (onProgress) onProgress(tries, best ? best.rating.level : 0);
    }
  }

  const api = { TECH, LEVELS, makeGeometry, createRater, createSolver, generate };
  if (typeof self !== "undefined") self.SuguruEngine = api;
  return api;
}
