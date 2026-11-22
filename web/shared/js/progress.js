// Progress: have you got better over time?
// The puzzles differ, so raw time does not say much. Each solved puzzle (without hints, not replayed) is therefore measured against
// what its grade usually costs you per empty cell: log(sec. per cell) = a + b * grade, fitted to your whole history.
// The deviation (the residual) is your form in that puzzle: negative = faster than normal for that grade.
// Progress = your latest k puzzles against your first k. A permutation test says whether the difference is larger than the
// normal variation (puzzles of the same grade vary a lot from one time to the next).

const PROG_MIN = 12; // this many clean solutions before anything is said

function progressData(list = games) {
  const sg = list.filter((g) => g.solved && !g.hints && !g.replay && g.empty > 0 && g.ms > 0 && g.value);
  if (sg.length < PROG_MIN) return { few: sg.length };
  const x = sg.map(gradeFor),
    y = sg.map((g) => Math.log(g.ms / 1000 / g.empty));
  const n = x.length,
    mx = x.reduce((a, b) => a + b) / n,
    my = y.reduce((a, b) => a + b) / n;
  let sxy = 0,
    sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  let b = sxx ? sxy / sxx : 0;
  if (!(b > 0.1)) b = Math.log(1.5); // too little spread in the grades: use the typical 1.5x per grade
  const a = my - b * mx;
  const r = y.map((yy, i) => yy - (a + b * x[i]));
  const k = Math.min(20, Math.floor(n / 3));
  const early = r.slice(0, k),
    recent = r.slice(-k);
  const diff = median(early) - median(recent); // > 0: faster now
  // Permutation test with a fixed seed, so the number does not jump each time the statistics are opened
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pool = early.concat(recent);
  let hits = 0;
  const N = 400;
  for (let t = 0; t < N; t++) {
    const p = pool.slice();
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    if (Math.abs(median(p.slice(0, k)) - median(p.slice(k))) >= Math.abs(diff) - 1e-12) hits++;
  }
  const pval = hits / N;
  // Moving form: the median of the latest 9 puzzles (index 100 = your normal for the grade's time)
  const roll = r.map((_, i) => (i < 4 ? null : median(r.slice(Math.max(0, i - 8), i + 1))));
  return {
    n,
    k,
    a,
    b,
    games: sg,
    r,
    roll,
    diff,
    pval,
    pct: Math.round(100 * (Math.exp(diff) - 1)),
    steps: diff / b,
    from: sg[0].end,
    fromRecent: sg[n - k].end,
  };
}

// Week by week: games, speed relative to the grade, errors, hints and the hardest solved puzzle
function progressWeeks(list, pd) {
  const rOf = {};
  if (pd && pd.games) pd.games.forEach((g, i) => (rOf[g.id] = pd.r[i]));
  const wk = {};
  list.forEach((g) => {
    const d = new Date(g.end),
      mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = dayKey(mon),
      w = (wk[k] = wk[k] || { k, n: 0, won: 0, hints: 0, r: [], moves: 0, err: 0, top: 0 });
    w.n++;
    if (g.solved) w.won++;
    if (g.hints) w.hints++;
    if (rOf[g.id] !== undefined) w.r.push(rOf[g.id]);
    if (g.route && g.route.n) {
      w.moves += g.route.n;
      w.err += g.route.wrong || 0;
    }
    if (g.solved && !g.hints) w.top = Math.max(w.top, gradeFor(g));
  });
  return Object.values(wk)
    .sort((p, q) => (p.k < q.k ? 1 : -1))
    .map((w) => ({
      ...w,
      speed: w.r.length >= 2 ? Math.round(100 * Math.exp(-median(w.r))) : null,
      errRate: w.moves >= 20 ? (100 * w.err) / w.moves : null,
    }));
}

