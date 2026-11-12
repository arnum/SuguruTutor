// Ruteanalyse: afspiller spillerens træk og sammenligner hvert med det letteste, der fandtes lige da.

// Afspil spillerens træk og vurdér hvert placeret tal i forhold til stillingen lige før.
function analyzeRoute(SE, p, moves, onProgress) {
  const G = SE.makeGeometry(p.rows, p.cols),
    tu = createTutor(G, p.region);
  const ent = new Array(G.n).fill(0),
    out = [],
    pre = [];
  let lastT = 0;
  const total = moves.filter((m) => m.v && !m.u).length;
  moves.forEach((m) => {
    const dt = Math.max(0, m.t - lastT);
    lastT = m.t;
    if (m.v && !m.u) {
      const rec = { c: m.c, v: m.v, t: m.t, dt };
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
          if (r.ahead) {
            rec.ahead = r.ahead.level;
            rec.depth = r.ahead.depth;
            rec.placed = r.ahead.placed;
          }
          rec.cls =
            r.direct <= r.avail ? "easy" : r.ahead && r.ahead.level <= r.avail ? "ahead" : r.direct >= 12 && !r.ahead ? "guess" : "harder";
        }
      }
      out.push(rec);
      if (onProgress) onProgress(out.length, total);
    }
    ent[m.c] = m.v;
  });
  // De længste søgninger: hvad var det letteste træk, mens du ledte?
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
// Hvilket niveau trækket reelt krævede (det, tiden tilskrives)
function moveLevel(m) {
  return m.cls === "easy"
    ? m.avail
    : m.cls === "ahead"
      ? m.ahead
      : m.cls === "harder"
        ? Math.min(m.direct, m.ahead || 12)
        : m.cls === "guess"
          ? 12
          : 0;
}
function routeSummary(list) {
  const a = list.filter((m) => m.cls !== "hint"),
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
    hints: list.length - a.length,
    excess: harder.length ? harder.reduce((s, m) => s + (Math.min(m.direct, m.ahead || 12) - m.avail), 0) / harder.length : 0,
    tEasy: avgT(a.filter((m) => m.cls === "easy")),
    tOther: avgT(a.filter((m) => m.cls === "harder" || m.cls === "ahead")),
    times: a.reduce((o, m) => {
      const L = moveLevel(m);
      if (L) (o[L] = o[L] || []).push(Math.round(m.dt / 1000));
      return o;
    }, {}),
    longest: a.reduce((x, m) => Math.max(x, m.dt), 0),
    // spot[L] = [gange L var det letteste, gange du tog det letteste]
    spot: a.reduce((o, m) => {
      if (m.avail && m.cls !== "wrong") {
        const e = (o[m.avail] = o[m.avail] || [0, 0]);
        e[0]++;
        if (m.cls === "easy") e[1]++;
      }
      return o;
    }, {}),
  };
}
