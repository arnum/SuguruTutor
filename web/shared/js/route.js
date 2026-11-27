// Route analysis: replays the player's moves and compares each with the easiest one available at that moment.

// Replay the player's moves and rate each placed number against the position just before.
// The what-if family is one tier when a move is compared with the easiest: which what-if is easiest is decided by
// length, not by kind (see whatIfCost in tutor.js). A tier is a place in the technique table's order (TT), so compare tiers.
const tierOf = (L) => TT.rank(TT.family(L) === "whatif" ? TT.first("whatif") : L);
// typ (optional): your typical seconds per level, to tell which route a long move most likely took
function analyzeRoute(SE, p, moves, onProgress, typ) {
  const G = SE.makeGeometry(p.rows, p.cols),
    tu = createTutor(G, p.region);
  const ent = new Array(G.n).fill(0),
    out = [],
    pre = [];
  const onBoard = new Map(); // wrong numbers standing on the board right now: cell -> index in out
  const shown = new Array(G.n).fill(0); // correct numbers, as the stored moves show (without the eraser)
  let lastT = 0;
  const total = moves.filter((m) => m.v && !m.u).length;
  let chk = null; // "Check for errors"/errors shown by the hint button since the last number
  moves.forEach((m) => {
    if (m.chk) {
      // The errors on the board were shown: mark them, and remember the check for the next number
      onBoard.forEach((idx) => (out[idx].shown = 1));
      chk = chk || { n: 0, t: m.t };
      chk.n++;
      return;
    }
    const dt = Math.max(0, m.t - lastT);
    lastT = m.t;
    // If a cell with a wrong number is changed (overwritten, erased or undone), the error is corrected
    if (onBoard.has(m.c)) {
      out[onBoard.get(m.c)].fixT = m.t;
      onBoard.delete(m.c);
    }
    if (m.v && !m.u) {
      const rec = { c: m.c, v: m.v, t: m.t, dt };
      if (m.pn) rec.pn = m.pn;
      // The board exactly as it stood just before the move (your numbers, wrong ones too; 0 = empty). Used to draw it.
      rec.b = ent.map((x) => x || 0).join("");
      if (chk) {
        rec.chk = chk.n;
        rec.chkT = chk.t;
        chk = null;
      }
      // Correct numbers that were erased again: the stored moves show them, but they were not on the board
      const er = [];
      for (let i = 0; i < G.n; i++) if (shown[i] && ent[i] !== shown[i] && i !== m.c) er.push(i);
      if (er.length) rec.er = er;
      tagError(rec, onBoard, out);
      if (m.h) rec.cls = "hint";
      else if (m.v !== p.solution[m.c]) rec.cls = "wrong";
      else {
        const known = p.givens.map((g, i) => g || (i !== m.c && ent[i] === p.solution[i] ? ent[i] : 0));
        const r = tu.routeMove(known, m.c, m.v);
        if (!r) rec.cls = "wrong";
        else {
          pre[out.length] = known;
          rec.avail = r.avail;
          rec.nAvail = r.nAvail;
          rec.direct = r.direct;
          if (r.len) rec.len = r.len;
          if (r.ahead) {
            rec.ahead = r.ahead.level;
            rec.depth = r.ahead.depth;
            rec.placed = r.ahead.placed;
            rec.via = r.ahead.via.slice(0, 4);
          }
          rec.cls =
            tierOf(r.direct) <= tierOf(r.avail) || r.cheapest
              ? "easy"
              : r.ahead && tierOf(r.ahead.level) <= tierOf(r.avail)
                ? "ahead"
                : r.direct === TT.GUESS && !r.ahead
                  ? "guess"
                  : "harder";
        }
      }
      settleError(rec);
      if (rec.cls === "wrong") onBoard.set(m.c, out.length);
      else shown[m.c] = m.v;
      out.push(rec);
      if (onProgress) onProgress(out.length, total);
    }
    ent[m.c] = m.v;
  });
  // Two corrections, now that the whole game is known:
  // - A move that could be reached by easier numbers in your head (ahead), but took far longer than that route usually
  //   takes you and is closer to your time for its direct technique, was most likely seen directly (as players report).
  //   Its time counts for the direct technique (aheadSlow); the route in your head stays for the explanation.
  // - A harder move is not harder than needed if solving on the easiest way would need a technique at least as hard before
  //   that cell is filled: it was needed anyway, only done early. It counts as one of the easiest, with its time for its
  //   own technique (early).
  const easyT = out.filter((m) => m.cls === "easy" && m.avail === TT.SINGLES && m.dt > 0).map((m) => m.dt).sort((a, b) => a - b);
  const easyMed = easyT.length ? easyT[Math.floor(easyT.length / 2)] / 1000 : 4;
  const typAt = (L) => (typ && typ[L]) || (L === TT.SINGLES ? easyMed : null);
  const slowAhead = (m) => {
    if (!m.ahead || !TT.harder(m.direct, m.ahead) || !(m.dt > 0)) return false;
    const sec = m.dt / 1000,
      tA = typAt(m.ahead),
      tD = typAt(m.direct);
    if (!tA || sec <= Math.max(20, 3 * tA)) return false;
    return !tD || Math.abs(Math.log(sec / tD)) < Math.abs(Math.log(sec / tA));
  };
  out.forEach((m, i) => {
    if ((m.cls === "ahead" || m.cls === "harder") && slowAhead(m)) {
      m.aheadSlow = 1;
      if (m.cls === "ahead") m.cls = m.direct === TT.GUESS ? "guess" : "harder";
    }
    if (m.cls === "harder" && pre[i] && tierOf(tu.hardestUntil(pre[i], m.c)) >= tierOf(ownLevel(m))) {
      m.cls = "easy";
      m.early = 1;
    }
  });
  // The longest searches: what was the easiest move while you were searching?
  out
    .map((m, i) => ({ m, i }))
    .filter((x) => pre[x.i] && x.m.dt >= 15000)
    .sort((a, b) => b.m.dt - a.m.dt)
    .slice(0, 5)
    .forEach(({ m, i }) => {
      const h = tu.easiest(pre[i]);
      if (h) m.best = { c: h.cell, v: h.v, L: h.hardestLevel, tech: h.hardest };
    });
  return out;
}
// Errors are counted as episodes: the first error is the main error; wrong numbers placed while it stands on the board
// are follow-on errors, and correct numbers placed meanwhile (amid) are not rated, because they were found on a wrong board.
// cause = the index of the main error in the episode.
function tagError(rec, onBoard, out) {
  if (!onBoard.size) return;
  const first = out[Math.min(...onBoard.values())];
  rec.cause = first.follow ? first.cause : out.indexOf(first);
  rec.pending = true; // decided when the class is known (see below)
}
function settleError(rec) {
  if (!rec.pending) return;
  delete rec.pending;
  if (rec.cls === "wrong") rec.follow = 1;
  else if (rec.cls !== "hint") rec.amid = 1;
  else delete rec.cause;
}
// Older analyses without episodes: rebuild them from the stored moves. The eraser is not stored, so it is not known when
// a wrong number disappeared; at the latest when the cell got a new number. Therefore:
// - a wrong number at most 5 moves after another wrong number that has not yet been overwritten counts as a follow-on error;
// - correct numbers placed in that period are not rated (unsure), because the board may have looked different from what the analysis assumes.
function markErrors(list) {
  markEpisodes(list);
  markSlips(list);
  return list;
}
// Slip: a wrong number that was corrected within a few seconds, before any other number was placed, and without follow-on errors.
// It is typically a tap on the wrong button or the wrong cell, not a reasoning error. It does not count as an error,
// and the search time is moved over to the next number (that was what you were looking for).
const SLIP_MS = 6000;
function markSlips(list) {
  list.forEach((m, i) => {
    if (m.cls !== "wrong" || m.follow || m.slip !== undefined) return;
    if (m.shown) return void (m.slip = 0); // found with "Check for errors", not a slip
    const next = list[i + 1];
    const quick = m.fixT !== undefined && m.fixT - m.t <= SLIP_MS && (!next || next.t >= m.fixT);
    const alone = !list.some((x) => x.cause === i);
    m.slip = quick && alone && next ? 1 : 0;
    if (m.slip && !next.slipDt) {
      next.slipDt = m.dt;
      next.dt += m.dt;
    }
  });
}
function markEpisodes(list) {
  if (!list.some((m) => m.cls === "wrong")) return list;
  if (list.some((m) => !m.legacy && (m.fixT !== undefined || m.follow || m.amid))) return list; // real episodes
  if (list.some((m) => m.legacy === 2)) return list;
  list.forEach((m) => {
    delete m.fixT;
    delete m.follow;
    delete m.cause;
    delete m.unsure;
  });
  const onBoard = new Map();
  list.forEach((rec, i) => {
    if (onBoard.has(rec.c)) {
      list[onBoard.get(rec.c)].fixT = rec.t;
      onBoard.delete(rec.c);
    }
    if (onBoard.size && rec.cls !== "wrong" && rec.cls !== "hint") {
      const first = list[Math.min(...onBoard.values())];
      rec.unsure = 1;
      rec.cause = first.follow ? first.cause : list.indexOf(first);
    }
    if (rec.cls === "wrong") {
      const recent = [...onBoard.values()].filter((j) => i - j <= 5);
      if (recent.length) {
        const first = list[Math.min(...recent)];
        rec.cause = first.follow ? first.cause : list.indexOf(first);
        rec.follow = 1;
      }
      onBoard.set(rec.c, i);
    }
    rec.legacy = 2;
  });
  return list;
}
// Moves that count in rating the route: not hints, not follow-on errors and not moves placed on a wrong board
const judged = (m) => m.cls !== "hint" && !m.amid && !m.unsure && !m.slip && !(m.cls === "wrong" && m.follow);
// The level of the move itself: the route in your head if it was easier, unless the move took too long for that (aheadSlow)
const ownLevel = (m) => (m.aheadSlow ? m.direct : TT.min(m.direct, m.ahead || TT.GUESS));
// Which level the move really needed (the one the time is attributed to)
function moveLevel(m) {
  return m.cls === "easy"
    ? m.early
      ? ownLevel(m)
      : m.avail
    : m.cls === "ahead"
      ? m.ahead
      : m.cls === "harder"
        ? ownLevel(m)
        : m.cls === "guess"
          ? 13
          : 0;
}
function routeSummary(list) {
  markErrors(list);
  const a = list.filter(judged),
    cnt = (k) => a.filter((m) => m.cls === k).length;
  const avgT = (arr) => (arr.length ? arr.reduce((s, m) => s + m.dt, 0) / arr.length : 0);
  const harder = a.filter((m) => m.cls === "harder");
  return {
    n: a.length,
    easy: cnt("easy"),
    ahead: cnt("ahead"),
    harder: harder.length,
    wrong: cnt("wrong"),
    guess: cnt("guess"),
    hints: list.filter((m) => m.cls === "hint").length,
    follow: list.filter((m) => m.cls === "wrong" && m.follow).length,
    amid: list.filter((m) => m.amid).length,
    unsure: list.filter((m) => m.unsure).length,
    slips: list.filter((m) => m.slip).length,
    checks: list.reduce((a, m) => a + (m.chk || 0), 0),
    excess: harder.length ? harder.reduce((s, m) => s + (ownLevel(m) - m.avail), 0) / harder.length : 0,
    tEasy: avgT(a.filter((m) => m.cls === "easy")),
    tOther: avgT(a.filter((m) => m.cls === "harder" || m.cls === "ahead")),
    times: a.reduce((o, m) => {
      const L = moveLevel(m);
      if (L) (o[L] = o[L] || []).push(Math.round(m.dt / 1000));
      return o;
    }, {}),
    // Moves with context for the progress measure: [technique level, time in tenths of a second, number of possible places]
    // per move: level, tenths of seconds, places to make progress, and the length of the reasoning (0 for singles)
    ctx: a.filter((m) => m.cls !== "wrong" && m.dt > 0 && moveLevel(m)).map((m) => [moveLevel(m), Math.round(m.dt / 100), m.nAvail || 1, m.len || 0]),
    longest: a.reduce((x, m) => Math.max(x, m.dt), 0),
    // spot[L] = [times L was the easiest, times you took the easiest]
    spot: a.reduce((o, m) => {
      if (m.avail && m.cls !== "wrong") {
        const e = (o[m.avail] = o[m.avail] || [0, 0]);
        e[0]++;
        if (m.cls === "easy" && !m.early) e[1]++; // done early is not taking the easiest
      }
      return o;
    }, {}),
  };
}
