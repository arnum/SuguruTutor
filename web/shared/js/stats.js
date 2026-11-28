// Statistics: tabs, key figures, activity and latest games. The indices, Skill, Focus and Debug are in statui.js.

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
// 4×4 is a game of its own in the statistics (core.js): a switch at the top picks which games everything is drawn from
function renderStats() {
  const hasMicro = SIZES.some((x) => x.r * x.c <= 16) && games.some(isMicro);
  if (!hasMicro || ui.statScope !== "micro") ui.statScope = "main";
  withScope(ui.statScope, renderStatsIn);
  if (!hasMicro) return;
  $("statsBody").insertAdjacentHTML(
    "afterbegin",
    `<div class="seg scopeseg" id="statScope" role="group" aria-label="${esc(tr("Which games"))}">` +
      [
        ["main", tr("{size} and up", { size: SIZES.filter((x) => x.r * x.c > 16).map((x) => x.c + "×" + x.r)[0] })],
        ["micro", tr("4×4")],
      ]
        .map(([k, t]) => `<button type="button" data-s="${k}" aria-pressed="${k === ui.statScope}">${t}</button>`)
        .join("") +
      `</div>`,
  );
  $("statScope")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          ui.statScope = b.dataset.s;
          saveUi();
          renderStats();
          window.scrollTo(0, 0);
        }),
    );
}
function renderStatsIn() {
  const body = $("statsBody");
  const won = games.filter((g) => g.solved);
  if (!games.length) {
    body.innerHTML =
      `<div class="empty"><div class="stamp" aria-hidden="true">数</div><p><b>${tr("No games yet.")}</b><br>${tr("Solve your first puzzle and your statistics will show up here.")}</p>` +
      `<button class="primary" type="button" id="stFirst">${tr("Start today's puzzle")}</button></div>`;
    $("stFirst").onclick = startDaily;
    return;
  }
  const st = streaks();
  const clean = won.filter((g) => !g.hints).length;
  const totalMs = games.reduce((a, g) => a + g.ms, 0);
  const finished = games.length;
  // KPI
  // Total time in small units: "3 h 12 min"
  const totMin = Math.round(totalMs / 60000),
    unit = (u) => `<small style="display:inline;font-size:15px"> ${u} </small>`;
  const totalTxt = totMin < 60 ? totMin + unit(tr("min")) : Math.floor(totMin / 60) + unit(tr("h")) + (totMin % 60) + unit(tr("min"));
  let html = `<div class="kpis">
    <div class="kpi"><b>${won.length}</b><span>${tr("Puzzles solved")}</span><small>${finished > won.length ? tr("{n} given up", { n: finished - won.length }) : tr("none given up")}</small></div>
    <div class="kpi"><b>${st.current}</b><span>${st.current === 1 ? tr("Day in a row") : tr("Days in a row")}</span><small>${st.best === 1 ? tr("Record: 1 day") : tr("Record: {n} days", { n: st.best })}</small></div>
    <div class="kpi"><b>${won.length ? Math.round((100 * clean) / won.length) : 0} %</b><span>${tr("Without hints")}</span><small>${tr("{a} of {b} solved", { a: clean, b: won.length })}</small></div>
    <div class="kpi"><b>${totalTxt}</b><span>${tr("Total time")}</span><small>${won.length ? tr("average {time} per puzzle", { time: fmt(won.reduce((a, g) => a + g.ms, 0) / won.length) }) : ""}</small></div>
  </div>`;
  // the three indices (statui.js), then the simple statistics
  html += statIndicesHtml() + statSkillLine();
  // Activity
  html += `<div class="panelcard"><h3>${tr("Activity")}</h3><p>${tr("Puzzles solved per day.")}</p>${heatmap(won)}</div>`;
  // Skill: the level, the techniques, practice and hints
  html += TAB("skill") + skillPanel() + drillPanel();
  const tc = new Array(E.TECH.length).fill(0);
  games.forEach((g) => (g.hintTechs || []).forEach((t) => tc[t]++));
  const totalHints = tc.reduce((a, b) => a + b, 0);
  if (totalHints) {
    const maxT = Math.max(...tc);
    html +=
      `<div class="panelcard"><h3>${tr("What hints have taught you")}</h3><p>${tr("The hardest technique in each hint.")}</p>` +
      tc
        .map((n, t) => [n, t])
        .sort((a, b) => TT.order(E.TECH[a[1]].level, E.TECH[b[1]].level) || a[1] - b[1]) // in the table's order (the mixed pair, 14, sits after the pairs)
        .map(([n, t]) =>
          n
            ? `<div class="barrow" data-tip="${esc(E.TECH[t].label)}: ${n === 1 ? tr("1 hint") : tr("{n} hints", { n })}"><span class="n">${E.TECH[t].level}</span>` +
              `<span class="name">${esc(E.TECH[t].label)}</span><span class="cnt">${n}</span><span class="best"></span>` +
              `<span class="track"><span class="fill" style="display:block;width:${((100 * n) / maxT).toFixed(1)}%"></span></span></div>`
            : "",
        )
        .join("") +
      `</div>`;
  }
  html += timePanel();
  // Focus
  html += TAB("fokus") + focusPanelNew();
  // Games: the weeks, the grades and the route, then the games themselves
  html += TAB("opgaver") + weeksHtml();
  const last = won.slice(-30);
  if (last.length >= 2) html += `<div class="panelcard"><h3>${tr("Difficulty over time")}</h3>${trendChart(last)}</div>`;
  html += gradeSizeHtml() + routePanel();
  const recent = games.slice(-15).reverse();
  html +=
    `<div class="panelcard"><h3>${tr("Recent games")}</h3><p>${tr("Tap a game for its route, or to play it again.")}</p><div class="games">` +
    recent.map(gameRow).join("") +
    `</div></div>`;
  // Debug: the reference, how the model fits, and the grading against your times
  html += TAB("debug") + debugPanel() + ratingPanel();
  // Spread the sections over tabs
  const parts = ("\u0001overblik\u0001" + html).split("\u0001"),
    chunks = {};
  for (let i = 1; i < parts.length; i += 2) chunks[parts[i]] = (chunks[parts[i]] || "") + parts[i + 1];
  const tabs = [
    ["overblik", tr("Overview")],
    ["skill", tr("Skill")],
    ["fokus", tr("Focus")],
    ["opgaver", tr("Games")],
    ["debug", tr("Debug")],
  ];
  if (!chunks[ui.statsTab]) ui.statsTab = "overblik";
  body.innerHTML =
    `<div class="seg" id="statTabs" role="tablist">` +
    tabs.map(([k, t]) => `<button type="button" role="tab" data-k="${k}" aria-pressed="${k === ui.statsTab}">${t}</button>`).join("") +
    `</div>` +
    chunks[ui.statsTab];
  foldLong(body);
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
        toast(tr("Copied. Paste it into the chat with Claude."));
      } catch (e) {
        toast(tr("Could not copy"));
      }
    };
  bindFocus(body);
  bindDrillPanel(body);
  // the indices and links that open a tab
  body.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        ui.statsTab = b.dataset.tab;
        saveUi();
        renderStats();
        window.scrollTo(0, 0);
      }),
  );
  bindGameRows(body);
  // Tap a day in the activity map: show the day's games
  body.querySelectorAll(".heat rect[data-day]").forEach((r) => (r.onclick = () => daySheet(r.dataset.day)));
}
// One line in a game list (latest games and the day's games)
function gameRow(g) {
  const d = new Date(g.end);
  const when =
    d.toLocaleDateString(LOCALE, { day: "numeric", month: "short" }) + " " + tr("at {time}", { time: d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) });
  const tags = [
    g.daily ? tr("Daily") : "",
    g.hints ? (g.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: g.hints })) : "",
    !g.solved ? (g.revealed ? tr("Solution shown") : tr("Given up")) : "",
    g.dbg && g.dbg.length ? tr("note") : "",
    penUsed(g) === true && g.np != null && Math.abs(g.np - g.value) >= 0.1 ? tr("with pencil") : "",
  ].filter(Boolean);
  return (
    `<button class="game ${g.solved ? "" : "lost"}" type="button" data-code="${esc(g.code)}" data-id="${esc(g.id)}"><span class="v">${dec(gradeFor(g))}</span>` +
    `<span><span class="t">${esc(BAND[gBand(g)])} · ${g.cols}×${g.rows}</span><br><span class="s">${when}${tags.length ? " · " + tags.join(" · ") : ""}${g.peak != null ? "<br>" + plText(g) : ""}${sealLine(g) ? "<br>" + sealLine(g) : ""}</span></span>` +
    `<span class="b">${g.solved ? fmt(g.ms) : Math.round((100 * (g.filled || 0)) / Math.max(1, g.empty || 1)) + " %"}</span></button>`
  );
}
function bindGameRows(root, before) {
  root.querySelectorAll(".game").forEach(
    (b) =>
      (b.onclick = () => {
        const g = games.find((x) => x.id === b.dataset.id);
        const open = () => {
          if (g && g.moves) gameSheet(g);
          else
            confirmSheet({
              title: tr("Play again?"),
              text: tr("The same puzzle from the start. It counts as a new game."),
              ok: tr("Play again"),
              onOk: () => replaceGame(() => importCode(b.dataset.code, { replay: true })),
            });
        };
        if (before) before(open);
        else open();
      }),
  );
}
function daySheet(day) {
  hideTip();
  const list = games.filter((g) => g.day === day).reverse();
  const d = new Date(day + "T12:00:00");
  const title = d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });
  const won = list.filter((g) => g.solved);
  const sub = list.length
    ? (won.length === 1 ? tr("1 solved") : tr("{n} solved", { n: won.length })) +
      (list.length > won.length ? " · " + tr("{n} not solved", { n: list.length - won.length }) : "") +
      (won.length ? " · " + tr("{time} in total", { time: fmt(won.reduce((a, g) => a + g.ms, 0)) }) : "")
    : tr("No games this day.");
  openSheet(
    `<h2>${esc(title[0].toUpperCase() + title.slice(1))}</h2><p class="sub">${sub}</p>` +
      (list.length ? `<div class="games">${list.map(gameRow).join("")}</div>` : "") +
      `<div class="actions"><button class="primary" type="button" id="dayClose">${tr("Close")}</button></div>`,
    (b) => {
      b.querySelector("#dayClose").onclick = closeSheet;
      bindGameRows(b, (open) => {
        closeSheet();
        setTimeout(open, 280);
      });
    },
  );
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
  // one hue from light to dark in six steps, scaled to your busiest day in the 12 weeks (a fixed 1, 2, 3+ put every day
  // of a 15-game habit in the darkest step)
  const fills = ["var(--chip)", 24, 38, 52, 66, 82, 100].map((p) => (typeof p === "string" ? p : `color-mix(in srgb, var(--indigo) ${p}%, var(--cell))`));
  const d0 = new Date(start),
    seen = [];
  for (let k = 0; k < W * 7; k++) {
    const d = new Date(d0);
    d.setDate(d0.getDate() + k);
    if (d <= today) seen.push(count[dayKey(d)] || 0);
  }
  const top = Math.max(1, ...seen),
    step = (n) => (n ? Math.min(6, Math.max(1, Math.ceil((6 * n) / top))) : 0);
  let s = `<svg class="heat" viewBox="0 0 ${L + W * (C + Gp)} ${T + 7 * (C + Gp)}" role="img" aria-label="${tr("Activity over the last 12 weeks")}">`;
  [tr("M"), "", tr("W"), "", tr("F"), "", tr("S")].forEach((t, r) => {
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
        d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" }) + ": " + (n ? tr("{n} solved", { n }) : tr("none"));
      s +=
        `<rect x="${L + w * (C + Gp)}" y="${T + r * (C + Gp)}" width="${C}" height="${C}" rx="4" fill="${fills[step(n)]}" data-tip="${esc(label)}" data-day="${k}" style="cursor:pointer"` +
        (k === dayKey(today) ? ` stroke="var(--ink)" stroke-width="1.5"` : "") +
        `/>`;
    }
  }
  s += `</svg><div class="legendrow">${tr("Fewer")} ${fills.map((f) => `<i style="background:${f}"></i>`).join("")} ${tr("More|count")} <span class="heatmax">${tr("(up to {n} a day)", { n: top })}</span></div>`;
  return s;
}
function trendChart(list) {
  const W = 320,
    H = 150,
    L = 26,
    R = 10,
    T = 10,
    B = 20;
  const maxV = Math.min(Math.ceil(GW.cap), Math.max(3, Math.ceil(Math.max(...list.map(gradeFor)) + 0.5)));
  const minV = Math.max(1, Math.floor(Math.min(...list.map(gradeFor))));
  const x = (i) => L + (list.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (list.length - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - minV) / Math.max(1, maxV - minV));
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("Difficulty of your latest solved puzzles")}">`;
  const step = maxV - minV > 6 ? 2 : 1;
  for (let v = minV; v <= maxV; v += step)
    s +=
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/>` +
      `<text x="${L - 8}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mute)">${v}</text>`;
  s += `<text x="${L}" y="${H - 4}" font-size="10" fill="var(--mute)">${tr("oldest")}</text><text x="${W - R}" y="${H - 4}" font-size="10" text-anchor="end" fill="var(--mute)">${tr("newest")}</text>`;
  s += `<polyline points="${list.map((g, i) => x(i) + "," + y(gradeFor(g))).join(" ")}" fill="none" stroke="var(--indigo)" stroke-width="2" stroke-linejoin="round" opacity="0.55"/>`;
  list.forEach((g, i) => {
    const d = new Date(g.end).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
    const tip = `${d}: ${BAND[gBand(g)]} ${dec(gradeFor(g))} · ${g.cols}×${g.rows} · ${fmt(g.ms)}${g.hints ? " · " + (g.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: g.hints })) : ""}${g.peak != null ? " · " + plText(g) : ""}`;
    s +=
      `<circle cx="${x(i)}" cy="${y(gradeFor(g))}" r="4.5" fill="${g.hints ? "var(--cell)" : "var(--indigo)"}" stroke="${g.hints ? "var(--indigo)" : "var(--cell)"}" stroke-width="2"/>` +
      `<circle cx="${x(i)}" cy="${y(gradeFor(g))}" r="13" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  s += `</svg><div class="legendrow"><i style="background:var(--indigo);border-radius:50%"></i> ${tr("without hints")} &nbsp; <i style="box-shadow:inset 0 0 0 2px var(--indigo);border-radius:50%"></i> ${tr("with hints")}</div>`;
  return s;
}
// Long explanations fold away, so the numbers and findings come first:
// - notes on how something is measured (.caveat; neighbouring notes together) go behind "How it's measured"
// - a long introduction keeps its first sentence; the rest is behind "More"
// Short texts, findings and empty-state notes stay as they are. Works on the finished DOM, so it covers every panel and
// both languages; the elements are moved, not copied, so ids and handlers keep working.
const FOLD_AT = 110;
function foldLong(root) {
  const len = (el) => el.textContent.trim().length;
  // the notes on method
  const done = new Set();
  root.querySelectorAll("p.caveat").forEach((p) => {
    if (done.has(p) || p.closest("details.tldr")) return; // already behind a short line (tldr)
    const group = [p];
    let n = p.nextElementSibling;
    while (n && n.matches("p.caveat")) group.push(n), (n = n.nextElementSibling);
    group.forEach((x) => done.add(x));
    if (group.reduce((a, x) => a + len(x), 0) <= FOLD_AT) return;
    const d = document.createElement("details");
    d.className = "fold how";
    d.innerHTML = `<summary>${tr("How it's measured")}</summary>`;
    p.parentNode.insertBefore(d, p);
    group.forEach((x) => d.appendChild(x));
  });
  // long introductions: the first sentence stays
  root.querySelectorAll(".panelcard > p:not([class])").forEach((p) => {
    if (len(p) <= FOLD_AT) return;
    const re = /[.!?](\s+)(?=[A-ZÆØÅ“"+–])/; // not before a digit: "pr. 100" is no sentence end
    let at = null;
    for (const node of p.childNodes) {
      if (node.nodeType !== 3) continue;
      const m = re.exec(node.textContent);
      if (m) {
        at = { node, i: m.index + 1 };
        break;
      }
    }
    if (!at) return;
    const rest = at.node.splitText(at.i);
    rest.textContent = rest.textContent.replace(/^\s+/, "");
    const lead = [];
    for (const node of [...p.childNodes]) {
      if (node === rest) break;
      lead.push(node);
    }
    if (lead.reduce((a, x) => a + x.textContent.length, 0) > 140) {
      p.normalize();
      return;
    }
    const d = document.createElement("details"),
      sum = document.createElement("summary"),
      body = document.createElement("p");
    d.className = "fold lead";
    lead.forEach((x) => sum.appendChild(x));
    sum.insertAdjacentHTML("beforeend", ` <span class="more">${tr("More")}</span>`);
    while (p.firstChild) body.appendChild(p.firstChild);
    d.append(sum, body);
    p.replaceWith(d);
  });
}
