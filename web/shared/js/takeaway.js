// After the game: what you did well, and up to three moments worth a second look, each shown on a board straight away
// (afterGameHtml). A moment is an overlooked easy number, a long search while easy numbers were ready, or an error.

// What to look for when you overlooked a technique (TECH_TIP) is in the game's js/game.js.

function takeaway(g) {
  if (!g || !g.moves || !g.moves.length) return null;
  const list = g.moves;
  markErrors(list);
  const base = baseline(g.id),
    r = g.route || routeSummary(list);
  const nm = (c) => "abcdefghij"[c % g.cols] + (Math.floor(c / g.cols) + 1);
  const usual = (L) => (base[L] ? base[L].med : L === TT.SINGLES ? 4 : 8 * TT.rung(L) ** 2);
  const primary = list.map((m, i) => Object.assign({ i }, m)).filter((m) => m.cls === "wrong" && !m.follow && !m.slip);

  // ---------- Good
  let good = null,
    noErrSaid = false;
  const fast = list
    .map((m, i) => Object.assign({ i }, m))
    .filter((m) => judged(m) && m.cls !== "wrong" && m.dt >= 1000 && moveLevel(m) >= 2 && base[moveLevel(m)] && m.dt / 1000 <= 0.6 * base[moveLevel(m)].med)
    .sort((a, b) => moveLevel(b) - moveLevel(a) || a.dt - b.dt)[0];
  const pct = r.n ? Math.round((100 * r.easy) / r.n) : 0;
  if (fast)
    good = tr("Move {k}: you found {cell} = {v} with {tech} in {time}. That usually takes you {usual}.", {
      k: fast.i + 1,
      cell: nm(fast.c),
      v: fast.v,
      tech: LEVEL_TECH[moveLevel(fast)],
      time: fmtS(fast.dt / 1000),
      usual: fmtS(base[moveLevel(fast)].med),
    });
  // the same expected time as the bar above it: the seal's (statui.js), else the other modes' estimate
  else if (expOf(g) && g.solved && g.ms / 1000 <= 0.87 * expOf(g))
    good = tr("You were faster than expected: {pct}% of the expected time.", { pct: Math.round((100 * g.ms) / 1000 / expOf(g)) });
  else if (!primary.length && pct >= 90) (good = tr("No errors, and {pct}% of your moves were the easiest available.", { pct })), (noErrSaid = true);
  else if (r.ahead) good = r.ahead === 1 ? tr("You thought ahead once and got it right.") : tr("You thought ahead {n} times and got it right.", { n: r.ahead });
  else if (pct >= 75) good = tr("{pct}% of your moves were the easiest available.", { pct });
  else good = tr("You finished it: {n} numbers in {time}.", { n: list.filter((m) => m.cls !== "wrong").length, time: fmt(g.ms) });
  if (!primary.length && !noErrSaid && list.length >= 8) good += " " + tr("And no errors.");

  // ---------- To learn: what cost the most time. Overlooked numbers are the same lessons as in the route analysis ("What you can learn"),
  // so the two places say the same thing.
  const cands = [];
  routeLessons(g).forEach((L) => {
    const text = lessonShort(L, nm, g);
    if (!text) return;
    const e = L.e,
      tech = LEVEL_TECH[e.L];
    // the lesson's number has the colour it has on the board that is shown first (your own number in a long search: orange)
    const tag = cvTag(nm, e.c, e.v, L.mode === "easy" ? "var(--warn)" : "var(--indigo)");
    const head = settings.coords
      ? L.parts.some((x) => x.type !== "self")
        ? tr("{cell} = {v} ({tech}) was waiting during {parts}.", { cell: nm(e.c), v: e.v, tech, parts: lessonParts(L) })
        : tr("You searched {time} for {cell} = {v} ({tech}).", { cell: nm(e.c), v: e.v, tech, time: fmt(L.selfDt * 1000) })
      : L.parts.some((x) => x.type !== "self")
        ? tr("{num} ({tech}) was waiting during {parts}.", { num: tag, tech, parts: lessonParts(L) })
        : tr("You searched {time} for {num} ({tech}).", { num: tag, tech, time: fmt(L.selfDt * 1000) });
    // advice about exactly this number when there is some, otherwise how to spot the technique
    const tip = (e.L === TT.SINGLES && spotTip(g, e, L.parts[0].i)) || TECH_TIP[e.L] || null;
    cands.push({ cost: L.cost, prio: 2, mode: L.mode, i: L.board, L: e.L, cell: e.c, text, head, tip });
  });
  const c = concGet(g);
  if (c)
    c.idx
      .filter((i) => list[i] && list[i].cls !== "wrong")
      .forEach((i) => {
        const m = list[i],
          lp = lapseInfo(g, i),
          tip = lp.tip;
        cands.push({
          cost: m.dt / 1000 - (c.norm || 4),
          prio: 1,
          mode: "easy",
          i,
          L: 1,
          cell: lp.cell,
          text: tr("Move {k}: you searched {time} for an easy number, even though {n} were ready.", { k: i + 1, time: fmt(m.dt), n: m.nAvail }) + " " + tip,
          head: tr("You searched {time} for an easy number, even though {n} were ready.", { time: fmt(m.dt), n: m.nAvail }),
          tip,
        });
      });
  primary.forEach((m) => {
    const fixed = m.fixT !== undefined && !m.legacy ? (m.fixT - m.t) / 1000 : 30,
      why = errWhy(g, m, nm);
    cands.push({
      cost: fixed + 20,
      prio: 3,
      mode: "err",
      i: m.i,
      L: null,
      cell: m.c,
      text: tr("Move {k}: {cell} = {v} was wrong.", { k: m.i + 1, cell: nm(m.c), v: m.v }) + " " + why,
      head: settings.coords ? tr("{cell} = {v} was wrong.", { cell: nm(m.c), v: m.v }) : tr("{num} was wrong.", { num: cvTag(nm, m.c, m.v, "var(--bad)") }),
      tip: why,
    });
  });
  cands.sort((a, b) => b.cost - a.cost || b.prio - a.prio);
  // up to three moments, one per number
  const seen = new Set(),
    moments = [];
  for (const x of cands) {
    if (x.cost < 8 || moments.length >= 3) continue;
    if (x.cell != null && seen.has(x.cell)) continue;
    if (x.cell != null) seen.add(x.cell);
    moments.push(x);
  }
  return { good, learn: moments[0] || null, moments };
}

