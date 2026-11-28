"use strict";
// The statistics model tested through the real path (TODO.md, statistics): simulated players solve real generated
// puzzles step by step (the tutor's easiest next number); their raw moves, hint events and wrong numbers go through the
// app's own route analysis (analyzeRoute) into the stored format, and only then into statmodel.js.
//   node tools/stats/realpath.js
const fs = require("fs"), path = require("path"), WEB = path.join(__dirname, "../../web/");
const files = ["suguru/js/app", "shared/js/lang/da", "shared/js/i18n", "suguru/js/game", "suguru/js/engine", "shared/js/tutor", "suguru/js/gradew", "shared/js/grade", "suguru/js/code", "shared/js/route", "suguru/js/statref", "shared/js/statmodel", "suguru/js/statprof"];
const src = 'var localStorage={getItem(){return null}};var navigator={language:"en"};' + files.map((f) => fs.readFileSync(WEB + f + ".js", "utf8")).join("\n");
const A = new Function(src + "\nreturn {E:engineFactory(),generateGraded,createTutor,analyzeRoute,TT,SM,STAT_REF,smRef,smSkill,statRecNew,statAddGame};")();
const TT = A.TT;

// mulberry32 with a scrambled seed: neighbouring seeds (one per game) must not give similar draws (a plain LCG does)
function rng(seed) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  let a = (h ^ (h >>> 16)) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// A pool of real puzzles: 5×5 and 6×6, levels 2 to 10
const POOL = [];
const CACHE = process.env.POOL_CACHE; // a file to keep the generated puzzles in between runs
if (CACHE && fs.existsSync(CACHE)) for (const p of JSON.parse(fs.readFileSync(CACHE, "utf8"))) POOL.push(p);
if (!POOL.length) {
  const t0 = Date.now();
  for (const [rows, cols] of [[5, 5], [6, 6]])
    for (let lv = 2; lv <= 10; lv++)
      for (let s = 1; s <= 14; s++) {
        try {
          const p = A.generateGraded(A.E, { rows, cols, level: lv, must: 0, startAt: 0, seed: 7000 + 100 * lv + s + rows * 10000, budget: 1500, lo: 0, hi: 9, nuance: "alle", kind: "alle", maxRegion: 5, np: false });
          if (p && p.rating && p.rating.solved && p.grade) POOL.push(p);
        } catch (e) {}
      }
  console.log("puzzles", POOL.length, "in", Math.round((Date.now() - t0) / 1000), "s");
  if (CACHE) fs.writeFileSync(CACHE, JSON.stringify(POOL.map((p) => Object.assign({}, p, { givens: Array.from(p.givens), solution: Array.from(p.solution), region: Array.from(p.region) }))));
}
const tutors = new Map();
const tutorOf = (p) => {
  if (!tutors.has(p)) tutors.set(p, A.createTutor(A.E.makeGeometry(p.rows, p.cols), p.region));
  return tutors.get(p);
};

// A player: basic = time ÷ reference on the basics, ratio[L] on the hard techniques, spot[L] (chance of spotting
// without a hint), sigma, interrupt (per minute), att(i) (a slowdown for game i), err (wrong numbers per basic)
function player(o) {
  const hard = {};
  for (const c of TT.list()) if (!(c === 1 || c === 2)) hard[c] = 1;
  return Object.assign({ basic: 2, ratio: (L) => 2, spot: (L) => 0.9, sigma: 0.75, sigmaHard: 1.1, interrupt: 0, att: () => 1, err: 0.02, gradeEffect: A.STAT_REF.gradeGame || 0 }, o);
}

