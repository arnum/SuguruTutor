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
function renderNew() {
  const solvedBy = {};
  games.forEach((g) => {
    if (g.solved) solvedBy[gBand(g)] = (solvedBy[gBand(g)] || 0) + 1;
  });
  // with only one size (Sudoku: 9×9) there is nothing to choose: hide the choice and its heading
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
              `<button class="lvl" type="button" data-l="${l}" aria-pressed="${l === ui.must}"><span class="n">${l}</span><span class="t">${E.LEVELS[l]}</span>` +
              `<span class="d">${LEVEL_INFO[l]}</span><span class="c"></span><span class="r" aria-hidden="true"></span></button>`,
          )
          .join("") +
        `</div>`,
    ).join("") +
    `</details>`;
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
  $("newNote").textContent = ui.must
    ? tr("The puzzle will require {tech}. The difficulty will be as close to {g} as possible.", { tech: LEVEL_TECH[ui.must], g: ui.level }) +
      (ui.must >= 10 ? " " + GAME.rareNote : "")
    : s.r * s.c <= 16 && ui.maxRegion === 4 && ui.level > 4
      ? tr("On 4×4 with regions of at most 4 cells, grade 4 is the highest. Allow bigger regions for more.")
      : ui.level >= 8
      ? tr("The highest grades are rare, especially on small boards. It can take up to 20 seconds, and you get the closest one found.")
      : ui.level === 2
        ? tr("Grade 2 is a narrow band between the very simple puzzles and those with eliminations.")
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
  $("startBtn").textContent = tr("Start") + " · " + BAND[ui.level] + " · " + s.c + "×" + s.r;
}
$("startBtn").onclick = () => replaceGame(() => generateFromUi());

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

function generateFromUi() {
  const s = SIZES[ui.sizeIdx],
    nu = NUANCES.find((x) => x.id === ui.nuance) || NUANCES[0];
  const req = {
    rows: s.r,
    cols: s.c,
    level: ui.level,
    must: ui.must || 0,
    seed: (Math.random() * 1e9) >>> 0,
    budget: 20000,
    lo: nu.lo,
    hi: nu.hi,
    nuance: nu.id,
    kind: ui.kind,
    maxRegion: ui.maxRegion,
    np: noPen(), // hit the band for the grade without pencil
  };
  generate(
    req,
    tr("Looking for grade {g}", { g: ui.level }) +
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
