// Personlig tidskurve: hvor lang tid tager et træk dig, ud fra hvilken teknik det krævede og hvor mange steder der var at finde det.
//   tid ≈ a · L^k · n^b      (L = teknikniveau 1–11, n = antal mulige træk på det niveau)
// a, k og b tilpasses dine egne træk. Startværdierne (priors) kommer fra én rigtig spillers 838 træk (nov. 2026), så kurven
// er fornuftig fra første spil og flytter sig mod dine egne tal, efterhånden som der kommer data.
// Oven på kurven får hver teknik sin egen afvigelse (r), dæmpet når der er få træk. Afvigelsen er det, fokusområdet viser.

const CAL_PRIOR = { c: Math.log(3.1), k: 2.0, b: -0.31 };
const CAL_STRENGTH = { c: 3, k: 25, b: 25 }; // hvor mange "træk" priors svarer til
const CAL_SHRINK = 4; // en teknik med n træk får n/(n+4) af sin målte afvigelse

// Træk, der kan bruges til kurven: tidsat, ikke hint, ikke fejl og ikke sat mens en fejl stod på pladen
function calibRows(gs) {
  const rows = [];
  gs.forEach((g) => {
    if (!g.moves) return;
    markErrors(g.moves);
    g.moves.forEach((m) => {
      if (!judged(m) || m.cls === "wrong" || m.cls === "hint" || !(m.dt > 0)) return;
      const L = moveLevel(m);
      if (!L || L > 11) return;
      rows.push({ L, y: Math.log(Math.max(0.5, m.dt / 1000)), ln: Math.log(Math.max(1, m.nAvail || 1)), dt: m.dt / 1000, one: (m.nAvail || 1) <= 1 });
    });
  });
  return rows;
}

// Mindste kvadraters metode med priors (ridge mod startværdierne)
function fitCalib(rows) {
  const P = [CAL_PRIOR.c, CAL_PRIOR.k, CAL_PRIOR.b],
    lam = [CAL_STRENGTH.c, CAL_STRENGTH.k, CAL_STRENGTH.b];
  const A = [0, 1, 2].map(() => [0, 0, 0, 0]);
  rows.forEach((r) => {
    const x = [1, Math.log(r.L), r.ln];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) A[i][j] += x[i] * x[j];
      A[i][3] += x[i] * r.y;
    }
  });
  // Prior på k og b vægtes med den spredning, de normalt har i data, så "25 træk" betyder det samme for alle tre
  const sx = [1, 0.5, 0.6];
  for (let i = 0; i < 3; i++) {
    const w = lam[i] * sx[i] * sx[i];
    A[i][i] += w;
    A[i][3] += w * P[i];
  }
  for (let i = 0; i < 3; i++)
    for (let r = 0; r < 3; r++)
      if (r !== i) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < 4; c++) A[r][c] -= f * A[i][c];
      }
  const [c, k, b] = A.map((r, i) => r[3] / r[i]);
  const lvl = {};
  rows.forEach((r) => {
    const e = (lvl[r.L] = lvl[r.L] || { n: 0, sum: 0, n1: 0 });
    e.n++;
    if (r.one) e.n1++;
    e.sum += r.y - (c + k * Math.log(r.L) + b * r.ln);
  });
  for (const L in lvl) {
    const e = lvl[L];
    e.raw = e.sum / e.n;
    e.r = e.sum / (e.n + CAL_SHRINK);
  }
  // Spredning: tiderne er skæve (nogle træk tager meget længere end det typiske). Kurven giver det typiske træk (medianen);
  // en sum af mange træk skal bruge gennemsnittet, som er exp(s2/2) gange større. s2 måles for lette (1) og sværere (2+) træk hver for sig.
  const sq = [0, 0, 0, 0];
  rows.forEach((r) => {
    const g = r.L === 1 ? 0 : 2,
      d = r.y - (c + k * Math.log(r.L) + b * r.ln + (lvl[r.L] ? lvl[r.L].r : 0));
    sq[g] += d * d;
    sq[g + 1]++;
  });
  const s2 = (i, prior) => (sq[i] + 10 * prior) / (sq[i + 1] + 10);
  return { c, k, b, lvl, n: rows.length, s2: [s2(0, 0.6), s2(2, 1.3)] };
}