// Play one puzzle: returns a game record as the app stores it (after the route analysis)
function play(pl, p, gi, seed, t0) {
  const r = rng(seed), tu = tutorOf(p), cells = p.rows * p.cols, grade = p.grade.value;
  const known = Array.from(p.givens), moves = [], sim = [];
  let t = 0, hints = 0, slow = 0, j = 0;
  const hintTechs = [];
  const a = pl.att(gi) * Math.exp(pl.gradeEffect * (grade - 4)); // a harder puzzle: longer searches before easy moves
  const addTime = (sec) => {
    // interruptions arrive per minute of play; the next two moves after one are 20 % slower
    if (slow > 0) { sec *= 1.2; slow--; }
    if (r() < 1 - Math.exp(-(pl.interrupt / 60) * sec)) { sec += 10 + 30 * r(); slow = 2; }
    t += sec * 1000;
  };
  for (let guard = 0; guard < 200 && known.some((v) => !v); guard++) {
    const h = tu.easiest(known);
    if (!h) break;
    // the technique the board needs for this move, as the route analysis will see it (its avail), decides spotting;
    // the hint's own technique (its explanation) can be harder
    const rm = tu.routeMove(known.map((v, i) => v || 0), h.cell, h.v);
    const L = (rm && rm.avail) || h.hardestLevel, basic = L === 1 || L === 2;
    sim.push({ c: h.cell, L, tutorL: h.hardestLevel });
    const fill = known.filter((v) => v).length / cells;
    const ref = A.smRef(L, 2, fill, cells, 0, grade);
    if (basic) {
      addTime(ref * pl.basic * Math.exp(pl.sigma * gauss(r) - pl.sigma ** 2 / 2) * a);
      if (r() < pl.err) {
        const wrongV = (h.v % 3) + 1 === h.v ? (h.v % 3) + 2 : (h.v % 3) + 1;
        moves.push({ c: h.cell, v: wrongV, t: Math.round(t) });
        addTime(2);
      }
    } else {
      const ratio = pl.ratio(L);
      const found = r() < pl.spot(L);
      sim[sim.length - 1].found = found;
      // shaped like the exports' finds: one in ten a quick spot, the rest log-normal (robust spread 1.26 together)
      if (found) addTime(ref * ratio * Math.exp(r() < 0.1 ? -2.5 + 0.7 * gauss(r) : pl.sigmaHard * gauss(r)));
      else {
        addTime(ref * ratio * 3); // a struggle, then a hint
        hints++;
        hintTechs.push(TT.methods(L)[0]);
        moves.push({ hint: L, hc: h.cell, t: Math.round(t) });
        addTime(3);
      }
    }
    moves.push({ c: h.cell, v: h.v, t: Math.round(t) });
    known[h.cell] = h.v;
    j++;
  }
  const out = A.analyzeRoute(A.E, p, moves, null, null);
  const end = new Date(Date.UTC(2026, 0, 1) + t0 * 1000 + gi * 3600 * 1000);
  return { id: "rp" + gi + "_" + seed, end: end.toISOString(), ms: Math.round(t), rows: p.rows, cols: p.cols, empty: p.givens.filter((v) => !v).length, value: grade, solved: true, hints, hintTechs, moves: out, sim };
}

// Run a player through n games on the pool; returns per game {seal, skill, grade, g}
function run(pl, n, o = {}) {
  const R = A.statRecNew(), r = rng(o.seed || 3), out = [];
  for (let i = 0; i < n; i++) {
    const cand = POOL.filter((p) => p.grade.value >= (o.lo ?? 0) && p.grade.value <= (o.hi ?? 99));
    const p = cand[Math.floor(r() * cand.length)];
    const g = play(o.change && i >= o.change.at ? o.change.pl : pl, p, i, (o.seed || 3) * 7919 + i, 0);
    const seal = A.statAddGame(R, g);
    out.push({ seal, skill: A.smSkill(R).grade, g, R });
  }
  out.R = R;
  return out;
}
const results = [];
const check = (name, value, ok, limit) => results.push([ok ? "PASS" : "FAIL", name, typeof value === "number" ? value.toFixed(3) : value, limit]);
const tail = (o, k) => o.slice(-k);
const lastSkill = (o, k = 60) => mean(tail(o, k).map((x) => x.skill));
const perfMinusSkill = (o, k = 200) => med(tail(o, k).filter((x) => x.seal && x.seal.perf != null).map((x) => x.seal.perf - x.seal.skill));
function slope(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  const b = sxy / sxx, res = ys.map((y, i) => y - my - b * (xs[i] - mx));
  return [b, Math.sqrt(res.reduce((s, v) => s + v * v, 0) / (xs.length - 2) / sxx)];
}
const SP = (L) => ({ basic: 0.9, chain: 0.75 })[TT.family(L)] ?? 0.6; // by family, not by the code's number (the mixed triple is 14)
const N = 400;
const base = (o = {}) => player(Object.assign({ spot: SP }, o));

