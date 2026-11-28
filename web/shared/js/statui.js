// The statistics model in the app (statmodel.js; every number is explained in tools/stats/README.md): the record kept on
// this device, the seal after a game, and the statistics built on them: the three indices, Skill, Focus, the games and
// the Debug view of how the model fits your games.

// ---------- The record
// Built from your games, oldest first, and updated after each game's route analysis. Kept between visits and rebuilt
// from the games when the model, its reference or the grade's weights (GW.fit) change (statFP), after an import or a
// reset, and after the games are regraded (main.js: it waits for the regrade, which gives them their new grades and steps).
// A game's seal is stored in the game (g.seal), so it survives the archive, which drops the moves.
const statFP = () => [SM.V, GW.fit, STAT_REF.perGrade, (STAT_REF.readStart || {}).focus, STAT_PROFILE.made, smFitted() ? "f" : "u"].join("|");
const ST = { R: undefined, busy: false, wait: [], redraw: false, again: false };
const statAll = () => SCOPE_ALL || games;
const byEnd = (a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0);
function statRec() {
  if (ST.R === undefined) {
    const s = store.get("statrec", null);
    ST.R = s && s.fp === statFP() && s.R ? s.R : null;
  }
  if (!ST.R) statBuild();
  return ST.R;
}
const statKeep = () => store.set("statrec", { fp: statFP(), R: ST.R });
function statReset() {
  store.del("statrec");
  ST.R = null;
  statBuild();
}
// fn runs when the record is ready: now, or once the rebuild has finished
function statWhen(fn) {
  if (statRec()) fn();
  else ST.wait.push(fn);
}
// One game into the record; its seal into the game. An older seal stays where the game's moves are gone and the new one
// would say less (a rebuild after a model change reads such games from their summary only).
function statFeed(R, g, rebuild) {
  let s = null;
  try {
    s = statAddGame(R, g);
  } catch (e) {
    return g.seal || null;
  }
  if (s && s.focus == null && s.perf == null) s = null;
  if (rebuild && !g.moves && g.seal && g.seal.perf != null && (!s || s.perf == null)) return g.seal;
  if (s) g.seal = s;
  else delete g.seal;
  return s;
}
// The rebuild runs in short slices, so the app stays responsive (about 13 ms a game on a laptop, more on a phone)
function statBuild() {
  if (ST.busy || REGRADING) return; // after the regrade, statAfterRegrade builds it
  ST.busy = true;
  const R = statRecNew();
  let list = statAll().filter((g) => g.end).sort(byEnd),
    i = 0;
  const step = () => {
    const t0 = Date.now();
    while (i < list.length && Date.now() - t0 < 30) statFeed(R, list[i++], true);
    if (i < list.length) return setTimeout(step, 0);
    const more = statAll().filter((g) => g.end && Date.parse(g.end) / 1000 > R.lastEnd).sort(byEnd); // ended meanwhile
    if (more.length) {
      list = more;
      i = 0;
      return setTimeout(step, 0);
    }
    ST.busy = false;
    if (ST.again) {
      // the games were regraded while this build read them: read them again
      ST.again = false;
      return statBuild();
    }
    ST.R = R;
    statKeep();
    saveGames();
    ST.wait.splice(0).forEach((f) => {
      try {
        f();
      } catch (e) {}
    });
  };
  setTimeout(step, 0);
}
// The games have new grades (main.js regradeOld): a record read before has the old ones
function statAfterRegrade() {
  if (ST.busy) return void (ST.again = true);
  if (ST.R === undefined && !ST.wait.length) return; // nothing read yet: the first look reads them as they are now
  store.del("statrec");
  ST.R = null;
  statBuild();
}
// After a game's route analysis (analysis.js): the game into the record, then done(seal)
function statOnGame(g, done) {
  statWhen(() => {
    if (Date.parse(g.end) / 1000 > ST.R.lastEnd) {
      statFeed(ST.R, g);
      statKeep();
      saveGames();
    }
    if (done) done(g.seal || null);
  });
}
// The statistics redraw once a rebuild has finished
function statRedrawLater() {
  if (ST.redraw) return;
  ST.redraw = true;
  ST.wait.push(() => {
    ST.redraw = false;
    if (view === "stats") renderStats();
  });
}

