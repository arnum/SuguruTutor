// Sværhedsgrad: simuleret menneskelig løsning -> indsats pr. skridt -> top, mængde og det samlede tal.

// Finere sværhedsgrad: simulér en menneskelig løsning (altid det letteste næste tal) og mål
//  - hukommelse: hvor mange usynlige fakta (elimineringer/kædeskridt) man højst skal holde i hovedet for at finde ét tal
//  - tidspunkt: hvor tidligt i løsningen det sværeste skridt kommer
//  - mængde:    hvor stor en del af tallene der kræver mere end de enkle teknikker
// Niveau (teknik) bestemmer heltallet; profilen bestemmer decimalen inden for niveauet.
function solveProfile(tutor, givens) {
  const known = givens.slice();
  const empty0 = known.filter((v) => !v).length;
  const steps = [],
    seen = new Set(); // mønstre brugt ved tidligere placeringer
  let placed = 0;
  while (known.some((v) => !v)) {
    const h = tutor.easiest(known);
    if (!h) return null;
    const repeat = h.sig != null && seen.has(h.sig) ? 1 : 0;
    if (h.sig != null) seen.add(h.sig);
    steps.push({
      L: h.hardestLevel,
      T: h.hardest,
      vis: h.vis,
      mem: h.mem,
      len: h.len,
      inner: h.inner || [],
      multi: h.multi || 0,
      trial: h.trial || 0,
      built: h.built || 0,
      partial: h.partial || 0,
      repeat,
      opts: h.opts,
      progress: placed / empty0,
    });
    known[h.cell] = h.v;
    placed++;
  }
  return steps;
}
// Sværhedsgrad som indsats, ikke som teknik-stige.
// Hvert skridt i en simuleret menneskelig løsning får en indsats som en sum af navngivne led:
//   genkendelse (hvor svært mønstret er at få øje på), hukommelse (ting der skal holdes i hovedet samtidig),
//   længde (antal led i ræsonnementet), overblik (hvor få steder der var at komme videre), og led der afhænger af,
//   om man bruger blyant. Opgavens tal er det tungeste skridt plus et lille tillæg for mange tunge skridt og for at de
//   kommer tidligt.
// Tre lag: træk (tutor.js beskriver hvert skridt: teknik, felter, hukommelse, ...), vægte (GW nedenfor, skrevet fra
// tools/grade/weights.json) og indsats (stepEffort). En kalibrering ændrer kun weights.json; se tools/grade/README.md.
// Historik: tilpasset 17 opgaver med målt tid (nov. 2026, sammenhæng med log(tid) 0,89); par og tripler hævet efter
// 93 opgaver (18. nov., 0,75 -> 0,80); teknikker inde i hvis-så (19. nov.); graden uden blyant (20. nov.).
// pen = false: graden uden blyant; pen = null: som du plejede. Grundtallene er tilpasset spil, hvor hvis-så og kæder over
// to-mulighedsfelter blev løst med blyant, tripler nogle gange, og resten uden (20. nov. 2026). weights.json siger pr.
// teknik, hvor stor en del der var med blyant; gen.py udleder derfra graden med og uden blyant.
// <gen:weights> Skrevet af tools/grade/gen.py ud fra tools/grade/weights.json. Ret dér, ikke her.
// Blyant-led: [med blyant, uden blyant, som du plejede], hver en liste pr. teknik (udledt af base, diff og anchor).
const GW = {
  fit: 8,
  recog: [0, 0, 0.6, 2.2, 2.9, 3, 3.7, 1.9, 2.2, 2.5, 2.8, 3.1, 3.5, 3.1],
  spot: [0.5, 0.5, 0.3, 0.15, 0],
  inner: 0.6,
  vis: 0.35,
  shapeSize: 0.15,
  shapeSizeCap: 3,
  shapeBent: 0.2,
  open: 0.8,
  openMid: 0.55,
  workPer: 0.12,
  workMid: 4,
  workLo: -0.25,
  workHi: 0.5,
  len: 0.35,
  loadOver: 1.5,
  loadTechRepeat: 0.25,
  loadScale: 9,
  loadWeight: 1,
  loadCountScale: 12,
  early: 0.3,
  singlesK: 0.9,
  singlesOptsW: 0.65,
  singlesOptsMid: 4.5,
  singlesOptsSpan: 2.5,
  singlesNarrowW: 0.35,
  singlesNarrowSpan: 0.15,
  pencil: {
    mem: [[0.3, 0.3, 0.3, 0.1, 0.1, 0.2, 0.2, 0.1, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3], [0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]],
    tech: [[0, 0, 0, -0.3, -0.5, -0.5, -0.6, -0.4, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0.5, 0.6, 0, 1, 1.2, 0.3, 1.5, 1.5, 1.5], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    multi: [[0, 0, 0, -0.25, -0.25, -0.125, -0.125, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0.125, 0.125, 0, 0.25, 0.25, 0, 0, 0.25, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    trial: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.3, 0, 0.3], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    built: [[0, 0, 0, -0.4, -0.4, -0.2, -0.2, -0.4, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0.2, 0.2, 0, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    repeat: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    partial: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    multiCap: 1,
  },
};
// </gen:weights>
// Indsatsen for ét skridt. pen: true = med blyant, false = uden, null = som du plejede (graden, vægtene er tilpasset;
// bruges til spil fra før blyant blev registreret). Leddene lægges sammen i fast rækkefølge (samme som Java).
function stepEffort(s, pen = true) {
  const m = pen === null ? 2 : pen === false ? 1 : 0,
    T = s.T,
    P = GW.pencil;
  // Genkendelse = mønstrets grundpris + hvor godt netop dette tilfælde skjuler sig
  const base = 1.0 * (GW.recog[T] || 0),
    v = s.vis;
  let shapeT = 0,
    openT = 0,
    workT = 0;
  if (v) {
    if (T >= 2 && T <= 6) shapeT = GW.vis * (GW.shapeSize * Math.min(GW.shapeSizeCap, Math.max(0, v.size - 2)) + GW.shapeBent * v.bent);
    openT = GW.vis * GW.open * (GW.openMid - v.fill); // tæt udfyldt giver rabat, åbent giver tillæg
    workT = GW.vis * Math.max(GW.workLo, Math.min(GW.workHi, GW.workPer * (v.work - GW.workMid)));
  }
  const R = base + shapeT + openT + workT;
  const memT = P.mem[m][T] * Math.log2(1 + (s.mem || 0));
  const lenT = GW.len * Math.log2(1 + Math.max(0, (s.len || 1) - 1));
  const spot = GW.spot[Math.max(0, Math.min(4, s.opts == null ? 4 : s.opts))];
  const innerT = s.inner && s.inner.length ? GW.inner * Math.max(...s.inner.map((t) => GW.recog[t])) : 0;
  const nopenT = P.tech[m][T],
    multiT = Math.max(-P.multiCap, Math.min(P.multiCap, P.multi[m][T] * (s.multi || 0))),
    trialT = P.trial[m][T] * (s.trial || 0),
    builtT = P.built[m][T] * Math.log2(1 + (s.built || 0)),
    repeatT = -P.repeat[m][T] * (s.repeat ? R : 0),
    partialT = P.partial[m][T] * (s.partial || 0);
  return {
    e: 1 + R + memT + lenT + spot + innerT + nopenT + multiT + trialT + builtT + repeatT + partialT,
    R,
    base,
    shapeT,
    openT,
    workT,
    memT,
    lenT,
    spot,
    innerT,
    nopenT,
    multiT,
    trialT,
    builtT,
    repeatT,
    partialT,
  };
}
// Led, der afhænger af blyant (til forklaringen af forskellen mellem graderne)
const PEN_TERMS = ["memT", "nopenT", "multiT", "trialT", "builtT", "repeatT", "partialT"];
function gradeFromSteps(steps, pen = true) {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const N = steps.length,
    ef = steps.map((s) => stepEffort(s, pen === null || pen === false ? pen : true));
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
    if (i !== hi) W += Math.max(0, x.e - GW.loadOver) / (1 + GW.loadTechRepeat * (k - 1));
  });
  if (tech === 1) {
    // Kun enkle træk: sværheden er, hvor smal vejen er
    value = 1 + GW.singlesK * (GW.singlesOptsW * clamp((GW.singlesOptsMid - avgOpts) / GW.singlesOptsSpan) + GW.singlesNarrowW * clamp(narrow / GW.singlesNarrowSpan));
  } else {
    loadT = GW.loadWeight * (1 - Math.exp(-W / GW.loadScale));
    earlyT = GW.early * (1 - hs.progress);
    peak = top.e + earlyT;
    value = peak + loadT;
  }
  if (tech === 1) peak = value;
  const load = tech === 1 ? 0 : Math.max(1, Math.min(10, Math.round(10 * (1 - Math.exp(-(W + Math.max(0, top.e - GW.loadOver)) / GW.loadCountScale)))));
  value = Math.max(1, Math.min(9.9, Math.round(value * 10) / 10));
  const band = Math.floor(value);
  // Graden uden blyant (ankeret, se tools/grade/weights.json) som et fuldt gradobjekt, så forklaringen kan vise dens egne led
  const np = pen !== null && pen !== false ? gradeFromSteps(steps, false) : null;
  return {
    np,
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
      innerT: top.innerT,
      inner: hs.inner || [],
      multi: hs.multi || 0,
      nopenT: top.nopenT,
      multiT: top.multiT,
      trialT: top.trialT,
      builtT: top.builtT,
      repeatT: top.repeatT,
      partialT: top.partialT,
      trial: hs.trial || 0,
      built: hs.built || 0,
      repeat: hs.repeat || 0,
      partial: hs.partial || 0,
    },
    fit: GW.fit,
    nHard,
    W,
    loadT,
    earlyT,
    peak: Math.round(Math.min(9.9, peak) * 10) / 10,
    load,
    series: ef.map((x, i) => (steps[i].L < 2 ? 0 : Math.round(x.e * 10) / 10)),
    lv: steps.map((s) => s.L * 100 + Math.min(99, s.opts || 1)), // til det personlige tidsestimat
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
    // d.np: spilleren spiller uden blyant, så båndet gælder graden uden blyant
    const gv = p.grade ? (d.np && p.grade.np ? p.grade.np.value : p.grade.value) : null;
    const band = p.grade ? Math.floor(gv) : p.rating.level,
      dec = p.grade ? Math.round((gv - Math.floor(gv)) * 10) : 0;
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
