// The statistics model: Focus, Skill and Performance (tools/stats/README.md documents every number).
// Focus: this game's easy moves (the basics) against your normal on that board size. Skill (a grade): how far up the
// grades the techniques you can do carry you (the repertoire) plus how fast you do the hard ones (speed). Performance (a
// grade): the level this game showed, from its time against what your own record predicts. Focus and Skill are made from
// different moves. Pure functions on a small record (statRec), updated once per game; it can be rebuilt from the games.
// Needs route.js (markErrors, moveLevel) and STAT_REF, STAT_PROFILE loaded first. Numbers come out unrounded: the
// screens round them (grades to one decimal, Focus to a whole %).

const SM = {
  V: "2026-11-28", // the model's version: a stored record from another version is rebuilt from the games (statui.js)
  N_NORMAL: 15, // your normal: the median of your last N readings on a board size
  SESSION_GAP: 1800, // seconds without play that end a session; the normal is held still during a session
  W_WRONG: 5, // seconds added to Focus's reading per wrong number on a basic
  WIN: 40, // needs (spotting) kept per technique
  WIN_FIND: 80, // finds (speed) kept per technique: a find varies 3 to 5 times by itself, so speed needs more of them
  BASIC_GAMES: 40, // games in the normal pace (the basics' part of the repertoire)
  FLUENT: 3, // the basics' bar (÷ reference): an ordinary player is fluent; their score falls to 0 at K × FLUENT
  K: 10,
  START_SPOT: 0.3, // spotting before anything is known
  K_SPOT: 3, // a technique's own needs weigh against its start as if the start were 3 needs
  K_START: 3, // in Skill's band, the start itself is uncertain and shared by all techniques (a player who spots well
  // tends to spot well everywhere): drawn once per draw, weighing as 3 needs
  K_FAM: 10, // a family's rate weighs against START_SPOT as if the start were 10 needs
  START_DONE: 0.95, // completion (attempts not given up) before anything is known, weighing as 3 attempts
  K_DONE: 3,
  K_OWN: 10, // your speed on all hard techniques together weighs against the typical player's as if it were 10 finds
  K_TECH: 5, // a technique's own speed weighs against your speed on all of them as if that were 5 finds
  CUE: { drill: 1.6, camp: 1.3, train: 1.3 }, // a cued find's time × this = the same find in a game
  MISS_STRUGGLE: 2, // a miss drawn without records of its own: the time before the hint ÷ the typical find, until you
  // have 5 misses of your own (then your own median ratio)
  MIN_CELLS: 25, // Skill and Performance need at least a 5×5 board (a 4×4 has too few moves); Focus shows on any
  Z90: 1.645,
  DRAWS: 301, // draws for the expected time (its median)
  SAMPLES: 200, // draws for Skill's band
  PER_GRADE: (typeof STAT_REF !== "undefined" && STAT_REF.perGrade) || 1.7, // one grade of speed: how much longer the
  // hard steps take per grade, measured on exports at the profile's size (tools/stats/fit_reference.py)
};
const smFitted = () => typeof STAT_REF !== "undefined" && !(STAT_REF.fitted && STAT_REF.fitted.unfitted);
const smBasics = () => [TT.SINGLES, TT.code("neighbour")].filter((c) => c && TT.known(c));
const smIsBasic = (L) => smBasics().includes(L);
const smHard = (L) => !!L && L !== TT.GUESS && TT.known(L) && !smIsBasic(L);
const smAnchor = () => 1 / STAT_REF.expert; // the fitted typical player's time ÷ reference
// speed 0: the fitted player's hard steps, read as yours are (STAT_REF.hardMid: the middle-half mean of their log
// residuals against the fit)
const smSpeedAnchor = () => smAnchor() * Math.exp(STAT_REF.hardMid || 0);
// The middle-half mean of the logs of a list of ratios (the 25 % at each end left out, the edges by their share): steady
// where a median flips between quick spots and long searches, and still deaf to a lucky or an interrupted find.
function smMid(a) {
  const n = a.length;
  if (!n) return null;
  const s = a.map(Math.log).sort((x, y) => x - y),
    lo = n / 4,
    hi = (3 * n) / 4;
  let sum = 0,
    w = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.max(0, Math.min(i + 1, hi) - Math.max(i, lo));
    sum += k * s[i];
    w += k;
  }
  return sum / w;
}

