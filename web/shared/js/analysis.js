// Analysis: solution route, time per technique, concentration, form and fatigue, focus area and a check of the rating.

// Each placed number is compared with the position just before: could it be seen with the easiest level available at that moment?
const ROUTE_CLS = {
  easy: { label: tr("Easiest"), long: tr("One of the easiest moves") },
  ahead: { label: tr("Thought ahead"), long: tr("Thought ahead") },
  harder: { label: tr("Harder"), long: tr("Harder than needed") },
  wrong: { label: tr("Errors"), long: tr("Wrong number") },
  guess: { label: tr("Guess"), long: tr("Could not be deduced") },
  hint: { label: tr("Hint"), long: tr("Placed with a hint") },
};
// Games analysed before "thought ahead" got named numbers: run the analysis again from the stored moves and add them.
// Erased numbers are not stored, but wrong numbers do not count in the position anyway, so the result is the same.
// Stored summaries from before the error episodes: recompute them from the stored moves (fast, no new analysis)
function refreshRouteSummaries() {
  let changed = false;
  games.forEach((g) => {
    if (!g.moves || (g.route && g.route.ctx !== undefined)) return;
    markErrors(g.moves);
    g.route = routeSummary(g.moves);
    g.thirds = thirdsOf(g);
    g.conc = null;
    changed = true;
  });
  if (changed) saveGames();
}
function upgradeAheadVia() {
  const todo = games.filter((g) => g.moves && g.code && g.moves.some((m) => m.cls === "ahead" && !m.via));
  const next = () => {
    const g = todo.shift();
    if (!g) return;
    let p;
    try {
      p = puzzleFromCode(g.code);
    } catch (e) {
      g.moves.forEach((m) => m.cls === "ahead" && !m.via && (m.via = []));
      return next();
    }
    const raw = g.moves.map((m) => ({ c: m.c, v: m.v, t: m.t, h: m.cls === "hint" ? 1 : 0 }));
    runRoute(p, raw, (list) => {
      g.moves.forEach((m, k) => {
        if (m.cls === "ahead" && !m.via) m.via = (list[k] && list[k].c === m.c && list[k].via) || [];
      });
      saveGames();
      setTimeout(next, 50);
    });
  };
  setTimeout(next, 1500);
}
function runRoute(p, moves, done) {
  try {
    const w = newWorker();
    w.onmessage = (e) => {
      if (e.data.type === "route") {
        w.terminate();
        done(e.data.list);
      }
    };
    w.onerror = () => {
      w.terminate();
      setTimeout(() => done(analyzeRoute(E, p, moves)), 30);
    };
    w.postMessage({ type: "route", puzzle: p, moves });
  } catch (e) {
    setTimeout(() => done(analyzeRoute(E, p, moves)), 30);
  }
}
function startRoute(rec) {
  const p = P,
    moves = meta.moves.slice();
  if (!moves.some((m) => m.v && !m.u && !m.h)) return;
  rec.routePending = true;
  runRoute(p, moves, (list) => {
    const g = games.find((x) => x.id === rec.id);
    if (!g) return;
    delete g.routePending;
    delete rec.routePending;
    g.moves = list.map((m) => {
      const o = Object.assign({}, m);
      for (const k in o) if (o[k] === undefined) delete o[k];
      return o;
    });
    g.route = routeSummary(list);
    g.thirds = thirdsOf(g);
    g.pace = paceOf(g, baseline(null));
    g.conc = concOf(g, baseline(g.id));
    rec.conc = g.conc;
    const cl = document.getElementById("concLine");
    if (cl) cl.innerHTML = concLineHtml(g);
    rec.route = g.route;
    rec.moves = g.moves;
    // Keep the details for the latest games (default 40); older ones keep only the summary
    trimMoves(Math.max(1, settings.keepMoves ?? 40));
    saveGames();
    const el2 = document.getElementById("routeLine");
    if (el2) el2.innerHTML = routeLineHtml(g);
    const tk = document.getElementById("takeaway");
    if (tk) {
      tk.innerHTML = takeawayHtml(g);
      bindTakeaway(tk, g);
    }
  });
}
function routeLineHtml(rec) {
  if (rec.routePending || (!rec.route && rec.solved)) return tr("Analysing your solving route …");
  const r = rec.route;
  if (!r || !r.n) return tr("No moves to analyse.");
  const pct = Math.round((100 * r.easy) / r.n);
  const rest = [
    r.ahead ? tr("{n} thought ahead", { n: r.ahead }) : "",
    r.harder ? tr("{n} harder than needed", { n: r.harder }) : "",
    r.wrong
      ? r.wrong === 1
        ? r.follow ? tr("1 error (+{f} follow-up)", { f: r.follow }) : tr("1 error")
        : r.follow ? tr("{n} errors (+{f} follow-up)", { n: r.wrong, f: r.follow }) : tr("{n} errors", { n: r.wrong })
      : "",
    r.guess ? tr("{n} guesses", { n: r.guess }) : "",
  ].filter(Boolean);
  return (
    tr("<b>Route: {pct} %</b> of your moves were one of the easiest available.", { pct }) +
    (rest.length ? " " + rest.join(", ") + "." : "") +
    (r.longest >= 20000 ? " " + tr("Longest search: {time}.", { time: fmt(r.longest) }) : "") +
    `<span class="more">${tr("See the route analysis ›")}</span>`
  );
}
function median(arr) {
  if (!arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y),
    k = a.length >> 1;
  return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2;
}
// Remove the moves (the full route analysis) for all but the `keep` newest games with moves. Before that, make sure the game
// has every summary the statistics use: the route summary with times and context, concentration, pace and
// errors/hints per third. Afterwards the route analysis cannot be opened for those games, but every number in the statistics is the same.
// Returns the number of games cleared.
function trimMoves(keep) {
  let seen = 0,
    n = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    const g = games[i];
    if (!g.moves) continue;
    if (++seen <= keep) continue;
    markErrors(g.moves);
    if (!g.route || g.route.ctx === undefined) g.route = routeSummary(g.moves);
    if (g.thirds == null) g.thirds = thirdsOf(g);
    if (g.pace == null) g.pace = paceOf(g, baseline(null));
    if (g.conc == null) g.conc = concOf(g, baseline(g.id));
    delete g.moves;
    n++;
  }
  return n;
}
// Storage: how much do the stored data take up, and how much of it is route details (moves)?
function storageInfo() {
  let total = 0;
  const keys = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(APP.id + ".")) continue;
      const len = k.length + (localStorage.getItem(k) || "").length;
      keys[k.slice(7)] = len;
      total += len;
    }
  } catch (e) {}
  const withMoves = games.filter((g) => g.moves);
  const movesLen = withMoves.reduce((s, g) => s + JSON.stringify(g.moves).length, 0);
  // What do the newest k games' moves cost? (for "frees about")
  const perGame = withMoves.map((g) => JSON.stringify(g.moves).length).reverse(); // newest first
  const keepCost = (k) => perGame.slice(0, k).reduce((s, x) => s + x, 0);
  return { total, keys, history: keys.history || 0, moves: movesLen, nMoves: withMoves.length, keepCost };
}
function fmtS(sec) {
  sec = Math.round(sec);
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}
// Times per technique level (seconds) for a game; older games without a summary are computed from the moves
function timesOf(g) {
  if (g.route && g.route.times) return g.route.times;
  if (!g.moves) return {};
  const o = {};
  g.moves.forEach((m) => {
    const L = moveLevel(m);
    if (L && judged(m) && m.cls !== "wrong") (o[L] = o[L] || []).push(Math.round(m.dt / 1000));
  });
  return o;
}
// Your normal search time per level from earlier games (at least 3 moves)
function baseline(excludeId) {
  const all = {};
  games.forEach((g) => {
    if (g.id === excludeId) return;
    const t = timesOf(g);
    for (const L in t) (all[L] = all[L] || []).push(...t[L]);
  });
  const out = {};
  for (const L in all) if (all[L].length >= 3) out[L] = { med: median(all[L]), n: all[L].length };
  return out;
}
function routeChart(list, p) {
  const W = 330,
    H = 180,
    L = 24,
    R = 8,
    T = 10,
    B = 24,
    n = list.length;
  const lvOf = (m) => (m.cls === "wrong" || m.cls === "guess" ? 0 : m.cls === "hint" ? m.avail || 1 : moveLevel(m));
  const top = Math.min(12, Math.max(3, ...list.map(lvOf), ...list.map((m) => m.avail || 1)) + 1);
  const tmax = Math.max(1000, ...list.map((m) => m.t));
  const x = (t) => L + ((W - L - R) * t) / tmax;
  const y = (v) => T + (H - T - B) * (1 - (v - 1) / Math.max(1, top - 1));
  const col = {
    easy: "var(--indigo)",
    ahead: "var(--indigo)",
    harder: "var(--warn)",
    wrong: "var(--bad)",
    guess: "var(--bad)",
    hint: "var(--mute)",
  };
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Your moves over time: level and how long you searched")}">`;
  const step = top > 7 ? 2 : 1;
  for (let v = 1; v <= top; v += step)
    s +=
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>` +
      `<text x="${L - 7}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${v}</text>`;
  [0, 0.5, 1].forEach(
    (f) =>
      (s += `<text x="${x(f * tmax)}" y="${H - 6}" font-size="10" text-anchor="${f === 0 ? "start" : f === 1 ? "end" : "middle"}" fill="var(--mute)">${fmt(f * tmax)}</text>`),
  );
  // The easiest possible level as a staircase over time
  let path = "";
  list.forEach((m, i) => {
    const a = m.avail || 1;
    path += i ? `H${x(m.t - m.dt)}V${y(a)}` : `M${x(0)} ${y(a)}`;
  });
  path += `H${x(tmax)}`;
  s += `<path d="${path}V${y(1) + 6}H${x(0)}Z" fill="var(--chip)" opacity="0.9"/><path d="${path}" fill="none" stroke="var(--mute)" stroke-width="1" opacity="0.5"/>`;
  // Periods when an error stood on the board (from the main error until it and its follow-on errors are corrected)
  markErrors(list);
  list.forEach((m, i) => {
    if (m.cls !== "wrong" || m.follow || m.slip || m.legacy) return; // old games: it is not known when the error was erased
    const ends = list.filter((x, j) => j === i || (x.cls === "wrong" && x.cause === i)).map((x) => (x.fixT === undefined ? tmax : x.fixT));
    const x0 = x(m.t), x1 = x(Math.max(...ends));
    s += `<rect x="${x0}" y="${T}" width="${Math.max(2, x1 - x0)}" height="${H - T - B}" fill="var(--bad)" opacity="0.08"/>` +
      `<line x1="${x0}" x2="${x0}" y1="${T}" y2="${H - B}" stroke="var(--bad)" stroke-width="1" opacity="0.4"/>`;
  });
  list.forEach((m) => {
    if (!m.chk) return;
    const xc = x(m.chkT);
    s +=
      `<path d="M${xc - 5} ${H - B + 9}l5 -7l5 7z" fill="var(--mute)"/>` +
      `<rect x="${xc - 7}" y="${H - B}" width="14" height="12" fill="transparent" data-tip="${esc(tr("“Check for errors” used here (counts as a hint)"))}"/>`;
  });
  list.forEach((m, i) => {
    const lv = lvOf(m),
      yy = y(lv ? Math.min(lv, top) : top),
      x0 = x(m.t - m.dt),
      x1 = x(m.t);
    const nm = "abcdefghij"[m.c % p.cols] + (Math.floor(m.c / p.cols) + 1);
    // The search time as a line leading up to the move
    const faint = m.amid || m.unsure || m.slip || (m.cls === "wrong" && m.follow);
    s += `<line x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}" stroke="${faint ? "var(--mute)" : col[m.cls]}" stroke-width="3" stroke-linecap="round" opacity="${faint ? 0.25 : 0.5}"/>`;
    if (m.amid || m.unsure) s += `<circle cx="${x1}" cy="${yy}" r="3" fill="var(--mute)" opacity="0.55"/>`;
    else if (m.cls === "wrong" && (m.follow || m.slip))
      s += `<path d="M${x1 - 3} ${yy - 3}l6 6M${x1 + 3} ${yy - 3}l-6 6" stroke="var(--bad)" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/>`;
    else if (m.cls === "easy") s += `<circle cx="${x1}" cy="${yy}" r="4" fill="var(--indigo)" stroke="var(--cell)" stroke-width="2"/>`;
    else if (m.cls === "ahead") s += `<circle cx="${x1}" cy="${yy}" r="4.5" fill="var(--cell)" stroke="var(--indigo)" stroke-width="2"/>`;
    else if (m.cls === "harder")
      s += `<rect x="${x1 - 5}" y="${yy - 5}" width="10" height="10" rx="2" fill="var(--warn)" stroke="var(--cell)" stroke-width="2" transform="rotate(45 ${x1} ${yy})"/>`;
    else if (m.cls === "hint") s += `<rect x="${x1 - 3.5}" y="${yy - 3.5}" width="7" height="7" rx="1" fill="var(--mute)"/>`;
    else
      s += `<path d="M${x1 - 4.5} ${yy - 4.5}l9 9M${x1 + 4.5} ${yy - 4.5}l-9 9" stroke="var(--bad)" stroke-width="2.4" stroke-linecap="round"/>`;
    const what = m.amid
      ? tr("placed while an error was on the board, not judged")
      : m.unsure
        ? tr("placed after an error, not judged")
        : m.slip
          ? tr("mistap, fixed right away")
          : m.cls === "wrong" && m.follow ? tr("follow-up error") : ROUTE_CLS[m.cls].long;
    let tip = tr("Move {k} · {cell} = {v} · found after {time}: {what}", { k: i + 1, cell: nm, v: m.v, time: fmt(m.dt), what });
    if (lv && m.cls !== "hint") tip += ` · ${LEVEL_TECH[lv]}`;
    if (m.avail && m.cls !== "easy" && m.cls !== "hint" && m.cls !== "wrong") tip += " · " + tr("easiest: {tech}", { tech: LEVEL_TECH[m.avail] });
    s += `<rect x="${Math.min(x0, x1 - 6)}" y="${yy - 9}" width="${Math.max(12, x1 - x0 + 6)}" height="18" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  s +=
    `</svg><div class="legendrow" style="flex-wrap:wrap;justify-content:flex-start;gap:4px 12px">` +
    `<span><i style="background:var(--indigo);border-radius:50%"></i> ${tr("easiest")}</span>` +
    `<span><i style="box-shadow:inset 0 0 0 2px var(--indigo);border-radius:50%"></i> ${tr("thought ahead")}</span>` +
    `<span><i style="background:var(--warn);transform:rotate(45deg) scale(.85)"></i> ${tr("harder")}</span>` +
    `<span><b style="color:var(--bad)">×</b> ${tr("error/guess")}</span><span><i style="background:var(--mute)"></i> ${tr("hint")}</span>` +
    `<span><i style="background:color-mix(in srgb, var(--bad) 14%, transparent)"></i> ${tr("error on the board")}</span>` +
    `<span><i style="background:var(--chip);box-shadow:inset 0 1px 0 var(--mute)"></i> ${tr("easiest available")}</span></div>`;
  return s;
}
// "Thought ahead": the number could not be seen directly at the easiest level, but follows once other numbers are placed first.
// The player has typically found those numbers in their head and gone on without writing them down. It is not a mistake.
const list2 = (arr) => (arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " " + tr("and") + " " + arr[arr.length - 1]);
// back: opened from the solved sheet. Then Close leads back there, and there is a direct button to a new puzzle.
// ---------- What you can learn: lessons from the route
// A lesson is one easy number that was ready while you spent time on something else: harder moves, guesses, thinking ahead or a long
// search. All moves while the same number was ready are gathered into one lesson, so the same number is not shown several times.
// A long search for the easiest number itself (which was hard to spot) is also a lesson.
// Thinking ahead alone is not a lesson (it is not a mistake), and long searches while many easy numbers were ready belong
// under concentration. A lesson must have cost at least 8 seconds more than normal. Sorted by what it cost.
function routeLessons(g) {
  const list = g.moves;
  if (!list || !list.length) return [];
  markErrors(list);
  const base = baseline(g.id);
  const usual = (L) => (base[L] ? base[L].med : L === 1 ? 4 : 8 * L * L);
  const gameMed = median(list.filter((m) => m.cls !== "hint" && m.cls !== "wrong").map((m) => m.dt / 1000));
  const lapse = new Set(((concGet(g) || {}).idx || []).filter((i) => list[i] && list[i].cls !== "wrong"));
  const isStuck = (m) => {
    const bl = base[m.avail],
      sec = m.dt / 1000;
    return m.avail && (bl ? sec >= Math.max(30, 2.5 * bl.med) : sec >= Math.max(45, 3 * gameMed));
  };
  const P2 = g.code ? routePuzzle(g) : null;
  const before = (i) => {
    if (!P2) return null;
    try {
      const k = boardBefore(P2, list, i);
      return k.unsure.length ? null : k;
    } catch (e) {
      return null;
    }
  };
  const easiestAt = (m, known) => {
    if (m.best) return { c: m.best.c, v: m.best.v, L: m.best.L, tech: m.best.tech };
    if (!known) return null;
    const h = P2.tu.easiest(known);
    return h ? { c: h.cell, v: h.v, L: h.hardestLevel, tech: h.hardest } : null;
  };
  // Was a number that already has a lesson still ready as one of the easiest? Then the move belongs to that lesson, even
  // when the hint engine would at that moment have pointed to another, equally easy number.
  const stillWaiting = (known, avail) =>
    out.find((L) => {
      if (!L.e || known[L.e.c]) return false;
      const r = P2.tu.routeMove(known, L.e.c, L.e.v);
      return r && r.direct <= avail;
    });
  const byKey = new Map(),
    out = [];
  list.forEach((m, i) => {
    if (!judged(m) || m.cls === "wrong" || !(m.dt > 0)) return;
    const kind = m.cls === "harder" || m.cls === "guess" || m.cls === "ahead" ? m.cls : null;
    const stuck = isStuck(m) && !lapse.has(i);
    if (!kind && !stuck) return;
    const known = before(i);
    let L = known ? stillWaiting(known, m.avail) : null;
    const e = L ? L.e : easiestAt(m, known);
    if (!e && !kind) return;
    const self = !!e && m.c === e.c && m.v === e.v;
    if (self && !stuck) return; // found the easy number (by a detour in the head) without searching long: nothing to learn
    const key = e ? e.c * 16 + e.v : "m" + i;
    L = L || byKey.get(key);
    if (!L) {
      L = { e, avail: m.avail, nAvail: m.nAvail, parts: [], cost: 0, spent: 0, self: 0, selfDt: 0, real: false };
      byKey.set(key, L);
      out.push(L);
    }
    // a long search that ended in thinking ahead is still a long search while the number was ready
    const sec = m.dt / 1000,
      type = self ? "self" : kind === "ahead" && stuck ? "search" : kind || "search";
    L.parts.push({ i, type, sec });
    if (type === "self") (L.self = i + 1), (L.selfDt = sec);
    else L.spent += sec;
    if (type !== "ahead") {
      L.real = true;
      L.cost += Math.max(0, sec - usual(m.avail));
    }
  });
  out.forEach((L) => {
    const others = L.parts.filter((x) => x.type !== "self");
    L.board = others.length ? others[0].i : L.parts[0].i;
    // your move against the easy number; or (a long search for the easy number itself) the number and the others just as easy,
    // or only the number if it was the only one
    L.mode = others.length ? "cmp" : L.nAvail > 1 ? "easy" : "one";
    if (L.e && !L.self) {
      const last = L.parts[L.parts.length - 1].i,
        j = list.findIndex((x, k) => k > last && x.c === L.e.c && x.v === L.e.v);
      if (j >= 0) L.found = { k: j + 1, hint: list[j].cls === "hint" };
    }
  });
  return out.filter((L) => L.real && L.cost >= 8).sort((a, b) => b.cost - a.cost);
}
// ---------- Advice for an overlooked easy number (naked/hidden single), from what made exactly that number easy to see
// In order of priority: your own move just before opened it up; the number was almost finished on the board (Sudoku); the house was
// almost full; the cell saw all other numbers; the number could only go in one place in the house. Gives null if the number was not direct.
function spotTip(g, e, i) {
  const P2 = g.code ? routePuzzle(g) : null;
  if (!P2 || !e) return null;
  const list = g.moves;
  const M = P2.M || (P2.M = boardModel(P2.G, P2.d.region));
  const nm = (c) => "abcdefghij"[c % P2.d.cols] + (Math.floor(c / P2.d.cols) + 1);
  const at = (j) => {
    try {
      const k = boardBefore(P2, list, j);
      return k.unsure.length ? null : k;
    } catch (er) {
      return null;
    }
  };
  // direct: naked single, or hidden single in a house (hidden: the houses where that is the case)
  const direct = (known, c, v) => {
    if (known[c] || v > M.size[c]) return null;
    const seen = new Set(M.peers[c].map((x) => known[x]).filter(Boolean));
    const naked = !seen.has(v) && [...Array(M.size[c]).keys()].every((k) => k + 1 === v || seen.has(k + 1));
    const hidden = M.unitsOf[c].filter((u) =>
      M.RC[u].every((x) => x === c || known[x] || v > M.size[x] || M.peers[x].some((y) => known[y] === v)),
    );
    return seen.has(v) ? null : naked || hidden.length ? { naked, hidden } : null;
  };
  const known = at(i);
  if (!known) return null;
  const d = direct(known, e.c, e.v);
  if (!d) return null;
  // 1. opened by one of your three latest numbers
  for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
    const kb = at(j);
    if (!kb) break;
    if (direct(kb, e.c, e.v)) continue; // was already ready before move j
    const m = list[j]; // move j made it possible; only your own correct number gives the advice
    if (m.cls !== "wrong" && m.cls !== "hint" && m.v === P2.sol[m.c])
      return tr("It became possible when you placed {cell} = {v}.", { cell: nm(m.c), v: m.v }) + " " + GAME.followTip;
    break;
  }
  // 2. the number was almost finished on the board
  const n = M.size[e.c];
  const placed = known.filter((x) => x === e.v).length;
  if (GAME.digitTip && placed >= n - 2) return tr("{v} was already placed {k} of {n} times.", { v: e.v, k: placed, n }) + " " + GAME.digitTip;
  // 3. an almost full house
  const houses = d.hidden.length ? d.hidden : M.unitsOf[e.c];
  const free = (u) => M.RC[u].filter((x) => !known[x]).length;
  const u = houses.reduce((a, b) => (free(b) < free(a) ? b : a));
  if (free(u) <= 3) return tr("{house} had only {k} empty cells.", { house: cap(M.unitName(u, nm, list2)), k: free(u) }) + " " + GAME.fullTip;
  // 4. how it could be seen
  if (d.naked) return tr("{cell} could only be {v}: all other numbers were already around it.", { cell: nm(e.c), v: e.v }) + " " + GAME.nakedTip;
  return tr("In {house}, {v} could only go in {cell}.", { house: M.unitName(u, nm, list2), v: e.v, cell: nm(e.c) }) + " " + GAME.hiddenTip;
}
// What you spent the time on while the number was ready: "2 harder moves and a long search"
function lessonParts(L) {
  const n = (t) => L.parts.filter((x) => x.type === t).length;
  const a = [];
  const h = n("harder"),
    gs = n("guess"),
    se = n("search"),
    ah = n("ahead");
  if (h) a.push(h === 1 ? tr("a harder move") : tr("{n} harder moves", { n: h }));
  if (gs) a.push(gs === 1 ? tr("a guess") : tr("{n} guesses", { n: gs }));
  if (se) a.push(se === 1 ? tr("a long search") : tr("{n} long searches", { n: se }));
  if (ah) a.push(ah === 1 ? tr("a move thought ahead") : tr("{n} moves thought ahead", { n: ah }));
  return list2(a);
}
// One lesson, short: the number and the technique, what happened (one line), the advice (only the first time for the technique) and the board folded
function lessonHtml(g, L, nm, tipShown) {
  const base = baseline(g.id);
  const m0 = g.moves[L.parts[0].i];
  const lvl = L.e ? L.e.L : m0.avail;
  const head = L.e ? `${nm(L.e.c)} = ${L.e.v} · ${esc(LEVEL_TECH[lvl])}` : `${nm(m0.c)} = ${m0.v} · ${esc(LEVEL_TECH[m0.avail])}`;
  const facts = [];
  if (L.parts.some((x) => x.type !== "self")) facts.push(tr("Waiting during {parts}", { parts: lessonParts(L) }));
  if (L.self) facts.push(base[lvl] ? tr("Searched for it (usually {usual})", { usual: fmtS(base[lvl].med) }) : tr("Searched for it"));
  if (L.nAvail === 1) facts.push(tr("the only number at that level"));
  else if (L.nAvail > 1 && !L.self) facts.push(tr("{n} numbers were waiting", { n: L.nAvail }));
  if (L.found) facts.push(L.found.hint ? tr("placed with a hint") : tr("found later"));
  let tip = "";
  const spot = lvl === 1 && L.e ? spotTip(g, L.e, L.parts[0].i) : null;
  if (spot) tip = `<p class="lstip"><b>${tr("Next time")}</b> ${spot}</p>`;
  else if (TECH_TIP[lvl] && !tipShown.has(lvl)) {
    tipShown.add(lvl);
    tip = `<p class="lstip"><b>${tr("Next time")}</b> ${TECH_TIP[lvl]}</p>`;
  }
  const guide = L.e && GAME.guide && GUIDE_IDS[L.e.tech] ? `<button class="link" type="button" data-guide="${L.e.tech}">${tr("Read about {tech} in the guide", { tech: TECH_NAMES_UI[L.e.tech] })}</button>` : "";
  return (
    `<div class="lshead"><b class="k">${head}</b><span class="lstime">${fmt((L.spent + L.selfDt) * 1000)}</span></div>` +
    `<p class="lsfacts">${facts.join(" · ")}</p>` +
    tip +
    (g.code ? `<details class="lsfold"><summary>${tr("See it on the board")}</summary>${mboardSlot(g, { i: L.board }, L.mode)}${guide}</details>` : "")
  );
}
// Short version for "Next time" after solving
function lessonShort(L, nm, g) {
  const e = L.e;
  if (!e) return null;
  const tech = LEVEL_TECH[e.L];
  const tip = (e.L === 1 && g && spotTip(g, e, L.parts[0].i)) || TECH_TIP[e.L];
  return (
    (L.parts.some((x) => x.type !== "self")
      ? tr("{cell} = {v} ({tech}) was waiting during {parts}.", { cell: nm(e.c), v: e.v, tech, parts: lessonParts(L) })
      : tr("You searched {time} for {cell} = {v} ({tech}).", { cell: nm(e.c), v: e.v, tech, time: fmt(L.selfDt * 1000) })) +
    (tip ? " " + tip : "")
  );
}
function showRoute(g, back) {
  const list = g.moves,
    r = g.route || routeSummary(list),
    p = { cols: g.cols };
  const nm = (c) => "abcdefghij"[c % g.cols] + (Math.floor(c / g.cols) + 1);
  const pct = r.n ? Math.round((100 * r.easy) / r.n) : 0;
  const base = baseline(g.id);
  // Error episodes: a main error with follow-on errors and the numbers placed meanwhile
  const episodes = list
    .map((m, i) => Object.assign({ i }, m))
    .filter((m) => m.cls === "wrong" && !m.follow && !m.slip)
    .map((m) => {
      const follow = list.map((x, j) => Object.assign({ i: j }, x)).filter((x) => x.cls === "wrong" && x.follow && x.cause === m.i);
      const amid = list.filter((x) => x.amid && x.cause === m.i).length;
      const ends = [m, ...follow].map((x) => x.fixT);
      const fixed = ends.every((t) => t !== undefined) ? Math.max(...ends) : null;
      return { m, follow, amid, fixed };
    });
  // Time per technique in this game, compared with your normal time
  const times = timesOf(g);
  const tRows = Object.keys(times)
    .map(Number)
    .sort((a, b) => a - b)
    .map((L) => {
      const med = median(times[L]),
        bl = base[L];
      let cmp = "";
      if (bl && times[L].length >= 1) {
        const d = med / Math.max(1, bl.med);
        cmp = d >= 1.4 ? tr("slower than usual") : d <= 0.7 ? tr("faster than usual") : "";
      }
      return (
        `<tr><td>${L}</td><td>${esc(LEVEL_TECH[L])}</td><td>${times[L].length}</td><td><b>${fmtS(med)}</b></td><td>${bl ? fmtS(bl.med) : "–"}</td></tr>` +
        (cmp
          ? `<tr><td></td><td colspan="4" style="border-top:0;padding-top:0;color:var(--mute)">${cmp}</td></tr>`
          : "")
      );
    })
    .join("");

  // What you can learn: one lesson per overlooked easy number (see routeLessons). The three most important are shown, the rest under "More".
  const lessons = routeLessons(g),
    tipShown = new Set();

  // The main points, short and in the order they matter
  const key = [];
  if (episodes.length) {
    const nf = episodes.reduce((t, e) => t + e.follow.length, 0),
      na = episodes.reduce((t, e) => t + e.amid, 0);
    key.push(
      (episodes.length === 1 ? tr("<b>1 error</b>") : tr("<b>{n} errors</b>", { n: episodes.length })) +
        (nf ? (nf === 1 ? tr(", 1 follow-on error") : tr(", {n} follow-on errors", { n: nf })) : "") +
        ".",
    );
  }
  const nc = list.reduce((a, m) => a + (m.chk || 0), 0);
  if (nc) key.push(nc === 1 ? tr("Errors shown once (counts as a hint).") : tr("Errors shown {n} times (counts as hints).", { n: nc }));
  const ns = list.filter((m) => m.slip).length;
  if (ns)
    key.push(
      ns === 1 ? tr("1 slip (does not count).") : tr("{n} slips (do not count).", { n: ns }),
    );
  const nu = list.filter((m) => m.unsure).length;
  if (nu)
    key.push(
      (nu === 1 ? tr("1 move after an error is not judged.") : tr("{n} moves after an error are not judged.", { n: nu })) +
        " " +
        tr("The game is from an older version that did not save erasures, so it is not known what the board looked like."),
    );
  if (lessons.length)
    key.push(lessons.length === 1 ? tr("<b>1 overlooked number.</b>") : tr("<b>{n} overlooked numbers.</b>", { n: lessons.length }));
  if (r.ahead) key.push(r.ahead === 1 ? tr("You thought ahead once and got it right.") : tr("You thought ahead {n} times and got it right.", { n: r.ahead }));
  if (r.guess) key.push(r.guess === 1 ? tr("1 guess that worked out.") : tr("{n} guesses that worked out.", { n: r.guess }));
  if (r.hints) key.push(r.hints === 1 ? tr("1 number placed with a hint.") : tr("{n} numbers placed with a hint.", { n: r.hints }));

  // What was wrong with an error, short (without advice): e.g. "It touched g2 = 1."
  const P2e = g.code ? routePuzzle(g) : null;
  const errWhat = (m) => {
    if (!P2e) return "";
    try {
      const known = boardBefore(P2e, list, m.i);
      if (known.unsure.length) return "";
      const vis = known.slice();
      known.wrong.forEach(([c, v]) => (vis[c] = v));
      return GAME.ruleBreak(P2e, vis, m.c, m.v, nm, true) || tr("Nothing on the board ruled it out directly.");
    } catch (er) {
      return "";
    }
  };
  const epText = (e) =>
    `<div class="lshead"><b class="k">${nm(e.m.c)} = ${e.m.v}</b><span class="lstime">${tr("move {k}", { k: e.m.i + 1 })}</span></div>` +
    `<p class="lsfacts">${[
      errWhat(e.m),
      e.m.legacy ? "" : e.fixed !== null ? tr("Fixed after {time}.", { time: fmt(e.fixed - e.m.t) }) : tr("Not fixed."),
      e.m.shown ? tr("Found with “Check for errors”.") : "",
      e.follow.length ? (e.follow.length === 1 ? tr("1 follow-on error.") : tr("{n} follow-on errors.", { n: e.follow.length })) : "",
      e.amid ? (e.amid === 1 ? tr("1 correct number placed meanwhile is not judged.") : tr("{n} correct numbers placed meanwhile are not judged.", { n: e.amid })) : "",
    ]
      .filter(Boolean)
      .join(" ")}</p>` +
    (g.code ? `<details class="lsfold"><summary>${tr("See it on the board")}</summary>${mboardSlot(g, e.m, "err")}</details>` : "");
  const section = (title, count, body, open) =>
    `<details class="rdet"${open ? " open" : ""}><summary><span>${title}</span>${count !== "" ? `<small>${count}</small>` : ""}</summary>${body}</details>`;
  const lapses = concRouteHtml(g, nm);
  const nLapse = (concGet(g) || { idx: [] }).idx.filter((i) => list[i] && list[i].cls !== "wrong").length;

  openSheet(
    `<h2>${tr("Your solving route")}</h2><p class="sub" style="color:var(--mute)">${esc(BAND[gBand(g)])} ${dec(gradeFor(g))} · ${g.cols}×${g.rows} · ${new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" })} · ${fmt(g.ms)}</p>` +
      `<div class="rkpi"><b>${pct} %</b><span>${tr("of {n} moves were one of the easiest available at the time.", { n: r.n })}</span></div>` +
      (key.length ? `<ul class="keypts">${key.map((t) => `<li>${t}</li>`).join("")}</ul>` : "") +
      routeChart(list, p) +
      `<div class="rsecs">` +
      (episodes.length ? section(tr("Errors"), episodes.length, `<ul class="notable lessons">${episodes.map((e) => `<li>${epText(e)}</li>`).join("")}</ul>`, true) : "") +
      (lessons.length
        ? section(
            tr("What you can learn"),
            lessons.length,
            `<ul class="notable lessons">${lessons
              .slice(0, 3)
              .map((L) => `<li>${lessonHtml(g, L, nm, tipShown)}</li>`)
              .join("")}</ul>` +
              (lessons.length > 3
                ? `<details class="rdet more"><summary><span>${tr("More")}</span><small>${lessons.length - 3}</small></summary><ul class="notable lessons">${lessons
                    .slice(3)
                    .map((L) => `<li>${lessonHtml(g, L, nm, tipShown)}</li>`)
                    .join("")}</ul></details>`
                : ""),
            true,
          )
        : "") +
      (tRows
        ? section(
            tr("Time per technique"),
            "",
            `<table class="data"><tr><th></th><th>${tr("The move needed")}</th><th>${tr("Moves")}</th><th>${tr("Median")}</th><th>${tr("Usual")}</th></tr>${tRows}</table>` +
              (Object.keys(base).length ? "" : `<p class="caveat">${tr("“Usual” fills in once you have solved a few more puzzles.")}</p>`),
          )
        : "") +
      (nLapse ? section(tr("Lapses in concentration"), nLapse, lapses) : "") +
      section(
        tr("About the analysis"),
        "",
        `<p class="caveat">${tr("Each line is the time from the previous number until you placed this one. Long lines are where you searched.")}</p>` +
          `<p class="caveat">${tr("The analysis only knows the numbers you wrote and when. Time is measured from the previous number, so if you found two numbers at once, the second looks quick, and time spent on pencil notes is included. A “harder” move may also have been found another way.")}</p>` +
          `<p class="caveat">${tr("An error counts once, even if it leads to more wrong numbers. Numbers placed while a wrong number is on the board are not judged, because they were found from a wrong position.")}</p>`,
      ) +
      `</div>` +
      (back
        ? `<div class="actions"><button class="primary big" type="button" id="rtNew">${tr("New puzzle")} · ${esc(BAND[ui.level])}</button>` +
          `<div class="actions row2" style="margin:0"><button class="secondary" type="button" id="rtAgain">${tr("Play again")}</button><button class="secondary" type="button" id="rtClose">${tr("Back")}</button></div></div>`
        : `<div class="actions row2"><button class="secondary" type="button" id="rtAgain">${tr("Play again")}</button><button class="primary" type="button" id="rtClose">${tr("Close")}</button></div>`) +
      noteLink("route"),
    (b2) => {
      bindMboards(b2, g);
      b2.querySelectorAll("[data-guide]").forEach((b) => (b.onclick = () => openGuide(+b.dataset.guide)));
      bindNoteLinks(b2, g, () => showRoute(g, back));
      b2.querySelector("#rtClose").onclick = closeSheet;
      const leave = (f) => {
        sheetOnClose = null; // not back to the solved sheet when you move on
        closeSheet();
        setTimeout(f, 280);
      };
      b2.querySelector("#rtAgain").onclick = () => leave(() => replaceGame(() => importCode(g.code, { replay: true })));
      if (back) b2.querySelector("#rtNew").onclick = () => leave(generateFromUi);
    },
    back ? () => setTimeout(back, 280) : null,
  );
}
// ---------- The board at a harder move: what you did, and what was easier at that moment
// The board is rebuilt from the puzzle code and your correct numbers before the move. Both explanations are made by the hint engine.
// mode "cmp": your move against the easiest move at that moment. mode "easy": your move and all the easy numbers that could be taken.
const mboardSlot = (g, m, mode = "cmp") => (g.code ? `<div class="mboard" data-mi="${m.i}" data-mode="${mode}"><span class="mbwait">${tr("Drawing the board …")}</span></div>` : "");
const ROUTE_PUZ = {};
function routePuzzle(g) {
  if (ROUTE_PUZ[g.id]) return ROUTE_PUZ[g.id];
  const d = decodePuzzle(g.code),
    G2 = E.makeGeometry(d.rows, d.cols),
    u = E.createSolver(G2, d.region).uniqueSolution(d.givens);
  if (!u.solution) return null;
  const size = {};
  d.region.forEach((r) => (size[r] = (size[r] || 0) + 1));
  return (ROUTE_PUZ[g.id] = { d, G: G2, sol: Array.from(u.solution), tu: createTutor(G2, d.region), maxR: Math.max(...Object.values(size)) });
}
// The board just before move i. Newer games store it exactly (b). Older games are rebuilt from the placed numbers; the eraser,
// undo and "start over" are not stored there, so a number that is placed again later in the same cell may have been gone
// in between. Those cells are uncertain (unsure), and then the board is not drawn.
// Result: correct numbers (for the hint engine) with .wrong = [[cell, number]] for wrong numbers on the board and .unsure = [cells].
function boardBefore(P2, list, i) {
  const k = P2.d.givens.slice(),
    wrong = [],
    unsure = [];
  const b = list[i].b;
  if (b && b.length === k.length) {
    for (let c = 0; c < k.length; c++) {
      const v = +b[c];
      if (!v || k[c]) continue;
      if (v === P2.sol[c]) k[c] = v;
      else wrong.push([c, v]);
    }
  } else {
    for (let j = 0; j < i; j++) {
      const x = list[j];
      if (x.v === P2.sol[x.c] && !k[x.c]) k[x.c] = x.v;
    }
    (list[i].er || []).forEach((c) => (k[c] = P2.d.givens[c] || 0)); // erased again
    if (!P2.d.givens[list[i].c]) k[list[i].c] = 0; // the cell being filled now was empty (or had a wrong number)
    for (let j = i; j < list.length; j++) {
      const x = list[j];
      if (x.v === P2.sol[x.c] && k[x.c] && !P2.d.givens[x.c] && !(list[i].er || []).includes(x.c) && unsure.indexOf(x.c) < 0 && j !== i) unsure.push(x.c);
    }
  }
  k.wrong = wrong;
  k.unsure = unsure;
  return k;
}
// The part of the explanation that shows what decides it: the step with the hardest technique, or the number itself for simple moves
function keyView(h) {
  const steps = h.views.filter((v) => !v.nudge && !v.final);
  if (!steps.length) return h.views[h.views.length - 1];
  const hard = steps.filter((v) => v.tech === h.hardest);
  const kv = (hard.length ? hard[hard.length - 1] : steps[steps.length - 1]) || steps[0];
  // For a what-if, the assumption (with the assumed numbers on the board) says more than the conclusion alone
  const prev = h.views[h.views.indexOf(kv) - 1];
  if (prev && prev.hypo && prev.tech === kv.tech && !kv.hypo) return Object.assign({}, prev, { text: prev.text + " " + kv.text });
  return kv;
}
// opts (optional): color = {cell: colour} for your numbers, corner = {cell: colour} for a small corner, label = description
function miniBoard(P2, known, hv, mark, head = {}, opts = {}) {
  const wrongAt = {};
  (known.wrong || []).forEach(([c, v]) => (wrongAt[c] = v));
  const marks = Array.isArray(mark) ? mark : mark ? [mark] : [];
  const { rows, cols, region } = P2.d,
    S = 100,
    giv = P2.d.givens,
    pos = P2.maxR >= 7 ? NOTE_POS9 : P2.maxR >= 6 ? NOTE_POS6 : NOTE_POS5;
  const pat = new Set(hv ? hv.pattern || [] : []),
    tgt = new Set(hv ? hv.target || [] : []),
    bad = new Set(hv && hv.bad ? hv.bad : []),
    hypo = (hv && hv.hypo) || {},
    cand = (hv && hv.cand) || {},
    strike = (hv && hv.strike) || {};
  let s = `<svg viewBox="-30 -30 ${cols * S + 36} ${rows * S + 36}" role="img" aria-label="${esc(opts.label || tr("The board before the move"))}">`;
  for (let c = 0; c < cols; c++) s += `<text x="${c * S + 50}" y="-10" font-size="22" text-anchor="middle" fill="var(--mute)">${"abcdefghij"[c]}</text>`;
  for (let r = 0; r < rows; r++) s += `<text x="-16" y="${r * S + 58}" font-size="22" text-anchor="middle" fill="var(--mute)">${r + 1}</text>`;
  for (let i = 0; i < rows * cols; i++) {
    const x = (i % cols) * S,
      y = Math.floor(i / cols) * S;
    let fill = giv[i] ? "var(--given)" : "var(--cell)";
    if (pat.has(i)) fill = "var(--pat)";
    if (tgt.has(i)) fill = "var(--tgt)";
    if (bad.has(i)) fill = "var(--badbg)";
    s += `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${fill}" stroke="var(--grid)" stroke-width="2"/>`;
    const v = known[i];
    if (v)
      s += giv[i]
        ? `<text x="${x + 50}" y="${y + 72}" font-size="62" font-weight="800" text-anchor="middle" fill="var(--ink)" font-family="Shippori Mincho B1, Georgia, serif">${v}</text>`
        : `<text x="${x + 50}" y="${y + 70}" font-size="54" text-anchor="middle" fill="${(opts.color && opts.color[i]) || "var(--indigo)"}">${v}</text>`;
    if (opts.corner && opts.corner[i]) s += `<path d="M${x + S - 30} ${y + 2}h28v28z" fill="${opts.corner[i]}"/>`;
    else if (wrongAt[i] !== undefined && !(mark && (Array.isArray(mark) ? mark : [mark]).some((k) => k.c === i)))
      s += `<text x="${x + 50}" y="${y + 70}" font-size="54" text-anchor="middle" fill="var(--bad)">${wrongAt[i]}</text>`;
    else if (head[i] !== undefined) {
      s += `<circle cx="${x + 50}" cy="${y + 50}" r="34" fill="none" stroke="var(--warn)" stroke-width="3" stroke-dasharray="5 6"/>`;
      s += `<text x="${x + 50}" y="${y + 67}" font-size="46" font-weight="700" text-anchor="middle" fill="var(--warn)">${head[i]}</text>`;
    } else if (marks.some((k) => k.c === i)) {
      const mk = marks.find((k) => k.c === i);
      s += `<circle cx="${x + 50}" cy="${y + 50}" r="40" fill="none" stroke="${mk.col}" stroke-width="6"/>`;
      s += `<text x="${x + 50}" y="${y + 70}" font-size="56" font-weight="800" text-anchor="middle" fill="${mk.col}">${mk.v}</text>`;
    } else if (hypo[i] !== undefined) {
      s += `<circle cx="${x + 50}" cy="${y + 50}" r="36" fill="none" stroke="var(--hypo)" stroke-width="3" stroke-dasharray="5 6"/>`;
      s += `<text x="${x + 50}" y="${y + 68}" font-size="48" font-weight="700" text-anchor="middle" fill="var(--hypo)">${hypo[i]}</text>`;
    } else if (cand[i] !== undefined) {
      for (let dg = 1; dg <= 9; dg++) {
        if (!(cand[i] & (1 << dg)) || !pos[dg]) continue;
        const [px, py] = pos[dg],
          st = (strike[i] || 0) & (1 << dg);
        s += `<text x="${x + px}" y="${y + py + 9}" font-size="25" text-anchor="middle" fill="${st ? "var(--bad)" : "var(--mute)"}" font-weight="${st ? 700 : 500}">${dg}</text>`;
        if (st) s += `<line x1="${x + px - 11}" y1="${y + py + 11}" x2="${x + px + 11}" y2="${y + py - 9}" stroke="var(--bad)" stroke-width="3" stroke-linecap="round"/>`;
      }
    }
  }
  // Region borders
  let path = "";
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c < cols - 1 && region[i] !== region[i + 1]) path += `M${(c + 1) * S} ${r * S}v${S}`;
      if (r < rows - 1 && region[i] !== region[i + cols]) path += `M${c * S} ${(r + 1) * S}h${S}`;
    }
  s += `<path d="${path}" stroke="var(--ink)" stroke-width="6" stroke-linecap="square" fill="none"/>`;
  s += `<rect x="0" y="0" width="${cols * S}" height="${rows * S}" fill="none" stroke="var(--ink)" stroke-width="7"/></svg>`;
  return s;
}
function mboardHtml(g, i, mode) {
  const P2 = routePuzzle(g);
  if (!P2) return "";
  const list = g.moves,
    m = list[i],
    known = boardBefore(P2, list, i);
  const nm = (c) => "abcdefghij"[c % P2.d.cols] + (Math.floor(c / P2.d.cols) + 1);
  if (known.unsure.length)
    return `<p class="mbnote">${tr("The board cannot be drawn reliably here. The game is from before the app saved the whole board, and some numbers were erased or undone along the way ({cells}), so it is not known whether they were there.", { cells: list2(known.unsure.slice(0, 4).map(nm)) + (known.unsure.length > 4 ? " " + tr("and more") : "") })}</p>`;
  if (mode === "err") {
    // An error: what you placed, and what should have been there (with an explanation, if it could be seen without guessing)
    const right = P2.sol[m.c],
      h = P2.tu.explainMove(known, m.c, right),
      alt = h ? null : P2.tu.easiest(known);
    const hh = h || alt,
      kv = hh ? keyView(hh) : null;
    const left =
      `<figure class="mbcol"><figcaption><b style="color:var(--bad)">${tr("What you placed")}</b><br>${nm(m.c)} = ${m.v}</figcaption>` +
      miniBoard(P2, known, null, { c: m.c, v: m.v, col: "var(--bad)" }) +
      `</figure>`;
    const rightCol = hh
      ? `<figure class="mbcol"><figcaption><b style="color:var(--indigo)">${h ? tr("The right number") : tr("The easiest move then")}</b><br>${nm(hh.cell)} = ${hh.v} · ${esc(LEVEL_TECH[hh.hardestLevel])}</figcaption>` +
        miniBoard(P2, known, kv, { c: hh.cell, v: hh.v, col: "var(--indigo)" }) +
        (kv && kv.text ? `<p class="mbtext">${esc(kv.text)}</p>` : "") +
        `</figure>`
      : "";
    return `<div class="mbpair">${left}${rightCol}</div>`;
  }
  if (mode === "one") {
    // The only number that could be found: only that and the explanation
    const mine = P2.tu.explainMove(known, m.c, m.v),
      kv = mine ? keyView(mine) : null;
    return (
      `<div class="mbpair one"><figure class="mbcol"><figcaption><b style="color:var(--indigo)">${tr("How it could be found")}</b><br>${nm(m.c)} = ${m.v}${mine ? " · " + esc(LEVEL_TECH[mine.hardestLevel]) : ""}</figcaption>` +
      miniBoard(P2, known, kv, { c: m.c, v: m.v, col: "var(--indigo)" }) +
      (kv && kv.text ? `<p class="mbtext">${esc(kv.text)}</p>` : "") +
      `</figure></div>`
    );
  }
  if (mode === "easy") {
    // An easy number that took long: what you found, and how many other easy numbers were ready
    const mine = P2.tu.explainMove(known, m.c, m.v),
      kv = mine ? keyView(mine) : null,
      all = P2.tu.easyList(known);
    const left =
      `<figure class="mbcol"><figcaption><b style="color:var(--warn)">${tr("What you found")}</b><br>${nm(m.c)} = ${m.v}${mine ? " · " + esc(LEVEL_TECH[mine.hardestLevel]) : ""}</figcaption>` +
      miniBoard(P2, known, kv, { c: m.c, v: m.v, col: "var(--warn)" }) +
      (kv && kv.text ? `<p class="mbtext">${esc(kv.text)}</p>` : "") +
      `</figure>`;
    const others = all.filter(([c]) => c !== m.c);
    const right = others.length
      ? `<figure class="mbcol"><figcaption><b style="color:var(--indigo)">${tr("Easy numbers then")}</b><br>${others.length === 1 ? tr("One other to choose") : tr("{n} others to choose from", { n: others.length })}</figcaption>` +
        miniBoard(
          P2,
          known,
          null,
          others.map(([c, v]) => ({ c, v, col: "var(--indigo)" })).concat([{ c: m.c, v: m.v, col: "var(--warn)" }]),
        ) +
        `<p class="mbtext">${GAME.directAll}</p></figure>`
      : `<figure class="mbcol"><figcaption><b style="color:var(--indigo)">${tr("Easy numbers then")}</b><br>${tr("That was the only one.")}</figcaption></figure>`;
    return `<div class="mbpair">${left}${right}</div>`;
  }
  // Could the move be found more easily by placing other numbers in your head first (thought ahead)? Then that route is shown,
  // and the hardest step on the route is the one that is drawn.
  const r = P2.tu.routeMove(known, m.c, m.v),
    head = {};
  let mine,
    extra = "",
    lvl = null;
  if (r && r.ahead && r.ahead.level < r.direct) {
    const kk = known.slice();
    let best = null;
    for (const [c, v] of r.ahead.via) {
      const h = P2.tu.explainMove(kk, c, v);
      if (h && (!best || h.hardestLevel > best.h.hardestLevel)) best = { h, c, v };
      kk[c] = v;
      head[c] = v;
    }
    const fin = P2.tu.explainMove(kk, m.c, m.v);
    const vs = r.ahead.via.map(([c, v]) => nm(c) + " = " + v),
      viaTxt = list2(vs.slice(0, 4)) + (vs.length > 4 ? " " + tr("and more") : "");
    lvl = r.ahead.level;
    if (best && fin && best.h.hardestLevel > fin.hardestLevel) {
      mine = best.h;
      extra =
        "<br>" +
        tr("first {via} in your head ({tech}), then {cell} ({tech2})", {
          via: viaTxt,
          tech: LEVEL_TECH[best.h.hardestLevel],
          cell: nm(m.c),
          tech2: LEVEL_TECH[fin.hardestLevel],
        });
    } else {
      mine = fin;
      extra = "<br>" + tr("after {via} in your head", { via: viaTxt });
    }
  } else mine = P2.tu.explainMove(known, m.c, m.v);
  const easy = P2.tu.easiest(known);
  // least: your own number. The app cannot see how you found it, only the easiest route to it: "at least {technique}"
  const panel = (h, col, title, c, v, hd, extra, L, least) => {
    const kv = h ? keyView(h) : null;
    L = L || (h ? h.hardestLevel : 0);
    const tech = L ? (least ? tr("at least {tech}", { tech: LEVEL_TECH[L] }) : LEVEL_TECH[L]) : "";
    return (
      `<figure class="mbcol"><figcaption><b style="color:${col}">${title}</b><br>${nm(c)} = ${v}${tech ? " · " + esc(tech) : ""}${extra || ""}</figcaption>` +
      miniBoard(P2, known, kv, { c, v, col }, hd) +
      (kv && kv.text ? `<p class="mbtext">${esc(kv.text)}</p>` : "") +
      `</figure>`
    );
  };
  return (
    `<div class="mbpair">` +
    panel(mine, "var(--warn)", tr("Your number"), m.c, m.v, head, extra, lvl, true) +
    (easy ? panel(easy, "var(--indigo)", tr("The easiest move then"), easy.cell, easy.v, {}) : "") +
    `</div>` +
    (m.nAvail > 1 ? `<p class="mbnote">${tr("There were {n} numbers to find at the easiest level. One of them is shown here.", { n: m.nAvail })}</p>` : "")
  );
}
// The boards are drawn only when the section is unfolded, and one at a time, so the sheet opens quickly
function bindMboards(root, g) {
  const fill = (det) => {
    // only the boards in exactly this section; a folded "More" inside it is drawn when it is unfolded itself
    const slots = [...det.querySelectorAll(".mboard:not([data-done])")].filter((el) => el.closest("details") === det);
    const next = () => {
      const el = slots.shift();
      if (!el) return;
      el.dataset.done = 1;
      try {
        el.innerHTML = mboardHtml(g, +el.dataset.mi, el.dataset.mode) || "";
      } catch (e) {
        el.innerHTML = "";
      }
      setTimeout(next, 0);
    };
    setTimeout(next, 30);
  };
  root.querySelectorAll("details.rdet, details.lsfold").forEach((det) => {
    if (!det.querySelector(".mboard")) return;
    det.addEventListener("toggle", () => det.open && fill(det));
    if (det.open) fill(det);
  });
}
// ---------- Concentration in a single game
// A "lapse" is a place where there should have been nothing to search for:
//   - an easy number (naked/hidden single), while at least 3 easy numbers were possible, that still took over 3 times your normal time (at least 20 sec.)
//   - a wrong number
// Lapses per 100 moves are compared with what is normal for you.
function concOf(g, base) {
  if (!g.moves) return g.conc || null;
  markErrors(g.moves);
  const mv = g.moves.filter(judged);
  if (mv.length < 8) return null;
  const easyT = mv.filter((m) => m.avail === 1 && m.cls === "easy").map((m) => m.dt / 1000);
  const norm = base[1] ? base[1].med : easyT.length ? median(easyT) : 8;
  const thr = Math.max(20, 3 * norm);
  const slips = [];
  g.moves.forEach((m, i) => {
    if (!judged(m)) return;
    if (m.cls === "wrong") slips.push({ i, kind: "err" });
    else if (m.avail === 1 && (m.nAvail || 0) >= 3 && m.dt / 1000 >= thr) slips.push({ i, kind: "slow" });
  });
  const slow = slips.filter((x) => x.kind === "slow").length,
    err = slips.length - slow;
  return {
    n: mv.length,
    slow,
    err,
    rate: (100 * slips.length) / mv.length,
    thr: Math.round(thr),
    norm: Math.round(norm),
    idx: slips.map((x) => x.i),
    late: slips.filter((x) => g.moves[x.i].t > 0.5 * g.ms).length,
  };
}
// Concentration is computed only once per game, as long as the history is unchanged (otherwise the statistics get slow
// with many games: each computation needs your normal time from all other games)
let CONC_KEY = "",
  CONC_MEMO = new Map();
