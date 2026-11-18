// Ruteanalyse: afspiller spillerens træk og sammenligner hvert med det letteste, der fandtes lige da.

// Afspil spillerens træk og vurdér hvert placeret tal i forhold til stillingen lige før.
function analyzeRoute(SE, p, moves, onProgress) {
  const G = SE.makeGeometry(p.rows, p.cols),
    tu = createTutor(G, p.region);
  const ent = new Array(G.n).fill(0),
    out = [],
    pre = [];
  const onBoard = new Map(); // forkerte tal, der står på pladen lige nu: felt -> indeks i out
  const shown = new Array(G.n).fill(0); // rigtige tal, som de gemte træk viser (uden viskelæder)
  let lastT = 0;
  const total = moves.filter((m) => m.v && !m.u).length;
  let chk = null; // "Tjek fejl"/fejl vist af hint-knappen siden sidste tal
  moves.forEach((m) => {
    if (m.chk) {
      // Fejlene, der stod på pladen, blev vist: marker dem, og husk tjekket til næste tal
      onBoard.forEach((idx) => (out[idx].shown = 1));
      chk = chk || { n: 0, t: m.t };
      chk.n++;
      return;
    }
    const dt = Math.max(0, m.t - lastT);
    lastT = m.t;
    // Ændres et felt med et forkert tal (overskrevet, visket ud eller fortrudt), er fejlen rettet
    if (onBoard.has(m.c)) {
      out[onBoard.get(m.c)].fixT = m.t;
      onBoard.delete(m.c);
    }
    if (m.v && !m.u) {
      const rec = { c: m.c, v: m.v, t: m.t, dt };
      if (chk) {
        rec.chk = chk.n;
        rec.chkT = chk.t;
        chk = null;
      }
      // Rigtige tal, der er visket ud igen: de gemte træk viser dem, men de stod ikke på pladen
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
      else shown[m.c] = m.v;
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
// Ældre analyser uden episoder: genskab dem ud fra de gemte træk. Viskelæder er ikke gemt, så det vides ikke, hvornår
// et forkert tal forsvandt; højst til feltet fik et nyt tal. Derfor:
// - et forkert tal højst 5 træk efter et andet forkert tal, der endnu ikke er overskrevet, regnes som følgefejl;
// - rigtige tal sat i det tidsrum bedømmes ikke (unsure), for pladen kan have set anderledes ud, end analysen antager.
function markErrors(list) {
  markEpisodes(list);
  markSlips(list);
  return list;
}
// Fejltryk: et forkert tal, der blev rettet inden for få sekunder, før noget andet tal blev sat, og uden følgefejl.
// Det er typisk et tryk på den forkerte knap eller det forkerte felt, ikke en tankefejl. Det tæller ikke som fejl,
// og søgetiden lægges over på det næste tal (det var det, du ledte efter).
const SLIP_MS = 6000;
function markSlips(list) {
  list.forEach((m, i) => {
    if (m.cls !== "wrong" || m.follow || m.slip !== undefined) return;
    if (m.shown) return void (m.slip = 0); // fundet med "Tjek fejl", ikke et fejltryk
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
  if (list.some((m) => !m.legacy && (m.fixT !== undefined || m.follow || m.amid))) return list; // rigtige episoder
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
// Træk, der indgår i bedømmelsen af ruten: ikke hints, ikke følgefejl og ikke træk sat på en forkert plade
const judged = (m) => m.cls !== "hint" && !m.amid && !m.unsure && !m.slip && !(m.cls === "wrong" && m.follow);
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
    unsure: list.filter((m) => m.unsure).length,
    slips: list.filter((m) => m.slip).length,
    checks: list.reduce((a, m) => a + (m.chk || 0), 0),
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