// ---------- Small helpers
const gr1 = (x) => (x == null || !isFinite(x) ? "–" : dec(x, 1)); // a grade, one decimal
const pc0 = (x) => (x == null || !isFinite(x) ? "–" : x > 999 ? "999+" : String(Math.round(x))); // Focus, whole %
const d1 = (x, d = 1) => dec(Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x, d); // no "−0.0"
const sgn1 = (x) => (Math.abs(x) < 0.05 ? dec(0, 1) : (x > 0 ? "+" : "−") + dec(Math.abs(x), 1)); // ± grades
// a legend's item: never broken across lines
const lgi = (sw, t) => `<span class="lgi">${sw} ${t}</span>`;
const sic = (k) => `<svg class="i sic" viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
const SIC = { perf: "bolt", skill: "brain", focus: "target" };
const dShort = (s) => new Date(s).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
const hasPerf = (g) => !!(g.seal && g.seal.perf != null);
const hasFocus = (g) => !!(g.seal && g.seal.focus != null);
// the games of the scope in view (withScope) that have a seal, oldest first
const sealedGames = () => games.filter((g) => g.seal && (g.seal.focus != null || g.seal.perf != null));
const showsSkill = () => smFitted() && !microNow();
function medianOf(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y),
    n = s.length;
  return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
// The median of a group and its 90 % band, on the log scale (Focus) or plain (grades)
function medBand(a, log) {
  const v = log ? a.map(Math.log) : a,
    m = medianOf(v),
    n = v.length;
  if (n < 2) return { m: log ? Math.exp(m) : m, lo: null, hi: null, n };
  const mu = v.reduce((x, y) => x + y, 0) / n,
    sd = Math.sqrt(v.reduce((x, y) => x + (y - mu) ** 2, 0) / (n - 1)),
    se = (1.2533 * sd) / Math.sqrt(n);
  const f = (x) => (log ? Math.exp(x) : x);
  return { m: f(m), lo: f(m - 1.645 * se), hi: f(m + 1.645 * se), n };
}
// The session number of each game (the 1st, 2nd … game of its session), from the seals' session starts
function sessionIndex(list) {
  const out = {};
  let prev = null,
    k = 0;
  list.forEach((g) => {
    const s = g.seal ? g.seal.sess : null;
    k = s != null && s === prev ? k + 1 : 1;
    prev = s;
    out[g.id] = k;
  });
  return out;
}

// ---------- The seal (the solved page; the square hanko of the 解 stamp)
function sealHtml(s, o = {}) {
  if (!s || (s.focus == null && s.perf == null)) return `<div class="smallstamp" aria-hidden="true">解</div>`;
  const label = [
    s.perf != null ? tr("Performance {v}", { v: gr1(s.perf) }) : "",
    s.skill != null ? tr("Skill {v}", { v: gr1(s.skill) }) : "",
    s.focus != null ? tr("Focus {v} %", { v: pc0(s.focus) }) : "",
  ]
    .filter(Boolean)
    .join(", ");
  const inner =
    s.perf != null
      ? `<span class="sp">${sic(SIC.perf)}<b>${gr1(s.perf)}</b></span><span class="sl"></span>` +
        `<span class="sr"><span>${sic(SIC.skill)}${gr1(s.skill)}</span><i></i><span>${sic(SIC.focus)}${pc0(s.focus)}</span></span>`
      : `<span class="sp">${sic(SIC.focus)}<b>${pc0(s.focus)}</b></span>`;
  return `<button type="button" class="seal${s.perf != null ? "" : " one"}"${o.id ? ` id="${o.id}"` : ""} aria-label="${esc(label)}">${inner}</button>`;
}
const bandTxt = (lo, hi, f) => (lo == null || hi == null ? "" : f(lo) + "–" + f(hi));
// A tap on the seal: the names and the bands
function sealSheet(g, back) {
  const s = g.seal;
  if (!s) return;
  const row = (k, name, v, band, what) =>
    `<div class="sealrow">${sic(SIC[k])}<div><b>${name} ${v}</b>${band ? ` <small>${band}</small>` : ""}<br><span class="sub">${what}</span></div></div>`;
  let html = "";
  if (s.perf != null) html += row("perf", tr("Performance"), gr1(s.perf), bandTxt(s.perfLo, s.perfHi, gr1), tr("This game, on the grade scale."));
  if (s.skill != null) html += row("skill", tr("Skill"), gr1(s.skill), bandTxt(s.skillLo, s.skillHi, gr1), tr("Your level: the techniques you find, and how fast."));
  if (s.focus != null) html += row("focus", tr("Focus"), pc0(s.focus), bandTxt(s.focusLo, s.focusHi, pc0), tr("Your attention on the easy numbers. 100 is your usual."));
  html += `<div class="actions row2"><button class="secondary" type="button" id="sealBack">${tr("Back")}</button><button class="primary" type="button" id="sealStats">${tr("Statistics")}</button></div>`;
  openSheet(html, (b) => {
    b.querySelector("#sealBack").onclick = () => (back ? back() : closeSheet());
    b.querySelector("#sealStats").onclick = () => {
      closeSheet();
      ui.statsTab = s.perf != null ? "skill" : "fokus";
      saveUi();
      setTimeout(() => go("stats"), 280);
    };
  });
}
// The time under the title: at once the time alone, with the bar against the expected time once the seal has come
function sealMeterHtml(g) {
  return g.seal && g.seal.expected ? timeMeterHtml(g.ms, g.seal.expected, tr("expected")) : `<div class="tmeter"><b class="tm-t">${fmt(g.ms)}</b></div>`;
}
// The expected time before a game, from the puzzle's own route (its step codes: level × 100 + places), with the same
// model as the bar after the game (which reads the steps as you played them). Null where the model has no Performance.
// The puzzle's own route is the solver's, which sometimes takes a harder step than players need, so the estimate is
// scaled by how your latest 30 games came out against it (median, as the old estimate did): about half of your games
// then come in under it, as with the bar's expected time.
function statPre(R, lv, rows, cols, grade) {
  const cells = rows * cols,
    n = lv.length,
    steps = lv.map((x, k) => {
      const L = Math.floor(x / 100),
        ref = smRef(L, x % 100, k / n, cells, 2, grade);
      return { i: k, N: L, U: L, refN: ref, refU: ref };
    });
  return smExpected(R, { size: cols + "x" + rows, grade, steps }).median;
}
let PRE_Q = null;
function statExpectedFor(lv, rows, cols, grade) {
  const R = ST.R || (ST.R === undefined ? statRec() : null);
  if (!R || !smFitted() || rows * cols < SM.MIN_CELLS || !lv || !lv.length) return null;
  try {
    if (!PRE_Q || PRE_Q.n !== R.n) {
      const r = statAll()
        .filter((g) => hasPerf(g) && g.solved && !g.hints && g.lv && g.lv.length)
        .slice(-30)
        .map((g) => g.ms / 1000 / statPre(R, g.lv, g.rows, g.cols, g.value))
        .filter((x) => isFinite(x) && x > 0);
      PRE_Q = { n: R.n, q: r.length >= 8 ? Math.max(0.6, Math.min(1.4, medianOf(r))) : 1 };
    }
    return statPre(R, lv, rows, cols, grade) * PRE_Q.q;
  } catch (e) {
    return null;
  }
}
// Below its band two games in a row in a session: time for a break
function focusNoteHtml(g) {
  const s = g.seal;
  if (!s || s.focus == null || s.focusHi == null || s.focusHi >= 100) return "";
  const all = statAll().filter(hasFocus),
    k = all.findIndex((x) => x.id === g.id),
    prev = k > 0 ? all[k - 1] : null;
  if (!(prev && prev.seal.sess === s.sess && prev.seal.focusHi != null && prev.seal.focusHi < 100)) return "";
  return `<p class="insight warn" style="text-align:left">${tr("Low Focus two games in a row. Time for a break.")}</p>`;
}
// The solved page fills in when the analysis is done (play.js showSolved, analysis.js startRoute)
function sealFill(root, g) {
  const st = root.querySelector("#sStamp"),
    mt = root.querySelector("#sMeter"),
    fl = root.querySelector("#focusLine");
  if (st) {
    st.innerHTML = sealHtml(g.seal, { id: "sealBtn" });
    const b = st.querySelector("#sealBtn");
    if (b) b.onclick = () => sealSheet(g, () => showSolved(g));
  }
  if (mt) mt.innerHTML = sealMeterHtml(g);
  if (fl) fl.innerHTML = focusNoteHtml(g);
}

// ---------- Charts
const CW = 320;
function yTicks(lo, hi, max = 5) {
  const span = hi - lo,
    step = span > 6 ? 2 : span > 2.5 ? 1 : 0.5,
    out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
  return out.length > max ? out.filter((_, i) => i % 2 === 0) : out;
}
// Skill as a line with its band, each game's Performance as a dot (a dot under the line: a weaker game than your level)
function skillChart(list, now) {
  const H = 170,
    L = 26,
    R = 30,
    T = 10,
    B = 20;
  const pts = list.map((g) => g.seal);
  const vals = pts.flatMap((s) => [s.perf, s.skillLo, s.skillHi]).concat(now ? [now.lo, now.hi] : []);
  const lo = Math.floor(Math.min(...vals) - 0.2),
    hi = Math.ceil(Math.max(...vals) + 0.2);
  const n = pts.length + (now ? 1 : 0),
    x = (i) => L + (n <= 1 ? (CW - L - R) / 2 : (i * (CW - L - R)) / (n - 1)),
    y = (v) => T + (H - T - B) * (1 - (Math.max(lo, Math.min(hi, v)) - lo) / Math.max(0.5, hi - lo));
  const line = pts.map((s, i) => [x(i), s.skill, s.skillLo, s.skillHi]).concat(now ? [[x(pts.length), now.grade, now.lo, now.hi]] : []);
  let s = `<svg class="trend" viewBox="0 0 ${CW} ${H}" role="img" aria-label="${esc(tr("Skill and each game's Performance over time"))}">`;
  yTicks(lo, hi).forEach((v) => {
    s += `<line x1="${L}" x2="${CW - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${dec(v, v % 1 ? 1 : 0)}</text>`;
  });
  s += `<polygon points="${line.map((p) => p[0] + "," + y(p[3])).concat(line.slice().reverse().map((p) => p[0] + "," + y(p[2]))).join(" ")}" fill="var(--indigo)" opacity="0.13"/>`;
  s += `<polyline points="${line.map((p) => p[0] + "," + y(p[1])).join(" ")}" fill="none" stroke="var(--indigo)" stroke-width="2" stroke-linejoin="round"/>`;
  list.forEach((g, i) => {
    const q = g.seal,
      tip =
        `${dShort(g.end)} · ${esc(BAND[gBand(g)])} ${dec(gradeFor(g))} · ${g.cols}×${g.rows} · ${fmt(g.ms)}: ` +
        tr("Performance {p}, Skill {s}", { p: gr1(q.perf), s: gr1(q.skill) }) +
        (g.hints ? " · " + (g.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: g.hints })) : "");
    s +=
      `<circle cx="${x(i)}" cy="${y(q.perf)}" r="3.6" fill="${q.perf < q.skillLo ? "var(--warn)" : "var(--ink)"}" stroke="var(--cell)" stroke-width="1.5"/>` +
      `<circle cx="${x(i)}" cy="${y(q.perf)}" r="11" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  const last = line[line.length - 1];
  s += `<text x="${last[0] + 6}" y="${y(last[1]) + 4}" font-size="11" font-weight="700" fill="var(--ink)">${gr1(last[1])}</text>`;
  s += `<text x="${L}" y="${H - 4}" font-size="10" fill="var(--mute)">${dShort(list[0].end)}</text><text x="${CW - R}" y="${H - 4}" font-size="10" text-anchor="end" fill="var(--mute)">${tr("now")}</text></svg>`;
  s +=
    `<div class="legendrow lg2">` +
    lgi(`<i style="background:var(--indigo);height:3px;border-radius:2px"></i>`, tr("Skill")) +
    lgi(`<i style="background:var(--indigo);opacity:.2"></i>`, tr("how sure")) +
    lgi(`<i style="background:var(--ink);border-radius:50%"></i>`, tr("a game's Performance")) +
    lgi(`<i style="background:var(--warn);border-radius:50%"></i>`, tr("below the band")) +
    `</div>`;
  return s;
}
// Focus per game around 100 with its band; sessions on alternating shades
function focusChart(list) {
  const H = 160,
    L = 30,
    R = 8,
    T = 8,
    B = 20;
  const pts = list.map((g) => g.seal);
  const lo = Math.max(20, Math.min(70, ...pts.map((s) => s.focusLo || s.focus)) * 0.95),
    hi = Math.min(400, Math.max(140, ...pts.map((s) => s.focusHi || s.focus)) * 1.05);
  const n = pts.length,
    w = (CW - L - R) / Math.max(1, n),
    x = (i) => L + w * (i + 0.5),
    y = (v) => T + (H - T - B) * (1 - (Math.log(Math.max(lo, Math.min(hi, v))) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)));
  let s = `<svg class="trend" viewBox="0 0 ${CW} ${H}" role="img" aria-label="${esc(tr("Focus per game"))}">`;
  // sessions
  let k = 0,
    from = 0;
  for (let i = 1; i <= n; i++)
    if (i === n || pts[i].sess !== pts[i - 1].sess) {
      if (k % 2) s += `<rect x="${L + w * from}" y="${T}" width="${w * (i - from)}" height="${H - T - B}" fill="var(--chip)" opacity="0.7"/>`;
      k++;
      from = i;
    }
  [50, 67, 100, 150, 200, 300].filter((v) => v > lo && v < hi).forEach((v) => {
    s +=
      `<line x1="${L}" x2="${CW - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 100 ? "var(--mute)" : "var(--grid)"}"${v === 100 ? ' stroke-dasharray="4 3"' : ""}/>` +
      `<text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${v}</text>`;
  });
  const si = sessionIndex(list);
  list.forEach((g, i) => {
    const q = g.seal,
      low = q.focusHi != null && q.focusHi < 100,
      high = q.focusLo != null && q.focusLo > 100;
    const d = new Date(g.end),
      tip =
        `${d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" })} ${d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })} · ` +
        tr("game {k} of the session", { k: si[g.id] }) +
        ` · ${g.cols}×${g.rows}: ` +
        tr("Focus {v} %", { v: pc0(q.focus) }) +
        (q.focusLo != null ? " (" + bandTxt(q.focusLo, q.focusHi, pc0) + ")" : "");
    if (q.focusLo != null) s += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(q.focusLo)}" y2="${y(q.focusHi)}" stroke="var(--mute)" stroke-width="1.2" opacity="0.6"/>`;
    s +=
      `<circle cx="${x(i)}" cy="${y(q.focus)}" r="3.6" fill="${low ? "var(--warn)" : high ? "var(--indigo)" : "var(--ink)"}" stroke="var(--cell)" stroke-width="1.5"/>` +
      `<rect x="${x(i) - w / 2}" y="${T}" width="${w}" height="${H - T - B}" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  s += `<text x="${L}" y="${H - 4}" font-size="10" fill="var(--mute)">${dShort(list[0].end)}</text><text x="${CW - R}" y="${H - 4}" font-size="10" text-anchor="end" fill="var(--mute)">${dShort(list[n - 1].end)}</text></svg>`;
  s +=
    `<div class="legendrow lg2">` +
    lgi(`<i style="background:var(--ink);border-radius:50%"></i>`, tr("within its band")) +
    lgi(`<i style="background:var(--warn);border-radius:50%"></i>`, tr("below")) +
    lgi(`<i style="background:var(--indigo);border-radius:50%"></i>`, tr("above (in the zone)")) +
    lgi(`<i style="background:var(--chip);box-shadow:inset 0 0 0 1px var(--grid)"></i>`, tr("a session")) +
    `</div>`;
  return s;
}
// A scatter for the Debug view: x and y with a reference line (y = ref, or the diagonal), and binned medians
function fitScatter(pts, o) {
  const H = 170,
    L = 34,
    R = 8,
    T = 8,
    B = 24;
  const xs = pts.map((p) => p.x),
    ys = pts.map((p) => p.y);
  const x0 = o.x0 != null ? o.x0 : Math.floor(Math.min(...xs)),
    x1 = o.x1 != null ? o.x1 : Math.ceil(Math.max(...xs)),
    y0 = o.y0 != null ? o.y0 : Math.min(...ys, o.ref != null ? o.ref : Infinity),
    y1 = o.y1 != null ? o.y1 : Math.max(...ys, o.ref != null ? o.ref : -Infinity);
  const tx = o.log ? Math.log : (v) => v;
  const X = (v) => L + ((CW - L - R) * (tx(v) - tx(x0))) / Math.max(1e-9, tx(x1) - tx(x0)),
    Y = (v) => T + (H - T - B) * (1 - (tx(Math.max(y0, Math.min(y1, v))) - tx(y0)) / Math.max(1e-9, tx(y1) - tx(y0)));
  let s = `<svg class="trend" viewBox="0 0 ${CW} ${H}" role="img" aria-label="${esc(o.label)}">`;
  (o.yt || []).forEach((v) => {
    s += `<line x1="${L}" x2="${CW - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${L - 6}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${o.fy ? o.fy(v) : v}</text>`;
  });
  (o.xt || []).forEach((v) => (s += `<text x="${X(v)}" y="${H - 9}" font-size="10" text-anchor="middle" fill="var(--mute)">${o.fx ? o.fx(v) : v}</text>`));
  if (o.ref != null) s += `<line x1="${L}" x2="${CW - R}" y1="${Y(o.ref)}" y2="${Y(o.ref)}" stroke="var(--mute)" stroke-dasharray="4 3"/>`;
  if (o.diag) s += `<line x1="${X(Math.max(x0, y0))}" y1="${Y(Math.max(x0, y0))}" x2="${X(Math.min(x1, y1))}" y2="${Y(Math.min(x1, y1))}" stroke="var(--mute)" stroke-dasharray="4 3"/>`;
  pts.forEach((p) => {
    s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" fill="var(--ink)" opacity="0.55"/>` + (p.tip ? `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="9" fill="transparent" data-tip="${esc(p.tip)}"/>` : "");
  });
  // the binned medians with their 90 % band: what the eye should follow
  (o.bins || []).forEach((b) => {
    if (b.n < 3) return;
    if (b.lo != null) s += `<line x1="${X(b.x)}" x2="${X(b.x)}" y1="${Y(b.lo)}" y2="${Y(b.hi)}" stroke="var(--indigo)" stroke-width="3" opacity="0.45" stroke-linecap="round"/>`;
    s += `<circle cx="${X(b.x)}" cy="${Y(b.m)}" r="5" fill="var(--indigo)" stroke="var(--cell)" stroke-width="2" data-tip="${esc(b.tip || "")}"/>`;
  });
  s += `</svg><div class="legendrow" style="justify-content:space-between"><span>${o.axes}</span>${o.bins ? `<span><i style="background:var(--indigo);border-radius:50%"></i> ${tr("median, with its 90 % band")}</span>` : ""}</div>`;
  return s;
}
// Medians in bins of x (for fitScatter)
function binMedians(pts, edges, log, label) {
  const out = [];
  for (let k = 0; k + 1 < edges.length; k++) {
    const a = pts.filter((p) => p.x >= edges[k] && p.x < edges[k + 1]);
    if (!a.length) continue;
    const mb = medBand(
      a.map((p) => p.y),
      log,
    );
    out.push(Object.assign(mb, { x: (edges[k] + edges[k + 1]) / 2, tip: label(edges[k], edges[k + 1], mb) }));
  }
  return out;
}

