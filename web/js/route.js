// Ruteanalyse: afspiller spillerens træk og sammenligner hvert med det letteste, der fandtes lige da.

// Afspil spillerens træk og vurdér hvert placeret tal i forhold til stillingen lige før.
function analyzeRoute(SE, p, moves, onProgress) {
  const G = SE.makeGeometry(p.rows, p.cols),
    tu = createTutor(G, p.region);
  const ent = new Array(G.n).fill(0),
    out = [],
    pre = [];
  const onBoard = new Map(); // forkerte tal, der står på pladen lige nu: felt -> indeks i out
  let lastT = 0;
  const total = moves.filter((m) => m.v && !m.u).length;
  moves.forEach((m) => {
    const dt = Math.max(0, m.t - lastT);
    lastT = m.t;
    // Ændres et felt med et forkert tal (overskrevet, visket ud eller fortrudt), er fejlen rettet
    if (onBoard.has(m.c)) {
      out[onBoard.get(m.c)].fixT = m.t;
      onBoard.delete(m.c);
    }
    if (m.v && !m.u) {
      const rec = { c: m.c, v: m.v, t: m.t, dt };
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
          if (r.ahead) {
            rec.ahead = r.ahead.level;
            rec.depth = r.ahead.depth;
            rec.placed = r.ahead.placed;
            rec.via = r.ahead.via.slice(0, 4);
          }
          rec.cls =
            r.direct <= r.avail ? "easy" : r.ahead && r.ahead.level <= r.avail ? "ahead" : r.direct >= 12 && !r.ahead ? "guess" : "harder";
        }
      }
      settleError(rec);
      if (rec.cls === "wrong") onBoard.set(m.c, out.length);
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
// Fejl tælles som episoder: den første fejl er hovedfejlen; forkerte tal, der sættes, mens den står på pladen,
// er følgefejl, og rigtige tal sat imens (amid) bedømmes ikke, fordi de er fundet på en forkert plade.
// cause = indekset på hovedfejlen i episoden.
function tagError(rec, onBoard, out) {
  if (!onBoard.size) return;
  const first = out[Math.min(...onBoard.values())];
  rec.cause = first.follow ? first.cause : out.indexOf(first);
  rec.pending = true; // afgøres, når klassen kendes (se nedenfor)
}
function settleError(rec) {
  if (!rec.pending) return;
  delete rec.pending;
  if (rec.cls === "wrong") rec.follow = 1;
  else if (rec.cls !== "hint") rec.amid = 1;
  else delete rec.cause;
}
// Ældre analyser uden episoder: genskab dem forsigtigt ud fra de gemte træk. Slettede tal er ikke gemt, så det
// vides ikke, hvor længe et forkert tal stod. Derfor: et forkert tal højst 5 træk efter et andet forkert tal, der
// endnu ikke er overskrevet, regnes som følgefejl; rigtige tal bedømmes som før (ingen "amid").
function markErrors(list) {
  if (!list.some((m) => m.cls === "wrong") || list.some((m) => m.fixT !== undefined || m.follow || m.amid || m.legacy)) return list;
  const onBoard = new Map();
  list.forEach((rec, i) => {
    if (onBoard.has(rec.c)) {
      list[onBoard.get(rec.c)].fixT = rec.t;
      onBoard.delete(rec.c);
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
    rec.legacy = 1;
  });
  return list;
}
// Træk, der indgår i bedømmelsen af ruten: ikke hints, ikke følgefejl og ikke træk sat på en forkert plade
const judged = (m) => m.cls !== "hint" && !m.amid && !(m.cls === "wrong" && m.follow);
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
