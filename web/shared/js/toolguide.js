// Pencil and chains: a short guide to the two note tools, with examples on real boards drawn as the game draws them
// (27 Nov. 2026). Opened from the game's menu and from the "?" in the chain bar. Each example steps through with the
// same ‹ › as the boards after a game (analysis.js, stepsHtml); the chips above a board are the buttons tapped in it.
//
// An example: a board (all its numbers drawn as given), pencil marks, and frames that add to it in turn:
//   notes {cell: "13"} (marks, "" for none), set {cell: v} (a number placed), col {"c4:1": "A"} (a colour on an option),
//   link [[from, number, to, number, "S" | "W"]] (a strong or weak link; the same cell twice links its two options);
// and, for that frame only: ring (the selected cell), target and strike (a cell that loses a mark), outline (a house),
// digit (the number the chain tool works on: its marks stand out), keys (the buttons; "*" = pressed). An example's focus
// (cells) dims the rest of a big board in every frame.
// Every claim was checked on the board's solution: the Suguru links examples are the guide's (tools/guide/data.json), the
// Sudoku ones from its Sudoku guide, and the colour boards were found by a search (27 Nov. 2026). The cell colours'
// board is the nook's guide page (28 Nov. 2026). A colour on a cell itself: {"c4:0": "A"}.

const TG_COLS = "abcdefghij";

