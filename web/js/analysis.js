// Analyse: løsningsrute, tid pr. teknik, koncentration, form og træthed, fokusområde og kontrol af bedømmelsen.

// Hvert placeret tal sammenlignes med stillingen lige før: kunne det ses med det letteste niveau, der fandtes på det tidspunkt?
const ROUTE_CLS = {
  easy: { label: tr("Letteste"), long: tr("Et af de letteste træk") },
  ahead: { label: tr("Tænkt frem"), long: tr("Tænkt frem") },
  harder: { label: tr("Sværere"), long: tr("Sværere end nødvendigt") },
  wrong: { label: tr("Fejl"), long: tr("Forkert tal") },
  guess: { label: tr("Gæt"), long: tr("Kunne ikke udledes") },
  hint: { label: tr("Hint"), long: tr("Sat med hint") },
};
// Spil analyseret før "tænkt frem" fik navngivne tal: kør analysen igen ud fra de gemte træk og tilføj dem.
// Slettede tal er ikke gemt, men forkerte tal tæller alligevel ikke med i stillingen, så resultatet bliver det samme.
// Gemte opsummeringer fra før fejl-episoderne: regn dem om ud fra de gemte træk (hurtigt, ingen ny analyse)
function refreshRouteSummaries() {
  let changed = false;
  games.forEach((g) => {
    if (!g.moves || (g.route && g.route.slips !== undefined)) return;
    markErrors(g.moves);
    g.route = routeSummary(g.moves);
    g.thirds = thirdsOf(g);
    g.conc = null;
    changed = true;
  });
  if (changed) saveGames();
}
function upgradeAheadVia() {
  const todo = games.filter((g) => g.moves && g.code && g.moves.some((m) => m.cls === "ahead" && !m.via));
  const next = () => {
    const g = todo.shift();
    if (!g) return;
    let p;
    try {
      p = puzzleFromCode(g.code);
    } catch (e) {
      g.moves.forEach((m) => m.cls === "ahead" && !m.via && (m.via = []));
      return next();
    }
    const raw = g.moves.map((m) => ({ c: m.c, v: m.v, t: m.t, h: m.cls === "hint" ? 1 : 0 }));
    runRoute(p, raw, (list) => {
      g.moves.forEach((m, k) => {
        if (m.cls === "ahead" && !m.via) m.via = (list[k] && list[k].c === m.c && list[k].via) || [];
      });
      saveGames();
      setTimeout(next, 50);
    });
  };
  setTimeout(next, 1500);
}
function runRoute(p, moves, done) {
  try {
    const w = newWorker();
    w.onmessage = (e) => {
      if (e.data.type === "route") {
        w.terminate();
        done(e.data.list);
      }
    };
    w.onerror = () => {
      w.terminate();
      setTimeout(() => done(analyzeRoute(E, p, moves)), 30);
    };
    w.postMessage({ type: "route", puzzle: p, moves });
  } catch (e) {
    setTimeout(() => done(analyzeRoute(E, p, moves)), 30);
  }
}
function startRoute(rec) {
  const p = P,
    moves = meta.moves.slice();
  if (!moves.some((m) => m.v && !m.u && !m.h)) return;
  rec.routePending = true;
  runRoute(p, moves, (list) => {
    const g = games.find((x) => x.id === rec.id);
    if (!g) return;
    delete g.routePending;
    delete rec.routePending;
    g.moves = list.map((m) => {
      const o = Object.assign({}, m);
      for (const k in o) if (o[k] === undefined) delete o[k];
      return o;
    });
    g.route = routeSummary(list);
    g.thirds = thirdsOf(g);
    g.pace = paceOf(g, baseline(null));
    g.conc = concOf(g, baseline(g.id));
    rec.conc = g.conc;
    const cl = document.getElementById("concLine");
    if (cl) cl.innerHTML = concLineHtml(g);
    rec.route = g.route;
    rec.moves = g.moves;
    // Gem detaljerne for de seneste 40 spil; ældre beholder kun opsummeringen
    let keep = 0;
    for (let i = games.length - 1; i >= 0; i--)
      if (games[i].moves) {
        if (++keep > 40) delete games[i].moves;
      }
    saveGames();
    const el2 = document.getElementById("routeLine");
    if (el2) el2.innerHTML = routeLineHtml(g);
    const tk = document.getElementById("takeaway");
    if (tk) {
      tk.innerHTML = takeawayHtml(g);
      bindTakeaway(tk, g);
    }
  });
}
function routeLineHtml(rec) {
  if (rec.routePending || (!rec.route && rec.solved)) return tr("Analyserer din løsningsrute …");
  const r = rec.route;
  if (!r || !r.n) return tr("Ingen træk at analysere.");
  const pct = Math.round((100 * r.easy) / r.n);
  const rest = [
    r.ahead ? tr("{n} tænkt frem", { n: r.ahead }) : "",
    r.harder ? tr("{n} sværere end nødvendigt", { n: r.harder }) : "",
    r.wrong
      ? r.wrong === 1
        ? r.follow ? tr("1 fejl (+{f} følgefejl)", { f: r.follow }) : tr("1 fejl")
        : r.follow ? tr("{n} fejl (+{f} følgefejl)", { n: r.wrong, f: r.follow }) : tr("{n} fejl", { n: r.wrong })
      : "",
    r.guess ? tr("{n} gæt", { n: r.guess }) : "",
  ].filter(Boolean);
  return (
    tr("<b>Rute: {pct} %</b> af dine træk var et af de letteste mulige.", { pct }) +
    (rest.length ? " " + rest.join(", ") + "." : "") +
    (r.longest >= 20000 ? " " + tr("Længste søgning: {tid}.", { tid: fmt(r.longest) }) : "") +
    `<span class="more">${tr("Se ruteanalysen ›")}</span>`
  );
}
function median(arr) {
  if (!arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y),
    k = a.length >> 1;
  return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2;
}
function fmtS(sec) {
  sec = Math.round(sec);
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}
// Tider pr. teknikniveau (sekunder) for et spil; ældre spil uden opsummering regnes ud fra trækkene
function timesOf(g) {
  if (g.route && g.route.times) return g.route.times;
  if (!g.moves) return {};
  const o = {};
  g.moves.forEach((m) => {
    const L = moveLevel(m);
    if (L && judged(m) && m.cls !== "wrong") (o[L] = o[L] || []).push(Math.round(m.dt / 1000));
  });
  return o;
}
// Din normale søgetid pr. niveau ud fra tidligere spil (mindst 3 træk)
function baseline(excludeId) {
  const all = {};
  games.forEach((g) => {
    if (g.id === excludeId) return;
    const t = timesOf(g);
    for (const L in t) (all[L] = all[L] || []).push(...t[L]);
  });
  const out = {};
  for (const L in all) if (all[L].length >= 3) out[L] = { med: median(all[L]), n: all[L].length };
  return out;
}
function routeChart(list, p) {
  const W = 330,
    H = 180,
    L = 24,
    R = 8,
    T = 10,
    B = 24,
    n = list.length;
  const lvOf = (m) => (m.cls === "wrong" || m.cls === "guess" ? 0 : m.cls === "hint" ? m.avail || 1 : moveLevel(m));
  const top = Math.min(12, Math.max(3, ...list.map(lvOf), ...list.map((m) => m.avail || 1)) + 1);
  const tmax = Math.max(1000, ...list.map((m) => m.t));
  const x = (t) => L + ((W - L - R) * t) / tmax;
  const y = (v) => T + (H - T - B) * (1 - (v - 1) / Math.max(1, top - 1));
  const col = {
    easy: "var(--indigo)",
    ahead: "var(--indigo)",
    harder: "var(--warn)",
    wrong: "var(--bad)",
    guess: "var(--bad)",
    hint: "var(--mute)",
  };
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Dine træk over tid: niveau og hvor længe du ledte")}">`;
  const step = top > 7 ? 2 : 1;
  for (let v = 1; v <= top; v += step)
    s +=
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>` +
      `<text x="${L - 7}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${v}</text>`;
  [0, 0.5, 1].forEach(
    (f) =>
      (s += `<text x="${x(f * tmax)}" y="${H - 6}" font-size="10" text-anchor="${f === 0 ? "start" : f === 1 ? "end" : "middle"}" fill="var(--mute)">${fmt(f * tmax)}</text>`),
  );
  // Letteste mulige niveau som trappe over tid
  let path = "";
  list.forEach((m, i) => {
    const a = m.avail || 1;
    path += i ? `H${x(m.t - m.dt)}V${y(a)}` : `M${x(0)} ${y(a)}`;
  });
  path += `H${x(tmax)}`;
  s += `<path d="${path}V${y(1) + 6}H${x(0)}Z" fill="var(--chip)" opacity="0.9"/><path d="${path}" fill="none" stroke="var(--mute)" stroke-width="1" opacity="0.5"/>`;
  // Perioder hvor en fejl stod på pladen (fra hovedfejlen, til den og dens følgefejl er rettet)
  markErrors(list);
  list.forEach((m, i) => {
    if (m.cls !== "wrong" || m.follow || m.slip || m.legacy) return; // gamle spil: det vides ikke, hvornår fejlen blev visket ud
    const ends = list.filter((x, j) => j === i || (x.cls === "wrong" && x.cause === i)).map((x) => (x.fixT === undefined ? tmax : x.fixT));
    const x0 = x(m.t), x1 = x(Math.max(...ends));
    s += `<rect x="${x0}" y="${T}" width="${Math.max(2, x1 - x0)}" height="${H - T - B}" fill="var(--bad)" opacity="0.08"/>` +
      `<line x1="${x0}" x2="${x0}" y1="${T}" y2="${H - B}" stroke="var(--bad)" stroke-width="1" opacity="0.4"/>`;
  });
  list.forEach((m) => {
    if (!m.chk) return;
    const xc = x(m.chkT);
    s +=
      `<path d="M${xc - 5} ${H - B + 9}l5 -7l5 7z" fill="var(--mute)"/>` +
      `<rect x="${xc - 7}" y="${H - B}" width="14" height="12" fill="transparent" data-tip="${esc(tr("«Tjek fejl» brugt her (tæller som hint)"))}"/>`;
  });
  list.forEach((m, i) => {
    const lv = lvOf(m),
      yy = y(lv ? Math.min(lv, top) : top),
      x0 = x(m.t - m.dt),
      x1 = x(m.t);
    const nm = "abcdefghij"[m.c % p.cols] + (Math.floor(m.c / p.cols) + 1);
    // Søgetiden som streg frem mod trækket
    const faint = m.amid || m.unsure || m.slip || (m.cls === "wrong" && m.follow);
    s += `<line x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}" stroke="${faint ? "var(--mute)" : col[m.cls]}" stroke-width="3" stroke-linecap="round" opacity="${faint ? 0.25 : 0.5}"/>`;
    if (m.amid || m.unsure) s += `<circle cx="${x1}" cy="${yy}" r="3" fill="var(--mute)" opacity="0.55"/>`;
    else if (m.cls === "wrong" && (m.follow || m.slip))
      s += `<path d="M${x1 - 3} ${yy - 3}l6 6M${x1 + 3} ${yy - 3}l-6 6" stroke="var(--bad)" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/>`;
    else if (m.cls === "easy") s += `<circle cx="${x1}" cy="${yy}" r="4" fill="var(--indigo)" stroke="var(--cell)" stroke-width="2"/>`;
    else if (m.cls === "ahead") s += `<circle cx="${x1}" cy="${yy}" r="4.5" fill="var(--cell)" stroke="var(--indigo)" stroke-width="2"/>`;
    else if (m.cls === "harder")
      s += `<rect x="${x1 - 5}" y="${yy - 5}" width="10" height="10" rx="2" fill="var(--warn)" stroke="var(--cell)" stroke-width="2" transform="rotate(45 ${x1} ${yy})"/>`;
    else if (m.cls === "hint") s += `<rect x="${x1 - 3.5}" y="${yy - 3.5}" width="7" height="7" rx="1" fill="var(--mute)"/>`;
    else
      s += `<path d="M${x1 - 4.5} ${yy - 4.5}l9 9M${x1 + 4.5} ${yy - 4.5}l-9 9" stroke="var(--bad)" stroke-width="2.4" stroke-linecap="round"/>`;
    const what = m.amid
      ? tr("sat mens en fejl stod på pladen, ikke bedømt")
      : m.unsure
        ? tr("sat efter en fejl, ikke bedømt")
        : m.slip
          ? tr("fejltryk, rettet med det samme")
          : m.cls === "wrong" && m.follow ? tr("følgefejl") : ROUTE_CLS[m.cls].long;
    let tip = tr("Træk {k} · {cell} = {v} · fundet efter {tid}: {what}", { k: i + 1, cell: nm, v: m.v, tid: fmt(m.dt), what });
    if (lv && m.cls !== "hint") tip += ` · ${LEVEL_TECH[lv]}`;
    if (m.avail && m.cls !== "easy" && m.cls !== "hint" && m.cls !== "wrong") tip += " · " + tr("letteste: {tech}", { tech: LEVEL_TECH[m.avail] });
    s += `<rect x="${Math.min(x0, x1 - 6)}" y="${yy - 9}" width="${Math.max(12, x1 - x0 + 6)}" height="18" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  s +=
    `</svg><div class="legendrow" style="flex-wrap:wrap;justify-content:flex-start;gap:4px 12px">` +
    `<span><i style="background:var(--indigo);border-radius:50%"></i> ${tr("letteste")}</span>` +
    `<span><i style="box-shadow:inset 0 0 0 2px var(--indigo);border-radius:50%"></i> ${tr("tænkt frem")}</span>` +
    `<span><i style="background:var(--warn);transform:rotate(45deg) scale(.85)"></i> ${tr("sværere")}</span>` +
    `<span><b style="color:var(--bad)">×</b> ${tr("fejl/gæt")}</span><span><i style="background:var(--mute)"></i> ${tr("hint")}</span>` +
    `<span><i style="background:color-mix(in srgb, var(--bad) 14%, transparent)"></i> ${tr("fejl på pladen")}</span>` +
    `<span><i style="background:var(--chip);box-shadow:inset 0 1px 0 var(--mute)"></i> ${tr("letteste mulige")}</span></div>`;
  return s;
}
// "Tænkt frem": tallet kunne ikke ses direkte på det letteste niveau, men følger, når andre tal er sat først.
// Spilleren har typisk fundet de tal i hovedet og fortsat uden at skrive dem ned. Det er ikke en fejl.
function aheadText(m, nm) {
  const direct =
    m.direct < 12
      ? tr("Direkte krævede det {tech}.", { tech: LEVEL_TECH[m.direct] })
      : tr("Direkte kunne det slet ikke udledes.");
  if (m.via && m.via.length) {
    const via = list2(m.via.map(([c, v]) => nm(c) + " = " + v)) + (m.placed > m.via.length ? " " + tr("m.fl.") : "");
    return (
      tr("{cell} = {v} kunne ikke ses direkte med {tech}, men følger, når {via} er sat.", { cell: nm(m.c), v: m.v, tech: LEVEL_TECH[m.ahead], via }) +
      " " +
      direct +
      " " +
      tr("Du har sandsynligvis fundet {via} i hovedet og fortsat derfra uden at skrive det ned. Det er ikke en fejl, men søgetiden dækker mere end ét tal.", { via })
    );
  }
  return (
    (m.placed === 1
      ? tr("{cell} = {v} kunne ses med {tech}, men først når 1 andet tal var sat i hovedet.", { cell: nm(m.c), v: m.v, tech: LEVEL_TECH[m.ahead] })
      : tr("{cell} = {v} kunne ses med {tech}, men først når {n} andre tal var sat i hovedet.", { cell: nm(m.c), v: m.v, tech: LEVEL_TECH[m.ahead], n: m.placed })) +
    " " +
    direct +
    " " +
    tr("Det er ikke en fejl, men søgetiden dækker mere end ét tal.")
  );
}
const list2 = (arr) => (arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " " + tr("og") + " " + arr[arr.length - 1]);
// back: åbnet fra løst-arket. Så fører Luk tilbage dertil, og der er en direkte knap til en ny opgave.
function showRoute(g, back) {
  const list = g.moves,
    r = g.route || routeSummary(list),
    p = { cols: g.cols };
  const nm = (c) => "abcdefghij"[c % g.cols] + (Math.floor(c / g.cols) + 1);
  const pct = r.n ? Math.round((100 * r.easy) / r.n) : 0;
  const base = baseline(g.id);
  // Fejl-episoder: hovedfejl med følgefejl og de tal, der blev sat imens
  const episodes = list
    .map((m, i) => Object.assign({ i }, m))
    .filter((m) => m.cls === "wrong" && !m.follow && !m.slip)
    .map((m) => {
      const follow = list.map((x, j) => Object.assign({ i: j }, x)).filter((x) => x.cls === "wrong" && x.follow && x.cause === m.i);
      const amid = list.filter((x) => x.amid && x.cause === m.i).length;
      const ends = [m, ...follow].map((x) => x.fixT);
      const fixed = ends.every((t) => t !== undefined) ? Math.max(...ends) : null;
      return { m, follow, amid, fixed };
    });
  const verdict =
    pct >= 90
      ? tr("Du fulgte stort set den letteste rute.")
      : pct >= 70
        ? tr("Du fulgte mest den letteste rute, med nogle omveje.")
        : pct >= 50
          ? tr("Du tog ofte en anden vej end den letteste.")
          : tr("Din rute afveg meget fra den letteste.");

  // Tid pr. teknik i dette spil, sammenlignet med din normale tid
  const times = timesOf(g);
  const tRows = Object.keys(times)
    .map(Number)
    .sort((a, b) => a - b)
    .map((L) => {
      const med = median(times[L]),
        bl = base[L];
      let cmp = "";
      if (bl && times[L].length >= 1) {
        const d = med / Math.max(1, bl.med);
        cmp = d >= 1.4 ? tr("langsommere end normalt") : d <= 0.7 ? tr("hurtigere end normalt") : "";
      }
      return (
        `<tr><td>${L}</td><td>${esc(LEVEL_TECH[L])}</td><td>${times[L].length}</td><td><b>${fmtS(med)}</b></td><td>${bl ? fmtS(bl.med) : "–"}</td></tr>` +
        (cmp
          ? `<tr><td></td><td colspan="4" style="border-top:0;padding-top:0;color:var(--mute)">${cmp}</td></tr>`
          : "")
      );
    })
    .join("");

  // Her sad du fast: lang søgning i forhold til din normale tid for det letteste niveau, der fandtes
  const all = list.filter((m) => m.cls !== "hint" && m.cls !== "wrong");
  const gameMed = median(all.map((m) => m.dt / 1000));
  const stuck = list
    .map((m, i) => Object.assign({ i }, m))
    .filter((m) => m.best && judged(m))
    .filter((m) => {
      const bl = base[m.avail],
        sec = m.dt / 1000;
      return bl ? sec >= Math.max(30, 2.5 * bl.med) : sec >= Math.max(45, 3 * gameMed);
    })
    .sort((a, b) => b.dt - a.dt)
    .slice(0, 3);
  const stuckText = (m) => {
    const lv = moveLevel(m) || m.avail,
      bl = base[m.avail];
    const usual = bl ? " " + tr("Et træk med {tech} plejer at tage dig {tid}.", { tech: LEVEL_TECH[m.avail], tid: fmtS(bl.med) }) : "";
    const few =
      m.nAvail === 1
        ? tr("Der var kun ét tal, der kunne findes på det niveau, så det var svært at få øje på.")
        : m.nAvail <= 3
          ? tr("Der var kun {n} tal at finde på det niveau.", { n: m.nAvail })
          : tr("Der var {n} tal at finde på det niveau.", { n: m.nAvail });
    const head = `<b class="k">${tr("Træk {k} · ledte i {tid}", { k: m.i + 1, tid: fmt(m.dt) })}</b><span class="tag ${m.cls}">${ROUTE_CLS[m.cls].label}</span><br>`;
    if (m.cls === "ahead") return head + aheadText(m, nm) + usual + mboardSlot(g, m);
    if (m.best.c === m.c && m.best.v === m.v)
      return head + tr("Du fandt {cell} = {v}, som var det letteste træk ({tech}).", { cell: nm(m.c), v: m.v, tech: LEVEL_TECH[m.avail] }) + " " + few + usual + mboardSlot(g, m, "easy");
    if (m.cls === "easy")
      return head + tr("Du fandt {cell} = {v} med {tech}.", { cell: nm(m.c), v: m.v, tech: LEVEL_TECH[lv] }) + " " + few + " " + tr("Fx {cell} = {v}.", { cell: nm(m.best.c), v: m.best.v }) + usual + mboardSlot(g, m, "easy");
    return (
      head +
      tr("Du endte med {cell} = {v}, som krævede {tech}. Imens fandtes {easy}, fx {bcell} = {bv}.", { cell: nm(m.c), v: m.v, tech: LEVEL_TECH[lv], easy: LEVEL_TECH[m.avail], bcell: nm(m.best.c), bv: m.best.v }) + " " + few + usual +
      (m.cls === "harder" ? mboardSlot(g, m) : "")
    );
  };

  const notable = list
    .map((m, i) => Object.assign({ i }, m))
    .filter((m) => m.cls !== "easy" && m.cls !== "wrong" && judged(m))
    .sort(
      (a, b) =>
        (b.cls === "harder" ? Math.min(b.direct, b.ahead || 12) - b.avail : b.cls === "ahead" ? 0.5 : 0.8) -
          (a.cls === "harder" ? Math.min(a.direct, a.ahead || 12) - a.avail : a.cls === "ahead" ? 0.5 : 0.8) || a.i - b.i,
    )
    .slice(0, 8);
  const ntext = (m) => {
    const head = `<b class="k">${tr("Træk {k}", { k: m.i + 1 })} · ${nm(m.c)} = ${m.v} · ${fmt(m.dt)}</b><span class="tag ${m.cls}">${ROUTE_CLS[m.cls].label}</span>`;
    if (m.cls === "harder") {
      const lv = Math.min(m.direct, m.ahead || 12);
      return head + "<br>" + tr("Krævede {tech}. Det letteste træk lige da var {easy}.", { tech: LEVEL_TECH[lv], easy: LEVEL_TECH[m.avail] }) + mboardSlot(g, m);
    }
    if (m.cls === "ahead") return head + "<br>" + aheadText(m, nm) + mboardSlot(g, m);
    if (m.cls === "wrong") return head + "<br>" + tr("Tallet var forkert.");
    return head + "<br>" + tr("Kunne ikke udledes af tallene på pladen på det tidspunkt.");
  };
  // Det vigtigste, kort og i den rækkefølge det betyder noget
  const key = [];
  if (episodes.length) {
    const nf = episodes.reduce((t, e) => t + e.follow.length, 0),
      na = episodes.reduce((t, e) => t + e.amid, 0);
    key.push(
      (episodes.length === 1 ? tr("<b>1 fejl</b>") : tr("<b>{n} fejl</b>", { n: episodes.length })) +
        (nf ? " " + (nf === 1 ? tr("førte til 1 følgefejl") : tr("førte til {n} følgefejl", { n: nf })) : "") +
        "." +
        (na ? " " + (na === 1 ? tr("1 tal sat imens er ikke bedømt.") : tr("{n} tal sat imens er ikke bedømt.", { n: na })) : ""),
    );
  }
  const nc = list.reduce((a, m) => a + (m.chk || 0), 0);
  if (nc) key.push(nc === 1 ? tr("Du fik vist fejl 1 gang. Det tæller som et hint.") : tr("Du fik vist fejl {n} gange. Det tæller som hints.", { n: nc }));
  const ns = list.filter((m) => m.slip).length;
  if (ns)
    key.push(
      ns === 1
        ? tr("1 fejltryk, rettet med det samme, tæller ikke som fejl.")
        : tr("{n} fejltryk, rettet med det samme, tæller ikke som fejl.", { n: ns }),
    );
  const nu = list.filter((m) => m.unsure).length;
  if (nu)
    key.push(
      (nu === 1 ? tr("1 træk efter en fejl er ikke bedømt.") : tr("{n} træk efter en fejl er ikke bedømt.", { n: nu })) +
        " " +
        tr("Spillet er fra en ældre version, der ikke gemte viskelæder, så det vides ikke, hvordan pladen så ud."),
    );
  if (r.harder) key.push(r.harder === 1 ? tr("<b>1 gang</b> et sværere træk end nødvendigt.") : tr("<b>{n} gange</b> et sværere træk end nødvendigt.", { n: r.harder }));
  if (stuck.length) key.push(tr("<b>Længst søgning:</b> {tid} før træk {k}.", { tid: fmt(stuck[0].dt), k: stuck[0].i + 1 }));
  if (r.ahead) key.push(r.ahead === 1 ? tr("1 gang tænkte du frem. Det er ikke en fejl.") : tr("{n} gange tænkte du frem. Det er ikke en fejl.", { n: r.ahead }));
  if (r.guess) key.push(tr("{n} tal kunne ikke udledes og ligner gæt, der gik godt.", { n: r.guess }));
  if (r.hints) key.push(r.hints === 1 ? tr("1 tal blev sat med hint og tæller ikke med.") : tr("{n} tal blev sat med hint og tæller ikke med.", { n: r.hints }));

  const epText = (e) =>
    `<b class="k">${tr("Træk {k}", { k: e.m.i + 1 })} · ${nm(e.m.c)} = ${e.m.v}</b><br>` +
    (e.m.legacy ? "" : e.fixed !== null ? tr("Rettet efter {tid}.", { tid: fmt(e.fixed - e.m.t) }) : tr("Ikke rettet.")) +
    (e.m.shown ? " " + tr("Fundet med «Tjek fejl».") : "") +
    (e.follow.length ? " " + tr("Følgefejl: {list}.", { list: list2(e.follow.map((x) => nm(x.c) + " = " + x.v)) }) : "") +
    (e.amid ? " " + (e.amid === 1 ? tr("1 rigtigt tal sat imens er ikke bedømt.") : tr("{n} rigtige tal sat imens er ikke bedømt.", { n: e.amid })) : "");
  const section = (title, count, body, open) =>
    `<details class="rdet"${open ? " open" : ""}><summary><span>${title}</span>${count !== "" ? `<small>${count}</small>` : ""}</summary>${body}</details>`;
  const lapses = concRouteHtml(g, nm);
  const nLapse = (concGet(g) || { idx: [] }).idx.filter((i) => list[i] && list[i].cls !== "wrong").length;

  openSheet(
    `<h2>${tr("Din løsningsrute")}</h2><p class="sub" style="color:var(--mute)">${esc(BAND[gBand(g)])} ${dec(g.value)} · ${g.cols}×${g.rows} · ${new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" })} · ${fmt(g.ms)}</p>` +
      `<div class="rkpi"><b>${pct} %</b><span>${tr("af {n} træk var et af de letteste mulige lige da.", { n: r.n })}<br>${verdict}</span></div>` +
      (key.length ? `<ul class="keypts">${key.map((t) => `<li>${t}</li>`).join("")}</ul>` : "") +
      routeChart(list, p) +
      `<p class="caveat" style="margin-top:4px!important">${tr("Hver streg er tiden fra forrige tal, til du satte dette. Lange streger er der, hvor du ledte.")}</p>` +
      `<div class="rsecs">` +
      (episodes.length ? section(tr("Fejl"), episodes.length, `<ul class="notable">${episodes.map((e) => `<li>${epText(e)}</li>`).join("")}</ul>`, true) : "") +
      (stuck.length ? section(tr("Her ledte du længe"), stuck.length, `<ul class="notable">${stuck.map((m) => `<li>${stuckText(m)}</li>`).join("")}</ul>`) : "") +
      (notable.length ? section(tr("Træk at kigge på"), notable.length, `<ul class="notable">${notable.map((m) => `<li>${ntext(m)}</li>`).join("")}</ul>`) : "") +
      (tRows
        ? section(
            tr("Tid pr. teknik"),
            "",
            `<table class="data"><tr><th></th><th>${tr("Trækket krævede")}</th><th>${tr("Træk")}</th><th>${tr("Median")}</th><th>${tr("Normalt")}</th></tr>${tRows}</table>` +
              (Object.keys(base).length ? "" : `<p class="caveat">${tr("»Normalt« udfyldes, når du har løst et par opgaver mere.")}</p>`),
          )
        : "") +
      (nLapse ? section(tr("Udfald i koncentrationen"), nLapse, lapses) : "") +
      section(
        tr("Om analysen"),
        "",
        `<p class="caveat">${tr("Analysen kender kun tallene, du skrev, og hvornår. Tiden er fra forrige tal, så hvis du fandt to tal på én gang, ser det andet hurtigt ud, og tid brugt på blyantsnoter tæller med. Et »sværere« træk kan også være fundet ad en anden vej.")}</p>` +
          `<p class="caveat">${tr("En fejl tæller én gang, selv om den fører til flere forkerte tal. Tal, der bliver sat, mens et forkert tal står på pladen, bedømmes ikke, fordi de er fundet ud fra en forkert stilling.")}</p>`,
      ) +
      `</div>` +
      (back
        ? `<div class="actions"><button class="primary big" type="button" id="rtNew">${tr("Ny opgave")} · ${esc(BAND[ui.level])}</button>` +
          `<div class="actions row2" style="margin:0"><button class="secondary" type="button" id="rtAgain">${tr("Spil igen")}</button><button class="secondary" type="button" id="rtClose">${tr("Tilbage")}</button></div></div>`
        : `<div class="actions row2"><button class="secondary" type="button" id="rtAgain">${tr("Spil igen")}</button><button class="primary" type="button" id="rtClose">${tr("Luk")}</button></div>`),
    (b2) => {
      bindMboards(b2, g);
      b2.querySelector("#rtClose").onclick = closeSheet;
      const leave = (f) => {
        sheetOnClose = null; // ikke tilbage til løst-arket, når man går videre
        closeSheet();
        setTimeout(f, 280);
      };
      b2.querySelector("#rtAgain").onclick = () => leave(() => replaceGame(() => importCode(g.code, { replay: true })));
      if (back) b2.querySelector("#rtNew").onclick = () => leave(generateFromUi);
    },
    back ? () => setTimeout(back, 280) : null,
  );
}
// ---------- Pladen ved et sværere træk: hvad du gjorde, og hvad der var lettere lige da
// Pladen genskabes ud fra opgavekoden og dine rigtige tal før trækket. Begge forklaringer laves af hint-motoren.
// mode "cmp": dit træk mod det letteste træk lige da. mode "easy": dit træk og alle de lette tal, der kunne tages.
const mboardSlot = (g, m, mode = "cmp") => (g.code ? `<div class="mboard" data-mi="${m.i}" data-mode="${mode}"><span class="mbwait">${tr("Tegner pladen …")}</span></div>` : "");
const ROUTE_PUZ = {};
function routePuzzle(g) {
  if (ROUTE_PUZ[g.id]) return ROUTE_PUZ[g.id];
  const d = decodePuzzle(g.code),
    G2 = E.makeGeometry(d.rows, d.cols),
    u = E.createSolver(G2, d.region).uniqueSolution(d.givens);
  if (!u.solution) return null;
  const size = {};
  d.region.forEach((r) => (size[r] = (size[r] || 0) + 1));
  return (ROUTE_PUZ[g.id] = { d, G: G2, sol: Array.from(u.solution), tu: createTutor(G2, d.region), maxR: Math.max(...Object.values(size)) });
}
// Pladen lige før træk i. Nyere spil gemmer den præcist (b). Ældre spil genskabes ud fra de placerede tal; viskelæder,
// fortryd og "start forfra" er ikke gemt der, så et tal, der senere sættes igen i samme felt, kan have været væk
// imellem. De felter er usikre (unsure), og så tegnes pladen ikke.
// Resultat: rigtige tal (til hint-motoren) med .wrong = [[felt, tal]] for forkerte tal på pladen og .unsure = [felter].
function boardBefore(P2, list, i) {
  const k = P2.d.givens.slice(),
    wrong = [],
    unsure = [];
  const b = list[i].b;
  if (b && b.length === k.length) {
    for (let c = 0; c < k.length; c++) {
      const v = +b[c];
      if (!v || k[c]) continue;
      if (v === P2.sol[c]) k[c] = v;
      else wrong.push([c, v]);
    }
  } else {
    for (let j = 0; j < i; j++) {
      const x = list[j];
      if (x.v === P2.sol[x.c] && !k[x.c]) k[x.c] = x.v;
    }
    (list[i].er || []).forEach((c) => (k[c] = P2.d.givens[c] || 0)); // visket ud igen
    if (!P2.d.givens[list[i].c]) k[list[i].c] = 0; // feltet, der udfyldes nu, var tomt (eller havde et forkert tal)
    for (let j = i; j < list.length; j++) {
      const x = list[j];
      if (x.v === P2.sol[x.c] && k[x.c] && !P2.d.givens[x.c] && !(list[i].er || []).includes(x.c) && unsure.indexOf(x.c) < 0 && j !== i) unsure.push(x.c);
    }
  }
  k.wrong = wrong;
  k.unsure = unsure;
  return k;
}
// Den del af forklaringen, der viser det afgørende: skridtet med den sværeste teknik, eller selve tallet ved enkle træk
function keyView(h) {
  const steps = h.views.filter((v) => !v.nudge && !v.final);
  if (!steps.length) return h.views[h.views.length - 1];
  const hard = steps.filter((v) => v.tech === h.hardest);
  const kv = (hard.length ? hard[hard.length - 1] : steps[steps.length - 1]) || steps[0];
  // Ved hvis-så er antagelsen (med de antagne tal på pladen) mere sigende end konklusionen alene
  const prev = h.views[h.views.indexOf(kv) - 1];
  if (prev && prev.hypo && prev.tech === kv.tech && !kv.hypo) return Object.assign({}, prev, { text: prev.text + " " + kv.text });
  return kv;
}
function miniBoard(P2, known, hv, mark, head = {}) {
  const wrongAt = {};
  (known.wrong || []).forEach(([c, v]) => (wrongAt[c] = v));
  const marks = Array.isArray(mark) ? mark : mark ? [mark] : [];
  const { rows, cols, region } = P2.d,
    S = 100,
    giv = P2.d.givens,
    pos = P2.maxR >= 6 ? NOTE_POS6 : NOTE_POS5;
  const pat = new Set(hv ? hv.pattern || [] : []),
    tgt = new Set(hv ? hv.target || [] : []),
    bad = new Set(hv && hv.bad ? hv.bad : []),
    hypo = (hv && hv.hypo) || {},
    cand = (hv && hv.cand) || {},
    strike = (hv && hv.strike) || {};
  let s = `<svg viewBox="-30 -30 ${cols * S + 36} ${rows * S + 36}" role="img" aria-label="${esc(tr("Pladen før trækket"))}">`;
  for (let c = 0; c < cols; c++) s += `<text x="${c * S + 50}" y="-10" font-size="22" text-anchor="middle" fill="var(--mute)">${"abcdefghij"[c]}</text>`;
  for (let r = 0; r < rows; r++) s += `<text x="-16" y="${r * S + 58}" font-size="22" text-anchor="middle" fill="var(--mute)">${r + 1}</text>`;
  for (let i = 0; i < rows * cols; i++) {
    const x = (i % cols) * S,
      y = Math.floor(i / cols) * S;
    let fill = giv[i] ? "var(--given)" : "var(--cell)";
    if (pat.has(i)) fill = "var(--pat)";
    if (tgt.has(i)) fill = "var(--tgt)";
    if (bad.has(i)) fill = "var(--badbg)";
    s += `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${fill}" stroke="var(--grid)" stroke-width="2"/>`;
    const v = known[i];
    if (v)
      s += giv[i]
        ? `<text x="${x + 50}" y="${y + 72}" font-size="62" font-weight="800" text-anchor="middle" fill="var(--ink)" font-family="Shippori Mincho B1, Georgia, serif">${v}</text>`
        : `<text x="${x + 50}" y="${y + 70}" font-size="54" text-anchor="middle" fill="var(--indigo)">${v}</text>`;
    else if (wrongAt[i] !== undefined && !(mark && (Array.isArray(mark) ? mark : [mark]).some((k) => k.c === i)))
      s += `<text x="${x + 50}" y="${y + 70}" font-size="54" text-anchor="middle" fill="var(--bad)">${wrongAt[i]}</text>`;
    else if (head[i] !== undefined) {
      s += `<circle cx="${x + 50}" cy="${y + 50}" r="34" fill="none" stroke="var(--warn)" stroke-width="3" stroke-dasharray="5 6"/>`;
      s += `<text x="${x + 50}" y="${y + 67}" font-size="46" font-weight="700" text-anchor="middle" fill="var(--warn)">${head[i]}</text>`;
    } else if (marks.some((k) => k.c === i)) {
      const mk = marks.find((k) => k.c === i);
      s += `<circle cx="${x + 50}" cy="${y + 50}" r="40" fill="none" stroke="${mk.col}" stroke-width="6"/>`;
      s += `<text x="${x + 50}" y="${y + 70}" font-size="56" font-weight="800" text-anchor="middle" fill="${mk.col}">${mk.v}</text>`;
    } else if (hypo[i] !== undefined) {
      s += `<circle cx="${x + 50}" cy="${y + 50}" r="36" fill="none" stroke="var(--hypo)" stroke-width="3" stroke-dasharray="5 6"/>`;
      s += `<text x="${x + 50}" y="${y + 68}" font-size="48" font-weight="700" text-anchor="middle" fill="var(--hypo)">${hypo[i]}</text>`;
    } else if (cand[i] !== undefined) {
      for (let dg = 1; dg <= 6; dg++) {
        if (!(cand[i] & (1 << dg)) || !pos[dg]) continue;
        const [px, py] = pos[dg],
          st = (strike[i] || 0) & (1 << dg);
        s += `<text x="${x + px}" y="${y + py + 9}" font-size="25" text-anchor="middle" fill="${st ? "var(--bad)" : "var(--mute)"}" font-weight="${st ? 700 : 500}">${dg}</text>`;
        if (st) s += `<line x1="${x + px - 11}" y1="${y + py + 11}" x2="${x + px + 11}" y2="${y + py - 9}" stroke="var(--bad)" stroke-width="3" stroke-linecap="round"/>`;
      }
    }
  }
  // Regionsgrænser
  let path = "";
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c < cols - 1 && region[i] !== region[i + 1]) path += `M${(c + 1) * S} ${r * S}v${S}`;
      if (r < rows - 1 && region[i] !== region[i + cols]) path += `M${c * S} ${(r + 1) * S}h${S}`;
    }
  s += `<path d="${path}" stroke="var(--ink)" stroke-width="6" stroke-linecap="square" fill="none"/>`;
  s += `<rect x="0" y="0" width="${cols * S}" height="${rows * S}" fill="none" stroke="var(--ink)" stroke-width="7"/></svg>`;
  return s;
}
function mboardHtml(g, i, mode) {
  const P2 = routePuzzle(g);
  if (!P2) return "";
  const list = g.moves,
    m = list[i],
    known = boardBefore(P2, list, i);
  const nm = (c) => "abcdefghij"[c % P2.d.cols] + (Math.floor(c / P2.d.cols) + 1);
  if (known.unsure.length)
    return `<p class="mbnote">${tr("Pladen kan ikke tegnes sikkert her. Spillet er fra før appen gemte hele pladen, og nogle tal blev visket ud eller fortrudt undervejs ({cells}), så det vides ikke, om de stod der.", { cells: list2(known.unsure.slice(0, 4).map(nm)) + (known.unsure.length > 4 ? " " + tr("m.fl.") : "") })}</p>`;
  if (mode === "err") {
    // En fejl: det du satte, og hvad der skulle stå (med forklaring, hvis det kunne ses uden at gætte)
    const right = P2.sol[m.c],
      h = P2.tu.explainMove(known, m.c, right),
      alt = h ? null : P2.tu.easiest(known);
    const hh = h || alt,
      kv = hh ? keyView(hh) : null;
    const left =
      `<figure class="mbcol"><figcaption><b style="color:var(--bad)">${tr("Det du satte")}</b><br>${nm(m.c)} = ${m.v}</figcaption>` +
      miniBoard(P2, known, null, { c: m.c, v: m.v, col: "var(--bad)" }) +
      `</figure>`;
    const rightCol = hh
      ? `<figure class="mbcol"><figcaption><b style="color:var(--indigo)">${h ? tr("Det rigtige") : tr("Det letteste lige da")}</b><br>${nm(hh.cell)} = ${hh.v} · ${esc(LEVEL_TECH[hh.hardestLevel])}</figcaption>` +
        miniBoard(P2, known, kv, { c: hh.cell, v: hh.v, col: "var(--indigo)" }) +
        (kv && kv.text ? `<p class="mbtext">${esc(kv.text)}</p>` : "") +
        `</figure>`
      : "";
    return `<div class="mbpair">${left}${rightCol}</div>`;
  }
  if (mode === "easy") {
    // Et let tal, der trak ud: hvad du fandt, og hvor mange andre lette tal der stod klar
    const mine = P2.tu.explainMove(known, m.c, m.v),
      kv = mine ? keyView(mine) : null,
      all = P2.tu.easyList(known);
    const left =
      `<figure class="mbcol"><figcaption><b style="color:var(--warn)">${tr("Det du fandt")}</b><br>${nm(m.c)} = ${m.v}${mine ? " · " + esc(LEVEL_TECH[mine.hardestLevel]) : ""}</figcaption>` +
      miniBoard(P2, known, kv, { c: m.c, v: m.v, col: "var(--warn)" }) +
      (kv && kv.text ? `<p class="mbtext">${esc(kv.text)}</p>` : "") +
      `</figure>`;
    const others = all.filter(([c]) => c !== m.c);
    const right = others.length
      ? `<figure class="mbcol"><figcaption><b style="color:var(--indigo)">${tr("Lette tal lige da")}</b><br>${others.length === 1 ? tr("Ét andet at vælge") : tr("{n} andre at vælge imellem", { n: others.length })}</figcaption>` +
        miniBoard(
          P2,
          known,
          null,
          others.map(([c, v]) => ({ c, v, col: "var(--indigo)" })).concat([{ c: m.c, v: m.v, col: "var(--warn)" }]),
        ) +
        `<p class="mbtext">${tr("Alle de tal, der kunne ses direkte: det eneste tal i et felt eller den eneste plads til et tal i en region.")}</p></figure>`
      : `<figure class="mbcol"><figcaption><b style="color:var(--indigo)">${tr("Lette tal lige da")}</b><br>${tr("Det var det eneste.")}</figcaption></figure>`;
    return `<div class="mbpair">${left}${right}</div>`;
  }
  // Kunne trækket findes lettere ved at sætte andre tal i hovedet først (tænkt frem)? Så vises den vej.
  // Kunne trækket findes lettere ved at sætte andre tal i hovedet først (tænkt frem)? Så vises den vej,
  // og det sværeste skridt på vejen er det, der tegnes.
  const r = P2.tu.routeMove(known, m.c, m.v),
    head = {};
  let mine,
    extra = "",
    lvl = null;
  if (r && r.ahead && r.ahead.level < r.direct) {
    const kk = known.slice();
    let best = null;
    for (const [c, v] of r.ahead.via) {
      const h = P2.tu.explainMove(kk, c, v);
      if (h && (!best || h.hardestLevel > best.h.hardestLevel)) best = { h, c, v };
      kk[c] = v;
      head[c] = v;
    }
    const fin = P2.tu.explainMove(kk, m.c, m.v);
    const vs = r.ahead.via.map(([c, v]) => nm(c) + " = " + v),
      viaTxt = list2(vs.slice(0, 4)) + (vs.length > 4 ? " " + tr("m.fl.") : "");
    lvl = r.ahead.level;
    if (best && fin && best.h.hardestLevel > fin.hardestLevel) {
      mine = best.h;
      extra =
        "<br>" +
        tr("først {via} i hovedet ({tech}), derefter {cell} ({tech2})", {
          via: viaTxt,
          tech: LEVEL_TECH[best.h.hardestLevel],
          cell: nm(m.c),
          tech2: LEVEL_TECH[fin.hardestLevel],
        });
    } else {
      mine = fin;
      extra = "<br>" + tr("efter {via} i hovedet", { via: viaTxt });
    }
  } else mine = P2.tu.explainMove(known, m.c, m.v);
  const easy = P2.tu.easiest(known);
  const panel = (h, col, title, c, v, hd, extra, L) => {
    const kv = h ? keyView(h) : null;
    L = L || (h ? h.hardestLevel : 0);
    return (
      `<figure class="mbcol"><figcaption><b style="color:${col}">${title}</b><br>${nm(c)} = ${v}${L ? " · " + esc(LEVEL_TECH[L]) : ""}${extra || ""}</figcaption>` +
      miniBoard(P2, known, kv, { c, v, col }, hd) +
      (kv && kv.text ? `<p class="mbtext">${esc(kv.text)}</p>` : "") +
      `</figure>`
    );
  };
  return (
    `<div class="mbpair">` +
    panel(mine, "var(--warn)", tr("Det du gjorde"), m.c, m.v, head, extra, lvl) +
    (easy ? panel(easy, "var(--indigo)", tr("Det letteste lige da"), easy.cell, easy.v, {}) : "") +
    `</div>` +
    (m.nAvail > 1 ? `<p class="mbnote">${tr("Der var {n} tal at finde på det letteste niveau. Her vises ét af dem.", { n: m.nAvail })}</p>` : "")
  );
}
// Pladerne tegnes først, når afsnittet foldes ud, og ét ad gangen, så arket åbner hurtigt
function bindMboards(root, g) {
  const fill = (det) => {
    const slots = [...det.querySelectorAll(".mboard:not([data-done])")];
    const next = () => {
      const el = slots.shift();
      if (!el) return;
      el.dataset.done = 1;
      try {
        el.innerHTML = mboardHtml(g, +el.dataset.mi, el.dataset.mode) || "";
      } catch (e) {
        el.innerHTML = "";
      }
      setTimeout(next, 0);
    };
    setTimeout(next, 30);
  };
  root.querySelectorAll("details.rdet").forEach((det) => {
    if (!det.querySelector(".mboard")) return;
    det.addEventListener("toggle", () => det.open && fill(det));
    if (det.open) fill(det);
  });
}
// ---------- Koncentration i det enkelte spil
// Et "udfald" er et sted, hvor der ikke burde være noget at lede efter:
//   - et let tal (eneste kandidat/plads), mens mindst 3 lette tal var mulige, som alligevel tog over 3 gange din normale tid (mindst 20 sek.)
//   - et forkert tal
// Udfald pr. 100 træk sammenlignes med, hvad der er normalt for dig.
function concOf(g, base) {
  if (!g.moves) return g.conc || null;
  markErrors(g.moves);
  const mv = g.moves.filter(judged);
  if (mv.length < 8) return null;
  const easyT = mv.filter((m) => m.avail === 1 && m.cls === "easy").map((m) => m.dt / 1000);
  const norm = base[1] ? base[1].med : easyT.length ? median(easyT) : 8;
  const thr = Math.max(20, 3 * norm);
  const slips = [];
  g.moves.forEach((m, i) => {
    if (!judged(m)) return;
    if (m.cls === "wrong") slips.push({ i, kind: "err" });
    else if (m.avail === 1 && (m.nAvail || 0) >= 3 && m.dt / 1000 >= thr) slips.push({ i, kind: "slow" });
  });
  const slow = slips.filter((x) => x.kind === "slow").length,
    err = slips.length - slow;
  return {
    n: mv.length,
    slow,
    err,
    rate: (100 * slips.length) / mv.length,
    thr: Math.round(thr),
    norm: Math.round(norm),
    idx: slips.map((x) => x.i),
    late: slips.filter((x) => g.moves[x.i].t > 0.5 * g.ms).length,
  };
}
function concGet(g) {
  return g.conc || (g.moves ? concOf(g, baseline(g.id)) : null);
}
// Dit normale niveau: median af udfald pr. 100 træk i tidligere spil
function concUsual(excludeId) {
  const r = games
    .filter((g) => g.id !== excludeId)
    .map(concGet)
    .filter(Boolean)
    .map((c) => c.rate);
  return r.length >= 3 ? median(r) : null;
}
// 0 = fint, 1 = dyk, 2 = mistet fokus
function concState(c, usual) {
  if (!c) return 0;
  const k = c.slow + c.err,
    u = usual == null ? 4 : usual;
  return k >= 3 && c.rate >= Math.max(8, 2 * u) ? 2 : k >= 2 && c.rate >= Math.max(5, 1.5 * u) ? 1 : 0;
}
function concLineHtml(g) {
  if (g.routePending) return "";
  const c = concGet(g);
  if (!c) return "";
  const usual = concUsual(g.id),
    st = concState(c, usual);
  const what = [
    c.slow ? (c.slow === 1 ? tr("1 let tal tog over {s} sek.", { s: c.thr }) : tr("{n} lette tal tog over {s} sek.", { n: c.slow, s: c.thr })) : "",
    c.err ? tr("{n} fejl", { n: c.err }) : "",
  ]
    .filter(Boolean)
    .join(" " + tr("og") + " ");
  if (!st)
    return `<p class="insight" style="text-align:left;margin:10px 0 0"><b>${tr("Koncentration: fin.")}</b> ${what ? tr("{what}, og det er inden for det normale for dig.", { what }) : tr("Ingen udfald: ingen lette tal trak ud, og ingen fejl.")}</p>`;
  // Var forrige spil i samme session også ramt?
  const ctx = contexts(),
    me = ctx[g.id],
    sorted = games.slice().sort((a, b) => (a.end < b.end ? -1 : 1)),
    k = sorted.findIndex((x) => x.id === g.id);
  const prev = k > 0 && me && me.idx > 1 ? sorted[k - 1] : null;
  const prevBad = prev && concState(concGet(prev), concUsual(prev.id)) > 0;
  const cmp = usual != null ? " " + tr("Det er {a} udfald pr. 100 træk mod normalt {b}.", { a: c.rate.toFixed(0), b: usual.toFixed(0) }) : "";
  const late = c.late >= 2 && c.late > 0.6 * (c.slow + c.err) ? " " + tr("De fleste kom i anden halvdel af spillet.") : "";
  const advice = prevBad
    ? " <b>" + tr("Det er andet spil i træk. En pause vil sandsynligvis hjælpe mere end en opgave til.") + "</b>"
    : st === 2
      ? " " + tr("Hvis det næste spil ser ud på samme måde, er det tid til en pause.")
      : "";
  const head = st === 2 ? tr("Du mistede fokus undervejs.") : tr("Et dyk i koncentrationen.");
  return `<p class="insight warn" style="text-align:left;margin:10px 0 0"><b>${head}</b> ${tr("{what}, selv om der var flere lette tal at tage.", { what: what[0].toUpperCase() + what.slice(1) })}${cmp}${late}${advice}</p>`;
}
function concRouteHtml(g, nm) {
  const c = concGet(g);
  // Kun de langsomme lette tal; fejlene står i deres eget afsnit
  const idx = c ? c.idx.filter((i) => g.moves[i] && g.moves[i].cls !== "wrong") : [];
  if (!idx.length) return "";
  return (
    `<ul class="notable">` +
    idx
      .slice(0, 6)
      .map((i) => {
        const m = g.moves[i];
        return (
          `<li><b class="k">${tr("Træk {k}", { k: i + 1 })} · ${nm(m.c)} = ${m.v} · ${tr("{tid} inde", { tid: fmt(m.t) })}</b><br>` +
          (m.cls === "wrong"
            ? tr("Forkert tal.")
            : tr("Ledte i {tid}, selv om {n} lette tal var mulige. Normalt tager et let tal dig {s} sek.", { tid: fmt(m.dt), n: m.nAvail, s: c.norm }) +
              mboardSlot(g, { i }, "easy")) +
          `</li>`
        );
      })
      .join("") +
    `</ul>`
  );
}
function concPanel() {
  const list = games
    .map((g) => ({ g, c: concGet(g) }))
    .filter((x) => x.c)
    .slice(-14);
  if (!list.length)
    return `<div class="panelcard"><h3>${tr("Koncentration")}</h3><p>${tr("Efter hvert spil ses her, om lette tal trak ud, eller om der kom fejl, og om det var mere end normalt for dig.")}</p></div>`;
  const W = 320,
    H = 96,
    L = 24,
    B = 14,
    mx = Math.max(10, ...list.map((x) => x.c.rate)),
    bw = Math.min(20, (W - L) / list.length - 4);
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Udfald pr. 100 træk i dine seneste spil")}">`;
  [0, mx / 2, mx].forEach((v) => {
    const y = 6 + (H - B - 6) * (1 - v / mx);
    s += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${L - 6}" y="${y + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${Math.round(v)}</text>`;
  });
  const usualAll = concUsual(null);
  if (usualAll != null) {
    const y = 6 + (H - B - 6) * (1 - usualAll / mx);
    s += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--mute)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  }
  let flagged = 0;
  list.forEach((x, i) => {
    const st = concState(x.c, concUsual(x.g.id));
    if (st) flagged++;
    const h = Math.max(2, ((H - B - 6) * x.c.rate) / mx),
      xx = L + 4 + i * ((W - L - 4) / list.length);
    const d = new Date(x.g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    s +=
      `<rect x="${xx}" y="${H - B - h}" width="${bw}" height="${h}" rx="3" fill="${st === 2 ? "var(--bad)" : st === 1 ? "var(--warn)" : "var(--indigo)"}"/>` +
      `<rect x="${xx - 2}" y="6" width="${bw + 4}" height="${H - B - 6}" fill="transparent" data-tip="${esc(d + " · " + BAND[gBand(x.g)] + " " + dec(x.g.value) + ": " + tr("{a} langsomme lette tal, {b} fejl på {n} træk", { a: x.c.slow, b: x.c.err, n: x.c.n }) + (st === 2 ? " · " + tr("mistet fokus") : st === 1 ? " · " + tr("dyk") : ""))}"/>`;
  });
  s +=
    `</svg><div class="legendrow" style="justify-content:flex-start;gap:4px 12px;flex-wrap:wrap"><span><i style="background:var(--indigo)"></i> ${tr("normalt")}</span><span><i style="background:var(--warn)"></i> ${tr("dyk")}</span>` +
    `<span><i style="background:var(--bad)"></i> ${tr("mistet fokus")}</span><span><svg width="18" height="8" style="vertical-align:middle"><path d="M0 4h18" stroke="var(--mute)" stroke-width="1.5" stroke-dasharray="4 3"/></svg> ${tr("dit normale")}</span></div>`;
  const last = list[list.length - 1];
  return (
    `<div class="panelcard"><h3>${tr("Koncentration")}</h3><p>${tr("Udfald pr. 100 træk i dine seneste {n} spil. Et udfald er et let tal, der tog over 3 gange din normale tid, selv om mindst 3 lette tal var mulige, eller et forkert tal.", { n: list.length })}</p>` +
    concLineHtml(last.g).replace("margin:10px 0 0", "margin:0 0 8px") +
    s +
    `<p class="caveat">${tr("Farven sammenligner hvert spil med dine øvrige spil. Et dyk kræver mindst 2 udfald og 1,5 gange dit normale; mistet fokus mindst 3 udfald og det dobbelte. En afbrydelse (telefon, nogen der spørger om noget) ser ud som et udfald.")}</p></div>`
  );
}

