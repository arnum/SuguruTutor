// Background work, so the screen does not freeze: generating puzzles and route analysis.
// Started from newgame.js (generation) and analysis.js (route analysis).
importScripts(
  "app.js",
  "../../shared/js/lang/da.js",
  "../../shared/js/i18n.js",
  "game.js",
  "engine.js",
  "../../shared/js/tutor.js",
  "gradew.js",
  "../../shared/js/grade.js",
  "../../shared/js/route.js",
);

const SE = engineFactory();

self.onmessage = (e) => {
  const d = e.data;
  if (d.type === "route") {
    self.postMessage({ type: "route", list: analyzeRoute(SE, d.puzzle, d.moves) });
    return;
  }
  const puzzle = generateGraded(SE, d, (tries, level, decimal) => self.postMessage({ type: "progress", tries, level, decimal }));
  self.postMessage({ type: "done", puzzle });
};
