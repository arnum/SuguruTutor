// Tutor: finds the easiest next number with an explanation (hints), and rates single moves (route analysis).

// Finds the easiest next number from a position and explains the way there step by step.
function createTutor(G, region) {
  const { n, cols } = G;
  const TECH_NAMES = TECH_LABELS; // the game's names for the 14 techniques (the game's game.js)
  const TECH_LEVEL = [1, 1, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11];
  const TECH_WEIGHT = [1, 1, 4, 8, 10, 15, 18, 20, 22, 24, 26, 30, 40, 60];
  const isChain = (t) => t >= 7 && t <= 9;
  const CHAIN_MODE = { 7: "x", 8: "xy", 9: "all" };
  // The game's rules come from the game's model (boardModel in the game's game.js): houses (RC: regions, or rows,
  // columns and boxes), which houses a cell lies in, the largest number per cell, and cells that may not have the same number.
  const MODEL = boardModel(G, region);
  const { RC, unitsOf, size, peers } = MODEL;
  const KING = !!MODEL.king; // Suguru: equal numbers may not touch (affects the texts)
  const nr = RC.length;
  const peerM = new Uint8Array(n * n);
  peers.forEach((p, a) => p.forEach((b) => (peerM[a * n + b] = 1)));
  const touch = MODEL.touch || (() => false);
  const peer = (a, b) => peerM[a * n + b] === 1;
  // the houses two cells have in common
  const common = (a, b) => unitsOf[a].filter((u) => unitsOf[b].includes(u));
  const pc = (x) => {
    let c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  };
  const ctz = (x) => 31 - Math.clz32(x & -x);
  const bitsOf = (m) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => m & (1 << v));

  // ---------- state
  function fresh() {
    return { cand: size.map((s) => (1 << (s + 1)) - 2), val: new Array(n).fill(0), broken: null };
  }
  const clone = (s) => ({ cand: s.cand.slice(), val: s.val.slice(), broken: s.broken });
  const solved = (s) => s.val.every((v) => v);
  function place(s, c, v) {
    const bit = 1 << v;
    if (!(s.cand[c] & bit)) {
      s.broken = s.broken || { kind: "cell", cell: c };
      return;
    }
    s.val[c] = v;
    s.cand[c] = bit;
    for (const p of peers[c])
      if (s.cand[p] & bit) {
        s.cand[p] &= ~bit;
        if (!s.cand[p]) s.broken = s.broken || { kind: "cell", cell: p };
      }
  }
  function elim(s, c, m) {
    if (s.val[c] || !(s.cand[c] & m)) return 0;
    const r = s.cand[c] & m;
    s.cand[c] &= ~m;
    if (!s.cand[c]) s.broken = s.broken || { kind: "cell", cell: c };
    return r;
  }
  function fromKnown(known) {
    const s = fresh();
    known.forEach((v, c) => {
      if (v) place(s, c, v);
    });
    return s;
  }
  const apply = (s, a) => {
    for (const t of a.targets) elim(s, t.cell, t.mask);
  };

  // ---------- singles (all), with a simple human difficulty score
  function singles(s) {
    const best = new Map();
    const add = (x) => {
      const o = best.get(x.cell);
      if (!o || x.score < o.score) best.set(x.cell, x);
    };
    for (let r = 0; r < nr; r++) {
      const cells = RC[r],
        empty = cells.filter((c) => !s.val[c]);
      if (!empty.length) continue;
      let placed = 0;
      for (const c of cells) if (s.val[c]) placed |= 1 << s.val[c];
      const missing = bitsOf(((1 << (cells.length + 1)) - 2) & ~placed);
      if (empty.length === 1 && missing.length === 1 && s.cand[empty[0]] & (1 << missing[0]))
        add({ kind: "last", cell: empty[0], v: missing[0], region: r, score: 0 });
      for (const v of missing) {
        const spots = empty.filter((c) => s.cand[c] & (1 << v));
        // one house can be easier to scan than another (Sudoku: a box easier than a row or column)
        if (spots.length === 1) add({ kind: "hidden", cell: spots[0], v, region: r, score: 1 + cells.length / 10 + (MODEL.unitCost ? MODEL.unitCost(r) : 0) });
      }
    }
    for (let c = 0; c < n; c++)
      if (!s.val[c] && pc(s.cand[c]) === 1)
        add({ kind: "naked", cell: c, v: ctz(s.cand[c]), region: unitsOf[c][0], score: 1.5 + size[c] / 10 });
    return [...best.values()].sort((a, b) => a.score - b.score || a.cell - b.cell);
  }
  function singleHolds(s, cell, v) {
    if (s.val[cell]) return null;
    for (const r of unitsOf[cell]) {
      const empty = RC[r].filter((c) => !s.val[c]);
      if (empty.length === 1 && empty[0] === cell && s.cand[cell] & (1 << v)) return "last";
    }
    for (const r of unitsOf[cell]) {
      const spots = RC[r].filter((c) => !s.val[c] && s.cand[c] & (1 << v));
      if (spots.length === 1 && spots[0] === cell && !RC[r].some((c) => s.val[c] === v)) return "hidden";
    }
    if (s.cand[cell] === 1 << v) return "naked";
    return null;
  }
  // The house that makes a single visible: where the cell is the only empty one ("last"), or where the number has only one place
  // ("hidden"). For "naked" the first of the cell's houses.
  function holdUnit(s, cell, v, kind) {
    for (const r of unitsOf[cell]) {
      const empty = RC[r].filter((c) => !s.val[c]);
      if (kind === "last" && empty.length === 1 && empty[0] === cell) return r;
      if (kind === "hidden" && !RC[r].some((c) => s.val[c] === v) && empty.filter((c) => s.cand[c] & (1 << v)).length === 1) return r;
    }
    return unitsOf[cell][0];
  }

  // ---------- applications of techniques (all, or only the first)
  // all: also patterns that remove nothing (the practice drills accept every real pattern; grading never asks for these)
  function neighborApps(s, first, all) {
    const out = [];
    for (let r = 0; r < nr; r++) {
      const cells = RC[r];
      for (let v = 1; v <= cells.length; v++) {
        if (cells.some((c) => s.val[c] === v)) continue;
        const bit = 1 << v,
          spots = cells.filter((c) => !s.val[c] && s.cand[c] & bit);
        if (spots.length < 2) continue;
        const targets = [];
        for (const x of peers[spots[0]]) {
          if (s.val[x] || !(s.cand[x] & bit) || spots.includes(x)) continue;
          if (spots.every((sp) => peer(x, sp))) targets.push({ cell: x, mask: bit });
        }
        if (targets.length || (all && seenByOne(spots, r))) {
          out.push({ tech: 2, region: r, v, spots, targets });
          if (first) return out;
        }
      }
    }
    return out;
  }
  // the places all see one cell outside their house (the pattern exists even if that cell has nothing to lose)
  const seenByOne = (spots, r) => peers[spots[0]].some((x) => !RC[r].includes(x) && spots.every((sp) => peer(x, sp)));
  function nakedApps(s, k, first, all) {
    const out = [],
      cs = [];
    for (let c = 0; c < n; c++) {
      const b = pc(s.cand[c]);
      if (!s.val[c] && b >= 2 && b <= k) cs.push(c);
    }
    const ch = [];
    const rec = (st, d, m) => {
      if (d === k) {
        if (pc(m) !== k) return false;
        const targets = [];
        for (const p of peers[ch[0]]) {
          if (s.val[p] || ch.includes(p) || !(s.cand[p] & m)) continue;
          if (ch.every((q) => peer(p, q))) targets.push({ cell: p, mask: s.cand[p] & m });
        }
        if (targets.length || all) {
          out.push({ tech: k === 2 ? 3 : 5, cells: ch.slice(), mask: m, targets });
          return first;
        }
        return false;
      }
      for (let i = st; i < cs.length; i++) {
        const c = cs[i],
          m2 = m | s.cand[c];
        if (pc(m2) > k) continue;
        let ok = true;
        for (let j = 0; j < d; j++)
          if (!peer(ch[j], c)) {
            ok = false;
            break;
          }
        if (!ok) continue;
        ch[d] = c;
        if (rec(i + 1, d + 1, m2)) return true;
      }
      return false;
    };
    rec(0, 0, 0);
    return out;
  }
  function hiddenApps(s, k, first, all) {
    const out = [];
    for (let r = 0; r < nr; r++) {
      const cells = RC[r];
      let placed = 0;
      for (const c of cells) if (s.val[c]) placed |= 1 << s.val[c];
      const open = ((1 << (cells.length + 1)) - 2) & ~placed;
      if (pc(open) < k || (pc(open) === k && !all)) continue;
      for (let m = open; m > 0; m = (m - 1) & open) {
        if (pc(m) !== k) continue;
        const spots = cells.filter((c) => !s.val[c] && s.cand[c] & m);
        if (spots.length !== k) continue;
        const targets = [];
        for (const c of spots) {
          const extra = s.cand[c] & ~m;
          if (extra) targets.push({ cell: c, mask: extra });
        }
        if (targets.length || all) {
          out.push({ tech: k === 2 ? 4 : 6, region: r, mask: m, cells: spots, targets });
          if (first) return out;
        }
      }
    }
    return out;
  }
  // Chain: strong links (a cell with two options / a number with two places in a region) alternating with weak links.
  // The shortest possible chains are found first (iterative deepening).
  function strongLinks(s, mode = "all") {
    const strong = new Map();
    const addS = (a, b) => {
      if (!strong.has(a)) strong.set(a, []);
      if (!strong.has(b)) strong.set(b, []);
      strong.get(a).push(b);
      strong.get(b).push(a);
    };
    if (mode !== "x")
      for (let c = 0; c < n; c++)
        if (!s.val[c] && pc(s.cand[c]) === 2) {
          const [lo, hi] = bitsOf(s.cand[c]);
          addS(c * 16 + lo, c * 16 + hi);
        }
    if (mode !== "xy")
      for (let r = 0; r < nr; r++) {
        const cells = RC[r];
        for (let d = 1; d <= cells.length; d++) {
          if (cells.some((c) => s.val[c] === d)) continue;
          const sp = cells.filter((c) => !s.val[c] && s.cand[c] & (1 << d));
          if (sp.length === 2) addS(sp[0] * 16 + d, sp[1] * 16 + d);
        }
      }
    return strong;
  }
  const weakLink = (a, b, mode = "all") =>
    a !== b && ((a >> 4 === b >> 4 && mode !== "x") || ((a & 15) === (b & 15) && peer(a >> 4, b >> 4)));
  function weakNbrs(s, k, mode = "all") {
    const c = k >> 4,
      d = k & 15,
      out = [];
    if (mode !== "x") for (const e of bitsOf(s.cand[c])) if (e !== d) out.push(c * 16 + e);
    for (const p of peers[c]) if (!s.val[p] && s.cand[p] & (1 << d)) out.push(p * 16 + d);
    return out;
  }
  function groupTargets(keys) {
    const m = new Map();
    for (const z of keys) m.set(z >> 4, (m.get(z >> 4) || 0) | (1 << (z & 15)));
    return [...m].map(([cell, mask]) => ({ cell, mask }));
  }
  function chainApps(s, first, mode = "all") {
    const tech = mode === "x" ? 7 : mode === "xy" ? 8 : 9;
    const strong = strongLinks(s, mode);
    if (strong.size < 4) return [];
    const out = [],
      seen = new Set();
    for (let maxK = 2; maxK <= 7; maxK++) {
      let budget = 20000;
      const path = [],
        onPath = new Set();
      const dfs = (A, Y, k) => {
        if (--budget < 0) return false;
        if (k === maxK) {
          const zs = weakNbrs(s, A, mode).filter((z) => !onPath.has(z) && weakLink(z, Y, mode));
          if (zs.length) {
            const targets = groupTargets(zs);
            const sig = targets
              .map((t) => t.cell + ":" + t.mask)
              .sort()
              .join("|");
            if (!seen.has(sig)) {
              seen.add(sig);
              out.push({ tech, nodes: path.slice(), cells: [...new Set(path.map((x) => x >> 4))], targets, relCount: k, memPeak: 2 });
              if (first) return true;
            }
          }
          return false;
        }
        for (const W of weakNbrs(s, Y, mode)) {
          if (onPath.has(W) || !strong.has(W)) continue;
          onPath.add(W);
          path.push(W);
          for (const Z of strong.get(W)) {
            if (onPath.has(Z)) continue;
            onPath.add(Z);
            path.push(Z);
            if (dfs(A, Z, k + 1)) return true;
            onPath.delete(Z);
            path.pop();
          }
          onPath.delete(W);
          path.pop();
        }
        return false;
      };
      for (const [A, list] of strong) {
        for (const B of list) {
          path.length = 0;
          onPath.clear();
          path.push(A, B);
          onPath.add(A);
          onPath.add(B);
          if (dfs(A, B, 1)) return out;
        }
        if (budget < 0) break;
      }
      if (out.length) return out;
    }
    return out;
  }

  // Working memory: how many facts are "alive" (needed later) at the same time.
  // Like register allocation in a compiler: a fact lives from when it is found until it is last used.
  // The assumption (node 0) must be remembered all the way to the conclusion.
  function peakLive(nodes, rel, rootDeps) {
    const ids = [...rel].sort((a, b) => a - b),
      END = 1e9,
      last = new Map();
    for (const i of ids) last.set(i, -1);
    for (const j of ids) for (const d of nodes[j].deps) if (last.has(d)) last.set(d, Math.max(last.get(d), j));
    for (const d of rootDeps) if (last.has(d)) last.set(d, END);
    if (last.has(0)) last.set(0, END);
    let peak = 0;
    for (const t of [...ids, END]) {
      let live = 0;
      for (const i of ids) if (i < t && last.get(i) >= t) live++;
      if (live > peak) peak = live;
    }
    return peak;
  }

  // Single-number what-if: assume c0 = x and follow only the number x via "hidden single" in the regions.
  function nishioRun(s, c0, x) {
    const has = new Uint8Array(n),
      placedBy = new Map(),
      removedBy = new Map();
    for (let c = 0; c < n; c++) has[c] = !s.val[c] && s.cand[c] & (1 << x) ? 1 : 0;
    const nodes = [{ deps: new Set() }],
      chain = [];
    const put = (c, id) => {
      placedBy.set(c, id);
      has[c] = 0;
      for (const p of peers[c])
        if (has[p]) {
          has[p] = 0;
          removedBy.set(p, id);
        }
    };
    put(c0, 0);
    let broken = null,
      changed = true;
    while (changed && !broken) {
      changed = false;
      for (let r = 0; r < nr && !broken; r++) {
        const cells = RC[r];
        if (cells.length < x || cells.some((c) => s.val[c] === x || placedBy.has(c))) continue;
        const spots = cells.filter((c) => has[c]);
        if (spots.length > 1) continue;
        const deps = new Set();
        for (const c of cells) if (!s.val[c] && s.cand[c] & (1 << x) && removedBy.has(c)) deps.add(removedBy.get(c));
        if (!spots.length) {
          broken = { kind: "region", region: r, v: x };
          nodes.push({ deps });
          break;
        }
        const id = nodes.length;
        nodes.push({ deps });
        chain.push({ kind: "place", single: { kind: "hidden", cell: spots[0], v: x, region: r } });
        put(spots[0], id);
        changed = true;
      }
    }
    if (!broken) return null;
    const rel = new Set(),
      stack = [nodes.length - 1];
    while (stack.length) {
      const k = stack.pop();
      if (rel.has(k)) continue;
      rel.add(k);
      for (const d of nodes[k].deps) stack.push(d);
    }
    chain.forEach((st, i) => {
      st.rel = rel.has(i + 1);
    });
    const brokenId = nodes.length - 1,
      relN = new Set([...rel].filter((k) => k !== brokenId));
    relN.add(0);
    return { chain, broken, relCount: chain.filter((st) => st.rel).length, memPeak: peakLive(nodes, relN, nodes[brokenId].deps) };
  }
  function nishioApps(s, first) {
    const out = [];
    for (let sz = 2; sz <= 6; sz++)
      for (let c = 0; c < n; c++) {
        if (s.val[c] || pc(s.cand[c]) !== sz) continue;
        for (const x of bitsOf(s.cand[c])) {
          const r = nishioRun(s, c, x);
          if (r) {
            out.push({
              tech: 10,
              cell: c,
              v: x,
              cells: [c],
              chain: r.chain,
              broken: r.broken,
              relCount: r.relCount,
              memPeak: r.memPeak,
              targets: [{ cell: c, mask: 1 << x }],
            });
            if (first) return out;
          }
        }
      }
    return out;
  }

  // Both ways: follow both options (a cell with two options / a number with two places) with simple moves
  // and trace which steps lead to the common result.
  function runBranch(s, c0, v0) {
    const t = clone(s),
      removedBy = new Map(),
      placedBy = new Map();
    const record = (b, after, node) => {
      for (let c = 0; c < n; c++) {
        if (after.val[c] && !b.val[c]) placedBy.set(c, node);
        for (const d of bitsOf(b.cand[c] & ~after.cand[c])) if (!removedBy.has(c * 16 + d)) removedBy.set(c * 16 + d, node);
      }
    };
    const depsOfCell = (q, b, out) => {
      if (placedBy.has(q)) out.add(placedBy.get(q));
      for (const d of bitsOf(s.cand[q] & ~b.cand[q])) {
        const x = removedBy.get(q * 16 + d);
        if (x !== undefined) out.add(x);
      }
    };
    const nodes = [{ deps: new Set() }],
      chain = [];
    let b = clone(t);
    place(t, c0, v0);
    record(b, t, 0);
    let guard = 0;
    while (!t.broken && !solved(t) && guard++ < 400) {
      const sg = singles(t);
      if (!sg.length) break;
      const x = sg[0],
        deps = new Set();
      b = clone(t);
      if (x.kind === "naked") depsOfCell(x.cell, b, deps);
      else
        for (const o of RC[x.region])
          if (o !== x.cell && !s.val[o] && (x.kind === "last" || s.cand[o] & (1 << x.v))) {
            if (placedBy.has(o)) deps.add(placedBy.get(o));
            else {
              const y = removedBy.get(o * 16 + x.v);
              if (y !== undefined) deps.add(y);
            }
          }
      place(t, x.cell, x.v);
      nodes.push({ deps });
      chain.push({ kind: "place", single: x });
      record(b, t, nodes.length - 1);
    }
    if (t.broken) return null;
    // relevant steps for a goal (cell g loses mask m)
    const relFor = (g, m) => {
      const root = new Set();
      if (placedBy.has(g)) root.add(placedBy.get(g));
      for (const d of bitsOf(m)) {
        const x = removedBy.get(g * 16 + d);
        if (x !== undefined) root.add(x);
      }
      const rel = new Set([0]),
        st = [...root];
      while (st.length) {
        const k = st.pop();
        if (rel.has(k)) continue;
        rel.add(k);
        for (const y of nodes[k].deps) st.push(y);
      }
      return chain.map((_, i) => rel.has(i + 1));
    };
    const peakFor = (g, m) => {
      const root = new Set();
      if (placedBy.has(g)) root.add(placedBy.get(g));
      for (const d of bitsOf(m)) {
        const x = removedBy.get(g * 16 + d);
        if (x !== undefined) root.add(x);
      }
      const rel = new Set([0]),
        st = [...root];
      while (st.length) {
        const k = st.pop();
        if (rel.has(k)) continue;
        rel.add(k);
        for (const y of nodes[k].deps) st.push(y);
      }
      return peakLive(nodes, rel, root);
    };
    return { t, chain, relFor, peakFor };
  }
  function bothWaysApps(s, first) {
    const roots = [];
    for (let c = 0; c < n; c++)
      if (!s.val[c] && pc(s.cand[c]) === 2) {
        const [lo, hi] = bitsOf(s.cand[c]);
        roots.push({ kind: "cell", a: [c, lo], b: [c, hi] });
      }
    for (let r = 0; r < nr; r++) {
      const cells = RC[r];
      for (let d = 1; d <= cells.length; d++) {
        if (cells.some((c) => s.val[c] === d)) continue;
        const sp = cells.filter((c) => !s.val[c] && s.cand[c] & (1 << d));
        if (sp.length === 2) roots.push({ kind: "region", region: r, a: [sp[0], d], b: [sp[1], d] });
      }
    }
    const out = [];
    for (const root of roots) {
      const A = runBranch(s, root.a[0], root.a[1]);
      if (!A) continue;
      const B = runBranch(s, root.b[0], root.b[1]);
      if (!B) continue;
      for (let g = 0; g < n; g++) {
        if (s.val[g]) continue;
        const gone = s.cand[g] & ~A.t.cand[g] & ~B.t.cand[g];
        if (!gone) continue;
        const relA = A.relFor(g, gone),
          relB = B.relFor(g, gone);
        const chainA = A.chain.map((st, i) => ({ ...st, rel: relA[i] })),
          chainB = B.chain.map((st, i) => ({ ...st, rel: relB[i] }));
        out.push({
          tech: 12,
          root,
          goal: g,
          cells: root.a[0] === root.b[0] ? [root.a[0]] : [root.a[0], root.b[0]],
          branches: [
            { start: root.a, chain: chainA, val: A.t.val[g] },
            { start: root.b, chain: chainB, val: B.t.val[g] },
          ],
          targets: [{ cell: g, mask: gone }],
          relCount: relA.filter(Boolean).length + relB.filter(Boolean).length,
          memPeak: Math.max(A.peakFor(g, gone), B.peakFor(g, gone) + 1),
        });
        if (first) return out;
      }
    }
    return out;
  }

  // One step in a what-if chain (simplest first), with details for the explanation
  function chainStep(s, maxLevel, early) {
    // What-if with techniques: if a pair, a triple or a neighbour elimination gives a contradiction straight away (a cell without
    // options), it is taken first. Then the short reasoning is found, not only the one the singles lead to. Only in the
    // first steps (early): that is where the short reasoning is.
    if (maxLevel >= 2 && early) {
      const quick = [() => neighborApps(s, false)];
      if (maxLevel >= 3)
        quick.push(
          () => nakedApps(s, 2, false),
          () => hiddenApps(s, 2, false),
        );
      if (maxLevel >= 4)
        quick.push(
          () => nakedApps(s, 3, false),
          () => hiddenApps(s, 3, false),
        );
      for (const f of quick)
        for (const a of f()) {
          const T = clone(s);
          apply(T, a);
          if (T.broken) {
            apply(s, a);
            return { kind: "elim", app: a };
          }
        }
    }
    const sg = singles(s);
    if (sg.length) {
      const x = sg[0];
      place(s, x.cell, x.v);
      return { kind: "place", single: x };
    }
    // empty region places are a contradiction
    for (let r = 0; r < nr; r++) {
      const cells = RC[r];
      for (let v = 1; v <= cells.length; v++) {
        if (cells.some((c) => s.val[c] === v)) continue;
        if (!cells.some((c) => !s.val[c] && s.cand[c] & (1 << v))) {
          s.broken = s.broken || { kind: "region", region: r, v };
          return { kind: "stop" };
        }
      }
    }
    const tries = [];
    if (maxLevel >= 2) tries.push(() => neighborApps(s, true));
    if (maxLevel >= 3)
      tries.push(
        () => nakedApps(s, 2, true),
        () => hiddenApps(s, 2, true),
      );
    if (maxLevel >= 4)
      tries.push(
        () => nakedApps(s, 3, true),
        () => hiddenApps(s, 3, true),
      );
    if (maxLevel >= 5) tries.push(() => chainApps(s, true, "x"));
    if (maxLevel >= 6) tries.push(() => chainApps(s, true, "xy"));
    if (maxLevel >= 7) tries.push(() => chainApps(s, true, "all"));
    if (maxLevel >= 8) tries.push(() => nishioApps(s, true));
    for (const f of tries) {
      const a = f();
      if (a.length) {
        apply(s, a[0]);
        return { kind: "elim", app: a[0] };
      }
    }
    return null;
  }
  // What-if with tracing: each step in the chain gets a list of the earlier steps it builds on.
  // Afterwards it is traced backwards from the contradiction, so only the steps that actually carry the argument are counted.
  function runTrial(s, cell, v, inner, maxSteps = 400) {
    const t = clone(s);
    const removedBy = new Map(),
      placedBy = new Map();
    const key = (c, d) => c * 16 + d;
    const record = (b, after, node) => {
      for (let c = 0; c < n; c++) {
        if (after.val[c] && !b.val[c]) placedBy.set(c, node);
        const gone = b.cand[c] & ~after.cand[c];
        for (const d of bitsOf(gone)) if (!removedBy.has(key(c, d))) removedBy.set(key(c, d), node);
      }
    };
    const depsOfCell = (q, b, out) => {
      if (placedBy.has(q)) out.add(placedBy.get(q));
      for (const d of bitsOf(s.cand[q] & ~b.cand[q])) {
        const x = removedBy.get(key(q, d));
        if (x !== undefined) out.add(x);
      }
    };
    const nodes = [{ deps: new Set() }]; // node 0 = the assumption
    let b = clone(t);
    place(t, cell, v);
    record(b, t, 0);
    const chain = [];
    let guard = 0;
    while (!t.broken && !solved(t) && guard++ < maxSteps) {
      b = clone(t);
      const st = chainStep(t, inner, guard <= 3);
      if (!st) break;
      if (st.kind === "stop") break;
      const id = nodes.length,
        deps = new Set();
      if (st.kind === "place") {
        const x = st.single,
          r = x.region;
        if (x.kind === "naked") depsOfCell(x.cell, b, deps);
        else
          for (const o of RC[r])
            if (o !== x.cell && !s.val[o] && (x.kind === "last" || s.cand[o] & (1 << x.v))) {
              if (placedBy.has(o)) deps.add(placedBy.get(o));
              else {
                const y = removedBy.get(key(o, x.v));
                if (y !== undefined) deps.add(y);
              }
            }
      } else {
        const a = st.app;
        const cells = new Set(a.tech === 2 ? a.spots : a.cells);
        if (a.region !== undefined) RC[a.region].forEach((c) => cells.add(c));
        for (const q of cells) depsOfCell(q, b, deps);
      }
      nodes.push({ deps });
      chain.push(st);
      record(b, t, id);
    }
    if (!t.broken) return null;
    // the contradiction's dependencies
    const br = t.broken,
      root = new Set();
    if (br.kind === "cell") depsOfCell(br.cell, t, root);
    else {
      const r = br.region;
      for (const o of RC[r]) depsOfCell(o, t, root);
    }
    const rel = new Set([0]),
      stack = [...root];
    while (stack.length) {
      const x = stack.pop();
      if (rel.has(x)) continue;
      rel.add(x);
      for (const y of nodes[x].deps) stack.push(y);
    }
    chain.forEach((st, i) => {
      st.rel = rel.has(i + 1);
    });
    return { chain, broken: t.broken, relCount: rel.size - 1, memPeak: peakLive(nodes, rel, root) };
  }
  function trialApps(s, inner, first, maxSteps = 400) {
    const out = [];
    for (let sz = 2; sz <= 5; sz++)
      for (let c = 0; c < n; c++) {
        if (s.val[c] || pc(s.cand[c]) !== sz) continue;
        for (const v of bitsOf(s.cand[c])) {
          const r = runTrial(s, c, v, inner, maxSteps);
          if (r) {
            out.push({
              tech: inner === 1 ? 11 : 13,
              cell: c,
              v,
              chain: r.chain,
              broken: r.broken,
              relCount: r.relCount,
              memPeak: r.memPeak,
              targets: [{ cell: c, mask: 1 << v }],
            });
            if (first) return out;
          }
        }
      }
    return out;
  }
  // ---------- The what-if family (levels 8-11: single-number what-if, with singles, both ways, with techniques) is compared
  // on effort, not on kind: a short what-if with a pair is easier than a long one with singles. The effort is the grade's
  // (stepEffort in grade.js, "as you used to play"): recognition + the length of the whole reasoning + the techniques inside the chain +
  // memory, with the game's weights (GW). len = support steps + the assumption + the chain's relevant steps.
  const WHATIF_L = 8;
  const innerTechs = (a) => (a.chain || []).filter((st) => st && st.rel !== false && st.kind === "elim" && st.app).map((st) => st.app.tech);
  function whatIfCost(a, len) {
    const W = typeof GW !== "undefined" ? GW : null;
    if (!W) return TECH_WEIGHT[a.tech] / 100 + len;
    const T = a.tech,
      innerR = innerTechs(a).reduce((m, t) => Math.max(m, W.recog[t] || 0), 0),
      lg = Math.log2(Math.max(1, len));
    const c =
      W.recog[T] +
      W.len * lg +
      W.inner * innerR +
      W.pencil.mem[2][T] * Math.log2(1 + (a.memPeak || 0)) +
      (W.pencil.len ? W.pencil.len[2][T] : 0) * lg;
    return Math.round(c * 1e6) / 1e6;
  }
  function levelApps(s, L) {
    if (L === 2) return neighborApps(s, false);
    if (L === 3) return nakedApps(s, 2, false).concat(hiddenApps(s, 2, false));
    if (L === 4) return nakedApps(s, 3, false).concat(hiddenApps(s, 3, false));
    if (L === 5) return chainApps(s, false, "x");
    if (L === 6) return chainApps(s, false, "xy");
    if (L === 7) return chainApps(s, false, "all");
    if (L === 8) return nishioApps(s, false);
    if (L === 9) return trialApps(s, 1, false);
    if (L === 10) return bothWaysApps(s, false);
    if (L === 11) return trialApps(s, 8, false);
    return [];
  }

  // ---------- validity on replay (after pruning)
  function refresh(T, a) {
    // returns an updated copy of the application if its premise still holds in T, otherwise null
    if (a.tech === 2) {
      const cells = RC[a.region],
        bit = 1 << a.v;
      if (cells.some((c) => T.val[c] === a.v)) return null;
      const spots = cells.filter((c) => !T.val[c] && T.cand[c] & bit);
      if (spots.length < 2 || !spots.every((c) => a.spots.includes(c))) return null;
      const targets = a.targets.filter((t) => !T.val[t.cell] && T.cand[t.cell] & bit && spots.every((sp) => peer(t.cell, sp)));
      return targets.length ? { ...a, spots, targets } : null;
    }
    if (a.tech === 3 || a.tech === 5) {
      if (a.cells.some((c) => T.val[c])) return null;
      const u = a.cells.reduce((m, c) => m | T.cand[c], 0);
      if (u & ~a.mask) return null;
      const targets = a.targets.map((t) => ({ cell: t.cell, mask: T.cand[t.cell] & a.mask })).filter((t) => !T.val[t.cell] && t.mask);
      return targets.length ? { ...a, targets } : null;
    }
    if (a.tech === 4 || a.tech === 6) {
      const cells = RC[a.region];
      if (cells.some((c) => T.val[c] && a.mask & (1 << T.val[c]))) return null;
      const spots = cells.filter((c) => !T.val[c] && T.cand[c] & a.mask);
      if (!spots.every((c) => a.cells.includes(c)) || spots.length !== a.cells.length) return null;
      const targets = a.cells.map((c) => ({ cell: c, mask: T.cand[c] & ~a.mask })).filter((t) => t.mask);
      return targets.length ? { ...a, targets } : null;
    }
    if (a.tech === 12) {
      const A = runBranch(T, a.root.a[0], a.root.a[1]),
        B = A && runBranch(T, a.root.b[0], a.root.b[1]);
      if (!A || !B || T.val[a.goal]) return null;
      const gone = T.cand[a.goal] & ~A.t.cand[a.goal] & ~B.t.cand[a.goal] & a.targets[0].mask;
      if (!gone) return null;
      const relA = A.relFor(a.goal, gone),
        relB = B.relFor(a.goal, gone);
      return {
        ...a,
        targets: [{ cell: a.goal, mask: gone }],
        branches: [
          { start: a.root.a, chain: A.chain.map((st, i) => ({ ...st, rel: relA[i] })), val: A.t.val[a.goal] },
          { start: a.root.b, chain: B.chain.map((st, i) => ({ ...st, rel: relB[i] })), val: B.t.val[a.goal] },
        ],
        relCount: relA.filter(Boolean).length + relB.filter(Boolean).length,
        memPeak: Math.max(A.peakFor(a.goal, gone), B.peakFor(a.goal, gone) + 1),
      };
    }
    if (isChain(a.tech)) {
      for (const k of a.nodes) if (T.val[k >> 4] || !(T.cand[k >> 4] & (1 << (k & 15)))) return null;
      for (let i = 0; i + 1 < a.nodes.length; i += 2) {
        const x = a.nodes[i],
          y = a.nodes[i + 1];
        if (x >> 4 === y >> 4) {
          if (pc(T.cand[x >> 4]) !== 2) return null;
        } else {
          // strong link: the number has exactly the two places in a shared house
          const d = x & 15;
          const ok = common(x >> 4, y >> 4).some((r) => {
            const sp = RC[r].filter((c) => !T.val[c] && T.cand[c] & (1 << d));
            return sp.length === 2 && !RC[r].some((c) => T.val[c] === d);
          });
          if (!ok) return null;
        }
      }
      const targets = a.targets.map((t) => ({ cell: t.cell, mask: T.cand[t.cell] & t.mask })).filter((t) => !T.val[t.cell] && t.mask);
      return targets.length ? { ...a, targets } : null;
    }
    // what-if
    if (T.val[a.cell] || !(T.cand[a.cell] & (1 << a.v))) return null;
    const r = a.tech === 10 ? nishioRun(T, a.cell, a.v) : runTrial(T, a.cell, a.v, a.tech === 11 ? 1 : 8);
    return r ? { ...a, chain: r.chain, broken: r.broken, relCount: r.relCount, memPeak: r.memPeak } : null;
  }
  function replay(S0, list, cell, v) {
    const T = clone(S0),
      out = [];
    for (const a of list) {
      const b = refresh(T, a);
      if (!b) continue; // the step is superfluous or no longer justified here

      out.push({ app: b, before: clone(T) });
      apply(T, b);
      if (T.broken) return null;
    }
    const kind = singleHolds(T, cell, v);
    return kind ? { steps: out, kind, after: T } : null;
  }

  // The what-if with the least effort (whatIfCost) that gives a number. The length is the whole reasoning: the steps it builds on
  // (support), the assumption and the relevant steps in the chain. Candidates are searched both in S (after the easier eliminations, steps) and
  // in S0 (without), so a short what-if that does not need the eliminations can beat a longer one that does.
  // want(T) gives the single that must come out of it, or null. Answer: { a, x, fromS0 } or null.
  function whatIfBest(S0, S, steps, want) {
    const raw = [];
    const consider = (St, a, fromS0) => {
      const T = clone(St);
      apply(T, a);
      if (T.broken) return;
      const x = want(T);
      if (!x) return;
      const rel = a.relCount || 0;
      raw.push({ a, x, fromS0, rel, lb: whatIfCost(a, 1 + rel) + (x.score || 0) * 0.1, ub: fromS0 ? 1 + rel : steps.length + 1 + rel });
    };
    const base = (St) => nishioApps(St, false).concat(trialApps(St, 1, false), bothWaysApps(St, false));
    for (const a of base(S)) consider(S, a, false);
    if (steps.length) for (const a of base(S0)) consider(S0, a, true);
    if (!raw.length) return null;
    // what-if with techniques: only so far that it can become shorter than the best so far (ub: the length at most), and only with
    // techniques up to triples inside the chain (a short what-if with a chain inside is not short). The same run as with all
    // techniques as long as it succeeds (the chains are only used when nothing up to triples can be used), so the replay
    // finds it again.
    const lim = Math.min(...raw.map((r) => r.ub)) - 1; // relCount < lim
    if (lim > 0)
      for (const [St, fromS0] of steps.length ? [[S0, true], [S, false]] : [[S, false]])
        for (const a of trialApps(St, 4, false, Math.max(2, 2 * lim + 2))) if ((a.relCount || 0) < lim) consider(St, a, fromS0);
    // the support steps that are actually needed (as in finish: remove one at a time as long as the number still holds)
    const support = (r) => {
      if (r.fromS0 || !steps.length) return 0;
      let kept = steps.concat([r.a]);
      let res = replay(S0, kept, r.x.cell, r.x.v);
      if (res)
        for (let i = steps.length - 1; i >= 0; i--) {
          const t = kept.slice(0, i).concat(kept.slice(i + 1)),
            r2 = replay(S0, t, r.x.cell, r.x.v);
          if (r2 && r2.steps.length && r2.steps[r2.steps.length - 1].app.tech === r.a.tech) {
            kept = t;
            res = r2;
          }
        }
      return res ? res.steps.length - 1 : steps.length;
    };
    // cheapest first (lower bound without support); the support is only computed as long as it can make a difference
    raw.sort((p, q) => p.lb - q.lb);
    let best = null;
    for (const r of raw) {
      if (best && r.lb >= best.key) break;
      const len = support(r) + 1 + r.rel;
      const key = whatIfCost(r.a, len) + (r.x.score || 0) * 0.1;
      if (!best || key < best.key) best = { a: r.a, x: r.x, fromS0: r.fromS0, len, key };
    }
    return best;
  }
  // ---------- the easiest next number
  function easiest(known) {
    const S0 = fromKnown(known);
    if (S0.broken || solved(S0)) return null;
    const sg = singles(S0);
    if (sg.length) return build(S0, { steps: [], kind: sg[0].kind, after: S0 }, sg[0].cell, sg[0].v);
    let S = clone(S0);
    const steps = [];
    const finish = (cell, v) => {
      // prune steps that are not needed for exactly this number
      let kept = steps.slice();
      let res = replay(S0, kept, cell, v);
      for (let i = kept.length - 1; i >= 0 && res; i--) {
        const tryList = kept.slice(0, i).concat(kept.slice(i + 1));
        const r2 = replay(S0, tryList, cell, v);
        if (r2) {
          kept = tryList;
          res = r2;
        }
      }
      if (!res) res = { steps: steps.map((a) => ({ app: a, before: null })), kind: singleHolds(S, cell, v) || "naked", after: S };
      return build(S0, res, cell, v);
    };
    for (let guard = 0; guard < 300; guard++) {
      const ready = singles(S)[0];
      if (ready) return finish(ready.cell, ready.v);
      let progressed = false;
      for (let L = 2; L <= 11 && !progressed; L++) {
        if (L === WHATIF_L) {
          const w = whatIfBest(S0, S, steps, (T) => singles(T)[0] || null);
          if (w) {
            if (w.fromS0) {
              steps.length = 0;
              S = clone(S0);
            }
            steps.push(w.a);
            apply(S, w.a);
            return finish(w.x.cell, w.x.v);
          }
        }
        const apps = levelApps(S, L);
        if (!apps.length) continue;
        let bestApp = null,
          bestSingle = null;
        for (const a of apps) {
          const T = clone(S);
          apply(T, a);
          if (T.broken) continue;
          const x = singles(T)[0];
          // prefer: the easiest technique, the shortest chain (what-if), the easiest number afterwards
          const key = (y) => TECH_WEIGHT[y.a.tech] / 100 + (y.a.relCount || 0) + y.x.score * 0.1;
          if (x && (!bestSingle || key({ a, x }) < key({ a: bestApp, x: bestSingle }))) {
            bestApp = a;
            bestSingle = x;
          }
        }
        if (bestApp) {
          steps.push(bestApp);
          apply(S, bestApp);
          return finish(bestSingle.cell, bestSingle.v);
        }
        for (const a of apps) {
          const before = S.cand.join();
          apply(S, a);
          if (S.cand.join() !== before) steps.push(a);
        }
        progressed = true;
      }
      if (!progressed) return null;
    }
    return null;
  }

  // ---------- texts (translated with tr(); see js/i18n.js)
  const nm = (c) => "abcdefghij"[c % cols] + (Math.floor(c / cols) + 1);
  const list = (arr) => (arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " " + tr("and") + " " + arr[arr.length - 1]);
  const vals = (m) => list(bitsOf(m).map(String));
  // "cannot be 4" / "can be neither 1 nor 2" / "can be neither 2, 3 nor 4"
  const cannot = (m) => {
    const b = bitsOf(m);
    return b.length === 1
      ? tr("cannot be {v}", { v: b[0] })
      : tr("can be neither {a} nor {b}", { a: b.slice(0, -1).join(", "), b: b[b.length - 1] });
  };
  const groupByMask = (targets) => {
    const g = new Map();
    for (const t of targets) {
      if (!g.has(t.mask)) g.set(t.mask, []);
      g.get(t.mask).push(t.cell);
    }
    return [...g];
  };
  const regionName = (r) => MODEL.unitName(r, nm, list); // "the region with a1, b1 and c1" / "row 3"
  // The shared house where a number has exactly two places (a strong link between two cells) in the state st
  const strongUnit = (a, b, d, st) =>
    common(a, b).find((r) => !st || (RC[r].filter((c) => !st.val[c] && st.cand[c] & (1 << d)).length === 2 && !RC[r].some((c) => st.val[c] === d))) ??
    common(a, b)[0];

  function stepText(a, st) {
    if (a.tech === 2) {
      const sp = list(a.spots.map(nm)),
        tg = list(a.targets.map((t) => nm(t.cell)));
      const all = a.spots.length === 2 ? tr("both cells") : tr("all {n} cells", { n: a.spots.length });
      return (
        tr("In {region}, {v} can only go in {spots}. We don't know where, but {v} lands in one of them.", { region: regionName(a.region), v: a.v, spots: sp }) +
        " " +
        (KING
          ? a.targets.length > 1
            ? tr("{cells} touch {all}, so they cannot be {v}.", { cells: tg, all, v: a.v })
            : tr("{cells} touches {all}, so it cannot be {v}.", { cells: tg, all, v: a.v })
          : a.targets.length > 1
            ? tr("{cells} see {all}, so they cannot be {v}.", { cells: tg, all, v: a.v })
            : tr("{cells} sees {all}, so it cannot be {v}.", { cells: tg, all, v: a.v }))
      );
    }
    if (a.tech === 3 || a.tech === 5) {
      const kk = a.cells.length,
        cs = list(a.cells.map(nm));
      const shared = a.cells.reduce((acc, c) => acc.filter((u) => unitsOf[c].includes(u)), unitsOf[a.cells[0]]);
      let s =
        (shared.length
          ? KING
            ? tr("{cells} are in the same region and between them can only be {vals}.", { cells: cs, vals: vals(a.mask) })
            : tr("{cells} lie in {unit} and between them can only be {vals}.", { cells: cs, unit: regionName(shared[0]), vals: vals(a.mask) })
          : tr("{cells} see each other and between them can only be {vals}.", { cells: cs, vals: vals(a.mask) })) +
        " " +
        (kk === 2 ? tr("So those two numbers are used up by exactly those two cells.") : tr("So those three numbers are used up by exactly those three cells.")) +
        " ";
      s += groupByMask(a.targets)
        .map(([m, cs]) =>
          kk === 2
            ? tr("Seeing both of them, {cells} {cannot}.", { cells: list(cs.map(nm)), cannot: cannot(m) })
            : tr("Seeing all three of them, {cells} {cannot}.", { cells: list(cs.map(nm)), cannot: cannot(m) }),
        )
        .join(" ");
      if (KING && kk === 3 && a.targets.length === 1) {
        const four = a.cells.concat(a.targets[0].cell);
        const rs = four.map((c) => Math.floor(c / cols)),
          csx = four.map((c) => c % cols);
        if (Math.max(...rs) - Math.min(...rs) === 1 && Math.max(...csx) - Math.min(...csx) === 1)
          s += " " + tr("The four cells form a 2×2 block, so they must all be different.");
      }
      return s;
    }
    if (a.tech === 4 || a.tech === 6) {
      const cs = list(a.cells.map(nm));
      return (
        tr("In {region}, {vals} can only go in {cells}.", { region: regionName(a.region), vals: vals(a.mask), cells: cs }) +
        " " +
        (a.cells.length === 2
          ? tr("So those two cells are taken by those numbers, even though they have other options.")
          : tr("So those three cells are taken by those numbers, even though they have other options.")) +
        " " +
        groupByMask(a.targets)
          .map(([m, cs]) => tr("{cells} {cannot}.", { cells: list(cs.map(nm)), cannot: cannot(m) }))
          .join(" ")
      );
    }
    if (isChain(a.tech)) return chainText(a, st).text;
    if (a.tech === 12) return bothText(a).conclusion;
    // what-if
    return trialText(a).text;
  }
  function placeSentence(x) {
    return x.kind === "naked"
      ? tr("{cell} can only be {v}", { cell: nm(x.cell), v: x.v })
      : x.kind === "last"
        ? KING
          ? tr("{cell} is the last cell in its region and becomes {v}", { cell: nm(x.cell), v: x.v })
          : tr("{cell} is the last cell in {unit} and becomes {v}", { cell: nm(x.cell), unit: regionName(x.region), v: x.v })
        : KING
          ? tr("{v} can only go in {cell} in its region", { cell: nm(x.cell), v: x.v })
          : tr("{v} can only go in {cell} in {unit}", { cell: nm(x.cell), unit: regionName(x.region), v: x.v });
  }
  function bothText(a) {
    const r = a.root;
    const intro =
      r.kind === "cell"
        ? tr("{cell} can only be {a} or {b}. Try both ways.", { cell: nm(r.a[0]), a: r.a[1], b: r.b[1] })
        : tr("In {region}, {v} can only go in {a} or {b}. Try both ways.", { region: regionName(r.region), v: r.a[1], a: nm(r.a[0]), b: nm(r.b[0]) });
    const g = a.goal,
      m = a.targets[0].mask;
    const branchText = (br, k) => {
      const steps = br.chain.filter((x) => x.rel).map((x) => tr("then {step}", { step: placeSentence(x.single) }));
      const res = br.val ? `${nm(g)} = ${br.val}` : `${nm(g)} ${cannot(m)}`;
      return (
        tr("Way {k}: if {cell} = {v},", { k, cell: nm(br.start[0]), v: br.start[1] }) +
        " " +
        (steps.length ? steps.join(", ") + ". " : "") +
        tr("That gives {res}.", { res })
      );
    };
    const same = a.branches[0].val && a.branches[0].val === a.branches[1].val;
    const conclusion = same
      ? tr("Both ways give {cell} = {v}. So it is true, whichever way is the right one.", { cell: nm(g), v: a.branches[0].val })
      : tr("Both ways lead to the same thing: {cell} {cannot}. So it holds, whichever way is the right one.", { cell: nm(g), cannot: cannot(m) });
    return { intro, b1: branchText(a.branches[0], 1), b2: branchText(a.branches[1], 2), conclusion };
  }
  function chainText(a, st) {
    const N = a.nodes,
      nc = (k) => nm(k >> 4),
      dg = (k) => k & 15,
      parts = [];
    parts.push(tr("Assume {cell} is not {v}.", { cell: nc(N[0]), v: dg(N[0]) }));
    for (let i = 1; i < N.length; i++) {
      const prev = N[i - 1],
        cur = N[i];
      const p = { cell: nc(cur), v: dg(cur), prev: nc(prev) };
      if (i % 2 === 1)
        parts.push(
          prev >> 4 === cur >> 4
            ? tr("Then {cell} = {v}, the cell's only other option.", p)
            : KING
              ? tr("Then {v} must go in {cell}, the only other place in the region.", p)
              : tr("Then {v} must go in {cell}, the only other place in {unit}.", { ...p, unit: regionName(strongUnit(prev >> 4, cur >> 4, cur & 15, st)) }),
        );
      else
        parts.push(
          prev >> 4 === cur >> 4
            ? tr("Then {cell} is not {v}.", p)
            : !KING
              ? tr("Then {cell} cannot be {v}, because it sees {prev}.", p)
              : touch(prev >> 4, cur >> 4)
                ? tr("Then {cell} cannot be {v}, because it touches {prev}.", p)
                : tr("Then {cell} cannot be {v}, because it is in the same region as {prev}.", p),
        );
    }
    const Y = N[N.length - 1];
    const end =
      tr("So either {a} = {va} or {b} = {vb}.", { a: nc(N[0]), va: dg(N[0]), b: nc(Y), vb: dg(Y) }) +
      " " +
      groupByMask(a.targets)
        .map(([m, cs]) => tr("{cells} {cannot}, because that would rule out both options.", { cells: list(cs.map(nm)), cannot: cannot(m) }))
        .join(" ");
    const short = parts.length <= 7;
    const text = short
      ? parts.join(" ") + " " + end
      : tr("A chain of {n} strong links: if {a} is not {va}, it ends with {b} = {vb}.", { n: a.relCount, a: nc(N[0]), va: dg(N[0]), b: nc(Y), vb: dg(Y) }) +
        " " +
        end;
    return { text, chain: short ? [] : parts };
  }
  function trialText(a) {
    const parts = [];
    for (const st of a.chain.filter((x) => x.rel)) {
      if (st.kind === "place") {
        const x = st.single,
          p = { cell: nm(x.cell), v: x.v };
        parts.push(
          x.kind === "naked"
            ? tr("Then {cell} can only be {v}.", p)
            : x.kind === "last"
              ? KING
                ? tr("Then {cell} is the last cell in its region and becomes {v}.", p)
                : tr("Then {cell} is the last cell in {unit} and becomes {v}.", { ...p, unit: regionName(x.region) })
              : KING
                ? tr("Then {v} can only go in {cell} in its region.", p)
                : tr("Then {v} can only go in {cell} in {unit}.", { ...p, unit: regionName(x.region) }),
        );
      } else if (st.kind === "elim") {
        const b = st.app;
        const what = list(b.targets.map((t) => tr("{vals} from {cell}", { vals: vals(t.mask), cell: nm(t.cell) })));
        const own = b.tech === 2 ? b.spots : b.cells;
        parts.push(
          own && own.length
            ? tr("{tech} in {cells} removes {what}.", { tech: TECH_NAMES[b.tech], cells: list(own.map(nm)), what })
            : tr("{tech} removes {what}.", { tech: TECH_NAMES[b.tech], what }),
        );
      }
    }
    const br = a.broken;
    const end =
      br.kind === "cell"
        ? tr("{cell} has no possible numbers left", { cell: nm(br.cell) })
        : br.kind === "region"
          ? tr("there is no room for {v} in {region}", { v: br.v, region: regionName(br.region) })
          : tr("the numbers do not add up");
    const relChain = a.chain.filter((st) => st.rel);
    const nPl = relChain.filter((st) => st.kind === "place").length;
    const contra = tr("That is a contradiction, so {cell} cannot be {v}.", { cell: nm(a.cell), v: a.v });
    if (a.tech === 10 && parts.length <= 6) {
      const mainEnd =
        br.kind === "region"
          ? tr("Now there is no room for {v} in {region}.", { v: br.v, region: regionName(br.region) })
          : tr("Now the numbers do not add up.");
      return {
        text:
          tr("Assume {cell} = {v} (orange) and follow only the number {v}.", { cell: nm(a.cell), v: a.v }) +
          " " +
          parts.join(" ") +
          (parts.length ? " " : "") +
          mainEnd +
          " " +
          contra,
        chain: [],
      };
    }
    const intro =
      a.tech === 10
        ? tr("Assume {cell} = {v} (orange) and follow only the number {v}:", { cell: nm(a.cell), v: a.v })
        : a.tech === 11
          ? tr("Assume {cell} = {v} (orange). Follow the consequences with naked and hidden singles:", { cell: nm(a.cell), v: a.v })
          : tr("Assume {cell} = {v} (orange). Follow the consequences with every technique up to the single-number what-if:", { cell: nm(a.cell), v: a.v });
    const after =
      relChain.length === 1 ? tr("after 1 step") : tr("after {n} steps", { n: relChain.length });
    const placedNote = nPl && nPl !== relChain.length ? " " + tr("({n} of them place a number)", { n: nPl }) : "";
    const text = intro + " " + after + placedNote + " " + tr("the result is that {end}.", { end }) + " " + contra;
    return { text, chain: parts };
  }

  function finalText(S0, res, cell, v, stepIdxOf) {
    const kind = res.kind,
      r = holdUnit(res.after || S0, cell, v, kind);
    if (kind === "last")
      return KING
        ? tr("{cell} is the only empty cell in {region}, and the region is only missing {v}. So {cell} = {v}.", { cell: nm(cell), region: regionName(r), v })
        : tr("{cell} is the only empty cell in {region}, which is only missing {v}. So {cell} = {v}.", { cell: nm(cell), region: regionName(r), v });
    if (kind === "naked") {
      const sz = size[cell],
        inReg = [],
        touching = [],
        fromStep = [];
      for (let u = 1; u <= sz; u++) {
        if (u === v) continue;
        if (KING ? RC[r].some((c) => S0.val[c] === u) : peers[cell].some((c) => S0.val[c] === u)) {
          inReg.push(u);
          continue;
        }
        const src = peers[cell].find((p) => S0.val[p] === u);
        if (src !== undefined) {
          touching.push(tr("{v} in {cell}", { v: u, cell: nm(src) }));
          continue;
        }
        fromStep.push([u, stepIdxOf(cell, u)]);
      }
      const bits = [];
      if (inReg.length)
        bits.push(
          KING
            ? tr("The region already has {vals}.", { vals: list(inReg.map(String)) })
            : tr("{cell} already sees {vals} in its row, column and box.", { cell: nm(cell), vals: list(inReg.map(String)) }),
        );
      if (touching.length)
        bits.push(tr("The cell is touched by {list}.", { list: list(touching) }));
      if (fromStep.length) {
        const byStep = new Map();
        for (const [u, k] of fromStep) {
          if (!byStep.has(k)) byStep.set(k, []);
          byStep.get(k).push(u);
        }
        bits.push([...byStep].map(([k, us]) => tr("Step {k} removed {vals}.", { vals: list(us.map(String)), k })).join(" "));
      }
      return (
        (KING ? tr("{cell} is in a region of {n} cells, so it can be 1–{n}.", { cell: nm(cell), n: sz }) + " " : "") +
        bits.join(" ") +
        " " +
        tr("Only {v} is left: {cell} = {v}.", { cell: nm(cell), v })
      );
    }
    // hidden
    const others = RC[r].filter((c) => c !== cell && !S0.val[c]);
    const bySrc = new Map(),
      stepped = [];
    for (const o of others) {
      const src = peers[o].find((p) => S0.val[p] === v && !RC[r].includes(p));
      if (src !== undefined) {
        if (!bySrc.has(src)) bySrc.set(src, []);
        bySrc.get(src).push(o);
      } else stepped.push(o);
    }
    const bits = [];
    for (const [src, cs] of bySrc)
      bits.push(
        KING
          ? tr("The {v} in {src} touches {cells}.", { cells: list(cs.map(nm)), v, src: nm(src) })
          : cs.length > 1
            ? tr("{cells} see the {v} in {src}.", { cells: list(cs.map(nm)), v, src: nm(src) })
            : tr("{cells} sees the {v} in {src}.", { cells: list(cs.map(nm)), v, src: nm(src) }),
      );
    if (stepped.length) {
      const byStep = new Map();
      for (const o of stepped) {
        const k = stepIdxOf(o, v);
        if (!byStep.has(k)) byStep.set(k, []);
        byStep.get(k).push(o);
      }
      bits.push([...byStep].map(([k, cs]) => tr("{cells} lost {v} in step {k}.", { cells: list(cs.map(nm)), v, k })).join(" "));
    }
    return (
      tr("{Region} is missing {v}.", { Region: regionName(r)[0].toUpperCase() + regionName(r).slice(1), v }) +
      " " +
      bits.join(" ") +
      " " +
      tr("So {v} can only go in {cell}: {cell} = {v}.", { cell: nm(cell), v })
    );
  }

  // Working memory for the whole way to one number. A step depends directly on an earlier fact if
  // the step's premise no longer holds when exactly that fact is removed (all other facts are kept).
  // A fact lives from when it is found to the last step that uses it; the peak also counts what a step itself needs.
  function outerPeak(S0, steps, cell, v) {
    const k = steps.length;
    if (!k) return 0;
    const without = (upto, skip) => {
      const T = clone(S0);
      for (let i = 0; i < upto; i++) if (i !== skip) apply(T, steps[i]);
      return T;
    };
    const last = new Array(k).fill(-1);
    for (let j = 1; j < k; j++) for (let i = 0; i < j; i++) if (!refresh(without(j, i), steps[j])) last[i] = Math.max(last[i], j);
    for (let i = 0; i < k; i++) if (singleHolds(without(k, i), cell, v) === null) last[i] = k;
    let peak = 0;
    for (let j = 0; j <= k; j++) {
      let live = 0;
      for (let i = 0; i < j; i++) if (last[i] >= j) live++;
      peak = Math.max(peak, live + (j < k ? steps[j].memPeak || 0 : 0));
    }
    return peak;
  }
  function build(S0, res, cell, v) {
    const steps = res.steps.map((s) => s.app);
    const stepIdxOf = (c, u) => {
      for (let i = 0; i < steps.length; i++) if (steps[i].targets.some((t) => t.cell === c && t.mask & (1 << u))) return i + 1;
      return "?";
    };
    const finalTech = res.kind === "naked" ? 0 : 1;
    const hardest = steps.reduce((m, a) => Math.max(m, a.tech), finalTech);
    const view = [];
    // 0: a nudge without the answer
    if (!steps.length) {
      view.push({
        nudge: true,
        text:
          res.kind === "naked"
            ? tr("Technique for the next number: {tech}. Look at the marked cell: which numbers can it not be?", { tech: TECH_NAMES[0].toLowerCase() })
            : KING
              ? tr("Technique for the next number: {tech}. Look at the marked region: which number can only go in one place?", { tech: TECH_NAMES[1].toLowerCase() })
              : tr("The next number can be found with {tech}. Look at the highlighted {kind}: which number can only go in one place?", {
                  tech: TECH_NAMES[1].toLowerCase(),
                  kind: MODEL.unitKind(holdUnit(S0, cell, v, res.kind)),
                }),
        pattern: res.kind === "naked" ? [cell] : RC[holdUnit(S0, cell, v, res.kind)].filter((c) => !S0.val[c]),
        target: [],
        cand: {},
        strike: {},
      });
    } else {
      const a0 = steps[0];
      const pat = a0.tech === 2 ? a0.spots : a0.cells ? a0.cells : [a0.cell];
      view.push({
        nudge: true,
        text: tr("Technique for the easiest next number: {tech}. Start at the marked cells. Think it through yourself first, then tap Next for the explanation.", {
          tech: TECH_NAMES[hardest].toLowerCase(),
        }),
        pattern: pat,
        target: [],
        cand: {},
        strike: {},
      });
    }
    // explanation steps
    res.steps.forEach((s, i) => {
      const a = s.app,
        st = s.before || S0;
      const pat = a.tech === 2 ? a.spots : a.cells ? a.cells : [a.cell];
      const show = new Set([...pat, ...a.targets.map((t) => t.cell)]);
      if (a.tech === 2 || a.tech === 4 || a.tech === 6)
        RC[a.region].forEach((c) => {
          if (!st.val[c]) show.add(c);
        });
      if (isChain(a.tech))
        a.nodes.forEach((k) => {
          for (const r of unitsOf[k >> 4])
            if (a.nodes.some((j, i) => i % 2 === 0 && (j & 15) === (k & 15) && unitsOf[j >> 4].includes(r) && j !== k))
              RC[r].forEach((c) => {
                if (!st.val[c]) show.add(c);
              });
        });
      const cand = {},
        strike = {};
      for (const c of show) if (!st.val[c]) cand[c] = st.cand[c];
      for (const t of a.targets) strike[t.cell] = (strike[t.cell] || 0) | t.mask;
      const v1 = {
        title: tr("Step {k}: {tech}", { k: i + 1, tech: TECH_NAMES[a.tech] }),
        tech: a.tech,
        text: stepText(a, st),
        pattern: pat,
        target: a.targets.map((t) => t.cell),
        cand,
        strike,
      };
      if (isChain(a.tech)) v1.chain = chainText(a, st).chain;
      if (a.tech === 12) {
        const bt = bothText(a);
        const hyp = (br) => {
          const h = { [br.start[0]]: br.start[1] };
          for (const x of br.chain) if (x.rel) h[x.single.cell] = x.single.v;
          return h;
        };
        const rootCells = a.cells;
        view.push({
          title: tr("Step {k}: Both ways · way 1", { k: i + 1 }),
          tech: 12,
          text: bt.intro + " " + bt.b1,
          pattern: [],
          target: [a.goal],
          cand: {},
          strike: {},
          hypo: hyp(a.branches[0]),
        });
        view.push({
          title: tr("Step {k}: Both ways · way 2", { k: i + 1 }),
          tech: 12,
          text: bt.b2,
          pattern: [],
          target: [a.goal],
          cand: {},
          strike: {},
          hypo: hyp(a.branches[1]),
        });
        view.push({
          title: tr("Step {k}: Both ways · conclusion", { k: i + 1 }),
          tech: 12,
          text: bt.conclusion,
          pattern: rootCells,
          target: [a.goal],
          cand: { [a.goal]: st.cand[a.goal] },
          strike: { [a.goal]: a.targets[0].mask },
        });
        return;
      }
      if (a.tech === 10 || a.tech === 11 || a.tech === 13) {
        v1.chain = trialText(a).chain;
        v1.hypo = { [a.cell]: a.v };
        for (const ch of a.chain) if (ch.kind === "place" && ch.rel) v1.hypo[ch.single.cell] = ch.single.v;
        v1.bad =
          a.broken.kind === "cell"
            ? [a.broken.cell]
            : a.broken.kind === "region"
              ? RC[a.broken.region].filter((c) => !st.val[c] && !(c in v1.hypo))
              : [];
        v1.pattern = [];
        v1.target = [];
        v1.cand = {};
        v1.strike = {};
        v1.after = {
          title: tr("Step {k}: conclusion", { k: i + 1 }),
          tech: a.tech,
          text: tr("The assumption led to a contradiction, so {cell} cannot be {v}.", { cell: nm(a.cell), v: a.v }),
          pattern: [],
          target: [a.cell],
          cand: { [a.cell]: st.cand[a.cell] },
          strike: { [a.cell]: 1 << a.v },
        };
      }
      view.push(v1);
      if (v1.after) {
        view.push(v1.after);
        delete v1.after;
      }
    });
    // the answer
    const fin = res.after;
    const show = new Set([cell]);
    const hu = holdUnit(fin, cell, v, res.kind);
    if (res.kind !== "naked")
      RC[hu].forEach((c) => {
        if (!fin.val[c]) show.add(c);
      });
    const cand = {};
    for (const c of show) if (!fin.val[c]) cand[c] = fin.cand[c];
    view.push({
      final: true,
      title: `${TECH_NAMES[finalTech]}`,
      tech: finalTech,
      text: finalText(S0, res, cell, v, stepIdxOf),
      pattern: res.kind === "naked" ? [] : RC[hu].filter((c) => !S0.val[c] && c !== cell),
      target: [cell],
      cand,
      strike: {},
    });
    const support = res.steps.map((s) => ({
      tech: s.app.tech,
      chain: s.app.relCount || 0,
      peak: s.app.memPeak || 0,
      fullChain: s.app.chain ? s.app.chain.length : 0,
    }));
    const mem = outerPeak(S0, steps, cell, v);
    const len = support.reduce((m, x) => m + 1 + x.chain, 0);
    // Techniques inside a what-if / both ways (only steps that carry the contradiction). Singles do not count.
    const inner = [
      ...new Set(
        steps
          .filter((a) => a.tech === hardest)
          .flatMap((a) => (a.branches ? a.branches.flatMap((b) => b.chain) : a.chain || []))
          .filter((st) => st && st.rel !== false && st.kind === "elim" && st.app)
          .map((st) => st.app.tech),
      ),
    ].sort((x, y) => x - y);
    // Cells the hardest step eliminates in but that still have several options afterwards. With pencil they are on
    // the board; without pencil they must be remembered (used for the grade without pencil).
    let multi = 0;
    {
      const Tm = clone(S0);
      for (const a of steps) {
        apply(Tm, a);
        if (a.tech === hardest) for (const t of a.targets) if (t.cell !== cell && !Tm.val[t.cell] && pc(Tm.cand[t.cell]) >= 2) multi++;
      }
    }
    // Features at the first step with the hardest technique, measured just before it (for the grade; see tools/grade/weights.json):
    //   trial   what-if from a cell with 3+ options: the contradiction eliminates only one number, which must be remembered without pencil
    //   built   the pattern's cells whose options build on earlier eliminations and not only on the placed numbers
    //           (for hidden pairs/triples: the region's cells where the numbers' places have changed)
    //   partial partial triple: not all three cells have all three numbers ({1,2},{2,3},{1,3})
    //   sig     the pattern's identity (technique, cells, numbers), so a later placement can see that the pattern was used before
    let trial = 0,
      built = 0,
      partial = 0,
      sig = null;
    {
      const i = steps.findIndex((a) => a.tech === hardest);
      if (i >= 0) {
        const a = steps[i],
          Tb = clone(S0);
        for (let j = 0; j < i; j++) apply(Tb, steps[j]);
        const own = (a.tech === 2 ? a.spots : a.cells || [a.cell]).filter((c) => c >= 0);
        if (a.tech === 4 || a.tech === 6) {
          for (const c of RC[a.region]) if (!S0.val[c] && (Tb.cand[c] ^ S0.cand[c]) & a.mask) built++;
        } else for (const c of own) if (Tb.cand[c] !== S0.cand[c]) built++;
        if ((a.tech === 10 || a.tech === 11 || a.tech === 13) && pc(Tb.cand[a.cell]) >= 3) trial = 1;
        if ((a.tech === 5 || a.tech === 6) && a.cells.some((c) => pc(Tb.cand[c] & a.mask) < 3)) partial = 1;
        sig = a.tech + ":" + own.slice().sort((x, y) => x - y).join(",") + ":" + (a.mask != null ? a.mask : a.v != null ? a.v : "");
      }
    }
    // How visible is the hardest step? The shape, how full the area is, and how many cells' options you need to know.
    let vis = null;
    res.steps.forEach((s) => {
      const a = s.app,
        st = S0;
      if (a.tech !== hardest || vis) return;
      const pat = (a.tech === 2 ? a.spots : a.cells ? a.cells : [a.cell]).filter((c) => c >= 0);
      if (!pat.length) return;
      const tg = a.targets.map((t) => t.cell);
      const rows = new Set(pat.map((c) => Math.floor(c / G.cols))),
        cols = new Set(pat.map((c) => c % G.cols));
      const area = new Set([...pat, ...tg]);
      for (const c of [...pat, ...tg]) for (const k of MODEL.near[c]) area.add(k);
      let filled = 0;
      for (const c of area) if (st.val[c]) filled++;
      const need = new Set([...pat, ...tg]);
      if (a.region !== undefined && RC[a.region]) RC[a.region].forEach((c) => need.add(c));
      let work = 0;
      for (const c of need) if (!st.val[c]) work++;
      vis = {
        size: pat.length,
        bent: pat.length > 1 && rows.size > 1 && cols.size > 1 ? 1 : 0,
        fill: filled / Math.max(1, area.size),
        work,
      };
    });
    return {
      cell,
      v,
      hardest,
      hardestLevel: TECH_LEVEL[hardest],
      hardestName: TECH_NAMES[hardest],
      views: view,
      support,
      vis,
      opts: singles(S0).length,
      mem,
      len,
      inner,
      multi,
      trial,
      built,
      partial,
      sig,
      eliminations: steps.flatMap((a) => a.targets),
    };
  }

  // ---------- route analysis: how hard was exactly this move, and what was the easiest possible at that moment?
  // One round: use techniques up to level L, lowest first. true if something changed.
  function sweepTo(S, L) {
    for (let l = 2; l <= L; l++) {
      const apps = levelApps(S, l);
      if (!apps.length) continue;
      const before = S.cand.join();
      for (const a of apps) {
        apply(S, a);
        if (S.broken) return false;
      }
      if (S.cand.join() !== before) return true;
    }
    return false;
  }
  // The lowest level at which there is a next number at all
  // n = how many cells could be placed at that level (few options are harder to spot)
  function availLevel(S0) {
    const cnt = (S) => new Set(singles(S).map((x) => x.cell)).size;
    let n = cnt(S0);
    if (n) return { level: 1, n };
    for (let L = 2; L <= 11; L++) {
      const S = clone(S0);
      for (let g = 0; g < 300; g++) {
        if ((n = cnt(S))) return { level: L, n };
        if (!sweepTo(S, L)) break;
      }
    }
    return { level: 12, n: 0 };
  }
  // The lowest level at which exactly (cell, v) can be seen directly, without placing other numbers first
  function directLevel(S0, cell, v) {
    if (singleHolds(S0, cell, v)) return 1;
    for (let L = 2; L <= 11; L++) {
      const S = clone(S0);
      for (let g = 0; g < 300; g++) {
        if (S.broken || !(S.cand[cell] & (1 << v))) break;
        if (singleHolds(S, cell, v)) return L;
        if (!sweepTo(S, L)) break;
      }
    }
    return 12;
  }
  // The lowest level up to maxL at which (cell, v) can be found by first placing other numbers in your head.
  // placed = the smallest number of other numbers that must be placed (greedily pruned, each number still justified).
  function closureWith(S0, cell, v, L, allowed) {
    const S = clone(S0),
      order = [],
      vals = [];
    let depth = 0;
    for (let g = 0; g < 400; g++) {
      if (S.broken || !(S.cand[cell] & (1 << v))) return null;
      if (singleHolds(S, cell, v)) return { order, vals, depth };
      const sg = singles(S).filter((x) => x.cell !== cell && (!allowed || allowed.has(x.cell)));
      if (sg.length) {
        for (const x of sg)
          if (!S.val[x.cell] && S.cand[x.cell] & (1 << x.v)) {
            place(S, x.cell, x.v);
            order.push(x.cell);
            vals.push(x.v);
          }
        depth++;
        continue;
      }
      if (L === 1 || !sweepTo(S, L)) return null;
    }
    return null;
  }
  function aheadLevel(S0, cell, v, maxL) {
    for (let L = 1; L <= maxL; L++) {
      const r = closureWith(S0, cell, v, L, null);
      if (!r) continue;
      let keep = new Set(r.order),
        best = r;
      for (const c of r.order.slice().reverse()) {
        const t = new Set(keep);
        t.delete(c);
        const r2 = closureWith(S0, cell, v, L, t);
        if (r2) {
          keep = new Set(r2.order);
          best = r2;
        }
      }
      // via: the numbers to be placed in your head first, as [cell, number]
      return { level: L, depth: best.depth, placed: best.order.length, via: best.order.map((c, i) => [c, best.vals[i]]) };
    }
    return null;
  }
  // Explanation of exactly (cell, v): the steps it takes, with the easiest techniques first, pruned to what is needed.
  // Used in the route analysis to show what the player actually did.
  // All numbers that can be seen directly (naked single / hidden single) in the position: [[cell, v], ...]
  function easyList(known) {
    const S0 = fromKnown(known);
    if (S0.broken) return [];
    return singles(S0).map((x) => [x.cell, x.v]);
  }
  // Practice drills (drill.js): every pattern at technique level L (2 neighbour elimination or locked candidates, 3 pairs,
  // 4 triples) in the position, with its cells and the numbers it makes directly visible. A pattern that gives nothing new
  // is still a correct find, just not a useful one here.
  // What the pattern is, without what it removes (the Sweep game asks for that part)
  function premiseText(apps) {
    const a0 = apps[0];
    if (apps.every((a) => a.tech === 2 && a.region === a0.region)) {
      const sp = list(a0.spots.map(nm));
      return apps.length > 1
        ? tr("In {region}, {vals} can only go in {cells}.", {
            region: regionName(a0.region),
            vals: list(apps.map((a) => a.v).sort((x, y) => x - y).map(String)),
            cells: sp,
          }) +
            " " +
            tr("We don't know where, but each of them lands in one of those cells.")
        : tr("In {region}, {v} can only go in {spots}. We don't know where, but {v} lands in one of them.", { region: regionName(a0.region), v: a0.v, spots: sp });
    }
    return apps
      .map((a) => {
        if (a.tech === 2)
          return tr("In {region}, {v} can only go in {spots}. We don't know where, but {v} lands in one of them.", {
            region: regionName(a.region),
            v: a.v,
            spots: list(a.spots.map(nm)),
          });
        const cs = list((a.cells || []).map(nm));
        if (a.tech === 3 || a.tech === 5) {
          const kk = a.cells.length;
          const shared = a.cells.reduce((acc, c) => acc.filter((u) => unitsOf[c].includes(u)), unitsOf[a.cells[0]]);
          return (
            (shared.length
              ? KING
                ? tr("{cells} are in the same region and between them can only be {vals}.", { cells: cs, vals: vals(a.mask) })
                : tr("{cells} lie in {unit} and between them can only be {vals}.", { cells: cs, unit: regionName(shared[0]), vals: vals(a.mask) })
              : tr("{cells} see each other and between them can only be {vals}.", { cells: cs, vals: vals(a.mask) })) +
            " " +
            (kk === 2 ? tr("So those two numbers are used up by exactly those two cells.") : tr("So those three numbers are used up by exactly those three cells."))
          );
        }
        if (a.tech === 4 || a.tech === 6)
          return (
            tr("In {region}, {vals} can only go in {cells}.", { region: regionName(a.region), vals: vals(a.mask), cells: cs }) +
            " " +
            (a.cells.length === 2
              ? tr("So those two cells are taken by those numbers, even though they have other options.")
              : tr("So those three cells are taken by those numbers, even though they have other options."))
          );
        return "";
      })
      .join(" ");
  }
  // Several numbers locked to the same places in the same region: one text for all of them
  function joinedText(apps, S) {
    const a0 = apps[0];
    if (apps.length < 2 || !apps.every((a) => a.tech === 2 && a.region === a0.region)) return apps.map((a) => stepText(a, S)).join(" ");
    const masks = new Map();
    apps.forEach((a) => a.targets.forEach((t) => masks.set(t.cell, (masks.get(t.cell) || 0) | t.mask)));
    const all = a0.spots.length === 2 ? tr("both cells") : tr("all {n} cells", { n: a0.spots.length });
    return (
      tr("In {region}, {vals} can only go in {cells}.", {
        region: regionName(a0.region),
        vals: list(apps.map((a) => a.v).sort((x, y) => x - y).map(String)),
        cells: list(a0.spots.map(nm)),
      }) +
      " " +
      tr("We don't know where, but each of them lands in one of those cells.") +
      " " +
      groupByMask([...masks].map(([cell, mask]) => ({ cell, mask })))
        .map(([m, cs]) => {
          const o = { cells: list(cs.map(nm)), all, cannot: cannot(m) };
          return KING
            ? cs.length > 1
              ? tr("{cells} touch {all}, so they {cannot}.", o)
              : tr("{cells} touches {all}, so it {cannot}.", o)
            : cs.length > 1
              ? tr("{cells} see {all}, so they {cannot}.", o)
              : tr("{cells} sees {all}, so it {cannot}.", o);
        })
        .join(" ")
    );
  }
  // Patterns on exactly the same cells count as one find (two numbers locked to the same two places, say): their
  // eliminations are joined, and so are their texts, so the board and the text show everything those cells do.
  function drillApps(known, L) {
    const S = fromKnown(known);
    if (S.broken || L < 2 || L > 4) return [];
    const before = new Set(singles(S).map((x) => x.cell * 16 + x.v));
    const groups = new Map();
    const every =
      L === 2 ? neighborApps(S, false, true) : nakedApps(S, L === 3 ? 2 : 3, false, true).concat(hiddenApps(S, L === 3 ? 2 : 3, false, true));
    for (const a of every) {
      const cells = (a.tech === 2 ? a.spots : a.cells || []).filter((c) => c >= 0),
        key = cells.slice().sort((x, y) => x - y).join(",");
      if (!groups.has(key)) groups.set(key, { cells, apps: [] });
      groups.get(key).apps.push(a);
    }
    return [...groups.values()].map(({ cells, apps }) => {
      const T = clone(S);
      apps.forEach((a) => apply(T, a));
      const gives = T.broken ? [] : singles(T).filter((x) => !before.has(x.cell * 16 + x.v));
      const masks = new Map();
      apps.forEach((a) => a.targets.forEach((t) => masks.set(t.cell, (masks.get(t.cell) || 0) | t.mask)));
      // the pattern that gives a number is explained first
      const useful = (a) => {
        const U = clone(S);
        apply(U, a);
        return !U.broken && singles(U).some((x) => !before.has(x.cell * 16 + x.v));
      };
      // the text is about what the pattern removes; a pattern that removes nothing only joins it when it is alone
      const acts = apps.filter((a) => a.targets.length).length ? apps.filter((a) => a.targets.length) : apps;
      const order = acts.length > 1 ? acts.filter(useful).concat(acts.filter((a) => !useful(a))) : acts;
      return {
        tech: apps[0].tech,
        cells,
        targets: [...masks].map(([cell, mask]) => ({ cell, mask })),
        gives: gives.map((x) => ({ cell: x.cell, v: x.v })),
        text: joinedText(order, S),
        premise: premiseText(order),
      };
    });
  }
  function explainMove(known, cell, v) {
    const S0 = fromKnown(known);
    if (S0.broken || S0.val[cell] || !(S0.cand[cell] & (1 << v))) return null;
    const k0 = singleHolds(S0, cell, v);
    if (k0) return build(S0, { steps: [], kind: k0, after: S0 }, cell, v);
    const S = clone(S0),
      steps = [];
    for (let g = 0; g < 300; g++) {
      if (S.broken || !(S.cand[cell] & (1 << v))) return null;
      if (singleHolds(S, cell, v)) break;
      // Like directLevel: use all applications at the lowest level that moves something, together. In the what-if family: the
      // what-if with the least effort that on its own gives exactly this number (as in hints).
      let done = false;
      for (let L = 2; L <= 11 && !done; L++) {
        if (L === WHATIF_L) {
          const w = whatIfBest(S0, S, steps, (T) => (singleHolds(T, cell, v) ? { cell, v, score: 0 } : null));
          if (w) {
            if (w.fromS0) {
              steps.length = 0;
              Object.assign(S, clone(S0));
            }
            apply(S, w.a);
            steps.push(w.a);
            done = true;
            break;
          }
        }
        for (const a of levelApps(S, L)) {
          const before = S.cand.join();
          apply(S, a);
          if (S.broken) return null;
          if (S.cand.join() !== before) {
            steps.push(a);
            done = true;
          }
        }
      }
      if (!done) return null;
    }
    let kept = steps.slice(),
      res = replay(S0, kept, cell, v);
    for (let i = kept.length - 1; i >= 0 && res; i--) {
      const t = kept.slice(0, i).concat(kept.slice(i + 1)),
        r2 = replay(S0, t, cell, v);
      if (r2) {
        kept = t;
        res = r2;
      }
    }
    if (!res) res = { steps: steps.map((a) => ({ app: a, before: null })), kind: singleHolds(S, cell, v) || "naked", after: S };
    return build(S0, res, cell, v);
  }
  function routeMove(known, cell, v) {
    const S0 = fromKnown(known);
    if (S0.broken) return null;
    const a = availLevel(S0),
      avail = a.level,
      direct = directLevel(S0, cell, v);
    const ahead = direct > avail ? aheadLevel(S0, cell, v, Math.min(direct - 1, 11)) : null;
    return { avail, nAvail: a.n, direct, ahead };
  }

  const st = (cand, val) => ({ cand: cand.slice(), val: val.slice(), broken: null });
  // A fast logical solver for the generator: place singles, and otherwise use all moves at the easiest level that helps,
  // at most maxL. The same techniques as hints. { solved, level (the hardest level used, 1-11), uses: moves per level,
  // tech: moves per technique (0 naked single, 1 hidden single, 2- as TECH_LABELS) }
  function rate(givens, maxL = 11) {
    const S = fromKnown(givens);
    const tech = new Array(TECH_NAMES.length).fill(0);
    if (S.broken) return { solved: false, level: 12, uses: {}, tech };
    let level = 1;
    const uses = {};
    for (let guard = 0; guard < 2000; guard++) {
      if (solved(S)) return { solved: true, level, uses, tech };
      const sg = singles(S);
      if (sg.length) {
        for (const x of sg)
          if (!S.val[x.cell] && S.cand[x.cell] & (1 << x.v)) {
            place(S, x.cell, x.v);
            tech[x.kind === "naked" ? 0 : 1]++;
          }
        if (S.broken) return { solved: false, level: 12, uses, tech };
        continue;
      }
      let moved = false;
      for (let L = 2; L <= maxL && !moved; L++) {
        const apps = levelApps(S, L);
        if (!apps.length) continue;
        const before = S.cand.join();
        for (const a of apps) {
          const b0 = S.cand.join();
          apply(S, a);
          if (a.tech != null && S.cand.join() !== b0) tech[a.tech]++;
        }
        if (S.broken) return { solved: false, level: 12, uses, tech };
        if (S.cand.join() !== before) {
          moved = true;
          level = Math.max(level, L);
          uses[L] = (uses[L] || 0) + 1;
        }
      }
      if (!moved) return { solved: false, level: 12, uses, tech };
    }
    return { solved: false, level: 12, uses, tech };
  }
  return {
    easiest,
    rate,
    singles,
    fromKnown,
    routeMove,
    explainMove,
    easyList,
    drillApps,
    // for the Quick call game (games.js): the houses, whether two cells see each other, and a house's short name
    houses: RC,
    peer,
    houseName: (u) => regionName(u),
    king: KING,
    chainsAt: (cand, val, mode) => chainApps(st(cand, val), false, mode || "all"),
    bothAt: (cand, val) => bothWaysApps(st(cand, val), false),
  };
}
