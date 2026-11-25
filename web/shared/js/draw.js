// One drawing code for every board (25 Nov 2026): the game board (renderGrid in board.js) and the small boards in practice,
// after the game and in the route analysis (miniBoard in analysis.js). They differ only in what they put on the board, so
// the look, and any fix, is the same everywhere. The home screen's thumbnail is a sketch of its own (thumbSvg in home.js).
//
// A board is drawn from two parts:
//   b, the puzzle and its numbers:
//     rows, cols, region, givens  the puzzle
//     values     the numbers on the board (0 = empty); givens may be included
//     color      {cell: colour} for numbers that are not the default (placed: indigo, given: ink)
//     crossed    Set of cells whose number is crossed out (wrong after "Check for errors")
//     notes      [mask] the player's pencil marks
//     reveal     [number] the solution, shown faintly in empty cells
//     maxR       the largest region (where the pencil marks go: 5, 6 or 9 positions)
//   v, what is shown on top (all optional):
//     fill       {cell: colour}: the state (selection, the selected cell's neighbours, the same number)
//     pattern, target, bad   cells (arrays or sets): the teaching highlights (the pattern, the cells it changes, a contradiction)
//     cand, strike           {cell: mask}: the options in a cell, the struck ones in red
//     hypo       {cell: number}: an assumption (dashed, orange); hypoStart: the cell it starts from (a solid ring)
//     head       {cell: number}: numbers placed in your head first (dashed)
//     marks      [{c, v, col}]: circled numbers (the answer, the numbers to choose from)
//     work       cells whose numbers do the work (rule the options out): a green ring around the number
//     opts       {cell: mask}: options that belong to the pattern, picked out in blue (the pair's two numbers)
//     digit      only this number matters: the other options are drawn faintly
//     outline    cells (or [{cells, col}]) whose outer border is drawn in colour: the region or house it is about
//     links      [{from, to, col}]: arrows between cells (a chain, what follows from an assumption), in order
//     badges     {cell: n}: small step numbers in the corner, when the order matters
//     focus      cells that play a part: the rest is dimmed
//     corner     {cell: colour}: a small corner (whose number it was)
//     dashed     a cell whose number gets a dashed circle (the hint's cell on the game board)
//     ring       {c, warn}: the selected cell's frame (warn: about to be overwritten)
//     flash      the numbers flash in (solved)
//     labels     the column letters and row numbers along the edges (default on)
//     aria       the game board: every cell a grid cell with its own label (otherwise one label for the picture)
//     label      that one label
// What a cell shows, first that applies: its number; a number placed in your head; a circled number; an assumption; options;
// the faint solution; pencil marks. Layers from the bottom: cell colours, contents, region borders, the selection frame.

const DRAW_S = 100;
const FONT_UI = "Zen Kaku Gothic New, system-ui, sans-serif",
  FONT_GIVEN = "Shippori Mincho B1, Georgia, serif";
const notePos = (maxR) => (maxR >= 7 ? NOTE_POS9 : maxR >= 6 ? NOTE_POS6 : NOTE_POS5);
const asSet = (x) => (x instanceof Set ? x : new Set(x || []));
const num = (x, y, size, weight, fill, txt, extra = "") =>
  `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_UI}" font-weight="${weight}" font-size="${size}" fill="${fill}"${extra}>${txt}</text>`;
