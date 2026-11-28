"use strict";
// Grade profiles for the statistics model's Skill: generated puzzles at one standard size per game, each with its grade
// and the techniques (units) its cheapest route used, each once. See tools/stats/README.md.
//   node tools/grade/profiles.js suguru|sudoku PER_LEVEL OUT.json
const fs = require("fs"), path = require("path"), WEB = path.join(__dirname, "../../web/");
const game = process.argv[2], per = +process.argv[3] || 20, out = process.argv[4];
function load(g) {
  const files = [g + "/js/app", "shared/js/lang/da", "shared/js/i18n", g + "/js/game", g + "/js/engine", "shared/js/tutor", g + "/js/gradew", "shared/js/grade", g + "/js/code"];
  const src = 'var localStorage={getItem(){return null}};var navigator={language:"en"};' + files.map((f) => fs.readFileSync(WEB + f + ".js", "utf8")).join("\n");
  return new Function(src + "\nreturn {E:engineFactory(),generateGraded,TT};")();
}
const A = load(game), TT = A.TT;
const size = game === "suguru" ? [6, 6, 5] : [9, 9, 9];
const list = [];
const t0 = Date.now();
// the generator's levels 2 to 12 (band-like targets), 'per' puzzles each: the same sample whatever units the table has
for (let L = 2; L <= 12; L++)
  for (let s = 1; s <= per; s++) {
    let p;
    try {
      p = A.generateGraded(A.E, { rows: size[0], cols: size[1], level: L, must: 0, startAt: 0, seed: 1000 * L + s, budget: 2500, lo: 0, hi: 9, nuance: "alle", kind: "alle", maxRegion: size[2], np: false });
    } catch (e) {
      continue;
    }
    if (!p || !p.rating || !p.rating.solved || !p.grade) continue;
    const units = [...new Set(p.rating.uses.map((n, m) => (n ? TT.unitOf(m) : 0)).filter(Boolean))].sort((a, b) => a - b);
    list.push([Math.round(p.grade.value * 100) / 100, units]);
  }
fs.writeFileSync(out, JSON.stringify({ game, rows: size[0], cols: size[1], made: new Date().toISOString().slice(0, 10), puzzles: list }));
console.log(game, list.length, "puzzles in", Math.round((Date.now() - t0) / 1000), "s");
