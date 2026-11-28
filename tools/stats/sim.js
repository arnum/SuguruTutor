"use strict";
// Simulated players for the statistics model (TODO.md, statistics step 2): node tools/stats/sim.js. Each check compares a player with a twin that
// differs in one thing only, on the same puzzles. Prints each check with its limit and PASS/FAIL.
const fs = require("fs"), path = require("path"), WEB = path.join(__dirname, "../../web/");
const PROF = process.env.PROF || WEB + "suguru/js/statprof.js";
function load() {
  const files = ["suguru/js/app", "shared/js/lang/da", "shared/js/i18n", "suguru/js/game", "suguru/js/gradew", "shared/js/route", "suguru/js/statref", "shared/js/statmodel"];
  let src = 'var localStorage={getItem(){return null}};var navigator={language:"en"};' + files.map((f) => fs.readFileSync(WEB + f + ".js", "utf8")).join("\n");
  src += "\n" + fs.readFileSync(PROF, "utf8");
  return new Function(src + "\nreturn {TT, SM, STAT_PROFILE, smRef, smSkill, smFacts, statRecNew, statAddGame};")();
}
const M = load(), TT = M.TT, P = M.STAT_PROFILE.puzzles;

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
// A find's time ÷ its typical time, shaped like the exports' finds (not like the model's assumption): one in ten a quick
// spot (about 12 times faster), the rest log-normal; together their robust spread is the measured 1.26 at sigmaHard 1.1
const hardDraw = (r, sigmaHard) => Math.exp(r() < 0.1 ? -2.5 + 0.7 * gauss(r) : sigmaHard * gauss(r));

// A player: ratio[L] = typical time ÷ reference for a find, spot[L] = chance of spotting, sigma = spread of one move,
// basicRatio, interrupt = interruptions per minute (10–40 s each, the next two moves 20 % slower), att = function(game)
// giving a multiplying slowdown, tvGames = function(game) → extra interruptions, sizeHard = how much more steeply than
// the reference this player's hard steps grow with the board (× (cells ÷ 36) ^ sizeHard)
function player(o) {
  return Object.assign({ basicRatio: 2, sigma: 0.75, sigmaHard: 1.1, ratio: {}, spot: {}, interrupt: 0, att: () => 1, extraInt: () => 0, hintAfter: 3, sizeHard: 0 }, o);
}
// the hard techniques: every unit but the basics (singles, neighbour elimination), from the table, so a new technique
// (the mixed triple, code 14, 28 Nov. 2026) is in it; a spotting rate by family, not by the code's number
const HARD = TT.list().filter((c) => c !== 1 && c !== 2);
const famSpot = (L) => ({ basic: 0.9, chain: 0.7 })[TT.family(L)] ?? 0.5;
function ability(base) {
  const ratio = {}, spot = {};
  for (const L of HARD) {
    ratio[L] = base.ratio(L);
    spot[L] = base.spot(L);
  }
  return { ratio, spot };
}

