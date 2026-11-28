// New game: choice of size, difficulty, type and technique, and generation in the background.

function sizeIcon(s) {
  const W = 30,
    cw = W / Math.max(s.r, s.c),
    w = s.c * cw,
    h = s.r * cw,
    ox = (34 - w) / 2,
    oy = (34 - h) / 2;
  let d = "";
  for (let c = 1; c < s.c; c++) d += `M${ox + c * cw} ${oy}v${h}`;
  for (let r = 1; r < s.r; r++) d += `M${ox} ${oy + r * cw}h${w}`;
  return `<svg viewBox="0 0 34 34" aria-hidden="true"><path d="${d}" stroke="var(--grid)" stroke-width="0.8"/><rect x="${ox}" y="${oy}" width="${w}" height="${h}" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
}
// ---------- Play modes: choose everything yourself (Manual), or let the app pick the grade from your own games.
// Your usual grade is the median of your latest 20 solved puzzles without hints on this size (all sizes with fewer than 5).
// Each mode starts from it and then moves after each game in the mode (modeAfterGame; Relax and Learn since 28 Nov. 2026),
// so the effort stays the same as you get better. Kept per board size, in your own data (the guest has their own).
//   Relax: starts a grade under your usual. Aims well under the expected time without hints (0.8 of it), so it stays easy.
//   Challenge: starts a little above your usual. Aims at the expected time without hints.
//   Learn: puzzles that need your focus technique (the weakest in the statistics), or the one you have met least, using
//     "require a technique"; starts at your usual. Aims at the expected time without hints, so the technique stays the
//     hard part and not the rest of the board.
const MODES = ["manual", "relax", "challenge", "learn"];
const modeName = (m) => ({ manual: tr("Manual"), relax: tr("Relax"), challenge: tr("Challenge"), learn: tr("Learn") })[m];
const sizeKey = (s) => s.c + "x" + s.r;
// The highest grade a 4×4 can have: a Suguru 4×4 with regions of at most 4 cells goes no higher than 4, and a Sudoku 4×4
// needs only singles (GAME.microTop)
const microTop = (s) => (s.r * s.c > 16 ? 9.9 : GAME.microTop || (ui.maxRegion === 4 ? 4.9 : 9.9));
// What New game says about that (empty when nothing)
const microNote = (s) =>
  s.r * s.c > 16 ? "" : GAME.microNote || (ui.maxRegion === 4 ? tr("On 4×4 with regions of at most 4 cells, grade 4 is the highest. Allow bigger regions for more.") : "");
function usualGrade(s) {
  const micro = s.r * s.c <= 16, // 4×4 is a game of its own (core.js): its usual grade only from 4×4
    clean = games.filter((g) => g.solved && !g.hints && !g.replay && g.value && isMicro(g) === micro);
  let pool = clean.filter((g) => g.rows === s.r && g.cols === s.c).slice(-20),
    same = true;
  if (pool.length < 5) (pool = clean.slice(-20)), (same = false);
  return pool.length >= 5 ? { g: median(pool.map(gradeFor)), same } : null;
}
function learnTech() {
  // the statistics' "Practise next" (statui.js): the technique where Skill has most to gain
  const P2 = microNow() ? null : statPractiseL();
  if (P2 && TT.known(P2) && TT.beyond(P2)) return { L: P2, focus: true };
  const cal = myCal(),
    L = TT.list("learn").sort((a, b) => ((cal.lvl[a] || {}).n || 0) - ((cal.lvl[b] || {}).n || 0))[0];
  return { L, focus: false };
}
function modePlan(mode) {
  const s = SIZES[ui.sizeIdx],
    u = usualGrade(s),
    base = u ? u.g : ui.level + 0.5,
    play = store.get("play", {}),
    kept = (play[modeStore(mode)] || {})[sizeKey(s)];
  let t,
    must = 0,
    why,
    short = "",
    more = "";
  const usual = u ? (u.same ? tr("your usual {g} on this size", { g: dec(u.g) }) : tr("your usual {g}", { g: dec(u.g) })) : "";
  if (MODE_STEP[mode]) short = tr("Moves after each game.");
  if (mode === "relax") {
    t = kept != null ? kept : Math.max(1, base - 1);
    why = kept != null ? tr("Where puzzles go smoothly for you on this size.") : u ? tr("A grade under {usual}, so it goes smoothly.", { usual }) : tr("A gentle grade. After 5 solved puzzles without hints, it follows your own level.");
    more = tr("It moves after each game: up after a solve without hints well under the expected time, down after a slow solve, hints or giving up. So it stays relaxing as you get better.");
  } else if (mode === "challenge") {
    t = kept != null ? kept : base + 0.5;
    why = u ? tr("A little above {usual}.", { usual }) : tr("A little above where you start.");
    more = tr("It moves after each game: up after a solve without hints at or under the expected time, down after a slow solve, hints or giving up.");
  } else if (mode === "learn" && microTop(s) < 2) {
    // nothing beyond singles fits on this board (a 4×4 Sudoku): no technique to require
    t = kept != null ? kept : base;
    why = GAME.microNote || "";
  } else if (mode === "learn") {
    const lt = withScope(s.r * s.c <= 16 ? "micro" : "main", learnTech);
    must = lt.L;
    t = kept != null ? kept : base;
    more = tr("It moves after each game: up after a solve without hints at or under the expected time, down after a slow solve, hints or giving up. So the technique stays the hard part.");
    why = lt.focus
      ? tr("Puzzles that need {tech}, where your Skill has most to gain, around {usualg}.", { tech: LEVEL_TECH[must], usualg: dec(t) })
      : tr("Puzzles that need {tech}, the technique you have met least, around {usualg}.", { tech: LEVEL_TECH[must], usualg: dec(t) });
  }
  const top = microTop(s);
  t = Math.round(Math.min(top, Math.max(1, t)) * 10) / 10;
  return { mode, t, level: Math.floor(t), must, why, short, more };
}
function modeLine(pl) {
  const s = SIZES[ui.sizeIdx];
  return (
    `<b>${modeName(pl.mode)}: ${esc(BAND[pl.level])} ${dec(pl.t)} · ${s.c}×${s.r}${pl.must ? " · " + esc(LEVEL_TECH[pl.must]) : ""}</b> ${esc(pl.why)}` +
    (pl.more ? " " + tldr(esc(pl.short), esc(pl.more), "inline") : "")
  );
}
// Start a game in the chosen mode: the grade within ±0.2 of the plan
function startMode(mode = ui.mode) {
  const pl = modePlan(mode),
    s = SIZES[ui.sizeIdx],
    d = Math.round((pl.t - pl.level) * 10);
  generate(
    {
      rows: s.r,
      cols: s.c,
      level: pl.level,
      must: pl.must,
      seed: (Math.random() * 1e9) >>> 0,
      budget: 20000,
      lo: Math.max(0, d - 2),
      hi: Math.min(9, d + 2),
      nuance: "alle",
      kind: "alle",
      maxRegion: ui.maxRegion,
      np: noPen(),
    },
    tr("{mode}: looking for {band} {g}", { mode: modeName(mode), band: BAND[pl.level], g: dec(pl.t) }) + (pl.must ? " " + tr("with {tech}", { tech: LEVEL_TECH[pl.must] }) : "") + " …",
    (p) => {
      loadPuzzle(p, null, { mode, modeT: pl.t });
      go("game");
      setMsg(tr("{mode}: {band} {g}.", { mode: modeName(mode), band: BAND[pBand(p)], g: levelValue(p) }) + (pl.must && p.rating.level !== pl.must ? " " + tr("No puzzle with {tech} turned up in time; this one needs {got}.", { tech: LEVEL_TECH[pl.must], got: LEVEL_TECH[p.rating.level] }) : ""), pl.must && p.rating.level !== pl.must ? "bad" : "");
    },
  );
}
// After a game in a mode: the grade for the next one on this size. r = your time ÷ the expected time shown before the
// game (the statistics model's, the old estimate where it has none). A solve without hints at or under the mode's aim
// (fast) moves it up, up to the mode's ok a little or not at all, slower down 0.2, hints or giving up down 0.4. The aims
// and steps are a first setting (TODO.md: tuning).
const MODE_STEP = {
  relax: { fast: 0.8, ok: 1.0, up: 0.2, mid: 0 },
  challenge: { fast: 1.0, ok: 1.3, up: 0.3, mid: 0.1 },
  learn: { fast: 1.0, ok: 1.3, up: 0.2, mid: 0 },
};
const modeStore = (mode) => (mode === "challenge" ? "chal" : mode); // where a mode keeps its grades ("chal" from before)
function modeAfterGame(rec) {
  const st = MODE_STEP[rec.mode];
  if (!st) return;
  const key = rec.cols + "x" + rec.rows,
    play = store.get("play", {}),
    k = modeStore(rec.mode),
    kept = Object.assign({}, play[k]),
    old = kept[key] != null ? kept[key] : rec.modeT != null ? rec.modeT : gradeFor(rec),
    ex = (rec.lv && statExpectedFor(rec.lv, rec.rows, rec.cols, gradeFor(rec))) || rec.est,
    r = ex ? rec.ms / 1000 / ex : 1;
  const step = !rec.solved || rec.hints ? -0.4 : r <= st.fast ? st.up : r <= st.ok ? st.mid : -0.2;
  kept[key] = Math.round(Math.min(9.9, Math.max(1, old + step)) * 10) / 10;
  store.set("play", Object.assign({}, play, { [k]: kept }));
}
// The New game screen: how to play first; in a mode the grade, nuance, type and technique are picked for you
function renderModes() {
  $("modes").innerHTML = MODES.map((m) => `<button type="button" data-m="${m}" aria-pressed="${m === ui.mode}">${modeName(m)}</button>`).join("");
  $("modes")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          ui.mode = b.dataset.m;
          saveUi();
          renderNew();
        }),
    );
  const manual = ui.mode === "manual";
  $("manualOpts").hidden = !manual;
  $("modeWhy").hidden = manual;
  if (!manual) $("modeWhy").innerHTML = modeLine(modePlan(ui.mode));
}

function renderNew() {
  if (!MODES.includes(ui.mode)) ui.mode = "manual";
  renderModes();
  const solvedBy = {};
  games.forEach((g) => {
    if (g.solved) solvedBy[gBand(g)] = (solvedBy[gBand(g)] || 0) + 1;
  });
  // with only one size there is nothing to choose: hide the choice and its heading
  const oneSize = SIZES.length < 2,
    sizeHead = $("sizes").previousElementSibling;
  $("sizes").hidden = oneSize;
  if (sizeHead && sizeHead.matches("h3.sec")) sizeHead.hidden = oneSize;
  $("sizes").innerHTML = SIZES.map(
    (s, i) =>
      `<button class="size" type="button" data-i="${i}" aria-pressed="${i === ui.sizeIdx}">${sizeIcon(s)}<b>${s.c}×${s.r}</b></button>`,
  ).join("");
  $("sizes")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          ui.sizeIdx = +b.dataset.i;
          const s = SIZES[ui.sizeIdx];
          ui.size = s.r + "x" + s.c;
          if (ui.maxRegion === 4 && s.r * s.c > 49) ui.maxRegion = 5;
          saveUi();
          renderNew();
        }),
    );
  $("levels").innerHTML =
    `<div class="bands">` +
    BAND.slice(1)
      .map((n, i) => {
        const l = i + 1;
        return `<button class="band" type="button" data-l="${l}" aria-pressed="${l === ui.level}"><b>${l}</b><span>${n}</span><small>${solvedBy[l] ? tr("{n} solved", { n: solvedBy[l] }) : "&nbsp;"}</small></button>`;
      })
      .join("") +
    `</div>`;
  $("levels")
    .querySelectorAll(".band")
    .forEach(
      (b) =>
        (b.onclick = () => {
          ui.level = +b.dataset.l;
          saveUi();
          renderNew();
        }),
    );
  $("musts").innerHTML =
    `<div class="group"><button class="lvl" type="button" data-l="0" aria-pressed="${!ui.must}"><span class="n">∗</span><span class="t">${tr("All techniques")}</span>` +
    `<span class="d">${tr("Only the difficulty decides.")}</span><span class="c"></span><span class="r" aria-hidden="true"></span></button></div>` +
    `<details ${ui.must ? "open" : ""}><summary>${tr("Practise a specific technique")}</summary>` +
    LEVEL_GROUPS.map(
      (g) =>
        `<div class="group" style="margin-top:8px"><h4>${g.name}</h4>` +
        g.levels
          .map(
            (l) =>
              `<button class="lvl" type="button" data-l="${l}" aria-pressed="${l === ui.must}"><span class="n">${TT.num(l)}</span><span class="t">${E.LEVELS[l]}</span>` +
              `<span class="d">${LEVEL_INFO[l]}</span><span class="c"></span><span class="r" aria-hidden="true"></span></button>`,
          )
          .join("") +
        `</div>`,
    ).join("") +
    `</details>` +
    // training: start the board where the technique is the next step (train.js); not for singles, which come first anyway
    (TT.beyond(ui.must)
      ? `<div class="group trainset"><div class="set"><span>${tr("Start where it is next")}</span><small>${tr("Training: not part of the statistics.")}</small>` +
        `<button class="switch" type="button" role="switch" id="startAtSw" aria-checked="${!!ui.startAt}" aria-label="${esc(tr("Start where it is next"))}"></button></div></div>`
      : "");
  if ($("startAtSw"))
    $("startAtSw").onclick = () => {
      ui.startAt = !ui.startAt;
      saveUi();
      renderNew();
    };
  $("musts")
    .querySelectorAll(".lvl")
    .forEach(
      (b) =>
        (b.onclick = () => {
          ui.must = +b.dataset.l;
          saveUi();
          renderNew();
        }),
    );
  $("nuances").innerHTML = NUANCES.map(
    (nu) =>
      `<button type="button" data-n="${nu.id}" aria-pressed="${nu.id === ui.nuance}">${nu.label}` +
      `<small>${nu.id === "alle" ? ".0–.9" : "." + nu.lo + "–." + nu.hi}</small></button>`,
  ).join("");
  $("nuances")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          ui.nuance = b.dataset.n;
          saveUi();
          renderNew();
        }),
    );
  const big = SIZES[ui.sizeIdx].r * SIZES[ui.sizeIdx].c > 49;
  // the regions' largest size only exists in games with regions (Suguru)
  if ($("maxsizes")) $("maxsizes").innerHTML = [4, 5, 6]
    .map(
      (m) =>
        `<button type="button" data-m="${m}" aria-pressed="${m === ui.maxRegion}" ${m === 4 && big ? "disabled" : ""}>${tr("{n} cells", { n: m })}` +
        `<small>${m === 4 ? (big ? tr("only up to 7×7") : tr("tighter")) : m === 5 ? tr("standard") : tr("more numbers")}</small></button>`,
    )
    .join("");
  if ($("maxsizes")) $("maxsizes")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          ui.maxRegion = +b.dataset.m;
          saveUi();
          renderNew();
        }),
    );
  const s = SIZES[ui.sizeIdx];
  // the note under the choices: a short line, the rest a tap away (tldr)
  const note = (short, full) => (full ? tldr(esc(short), esc(full)) : esc(short));
  $("newNote").innerHTML = ui.mode !== "manual"
    ? note(microNote(s))
    : TT.beyond(ui.must) && ui.startAt
    ? note(
        tr("Starts where {tech} is next.", { tech: LEVEL_TECH[ui.must] }),
        tr("The board starts part-solved, where {tech} is the next step. Once you have used it, you can skip to the next board.", { tech: LEVEL_TECH[ui.must] }) +
          (TT.is(ui.must, "rare") ? " " + GAME.rareNote : ""),
      )
    : ui.must
    ? note(
        tr("Needs {tech}, close to {g}.", { tech: LEVEL_TECH[ui.must], g: ui.level }),
        tr("The puzzle will require {tech}. The difficulty will be as close to {g} as possible.", { tech: LEVEL_TECH[ui.must], g: ui.level }) +
          (TT.is(ui.must, "rare") ? " " + GAME.rareNote : ""),
      )
    : microNote(s) && ui.level > Math.floor(microTop(s))
      ? note(microNote(s))
      : ui.level >= 8
      ? note(tr("Rare. Can take 20 seconds."), tr("The highest grades are rare, especially on small boards. It can take up to 20 seconds, and you get the closest one found."))
      : ui.level === 2
        ? note(tr("A narrow band."), tr("Grade 2 is a narrow band between the very simple puzzles and those with eliminations."))
        : "";
  $("kinds").innerHTML = KINDS.map(
    ([k, t, d]) => `<button type="button" data-k="${k}" aria-pressed="${k === ui.kind}">${t}<small>${d}</small></button>`,
  ).join("");
  $("kinds")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          ui.kind = b.dataset.k;
          saveUi();
          renderNew();
        }),
    );
  $("startBtn").textContent =
    ui.mode === "manual" && TT.beyond(ui.must) && ui.startAt
      ? tr("Start training") + " · " + s.c + "×" + s.r
      : tr("Start") + " · " + (ui.mode === "manual" ? BAND[Math.min(ui.level, Math.floor(microTop(s)))] : modeName(ui.mode)) + " · " + s.c + "×" + s.r;
}
$("startBtn").onclick = () => replaceGame(() => (ui.mode === "manual" ? generateFromUi() : startMode()));
// "New puzzle" after a game and in the menu: the same settings, or the same mode
const newSameLabel = () => (ui.mode === "manual" ? BAND[ui.level] : modeName(ui.mode));
const newSame = () => (ui.mode === "manual" ? generateFromUi() : startMode());

// ---------- Generation in the background
// The work happens in js/worker.js. If it cannot be started, the same runs in the page (slower to watch, same result).
const newWorker = () => new Worker("js/worker.js");
let genToken = 0;
function generate(req, label, onDone) {
  const tok = ++genToken;
  $("busy").hidden = false;
  syncClock();
  $("busyText").textContent = label;
  $("busySub").textContent = "";
  const finish = (p) => {
    if (tok !== genToken) return;
    $("busy").hidden = true;
    onDone(p);
  };
  try {
    if (worker) worker.terminate();
    worker = newWorker();
    worker.onmessage = (e) => {
      if (e.data.type === "progress") $("busySub").textContent = tr("{n} tries · last {v}", { n: e.data.tries, v: dec(e.data.level + e.data.decimal / 10) });
      else {
        worker.terminate();
        worker = null;
        finish(e.data.puzzle);
      }
    };
    worker.onerror = () => {
      worker = null;
      setTimeout(() => finish(generateGraded(E, req)), 30);
    };
    worker.postMessage(req);
  } catch (err) {
    setTimeout(() => finish(generateGraded(E, req)), 30);
  }
}
$("busyCancel").onclick = () => {
  genToken++;
  if (worker) {
    worker.terminate();
    worker = null;
  }
  $("busy").hidden = true;
  syncClock();
};

// trainL: a training board for that technique (train.js); otherwise from the switch "Start where it is next"
function generateFromUi(trainL) {
  const s = SIZES[ui.sizeIdx],
    nu = NUANCES.find((x) => x.id === ui.nuance) || NUANCES[0],
    tL = trainL || (ui.mode === "manual" && ui.startAt && TT.beyond(ui.must) ? ui.must : 0);
  const req = {
    rows: s.r,
    cols: s.c,
    level: Math.min(ui.level, Math.floor(microTop(s))), // a 4×4 cannot go higher: no long search for what is not there
    must: tL || ui.must || 0,
    startAt: tL,
    seed: (Math.random() * 1e9) >>> 0,
    budget: 20000,
    lo: nu.lo,
    hi: nu.hi,
    nuance: nu.id,
    kind: ui.kind,
    maxRegion: ui.maxRegion,
    np: noPen(), // hit the band for the grade without pencil
  };
  if (tL) {
    generate(req, tr("Looking for a board where {tech} is next …", { tech: LEVEL_TECH[tL] }), (p) => trainLoad(p, tL, "new"));
    return;
  }
  generate(
    req,
    tr("Looking for grade {g}", { g: req.level }) +
      (ui.must ? " " + tr("with {tech}", { tech: LEVEL_TECH[ui.must] }) : "") +
      (nu.id !== "alle" ? " (" + nu.label.toLowerCase() + ")" : "") +
      " …",
    (p) => {
      loadPuzzle(p, null, {});
      go("game");
      const n2 = NUANCES.find((x) => x.id === p.nuance);
      if (ui.must && p.rating.level !== ui.must)
        setMsg(tr("Could not find a puzzle with {tech} in time. This one requires {got}.", { tech: LEVEL_TECH[ui.must], got: LEVEL_TECH[p.rating.level] }), "bad");
      else if (pBand(p) !== p.target)
        setMsg(tr("Could not find grade {g} in time. Showing the closest: {v}.", { g: p.target, v: levelValue(p) }), "bad");
      else if (n2 && p.grade && (Math.round((shownGrade(p) % 1) * 10) < n2.lo || Math.round((shownGrade(p) % 1) * 10) > n2.hi))
        setMsg(tr("Could not find a {n} puzzle in time. Showing {v}.", { n: n2.label.toLowerCase(), v: levelValue(p) }), "bad");
    },
  );
}
function startDaily() {
  const ds = dailySpec();
  if (P && meta && meta.daily === ds.key) {
    go("game");
    return;
  }
  const done = games.find((g) => g.daily === ds.key && g.solved);
  const run = () => {
    const cached = store.get("daily", null);
    const open = (p) => {
      loadPuzzle(p, null, { daily: ds.key });
      go("game");
      if (done) setMsg(tr("You have already solved today's puzzle. This time it counts as a normal game."), "");
    };
    if (cached && cached.key === ds.key && cached.puzzle) {
      open(cached.puzzle);
      return;
    }
    generate(
      { rows: ds.rows, cols: ds.cols, level: ds.level, seed: ds.seed, budget: 20000, lo: 0, hi: 9, nuance: "alle", maxRegion: GAME.dailyMaxRegion || 5 },
      tr("Getting today's puzzle …"),
      (p) => {
        store.set("daily", { key: ds.key, puzzle: p });
        open(p);
      },
    );
  };
  replaceGame(run);
}

// Ask before a game in progress is replaced. The old one is stored as abandoned.
function hasProgress() {
  return P && !solved && entries.some(Boolean);
}
function replaceGame(then) {
  if (!hasProgress()) {
    then();
    return;
  }
  const empty = P.givens.filter((g) => !g).length,
    filled = entries.filter(Boolean).length;
  if (meta && meta.train) {
    // a training board is not in the statistics: nothing to lose but the board
    confirmSheet({
      title: tr("You have a training board in progress"),
      text: tr("{time} spent, {pct} % filled in. Training boards are not part of the statistics.", { time: fmt(elapsed()), pct: Math.round((100 * filled) / empty) }),
      ok: tr("Start new"),
      cancel: tr("Continue the old one"),
      onOk: () => {
        recordGame(false);
        then();
      },
      onCancel: () => go("game"),
    });
    return;
  }
  confirmSheet({
    title: tr("You have a game in progress"),
    text: tr("{grade} {v}, {time} spent, {pct} % filled in. If you start a new one, the old one counts as abandoned in your statistics.", {
      grade: BAND[pBand(P)],
      v: levelValue(P),
      time: fmt(elapsed()),
      pct: Math.round((100 * filled) / empty),
    }),
    ok: tr("Start new"),
    cancel: tr("Continue the old one"),
    onOk: () => {
      recordGame(false);
      then();
    },
    onCancel: () => go("game"),
  });
}