if (process.env.SETUP_ONLY) { module.exports = { A, POOL, play, run, player, base: (o = {}) => player(Object.assign({ spot: SP }, o)), tutorOf }; return; }
// C1 Performance centres on Skill (steady hints and no hints)
const B = run(base(), N);
check("C1: Performance − Skill, median (spotting 0.6–0.9, hints recorded)", perfMinusSkill(B), Math.abs(perfMinusSkill(B)) <= 0.1, "0 ± 0.1 grade");
const B1 = run(base({ spot: () => 1, err: 0 }), N);
check("C1: Performance − Skill, median (no hints)", perfMinusSkill(B1), Math.abs(perfMinusSkill(B1)) <= 0.1, "0 ± 0.1 grade");
// the record sees hints: spotting recovered
{
  const sp = A.smSkill(B.R).spotting;
  const pairs = sp[3] ? sp[3].mean : NaN, tri = sp[5] ? sp[5].mean : NaN;
  check("hints recorded: spotting for pairs (true 0.9)", pairs, Math.abs(pairs - 0.9) <= 0.07, "0.9 ± 0.07");
  check("hints recorded: spotting for triples (true 0.9)", tri, Math.abs(tri - 0.9) <= 0.1, "0.9 ± 0.1");
}
// C2 10 % faster at the hard steps: Skill and Performance up by log 1.1 ÷ log PER_GRADE grades
{
  const F = run(base({ ratio: () => 2 / 1.1 }), N);
  const want = Math.log(1.1) / Math.log(A.SM.PER_GRADE);
  const ds = lastSkill(F) - lastSkill(B);
  check(`C2: 10 % faster at the hard steps: Skill up (want ${want.toFixed(2)})`, ds, Math.abs(ds - want) <= 0.07, "± 0.07 grade");
  const dp = med(tail(F, 200).map((x) => x.seal.perf)) - med(tail(B, 200).map((x) => x.seal.perf));
  check("C2: ... Performance up", dp, Math.abs(dp - want) <= 0.12, `${want.toFixed(2)} ± 0.12 grade`);
  const df = Math.abs(med(tail(F, 300).map((x) => x.seal.focus)) - med(tail(B, 300).map((x) => x.seal.focus)));
  check("C3: ... Focus unchanged", df, df <= 2, "<= 2");
}
// C3 the basics 10 % faster: Skill unchanged
{
  const F = run(base({ basic: 2 / 1.1 }), N);
  const d = Math.abs(lastSkill(F) - lastSkill(B));
  check("C3: the basics 10 % faster: Skill unchanged", d, d <= 0.03, "<= 0.03 grade");
}
// C5 no trend with the grade: Focus and Performance − Skill. The players' times follow the reference's grade and size
// terms, so these check the pipeline (route analysis, reference, normal), not the reference: that is conditions.js on
// the exports
{
  const rows = tail(B, 300).filter((x) => x.seal && x.seal.focus != null);
  const [bf, sf] = slope(rows.map((x) => x.g.value), rows.map((x) => Math.log(x.seal.focus)));
  check("C5 (pipeline): Focus per grade", Math.exp(bf) - 1, Math.abs(bf) <= 2 * sf + 0.01, `0 within 2 SE (SE ${sf.toFixed(3)})`);
  const rp = rows.filter((x) => x.seal.perf != null);
  const [bp, spp] = slope(rp.map((x) => x.g.value), rp.map((x) => x.seal.perf - x.seal.skill));
  check("C5 (pipeline): Performance − Skill per grade", bp, Math.abs(bp) <= 2 * spp + 0.02, `0 within 2 SE (SE ${spp.toFixed(3)})`);
  const by = [5, 6].map((z) => med(rows.filter((x) => x.g.rows === z).map((x) => x.seal.focus)));
  check("C5 (pipeline): Focus by size 5×5 / 6×6", by.join(" / "), Math.abs(by[0] - by[1]) <= 6, "within 6");
}
// a busy room: an interruption every 2.5 minutes; getting faster still shows
{
  const Bz = run(base({ interrupt: 0.4 }), N), Fz = run(base({ interrupt: 0.4, ratio: () => 2 / 1.1 }), N);
  const F = run(base({ ratio: () => 2 / 1.1 }), N);
  const gq = lastSkill(F) - lastSkill(B), gz = lastSkill(Fz) - lastSkill(Bz);
  check("busy room: gain from 10 % faster vs quiet room", gz / gq, gz / gq >= 0.8, ">= 0.8");
  check("busy room: Performance − Skill, median", perfMinusSkill(Bz), Math.abs(perfMinusSkill(Bz)) <= 0.1, "0 ± 0.1 grade");
}
// a TV evening (5 games 15 % slower, one interruption a minute) in a settled player: Skill barely moves
{
  const tv = (i) => i >= 300 && i < 305;
  const T = run(base({ att: (i) => (tv(i) ? 1.15 : 1), interrupt: 0 }), 320, { change: { at: 300, pl: base({ att: (i) => (tv(i) ? 1.15 : 1), interrupt: 1 }) } });
  const C = run(base(), 320);
  const d = Math.abs(T[309].skill - C[309].skill);
  check("one TV evening: Skill moves", d, d <= 0.1, "<= 0.1 grade");
  const f = med(T.slice(300, 305).map((x) => x.seal.focus)), fc = med(C.slice(300, 305).map((x) => x.seal.focus));
  check("one TV evening: Focus in those games vs the twin", f / fc, f / fc < 0.85, "< 0.85");
}
// a new player: after 10 games, Skill's band already holds where the same player settles (its last 100 games)
{
  const s10 = B.slice(9).find((x) => x.seal && x.seal.skillLo != null).seal, later = lastSkill(B);
  check("a new player after 10 games: the band holds the settled Skill", `${later.toFixed(2)} in [${s10.skillLo.toFixed(2)}, ${s10.skillHi.toFixed(2)}]`, s10.skillLo <= later && later <= s10.skillHi, "inside the band");
}

for (const r of results) console.log(r[0], "|", r[1], "|", r[2], "|", r[3]);
console.log(results.filter((r) => r[0] === "PASS").length + "/" + results.length + " pass");