const ringAt = (x, y, r, col, w, dash) => `<circle cx="${x + 50}" cy="${y + 50}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;

function boardParts(b, v = {}) {
  const { rows, cols, region, givens } = b,
    S = DRAW_S,
    n = rows * cols,
    pos = notePos(b.maxR || 5);
  const values = b.values || givens,
    color = b.color || {},
    crossed = asSet(b.crossed),
    fill = v.fill || {},
    pat = asSet(v.pattern),
    tgt = asSet(v.target),
    bad = asSet(v.bad),
    cand = v.cand || {},
    strike = v.strike || {},
    hypo = v.hypo || {},
    head = v.head || {},
    marks = new Map((v.marks || []).map((m) => [m.c, m])),
    corner = v.corner || {},
    work = asSet(v.work),
    opts = v.opts || {},
    badges = v.badges || {},
    focus = v.focus && v.focus.length ? asSet(v.focus) : null;
  let cells = "",
    texts = "";
  if (v.labels !== false) {
    texts += `<g pointer-events="none" font-family="${FONT_UI}" font-size="22" fill="var(--mute)" text-anchor="middle">`;
    for (let c = 0; c < cols; c++) texts += `<text x="${c * S + 50}" y="-14">${"abcdefghij"[c]}</text>`;
    for (let r = 0; r < rows; r++) texts += `<text x="-18" y="${r * S + 58}">${r + 1}</text>`;
    texts += `</g>`;
  }
  texts += `<g pointer-events="none">`;
  for (let i = 0; i < n; i++) {
    const x = (i % cols) * S,
      y = Math.floor(i / cols) * S,
      val = values[i],
      given = !!givens[i];
    let f = fill[i] || baseFill(i, region, rows, cols, given);
    if (pat.has(i)) f = "var(--pat)";
    if (tgt.has(i)) f = "var(--tgt)";
    if (bad.has(i)) f = "var(--badbg)";
    cells +=
      `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${f}" data-i="${i}" class="cellbg"` +
      (v.aria ? ` role="gridcell" aria-label="${esc(tr("Row {r}, column {c}", { r: Math.floor(i / cols) + 1, c: (i % cols) + 1 }) + ", " + (val || tr("empty")))}"` : "") +
      `/>`;
    if (val && work.has(i)) texts += ringAt(x, y, 42, "var(--work)", 5);
    if (val && given)
      texts += `<text x="${x + 50}" y="${y + 52}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_GIVEN}" font-weight="800" font-size="64" fill="${color[i] || "var(--ink)"}">${val}</text>`;
    else if (val) {
      texts += num(x + 50, y + 52, 56, 500, color[i] || "var(--indigo)", val, v.flash ? ` class="solved-flash"` : "");
      if (crossed.has(i)) texts += `<line x1="${x + 22}" y1="${y + 80}" x2="${x + 78}" y2="${y + 20}" stroke="var(--bad)" stroke-width="4" stroke-linecap="round"/>`;
      if (i === v.dashed) texts += ringAt(x, y, 40, "var(--indigo)", 3, "6 6");
    } else if (head[i] !== undefined) texts += ringAt(x, y, 36, "var(--warn)", 3, "5 6") + num(x + 50, y + 53, 48, 700, "var(--warn)", head[i]);
    else if (marks.has(i)) {
      const m = marks.get(i);
      texts += ringAt(x, y, 40, m.col, 6) + num(x + 50, y + 52, 56, 800, m.col, m.v);
    } else if (hypo[i] !== undefined)
      texts += (i === v.hypoStart ? ringAt(x, y, 39, "var(--hypo)", 6) : ringAt(x, y, 38, "var(--hypo)", 3, "5 6")) + num(x + 50, y + 53, 52, 700, "var(--hypo)", hypo[i]);
    else if (cand[i] !== undefined) {
      for (let d = 1; d <= 9; d++) {
        if (!(cand[i] & (1 << d)) || !pos[d]) continue;
        const [px, py] = pos[d],
          st = (strike[i] || 0) & (1 << d),
          mine = (opts[i] || 0) & (1 << d),
          faint = v.digit && d !== v.digit && !st;
        if (mine) texts += `<circle cx="${x + px}" cy="${y + py}" r="15" fill="var(--optbg)"/>`;
        texts += num(x + px, y + py, st ? 26 : mine ? 25 : 23, st || mine ? 700 : 500, st ? "var(--bad)" : mine ? "var(--indigo)" : "var(--ink)", d, faint ? ` opacity="0.3"` : "");
        if (st) texts += `<line x1="${x + px - 13}" y1="${y + py + 11}" x2="${x + px + 13}" y2="${y + py - 11}" stroke="var(--bad)" stroke-width="3.5" stroke-linecap="round"/>`;
      }
    } else if (b.reveal && b.reveal[i]) texts += num(x + 50, y + 52, 44, 400, "var(--mute)", b.reveal[i], ` opacity="0.7"`);
    else if (b.notes && b.notes[i]) {
      for (let d = 1; d <= 9; d++) if (b.notes[i] & (1 << d) && pos[d]) texts += num(x + pos[d][0], y + pos[d][1], 22, 500, "var(--mute)", d);
    }
    if (corner[i]) texts += `<path d="M${x + S - 30} ${y + 2}h28v28z" fill="${corner[i]}"/>`;
    if (badges[i] != null) texts += `<circle cx="${x + 19}" cy="${y + 19}" r="14" fill="var(--ink)"/>` + num(x + 19, y + 20, 18, 700, "var(--paper)", badges[i]);
  }
  texts += `</g>`;
  // the cells that play no part, dimmed (under the grid lines, so the board stays crisp)
  let dim = "";
  if (focus) for (let i = 0; i < n; i++) if (!focus.has(i)) dim += `<rect x="${(i % cols) * S}" y="${Math.floor(i / cols) * S}" width="${S}" height="${S}" fill="var(--paper)" opacity="0.55"/>`;
  if (dim) texts += `<g pointer-events="none">${dim}</g>`;
  // the grid: thin lines inside regions, thick ones between them, and the frame
  let thin = "",
    thick = "";
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols) {
        const seg = `M${(c + 1) * S} ${r * S}V${(r + 1) * S}`;
        if (region[i] === region[i + 1]) thin += seg;
        else thick += seg;
      }
      if (r + 1 < rows) {
        const seg = `M${c * S} ${(r + 1) * S}H${(c + 1) * S}`;
        if (region[i] === region[i + cols]) thin += seg;
        else thick += seg;
      }
    }
  let lines =
    `<path d="${thin}" stroke="var(--grid)" stroke-width="2" fill="none" pointer-events="none"/>` +
    `<path d="${thick}" stroke="var(--ink)" stroke-width="7" stroke-linecap="square" fill="none" pointer-events="none"/>` +
    `<rect x="0" y="0" width="${cols * S}" height="${rows * S}" stroke="var(--ink)" stroke-width="9" fill="none" pointer-events="none"/>`;
  // coloured outlines around the region or house it is about
  const outlines = !v.outline ? [] : Array.isArray(v.outline) && v.outline.length && typeof v.outline[0] === "object" ? v.outline : [{ cells: v.outline }];
  for (const o of outlines) {
    const set = asSet(o.cells);
    let d = "";
    set.forEach((i) => {
      const r = Math.floor(i / cols),
        c = i % cols,
        x = c * S,
        y = r * S;
      if (r === 0 || !set.has(i - cols)) d += `M${x} ${y}H${x + S}`;
      if (r === rows - 1 || !set.has(i + cols)) d += `M${x} ${y + S}H${x + S}`;
      if (c === 0 || !set.has(i - 1)) d += `M${x} ${y}V${y + S}`;
      if (c === cols - 1 || !set.has(i + 1)) d += `M${x + S} ${y}V${y + S}`;
    });
    if (d) lines += `<path d="${d}" stroke="${o.col || "var(--outline)"}" stroke-width="8" stroke-linecap="round" fill="none" pointer-events="none"/>`;
  }
  // arrows from cell to cell, slightly bent so a chain stays readable, with the head drawn at the end
  for (const l of v.links || []) {
    const c = (k) => [(k % cols) * S + 50, Math.floor(k / cols) * S + 50],
      [x1, y1] = c(l.from),
      [x2, y2] = c(l.to),
      dx = x2 - x1,
      dy = y2 - y1,
      len = Math.hypot(dx, dy) || 1,
      ux = dx / len,
      uy = dy / len,
      sx = x1 + ux * 30,
      sy = y1 + uy * 30,
      ex = x2 - ux * 34,
      ey = y2 - uy * 34,
      bend = Math.min(30, len * 0.15),
      cx = (sx + ex) / 2 - uy * bend,
      cy = (sy + ey) / 2 + ux * bend,
      tx = ex - cx,
      ty = ey - cy,
      tl = Math.hypot(tx, ty) || 1,
      hx = tx / tl,
      hy = ty / tl,
      col = l.col || "var(--link)";
    lines +=
      `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${col}" stroke-width="5" fill="none" stroke-linecap="round" pointer-events="none"/>` +
      `<path d="M${(ex + hx * 12).toFixed(1)} ${(ey + hy * 12).toFixed(1)}L${(ex - hx * 10 - hy * 10).toFixed(1)} ${(ey - hy * 10 + hx * 10).toFixed(1)}L${(ex - hx * 10 + hy * 10).toFixed(1)} ${(ey - hy * 10 - hx * 10).toFixed(1)}Z" fill="${col}" pointer-events="none"/>`;
  }
  if (v.ring && v.ring.c >= 0) {
    const x = (v.ring.c % cols) * S,
      y = Math.floor(v.ring.c / cols) * S;
    lines += `<rect x="${x + 7}" y="${y + 7}" width="${S - 14}" height="${S - 14}" rx="8" fill="none" pointer-events="none" stroke="${v.ring.warn ? "var(--warn)" : "var(--indigo)"}" stroke-width="8"${v.ring.warn ? ` stroke-dasharray="14 9"` : ""}/>`;
  }
  return { viewBox: `-34 -34 ${cols * S + 40} ${rows * S + 40}`, ratio: (cols * S + 40) / (rows * S + 40), inner: `<g>${cells}</g>${texts}${lines}` };
}
// A whole board as an <svg> picture (the small boards)
function boardSvg(b, v = {}) {
  const p = boardParts(b, v);
  return `<svg viewBox="${p.viewBox}" role="img" aria-label="${esc(v.label || tr("The board before the move"))}">${p.inner}</svg>`;
}

