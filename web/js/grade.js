// Sværhedsgrad: simuleret menneskelig løsning -> indsats pr. skridt -> top, mængde og det samlede tal.

// Finere sværhedsgrad: simulér en menneskelig løsning (altid det letteste næste tal) og mål
//  - hukommelse: hvor mange usynlige fakta (elimineringer/kædeskridt) man højst skal holde i hovedet for at finde ét tal
//  - tidspunkt: hvor tidligt i løsningen det sværeste skridt kommer
//  - mængde:    hvor stor en del af tallene der kræver mere end de enkle teknikker
// Niveau (teknik) bestemmer heltallet; profilen bestemmer decimalen inden for niveauet.
function solveProfile(tutor, givens) {
  const known = givens.slice();
  const empty0 = known.filter((v) => !v).length;
  const steps = [];
  let placed = 0;
  while (known.some((v) => !v)) {
    const h = tutor.easiest(known);
    if (!h) return null;
    steps.push({ L: h.hardestLevel, T: h.hardest, vis: h.vis, mem: h.mem, len: h.len, opts: h.opts, progress: placed / empty0 });
    known[h.cell] = h.v;
    placed++;
  }
  return steps;
}
// Sværhedsgrad som indsats, ikke som teknik-stige.
// Hvert skridt i en simuleret menneskelig løsning får en indsats ud fra fire ting:
//   genkendelse (hvor svært mønstret er at få øje på), hukommelse (ting der skal holdes i hovedet samtidig),
//   længde (antal led i ræsonnementet) og overblik (hvor få steder der var at komme videre).
// Opgavens tal er det tungeste skridt plus et lille tillæg for mange tunge skridt og for at de kommer tidligt.
// Konstanterne er tilpasset 17 opgaver med målt løsningstid og oplevet sværhed (nov. 2026): teknikken vejer tungt,
// hukommelse og omgivelser mindre end først antaget. Sammenhæng med log(tid): 0,89.
function gradeFromSteps(steps) {
  // (konstanter og hjælpefunktion ligger inde i funktionen, så den kan sendes til baggrunds-workeren)
  const RECOG = [0, 0, 0.6, 1.0, 1.7, 1.9, 2.6, 1.9, 2.2, 2.5, 2.8, 3.1, 3.5, 4.4];
  function stepEffort(s) {
    // Genkendelse = mønstrets grundpris + hvor godt netop dette tilfælde skjuler sig
    const base = 1.0 * (RECOG[s.T] || 0),
      v = s.vis;
    let shapeT = 0,
      openT = 0,
      workT = 0;
    if (v) {
      if (s.T >= 2 && s.T <= 6) shapeT = 0.35 * (0.15 * Math.min(3, Math.max(0, v.size - 2)) + 0.2 * v.bent);
      openT = 0.35 * 0.8 * (0.55 - v.fill); // tæt udfyldt giver rabat, åbent giver tillæg
      workT = 0.35 * Math.max(-0.25, Math.min(0.5, 0.12 * (v.work - 4)));
    }
    const R = base + shapeT + openT + workT;
    const memT = 0.3 * Math.log2(1 + (s.mem || 0));
    const lenT = 0.35 * Math.log2(1 + Math.max(0, (s.len || 1) - 1));
    const spot = s.opts <= 1 ? 0.5 : s.opts === 2 ? 0.3 : s.opts === 3 ? 0.15 : 0;
    return { e: 1 + R + memT + lenT + spot, R, base, shapeT, openT, workT, memT, lenT, spot };
  }
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const N = steps.length,
    ef = steps.map(stepEffort);
  let hi = 0;
  ef.forEach((x, i) => {
    if (x.e > ef[hi].e + 1e-9) hi = i;
  });
  const top = ef[hi],
    hs = steps[hi];
  const tech = Math.max(...steps.map((s) => s.L));
  const avgOpts = steps.reduce((a, s) => a + s.opts, 0) / N,
    narrow = steps.filter((s) => s.opts <= 1).length / N;
  const advCount = steps.filter((s) => s.L >= 2).length;
  let value,
    loadT = 0,
    earlyT = 0,
    nHard = 0,
    W = 0,
    peak;
  // Mængde: summen af indsatsen i alle ikke-trivielle skridt ud over det tungeste. Gentagelser af samme teknik tæller mindre og mindre.
  const seen = {};
  ef.forEach((x, i) => {
    if (steps[i].L < 2) return;
    nHard++;
    const k = (seen[steps[i].T] = (seen[steps[i].T] || 0) + 1);
    if (i !== hi) W += Math.max(0, x.e - 1.5) / (1 + 0.25 * (k - 1));
  });
  if (tech === 1) {
    // Kun enkle træk: sværheden er, hvor smal vejen er
    value = 1 + 0.9 * (0.65 * clamp((4.5 - avgOpts) / 2.5) + 0.35 * clamp(narrow / 0.15));
  } else {
    loadT = 1.0 * (1 - Math.exp(-W / 9));
    earlyT = 0.3 * (1 - hs.progress);
    peak = top.e + earlyT;
    value = peak + loadT;
  }
  if (tech === 1) peak = value;
  const load = tech === 1 ? 0 : Math.max(1, Math.min(10, Math.round(10 * (1 - Math.exp(-(W + Math.max(0, top.e - 1.5)) / 12)))));
  value = Math.max(1, Math.min(9.9, Math.round(value * 10) / 10));
  const band = Math.floor(value);
  return {
    value,
    level: band,
    band,
    decimal: Math.round((value - band) * 10),
    tech,
    total: N,
    advCount,
    avgOpts,
    narrow,
    mem: Math.max(...steps.map((s) => s.mem)),
    len: Math.max(...steps.map((s) => s.len || 0)),
    hard: {
      T: hs.T,
      L: hs.L,
      mem: hs.mem,
      len: hs.len,
      opts: hs.opts,
      progress: hs.progress,
      e: top.e,
      R: top.R,
      base: top.base,
      shapeT: top.shapeT,
      openT: top.openT,
      workT: top.workT,
      vis: hs.vis || null,
      memT: top.memT,
      lenT: top.lenT,
      spot: top.spot,
    },
    fit: 2,
    nHard,
    W,
    loadT,
    earlyT,
    peak: Math.round(Math.min(9.9, peak) * 10) / 10,
    load,
    series: ef.map((x, i) => (steps[i].L < 2 ? 0 : Math.round(x.e * 10) / 10)),
  };
}
const NUANCES = [
  { id: "alle", label: tr("Alle"), lo: 0, hi: 9 },
  { id: "mild", label: tr("Mild"), lo: 0, hi: 3 },
  { id: "middel", label: tr("Middel"), lo: 4, hi: 6 },
  { id: "haard", label: tr("Hård"), lo: 7, hi: 9 },
];
// Generér til et niveau OG et decimal-interval. Køres både i baggrunds-workeren og som reserve i siden.
function generateGraded(SE, d, onProgress) {
  // d.level er et sværhedsbånd (1-9); d.must er en valgfri teknik (1-11), som opgaven skal kræve.
  const t0 = Date.now(),
    START = [0, 1, 2, 2, 3, 5, 6, 8, 9, 10];
  let best = null,
    bestKey = Infinity,
    tries = 0,
    seed = d.seed,
    tt = d.must || START[d.level] || 2;
  while (true) {
    const left = d.budget - (Date.now() - t0);
    const p = SE.generate(d.rows, d.cols, tt, seed++, Math.max(1200, Math.min(4000, left)), null, d.maxRegion || 5);
    const steps = solveProfile(createTutor(SE.makeGeometry(d.rows, d.cols), p.region), p.givens);
    p.grade = steps ? gradeFromSteps(steps) : null;
    p.target = d.level;
    tries++;
    const band = p.grade ? p.grade.band : p.rating.level,
      dec = p.grade ? p.grade.decimal : 0;
    const key =
      (d.must ? Math.abs(p.rating.level - d.must) * 100 : 0) +
      Math.abs(band - d.level) * 10 +
      (dec < d.lo ? d.lo - dec : dec > d.hi ? dec - d.hi : 0) +
      (p.grade && d.kind === "kort" ? Math.max(0, p.grade.load - 3) : p.grade && d.kind === "lang" ? Math.max(0, 6 - p.grade.load) : 0);
    if (key < bestKey) {
      best = p;
      bestKey = key;
    }
    if (onProgress) onProgress(tries, band, dec);
    if (key === 0 || Date.now() - t0 > d.budget) break;
    // Søg teknikken, der oftest rammer båndet: for let -> sværere teknik, for svær -> lettere
    if (!d.must) tt = band < d.level ? Math.min(11, tt + 1) : band > d.level ? Math.max(d.level === 1 ? 1 : 2, tt - 1) : tt;
  }
  best.nuance = d.nuance;
  return best;
}
