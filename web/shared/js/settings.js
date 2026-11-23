// Settings and export/import of statistics.

// The page's own address (without index.html, a puzzle code or anything else after it), so others can open the game. null in Claude's
// preview, where the address cannot be shared.
function appUrl() {
  if (FRAMED || !/^https?:$/.test(location.protocol)) return null;
  return location.origin + location.pathname.replace(/index\.html$/, "");
}
function shareSection() {
  const url = appUrl(),
    name = document.title || APP.name;
  const link = '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>';
  return (
    `<h3 class="sec">${tr("Share the game")}</h3>` +
    (url
      ? `<div class="menu">` +
        menuItem("dLink", link, tr("Copy link to {name}", { name: esc(name) }), `<span class="url">${esc(url.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</span>`) +
        (navigator.share ? menuItem("dShare", IC.share, tr("Share {name} with others", { name: esc(name) })) : "") +
        `</div>`
      : `<p class="about">${tr("The link can only be shared from the page itself, not from the preview in Claude.")}</p>`)
  );
}
function bindShare() {
  const url = appUrl(),
    name = document.title || APP.name;
  const c = $("dLink");
  if (c) c.onclick = () => copyText(url, tr("Link copied"));
  const s = $("dShare");
  if (s)
    s.onclick = async () => {
      try {
        await navigator.share({ title: name, url });
      } catch (e) {
        if (e.name !== "AbortError") copyText(url, tr("Link copied"));
      }
    };
}