// Technique speed in context: each move is measured against your normal time for exactly that technique when there were just as many places
// to find it (your personal time curve, calib.js). A pair that was the only move on the board is thus compared with
// other pairs that were the only move. Index 100 = your normal; above 100 = faster. Singles and techniques are kept
// apart, because singles would otherwise take up almost everything.
function progressMoves(list) {
  const cal = myCal();
  const mv = [];
  list.forEach((g) => {
    if (!g.route || !g.route.ctx) return;
    g.route.ctx.forEach(([L, ds, n]) => mv.push({ L, end: g.end, res: Math.log(Math.max(0.5, ds / 10)) - Math.log(calTime(cal, L, n, true)) }));
  });
  const part = (arr, B) => {
    if (arr.length < 3 * B) return null;
    const mid = median(arr.map((m) => m.res)); // your normal = 100
    const blocks = [];
    for (let i = 0; i + B <= arr.length; i += B) {
      const bl = arr.slice(i, i + B);
      blocks.push({ v: Math.round(100 * Math.exp(-(median(bl.map((m) => m.res)) - mid))), from: bl[0].end, to: bl[B - 1].end });
    }
    const k = Math.min(Math.floor(arr.length / 3), 4 * B);
    const first = arr.slice(0, k).map((m) => m.res),
      last = arr.slice(-k).map((m) => m.res);
    const d = median(first) - median(last);
    let seed = 99,
      hits = 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pool = first.concat(last);
    for (let t = 0; t < 300; t++) {
      const p = pool.slice();
      for (let i = p.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
      }
      if (Math.abs(median(p.slice(0, k)) - median(p.slice(k))) >= Math.abs(d) - 1e-12) hits++;
    }
    return { n: arr.length, B, k, blocks, pct: Math.round(100 * (Math.exp(d) - 1)), p: hits / 300, mid };
  };
  const tech = mv.filter((m) => m.L >= 2),
    one = mv.filter((m) => m.L === 1);
  const T = part(tech, Math.max(15, Math.ceil(tech.length / 12)));
  // Per technique: your latest moves with the technique against your earlier ones (only with at least 10 in each half)
  const per = [];
  if (T)
    for (let L = 2; L <= 11; L++) {
      const a = tech.filter((m) => m.L === L);
      if (a.length < 20) continue;
      const h = Math.floor(a.length / 2);
      const i1 = Math.round(100 * Math.exp(-(median(a.slice(0, h).map((m) => m.res)) - T.mid))),
        i2 = Math.round(100 * Math.exp(-(median(a.slice(h).map((m) => m.res)) - T.mid)));
      per.push({ L, n: a.length, i1, i2 });
    }
  return { tech: T, one: part(one, Math.max(100, Math.ceil(one.length / 10))), per, games: list.filter((g) => g.route && g.route.ctx).length };
}
function verdictTxt(x) {
  if (!x || x.p >= 0.15 || Math.abs(x.pct) < 5) return tr("no clear change");
  return x.pct > 0 ? tr("{p}% faster than at the start", { p: x.pct }) : tr("{p}% slower than at the start", { p: -x.pct });
}
function blockChart(x) {
  const W = 320,
    H = 120,
    L = 30,
    R = 10,
    T = 8,
    B = 18;
  const vals = x.blocks.map((b) => b.v);
  const lo = Math.min(...vals) < 50 ? 25 : 50,
    hi = Math.max(...vals) > 200 ? 400 : 200;
  const ly = (v) => Math.log(Math.max(lo, Math.min(hi, v)));
  const xx = (i) => L + (vals.length === 1 ? 0 : (i * (W - L - R)) / (vals.length - 1));
  const y = (v) => T + (H - T - B) * (1 - (ly(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)));
  const df = (s) => new Date(s).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tr("Technique speed in context over time"))}">`;
  [lo, 50, 100, 200, hi]
    .filter((v, i, a) => a.indexOf(v) === i)
    .forEach((v) => {
      s +=
        `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 100 ? "var(--mute)" : "var(--grid)"}" stroke-width="1"${v === 100 ? ' stroke-dasharray="4 3"' : ""}/>` +
        `<text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${v}</text>`;
    });
  s += `<polyline points="${vals.map((v, i) => xx(i) + "," + y(v)).join(" ")}" fill="none" stroke="var(--indigo)" stroke-width="2.5" stroke-linejoin="round"/>`;
  x.blocks.forEach((b, i) => {
    s +=
      `<circle cx="${xx(i)}" cy="${y(b.v)}" r="3.5" fill="var(--indigo)"/>` +
      `<circle cx="${xx(i)}" cy="${y(b.v)}" r="10" fill="transparent" data-tip="${esc(tr("{n} moves, {a} to {b}: index {v}", { n: x.B, a: df(b.from), b: df(b.to), v: b.v }))}"/>`;
  });
  s += `<text x="${L}" y="${H - 3}" font-size="10" fill="var(--mute)">${df(x.blocks[0].from)}</text><text x="${W - R}" y="${H - 3}" font-size="10" text-anchor="end" fill="var(--mute)">${df(x.blocks[x.blocks.length - 1].to)}</text></svg>`;
  return s;
}

