#!/usr/bin/env node
// Træk og led for hvert spil i en eksport, til kalibrering af sværhedsgraden (se tools/grade/README.md).
//
//   node tools/grade/features.js eksport.json > spil.csv
//   node tools/grade/features.js eksport.json --weights forslag.json > spil.csv
//
// Hvert spil med en opgavekode løses igen med appens egen tutor og grader (web/js), med vægtene fra
// tools/grade/weights.json eller --weights. CSV'en har én linje pr. spil: tid, hjælp, blyantsbrug, begge grader og
// hvert led i det tungeste skridt med og uden blyant, plus hvor mange skridt hvert træk optræder i.
// På stderr står en kort opsummering: hvor godt hver grad følger log(tid) for rene spil (løst, ingen hint/tjek),
// delt op efter om der blev brugt blyant. Sådan kan et forslag til vægte prøves uden at røre appen.
"use strict";
const fs = require("fs"),
  path = require("path");
const ROOT = path.resolve(__dirname, "..", ".."),
  W = path.join(ROOT, "web", "js");
const args = process.argv.slice(2);
if (!args.length) {
  console.error("brug: node tools/grade/features.js eksport.json [--weights vægte.json]");
  process.exit(1);
}
const wi = args.indexOf("--weights");
const weightsPath = wi >= 0 ? args[wi + 1] : path.join(__dirname, "weights.json");

// Vægtene som appens GW-objekt, udledt af gen.py (samme udledning af blyant-rækkerne som i appen)
const GWsrc = require("child_process").execFileSync("python3", [path.join(__dirname, "gen.py"), "--print-js", "--weights", weightsPath], { encoding: "utf8" });

let src = ["lang/en", "i18n", "engine", "tutor", "grade", "code"].map((f) => fs.readFileSync(path.join(W, f + ".js"), "utf8")).join("\n");
const block = /\/\/ <gen:weights>[\s\S]*?\/\/ <\/gen:weights>/;
if (!block.test(src)) throw new Error("markører mangler i grade.js");
src = src.replace(block, () => GWsrc);
const M = new Function(
  'var localStorage={getItem(){return null}};var navigator={language:"da"};' + src + "\nreturn {E:engineFactory(),createTutor,solveProfile,gradeFromSteps,stepEffort,decodePuzzle,PEN_TERMS,GW};",
)();

const exp = JSON.parse(fs.readFileSync(args[0], "utf8"));
const games = (exp.history || exp.games || exp).filter((g) => g && g.code);
const TERMS = ["e", "R", "memT", "lenT", "spot", "innerT", "nopenT", "multiT", "trialT", "builtT", "repeatT", "partialT"];
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
  // som i appen: med blyant for spil med 3+ noter, uden for færre, og som du plejede for spil fra før blyant blev gemt
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
const line = (name, a) => `  ${name.padEnd(38)} ${String(a.length).padStart(5)} spil   r(grad, log tid) = ${corr(a) == null ? "-" : corr(a).toFixed(3)}`;
console.error(`vægte: ${wi >= 0 ? weightsPath : "tools/grade/weights.json"} (fit ${M.GW.fit}); ${games.length} spil, ${cache.size} forskellige opgaver`);
console.error("rene spil (løst, ingen hint, tjek eller afsløring):");
console.error(line("med blyant (3+ noter)", sum.pen));
console.error(line("uden blyant", sum.nopen));
console.error(line("før blyant blev gemt (som du plejede)", sum.unknown));