// One game for a player on a puzzle [grade, units]; the same seed gives the same puzzle layout for twins
function makeGame(pl, puzzle, gi, seed, opts = {}) {
  // r: the puzzle's randomness; rp: the player's; ri: the room's (its own stream, so a twin with interruptions draws
  // the same puzzle and the same player times, and differs only by the interruptions: common random numbers)
  const r = rng(seed), rp = rng(seed * 7 + 3), ri = rng(seed * 13 + 5);
  const nb = opts.nBasic || 26,
    cells = opts.cells || (nb <= 10 ? 16 : nb <= 30 ? 36 : 64);
  const hardUnits = puzzle[1].filter((u) => !(u === 1 || u === 2));
  // positions of the hard steps among the moves
  const total = nb + hardUnits.length + 1;
  const pos = new Set();
  hardUnits.forEach((u, k) => pos.add(1 + Math.floor(((k + 1) * (total - 1)) / (hardUnits.length + 1))));
  const moves = [];
  let clock = 0, slow = 0, hk = 0;
  const intRate = (pl.interrupt + pl.extraInt(gi)) / 60;
  const a = pl.att(gi);
  for (let j = 0; j < total; j++) {
    const hard = pos.has(j) && hk < hardUnits.length;
    const L = hard ? hardUnits[hk++] : r() < 0.85 ? 1 : 2;
    const places = 1 + Math.floor(r() * 3);
    const fill = Math.min(1, (cells - total + j) / cells); // as statmodel.js reads it from the per-move summary
    const ref = M.smRef(L, places, fill, cells, 0);
    let t, cls = "easy", wrongBefore = 0;
    if (!hard) t = ref * pl.basicRatio * Math.exp(pl.sigma * gauss(rp) - pl.sigma ** 2 / 2) * a;
    else {
      const sp = rp() < pl.spot[L];
      t = ref * pl.ratio[L] * hardDraw(rp, pl.sigmaHard) * Math.pow(cells / 36, pl.sizeHard) * a;
      if (!sp && opts.luckyL !== L) {
        t = ref * pl.ratio[L] * pl.hintAfter;
        cls = "hint";
      }
      if (opts.lucky && hk === 1) t = t * 0.25; // a lucky find: four times faster than this player would have been
      if (opts.luckyL === L) t = ref * pl.ratio[L] * 0.25; // a lucky find of a rare technique: spotted, and quickly
    }
    if (slow > 0) {
      t *= 1.2;
      slow--;
    }
    // interruptions arrive per minute of play
    let extra = 0;
    const lam = intRate * t;
    if (ri() < 1 - Math.exp(-lam)) {
      extra = 10 + 30 * ri();
      slow = 2;
    }
    if (opts.pauseAt === j) extra += 300;
    t += extra;
    if (!hard && rp() < (opts.errRate || 0)) {
      moves.push({ cls: "wrong", dt: 2000 });
      clock += 2;
    }
    moves.push({ cls, dt: Math.round(t * 1000), avail: L, nAvail: places });
    clock += t;
  }
  const end = new Date(Date.UTC(2026, 0, 1) + (opts.t0 || 0) * 1000 + gi * (opts.gap || 3600) * 1000);
  return { id: "g" + gi + "_" + seed, end: end.toISOString(), ms: Math.round(clock * 1000), rows: Math.round(Math.sqrt(cells)), cols: Math.round(Math.sqrt(cells)), empty: total, solved: true, moves, hintTechs: [] };
}

