// Fremgang: er du blevet bedre over tid?
// Opgaverne er forskellige, så rå tid siger ikke meget. Hver løst opgave (uden hints, ikke genspillet) måles derfor mod,
// hvad dens grad plejer at koste dig pr. tomt felt: log(sek. pr. felt) = a + b * grad, tilpasset hele din historik.
// Afvigelsen (residualen) er din form i den opgave: negativ = hurtigere end normalt for den grad.
// Fremgang = dine seneste k opgaver mod dine første k. En permutationstest siger, om forskellen er større end den
// normale variation (opgaver af samme grad svinger meget fra gang til gang).

const PROG_MIN = 12; // så mange rene løsninger, før der siges noget

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
  if (!(b > 0.1)) b = Math.log(1.5); // for lidt spredning i graderne: brug den typiske 1,5x pr. grad
  const a = my - b * mx;
  const r = y.map((yy, i) => yy - (a + b * x[i]));
  const k = Math.min(20, Math.floor(n / 3));
  const early = r.slice(0, k),
    recent = r.slice(-k);
  const diff = median(early) - median(recent); // > 0: hurtigere nu
  // Permutationstest med fast frø, så tallet ikke hopper, hver gang statistikken åbnes
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
  // Glidende form: median af de seneste 9 opgaver (indeks 100 = dit normale for gradens tid)
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

// Uge for uge: spil, fart i forhold til graden, fejl, hints og den sværeste løste opgave
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

// Teknikfart i sammenhæng: hvert træk måles mod din normale tid for netop den teknik, når der var lige så mange steder
// at finde den (din personlige tidskurve, calib.js). Et par, der var det eneste træk på pladen, sammenlignes altså med
// andre par, der var det eneste træk. Indeks 100 = dit normale; over 100 = hurtigere. Enkle tal og teknikker holdes
// adskilt, fordi enkle tal ellers ville fylde næsten alt.
function progressMoves(list) {
  const cal = myCal();
  const mv = [];
  list.forEach((g) => {
    if (!g.route || !g.route.ctx) return;
    g.route.ctx.forEach(([L, ds, n]) => mv.push({ L, end: g.end, res: Math.log(Math.max(0.5, ds / 10)) - Math.log(calTime(cal, L, n, true)) }));
  });
  const part = (arr, B) => {
    if (arr.length < 3 * B) return null;
    const mid = median(arr.map((m) => m.res)); // dit normale = 100
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
  // Pr. teknik: dine seneste træk med teknikken mod dine tidligere (kun med mindst 10 i hver halvdel)
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
  if (!x || x.p >= 0.15 || Math.abs(x.pct) < 5) return tr("ingen klar ændring");
  return x.pct > 0 ? tr("{p} % hurtigere end i starten", { p: x.pct }) : tr("{p} % langsommere end i starten", { p: -x.pct });
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
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tr("Teknikfart i sammenhæng over tid"))}">`;
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
      `<circle cx="${xx(i)}" cy="${y(b.v)}" r="10" fill="transparent" data-tip="${esc(tr("{n} træk, {a} til {b}: indeks {v}", { n: x.B, a: df(b.from), b: df(b.to), v: b.v }))}"/>`;
  });
  s += `<text x="${L}" y="${H - 3}" font-size="10" fill="var(--mute)">${df(x.blocks[0].from)}</text><text x="${W - R}" y="${H - 3}" font-size="10" text-anchor="end" fill="var(--mute)">${df(x.blocks[x.blocks.length - 1].to)}</text></svg>`;
  return s;
}

function progressHeadline(pd) {
  if (pd.few !== undefined)
    return tr("Efter {n} løste opgaver uden hints kan appen se, om du bliver bedre ({have} indtil nu).", { n: PROG_MIN, have: pd.few });
  const sure = pd.pval < 0.05 ? 2 : pd.pval < 0.15 ? 1 : 0;
  const pct = Math.abs(pd.pct),
    steps = dec(Math.abs(pd.steps));
  if (!sure || pct < 5)
    return tr("Ingen klar ændring endnu. Forskellen ({pct} %) er inden for den normale variation fra opgave til opgave.", { pct: pd.pct > 0 ? "+" + pd.pct : pd.pct });
  const certain = sure === 2 ? tr("Det er tydeligt.") : tr("Det er sandsynligt, men ikke sikkert endnu.");
  return pd.diff > 0
    ? tr("Du er blevet ca. {pct} % hurtigere på opgaver af samme sværhed. Det svarer til at klare ca. {steps} grad sværere opgaver på samme tid.", { pct, steps }) + " " + certain
    : tr("Du er ca. {pct} % langsommere end i starten på opgaver af samme sværhed.", { pct }) + " " + certain;
}