// ---------- Overview: the three indices
function statIndicesHtml() {
  const R = statRec();
  if (!R) {
    statRedrawLater();
    return `<div class="panelcard"><p class="sub">${tr("Reading your games …")}</p></div>`;
  }
  const list = sealedGames();
  if (!list.length) return "";
  const tile = (k, tab, v, name, sub) =>
    `<button class="idx" type="button" data-tab="${tab}">${sic(SIC[k])}<b>${v}</b><span>${name}</span><small>${sub}</small></button>`;
  let html = `<div class="idxs">`;
  const skill = showsSkill();
  if (skill) {
    const sk = smSkill(R),
      pl = list.filter(hasPerf);
    const ago = Date.now() - 14 * 864e5,
      old = pl.filter((g) => Date.parse(g.end) <= ago).pop();
    const d = old ? sk.grade - old.seal.skill : null;
    html += tile(
      "skill",
      "skill",
      gr1(sk.grade),
      tr("Skill"),
      d == null ? bandTxt(sk.lo, sk.hi, gr1) : tr("{d} in 2 weeks", { d: sgn1(d) }),
    );
    const last10 = pl.slice(-10).map((g) => g.seal.perf);
    if (last10.length) html += tile("perf", "skill", gr1(medianOf(last10)), tr("Performance"), tr("last {n} games", { n: last10.length }));
  }
  const fl = list.filter(hasFocus).slice(-10);
  if (fl.length) {
    html += tile("focus", "fokus", pc0(medianOf(fl.map((g) => g.seal.focus))), tr("Focus"), tr("last {n} games", { n: fl.length }));
  }
  html += `</div>`;
  return html;
}
// Overview: the Skill chart for the last 30 games
function statSkillLine() {
  if (!showsSkill() || !statRec()) return "";
  const pl = sealedGames().filter(hasPerf);
  if (pl.length < 3) return "";
  return `<div class="panelcard" data-tab="skill"><h3>${sic(SIC.skill)} ${tr("Skill")}</h3>${skillChart(pl.slice(-30), smSkill(ST.R))}</div>`;
}

