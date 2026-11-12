// Tutor: finder det letteste næste tal med forklaring (hints), og vurderer enkelte træk (ruteanalyse).

// Finder det letteste næste tal fra en stilling og forklarer vejen dertil trin for trin.
function createTutor(G, region) {
  const { n, cols } = G;
  const TECH_NAMES = [
    tr("Eneste kandidat"),
    tr("Eneste plads i region"),
    tr("Nabo-eliminering"),
    tr("Nøgent par"),
    tr("Skjult par"),
    tr("Nøgen trippel"),
    tr("Skjult trippel"),
    tr("Kæde med ét tal"),
    tr("Kæde med to-mulighedsfelter"),
    tr("Blandet kæde"),
    tr("Hvis-så med ét tal"),
    tr("Hvis-så, kort"),
    tr("Begge veje"),
    tr("Hvis-så, dyb"),
  ];
  const TECH_LEVEL = [1, 1, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11];
  const TECH_WEIGHT = [1, 1, 4, 8, 10, 15, 18, 20, 22, 24, 26, 30, 40, 60];
  const isChain = (t) => t >= 7 && t <= 9;
  const CHAIN_MODE = { 7: "x", 8: "xy", 9: "all" };
  const nr = Math.max(...region) + 1;
  const RC = Array.from({ length: nr }, () => []);
  region.forEach((r, c) => RC[r].push(c));
  const size = region.map((r) => RC[r].length);
  const touchM = new Uint8Array(n * n),
    peerM = new Uint8Array(n * n),
    peers = [];
  for (let a = 0; a < n; a++) {
    const p = [];
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const t = Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) <= 1 && Math.abs((a % cols) - (b % cols)) <= 1;
      if (t) touchM[a * n + b] = 1;
      if (t || region[a] === region[b]) {
        peerM[a * n + b] = 1;
        p.push(b);
      }
    }
    peers.push(p);
  }
  const touch = (a, b) => touchM[a * n + b] === 1;
  const peer = (a, b) => peerM[a * n + b] === 1;
  const pc = (x) => {
    let c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  };
  const ctz = (x) => 31 - Math.clz32(x & -x);
  const bitsOf = (m) => [1, 2, 3, 4, 5, 6].filter((v) => m & (1 << v));

  // ---------- tilstand
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

  // ---------- singles (alle), med en enkel menneskelig sværhedsscore
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
        if (spots.length === 1) add({ kind: "hidden", cell: spots[0], v, region: r, score: 1 + cells.length / 10 });
      }
    }
    for (let c = 0; c < n; c++)
      if (!s.val[c] && pc(s.cand[c]) === 1)
        add({ kind: "naked", cell: c, v: ctz(s.cand[c]), region: region[c], score: 1.5 + size[c] / 10 });
    return [...best.values()].sort((a, b) => a.score - b.score || a.cell - b.cell);
  }
  function singleHolds(s, cell, v) {
    if (s.val[cell]) return null;
    const r = region[cell],
      empty = RC[r].filter((c) => !s.val[c]);
    if (empty.length === 1 && empty[0] === cell && s.cand[cell] & (1 << v)) return "last";
    const spots = empty.filter((c) => s.cand[c] & (1 << v));
    if (spots.length === 1 && spots[0] === cell && !RC[r].some((c) => s.val[c] === v)) return "hidden";
    if (s.cand[cell] === 1 << v) return "naked";
    return null;
  }

  // ---------- anvendelser af teknikker (alle, eller kun den første)
  function neighborApps(s, first) {
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
        if (targets.length) {
          out.push({ tech: 2, region: r, v, spots, targets });
          if (first) return out;
        }
      }
    }
    return out;
  }
  function nakedApps(s, k, first) {
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
        if (targets.length) {
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
  function hiddenApps(s, k, first) {
    const out = [];
    for (let r = 0; r < nr; r++) {
      const cells = RC[r];
      let placed = 0;
      for (const c of cells) if (s.val[c]) placed |= 1 << s.val[c];
      const open = ((1 << (cells.length + 1)) - 2) & ~placed;
      if (pc(open) <= k) continue;
      for (let m = open; m > 0; m = (m - 1) & open) {
        if (pc(m) !== k) continue;
        const spots = cells.filter((c) => !s.val[c] && s.cand[c] & m);
        if (spots.length !== k) continue;
        const targets = [];
        for (const c of spots) {
          const extra = s.cand[c] & ~m;
          if (extra) targets.push({ cell: c, mask: extra });
        }
        if (targets.length) {
          out.push({ tech: k === 2 ? 4 : 6, region: r, mask: m, cells: spots, targets });
          if (first) return out;
        }
      }
    }
    return out;
  }
  // Kæde: stærke led (felt med to muligheder / tal med to pladser i en region) skiftevis med svage led.
  // Kortest mulige kæder findes først (iterativ uddybning).
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
          addS(c * 8 + lo, c * 8 + hi);
        }
    if (mode !== "xy")
      for (let r = 0; r < nr; r++) {
        const cells = RC[r];
        for (let d = 1; d <= cells.length; d++) {
          if (cells.some((c) => s.val[c] === d)) continue;
          const sp = cells.filter((c) => !s.val[c] && s.cand[c] & (1 << d));
          if (sp.length === 2) addS(sp[0] * 8 + d, sp[1] * 8 + d);
        }
      }
    return strong;
  }
  const weakLink = (a, b, mode = "all") =>
    a !== b && ((a >> 3 === b >> 3 && mode !== "x") || ((a & 7) === (b & 7) && peer(a >> 3, b >> 3)));
  function weakNbrs(s, k, mode = "all") {
    const c = k >> 3,
      d = k & 7,
      out = [];
    if (mode !== "x") for (const e of bitsOf(s.cand[c])) if (e !== d) out.push(c * 8 + e);
    for (const p of peers[c]) if (!s.val[p] && s.cand[p] & (1 << d)) out.push(p * 8 + d);
    return out;
  }
  function groupTargets(keys) {
    const m = new Map();
    for (const z of keys) m.set(z >> 3, (m.get(z >> 3) || 0) | (1 << (z & 7)));
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
              out.push({ tech, nodes: path.slice(), cells: [...new Set(path.map((x) => x >> 3))], targets, relCount: k, memPeak: 2 });
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

  // Arbejdshukommelse: hvor mange fakta der er "levende" (skal bruges senere) på samme tid.
  // Som registerallokering i en compiler: et faktum lever fra det findes, til det sidst bruges.
  // Antagelsen (node 0) skal huskes helt til konklusionen.
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

  // Hvis-så med ét tal: antag c0 = x og følg kun tallet x via "eneste plads" i regionerne.
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

  // Begge veje: følg begge muligheder (felt med to muligheder / tal med to pladser) med enkle træk
  // og sporer, hvilke skridt der fører til det fælles resultat.
  function runBranch(s, c0, v0) {
    const t = clone(s),
      removedBy = new Map(),
      placedBy = new Map();
    const record = (b, after, node) => {
      for (let c = 0; c < n; c++) {
        if (after.val[c] && !b.val[c]) placedBy.set(c, node);
        for (const d of bitsOf(b.cand[c] & ~after.cand[c])) if (!removedBy.has(c * 8 + d)) removedBy.set(c * 8 + d, node);
      }
    };
    const depsOfCell = (q, b, out) => {
      if (placedBy.has(q)) out.add(placedBy.get(q));
      for (const d of bitsOf(s.cand[q] & ~b.cand[q])) {
        const x = removedBy.get(q * 8 + d);
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
              const y = removedBy.get(o * 8 + x.v);
              if (y !== undefined) deps.add(y);
            }
          }
      place(t, x.cell, x.v);
      nodes.push({ deps });
      chain.push({ kind: "place", single: x });
      record(b, t, nodes.length - 1);
    }
    if (t.broken) return null;
    // relevante skridt for et mål (celle g mister maske m)
    const relFor = (g, m) => {
      const root = new Set();
      if (placedBy.has(g)) root.add(placedBy.get(g));
      for (const d of bitsOf(m)) {
        const x = removedBy.get(g * 8 + d);
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
        const x = removedBy.get(g * 8 + d);
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

  // Ét skridt i en hvis-så-kæde (simpleste først), med detaljer til forklaringen
  function chainStep(s, maxLevel) {
    const sg = singles(s);
    if (sg.length) {
      const x = sg[0];
      place(s, x.cell, x.v);
      return { kind: "place", single: x };
    }
    // tomme regioner-pladser er modstrid
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
  // Hvis-så med sporing: hvert skridt i kæden får en liste over de tidligere skridt, det bygger på.
  // Bagefter spores baglæns fra modstriden, så kun de skridt der faktisk bærer argumentet tælles.
  function runTrial(s, cell, v, inner) {
    const t = clone(s);
    const removedBy = new Map(),
      placedBy = new Map();
    const key = (c, d) => c * 8 + d;
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
    const nodes = [{ deps: new Set() }]; // node 0 = antagelsen
    let b = clone(t);
    place(t, cell, v);
    record(b, t, 0);
    const chain = [];
    let guard = 0;
    while (!t.broken && !solved(t) && guard++ < 400) {
      b = clone(t);
      const st = chainStep(t, inner);
      if (!st) break;
      if (st.kind === "stop") break;
      const id = nodes.length,
        deps = new Set();
      if (st.kind === "place") {
        const x = st.single,
          r = region[x.cell];
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
    // modstridens afhængigheder
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
  function trialApps(s, inner, first) {
    const out = [];
    for (let sz = 2; sz <= 5; sz++)
      for (let c = 0; c < n; c++) {
        if (s.val[c] || pc(s.cand[c]) !== sz) continue;
        for (const v of bitsOf(s.cand[c])) {
          const r = runTrial(s, c, v, inner);
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

  // ---------- gyldighed ved genafspilning (efter beskæring)
  function refresh(T, a) {
    // returnerer en opdateret kopi af anvendelsen hvis dens præmis stadig holder i T, ellers null
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
      for (const k of a.nodes) if (T.val[k >> 3] || !(T.cand[k >> 3] & (1 << (k & 7)))) return null;
      for (let i = 0; i + 1 < a.nodes.length; i += 2) {
        const x = a.nodes[i],
          y = a.nodes[i + 1];
        if (x >> 3 === y >> 3) {
          if (pc(T.cand[x >> 3]) !== 2) return null;
        } else {
          const d = x & 7,
            r = region[x >> 3];
          const sp = RC[r].filter((c) => !T.val[c] && T.cand[c] & (1 << d));
          if (sp.length !== 2 || RC[r].some((c) => T.val[c] === d)) return null;
        }
      }
      const targets = a.targets.map((t) => ({ cell: t.cell, mask: T.cand[t.cell] & t.mask })).filter((t) => !T.val[t.cell] && t.mask);
      return targets.length ? { ...a, targets } : null;
    }
    // hvis-så
    if (T.val[a.cell] || !(T.cand[a.cell] & (1 << a.v))) return null;
    const r = a.tech === 10 ? nishioRun(T, a.cell, a.v) : runTrial(T, a.cell, a.v, a.tech === 11 ? 1 : 8);
    return r ? { ...a, chain: r.chain, broken: r.broken, relCount: r.relCount, memPeak: r.memPeak } : null;
  }
  function replay(S0, list, cell, v) {
    const T = clone(S0),
      out = [];
    for (const a of list) {
      const b = refresh(T, a);
      if (!b) continue; // skridtet er overflødigt eller ikke længere begrundet her

      out.push({ app: b, before: clone(T) });
      apply(T, b);
      if (T.broken) return null;
    }
    const kind = singleHolds(T, cell, v);
    return kind ? { steps: out, kind, after: T } : null;
  }

  // ---------- det letteste næste tal
  function easiest(known) {
    const S0 = fromKnown(known);
    if (S0.broken || solved(S0)) return null;
    const sg = singles(S0);
    if (sg.length) return build(S0, { steps: [], kind: sg[0].kind, after: S0 }, sg[0].cell, sg[0].v);
    let S = clone(S0);
    const steps = [];
    const finish = (cell, v) => {
      // beskær skridt der ikke er nødvendige for netop dette tal
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
        const apps = levelApps(S, L);
        if (!apps.length) continue;
        let bestApp = null,
          bestSingle = null;
        for (const a of apps) {
          const T = clone(S);
          apply(T, a);
          if (T.broken) continue;
          const x = singles(T)[0];
          // foretræk: letteste teknik, korteste kæde (hvis-så), letteste tal bagefter
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

  // ---------- tekster (oversættes med tr(); se js/i18n.js)
  const nm = (c) => "abcdefghij"[c % cols] + (Math.floor(c / cols) + 1);
  const list = (arr) => (arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " " + tr("og") + " " + arr[arr.length - 1]);
  const vals = (m) => list(bitsOf(m).map(String));
  // "kan ikke være 4" / "kan hverken være 1 eller 2" / "kan hverken være 2, 3 eller 4"
  const cannot = (m) => {
    const b = bitsOf(m);
    return b.length === 1
      ? tr("kan ikke være {v}", { v: b[0] })
      : tr("kan hverken være {a} eller {b}", { a: b.slice(0, -1).join(", "), b: b[b.length - 1] });
  };
  const groupByMask = (targets) => {
    const g = new Map();
    for (const t of targets) {
      if (!g.has(t.mask)) g.set(t.mask, []);
      g.get(t.mask).push(t.cell);
    }
    return [...g];
  };
  const regionName = (r) => tr("regionen med {cells}", { cells: list(RC[r].map(nm)) });

  function stepText(a, k) {
    if (a.tech === 2) {
      const sp = list(a.spots.map(nm)),
        tg = list(a.targets.map((t) => nm(t.cell)));
      const all = a.spots.length === 2 ? tr("begge felter") : tr("alle {n} felter", { n: a.spots.length });
      return (
        tr("I {region} kan {v} kun stå i {spots}. Vi ved ikke hvor, men {v} lander i ét af dem.", { region: regionName(a.region), v: a.v, spots: sp }) +
        " " +
        (a.targets.length > 1
          ? tr("{cells} rører {all}, så de kan ikke være {v}.", { cells: tg, all, v: a.v })
          : tr("{cells} rører {all}, så den kan ikke være {v}.", { cells: tg, all, v: a.v }))
      );
    }
    if (a.tech === 3 || a.tech === 5) {
      const kk = a.cells.length,
        cs = list(a.cells.map(nm));
      const sameReg = a.cells.every((c) => region[c] === region[a.cells[0]]);
      let s =
        (sameReg
          ? tr("{cells} ligger i samme region og kan tilsammen kun være {vals}.", { cells: cs, vals: vals(a.mask) })
          : tr("{cells} ser hinanden og kan tilsammen kun være {vals}.", { cells: cs, vals: vals(a.mask) })) +
        " " +
        (kk === 2 ? tr("De to tal bliver altså brugt af netop de to felter.") : tr("De tre tal bliver altså brugt af netop de tre felter.")) +
        " ";
      s += groupByMask(a.targets)
        .map(([m, cs]) =>
          kk === 2
            ? tr("{cells} ser dem begge og {cannot}.", { cells: list(cs.map(nm)), cannot: cannot(m) })
            : tr("{cells} ser dem alle tre og {cannot}.", { cells: list(cs.map(nm)), cannot: cannot(m) }),
        )
        .join(" ");
      if (kk === 3 && a.targets.length === 1) {
        const four = a.cells.concat(a.targets[0].cell);
        const rs = four.map((c) => Math.floor(c / cols)),
          csx = four.map((c) => c % cols);
        if (Math.max(...rs) - Math.min(...rs) === 1 && Math.max(...csx) - Math.min(...csx) === 1)
          s += " " + tr("De fire felter er en 2×2-blok og skal derfor alle være forskellige.");
      }
      return s;
    }
    if (a.tech === 4 || a.tech === 6) {
      const cs = list(a.cells.map(nm));
      return (
        tr("I {region} kan {vals} kun stå i {cells}.", { region: regionName(a.region), vals: vals(a.mask), cells: cs }) +
        " " +
        (a.cells.length === 2
          ? tr("De to felter er altså optaget af de tal, selv om de har andre muligheder.")
          : tr("De tre felter er altså optaget af de tal, selv om de har andre muligheder.")) +
        " " +
        groupByMask(a.targets)
          .map(([m, cs]) => tr("{cells} {cannot}.", { cells: list(cs.map(nm)), cannot: cannot(m) }))
          .join(" ")
      );
    }
    if (isChain(a.tech)) return chainText(a).text;
    if (a.tech === 12) return bothText(a).conclusion;
    // hvis-så
    return trialText(a).text;
  }
  function placeSentence(x) {
    return x.kind === "naked"
      ? tr("{cell} kan kun være {v}", { cell: nm(x.cell), v: x.v })
      : x.kind === "last"
        ? tr("{cell} er sidste felt i sin region og bliver {v}", { cell: nm(x.cell), v: x.v })
        : tr("{v} kan kun stå i {cell} i sin region", { cell: nm(x.cell), v: x.v });
  }
  function bothText(a) {
    const r = a.root;
    const intro =
      r.kind === "cell"
        ? tr("{cell} kan kun være {a} eller {b}. Prøv begge veje.", { cell: nm(r.a[0]), a: r.a[1], b: r.b[1] })
        : tr("I {region} kan {v} kun stå i {a} eller {b}. Prøv begge veje.", { region: regionName(r.region), v: r.a[1], a: nm(r.a[0]), b: nm(r.b[0]) });
    const g = a.goal,
      m = a.targets[0].mask;
    const branchText = (br, k) => {
      const steps = br.chain.filter((x) => x.rel).map((x) => tr("så {step}", { step: placeSentence(x.single) }));
      const res = br.val ? `${nm(g)} = ${br.val}` : `${nm(g)} ${cannot(m)}`;
      return (
        tr("Vej {k}: hvis {cell} = {v},", { k, cell: nm(br.start[0]), v: br.start[1] }) +
        " " +
        (steps.length ? steps.join(", ") + ". " : "") +
        tr("Det giver {res}.", { res })
      );
    };
    const same = a.branches[0].val && a.branches[0].val === a.branches[1].val;
    const conclusion = same
      ? tr("Begge veje giver {cell} = {v}. Så er det sandt, uanset hvilken vej der er den rigtige.", { cell: nm(g), v: a.branches[0].val })
      : tr("Begge veje fører til, at {cell} {cannot}. Så gælder det, uanset hvilken vej der er den rigtige.", { cell: nm(g), cannot: cannot(m) });
    return { intro, b1: branchText(a.branches[0], 1), b2: branchText(a.branches[1], 2), conclusion };
  }
  function chainText(a) {
    const N = a.nodes,
      nc = (k) => nm(k >> 3),
      dg = (k) => k & 7,
      parts = [];
    parts.push(tr("Antag at {cell} ikke er {v}.", { cell: nc(N[0]), v: dg(N[0]) }));
    for (let i = 1; i < N.length; i++) {
      const prev = N[i - 1],
        cur = N[i];
      const p = { cell: nc(cur), v: dg(cur), prev: nc(prev) };
      if (i % 2 === 1)
        parts.push(
          prev >> 3 === cur >> 3
            ? tr("Så er {cell} = {v}, feltets eneste anden mulighed.", p)
            : tr("Så må {v} stå i {cell}, den eneste anden plads i regionen.", p),
        );
      else
        parts.push(
          prev >> 3 === cur >> 3
            ? tr("Så er {cell} ikke {v}.", p)
            : touch(prev >> 3, cur >> 3)
              ? tr("Så kan {cell} ikke være {v}, fordi den rører {prev}.", p)
              : tr("Så kan {cell} ikke være {v}, fordi den ligger i samme region som {prev}.", p),
        );
    }
    const Y = N[N.length - 1];
    const end =
      tr("Altså er enten {a} = {va}, eller {b} = {vb}.", { a: nc(N[0]), va: dg(N[0]), b: nc(Y), vb: dg(Y) }) +
      " " +
      groupByMask(a.targets)
        .map(([m, cs]) => tr("{cells} {cannot}, fordi det ville udelukke begge muligheder.", { cells: list(cs.map(nm)), cannot: cannot(m) }))
        .join(" ");
    const short = parts.length <= 7;
    const text = short
      ? parts.join(" ") + " " + end
      : tr("En kæde på {n} stærke led: hvis {a} ikke er {va}, ender det med at {b} = {vb}.", { n: a.relCount, a: nc(N[0]), va: dg(N[0]), b: nc(Y), vb: dg(Y) }) +
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
            ? tr("Så kan {cell} kun være {v}.", p)
            : x.kind === "last"
              ? tr("Så er {cell} sidste felt i sin region og bliver {v}.", p)
              : tr("Så kan {v} kun stå i {cell} i sin region.", p),
        );
      } else if (st.kind === "elim") {
        const b = st.app;
        const what = list(b.targets.map((t) => tr("{vals} fra {cell}", { vals: vals(t.mask), cell: nm(t.cell) })));
        parts.push(tr("{tech} fjerner {what}.", { tech: TECH_NAMES[b.tech], what }));
      }
    }
    const br = a.broken;
    const end =
      br.kind === "cell"
        ? tr("{cell} ikke har nogen mulige tal tilbage", { cell: nm(br.cell) })
        : br.kind === "region"
          ? tr("der ikke er plads til {v} i {region}", { v: br.v, region: regionName(br.region) })
          : tr("regnestykket ikke går op");
    const relChain = a.chain.filter((st) => st.rel);
    const nPl = relChain.filter((st) => st.kind === "place").length;
    const contra = tr("Det er en modstrid, så {cell} kan ikke være {v}.", { cell: nm(a.cell), v: a.v });
    if (a.tech === 10 && parts.length <= 6) {
      const mainEnd =
        br.kind === "region"
          ? tr("Nu er der ikke plads til {v} i {region}.", { v: br.v, region: regionName(br.region) })
          : tr("Nu går regnestykket ikke op.");
      return {
        text:
          tr("Antag {cell} = {v} (orange), og følg kun tallet {v}.", { cell: nm(a.cell), v: a.v }) +
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
        ? tr("Antag {cell} = {v} (orange), og følg kun tallet {v}:", { cell: nm(a.cell), v: a.v })
        : a.tech === 11
          ? tr("Antag {cell} = {v} (orange). Følg konsekvenserne med eneste kandidat og eneste plads:", { cell: nm(a.cell), v: a.v })
          : tr("Antag {cell} = {v} (orange). Følg konsekvenserne med alle teknikker op til hvis-så med ét tal:", { cell: nm(a.cell), v: a.v });
    const after =
      relChain.length === 1 ? tr("efter 1 skridt") : tr("efter {n} skridt", { n: relChain.length });
    const placedNote = nPl && nPl !== relChain.length ? " " + tr("({n} af dem sætter et tal)", { n: nPl }) : "";
    const text = intro + " " + after + placedNote + " " + tr("ender det med, at {end}.", { end }) + " " + contra;
    return { text, chain: parts };
  }

  function finalText(S0, res, cell, v, stepIdxOf) {
    const kind = res.kind,
      r = region[cell];
    if (kind === "last")
      return tr("{cell} er det eneste tomme felt i {region}, og regionen mangler kun {v}. Altså er {cell} = {v}.", { cell: nm(cell), region: regionName(r), v });
    if (kind === "naked") {
      const sz = size[cell],
        inReg = [],
        touching = [],
        fromStep = [];
      for (let u = 1; u <= sz; u++) {
        if (u === v) continue;
        if (RC[r].some((c) => S0.val[c] === u)) {
          inReg.push(u);
          continue;
        }
        const src = peers[cell].find((p) => S0.val[p] === u);
        if (src !== undefined) {
          touching.push(tr("{v} i {cell}", { v: u, cell: nm(src) }));
          continue;
        }
        fromStep.push([u, stepIdxOf(cell, u)]);
      }
      const bits = [];
      if (inReg.length) bits.push(tr("Regionen har allerede {vals}.", { vals: list(inReg.map(String)) }));
      if (touching.length)
        bits.push(tr("{list} rører feltet.", { list: list(touching) }));
      if (fromStep.length) {
        const byStep = new Map();
        for (const [u, k] of fromStep) {
          if (!byStep.has(k)) byStep.set(k, []);
          byStep.get(k).push(u);
        }
        bits.push([...byStep].map(([k, us]) => tr("{vals} blev fjernet i trin {k}.", { vals: list(us.map(String)), k })).join(" "));
      }
      return (
        tr("{cell} ligger i en region med {n} felter og kan være 1–{n}.", { cell: nm(cell), n: sz }) +
        " " +
        bits.join(" ") +
        " " +
        tr("Kun {v} er tilbage: {cell} = {v}.", { cell: nm(cell), v })
      );
    }
    // hidden
    const others = RC[r].filter((c) => c !== cell && !S0.val[c]);
    const bySrc = new Map(),
      stepped = [];
    for (const o of others) {
      const src = peers[o].find((p) => S0.val[p] === v && region[p] !== r);
      if (src !== undefined) {
        if (!bySrc.has(src)) bySrc.set(src, []);
        bySrc.get(src).push(o);
      } else stepped.push(o);
    }
    const bits = [];
    for (const [src, cs] of bySrc) bits.push(tr("{cells} rører {v}-tallet i {src}.", { cells: list(cs.map(nm)), v, src: nm(src) }));
    if (stepped.length) {
      const byStep = new Map();
      for (const o of stepped) {
        const k = stepIdxOf(o, v);
        if (!byStep.has(k)) byStep.set(k, []);
        byStep.get(k).push(o);
      }
      bits.push([...byStep].map(([k, cs]) => tr("{cells} mistede {v} i trin {k}.", { cells: list(cs.map(nm)), v, k })).join(" "));
    }
    return (
      tr("{Region} mangler {v}.", { Region: regionName(r)[0].toUpperCase() + regionName(r).slice(1), v }) +
      " " +
      bits.join(" ") +
      " " +
      tr("Så kan {v} kun stå i {cell}: {cell} = {v}.", { cell: nm(cell), v })
    );
  }

  // Arbejdshukommelse for hele vejen til ét tal. Et skridt afhænger direkte af et tidligere faktum, hvis
  // skridtets præmis ikke længere holder, når netop det faktum fjernes (alle andre fakta bevares).
  // Et faktum lever fra det findes til sidste skridt, der bruger det; toppen tæller også det, et skridt selv kræver.
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
    // 0: et skub uden svaret
    if (!steps.length) {
      view.push({
        nudge: true,
        text:
          res.kind === "naked"
            ? tr("Det næste tal kan findes med {tech}. Kig på det markerede felt: hvilke tal kan det ikke være?", { tech: TECH_NAMES[0].toLowerCase() })
            : tr("Det næste tal kan findes med {tech}. Kig på den markerede region: hvilket tal kan kun stå ét sted?", { tech: TECH_NAMES[1].toLowerCase() }),
        pattern: res.kind === "naked" ? [cell] : RC[region[cell]].filter((c) => !S0.val[c]),
        target: [],
        cand: {},
        strike: {},
      });
    } else {
      const a0 = steps[0];
      const pat = a0.tech === 2 ? a0.spots : a0.cells ? a0.cells : [a0.cell];
      view.push({
        nudge: true,
        text: tr("Det letteste næste tal kræver {tech}. Begynd ved de markerede felter. Tænk selv først, og tryk Næste for forklaringen.", {
          tech: TECH_NAMES[hardest].toLowerCase(),
        }),
        pattern: pat,
        target: [],
        cand: {},
        strike: {},
      });
    }
    // forklaringstrin
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
          const r = region[k >> 3];
          if (a.nodes.some((j, i) => i % 2 === 0 && (j & 7) === (k & 7) && region[j >> 3] === r && j !== k))
            RC[r].forEach((c) => {
              if (!st.val[c]) show.add(c);
            });
        });
      const cand = {},
        strike = {};
      for (const c of show) if (!st.val[c]) cand[c] = st.cand[c];
      for (const t of a.targets) strike[t.cell] = (strike[t.cell] || 0) | t.mask;
      const v1 = {
        title: tr("Trin {k}: {tech}", { k: i + 1, tech: TECH_NAMES[a.tech] }),
        tech: a.tech,
        text: stepText(a),
        pattern: pat,
        target: a.targets.map((t) => t.cell),
        cand,
        strike,
      };
      if (isChain(a.tech)) v1.chain = chainText(a).chain;
      if (a.tech === 12) {
        const bt = bothText(a);
        const hyp = (br) => {
          const h = { [br.start[0]]: br.start[1] };
          for (const x of br.chain) if (x.rel) h[x.single.cell] = x.single.v;
          return h;
        };
        const rootCells = a.cells;
        view.push({
          title: tr("Trin {k}: Begge veje · vej 1", { k: i + 1 }),
          tech: 12,
          text: bt.intro + " " + bt.b1,
          pattern: [],
          target: [a.goal],
          cand: {},
          strike: {},
          hypo: hyp(a.branches[0]),
        });
        view.push({
          title: tr("Trin {k}: Begge veje · vej 2", { k: i + 1 }),
          tech: 12,
          text: bt.b2,
          pattern: [],
          target: [a.goal],
          cand: {},
          strike: {},
          hypo: hyp(a.branches[1]),
        });
        view.push({
          title: tr("Trin {k}: Begge veje · konklusion", { k: i + 1 }),
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
          title: tr("Trin {k}: konklusion", { k: i + 1 }),
          tech: a.tech,
          text: tr("Antagelsen førte til en modstrid, så {cell} kan ikke være {v}.", { cell: nm(a.cell), v: a.v }),
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
    // svaret
    const fin = res.after;
    const show = new Set([cell]);
    if (res.kind !== "naked")
      RC[region[cell]].forEach((c) => {
        if (!fin.val[c]) show.add(c);
      });
    const cand = {};
    for (const c of show) if (!fin.val[c]) cand[c] = fin.cand[c];
    view.push({
      final: true,
      title: `${TECH_NAMES[finalTech]}`,
      tech: finalTech,
      text: finalText(S0, res, cell, v, stepIdxOf),
      pattern: res.kind === "naked" ? [] : RC[region[cell]].filter((c) => !S0.val[c] && c !== cell),
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
    // Hvor synligt er det sværeste skridt? Form, hvor fyldt området er, og hvor mange felters muligheder man skal kende.
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
      for (const c of [...pat, ...tg]) for (const k of G.king[c]) area.add(k);
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
      eliminations: steps.flatMap((a) => a.targets),
    };
  }

  // ---------- ruteanalyse: hvor svært var netop dette træk, og hvad var det letteste mulige lige da?
  // Én runde: brug teknikker op til niveau L, laveste først. true hvis noget ændrede sig.
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
  // Laveste niveau, hvor der overhovedet findes et næste tal
  // n = hvor mange felter der kunne sættes på det niveau (få muligheder er sværere at få øje på)
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
  // Laveste niveau, hvor netop (cell, v) kan ses direkte, uden at sætte andre tal først
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
  // Laveste niveau op til maxL, hvor (cell, v) kan findes ved først at sætte andre tal i hovedet.
  // placed = det mindste antal andre tal, der skal sættes (grådigt beskåret, hvert tal stadig begrundet).
  function closureWith(S0, cell, v, L, allowed) {
    const S = clone(S0),
      order = [];
    let depth = 0;
    for (let g = 0; g < 400; g++) {
      if (S.broken || !(S.cand[cell] & (1 << v))) return null;
      if (singleHolds(S, cell, v)) return { order, depth };
      const sg = singles(S).filter((x) => x.cell !== cell && (!allowed || allowed.has(x.cell)));
      if (sg.length) {
        for (const x of sg)
          if (!S.val[x.cell] && S.cand[x.cell] & (1 << x.v)) {
            place(S, x.cell, x.v);
            order.push(x.cell);
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
      return { level: L, depth: best.depth, placed: best.order.length };
    }
    return null;
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
  return {
    easiest,
    singles,
    fromKnown,
    routeMove,
    chainsAt: (cand, val, mode) => chainApps(st(cand, val), false, mode || "all"),
    bothAt: (cand, val) => bothWaysApps(st(cand, val), false),
  };
}
