// Practice games: four short games, each training one part of seeing. The rounds, levels, scoring and screens are the
// drills' own (drill.js); this file has what differs per game. The positions come from findGame in drillgen.js.
//  Cascade: place a run of easy numbers; each one can open the next
//  What changed?: one number is placed; find the new easy numbers it made
//  Sweep: a pattern is given; tap every cell that loses an option
//  Count them: how many easy numbers are on the board?
//  Quick call: true or false, as many as you can in 60 seconds (the one game with a clock: the pressure is the game)
// Time is measured against your own curve, like the drills: an easy number costs what your curve says for singles.

const PRACTICE_GAMES = ["cascade", "changed", "sweep", "count", "quick"];
const CASCADE_ENTRY_MS = 1000; // most of the time per number Cascade leaves out (tapping the number after the cell)
const isGame = (k) => typeof k === "string";
const gNm = (c, i) => "abcdefghij"[i % c.b.cols] + (Math.floor(i / c.b.cols) + 1);
// seconds your curve expects for an easy number with n to choose from
const easyU = (n = 1) => calTime(myCal(), 1, n, true);
// the pencil marks on the board (only at the levels that show them)
function gameCand(c, known) {
  const cand = {};
  if (!c.spec.pencil) return cand;
  const S = c.tu.fromKnown(known || c.known);
  (known || c.known).forEach((v, i) => !v && (cand[i] = S.cand[i]));
  return cand;
}
// the game's number pad (padButtonsHtml in board.js), so it looks and responds the same
const padHtml = (max, off) => `<div class="pad dpad" style="--padn:${max};--padl:${max > 6 ? Math.ceil(max / 2) : max}">${padButtonsHtml(max, off)}</div>`;