// Advice for a long search while several easy numbers were ready: the advice for the easiest of them, otherwise the general one
function lapseTip(g, i) {
  return lapseInfo(g, i).tip;
}
// The same, with the cell of the example (so two moments about the same number are not both shown)
function lapseInfo(g, i) {
  const P2 = g.code ? routePuzzle(g) : null;
  if (!P2) return { tip: GAME.stuckTip };
  try {
    const known = boardBefore(P2, g.moves, i);
    if (known.unsure.length) return { tip: GAME.stuckTip };
    const h = P2.tu.easiest(known);
    const nm = (c) => "abcdefghij"[c % P2.d.cols] + (Math.floor(c / P2.d.cols) + 1);
    const t = h && h.hardestLevel === TT.SINGLES ? spotTip(g, { c: h.cell, v: h.v, L: TT.SINGLES }, i) : null;
    const ex = settings.coords ? tr("For example {cell} = {v}:", { cell: nm(h.cell), v: h.v }) : tr("For example {num}:", { num: cvTag(nm, h.cell, h.v, "var(--indigo)") });
    return t ? { tip: ex + " " + t, cell: h.cell } : { tip: GAME.stuckTip };
  } catch (e) {
    return { tip: GAME.stuckTip };
  }
}
// The two boards of a moment and what the switch calls them (a moment with one board has no switch)
const momentSwitch = (mode, L) =>
  ({
    cmp: [tr("Your move"), tr("Easier then")],
    easy: [tr("What you found"), TT.beyond(L) ? tr("Just as easy then") : tr("Easy numbers then")],
    err: [tr("What you placed"), tr("The right number")],
  })[mode] || null;
