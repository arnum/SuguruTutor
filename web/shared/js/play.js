// The game: input, hints, menu, explanation of the difficulty and the solved sheet.

function pushUndo() {
  undoStack.push({ entries: entries.slice(), notes: notes.slice() });
  if (undoStack.length > 300) undoStack.shift();
}
function input(d) {
  if (selected < 0 || P.givens[selected] || solved || d > digitMax(selected)) return;
  const cur = entries[selected];
  if (noteMode) {
    if (cur) {
      setMsg(tr("The cell already has {v}. Erase it if you want to write notes.", { v: cur }), "warn");
      return;
    }
    pushUndo();
    checked = false;
    hintCell = -1;
    pendingOverwrite = null;
    notes[selected] ^= 1 << d;
    if (notes[selected] & (1 << d)) {
      const stake = penStake();
      meta.pen = (meta.pen || 0) + 1; // used to choose the grade with/without pencil
      if (stake && stake.left === 1) {
        toast(tr("This game now counts as played with pencil: {a}.", { a: dec(stake.pen) }));
        renderStatus(); // the heading switches to the grade with pencil
      }
    }
    afterChange();
    return;
  }
  if (cur === d) {
    if (pendingOverwrite) {
      pendingOverwrite = null;
      setMsg("", "");
      renderGrid();
    }
    return;
  }
  if (cur && settings.confirm && !(pendingOverwrite && pendingOverwrite.cell === selected && pendingOverwrite.d === d)) {
    pendingOverwrite = { cell: selected, d };
    setMsg(tr("The cell already has {v}. Tap {d} again to change it.", { v: cur, d }), "warn");
    renderGrid();
    return;
  }
  pushUndo();
  checked = false;
  hintCell = -1;
  pendingOverwrite = null;
  entries[selected] = d;
  // pn: how many cells had pencil notes when the number was placed
  const pn = notes.reduce((a, x) => a + (x ? 1 : 0), 0);
  meta.moves.push(pn ? { c: selected, v: d, t: elapsed(), pn } : { c: selected, v: d, t: elapsed() });
  for (const j of peerSets[selected]) notes[j] &= ~(1 << d);
  afterChange();
}
function erase() {
  if (selected < 0 || P.givens[selected] || solved) return;
  if (!entries[selected] && !notes[selected]) return;
  if (entries[selected]) meta.moves.push({ c: selected, v: 0, t: elapsed() });
  pushUndo();
  entries[selected] = 0;
  notes[selected] = 0;
  checked = false;
  pendingOverwrite = null;
  afterChange();
}
function undo() {
  const h = undoStack.pop();
  if (!h || solved) return;
  const t = elapsed();
  h.entries.forEach((v, i) => {
    if (v !== entries[i]) meta.moves.push({ c: i, v, t, u: 1 });
  });
  entries = h.entries;
  notes = h.notes;
  checked = false;
  hintCell = -1;
  pendingOverwrite = null;
  afterChange();
}
let saveT = 0;
function afterChange() {
  if (hint) {
    // A hint that does not count yet counts after all if the hint's number was just placed in a cell that was first chosen
    // after the hint. If the cell was chosen already before, you hit the hint button instead of the number you had found yourself.
    if (hint.data && !hint.counted) {
      if (entries[hint.data.cell] === hint.data.v && hint.sel !== hint.data.cell) commitHint();
      else dropHint(hint.sel === hint.data.cell && entries[hint.data.cell] === hint.data.v);
    }
    hint = null;
    renderHint();
  }
  let done = true;
  for (let i = 0; i < G.n; i++)
    if (value(i) !== P.solution[i]) {
      done = false;
      break;
    }
  if (done && !solved) {
    syncClock();
    clockAcc = elapsed();
    clockSince = null;
    solved = true;
    selected = -1;
    const rec = recordGame(true);
    saveCurrent();
    renderGrid();
    renderPad();
    renderStatus();
    setMsg(rec.solved ? tr("Solved in {time}.", { time: fmt(rec.ms) }) : tr("Filled in, but the solution was shown along the way."), rec.solved ? "good" : "");
    try {
      navigator.storage && navigator.storage.persist && navigator.storage.persist();
    } catch (e) {}
    startRoute(rec);
    setTimeout(() => showSolved(rec), 650);
    return;
  }
  if (!done && $("msg").classList.contains("good")) setMsg("", "");
  if (!done && boardFull()) setMsg(tr("The board is full, but something is wrong. “Check for errors” shows what (counts as a hint)."), "bad");
  renderGrid();
  renderPad();
  renderStatus();
  clearTimeout(saveT);
  saveT = setTimeout(saveCurrent, 600);
}
fastTap($("pad"), (e) => {
  const b = e.target.closest && e.target.closest("button");
  if (b && !b.disabled && b.dataset.d) input(+b.dataset.d);
});
function cellAt(e) {
  if (e.detail === 0 && e.type === "click") {
    const a = e.target.getAttribute && e.target.getAttribute("data-i");
    return a == null ? -1 : +a;
  }
  return svgCellAt(svg, G.cols, G.rows, e);
}
fastTap(svg, (e) => {
  if (!P) return;
  const i = cellAt(e);
  if (i < 0) return;
  selected = +i === selected ? -1 : +i;
  if (pendingOverwrite) {
    pendingOverwrite = null;
    if ($("msg").classList.contains("warn")) setMsg("", "");
  }
  renderGrid();
  renderPad();
});
document.addEventListener("keydown", (e) => {
  if (view !== "game" || !P || !$("sheet").hidden || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key >= "1" && e.key <= "9" && +e.key <= (P.maxRegion || 5)) {
    input(+e.key);
    e.preventDefault();
  } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
    erase();
    e.preventDefault();
  } else if (e.key.startsWith("Arrow")) {
    if (selected < 0) selected = 0;
    else {
      const r = Math.floor(selected / G.cols),
        c = selected % G.cols;
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      selected = Math.min(G.rows - 1, Math.max(0, r + d[0])) * G.cols + Math.min(G.cols - 1, Math.max(0, c + d[1]));
      if (pendingOverwrite) {
        pendingOverwrite = null;
        if ($("msg").classList.contains("warn")) setMsg("", "");
      }
    }
    renderGrid();
    renderPad();
    e.preventDefault();
  } else if (e.key === "n" || e.key === "N") {
    noteMode = !noteMode;
    renderPad();
  } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
    undo();
    e.preventDefault();
  }
});
fastTap($("noteBtn"), () => {
  if (solved) return;
  noteMode = !noteMode;
  renderPad();
});
fastTap($("eraseBtn"), erase);
fastTap($("undoBtn"), undo);
$("gameBack").onclick = () => go("home", { back: true });
$("gameTitle").onclick = showRating;
$("menuBtn").onclick = showMenu;