// ---------- Skill
// The techniques: spotting (when the board needed it, did you find it?), your typical time for it and their bands
function ladderHtml(R, sk) {
  const parts = sk.speedParts,
    cells = STAT_PROFILE.rows * STAT_PROFILE.cols,
    la = Math.log(smSpeedAnchor()),
    lg = Math.log(SM.PER_GRADE);
  const rows = [],
    unseen = [];
  for (const c of TT.list()) {
    if (!smHard(c)) continue;
    const sp = sk.spotting[c],
      finds = R.tech[c] ? R.tech[c].att.length : 0,
      needs = sp ? sp.n : 0;
    if (!needs && !finds) {
      unseen.push(LEVEL_TECH[c]);
      continue;
    }
    const sd = Math.sqrt((sp.a * sp.b) / ((sp.a + sp.b) ** 2 * (sp.a + sp.b + 1))),
      spLo = Math.max(0, sp.mean - 1.645 * sd),
      spHi = Math.min(1, sp.mean + 1.645 * sd);
    const ref = smRef(c, 1, 0.5, cells, 2, 4),
      mu = parts.mu[c],
      t = Math.exp(mu) * ref,
      tLo = Math.exp(mu - 1.645 * parts.sd[c]) * ref,
      tHi = Math.exp(mu + 1.645 * parts.sd[c]) * ref,
      typ = Math.exp(la) * ref,
      g = (la - mu) / lg;
    const tip = `${cap(LEVEL_TECH[c])}: ${Math.round(100 * sp.mean)} % (${bandTxt(100 * spLo, 100 * spHi, pc0)}) · ${fmtS(t)} (${bandTxt(tLo, tHi, fmtS)}) · ${tr("typical {t}", { t: fmtS(typ) })}`;
    rows.push(
      `<div class="lad" data-tip="${esc(tip)}"><span class="ln">${TT.num(c)}</span><span class="lname">${esc(cap(LEVEL_TECH[c]))}</span>` +
        `<span class="lsp"><span class="lbar"><i style="left:${(100 * spLo).toFixed(0)}%;width:${(100 * (spHi - spLo)).toFixed(0)}%"></i><b style="left:${(100 * sp.mean).toFixed(0)}%"></b></span><small>${Math.round(100 * sp.mean)} %</small></span>` +
        `<span class="lt ${g >= 0.25 ? "up" : g <= -0.25 ? "down" : ""}">${sgn1(g)}</span></div>`,
    );
  }
  return (
    `<div class="ladh"><span></span><span>${tr("Technique")}</span><span>${tr("Found")}</span><span>${tr("Speed")}</span></div>` +
    rows.join("") +
    (unseen.length ? `<p class="techfew">${tr("Not met yet: {list}.", { list: unseen.join(", ") })}</p>` : "") +
    `<p class="techfew">${tr("Found: how often you get past it without help. Speed: grades faster (+) or slower (−) than the typical player.")}</p>`
  );
}
// Practise next: the technique where Skill has most to gain, from what it adds to the puzzles you can solve and how much
// slower than the typical player you find it
function practiseNext(R, sk) {
  const parts = sk.speedParts,
    w = smWeights(sk.repertoire),
    W = Object.values(w).reduce((a, b) => a + b, 0) || 1,
    la = Math.log(smSpeedAnchor()),
    lg = Math.log(SM.PER_GRADE);
  let best = null;
  for (const c in w) {
    const L = +c;
    if (!smHard(L) || !TT.known(L)) continue;
    const m2 = Object.assign({}, sk.mastery, { [L]: Math.max(sk.mastery[L] || 0, 0.97) });
    const gainRep = smRepertoire(m2) - sk.repertoire,
      gainSpeed = parts.mu[L] > la ? (w[L] / W) * ((parts.mu[L] - la) / lg) : 0,
      gain = gainRep + gainSpeed;
    if (!best || gain > best.gain) best = { L, gain, gainRep, gainSpeed };
  }
  if (!best || best.gain < 0.05) return null;
  const T = R.tech[best.L] || { need: [] };
  return Object.assign(best, { found: T.need.filter((x) => x[0]).length, needs: T.need.length, speed: (la - parts.mu[best.L]) / lg });
}
function practiseHtml(R, sk) {
  const p = practiseNext(R, sk);
  if (!p) return "";
  const facts = [p.needs ? tr("found {a} of {b}", { a: p.found, b: p.needs }) : "", tr("speed {g}", { g: sgn1(p.speed) }), tr("Skill +{g}", { g: dec(p.gain, 1) })].filter(Boolean);
  return (
    `<div class="fcard weak"><span class="eyebrow">${tr("Practise next")}</span><strong>${esc(cap(LEVEL_TECH[p.L]))}</strong>` +
    `<p class="pfacts">${facts.join(" · ")}</p>` +
    `<div class="actions row2" style="margin-top:6px">` +
    (GAME.guide ? `<button class="secondary" type="button" data-guide="${guideTechOf(p.L)}">${tr("Read the guide")}</button>` : "") +
    `<button class="primary" type="button" data-train="${p.L}">${tr("Practise the technique")}</button></div></div>`
  );
}
// The technique Learn mode practises (newgame.js), or null
function statPractiseL() {
  try {
    if (!smFitted() || !ST.R) return null;
    const p = practiseNext(ST.R, smSkill(ST.R));
    return p ? p.L : null;
  } catch (e) {
    return null;
  }
}
function skillPanel() {
  if (!showsSkill()) return "";
  const R = statRec();
  if (!R) return statIndicesHtml();
  const sk = smSkill(R),
    pl = sealedGames().filter(hasPerf);
  let html =
    `<div class="panelcard"><h3>${sic(SIC.skill)} ${tr("Skill")} <span class="hval">${gr1(sk.grade)}<small>${bandTxt(sk.lo, sk.hi, gr1)}</small></span></h3>` +
    `<p>${tr("Your level: the techniques you find, and how fast. The dots are each game's Performance.")}</p>`;
  if (pl.length >= 3) html += skillChart(pl.slice(-60), sk);
  html +=
    `<table class="data"><tr><td>${tr("What you can solve")}</td><td class="num"><b>${gr1(sk.repertoire)}</b></td></tr>` +
    `<tr><td>${tr("Speed")}</td><td class="num"><b>${sgn1(sk.speed)}</b></td></tr></table>` +
    `</div>`;
  html += `<div class="panelcard"><h3>${tr("Techniques")}</h3>${practiseHtml(R, sk)}${ladderHtml(R, sk)}</div>`;
  return html;
}

