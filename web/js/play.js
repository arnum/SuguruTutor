// Spillet: indtastning, hints, menu, forklaring af sværhedsgraden og løst-arket.

function pushUndo() {
  undoStack.push({ entries: entries.slice(), notes: notes.slice() });
  if (undoStack.length > 300) undoStack.shift();
}
function input(d) {
  if (selected < 0 || P.givens[selected] || solved || d > regionSize[selected]) return;
  const cur = entries[selected];
  if (noteMode) {
    if (cur) {
      setMsg(tr("Feltet har allerede {v}. Visk ud, hvis du vil skrive noter.", { v: cur }), "warn");
      return;
    }
    pushUndo();
    checked = false;
    hintCell = -1;
    pendingOverwrite = null;
    notes[selected] ^= 1 << d;
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
    setMsg(tr("Feltet har allerede {v}. Tryk {d} igen for at skifte.", { v: cur, d }), "warn");
    renderGrid();
    return;
  }
  pushUndo();
  checked = false;
  hintCell = -1;
  pendingOverwrite = null;
  entries[selected] = d;
  meta.moves.push({ c: selected, v: d, t: elapsed() });
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
    setMsg(rec.solved ? tr("Løst på {tid}.", { tid: fmt(rec.ms) }) : tr("Udfyldt, men løsningen blev vist undervejs."), rec.solved ? "good" : "");
    try {
      navigator.storage && navigator.storage.persist && navigator.storage.persist();
    } catch (e) {}
    startRoute(rec);
    setTimeout(() => showSolved(rec), 650);
    return;
  }
  if (!done && $("msg").classList.contains("good")) setMsg("", "");
  renderGrid();
  renderPad();
  renderStatus();
  clearTimeout(saveT);
  saveT = setTimeout(saveCurrent, 600);
}
// Hurtige tryk: der reageres på pointerdown, ikke click. Et click kræver, at fingeren løftes på samme element,
// og både talknapper og gitter tegnes om efter hvert tryk, så hurtige tryk gik tabt.
function fastTap(node, fn) {
  node.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    fn(e);
  });
  node.addEventListener("click", (e) => {
    if (e.detail === 0) fn(e);
  }); // tastatur og skærmlæser
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
  const r = svg.getBoundingClientRect(),
    vw = G.cols * 100 + 40,
    vh = G.rows * 100 + 40;
  const c = Math.floor((((e.clientX - r.left) / r.width) * vw - 34) / 100),
    row = Math.floor((((e.clientY - r.top) / r.height) * vh - 34) / 100);
  return c < 0 || row < 0 || c >= G.cols || row >= G.rows ? -1 : row * G.cols + c;
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
  if (e.key >= "1" && e.key <= "6") {
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
    setMsg(tr("Ret først {cell}: tallet passer ikke med løsningen.", { cell: cellName(wrongIdx) }), "bad");
    renderGrid();
    renderPad();
    return;
  }
  hint = { data: null, k: 0 };
  renderHint();
  setTimeout(() => {
    const known = P.givens.map((g, i) => g || entries[i]);
    const data = tutor.easiest(known);
    if (!data) {
      hint = null;
      renderHint();
      setMsg(tr("Fandt ingen logisk vej herfra."), "bad");
      return;
    }
    hint = { data, k: 0 };
    meta.hints++;
    meta.hintTechs.push(data.hardest);
    saveCurrent();
    renderHint();
    renderGrid();
    renderStatus();
    $("hintPanel").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, 30);
};
function renderHint() {
  const panel = $("hintPanel");
  if (!hint) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  if (!hint.data) {
    $("hintTag").textContent = tr("Hint");
    $("hintText").textContent = tr("Finder det letteste næste tal …");
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
    ? tr("Hint · {tech} · et skub i den rigtige retning", { tech: LEVEL_TECH[d.hardestLevel] })
    : tr("Hint") + " · " + v.title;
  $("hintText").textContent = v.text;
  const ch = $("hintChain");
  if (v.chain && v.chain.length) {
    ch.hidden = false;
    ch.open = false;
    $("hintChainSum").textContent = tr("Se hele kæden ({n} skridt)", { n: v.chain.length });
    $("hintChainList").innerHTML = "";
    v.chain.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      $("hintChainList").appendChild(li);
    });
  } else ch.hidden = true;
  $("hintPrev").disabled = hint.k === 0;
  $("hintNext").textContent = last ? tr("Indsæt {v}", { v: d.v }) : v.nudge ? tr("Vis forklaring") : tr("Næste");
  $("hintDots").innerHTML = d.views.map((_, i) => '<i class="' + (i <= hint.k ? "on" : "") + '"></i>').join("");
  const tech = v.tech !== undefined ? v.tech : d.hardest;
  $("hintGuide").hidden = false;
  $("hintGuide").dataset.tech = tech;
  $("hintGuide").textContent = tr("Læs om {tech} i guiden", { tech: TECH_NAMES_UI[tech] });
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
  if (!solved) setMsg(tr("Indsat: {cell} = {v}.", { cell: name, v: d.v }), "good");
};
$("hintClose").onclick = () => {
  hint = null;
  renderHint();
  renderGrid();
};
$("hintGuide").onclick = () => openGuide(+$("hintGuide").dataset.tech);