function toolExamples() {
  if (APP.id === "sudoku") {
    const D1 = "26...54.9...72.63.....6..2.3796....2416832597.2....34668..9..54.54.86..31.25...68",
      N1 = { c1: "1378", d1: "13", e1: "1", h1: "178", a2: "589", b2: "49", c2: "158", f2: "1489", i2: "15", a3: "5789", b3: "349", c3: "13578", d3: "1349", f3: "13489", g3: "178", i3: "15", e4: "145", f4: "14", g4: "18", h4: "18", a6: "58", c6: "58", d6: "19", e6: "157", f6: "179", c7: "37", d7: "123", f7: "137", g7: "127", a8: "79", d8: "12", g8: "1279", h8: "17", b9: "39", e9: "47", f9: "347", g9: "79" },
      row = (r) => Array.from({ length: 9 }, (_, c) => TG_COLS[c] + r),
      col = (c) => Array.from({ length: 9 }, (_, r) => c + (r + 1)),
      box = (br, bc) => Array.from({ length: 9 }, (_, k) => TG_COLS[bc * 3 + (k % 3)] + (br * 3 + Math.floor(k / 3) + 1));
    return [
      {
        id: "pencil",
        title: tr("Pencil"),
        tldr: tr("Small marks for the numbers a cell can still be."),
        rows: 9,
        cols: 9,
        board: D1,
        notes: Object.assign({}, N1, { d1: "" }),
        frames: [
          { ring: "d1", keys: [tr("Pencil") + "*"], text: tr("Pencil on, then a cell, then the numbers it can be.") },
          { notes: { d1: "13" }, ring: "d1", keys: [tr("Pencil") + "*", "1", "3"], text: tr("Each becomes a small mark. Tap a number again to take its mark away.") },
          {
            set: { e1: 1 },
            notes: { c1: "378", d1: "3", h1: "78", e4: "45", e6: "57", f2: "489", d3: "349", f3: "3489" },
            ring: "e1",
            keys: [tr("Pencil"), "1"],
            text: tr("Pencil off, place a number: it leaves the marks in its row, column and box."),
          },
        ],
      },
      {
        id: "colours",
        title: tr("Colours"),
        tldr: tr("A and B: one of the two is right."),
        rows: 9,
        cols: 9,
        board: D1,
        notes: N1,
        focus: ["b2", "b3", "d3", "f2", "f3", "e4", "f4", "e9", "f9"], // the cells where 4 can go
        frames: [
          { digit: 4, keys: [tr("Chains") + "*", "A*", "4*"], text: tr("Chains, A, then a number: its marks stand out.") },
          { col: { "e4:4": "A", "f4:4": "B" }, outline: row(4), digit: 4, keys: ["A", "B"], text: tr("4 has two places in this row. Colour one A and the other B: one of them is 4.") },
          { col: { "e9:4": "B", "f9:4": "A" }, outline: [col("e"), row(9)], digit: 4, keys: ["B", "A"], text: tr("Where 4 again has only two places, go on: the colours take turns.") },
          { target: ["f2", "f3"], strike: { f2: "4", f3: "4" }, digit: 4, text: tr("These cells see both colours, so they cannot be 4.") },
        ],
      },
      {
        id: "links",
        title: tr("Links"),
        tldr: tr("Solid: one of the two is right. Dashed: not both."),
        rows: 9,
        cols: 9,
        board: "..1459.765947.681...618.4954...6..3...2.4596..6..7..4.6485.7.29123698754957..468.",
        notes: { g1: "23", e2: "23", i2: "23", g4: "125", g6: "125", e7: "13", g7: "13" },
        focus: ["i2", "g1", "g7", "e7", "e2"],
        frames: [
          { link: [["i2", 3, "g1", 3, "S"]], outline: box(0, 2), digit: 3, keys: [tr("Chains") + "*", tr("Strong") + "*", "3"], text: tr("Strong link: 3 has only these two places in the box. One of them is 3.") },
          { link: [["g1", 3, "g7", 3, "W"]], digit: 3, keys: [tr("Weak") + "*"], text: tr("Weak link: these two 3s see each other, so they cannot both be 3.") },
          { link: [["g7", 3, "e7", 3, "S"]], outline: row(7), digit: 3, keys: [tr("Strong") + "*"], text: tr("Strong again: 3 has only these two places in the row.") },
          { target: ["e2"], strike: { e2: "3" }, digit: 3, text: tr("The chain starts and ends with a strong link, so one of its ends is 3. A cell that sees both ends cannot be 3.") },
        ],
      },
      {
        id: "pairs",
        title: tr("Links in a cell"),
        tldr: tr("A cell with two options: one of them is right."),
        rows: 9,
        cols: 9,
        board: "42358..6.8..642.3556.39.248..67548..274968513985213476..247..81...8....4.481.965.",
        notes: { g7: "39", a8: "1367", b8: "1359", c8: "179", e8: "23", f8: "56", g8: "379", h8: "29", i9: "27" },
        focus: ["g7", "h8", "e8", "g8"],
        frames: [
          { link: [["g7", 3, "g7", 9, "S"]], keys: [tr("Strong") + "*", "3", "9"], text: tr("Link a cell's two options: choose 3, tap the cell, choose 9, tap it again.") },
          { link: [["g7", 9, "h8", 9, "W"], ["h8", 9, "h8", 2, "S"]], keys: [tr("Weak") + "*", tr("Strong") + "*"], text: tr("The 9s see each other (weak), and the next cell has only 9 and 2 (strong).") },
          { link: [["h8", 2, "e8", 2, "W"], ["e8", 2, "e8", 3, "S"]], keys: [tr("Weak") + "*", tr("Strong") + "*"], text: tr("Again: the 2s see each other, and that cell has only 2 and 3.") },
          { target: ["g8"], strike: { g8: "3" }, text: tr("Both ends are 3s, and one of them is right. A cell that sees both cannot be 3.") },
        ],
      },
    ];
  }
  const S1 = ".3.53.5.424.3...5.4234...",
    R1 = ["AABBB", "AABBC", "ADECC", "DDECF", "DDEFF"],
    N1 = { a1: "12", c1: "12", a2: "12", c2: "12", b3: "12", d3: "1", e3: "13", a4: "12", c4: "12", c5: "12", d5: "13", e5: "13" };
  return [
    {
      id: "pencil",
      title: tr("Pencil"),
      tldr: tr("Small marks for the numbers a cell can still be."),
      rows: 5,
      cols: 5,
      regions: R1,
      board: S1,
      notes: Object.assign({}, N1, { e3: "" }),
      frames: [
        { ring: "e3", keys: [tr("Pencil") + "*"], text: tr("Pencil on, then a cell, then the numbers it can be.") },
        { notes: { e3: "13" }, ring: "e3", keys: [tr("Pencil") + "*", "1", "3"], text: tr("Each becomes a small mark. Tap a number again to take its mark away.") },
        { set: { d3: 1 }, notes: { c2: "2", e3: "3", c4: "2" }, ring: "d3", keys: [tr("Pencil"), "1"], text: tr("Pencil off, place a number: it leaves the marks of the cells it touches and of its region.") },
      ],
    },
    {
      id: "colours",
      title: tr("Colours"),
      tldr: tr("A and B: one of the two is right."),
      rows: 5,
      cols: 5,
      regions: R1,
      board: S1,
      notes: N1,
      frames: [
        { digit: 1, keys: [tr("Chains") + "*", "A*", "1*"], text: tr("Chains, A, then a number: its marks stand out.") },
        { col: { "c4:1": "A", "c5:1": "B" }, outline: ["c3", "c4", "c5"], digit: 1, keys: ["A", "B"], text: tr("1 has two places in this region. Colour one A and the other B: one of them is 1.") },
        { target: ["d5"], strike: { d5: "1" }, digit: 1, text: tr("This cell touches both colours, so it cannot be 1.") },
        { notes: { d5: "3" }, ring: "d5", keys: [tr("Pencil") + "*", "1"], text: tr("Take its mark away with the pencil: only 3 is left.") },
      ],
    },
    {
      id: "same",
      title: tr("Same number"),
      tldr: tr("Colour the cells themselves: one colour, one number."),
      rows: 5,
      cols: 5,
      regions: ["AAAAA", "BBBBB", "CCDEE", "FCDEE", "FCCEG"],
      board: "4..3.........51.3.42.5.31",
      notes: { b1: "125", c1: "125", e1: "125", a2: "1235", b2: "1235", c2: "124", d2: "24", e2: "24", a3: "124", b3: "124", c3: "12", a4: "12", c4: "12", a5: "12", c5: "12" },
      frames: [
        { col: { "c4:0": "A" }, ring: "c4", keys: [tr("Chains") + "*", "A*"], text: tr("With no number chosen, a colour goes on the cell itself: cells with one colour hold the same number.") },
        { col: { "a3:0": "A" }, outline: ["a3", "b3", "b4", "b5", "c5"], keys: ["A*"], text: tr("c4 touches all of this region but a3, and its own region is no bigger: the two hold the same number (a nook).") },
        { set: { c4: 1 }, notes: { b3: "24", c3: "2", c5: "2" }, ring: "c4", keys: [tr("Chains"), "1"], text: tr("Once one of them has its number, the others of its colour show it.") },
      ],
    },
    {
      id: "links",
      title: tr("Links"),
      tldr: tr("Solid: one of the two is right. Dashed: not both."),
      rows: 5,
      cols: 5,
      regions: ["AABBC", "AABBB", "DAEEE", "DDDEE", "FFFFF"],
      board: "3235114142.5...4...4..4.3",
      notes: { a3: "23", c3: "23", d3: "35", e3: "135", b4: "123", c4: "13", d4: "125", a5: "125", b5: "25", d5: "125" },
      frames: [
        { link: [["c4", 1, "b4", 1, "S"]], outline: ["a3", "a4", "b4", "c4"], digit: 1, keys: [tr("Chains") + "*", tr("Strong") + "*", "1"], text: tr("Strong link: 1 has only these two places in the region. One of them is 1.") },
        { link: [["b4", 1, "a5", 1, "W"]], digit: 1, keys: [tr("Weak") + "*"], text: tr("Weak link: these two 1s touch, so they cannot both be 1.") },
        { link: [["a5", 1, "d5", 1, "S"]], outline: ["a5", "b5", "c5", "d5", "e5"], digit: 1, keys: [tr("Strong") + "*"], text: tr("Strong again: 1 has only these two places in this region.") },
        { target: ["d4"], strike: { d4: "1" }, digit: 1, text: tr("The chain starts and ends with a strong link, so one of its ends is 1. A cell touching both ends cannot be 1.") },
      ],
    },
    {
      id: "pairs",
      title: tr("Links in a cell"),
      tldr: tr("A cell with two options: one of them is right."),
      rows: 5,
      cols: 5,
      regions: ["ABCCD", "ABCCD", "BBEED", "BEEED", "FFFFF"],
      board: "153.324...13.3.2.....13.2",
      notes: { d1: "124", c2: "12", d2: "14", e2: "12", c3: "125", e3: "124", b4: "45", c4: "245", d4: "15", e4: "14", a5: "45", d5: "45" },
      frames: [
        { link: [["d4", 1, "d4", 5, "S"]], keys: [tr("Strong") + "*", "1", "5"], text: tr("Link a cell's two options: choose 1, tap the cell, choose 5, tap it again.") },
        { link: [["d4", 5, "d5", 5, "W"], ["d5", 5, "d5", 4, "S"]], keys: [tr("Weak") + "*", tr("Strong") + "*"], text: tr("The 5s touch (weak), and the next cell has only 5 and 4 (strong).") },
        { link: [["d5", 4, "e4", 4, "W"], ["e4", 4, "e4", 1, "S"]], keys: [tr("Weak") + "*", tr("Strong") + "*"], text: tr("Again: the 4s touch, and that cell has only 4 and 1.") },
        { target: ["e3"], strike: { e3: "1" }, text: tr("Both ends are 1s, and one of them is right. A cell touching both cannot be 1.") },
      ],
    },
  ];
}