function renderSettings() {
  const sw = (key, label, sub) =>
    `<div class="set"><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}` +
    `<button class="switch" type="button" role="switch" aria-checked="${!!settings[key]}" data-key="${key}" aria-label="${esc(label)}"></button></div>`;
  $("setBody").innerHTML =
    `<h3 class="sec">${tr("Language")}</h3><div class="group"><div class="set"><span>${tr("App language")}</span><div class="seg" id="langSeg">` +
    [["system", tr("Automatic")], ...Object.entries(LANGS)]
      .map(([k, name]) => `<button type="button" data-l="${k}" aria-pressed="${(settings.lang || "system") === k}">${name}</button>`)
      .join("") +
    `</div></div></div>` +
    `<h3 class="sec">${tr("Appearance")}</h3><div class="group"><div class="set"><span>${tr("Theme")}</span><div class="seg" id="themeSeg">` +
    [
      ["system", tr("System")],
      ["light", tr("Light")],
      ["dark", tr("Dark")],
    ]
      .map(([k, name]) => `<button type="button" data-t="${k}" aria-pressed="${settings.theme === k}">${name}</button>`)
      .join("") +
    `</div></div>${sw("timer", tr("Show timer"), tr("Time is still measured for the statistics."))}</div>` +
    `<h3 class="sec">${tr("Help while playing")}</h3><div class="group">${sw("same", tr("Highlight matching numbers"), tr("All cells with the selected number are coloured."))}` +
    `${sw("peers", GAME.peersLabel, tr("Cells that cannot hold the same number."))}` +
    `${sw("confirm", tr("Ask before overwriting a number"), tr("Tap a different number twice to change it."))}` +
    (GAME.anyDigit ? `${sw("anyDigit", tr("Allow all numbers in all cells"), GAME.anyDigit)}` : "") +
    `<div class="set stack"><span>${tr("Pencil")}</span><small>${tr("Which grade you see, and which new puzzles are chosen by. Without pencil, triples, chains and what-ifs are harder because the options must be remembered. The statistics always use the grade that fits whether you actually used the pencil in the game.")}</small><div class="seg" id="penSeg">` +
    [
      ["med", tr("With pencil")],
      ["uden", tr("Without pencil")],
    ]
      .map(([k, name]) => `<button type="button" data-p="${k}" aria-pressed="${(settings.pencil === "med" ? "med" : "uden") === k}">${name}</button>`)
      .join("") +
    `</div></div>` +
    `<div class="set stack"><span>${tr("Errors during play")}</span><small>${GAME.ruleText}</small><div class="seg" id="errSeg">` +
    [
      ["live", tr("Show rule breaks right away")],
      ["end", tr("Hide until the board is full")],
    ]
      .map(([k, name]) => `<button type="button" data-e="${k}" aria-pressed="${(settings.liveErrors === false ? "end" : "live") === k}">${name}</button>`)
      .join("") +
    `</div></div></div>` +
    `<h3 class="sec">${tr("Data")}</h3><div class="menu">` +
    menuItem("dExport", '<path d="M12 3v12M8 11l4 4 4-4M5 21h14"/>', tr("Export statistics"), tr("{n} games", { n: games.length })) +
    menuItem("dImport", '<path d="M12 21V9M8 13l4-4 4 4M5 3h14"/>', tr("Import statistics")) +
    menuItem(
      "dStorage",
      '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
      tr("Storage"),
      kb(storageInfo().total) + " · " + (games.filter((g) => g.moves).length === 1 ? tr("route analysis for 1 game") : tr("route analysis for {n} games", { n: games.filter((g) => g.moves).length })),
    ) +
    (allNotes().length
      ? menuItem("dNotes", '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13 7l4 4"/>', tr("Copy debug notes"), tr("{n} games with notes", { n: allNotes().length }))
      : "") +
    menuItem("dReset", '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', tr("Reset statistics"), "", "danger") +
    `</div>` +
    shareSection() +
    `<p class="about">${tr("Data is only stored on this device and in this browser. Use export and import to move it.")}</p>` +
    `<p class="about">${APP.name} ${APP_VERSION} · ${STANDALONE ? tr("running as an app") : FRAMED ? tr("running in Claude") : tr("running in the browser")}${GAME.aboutNote ? " · " + GAME.aboutNote : ""}</p>`;
  bindShare();
  // The language is switched by reloading the page, so all texts (also those already made) come in the new language
  $("langSeg")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if ((settings.lang || "system") === b.dataset.l) return;
          settings.lang = b.dataset.l;
          saveSettings();
          saveCurrent();
          location.reload();
        }),
    );
  $("setBody")
    .querySelectorAll(".switch")
    .forEach(
      (b) =>
        (b.onclick = () => {
          settings[b.dataset.key] = !settings[b.dataset.key];
          saveSettings();
          if (b.dataset.key === "anyDigit" && P) renderPad();
          b.setAttribute("aria-checked", settings[b.dataset.key]);
        }),
    );
  $("penSeg")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          settings.pencil = b.dataset.p;
          saveSettings();
          $("penSeg")
            .querySelectorAll("button")
            .forEach((x) => x.setAttribute("aria-pressed", x === b));
          if (P) {
            renderStatus();
            renderPad();
          }
        }),
    );
  $("errSeg")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          settings.liveErrors = b.dataset.e === "live";
          saveSettings();
          $("errSeg")
            .querySelectorAll("button")
            .forEach((x) => x.setAttribute("aria-pressed", x === b));
          if (P) renderGrid();
        }),
    );
  $("themeSeg")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          settings.theme = b.dataset.t;
          saveSettings();
          applyTheme();
          renderSettings();
        }),
    );
  $("dExport").onclick = exportData;
  $("dImport").onclick = importData;
  $("dStorage").onclick = storageSheet;
  if ($("dNotes"))
    $("dNotes").onclick = () => copyText(JSON.stringify({ app: APP.id, kind: "debug-notes", build: APP_BUILD, exported: new Date().toISOString(), games: allNotes() }), tr("Notes copied"));
  $("dReset").onclick = () =>
    confirmSheet({
      title: tr("Reset statistics?"),
      text: tr("All {n} saved games will be deleted from this device. This cannot be undone.", { n: games.length }),
      ok: tr("Delete statistics"),
      onOk: () => {
        games = [];
        saveGames(true);
        renderSettings();
        toast(tr("Statistics have been reset"));
      },
    });
}
const kb = (chars) => (chars >= 1024 * 1024 ? dec(chars / 1024 / 1024, 1) + " MB" : Math.max(1, Math.round(chars / 1024)) + " KB");
// Storage: show what takes up space, and clear the full route analysis for older games. The statistics are kept.
// Browsers give 2.5-5 MB (characters) to this kind of data. We cautiously count on the lowest value (e.g. Safari on iPhone).
const STORAGE_LIMIT = 2.5 * 1024 * 1024;
// A cautious estimate of how many more games there is room for: the uncompressed part is at most about 300 games + 40 with the full
// route analysis; the rest is in the archive with the size per game the archive has now (otherwise about 0.2 KB).
function roomForGames(si) {
  const perArch = ARCH_N >= 20 ? ARCH_LEN / ARCH_N : 200;
  const recentMax = ARCH_MAX * 1300 + 40 * 5300;
  return Math.max(0, Math.floor((STORAGE_LIMIT - (si.total - si.history) - ARCH_LEN - recentMax) / perArch));
}
function storageSheet() {
  const si = storageInfo();
  const cur = settings.keepMoves ?? 40;
  const opts = [40, 20, 10, 1]; // the latest game is always kept, so the analysis after solving works
  const pct = Math.min(100, Math.round((100 * si.total) / STORAGE_LIMIT));
  const row = (label, v, sub) => `<tr><td>${label}${sub ? `<br><small style="color:var(--mute)">${sub}</small>` : ""}</td><td style="text-align:right">${kb(v)}</td></tr>`;
  openSheet(
    `<h2>${tr("Storage")}</h2>` +
      `<p class="sub">${tr("The app uses {size}. Browsers allow at least about 2.5 MB (some 5 MB), so that is at most {pct}% of the space.", { size: kb(si.total), pct })}</p>` +
      `<div class="stbar"><i style="width:${Math.max(1, pct)}%"></i></div>` +
      `<p class="sub"><b>${tr("Room for about {n} more games.", { n: roomForGames(si).toLocaleString(LOCALE) })}</b> ${tr("A cautious estimate.")}</p>` +
      `<table class="data">` +
      row(tr("Newest games"), si.history, tr("{n} games", { n: games.length - ARCH_N })) +
      row(tr("of which full route analysis"), si.moves, tr("all moves for {n} games", { n: si.nMoves })) +
      row(tr("Compressed archive"), ARCH_LEN, ARCH_N ? tr("{n} older games, about {s} per game", { n: ARCH_N, s: Math.round(ARCH_LEN / Math.max(1, ARCH_N)) + " B" }) : tr("empty until you have over {n} games", { n: ARCH_MAX })) +
      row(tr("Current game and settings"), si.total - si.history - (si.keys.archive || 0)) +
      `</table>` +
      `<p class="caveat">${tr("Older games move to the archive automatically once you have over {a} games. They are compressed without losing anything the statistics use.", { a: ARCH_MAX })}</p>` +
      `<h3>${tr("Keep full route analysis for")}</h3>` +
      `<div class="seg" id="keepSeg">${opts.map((k) => `<button type="button" data-k="${k}" aria-pressed="${k === cur}">${k === 1 ? tr("latest only") : tr("{n} games", { n: k })}</button>`).join("")}</div>` +
      `<p class="sub" id="keepInfo"></p>` +
      `<p class="caveat">${tr("What is cleared is the moves behind the full route analysis: the chart, the boards and the “key takeaway”. All numbers in the statistics are kept, including the focus area, progress, your time curve and concentration. New games are still saved with full analysis, and the oldest are cleared as you go.")}</p>` +
      `<div class="actions row2"><button class="secondary" type="button" id="stClose">${tr("Close")}</button><button class="primary" type="button" id="stTrim">${tr("Save and clean up")}</button></div>`,
    (b) => {
      let k = cur;
      const info = () => {
        const freed = si.moves - si.keepCost(k);
        const n = Math.max(0, si.nMoves - k);
        b.querySelector("#keepInfo").textContent = n
          ? tr("Clears the route analysis for {n} older games and frees about {size}.", { n, size: kb(freed) })
          : tr("Nothing to clear right now.");
      };
      info();
      b.querySelectorAll("#keepSeg button").forEach(
        (x) =>
          (x.onclick = () => {
            k = +x.dataset.k;
            b.querySelectorAll("#keepSeg button").forEach((y) => y.setAttribute("aria-pressed", y === x));
            info();
          }),
      );
      b.querySelector("#stClose").onclick = closeSheet;
      b.querySelector("#stTrim").onclick = () => {
        settings.keepMoves = k;
        saveSettings();
        const n = trimMoves(k);
        saveGames();
        closeSheet();
        toast(n ? tr("Route analysis cleared for {n} games. The statistics are kept.", { n }) : tr("Saved"));
        renderSettings();
      };
    },
  );
}
function exportData() {
  const data = JSON.stringify({ app: APP.id, v: 1, exported: new Date().toISOString(), history: games, drills: store.get("drills", {}), practiceLog: store.get("practicelog", []) });
  openSheet(
    `<h2>${tr("Export statistics")}</h2><p>${tr("Copy the text and paste it under “Import” on the other device or version.")}</p>` +
      `<textarea class="io" id="ioText" readonly></textarea><div class="actions row2"><button class="primary" type="button" id="ioCopy">${tr("Copy")}</button>` +
      (FRAMED ? "" : `<button class="secondary" type="button" id="ioFile">${tr("Save as file")}</button>`) +
      `</div><div class="actions"><button class="secondary" type="button" id="ioClose">${tr("Close")}</button></div>`,
    (b) => {
      b.querySelector("#ioText").value = data;
      b.querySelector("#ioCopy").onclick = async () => {
        try {
          await navigator.clipboard.writeText(data);
          toast(tr("Copied"));
        } catch (e) {
          b.querySelector("#ioText").select();
          toast(tr("Select and copy the text"));
        }
      };
      if (b.querySelector("#ioFile"))
        b.querySelector("#ioFile").onclick = () => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
          a.download = APP.id + "-statistik-" + dayKey(new Date()) + ".json";
          document.body.appendChild(a);
          a.click();
          a.remove();
        };
      b.querySelector("#ioClose").onclick = closeSheet;
    },
  );
}
function importData() {
  openSheet(
    `<h2>${tr("Import statistics")}</h2><p>${tr("Paste the text from an export. Games you already have are not counted twice.")}</p>` +
      `<textarea class="io" id="ioText" placeholder='{"app":"suguru", …}'></textarea>` +
      `<div class="actions"><button class="primary big" type="button" id="ioGo">${tr("Import")}</button><button class="secondary" type="button" id="ioClose">${tr("Cancel")}</button></div>`,
    (b) => {
      b.querySelector("#ioGo").onclick = () => {
        let d;
        try {
          d = JSON.parse(b.querySelector("#ioText").value);
        } catch (e) {
          toast(tr("The text could not be read"));
          return;
        }
        if (!d || d.app !== APP.id || !Array.isArray(d.history)) {
          toast(tr("That is not a {name} export", { name: APP.name }));
          return;
        }
        const have = new Set(games.map((g) => g.id));
        const add = d.history.filter((g) => g && g.id && !have.has(g.id) && typeof g.ms === "number");
        games = games.concat(add).sort((a, b2) => (a.end < b2.end ? -1 : 1));
        ARCH_N = 0; // the order may have changed: rewrite all of it
        saveGames(true);
        if (d.drills && typeof d.drills === "object") mergeDrills(d.drills);
        closeSheet();
        renderSettings();
        toast(add.length ? tr("{n} games imported", { n: add.length }) : tr("No new games to import"));
      };
      b.querySelector("#ioClose").onclick = closeSheet;
    },
  );
}
// Practice levels from another device: the logs are joined, and the level is taken from the device that practised last
function mergeDrills(other) {
  const all = Object.assign({}, store.get("drills", {}));
  for (const L of Object.keys(other)) {
    const a = all[L],
      b = other[L];
    if (!b || !Array.isArray(b.log)) continue;
    if (!a) {
      all[L] = b;
      continue;
    }
    const last = (x) => (x.log && x.log.length ? x.log[x.log.length - 1].d : "");
    const seen = new Set(),
      log = (a.log || [])
        .concat(b.log)
        .filter((x) => {
          const k = JSON.stringify(x);
          return seen.has(k) ? false : seen.add(k);
        })
        .sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0))
        .slice(-400);
    const newer = last(b) > last(a) ? b : a;
    all[L] = { lv: newer.lv, days: Object.assign({}, b.days, a.days, newer.days), log };
  }
  store.set("drills", all);
}
