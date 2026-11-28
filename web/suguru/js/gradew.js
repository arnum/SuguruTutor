// Suguru: the difficulty's numbers. Written by tools/grade/gen.py from tools/grade/weights.json; edit there.
// <gen:weights> Written by tools/grade/gen.py from tools/grade/weights.json. Edit there, not here.
// Pencil terms: [with pencil, without pencil, as you used to play], each a list per technique (derived from base, diff and anchor).
const GW = {
  fit: 14,
  recog: [0, 0, 0.6, 2.2, 2.9, 3, 3.7, 1.9, 2.2, 2.5, 2.8, 3.1, 3.5, 3.1, 2.6, 3.4, 1.9, 0.6, 2.2, 2.5],
  link: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  spot: [0.5, 0.5, 0.3, 0.15, 0],
  cap: 14.9,
  inner: 0.25,
  vis: 0.35,
  shapeSize: 0.15,
  shapeSizeCap: 3,
  shapeBent: 0.2,
  open: 0.8,
  openMid: 0.55,
  workPer: 0.12,
  workMid: 4,
  workLo: -0.25,
  workHi: 0.5,
  len: 0.35,
  loadOver: 1.5,
  loadTechRepeat: 0.25,
  loadScale: 9,
  loadWeight: 1,
  loadCountScale: 12,
  early: 0.3,
  singlesK: 0.9,
  singlesOptsW: 0.65,
  singlesOptsMid: 4.5,
  singlesOptsSpan: 2.5,
  singlesNarrowW: 0.35,
  singlesNarrowSpan: 0.15,
  singlesFirst: 0,
  singlesNakedW: 0,
  singlesNakedSpan: 1,
  pencil: {
    mem: [[0.3, 0.3, 0.3, 0.1, 0.1, 0.2, 0.2, 0.1, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.1, 0.2, 0.1, 0.3, 0.3, 0.3], [0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.3, 0.4, 0.3, 0.3, 0.5, 0.5], [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]],
    tech: [[0, 0, 0, -0.3, -0.5, -0.5, -0.6, -0.4, 0, 0, 0, 0, 0, 0, -0.3, -0.5, -0.4, 0, 0, 0], [0, 0, 0, 0, 0, 0.5, 0.6, 0, 1, 1.2, 0.3, 1.5, 1.5, 1.5, 0, 0.5, 0, 0, 1, 1.2], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    multi: [[0, 0, 0, -0.25, -0.25, -0.125, -0.125, 0, 0, 0, 0, 0, 0, 0, -0.25, -0.125, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0.125, 0.125, 0, 0.25, 0.25, 0, 0, 0.25, 0, 0, 0.125, 0, 0, 0.25, 0.25], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    trial: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.3, 0, 0.3, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    built: [[0, 0, 0, -0.4, -0.4, -0.2, -0.2, -0.4, 0, 0, 0, 0, 0, 0, -0.4, -0.2, -0.4, 0, 0, 0], [0, 0, 0, 0, 0, 0.2, 0.2, 0, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0, 0.2, 0, 0, 0.4, 0.4], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    repeat: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    partial: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    len: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.2, 0.2, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    multiCap: 1,
  },
};
// The technique table, from tools/grade/techniques.json:
const TECHS = {"guess": 13, "units": [{"code": 1, "id": "singles", "family": "basic", "rung": 1, "drill": true, "methods": [0, 1]}, {"code": 2, "id": "neighbour", "family": "basic", "rung": 2, "drill": true, "learn": true, "methods": [2, 17]}, {"code": 3, "id": "pairs", "family": "basic", "rung": 3, "drill": true, "learn": true, "methods": [3, 4]}, {"code": 4, "id": "mixedPair", "family": "basic", "rung": 3.5, "drill": true, "learn": true, "games": ["suguru"], "methods": [14]}, {"code": 5, "id": "triples", "family": "basic", "rung": 4, "drill": true, "learn": true, "methods": [5, 6]}, {"code": 14, "id": "mixedTriple", "family": "basic", "rung": 4.5, "drill": true, "learn": true, "games": ["suguru"], "methods": [15]}, {"code": 6, "id": "chain1", "family": "chain", "rung": 5, "learn": true, "methods": [16, 7]}, {"code": 7, "id": "chain2", "family": "chain", "rung": 6, "learn": true, "methods": [18, 8]}, {"code": 8, "id": "chainMixed", "family": "chain", "rung": 7, "methods": [19, 9]}, {"code": 9, "id": "whatIf1", "family": "whatif", "rung": 8, "methods": [10]}, {"code": 10, "id": "whatIfSingles", "family": "whatif", "rung": 9, "methods": [11]}, {"code": 11, "id": "bothWays", "family": "whatif", "rung": 10, "rare": true, "methods": [12]}, {"code": 12, "id": "whatIfTech", "family": "whatif", "rung": 11, "rare": true, "methods": [13]}], "methods": [{"id": "nakedSingle", "weight": 1}, {"id": "hiddenSingle", "weight": 1}, {"id": "neighbour", "weight": 4, "pattern": true, "inner": true}, {"id": "nakedPair", "weight": 8, "pattern": true, "inner": true}, {"id": "hiddenPair", "weight": 10, "pattern": true, "inner": true}, {"id": "nakedTriple", "weight": 15, "pattern": true, "inner": true}, {"id": "hiddenTriple", "weight": 18, "pattern": true, "inner": true}, {"id": "chain1", "weight": 20, "chain": true, "byLength": true, "inner": true}, {"id": "chain2", "weight": 22, "chain": true, "byLength": true, "inner": true}, {"id": "chainMixed", "weight": 24, "chain": true, "byLength": true, "inner": true}, {"id": "whatIf1", "weight": 26, "byLength": true, "inner": true}, {"id": "whatIfSingles", "weight": 30, "byLength": true, "within": 1}, {"id": "bothWays", "weight": 40, "byLength": true}, {"id": "whatIfTech", "weight": 60, "byLength": true, "within": 9}, {"id": "mixedPair", "weight": 12, "pattern": true, "inner": true}, {"id": "mixedTriple", "weight": 16, "pattern": true, "inner": true}, {"id": "shortChain", "weight": 19, "chain": true, "byLength": true, "inner": true}, {"id": "nook", "weight": 5, "pattern": true, "inner": true, "noDrill": true}, {"id": "xyWing", "weight": 21, "chain": true, "byLength": true, "inner": true}, {"id": "wWing", "weight": 23, "chain": true, "byLength": true, "inner": true}]};
// The technique table's questions (27 Nov. 2026). tools/grade/gen.py writes this file, after the table itself (TECHS,
// from techniques.json), into each game's gradew.js: edit here, not there.
//
// A unit is named by its code, which never changes; the table's order is the only order. So no code may compare unit
// codes as numbers: ask TT instead (rank, harder, max, next, the flags). Code TT.GUESS means "cannot be done without
// guessing" and ranks after every unit.
const TT = (() => {
  const byCode = {},
    unitOf = [];
  TECHS.units.forEach((u, i) => {
    byCode[u.code] = Object.assign({ rank: i }, u);
    u.methods.forEach((m) => (unitOf[m] = u.code));
  });
  const game = () => (typeof APP !== "undefined" && APP.id) || "";
  // GUESS ranks right after the last unit (as the old level numbers did: 13 after 12), anything else before the first
  const rank = (c) => (byCode[c] ? byCode[c].rank : c === TECHS.guess ? TECHS.units.length : -1);
  const here = (c) => !!byCode[c] && (!byCode[c].games || byCode[c].games.includes(game()));
  const T = {
    GUESS: TECHS.guess,
    SINGLES: unitOf[0], // the unit of the naked single: the floor every other unit is "harder" than
    // the units in order: all of them (the solver; a game without a unit finds nothing for it), or this game's (with a flag)
    all: () => TECHS.units.map((u) => u.code),
    list: (flag) => TECHS.units.filter((u) => here(u.code) && (!flag || u[flag])).map((u) => u.code),
    rank,
    here, // the unit exists in this game
    known: (c) => !!byCode[c], // a unit code (not 0, not GUESS)
    is: (c, flag) => !!(byCode[c] && byCode[c][flag]),
    id: (c) => (byCode[c] ? byCode[c].id : c === TECHS.guess ? "guess" : ""),
    code: (id) => {
      const u = TECHS.units.find((x) => x.id === id);
      if (!u) throw new Error("no technique unit " + id);
      return u.code;
    },
    family: (c) => (byCode[c] ? byCode[c].family : c === TECHS.guess ? "guess" : ""),
    rung: (c) => (byCode[c] ? byCode[c].rung : 0),
    methods: (c) => (byCode[c] ? byCode[c].methods : []),
    unitOf: (m) => unitOf[m],
    method: (m) => TECHS.methods[m],
    harder: (a, b) => rank(a) > rank(b),
    // a unit beyond the singles (GUESS too); not a unit at all (0, a string) is not
    beyond: (c) => rank(c) > rank(unitOf[0]),
    max: (a, b) => (rank(b) > rank(a) ? b : a),
    // methods: a is harder than b if its unit is, or (in one unit) if it comes later in the unit's list
    harderMethod: (a, b) =>
      unitOf[a] !== unitOf[b] ? rank(unitOf[a]) > rank(unitOf[b]) : byCode[unitOf[a]].methods.indexOf(a) > byCode[unitOf[a]].methods.indexOf(b),
    min: (a, b) => (rank(b) < rank(a) ? b : a),
    // the units up to and including c, in order (all units: the solver)
    upTo: (c) => TECHS.units.filter((u, i) => i <= rank(c)).map((u) => u.code),
    // the next and the previous unit of this game (c itself at the ends)
    next: (c) => {
      const l = T.list(),
        i = l.indexOf(c);
      return i >= 0 && i < l.length - 1 ? l[i + 1] : c;
    },
    prev: (c) => {
      const l = T.list(),
        i = l.indexOf(c);
      return i > 0 ? l[i - 1] : c;
    },
    // the unit just before c among all units (the solver's ladder); for GUESS the last unit
    below: (c) => (c === TECHS.guess ? TECHS.units[TECHS.units.length - 1].code : rank(c) > 0 ? TECHS.units[rank(c) - 1].code : c),
    // the unit just after c among all units (the last unit stays)
    above: (c) => (rank(c) >= 0 && rank(c) < TECHS.units.length - 1 ? TECHS.units[rank(c) + 1].code : c),
    // the number shown to the player: the unit's place in this game's order, from 1 (GUESS after the last; 0: not a unit)
    num: (c) => (c === TECHS.guess ? T.list().length + 1 : T.list().indexOf(c) + 1),
    // a comparator for sorting unit codes in the table's order
    order: (a, b) => rank(a) - rank(b),
    first: (family) => TECHS.units.find((u) => u.family === family).code,
    last: () => TECHS.units[TECHS.units.length - 1].code,
  };
  return T;
})();
// </gen:weights>
