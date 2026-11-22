// Difficulty: simulated human solution -> effort per step -> peak, load and the overall number.

// Finer difficulty: simulate a human solution (always the easiest next number) and measure
//  - memory: how many invisible facts (eliminations/chain steps) you must at most keep in mind to find one number
//  - timing: how early in the solution the hardest step comes
//  - load:   how large a share of the numbers needs more than the simple techniques
// The level (technique) decides the whole number; the profile decides the decimal within the level.
function solveProfile(tutor, givens) {
  const known = givens.slice();
  const empty0 = known.filter((v) => !v).length;
  const steps = [],
    seen = new Set(); // patterns used at earlier placements
  let placed = 0;
  while (known.some((v) => !v)) {
    const h = tutor.easiest(known);
    if (!h) return null;
    const repeat = h.sig != null && seen.has(h.sig) ? 1 : 0;
    if (h.sig != null) seen.add(h.sig);
    steps.push({
      L: h.hardestLevel,
      T: h.hardest,
      vis: h.vis,
      mem: h.mem,
      len: h.len,
      inner: h.inner || [],
      multi: h.multi || 0,
      trial: h.trial || 0,
      built: h.built || 0,
      partial: h.partial || 0,
      repeat,
      opts: h.opts,
      progress: placed / empty0,
    });
    known[h.cell] = h.v;
    placed++;
  }
  return steps;
}
// Difficulty as effort, not as a ladder of techniques.
// Each step in a simulated human solution gets an effort as a sum of named terms:
//   recognition (how hard the pattern is to spot), memory (things to keep in mind at once),
//   length (the number of links in the reasoning), overview (how few places there were to make progress), and terms that depend on
//   whether you use the pencil. The puzzle's number is the heaviest step plus a small addition for many heavy steps and for them
//   coming early.
// Three layers: features (tutor.js describes each step: technique, cells, memory, ...), weights (GW below, written from
// tools/grade/weights.json) and effort (stepEffort). A calibration only changes weights.json; see tools/grade/README.md.
// History: fitted to 17 puzzles with measured time (Nov. 2026, correlation with log(time) 0.89); pairs and triples raised after
// 93 puzzles (18 Nov., 0.75 -> 0.80); techniques inside what-ifs (19 Nov.); the grade without pencil (20 Nov.).
// pen = false: the grade without pencil; pen = null: as you used to play. The base values are fitted to games where what-ifs and chains over
// two-option cells were solved with pencil, triples sometimes, and the rest without (20 Nov. 2026). weights.json says per
// technique how large a share was with pencil; gen.py derives the grade with and without pencil from it.
// The weights (GW) are in the game's own js/gradew.js, written by tools/grade/gen.py.
// The effort for one step. pen: true = with pencil, false = without, null = as you used to play (the grade the weights are fitted to;
// used for games from before pencil use was recorded). The terms are added in a fixed order (the same as Java).
function stepEffort(s, pen = true) {
  const m = pen === null ? 2 : pen === false ? 1 : 0,
    T = s.T,
    P = GW.pencil;
  // Recognition = the pattern's base price + how well this particular case hides
  const base = 1.0 * (GW.recog[T] || 0),
    v = s.vis;
  let shapeT = 0,
    openT = 0,
    workT = 0;
  if (v) {
    if (T >= 2 && T <= 6) shapeT = GW.vis * (GW.shapeSize * Math.min(GW.shapeSizeCap, Math.max(0, v.size - 2)) + GW.shapeBent * v.bent);
    openT = GW.vis * GW.open * (GW.openMid - v.fill); // crowded gives a discount, open gives an addition
    workT = GW.vis * Math.max(GW.workLo, Math.min(GW.workHi, GW.workPer * (v.work - GW.workMid)));
  }
  const R = base + shapeT + openT + workT;
  const memT = P.mem[m][T] * Math.log2(1 + (s.mem || 0));
  const lenT = GW.len * Math.log2(1 + Math.max(0, (s.len || 1) - 1));
  const spot = GW.spot[Math.max(0, Math.min(4, s.opts == null ? 4 : s.opts))];
  const innerT = s.inner && s.inner.length ? GW.inner * Math.max(...s.inner.map((t) => GW.recog[t])) : 0;
  const nopenT = P.tech[m][T],
    multiT = Math.max(-P.multiCap, Math.min(P.multiCap, P.multi[m][T] * (s.multi || 0))),
    trialT = P.trial[m][T] * (s.trial || 0),
    builtT = P.built[m][T] * Math.log2(1 + (s.built || 0)),
    repeatT = -P.repeat[m][T] * (s.repeat ? R : 0),
    partialT = P.partial[m][T] * (s.partial || 0),
    // the length of the reasoning counts more without pencil (what-if: all the assumed numbers must be remembered)
    lenPT = (P.len ? P.len[m][T] : 0) * Math.log2(1 + Math.max(0, (s.len || 1) - 1));
  return {
    e: 1 + R + memT + lenT + spot + innerT + nopenT + multiT + trialT + builtT + repeatT + partialT + lenPT,
    R,
    base,
    shapeT,
    openT,
    workT,
    memT,
    lenT,
    spot,
    innerT,
    nopenT,
    multiT,
    trialT,
    builtT,
    repeatT,
    partialT,
    lenPT,
  };
}
// Terms that depend on the pencil (for explaining the difference between the grades)
const PEN_TERMS = ["memT", "nopenT", "multiT", "trialT", "builtT", "repeatT", "partialT", "lenPT"];
function gradeFromSteps(steps, pen = true) {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const N = steps.length,
    ef = steps.map((s) => stepEffort(s, pen === null || pen === false ? pen : true));
  let hi = 0;
  ef.forEach((x, i) => {
    if (x.e > ef[hi].e + 1e-9) hi = i;
  });
  const top = ef[hi],
    hs = steps[hi];
  const tech = Math.max(...steps.map((s) => s.L));
  // Overview: the average number of places to make progress. singlesFirst > 0: only the first steps (Pelánek 2011: the number
  // of easy moves over the first 20-30 steps predicts the time best for easy Sudoku; later everything becomes easy).
  const SF = GW.singlesFirst || 0,
    early = SF ? steps.slice(0, SF) : steps,
    avgOpts = early.reduce((a, s) => a + s.opts, 0) / early.length,
    narrow = steps.filter((s) => s.opts <= 1).length / N,
    nakedShare = steps.filter((s) => s.T === 0).length / N; // steps where only a naked single was possible
  const advCount = steps.filter((s) => s.L >= 2).length;
  let value,
    loadT = 0,
    earlyT = 0,
    nHard = 0,
    W = 0,
    peak;
  // Load: the sum of the effort in all non-trivial steps beyond the heaviest. Repeats of the same technique count less and less.
  const seen = {};
  ef.forEach((x, i) => {
    if (steps[i].L < 2) return;
    nHard++;
    const k = (seen[steps[i].T] = (seen[steps[i].T] || 0) + 1);
    if (i !== hi) W += Math.max(0, x.e - GW.loadOver) / (1 + GW.loadTechRepeat * (k - 1));
  });
  if (tech === 1) {
    // Only simple moves: the difficulty is how narrow the path is
    value =
      1 +
      GW.singlesK *
        (GW.singlesOptsW * clamp((GW.singlesOptsMid - avgOpts) / GW.singlesOptsSpan) +
          GW.singlesNarrowW * clamp(narrow / GW.singlesNarrowSpan) +
          (GW.singlesNakedW ? GW.singlesNakedW * clamp(nakedShare / GW.singlesNakedSpan) : 0));
  } else {
    loadT = GW.loadWeight * (1 - Math.exp(-W / GW.loadScale));
    earlyT = GW.early * (1 - hs.progress);
    peak = top.e + earlyT;
    value = peak + loadT;
  }
  if (tech === 1) peak = value;
  const load = tech === 1 ? 0 : Math.max(1, Math.min(10, Math.round(10 * (1 - Math.exp(-(W + Math.max(0, top.e - GW.loadOver)) / GW.loadCountScale)))));
  value = Math.max(1, Math.min(GW.cap, Math.round(value * 10) / 10));
  const band = Math.min(9, Math.floor(value)); // level 9 (Diabolical) covers everything from 9 up
  // The grade without pencil (the anchor, see tools/grade/weights.json) as a full grade object, so the explanation can show its own terms
  const np = pen !== null && pen !== false ? gradeFromSteps(steps, false) : null;
  return {
    np,
    value,
    level: band,
    band,
    decimal: Math.min(9, Math.round((value - band) * 10)), // 10 and above count as the top of level 9
    tech,
    total: N,
    advCount,
    avgOpts,
    narrow,
    mem: Math.max(...steps.map((s) => s.mem)),
    len: Math.max(...steps.map((s) => s.len || 0)),
    hard: {
      T: hs.T,
      L: hs.L,
      mem: hs.mem,
      len: hs.len,
      opts: hs.opts,
      progress: hs.progress,
      e: top.e,
      R: top.R,
      base: top.base,
      shapeT: top.shapeT,
      openT: top.openT,
      workT: top.workT,
      vis: hs.vis || null,
      memT: top.memT,
      lenT: top.lenT,
      spot: top.spot,
      innerT: top.innerT,
      inner: hs.inner || [],
      multi: hs.multi || 0,
      nopenT: top.nopenT,
      multiT: top.multiT,
      trialT: top.trialT,
      builtT: top.builtT,
      repeatT: top.repeatT,
      partialT: top.partialT,
      lenPT: top.lenPT,
      trial: hs.trial || 0,
      built: hs.built || 0,
      repeat: hs.repeat || 0,
      partial: hs.partial || 0,
    },
    fit: GW.fit,
    nHard,
    W,
    loadT,
    earlyT,
    peak: Math.round(Math.min(GW.cap, peak) * 10) / 10,
    load,
    series: ef.map((x, i) => (steps[i].L < 2 ? 0 : Math.round(x.e * 10) / 10)),
    lv: steps.map((s) => s.L * 100 + Math.min(99, s.opts || 1)), // for the personal time estimate
  };
}
const NUANCES = [
  { id: "alle", label: tr("All"), lo: 0, hi: 9 },
  { id: "mild", label: tr("Mild"), lo: 0, hi: 3 },
  { id: "middel", label: tr("Medium"), lo: 4, hi: 6 },
  { id: "haard", label: tr("Hard|band"), lo: 7, hi: 9 },
];
// Generate for a level AND a decimal range. Runs both in the background worker and as a fallback in the page.
function generateGraded(SE, d, onProgress) {
  // d.level is a difficulty band (1-9); d.must is an optional technique (1-11) the puzzle must need.
  const t0 = Date.now(),
    START = GAME.gradeStart || [0, 1, 2, 2, 3, 5, 6, 8, 9, 10]; // the technique level to start with per band
  let best = null,
    bestKey = Infinity,
    tries = 0,
    seed = d.seed,
    tt = d.must || START[d.level] || 2;
  while (true) {
    const left = d.budget - (Date.now() - t0);
    const p = SE.generate(d.rows, d.cols, tt, seed++, Math.max(1200, Math.min(4000, left)), null, d.maxRegion || 5);
    const steps = solveProfile(createTutor(SE.makeGeometry(d.rows, d.cols), p.region), p.givens);
    p.grade = steps ? gradeFromSteps(steps) : null;
    p.target = d.level;
    tries++;
    // d.np: the player plays without pencil, so the band applies to the grade without pencil
    const gv = p.grade ? (d.np && p.grade.np ? p.grade.np.value : p.grade.value) : null;
    const band = p.grade ? Math.min(9, Math.floor(gv)) : p.rating.level,
      dec = p.grade ? Math.min(9, Math.round((gv - band) * 10)) : 0;
    const key =
      (d.must ? Math.abs(p.rating.level - d.must) * 100 : 0) +
      Math.abs(band - d.level) * 10 +
      (dec < d.lo ? d.lo - dec : dec > d.hi ? dec - d.hi : 0) +
      (p.grade && d.kind === "kort" ? Math.max(0, p.grade.load - 3) : p.grade && d.kind === "lang" ? Math.max(0, 6 - p.grade.load) : 0);
    if (key < bestKey) {
      best = p;
      bestKey = key;
    }
    if (onProgress) onProgress(tries, band, dec);
    if (key === 0 || Date.now() - t0 > d.budget) break;
    // Search for the technique that hits the band most often: too easy -> a harder technique, too hard -> an easier one
    if (!d.must) tt = band < d.level ? Math.min(11, tt + 1) : band > d.level ? Math.max(d.level === 1 ? 1 : 2, tt - 1) : tt;
  }
  best.nuance = d.nuance;
  return best;
}
