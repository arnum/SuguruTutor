// Drawing: grid, number buttons and status line.

function value(i) {
  return P.givens[i] || entries[i];
}
const boardFull = () => P.givens.every((g, i) => g || entries[i]);
function conflicts() {
  const bad = new Set();
  for (let i = 0; i < G.n; i++) {
    const v = value(i);
    if (!v) continue;
    if (v > regionSize[i]) bad.add(i); // larger than the region (only possible with "Allow all numbers")
    for (const j of peerSets[i])
      if (value(j) === v) {
        bad.add(i);
        bad.add(j);
      }
  }
  return bad;
}
const NOTE_POS5 = { 1: [24, 24], 2: [76, 24], 3: [50, 50], 4: [24, 76], 5: [76, 76] };
const NOTE_POS4 = { 1: [30, 30], 2: [70, 30], 3: [30, 70], 4: [70, 70] }; // a 4×4 Sudoku: two by two, like its boxes
const NOTE_POS6 = { 1: [22, 30], 2: [50, 30], 3: [78, 30], 4: [22, 72], 5: [50, 72], 6: [78, 72] };
const NOTE_POS9 = { 1: [22, 26], 2: [50, 26], 3: [78, 26], 4: [22, 54], 5: [50, 54], 6: [78, 54], 7: [22, 82], 8: [50, 82], 9: [78, 82] };
let NOTE_POS = NOTE_POS5;

