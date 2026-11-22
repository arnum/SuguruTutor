// Suguru: the game's rules as a model that the tutor, board and analysis build on.

// The names of the 14 techniques (the same order in both games; see tutor.js)
const TECH_LABELS = [
  tr("Naked single"),
  tr("Hidden single|suguru"),
  tr("Neighbour elimination"),
  tr("Naked pair"),
  tr("Hidden pair"),
  tr("Naked triple"),
  tr("Hidden triple"),
  tr("Single-number chain"),
  tr("Bivalue chain"),
  tr("Mixed chain"),
  tr("Single-number what-if"),
  tr("What-if with singles"),
  tr("Both ways"),
  tr("What-if with techniques"),
];

// ---------- Lists the shared code uses (core.js, newgame.js, stats.js, play.js)
const GUIDE_IDS = [
  "eneste-kandidat",
  "eneste-plads",
  "nabo-eliminering",
  "noegent-par",
  "skjult-par",
  "noegen-trippel",
  "skjult-trippel",
  "kaede-et-tal",
  "kaede-to-muligheder",
  "kaede",
  "hvis-saa-et-tal",
  "hvis-saa-kort",
  "begge-veje",
  "hvis-saa-dyb",
];
const TECH_NAMES_UI = [
  tr("naked single"),
  tr("hidden single|suguru"),
  tr("neighbour elimination"),
  tr("naked pair"),
  tr("hidden pair"),
  tr("naked triple"),
  tr("hidden triple"),
  tr("single-number chains"),
  tr("bivalue chains"),
  tr("mixed chains"),
  tr("single-number what-if"),
  tr("what-if with singles"),
  tr("both ways"),
  tr("what-if with techniques"),
];
const SIZES = [
  { r: 5, c: 5, t: tr("Quick") },
  { r: 6, c: 6, t: tr("Classic") },
  { r: 7, c: 7, t: tr("Larger") },
  { r: 8, c: 8, t: tr("Large") },
  { r: 10, c: 8, t: tr("Tall") },
];
const LEVEL_INFO = [
  null,
  tr("Only naked and hidden singles."),
  tr("A number blocks cells outside its region."),
  tr("Pairs: two cells share the same two numbers."),
  tr("Triples of cells and numbers."),
  tr("Follow one number through regions with two places."),
  tr("Chains of cells with two options."),
  tr("Chains that mix both kinds of link."),
  tr("Assume a number and follow only that number."),
  tr("Assume, and find a contradiction with simple moves."),
  tr("Try both options: what they share is true."),
  tr("Long assumptions with the hard techniques."),
];
const LEVEL_TECH = [
  "",
  tr("singles"),
  tr("neighbour elimination"),
  tr("pairs"),
  tr("triples"),
  tr("single-number chain"),
  tr("bivalue chain"),
  tr("mixed chain"),
  tr("single-number what-if"),
  tr("what-if with singles"),
  tr("both ways"),
  tr("what-if with techniques"),
  tr("guessing"),
];

// What to look for when you overlooked a technique. Ordered by the level that was the easiest at that moment.
const TECH_TIP = [
  "",
  tr("Scan region by region before looking for patterns: is only one number missing, or can a number only go in one place?"),
  tr("Look for numbers that touch several empty cells in the same region: the number cannot go in any of them, which often leaves only one place."),
  tr("Find two cells in a region with the same two options: those two numbers are then locked to those cells and can be crossed out everywhere else in the region."),
  tr("Three cells in a region that together have only three options lock those three numbers, just like a pair."),
  tr("When a number can only go in two places, follow both options one step: if both touch the same cell, the number cannot go there."),
  tr("Follow a chain of cells with only two options: each cell decides the next, and the two ends can remove options from cells they both touch."),
  tr("Mix the two kinds of chain: switch between 'the number can only go in two places' and 'the cell has only two options'."),
  tr("Try a number in your head: if it leads to a contradiction, it is wrong."),
  tr("Try a number in your head: if it leads to a contradiction, it is wrong."),
  tr("Try both options in a cell: whatever happens in both cases is certain."),
  tr("Try a number in your head and follow it further: if it leads to a contradiction, it is wrong."),
];

