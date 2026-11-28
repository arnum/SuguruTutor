"use strict";
// Reads exports the way the app imports them (settings.js, main.js). An export made before the levels were renumbered
// (26 Nov 2026: the mixed pair came in as level 4, so the old levels 4–12 are now 5–13) has its games moved along first,
// as levelsGame in main.js does; without that, an old export's triples read as mixed pairs, its chains as triples, and
// so on up. Then the exports are merged: per game the version that kept the most (its moves, else its per-move summary),
// the newest export on a tie.
const fs = require("fs");
const upL = (L) => (typeof L === "number" && L >= 4 ? L + 1 : L);
const upLv = (x) => (typeof x === "number" && Math.floor(x / 100) >= 4 ? x + 100 : x);
function levelsGame(g) {
  if (typeof g.tech === "number") g.tech = upL(g.tech);
  if (Array.isArray(g.lv)) g.lv = g.lv.map(upLv);
  if (Array.isArray(g.moves))
    g.moves.forEach((m) => {
      for (const k of ["direct", "avail", "ahead"]) if (typeof m[k] === "number") m[k] = upL(m[k]);
    });
  if (g.route) {
    if (Array.isArray(g.route.ctx)) g.route.ctx.forEach((x) => (x[0] = upL(x[0])));
    if (g.route.times) {
      const n = {};
      for (const k in g.route.times) n[/^\d+$/.test(k) ? upL(+k) : k] = g.route.times[k];
      g.route.times = n;
    }
  }
  return g;
}
function loadExports(paths) {
  const docs = paths
    .filter((p) => p.endsWith(".json"))
    .map((p) => JSON.parse(fs.readFileSync(p, "utf8")))
    .sort((a, b) => ((a.exported || "") < (b.exported || "") ? -1 : 1));
  const best = {};
  for (const d of docs) {
    const old = (d.levelsV || 1) < 2;
    for (const g0 of d.history || []) {
      const g = old ? levelsGame(JSON.parse(JSON.stringify(g0))) : g0;
      const rank = g.moves && g.moves.length ? 2 : g.route && g.route.ctx ? 1 : 0;
      if (rank && rank >= ((best[g.id] && best[g.id][0]) || 0)) best[g.id] = [rank, g];
    }
  }
  return Object.values(best)
    .map((x) => x[1])
    .sort((a, b) => Date.parse(a.end) - Date.parse(b.end));
}
module.exports = { loadExports, levelsGame };
// node tools/stats/exports.js OUT.json EXPORT.json ...: the merged history, as the app would hold it (browser tests)
if (require.main === module) {
  const [out, ...paths] = process.argv.slice(2);
  const h = loadExports(paths);
  h.forEach((g) => delete g.seal);
  fs.writeFileSync(out, JSON.stringify(h));
  console.log(h.length, "games,", h.filter((g) => g.moves).length, "with moves");
}