// ---------- Hint
$("hintBtn").onclick = () => {
  if (solved) return;
  const wrongIdx = entries.findIndex((v, i) => v && v !== P.solution[i]);
  if (wrongIdx >= 0) {
    selected = wrongIdx;
    checked = true;
    logCheck(entries.filter((v, i) => v && v !== P.solution[i]).length);
    saveCurrent();
    setMsg(tr("Fix {cell} first: the number does not match the solution.", { cell: cellName(wrongIdx) }), "bad");
    renderGrid();
    renderPad();
    return;
  }
  const sel = selected; // the cell that was chosen when hint was pressed
  hint = { data: null, k: 0 };
  renderHint();
  setTimeout(() => {
    const known = P.givens.map((g, i) => g || entries[i]);
    const data = tutor.easiest(known);
    if (!data) {
      hint = null;
      renderHint();
      setMsg(tr("Found no logical way forward from here."), "bad");
      return;
    }
    // The hint counts only when it is used (Next, Insert, the guide) or has been open for HINT_GRACE ms.
    // If it is closed before that, it was a mis-tap (e.g. next to a number), and it does not count.
    const h = { data, k: 0, counted: false, sel };
    hint = h;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint === h && commitHint(), HINT_GRACE);
    renderHint();
    renderGrid();
    renderStatus();
    $("hintPanel").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, 30);
};
const HINT_GRACE = 3000;
let hintTimer = 0;
function commitHint() {
  if (!hint || !hint.data || hint.counted) return;
  hint.counted = true;
  clearTimeout(hintTimer);
  meta.hints++;
  meta.hintTechs.push(hint.data.hardest);
  saveCurrent();
  renderStatus();
}
// closed within HINT_GRACE without being used: does not count
function dropHint(own) {
  clearTimeout(hintTimer);
  toast(own ? tr("The hint does not count: you had already chosen the cell before the hint appeared.") : tr("The hint does not count: it was closed right away."));
}
function renderHint() {
  const panel = $("hintPanel");
  if (!hint) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  if (!hint.data) {
    $("hintTag").textContent = tr("Hint");
    $("hintText").textContent = tr("Finding the easiest next number …");
    $("hintNav").hidden = true;
    $("hintGuide").hidden = true;
    $("hintChain").hidden = true;
    return;
  }
  const d = hint.data,
    v = d.views[hint.k],
    last = hint.k === d.views.length - 1;
  $("hintNav").hidden = false;
  $("hintTag").textContent = v.nudge
    ? tr("Hint · {tech} · a nudge in the right direction", { tech: LEVEL_TECH[d.hardestLevel] })
    : tr("Hint") + " · " + v.title;
  $("hintText").textContent = v.text;
  const ch = $("hintChain");
  if (v.chain && v.chain.length) {
    ch.hidden = false;
    ch.open = false;
    $("hintChainSum").textContent = tr("See the whole chain ({n} steps)", { n: v.chain.length });
    $("hintChainList").innerHTML = "";
    v.chain.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      $("hintChainList").appendChild(li);
    });
  } else ch.hidden = true;
  $("hintPrev").disabled = hint.k === 0;
  $("hintNext").textContent = last ? tr("Place {v}", { v: d.v }) : v.nudge ? tr("Show explanation") : tr("Next");
  $("hintDots").innerHTML = d.views.map((_, i) => '<i class="' + (i <= hint.k ? "on" : "") + '"></i>').join("");
  const tech = v.tech !== undefined ? v.tech : d.hardest;
  $("hintGuide").hidden = !GAME.guide || !GUIDE_IDS[tech]; // games without a guide, or a technique without an example, do not show the link
  $("hintGuide").dataset.tech = tech;
  $("hintGuide").textContent = tr("Read about {tech} in the guide", { tech: TECH_NAMES_UI[tech] });
}
$("hintPrev").onclick = () => {
  if (hint && hint.data && hint.k > 0) {
    hint.k--;
    renderHint();
    renderGrid();
  }
};
$("hintNext").onclick = () => {
  if (!hint || !hint.data) return;
  commitHint();
  const d = hint.data;
  if (hint.k < d.views.length - 1) {
    hint.k++;
    renderHint();
    renderGrid();
    return;
  }
  pushUndo();
  entries[d.cell] = d.v;
  notes[d.cell] = 0;
  hintCell = d.cell;
  selected = d.cell;
  pendingOverwrite = null;
  meta.moves.push({ c: d.cell, v: d.v, t: elapsed(), h: 1 });
  for (const j of peerSets[d.cell]) notes[j] &= ~(1 << d.v);
  const name = cellName(d.cell);
  afterChange();
  if (!solved && beginner()) setMsg(tr("Placed: {cell} = {v}.", { cell: name, v: d.v }), "good");
};
$("hintClose").onclick = () => {
  if (hint && hint.data && !hint.counted) dropHint();
  hint = null;
  renderHint();
  renderGrid();
};
$("hintChain").addEventListener("toggle", () => $("hintChain").open && commitHint());
$("hintGuide").onclick = () => {
  commitHint();
  openGuide(+$("hintGuide").dataset.tech);
};