// ---------- Form og træthed
// Tempo = din tid pr. træk divideret med din egen normale tid for samme teknik. 1,00 er normalt, over er langsommere.
function paceOf(g, base) {
  if (!g.moves) return g.pace == null ? null : g.pace;
  const r = [];
  g.moves.forEach((m) => {
    const L = moveLevel(m);
    if (L && m.cls !== "hint" && m.cls !== "wrong" && base[L]) r.push((m.dt / 1000 + 1) / (base[L].med + 1));
  });
  return r.length >= 5 ? median(r) : g.pace == null ? null : g.pace;
}
// Fejl og hints fordelt på spillets første, midterste og sidste tredjedel (i tid)
function thirdsOf(g) {
  if (!g.moves) return g.thirds || null;
  const o = { err: [0, 0, 0], hint: [0, 0, 0] },
    tot = Math.max(1, g.ms);
  g.moves.forEach((m) => {
    const k = Math.min(2, Math.floor((3 * m.t) / tot));
    if (m.cls === "wrong" && !m.follow) o.err[k]++;
    if (m.cls === "hint") o.hint[k]++;
  });
  return o;
}
// Sammenhæng for hvert spil: nummer i sessionen (pause under 30 min = samme session) og tid på dagen
function contexts() {
  const out = {},
    sorted = games.slice().sort((a, b) => (a.end < b.end ? -1 : 1));
  let prevEnd = 0,
    idx = 0,
    sessStart = 0;
  sorted.forEach((g) => {
    const end = +new Date(g.end),
      start = end - g.ms;
    if (start - prevEnd < 30 * 60000 && prevEnd) idx++;
    else {
      idx = 1;
      sessStart = start;
    }
    const h = new Date(start).getHours();
    out[g.id] = { idx, into: (start - sessStart) / 60000, part: h >= 5 && h < 11 ? 0 : h < 17 ? 1 : h < 22 ? 2 : 3 };
    prevEnd = end;
  });
  return out;
}
function formPanel() {
  const base = baseline(null),
    ctx = contexts();
  const rows = games.map((g) => ({ g, c: ctx[g.id], pace: paceOf(g, base) })).filter((x) => x.c && (x.pace != null || x.g.route));
  if (rows.length < 4)
    return `<div class="panelcard"><h3>${tr("Form og træthed")}</h3><p>${tr("Her kommer til at stå, om du bliver langsommere eller laver flere fejl sent i en session, på bestemte tidspunkter af dagen eller sidst i en opgave. Det kræver mindst 4 analyserede spil.")}</p></div>`;
  const agg = (list) => {
    const p = list.map((x) => x.pace).filter((v) => v != null),
      n = list.reduce((a, x) => a + ((x.g.route || {}).n || 0), 0);
    return {
      games: list.length,
      pace: p.length >= 2 ? median(p) : null,
      err: n ? (100 * list.reduce((a, x) => a + ((x.g.route || {}).wrong || 0), 0)) / n : null,
      hints: list.length ? list.reduce((a, x) => a + (x.g.hints || 0), 0) / list.length : 0,
      gaveUp: list.length ? list.filter((x) => !x.g.solved).length / list.length : 0,
    };
  };
  const groups = [
    {
      name: tr("Nummer i sessionen"),
      key: "sess",
      items: [
        [tr("1. spil"), (x) => x.c.idx === 1],
        [tr("2. spil"), (x) => x.c.idx === 2],
        [tr("3. spil eller senere"), (x) => x.c.idx >= 3],
      ],
    },
    {
      name: tr("Tid på dagen"),
      key: "day",
      items: [
        [tr("Morgen 5–11"), (x) => x.c.part === 0],
        [tr("Eftermiddag 11–17"), (x) => x.c.part === 1],
        [tr("Aften 17–22"), (x) => x.c.part === 2],
        [tr("Nat 22–5"), (x) => x.c.part === 3],
      ],
    },
  ];
  const pc = (v) => (v == null ? "–" : (v >= 1 ? "+" : "−") + Math.abs(Math.round((v - 1) * 100)) + " %");
  let table = `<table class="data"><tr><th></th><th class="num">${tr("Spil")}</th><th class="num">${tr("Tempo")}</th><th class="num">${tr("Fejl/100")}</th><th class="num">${tr("Hints")}</th></tr>`,
    insights = [];
  groups.forEach((gr) => {
    table += `<tr class="grp"><td colspan="5">${gr.name}</td></tr>`;
    const res = gr.items.map(([label, f]) => ({ label, a: agg(rows.filter(f)) }));
    res.forEach(({ label, a }) => {
      if (a.games)
        table +=
          `<tr><td>${label}</td><td class="num">${a.games}</td><td class="num">${pc(a.pace)}</td>` +
          `<td class="num">${a.err == null ? "–" : dec(a.err, 1)}</td><td class="num">${dec(a.hints, 1)}</td></tr>`;
    });
    const ok = res.filter((r) => r.a.games >= 3 && r.a.pace != null);
    if (ok.length >= 2) {
      const best = ok.reduce((x, y) => (y.a.pace < x.a.pace ? y : x)),
        worst = ok.reduce((x, y) => (y.a.pace > x.a.pace ? y : x));
      if (worst.a.pace / best.a.pace >= 1.15)
        insights.push(
          tr("<b>{worst}</b> er du {pct} % langsommere pr. træk end <b>{best}</b>, for de samme teknikker", { worst: worst.label, pct: Math.round((worst.a.pace / best.a.pace - 1) * 100), best: best.label.toLowerCase() }) +
            (worst.a.err != null && best.a.err != null && worst.a.err > best.a.err + 1
              ? tr(", og du laver flere fejl ({a} mod {b} pr. 100 træk)", { a: dec(worst.a.err, 1), b: dec(best.a.err, 1) })
              : "") +
            `.`,
        );
    }
  });
  table += `</table>`;
  // Fejl og hints inde i opgaven
  const th = { err: [0, 0, 0], hint: [0, 0, 0] };
  games.forEach((g) => {
    const t = thirdsOf(g);
    if (t) for (const k of ["err", "hint"]) t[k].forEach((v, i) => (th[k][i] += v));
  });
  const sumE = th.err.reduce((a, b) => a + b, 0),
    sumH = th.hint.reduce((a, b) => a + b, 0);
  let inGame = "";
  if (sumE + sumH >= 3) {
    inGame =
      `<h4 style="margin:14px 0 2px;font-size:13px">${tr("Hvornår i opgaven")}</h4><table class="data"><tr><th></th><th class="num">${tr("Første tredjedel")}</th><th class="num">${tr("Midten")}</th><th class="num">${tr("Sidste")}</th></tr>` +
      `<tr><td>${tr("Fejl")}</td>${th.err.map((v) => `<td class="num">${v}</td>`).join("")}</tr><tr><td>${tr("Hints")}</td>${th.hint.map((v) => `<td class="num">${v}</td>`).join("")}</tr></table>`;
    if (sumE >= 5 && th.err[2] > 0.5 * sumE)
      insights.push(
        tr("Over halvdelen af dine fejl ({a} af {b}) kommer i <b>den sidste tredjedel</b> af opgaven. Der er pladen ellers lettest, så det ligner tab af koncentration snarere end manglende teknik.", { a: th.err[2], b: sumE }),
      );
    if (sumH >= 4 && th.hint[2] > 0.5 * sumH)
      insights.push(
        tr("De fleste hints ({a} af {b}) bruges i <b>den sidste tredjedel</b> af tiden. Det tyder på, at du beder om hjælp, når du er kørt træt, ikke kun når teknikken er svær.", { a: th.hint[2], b: sumH }),
      );
  }
  return (
    `<div class="panelcard"><h3>${tr("Form og træthed")}</h3><p>${tr("Tempo er din tid pr. træk i forhold til din egen normale tid for samme teknik. +20 % betyder langsommere end normalt.")}</p>` +
    (insights.length
      ? insights.map((t) => `<p class="insight warn">${t}</p>`).join("")
      : `<p class="insight">${tr("Ingen tydelig forskel endnu. En gruppe skal have mindst 3 spil og afvige 15 %, før den nævnes.")}</p>`) +
    table +
    inGame +
    `<p class="caveat">${tr("Appen kan ikke måle træthed direkte. Den ser kun mønstre i tempo, fejl og hints, og andre ting (støj, afbrydelser, sværere opgaver om aftenen) kan give samme billede. En session er spil med under 30 minutters pause imellem.")}</p></div>`
  );
}

