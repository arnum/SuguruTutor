// Tegning: gitter, talknapper og statuslinje.

function value(i) {
  return P.givens[i] || entries[i];
}
function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function conflicts() {
  const bad = new Set();
  for (let i = 0; i < G.n; i++) {
    const v = value(i);
    if (!v) continue;
    for (const j of peerSets[i])
      if (value(j) === v) {
        bad.add(i);
        bad.add(j);
      }
  }
  return bad;
}
const NOTE_POS5 = { 1: [24, 24], 2: [76, 24], 3: [50, 50], 4: [24, 76], 5: [76, 76] };
const NOTE_POS6 = { 1: [22, 30], 2: [50, 30], 3: [78, 30], 4: [22, 72], 5: [50, 72], 6: [78, 72] };
let NOTE_POS = NOTE_POS5;

function renderGrid() {
  if (!P) return;
  const { rows, cols, n } = G,
    S = 100;
  svg.setAttribute("viewBox", `-34 -34 ${cols * S + 40} ${rows * S + 40}`);
  svg.innerHTML = "";
  const hv = hint && hint.data ? hint.data.views[hint.k] : null;
  const hPat = new Set(hv ? hv.pattern : []),
    hTgt = new Set(hv ? hv.target : []),
    hBad = new Set(hv && hv.bad ? hv.bad : []);
  const hHypo = hv && hv.hypo ? hv.hypo : {};
  const labels = el(
    "g",
    {
      "pointer-events": "none",
      "font-family": "Zen Kaku Gothic New, system-ui, sans-serif",
      "font-size": 22,
      fill: "var(--mute)",
      "text-anchor": "middle",
    },
    svg,
  );
  for (let c = 0; c < cols; c++) el("text", { x: c * S + 50, y: -14 }, labels).textContent = "abcdefghij"[c];
  for (let r = 0; r < rows; r++) el("text", { x: -18, y: r * S + 58 }, labels).textContent = r + 1;
  const bad = conflicts();
  const selVal = selected >= 0 ? value(selected) : 0;
  const cells = el("g", {}, svg),
    texts = el("g", { "pointer-events": "none" }, svg);
  for (let i = 0; i < n; i++) {
    const x = (i % cols) * S,
      y = Math.floor(i / cols) * S;
    let fill = P.givens[i] ? "var(--given)" : "var(--cell)";
    if (!hv && settings.peers && selected >= 0 && peerSets[selected].has(i) && !P.givens[i]) fill = "var(--peer)";
    if (!hv && settings.same && selVal && value(i) === selVal) fill = "var(--same)";
    if (i === selected) fill = "var(--sel)";
    if (hPat.has(i)) fill = "var(--pat)";
    if (hTgt.has(i)) fill = "var(--tgt)";
    if (hBad.has(i)) fill = "var(--badbg)";
    const r = el("rect", { x, y, width: S, height: S, fill, "data-i": i, class: "cellbg", role: "gridcell" }, cells);
    r.setAttribute(
      "aria-label",
      tr("Række {r}, kolonne {c}", { r: Math.floor(i / cols) + 1, c: (i % cols) + 1 }) + ", " + (value(i) || tr("tom")),
    );
    const v = value(i);
    if (P.givens[i]) {
      el(
        "text",
        {
          x: x + 50,
          y: y + 52,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "font-family": "Shippori Mincho B1, Georgia, serif",
          "font-weight": 800,
          "font-size": 64,
          fill: bad.has(i) ? "var(--bad)" : "var(--ink)",
        },
        texts,
      ).textContent = v;
    } else if (v) {
      const wrong = checked && v !== P.solution[i];
      el(
        "text",
        {
          x: x + 50,
          y: y + 52,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "font-family": "Zen Kaku Gothic New, system-ui, sans-serif",
          "font-weight": 500,
          "font-size": 56,
          fill: bad.has(i) || wrong ? "var(--bad)" : "var(--indigo)",
          class: solved ? "solved-flash" : "",
        },
        texts,
      ).textContent = v;
      if (wrong)
        el(
          "line",
          { x1: x + 22, y1: y + 80, x2: x + 78, y2: y + 20, stroke: "var(--bad)", "stroke-width": 4, "stroke-linecap": "round" },
          texts,
        );
      if (i === hintCell)
        el(
          "circle",
          { cx: x + 50, cy: y + 50, r: 40, fill: "none", stroke: "var(--indigo)", "stroke-width": 3, "stroke-dasharray": "6 6" },
          texts,
        );
    } else if (hv && hHypo[i] !== undefined) {
      el(
        "text",
        {
          x: x + 50,
          y: y + 53,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "font-family": "Zen Kaku Gothic New, system-ui, sans-serif",
          "font-weight": 700,
          "font-size": 52,
          fill: "var(--hypo)",
        },
        texts,
      ).textContent = hHypo[i];
      el(
        "circle",
        { cx: x + 50, cy: y + 50, r: 38, fill: "none", stroke: "var(--hypo)", "stroke-width": 3, "stroke-dasharray": "5 6" },
        texts,
      );
    } else if (hv && hv.cand[i] !== undefined) {
      const m = hv.cand[i],
        st = hv.strike[i] || 0;
      for (let d = 1; d <= 6; d++)
        if (m & (1 << d)) {
          const struck = !!(st & (1 << d));
          el(
            "text",
            {
              x: x + NOTE_POS[d][0],
              y: y + NOTE_POS[d][1],
              "text-anchor": "middle",
              "dominant-baseline": "central",
              "font-family": "Zen Kaku Gothic New, system-ui, sans-serif",
              "font-weight": struck ? 700 : 500,
              "font-size": struck ? 26 : 23,
              fill: struck ? "var(--bad)" : "var(--ink)",
            },
            texts,
          ).textContent = d;
          if (struck)
            el(
              "line",
              {
                x1: x + NOTE_POS[d][0] - 13,
                y1: y + NOTE_POS[d][1] + 11,
                x2: x + NOTE_POS[d][0] + 13,
                y2: y + NOTE_POS[d][1] - 11,
                stroke: "var(--bad)",
                "stroke-width": 3.5,
                "stroke-linecap": "round",
              },
              texts,
            );
        }
    } else if (reveal) {
      el(
        "text",
        {
          x: x + 50,
          y: y + 52,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "font-family": "Zen Kaku Gothic New, system-ui, sans-serif",
          "font-size": 44,
          fill: "var(--mute)",
          opacity: 0.7,
        },
        texts,
      ).textContent = P.solution[i];
    } else if (notes[i]) {
      for (let d = 1; d <= 6; d++)
        if (notes[i] & (1 << d))
          el(
            "text",
            {
              x: x + NOTE_POS[d][0],
              y: y + NOTE_POS[d][1],
              "text-anchor": "middle",
              "dominant-baseline": "central",
              "font-family": "Zen Kaku Gothic New, system-ui, sans-serif",
              "font-weight": 500,
              "font-size": 22,
              fill: "var(--mute)",
            },
            texts,
          ).textContent = d;
    }
  }
  let thin = "",
    thick = "";
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols) {
        const seg = `M${(c + 1) * S} ${r * S}V${(r + 1) * S}`;
        if (P.region[i] === P.region[i + 1]) thin += seg;
        else thick += seg;
      }
      if (r + 1 < rows) {
        const seg = `M${c * S} ${(r + 1) * S}H${(c + 1) * S}`;
        if (P.region[i] === P.region[i + cols]) thin += seg;
        else thick += seg;
      }
    }
  el("path", { d: thin, stroke: "var(--grid)", "stroke-width": 2, fill: "none", "pointer-events": "none" }, svg);
  el(
    "path",
    { d: thick, stroke: "var(--ink)", "stroke-width": 7, "stroke-linecap": "square", fill: "none", "pointer-events": "none" },
    svg,
  );
  el(
    "rect",
    { x: 0, y: 0, width: cols * S, height: rows * S, stroke: "var(--ink)", "stroke-width": 9, fill: "none", "pointer-events": "none" },
    svg,
  );
  if (selected >= 0) {
    const x = (selected % cols) * S,
      y = Math.floor(selected / cols) * S,
      warn = pendingOverwrite && pendingOverwrite.cell === selected;
    el(
      "rect",
      {
        x: x + 7,
        y: y + 7,
        width: S - 14,
        height: S - 14,
        rx: 8,
        fill: "none",
        "pointer-events": "none",
        stroke: warn ? "var(--warn)" : "var(--indigo)",
        "stroke-width": 8,
        "stroke-dasharray": warn ? "14 9" : "none",
      },
      svg,
    );
  }
}
function renderPad() {
  if (!P) return;
  const pad = $("pad"),
    top = P.maxRegion || 5;
  pad.innerHTML = "";
  pad.style.setProperty("--padn", top);
  pad.classList.toggle("notes", noteMode);
  const max = selected >= 0 ? regionSize[selected] : top,
    locked = selected < 0 || !!P.givens[selected] || solved;
  for (let d = 1; d <= top; d++) {
    const b = document.createElement("button");
    b.type = "button";
    b.id = "pad-" + d;
    b.textContent = d;
    b.disabled = locked || d > max;
    if (!locked && !noteMode && entries[selected] === d) {
      b.classList.add("cur");
      b.setAttribute("aria-pressed", "true");
    }
    if (!locked && noteMode && notes[selected] & (1 << d)) b.classList.add("cur");
    b.dataset.d = d;
    pad.appendChild(b);
  }
  $("padhint").textContent = solved
    ? ""
    : selected < 0
      ? tr("Tryk på en celle.")
      : P.givens[selected]
        ? tr("Denne celle er givet.")
        : noteMode
          ? tr("Blyant: tryk tal for at skrive eller fjerne små noter.")
          : entries[selected]
            ? tr("Feltet har {v}.", { v: entries[selected] }) + (settings.confirm ? " " + tr("Et andet tal skal trykkes to gange.") : "")
            : tr("Regionen har {n} felter, så cellen kan være 1–{n}.", { n: max });
  $("noteBtn").setAttribute("aria-pressed", noteMode);
  ["noteBtn", "eraseBtn", "undoBtn", "hintBtn"].forEach((id) => ($(id).disabled = solved));
}
function renderStatus() {
  if (!P) return;
  const lv = pBand(P);
  const dots = Array.from({ length: 9 }, (_, i) => `<i class="${i < lv ? "on" : ""}"></i>`).join("");
  $("levelPill").innerHTML =
    `${esc(BAND[lv])} <span class="val">${levelValue(P)}</span><svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`;
  $("gameSub").textContent =
    P.cols +
    "×" +
    P.rows +
    " · " +
    LEVEL_TECH[P.rating.level] +
    (P.grade ? " · " + plText(P.grade) : "") +
    " · " +
    (meta && meta.daily ? tr("Dagens") : P.seed != null ? "#" + P.seed : tr("fra kode"));
  $("status").innerHTML =
    `<span class="dots" aria-label="${tr("Grad {g} af 9", { g: lv })}">${dots}</span>` +
    (P.seed != null && P.target && lv !== P.target ? `<span style="color:var(--bad)">${tr("ønsket {g}", { g: P.target })}</span>` : "") +
    (meta && meta.hints ? `<span>${meta.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: meta.hints })}</span>` : "") +
    (settings.timer ? `<span class="timer" id="timer">${fmt(elapsed())}</span>` : `<span class="timer" id="timer" hidden></span>`);
}
function renderAll() {
  if (!P) return;
  renderGrid();
  renderPad();
  renderStatus();
  renderHint();
}
function setMsg(text, kind) {
  const m = $("msg");
  m.textContent = text;
  m.className = "msg " + (kind || "");
}
