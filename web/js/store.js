// Indlæsning af en opgave, gemning af spil i gang og af færdige spil, og opgavekoder.

function loadPuzzle(p, saved, opts = {}) {
  P = p;
  G = E.makeGeometry(p.rows, p.cols);
  tutor = createTutor(G, p.region);
  hint = null;
  if (!p.maxRegion) p.maxRegion = 5;
  NOTE_POS = p.maxRegion >= 6 ? NOTE_POS6 : NOTE_POS5;
  if (!p.grade || !p.grade.hard || p.grade.load === undefined || p.grade.fit !== 2) {
    const st = solveProfile(tutor, p.givens);
    p.grade = st ? gradeFromSteps(st, p.rating.level, p.maxRegion) : null;
  }
  const n = G.n,
    count = {};
  p.region.forEach((r) => (count[r] = (count[r] || 0) + 1));
  regionSize = p.region.map((r) => count[r]);
  peerSets = [];
  for (let i = 0; i < n; i++) {
    const s = new Set(G.king[i]);
    for (let j = 0; j < n; j++) if (j !== i && p.region[j] === p.region[i]) s.add(j);
    peerSets.push(s);
  }
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
    level: pBand(P),
    tech: P.rating.level,
    scale: 2,
    fit: 2,
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
    filled: entries.filter(Boolean).length,
    empty: P.givens.filter((g) => !g).length,
  };
  games = games.filter((g) => g.id !== rec.id);
  games.push(rec);
  saveGames();
  return rec;
}

// Hent opgave fra kode. Koden indeholder selve opgaven, så den virker på tværs af JS- og Java-versionerne.
function puzzleFromCode(text) {
  const d = decodePuzzle(text);
  const G2 = E.makeGeometry(d.rows, d.cols);
  const u = E.createSolver(G2, d.region).uniqueSolution(d.givens);
  if (u.count === 0) throw new Error(tr("Koden giver en opgave uden løsning."));
  if (u.count !== 1) throw new Error(tr("Koden giver en opgave med mere end én løsning."));
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
  setMsg(opts.replay ? tr("Samme opgave igen. Held og lykke!") : tr("Opgaven er hentet fra koden. Hint virker som normalt."), "good");
  return true;
}
