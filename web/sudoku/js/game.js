// Sudoku: the game's rules as a model that the tutor, board and analysis build on, and the texts and lists that are
// Sudoku-specific. The techniques are the same 14 as in Suguru (the same numbers, see shared/js/tutor.js); only the names and
// explanations are Sudoku's own.

// The names of the 14 techniques. "Single-number chain" covers X-wing, skyscraper and other X-chains; "bivalue chain"
// covers XY-wing and XY-chains; "locked candidates" is pointing and claiming.
const TECH_LABELS = [
  tr("Naked single"),
  tr("Hidden single"),
  tr("Locked candidates"),
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
// the guide's anchors per technique (sudoku/guide.html, built by tools/guide/build_sudoku.js). null = no example in the
// guide, so hints about that technique do not link to it. Since 22 Nov. 2026 all 14 have an example.
const GUIDE_IDS = ["eneste-kandidat", "eneste-plads", "laaste-kandidater", "noegent-par", "skjult-par", "noegen-trippel", "skjult-trippel", "kaede-et-tal", "kaede-to-muligheder", "kaede", "hvis-saa-et-tal", "hvis-saa-kort", "begge-veje", "hvis-saa-dyb"];
const TECH_NAMES_UI = [
  tr("naked single"),
  tr("hidden single"),
  tr("locked candidates"),
  tr("naked pair"),
  tr("hidden pair"),
  tr("naked triple"),
  tr("hidden triple"),
  tr("single-number chains (e.g. X-wing)"),
  tr("chains of two-option cells (e.g. XY-wing)"),
  tr("mixed chains"),
  tr("single-number what-if"),
  tr("what-if with singles"),
  tr("both ways"),
  tr("what-if with techniques"),
];
const SIZES = [{ r: 9, c: 9, t: tr("Classic") }];
const LEVEL_INFO = [
  null,
  tr("Only naked and hidden singles."),
  tr("A number is locked to one line in a box, or to one box in a line."),
  tr("Pairs: two cells share the same two numbers."),
  tr("Triples of cells and numbers."),
  tr("Follow one number: X-wing and similar chains."),
  tr("Chains of cells with two options, e.g. XY-wing."),
  tr("Chains that mix both kinds of link."),
  tr("Assume a number and follow only that number."),
  tr("Assume, and find a contradiction with simple moves."),
  tr("Try both options: what they share is true."),
  tr("Long assumptions with the hard techniques."),
];
const LEVEL_TECH = [
  "",
  tr("singles"),
  tr("locked candidates"),
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
  tr("Scan box by box and row by row: is only one number missing, or can a number only go in one place?"),
  tr("If a number in a box can only go in one row or column, it cannot go anywhere else in that row or column. The same holds the other way round."),
  tr("Find two cells in the same row, column or box with the same two options: those two numbers can be crossed out everywhere else there."),
  tr("Three cells in the same row, column or box that have only three options between them lock those three numbers, just like a pair."),
  tr("If a number can only go in two places in each of two rows, and the places are in the same columns (X-wing), the number cannot go anywhere else in those columns."),
  tr("Follow a chain of cells with only two options (e.g. XY-wing): the ends can remove options from cells that see both of them."),
  tr("Mix the two kinds of chain: switch between 'the number can only go in two places' and 'the cell has only two options'."),
  tr("Try a number in your head: if it leads to a contradiction, it is wrong."),
  tr("Try a number in your head: if it leads to a contradiction, it is wrong."),
  tr("Try both options in a cell: whatever happens in both cases is certain."),
  tr("Try a number in your head and follow it further: if it leads to a contradiction, it is wrong."),
];

// ---------- Texts and rules the shared code looks up here
const CHECK_TIP = tr("Check the row, column and box before you place a number: each number may appear only once in each.");
const GAME = {
  guide: true, // the strategy guide: guide.html (English) and guide-da.html (Danish)
  ui: { sizeIdx: 0, maxRegion: 9 }, // defaults on "New game"
  // the daily puzzle per weekday (Sunday first): always 9×9, harder through the week and at the weekend
  daily: [
    [9, 9, 6],
    [9, 9, 2],
    [9, 9, 3],
    [9, 9, 4],
    [9, 9, 4],
    [9, 9, 5],
    [9, 9, 5],
  ],
  // Sudoku grades assume written candidates from pairs up (see tools/grade/sudoku.json), so the grade with pencil is shown
  settings: { pencil: "med" },
  // the technique level the generator starts with per difficulty band (with pencil: pairs ~4-5, X-chains ~5-6, XY ~6, mixed ~8)
  gradeStart: [0, 1, 2, 3, 3, 5, 6, 7, 8, 9],
  dailyMaxRegion: 9,
  tintLabel: tr("Colour the boxes"),
  peersLabel: tr("Highlight row, column and box"),
  anyDigit: null, // all numbers 1-9 are legal in all cells
  ruleText: tr(
    "A rule break is two equal numbers in the same row, column or box. Numbers that are only wrong compared with the solution are never shown by themselves. “Check errors” always shows all errors.",
  ),
  aboutNote: tr("Puzzle codes (SD1) and ordinary 81-character puzzles can be loaded on the home screen."),
  codePrefix: "SD1", // puzzle codes and shared links (#SD1-…)
  // Starting value for the time estimate before you have played Sudoku: the typical time for an easy move (a in calib.js). Suguru's starting value
  // (3.1 s) gave about 2 minutes for a puzzle with only hidden/naked singles; a number in Sudoku needs you to go through the row, column
  // and box for nine numbers. With 8 s an easy puzzle becomes about 5-6 minutes and a medium one about 10, which is what is typically
  // given for practised players (not experts); the world record for an easy puzzle was 2:08 (Thomas Snyder, 2006).
  // Already after the first game the estimate builds mostly on your own times (the starting value weighs as 3 moves).
  calPrior: { c: Math.log(8), cells: 81 },
  // practice par (drill.js) on top of the board-size scaling: a find in Sudoku takes longer (provisional, as in calPrior)
  parScale: 1.8,
  codeNote: tr("The code contains the puzzle itself. It can be loaded on the app's home screen, also on another phone."),
  directAll: tr("All the numbers that could be seen directly: the only number in a cell, or the only place for a number in a row, column or box."),
  // Advice for an overlooked easy number, chosen from the situation on the board (see spotTip in analysis.js)
  followTip: tr("After each number, look at its row, column and box: a new easy number often appears there."),
  fullTip: tr("Start with the rows, columns and boxes that are almost full."),
  nakedTip: tr("Look for empty cells where a well-filled row, column and box meet."),
  hiddenTip: tr("Take one number at a time and, in each row, column and box, see where it can still go."),
  digitTip: tr("Numbers that are almost complete have few places left: check them first."),
  stuckTip: tr("When you are stuck, go through the boxes one at a time and ask: which number is missing, and where can it go?"),
  checkTip: CHECK_TIP,
  // Practice drills (drill.js, drillgen.js): six levels per drill. Always 9×9: whether pencil marks are shown, the share of
  // empty cells in the position, and for singles how many easy numbers there may be at most
  drillLevels: [
    { size: [9, 9], pencil: true, empty: [0.3, 0.5] },
    { size: [9, 9], pencil: true, empty: [0.45, 0.65] },
    { size: [9, 9], pencil: false, empty: [0.3, 0.5] },
    { size: [9, 9], pencil: false, empty: [0.45, 0.6] },
    { size: [9, 9], pencil: false, empty: [0.5, 0.7] },
    { size: [9, 9], pencil: false, empty: [0.55, 0.8] },
  ],
  drillSingles: [
    { size: [9, 9], empty: [0.25, 0.45] },
    { size: [9, 9], empty: [0.4, 0.55] },
    { size: [9, 9], empty: [0.5, 0.65], opts: 4 },
    { size: [9, 9], empty: [0.55, 0.7], opts: 3 },
    { size: [9, 9], empty: [0.6, 0.75], opts: 2 },
    { size: [9, 9], empty: [0.6, 0.8], opts: 1 },
  ],
  // what to look for in each drill: the heading and one line
  drillFind: {
    1: [tr("Find an easy number"), tr("Tap a cell whose number you can see.")],
    2: [tr("Find locked candidates"), tr("Find a number that in a box can only go in one row or column, or in a line only in one box. Tap those places.")],
    3: [tr("Find a pair"), tr("Two cells in a house with the same two options, or two numbers with only the same two places in a house. Tap the two cells.")],
    4: [tr("Find a triple"), tr("Three cells and three numbers locked to each other in a house. Tap the three cells.")],
  },
  // Practice games (games.js): six levels each, like the drills (see Suguru's game.js)
  games: {
    cascade: [
      { size: [9, 9], pencil: true, empty: [0.35, 0.5], n: 8 },
      { size: [9, 9], pencil: false, empty: [0.35, 0.5], n: 8 },
      { size: [9, 9], pencil: false, empty: [0.45, 0.6], n: 10 },
      { size: [9, 9], pencil: false, empty: [0.5, 0.65], n: 10 },
      { size: [9, 9], pencil: false, empty: [0.55, 0.7], n: 12 },
      { size: [9, 9], pencil: false, empty: [0.6, 0.75], n: 12 },
    ],
    changed: [
      { size: [9, 9], pencil: true, empty: [0.35, 0.5], fresh: [1, 2] },
      { size: [9, 9], pencil: false, empty: [0.35, 0.5], fresh: [1, 2] },
      { size: [9, 9], pencil: false, empty: [0.45, 0.6], fresh: [1, 3] },
      { size: [9, 9], pencil: false, empty: [0.5, 0.65], fresh: [2, 3] },
      { size: [9, 9], pencil: false, empty: [0.55, 0.7], fresh: [2, 4] },
      { size: [9, 9], pencil: false, empty: [0.6, 0.75], fresh: [2, 4] },
    ],
    sweep: [
      { size: [9, 9], pencil: true, empty: [0.4, 0.55], techs: [2], minT: 2 },
      { size: [9, 9], pencil: true, empty: [0.4, 0.6], techs: [3], minT: 2 },
      { size: [9, 9], pencil: true, empty: [0.45, 0.65], techs: [2, 3, 4], minT: 3 },
      { size: [9, 9], pencil: false, empty: [0.4, 0.55], techs: [2], minT: 2 },
      { size: [9, 9], pencil: false, empty: [0.45, 0.6], techs: [2, 3], minT: 3 },
      { size: [9, 9], pencil: false, empty: [0.5, 0.65], techs: [3, 4], minT: 3 },
    ],
    count: [
      { size: [9, 9], pencil: true, empty: [0.3, 0.45], count: [1, 3] },
      { size: [9, 9], pencil: false, empty: [0.35, 0.5], count: [2, 4] },
      { size: [9, 9], pencil: false, empty: [0.4, 0.55], count: [3, 5] },
      { size: [9, 9], pencil: false, empty: [0.45, 0.6], count: [3, 6] },
      { size: [9, 9], pencil: false, empty: [0.5, 0.65], count: [4, 7] },
      { size: [9, 9], pencil: false, empty: [0.55, 0.7], count: [5, 9] },
    ],
    quick: [
      { size: [9, 9], pencil: true, empty: [0.35, 0.55], types: [1], batch: 10 },
      { size: [9, 9], pencil: true, empty: [0.4, 0.6], types: [1, 2], batch: 10 },
      { size: [9, 9], pencil: true, empty: [0.45, 0.65], types: [1, 2, 3], batch: 10 },
      { size: [9, 9], pencil: false, empty: [0.4, 0.55], types: [1, 3], batch: 10 },
      { size: [9, 9], pencil: false, empty: [0.45, 0.6], types: [1, 2, 3], batch: 10 },
      { size: [9, 9], pencil: false, empty: [0.5, 0.65], types: [1, 2, 3], batch: 10 },
    ],
  },
  countLine: tr("An easy number is the only option in a cell, or the only place for a number in a row, column or box."),

  rareNote: tr("The technique is rare, so finding a puzzle can take a while."),
  cellRange: (n) => tr("The cell can be 1–{n}.", { n }),
  // Did the number v in cell c break a rule on the board vis? The text, otherwise null.
  // short: only what was wrong (the route analysis's list of errors), without the advice afterwards
  ruleBreak(P2, vis, c, v, nm, short) {
    const M = boardModel(P2.G, P2.d.region);
    for (const u of M.unitsOf[c]) {
      const dup = M.RC[u].find((x) => x !== c && vis[x] === v);
      if (dup === undefined) continue;
      const k = M.kindOf(u);
      // nm null: no cell names (the board is shown next to the text)
      const t = !nm
        ? k === "box"
          ? tr("The box already had a {v}.", { v })
          : k === "row"
            ? tr("The row already had a {v}.", { v })
            : tr("The column already had a {v}.", { v })
        : k === "box"
          ? tr("The box already had {v} in {nb}.", { v, nb: nm(dup) })
          : k === "row"
            ? tr("The row already had {v} in {nb}.", { v, nb: nm(dup) })
            : tr("The column already had {v} in {nb}.", { v, nb: nm(dup) });
      return t + (short ? "" : " " + CHECK_TIP);
    }
    return null;
  },
};

// ---------- Houses: the boxes (region = the box's number), the rows and the columns. Each house holds the numbers 1..9.
// The boxes come first: a single is easiest to see in a box (Sudoku Explainer: hidden single in a box 1.2, in a
// row or column 1.5), and on an equal score the tutor picks the first house.
function boardModel(G, region) {
  const { n, rows, cols } = G;
  const nb = Math.max(...region) + 1;
  const RC = Array.from({ length: nb }, () => []);
  region.forEach((b, c) => RC[b].push(c));
  for (let r = 0; r < rows; r++) RC.push(Array.from({ length: cols }, (_, k) => r * cols + k));
  for (let k = 0; k < cols; k++) RC.push(Array.from({ length: rows }, (_, r) => r * cols + k));
  const unitsOf = Array.from({ length: n }, () => []);
  RC.forEach((cells, u) => cells.forEach((c) => unitsOf[c].push(u)));
  const peers = [];
  for (let a = 0; a < n; a++) {
    const p = [];
    for (let b = 0; b < n; b++) if (a !== b && unitsOf[a].some((u) => unitsOf[b].includes(u))) p.push(b);
    peers.push(p);
  }
  const kindOf = (u) => (u < nb ? "box" : u < nb + rows ? "row" : "col");
  return {
    king: false,
    RC,
    unitsOf,
    size: new Array(n).fill(rows),
    peers,
    near: peers, // the area around a cell: its row, column and box
    kindOf,
    // a hidden single in a row or column is a little harder to see than in a box
    unitCost: (u) => (u < nb ? 0 : 0.3),
    unitKind: (u) => (u < nb ? tr("box") : u < nb + rows ? tr("row") : tr("column")),
    unitName: (u) =>
      u < nb
        ? tr("box {n}", { n: u + 1 })
        : u < nb + rows
          ? tr("row {n}", { n: u - nb + 1 })
          : tr("column {c}", { c: "abcdefghij"[u - nb - rows] }),
  };
}