const PG = {
  cascade: {
    name: () => tr("Cascade"),
    blurb: () => tr("Place a run of easy numbers. Each one can open the next."),
    round: 3,
    showLabel: () => tr("Show one"),
    init(c) {
      c.need = c.spec.n;
      c.placed = [];
      c.helped = [];
      c.sel = null;
      c.exp = 0;
    },
    task(c) {
      const k = c.placed.length + c.helped.length;
      if (c.phase === "done")
        return (
          `<h3 class="ok">✓ ${tr("{n} numbers placed", { n: c.need })}</h3>` +
          (c.helped.length ? `<p>${c.helped.length === 1 ? tr("One of them was shown to you.") : tr("{n} of them were shown to you.", { n: c.helped.length })}</p>` : "")
        );
      return (
        `<h3>${tr("Place {n} numbers", { n: c.need })}</h3>` +
        `<p>${tr("Tap a cell, then its number. Each number you place can open the next.")}</p>` +
        `<p class="dprog">${tr("{k} of {n} placed", { k, n: c.need })}</p>`
      );
    },
    pad: (c) => (c.phase === "done" ? "" : padHtml(c.P2.maxR, c.sel == null)),
    tap(c, cell) {
      if (c.known[cell]) return;
      c.sel = c.sel === cell ? null : cell;
      c.selAt = performance.now();
      renderDrill();
    },
    padTap(c, v) {
      const cell = c.sel;
      if (cell == null) return;
      if (c.P2.sol[cell] !== v) return drillFlash(c, [cell]);
      // entering the number is finger work, not seeing: up to a second per number is not counted
      c.inputMs = (c.inputMs || 0) + Math.min(CASCADE_ENTRY_MS, performance.now() - (c.selAt || performance.now()));
      const opts = c.tu.easyList(c.known).length;
      plog(c, "num", cell, opts);
      c.exp += easyU(Math.max(1, opts));
      c.known[cell] = v;
      c.placed.push(cell);
      c.sel = null;
      c.last = cell;
      if (c.placed.length + c.helped.length >= c.need) return drillFinish(false);
      renderDrill();
    },
    // "Show one" places one easy number for you and costs a little; half the run shown counts as a miss
    show(c) {
      const h = c.tu.easiest(c.known);
      if (!h) return;
      plog(c, "show", h.cell);
      c.known[h.cell] = h.v;
      c.helped.push(h.cell);
      c.sel = null;
      c.last = h.cell;
      c.penalty = (c.penalty || 0) + 0.5;
      if (c.placed.length + c.helped.length >= c.need) return drillFinish(c.helped.length * 2 >= c.need);
      renderDrill();
    },
    expected: (c) => c.exp || easyU(1),
    // the time that counts: until you tap the right cell, without choosing its number
    measured: (c, sec) => Math.max(0.5, sec - (c.inputMs || 0) / 1000),
    paceNote: () => tr("Choosing the number after tapping the cell is not counted (up to a second per number)."),
    view(c) {
      const color = {};
      c.known.forEach((v, i) => v && !c.b.givens[i] && (color[i] = "var(--ink)"));
      c.placed.forEach((i) => (color[i] = "var(--indigo)"));
      c.helped.forEach((i) => (color[i] = "var(--warn)"));
      return {
        hv: { pattern: c.sel != null ? [c.sel] : [], target: c.last != null && c.sel == null ? [c.last] : [], bad: c.flash || [], cand: gameCand(c) },
        color,
      };
    },
  },

  changed: {
    name: () => tr("What changed?"),
    blurb: () => tr("One number is placed. Find the new easy numbers it made."),
    round: 5,
    init(c) {
      c.move = c.b.move;
      c.before = new Set(c.tu.easyList(c.known).map(([i]) => i));
      c.after = c.known.slice();
      c.after[c.move.cell] = c.move.v;
      c.fresh = c.tu
        .easyList(c.after)
        .filter(([i]) => !c.before.has(i) && i !== c.move.cell)
        .map(([cell, v]) => ({ cell, v }));
      c.found = [];
      // the number drops in after a moment; the clock starts then
      c.phase = "intro";
      setTimeout(() => {
        if (!D || D.cur !== c || c.phase !== "intro") return;
        c.phase = "find";
        c.t0 = performance.now();
        c.hiddenMs = 0;
        c.pop = true;
        renderDrill();
      }, 900);
    },
    task(c) {
      const m = c.fresh.length,
        mv = gNm(c, c.move.cell) + " = " + c.move.v;
      if (c.phase === "intro") return `<h3>${tr("What changed?")}</h3><p>${tr("Watch the board: one number is about to be placed.")}</p>`;
      if (c.phase === "done") {
        const h = c.tu.explainMove(c.after, c.fresh[0].cell, c.fresh[0].v),
          kv = h ? keyView(h) : null;
        return (
          `<h3 class="${c.shown ? "" : "ok"}">${c.shown ? (c.fresh.length === 1 ? tr("Here it is:") : tr("Here they are:")) : "✓"} ${c.fresh.map((f) => gNm(c, f.cell) + " = " + f.v).join(", ")}</h3>` +
          (kv && kv.text ? `<p>${esc(kv.text)}</p>` : "")
        );
      }
      return (
        `<h3>${m === 1 ? tr("One new easy number") : tr("{n} new easy numbers", { n: m })}</h3>` +
        `<p>${m === 1 ? tr("{move} was just placed, and it made one new easy number. Find it.", { move: mv }) : tr("{move} was just placed, and it made {n} new easy numbers. Find them.", { move: mv, n: m })}</p>` +
        (m > 1 ? `<p class="dprog">${tr("{k} of {n} found", { k: c.found.length, n: m })}</p>` : "")
      );
    },
    tap(c, cell) {
      if (c.phase !== "find" || c.after[cell] || c.found.some((f) => f.cell === cell)) return;
      const f = c.fresh.find((x) => x.cell === cell);
      c.msg = "";
      if (f) {
        c.found.push(f);
        c.pop = true;
        if (c.found.length === c.fresh.length) return drillFinish(false);
        return renderDrill();
      }
      // near misses cost nothing, but are explained: easy already before, or one step after the new ones
      if (c.before.has(cell)) {
        c.msg = tr("{cell} was easy already before {move}.", { cell: gNm(c, cell), move: gNm(c, c.move.cell) + " = " + c.move.v });
        return renderDrill();
      }
      const after = c.after.slice();
      c.fresh.forEach((x) => (after[x.cell] = x.v));
      if (c.tu.easyList(after).some(([i]) => i === cell)) {
        c.msg = tr("{cell} comes one step later: it needs one of the other numbers first.", { cell: gNm(c, cell) });
        return renderDrill();
      }
      drillFlash(c, [cell]);
    },
    show(c) {
      c.shown = true;
      c.found = c.fresh.slice();
      drillFinish(true);
    },
    expected: (c) => easyU(1) * Math.max(1, c.fresh.length),
    view(c) {
      const placed = c.phase !== "intro";
      const marks = placed ? [{ c: c.move.cell, v: c.move.v, col: "var(--warn)" }] : [];
      (c.phase === "done" ? c.fresh : c.found).forEach((f) => marks.push({ c: f.cell, v: f.v, col: "var(--indigo)" }));
      const cand = gameCand(c, placed ? c.after : c.known);
      marks.forEach((m) => delete cand[m.c]);
      return { hv: { pattern: [], target: placed ? [c.move.cell] : [], bad: c.flash || [], cand }, marks };
    },
  },

  sweep: {
    name: () => tr("Sweep"),
    blurb: () => tr("A pattern is given. Tap every cell that loses an option."),
    round: 5,
    init(c) {
      const key = (cells) => cells.slice().sort((x, y) => x - y).join(",");
      c.app = c.tu.drillApps(c.known, c.b.L).find((a) => key(a.cells) === key(c.b.cells));
      c.hit = [];
      if (!c.app) c.failed = true;
    },
    task(c) {
      const n = c.app.targets.length;
      if (c.phase === "done") {
        const g = c.app.gives.map((x) => gNm(c, x.cell) + " = " + x.v).join(", ");
        return (
          `<h3 class="${c.shown ? "" : "ok"}">${c.shown ? tr("Here they are") : "✓ " + tr("All {n} cells", { n })}</h3><p>${esc(c.app.text)}</p>` +
          (g ? `<p>${c.app.gives.length === 1 ? tr("New easy number: {list}.", { list: g }) : tr("New easy numbers: {list}.", { list: g })}</p>` : "")
        );
      }
      return (
        `<h3>${tr("Which cells lose an option?")}</h3><p>${esc(c.app.premise)}</p>` +
        `<p class="dprog">${tr("{k} of {n} cells", { k: c.hit.length, n })}</p>`
      );
    },
    tap(c, cell) {
      const isTarget = c.app.targets.some((t) => t.cell === cell);
      // the pattern's own cells can lose options too (a hidden pair loses everything but its two numbers)
      if (c.known[cell] || c.hit.includes(cell) || (c.app.cells.includes(cell) && !isTarget)) return;
      c.msg = "";
      if (isTarget) {
        c.hit.push(cell);
        c.pop = true;
        if (c.hit.length === c.app.targets.length) return drillFinish(false);
        return renderDrill();
      }
      // a cell that sees the whole pattern but has nothing to lose: still a miss, but say why
      if (c.app.cells.every((p) => c.tu.peer(cell, p)))
        c.msg = tr("{cell} sees the pattern, but it has none of those numbers left to lose.", { cell: gNm(c, cell) });
      drillFlash(c, [cell]);
    },
    show(c) {
      c.shown = true;
      c.hit = c.app.targets.map((t) => t.cell);
      drillFinish(true);
    },
    expected: (c) => easyU(1) * (1 + c.app.targets.length),
    view(c) {
      const cand = gameCand(c),
        strike = {};
      // a swept cell shows what it lost, struck out (without pencil marks: only that)
      c.hit.forEach((cell) => {
        const t = c.app.targets.find((x) => x.cell === cell);
        strike[cell] = t.mask;
        if (cand[cell] === undefined) cand[cell] = t.mask;
      });
      const marks = c.phase === "done" ? c.app.gives.map((x) => ({ c: x.cell, v: x.v, col: "var(--indigo)" })) : null;
      return { hv: { pattern: c.app.cells, target: c.hit.slice(), bad: c.flash || [], cand, strike }, marks };
    },
  },

  count: {
    name: () => tr("Count them"),
    blurb: () => tr("How many easy numbers are on the board?"),
    round: 5,
    init(c) {
      c.easy = c.tu.easyList(c.known).map(([cell, v]) => ({ cell, v }));
      c.answer = null;
    },
    task(c) {
      const n = c.easy.length;
      if (c.phase === "done") {
        const next = PG.count.next(c),
          nx = next.length ? `<p>${tr("The dashed numbers become easy once a circled number is in, so they do not count yet.")}</p>` : "";
        if (c.answer === n) return `<h3 class="ok">✓ ${n}</h3><p>${tr("Each circled number could be seen directly.")}</p>` + nx;
        return (
          `<h3>${tr("There were {n}", { n })}</h3>` +
          `<p>${c.answer != null ? tr("You said {k}.", { k: c.answer }) + " " : ""}${tr("Each circled number could be seen directly.")}</p>` +
          nx
        );
      }
      return `<h3>${tr("How many easy numbers are on the board?")}</h3><p>${GAME.countLine} ${tr("Count only what the numbers already on the board show.")}</p>`;
    },
    pad: (c) => (c.phase === "done" ? "" : padHtml(9)),
    tap() {},
    // one answer per board; a wrong count shows them all and counts as a miss
    padTap(c, k) {
      plog(c, "count", k, c.easy.length);
      c.answer = k;
      drillFinish(k !== c.easy.length);
    },
    show(c) {
      c.shown = true;
      drillFinish(true);
    },
    expected: (c) => easyU(1) * (1 + 0.5 * c.easy.length),
    // the numbers that become easy once the circled ones are in: one step later, so not counted
    next(c) {
      if (!c.afterEasy) {
        c.afterEasy = c.known.slice();
        c.easy.forEach((x) => (c.afterEasy[x.cell] = x.v));
        const was = new Set(c.easy.map((x) => x.cell));
        c.nextEasy = c.tu
          .easyList(c.afterEasy)
          .filter(([i]) => !was.has(i))
          .map(([cell, v]) => ({ cell, v }));
      }
      return c.nextEasy;
    },
    // after the answer the board shows the circled numbers as placed: the pencil marks around them update, and what
    // follows from them is dashed
    view(c) {
      const done = c.phase === "done";
      if (!done) return { hv: { pattern: [], target: [], bad: [], cand: gameCand(c) } };
      const next = PG.count.next(c),
        cand = gameCand(c, c.afterEasy),
        head = {};
      const marks = c.easy.map((x) => ({ c: x.cell, v: x.v, col: "var(--indigo)" }));
      next.forEach((x) => (head[x.cell] = x.v));
      marks.forEach((m) => delete cand[m.c]);
      next.forEach((x) => delete cand[x.cell]);
      return { hv: { pattern: [], target: c.easy.map((x) => x.cell), bad: [], cand }, marks, head };
    },
  },
};

