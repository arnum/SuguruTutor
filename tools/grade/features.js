#!/usr/bin/env node
// Features and terms for each game in an export, for calibrating the difficulty (see tools/grade/README.md).
//
//   node tools/grade/features.js export.json > games.csv
//   node tools/grade/features.js export.json --weights proposal.json > games.csv
//   node tools/grade/features.js export.json --game sudoku > games.csv
//
// Each game with a puzzle code is solved again with the app's own tutor and grader (web/suguru/js and web/shared/js), with the weights from
// tools/grade/weights.json or --weights. The CSV has one line per game: time, help, pencil use, both grades and
// each term in the heaviest step with and without pencil, plus how many steps each feature appears in.
// On stderr there is a short summary: how well each grade follows log(time) for clean games (solved, no hint/check),
// split by whether pencil was used. This way a proposal for weights can be tried without touching the app.
"use strict";
const fs = require("fs"),
  path = require("path");
const ROOT = path.resolve(__dirname, "..", ".."),
  SHARED = path.join(ROOT, "web", "shared", "js");
const args = process.argv.slice(2);
if (!args.length) {
  console.error("usage: node tools/grade/features.js export.json [--weights weights.json] [--game sudoku]");
  process.exit(1);
}
const gi = args.indexOf("--game"),
  GAMEID = gi >= 0 ? args[gi + 1] : "suguru";
const OWN = path.join(ROOT, "web", GAMEID, "js");
const wi = args.indexOf("--weights");
const weightsPath = wi >= 0 ? args[wi + 1] : path.join(__dirname, GAMEID === "suguru" ? "weights.json" : GAMEID + ".json");

// The weights as the app's GW object, derived by gen.py (the same derivation of the pencil rows as in the app)
const GWsrc = require("child_process").execFileSync("python3", [path.join(__dirname, "gen.py"), "--print-js", "--weights", weightsPath], { encoding: "utf8" });

// the same files and order as the game's worker; the weights from the weight file instead of js/gradew.js
const F = (d, f) => fs.readFileSync(path.join(d, f + ".js"), "utf8");
let src = [F(OWN, "app"), F(SHARED, "lang/da"), F(SHARED, "i18n"), F(OWN, "game"), F(OWN, "engine"), F(SHARED, "tutor"), GWsrc, F(SHARED, "grade"), F(OWN, "code")].join("\n");
const M = new Function(
  'var localStorage={getItem(){return null}};var navigator={language:"da"};' + src + "\nreturn {E:engineFactory(),createTutor,solveProfile,gradeFromSteps,stepEffort,decodePuzzle,PEN_TERMS,GW};",
)();

const exp = JSON.parse(fs.readFileSync(args[0], "utf8"));
const games = (exp.history || exp.games || exp).filter((g) => g && g.code);
const TERMS = ["e", "R", "memT", "lenT", "spot", "innerT", "nopenT", "multiT", "trialT", "builtT", "repeatT", "partialT", "lenPT"];
const FEATS = ["mem", "len", "opts", "multi", "trial", "built", "repeat", "partial"];
const head = ["id", "day", "sec", "solved", "hints", "checks", "revealed", "pen", "penUsed", "clean", "value", "np", "tg", "peak", "npPeak", "load", "npLoad", "T", "npT"]
  .concat(TERMS.map((t) => "pen_" + t), TERMS.map((t) => "np_" + t), FEATS.map((f) => "np_" + f), ["n_trial", "n_built", "n_repeat", "n_partial", "steps"]);
const out = [head.join(",")];
const sum = { pen: [], nopen: [], unknown: [] };
const cache = new Map();
for (const g of games) {
  let st = cache.get(g.code);
  if (st === undefined) {
    const d = M.decodePuzzle(g.code);
    st = d ? M.solveProfile(M.createTutor(M.E.makeGeometry(d.rows, d.cols), d.region), d.givens) : null;
    cache.set(g.code, st);
  }
  if (!st || !st.length) continue;
  const gr = M.gradeFromSteps(st),
    tg = M.gradeFromSteps(st, null).value,
    hardest = (pen) => {
      const ef = st.map((s) => M.stepEffort(s, pen));
      let hi = 0;
      ef.forEach((x, i) => {
        if (x.e > ef[hi].e + 1e-9) hi = i;
      });
      return { f: ef[hi], s: st[hi] };
    };
  const hp = hardest(true),
    hn = hardest(false);
  const penUsed = g.pen == null ? "" : g.pen >= 3 ? 1 : 0;
  const clean = g.solved && !g.hints && !g.checks && !g.revealed && g.ms > 0 ? 1 : 0;
  const n = (k) => st.filter((s) => s[k]).length;
  const r = (x) => (typeof x === "number" ? Math.round(x * 1000) / 1000 : x == null ? "" : x);
  out.push(
    [g.id, g.day, Math.round((g.ms || 0) / 1000), g.solved ? 1 : 0, g.hints || 0, g.checks || 0, g.revealed ? 1 : 0, g.pen == null ? "" : g.pen, penUsed, clean,
      gr.value, gr.np.value, tg, gr.peak, gr.np.peak, gr.load, gr.np.load, hp.s.T, hn.s.T]
      .concat(TERMS.map((t) => hp.f[t]), TERMS.map((t) => hn.f[t]), FEATS.map((f) => hn.s[f] || 0), [n("trial"), n("built"), n("repeat"), n("partial"), st.length])
      .map(r)
      .join(","),
  );
  // as in the app: with pencil for games with 3+ notes, without for fewer, and as you used to play for games from before pencil use was stored
  if (clean) (penUsed === "" ? sum.unknown : penUsed ? sum.pen : sum.nopen).push({ t: Math.log(g.ms / 1000), v: penUsed === "" ? tg : penUsed ? gr.value : gr.np.value });
}
process.stdout.write(out.join("\n") + "\n");
const corr = (a) => {
  if (a.length < 3) return null;
  const mx = a.reduce((s, x) => s + x.v, 0) / a.length,
    my = a.reduce((s, x) => s + x.t, 0) / a.length;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (const x of a) {
    sxy += (x.v - mx) * (x.t - my);
    sxx += (x.v - mx) ** 2;
    syy += (x.t - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
};
const line = (name, a) => `  ${name.padEnd(38)} ${String(a.length).padStart(5)} games   r(grade, log time) = ${corr(a) == null ? "-" : corr(a).toFixed(3)}`;
console.error(`${GAMEID} · weights: ${wi >= 0 ? weightsPath : path.relative(ROOT, weightsPath)} (fit ${M.GW.fit}); ${games.length} games, ${cache.size} different puzzles`);
console.error("clean games (solved, no hint, check or reveal):");
console.error(line("with pencil (3+ notes)", sum.pen));
console.error(line("without pencil", sum.nopen));
console.error(line("before pencil was stored (as you used to play)", sum.unknown));
