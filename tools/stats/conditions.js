"use strict";
// The conditions on real exports (TODO.md, statistics): C1 Performance centres on Skill; C5 no trend with the puzzle's
// grade or the board size, in Focus or in Performance − Skill.   node tools/stats/conditions.js EXPORT.json [...]
const fs = require("fs"), path = require("path"), WEB = path.join(__dirname, "../../web/");
function load(game) {
  const files = [game + "/js/app", "shared/js/lang/da", "shared/js/i18n", game + "/js/game", game + "/js/gradew", "shared/js/route", game + "/js/statref", "shared/js/statmodel", game + "/js/statprof"];
  const src = 'var localStorage={getItem(){return null}};var navigator={language:"en"};' + files.map((f) => fs.readFileSync(WEB + f + ".js", "utf8")).join("\n");
  return new Function(src + "\nreturn {TT, SM, statRebuild};")();
}
const games = (paths) => require("./exports").loadExports(paths);
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
function slope(xs, ys) {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  const b = sxy / sxx, res = ys.map((y, i) => y - my - b * (xs[i] - mx));
  const se = Math.sqrt(res.reduce((a, r) => a + r * r, 0) / (xs.length - 2) / sxx);
  return [b, se];
}
function run(game, paths, opts = {}) {
  const M = load(game);
  Object.assign(M.SM, opts.sm || {});
  const list = games(paths), { seals } = M.statRebuild(list);
  const rows = list.slice(opts.skip ?? 40).map((g) => [g, seals[g.id]]).filter((x) => x[1] && x[1].perf != null);
  const out = { n: rows.length };
  const pm = rows.map(([g, s]) => s.perf - s.skill);
  out.C1 = med(pm);
  // the first games too (a new record: little of its own yet)
  const first = list.slice(0, opts.skip ?? 40).map((g) => seals[g.id]).filter((s) => s && s.perf != null);
  out.C1_first = [first.length, med(first.map((s) => s.perf - s.skill))];
  const gr = rows.map(([g]) => g.value || 0), fo = rows.map(([g, s]) => Math.log(s.focus || 100));
  out.C5_perf_per_grade = slope(gr, pm);
  out.C5_focus_per_grade = slope(gr, fo).map((x) => Math.exp(x) - 1);
  const bands = [[0, 3], [3, 4.5], [4.5, 6], [6, 99]];
  out.byGrade = bands.map(([a, b]) => { const r = rows.filter(([g]) => g.value >= a && g.value < b); return [a + "-" + b, r.length, med(r.map(([g, s]) => s.perf - s.skill)).toFixed(2), med(r.map(([g, s]) => s.focus))]; });
  const sizes = [...new Set(rows.map(([g]) => g.cols + "x" + g.rows))];
  out.bySize = sizes.map((z) => { const r = rows.filter(([g]) => g.cols + "x" + g.rows === z); return [z, r.length, med(r.map(([g, s]) => s.perf - s.skill)).toFixed(2), med(r.map(([g, s]) => s.focus))]; });
  return out;
}
module.exports = { run };
if (require.main === module) {
  const paths = process.argv.slice(2).filter((a) => a.endsWith(".json"));
  const r = run("suguru", paths);
  console.log(JSON.stringify(r, (k, v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v), 1));
}