function progressHeadline(pd) {
  if (pd.few !== undefined)
    return tr("After {n} puzzles solved without hints, the app can tell whether you are improving ({have} so far).", { n: PROG_MIN, have: pd.few });
  const sure = pd.pval < 0.05 ? 2 : pd.pval < 0.15 ? 1 : 0;
  const pct = Math.abs(pd.pct),
    steps = dec(Math.abs(pd.steps));
  if (!sure || pct < 5)
    return tr("No clear change yet. The difference ({pct}%) is within the normal variation from puzzle to puzzle.", { pct: pd.pct > 0 ? "+" + pd.pct : pd.pct });
  const certain = sure === 2 ? tr("That is clear.") : tr("That is likely, but not certain yet.");
  return pd.diff > 0
    ? tr("You have become about {pct}% faster on puzzles of the same difficulty. That is like handling puzzles about {steps} grade harder in the same time.", { pct, steps }) + " " + certain
    : tr("You are about {pct}% slower than at the start on puzzles of the same difficulty.", { pct }) + " " + certain;
}

function progressChart(pd) {
  const W = 320,
    H = 150,
    L = 30,
    R = 10,
    T = 10,
    B = 20;
  const idx = (r) => 100 * Math.exp(-r); // 100 = normal for the grade's time, 130 = 30 % faster
  const vals = pd.r.map(idx);
  const lo = Math.min(...vals) < 50 ? 25 : 50,
    hi = Math.max(...vals) > 200 ? 400 : 200;
  const ly = (v) => Math.log(Math.max(lo, Math.min(hi, v)));
  const x = (i) => L + (pd.n === 1 ? 0 : (i * (W - L - R)) / (pd.n - 1));
  const y = (v) => T + (H - T - B) * (1 - (ly(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)));
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tr("Your speed over time relative to difficulty"))}">`;
  [lo, 50, 100, 200, hi].filter((v, i, a) => a.indexOf(v) === i).forEach((v) => {
    s +=
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 100 ? "var(--mute)" : "var(--grid)"}" stroke-width="1"${v === 100 ? ' stroke-dasharray="4 3"' : ""}/>` +
      `<text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${v}</text>`;
  });
  // The two periods being compared
  s +=
    `<rect x="${x(0)}" y="${T}" width="${x(pd.k - 1) - x(0)}" height="${H - T - B}" fill="var(--chip)" opacity="0.7"/>` +
    `<rect x="${x(pd.n - pd.k)}" y="${T}" width="${x(pd.n - 1) - x(pd.n - pd.k)}" height="${H - T - B}" fill="var(--chip)" opacity="0.7"/>`;
  const first = Math.max(0, pd.n - 300); // at most 300 dots; the moving line and the comparison use all of them
  pd.games.forEach((g, i) => {
    if (i < first) return;
    const d = new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    const tip = `${d}: ${BAND[gBand(g)]} ${dec(gradeFor(g))} · ${fmt(g.ms)} · ${tr("index {v}", { v: Math.round(vals[i]) })}`;
    s +=
      `<circle cx="${x(i)}" cy="${y(vals[i])}" r="3" fill="var(--indigo)" opacity="0.35"/>` +
      `<circle cx="${x(i)}" cy="${y(vals[i])}" r="9" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  const pts = pd.roll.map((v, i) => (v == null ? null : x(i) + "," + y(idx(v)))).filter(Boolean);
  if (pts.length > 1) s += `<polyline points="${pts.join(" ")}" fill="none" stroke="var(--indigo)" stroke-width="2.5" stroke-linejoin="round"/>`;
  const d0 = new Date(pd.games[0].end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" }),
    d1 = new Date(pd.games[pd.n - 1].end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  s += `<text x="${L}" y="${H - 4}" font-size="10" fill="var(--mute)">${d0}</text><text x="${W - R}" y="${H - 4}" font-size="10" text-anchor="end" fill="var(--mute)">${d1}</text></svg>`;
  s += `<div class="legendrow"><i style="background:var(--indigo);border-radius:2px;height:3px"></i> ${tr("rolling (9 puzzles)")} &nbsp; <i style="background:var(--chip)"></i> ${tr("periods compared")}</div>`;
  return s;
}

function progressPanel() {
  const pd = progressData();
  let html = `<div class="panelcard progress"><h3>${tr("Progress")}</h3><p class="prohead">${progressHeadline(pd)}</p>`;
  if (pd.few === undefined)
    html +=
      `<p>${tr("Index 100 is your normal time for a puzzle's grade. Above 100 is faster, below 100 slower.")}</p>` +
      progressChart(pd) +
      `<p class="caveat">${tr("Compares your first {k} and latest {k} puzzles solved without hints. Each puzzle is measured against what its grade usually costs you per empty cell, so a harder puzzle does not look like slower play. Replayed puzzles are not counted.", { k: pd.k })}</p>`;
  html += `</div>`;

  // Week by week
  const weeks = progressWeeks(games, pd.few === undefined ? pd : null).slice(0, 8);
  if (weeks.length) {
    const dfmt = (k) => new Date(k + "T12:00:00").toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    html +=
      `<div class="panelcard"><h3>${tr("Week by week")}</h3><p>${tr("Newest week first. Speed is the index above for the week's puzzles without hints.")}</p>` +
      `<table class="data wk"><tr><th>${tr("Week of")}</th><th>${tr("Games")}</th><th>${tr("Speed")}</th><th>${tr("Errors/100")}</th><th>${tr("Hardest")}</th></tr>` +
      weeks
        .map((w) => {
          const sp = w.speed == null ? "–" : `<b style="color:${w.speed >= 110 ? "var(--indigo)" : w.speed <= 90 ? "var(--bad)" : "var(--ink)"}">${w.speed}</b>`;
          return (
            `<tr><td>${dfmt(w.k)}</td><td>${w.won}${w.n > w.won ? `<small> / ${w.n}</small>` : ""}${w.hints ? `<br><small style="color:var(--mute)">${w.hints === 1 ? tr("1 with hints") : tr("{n} with hints", { n: w.hints })}</small>` : ""}</td>` +
            `<td>${sp}</td><td>${w.errRate == null ? "–" : dec(w.errRate)}</td><td>${w.top ? dec(w.top) : "–"}</td></tr>`
          );
        })
        .join("") +
      `</table><p class="caveat" style="margin-top:4px!important">${tr("Games: solved (/ played). Errors per 100 moves count only first errors, not follow-on errors or mistaps. – means too few games that week.")}</p></div>`;
  }

  // Technique speed in context
  const pm = progressMoves(games);
  html += `<div class="panelcard"><h3>${tr("Technique speed in context")}</h3><p>${tr("Each move is measured against your normal time for the same technique when there were as many places to find it. So a pair that was the only move on the board does not count as slow just because it was hard to spot. 100 is your normal, above 100 is faster.")}</p>`;
  if (!pm.tech)
    html += `<p class="caveat">${tr("There are too few technique moves yet ({n} games with data). It will come as you play.", { n: pm.games })}</p>`;
  else {
    html +=
      `<p class="prohead">${tr("Techniques: {v}.", { v: verdictTxt(pm.tech) })}${pm.one ? " " + tr("Easy numbers: {v}.", { v: verdictTxt(pm.one) }) : ""}</p>` +
      blockChart(pm.tech) +
      `<div class="legendrow">${tr("each point: {n} technique moves", { n: pm.tech.B })}</div>`;
    if (pm.per.length)
      html +=
        `<table class="data"><tr><th>${tr("Technique")}</th><th>${tr("Earlier")}</th><th>${tr("Latest")}</th></tr>` +
        pm.per.map((r) => `<tr><td>${esc(LEVEL_TECH[r.L])}<br><small style="color:var(--mute)">${tr("{n} moves in total", { n: r.n })}</small></td><td>${r.i1}</td><td><b>${r.i2}</b></td></tr>`).join("") +
        `</table>`;
    html += `<p class="caveat">${tr("Based on {n} games that saved the context of each move. Techniques with fewer than 20 moves are not shown separately.", { n: pm.games })}</p>`;
  }
  html += `</div>`;
  return html;
}
// A line for Overview
function progressLine() {
  const pd = progressData();
  return `<div class="panelcard progress"><h3>${tr("Progress")}</h3><p class="prohead">${progressHeadline(pd)}</p>${pd.few === undefined ? `<button class="tablelink" type="button" id="toProgress">${tr("See all progress")}</button>` : ""}</div>`;
}