// The frozen reference time of a move, in seconds (STAT_REF, fitted by tools/stats/fit_reference.py)
function smRef(L, places, fill, cells, len, grade) {
  const R = STAT_REF,
    b = smIsBasic(L);
  let x = R.lv[L] != null ? R.lv[L] : R.lv[TT.last()];
  const p2 = places === 2 ? 1 : 0,
    p3 = places >= 3 ? 1 : 0;
  x += b ? p2 * R.p2Basic + p3 * R.p3Basic + (R.pMoreBasic || 0) * Math.log(Math.max(places, 3) / 3) : p2 * R.p2Hard + p3 * R.p3Hard;
  if (b) x += R.fill * fill + R.fill2 * fill * fill;
  x += (b ? R.sizeBasic : R.sizeHard) * Math.log(cells / 36);
  if (TT.family(L) === "chain" || TT.family(L) === "whatif") x += R.len * Math.log(1 + (len || 0));
  if (grade) x += (b ? R.gradeBasic || 0 : R.gradeHard || 0) * (grade - 4);
  return Math.exp(x);
}

// One game as steps. Each placement: the technique the board needed (N, the route analysis's avail), the one you used
// (U), whether you got past it with help (a hint, a guess, a check for errors), its time with wrong numbers on the way,
// its own time, and the reference times for N and U. The per-move summary of older games knows only U.
function smSteps(g) {
  const cells = g.rows * g.cols,
    given = cells - (g.empty || 0),
    gr = g.value || 0,
    out = [];
  if (g.moves && g.moves.length && g.moves.some((m) => m.cls)) {
    // the error episodes and slips marked on a copy, whether or not the stored moves were marked (same seal on a rebuild);
    // a slip's time is already in the next move's (markSlips), so it is not added again
    const moves = markErrors(g.moves.map((m) => Object.assign({}, m)));
    let pend = 0,
      wrong = 0,
      j = 0;
    for (const m of moves) {
      if (m.cls === "wrong") {
        if (!m.slip) {
          pend += (m.dt || 0) / 1000;
          wrong++;
        }
        continue;
      }
      const N = m.avail || 0,
        U = m.cls === "hint" || m.cls === "guess" ? N : moveLevel(m);
      const filled = m.b ? [...m.b].filter((ch) => ch !== "0").length : given + j;
      const fill = Math.min(1, filled / cells),
        pl = m.nAvail || 1;
      out.push({
        N,
        U,
        miss: m.cls === "hint" || m.cls === "guess" || !!m.chk || !!m.hint,
        marked: m.cls === "hint" || !!m.hint,
        t: (m.dt || 0) / 1000 + pend,
        own: (m.dt || 0) / 1000,
        wrong,
        i: j,
        refN: N && N !== TT.GUESS ? smRef(N, pl, fill, cells, m.len, gr) : 0,
        refU: U && U !== TT.GUESS ? smRef(U, pl, fill, cells, m.len, gr) : 0,
      });
      pend = 0;
      wrong = 0;
      j++;
    }
  } else if (g.route && g.route.ctx) {
    g.route.ctx.forEach((e, j) => {
      if (!(e[1] > 0) || !e[0] || e[0] === TT.GUESS) return;
      const r = smRef(e[0], e[2] || 1, Math.min(1, (given + j) / cells), cells, e[3], gr);
      out.push({ N: 0, U: e[0], miss: false, marked: false, t: e[1] / 10, own: e[1] / 10, wrong: 0, i: j, refN: 0, refU: r });
    });
  }
  return out;
}

