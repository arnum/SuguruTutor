// Background work, so the screen does not freeze: generating puzzles, route analysis and practice boards.
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
  "../../shared/js/drillgen.js",
);

const SE = engineFactory();

self.onmessage = (e) => {
  const d = e.data;
  if (d.type === "game") {
    self.postMessage({ type: "drill", id: d.id, board: findGame(SE, d) });
    return;
  }
  if (d.type === "drill") {
    self.postMessage({ type: "drill", id: d.id, board: findDrill(SE, d) });
    return;
  }
  if (d.type === "example") {
    self.postMessage({ type: "drill", id: d.id, board: findExample(SE, d) });
    return;
  }
  if (d.type === "route") {
    self.postMessage({ type: "route", list: analyzeRoute(SE, d.puzzle, d.moves, null, d.typ) });
    return;
  }
  let puzzle = generateGraded(SE, d, (tries, level, decimal) => self.postMessage({ type: "progress", tries, level, decimal }));
  // campaign and training: generateGraded starts the board where the technique is the next step (startAt)
  self.postMessage({ type: "done", puzzle });
};
