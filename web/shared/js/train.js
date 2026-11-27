// Training: a board that starts where a chosen technique is the next step. Started from New game (a technique chosen and
// "Start where it is next" on) and from practice (the chain and what-if families, which have no drills).
// Training boards stay out of the statistics. Once you have placed a number that needed the technique, "Next board" skips
// the rest of the board.
//
// meta.train = { L, from ("new" | "practice"), part (the board starts where L is next), used: { t, hint } once a number
// that needed L was placed, harder: numbers placed that needed more than L }
const TRAIN_KEEP = 100; // training results kept (store "training"): for the export and the campaign's practice count

const trainLog = () => store.get("training", []);

// A new training board for technique L, the way it was started before. From a training board ("Next board") the board in
// hand is kept by trainLoad; another game in progress is asked about first.
function trainStart(L, from) {
  const run = () => (from === "new" ? generateFromUi(L) : trainGenerate(L));
  if (meta && meta.train && !solved) run();
  else replaceGame(run);
}
function trainGenerate(L) {
  const s = campSize(); // the size chosen in New game, but not 4×4
  generate(
    {
      rows: s.r,
      cols: s.c,
      level: campBand(L),
      must: L,
      startAt: L,
      seed: (Math.random() * 1e9) >>> 0,
      budget: 20000,
      lo: 0,
      hi: 9,
      nuance: "alle",
      kind: "alle",
      maxRegion: ui.maxRegion,
      np: noPen(),
    },
    tr("Looking for a board where {tech} is next …", { tech: LEVEL_TECH[L] }),
    (p) => trainLoad(p, L, "practice"),
  );
}
function trainLoad(p, L, from) {
  // "Next board" leaves the board unfinished: it is kept as a training result, not as an abandoned game
  if (P && meta && meta.train && !meta.trainDone && !solved && entries.some(Boolean)) recordGame(false);
  loadPuzzle(p, null, { train: { L, from, part: !!p.startAt } });
  go("game");
  setMsg(
    p.startAt
      ? tr("Training: the board starts where {tech} is the next step.", { tech: LEVEL_TECH[L] })
      : tr("No board where {tech} is next turned up in time. This one starts from the beginning.", { tech: LEVEL_TECH[L] }),
    p.startAt ? "" : "bad",
  );
}

// ---------- During the board
// The known numbers before a move: the givens and the correct numbers placed
function trainKnown() {
  return P.givens.map((g, i) => g || (entries[i] === P.solution[i] ? entries[i] : 0));
}
// A correct number was placed (before afterChange). If it needed the technique, the board has done its job.
// Returns a message for numbers that needed more than the technique.
function trainCheck(cell, v, known) {
  const t = meta.train;
  const lv = tutor.moveLevel(known, cell, v, t.L);
  if (lv === t.L) {
    // with a hint: one taken earlier on this board, or the open hint for exactly this number (see afterChange)
    const viaHint = meta.hints > 0 || !!(hint && hint.data && hint.data.cell === cell && hint.data.v === v && hint.sel !== cell);
    t.used = { t: elapsed(), hint: viaHint ? 1 : 0 };
    setMsg("", ""); // the bar says it now
    return "";
  }
  if (lv > t.L) {
    t.harder = (t.harder || 0) + 1;
    return tr("That number needs more than {tech}: a harder step, or a guess.", { tech: LEVEL_TECH[t.L] });
  }
  return "";
}
// The bar under the board once the technique is used: what happened, and "Next board"
function renderTrain() {
  const bar = $("trainBar");
  if (!bar) return;
  const t = meta && meta.train;
  bar.hidden = !(t && t.used && !solved);
  if (bar.hidden) return;
  const tech = LEVEL_TECH[t.L];
  $("trainText").textContent = t.used.hint
    ? tr("{tech} placed with a hint.", { tech: cap(tech) })
    : tr("{tech} found in {time}.", { tech: cap(tech), time: fmt(t.used.t) });
}
$("trainNext").onclick = () => {
  if (meta && meta.train) trainStart(meta.train.L, meta.train.from);
};

