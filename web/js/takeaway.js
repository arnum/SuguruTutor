// "Det vigtigste fra spillet": en kort ruteanalyse lige efter løsningen. Én ting, du gjorde godt, og én ting at lære,
// med et eksempel fra spillet (en lille plade, der vises ved tryk).

// Hvad man skal kigge efter, når man overså en teknik. Ordnet efter det niveau, der var det letteste lige da.
const TECH_TIP = [
  "",
  tr("Scan region for region, før du leder efter mønstre: mangler der kun ét tal, eller kan et tal kun stå ét sted?"),
  tr("Kig efter tal, der rører flere tomme felter i samme region: tallet kan ikke stå i nogen af dem, og så er der ofte kun én plads tilbage."),
  tr("Find to felter i en region med de samme to muligheder: de to tal er så låst til de felter og kan streges alle andre steder i regionen."),
  tr("Tre felter i en region, der tilsammen kun har tre muligheder, låser de tre tal på samme måde som et par."),
  tr("Når et tal kun kan stå to steder, så følg begge muligheder et skridt: rører de begge det samme felt, kan tallet ikke stå der."),
  tr("Følg en kæde af felter med kun to muligheder: hvert felt bestemmer det næste, og enderne kan fjerne muligheder i felter, de begge rører."),
  tr("Bland de to slags kæder: skift mellem 'tallet kan kun stå to steder' og 'feltet har kun to muligheder'."),
  tr("Prøv ét tal af i hovedet: fører det til en modstrid, er det forkert."),
  tr("Prøv ét tal af i hovedet: fører det til en modstrid, er det forkert."),
  tr("Prøv begge muligheder i et felt: det, der sker i begge tilfælde, er sikkert."),
  tr("Prøv ét tal af i hovedet og følg det længere: fører det til en modstrid, er det forkert."),
];

function takeaway(g) {
  if (!g || !g.moves || !g.moves.length) return null;
  const list = g.moves;
  markErrors(list);
  const base = baseline(g.id),
    r = g.route || routeSummary(list);
  const nm = (c) => "abcdefghij"[c % g.cols] + (Math.floor(c / g.cols) + 1);
  const usual = (L) => (base[L] ? base[L].med : L === 1 ? 4 : 8 * L * L);
  const primary = list.map((m, i) => Object.assign({ i }, m)).filter((m) => m.cls === "wrong" && !m.follow && !m.slip);

  // ---------- Godt
  let good = null,
    noErrSaid = false;
  const fast = list
    .map((m, i) => Object.assign({ i }, m))
    .filter((m) => judged(m) && m.cls !== "wrong" && m.dt >= 1000 && moveLevel(m) >= 2 && base[moveLevel(m)] && m.dt / 1000 <= 0.6 * base[moveLevel(m)].med)
    .sort((a, b) => moveLevel(b) - moveLevel(a) || a.dt - b.dt)[0];
  const pct = r.n ? Math.round((100 * r.easy) / r.n) : 0;
  if (fast)
    good = tr("Træk {k}: du fandt {cell} = {v} med {tech} på {tid}. Det plejer at tage dig {usual}.", {
      k: fast.i + 1,
      cell: nm(fast.c),
      v: fast.v,
      tech: LEVEL_TECH[moveLevel(fast)],
      tid: fmtS(fast.dt / 1000),
      usual: fmtS(base[moveLevel(fast)].med),
    });
  else if (g.est && g.solved && g.ms / 1000 <= 0.87 * g.est)
    good = tr("Du var hurtigere end dit estimat: {pct} % af tiden.", { pct: Math.round((100 * g.ms) / 1000 / g.est) });
  else if (!primary.length && pct >= 90) (good = tr("Ingen fejl, og {pct} % af dine træk var de letteste, der fandtes.", { pct })), (noErrSaid = true);
  else if (r.ahead) good = r.ahead === 1 ? tr("Du tænkte frem én gang og ramte rigtigt.") : tr("Du tænkte frem {n} gange og ramte rigtigt.", { n: r.ahead });
  else if (pct >= 75) good = tr("{pct} % af dine træk var de letteste, der fandtes.", { pct });
  else good = tr("Du gjorde den færdig: {n} tal på {tid}.", { n: list.filter((m) => m.cls !== "wrong").length, tid: fmt(g.ms) });
  if (!primary.length && !noErrSaid && list.length >= 8) good += " " + tr("Og ingen fejl.");

  // ---------- At lære: det, der kostede mest tid
  const cands = [];
  list.forEach((m, i) => {
    if (!judged(m)) return;
    if (m.cls === "harder") {
      const lv = moveLevel(m);
      cands.push({
        cost: m.dt / 1000 - usual(m.avail),
        prio: 2,
        mode: "cmp",
        i,
        text:
          tr("Træk {k}: du fandt {cell} = {v} med {tech}, men der var et lettere træk med {easy}.", {
            k: i + 1,
            cell: nm(m.c),
            v: m.v,
            tech: LEVEL_TECH[lv],
            easy: LEVEL_TECH[m.avail],
          }) +
          " " +
          TECH_TIP[m.avail],
      });
    }
  });
  const c = concGet(g);
  if (c)
    c.idx
      .filter((i) => list[i] && list[i].cls !== "wrong")
      .forEach((i) => {
        const m = list[i];
        cands.push({
          cost: m.dt / 1000 - (c.norm || 4),
          prio: 1,
          mode: "easy",
          i,
          text:
            tr("Træk {k}: du ledte {tid} efter et let tal, selv om {n} stod klar.", { k: i + 1, tid: fmt(m.dt), n: m.nAvail }) +
            " " +
            tr("Når du sidder fast, så gå regionerne igennem én ad gangen og spørg: hvilket tal mangler, og hvor kan det stå?"),
        });
      });
  primary.forEach((m) => {
    const fixed = m.fixT !== undefined && !m.legacy ? (m.fixT - m.t) / 1000 : 30;
    cands.push({
      cost: fixed + 20,
      prio: 3,
      mode: "err",
      i: m.i,
      text: tr("Træk {k}: {cell} = {v} var forkert.", { k: m.i + 1, cell: nm(m.c), v: m.v }) + " " + errWhy(g, m, nm),
    });
  });
  cands.sort((a, b) => b.cost - a.cost || b.prio - a.prio);
  const learn = cands.length && cands[0].cost >= 8 ? cands[0] : null;
  return { good, learn };
}

