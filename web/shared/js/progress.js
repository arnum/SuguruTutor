// Progress: are you getting faster? The charts show it; they do not draw a conclusion.
// Overall: puzzles differ, so each solved puzzle (without hints, not replayed) is measured against what its grade and board size
// usually cost you per empty cell: log(sec. per cell) = a + b * grade + z * log(cells). A bigger board costs more per cell at
// the same grade (more to scan for every number), so without the size a spell of small boards looked like progress. b and z
// are measured inside blocks of puzzles played at the same time, so getting faster while moving to harder grades or other
// sizes does not hide in them. The deviation (the residual) is your speed in that
// puzzle; index 100 = your usual (median) speed for the grade over all your puzzles. New puzzles shift the whole line a little,
// never its shape.
// Each point is the median of a block, counted back from the newest, so the last point is always your latest block.
// The faded band around a point says how sure the median is: ±1.4 standard errors of the median, from the spread inside the block.
// Two bands that do not overlap therefore differ by more than chance (about 5 %).
// Techniques: the same, per technique, with each move measured against your time curve (calib.js) fitted to all your moves.
// Not the curve from your latest games: that one follows you, so a technique you get faster at would drift back to 100.

const PROG_MIN = 12; // this many clean solutions before the chart is drawn
const SE_MED = 1.2533; // standard error of a median = 1.2533 * sd / sqrt(n)
const BAND_Z = 1.4; // two such bands that do not overlap differ at about the 5 % level

// Blocks of B, counted back from the newest. A left-over oldest block is kept if it holds at least half a block.
// vals: residuals in log units (positive = slower), ends: the matching dates.
function progBlocks(vals, ends, B) {
  const n = vals.length,
    out = [],
    rest = n % B;
  const make = (i0, i1) => {
    const s = vals.slice(i0, i1),
      k = s.length,
      mu = s.reduce((a, x) => a + x, 0) / k,
      sd = k > 1 ? Math.sqrt(s.reduce((a, x) => a + (x - mu) ** 2, 0) / (k - 1)) : 0;
    out.push({ med: median(s), se: (SE_MED * sd) / Math.sqrt(k), n: k, from: ends[i0], to: ends[i1 - 1] });
  };
  if (rest && rest >= B / 2) make(0, rest);
  for (let i = rest; i + B <= n; i += B) make(i, i + B);
  return out;
}
// Residual (log units, positive = slower) to index (100 = your usual, above = faster)
const progIdx = (r, mid) => 100 * Math.exp(-(r - mid));
function progIndexBlocks(blocks, mid) {
  return blocks.map((b) => ({ ...b, v: progIdx(b.med, mid), lo: progIdx(b.med + BAND_Z * b.se, mid), hi: progIdx(b.med - BAND_Z * b.se, mid) }));
}