// What a game says, once
function smFacts(g) {
  const steps = smSteps(g),
    end = Date.parse(g.end) / 1000,
    full = !!(g.moves && g.moves.some((m) => m.cls));
  // the easy moves: a basic that the board needed and you used (the first move, the opening look, left out)
  const bas = steps.filter((s) => s.i > 0 && smIsBasic(s.U) && (!s.N || smIsBasic(s.N)) && !s.marked);
  const actual = bas.reduce((a, s) => a + s.t, 0) + SM.W_WRONG * bas.reduce((a, s) => a + s.wrong, 0),
    ref = bas.reduce((a, s) => a + s.refU, 0),
    ref2 = bas.reduce((a, s) => a + s.refU * s.refU, 0);
  // the expected time's own reading: seconds on every step the board needed a basic for, whatever you used for it
  // (a harder way round is part of how you usually play), against the basic's reference
  const easy = steps.filter((s) => s.i > 0 && !smHard(s.N || s.U) && (s.refN || s.refU)),
    timeE = easy.reduce((a, s) => a + s.t, 0),
    refE = easy.reduce((a, s) => a + (s.refN || s.refU), 0);
  const ratios = bas.map((s) => s.own / s.refU).sort((a, b) => a - b);
  // the spread of this game's easy moves (log, robust): the ordinary luck Focus's band is made of
  const lr = ratios.filter((x) => x > 0).map(Math.log),
    lm = smMedian(lr);
  const spread = lr.length >= 5 ? 1.4826 * smMedian(lr.map((x) => Math.abs(x - lm))) : null;
  // hints of games from before hints were marked in the moves: only the techniques are known (hintTechs, methods)
  const marked = steps.some((s) => s.marked);
  const oldHints = full && !marked && g.hints ? (g.hintTechs || []).map((m) => TT.unitOf(m)).filter(smHard) : [];
  return {
    id: g.id,
    end,
    start: end - (g.ms || 0) / 1000,
    size: g.cols + "x" + g.rows,
    full,
    grade: g.value || 0,
    nBasic: bas.length,
    nEff: ref2 > 0 ? (ref * ref) / ref2 : 0, // the reading is a sum: moves with long references weigh more
    reading: bas.length >= 3 && ref > 0 ? Math.log(actual / ref) : null, // Focus: with W_WRONG per wrong number
    readingT: easy.length >= 3 && refE > 0 && timeE > 0 ? Math.log(timeE / refE) : null, // the expected time's
    spread,
    medBasic: ratios.length ? ratios[ratios.length >> 1] : null,
    steps,
    oldHints,
  };
}

function statRecNew() {
  return { v: 3, tech: {}, basic: [], read: {}, lastEnd: 0, sessStart: 0, n: 0 };
}
const smMedian = (a) => {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y),
    k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};
const smPush = (a, x, n) => {
  a.push(x);
  if (a.length > n) a.splice(0, a.length - n);
};
// per technique: need = [[found 0/1, time ÷ reference]], att = finds' time ÷ reference, done = cued attempts [1/0]
const smTech = (R, L) => (R.tech[L] = R.tech[L] || { need: [], att: [], done: [] });