function takeawayHtml(g) {
  const t = takeaway(g);
  if (!t) return "";
  return (
    `<div class="takeaway"><h3>${tr("Det vigtigste fra spillet")}</h3>` +
    `<p class="tkgood"><b>${tr("Godt")}</b> ${t.good}</p>` +
    (t.learn
      ? `<p class="tklearn"><b>${tr("Til næste gang")}</b> ${t.learn.text}</p>` +
        (g.code ? `<details class="tkboard"><summary>${tr("Se det på pladen")}</summary>${mboardSlot(g, { i: t.learn.i }, t.learn.mode)}</details>` : "")
      : `<p class="tklearn"><b>${tr("Til næste gang")}</b> ${tr("Ingen tydelige omveje i dette spil. Prøv en sværere opgave.")}</p>`) +
    `</div>`
  );
}
function bindTakeaway(root, g) {
  const det = root.querySelector(".tkboard");
  if (!det) return;
  det.addEventListener("toggle", () => {
    const el = det.querySelector(".mboard:not([data-done])");
    if (!det.open || !el) return;
    el.dataset.done = 1;
    setTimeout(() => {
      try {
        el.innerHTML = mboardHtml(g, +el.dataset.mi, el.dataset.mode) || "";
      } catch (e) {
        el.innerHTML = "";
      }
    }, 30);
  });
}

// Hvorfor var tallet forkert? Ud fra pladen lige før: rørte det samme tal, stod det allerede i regionen, var regionen
// for lille, eller var det selve ræsonnementet, der gik galt?
function errWhy(g, m, nm) {
  const P2 = g.code ? routePuzzle(g) : null;
  if (!P2) return tr("Tjek de otte naboer, før du sætter et tal: samme tal må ikke røre hinanden, heller ikke på skrå.");
  const known = boardBefore(P2, g.moves, m.i),
    reg = P2.d.region,
    cells = reg.map((r, i) => i).filter((i) => reg[i] === reg[m.c]);
  const touch = P2.G.king[m.c].find((x) => known[x] === m.v);
  if (touch !== undefined)
    return tr("Det rørte {nb} = {v}.", { nb: nm(touch), v: m.v }) + " " + tr("Tjek de otte naboer, før du sætter et tal: samme tal må ikke røre hinanden, heller ikke på skrå.");
  const dup = cells.find((x) => x !== m.c && known[x] === m.v);
  if (dup !== undefined)
    return tr("Regionen havde allerede {v} i {nb}.", { v: m.v, nb: nm(dup) }) + " " + tr("Se, hvilke tal regionen mangler, før du sætter et.");
  if (m.v > cells.length) return tr("Regionen har kun {n} felter, så {v} kan ikke stå der.", { n: cells.length, v: m.v });
  return (
    tr("Intet på pladen udelukkede det direkte, så det var ræsonnementet, der gik galt. Feltet skulle være {right}.", { right: P2.sol[m.c] }) +
    " " +
    tr("Når du er i tvivl, så skriv mulighederne med blyant, før du sætter tallet.")
  );
}
