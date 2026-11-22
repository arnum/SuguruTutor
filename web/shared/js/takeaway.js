// "Key takeaway from the game": a short route analysis right after solving. One thing you did well, and one thing to learn,
// with an example from the game (a small board that is shown on tap).

// What to look for when you overlooked a technique (TECH_TIP) is in the game's js/game.js.

function takeaway(g) {
  if (!g || !g.moves || !g.moves.length) return null;
  const list = g.moves;
  markErrors(list);
  const base = baseline(g.id),
    r = g.route || routeSummary(list);
  const nm = (c) => "abcdefghij"[c % g.cols] + (Math.floor(c / g.cols) + 1);
  const usual = (L) => (base[L] ? base[L].med : L === 1 ? 4 : 8 * L * L);
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
  else if (g.est && g.solved && g.ms / 1000 <= 0.87 * g.est)
    good = tr("You were faster than your estimate: {pct}% of the time.", { pct: Math.round((100 * g.ms) / 1000 / g.est) });
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
    if (text) cands.push({ cost: L.cost, prio: 2, mode: L.mode, i: L.board, text });
  });
  const c = concGet(g);
  if (c)
    c.idx
      .filter((i) => list[i] && list[i].cls !== "wrong")
      .forEach((i) => {
        const m = list[i];
        cands.push({
          cost: m.dt / 1000 - (c.norm || 4),
          prio: 1,
          mode: "easy",
          i,
          text:
            tr("Move {k}: you searched {time} for an easy number, even though {n} were ready.", { k: i + 1, time: fmt(m.dt), n: m.nAvail }) +
            " " +
            lapseTip(g, i),
        });
      });
  primary.forEach((m) => {
    const fixed = m.fixT !== undefined && !m.legacy ? (m.fixT - m.t) / 1000 : 30;
    cands.push({
      cost: fixed + 20,
      prio: 3,
      mode: "err",
      i: m.i,
      text: tr("Move {k}: {cell} = {v} was wrong.", { k: m.i + 1, cell: nm(m.c), v: m.v }) + " " + errWhy(g, m, nm),
    });
  });
  cands.sort((a, b) => b.cost - a.cost || b.prio - a.prio);
  const learn = cands.length && cands[0].cost >= 8 ? cands[0] : null;
  return { good, learn };
}

// Advice for a long search while several easy numbers were ready: the advice for the easiest of them, otherwise the general one
function lapseTip(g, i) {
  const P2 = g.code ? routePuzzle(g) : null;
  if (!P2) return GAME.stuckTip;
  try {
    const known = boardBefore(P2, g.moves, i);
    if (known.unsure.length) return GAME.stuckTip;
    const h = P2.tu.easiest(known);
    const nm = (c) => "abcdefghij"[c % P2.d.cols] + (Math.floor(c / P2.d.cols) + 1);
    const t = h && h.hardestLevel === 1 ? spotTip(g, { c: h.cell, v: h.v, L: 1 }, i) : null;
    return t ? tr("For example {cell} = {v}:", { cell: nm(h.cell), v: h.v }) + " " + t : GAME.stuckTip;
  } catch (e) {
    return GAME.stuckTip;
  }
}
function takeawayHtml(g) {
  const t = takeaway(g);
  if (!t) return "";
  return (
    `<div class="takeaway"><h3>${tr("Key takeaway from the game")}</h3>` +
    `<p class="tkgood"><b>${tr("Well done")}</b> ${t.good}</p>` +
    (t.learn
      ? `<p class="tklearn"><b>${tr("Next time|takeaway")}</b> ${t.learn.text}</p>` +
        (g.code ? `<details class="tkboard"><summary>${tr("See it on the board")}</summary>${mboardSlot(g, { i: t.learn.i }, t.learn.mode)}</details>` : "")
      : `<p class="tklearn"><b>${tr("Next time|takeaway")}</b> ${tr("No clear detours in this game. Try a harder puzzle.")}</p>`) +
    `</div>`
  );
}
function bindTakeaway(root, g) {
  const det = root.querySelector(".tkboard");
  if (!det) return;
  det.addEventListener("toggle", () => {
    const el = det.querySelector(".mboard:not([data-done])");
    if (!det.open || !el) return;
    el.dataset.done = 1;
    setTimeout(() => {
      try {
        el.innerHTML = mboardHtml(g, +el.dataset.mi, el.dataset.mode) || "";
      } catch (e) {
        el.innerHTML = "";
      }
    }, 30);
  });
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
  const broke = GAME.ruleBreak(P2, vis, m.c, m.v, nm);
  if (broke) return broke;
  return (
    tr("Nothing on the board ruled it out directly, so it was the reasoning that went wrong. The cell had to be {right}.", { right: P2.sol[m.c] }) +
    " " +
    tr("When in doubt, pencil in the options before placing the number.")
  );
}