function pickPuzzle(r, lo, hi) {
  const c = P.filter((p) => p[0] >= lo && p[0] <= hi);
  return c[Math.floor(r() * c.length)];
}
// Run a player through n games; returns seals and Skill after each game
function run(pl, n, o = {}) {
  const R = M.statRecNew(), r = rng(o.seed || 11), out = [];
  for (let i = 0; i < n; i++) {
    const pz = pickPuzzle(r, o.lo ?? 3, o.hi ?? 7.5);
    const plNow = o.change && i >= o.change.at ? o.change.pl : pl;
    const g = makeGame(plNow, pz, i, (o.seed || 11) * 100003 + i, Object.assign({}, o.game || {}, o.gameAt ? o.gameAt(i) : {}));
    const seal = M.statAddGame(R, g);
    const sk = M.smSkill(R);
    out.push({ seal, skill: sk.grade, rep: sk.repertoire, g });
  }
  return out;
}
const med = (a) => { const s = a.filter((x) => x != null).slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const last = (o, k = 20) => mean(o.slice(-k).map((x) => x.skill));
const results = [];
function check(name, value, ok, limit) {
  results.push([ok ? "PASS" : "FAIL", name, typeof value === "number" ? value.toFixed(3) : value, limit]);
}

// the base player: typical times about twice the reference (the reference is set at an expert pace), spotting 0.85
const base = (o = {}) => player(Object.assign(ability({ ratio: (L) => 2 * (o.slower || 1), spot: famSpot }), o));
const N = 300;

// THE CONDITIONS the three numbers must meet together (TODO.md, statistics: "Conditions")
// C1 Performance centres on Skill: see the calibration checks below (four kinds of player, 1,200 games each).
// C2 x % faster at the hard steps raises Skill's index and Performance by x % once the record has caught up.
{
  const sp = famSpot;
  const A = run(base(), 600), B = run(player(ability({ ratio: () => 2 / 1.1, spot: sp })), 600);
  const want = Math.log(1.1) / Math.log(M.SM.PER_GRADE);
  const sk = mean(B.slice(-100).map((x) => x.skill)) - mean(A.slice(-100).map((x) => x.skill));
  check(`C2: 10 % faster at the hard steps: Skill up (want ${want.toFixed(2)})`, sk, Math.abs(sk - want) <= 0.04, "± 0.04 grade");
  const pf = med(B.slice(-300).map((x) => x.seal.perf)) - med(A.slice(-300).map((x) => x.seal.perf));
  check("C2: ... and Performance up", pf, Math.abs(pf - want) <= 0.08, "± 0.08 grade");
  const fd = Math.abs(med(A.map((x) => x.seal && x.seal.focus)) - med(B.map((x) => x.seal && x.seal.focus)));
  check("C3: ... Focus unchanged (Focus uses none of the hard steps)", fd, fd <= 1, "<= 1");
}
// C3 Skill uses none of Focus's data: the basics 10 % faster (below the fluent bar) leave Skill as it is
{
  const A = run(base(), N), B = run(base({ basicRatio: 2 / 1.1 }), N);
  const d = Math.abs(last(A) - last(B));
  check("C3: the basics 10 % faster: Skill unchanged", d, d <= 0.02, "<= 0.02 grade");
}
// C4 one grade of repertoire = one grade of speed: PER_GRADE times faster = one grade
{
  const sp = famSpot;
  const A = run(base(), 600), B = run(player(ability({ ratio: () => 2 / M.SM.PER_GRADE, spot: sp })), 600);
  const d = last(B, 100) - last(A, 100);
  check(`C4 (arithmetic, speed ÷ log perGrade; the convention itself is measured on exports): ${M.SM.PER_GRADE} times faster: Skill up`, d, Math.abs(d - 1) <= 0.05, "1.00 ± 0.05 grade");
}
// 2. a new technique learned (triples spotted 0.1 → 0.9)
{
  const ab = (s5) => player(ability({ ratio: () => 2, spot: (L) => (L === 5 ? s5 : famSpot(L)) }));
  const A = run(ab(0.1), N), B = run(ab(0.9), N);
  const d = last(B) - last(A);
  check("triples learned (spotting 0.1 → 0.9): Skill up", d, d >= 0.3, ">= 0.3 grade");
}
// 3. board mix: the same player on an easier and a harder mix that both contain every technique. Three seeds each,
// because spotting from 40 needs per technique carries its own noise (about ±0.07 per technique) into the repertoire
{
  const seeds = [11, 23, 37];
  const sk = (lo, hi) => mean(seeds.map((seed) => last(run(base(), 1000, { lo, hi, seed }), 300)));
  const d = Math.abs(sk(3, 9) - sk(5, 9.5));
  check("board mix 3–9 against 5–9.5, same player, 3 seeds × 1,000 games: Skill", d, d <= 0.2, "<= 0.2 grade apart");
}
// 4. a lucky hard game
{
  const A = run(base(), 200), B = run(base(), 200, { gameAt: (i) => (i === 150 ? { lucky: true } : {}) });
  const d = Math.max(...A.map((x, i) => Math.abs(x.skill - B[i].skill)));
  // unrounded: Performance − Skill moves with log(expected ÷ time); the same expected time, a shorter game
  const gainLog = Math.log(A[150].g.ms / B[150].g.ms) / Math.log(M.SM.PER_GRADE);
  check("one lucky hard game: Skill moves", d, d < 0.1, "< 0.1 grade");
  check("  ... Performance up (grades, unrounded)", gainLog, gainLog > 0 && B[150].seal.perf >= A[150].seal.perf, "> 0");
}
// 4b. a lucky find of a rare technique (what-if 1, spotted half the time) in a settled player: one find is evidence,
// but one game must not lift the repertoire
{
  const pz = P.find((p) => p[1].includes(9) && p[0] <= 7.5);
  const A = run(base(), 200);
  const R = M.statRecNew();
  for (const x of A) M.statAddGame(R, x.g);
  const before = M.smSkill(R).grade;
  M.statAddGame(R, makeGame(base(), pz, 200, 777, { luckyL: 9 }));
  const d = M.smSkill(R).grade - before;
  check("one lucky find of a rare technique (what-if 1): Skill moves", d, Math.abs(d) < 0.1, "< 0.1 grade");
}
// 4c. the board size: the same player on 5×5 against 7×7 boards (C5); and one whose hard steps grow faster with the
// board than the reference says
{
  // three seeds: one seed's Skill wanders ±0.2 grade with its 40-need and 80-find windows (seeds 11, 23, 37 gave
  // −0.26, +0.16, +0.21 on 28 Nov.), as much as the limit, so the check is on their mean
  const S = (pl, cells, nb, seed = 11) => run(pl, 600, { seed, game: { cells, nBasic: nb } });
  const pairs = [11, 23, 37].map((seed) => [S(base(), 25, 18, seed), S(base(), 49, 34, seed)]);
  const [a, b] = pairs[0];
  const d = mean(pairs.map(([x, y]) => last(x, 200) - last(y, 200)));
  check("board size 5×5 against 7×7, same player: Skill (mean of 3 seeds)", d, Math.abs(d) <= 0.2, "<= 0.2 grade apart");
  const c = S(base({ sizeHard: 0.3 }), 25, 18), e = S(base({ sizeHard: 0.3 }), 49, 34);
  const pm = (o) => med(o.slice(100).map((x) => x.seal.perf - x.seal.skill));
  results.push(["MEASURE", "  ... hard steps growing more steeply with size (+0.3): Skill 5×5 − 7×7 (grade)", (last(c, 200) - last(e, 200)).toFixed(3), "stated in the README"]);
  check("  ... and Performance − Skill on each size", `${pm(a).toFixed(2)} / ${pm(b).toFixed(2)}`, Math.abs(pm(a)) <= 0.1 && Math.abs(pm(b)) <= 0.1, "0 ± 0.1 grade (a player who plays one size)");
}
// 5. TV in a third of the games (extra interruptions 1 per minute, everything 10 % slower)
{
  const tv = (i) => i % 3 === 0;
  const A = run(base(), N), B = run(base({ att: (i) => (tv(i) ? 1.1 : 1), extraInt: (i) => (tv(i) ? 1 : 0) }), N);
  const fTv = med(B.filter((x, i) => tv(i)).map((x) => x.seal && x.seal.focus)), fNo = med(B.filter((x, i) => !tv(i)).map((x) => x.seal && x.seal.focus));
  check("TV in a third of games: Focus in TV games vs others", fTv / fNo, fTv < 0.85 * fNo, "TV games < 0.85 × others");
  const d = last(A) - last(B);
  results.push(["MEASURE", "  ... a habit: Skill lower than the quiet twin by (grade)", d.toFixed(3), "stated in the README"]);
}
// 6. busy room: an interruption every 2.5 min, against a quiet twin; and 10 % faster in both. The twins share their
// random draws (only the room differs); three seeds, because Skill wanders by itself (a find's time varies 3–5 times)
{
  const busy = (o = {}) => base(Object.assign({ interrupt: 0.4 }, o));
  const NB = 800, seeds = [11, 23, 37];
  const QS = seeds.map((seed) => run(base(), NB, { seed })), BS = seeds.map((seed) => run(busy(), NB, { seed }));
  const Q = QS[0], B = BS[0];
  const Qf = run(player(ability({ ratio: () => 1.8, spot: famSpot })), NB);
  const Bf = run(player(Object.assign(ability({ ratio: () => 1.8, spot: famSpot }), { interrupt: 0.4 })), NB);
  const gainQ = last(Qf, 300) - last(Q, 300), gainB = last(Bf, 300) - last(B, 300);
  check("busy room: gain from 10 % faster vs quiet room", gainB / gainQ, gainB >= 0.9 * gainQ, ">= 0.9");
  const win = (o, a, b) => mean(o.slice(a, b).map((x) => x.skill));
  const gap = (a, b) => mean(seeds.map((_, k) => win(QS[k], a, b) - win(BS[k], a, b)));
  const gap1 = gap(200, 500), gap2 = gap(500, 800);
  check("busy room: gap to the quiet twin steady (games 200–500 vs 500–800, 3 seeds)", Math.abs(gap1 - gap2), Math.abs(gap1 - gap2) <= 0.1, "<= 0.1 grade");
  results.push(["MEASURE", "  ... the busy room's constant: Skill lower than the quiet twin by (grade)", ((gap1 + gap2) / 2).toFixed(3), "stated in the README"]);
  // the noise floor: a player who does not change, games 200–800 in windows of 100
  const sds = QS.map((o) => { const m = [2, 3, 4, 5, 6, 7].map((k) => win(o, k * 100, k * 100 + 100)), mm = mean(m); return Math.sqrt(mean(m.map((x) => (x - mm) ** 2))); });
  results.push(["MEASURE", "  ... a player who does not change: Skill's wander (sd of 100-game means)", mean(sds).toFixed(3), "stated in the README"]);
}
// 7. calibration: Focus median 100 for 8, 26, 50 basics; Performance dots centred (no pauses), steady/erratic, spotting 0.6–1
for (const nb of [8, 26, 50]) {
  const A = run(base(), N, { game: { nBasic: nb } });
  const f = med(A.slice(50).map((x) => x.seal && x.seal.focus));
  check(`ordinary game, ${nb} basics: Focus median`, f, Math.abs(f - 100) <= 2, "100 ± 2");
}
// the 90 % band of Focus is luck: for a quiet player (no interruptions) it holds 100 in about 90 % of games
{
  const A = run(base(), 400);
  const S = A.slice(40).map((x) => x.seal).filter((x) => x && x.focus != null);
  const cov = S.filter((x) => x.focusLo <= 100 && 100 <= x.focusHi).length / S.length;
  check("Focus's 90 % band, quiet player: games whose band holds 100", cov, cov >= 0.85 && cov <= 0.95, "0.85 to 0.95");
}
for (const [nm, sh, sp] of [["steady", 0.6, 0.9], ["erratic", 1.2, 0.9], ["spotting 0.6", 1.0, 0.6], ["spotting 1", 1.0, 1.0]]) {
  const pl = player(Object.assign(ability({ ratio: () => 2, spot: () => sp }), { sigmaHard: sh }));
  const A = run(pl, 1200);
  const r = med(A.slice(80).map((x) => x.seal && x.seal.perf - x.seal.skill));
  check(`Performance dots, ${nm}: median − Skill`, r, Math.abs(r) <= 0.05, "0 ± 0.05 grade");
}
// 8. a session slowing 5 % per game (games 2 minutes apart, 8 per session, sessions a day apart)
{
  const pl = base({ att: (i) => Math.pow(1.05, i % 8) });
  const A = run(pl, 240, { game: { gap: 120 }, gameAt: (i) => ({ t0: Math.floor(i / 8) * 86400 }) });
  const byIdx = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => med(A.filter((x, i) => i >= 40 && i % 8 === k).map((x) => x.seal && x.seal.focus)));
  const xs = byIdx.map((v, k) => k), ys = byIdx.map((v) => Math.log(v)), mx = 3.5, my = ys.reduce((a, b) => a + b) / 8;
  const slope = xs.reduce((a, x, k) => a + (x - mx) * (ys[k] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  check("a session slowing 5 % per game: Focus by game in session " + byIdx.map((v) => Math.round(v)).join(" "), Math.exp(slope) - 1, Math.abs(Math.exp(slope) - 1 / 1.05) < 0.02, "≈ −4.8 % per game (± 2 %)");
}
// 9. noise: Skill's change per game once filled
{
  const A = run(base(), N);
  const ch = A.slice(100).map((x, i, a) => (i ? Math.abs(x.skill - a[i - 1].skill) : 0)).slice(1).sort((a, b) => a - b);
  check("Skill's change per game: median", ch[ch.length >> 1], ch[ch.length >> 1] < 0.05, "< 0.05 grade");
  check("Skill's change per game: top tenth", ch[Math.floor(ch.length * 0.9)], ch[Math.floor(ch.length * 0.9)] < 0.2, "< 0.2 grade");
}
// 10. anchors
{
  const top = run(player(ability({ ratio: () => 0.9, spot: () => 1 })), N);
  const basicsOnly = run(player(ability({ ratio: () => 30, spot: () => 0.01 })), N);
  const topGrade = Math.max(...M.STAT_PROFILE.puzzles.map((p) => p[0]));
  const repTop = mean(top.slice(-20).map((x) => x.rep));
  check("spotting 1 on everything: the repertoire near the top", `${repTop.toFixed(2)} of ${topGrade}`, repTop >= topGrade - 1, "within 1 of the top (the rarest techniques keep part of their start: little evidence)");
  const firstHard = Math.min(...M.STAT_PROFILE.puzzles.filter((p) => p[1].some((u) => u > 2)).map((p) => p[0]));
  check("basics only: Skill stops where hard techniques start", `${last(basicsOnly).toFixed(2)} (first hard ${firstHard})`, last(basicsOnly) <= firstHard + 0.5, "<= first hard grade + 0.5");
}
// 11. a hint after a struggle vs a twin who struggles as long and then finds it
{
  // same game, same struggle; one ends in a hint
  const pl = base();
  const R = M.statRecNew(), r = rng(5);
  for (let i = 0; i < 150; i++) M.statAddGame(R, makeGame(pl, pickPuzzle(r, 4, 7), i, 900 + i));
  const pz = P.find((p) => p[1].includes(5) && p[0] > 4.5);
  const g = makeGame(pl, pz, 999, 4242);
  const k = g.moves.findIndex((m) => m.avail === 5);
  const gHint = JSON.parse(JSON.stringify(g)), gFind = JSON.parse(JSON.stringify(g));
  gHint.moves[k].cls = "hint"; gHint.moves[k].dt = 120000; gFind.moves[k].dt = 120000;
  const R1 = JSON.parse(JSON.stringify(R)), R2 = JSON.parse(JSON.stringify(R));
  const sh = M.statAddGame(R1, gHint), sf = M.statAddGame(R2, gFind);
  check("hint after a 2-minute struggle vs finding it then: Performance", `${sh.perf} vs ${sf.perf}`, sh.perf <= sf.perf, "hint <= find");
}
{
}

for (const r of results) console.log(r[0], "|", r[1], "|", r[2], "|", r[3]);
console.log(results.filter((r) => r[0] === "PASS").length + "/" + results.filter((r) => r[0] !== "MEASURE").length + " pass");