// ---------- Bedømmelse mod virkeligheden: passer sværhedsgraden med din tid og din oplevelse?
function feltExport() {
  return (
    tr("Suguru: bedømmelse mod oplevelse") + "\n" +
    games
      .filter((g) => g.felt != null || g.solved)
      .slice(-60)
      .map((g) =>
        [
          g.code,
          tr("vurderet {v}", { v: dec(g.value) }) + (g.scale === 2 ? "" : " " + tr("(gammel skala)")),
          g.tech ? LEVEL_TECH[g.tech] : "",
          plText(g),
          g.felt != null ? tr("føltes {f}", { f: FELT[g.felt + 2].toLowerCase() }) : tr("ingen vurdering"),
          fmt(g.ms),
          tr("{n} hints", { n: g.hints || 0 }),
          g.route ? Math.round((100 * g.route.easy) / Math.max(1, g.route.n)) + "% " + tr("letteste") : "",
        ].join(" · "),
      )
      .join("\n")
  );
}
function ratingPanel() {
  const pts = games.filter((g) => g.solved && g.empty).map((g) => ({ g, x: +g.value, y: g.ms / 1000 / g.empty }));
  let out = `<div class="panelcard"><h3>${tr("Passer bedømmelsen?")}</h3>`;
  if (pts.length < 5)
    return (
      out +
      `<p>${tr("Når du har løst 5 opgaver, sammenlignes den beregnede sværhedsgrad her med din faktiske tid pr. felt og med, hvordan opgaverne føltes.")}</p></div>`
    );
  const n = pts.length,
    mx = pts.reduce((a, p) => a + p.x, 0) / n,
    my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0),
    sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0),
    syy = pts.reduce((a, p) => a + (p.y - my) ** 2, 0);
  const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0,
    slope = sxx ? sxy / sxx : 0;
  const W = 320,
    H = 170,
    L = 30,
    R = 8,
    T = 8,
    B = 24;
  const x0 = Math.floor(Math.min(...pts.map((p) => p.x))),
    x1 = Math.ceil(Math.max(...pts.map((p) => p.x)) + 0.01),
    y1 = Math.max(...pts.map((p) => p.y)) * 1.1;
  const X = (v) => L + ((W - L - R) * (v - x0)) / Math.max(1, x1 - x0),
    Y = (v) => T + (H - T - B) * (1 - v / y1);
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Beregnet sværhedsgrad mod din tid pr. felt")}">`;
  for (let k = 0; k <= 3; k++) {
    const v = (y1 * k) / 3;
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${L - 6}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${Math.round(v)}</text>`;
  }
  for (let v = x0; v <= x1; v++) s += `<text x="${X(v)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="var(--mute)">${v}</text>`;
  s += `<line x1="${X(x0)}" y1="${Y(Math.max(0, my + slope * (x0 - mx)))}" x2="${X(x1)}" y2="${Y(Math.max(0, my + slope * (x1 - mx)))}" stroke="var(--mute)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  pts.forEach((p) => {
    const g = p.g,
      d = new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    const tip = `${d}: ${BAND[gBand(g)]} ${dec(p.x)} · ${g.cols}×${g.rows} · ${tr("{s} sek. pr. felt", { s: Math.round(p.y) })}${g.hints ? " · " + (g.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: g.hints })) : ""}${g.felt != null ? " · " + tr("føltes {f}", { f: FELT[g.felt + 2].toLowerCase() }) : ""}`;
    s +=
      `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4.5" fill="${g.hints ? "var(--cell)" : "var(--indigo)"}" stroke="${g.hints ? "var(--indigo)" : "var(--cell)"}" stroke-width="2"/>` +
      `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="12" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  s += `</svg><div class="legendrow" style="justify-content:space-between"><span>${tr("sekunder pr. felt ↑ · beregnet sværhedsgrad →")}</span><span><i style="background:var(--indigo);border-radius:50%"></i> ${tr("uden hints")}</span></div>`;
  const corr = (xs) => {
    const m = xs.length,
      ax = xs.reduce((a, q) => a + q[0], 0) / m,
      ay = xs.reduce((a, q) => a + q[1], 0) / m;
    const xy = xs.reduce((a, q) => a + (q[0] - ax) * (q[1] - ay), 0),
      xx = xs.reduce((a, q) => a + (q[0] - ax) ** 2, 0),
      yy = xs.reduce((a, q) => a + (q[1] - ay) ** 2, 0);
    return xx && yy ? xy / Math.sqrt(xx * yy) : 0;
  };
  const two = pts.filter((q) => q.g.peak != null);
  const split =
    two.length >= 8
      ? `<table class="data"><tr><th>${tr("Hvad følger din tid?")}</th><th class="num">${tr("Sammenhæng")}</th></tr>` +
        [
          [tr("Det samlede tal"), two.map((q) => [q.x, q.y])],
          [tr("Top (tungeste skridt)"), two.map((q) => [q.g.peak, q.y])],
          [tr("Mængde (antal tunge skridt)"), two.map((q) => [q.g.load, q.y])],
        ]
          .map(([t, d]) => `<tr><td>${t}</td><td class="num">${dec(corr(d), 2)}</td></tr>`)
          .join("") +
        `</table><p class="caveat">${tr("0 er ingen sammenhæng, 1 er perfekt. Hvis mængde følger din tid bedre end det samlede tal, vejer mængden for lidt i tallet.")}</p>`
      : `<p class="caveat">${tr("Efter 8 løste opgaver på den nye skala vises her, om det er top eller mængde, der bedst følger din tid.")}</p>`;
  const verdict =
    n < 8
      ? tr("For få opgaver til at sige noget sikkert ({n}).", { n })
      : r >= 0.6
        ? tr("Bedømmelsen følger din tid godt (sammenhæng {r} på en skala fra 0 til 1).", { r: dec(r, 2) })
        : r >= 0.3
          ? tr("Bedømmelsen følger kun delvist din tid (sammenhæng {r}). Punkter langt fra den stiplede linje er opgaver, den ramte forkert for dig.", { r: dec(r, 2) })
          : tr("Bedømmelsen forklarer din tid dårligt (sammenhæng {r}). Den måler tydeligvis noget andet end det, der er svært for dig.", { r: dec(r, 2) });
  out +=
    `<p>${tr("Hvert punkt er en løst opgave. Hvis bedømmelsen passer til dig, stiger punkterne mod højre.")}</p><p class="insight ${n >= 8 && r < 0.3 ? "warn" : ""}">${verdict}</p>` +
    s +
    split;
  // Oplevelse
  const felt = games.filter((g) => g.felt != null);
  if (felt.length) {
    const by = {};
    felt.forEach((g) => (by[gBand(g)] = by[gBand(g)] || []).push(g.felt));
    out +=
      `<h4 style="margin:14px 0 2px;font-size:13px">${tr("Din oplevelse ({n} vurderede)", { n: felt.length })}</h4><table class="data"><tr><th>${tr("Grad")}</th><th class="num">${tr("Antal")}</th><th>${tr("Føltes i snit")}</th></tr>` +
      Object.keys(by)
        .map(Number)
        .sort((a, b) => a - b)
        .map((L) => {
          const a = by[L].reduce((x, y) => x + y, 0) / by[L].length;
          return `<tr><td>${L} · ${esc(BAND[L])}</td><td class="num">${by[L].length}</td><td>${a <= -0.5 ? tr("lettere end bedømt") : a >= 0.5 ? tr("sværere end bedømt") : tr("som bedømt")} (${a > 0 ? "+" : ""}${dec(a, 1)})</td></tr>`;
        })
        .join("") +
      `</table>`;
  } else out += `<p class="caveat">${tr("Når du har løst en opgave, kan du svare på, hvordan den føltes. Svarene samles her.")}</p>`;
  return (
    out + `<button class="tablelink" type="button" id="feltCopy">${tr("Kopiér opgaver og vurderinger, så bedømmelsen kan justeres")}</button></div>`
  );
}

// ---------- Fokusområde
// Forventet tid pr. teknik kommer fra din personlige tidskurve (calib.js). Fokusområdet viser, hvilke teknikker der ligger
// over eller under kurven: det er dine relative svagheder og styrker, ikke en sammenligning med andre spillere.
const LEVEL_GUIDE_TECH = [0, 0, 2, 3, 5, 7, 8, 9, 10, 11, 12, 13];
function spotOf(g) {
  if (g.route && g.route.spot) return g.route.spot;
  const o = {};
  (g.moves || []).forEach((m) => {
    if (m.avail && m.cls !== "wrong" && judged(m)) {
      const e = (o[m.avail] = o[m.avail] || [0, 0]);
      e[0]++;
      if (m.cls === "easy") e[1]++;
    }
  });
  return o;
}
function focusData() {
  let src = games.filter((g) => g.route || g.moves || (g.hintTechs || []).length).slice(-40);
  // Spil sent i en lang session eller om natten udelades, hvis der er nok tilbage: ellers ligner træthed en svag teknik
  const ctx = contexts(),
    fresh = src.filter((g) => {
      const c = ctx[g.id];
      return !c || (c.idx < 3 && c.part !== 3);
    });
  const filtered = fresh.length >= 5 && fresh.length >= 0.6 * src.length && fresh.length < src.length;
  if (filtered) src = fresh;
  const T = {},
    S = {},
    H = {},
    M = {};
  src.forEach((g) => {
    const t = timesOf(g);
    for (const L in t) (T[L] = T[L] || []).push(...t[L]);
    const sp = spotOf(g);
    for (const L in sp) {
      const e = (S[L] = S[L] || [0, 0]);
      e[0] += sp[L][0];
      e[1] += sp[L][1];
    }
    (g.hintTechs || []).forEach((t2) => {
      const L = E.TECH[t2].level;
      H[L] = (H[L] || 0) + 1;
    });
  });
  const base = T[1] && T[1].length >= 5 ? median(T[1]) : null;
  const cal = fitCalib(calibRows(src));
  const out = [];
  for (let L = 1; L <= 11; L++) {
    const cl = cal.lvl[L],
      nT = cl ? cl.n : 0,
      sp = S[L],
      h = H[L] || 0;
    if (nT < 3 && !(sp && sp[0] >= 4) && h < 2) continue;
    // Typisk tid, når trækket er det eneste på pladen: din egen for teknikken og den, kurven giver
    const med = nT ? calTime(cal, L, 1, true) : null,
      expected = calTime(cal, L, 1, false);
    const speed = L > 1 && base && nT >= 5 ? Math.exp(-cl.r) : null; // >1: hurtigere end din kurve
    const spot = sp && sp[0] >= 4 ? sp[1] / sp[0] : null; // andel af gangene du tog det letteste, når L var det letteste
    const hintShare = h / Math.max(1, h + nT);
    let score = 0;
    if (speed != null) score += Math.log2(speed);
    if (spot != null) score += 2 * (spot - 0.8);
    score -= 2 * hintShare;
    out.push({ L, nT, med, speed, spot, spotN: sp ? sp[0] : 0, hints: h, hintShare, score, expected });
  }
  return { rows: out, base, games: src.length, filtered, cal };
}
function focusReasons(f, weak) {
  const r = [];
  if (f.speed != null) {
    if (weak && f.speed < 0.8)
      r.push(
        tr("Du bruger {x} gange så lang tid, som din egen kurve forventer: typisk {med}, hvor kurven siger {exp}, når den er det eneste træk.", { x: dec(1 / f.speed), med: fmtS(f.med), exp: fmtS(f.expected) }),
      );
    if (!weak && f.speed > 1.2)
      r.push(
        tr("Du er {x} gange hurtigere, end din egen kurve forventer: typisk {med}, hvor kurven siger {exp}.", { x: dec(f.speed, 1), med: fmtS(f.med), exp: fmtS(f.expected) }),
      );
  }
  if (f.spot != null) {
    const miss = f.spotN - Math.round(f.spot * f.spotN);
    if (weak && f.spot < 0.8)
      r.push(tr("Når den var det letteste træk, overså du den {a} af {b} gange og tog noget sværere eller tænkte frem.", { a: miss, b: f.spotN }));
    if (!weak && f.spot >= 0.9) r.push(tr("Når den var det letteste træk, fandt du den {a} af {b} gange.", { a: Math.round(f.spot * f.spotN), b: f.spotN }));
  }
  if (weak && f.hints >= 2) r.push(tr("{n} af dine hints handlede om den.", { n: f.hints }));
  if (!weak && !f.hints && f.nT >= 5) r.push(tr("Du har aldrig brugt hint til den."));
  return r;
}
function focusPanel() {
  const fd = focusData(),
    rows = fd.rows;
  if (!fd.base || rows.length < 2) {
    const n1 = games.reduce((a, g) => a + (timesOf(g)[1] || []).length, 0);
    return (
      `<div class="panelcard focus"><h3>${tr("Fokusområde")}</h3><p>${tr("Her kommer til at stå, hvilken teknik du er svagest i, og hvor du er stærkere, end teknikken burde give.")} ` +
      `${tr("Det kræver nogle løste opgaver med forskellige teknikker")}${n1 < 5 ? " " + tr("(mindst 5 lette træk for at kende din grundfart)") : ""}.</p></div>`
    );
  }
  const sorted = rows.slice().sort((a, b) => a.score - b.score);
  const weak = sorted.find((f) => f.score < -0.25 && focusReasons(f, true).length);
  const strong = sorted
    .slice()
    .reverse()
    .find((f) => f.score > 0.25 && f !== weak && focusReasons(f, false).length);
  const card = (f, isWeak) =>
    `<div class="fcard ${isWeak ? "weak" : "strong"}"><span class="eyebrow">${isWeak ? tr("Øv dig på") : tr("Din styrke")}</span>` +
    `<strong>${esc(LEVEL_TECH[f.L][0].toUpperCase() + LEVEL_TECH[f.L].slice(1))}</strong>` +
    `<ul>${focusReasons(f, isWeak)
      .map((t) => `<li>${t}</li>`)
      .join("")}</ul>` +
    (isWeak
      ? `<div class="actions row2" style="margin-top:6px"><button class="secondary" type="button" data-guide="${LEVEL_GUIDE_TECH[f.L]}">${tr("Læs i guiden")}</button>` +
        `<button class="primary" type="button" data-train="${f.L}">${tr("Træn teknikken")}</button></div>`
      : "") +
    `</div>`;
  // Divergerende oversigt: forventet tid er midten; til højre hurtigere, til venstre langsommere
  const sp = rows.filter((f) => f.speed != null);
  let chart = "";
  if (sp.length) {
    const W = 320,
      rowH = 24,
      L0 = 120,
      mid = L0 + (W - L0) / 2,
      half = (W - L0) / 2 - 6,
      H = sp.length * rowH + 22;
    const lim = Math.max(1, ...sp.map((f) => Math.abs(Math.log2(f.speed))));
    chart =
      `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Din fart pr. teknik i forhold til din kurve")}">` +
      `<line x1="${mid}" x2="${mid}" y1="4" y2="${H - 18}" stroke="var(--mute)" stroke-width="1.5"/>` +
      `<text x="${mid}" y="${H - 4}" font-size="10" text-anchor="middle" fill="var(--mute)">${tr("din kurve")}</text>` +
      `<text x="${L0 + 2}" y="${H - 4}" font-size="10" fill="var(--mute)">${tr("langsommere")}</text><text x="${W - 2}" y="${H - 4}" font-size="10" text-anchor="end" fill="var(--mute)">${tr("hurtigere")}</text>`;
    sp.forEach((f, i) => {
      const v = Math.log2(f.speed),
        w = Math.max(2, (half * Math.abs(v)) / lim),
        y = 6 + i * rowH;
      const x = v >= 0 ? mid + 1 : mid - 1 - w;
      chart +=
        `<text x="0" y="${y + 13}" font-size="11.5" fill="var(--ink)">${f.L} · ${esc(LEVEL_TECH[f.L].length > 16 ? LEVEL_TECH[f.L].slice(0, 15) + "…" : LEVEL_TECH[f.L])}</text>` +
        `<rect x="${x}" y="${y + 3}" width="${w}" height="12" rx="4" fill="${v >= 0 ? "var(--indigo)" : "var(--warn)"}"` +
        ` data-tip="${esc(LEVEL_TECH[f.L])}: ${tr("typisk {med}, din kurve {exp} ({n} træk)", { med: fmtS(f.med), exp: fmtS(f.expected), n: f.nT })}${f.spot != null ? ", " + tr("fandt den som letteste {pct} %", { pct: Math.round(100 * f.spot) }) : ""}"/>` +
        `<rect x="${L0}" y="${y}" width="${W - L0}" height="${rowH}" fill="transparent" data-tip="${esc(LEVEL_TECH[f.L])}: ${tr("typisk {med}, din kurve {exp} ({n} træk)", { med: fmtS(f.med), exp: fmtS(f.expected), n: f.nT })}"/>`;
    });
    chart += `</svg>`;
  }
  return (
    `<div class="panelcard focus"><h3>${tr("Fokusområde")}</h3><p>${tr("Ud fra dine seneste {n} spil. Din grundfart er {tid} pr. lette træk.", { n: fd.games, tid: fmtS(fd.base) })}${fd.filtered ? " " + tr("Spil sent i en lang session eller om natten er udeladt, så træthed ikke ligner en svag teknik.") : ""}</p>` +
    `<p class="curve">${tr("Din kurve, når trækket er det eneste på pladen:")} ${rows
      .filter((f) => f.nT >= 3)
      .map((f) => `${esc(LEVEL_TECH[f.L])} <b>${fmtS(f.expected)}</b>`)
      .join(" · ")}.</p>` +
    (weak ? card(weak, true) : `<p>${tr("Ingen tydelig svaghed lige nu. Alle teknikker ligger tæt på din kurve.")}</p>`) +
    (strong ? card(strong, false) : "") +
    (chart ? `<h4 style="margin:12px 0 4px;font-size:13px">${tr("Fart pr. teknik i forhold til din kurve")}</h4>${chart}` : "") +
    `<p class="caveat">${tr("»Din kurve« er tilpasset dine egne træk: én jævn kurve for alle teknikker, hvor sværere teknikker tager længere tid, og flere mulige steder gør det hurtigere. Svagheder og styrker er de teknikker, der ligger over eller under kurven. Den siger ikke, om du er hurtig eller langsom i forhold til andre.")} ` +
    `${tr("Fokusområdet vægter tre ting: fart, om du finder teknikken når den er det letteste træk, og hvor mange hints du har brugt til den.")}</p></div>`
  );
}
function bindFocus(root) {
  root.querySelectorAll("[data-train]").forEach(
    (b) =>
      (b.onclick = () => {
        ui.must = +b.dataset.train;
        saveUi();
        go("new");
        toast(tr("Teknik valgt: {tech}", { tech: LEVEL_TECH[ui.must] }));
      }),
  );
  root.querySelectorAll("[data-guide]").forEach((b) => (b.onclick = () => openGuide(+b.dataset.guide)));
}
// Dashboard: hvor lang tid tager hver teknik dig, og bliver du hurtigere?
function timePanel() {
  const withT = games.filter((g) => Object.keys(timesOf(g)).length);
  if (!withT.length) return "";
  const recentIds = new Set(withT.slice(-10).map((g) => g.id));
  const all = {},
    recent = {},
    older = {};
  withT.forEach((g) => {
    const t = timesOf(g);
    for (const L in t) {
      (all[L] = all[L] || []).push(...t[L]);
      const tgt = recentIds.has(g.id) ? recent : older;
      (tgt[L] = tgt[L] || []).push(...t[L]);
    }
  });
  const levels = Object.keys(all)
    .map(Number)
    .sort((a, b) => a - b);
  const meds = levels.map((L) => median(all[L])),
    maxM = Math.max(1, ...meds);
  return (
    `<div class="panelcard"><h3>${tr("Tid pr. teknik")}</h3><p>${tr("Median tid fra forrige tal, til du satte et tal, fordelt på hvad trækket krævede. Pilen sammenligner dine seneste 10 spil med de tidligere.")}</p>` +
    levels
      .map((L, k) => {
        const n = all[L].length,
          med = meds[k];
        let trend = "",
          tipT = "";
        if ((recent[L] || []).length >= 3 && (older[L] || []).length >= 3) {
          const d = median(recent[L]) / Math.max(1, median(older[L])) - 1;
          trend = Math.abs(d) < 0.1 ? "→" : d < 0 ? "↓" + Math.round(-d * 100) + "%" : "↑" + Math.round(d * 100) + "%";
          tipT = " · " + tr("seneste {a}, før {b}", { a: fmtS(median(recent[L])), b: fmtS(median(older[L])) });
        }
        return (
          `<div class="barrow" data-tip="${esc(LEVEL_TECH[L])}: ${tr("median {med} over {n} træk", { med: fmtS(med), n })}${tipT}"><span class="n">${L}</span>` +
          `<span class="name">${esc(LEVEL_TECH[L])} <small style="color:var(--mute)">· ${n}</small></span><span class="cnt" style="font-size:13px">${fmtS(med)}</span>` +
          `<span class="best" style="color:${trend.startsWith("↓") ? "var(--indigo)" : trend.startsWith("↑") ? "var(--warn)" : "var(--mute)"};font-weight:700">${trend}</span>` +
          `<span class="track"><span class="fill" style="display:block;width:${((100 * med) / maxM).toFixed(1)}%"></span></span></div>`
        );
      })
      .join("") +
    `<p class="caveat" style="margin:8px 0 0!important">${tr("↓ betyder hurtigere. Tallet efter navnet er antal træk.")}</p>` +
    estStatsHtml() +
    `</div>`
  );
}
function estStatsHtml() {
  const s = estStats();
  if (!s) return "";
  const word =
    s.med >= 1.15
      ? tr("Du er typisk langsommere end estimatet, fx når du laver fejl eller er træt.")
      : s.med <= 0.87
        ? tr("Du er typisk hurtigere end estimatet, så du bliver bedre.")
        : tr("Estimatet rammer typisk rigtigt.");
  return (
    `<p class="estline">${tr("Mod dit tidsestimat: dine seneste {n} løste opgaver tog typisk {x} gange estimatet (halvdelen mellem {a} og {b}).", { n: s.n, x: dec(s.med), a: dec(s.lo), b: dec(s.hi) })} ${word}</p>`
  );
}
function gameSheet(g) {
  openSheet(
    `<h2>${esc(BAND[gBand(g)])} ${dec(g.value)} · ${g.cols}×${g.rows}</h2>` +
      `<p style="color:var(--mute)">${new Date(g.end).toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${g.solved ? tr("løst på {tid}", { tid: fmt(g.ms) }) : tr("ikke løst")}${g.solved && g.lv ? " · " + tr("estimat {t}", { t: estFmt(g.est || estimateSec(myCal(), g.lv)) }) : ""}</p>` +
      `<div class="menu">` +
      menuItem(
        "gRoute",
        '<path d="M4 19c4 0 4-14 8-14s4 14 8 14"/><circle cx="4" cy="19" r="1.5"/><circle cx="20" cy="19" r="1.5"/>',
        tr("Se ruteanalyse"),
        g.route && g.route.n ? Math.round((100 * g.route.easy) / g.route.n) + " % " + tr("letteste") : "",
      ) +
      menuItem("gAgain", IC.restart, tr("Spil samme opgave igen")) +
      `</div>`,
    (b) => {
      b.querySelector("#gRoute").onclick = () => {
        closeSheet();
        setTimeout(() => showRoute(g), 280);
      };
      b.querySelector("#gAgain").onclick = () => {
        closeSheet();
        setTimeout(() => replaceGame(() => importCode(g.code, { replay: true })), 280);
      };
    },
  );
}
function routePanel() {
  const rs = games.filter((g) => g.route && g.route.n);
  if (!rs.length)
    return `<div class="panelcard"><h3>${tr("Din løsningsrute")}</h3><p>${tr("Når du har løst en opgave, vises her, hvor ofte du tog et af de letteste træk, der fandtes lige da.")}</p></div>`;
  const last = rs.slice(-20);
  const sum = (k) => last.reduce((a, g) => a + (g.route[k] || 0), 0);
  const N = sum("n"),
    pct = Math.round((100 * sum("easy")) / N);
  const W = 320,
    H = 110,
    L = 26,
    B = 14,
    bw = Math.min(22, (W - L) / last.length - 3);
  let bars = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Andel letteste træk i dine seneste spil")}">`;
  [0, 50, 100].forEach((v) => {
    const yy = 6 + (H - B - 6) * (1 - v / 100);
    bars += `<line x1="${L}" x2="${W}" y1="${yy}" y2="${yy}" stroke="var(--grid)"/><text x="${L - 6}" y="${yy + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${v}</text>`;
  });
  last.forEach((g, i) => {
    const v = (100 * g.route.easy) / g.route.n,
      h = Math.max(2, ((H - B - 6) * v) / 100),
      xx = L + 4 + i * ((W - L - 4) / last.length);
    const d = new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    bars += `<path d="M${xx} ${H - B}v${-(h - 4)}a4 4 0 0 1 4 -4h${bw - 8}a4 4 0 0 1 4 4v${h - 4}z" fill="var(--indigo)" data-tip="${esc(d + " · " + BAND[gBand(g)] + " " + dec(g.value) + ": " + tr("{pct} % letteste træk", { pct: Math.round(v) }))}"/>`;
  });
  bars += `</svg>`;
  const rows = [
    ["easy", tr("Letteste træk")],
    ["ahead", tr("Tænkt frem")],
    ["harder", tr("Sværere end nødvendigt")],
    ["wrong", tr("Fejl")],
    ["guess", tr("Gæt")],
  ];
  const maxC = Math.max(1, ...rows.map(([k]) => sum(k)));
  return (
    `<div class="panelcard"><h3>${tr("Din løsningsrute")}</h3><p>${tr("Hvor ofte du tog et af de letteste træk, der fandtes lige da.")} ${last.length === 1 ? tr("Seneste spil, {n} træk.", { n: N }) : tr("Seneste {k} spil, {n} træk.", { k: last.length, n: N })}</p>` +
    `<div class="rkpi"><b>${pct} %</b><span>${tr("letteste træk")}${sum("harder") ? "<br>" + tr("{n} gange sværere end nødvendigt", { n: sum("harder") }) : ""}</span></div>` +
    bars +
    rows
      .map(([k, t]) => {
        const c = sum(k);
        return (
          `<div class="barrow ${c ? "" : "zero"}" data-tip="${t}: ${tr("{c} af {n} træk ({pct} %)", { c, n: N, pct: Math.round((100 * c) / N) })}"><span class="n"></span><span class="name">${t}</span>` +
          `<span class="cnt">${c}</span><span class="best">${Math.round((100 * c) / N)} %</span><span class="track"><span class="fill" style="display:block;width:${((100 * c) / maxC).toFixed(1)}%"></span></span></div>`
        );
      })
      .join("") +
    `</div>`
  );
}