// The board comes first: up to three moments, each on its board, with what happened in one line. On a phone one board at a
// time (the lesson first; tap the board or the switch for your own move); on a wide screen both side by side.
// A clean game shows the board as it ended.
function afterGameHtml(g) {
  const t = takeaway(g);
  if (!t) return "";
  const good = `<p class="mgood"><b>${tr("Well done")}</b> ${t.good}</p>`;
  if (!t.moments.length) {
    const fb = g.code ? finalBoardHtml(g) : null;
    return (
      `<div class="moment clean"><div class="mhead"><b>${tr("A clean game")}</b></div>` +
      (fb ? `<div class="finalboard">${fb.svg}</div>` : "") +
      `<p class="mtext">${tr("Nothing worth a second look this time.")}</p>${good}</div>`
    );
  }
  const n = t.moments.length;
  return (
    `<div class="moments">` +
    t.moments
      .map((m, k) => {
        const sw = momentSwitch(m.mode, m.L);
        return (
          `<div class="moment" data-k="${k}" data-show="1"${k ? " hidden" : ""}>` +
          `<div class="mhead"><b>${tr("Move {k}", { k: m.i + 1 })}</b>` +
          (sw
            ? `<div class="mswitch" role="group" aria-label="${esc(tr("Which board to show"))}"><button type="button" data-s="0" aria-pressed="false">${sw[0]}</button><button type="button" data-s="1" aria-pressed="true">${sw[1]}</button></div>`
            : "") +
          `</div>` +
          (g.code ? mboardSlot(g, { i: m.i }, m.mode) : "") +
          `<p class="mtext">${m.head}${m.tip ? " " + m.tip : ""}</p></div>`
        );
      })
      .join("") +
    (n > 1
      ? `<div class="mpager"><button type="button" data-step="-1" aria-label="${esc(tr("Previous"))}">‹</button><span class="mcount">1 / ${n}</span><button type="button" data-step="1" aria-label="${esc(tr("Next"))}">›</button></div>`
      : "") +
    good +
    `</div>`
  );
}
function bindAfterGame(root, g) {
  const box = root.querySelector(".moments");
  if (!box) return;
  const ms = [...box.querySelectorAll(".moment")];
  const draw = (mo) => {
    const el = mo.querySelector(".mboard:not([data-done])");
    if (!el) return;
    el.dataset.done = 1;
    try {
      el.innerHTML = mboardHtml(g, +el.dataset.mi, el.dataset.mode) || "";
    } catch (e) {
      el.innerHTML = "";
    }
    // only one board after all (nothing else was ready): no switch
    if (el.querySelector(".mbpair.one")) mo.querySelectorAll(".mswitch").forEach((x) => x.remove());
  };
  const show = (mo, s) => {
    mo.dataset.show = s;
    mo.querySelectorAll(".mswitch button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.s === String(s)));
  };
  ms.forEach((mo) => {
    mo.querySelectorAll(".mswitch button").forEach((b) => (b.onclick = () => show(mo, +b.dataset.s)));
    // tapping the board shows the other one
    mo.addEventListener("click", (e) => {
      if (e.target.closest(".mbstepnav")) return; // stepping through an explanation
      if (e.target.closest(".mbpair:not(.one)") && mo.querySelector(".mswitch")) show(mo, mo.dataset.show === "1" ? 0 : 1);
    });
  });
  let k = 0;
  const go2 = (d) => {
    ms[k].hidden = true;
    k = (k + d + ms.length) % ms.length;
    ms[k].hidden = false;
    draw(ms[k]);
    const c = box.querySelector(".mcount");
    if (c) c.textContent = k + 1 + " / " + ms.length;
  };
  box.querySelectorAll(".mpager button").forEach((b) => (b.onclick = () => go2(+b.dataset.step)));
  setTimeout(() => draw(ms[0]), 30);
}

// Why was the number wrong? From the board just before: did it break a rule (the game's ruleBreak in js/game.js), or was
// it the reasoning itself that went wrong?
function errWhy(g, m, nm) {
  const P2 = g.code ? routePuzzle(g) : null;
  if (!P2) return GAME.checkTip;
  const known = boardBefore(P2, g.moves, m.i);
  if (known.unsure.length) return GAME.checkTip;
  const vis = known.slice();
  known.wrong.forEach(([c, v]) => (vis[c] = v)); // wrong numbers that stood on the board too
  const broke = GAME.ruleBreak(P2, vis, m.c, m.v, settings.coords ? nm : null);
  if (broke) return broke;
  return (
    tr("Nothing on the board ruled it out directly, so it was the reasoning that went wrong. The cell had to be {right}.", { right: P2.sol[m.c] }) +
    " " +
    tr("When in doubt, pencil in the options before placing the number.")
  );
}
const expOf = (g) => (g.seal && g.seal.expected) || g.est || null;