// ---------- Guide: inside the app when it is self-hosted, otherwise in a new window
function openGuide(tech) {
  const anchor = tech != null && GUIDE_IDS[tech] ? "#" + GUIDE_IDS[tech] : "";
  const page = LANG === BASE_LANG ? "guide.html" : "guide-" + LANG + ".html";
  if (location.protocol === "file:") {
    window.open(page + anchor, "_blank", "noopener");
    return;
  }
  const f = $("guideFrame"),
    src = page + anchor;
  if (f.getAttribute("src") !== src) f.setAttribute("src", src);
  go("guide");
}

// ---------- Menu
function menuItem(id, icon, label, small, cls) {
  return `<button type="button" id="${id}" class="${cls || ""}"><svg class="i" viewBox="0 0 24 24">${icon}</svg>${label}${small ? `<small>${small}</small>` : ""}</button>`;
}
const IC = {
  check: '<path d="M4 12l5 5L20 6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders:
    '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
};
function showMenu() {
  openSheet(
    `<div class="menu">` +
      menuItem("mCheck", IC.check, tr("Check for errors"), (meta.checks ? tr("used {n}×", { n: meta.checks }) + " · " : "") + tr("counts as a hint")) +
      menuItem("mReveal", IC.eye, reveal ? tr("Hide solution") : tr("Show solution"), reveal ? "" : tr("counts as given up")) +
      menuItem("mRestart", IC.restart, tr("Start over")) +
      `</div><div class="menu">` +
      menuItem("mInfo", IC.info, tr("About the puzzle and its difficulty")) +
      menuItem("mShare", IC.share, tr("Share puzzle"), FRAMED ? tr("copy code") : "") +
      `</div><div class="menu">` +
      menuItem("mAgain", IC.plus, tr("New puzzle with the same settings"), BAND[ui.level]) +
      menuItem("mNew", IC.sliders, tr("Choose a new puzzle")) +
      menuItem("mHome", IC.home, tr("Back to home")) +
      `</div>` +
      noteLink("play"),
    (b) => {
      bindNoteLinks(b, null, showMenu);
      b.querySelector("#mCheck").onclick = () => {
        closeSheet();
        checkErrors();
      };
      b.querySelector("#mReveal").onclick = () => {
        if (reveal || solved || meta.revealed) {
          closeSheet();
          toggleReveal();
          return;
        }
        closeSheet();
        setTimeout(
          () =>
            confirmSheet({
              title: tr("Show the solution?"),
              text: tr("The puzzle then won't count as solved in your statistics. You can hide the solution again afterwards."),
              ok: tr("Show solution"),
              onOk: toggleReveal,
            }),
          280,
        );
      };
      b.querySelector("#mRestart").onclick = () => {
        closeSheet();
        restart();
      };
      b.querySelector("#mInfo").onclick = () => {
        closeSheet();
        setTimeout(showRating, 280);
      };
      b.querySelector("#mShare").onclick = () => {
        closeSheet();
        shareCode();
      };
      b.querySelector("#mAgain").onclick = () => {
        closeSheet();
        setTimeout(() => replaceGame(generateFromUi), 280);
      };
      b.querySelector("#mNew").onclick = () => {
        closeSheet();
        go("new");
      };
      b.querySelector("#mHome").onclick = () => {
        closeSheet();
        go("home", { back: true });
      };
    },
  );
}
// The largest number that can be written in the cell: the region's size, or the board's largest region with "Allow all numbers"
const digitMax = (i) => (settings.anyDigit ? P.maxRegion || 5 : regionSize[i]);
// Having errors shown counts as a hint and is written to the log, so the route analysis knows the errors were found that way
function logCheck(wrong) {
  meta.checks++;
  meta.hints++;
  meta.moves.push({ chk: 1, n: wrong, t: elapsed() });
  renderStatus();
}
function checkErrors() {
  if (solved) return;
  checked = true;
  const wrong = entries.filter((v, i) => v && v !== P.solution[i]).length;
  logCheck(wrong);
  setMsg(
    wrong ? (wrong === 1 ? tr("1 error is marked.") : tr("{n} errors are marked.", { n: wrong })) : tr("No errors so far."),
    wrong ? "bad" : "good",
  );
  renderGrid();
  saveCurrent();
}
function toggleReveal() {
  reveal = !reveal;
  if (reveal && !solved) meta.revealed = true;
  renderGrid();
  renderPad();
  saveCurrent();
}
function restart() {
  if (!entries.some(Boolean) && !notes.some(Boolean)) {
    toast(tr("There is nothing to clear."));
    return;
  }
  pushUndo();
  const t = elapsed();
  entries.forEach((v, i) => {
    if (v) meta.moves.push({ c: i, v: 0, t, u: 1 });
  });
  entries = entries.map(() => 0);
  notes = notes.map(() => 0);
  checked = false;
  hintCell = -1;
  reveal = false;
  setMsg(tr("Started over. Undo brings your numbers back."), "");
  renderAll();
  saveCurrent();
}
async function shareCode() {
  const url = appUrl() ? appUrl() + "#" + P.code : null;
  const text = APP.name + " · " + BAND[pBand(P)] + " " + levelValue(P) + " · " + P.cols + "×" + P.rows + "\n" + P.code;
  if (url && navigator.share) {
    try {
      await navigator.share({ title: APP.name, text, url });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url || P.code);
    toast(url ? tr("Link copied") : tr("The code has been copied"));
  } catch (e) {
    showRating();
    toast(tr("Could not copy. Select the code here."));
  }
}