// ---------- Guide: i appen når den er hostet selv, ellers i et nyt vindue
function openGuide(tech) {
  const anchor = tech != null ? "#" + GUIDE_IDS[tech] : "";
  const page = LANG === "da" ? "guide.html" : "guide-" + LANG + ".html";
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
      menuItem("mCheck", IC.check, tr("Tjek fejl"), meta.checks ? tr("brugt {n}×", { n: meta.checks }) : "") +
      menuItem("mReveal", IC.eye, reveal ? tr("Skjul løsning") : tr("Vis løsning"), reveal ? "" : tr("tæller som opgivet")) +
      menuItem("mRestart", IC.restart, tr("Start forfra")) +
      `</div><div class="menu">` +
      menuItem("mInfo", IC.info, tr("Om opgaven og sværhedsgraden")) +
      menuItem("mShare", IC.share, tr("Del opgave"), FRAMED ? tr("kopiér kode") : "") +
      `</div><div class="menu">` +
      menuItem("mAgain", IC.plus, tr("Ny opgave med samme indstillinger"), BAND[ui.level]) +
      menuItem("mNew", IC.sliders, tr("Vælg ny opgave")) +
      menuItem("mHome", IC.home, tr("Til forsiden")) +
      `</div>`,
    (b) => {
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
              title: tr("Vis løsningen?"),
              text: tr("Opgaven tæller så ikke som løst i statistikken. Du kan skjule løsningen igen bagefter."),
              ok: tr("Vis løsning"),
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
function checkErrors() {
  if (solved) return;
  checked = true;
  meta.checks++;
  const wrong = entries.filter((v, i) => v && v !== P.solution[i]).length;
  setMsg(
    wrong ? (wrong === 1 ? tr("1 fejl er markeret.") : tr("{n} fejl er markeret.", { n: wrong })) : tr("Ingen fejl indtil videre."),
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
    toast(tr("Der er intet at rydde."));
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
  setMsg(tr("Startet forfra. Fortryd bringer dine tal tilbage."), "");
  renderAll();
  saveCurrent();
}
async function shareCode() {
  const url = !FRAMED && /^https?:/.test(location.protocol) ? location.origin + location.pathname + "#" + P.code : null;
  const text = "Suguru · " + BAND[pBand(P)] + " " + levelValue(P) + " · " + P.cols + "×" + P.rows + "\n" + P.code;
  if (url && navigator.share) {
    try {
      await navigator.share({ title: "Suguru", text, url });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url || P.code);
    toast(url ? tr("Link kopieret") : tr("Koden er kopieret"));
  } catch (e) {
    showRating();
    toast(tr("Kunne ikke kopiere. Markér koden her."));
  }
}

// ---------- Om opgaven (sværhedsgrad)
function showRating() {
  const r = P.rating;
  const hardestIdx = r.uses.reduce((best, u, i) => (u > 0 ? i : best), -1);
  const items = E.TECH.map((t, i) => {
    const used = r.uses[i] > 0;
    return (
      `<li class="${used ? "" : "unused"} ${i === hardestIdx ? "hardest" : ""}"><span class="lv">${t.level}</span><span class="name">${t.label}</span>` +
      `<span class="n">${used ? "×" + r.uses[i] : "–"}</span><span class="d">${t.desc}</span></li>`
    );
  }).join("");
  openSheet(
    `<div class="rating"><h2>${tr("Hvorfor {v}?", { v: levelValue(P) })}</h2>` +
      profileHtml(P.grade) +
      `<h3>${tr("Opgavekode")}</h3><p>${tr("Koden indeholder selve opgaven. Den kan hentes her i appen og i Java-programmet.")}</p><div class="codebox">${P.code}</div>` +
      `<div class="actions row2"><button class="secondary" type="button" id="rCopy">${tr("Kopiér kode")}</button><button class="secondary" type="button" id="rShare">${tr("Del")}</button></div>` +
      `<h3>${tr("Teknikker")}</h3><p>${tr("De teknikker en løser skal bruge, og hvor mange gange. De bestemmer ikke længere tallet alene.")}</p><ul class="tech">${items}</ul>` +
      `<div class="actions"><button class="primary big" type="button" id="rClose">Luk</button></div></div>`,
    (b) => {
      b.querySelector("#rClose").onclick = closeSheet;
      b.querySelector("#rCopy").onclick = async () => {
        try {
          await navigator.clipboard.writeText(P.code);
          toast(tr("Koden er kopieret"));
        } catch (e) {
          toast(tr("Markér koden og kopiér den"));
        }
      };
      b.querySelector("#rShare").onclick = () => {
        closeSheet();
        shareCode();
      };
    },
  );
}
// Indsatsen skridt for skridt gennem hele løsningen: én spids eller et plateau?
function effortStrip(g) {
  if (!g.series || g.tech === 1) return "";
  const n = g.series.length,
    W = 320,
    H = 54,
    bw = W / n,
    mx = Math.max(3, ...g.series);
  let s = `<svg class="trend" viewBox="0 0 ${W} ${H + 14}" role="img" aria-label="${tr("Indsats for hvert skridt i løsningen")}" style="margin:4px 0 2px">`;
  g.series.forEach((e, i) => {
    const h = e ? Math.max(4, (H * e) / mx) : 2,
      top = e && Math.abs(e - g.hard.e) < 0.06;
    s +=
      `<rect x="${(i * bw + 0.5).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${e ? (top ? "var(--stamp)" : "var(--indigo)") : "var(--grid)"}"` +
      ` data-tip="${tr("Skridt {k} af {n}:", { k: i + 1, n })} ${e ? tr("indsats {x}", { x: dec(e) }) : tr("direkte tal")}"/>`;
  });
  return (
    s +
    `<text x="0" y="${H + 11}" font-size="10" fill="var(--mute)">${tr("første tal")}</text><text x="${W}" y="${H + 11}" font-size="10" text-anchor="end" fill="var(--mute)">${tr("sidste tal")}</text></svg>` +
    `<p style="font-size:12.5px;color:var(--mute);margin:0 0 10px">${tr("Hver streg er ét tal i løsningen. Høje streger er tunge skridt, den røde er det tungeste, de grå er direkte tal.")}</p>`
  );
}
// Hvorfor netop dette mønster er let eller svært at få øje på
function visText(h) {
  const v = h.vis,
    f = (x) => (x < -0.04 ? "−" : "+") + dec(Math.abs(x)),
    parts = [];
  parts.push(tr("mønstret i sig selv {x}", { x: f(h.base) }));
  if (h.T >= 2 && h.T <= 6)
    parts.push(
      (v.size === 1
        ? tr("1 felt")
        : v.bent
          ? tr("{n} felter om et hjørne", { n: v.size })
          : tr("{n} felter på linje", { n: v.size })) +
        " " +
        f(h.shapeT),
    );
  const pctF = Math.round(v.fill * 100);
  const area = pctF >= 60 ? tr("tæt udfyldt område") : pctF >= 40 ? tr("halvåbent område") : tr("åbent område");
  parts.push(tr("{area} ({pct} % af felterne omkring har tal) {x}", { area, pct: pctF, x: f(h.openT) }));
  parts.push(
    v.work === 1
      ? tr("1 tomt felt, hvis muligheder du skal kende, {x}", { x: f(h.workT) })
      : tr("{n} tomme felter, hvis muligheder du skal kende, {x}", { n: v.work, x: f(h.workT) }),
  );
  return tr("Fordelt: {parts}.", { parts: parts.join("; ") });
}
function profileHtml(g) {
  if (!g || !g.hard) return "";
  const f = (v) => dec(v),
    h = g.hard,
    pct = Math.round(h.progress * 100);
  const bar = Array.from({ length: 9 }, (_, i) => `<i class="${i < g.band ? "on" : ""}"></i>`).join("");
  const row = (num, lead, text) => `<dt>${num}</dt><dd>${lead ? "<b>" + lead + "</b> " : ""}${text}</dd>`;
  let rows;
  if (g.tech === 1) {
    const way = g.avgOpts < 2 ? tr("Smal vej.") : g.avgOpts < 3.5 ? tr("Nogle muligheder.") : tr("Mange muligheder.");
    rows =
      row(dec(1), tr("Kun enkle træk."), tr("Hvert tal kan findes direkte ud fra tallene i gitteret.")) +
      row(
        "+" + f(g.value - 1),
        way,
        tr("I gennemsnit {n} steder at komme videre fra. Færre steder gør det sværere at få øje på det næste tal.", { n: f(g.avgOpts) }),
      );
  } else {
    const techName = E.TECH[h.T].label;
    const mem =
      h.mem === 0
        ? tr("Intet skal huskes.")
        : (h.mem === 1 ? tr("1 ting skal holdes i hovedet på samme tid") : tr("{n} ting skal holdes i hovedet på samme tid", { n: h.mem })) +
          (h.mem >= 7 ? tr("; her hjælper blyanten.") : h.mem >= 4 ? tr("; det kræver koncentration.") : ".");
    rows =
      row(dec(1), "", tr("Grundtal for et tal, der ses direkte.")) +
      row(
        "+" + f(h.R),
        tr("Genkendelse."),
        tr("Det tungeste skridt er {tech}, {pct} % inde i opgaven.", { tech: esc(techName.toLowerCase()), pct }) + (h.vis ? " " + visText(h) : ""),
      ) +
      row("+" + f(h.memT), tr("Hukommelse."), mem) +
      row("+" + f(h.lenT), tr("Længde."), h.len === 1 ? tr("Ræsonnementet har 1 led.") : tr("Ræsonnementet har {n} led.", { n: h.len })) +
      (h.spot
        ? row("+" + f(h.spot), tr("Overblik."), h.opts <= 1 ? tr("Der var kun ét sted at komme videre.") : tr("Der var kun {n} steder at komme videre.", { n: h.opts }))
        : "") +
      (g.earlyT >= 0.05 ? row("+" + f(g.earlyT), tr("Tidligt."), tr("Det tunge skridt kommer, mens pladen stadig er åben.")) : "") +
      row(`<b>${f(g.peak)}</b>`, tr("Top:"), tr("det tungeste skridt alene.")) +
      row(
        "+" + f(g.loadT),
        tr("Mængde {n} af 10.", { n: g.load }),
        (g.nHard === 1
          ? tr("Det er det eneste skridt, der kræver mere end et direkte tal.")
          : tr("{n} skridt kræver mere end et direkte tal.", { n: g.nHard })) +
          " " +
          tr("Hvert af de øvrige lægger lidt til, og gentagelser af samme teknik tæller mindre og mindre. Tillægget kan højst blive {max}.", { max: dec(1) }),
      );
    if (E.TECH[h.T].level !== g.tech)
      rows += row(
        tr("NB"),
        "",
        tr("Den mest avancerede teknik i opgaven er {tech}, men den er ikke det tungeste skridt her.", { tech: esc(LEVEL_TECH[g.tech]) }),
      );
  }
  return (
    `<div class="decbar" aria-hidden="true">${bar}</div>` +
    `<p>${tr("Tallet er det tungeste skridt (top) plus et tillæg for, hvor mange tunge skridt der er (mængde). Det måler indsats, ikke hvilken teknik der bruges.")}</p>` +
    effortStrip(g) +
    `<dl class="profile">${rows}<dt><b>${f(g.value)}</b></dt><dd><b>${BAND[g.band]}</b>${g.value >= 9.9 ? " " + tr("(skalaen stopper ved {max})", { max: dec(9.9) }) : ""}</dd></dl>` +
    `<p>${tr("Vægtene er tilpasset de første 17 vurderede opgaver. Bliv ved med at svare på »hvordan føltes den?«, så kan de justeres igen.")}</p>`
  );
}

const FELT = [tr("Meget lettere"), tr("Lettere"), tr("Passer"), tr("Sværere"), tr("Meget sværere")];
function showSolved(rec) {
  if (view !== "game") return;
  const st = streaks();
  let record = "";
  if (rec.solved && !rec.hints) {
    const prev = games.filter(
      (g) => g.id !== rec.id && g.solved && !g.hints && g.rows === rec.rows && g.cols === rec.cols && gBand(g) === gBand(rec),
    );
    if (prev.length && rec.ms < Math.min(...prev.map((g) => g.ms)))
      record = `<span class="record">${tr("Ny rekord på {size}, grad {g}", { size: rec.cols + "×" + rec.rows, g: gBand(rec) })}</span>`;
    else if (!prev.length)
      record = `<span class="record">${tr("Første løsning på {size}, grad {g} uden hints", { size: rec.cols + "×" + rec.rows, g: gBand(rec) })}</span>`;
  }
  openSheet(
    `<div class="solved"><div class="bigstamp" aria-hidden="true">解</div><h2>${rec.solved ? tr("Løst!") : tr("Udfyldt")}</h2>` +
      `<p class="sub">${esc(BAND[gBand(rec)])} ${dec(rec.value)} · ${rec.cols}×${rec.rows}${rec.daily ? " · " + tr("Dagens opgave") : ""}${rec.peak != null ? "<br>" + plText(rec) : ""}</p>` +
      `<div class="kpis three"><div class="kpi"><b>${fmt(rec.ms)}</b><span>${tr("Tid")}</span></div><div class="kpi"><b>${rec.hints}</b><span>${rec.hints === 1 ? tr("Hint") : tr("Hints")}</span></div>` +
      `<div class="kpi"><b>${st.current}</b><span>${st.current === 1 ? tr("Dag i træk") : tr("Dage i træk")}</span></div></div>${record}` +
      (rec.solved ? "" : `<p class="sub" style="margin-top:10px">${tr("Løsningen blev vist undervejs, så den tæller ikke som løst.")}</p>`) +
      `<button class="routeline" type="button" id="routeLine">${routeLineHtml(rec)}</button>` +
      `<div id="concLine">${concLineHtml(rec)}</div>` +
      `<p class="feltq">${tr("Hvordan føltes den i forhold til {v}?", { v: dec(rec.value) })}</p><div class="seg felt" id="feltSeg">` +
      FELT.map((t, i) => `<button type="button" data-f="${i - 2}" aria-pressed="false">${t}</button>`).join("") +
      `</div>` +
      `<div class="actions"><button class="primary big" type="button" id="sNew">${tr("Ny opgave")} · ${esc(BAND[ui.level])}</button>` +
      `<div class="actions row2" style="margin:0"><button class="secondary" type="button" id="sStats">${tr("Statistik")}</button><button class="secondary" type="button" id="sHome">${tr("Forside")}</button></div></div></div>`,
    (b) => {
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
          setTimeout(() => showRoute(g), 280);
        }
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