function progressData(list = games) {
  const sg = list.filter((g) => g.solved && !g.hints && !g.replay && g.empty > 0 && g.ms > 0 && g.value);
  if (sg.length < PROG_MIN) return { few: sg.length };
  const n = sg.length,
    x = sg.map(gradeFor),
    z = sg.map((g) => Math.log((g.rows * g.cols) / 36)),
    y = sg.map((g) => Math.log(g.ms / 1000 / g.empty));
  const B = n >= 60 ? Math.max(20, Math.ceil(n / 15)) : Math.max(4, Math.floor(n / 3));
  // The grade and size slopes within blocks: each block is compared with itself, so a change in speed over time does not enter them
  const blockOf = (i) => Math.floor((i - (n % B)) / B);
  const grp = {};
  sg.forEach((_, i) => (grp[blockOf(i)] = grp[blockOf(i)] || []).push(i));
  let xx = 0,
    xz = 0,
    zz = 0,
    xy = 0,
    zy = 0;
  Object.values(grp).forEach((ix) => {
    const m = (v) => ix.reduce((a, i) => a + v[i], 0) / ix.length,
      mx = m(x),
      mz = m(z),
      my = m(y);
    ix.forEach((i) => {
      const dx = x[i] - mx,
        dz = z[i] - mz,
        dy = y[i] - my;
      xx += dx * dx;
      xz += dx * dz;
      zz += dz * dz;
      xy += dx * dy;
      zy += dz * dy;
    });
  });
  // Too little spread in the sizes within blocks: the size slope from one player's games (0.8: a 7×7 costs 2.4 times a 4×4
  // per empty cell at the same grade). Too little spread in the grades: the typical 1.5 times per grade.
  const Z_PRIOR = 0.8,
    zW = 2; // the prior counts as this much size spread
  const det = xx * (zz + zW) - xz * xz;
  let b = det > 1e-9 ? ((zz + zW) * xy - xz * (zy + zW * Z_PRIOR)) / det : 0,
    zs = det > 1e-9 ? (xx * (zy + zW * Z_PRIOR) - xz * xy) / det : Z_PRIOR;
  if (!(b > 0.1)) {
    b = Math.log(1.5);
    zs = (zy - b * xz + zW * Z_PRIOR) / (zz + zW);
  }
  const a = y.reduce((s, yy, i) => s + yy - b * x[i] - zs * z[i], 0) / n;
  const r = y.map((yy, i) => yy - (a + b * x[i] + zs * z[i]));
  const mid = median(r);
  const blocks = progIndexBlocks(
    progBlocks(
      r,
      sg.map((g) => g.end),
      B,
    ),
    mid,
  );
  return { n, B, a, b, z: zs, mid, r, games: sg, blocks, perGrade: Math.exp(b), per7x7: Math.exp(zs * Math.log(49 / 16)) };
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
      speed: w.r.length >= 2 ? Math.round(progIdx(median(w.r), pd.mid)) : null,
      errRate: w.moves >= 20 ? (100 * w.err) / w.moves : null,
    }));
}

// Technique speed: each move is measured against your usual time for exactly that technique when there were just as many places
// to find it. A pair that was the only move on the board is thus compared with other pairs that were the only move.
// The curve is fitted to all your moves; 100 = your usual (median) for the technique.
let PROG_CAL = null;
function progressMoves(list) {
  const key = list.length + ":" + (list.length ? list[list.length - 1].id : "");
  if (!PROG_CAL || PROG_CAL.key !== key) {
    PROG_CAL = fitCalib(calibRows(list));
    PROG_CAL.key = key;
  }
  const cal = PROG_CAL,
    mv = {};
  let withCtx = 0;
  list.forEach((g) => {
    if (!g.route || !g.route.ctx) return;
    withCtx++;
    g.route.ctx.forEach(([L, ds, n]) => {
      if (!TT.known(L) || !(ds > 0)) return;
      (mv[L] = mv[L] || []).push({ r: Math.log(Math.max(0.5, ds / 10)) - Math.log(calTime(cal, L, n, false, g.rows * g.cols)), end: g.end });
    });
  });
  const rows = [],
    few = [];
  Object.keys(mv)
    .map(Number)
    .sort(TT.order)
    .forEach((L) => {
      const a = mv[L],
        base = L === TT.SINGLES ? 150 : 20,
        min = L === TT.SINGLES ? 50 : 10;
      if (a.length < 2 * min) return few.push({ L, n: a.length, need: 2 * min });
      const B = Math.max(min, Math.min(base, Math.floor(a.length / 3)), Math.ceil(a.length / 15));
      const res = a.map((m) => m.r),
        mid = median(res);
      rows.push({
        L,
        n: a.length,
        B,
        blocks: progIndexBlocks(
          progBlocks(
            res,
            a.map((m) => m.end),
            B,
          ),
          mid,
        ),
      });
    });
  return { rows, few, games: withCtx };
}

