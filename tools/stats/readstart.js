"use strict";
// The fitted player's typical game reading, read exactly as statmodel.js reads a game (smFacts), for Focus's normal
// and the expected time before a player has readings of their own. Called by fit_reference.py with the new reference:
//   node tools/stats/readstart.js GAME STATREF.js EXPORT.json [...]   → JSON {focus, time, sd} (log, at grade 4)
const fs = require("fs"), path = require("path"), WEB = path.join(__dirname, "../../web/");
const [game, refPath, ...paths] = process.argv.slice(2);
const files = [game + "/js/app", "shared/js/lang/da", "shared/js/i18n", game + "/js/game", game + "/js/gradew", "shared/js/route"];
const src = 'var localStorage={getItem(){return null}};var navigator={language:"en"};' + files.map((f) => fs.readFileSync(WEB + f + ".js", "utf8")).join("\n") +
  "\n" + fs.readFileSync(refPath, "utf8") + "\n" + fs.readFileSync(WEB + "shared/js/statmodel.js", "utf8");
const M = new Function(src + "\nreturn {smFacts, smMedian, STAT_REF};")();
const list = require("./exports").loadExports(paths);
const gg = M.STAT_REF.gradeGame || 0, F = [], T = [];
for (const g of list) {
  if (g.revealed || g.solved === false) continue;
  const f = M.smFacts(g);
  if (f.reading == null) continue;
  F.push(f.reading - gg * ((f.grade || 4) - 4));
  T.push(f.readingT - gg * ((f.grade || 4) - 4));
}
const m = M.smMedian(F), sd = 1.4826 * M.smMedian(F.map((x) => Math.abs(x - m)));
const r4 = (x) => Math.round(x * 10000) / 10000;
console.log(JSON.stringify({ focus: r4(m), time: r4(M.smMedian(T)), sd: r4(sd), games: F.length }));