// Forventet tid (sekunder) for et træk på niveau L med n muligheder. own=true lægger din egen afvigelse for teknikken oveni.
function calTime(cal, L, n = 1, own = true) {
  const r = own && cal.lvl[L] ? cal.lvl[L].r : 0;
  return Math.exp(cal.c + cal.k * Math.log(L) + cal.b * Math.log(Math.max(1, n)) + r);
}
// Hvor meget dyrere hvert trin på stigen er (fra niveau L til L+1), som tal at vise
const calStep = (cal, L) => Math.pow((L + 1) / L, cal.k);

// Din kurve ud fra de seneste 60 spil, genberegnet når der kommer nye spil til
let CAL = null;
function myCal() {
  const key = games.length + ":" + (games.length ? games[games.length - 1].id : "");
  if (!CAL || CAL.key !== key) {
    CAL = fitCalib(calibRows(games.slice(-60)));
    CAL.key = key;
  }
  return CAL;
}
// Opgavens skridt i kort form: L*100 + antal muligheder, ét tal pr. tal der skal sættes
function stepCodes(steps) {
  return steps.map((s) => s.L * 100 + Math.min(99, s.opts || 1));
}
// Personligt tidsestimat (sekunder) for en hel opgave: summen af det gennemsnitlige træk for hvert skridt
function estimateSec(cal, lv) {
  if (!cal || !lv || !lv.length) return null;
  return lv.reduce((a, x) => {
    const L = Math.floor(x / 100);
    return a + calTime(cal, L, x % 100) * Math.exp((L === 1 ? cal.s2[0] : cal.s2[1]) / 2);
  }, 0);
}

// Estimat og sammenligning i tekst (bruges i "hvorfor"-arket, efter løsning og i statistikken)
const estFmt = (sec) => fmt(Math.max(10, Math.round(sec / 10) * 10) * 1000);
function estCompare(ms, est) {
  const r = ms / 1000 / est;
  if (r >= 1.15) return tr("Du brugte {x} gange så lang tid.", { x: dec(r) });
  if (r <= 0.87) return tr("Du var hurtigere: {pct} % af estimatet.", { pct: Math.round(100 * r) });
  return tr("Det passede nogenlunde.");
}
function estLineHtml(lv) {
  const cal = myCal(),
    est = estimateSec(cal, lv);
  if (!est) return "";
  return (
    `<p class="estline"><b>${tr("Dit tidsestimat: ca. {t}.", { t: estFmt(est) })}</b> ` +
    tr("Summen af din typiske tid for hvert skridt i opgaven, ud fra {n} af dine træk.", { n: cal.n }) +
    (cal.n < 100 ? " " + tr("Indtil du har spillet lidt mere, bygger det mest på startværdier.") : "") +
    `</p>`
  );
}
// Hvor godt rammer estimatet? Dine seneste løste opgaver med estimat
function estStats(k = 12) {
  const cal = myCal();
  const r = games
    .filter((g) => g.solved && g.lv && g.lv.length)
    .slice(-k)
    .map((g) => g.ms / 1000 / (g.est || estimateSec(cal, g.lv)))
    .filter((x) => isFinite(x) && x > 0)
    .sort((a, b) => a - b);
  if (r.length < 4) return null;
  const q = (p) => r[Math.min(r.length - 1, Math.floor(p * r.length))];
  return { n: r.length, med: q(0.5), lo: q(0.25), hi: q(0.75) };
}