// The game board, drawn by the shared drawing code (draw.js): the player's numbers and notes, the selection with its
// neighbours and matching numbers, rule breaks, and a hint's view on top
function renderGrid() {
  if (!P) return;
  const hv = hint && hint.data ? hint.data.views[hint.k] : null;
  // Rule breaks are shown at once (default), or only when the board is full or after "Check for errors"
  const bad = settings.liveErrors !== false || checked || boardFull() ? conflicts() : new Set();
  const selVal = selected >= 0 ? value(selected) : 0;
  const values = P.givens.map((g, i) => g || entries[i]),
    color = {},
    crossed = new Set(),
    fill = {};
  for (let i = 0; i < G.n; i++) {
    const wrong = !P.givens[i] && entries[i] && checked && entries[i] !== P.solution[i];
    if (values[i] && (bad.has(i) || wrong)) color[i] = "var(--bad)";
    if (wrong) crossed.add(i);
    if (chainTool) {
      // the chain tool: no selection (a tap colours or links); the number worked on is picked out where it is placed
      if (chainD && values[i] === chainD) fill[i] = "var(--same)";
      continue;
    }
    if (!hv && settings.peers && selected >= 0 && peerSets[selected].has(i) && !P.givens[i]) fill[i] = "var(--peer)";
    if (!hv && settings.same && selVal && values[i] === selVal) fill[i] = "var(--same)";
    if (i === selected) fill[i] = "var(--sel)";
  }
  const parts = boardParts(
    { rows: G.rows, cols: G.cols, region: P.region, givens: P.givens, values, color, crossed, notes, reveal: reveal ? P.solution : null, maxR: P.maxRegion },
    Object.assign(viewLayers(hv), hv ? {} : chainLayer(), {
      fill,
      dashed: hintCell,
      ring: selected >= 0 && !chainTool ? { c: selected, warn: !!(pendingOverwrite && pendingOverwrite.cell === selected) } : null,
      flash: solved,
      aria: true,
    }),
  );
  svg.setAttribute("viewBox", parts.viewBox);
  // the board's aspect ratio, so the layout can size it to the screen (see "iPhone and iPad" in app.css)
  svg.parentNode.style.setProperty("--ar", parts.ratio.toFixed(4));
  svg.innerHTML = parts.inner;
}
function renderPad() {
  if (!P) return;
  const pad = $("pad"),
    top = P.maxRegion || 5;
  pad.innerHTML = "";
  pad.style.setProperty("--padn", top);
  pad.style.setProperty("--padl", top > 6 ? Math.ceil(top / 2) : top); // in landscape 1-9 go in two rows (see app.css)
  pad.classList.toggle("notes", noteMode);
  pad.classList.toggle("chain", !!chainTool);
  const max = selected >= 0 ? digitMax(selected) : top,
    locked = selected < 0 || !!P.givens[selected] || solved;
  for (let d = 1; d <= top; d++) {
    const b = document.createElement("button");
    b.type = "button";
    b.id = "pad-" + d;
    b.textContent = d;
    // the chain tool: the numbers choose the number to colour or link, whatever cell is selected
    if (chainTool && !solved) {
      if (chainD === d) {
        b.classList.add("cur");
        b.setAttribute("aria-pressed", "true");
      }
      b.dataset.d = d;
      pad.appendChild(b);
      continue;
    }
    b.disabled = locked || d > max;
    if (!locked && !noteMode && entries[selected] === d) {
      b.classList.add("cur");
      b.setAttribute("aria-pressed", "true");
    }
    if (!locked && noteMode && notes[selected] & (1 << d)) b.classList.add("cur");
    b.dataset.d = d;
    pad.appendChild(b);
  }
  const stake = penStake(),
    sb = $("penStake");
  sb.hidden = !stake;
  if (stake) {
    // Without-pencil view: what the puzzle drops to with pencil. With-pencil view: what it counts as as long as the pencil is not used.
    const np = noPen();
    sb.textContent = dec(np ? stake.pen : stake.nopen);
    sb.classList.toggle("gain", !np);
    sb.title = np
      ? tr("With pencil the puzzle counts as {a} instead of {b}.", { a: dec(stake.pen), b: dec(stake.nopen) })
      : tr("Without pencil the puzzle counts as {b} instead of {a}.", { a: dec(stake.pen), b: dec(stake.nopen) });
  }
  $("noteBtn").setAttribute("aria-label", tr("Pencil") + (stake ? ". " + sb.title : ""));
  // The line below the numbers: the consequence of the pencil is always shown; guidance on use (tap a cell, which numbers a
  // cell can have, etc.) only for new players (the first BEGINNER_GAMES games), not for those who know the game.
  $("padhint").textContent = solved
    ? ""
    : chainTool
    ? chainPadHint()
    : noteMode && stake
      ? stake.left === PEN_MIN
        ? tr("Pencil: from note {k} on, the puzzle counts as {a} instead of {b}.", { k: PEN_MIN, a: dec(stake.pen), b: dec(stake.nopen) })
        : stake.left === 1
          ? tr("1 more note and the puzzle counts as {a} instead of {b}.", { a: dec(stake.pen), b: dec(stake.nopen) })
          : tr("{n} more notes and the puzzle counts as {a} instead of {b}.", { n: stake.left, a: dec(stake.pen), b: dec(stake.nopen) })
    : !beginner()
      ? ""
      : selected < 0
      ? tr("Tap a cell.")
      : P.givens[selected]
        ? tr("This cell is given.")
        : noteMode
          ? tr("Pencil: tap numbers to add or remove small notes.")
          : entries[selected]
            ? tr("The cell has {v}.", { v: entries[selected] }) + (settings.confirm ? " " + tr("Tap a different number twice to change it.") : "")
            : GAME.cellRange(max);
  $("noteBtn").setAttribute("aria-pressed", noteMode);
  renderChain(); // the chain tool's button and bar (chains.js)
  ["noteBtn", "chainBtn", "eraseBtn", "undoBtn", "hintBtn"].forEach((id) => ($(id).disabled = solved));
  if (chainTool) $("eraseBtn").disabled = true; // the chain tool has its own Clear
  $("hintBtn").hidden = !!(meta && (meta.camp || meta.trial)); // the campaign and the timed trials have no hints
  $("noteBtn").hidden = $("chainBtn").hidden = !!(meta && meta.trial); // ... and a trial has no pencil, nor colours
  $("eraseBtn").hidden = $("undoBtn").hidden = !!(meta && meta.trial && meta.trial.fl === "hard"); // hardcore: nothing to correct
}
function pillPersonal() {
  const pg = P.grade && personalGrade(shownGrade(P), P.rating.level);
  return pg && Math.abs(pg.value - shownGrade(P)) >= 0.2 ? ` <span class="pval">${tr("for you ≈{v}", { v: dec(pg.value) })}</span>` : "";
}
function renderStatus() {
  if (!P) return;
  const lv = pBand(P);
  const dots = Array.from({ length: 9 }, (_, i) => `<i class="${i < lv ? "on" : ""}"></i>`).join("");
  $("levelPill").innerHTML =
    `${esc(BAND[lv])} <span class="val">${levelValue(P)}</span>${pillPersonal()}<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`;
  // Hardest technique, peak and load (the size can be seen on the board, and the puzzle's number says nothing during the game)
  $("gameSub").textContent =
    (meta && meta.train ? tr("Training · {tech}", { tech: LEVEL_TECH[meta.train.L] }) : LEVEL_TECH[P.rating.level]) +
    (P.grade ? " · " + plText(P.grade) : "") +
    (meta && meta.daily ? " · " + tr("Daily") : "");
  $("status").innerHTML =
    `<span class="dots" aria-label="${tr("Grade {g} of 9", { g: lv })}">${dots}</span>` +
    (P.seed != null && P.target && lv !== P.target && !P.startAt ? `<span style="color:var(--bad)">${tr("wanted {g}", { g: P.target })}</span>` : "") +
    (meta && meta.hints ? `<span>${meta.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: meta.hints })}</span>` : "") +
    (meta && meta.trial
      ? `<span class="timer${meta.trial.lim * 1000 - elapsed() < 30000 ? " short" : ""}" id="timer">${fmt(Math.max(0, meta.trial.lim * 1000 - elapsed()))}</span>` // the time left
      : settings.timer
        ? `<span class="timer" id="timer">${fmt(elapsed())}</span>`
        : `<span class="timer" id="timer" hidden></span>`);
  renderTrain();
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

// ---------- input, shared by the main game and the practice screens (drill.js, games.js)
// Fast taps: we react to pointerdown, not click. A click needs the finger to be lifted on the same element,
// and both the number buttons and the grid are redrawn after every tap, so fast taps got lost.
function fastTap(node, fn) {
  node.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    fn(e);
  });
  node.addEventListener("click", (e) => {
    if (e.detail === 0) fn(e);
  }); // keyboard and screen reader
}
// The cell under a tap on a board drawing. Every board (the game's and the small ones) puts cell (0,0) at 0,0 with
// 100 units per cell; the viewBox says where the margin is.
function svgCellAt(svg, cols, rows, e) {
  const r = svg.getBoundingClientRect(),
    vb = svg.viewBox.baseVal;
  const x = ((e.clientX - r.left) / r.width) * vb.width + vb.x,
    y = ((e.clientY - r.top) / r.height) * vb.height + vb.y;
  const c = Math.floor(x / 100),
    row = Math.floor(y / 100);
  return x < 0 || y < 0 || c >= cols || row >= rows ? -1 : row * cols + c;
}
// Number buttons as in the game: same look, same size on phone and tablet, data-d for the number
function padButtonsHtml(top, disabled) {
  let s = "";
  for (let d = 1; d <= top; d++) s += `<button type="button" data-d="${d}"${disabled ? " disabled" : ""}>${d}</button>`;
  return s;
}

