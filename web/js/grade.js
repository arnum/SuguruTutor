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
    steps.push({ L: h.hardestLevel, T: h.hardest, vis: h.vis, mem: h.mem, len: h.len, inner: h.inner || [], multi: h.multi || 0, opts: h.opts, progress: placed / empty0 });
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
// Justeret 18. nov. 2026 ud fra 93 løste opgaver: par og tripler tog ca. 1,5 gange så lang tid som deres grad sagde
// (og blev oplevet sværere), så deres genkendelse er hævet (par +1,2, tripler +1,1). Sammenhæng med log(tid): 0,75 -> 0,80.
// pen = false: graden uden blyant (20. nov. 2026). Teknikker, der kræver at man husker muligheder, koster mere:
// tripler og skjulte par mere end nøgne par, kæder over to-mulighedsfelter mere end kæder med ét tal, og hvis-så med
// alle tal meget mere end at følge ét tal. Hukommelse vejer mere, og strygninger, der efterlader felter med flere
// muligheder, skal huskes. Enkle tal og nabo-eliminering er uændret, så lette opgaver får samme grad.
// Tallene er et kvalificeret skøn; de tilpasses, når der er spil nok med og uden blyant (spillet gemmer, om der blev brugt blyant).
function gradeFromSteps(steps, pen = true) {
  // (konstanter og hjælpefunktion ligger inde i funktionen, så den kan sendes til baggrunds-workeren)
  // Hvis-så (11) og hvis-så med teknikker (13) har samme grundtal; forskellen ligger nu i INNER nedenfor.
  const RECOG = [0, 0, 0.6, 2.2, 2.9, 3.0, 3.7, 1.9, 2.2, 2.5, 2.8, 3.1, 3.5, 3.1];
  // Teknikker inde i et hvis-så / begge veje vejer med: 0,6 x genkendelsen af den sværeste af dem (19. nov. 2026).
  // Et hvis-så med kun enkle tal og nabo-eliminering er langt lettere end et, der kræver par, tripler eller kæder
  // undervejs. Typisk værdi svarer til det gamle faste tillæg for et dybt hvis-så (4,4).
  const INNER = 0.6;
  const NOPEN = [0, 0, 0, 0.3, 0.5, 1.0, 1.2, 0.4, 1.0, 1.2, 0.3, 1.5, 1.5, 1.5];
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
    const memT = (pen || s.T < 3 ? 0.3 : 0.5) * Math.log2(1 + (s.mem || 0));
    const lenT = 0.35 * Math.log2(1 + Math.max(0, (s.len || 1) - 1));
    const spot = s.opts <= 1 ? 0.5 : s.opts === 2 ? 0.3 : s.opts === 3 ? 0.15 : 0;
    const innerT = s.inner && s.inner.length ? INNER * Math.max(...s.inner.map((t) => RECOG[t])) : 0;
    const nopenT = pen ? 0 : NOPEN[s.T] || 0,
      // (kæder med ét tal stryger kun ét tal, som nabo-eliminering, så de tæller ikke her)
      multiT = pen || !((s.T >= 3 && s.T <= 6) || s.T === 8 || s.T === 9 || s.T === 12) ? 0 : Math.min(1, 0.25 * (s.multi || 0));
    return { e: 1 + R + memT + lenT + spot + innerT + nopenT + multiT, R, base, shapeT, openT, workT, memT, lenT, spot, innerT, nopenT, multiT };
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
  // Graden uden blyant (samme skridt, anden pris)
  let np = null;
  if (pen) {
    const n = gradeFromSteps(steps, false);
    np = { value: n.value, band: n.band, peak: n.peak, load: n.load, T: n.hard.T, memT: n.hard.memT, nopenT: n.hard.nopenT, multiT: n.hard.multiT, multi: n.hard.multi };
  }
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
    },
    fit: 5,
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