// ---------- Focus
function focusPanelNew() {
  const R = statRec();
  if (!R) return statIndicesHtml();
  const all = sealedGames().filter(hasFocus);
  if (all.length < 3) return "";
  const list = all.slice(-40),
    si = sessionIndex(all);
  const lastSess = list[list.length - 1].seal.sess,
    sess = list.filter((g) => g.seal.sess === lastSess);
  let html =
    `<div class="panelcard"><h3>${sic(SIC.focus)} ${tr("Focus")}</h3>` +
    `<p>${tr("Your attention on the easy numbers in each game. 100 is your usual; the line is how sure.")}</p>` +
    focusChart(list) +
    `<p class="sub">${tr("Latest session: {list}", { list: sess.map((g) => pc0(g.seal.focus)).join(" · ") })}</p>` +
    `</div>`;
  html += focusFactorsHtml(all, si);
  html += lapseHtml(list);
  return html;
}
// What lowers it for you: the game's number in its session, the time of day and the game's length, as sizes with bands
function focusFactorsHtml(all, si) {
  const list = all.slice(-200);
  if (list.length < 12) return "";
  const hour = (g) => new Date(Date.parse(g.end) - g.ms).getHours();
  const groups = [
    [
      tr("Game number in the session"),
      [
        [tr("1st game"), (g) => si[g.id] === 1],
        [tr("2nd game"), (g) => si[g.id] === 2],
        [tr("3rd game or later"), (g) => si[g.id] >= 3],
      ],
    ],
    [
      tr("Time of day"),
      [
        [tr("Morning 5–11"), (g) => hour(g) >= 5 && hour(g) < 11],
        [tr("Afternoon 11–17"), (g) => hour(g) >= 11 && hour(g) < 17],
        [tr("Evening 17–22"), (g) => hour(g) >= 17 && hour(g) < 22],
        [tr("Night 22–5"), (g) => hour(g) >= 22 || hour(g) < 5],
      ],
    ],
    // the board size, not the game's length: a game is long partly because its easy numbers were slow (circular)
    [
      tr("Board size"),
      [...new Set(list.map((g) => g.rows * g.cols))]
        .sort((a, b) => a - b)
        .map((n) => {
          const g0 = list.find((g) => g.rows * g.cols === n);
          return [g0.cols + "×" + g0.rows, (g) => g.rows * g.cols === n];
        }),
    ],
  ];
  const all100 = medianOf(list.map((g) => g.seal.focus));
  // each group's median and band on one shared axis (log), like the technique ladder, so they compare at a glance
  const rows = groups.map(([name, items]) => [
    name,
    items
      .map(([label, f]) => {
        const a = list.filter(f).map((g) => g.seal.focus);
        return a.length ? Object.assign(medBand(a, true), { label }) : null;
      })
      .filter(Boolean),
  ]);
  const shown = rows.flatMap((r) => r[1]).filter((b) => b.n >= 3);
  const ends = shown.flatMap((b) => (b.n >= 5 && b.lo != null ? [b.lo, b.hi] : [b.m]));
  const lo = Math.max(40, Math.min(80, all100 * 0.85, ...ends) * 0.95),
    hi = Math.min(250, Math.max(125, all100 * 1.15, ...ends) * 1.05),
    pos = (v) => (100 * (Math.log(Math.max(lo, Math.min(hi, v))) - Math.log(lo))) / (Math.log(hi) - Math.log(lo));
  let table = `<div class="frows">`;
  rows.forEach(([name, items]) => {
    table += `<div class="fgrp">${name}</div>`;
    items.forEach((b) => {
      const band = b.n >= 5 && b.lo != null,
        low = band && b.hi < all100,
        high = band && b.lo > all100;
      const tip = `${b.label}: ${b.n === 1 ? tr("1 game") : tr("{n} games", { n: b.n })}` + (b.n >= 3 ? ` · ${tr("Focus {v} %", { v: pc0(b.m) })}` : "") + (band ? ` (${bandTxt(b.lo, b.hi, pc0)})` : "");
      table +=
        `<div class="frow" data-tip="${esc(tip)}"><span class="fl">${b.label}<small>${b.n}</small></span>` +
        `<span class="lbar fbar"><u style="left:${pos(all100).toFixed(1)}%"></u>` +
        (band ? `<i style="left:${pos(b.lo).toFixed(1)}%;width:${(pos(b.hi) - pos(b.lo)).toFixed(1)}%"></i>` : "") +
        (b.n >= 3 ? `<b class="${low ? "low" : high ? "high" : ""}" style="left:${pos(b.m).toFixed(1)}%"></b>` : "") +
        `</span><span class="fv ${low ? "low" : high ? "high" : ""}">${b.n >= 3 ? pc0(b.m) : "–"}</span></div>`;
    });
  });
  table += `<div class="frs"><span></span><span class="fscale"><small style="left:0">${pc0(lo)}</small><small style="left:${pos(all100).toFixed(1)}%">${tr("your median {m}", { m: pc0(all100) })}</small><small style="left:100%">${pc0(hi)}</small></span><span></span></div></div>`;
  return `<div class="panelcard"><h3>${tr("What moves your Focus")}</h3><p>${tr("Your typical Focus in each situation, with how sure it is.")}</p>${table}</div>`;
}
// The latest game below its band, on the board: the easy number that took longest, and the ones that were waiting
function lapseHtml(list) {
  for (let k = list.length - 1; k >= 0; k--) {
    const g = list[k];
    if (!(g.seal.focusHi != null && g.seal.focusHi < 100 && g.moves)) continue;
    const cand = g.moves
      .map((m, i) => ({ m, i }))
      .filter(({ m, i }) => i > 0 && m.cls === "easy" && smIsBasic(moveLevel(m)))
      .sort((a, b) => b.m.dt - a.m.dt)
      .slice(0, 3);
    for (const { i } of cand) {
      let b = "";
      try {
        b = concBoardHtml(g, i);
      } catch (e) {}
      if (b) return `<div class="panelcard"><h3>${tr("The latest dip")} <span class="hval">${sic(SIC.focus)} ${pc0(g.seal.focus)}</span></h3>${b}</div>`;
    }
  }
  return "";
}