const tgIdx = (ex, name) => TG_COLS.indexOf(name[0]) + (parseInt(name.slice(1), 10) - 1) * ex.cols;
const tgMask = (ds) => [...String(ds)].reduce((m, d) => m | (1 << +d), 0);
// The board after frame k
function tgState(ex, k) {
  const n = ex.rows * ex.cols,
    givens = [...ex.board].map((ch) => (ch === "." ? 0 : +ch)),
    values = givens.slice(),
    notes = new Array(n).fill(0),
    col = {},
    links = [];
  const put = (m) => Object.entries(m || {}).forEach(([nm, ds]) => (notes[tgIdx(ex, nm)] = tgMask(ds)));
  put(ex.notes);
  for (let i = 0; i <= k; i++) {
    const f = ex.frames[i];
    if (f.set)
      Object.entries(f.set).forEach(([nm, v]) => {
        values[tgIdx(ex, nm)] = v;
        notes[tgIdx(ex, nm)] = 0;
      });
    put(f.notes);
    Object.entries(f.col || {}).forEach(([key, c]) => {
      const [nm, d] = key.split(":");
      col[tgIdx(ex, nm) * 16 + +d] = c === "A" ? 1 : 2;
    });
    (f.link || []).forEach(([a, da, b, db, t]) => links.push({ a: tgIdx(ex, a), da, b: tgIdx(ex, b), db, w: t === "W" ? 1 : 0 }));
  }
  return { givens, values, notes, col, links };
}
function tgRegion(ex) {
  if (!ex.regions) return sudokuBoxes(ex.rows, ex.cols);
  const s = ex.regions.join(""),
    letters = [...new Set(s)];
  return [...s].map((ch) => letters.indexOf(ch));
}
function tgFrameHtml(ex, k, region) {
  const f = ex.frames[k],
    st = tgState(ex, k),
    sizes = {};
  region.forEach((r) => (sizes[r] = (sizes[r] || 0) + 1));
  const strike = {};
  Object.entries(f.strike || {}).forEach(([nm, ds]) => (strike[tgIdx(ex, nm)] = tgMask(ds)));
  const outline = !f.outline ? null : Array.isArray(f.outline[0]) ? f.outline.map((cells) => ({ cells: cells.map((nm) => tgIdx(ex, nm)) })) : f.outline.map((nm) => tgIdx(ex, nm));
  const svg = boardSvg(
    { rows: ex.rows, cols: ex.cols, region, givens: st.givens, values: st.values, notes: st.notes, maxR: Math.max(...Object.values(sizes)) },
    {
      labels: false,
      ucol: st.col,
      ulinks: st.links,
      noteDigit: f.digit || 0,
      ring: f.ring ? { c: tgIdx(ex, f.ring) } : null,
      target: (f.target || []).map((nm) => tgIdx(ex, nm)),
      strike,
      outline,
      focus: (f.focus || ex.focus || []).map((nm) => tgIdx(ex, nm)),
      label: f.text,
    },
  );
  const keys = (f.keys || []).map((k) => `<span class="${k.endsWith("*") ? "on" : ""}">${esc(k.replace(/\*$/, ""))}</span>`).join("");
  const n = ex.frames.length;
  return (
    `<div class="mbstep"${k ? " hidden" : ""}>` +
    `<div class="tgkeys" aria-label="${esc(tr("Buttons"))}">${keys}</div>` +
    `<div class="tgboard">${svg}</div>` +
    `<div class="mbstepnav"><button type="button" data-mbstep="-1" aria-label="${esc(tr("Previous step"))}"${k ? "" : " disabled"}>‹</button>` +
    `<span>${tr("Step {k} of {n}", { k: k + 1, n })}</span>` +
    `<button type="button" data-mbstep="1" aria-label="${esc(tr("Next step"))}"${k === n - 1 ? " disabled" : ""}>›</button></div>` +
    `<p class="mbtext">${esc(f.text)}</p></div>`
  );
}
function renderToolGuide() {
  const exs = toolExamples();
  $("toolsBody").innerHTML =
    exs
      .map((ex) => {
        const region = tgRegion(ex);
        return (
          `<section class="tg" id="tg-${ex.id}"><h3>${esc(ex.title)}</h3><p class="tldr">${esc(ex.tldr)}</p>` +
          `<div class="mbsteps" data-k="0">${ex.frames.map((_, k) => tgFrameHtml(ex, k, region)).join("")}</div></section>`
        );
      })
      .join("") +
    `<section class="tg"><h3>${tr("Good to know")}</h3><ul class="tglist">` +
    [
      tr("With no number chosen, A and B colour the cell itself: cells of one colour hold the same number, and once one has it the others show it."),
      tr("Clear removes all colours and links. Undo brings them back."),
      tr("A placed number takes its marks and colours away from the cells it rules out."),
      tr("Colours and links are hidden while a hint is shown, and kept with the game."),
      tr("From mark {n} on (colours and links count too), the game counts as played with pencil: the Pencil button shows that grade.", { n: PEN_MIN }),
      tr("The timed trial has no pencil and no chains."),
    ]
      .map((t) => `<li>${esc(t)}</li>`)
      .join("") +
    `</ul></section>`;
  // tapping a board goes one step on, as the guide does
  $("toolsBody")
    .querySelectorAll(".mbsteps")
    .forEach((box) =>
      box.querySelectorAll(".tgboard").forEach(
        (b) =>
          (b.onclick = () => {
            const st = [...box.querySelectorAll(":scope > .mbstep")],
              k = (+box.dataset.k + 1) % st.length;
            st.forEach((x, j) => (x.hidden = j !== k));
            box.dataset.k = k;
          }),
      ),
    );
}
function openToolGuide(section) {
  go("tools");
  if (section) {
    const el = document.getElementById("tg-" + section);
    if (el) el.scrollIntoView();
  }
}
