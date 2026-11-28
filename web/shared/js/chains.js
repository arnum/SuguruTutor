// Colour and draw chains (27 Nov. 2026): a tool in the game to follow a chain yourself.
//   Colours: a number in a cell (a candidate) gets colour A or B, the two states of a chain (simple colouring). A cell
//   that sees both colours of a number loses it; two cells of one colour that see each other mean that colour is false.
//   With no number chosen the colour goes on the cell itself (28 Nov. 2026): cells of one colour hold the same number,
//   whichever it is (the nook and its twin, a chain's two equal ends). Drawn as a frame round the cell; once one of
//   them has its number, the others show it (draw.js).
//   Links: a line between two candidates (or two cells), solid for a strong link ("only two places" or "only two options")
//   and dashed for a weak one ("they see each other").
// The app does not judge the marks: they are notes, so they count as pencil for the grade (meta.pen) and a timed trial
// has none. They are hidden while a hint is shown, saved with the game and undone with Undo.
//
// Use: the Chains button opens a bar with four tools (colour A, colour B, strong link, weak link) and Clear. The number
// buttons then choose the number to work on; tapping cells colours that number, or links it (tap two cells). With no
// number chosen, a colour goes on the cell and a link goes from cell to cell. Choosing another number between the two taps links two numbers (a cell's
// two options, for a chain of cells with two options).

let chainTool = null, // null (off) | "A" | "B" | "S" (strong link) | "W" (weak link)
  chainD = 0, // the number worked on (0: none)
  chainFrom = null, // the first end of a link being drawn: { c, d }
  chainState = { col: {}, links: [] }; // col: { cell*16+d: 1 (A) | 2 (B); d 0: the cell }; links: [{ a, da, b, db, w (1 = weak) }]

const chainKey = (c, d) => c * 16 + d;
const chainEmpty = () => !Object.keys(chainState.col).length && !chainState.links.length;
function chainLoad(saved) {
  chainState = saved && saved.col ? { col: Object.assign({}, saved.col), links: (saved.links || []).slice() } : { col: {}, links: [] };
  chainTool = null;
  chainD = 0;
  chainFrom = null;
}
const chainSnapshot = () => ({ col: Object.assign({}, chainState.col), links: chainState.links.map((l) => Object.assign({}, l)) });
function chainRestore(s) {
  if (s) chainState = s;
  chainFrom = null;
}
// a number placed: the number is gone as an option from the cell's peers, so are its colours there
function chainPlaced(cell, d) {
  for (const j of peerSets[cell]) delete chainState.col[chainKey(j, d)];
}
// a cell erased or the board started over (its own colour stays: it says which cells are equal, not what it holds)
function chainClearCell(cell) {
  for (let d = 1; d <= 9; d++) delete chainState.col[chainKey(cell, d)];
  chainState.links = chainState.links.filter((l) => l.a !== cell && l.b !== cell);
}
function chainClearAll() {
  chainState = { col: {}, links: [] };
  chainFrom = null;
}

// ---------- Input
function chainSetTool(t) {
  chainTool = t;
  chainFrom = null;
  renderChain();
  renderPad();
  renderGrid();
}
function chainToggle() {
  if (solved || (meta && meta.trial)) return;
  if (chainTool) chainTool = null;
  else {
    chainTool = "A";
    noteMode = false;
    // start with the number of the selected cell's only note or the number the player was looking at, if any
    if (!chainD && selected >= 0 && !value(selected)) {
      const m = notes[selected];
      if (m && !(m & (m - 1))) chainD = Math.log2(m);
    }
  }
  chainFrom = null;
  renderChain();
  renderPad();
  renderGrid();
}
// a number button: choose the number (again: none)
function chainPad(d) {
  chainD = chainD === d && !chainFrom ? 0 : d;
  renderChain();
  renderPad();
  renderGrid();
}
function chainTap(cell) {
  if (solved) return;
  if (chainTool === "A" || chainTool === "B") {
    if (chainD && value(cell)) return setMsg(tr("Colours go on the options of empty cells."), "warn");
    if (chainD > digitMax(cell)) return setMsg(tr("This cell cannot be {v}.", { v: chainD }), "warn");
    const k = chainKey(cell, chainD), // chainD 0: the cell itself
      want = chainTool === "A" ? 1 : 2;
    pushUndo();
    if (chainState.col[k] === want) delete chainState.col[k];
    else {
      chainState.col[k] = want;
      penAdded();
    }
    setMsg("", "");
    return chainChanged();
  }
  // a link: the first tap marks one end, the second draws it (the same two ends again remove it)
  const end = { c: cell, d: chainD && !value(cell) && chainD <= digitMax(cell) ? chainD : 0 };
  if (!chainFrom || (chainFrom.c === end.c && chainFrom.d === end.d)) {
    chainFrom = chainFrom ? null : end;
    renderGrid();
    renderPad();
    return renderChain();
  }
  const same = (l) => (l.a === chainFrom.c && l.da === chainFrom.d && l.b === end.c && l.db === end.d) || (l.b === chainFrom.c && l.db === chainFrom.d && l.a === end.c && l.da === end.d);
  pushUndo();
  const old = chainState.links.find(same),
    w = chainTool === "W" ? 1 : 0;
  chainState.links = chainState.links.filter((l) => !same(l));
  if (!old || old.w !== w) {
    chainState.links.push({ a: chainFrom.c, da: chainFrom.d, b: end.c, db: end.d, w });
    penAdded();
  }
  chainFrom = null;
  setMsg("", "");
  chainChanged();
}
function chainChanged() {
  renderGrid();
  renderPad();
  renderChain();
  clearTimeout(saveT);
  saveT = setTimeout(saveCurrent, 600);
}
function chainClear() {
  if (chainEmpty()) return;
  pushUndo();
  chainClearAll();
  setMsg(tr("Colours and links cleared. Undo brings them back."), "");
  chainChanged();
}

// ---------- Drawing
// what renderGrid adds to the board (nothing while a hint is shown)
function chainLayer() {
  if (chainEmpty() && !chainTool) return {};
  return { ucol: chainState.col, ulinks: chainState.links, ufrom: chainFrom, noteDigit: chainTool ? chainD : 0 };
}
function renderChain() {
  if (solved) chainTool = null;
  const on = !!chainTool,
    bar = $("chainBar");
  $("chainBtn").setAttribute("aria-pressed", on);
  bar.hidden = !on;
  if (on)
    bar.querySelectorAll("[data-tool]").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.tool === chainTool);
    });
  $("chainClear").disabled = chainEmpty();
}
// the line under the numbers while the tool is on (board.js)
function chainPadHint() {
  if (chainTool === "A" || chainTool === "B")
    return chainD
      ? tr("Tap cells to colour {v} with colour {c}. Tap again to remove it.", { v: chainD, c: chainTool })
      : tr("Tap cells to mark them {c}: cells with one colour hold the same number. Or choose a number to colour.", { c: chainTool });
  if (chainFrom) return tr("Now tap the other end of the link.") + " " + tr("You can choose another number first.");
  return chainTool === "S"
    ? tr("Strong link (only two places, or only two options): tap two cells.") + (chainD ? "" : " " + tr("Choose a number to link its options."))
    : tr("Weak link (they see each other): tap two cells.") + (chainD ? "" : " " + tr("Choose a number to link its options."));
}

$("chainBtn").onclick = chainToggle;
$("chainBar").querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => chainSetTool(b.dataset.tool)));
$("chainClear").onclick = chainClear;
$("chainHelp").onclick = () => openToolGuide("colours"); // the guide to the pencil and chains (toolguide.js)