// ---------- About the puzzle (difficulty)
function showRating() {
  const r = P.rating;
  const hardestIdx = r.uses.reduce((best, u, i) => (u > 0 ? i : best), -1);
  const items = E.TECH.map((t, i) => {
    const used = r.uses[i] > 0;
    return (
      `<li class="${used ? "" : "unused"} ${i === hardestIdx ? "hardest" : ""}"><span class="lv">${t.level}</span><span class="name"${i === hardestIdx ? ` data-hardest="${tr("hardest")}"` : ""}>${t.label}</span>` +
      `<span class="n">${used ? "×" + r.uses[i] : "–"}</span><span class="d">${t.desc}</span></li>`
    );
  }).join("");
  openSheet(
    `<div class="rating"><h2>${tr("Why {v}?", { v: levelValue(P) })}</h2>` +
      personalLineHtml(shownGrade(P), P.rating.level) +
      penLineHtml(P.grade) +
      profileHtml(P.grade) +
      `<h3>${tr("Puzzle code")}</h3><p>${GAME.codeNote}</p><div class="codebox">${P.code}</div>` +
      `<div class="actions row2"><button class="secondary" type="button" id="rCopy">${tr("Copy code")}</button><button class="secondary" type="button" id="rShare">${tr("Share")}</button></div>` +
      `<h3>${tr("Techniques")}</h3><p>${tr("The techniques a solver needs, and how many times. They no longer decide the number on their own.")}</p><ul class="tech">${items}</ul>` +
      `<div class="actions"><button class="primary big" type="button" id="rClose">${tr("Close")}</button></div>` +
      noteLink("grade") +
      `</div>`,
    (b) => {
      bindNoteLinks(b, null, showRating);
      b.querySelector("#rClose").onclick = closeSheet;
      b.querySelector("#rCopy").onclick = async () => {
        try {
          await navigator.clipboard.writeText(P.code);
          toast(tr("The code has been copied"));
        } catch (e) {
          toast(tr("Select the code and copy it"));
        }
      };
      b.querySelector("#rShare").onclick = () => {
        closeSheet();
        shareCode();
      };
    },
  );
}
// The effort step by step through the whole solution: one spike or a plateau?
function effortStrip(g) {
  if (!g.series || g.tech === 1) return "";
  const n = g.series.length,
    W = 320,
    H = 54,
    bw = W / n,
    mx = Math.max(3, ...g.series);
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H + 14}" role="img" aria-label="${tr("Effort for each step of the solution")}" style="margin:4px 0 2px">`;
  g.series.forEach((e, i) => {
    const h = e ? Math.max(4, (H * e) / mx) : 2,
      top = e && Math.abs(e - g.hard.e) < 0.06;
    s +=
      `<rect x="${(i * bw + 0.5).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${e ? (top ? "var(--stamp)" : "var(--indigo)") : "var(--grid)"}"` +
      ` data-tip="${tr("Step {k} of {n}:", { k: i + 1, n })} ${e ? tr("effort {x}", { x: dec(e) }) : tr("direct number")}"/>`;
  });
  return (
    s +
    `<text x="0" y="${H + 11}" font-size="10" fill="var(--mute)">${tr("first number")}</text><text x="${W}" y="${H + 11}" font-size="10" text-anchor="end" fill="var(--mute)">${tr("last number")}</text></svg>` +
    `<p style="font-size:12.5px;color:var(--mute);margin:0 0 10px">${tr("Each bar is one number in the solution. Tall bars are heavy steps, the red one is the heaviest, the grey ones are direct numbers.")}</p>`
  );
}
// Why exactly this pattern is easy or hard to spot
function visText(h) {
  const v = h.vis,
    f = (x) => (x < -0.04 ? "−" : "+") + dec(Math.abs(x)),
    parts = [];
  parts.push(tr("the pattern itself {x}", { x: f(h.base) }));
  if (h.T >= 2 && h.T <= 6)
    parts.push(
      (v.size === 1
        ? tr("1 cell")
        : v.bent
          ? tr("{n} cells around a corner", { n: v.size })
          : tr("{n} cells in a line", { n: v.size })) +
        " " +
        f(h.shapeT),
    );
  const pctF = Math.round(v.fill * 100);
  const area = pctF >= 60 ? tr("crowded area") : pctF >= 40 ? tr("half-open area") : tr("open area");
  parts.push(tr("{area} ({pct} % of the surrounding cells have numbers) {x}", { area, pct: pctF, x: f(h.openT) }));
  parts.push(
    v.work === 1
      ? tr("1 empty cell whose options you need to know {x}", { x: f(h.workT) })
      : tr("{n} empty cells whose options you need to know {x}", { n: v.work, x: f(h.workT) }),
  );
  return tr("Breakdown: {parts}.", { parts: parts.join("; ") });
}
// Why the grade without pencil is higher
// One explanation per pencil term (see PEN_TERMS in grade.js); h is the heaviest step (g.hard or g.np).
function penReason(k, h) {
  switch (k) {
    case "nopenT":
      return tr("{tech} requires remembering the cells' options", { tech: E.TECH[h.T].label.toLowerCase() });
    case "multiT":
      return h.multi === 1 ? tr("1 cell is left with several options after the elimination") : tr("{n} cells are left with several options after the elimination", { n: h.multi });
    case "memT":
      return tr("more must be kept in mind");
    case "trialT":
      return tr("the assumption starts in a cell with 3 or more options, so the contradiction removes only one number, which you must remember");
    case "builtT":
      return tr("the pattern rests on earlier eliminations that cannot be seen from the numbers on the board");
    case "repeatT":
      return tr("the pattern was used before, and with pencil it is already on the board");
    case "partialT":
      return tr("a partial triple requires knowing each cell's exact options");
    case "lenPT":
      return tr("the whole chain of assumed numbers ({n} links) has to be kept in your head", { n: h.len });
  }
  return "";
}
// Why the grade without pencil is higher: the pencil terms that cost more without pencil (g.np is the whole grade without pencil)
function penWhy(g) {
  const a = g.hard || {},
    b = (g.np && g.np.hard) || {};
  return PEN_TERMS.filter((k) => (b[k] || 0) - (a[k] || 0) > 0.05).map((k) => penReason(k, Math.abs(a[k] || 0) >= Math.abs(b[k] || 0) ? a : b));
}
// One row for the pencil terms in the step shown (memory has its own row). With pencil they are deductions.
function penRow(h, row, f) {
  const ks = PEN_TERMS.filter((k) => k !== "memT" && Math.abs(h[k] || 0) >= 0.05),
    sum = ks.reduce((a, k) => a + h[k], 0);
  if (Math.abs(sum) < 0.05) return "";
  const why = list2(ks.map((k) => penReason(k, h)));
  return sum < 0
    ? row("−" + f(-sum), tr("With pencil."), tr("The notes keep track of what you would otherwise have to remember: {why}.", { why }))
    : row("+" + f(sum), tr("Without pencil."), tr("What the pencil would otherwise keep track of must be remembered: {why}.", { why }));
}
// The grade with and without pencil, and why they differ
function penLineHtml(g) {
  if (!g || !g.np) return "";
  const other = showNoPen() ? g.value : g.np.value,
    otherName = showNoPen() ? tr("With pencil") : tr("Without pencil");
  if (Math.abs(g.np.value - g.value) < 0.1)
    return `<p class="estline"><b>${tr("Same grade with and without pencil.")}</b> ${tr("The puzzle does not require keeping track of options.")}</p>`;
  const why = penWhy(g);
  return (
    `<p class="estline"><b>${tr("{name}: {v}.", { name: otherName, v: dec(other) })}</b> ` +
    (why.length ? tr("Without pencil it is harder because {why}.", { why: list2(why) }) : "") +
    `</p>`
  );
}
function profileHtml(g0) {
  if (!g0 || !g0.hard) return "";
  // Explain the grade that is shown: without pencil is the anchor (no pencil terms); with pencil has deductions for the notes
  const g = showNoPen() && g0.np && g0.np.hard ? g0.np : g0;
  const f = (v) => dec(v),
    h = g.hard,
    pct = Math.round(h.progress * 100),
    total = g.value,
    band = g.band;
  const bar = Array.from({ length: 9 }, (_, i) => `<i class="${i < band ? "on" : ""}"></i>`).join("");
  const row = (num, lead, text) => `<dt>${num}</dt><dd>${lead ? "<b>" + lead + "</b> " : ""}${text}</dd>`;
  let rows;
  if (g.tech === 1) {
    const way = g.avgOpts < 2 ? tr("Narrow path.") : g.avgOpts < 3.5 ? tr("Some options.") : tr("Many options.");
    rows =
      row(dec(1), tr("Only simple moves."), tr("Every number can be found directly from the numbers in the grid.")) +
      row(
        "+" + f(g.value - 1),
        way,
        tr("On average {n} places to make progress from. Fewer places make the next number harder to spot.", { n: f(g.avgOpts) }),
      );
  } else {
    const techName = E.TECH[h.T].label;
    const mem =
      h.mem === 0
        ? tr("Nothing needs to be remembered.")
        : (h.mem === 1 ? tr("1 thing must be kept in mind at once") : tr("{n} things must be kept in mind at once", { n: h.mem })) +
          (h.mem >= 7 ? tr("; the pencil helps here.") : h.mem >= 4 ? tr("; that takes concentration.") : ".");
    rows =
      row(dec(1), "", tr("Base value for a number you can see directly.")) +
      row(
        "+" + f(h.R),
        tr("Recognition."),
        tr("The heaviest step ({tech}) comes {pct} % into the puzzle.", { tech: esc(techName.toLowerCase()), pct }) + (h.vis ? " " + visText(h) : ""),
      ) +
      row("+" + f(h.memT), tr("Memory."), mem) +
      row("+" + f(h.lenT), tr("Length."), h.len === 1 ? tr("The reasoning has 1 link.") : tr("The reasoning has {n} links.", { n: h.len })) +
      (h.innerT
        ? row("+" + f(h.innerT), tr("Along the way."), tr("Along the way in the assumption you need {tech}.", { tech: list2((h.inner || []).map((t) => esc(E.TECH[t].label.toLowerCase()))) }))
        : h.T === 11 || h.T === 13
          ? row("+0", tr("Along the way."), tr("Along the way in the assumption there are only singles."))
          : "") +
      (h.spot
        ? row("+" + f(h.spot), tr("Overview."), h.opts <= 1 ? tr("There was only one place to make progress.") : tr("There were only {n} places to make progress.", { n: h.opts }))
        : "") +
      penRow(h, row, f) +
      (g.earlyT >= 0.05 ? row("+" + f(g.earlyT), tr("Early."), tr("The heavy step comes while the board is still open.")) : "") +
      row(`<b>${f(g.peak)}</b>`, tr("Peak:"), tr("the heaviest step on its own.")) +
      row(
        "+" + f(g.loadT),
        tr("Load {n} of 10.", { n: g.load }),
        (g.nHard === 1
          ? tr("It is the only step that needs more than a direct number.")
          : tr("{n} steps need more than a direct number.", { n: g.nHard })) +
          " " +
          tr("Each of the others adds a little, and repeats of the same technique count less and less. The addition is at most {max}.", { max: dec(1) }),
      );
    if (E.TECH[h.T].level !== g.tech)
      rows += row(
        tr("NB"),
        "",
        tr("The most advanced technique in the puzzle is {tech}, but it is not the heaviest step here.", { tech: esc(LEVEL_TECH[g.tech]) }),
      );
  }
  return (
    `<div class="decbar" aria-hidden="true">${bar}</div>` +
    `<p>${tr("The number is the heaviest step (peak) plus an addition for how many heavy steps there are (load). It measures effort, not which technique is used.")}</p>` +
    effortStrip(g) +
    `<dl class="profile">${rows}<dt><b>${f(total)}</b></dt><dd><b>${BAND[band]}</b>${total >= GW.cap ? " " + tr("(the scale stops at {max})", { max: dec(GW.cap) }) : ""}</dd></dl>` +
    estLineHtml(g0.lv) +
    `<p>${tr("The weights are fitted to the first 17 rated puzzles. Keep answering “how did it feel?” so they can be adjusted again.")}</p>`
  );
}