const histKey = () => games.length + ":" + (games.length ? games[games.length - 1].id : "") + ":" + (games.length ? games[games.length - 1].route?.n : "");
function concGet(g) {
  if (g.conc) return g.conc;
  if (!g.moves) return null;
  const k = histKey();
  if (k !== CONC_KEY) {
    CONC_KEY = k;
    CONC_MEMO = new Map();
  }
  if (!CONC_MEMO.has(g.id)) {
    const c = concOf(g, baseline(g.id));
    if (c) g.conc = c; // stored with the game (as with the analysis), so it does not have to be computed again
    CONC_MEMO.set(g.id, c);
  }
  return CONC_MEMO.get(g.id);
}
// Your normal level: the median of lapses per 100 moves in earlier games
let RATES_KEY = "",
  RATES = [];
function concUsual(excludeId) {
  const k = histKey();
  if (k !== RATES_KEY) {
    RATES_KEY = k;
    RATES = games.map((g) => [g.id, concGet(g)]).filter((x) => x[1]).map(([id, c]) => [id, c.rate]);
  }
  const r = RATES.filter((x) => x[0] !== excludeId).map((x) => x[1]);
  return r.length >= 3 ? median(r) : null;
}
// 0 = fine, 1 = dip, 2 = lost focus
function concState(c, usual) {
  if (!c) return 0;
  const k = c.slow + c.err,
    u = usual == null ? 4 : usual;
  return k >= 3 && c.rate >= Math.max(8, 2 * u) ? 2 : k >= 2 && c.rate >= Math.max(5, 1.5 * u) ? 1 : 0;
}
function concLineHtml(g) {
  if (g.routePending) return "";
  const c = concGet(g);
  if (!c) return "";
  const usual = concUsual(g.id),
    st = concState(c, usual);
  const what = [
    c.slow ? (c.slow === 1 ? tr("1 easy number took over {s} sec.", { s: c.thr }) : tr("{n} easy numbers took over {s} sec.", { n: c.slow, s: c.thr })) : "",
    c.err ? tr("{n} errors", { n: c.err }) : "",
  ]
    .filter(Boolean)
    .join(" " + tr("and") + " ");
  if (!st)
    return `<p class="insight" style="text-align:left;margin:10px 0 0"><b>${tr("Concentration: fine.")}</b> ${what ? tr("{what}, which is within your usual range.", { what }) : tr("No lapses: no easy numbers dragged on, and no errors.")}</p>`;
  // Was the previous game in the same session affected too?
  const ctx = contexts(),
    me = ctx[g.id],
    sorted = games.slice().sort((a, b) => (a.end < b.end ? -1 : 1)),
    k = sorted.findIndex((x) => x.id === g.id);
  const prev = k > 0 && me && me.idx > 1 ? sorted[k - 1] : null;
  const prevBad = prev && concState(concGet(prev), concUsual(prev.id)) > 0;
  const cmp = usual != null ? " " + tr("That is {a} lapses per 100 moves against your usual {b}.", { a: c.rate.toFixed(0), b: usual.toFixed(0) }) : "";
  const late = c.late >= 2 && c.late > 0.6 * (c.slow + c.err) ? " " + tr("Most of them came in the second half of the game.") : "";
  const advice = prevBad
    ? " <b>" + tr("This is the second game in a row. A break will probably help more than another puzzle.") + "</b>"
    : st === 2
      ? " " + tr("If the next game looks the same, it's time for a break.")
      : "";
  const head = st === 2 ? tr("You lost focus along the way.") : tr("A dip in concentration.");
  return `<p class="insight warn" style="text-align:left;margin:10px 0 0"><b>${head}</b> ${tr("{what}, even though there were several easy numbers to take.", { what: what[0].toUpperCase() + what.slice(1) })}${cmp}${late}${advice}</p>`;
}
function concRouteHtml(g, nm) {
  const c = concGet(g);
  // Only the slow easy numbers; the errors are in their own section
  const idx = c ? c.idx.filter((i) => g.moves[i] && g.moves[i].cls !== "wrong") : [];
  if (!idx.length) return "";
  return (
    `<ul class="notable">` +
    idx
      .slice(0, 6)
      .map((i) => {
        const m = g.moves[i];
        return (
          `<li><b class="k">${tr("Move {k}", { k: i + 1 })} · ${nm(m.c)} = ${m.v} · ${tr("{time} in", { time: fmt(m.t) })}</b><br>` +
          (m.cls === "wrong"
            ? tr("Wrong number.")
            : tr("Searched for {time}, even though {n} easy numbers were available. An easy number usually takes you {s} sec.", { time: fmt(m.dt), n: m.nAvail, s: c.norm }) +
              mboardSlot(g, { i }, "easy")) +
          `</li>`
        );
      })
      .join("") +
    `</ul>`
  );
}
function concPanel() {
  const list = games
    .map((g) => ({ g, c: concGet(g) }))
    .filter((x) => x.c)
    .slice(-14);
  if (!list.length)
    return `<div class="panelcard"><h3>${tr("Concentration")}</h3><p>${tr("After each game, this shows whether easy numbers dragged on or errors crept in, and whether that was more than usual for you.")}</p></div>`;
  const W = 320,
    H = 96,
    L = 24,
    B = 14,
    mx = Math.max(10, ...list.map((x) => x.c.rate)),
    bw = Math.min(20, (W - L) / list.length - 4);
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Lapses per 100 moves in your recent games")}">`;
  [0, mx / 2, mx].forEach((v) => {
    const y = 6 + (H - B - 6) * (1 - v / mx);
    s += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${L - 6}" y="${y + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${Math.round(v)}</text>`;
  });
  const usualAll = concUsual(null);
  if (usualAll != null) {
    const y = 6 + (H - B - 6) * (1 - usualAll / mx);
    s += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--mute)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  }
  let flagged = 0;
  list.forEach((x, i) => {
    const st = concState(x.c, concUsual(x.g.id));
    if (st) flagged++;
    const h = Math.max(2, ((H - B - 6) * x.c.rate) / mx),
      xx = L + 4 + i * ((W - L - 4) / list.length);
    const d = new Date(x.g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    s +=
      `<rect x="${xx}" y="${H - B - h}" width="${bw}" height="${h}" rx="3" fill="${st === 2 ? "var(--bad)" : st === 1 ? "var(--warn)" : "var(--indigo)"}"/>` +
      `<rect x="${xx - 2}" y="6" width="${bw + 4}" height="${H - B - 6}" fill="transparent" data-tip="${esc(d + " · " + BAND[gBand(x.g)] + " " + dec(gradeFor(x.g)) + ": " + tr("{a} slow easy numbers, {b} errors in {n} moves", { a: x.c.slow, b: x.c.err, n: x.c.n }) + (st === 2 ? " · " + tr("lost focus") : st === 1 ? " · " + tr("dip") : ""))}"/>`;
  });
  s +=
    `</svg><div class="legendrow" style="justify-content:flex-start;gap:4px 12px;flex-wrap:wrap"><span><i style="background:var(--indigo)"></i> ${tr("usual")}</span><span><i style="background:var(--warn)"></i> ${tr("dip")}</span>` +
    `<span><i style="background:var(--bad)"></i> ${tr("lost focus")}</span><span><svg width="18" height="8" style="vertical-align:middle"><path d="M0 4h18" stroke="var(--mute)" stroke-width="1.5" stroke-dasharray="4 3"/></svg> ${tr("your usual")}</span></div>`;
  const last = list[list.length - 1];
  return (
    `<div class="panelcard"><h3>${tr("Concentration")}</h3><p>${tr("Lapses per 100 moves in your last {n} games. A lapse is an easy number that took more than 3 times your usual time while at least 3 easy numbers were available, or a wrong number.", { n: list.length })}</p>` +
    concLineHtml(last.g).replace("margin:10px 0 0", "margin:0 0 8px") +
    s +
    `<p class="caveat">${tr("The colour compares each game with your other games. A dip needs at least 2 lapses and 1.5 times your usual rate; lost focus at least 3 lapses and twice the rate. An interruption (a phone call, someone asking you something) looks like a lapse.")}</p></div>`
  );
}