// ---------- Focus
// A record's reading: [end, reading (Focus), grade, reading (seconds only), spread of its easy moves]
const RD = { focus: 1, time: 3 };
// The readings your normal is made of: the last N on this size from before this session, each moved to this game's grade
// (a harder puzzle has longer searches before its easy moves: gradeGame per grade, fitted on exports); a size with fewer
// than 5 borrows the pooled readings (all sizes), shifted towards its own as its readings come in. Before any reading:
// the fitted player's typical game (STAT_REF.readStart, read the same way). k: RD.focus or RD.time.
function smNormalPool(R, size, grade, k = RD.focus) {
  const gg = STAT_REF.gradeGame || 0,
    at = (x) => x[k] + (grade && x[2] ? gg * (grade - x[2]) : 0);
  const before = (x) => x[0] < R.sessStart && x[k] != null;
  const own = (R.read[size] || []).filter(before).slice(-SM.N_NORMAL).map(at);
  if (own.length >= 5) return own;
  const all = Object.values(R.read)
    .flat()
    .filter(before)
    .sort((a, b) => a[0] - b[0])
    .slice(-SM.N_NORMAL)
    .map(at);
  if (!all.length) {
    if (own.length) return own;
    const st = STAT_REF.readStart || {};
    return [(k === RD.time ? st.time : st.focus) + gg * ((grade || 4) - 4)];
  }
  const off = own.length ? ((smMedian(own) - smMedian(all)) * own.length) / 5 : 0;
  return all.map((v) => v + off);
}
const smSpread = () => STAT_REF.spread || 0.75;
const smRobustSd = (a) => {
  const m = smMedian(a);
  return 1.4826 * smMedian(a.map((x) => Math.abs(x - m)));
};
// Focus for a game, from the record before it: {focus, lo, hi} or null. The 90 % band is luck: the ordinary spread of
// your easy moves (your own, from the games your normal is made of) over this game's effective number of them, and how
// well your normal is known (its readings' spread over their number).
function smFocus(R, f) {
  if (f.reading == null) return null;
  const pool = smNormalPool(R, f.size, f.grade),
    norm = smMedian(pool);
  const sp = (R.read[f.size] || []).filter((x) => x[0] < R.sessStart && x[4] != null).slice(-SM.N_NORMAL).map((x) => x[4]);
  const sig = sp.length >= 5 ? smMedian(sp) : smSpread(),
    cv = Math.sqrt(Math.exp(sig * sig) - 1),
    sGame = cv / Math.sqrt(Math.max(1, f.nEff));
  const sRead = pool.length >= 5 ? smRobustSd(pool) : (STAT_REF.readStart || {}).sd || 0.45,
    sNorm = (1.2533 * sRead) / Math.sqrt(pool.length);
  const se = Math.sqrt(sGame * sGame + sNorm * sNorm),
    v = norm - f.reading;
  return { focus: 100 * Math.exp(v), lo: 100 * Math.exp(v - SM.Z90 * se), hi: 100 * Math.exp(v + SM.Z90 * se) };
}

// ---------- Skill: the repertoire
// Spotting per hard technique: a Beta posterior whose start is layered: the family's rate (all its techniques together)
// pulled down towards START_SPOT by how little the family has, and never above the next easier technique in the family.
// Returns {a, b} (the posterior's counts) per code. start0: the start before anything is known (START_SPOT).
function smSpotting(R, start0 = SM.START_SPOT) {
  const fam = {};
  for (const c of TT.list())
    if (smHard(c)) {
      const T = R.tech[c],
        f = TT.family(c);
      fam[f] = fam[f] || [0, 0];
      if (T) {
        fam[f][0] += T.need.filter((x) => x[0]).length;
        fam[f][1] += T.need.length;
      }
    }
  const out = {},
    lastIn = {};
  for (const c of TT.list()) {
    if (!smHard(c)) continue;
    const f = TT.family(c),
      [F, N] = fam[f];
    let start = (F + SM.K_FAM * start0) / (N + SM.K_FAM);
    if (lastIn[f] != null) start = Math.min(start, lastIn[f]);
    const T = R.tech[c] || { need: [] },
      found = T.need.filter((x) => x[0]).length,
      n = T.need.length;
    const a = found + SM.K_SPOT * start,
      b = n - found + SM.K_SPOT * (1 - start);
    out[c] = { a, b, mean: a / (a + b), n };
    lastIn[f] = a / (a + b);
  }
  return out;
}
function smCompletion(R, c) {
  const d = (R.tech[c] && R.tech[c].done) || [],
    k = d.filter((x) => x).length;
  return { a: k + SM.K_DONE * SM.START_DONE, b: d.length - k + SM.K_DONE * (1 - SM.START_DONE) };
}
// The basics' score from your normal pace: 1 at or under FLUENT, falling in a straight line to 0 at K × FLUENT
function smFluent(R) {
  const pace = smMedian(R.basic) ?? smAnchor();
  return pace <= SM.FLUENT ? 1 : Math.max(0, 1 - (pace - SM.FLUENT) / ((SM.K - 1) * SM.FLUENT));
}
// 1 + the area under the clean-solve curve of the profile (STAT_PROFILE), for mastery m[code] (0..1)
function smRepertoire(m) {
  const P = STAT_PROFILE,
    bin = 0.25,
    bins = {};
  for (const [gr, units] of P.puzzles) {
    let ch = 1;
    for (const u of units) ch *= m[u] != null ? m[u] : SM.START_SPOT;
    const k = Math.floor(gr / bin);
    (bins[k] = bins[k] || []).push(ch);
  }
  const ks = Object.keys(bins)
    .map(Number)
    .sort((a, b) => a - b);
  if (!ks.length) return 1;
  const top = P.top || (ks[ks.length - 1] + 1) * bin;
  const avg = (k) => bins[k].reduce((a, b) => a + b, 0) / bins[k].length;
  let prev = null,
    area = 0;
  for (let k = Math.floor(1 / bin); k * bin < top; k++) {
    let v = bins[k] ? avg(k) : prev;
    if (v == null) v = avg(ks[0]);
    if (prev != null) v = Math.min(v, prev); // the curve only falls as the grade rises
    area += v * bin;
    prev = v;
  }
  return 1 + area;
}