// ---------- The legend under a board: the roles that are shown, each with its colour and shape, so the explanation can
// point at them ("the blue cells") without explaining the colours in its sentences
const ROLE_SWATCH = {
  pattern: `<i class="lg cell" style="background:var(--pat)"></i>`,
  opts: `<i class="lg opt"></i>`,
  target: `<i class="lg cell" style="background:var(--tgt)"></i>`,
  bad: `<i class="lg cell" style="background:var(--badbg)"></i>`,
  work: `<i class="lg ring" style="border-color:var(--work)"></i>`,
  hypo: `<i class="lg ring" style="border-color:var(--hypo)"></i>`,
  head: `<i class="lg ring dash" style="border-color:var(--warn)"></i>`,
  outline: `<i class="lg box" style="border-color:var(--outline)"></i>`,
  links: `<i class="lg arrow" style="color:var(--link)">→</i>`,
  answer: `<i class="lg ring" style="border-color:var(--indigo);border-width:3px"></i>`,
  strike: `<i class="lg strike">2</i>`,
};
function legendHtml(v, names) {
  const has = (x) => x && (x instanceof Set ? x.size : Array.isArray(x) ? x.length : Object.keys(x).length);
  const on = {
    pattern: has(v.pattern),
    opts: has(v.opts),
    target: has(v.target),
    bad: has(v.bad),
    work: has(v.work),
    hypo: has(v.hypo),
    outline: has(v.outline),
    links: has(v.links),
    strike: has(v.strike) && Object.values(v.strike).some(Boolean),
  };
  const items = Object.keys(names || {})
    .filter((k) => on[k] || k === "answer")
    .map((k) => `<span>${ROLE_SWATCH[k] || ""}${esc(names[k])}</span>`);
  return items.length ? `<div class="legend">${items.join("")}</div>` : "";
}