// ---------- After the board
// Called from recordGame instead of storing the game in the statistics
function trainRecord(rec) {
  const t = rec.train,
    log = trainLog();
  log.push({
    id: rec.id,
    end: rec.end,
    L: t.L,
    from: t.from,
    part: t.part ? 1 : 0,
    used: t.used ? t.used.t : null, // ms from the start to the number that needed the technique
    uh: t.used && t.used.hint ? 1 : undefined,
    harder: t.harder || undefined,
    solved: rec.solved,
    ms: rec.ms,
    hints: rec.hints,
    value: rec.value,
    est: rec.est,
    code: rec.code,
  });
  store.set("training", log.slice(-TRAIN_KEEP));
}
function trainHead(rec) {
  const t = rec.train,
    tech = LEVEL_TECH[t.L];
  return t.used
    ? t.used.hint
      ? tr("{tech} placed with a hint", { tech: cap(tech) })
      : tr("{tech} found", { tech: cap(tech) })
    : t.part
      ? tr("Solved, but not with {tech}", { tech })
      : tr("Solved");
}
function trainResult(rec) {
  const t = rec.train,
    tech = LEVEL_TECH[t.L],
    analysed = rec.moves && !rec.routePending;
  const facts = [tr("Training"), esc(BAND[gBand(rec)]) + " " + dec(gradeFor(rec)), rec.cols + "×" + rec.rows, rec.est ? "" : fmt(rec.ms)].filter(Boolean);
  const why = t.used
    ? tr("{tech} after {a}; the whole board took {b}.", { tech: cap(tech), a: fmt(t.used.t), b: fmt(rec.ms) })
    : t.part && t.harder
      ? tr("The step that needed {tech} was passed another way: a harder step or a guess.", { tech })
      : t.part
        ? tr("No number on the way needed {tech}.", { tech })
        : "";
  openSheet(
    `<div class="solved v2 trainres"><div class="shead"><div class="smallstamp" aria-hidden="true">練</div>` +
      `<div><h2>${esc(trainHead(rec))}</h2><p class="sub">${facts.join(" · ")}</p></div></div>` +
      (rec.solved && rec.est ? timeMeterHtml(rec.ms, rec.est, tr("expected")) : "") +
      (why ? `<p class="sub campwhy">${esc(why)}</p>` : "") +
      `<div id="takeaway">${analysed ? afterGameHtml(rec) : rec.routePending ? `<p class="sub mwait">${tr("Finding the moments worth a second look …")}</p>` : ""}</div>` +
      `<div class="actions sbtns"><button class="primary big" type="button" id="tNext">${tr("Next board")}</button></div>` +
      `<button class="routeline" type="button" id="routeLine">${routeLineHtml(rec)}</button>` +
      `<div id="concLine">${concWarnHtml(rec)}</div>` +
      `<p class="sub">${tr("Training boards are not part of the statistics.")}</p>` +
      `<div class="actions row2"><button class="secondary" type="button" id="sFinal">${tr("See board")}</button><button class="secondary" type="button" id="sHome">${tr("Home")}</button></div></div>`,
    (b) => {
      if (analysed) bindAfterGame(b, rec);
      const on = (id, f) => {
        const x = b.querySelector("#" + id);
        if (x) x.onclick = f;
      };
      on("tNext", () => {
        closeSheet();
        trainStart(t.L, t.from);
      });
      on("routeLine", () => {
        if (!rec.moves) return;
        closeSheet();
        setTimeout(() => showRoute(rec, () => trainResult(rec)), 280);
      });
      on("sFinal", () => showFinal(rec, () => trainResult(rec)));
      on("sHome", () => {
        closeSheet();
        go("home", { back: true });
      });
    },
  );
}
// For the campaign: training boards since a time where the technique was found without a hint
function trainFound(L, since) {
  return trainLog().filter((e) => e.end > since && e.L === L && e.used != null && !e.uh).length;
}
// Practice (drill.js): the chains and what-ifs, as training boards. The count: boards where you found it without a hint.
function trainListHtml() {
  const log = trainLog();
  return TT.list()
    .filter((L) => ["chain", "whatif"].includes(TT.family(L)))
    .map((L) => {
      const n = log.filter((e) => e.L === L && e.used != null && !e.uh).length;
      return (
        `<button type="button" class="drow trow" data-train="${L}"><span class="dname">${esc(cap(LEVEL_TECH[L]))}</span>` +
        `<span class="dlv">${n ? tr("{n} found", { n }) : tr("new")}</span></button>`
      );
    })
    .join("");
}