// ---------- Quick call
// Claims about a board, half of them true. The false ones are near misses: the right cell with the wrong number, two cells
// with the same two options that do not see each other, a number with one more place than claimed. Every claim can be
// checked with the basic options (the numbers already placed), the same as the pencil marks show.
const QUICK_SECONDS = 60,
  QUICK_COST = 5, // seconds a wrong answer costs
  QUICK_PACE = 1.5; // a claim (read it, look, answer) is expected to take 1.5 times your curve's time for an easy number
// right answers your curve expects in one run; more moves the level up, fewer down
const quickExpected = () => Math.max(1, Math.round(QUICK_SECONDS / (QUICK_PACE * easyU(1))));
function quickPos(b) {
  const tu = createTutor(E.makeGeometry(b.rows, b.cols), b.region);
  const size = {};
  b.region.forEach((r) => (size[r] = (size[r] || 0) + 1));
  return { b, tu, known: b.known.slice(), P2: { d: { rows: b.rows, cols: b.cols, region: b.region, givens: b.givens }, maxR: Math.max(...Object.values(size)), sol: b.sol } };
}
function quickClaims(pos, types) {
  const { tu, known, b } = pos,
    cand = tu.fromKnown(known).cand;
  const nm = (i) => "abcdefghij"[i % b.cols] + (Math.floor(i / b.cols) + 1);
  const bits = (m) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => m & (1 << v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const empty = known.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const easy = new Map(tu.easyList(known).map(([c, v]) => [c, v]));
  const T = [],
    F = [];
  if (types.includes(1)) {
    const ez = [...easy];
    if (ez.length) {
      const [c, v] = pick(ez);
      T.push({ cells: [c], text: tr("{cell} = {v} is an easy number.", { cell: nm(c), v }), why: tr("{cell} = {v} could be seen directly.", { cell: nm(c), v }) });
    }
    // the right cell, the wrong number
    const wrongNum = ez.filter(([c, v]) => bits(cand[c]).some((x) => x !== v));
    if (wrongNum.length) {
      const [c, v] = pick(wrongNum),
        x = pick(bits(cand[c]).filter((y) => y !== v));
      F.push({ cells: [c], text: tr("{cell} = {v} is an easy number.", { cell: nm(c), v: x }), why: tr("{cell} is an easy number, but it is {v}.", { cell: nm(c), v }) });
    }
    // a cell with two options left
    const two = empty.filter((i) => !easy.has(i) && bits(cand[i]).length === 2);
    if (two.length) {
      const c = pick(two),
        [a, a2] = bits(cand[c]);
      F.push({ cells: [c], text: tr("{cell} = {v} is an easy number.", { cell: nm(c), v: pick([a, a2]) }), why: tr("{cell} can still be {a} or {b}.", { cell: nm(c), a, b: a2 }) });
    }
  }
  // the kind of each claim (1 easy number, 2 pair, 3 only places), for the practice log
  const mark = (k) => T.concat(F).forEach((x) => x.kind == null && (x.kind = k));
  mark(1);
  if (types.includes(2)) {
    const two = empty.filter((i) => bits(cand[i]).length === 2);
    const pairs = [],
      apart = [],
      loose = [];
    for (let x = 0; x < two.length; x++)
      for (let y = x + 1; y < two.length; y++) {
        const a = two[x],
          c = two[y];
        if (cand[a] !== cand[c]) continue;
        (tu.peer(a, c) ? pairs : apart).push([a, c]);
      }
    // two cells that see each other, where the second has one option more: not a pair (unless the two numbers have no
    // other place in a house they share, which would make it a hidden pair)
    const hidden = (a, c, m) =>
      tu.houses.some((h) => h.includes(a) && h.includes(c) && bits(m).every((v) => h.filter((i) => !known[i] && cand[i] & (1 << v)).length === 2));
    for (const a of two)
      for (const c of empty)
        if (c !== a && tu.peer(a, c) && bits(cand[c]).length === 3 && (cand[c] & cand[a]) === cand[a] && !hidden(a, c, cand[a])) loose.push([a, c]);
    if (pairs.length) {
      const [a, c] = pick(pairs);
      T.push({ cells: [a, c], text: tr("{a} and {b} are a pair.", { a: nm(a), b: nm(c) }), why: tr("{a} and {b} see each other and can only be {vals}.", { a: nm(a), b: nm(c), vals: bits(cand[a]).join(" " + tr("and") + " ") }) });
    }
    if (apart.length) {
      const [a, c] = pick(apart);
      F.push({ cells: [a, c], text: tr("{a} and {b} are a pair.", { a: nm(a), b: nm(c) }), why: tr("{a} and {b} have the same two options, but they do not see each other.", { a: nm(a), b: nm(c) }) });
    }
    if (loose.length) {
      const [a, c] = pick(loose),
        extra = bits(cand[c] & ~cand[a])[0];
      F.push({ cells: [a, c], text: tr("{a} and {b} are a pair.", { a: nm(a), b: nm(c) }), why: tr("{cell} can also be {v}.", { cell: nm(c), v: extra }) });
    }
  }
  mark(2);
  if (types.includes(3)) {
    const order = tu.houses.map((h, u) => u).sort(() => Math.random() - 0.5);
    let gotT = false,
      gotF = false;
    for (const u of order) {
      if (gotT && gotF) break;
      const h = tu.houses[u],
        have = new Set(h.map((i) => known[i]).filter(Boolean));
      for (let v = 1; v <= h.length && v <= 9; v++) {
        if (have.has(v)) continue;
        const places = h.filter((i) => !known[i] && cand[i] & (1 << v));
        if (places.length < 2 || places.length > 3) continue;
        const where = (cells) =>
          tu.king
            ? tr("In their region, {v} can only go in {cells}.", { v, cells: list2(cells.map(nm)) })
            : tr("In {unit}, {v} can only go in {cells}.", { unit: tu.houseName(u), v, cells: list2(cells.map(nm)) });
        if (!gotT) {
          T.push({ cells: places, u, v, text: where(places), why: tr("Those are the only places for {v} there.", { v }) });
          gotT = true;
        } else if (!gotF && places.length === 3) {
          const miss = pick(places),
            claim = places.filter((i) => i !== miss);
          F.push({ cells: claim, u, v, text: where(claim), why: tr("{v} can also go in {cell}.", { v, cell: nm(miss) }) });
          gotF = true;
        } else if (!gotF) {
          const other = h.filter((i) => !known[i] && !(cand[i] & (1 << v)));
          if (other.length) {
            const o = pick(other),
              claim = [places[0], o].sort((x, y) => x - y);
            F.push({ cells: claim, u, v, text: where(claim), why: tr("{cell} cannot be {v}.", { cell: nm(o), v }) });
            gotF = true;
          }
        }
        if (gotT && gotF) break;
      }
    }
  }
  mark(3);
  // about half true; up to four claims per board, shuffled
  const out = [];
  T.sort(() => Math.random() - 0.5);
  F.sort(() => Math.random() - 0.5);
  while (out.length < 4 && (T.length || F.length)) {
    const takeTrue = T.length && (!F.length || Math.random() < 0.5);
    const one = takeTrue ? T.shift() : F.shift();
    out.push(Object.assign({ truth: !!takeTrue, pos }, one));
  }
  return out;
}
PG.quick = {
  name: () => tr("Quick call"),
  blurb: () => tr("True or false, as many as you can in 60 seconds."),
  round: 1,
  stepScale: 2,
  noHelp: true,
  init(c) {
    c.claims = [];
    c.ans = [];
    c.phase = "ready";
    c.fetching = false;
    for (const b of c.b.batch || [c.b]) c.claims.push(...quickClaims(quickPos(b), c.spec.types));
    c.at = 0;
  },
  // more boards while you play, so the claims never run out
  refill(c) {
    if (c.fetching || c.claims.length - c.at > 10) return;
    c.fetching = true;
    drillFetch("quick", c.lv).then((b) => {
      c.fetching = false;
      if (b) for (const x of b.batch || [b]) c.claims.push(...quickClaims(quickPos(x), c.spec.types));
    });
  },
  start(c) {
    c.phase = "find";
    c.t0 = performance.now();
    c.hiddenMs = 0;
    c.deadline = c.t0 + QUICK_SECONDS * 1000;
    renderDrill();
    const tick = setInterval(() => {
      if (!D || D.cur !== c || c.phase !== "find") return clearInterval(tick);
      const left = c.deadline + c.hiddenMs - performance.now();
      if (left <= 0) {
        clearInterval(tick);
        c.phase = "done";
        const right = c.ans.filter((a) => a.right).length;
        return drillFinish(c.ans.length > 0 && right / c.ans.length < 0.6);
      }
      const bar = document.getElementById("dTimeBar");
      if (bar) bar.style.width = ((100 * left) / (QUICK_SECONDS * 1000)).toFixed(1) + "%";
      $("drillCount").textContent = Math.ceil(left / 1000) + " s";
    }, 100);
  },
  answer(c, yes) {
    if (c.phase !== "find") return;
    const cl = c.claims[c.at];
    if (!cl) return;
    const right = yes === cl.truth;
    const prev = c.ans.length ? c.ans[c.ans.length - 1].claim : null;
    plog(c, "claim", cl.kind, right ? 1 : 0, !prev || prev.pos !== cl.pos ? 1 : 0, cl.pos.b.rows + "x" + cl.pos.b.cols);
    c.ans.push({ claim: cl, yes, right });
    if (!right) {
      c.deadline -= QUICK_COST * 1000;
      c.wrong++;
      c.cost = (c.cost || 0) + 1;
    }
    c.at++;
    c.flashRight = right;
    PG.quick.refill(c);
    renderDrill();
  },
  top(c) {
    const left = c.phase === "find" ? Math.max(0, c.deadline + c.hiddenMs - performance.now()) : c.phase === "ready" ? QUICK_SECONDS * 1000 : 0;
    const dots = c.ans
      .slice(-24)
      .map((a) => `<i class="${a.right ? "on" : "miss"}"></i>`)
      .join("");
    return (
      `<div class="dtime" aria-hidden="true"><i id="dTimeBar" style="width:${((100 * left) / (QUICK_SECONDS * 1000)).toFixed(1)}%"></i>` +
      (c.cost && c.flashRight === false ? `<span class="dcost" key="${c.ans.length}">−${QUICK_COST} s</span>` : "") +
      `</div><div class="dqdots" aria-hidden="true">${dots}</div>`
    );
  },
  count(c) {
    if (c.phase !== "find") return "";
    return Math.ceil(Math.max(0, c.deadline + c.hiddenMs - performance.now()) / 1000) + " s";
  },
  task(c) {
    const right = c.ans.filter((a) => a.right).length,
      wrong = c.ans.length - right;
    if (c.phase === "ready")
      return (
        `<h3>${tr("Quick call")}</h3><p>${tr("Claims about the board come one after another. Is each one true or false? You have {s} seconds, and a wrong answer costs {c}.", { s: QUICK_SECONDS, c: QUICK_COST + " s" })}</p>` +
        `<p>${GAME.countLine} ${tr("A number is easy only if the numbers already on the board show it, not if it follows after another one.")}</p>` +
        `<div class="actions"><button class="primary big" type="button" id="dqStart">${tr("Start")}</button></div>`
      );
    if (c.phase === "done") return `<h3 class="ok">${tr("Time!")}</h3><p>${tr("{k} right and {w} wrong.", { k: right, w: wrong })}</p>`;
    const cl = c.claims[c.at];
    return `<p class="dclaim">${cl ? esc(cl.text) : "…"}</p>`;
  },
  pad(c) {
    if (c.phase !== "find") return "";
    return `<div class="dtf"><button type="button" class="tf no" data-tf="0">${tr("False")}</button><button type="button" class="tf yes" data-tf="1">${tr("True")}</button></div>`;
  },
  tap() {},
  show() {},
  // the score: right answers against what your curve expects (quickExpected)
  score(c) {
    const right = c.ans.filter((a) => a.right).length;
    return QUICK_SECONDS / (QUICK_PACE * easyU(1)) / Math.max(0.5, right);
  },
  expected: () => easyU(1),
  view(c) {
    const cl = c.phase === "find" ? c.claims[c.at] : c.phase === "done" ? c.ans.length && c.ans[c.ans.length - 1].claim : null;
    const pos = cl ? cl.pos : quickPos((c.b.batch || [c.b])[0]);
    // the board belongs to the claim; drillBoardSvg draws c.P2 and c.known, so point them at it
    c.P2 = pos.P2;
    c.known = pos.known;
    c.tu = pos.tu;
    c.b = Object.assign({}, pos.b, { batch: c.b.batch });
    return { hv: { pattern: cl ? cl.cells : [], target: [], bad: [], cand: gameCand(c) } };
  },
  scoreHtml(c) {
    const right = c.ans.filter((a) => a.right).length;
    return (
      `<div><b>${right}</b><span>${tr("right in {s} seconds", { s: QUICK_SECONDS })}</span>` +
      `<span class="dexp">${tr("Your curve expects about {n}.", { n: quickExpected() })}</span></div>` +
      `<div class="dqdots big" role="img" aria-label="${esc(tr("{k} right and {w} wrong.", { k: right, w: c.ans.length - right }))}">${c.ans.map((a) => `<i class="${a.right ? "on" : "miss"}"></i>`).join("")}</div>`
    );
  },
  // after the run: the claims you got wrong, each with its board and why
  misses(c) {
    return c.ans.filter((a) => !a.right);
  },
  missHtml(a) {
    const pos = a.claim.pos,
      fake = { spec: D.cur ? D.cur.spec : { pencil: false }, tu: pos.tu, known: pos.known },
      color = {};
    pos.known.forEach((v, i) => v && !pos.b.givens[i] && (color[i] = "var(--ink)"));
    return (
      `<div class="qmiss"><p><b>${esc(a.claim.text)}</b> ${a.claim.truth ? tr("True.") : tr("False.")} ${esc(a.claim.why)}</p>` +
      miniBoard(pos.P2, pos.known, { pattern: a.claim.cells, cand: gameCand(fake) }, null, {}, { color, label: tr("The practice board") }) +
      `</div>`
    );
  },
};

// What the next round of a game looks like
function gameLevelText(k, lv) {
  const sp = drillSpec(k, lv),
    parts = [];
  if (new Set(GAME.games[k].map((x) => x.size.join("x"))).size > 1) parts.push(sp.size[1] + "×" + sp.size[0]);
  parts.push(sp.pencil ? tr("with pencil marks") : tr("without pencil marks"));
  if (k === "cascade") parts.push(tr("{n} numbers in a row", { n: sp.n }));
  if (k === "changed") parts.push(tr("{a} to {b} new easy numbers", { a: sp.fresh[0], b: sp.fresh[1] }));
  if (k === "sweep") parts.push(list2(sp.techs.map((L) => LEVEL_TECH[L])));
  if (k === "count") parts.push(tr("{a} to {b} easy numbers", { a: sp.count[0], b: sp.count[1] }));
  if (k === "quick")
    parts.push(list2(sp.types.map((t) => ({ 1: tr("easy numbers"), 2: tr("pairs"), 3: tr("only places") })[t])));
  const mid = (sp.empty[0] + sp.empty[1]) / 2;
  parts.push(mid < 0.45 ? tr("late in the puzzle") : mid < 0.62 ? tr("mid-puzzle") : tr("early in the puzzle"));
  return parts.join(", ");
}
// All games with their level; each row starts a round
function gameListHtml(cur, blurbs) {
  return PRACTICE_GAMES.map((k) => {
    const s = drillOf(k),
      started = s.log && s.log.length;
    return (
      `<button type="button" class="drow${k === cur ? " cur" : ""}" data-drill="${k}"><span class="dname">${esc(PG[k].name())}</span>` +
      drillBars(started ? s.lv : 0) +
      `<span class="dlv">${started ? tr("level {n}", { n: lvTxt(s.lv) }) : tr("new")}</span>` +
      (blurbs ? `<small class="dblurb">${esc(PG[k].blurb())}</small>` : "") +
      `</button>`
    );
  }).join("");
}