// ---------- Skill: speed
// Per hard technique, the log of its typical time ÷ reference: the middle-half mean of its finds (smMid), pulled
// towards your speed on all hard techniques together, which is pulled towards the fitted typical player (speed 0) while
// you have few finds. Returns {mu: {code: log ratio}, sd: {code: its own uncertainty}, share: {code: how much of it is
// your speed on all of them}, own, sdOwn (that speed's uncertainty, shared by every technique in Skill's band)}
const smSpreadHard = () => STAT_REF.spreadHard || 1.25;
function smSpeedParts(R) {
  const all = [];
  for (const L in R.tech) for (const r of R.tech[L].att) all.push(r);
  const la = Math.log(smSpeedAnchor()),
    n0 = all.length;
  const own = n0 ? (n0 * smMid(all) + SM.K_OWN * la) / (n0 + SM.K_OWN) : la;
  const mu = {},
    sd = {},
    share = {};
  for (const c of TT.list()) {
    if (!smHard(c)) continue;
    const a = (R.tech[c] && R.tech[c].att) || [],
      n = a.length;
    mu[c] = n ? (n * smMid(a) + SM.K_TECH * own) / (n + SM.K_TECH) : own;
    sd[c] = (1.093 * smSpreadHard()) / Math.sqrt(n + SM.K_TECH); // the middle-half mean's uncertainty, with the start's weight
    share[c] = SM.K_TECH / (n + SM.K_TECH);
  }
  return { mu, sd, share, own, sdOwn: (1.093 * smSpreadHard()) / Math.sqrt(n0 + SM.K_OWN) };
}
// How often each hard technique appears in the profile's puzzles up to one grade above a repertoire
function smWeights(rep) {
  const w = {};
  for (const [gr, units] of STAT_PROFILE.puzzles) if (gr <= rep + 1) for (const u of units) if (smHard(u)) w[u] = (w[u] || 0) + 1;
  return w;
}
// Speed in grades: the weighted mean, over the techniques, of log(typical player ÷ your time) ÷ log(PER_GRADE)
function smSpeedShift(mu, w) {
  let s = 0,
    n = 0;
  const la = Math.log(smSpeedAnchor());
  for (const u in w) {
    s += w[u] * (la - (mu[u] != null ? mu[u] : la));
    n += w[u];
  }
  return n ? s / n / Math.log(SM.PER_GRADE) : 0;
}