// ---------- Games
// The seal's numbers on a game's line (stats.js gameRow)
function sealLine(g) {
  const s = g.seal;
  if (!s || (s.perf == null && s.focus == null)) return "";
  return `<span class="sealmini">${s.perf != null ? sic(SIC.perf) + gr1(s.perf) + " " : ""}${s.focus != null ? sic(SIC.focus) + pc0(s.focus) : ""}</span>`;
}
// Week by week: games, the median Performance and Focus, errors and the hardest solved
function weeksHtml() {
  const wk = {};
  games.forEach((g) => {
    const d = new Date(g.end),
      mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = dayKey(mon),
      w = (wk[k] = wk[k] || { k, n: 0, won: 0, perf: [], focus: [], moves: 0, err: 0, top: 0 });
    w.n++;
    if (g.solved) w.won++;
    if (hasPerf(g)) w.perf.push(g.seal.perf);
    if (hasFocus(g)) w.focus.push(g.seal.focus);
    if (g.route && g.route.n) {
      w.moves += g.route.n;
      w.err += g.route.wrong || 0;
    }
    if (g.solved && !g.hints) w.top = Math.max(w.top, gradeFor(g));
  });
  const weeks = Object.values(wk)
    .sort((p, q) => (p.k < q.k ? 1 : -1))
    .slice(0, 8);
  if (!weeks.length) return "";
  const df = (k) => new Date(k + "T12:00:00").toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  const skill = showsSkill();
  return (
    `<div class="panelcard"><h3>${tr("Week by week")}</h3>` +
    `<table class="data wk"><tr><th>${tr("Week of")}</th><th>${tr("Games")}</th>${skill ? `<th>${sic(SIC.perf)}</th>` : ""}<th>${sic(SIC.focus)}</th><th>${tr("Errors/100")}</th><th>${tr("Hardest")}</th></tr>` +
    weeks
      .map(
        (w) =>
          `<tr><td>${df(w.k)}</td><td>${w.won}${w.n > w.won ? `<small> / ${w.n}</small>` : ""}</td>` +
          (skill ? `<td>${w.perf.length ? `<b>${gr1(medianOf(w.perf))}</b>` : "–"}</td>` : "") +
          `<td>${w.focus.length ? pc0(medianOf(w.focus)) : "–"}</td><td>${w.moves >= 20 ? dec((100 * w.err) / w.moves) : "–"}</td><td>${w.top ? dec(w.top) : "–"}</td></tr>`,
      )
      .join("") +
    `</table>` +
    `</div>`
  );
}
// Times by grade and board size: a grade 3 on 5×5 and on 7×7 are different puzzles, so each size has its own column
function gradeSizeHtml() {
  const won = games.filter((g) => g.solved && !g.hints && !g.replay);
  if (won.length < 3) return "";
  const sizes = [...new Set(won.map((g) => g.cols + "×" + g.rows))].sort((a, b) => {
    const n = (s) => s.split("×").reduce((x, y) => x * y, 1);
    return n(a) - n(b);
  });
  const bands = [...new Set(won.map(gBand))].sort((a, b) => a - b);
  let t = `<table class="data"><tr><th>${tr("Grade")}</th>${sizes.map((s) => `<th class="num">${s}</th>`).join("")}</tr>`;
  bands.forEach((b) => {
    t += `<tr><td>${b} · ${esc(BAND[b])}</td>`;
    sizes.forEach((s) => {
      const a = won.filter((g) => gBand(g) === b && g.cols + "×" + g.rows === s).map((g) => g.ms);
      t += a.length ? `<td class="num${a.length < 3 ? " few" : ""}" data-tip="${esc(a.length === 1 ? tr("1 game") : tr("{n} games", { n: a.length }))}">${fmt(medianOf(a))}</td>` : `<td class="num">–</td>`;
    });
    t += `</tr>`;
  });
  t += `</table>`;
  return `<div class="panelcard"><h3>${tr("Your times by grade and board size")}</h3><p>${tr("Median time without hints.")}</p>${t}</div>`;
}