// ---------- An explanation's text: without cell names, pointing at the board (say), or with them when the setting "Cell
// names in explanations" is on (text, which is also what screen readers get)
const viewText = (v) => (!v ? "" : settings.coords || !v.say ? v.text || "" : v.say);
// The legend's names for a view (from the tutor), only when the explanation points at the board
const viewLegend = (v) => (!v || !v.legend || settings.coords || !v.say ? "" : legendHtml(v, v.legend));
// The teaching layers of an explanation view (a hint's step) for boardParts/boardSvg
function viewLayers(hv) {
  if (!hv) return {};
  return {
    pattern: hv.pattern,
    target: hv.target,
    bad: hv.bad,
    cand: hv.cand,
    strike: hv.strike,
    hypo: hv.hypo,
    hypoStart: hv.hypoStart,
    work: hv.work,
    opts: hv.opts,
    digit: hv.digit,
    outline: hv.outline,
    links: hv.links,
    focus: hv.focus,
  };
}

// A number on the board named in a caption or sentence: with cell names "b3 = 4"; without, the number in a small ring of the
// colour it has on the board, so the eye finds it there (the cell name stays for screen readers)
const cvTag = (nm, c, v, col) =>
  settings.coords ? `${nm(c)} = ${v}` : `<span class="cvtag" style="--c:${col}">${v}<span class="vh"> (${nm(c)})</span></span>`;