// ---------- Region colours (setting "regionTint", off by default): every region gets one of six faint tints, and
// regions that share an edge never get the same one (Sudoku's boxes end up in two alternating tints). Used by the game
// board and the small boards (miniBoard). Colours are in app.css (--rt0..5, and --rtg0..5 for given cells).
const tintCache = new Map();
function regionTints(region, rows, cols) {
  const key = rows + "x" + cols + ":" + Array.from(region).join(",");
  if (tintCache.has(key)) return tintCache.get(key);
  const nb = new Map(),
    add = (a, b) => {
      if (a === b) return;
      if (!nb.has(a)) nb.set(a, new Set());
      if (!nb.has(b)) nb.set(b, new Set());
      nb.get(a).add(b);
      nb.get(b).add(a);
    };
  for (let i = 0; i < rows * cols; i++) {
    if (!nb.has(region[i])) nb.set(region[i], new Set());
    if ((i % cols) + 1 < cols) add(region[i], region[i + 1]);
    if (i + cols < rows * cols) add(region[i], region[i + cols]);
  }
  // DSatur: colour the region with the most differently coloured neighbours first, with the lowest free colour
  const col = new Map();
  while (col.size < nb.size) {
    let best = null,
      bs = -1,
      bd = -1;
    for (const [r, ns] of nb) {
      if (col.has(r)) continue;
      const sat = new Set([...ns].filter((x) => col.has(x)).map((x) => col.get(x))).size;
      if (sat > bs || (sat === bs && ns.size > bd)) (best = r), (bs = sat), (bd = ns.size);
    }
    const used = new Set([...nb.get(best)].map((x) => col.get(x)));
    let c = 0;
    while (used.has(c) && c < 5) c++;
    col.set(best, c);
  }
  tintCache.set(key, col);
  if (tintCache.size > 50) tintCache.delete(tintCache.keys().next().value);
  return col;
}
// The resting colour of a cell: the cell or given colour, or with region colours on, its region's tint
function baseFill(i, region, rows, cols, given) {
  if (!settings.regionTint || !region) return given ? "var(--given)" : "var(--cell)";
  const t = regionTints(region, rows, cols).get(region[i]);
  return `var(--rt${given ? "g" : ""}${t})`;
}