// The chart: one point per block, a faded band for how sure it is, a dashed line at 100. Log scale, so 50 and 200 are as far from 100.
function bandChart(blocks, o) {
  const W = 320,
    H = o.small ? 92 : 150,
    L = 30,
    R = 36,
    T = 8,
    B = 18;
  const lo = Math.max(20, Math.min(80, ...blocks.map((b) => b.lo)) * 0.95),
    hi = Math.min(500, Math.max(125, ...blocks.map((b) => b.hi)) * 1.05);
  const ly = (v) => Math.log(Math.max(lo, Math.min(hi, v)));
  const xx = (i) => L + (blocks.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (blocks.length - 1));
  const y = (v) => T + (H - T - B) * (1 - (ly(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)));
  const df = (s) => new Date(s).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  let ticks = [25, 50, 67, 80, 100, 125, 150, 200, 300, 400].filter((v) => v >= lo && v <= hi);
  if (ticks.length > (o.small ? 3 : 5)) ticks = [ticks[0], 100, ticks[ticks.length - 1]].filter((v, i, a) => a.indexOf(v) === i);
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)}">`;
  ticks.forEach((v) => {
    s +=
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 100 ? "var(--mute)" : "var(--grid)"}" stroke-width="1"${v === 100 ? ' stroke-dasharray="4 3"' : ""}/>` +
      `<text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${v}</text>`;
  });
  // The band: through the upper ends, back through the lower ends
  const half = blocks.length === 1 ? 10 : 0;
  const up = blocks.map((b, i) => xx(i) - half + "," + y(b.hi)),
    down = blocks.map((b, i) => xx(i) + half + "," + y(b.lo)).reverse();
  if (half) up.push(xx(0) + half + "," + y(blocks[0].hi)), down.push(xx(0) - half + "," + y(blocks[0].lo));
  s += `<polygon class="band" points="${up.concat(down).join(" ")}" fill="var(--indigo)" opacity="0.14"/>`;
  if (blocks.length > 1) s += `<polyline points="${blocks.map((b, i) => xx(i) + "," + y(b.v)).join(" ")}" fill="none" stroke="var(--indigo)" stroke-width="2" stroke-linejoin="round"/>`;
  blocks.forEach((b, i) => {
    const tip = tr("{n} {what}, {a} to {b}: index {v}, likely {lo}–{hi}", {
      n: b.n,
      what: o.unit,
      a: df(b.from),
      b: df(b.to),
      v: Math.round(b.v),
      lo: Math.round(b.lo),
      hi: Math.round(b.hi),
    });
    s += `<circle cx="${xx(i)}" cy="${y(b.v)}" r="3.5" fill="var(--indigo)"/>` + `<circle cx="${xx(i)}" cy="${y(b.v)}" r="11" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  const last = blocks[blocks.length - 1];
  s += `<text class="lastv" x="${xx(blocks.length - 1) + 7}" y="${y(last.v) + 4}" font-size="11" font-weight="600" fill="var(--ink)">${Math.round(last.v)}</text>`;
  s += `<text x="${L}" y="${H - 4}" font-size="10" fill="var(--mute)">${df(blocks[0].from)}</text><text x="${W - R}" y="${H - 4}" font-size="10" text-anchor="end" fill="var(--mute)">${df(last.to)}</text></svg>`;
  return s;
}
const bandLegend = (each) =>
  `<div class="legendrow"><i style="background:var(--indigo);border-radius:2px;height:3px"></i> ${esc(each)} &nbsp; <i style="background:var(--indigo);opacity:.18"></i> ${tr("how sure")}</div>`;

function progressChartHtml(pd) {
  return (
    `<p>${tr("Index 100 is your usual speed for a puzzle's grade. 110 is 10% faster, 90 is 10% slower.")}</p>` +
    bandChart(pd.blocks, { unit: tr("puzzles"), label: tr("Your speed over time relative to difficulty") }) +
    bandLegend(tr("each point: {n} puzzles", { n: pd.B }))
  );
}
const progressFew = (pd) => `<p>${tr("After {n} puzzles solved without hints, the progress chart appears ({have} so far).", { n: PROG_MIN, have: pd.few })}</p>`;

function progressPanel() {
  const pd = progressData();
  let html = `<div class="panelcard progress"><h3>${tr("Progress")}</h3>`;
  if (pd.few !== undefined) html += progressFew(pd);
  else
    html +=
      progressChartHtml(pd) +
      `<p>${tr("Faded band: how sure each point is. Bands that do not overlap differ by more than chance.")}</p>` +
      `<p class="caveat">${tr(
        "Each puzzle solved without hints is measured against what its grade and board size usually cost you per empty cell, fitted to all your puzzles. For you, one grade harder takes {x} times as long, and a 7×7 takes {y} times as long per cell as a 4×4. Both are measured within blocks of puzzles played at the same time, so getting faster does not hide in them. New puzzles move the whole line a little, never its shape. Replayed puzzles are not counted.",
        { x: dec(pd.perGrade), y: dec(pd.per7x7) },
      )}</p>`;
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
          const sp = w.speed == null ? "–" : `<b>${w.speed}</b>`;
          return (
            `<tr><td>${dfmt(w.k)}</td><td>${w.won}${w.n > w.won ? `<small> / ${w.n}</small>` : ""}${w.hints ? `<br><small style="color:var(--mute)">${w.hints === 1 ? tr("1 with hints") : tr("{n} with hints", { n: w.hints })}</small>` : ""}</td>` +
            `<td>${sp}</td><td>${w.errRate == null ? "–" : dec(w.errRate)}</td><td>${w.top ? dec(w.top) : "–"}</td></tr>`
          );
        })
        .join("") +
      `</table><p class="caveat" style="margin-top:4px!important">${tr("Games: solved (/ played). Errors per 100 moves count only first errors, not follow-on errors or mistaps. – means too few games that week.")}</p></div>`;
  }

  // Technique speed
  const pm = progressMoves(games);
  html += `<div class="panelcard techprog"><h3>${tr("Technique speed")}</h3><p>${tr("Index 100 is your usual speed with each technique. Above 100 is faster.")}</p>`;
  if (!pm.rows.length && !pm.few.length) html += `<p class="caveat">${tr("There are too few technique moves yet ({n} games with data). It will come as you play.", { n: pm.games })}</p>`;
  else {
    pm.rows.forEach((t) => {
      html +=
        `<div class="techrow"><div class="trh"><b>${esc(cap(LEVEL_TECH[t.L]))}</b><small>${tr("{n} moves, {b} per point", { n: t.n, b: t.B })}</small></div>` +
        bandChart(t.blocks, { small: true, unit: tr("moves"), label: cap(LEVEL_TECH[t.L]) }) +
        `</div>`;
    });
    if (pm.few.length)
      html += `<p class="techfew">${tr("Too few moves for a line yet: {list}.", { list: pm.few.map((f) => tr("{tech} {n} of {need}", { tech: LEVEL_TECH[f.L], n: f.n, need: f.need })).join(", ") })}</p>`;
    html += `<p class="caveat">${tr("Each move is measured against your usual time for the same technique when there were as many places to find it. The time curve is fitted to all your moves, so a technique you get faster at does not drift back to 100. Based on {n} games that saved the context of each move.", { n: pm.games })}</p>`;
  }
  html += `</div>`;
  return html;
}
// The chart on Overview
function progressLine() {
  const pd = progressData();
  return (
    `<div class="panelcard progress"><h3>${tr("Progress")}</h3>` +
    (pd.few !== undefined ? progressFew(pd) : progressChartHtml(pd) + `<button class="tablelink" type="button" id="toProgress">${tr("See all progress")}</button>`) +
    `</div>`
  );
}