// ---------- Form and fatigue
// Pace = your time per move divided by your own normal time for the same technique. 1.00 is normal, above is slower.
function paceOf(g, base) {
  if (!g.moves) return g.pace == null ? null : g.pace;
  const r = [];
  g.moves.forEach((m) => {
    const L = moveLevel(m);
    if (L && m.cls !== "hint" && m.cls !== "wrong" && base[L]) r.push((m.dt / 1000 + 1) / (base[L].med + 1));
  });
  return r.length >= 5 ? median(r) : g.pace == null ? null : g.pace;
}
// Errors and hints split over the game's first, middle and last third (in time)
function thirdsOf(g) {
  if (!g.moves) return g.thirds || null;
  const o = { err: [0, 0, 0], hint: [0, 0, 0] },
    tot = Math.max(1, g.ms);
  g.moves.forEach((m) => {
    const k = Math.min(2, Math.floor((3 * m.t) / tot));
    if (m.cls === "wrong" && !m.follow) o.err[k]++;
    if (m.cls === "hint") o.hint[k]++;
  });
  return o;
}
// Context for each game: number in the session (a break under 30 min = the same session) and time of day
function contexts() {
  const out = {},
    sorted = games.slice().sort((a, b) => (a.end < b.end ? -1 : 1));
  let prevEnd = 0,
    idx = 0,
    sessStart = 0;
  sorted.forEach((g) => {
    const end = +new Date(g.end),
      start = end - g.ms;
    if (start - prevEnd < 30 * 60000 && prevEnd) idx++;
    else {
      idx = 1;
      sessStart = start;
    }
    const h = new Date(start).getHours();
    out[g.id] = { idx, into: (start - sessStart) / 60000, part: h >= 5 && h < 11 ? 0 : h < 17 ? 1 : h < 22 ? 2 : 3 };
    prevEnd = end;
  });
  return out;
}
function formPanel() {
  const base = baseline(null),
    ctx = contexts();
  const rows = games.map((g) => ({ g, c: ctx[g.id], pace: paceOf(g, base) })).filter((x) => x.c && (x.pace != null || x.g.route));
  if (rows.length < 4)
    return `<div class="panelcard"><h3>${tr("Form and fatigue")}</h3><p>${tr("This will show whether you slow down or make more errors late in a session, at certain times of day, or towards the end of a puzzle. It needs at least 4 analysed games.")}</p></div>`;
  const agg = (list) => {
    const p = list.map((x) => x.pace).filter((v) => v != null),
      n = list.reduce((a, x) => a + ((x.g.route || {}).n || 0), 0);
    return {
      games: list.length,
      pace: p.length >= 2 ? median(p) : null,
      err: n ? (100 * list.reduce((a, x) => a + ((x.g.route || {}).wrong || 0), 0)) / n : null,
      hints: list.length ? list.reduce((a, x) => a + (x.g.hints || 0), 0) / list.length : 0,
      gaveUp: list.length ? list.filter((x) => !x.g.solved).length / list.length : 0,
    };
  };
  const groups = [
    {
      name: tr("Game number in the session"),
      key: "sess",
      items: [
        [tr("1st game"), (x) => x.c.idx === 1],
        [tr("2nd game"), (x) => x.c.idx === 2],
        [tr("3rd game or later"), (x) => x.c.idx >= 3],
      ],
    },
    {
      name: tr("Time of day"),
      key: "day",
      items: [
        [tr("Morning 5–11"), (x) => x.c.part === 0],
        [tr("Afternoon 11–17"), (x) => x.c.part === 1],
        [tr("Evening 17–22"), (x) => x.c.part === 2],
        [tr("Night 22–5"), (x) => x.c.part === 3],
      ],
    },
  ];
  const pc = (v) => (v == null ? "–" : (v >= 1 ? "+" : "−") + Math.abs(Math.round((v - 1) * 100)) + " %");
  let table = `<table class="data"><tr><th></th><th class="num">${tr("Games")}</th><th class="num">${tr("Pace")}</th><th class="num">${tr("Errors/100")}</th><th class="num">${tr("Hints")}</th></tr>`,
    insights = [];
  groups.forEach((gr) => {
    table += `<tr class="grp"><td colspan="5">${gr.name}</td></tr>`;
    const res = gr.items.map(([label, f]) => ({ label, a: agg(rows.filter(f)) }));
    res.forEach(({ label, a }) => {
      if (a.games)
        table +=
          `<tr><td>${label}</td><td class="num">${a.games}</td><td class="num">${pc(a.pace)}</td>` +
          `<td class="num">${a.err == null ? "–" : dec(a.err, 1)}</td><td class="num">${dec(a.hints, 1)}</td></tr>`;
    });
    const ok = res.filter((r) => r.a.games >= 3 && r.a.pace != null);
    if (ok.length >= 2) {
      const best = ok.reduce((x, y) => (y.a.pace < x.a.pace ? y : x)),
        worst = ok.reduce((x, y) => (y.a.pace > x.a.pace ? y : x));
      if (worst.a.pace / best.a.pace >= 1.15)
        insights.push(
          tr("<b>{worst}</b>: you are {pct} % slower per move than in <b>{best}</b>, for the same techniques", { worst: worst.label, pct: Math.round((worst.a.pace / best.a.pace - 1) * 100), best: best.label.toLowerCase() }) +
            (worst.a.err != null && best.a.err != null && worst.a.err > best.a.err + 1
              ? tr(", and you make more errors ({a} against {b} per 100 moves)", { a: dec(worst.a.err, 1), b: dec(best.a.err, 1) })
              : "") +
            `.`,
        );
    }
  });
  table += `</table>`;
  // Errors and hints within the puzzle
  const th = { err: [0, 0, 0], hint: [0, 0, 0] };
  games.forEach((g) => {
    const t = thirdsOf(g);
    if (t) for (const k of ["err", "hint"]) t[k].forEach((v, i) => (th[k][i] += v));
  });
  const sumE = th.err.reduce((a, b) => a + b, 0),
    sumH = th.hint.reduce((a, b) => a + b, 0);
  let inGame = "";
  if (sumE + sumH >= 3) {
    inGame =
      `<h4 style="margin:14px 0 2px;font-size:13px">${tr("When in the puzzle")}</h4><table class="data"><tr><th></th><th class="num">${tr("First third")}</th><th class="num">${tr("Middle")}</th><th class="num">${tr("Last")}</th></tr>` +
      `<tr><td>${tr("Errors")}</td>${th.err.map((v) => `<td class="num">${v}</td>`).join("")}</tr><tr><td>${tr("Hints")}</td>${th.hint.map((v) => `<td class="num">${v}</td>`).join("")}</tr></table>`;
    if (sumE >= 5 && th.err[2] > 0.5 * sumE)
      insights.push(
        tr("Over half of your errors ({a} of {b}) come in <b>the last third</b> of the puzzle. That is where the board is otherwise easiest, so it looks like lost concentration rather than missing technique.", { a: th.err[2], b: sumE }),
      );
    if (sumH >= 4 && th.hint[2] > 0.5 * sumH)
      insights.push(
        tr("Most hints ({a} of {b}) are used in <b>the last third</b> of the time. That suggests you ask for help when you are worn out, not only when the technique is hard.", { a: th.hint[2], b: sumH }),
      );
  }
  return (
    `<div class="panelcard"><h3>${tr("Form and fatigue")}</h3><p>${tr("Pace is your time per move compared with your own usual time for the same technique. +20 % means slower than usual.")}</p>` +
    (insights.length
      ? insights.map((t) => `<p class="insight warn">${t}</p>`).join("")
      : `<p class="insight">${tr("No clear difference yet. A group needs at least 3 games and a 15 % difference before it is mentioned.")}</p>`) +
    table +
    inGame +
    `<p class="caveat">${tr("The app cannot measure fatigue directly. It only sees patterns in pace, errors and hints, and other things (noise, interruptions, harder puzzles in the evening) can give the same picture. A session is games with less than 30 minutes' break between them.")}</p></div>`
  );
}

