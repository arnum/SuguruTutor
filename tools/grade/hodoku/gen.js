"use strict";
// usage: node gen.js [per band] [out file]   (12 per band and puzzles.jsonl by default; bands 8-9 take minutes)
// Sudoku puzzles from the app's own generator, across the grade bands, with the app's grade, for comparison with HoDoKu
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, "../../../web");
const GWsrc = cp.execFileSync("python3", [path.join(__dirname, "../gen.py"), "--print-js", "--weights", path.join(__dirname, "../sudoku.json")], { encoding: "utf8" });
const F = (d, f) => fs.readFileSync(path.join(ROOT, d, f + ".js"), "utf8");
const src = [F("sudoku/js", "app"), F("shared/js", "lang/da"), F("shared/js", "i18n"), F("sudoku/js", "game"), F("sudoku/js", "engine"), F("shared/js", "tutor"), GWsrc, F("shared/js", "grade"), F("sudoku/js", "code")].join("\n");
const M = new Function('var localStorage={getItem(){return null}};var navigator={language:"en"};' + src + "\nreturn {E:engineFactory(),generateGraded};")();
const per = +process.argv[2] || 12, out = process.argv[3] || "puzzles.jsonl";
const seen = new Set();
for (let band = 1; band <= 9; band++) {
  let n = 0;
  for (let k = 0; k < per * 3 && n < per; k++) {
    const t0 = Date.now();
    const p = M.generateGraded(M.E, { rows: 9, cols: 9, level: band, must: 0, seed: band * 1000 + k * 7 + 1, budget: 15000, lo: 0, hi: 9, nuance: "alle", kind: "alle", maxRegion: 9, np: false });
    if (!p || !p.grade) continue;
    const s = Array.from(p.givens).join("");
    if (seen.has(s)) continue;
    seen.add(s);
    n++;
    fs.appendFileSync(out, JSON.stringify({ s, band, value: p.grade.value, gband: p.grade.band, level: p.rating.level, hardT: p.grade.hard ? p.grade.hard.T : null, peak: p.grade.peak, load: p.grade.load, ms: Date.now() - t0 }) + "\n");
  }
  console.log("band", band, "made", n);
}
