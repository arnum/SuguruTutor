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