// ---------- Rating against reality: does the difficulty match your time and your experience?
function feltExport() {
  return (
    tr("{name}: rating vs experience", { name: APP.name }) + "\n" +
    games
      .filter((g) => g.felt != null || g.solved)
      .slice(-60)
      .map((g) =>
        [
          g.code,
          tr("rated {v}", { v: dec(gradeFor(g)) }) + (g.scale === 2 ? "" : " " + tr("(old scale)")),
          g.tech ? LEVEL_TECH[g.tech] : "",
          plText(g),
          g.felt != null ? tr("felt {f}", { f: FELT[g.felt + 2].toLowerCase() }) : tr("no rating"),
          fmt(g.ms),
          tr("{n} hints", { n: g.hints || 0 }),
          g.route ? Math.round((100 * g.route.easy) / Math.max(1, g.route.n)) + "% " + tr("easiest") : "",
        ].join(" · "),
      )
      .join("\n")
  );
}
function ratingPanel() {
  // The latest 400 solved puzzles: enough for a reliable picture, and the chart does not get heavy with thousands of games
  const pts = games
    .filter((g) => g.solved && g.empty)
    .slice(-400)
    .map((g) => ({ g, x: gradeFor(g), y: g.ms / 1000 / g.empty }));
  let out = `<div class="panelcard"><h3>${tr("Does the rating fit?")}</h3>`;
  if (pts.length < 5)
    return (
      out +
      `<p>${tr("Once you have solved 5 puzzles, the computed difficulty is compared here with your actual time per cell and with how the puzzles felt.")}</p></div>`
    );
  const n = pts.length,
    mx = pts.reduce((a, p) => a + p.x, 0) / n,
    my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0),
    sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0),
    syy = pts.reduce((a, p) => a + (p.y - my) ** 2, 0);
  const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0,
    slope = sxx ? sxy / sxx : 0;
  const W = 320,
    H = 170,
    L = 30,
    R = 8,
    T = 8,
    B = 24;
  const x0 = Math.floor(Math.min(...pts.map((p) => p.x))),
    x1 = Math.ceil(Math.max(...pts.map((p) => p.x)) + 0.01),
    y1 = Math.max(...pts.map((p) => p.y)) * 1.1;
  const X = (v) => L + ((W - L - R) * (v - x0)) / Math.max(1, x1 - x0),
    Y = (v) => T + (H - T - B) * (1 - v / y1);
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Computed difficulty against your time per cell")}">`;
  for (let k = 0; k <= 3; k++) {
    const v = (y1 * k) / 3;
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${L - 6}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${Math.round(v)}</text>`;
  }
  for (let v = x0; v <= x1; v++) s += `<text x="${X(v)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="var(--mute)">${v}</text>`;
  s += `<line x1="${X(x0)}" y1="${Y(Math.max(0, my + slope * (x0 - mx)))}" x2="${X(x1)}" y2="${Y(Math.max(0, my + slope * (x1 - mx)))}" stroke="var(--mute)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  pts.forEach((p) => {
    const g = p.g,
      d = new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    const tip = `${d}: ${BAND[gBand(g)]} ${dec(p.x)} · ${g.cols}×${g.rows} · ${tr("{s} sec. per cell", { s: Math.round(p.y) })}${g.hints ? " · " + (g.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: g.hints })) : ""}${g.felt != null ? " · " + tr("felt {f}", { f: FELT[g.felt + 2].toLowerCase() }) : ""}`;
    s +=
      `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4.5" fill="${g.hints ? "var(--cell)" : "var(--indigo)"}" stroke="${g.hints ? "var(--indigo)" : "var(--cell)"}" stroke-width="2"/>` +
      `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="12" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  s += `</svg><div class="legendrow" style="justify-content:space-between"><span>${tr("seconds per cell ↑ · computed difficulty →")}</span><span><i style="background:var(--indigo);border-radius:50%"></i> ${tr("without hints")}</span></div>`;
  const corr = (xs) => {
    const m = xs.length,
      ax = xs.reduce((a, q) => a + q[0], 0) / m,
      ay = xs.reduce((a, q) => a + q[1], 0) / m;
    const xy = xs.reduce((a, q) => a + (q[0] - ax) * (q[1] - ay), 0),
      xx = xs.reduce((a, q) => a + (q[0] - ax) ** 2, 0),
      yy = xs.reduce((a, q) => a + (q[1] - ay) ** 2, 0);
    return xx && yy ? xy / Math.sqrt(xx * yy) : 0;
  };
  const two = pts.filter((q) => q.g.peak != null);
  const split =
    two.length >= 8
      ? `<table class="data"><tr><th>${tr("What tracks your time?")}</th><th class="num">${tr("Correlation")}</th></tr>` +
        [
          [tr("The overall number"), two.map((q) => [q.x, q.y])],
          [tr("Peak (heaviest step)"), two.map((q) => [q.g.peak, q.y])],
          [tr("Load (number of heavy steps)"), two.map((q) => [q.g.load, q.y])],
        ]
          .map(([t, d]) => `<tr><td>${t}</td><td class="num">${dec(corr(d), 2)}</td></tr>`)
          .join("") +
        `</table><p class="caveat">${tr("0 is no correlation, 1 is perfect. If load tracks your time better than the overall number, load is weighted too low in the number.")}</p>`
      : `<p class="caveat">${tr("After 8 solved puzzles on the new scale, this shows whether peak or load tracks your time best.")}</p>`;
  const verdict =
    n < 8
      ? tr("Too few puzzles to say anything for sure ({n}).", { n })
      : r >= 0.6
        ? tr("The rating tracks your time well (correlation {r} on a scale from 0 to 1).", { r: dec(r, 2) })
        : r >= 0.3
          ? tr("The rating only partly tracks your time (correlation {r}). Points far from the dashed line are puzzles it got wrong for you.", { r: dec(r, 2) })
          : tr("The rating explains your time poorly (correlation {r}). It clearly measures something other than what is hard for you.", { r: dec(r, 2) });
  out +=
    `<p>${tr("Each point is a solved puzzle. If the rating fits you, the points rise to the right.")}</p><p class="insight ${n >= 8 && r < 0.3 ? "warn" : ""}">${verdict}</p>` +
    s +
    split;
  // Experience
  const felt = games.filter((g) => g.felt != null);
  if (felt.length) {
    const by = {};
    felt.forEach((g) => (by[gBand(g)] = by[gBand(g)] || []).push(g.felt));
    out +=
      `<h4 style="margin:14px 0 2px;font-size:13px">${tr("Your experience ({n} rated)", { n: felt.length })}</h4><table class="data"><tr><th>${tr("Grade")}</th><th class="num">${tr("Count")}</th><th>${tr("Felt on average")}</th></tr>` +
      Object.keys(by)
        .map(Number)
        .sort((a, b) => a - b)
        .map((L) => {
          const a = by[L].reduce((x, y) => x + y, 0) / by[L].length;
          return `<tr><td>${L} · ${esc(BAND[L])}</td><td class="num">${by[L].length}</td><td>${a <= -0.5 ? tr("easier than rated") : a >= 0.5 ? tr("harder than rated") : tr("as rated")} (${a > 0 ? "+" : ""}${dec(a, 1)})</td></tr>`;
        })
        .join("") +
      `</table>`;
  } else out += `<p class="caveat">${tr("After solving a puzzle you can say how it felt. Your answers are collected here.")}</p>`;
  return (
    out + `<button class="tablelink" type="button" id="feltCopy">${tr("Copy puzzles and ratings so the rating can be adjusted")}</button></div>`
  );
}

// ---------- Focus area
// The expected time per technique comes from your personal time curve (calib.js). The focus area shows which techniques lie
// above or below the curve: they are your relative weaknesses and strengths, not a comparison with other players.
const LEVEL_GUIDE_TECH = [0, 0, 2, 3, 5, 7, 8, 9, 10, 11, 12, 13];
function spotOf(g) {
  if (g.route && g.route.spot) return g.route.spot;
  const o = {};
  (g.moves || []).forEach((m) => {
    if (m.avail && m.cls !== "wrong" && judged(m)) {
      const e = (o[m.avail] = o[m.avail] || [0, 0]);
      e[0]++;
      if (m.cls === "easy") e[1]++;
    }
  });
  return o;
}
function focusData() {
  let src = games.filter((g) => g.route || g.moves || (g.hintTechs || []).length).slice(-40);
  // Games late in a long session or at night are left out if enough are left: otherwise fatigue looks like a weak technique
  const ctx = contexts(),
    fresh = src.filter((g) => {
      const c = ctx[g.id];
      return !c || (c.idx < 3 && c.part !== 3);
    });
  const filtered = fresh.length >= 5 && fresh.length >= 0.6 * src.length && fresh.length < src.length;
  if (filtered) src = fresh;
  const T = {},
    S = {},
    H = {},
    M = {};
  src.forEach((g) => {
    const t = timesOf(g);
    for (const L in t) (T[L] = T[L] || []).push(...t[L]);
    const sp = spotOf(g);
    for (const L in sp) {
      const e = (S[L] = S[L] || [0, 0]);
      e[0] += sp[L][0];
      e[1] += sp[L][1];
    }
    (g.hintTechs || []).forEach((t2) => {
      const L = E.TECH[t2].level;
      H[L] = (H[L] || 0) + 1;
    });
  });
  const base = T[1] && T[1].length >= 5 ? median(T[1]) : null;
  const cal = fitCalib(calibRows(src));
  const out = [];
  for (let L = 1; L <= 11; L++) {
    const cl = cal.lvl[L],
      nT = cl ? cl.n : 0,
      sp = S[L],
      h = H[L] || 0;
    if (nT < 3 && !(sp && sp[0] >= 4) && h < 2) continue;
    // Typical time when the move is the only one on the board: your own for the technique and the one the curve gives
    const med = nT ? calTime(cal, L, 1, true) : null,
      expected = calTime(cal, L, 1, false);
    const speed = L > 1 && base && nT >= 5 ? Math.exp(-cl.r) : null; // >1: faster than your curve
    const spot = sp && sp[0] >= 4 ? sp[1] / sp[0] : null; // share of the times you took the easiest when L was the easiest
    const hintShare = h / Math.max(1, h + nT);
    let score = 0;
    if (speed != null) score += Math.log2(speed);
    if (spot != null) score += 2 * (spot - 0.8);
    score -= 2 * hintShare;
    out.push({ L, nT, med, speed, spot, spotN: sp ? sp[0] : 0, hints: h, hintShare, score, expected });
  }
  return { rows: out, base, games: src.length, filtered, cal };
}
function focusReasons(f, weak) {
  const r = [];
  if (f.speed != null) {
    if (weak && f.speed < 0.8)
      r.push(
        tr("You take {x} times as long as your own curve expects: typically {median}, where the curve says {exp}, when it is the only move.", { x: dec(1 / f.speed), median: fmtS(f.med), exp: fmtS(f.expected) }),
      );
    if (!weak && f.speed > 1.2)
      r.push(
        tr("You are {x} times faster than your own curve expects: typically {median}, where the curve says {exp}.", { x: dec(f.speed, 1), median: fmtS(f.med), exp: fmtS(f.expected) }),
      );
  }
  if (f.spot != null) {
    const miss = f.spotN - Math.round(f.spot * f.spotN);
    if (weak && f.spot < 0.8)
      r.push(tr("When it was the easiest move, you missed it {a} of {b} times and did something harder or thought ahead.", { a: miss, b: f.spotN }));
    if (!weak && f.spot >= 0.9) r.push(tr("When it was the easiest move, you found it {a} of {b} times.", { a: Math.round(f.spot * f.spotN), b: f.spotN }));
  }
  if (weak && f.hints >= 2) r.push(tr("{n} of your hints were about it.", { n: f.hints }));
  if (!weak && !f.hints && f.nT >= 5) r.push(tr("You have never needed a hint for it."));
  return r;
}
function focusPanel() {
  const fd = focusData(),
    rows = fd.rows;
  if (!fd.base || rows.length < 2) {
    const n1 = games.reduce((a, g) => a + (timesOf(g)[1] || []).length, 0);
    return (
      `<div class="panelcard focus"><h3>${tr("Focus area")}</h3><p>${tr("This will show which technique you are weakest at, and where you are stronger than the technique would suggest.")} ` +
      `${tr("It needs some solved puzzles with different techniques")}${n1 < 5 ? " " + tr("(at least 5 easy moves to know your base speed)") : ""}.</p></div>`
    );
  }
  const sorted = rows.slice().sort((a, b) => a.score - b.score);
  const weak = sorted.find((f) => f.score < -0.25 && focusReasons(f, true).length);
  const strong = sorted
    .slice()
    .reverse()
    .find((f) => f.score > 0.25 && f !== weak && focusReasons(f, false).length);
  const card = (f, isWeak) =>
    `<div class="fcard ${isWeak ? "weak" : "strong"}"><span class="eyebrow">${isWeak ? tr("Practise") : tr("Your strength")}</span>` +
    `<strong>${esc(LEVEL_TECH[f.L][0].toUpperCase() + LEVEL_TECH[f.L].slice(1))}</strong>` +
    `<ul>${focusReasons(f, isWeak)
      .map((t) => `<li>${t}</li>`)
      .join("")}</ul>` +
    (isWeak
      ? `<div class="actions row2" style="margin-top:6px">` +
        (GAME.guide ? `<button class="secondary" type="button" data-guide="${LEVEL_GUIDE_TECH[f.L]}">${tr("Read the guide")}</button>` : "") +
        `<button class="primary" type="button" data-train="${f.L}">${tr("Practise the technique")}</button></div>`
      : "") +
    `</div>`;
  // Diverging overview: the expected time is the middle; faster to the right, slower to the left
  const sp = rows.filter((f) => f.speed != null);
  let chart = "";
  if (sp.length) {
    const W = 320,
      rowH = 24,
      L0 = 120,
      mid = L0 + (W - L0) / 2,
      half = (W - L0) / 2 - 6,
      H = sp.length * rowH + 22;
    const lim = Math.max(1, ...sp.map((f) => Math.abs(Math.log2(f.speed))));
    chart =
      `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Your speed per technique compared with your curve")}">` +
      `<line x1="${mid}" x2="${mid}" y1="4" y2="${H - 18}" stroke="var(--mute)" stroke-width="1.5"/>` +
      `<text x="${mid}" y="${H - 4}" font-size="10" text-anchor="middle" fill="var(--mute)">${tr("your curve")}</text>` +
      `<text x="${L0 + 2}" y="${H - 4}" font-size="10" fill="var(--mute)">${tr("slower")}</text><text x="${W - 2}" y="${H - 4}" font-size="10" text-anchor="end" fill="var(--mute)">${tr("faster")}</text>`;
    sp.forEach((f, i) => {
      const v = Math.log2(f.speed),
        w = Math.max(2, (half * Math.abs(v)) / lim),
        y = 6 + i * rowH;
      const x = v >= 0 ? mid + 1 : mid - 1 - w;
      chart +=
        `<text x="0" y="${y + 13}" font-size="11.5" fill="var(--ink)">${f.L} · ${esc(LEVEL_TECH[f.L].length > 16 ? LEVEL_TECH[f.L].slice(0, 15) + "…" : LEVEL_TECH[f.L])}</text>` +
        `<rect x="${x}" y="${y + 3}" width="${w}" height="12" rx="4" fill="${v >= 0 ? "var(--indigo)" : "var(--warn)"}"` +
        ` data-tip="${esc(LEVEL_TECH[f.L])}: ${tr("typically {median}, your curve {exp} ({n} moves)", { median: fmtS(f.med), exp: fmtS(f.expected), n: f.nT })}${f.spot != null ? ", " + tr("found it when easiest {pct} %", { pct: Math.round(100 * f.spot) }) : ""}"/>` +
        `<rect x="${L0}" y="${y}" width="${W - L0}" height="${rowH}" fill="transparent" data-tip="${esc(LEVEL_TECH[f.L])}: ${tr("typically {median}, your curve {exp} ({n} moves)", { median: fmtS(f.med), exp: fmtS(f.expected), n: f.nT })}"/>`;
    });
    chart += `</svg>`;
  }
  return (
    `<div class="panelcard focus"><h3>${tr("Focus area")}</h3><p>${tr("Based on your last {n} games. Your base speed is {time} per easy move.", { n: fd.games, time: fmtS(fd.base) })}${fd.filtered ? " " + tr("Games late in a long session or at night are left out, so fatigue doesn't look like a weak technique.") : ""}</p>` +
    `<p class="curve">${tr("Your curve, when the move is the only one on the board:")} ${rows
      .filter((f) => f.nT >= 3)
      .map((f) => `${esc(LEVEL_TECH[f.L])} <b>${fmtS(f.expected)}</b>`)
      .join(" · ")}.</p>` +
    (weak ? card(weak, true) : `<p>${tr("No clear weakness right now. All techniques are close to your curve.")}</p>`) +
    (strong ? card(strong, false) : "") +
    (chart ? `<h4 style="margin:12px 0 4px;font-size:13px">${tr("Speed per technique compared with your curve")}</h4>${chart}` : "") +
    `<p class="caveat">${tr("“Your curve” is fitted to your own moves: one smooth curve for all techniques, where harder techniques take longer and more possible places make it faster. Weaknesses and strengths are the techniques that sit above or below the curve. It says nothing about whether you are fast or slow compared with others.")} ` +
    `${tr("The focus area weighs three things: speed, whether you find the technique when it is the easiest move, and how many hints you have used for it.")}</p></div>`
  );
}
function bindFocus(root) {
  root.querySelectorAll("[data-train]").forEach(
    (b) =>
      (b.onclick = () => {
        ui.must = +b.dataset.train;
        saveUi();
        go("new");
        toast(tr("Technique selected: {tech}", { tech: LEVEL_TECH[ui.must] }));
      }),
  );
  root.querySelectorAll("[data-guide]").forEach((b) => (b.onclick = () => openGuide(+b.dataset.guide)));
}
// Dashboard: how long does each technique take you, and are you getting faster?
function timePanel() {
  const withT = games.filter((g) => Object.keys(timesOf(g)).length);
  if (!withT.length) return "";
  const recentIds = new Set(withT.slice(-10).map((g) => g.id));
  const all = {},
    recent = {},
    older = {};
  withT.forEach((g) => {
    const t = timesOf(g);
    for (const L in t) {
      (all[L] = all[L] || []).push(...t[L]);
      const tgt = recentIds.has(g.id) ? recent : older;
      (tgt[L] = tgt[L] || []).push(...t[L]);
    }
  });
  const levels = Object.keys(all)
    .map(Number)
    .sort((a, b) => a - b);
  const meds = levels.map((L) => median(all[L])),
    maxM = Math.max(1, ...meds);
  return (
    `<div class="panelcard"><h3>${tr("Time per technique")}</h3><p>${tr("Median time from the previous number until you placed one, split by what the move needed. The arrow compares your last 10 games with the earlier ones.")}</p>` +
    levels
      .map((L, k) => {
        const n = all[L].length,
          med = meds[k];
        let trend = "",
          tipT = "";
        if ((recent[L] || []).length >= 3 && (older[L] || []).length >= 3) {
          const d = median(recent[L]) / Math.max(1, median(older[L])) - 1;
          trend = Math.abs(d) < 0.1 ? "→" : d < 0 ? "↓" + Math.round(-d * 100) + "%" : "↑" + Math.round(d * 100) + "%";
          tipT = " · " + tr("recent {a}, before {b}", { a: fmtS(median(recent[L])), b: fmtS(median(older[L])) });
        }
        return (
          `<div class="barrow" data-tip="${esc(LEVEL_TECH[L])}: ${tr("median {median} over {n} moves", { median: fmtS(med), n })}${tipT}"><span class="n">${L}</span>` +
          `<span class="name">${esc(LEVEL_TECH[L])} <small style="color:var(--mute)">· ${n}</small></span><span class="cnt" style="font-size:13px">${fmtS(med)}</span>` +
          `<span class="best" style="color:${trend.startsWith("↓") ? "var(--indigo)" : trend.startsWith("↑") ? "var(--warn)" : "var(--mute)"};font-weight:700">${trend}</span>` +
          `<span class="track"><span class="fill" style="display:block;width:${((100 * med) / maxM).toFixed(1)}%"></span></span></div>`
        );
      })
      .join("") +
    `<p class="caveat" style="margin:8px 0 0!important">${tr("↓ means faster. The number after the name is the number of moves.")}</p>` +
    estStatsHtml() +
    `</div>`
  );
}
function estStatsHtml() {
  const s = estStats();
  if (!s) return "";
  const word =
    s.med >= 1.15
      ? tr("You are usually slower than the estimate, for example when you make errors or are tired.")
      : s.med <= 0.87
        ? tr("You are usually faster than the estimate, so you are improving.")
        : tr("The estimate is usually about right.");
  return (
    `<p class="estline">${tr("Against your time estimate: your last {n} solved puzzles typically took {x} times the estimate (half of them between {a} and {b}).", { n: s.n, x: dec(s.med), a: dec(s.lo), b: dec(s.hi) })} ${word}</p>`
  );
}
// ---------- The final picture: the board as it ended, with where the numbers came from and where errors stood along the way
// The game always ended with the solution on the board (solved or shown). The moves say which numbers you placed yourself, which came
// from a hint, and where a wrong number stood along the way (slips do not count). If the moves have been cleaned up, only the solution is shown.
function finalBoardHtml(g) {
  const P2 = g.code ? routePuzzle(g) : null;
  if (!P2) return null;
  const giv = P2.d.givens,
    sol = P2.sol,
    src = {},
    err = {};
  for (const m of g.moves || []) {
    if (m.chk || !m.v || m.u) continue;
    if (m.v === sol[m.c]) src[m.c] = m.h || m.cls === "hint" ? "hint" : "you";
    else if (!m.slip && !giv[m.c]) err[m.c] = (err[m.c] || 0) + 1;
  }
  const has = !!(g.moves && g.moves.length),
    color = {},
    corner = {},
    cnt = { you: 0, hint: 0, shown: 0 };
  sol.forEach((v, i) => {
    if (giv[i]) return;
    const k = has ? src[i] || "shown" : "you";
    cnt[k]++;
    if (k === "hint") color[i] = "var(--mute)";
    else if (k === "shown") color[i] = "color-mix(in srgb, var(--mute) 55%, var(--cell))";
    if (err[i]) corner[i] = "var(--bad)";
  });
  const nErr = Object.keys(err).length;
  const sw = (c, t) => `<span class="lg"><i style="background:${c}"></i>${t}</span>`;
  const legend = has
    ? sw("var(--ink)", tr("given")) +
      (cnt.you ? sw("var(--indigo)", tr("your numbers")) : "") +
      (cnt.hint ? sw("var(--mute)", tr("from hints")) : "") +
      (cnt.shown ? sw("color-mix(in srgb, var(--mute) 55%, var(--cell))", tr("revealed solution")) : "") +
      (nErr ? `<span class="lg"><i class="corner"></i>${nErr === 1 ? tr("a wrong number stood here during play") : tr("wrong numbers stood here during play")}</span>` : "")
    : "";
  return {
    svg: miniBoard(P2, sol.slice(), null, null, {}, { color, corner, label: tr("The board as it ended") }),
    legend,
    note: has ? "" : tr("The details of your moves have been trimmed for this older game, so only the solution is shown."),
  };
}
function showFinal(g, back) {
  const fb = finalBoardHtml(g);
  if (!fb) return;
  // errors as in the route analysis (without follow-on errors and slips)
  const errs = g.route && g.route.wrong != null ? g.route.wrong : g.moves ? g.moves.filter((m) => m.cls === "wrong" && !m.follow && !m.slip).length : null;
  openSheet(
    `<h2>${tr("Final board")}</h2>` +
      `<p class="sub">${esc(BAND[gBand(g)])} ${dec(gradeFor(g))} · ${g.cols}×${g.rows} · ${new Date(g.end).toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>` +
      `<div class="kpis three"><div class="kpi"><b>${g.solved ? fmt(g.ms) : "–"}</b><span>${g.solved ? tr("Time") : tr("not solved")}</span></div>` +
      `<div class="kpi"><b>${g.hints || 0}</b><span>${g.hints === 1 ? tr("Hint") : tr("Hints")}</span></div>` +
      `<div class="kpi"><b>${errs == null ? "–" : errs}</b><span>${errs === 1 ? tr("Error") : tr("Errors")}</span></div></div>` +
      `<div class="finalboard">${fb.svg}</div>` +
      (fb.legend ? `<p class="fblegend">${fb.legend}</p>` : "") +
      (fb.note ? `<p class="sub">${fb.note}</p>` : "") +
      `<div class="actions"><button class="secondary" type="button" id="fBack">${tr("Back")}</button></div>`,
    (b) => {
      b.querySelector("#fBack").onclick = () => {
        if (back) back();
        else closeSheet();
      };
    },
  );
}
function gameSheet(g) {
  openSheet(
    `<h2>${esc(BAND[gBand(g)])} ${dec(gradeFor(g))} · ${g.cols}×${g.rows}</h2>` +
      (g.np != null && Math.abs(g.np - g.value) >= 0.1
        ? `<p class="sub">${penUsed(g) === true ? tr("Played with pencil. Without pencil: {v}.", { v: dec(g.np) }) : penUsed(g) === false ? tr("Played without pencil. With pencil: {v}.", { v: dec(g.value) }) : tr("With pencil: {a}. Without pencil: {b}.", { a: dec(g.value), b: dec(g.np) })}</p>`
        : "") +
      `<p style="color:var(--mute)">${new Date(g.end).toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${g.solved ? tr("solved in {time}", { time: fmt(g.ms) }) : tr("not solved")}${g.solved && g.lv ? " · " + tr("estimate {t}", { t: estFmt(g.est || estimateSec(myCal(), g.lv)) }) : ""}</p>` +
      `<div class="menu">` +
      menuItem(
        "gRoute",
        '<path d="M4 19c4 0 4-14 8-14s4 14 8 14"/><circle cx="4" cy="19" r="1.5"/><circle cx="20" cy="19" r="1.5"/>',
        tr("See route analysis"),
        g.route && g.route.n ? Math.round((100 * g.route.easy) / g.route.n) + " % " + tr("easiest") : "",
      ) +
      (g.code ? menuItem("gFinal", '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>', tr("See the final board")) : "") +
      menuItem("gAgain", IC.restart, tr("Play the same puzzle again")) +
      `</div>` +
      (g.dbg && g.dbg.length ? `<p class="sub">${g.dbg.length === 1 ? tr("1 debug note") : tr("{n} debug notes", { n: g.dbg.length })}</p>` : "") +
      noteLink("other"),
    (b) => {
      bindNoteLinks(b, g, () => gameSheet(g));
      b.querySelector("#gRoute").onclick = () => {
        closeSheet();
        setTimeout(() => showRoute(g), 280);
      };
      const fin = b.querySelector("#gFinal");
      if (fin) fin.onclick = () => showFinal(g, () => gameSheet(g));
      b.querySelector("#gAgain").onclick = () => {
        closeSheet();
        setTimeout(() => replaceGame(() => importCode(g.code, { replay: true })), 280);
      };
    },
  );
}
function routePanel() {
  const rs = games.filter((g) => g.route && g.route.n);
  if (!rs.length)
    return `<div class="panelcard"><h3>${tr("Your solving route")}</h3><p>${tr("Once you have solved a puzzle, this shows how often you made one of the easiest moves available at the time.")}</p></div>`;
  const last = rs.slice(-20);
  const sum = (k) => last.reduce((a, g) => a + (g.route[k] || 0), 0);
  const N = sum("n"),
    pct = Math.round((100 * sum("easy")) / N);
  const W = 320,
    H = 110,
    L = 26,
    B = 14,
    bw = Math.min(22, (W - L) / last.length - 3);
  let bars = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Share of easiest moves in your recent games")}">`;
  [0, 50, 100].forEach((v) => {
    const yy = 6 + (H - B - 6) * (1 - v / 100);
    bars += `<line x1="${L}" x2="${W}" y1="${yy}" y2="${yy}" stroke="var(--grid)"/><text x="${L - 6}" y="${yy + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${v}</text>`;
  });
  last.forEach((g, i) => {
    const v = (100 * g.route.easy) / g.route.n,
      h = Math.max(2, ((H - B - 6) * v) / 100),
      xx = L + 4 + i * ((W - L - 4) / last.length);
    const d = new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    bars += `<path d="M${xx} ${H - B}v${-(h - 4)}a4 4 0 0 1 4 -4h${bw - 8}a4 4 0 0 1 4 4v${h - 4}z" fill="var(--indigo)" data-tip="${esc(d + " · " + BAND[gBand(g)] + " " + dec(gradeFor(g)) + ": " + tr("{pct} % easiest moves", { pct: Math.round(v) }))}"/>`;
  });
  bars += `</svg>`;
  const rows = [
    ["easy", tr("Easiest moves")],
    ["ahead", tr("Thought ahead")],
    ["harder", tr("Harder than needed")],
    ["wrong", tr("Errors")],
    ["guess", tr("Guess")],
  ];
  const maxC = Math.max(1, ...rows.map(([k]) => sum(k)));
  return (
    `<div class="panelcard"><h3>${tr("Your solving route")}</h3><p>${tr("How often you made one of the easiest moves available at the time.")} ${last.length === 1 ? tr("Latest game, {n} moves.", { n: N }) : tr("Last {k} games, {n} moves.", { k: last.length, n: N })}</p>` +
    `<div class="rkpi"><b>${pct} %</b><span>${tr("easiest moves")}${sum("harder") ? "<br>" + tr("{n} times harder than needed", { n: sum("harder") }) : ""}</span></div>` +
    bars +
    rows
      .map(([k, t]) => {
        const c = sum(k);
        return (
          `<div class="barrow ${c ? "" : "zero"}" data-tip="${t}: ${tr("{c} of {n} moves ({pct} %)", { c, n: N, pct: Math.round((100 * c) / N) })}"><span class="n"></span><span class="name">${t}</span>` +
          `<span class="cnt">${c}</span><span class="best">${Math.round((100 * c) / N)} %</span><span class="track"><span class="fill" style="display:block;width:${((100 * c) / maxC).toFixed(1)}%"></span></span></div>`
        );
      })
      .join("") +
    `</div>`
  );
}
