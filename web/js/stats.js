// Statistik: faner, nøgletal, aktivitet og seneste spil.

function streaks() {
  const days = new Set(games.filter((g) => g.solved).map((g) => g.day));
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let current = 0;
  while (days.has(dayKey(d))) {
    current++;
    d.setDate(d.getDate() - 1);
  }
  const sorted = [...days].sort();
  let best = 0,
    run = 0,
    prev = null;
  for (const k of sorted) {
    const t = new Date(k + "T12:00:00");
    run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return { current, best, days };
}
const TAB = (k) => "\u0001" + k + "\u0001";
function renderStats() {
  const body = $("statsBody");
  const won = games.filter((g) => g.solved);
  if (!games.length) {
    body.innerHTML =
      `<div class="empty"><div class="stamp" aria-hidden="true">数</div><p><b>${tr("Ingen spil endnu.")}</b><br>${tr("Løs din første opgave, så dukker statistikken op her.")}</p>` +
      `<button class="primary" type="button" id="stFirst">${tr("Start dagens opgave")}</button></div>`;
    $("stFirst").onclick = startDaily;
    return;
  }
  const st = streaks();
  const clean = won.filter((g) => !g.hints).length;
  const totalMs = games.reduce((a, g) => a + g.ms, 0);
  const finished = games.length;
  // KPI
  // Tid i alt med små enheder: "3 t 12 min"
  const totMin = Math.round(totalMs / 60000),
    unit = (u) => `<small style="display:inline;font-size:15px"> ${u} </small>`;
  const totalTxt = totMin < 60 ? totMin + unit(tr("min")) : Math.floor(totMin / 60) + unit(tr("t")) + (totMin % 60) + unit(tr("min"));
  let html = `<div class="kpis">
    <div class="kpi"><b>${won.length}</b><span>${tr("Løste opgaver")}</span><small>${finished > won.length ? tr("{n} opgivet", { n: finished - won.length }) : tr("ingen opgivet")}</small></div>
    <div class="kpi"><b>${st.current}</b><span>${st.current === 1 ? tr("Dag i træk") : tr("Dage i træk")}</span><small>${st.best === 1 ? tr("Rekord: 1 dag") : tr("Rekord: {n} dage", { n: st.best })}</small></div>
    <div class="kpi"><b>${won.length ? Math.round((100 * clean) / won.length) : 0} %</b><span>${tr("Uden hints")}</span><small>${tr("{a} af {b} løste", { a: clean, b: won.length })}</small></div>
    <div class="kpi"><b>${totalTxt}</b><span>${tr("Tid i alt")}</span><small>${won.length ? tr("snit {tid} pr. opgave", { tid: fmt(won.reduce((a, g) => a + g.ms, 0) / won.length) }) : ""}</small></div>
  </div>`;
  html += TAB("teknik") + focusPanel() + TAB("overblik");
  // Pr. niveau
  const per = [];
  for (let l = 1; l <= 9; l++) {
    const gl = won.filter((g) => gBand(g) === l),
      cl = gl.filter((g) => !g.hints);
    per[l] = {
      n: gl.length,
      best: cl.length ? Math.min(...cl.map((g) => g.ms)) : null,
      avg: gl.length ? gl.reduce((a, g) => a + g.ms, 0) / gl.length : null,
    };
  }
  const maxN = Math.max(1, ...per.slice(1).map((x) => x.n));
  html +=
    `<div class="panelcard"><h3>${tr("Løste pr. sværhedsgrad")}</h3><p>${tr("Bedste tid er uden hints. Tryk på en række for gennemsnit.")}</p>` +
    per
      .slice(1)
      .map((x, i) => {
        const l = i + 1;
        return (
          `<div class="barrow ${x.n ? "" : "zero"}" data-tip="${esc(BAND[l])}: ${tr("{n} løst", { n: x.n })}${x.avg ? " · " + tr("snit {tid}", { tid: fmt(x.avg) }) : ""}${x.best ? " · " + tr("bedste {tid}", { tid: fmt(x.best) }) : ""}">` +
          `<span class="n">${l}</span><span class="name">${esc(BAND[l])}</span><span class="cnt">${x.n || "–"}</span><span class="best">${x.best ? fmt(x.best) : ""}</span>` +
          `<span class="track"><span class="fill" style="display:block;width:${((100 * x.n) / maxN).toFixed(1)}%"></span></span></div>`
        );
      })
      .join("") +
    `</div>`;
  // Aktivitet
  html += `<div class="panelcard"><h3>${tr("Aktivitet")}</h3><p>${tr("Løste opgaver pr. dag de sidste 12 uger.")}</p>${heatmap(won)}</div>`;
  // Udvikling
  html += TAB("opgaver") + ratingPanel();
  const last = won.slice(-30);
  if (last.length >= 2)
    html +=
      `<div class="panelcard"><h3>${tr("Sværhedsgrad over tid")}</h3><p>${tr("Dine seneste {n} løste opgaver. Tryk på et punkt.", { n: last.length })}</p>${trendChart(last)}` +
      `<button class="tablelink" type="button" id="trendTable">${tr("Vis som tabel")}</button><div id="trendTableBox"></div></div>`;
  html += TAB("teknik") + routePanel();
  html += timePanel();
  // Hints
  const tc = new Array(14).fill(0);
  games.forEach((g) => (g.hintTechs || []).forEach((t) => tc[t]++));
  const totalHints = tc.reduce((a, b) => a + b, 0);
  if (totalHints) {
    const maxT = Math.max(...tc);
    html +=
      `<div class="panelcard"><h3>${tr("Det har hints lært dig")}</h3><p>${tr("Den sværeste teknik i hvert af dine {n} hints.", { n: totalHints })}</p>` +
      tc
        .map((n, t) =>
          n
            ? `<div class="barrow" data-tip="${esc(E.TECH[t].label)}: ${n === 1 ? tr("1 hint") : tr("{n} hints", { n })}"><span class="n">${E.TECH[t].level}</span>` +
              `<span class="name">${esc(E.TECH[t].label)}</span><span class="cnt">${n}</span><span class="best"></span>` +
              `<span class="track"><span class="fill" style="display:block;width:${((100 * n) / maxT).toFixed(1)}%"></span></span></div>`
            : "",
        )
        .join("") +
      `</div>`;
  }
  html += TAB("form") + concPanel() + formPanel();
  // Seneste
  html += TAB("opgaver");
  const recent = games.slice(-15).reverse();
  html +=
    `<div class="panelcard"><h3>${tr("Seneste spil")}</h3><p>${tr("Tryk for at se ruten eller spille samme opgave igen.")}</p><div class="games">` +
    recent
      .map((g) => {
        const d = new Date(g.end);
        const when =
          d.toLocaleDateString(LOCALE, { day: "numeric", month: "short" }) +
          " " +
          tr("kl. {tid}", { tid: d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) });
        const tags = [
          g.daily ? tr("Dagens") : "",
          g.hints ? (g.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: g.hints })) : "",
          !g.solved ? (g.revealed ? tr("Løsning vist") : tr("Opgivet")) : "",
        ].filter(Boolean);
        return (
          `<button class="game ${g.solved ? "" : "lost"}" type="button" data-code="${esc(g.code)}" data-id="${esc(g.id)}"><span class="v">${dec(g.value)}</span>` +
          `<span><span class="t">${esc(BAND[gBand(g)])} · ${g.cols}×${g.rows}</span><br><span class="s">${when}${tags.length ? " · " + tags.join(" · ") : ""}${g.peak != null ? "<br>" + plText(g) : ""}</span></span>` +
          `<span class="b">${g.solved ? fmt(g.ms) : Math.round((100 * (g.filled || 0)) / Math.max(1, g.empty || 1)) + " %"}</span></button>`
        );
      })
      .join("") +
    `</div></div>`;
  // Fordel afsnittene på faner
  const parts = ("\u0001overblik\u0001" + html).split("\u0001"),
    chunks = {};
  for (let i = 1; i < parts.length; i += 2) chunks[parts[i]] = (chunks[parts[i]] || "") + parts[i + 1];
  const tabs = [
    ["overblik", tr("Overblik")],
    ["teknik", tr("Teknik")],
    ["form", tr("Form")],
    ["opgaver", tr("Opgaver")],
  ];
  if (!chunks[ui.statsTab]) ui.statsTab = "overblik";
  body.innerHTML =
    `<div class="seg" id="statTabs" role="tablist">` +
    tabs.map(([k, t]) => `<button type="button" role="tab" data-k="${k}" aria-pressed="${k === ui.statsTab}">${t}</button>`).join("") +
    `</div>` +
    chunks[ui.statsTab];
  body.querySelectorAll("#statTabs button").forEach(
    (b) =>
      (b.onclick = () => {
        ui.statsTab = b.dataset.k;
        saveUi();
        renderStats();
        window.scrollTo(0, 0);
      }),
  );
  const cp = $("feltCopy");
  if (cp)
    cp.onclick = async () => {
      try {
        await navigator.clipboard.writeText(feltExport());
        toast(tr("Kopieret. Indsæt det i chatten med Claude."));
      } catch (e) {
        toast(tr("Kunne ikke kopiere"));
      }
    };
  bindFocus(body);
  body.querySelectorAll(".game").forEach(
    (b) =>
      (b.onclick = () => {
        const g = games.find((x) => x.id === b.dataset.id);
        if (g && g.moves) gameSheet(g);
        else
          confirmSheet({
            title: tr("Spil igen?"),
            text: tr("Samme opgave fra start. Den tæller som et nyt spil."),
            ok: tr("Spil igen"),
            onOk: () => replaceGame(() => importCode(b.dataset.code, { replay: true })),
          });
      }),
  );
  const tt = $("trendTable");
  if (tt)
    tt.onclick = () => {
      const box = $("trendTableBox");
      if (box.innerHTML) {
        box.innerHTML = "";
        tt.textContent = tr("Vis som tabel");
        return;
      }
      tt.textContent = tr("Skjul tabel");
      box.innerHTML =
        `<table class="data"><tr><th>${tr("Dato")}</th><th>${tr("Grad")}</th><th>${tr("Plade")}</th><th>${tr("Tid")}</th><th>${tr("Hints")}</th></tr>` +
        last
          .slice()
          .reverse()
          .map(
            (g) =>
              `<tr><td>${new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" })}</td><td>${dec(g.value)}</td>` +
              `<td>${g.cols}×${g.rows}</td><td>${fmt(g.ms)}</td><td>${g.hints || ""}</td></tr>`,
          )
          .join("") +
        `</table>`;
    };
}
function heatmap(won) {
  const count = {};
  won.forEach((g) => (count[g.day] = (count[g.day] || 0) + 1));
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - dow - 7 * 11);
  const C = 17,
    Gp = 3,
    L = 22,
    T = 16,
    W = 12;
  const fills = [
    "var(--chip)",
    "color-mix(in srgb, var(--indigo) 38%, var(--cell))",
    "color-mix(in srgb, var(--indigo) 68%, var(--cell))",
    "var(--indigo)",
  ];
  let s = `<svg class="heat" viewBox="0 0 ${L + W * (C + Gp)} ${T + 7 * (C + Gp)}" role="img" aria-label="${tr("Aktivitet de sidste 12 uger")}">`;
  [tr("M"), "", tr("O"), "", tr("F"), "", tr("S")].forEach((t, r) => {
    if (t) s += `<text x="0" y="${T + r * (C + Gp) + 12.5}" font-size="10" fill="var(--mute)">${t}</text>`;
  });
  let lastMonth = -1;
  for (let w = 0; w < W; w++) {
    const first = new Date(start);
    first.setDate(start.getDate() + w * 7);
    if (first.getMonth() !== lastMonth) {
      lastMonth = first.getMonth();
      if (w < W - 1)
        s += `<text x="${L + w * (C + Gp)}" y="10" font-size="10" fill="var(--mute)">${first.toLocaleDateString(LOCALE, { month: "short" }).replace(".", "")}</text>`;
    }
    for (let r = 0; r < 7; r++) {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + r);
      if (d > today) continue;
      const k = dayKey(d),
        n = count[k] || 0;
      const label =
        d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" }) + ": " + (n ? tr("{n} løst", { n }) : tr("ingen"));
      s +=
        `<rect x="${L + w * (C + Gp)}" y="${T + r * (C + Gp)}" width="${C}" height="${C}" rx="4" fill="${fills[Math.min(3, n)]}" data-tip="${esc(label)}"` +
        (k === dayKey(today) ? ` stroke="var(--ink)" stroke-width="1.5"` : "") +
        `/>`;
    }
  }
  s += `</svg><div class="legendrow">${tr("Færre")} ${fills.map((f) => `<i style="background:${f}"></i>`).join("")} ${tr("Flere")}</div>`;
  return s;
}
function trendChart(list) {
  const W = 320,
    H = 150,
    L = 26,
    R = 10,
    T = 10,
    B = 20;
  const maxV = Math.min(10, Math.max(3, Math.ceil(Math.max(...list.map((g) => +g.value)) + 0.5)));
  const minV = Math.max(1, Math.floor(Math.min(...list.map((g) => +g.value))));
  const x = (i) => L + (list.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (list.length - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - minV) / Math.max(1, maxV - minV));
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Sværhedsgrad for dine seneste løste opgaver")}">`;
  const step = maxV - minV > 6 ? 2 : 1;
  for (let v = minV; v <= maxV; v += step)
    s +=
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>` +
      `<text x="${L - 8}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${v}</text>`;
  s += `<text x="${L}" y="${H - 4}" font-size="10" fill="var(--mute)">${tr("ældst")}</text><text x="${W - R}" y="${H - 4}" font-size="10" text-anchor="end" fill="var(--mute)">${tr("nyest")}</text>`;
  s += `<polyline points="${list.map((g, i) => x(i) + "," + y(+g.value)).join(" ")}" fill="none" stroke="var(--indigo)" stroke-width="2" stroke-linejoin="round" opacity="0.55"/>`;
  list.forEach((g, i) => {
    const d = new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    const tip = `${d}: ${BAND[gBand(g)]} ${dec(g.value)} · ${g.cols}×${g.rows} · ${fmt(g.ms)}${g.hints ? " · " + (g.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: g.hints })) : ""}${g.peak != null ? " · " + plText(g) : ""}`;
    s +=
      `<circle cx="${x(i)}" cy="${y(+g.value)}" r="4.5" fill="${g.hints ? "var(--cell)" : "var(--indigo)"}" stroke="${g.hints ? "var(--indigo)" : "var(--cell)"}" stroke-width="2"/>` +
      `<circle cx="${x(i)}" cy="${y(+g.value)}" r="13" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  s += `</svg><div class="legendrow"><i style="background:var(--indigo);border-radius:50%"></i> ${tr("uden hints")} &nbsp; <i style="box-shadow:inset 0 0 0 2px var(--indigo);border-radius:50%"></i> ${tr("med hints")}</div>`;
  return s;
}
