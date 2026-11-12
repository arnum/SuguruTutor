// Baggrundsarbejde, så skærmen ikke fryser: generering af opgaver og ruteanalyse.
// Startes fra newgame.js (generering) og analysis.js (ruteanalyse).
importScripts("lang/en.js", "i18n.js", "engine.js", "tutor.js", "grade.js", "route.js");

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