const FELT = [tr("Much easier"), tr("Easier"), tr("About right"), tr("Harder"), tr("Much harder")];
function showSolved(rec) {
  if (view !== "game") return;
  const st = streaks();
  const gNow = games.find((g) => g.id === rec.id),
    feltNow = gNow && gNow.felt != null ? gNow.felt : null;
  let record = "";
  if (rec.solved && !rec.hints) {
    const prev = games.filter(
      (g) => g.id !== rec.id && g.solved && !g.hints && g.rows === rec.rows && g.cols === rec.cols && gBand(g) === gBand(rec),
    );
    if (prev.length && rec.ms < Math.min(...prev.map((g) => g.ms)))
      record = `<span class="record">${tr("New record on {size}, grade {g}", { size: rec.cols + "×" + rec.rows, g: gBand(rec) })}</span>`;
    else if (!prev.length)
      record = `<span class="record">${tr("First solve on {size}, grade {g} without hints", { size: rec.cols + "×" + rec.rows, g: gBand(rec) })}</span>`;
  }
  const facts = [
    esc(BAND[gBand(rec)]) + " " + dec(gradeFor(rec)),
    rec.cols + "×" + rec.rows,
    rec.daily ? tr("Daily puzzle") : "",
    fmt(rec.ms),
    rec.hints ? (rec.hints === 1 ? tr("1 hint") : tr("{n} hints", { n: rec.hints })) : tr("no hints"),
    st.current > 1 ? tr("{n} days in a row", { n: st.current }) : "",
  ].filter(Boolean);
  openSheet(
    `<div class="solved v2"><div class="shead"><div class="smallstamp" aria-hidden="true">解</div>` +
      `<div><h2>${rec.solved ? tr("Solved!") : tr("Filled in")}</h2><p class="sub">${facts.join(" · ")}</p></div></div>${record}` +
      (rec.est && rec.solved ? `<p class="sub estcmp">${tr("Your estimate was {t}.", { t: estFmt(rec.est) })} ${estCompare(rec.ms, rec.est)}</p>` : "") +
      (rec.solved ? "" : `<p class="sub">${tr("The solution was shown along the way, so it doesn't count as solved.")}</p>`) +
      `<div id="takeaway">${
        gNow && gNow.moves && !gNow.routePending
          ? afterGameHtml(gNow)
          : gNow && gNow.routePending
            ? `<p class="sub mwait">${tr("Finding the moments worth a second look …")}</p>`
            : ""
      }</div>` +
      `<div class="actions sbtns"><span id="sPractice"></span><button class="primary big" type="button" id="sNew">${tr("New puzzle")} · ${esc(BAND[ui.level])}</button></div>` +
      `<button class="routeline" type="button" id="routeLine">${routeLineHtml(rec)}</button>` +
      `<div id="concLine">${concWarnHtml(rec)}</div>` +
      `<p class="feltq">${tr("How did it feel compared with {v}?", { v: dec(gradeFor(rec)) })}</p><div class="seg felt" id="feltSeg">` +
      FELT.map((t, i) => `<button type="button" data-f="${i - 2}" aria-pressed="${feltNow === i - 2}">${t}</button>`).join("") +
      `</div>` +
      `<div class="actions row2"><button class="secondary" type="button" id="sFinal">${tr("See board")}</button><button class="secondary" type="button" id="sStats">${tr("Statistics")}</button><button class="secondary" type="button" id="sHome">${tr("Home")}</button></div></div>`,
    (b) => {
      if (gNow && gNow.moves && !gNow.routePending) {
        bindAfterGame(b, gNow);
        fillPractice(b, gNow);
      }
      b.querySelector("#sNew").onclick = () => {
        closeSheet();
        generateFromUi();
      };
      b.querySelectorAll("#feltSeg button").forEach(
        (x) =>
          (x.onclick = () => {
            const g = games.find((y) => y.id === rec.id);
            if (!g) return;
            g.felt = +x.dataset.f;
            saveGames();
            b.querySelectorAll("#feltSeg button").forEach((y) => y.setAttribute("aria-pressed", y === x));
          }),
      );
      b.querySelector("#routeLine").onclick = () => {
        const g = games.find((x) => x.id === rec.id);
        if (g && g.moves) {
          closeSheet();
          setTimeout(() => showRoute(g, () => showSolved(rec)), 280);
        }
      };
      b.querySelector("#sFinal").onclick = () => {
        const g = games.find((x) => x.id === rec.id);
        if (g) showFinal(g, () => showSolved(rec));
      };
      b.querySelector("#sStats").onclick = () => {
        closeSheet();
        go("stats");
      };
      b.querySelector("#sHome").onclick = () => {
        closeSheet();
        go("home", { back: true });
      };
    },
  );
}
// "Practise {technique}" after the game: the technique of the first moment that has a drill
function fillPractice(root, g) {
  const slot = root.querySelector("#sPractice");
  if (!slot) return;
  let L = null;
  try {
    const t = takeaway(g);
    const m = t && t.moments.find((x) => x.L >= 1 && x.L <= 4);
    if (m) L = m.L;
  } catch (e) {}
  slot.innerHTML = L ? `<button class="secondary big" type="button" id="sPractise">${tr("Practise {tech}", { tech: LEVEL_TECH[L] })}</button>` : "";
  const b = slot.querySelector("#sPractise");
  if (b)
    b.onclick = () => {
      closeSheet();
      setTimeout(() => startDrill(L), 280);
    };
}
// The concentration line after the game only when something was off
function concWarnHtml(g) {
  const h = concLineHtml(g);
  return h.includes("insight warn") ? h : "";
}