// ---------- Personlig grad: hvordan en opgave sandsynligvis føles for dig
// Ud fra dine løste opgaver uden hints: hvor lang tid pr. tomt felt hver grad plejer at tage dig, og hvor meget opgaver med
// samme sværeste teknik har ligget over eller under deres grad. Afvigelsen dæmpes, når der er få opgaver af den slags.
// Testet på 46 rigtige opgaver (nov. 2026): 0,80 mod 0,72. Fremadrettet test på 40 nye opgaver gav ingen gevinst, så
// afvigelsen dæmpes nu kraftigt (n + 12) og kræver mindst 5 opgaver med samme sværeste teknik.
let PGM = null;
function personalModel() {
  const key = games.length + ":" + (games.length ? games[games.length - 1].id : "");
  if (PGM && PGM.key === key) return PGM.m;
  const hist = games.filter((g) => g.solved && !g.hints && g.empty > 0 && g.ms > 0 && g.value && g.tech).slice(-80);
  let m = null;
  if (hist.length >= 10) {
    const x = hist.map((g) => g.value),
      y = hist.map((g) => Math.log(g.ms / 1000 / g.empty));
    const n = x.length,
      mx = x.reduce((a, b) => a + b) / n,
      my = y.reduce((a, b) => a + b) / n;
    let sxy = 0,
      sxx = 0;
    for (let i = 0; i < n; i++) {
      sxy += (x[i] - mx) * (y[i] - my);
      sxx += (x[i] - mx) ** 2;
    }
    const b = sxx ? sxy / sxx : 0,
      a = my - b * mx;
    if (b >= 0.15) {
      const grp = {};
      hist.forEach((g, i) => {
        const k = Math.min(g.tech, 6),
          e = (grp[k] = grp[k] || { n: 0, sum: 0 });
        e.n++;
        e.sum += (y[i] - a) / b - g.value; // hvor mange grader opgaven føltes over eller under sin grad (målt i tid)
      });
      // Forsigtig: en teknik skal have vist samme mønster i mange opgaver, før den flytter graden meget
      for (const k in grp) grp[k].adj = grp[k].sum / (grp[k].n + 12);
      m = { a, b, n, grp, step: Math.exp(b) };
    }
  }
  PGM = { key, m };
  return m;
}
function personalGrade(value, tech) {
  const m = personalModel();
  if (!m || !tech) return null;
  const e = m.grp[Math.min(tech, 6)];
  if (!e || e.n < 5) return null;
  return { value: Math.max(1, Math.min(9.9, Math.round((value + e.adj) * 10) / 10)), adj: e.adj, n: e.n };
}
function personalLineHtml(value, tech) {
  const pg = personalGrade(value, tech);
  if (!pg) {
    const solvedClean = games.filter((g) => g.solved && !g.hints).length;
    return solvedClean < 10
      ? `<p class="estline">${tr("Efter 10 løste opgaver uden hints kan appen sige, hvordan en opgave sandsynligvis føles for dig ({n} indtil nu).", { n: solvedClean })}</p>`
      : "";
  }
  const name = LEVEL_TECH[Math.min(tech, 6)] + (tech >= 6 ? " " + tr("eller sværere") : "");
  const why =
    pg.adj >= 0.2
      ? tr("Opgaver, hvor {tech} er det sværeste, har taget dig længere tid, end deres grad siger ({n} opgaver).", { tech: name, n: pg.n })
      : pg.adj <= -0.2
        ? tr("Opgaver, hvor {tech} er det sværeste, har gået hurtigere for dig, end deres grad siger ({n} opgaver).", { tech: name, n: pg.n })
        : tr("Opgaver, hvor {tech} er det sværeste, har passet med deres grad for dig ({n} opgaver).", { tech: name, n: pg.n });
  return `<p class="estline"><b>${tr("Ud fra din historik vil den sandsynligvis føles som en {v}.", { v: dec(pg.value) })}</b> ${why}</p>`;
}