// ---------- Debug: the reference, and how the model fits your games
function debugPanel() {
  const R = statRec();
  if (!R) return statIndicesHtml();
  const F = STAT_REF.fitted || {},
    fit = smFitted();
  let html = `<div class="panelcard"><h3>${tr("The reference")}</h3>`;
  if (!fit) html += `<p class="insight warn">${tr("Not fitted yet: Suguru's reference")}</p>`;
  const kv = (k, v) => `<tr><td>${k}</td><td class="num">${v}</td></tr>`;
  html +=
    `<table class="data">` +
    (fit ? kv(tr("Fitted on"), tr("{g} games, {m} moves", { g: F.games, m: F.moves })) : "") +
    kv(tr("One grade = the hard steps take"), "×" + dec(SM.PER_GRADE, 2)) +
    kv(tr("Easy numbers per grade harder"), "+" + dec(100 * (Math.exp(STAT_REF.gradeGame || 0) - 1), 1) + " %") +
    kv(tr("A move's ordinary spread"), "×" + dec(Math.exp(STAT_REF.spread || 0), 1)) +
    kv(tr("A hard step's ordinary spread"), "×" + dec(Math.exp(STAT_REF.spreadHard || 0), 1)) +
    kv(tr("The typical player's easy numbers"), "×" + dec(Math.exp((STAT_REF.readStart || {}).focus || 0), 2)) +
    kv(tr("Grade profile"), tr("{n} puzzles on {size}, grades {a} to {b}", { n: STAT_PROFILE.puzzles.length, size: STAT_PROFILE.cols + "×" + STAT_PROFILE.rows, a: dec(STAT_PROFILE.puzzles[0][0]), b: dec(STAT_PROFILE.puzzles[STAT_PROFILE.puzzles.length - 1][0]) })) +
    `</table>`;
  const cells = STAT_PROFILE.rows * STAT_PROFILE.cols;
  html +=
    `<h4 class="dh">${tr("Reference time per technique, at one place on {size}", { size: STAT_PROFILE.cols + "×" + STAT_PROFILE.rows })}</h4><table class="data">` +
    TT.list()
      .map((c) => `<tr><td>${TT.num(c)} · ${esc(cap(LEVEL_TECH[c]))}</td><td class="num">${fmtS(smRef(c, 1, 0.5, cells, 2, 4))}</td><td class="num">${F.n && F.n[c] != null ? tr("{n} moves", { n: F.n[c] }) : "–"}</td></tr>`)
      .join("") +
    `</table>` +
    `</div>`;
  // the fit on your games, after the first 40 (the record is still young before)
  const sealed = sealedGames(),
    young = 40,
    pl = sealed.filter(hasPerf).slice(young);
  if (fit && !microNow() && pl.length >= 10) {
    const d = pl.map((g) => ({ x: gradeFor(g), y: g.seal.perf - g.seal.skill, tip: `${dShort(g.end)} · ${dec(gradeFor(g))} · ${g.cols}×${g.rows}: ${dec(g.seal.perf - g.seal.skill, 2)}` }));
    const c1 = medBand(
      d.map((p) => p.y),
      false,
    );
    const ys = d.map((p) => p.y);
    html +=
      `<div class="panelcard"><h3>${tr("Performance against Skill")}</h3>` +
      `<p>${tr("Median {m} ({a} to {b}), {n} games", { m: d1(c1.m, 2), a: d1(c1.lo, 2), b: d1(c1.hi, 2), n: pl.length })}</p>` +
      fitScatter(d, {
        label: tr("Performance minus Skill against the puzzle's grade"),
        ref: 0,
        y0: Math.max(-3, Math.min(...ys)),
        y1: Math.min(3, Math.max(...ys)),
        yt: [-2, -1, 0, 1, 2],
        xt: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        x0: 1,
        x1: 9.5,
        bins: binMedians(d, [0, 2, 3, 4, 5, 6, 7, 8, 10], false, (a, b, m) => tr("grades {a} to {b}: median {m} ({n} games)", { a, b, m: dec(m.m, 2), n: m.n })),
        axes: tr("Performance − Skill ↑ · puzzle grade →"),
      }) +
      sizeTable(pl) +
      `</div>`;
    // expected against actual time
    const e = pl.filter((g) => g.seal.expected > 0).map((g) => ({ x: g.seal.expected, y: g.ms / 1000, tip: `${dShort(g.end)}: ${tr("expected {a}, took {b}", { a: fmt(g.seal.expected * 1000), b: fmt(g.ms) })}` }));
    if (e.length >= 10) {
      const faster = e.filter((p) => p.y < p.x).length;
      const lo = Math.min(...e.map((p) => Math.min(p.x, p.y))) * 0.9,
        hi = Math.max(...e.map((p) => Math.max(p.x, p.y))) * 1.1;
      const ticks = [30, 60, 120, 300, 600, 1200, 2400].filter((v) => v >= lo && v <= hi);
      html +=
        `<div class="panelcard"><h3>${tr("Expected against actual time")}</h3>` +
        `<p>${tr("Faster than expected: {a} of {b} ({pct} %)", { a: faster, b: e.length, pct: Math.round((100 * faster) / e.length) })}</p>` +
        fitScatter(e, {
          label: tr("The expected time against your time"),
          log: true,
          diag: true,
          x0: lo,
          x1: hi,
          y0: lo,
          y1: hi,
          yt: ticks,
          xt: ticks,
          fx: (v) => fmt(v * 1000),
          fy: (v) => fmt(v * 1000),
          axes: tr("your time ↑ · expected →"),
        }) +
        `</div>`;
    }
  }
  // Focus: by grade, and how often its band holds 100
  const fl = sealed.filter(hasFocus).slice(young);
  if (fl.length >= 10) {
    const d = fl.map((g) => ({ x: gradeFor(g), y: g.seal.focus, tip: `${dShort(g.end)} · ${dec(gradeFor(g))} · ${g.cols}×${g.rows}: ${pc0(g.seal.focus)}` }));
    const inBand = fl.filter((g) => g.seal.focusLo != null && g.seal.focusLo <= 100 && 100 <= g.seal.focusHi).length;
    const ys = d.map((p) => p.y);
    html +=
      `<div class="panelcard"><h3>${tr("Focus against the grade")}</h3>` +
      `<p>${tr("Band holds 100: {pct} % of {n} games", { pct: Math.round((100 * inBand) / fl.length), n: fl.length })}</p>` +
      fitScatter(d, {
        label: tr("Focus against the puzzle's grade"),
        ref: 100,
        log: false,
        y0: Math.max(20, Math.min(...ys)),
        y1: Math.min(300, Math.max(...ys)),
        yt: [50, 100, 150, 200].filter((v) => v >= Math.min(...ys) - 20 && v <= Math.max(...ys) + 20),
        xt: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        x0: 1,
        x1: 9.5,
        bins: binMedians(d, [0, 2, 3, 4, 5, 6, 7, 8, 10], true, (a, b, m) => tr("grades {a} to {b}: median {m} ({n} games)", { a, b, m: pc0(m.m), n: m.n })),
        axes: tr("Focus ↑ · puzzle grade →"),
      }) +
      `</div>`;
  }
  // Skill's two parts over time
  const sp = sealed.filter((g) => hasPerf(g) && g.seal.rep != null);
  if (fit && !microNow() && sp.length >= 5) html += partsHtml(sp.slice(-120));
  html += `<div class="panelcard"><h3>${tr("The model's numbers")}</h3><table class="data">` +
    [
      [tr("Your normal: games on the size"), SM.N_NORMAL],
      [tr("A session ends after a break of"), tr("{n} min", { n: SM.SESSION_GAP / 60 })],
      [tr("Steps kept per technique"), tr("{a} needs, {b} finds", { a: SM.WIN, b: SM.WIN_FIND })],
      [tr("A wrong number on an easy move adds"), tr("{s} s", { s: SM.W_WRONG })],
      [tr("Skill and Performance from"), tr("{n} cells", { n: SM.MIN_CELLS })],
      [tr("Your record"), tr("{n} games", { n: R.n || 0 }) + " · " + SM.V],
    ]
      .map(([k, v]) => kv(k, v))
      .join("") +
    `</table></div>`;
  return html;
}
// Performance − Skill and Focus by board size (C5: no trend with size)
function sizeTable(pl) {
  const by = {};
  pl.forEach((g) => (by[g.cols + "×" + g.rows] = by[g.cols + "×" + g.rows] || []).push(g));
  const rows = Object.entries(by).sort((a, b) => a[1][0].rows * a[1][0].cols - b[1][0].rows * b[1][0].cols);
  return (
    `<table class="data"><tr><th>${tr("Board")}</th><th class="num">${tr("Games")}</th><th class="num">${tr("Performance − Skill")}</th><th class="num">${sic(SIC.focus)}</th></tr>` +
    rows
      .map(([k, l]) => {
        const b = medBand(
          l.map((g) => g.seal.perf - g.seal.skill),
          false,
        );
        return `<tr><td>${k}</td><td class="num">${l.length}</td><td class="num">${d1(b.m, 2)}${l.length >= 5 && b.lo != null ? `<small> (${d1(b.lo)} to ${d1(b.hi)})</small>` : ""}</td><td class="num">${pc0(medianOf(l.filter(hasFocus).map((g) => g.seal.focus)))}</td></tr>`;
      })
      .join("") +
    `</table>`
  );
}
// Skill and what you can solve, game by game: the gap is your speed
function partsHtml(list) {
  const H = 150,
    L = 26,
    R = 8,
    T = 8,
    B = 18;
  const vals = list.flatMap((g) => [g.seal.skill, g.seal.rep]),
    lo = Math.floor(Math.min(...vals) - 0.2),
    hi = Math.ceil(Math.max(...vals) + 0.2);
  const x = (i) => L + (list.length <= 1 ? 0 : (i * (CW - L - R)) / (list.length - 1)),
    y = (v) => T + (H - T - B) * (1 - (v - lo) / Math.max(0.5, hi - lo));
  let s = `<svg class="trend" viewBox="0 0 ${CW} ${H}" role="img" aria-label="${esc(tr("Skill and what you can solve over time"))}">`;
  yTicks(lo, hi).forEach((v) => (s += `<line x1="${L}" x2="${CW - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${dec(v, v % 1 ? 1 : 0)}</text>`));
  s += `<polyline points="${list.map((g, i) => x(i) + "," + y(g.seal.rep)).join(" ")}" fill="none" stroke="var(--mute)" stroke-width="2" stroke-dasharray="5 3"/>`;
  s += `<polyline points="${list.map((g, i) => x(i) + "," + y(g.seal.skill)).join(" ")}" fill="none" stroke="var(--indigo)" stroke-width="2"/>`;
  list.forEach((g, i) => (s += `<rect x="${x(i) - 3}" y="${T}" width="6" height="${H - T - B}" fill="transparent" data-tip="${esc(`${dShort(g.end)}: ${tr("Skill {s} = what you can solve {r} + speed {v}", { s: gr1(g.seal.skill), r: gr1(g.seal.rep), v: sgn1(g.seal.speed) })}`)}"/>`));
  s += `<text x="${L}" y="${H - 4}" font-size="10" fill="var(--mute)">${dShort(list[0].end)}</text><text x="${CW - R}" y="${H - 4}" font-size="10" text-anchor="end" fill="var(--mute)">${dShort(list[list.length - 1].end)}</text></svg>`;
  return (
    `<div class="panelcard"><h3>${tr("Skill's two parts")}</h3>${s}` +
    `<div class="legendrow lg2">${lgi(`<i style="background:var(--indigo);height:3px;border-radius:2px"></i>`, tr("Skill"))}${lgi(`<i style="background:var(--mute);height:3px;border-radius:2px"></i>`, tr("what you can solve"))}</div></div>`
  );
}