function progressChart(pd) {
  const W = 320,
    H = 150,
    L = 30,
    R = 10,
    T = 10,
    B = 20;
  const idx = (r) => 100 * Math.exp(-r); // 100 = normalt for gradens tid, 130 = 30 % hurtigere
  const vals = pd.r.map(idx);
  const lo = Math.min(...vals) < 50 ? 25 : 50,
    hi = Math.max(...vals) > 200 ? 400 : 200;
  const ly = (v) => Math.log(Math.max(lo, Math.min(hi, v)));
  const x = (i) => L + (pd.n === 1 ? 0 : (i * (W - L - R)) / (pd.n - 1));
  const y = (v) => T + (H - T - B) * (1 - (ly(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)));
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tr("Din fart over tid i forhold til sværheden"))}">`;
  [lo, 50, 100, 200, hi].filter((v, i, a) => a.indexOf(v) === i).forEach((v) => {
    s +=
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 100 ? "var(--mute)" : "var(--grid)"}" stroke-width="1"${v === 100 ? ' stroke-dasharray="4 3"' : ""}/>` +
      `<text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${v}</text>`;
  });
  // De to perioder, der sammenlignes
  s +=
    `<rect x="${x(0)}" y="${T}" width="${x(pd.k - 1) - x(0)}" height="${H - T - B}" fill="var(--chip)" opacity="0.7"/>` +
    `<rect x="${x(pd.n - pd.k)}" y="${T}" width="${x(pd.n - 1) - x(pd.n - pd.k)}" height="${H - T - B}" fill="var(--chip)" opacity="0.7"/>`;
  const first = Math.max(0, pd.n - 300); // højst 300 prikker; den glidende linje og sammenligningen bruger alle
  pd.games.forEach((g, i) => {
    if (i < first) return;
    const d = new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    const tip = `${d}: ${BAND[gBand(g)]} ${dec(gradeFor(g))} · ${fmt(g.ms)} · ${tr("indeks {v}", { v: Math.round(vals[i]) })}`;
    s +=
      `<circle cx="${x(i)}" cy="${y(vals[i])}" r="3" fill="var(--indigo)" opacity="0.35"/>` +
      `<circle cx="${x(i)}" cy="${y(vals[i])}" r="9" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  const pts = pd.roll.map((v, i) => (v == null ? null : x(i) + "," + y(idx(v)))).filter(Boolean);
  if (pts.length > 1) s += `<polyline points="${pts.join(" ")}" fill="none" stroke="var(--indigo)" stroke-width="2.5" stroke-linejoin="round"/>`;
  const d0 = new Date(pd.games[0].end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" }),
    d1 = new Date(pd.games[pd.n - 1].end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  s += `<text x="${L}" y="${H - 4}" font-size="10" fill="var(--mute)">${d0}</text><text x="${W - R}" y="${H - 4}" font-size="10" text-anchor="end" fill="var(--mute)">${d1}</text></svg>`;
  s += `<div class="legendrow"><i style="background:var(--indigo);border-radius:2px;height:3px"></i> ${tr("glidende (9 opgaver)")} &nbsp; <i style="background:var(--chip)"></i> ${tr("perioderne, der sammenlignes")}</div>`;
  return s;
}

function progressPanel() {
  const pd = progressData();
  let html = `<div class="panelcard progress"><h3>${tr("Fremgang")}</h3><p class="prohead">${progressHeadline(pd)}</p>`;
  if (pd.few === undefined)
    html +=
      `<p>${tr("Indeks 100 er din normale tid for en opgaves grad. Over 100 er hurtigere, under 100 langsommere.")}</p>` +
      progressChart(pd) +
      `<p class="caveat">${tr("Sammenligner dine første {k} og seneste {k} løste opgaver uden hints. Hver opgave måles mod, hvad dens grad plejer at koste dig pr. tomt felt, så en sværere opgave ikke ligner langsommere spil. Genspillede opgaver tæller ikke med.", { k: pd.k })}</p>`;
  html += `</div>`;

  // Uge for uge
  const weeks = progressWeeks(games, pd.few === undefined ? pd : null).slice(0, 8);
  if (weeks.length) {
    const dfmt = (k) => new Date(k + "T12:00:00").toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    html +=
      `<div class="panelcard"><h3>${tr("Uge for uge")}</h3><p>${tr("Nyeste uge øverst. Fart er indekset ovenfor for ugens opgaver uden hints.")}</p>` +
      `<table class="data wk"><tr><th>${tr("Uge fra")}</th><th>${tr("Spil")}</th><th>${tr("Fart")}</th><th>${tr("Fejl/100")}</th><th>${tr("Sværeste")}</th></tr>` +
      weeks
        .map((w) => {
          const sp = w.speed == null ? "–" : `<b style="color:${w.speed >= 110 ? "var(--indigo)" : w.speed <= 90 ? "var(--bad)" : "var(--ink)"}">${w.speed}</b>`;
          return (
            `<tr><td>${dfmt(w.k)}</td><td>${w.won}${w.n > w.won ? `<small> / ${w.n}</small>` : ""}${w.hints ? `<br><small style="color:var(--mute)">${w.hints === 1 ? tr("1 med hints") : tr("{n} med hints", { n: w.hints })}</small>` : ""}</td>` +
            `<td>${sp}</td><td>${w.errRate == null ? "–" : dec(w.errRate)}</td><td>${w.top ? dec(w.top) : "–"}</td></tr>`
          );
        })
        .join("") +
      `</table><p class="caveat" style="margin-top:4px!important">${tr("Spil: løste (/ spillede). Fejl pr. 100 træk tæller kun første fejl, ikke følgefejl eller fejltryk. – betyder for få spil den uge.")}</p></div>`;
  }

  // Teknikfart i sammenhæng
  const pm = progressMoves(games);
  html += `<div class="panelcard"><h3>${tr("Teknikfart i sammenhæng")}</h3><p>${tr("Hvert træk måles mod din normale tid for samme teknik, når der var lige så mange steder at finde den. Så tæller et par, der var det eneste træk på pladen, ikke som langsomt, bare fordi det var svært at få øje på. 100 er dit normale, over 100 er hurtigere.")}</p>`;
  if (!pm.tech)
    html += `<p class="caveat">${tr("Der er endnu for få træk med teknikker ({n} spil med data). Det kommer, efterhånden som du spiller.", { n: pm.games })}</p>`;
  else {
    html +=
      `<p class="prohead">${tr("Teknikker: {v}.", { v: verdictTxt(pm.tech) })}${pm.one ? " " + tr("Enkle tal: {v}.", { v: verdictTxt(pm.one) }) : ""}</p>` +
      blockChart(pm.tech) +
      `<div class="legendrow">${tr("hvert punkt: {n} træk med teknikker", { n: pm.tech.B })}</div>`;
    if (pm.per.length)
      html +=
        `<table class="data"><tr><th>${tr("Teknik")}</th><th>${tr("Tidligere")}</th><th>${tr("Senest")}</th></tr>` +
        pm.per.map((r) => `<tr><td>${esc(LEVEL_TECH[r.L])}<br><small style="color:var(--mute)">${tr("{n} træk i alt", { n: r.n })}</small></td><td>${r.i1}</td><td><b>${r.i2}</b></td></tr>`).join("") +
        `</table>`;
    html += `<p class="caveat">${tr("Bygger på {n} spil, der har gemt sammenhængen for hvert træk. Teknikker med under 20 træk vises ikke enkeltvis.", { n: pm.games })}</p>`;
  }
  html += `</div>`;
  return html;
}
// En linje til Overblik
function progressLine() {
  const pd = progressData();
  return `<div class="panelcard progress"><h3>${tr("Fremgang")}</h3><p class="prohead">${progressHeadline(pd)}</p>${pd.few === undefined ? `<button class="tablelink" type="button" id="toProgress">${tr("Se hele fremgangen")}</button>` : ""}</div>`;
}
