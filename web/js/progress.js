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
  const x = sg.map((g) => +g.value),
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
    tech: progressTech(list),
    acc: progressAcc(list),
    top: progressTop(sg),
  };
}

// Tid pr. teknik: første halvdel af spillene med ruteanalyse mod anden halvdel
function progressTech(list) {
  const rg = list.filter((g) => g.route && g.route.times);
  if (rg.length < 8) return [];
  const half = Math.floor(rg.length / 2),
    A = {},
    B = {};
  rg.forEach((g, i) => {
    const t = g.route.times,
      tgt = i < half ? A : B;
    for (const L in t) (tgt[L] = tgt[L] || []).push(...t[L]);
  });
  const out = [];
  for (let L = 1; L <= 11; L++) {
    if (!A[L] || !B[L] || A[L].length < 6 || B[L].length < 6) continue;
    const m1 = Math.max(0.5, median(A[L])),
      m2 = Math.max(0.5, median(B[L]));
    // Få træk eller små ændringer siges der ikke noget om
    const sure = A[L].length >= 15 && B[L].length >= 15;
    out.push({ L, m1, m2, n1: A[L].length, n2: B[L].length, ratio: m2 / m1, sure });
  }
  return out;
}
// Fejl, hints og den letteste rute: første mod seneste spil
function progressAcc(list) {
  const rg = list.filter((g) => g.route && g.route.n >= 8);
  if (rg.length < 8) return null;
  const k = Math.min(20, Math.floor(rg.length / 2));
  const part = (arr) => {
    const moves = arr.reduce((s, g) => s + g.route.n, 0);
    return {
      err: (100 * arr.reduce((s, g) => s + (g.route.wrong || 0), 0)) / moves,
      easy: (100 * arr.reduce((s, g) => s + (g.route.easy || 0) + (g.route.ahead || 0), 0)) / moves,
      hints: arr.filter((g) => g.hints).length / arr.length,
    };
  };
  return { k, a: part(rg.slice(0, k)), b: part(rg.slice(-k)) };
}
// Den sværeste opgave, du har løst uden hints, uge for uge
function progressTop(sg) {
  const wk = {};
  sg.forEach((g) => {
    const d = new Date(g.end),
      mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = dayKey(mon);
    wk[key] = Math.max(wk[key] || 0, +g.value);
  });
  return Object.entries(wk).sort((p, q) => (p[0] < q[0] ? -1 : 1));
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
  pd.games.forEach((g, i) => {
    const d = new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    const tip = `${d}: ${BAND[gBand(g)]} ${dec(g.value)} · ${fmt(g.ms)} · ${tr("indeks {v}", { v: Math.round(vals[i]) })}`;
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
  const head = `<div class="panelcard progress"><h3>${tr("Fremgang")}</h3><p class="prohead">${progressHeadline(pd)}</p>`;
  if (pd.few !== undefined) return head + `</div>`;
  const dfmt = (s) => new Date(s).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  let html =
    head +
    `<p>${tr("Indeks 100 er din normale tid for en opgaves grad. Over 100 er hurtigere, under 100 langsommere.")}</p>` +
    progressChart(pd);
  // Teknikker
  if (pd.tech.length)
    html +=
      `<h4 class="proh">${tr("Tid pr. teknik: første halvdel mod anden halvdel af dine spil")}</h4><table class="data"><tr><th>${tr("Teknik")}</th><th>${tr("Før")}</th><th>${tr("Nu")}</th><th></th></tr>` +
      pd.tech
        .map((t) => {
          const faster = t.ratio <= 0.9,
            slower = t.ratio >= 1.1;
          const txt = !t.sure
            ? tr("for få træk")
            : faster
              ? tr("{p} % hurtigere", { p: Math.round(100 * (1 - t.ratio)) })
              : slower
                ? t.ratio >= 2
                  ? tr("{x} gange så lang tid", { x: dec(t.ratio) })
                  : tr("{p} % langsommere", { p: Math.round(100 * (t.ratio - 1)) })
                : tr("uændret");
          const col = !t.sure ? "var(--mute)" : faster ? "var(--indigo)" : slower ? "var(--bad)" : "var(--mute)";
          return (
            `<tr><td>${esc(LEVEL_TECH[t.L])}<br><small style="color:var(--mute)">${tr("{a} og {b} træk", { a: t.n1, b: t.n2 })}</small></td>` +
            `<td>${fmtS(t.m1)}</td><td>${fmtS(t.m2)}</td><td style="color:${col}">${txt}</td></tr>`
          );
        })
        .join("") +
      `</table><p class="caveat" style="margin-top:4px!important">${tr("Tiden for en teknik afhænger også af, hvor godt mønsteret var skjult i de opgaver, du fik. Med under 15 træk i hver halvdel vises ingen dom.")}</p>`;
  // Fejl og rute
  if (pd.acc) {
    const A = pd.acc.a,
      Bb = pd.acc.b;
    const row = (label, a, b2, fmtv, betterLow) => {
      const better = betterLow ? b2 < a - 0.05 * Math.max(1, a) : b2 > a + 0.05 * Math.max(1, a);
      const worse = betterLow ? b2 > a + 0.05 * Math.max(1, a) : b2 < a - 0.05 * Math.max(1, a);
      return `<tr><td>${label}</td><td>${fmtv(a)}</td><td>${fmtv(b2)}</td><td style="color:${better ? "var(--indigo)" : worse ? "var(--bad)" : "var(--mute)"}">${better ? tr("bedre") : worse ? tr("dårligere") : tr("uændret")}</td></tr>`;
    };
    html +=
      `<h4 class="proh">${tr("Præcision: dine første {k} mod dine seneste {k} spil", { k: pd.acc.k })}</h4><table class="data"><tr><th></th><th>${tr("Før")}</th><th>${tr("Nu")}</th><th></th></tr>` +
      row(tr("Fejl pr. 100 træk"), A.err, Bb.err, (v) => dec(v), true) +
      row(tr("Letteste træk"), A.easy, Bb.easy, (v) => Math.round(v) + " %", false) +
      row(tr("Spil med hints"), 100 * A.hints, 100 * Bb.hints, (v) => Math.round(v) + " %", true) +
      `</table>`;
  }
  // Sværeste løste pr. uge
  if (pd.top.length >= 2)
    html +=
      `<h4 class="proh">${tr("Sværeste opgave løst uden hints, uge for uge")}</h4><div class="protop">` +
      pd.top.map(([wk, v]) => `<span><b>${dec(v)}</b><small>${tr("uge fra {d}", { d: dfmt(wk + "T12:00:00") })}</small></span>`).join("") +
      `</div>`;
  html +=
    `<p class="caveat">${tr("Sammenligner dine første {k} og seneste {k} løste opgaver uden hints ({a} til {b}). Hver opgave måles mod, hvad dens grad plejer at koste dig pr. tomt felt, så en sværere opgave ikke ligner langsommere spil. Genspillede opgaver tæller ikke med.", { k: pd.k, a: dfmt(pd.from), b: dfmt(pd.games[pd.n - 1].end) })}</p></div>`;
  return html;
}
// En linje til Overblik
function progressLine() {
  const pd = progressData();
  return `<div class="panelcard progress"><h3>${tr("Fremgang")}</h3><p class="prohead">${progressHeadline(pd)}</p>${pd.few === undefined ? `<button class="tablelink" type="button" id="toProgress">${tr("Se hele fremgangen")}</button>` : ""}</div>`;
}
