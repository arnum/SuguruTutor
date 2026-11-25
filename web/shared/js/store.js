// Loading a puzzle, saving games in progress and finished games, and puzzle codes.

function loadPuzzle(p, saved, opts = {}) {
  P = p;
  G = E.makeGeometry(p.rows, p.cols);
  tutor = createTutor(G, p.region);
  hint = null;
  if (!p.maxRegion) p.maxRegion = 5;
  NOTE_POS = p.maxRegion >= 7 ? NOTE_POS9 : p.maxRegion >= 6 ? NOTE_POS6 : NOTE_POS5;
  if (!p.grade || !p.grade.hard || p.grade.load === undefined || p.grade.fit !== GW.fit || !p.grade.lv) {
    const st = solveProfile(tutor, p.givens);
    p.grade = st ? gradeFromSteps(st) : null;
  }
  const n = G.n,
    count = {};
  p.region.forEach((r) => (count[r] = (count[r] || 0) + 1));
  regionSize = p.region.map((r) => count[r]);
  // cells that may not have the same number (the game's rules, see boardModel in js/game.js)
  peerSets = boardModel(G, p.region).peers.map((x) => new Set(x));
  entries = saved ? saved.entries : new Array(n).fill(0);
  notes = saved ? saved.notes : new Array(n).fill(0);
  undoStack = [];
  selected = -1;
  reveal = false;
  checked = false;
  hintCell = -1;
  pendingOverwrite = null;
  noteMode = false;
  solved = saved ? !!saved.solved : false;
  clockAcc = saved ? saved.elapsed : 0;
  clockSince = null;
  meta =
    saved && saved.meta
      ? saved.meta
      : {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          daily: opts.daily || null,
          hints: 0,
          hintTechs: [],
          checks: 0,
          revealed: false,
          started: new Date().toISOString(),
          replay: !!opts.replay,
          mode: opts.mode || null, // the play mode it was started in, and the grade it aimed at (newgame.js)
          modeT: opts.modeT != null ? opts.modeT : null,
          camp: opts.camp || null, // a campaign board: { L, board, part } (campaign.js)
          trial: opts.trial || null, // a timed trial board: { fl, T, lim } (trial.js)
          moves: [],
        };
  if (!meta.moves) meta.moves = [];
  if (!p.code) p.code = encodePuzzle(p);
  setMsg("", "");
  renderHint();
  saveCurrent();
}
function saveCurrent() {
  if (!P) return;
  store.set("current", { puzzle: P, entries, notes, elapsed: elapsed(), solved, meta });
}
function recordGame(won) {
  if (!P || !meta) return;
  const rec = {
    id: meta.id,
    end: new Date().toISOString(),
    day: dayKey(new Date()),
    rows: P.rows,
    cols: P.cols,
    maxRegion: P.maxRegion,
    level: P.grade ? P.grade.band : bandOf(P.rating.level), // the ordinary grade (with pencil)
    tech: P.rating.level,
    scale: 2,
    fit: GW.fit,
    np: P.grade && P.grade.np ? P.grade.np.value : null, // the grade without pencil
    npk: P.grade && P.grade.np ? P.grade.np.peak : null, // and its peak and load
    npl: P.grade && P.grade.np ? P.grade.np.load : null,
    pen: meta.pen || 0, // number of pencil notes written in the game (0 = played without pencil)
    penOn: noPen() || meta.trial ? undefined : 1, // the setting "with pencil": the game counts as with pencil, notes or not
    peak: P.grade ? P.grade.peak : null,
    load: P.grade ? P.grade.load : null,
    nHard: P.grade ? P.grade.nHard : null,
    value: P.grade ? P.grade.value : P.rating.level,
    ms: elapsed(),
    hints: meta.hints,
    hintTechs: meta.hintTechs.slice(),
    checks: meta.checks,
    revealed: meta.revealed,
    solved: won && !meta.revealed,
    code: P.code,
    daily: meta.daily,
    replay: meta.replay || undefined,
    mode: meta.mode || undefined,
    modeT: meta.mode && meta.modeT != null ? meta.modeT : undefined,
    dbg: meta.dbg && meta.dbg.length ? meta.dbg : undefined,
    lv: P.grade ? P.grade.lv : null,
    pv: (P.grade && (personalGrade(shownGrade(P), P.rating.level) || {}).value) || null,
    est: P.grade ? Math.round(estimateSec(myCal(), P.grade.lv, P.rows * P.cols) || 0) || null : null,
    filled: entries.filter(Boolean).length,
    empty: P.givens.filter((g) => !g).length,
  };
  // a timed trial board is kept by the trials, not in the statistics
  if (meta.trial) {
    if (meta.trialDone) return null;
    meta.trialDone = true;
    trialRecord(rec);
    return rec;
  }
  // a campaign board is kept by the campaign, not in the statistics
  if (meta.camp) {
    if (meta.campDone) return null;
    meta.campDone = true;
    rec.camp = meta.camp;
    campRecord(rec);
    return rec;
  }
  games = games.filter((g) => g.id !== rec.id);
  games.push(rec);
  saveGames();
  modeAfterGame(rec);
  return rec;
}

// Load a puzzle from a code. The code contains the puzzle itself, so it works across the JS and Java versions.
function puzzleFromCode(text) {
  const d = decodePuzzle(text);
  const G2 = E.makeGeometry(d.rows, d.cols);
  const u = E.createSolver(G2, d.region).uniqueSolution(d.givens);
  if (u.count === 0) throw new Error(tr("The code gives a puzzle with no solution."));
  if (u.count !== 1) throw new Error(tr("The code gives a puzzle with more than one solution."));
  const rating = E.createRater(G2, d.region).rate(d.givens);
  const sizes = {};
  d.region.forEach((r) => (sizes[r] = (sizes[r] || 0) + 1));
  return {
    rows: d.rows,
    cols: d.cols,
    region: d.region,
    solution: u.solution,
    givens: d.givens,
    rating,
    target: rating.level,
    seed: null,
    tries: 0,
    maxRegion: Math.max(...Object.values(sizes)),
    code: encodePuzzle(d),
  };
}
function importCode(text, opts = {}) {
  let p;
  try {
    p = puzzleFromCode(text);
  } catch (e) {
    toast(e.message);
    return false;
  }
  loadPuzzle(p, null, opts);
  go("game");
  setMsg(opts.replay ? tr("The same puzzle again. Good luck!") : tr("The puzzle was loaded from the code. Hints work as usual."), "good");
  return true;
}