// Skill: {grade, lo, hi (90 %), repertoire, speed, mastery}. The band: SAMPLES draws of every technique's spotting,
// completion and speed from their own uncertainty (seeded, so the same record gives the same band).
function smSkill(R) {
  const sp = smSpotting(R),
    fl = smFluent(R),
    parts = smSpeedParts(R);
  const mastery = {};
  for (const c of TT.list()) {
    if (smIsBasic(c)) mastery[c] = fl;
    else if (sp[c]) {
      const d = smCompletion(R, c);
      mastery[c] = sp[c].mean * (d.a / (d.a + d.b));
    }
  }
  const rep = smRepertoire(mastery),
    w = smWeights(rep),
    speed = smSpeedShift(parts.mu, w);
  // the band
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const gamma = (k) => {
    // Marsaglia–Tsang, k > 0
    if (k < 1) return gamma(k + 1) * Math.pow(rnd(), 1 / k);
    const d = k - 1 / 3,
      c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do {
        x = gauss();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = rnd();
      if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const beta = (a, b) => {
    const x = gamma(a),
      y = gamma(b);
    return x / (x + y);
  };
  const draws = [];
  for (let k = 0; k < SM.SAMPLES; k++) {
    const m = {},
      mu = {},
      spk = smSpotting(R, beta(SM.K_START * SM.START_SPOT, SM.K_START * (1 - SM.START_SPOT))),
      dOwn = parts.sdOwn * gauss(); // your speed on all hard techniques: one draw shared by every technique
    for (const c of TT.list()) {
      if (smIsBasic(c)) m[c] = fl;
      else if (spk[c]) {
        const d = smCompletion(R, c);
        m[c] = beta(spk[c].a, spk[c].b) * beta(d.a, d.b);
        mu[c] = parts.mu[c] + parts.share[c] * dOwn + parts.sd[c] * gauss();
      }
    }
    const r = smRepertoire(m);
    draws.push(r + smSpeedShift(mu, smWeights(r)));
  }
  draws.sort((a, b) => a - b);
  return {
    grade: rep + speed,
    lo: draws[Math.floor(0.05 * draws.length)],
    hi: draws[Math.floor(0.95 * draws.length)],
    repertoire: rep,
    speed,
    mastery,
    spotting: sp,
    speedParts: parts,
  };
}

// ---------- Performance
// Your median find time for a technique (÷ reference): what a hint adds to the step
function smMedFind(R, L, parts) {
  const a = R.tech[L] ? R.tech[L].att : [];
  if (a.length) return smMedian(a);
  const p = parts || smSpeedParts(R);
  return Math.exp(p.mu[L] != null ? p.mu[L] : p.own);
}
// The expected time of a game (its median, with the 10 % and 90 % draws), from the record before it: the basics and
// the first move at one of the readings your normal is made of; each step the board needed a hard technique for, at
// one of that technique's needs (a find at its time; a miss at its time plus your median find time, as Performance
// charges it), or at your typical time for it if it has no needs yet. A move made with a harder technique than needed
// is drawn as its need. Seeded, so the same game gives the same number.
// How long you struggle before a hint, ÷ your typical find: from your own misses once there are 5
function smStruggle(R) {
  const r = [];
  for (const L in R.tech) {
    const T = R.tech[L],
      fm = T.att.length ? smMedian(T.att) : null;
    if (fm) for (const x of T.need) if (!x[0] && x[1] != null) r.push(x[1] / fm);
  }
  return r.length >= 5 ? smMedian(r) : SM.MISS_STRUGGLE;
}
function smExpected(R, f, sp) {
  const pool = smNormalPool(R, f.size, f.grade, RD.time),
    parts = smSpeedParts(R),
    spot = sp || smSpotting(R),
    struggle = smStruggle(R);
  // a step the board needed a basic for is expected as that basic, at your usual pace on such steps (readingT)
  const hard = f.steps.filter((s) => s.i > 0 && smHard(s.N || s.U));
  const baseRef = f.steps.filter((s) => !hard.includes(s)).reduce((a, s) => a + (s.refN || s.refU), 0);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const totals = [];
  for (let d = 0; d < SM.DRAWS; d++) {
    let t = baseRef * Math.exp(pool[Math.floor(rnd() * pool.length)]);
    for (const s of hard) {
      const L = s.N || s.U,
        ref = s.refN || s.refU,
        needs = R.tech[L] ? R.tech[L].need.filter((x) => x[1] != null) : [];
      // its own needs with weight n ÷ (n + K_TECH); otherwise your typical time and spotting for it (as for speed)
      if (needs.length && rnd() < needs.length / (needs.length + SM.K_TECH)) {
        const x = needs[Math.floor(rnd() * needs.length)];
        t += ref * (x[1] + (x[0] ? 0 : smMedFind(R, L, parts)));
      } else {
        const mu = parts.mu[L] != null ? parts.mu[L] : parts.own,
          z = Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd()),
          find = Math.exp(mu + smSpreadHard() * z); // mu is the middle of your finds
        const p = spot[L] ? spot[L].mean : SM.START_SPOT;
        t += ref * (rnd() < p ? find : struggle * find + smMedFind(R, L, parts));
      }
    }
    totals.push(t);
  }
  totals.sort((a, b) => a - b);
  return { median: totals[totals.length >> 1], lo: totals[Math.floor(0.1 * totals.length)], hi: totals[Math.floor(0.9 * totals.length)] };
}

// The seal for a game, from the record before it; then the record is updated with the game.
function statAddGame(R, g) {
  const f = smFacts(g);
  if (f.start - R.lastEnd > SM.SESSION_GAP) R.sessStart = f.start;
  let seal = null;
  if (!g.revealed && g.solved !== false && f.steps.length) {
    const cells = g.rows * g.cols;
    const fo = smFocus(R, f);
    // sess: the session's start (seconds), so the statistics can mark sessions
    seal = { v: SM.V, focus: fo ? fo.focus : null, focusLo: fo ? fo.lo : null, focusHi: fo ? fo.hi : null, nBasic: f.nBasic, sess: R.sessStart };
    if (smFitted() && cells >= SM.MIN_CELLS) {
      const sk = smSkill(R),
        ex = smExpected(R, f, sk.spotting),
        parts = sk.speedParts;
      // a step got past with help costs the time spent plus your median find time for it (Performance only)
      const actual = (g.ms || 0) / 1000 + f.steps.filter((s) => s.miss && smHard(s.N)).reduce((a, s) => a + s.refN * smMedFind(R, s.N, parts), 0);
      const lg = Math.log(SM.PER_GRADE);
      const pg = (e) => sk.grade + Math.log(e / actual) / lg;
      Object.assign(seal, {
        perf: pg(ex.median),
        perfLo: pg(ex.lo),
        perfHi: pg(ex.hi),
        skill: sk.grade,
        skillLo: sk.lo,
        skillHi: sk.hi,
        rep: sk.repertoire,
        speed: sk.speed,
        expected: ex.median,
      });
    }
  }
  // update the record. Focus's readings from every size; Skill's data only from boards that can show Skill (a 4×4 has
  // too few moves, and its spotting and speed would carry over unadjusted)
  if (f.reading != null) smPush((R.read[f.size] = R.read[f.size] || []), [f.end, f.reading, f.grade, f.readingT, f.spread], 60);
  if (g.rows * g.cols >= SM.MIN_CELLS) {
    if (f.medBasic != null) smPush(R.basic, f.medBasic, SM.BASIC_GAMES);
    const skip = new Set(f.oldHints); // older hinted games: which steps were hinted is unknown, so those are left out
    for (const s of f.steps) {
      if (s.i === 0 || !f.full) continue; // a find counts where the board needed a hard technique, so it must be known
      if (smHard(s.N) && !skip.has(s.N)) smPush(smTech(R, s.N).need, [s.miss ? 0 : 1, s.t / s.refN], SM.WIN);
      if (!s.miss && smHard(s.N) && smHard(s.U) && s.refU && !skip.has(s.U)) smPush(smTech(R, s.U).att, s.own / s.refU, SM.WIN_FIND);
    }
    for (const c of f.oldHints) smPush(smTech(R, c).need, [0, null], SM.WIN);
  }
  R.lastEnd = Math.max(R.lastEnd, f.end);
  R.n++;
  return seal;
}

// A cued attempt (drill, campaign step, training board) at a hard technique: time in seconds, or -1 for a give-up
function statAddCued(R, L, sec, ref, source) {
  if (!smHard(L)) return;
  const T = smTech(R, L);
  smPush(T.done, sec < 0 ? 0 : 1, SM.WIN);
  if (sec >= 0) smPush(T.att, (sec / ref) * (SM.CUE[source] || 1), SM.WIN_FIND);
}

// Rebuild the record from the games (oldest first); returns the record and each game's seal by id
function statRebuild(list) {
  const R = statRecNew(),
    seals = {};
  for (const g of list.slice().sort((a, b) => Date.parse(a.end) - Date.parse(b.end))) {
    const s = statAddGame(R, g);
    if (s) seals[g.id] = s;
  }
  return { R, seals };
}
