"use strict";
// Replay exports through the statistics model (statmodel.js) and print what the seal would have shown:
//   node tools/stats/replay.js EXPORT.json [EXPORT.json ...]
const fs = require("fs"), path = require("path"), WEB = path.join(__dirname, "../../web/");
const PROF = process.env.PROF || WEB + "suguru/js/statprof.js";
function load() {
  const files = ["suguru/js/app", "shared/js/lang/da", "shared/js/i18n", "suguru/js/game", "suguru/js/gradew", "shared/js/route", "suguru/js/statref", "shared/js/statmodel"];
  let src = 'var localStorage={getItem(){return null}};var navigator={language:"en"};' + files.map((f) => fs.readFileSync(WEB + f + ".js", "utf8")).join("\n");
  src += "\n" + fs.readFileSync(PROF, "utf8");
  return new Function(src + "\nreturn {TT, SM, smFacts, smFocus, smSkill, statRecNew, statAddGame, statRebuild, smSpotting, smSpeedParts};")();
}
const M = load();
const list = require("./exports").loadExports(process.argv.slice(2));
const { R, seals } = M.statRebuild(list);
const rows = list.sort((a, b) => Date.parse(a.end) - Date.parse(b.end)).map((g) => [g.end.slice(5, 16), g.cols + "x" + g.rows, (g.value || 0).toFixed(1), Math.round(g.ms / 1000), seals[g.id]]);
module.exports = { M, R, seals, rows, list };
// as the screens will show them: grades to one decimal, Focus and seconds whole
const g1 = (x) => (x == null ? "–" : x.toFixed(1)), p0 = (x) => (x == null ? "–" : Math.round(x));
const show = (s) => s.perf == null ? `focus ${p0(s.focus)} [${p0(s.focusLo)}-${p0(s.focusHi)}] nb ${s.nBasic}`
  : `perf ${g1(s.perf)} [${g1(s.perfLo)}-${g1(s.perfHi)}] skill ${g1(s.skill)} [${g1(s.skillLo)}-${g1(s.skillHi)}] focus ${p0(s.focus)} [${p0(s.focusLo)}-${p0(s.focusHi)}] exp ${p0(s.expected)}s nb ${s.nBasic}`;
if (require.main === module) {
  for (const r of rows.slice(-25)) console.log(r.slice(0, 4).join(" "), r[4] ? show(r[4]) : "-");
  const sk = M.smSkill(R);
  console.log("Skill now", sk.grade.toFixed(2), "[" + sk.lo.toFixed(2) + "-" + sk.hi.toFixed(2) + "] repertoire", sk.repertoire.toFixed(2), "speed", sk.speed.toFixed(2));
  for (const c in sk.spotting) console.log(" ", c, M.TT.id(+c), "spot", sk.spotting[c].mean.toFixed(2), "needs", sk.spotting[c].n, "speed(log ratio)", sk.speedParts.mu[c].toFixed(2), "finds", (R.tech[c] ? R.tech[c].att.length : 0));
  const S = Object.values(seals);
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  console.log("seals", S.length, "median focus", med(S.filter((s) => s.focus != null).map((s) => s.focus)), "median perf − skill", med(S.filter((s) => s.perf != null).map((s) => s.perf - s.skill)).toFixed(2));
}