// ---------- Texts and rules the shared code looks up here
const CHECK_TIP = tr("Check the eight neighbours before placing a number: the same number must not touch, not even diagonally.");
const GAME = {
  guide: true, // the strategy guide: guide.html (English) / guide-da.html (Danish)
  peersLabel: tr("Highlight neighbours and region"),
  anyDigit: tr("Also numbers larger than the region. They count as rule breaks."),
  ruleText: tr("Rule breaks are equal numbers that touch, two equal numbers in a region, or a number larger than the region. Numbers that are only wrong compared with the solution are never shown on their own. “Check for errors” always shows all errors."),
  aboutNote: tr("puzzle codes (SU1) also work in the Java version."),
  codePrefix: "SU1", // puzzle codes and shared links (#SU1-…)
  codeNote: tr("The code contains the puzzle itself. It can be loaded here in the app and in the Java program."),
  directAll: tr("All the numbers that could be seen directly: the only number in a cell, or the only place for a number in a region."),
  // Advice for an overlooked easy number, chosen from the situation on the board (see spotTip in analysis.js)
  followTip: tr("After each number, look at its region and neighbours: a new easy number often appears there."),
  fullTip: tr("Start with the regions that are almost full."),
  nakedTip: tr("Look for empty cells surrounded by many numbers."),
  hiddenTip: tr("Take one missing number at a time and see which cells in the region it touches."),
  digitTip: null, // the numbers do not repeat across the board, so "almost finished numbers" make no sense here
  stuckTip: tr("When you are stuck, go through the regions one at a time and ask: which number is missing, and where can it go?"),
  checkTip: CHECK_TIP,
  rareNote: tr("This technique is rare and almost only appears on 8×8."),
  cellRange: (n) => tr("The region has {n} cells, so the cell can be 1–{n}.", { n }),
  // Did the number v in cell c break a rule on the board vis? The text, otherwise null.
  // short: only what was wrong (the route analysis's list of errors), without the advice afterwards
  ruleBreak(P2, vis, c, v, nm, short) {
    const reg = P2.d.region,
      cells = reg.map((r, i) => i).filter((i) => reg[i] === reg[c]);
    const touch = P2.G.king[c].find((x) => vis[x] === v);
    if (touch !== undefined) return tr("It touched {nb} = {v}.", { nb: nm(touch), v }) + (short ? "" : " " + CHECK_TIP);
    const dup = cells.find((x) => x !== c && vis[x] === v);
    if (dup !== undefined)
      return tr("The region already had {v} in {nb}.", { v, nb: nm(dup) }) + (short ? "" : " " + tr("Check which numbers the region is missing before placing one."));
    if (v > cells.length) return tr("The region has only {n} cells, so {v} cannot go there.", { n: cells.length, v });
    return null;
  },
};

// ---------- Houses (RC): the regions; a house of k cells holds the numbers 1..k. Cells that may not have the same number (peers): the same
// region, or they touch (also diagonally).
function boardModel(G, region) {
  const { n, cols } = G;
  const nr = Math.max(...region) + 1;
  const RC = Array.from({ length: nr }, () => []);
  region.forEach((r, c) => RC[r].push(c));
  const touchM = new Uint8Array(n * n),
    peers = [];
  for (let a = 0; a < n; a++) {
    const p = [];
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const t = Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) <= 1 && Math.abs((a % cols) - (b % cols)) <= 1;
      if (t) touchM[a * n + b] = 1;
      if (t || region[a] === region[b]) p.push(b);
    }
    peers.push(p);
  }
  return {
    king: true, // the neighbour rule: equal numbers may not touch (also steers the wording of the texts)
    RC, // the houses' cells
    unitsOf: region.map((r) => [r]), // the houses a cell lies in
    size: region.map((r) => RC[r].length), // the largest number in the cell
    peers,
    touch: (a, b) => touchM[a * n + b] === 1,
    near: G.king, // the area around a cell (for how visible a pattern is)
    unitName: (u, nm, list) => tr("the region with {cells}", { cells: list(RC[u].map(nm)) }),
  };
}
