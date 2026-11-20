// Indstillinger og eksport/import af statistik.

function renderSettings() {
  const sw = (key, label, sub) =>
    `<div class="set"><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}` +
    `<button class="switch" type="button" role="switch" aria-checked="${!!settings[key]}" data-key="${key}" aria-label="${esc(label)}"></button></div>`;
  $("setBody").innerHTML =
    `<h3 class="sec">${tr("Sprog")}</h3><div class="group"><div class="set"><span>${tr("Appens sprog")}</span><div class="seg" id="langSeg">` +
    [["system", tr("Automatisk")], ...Object.entries(LANGS)]
      .map(([k, name]) => `<button type="button" data-l="${k}" aria-pressed="${(settings.lang || "system") === k}">${name}</button>`)
      .join("") +
    `</div></div></div>` +
    `<h3 class="sec">${tr("Udseende")}</h3><div class="group"><div class="set"><span>${tr("Tema")}</span><div class="seg" id="themeSeg">` +
    [
      ["system", tr("System")],
      ["light", tr("Lys")],
      ["dark", tr("Mørk")],
    ]
      .map(([k, name]) => `<button type="button" data-t="${k}" aria-pressed="${settings.theme === k}">${name}</button>`)
      .join("") +
    `</div></div>${sw("timer", tr("Vis ur"), tr("Tiden måles stadig til statistikken."))}</div>` +
    `<h3 class="sec">${tr("Hjælp under spillet")}</h3><div class="group">${sw("same", tr("Fremhæv ens tal"), tr("Alle felter med det valgte tal farves."))}` +
    `${sw("peers", tr("Fremhæv naboer og region"), tr("Felter, der ikke må have samme tal."))}` +
    `${sw("confirm", tr("Spørg før et tal overskrives"), tr("Et andet tal skal trykkes to gange."))}` +
    `${sw("anyDigit", tr("Tillad alle tal i alle felter"), tr("Også tal, der er større end regionen. De tæller som regelbrud."))}` +
    `<div class="set stack"><span>${tr("Blyant")}</span><small>${tr("Hvilken grad du ser, og som nye opgaver vælges efter. Uden blyant er tripler, kæder og hvis-så sværere, fordi mulighederne skal huskes. Statistikken bruger altid den grad, der passer til, om du faktisk brugte blyant i spillet.")}</small><div class="seg" id="penSeg">` +
    [
      ["med", tr("Med blyant")],
      ["uden", tr("Uden blyant")],
    ]
      .map(([k, name]) => `<button type="button" data-p="${k}" aria-pressed="${(settings.pencil === "med" ? "med" : "uden") === k}">${name}</button>`)
      .join("") +
    `</div></div>` +
    `<div class="set stack"><span>${tr("Fejl under spillet")}</span><small>${tr("Regelbrud er ens tal, der rører hinanden, to ens tal i en region eller et tal større end regionen. Tal, der kun er forkerte i forhold til løsningen, vises aldrig af sig selv. «Tjek fejl» viser altid alle fejl.")}</small><div class="seg" id="errSeg">` +
    [
      ["live", tr("Vis regelbrud med det samme")],
      ["end", tr("Skjul til pladen er fuld")],
    ]
      .map(([k, name]) => `<button type="button" data-e="${k}" aria-pressed="${(settings.liveErrors === false ? "end" : "live") === k}">${name}</button>`)
      .join("") +
    `</div></div></div>` +
    `<h3 class="sec">${tr("Data")}</h3><div class="menu">` +
    menuItem("dExport", '<path d="M12 3v12M8 11l4 4 4-4M5 21h14"/>', tr("Eksportér statistik"), tr("{n} spil", { n: games.length })) +
    menuItem("dImport", '<path d="M12 21V9M8 13l4-4 4 4M5 3h14"/>', tr("Importér statistik")) +
    menuItem(
      "dStorage",
      '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
      tr("Lagerplads"),
      kb(storageInfo().total) + " · " + (games.filter((g) => g.moves).length === 1 ? tr("ruteanalyse for 1 spil") : tr("ruteanalyse for {n} spil", { n: games.filter((g) => g.moves).length })),
    ) +
    (allNotes().length
      ? menuItem("dNotes", '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13 7l4 4"/>', tr("Kopiér debug-noter"), tr("{n} spil med noter", { n: allNotes().length }))
      : "") +
    menuItem("dReset", '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', tr("Nulstil statistik"), "", "danger") +
    `</div>` +
    `<p class="about">${tr("Data gemmes kun på denne enhed og i denne browser. Brug eksport og import for at flytte den.")}</p>` +
    `<p class="about">Suguru ${APP_VERSION} · ${STANDALONE ? tr("kører som app") : FRAMED ? tr("kører i Claude") : tr("kører i browseren")} · ${tr("opgavekoder (SU1) virker også i Java-versionen.")}</p>`;
  // Sproget skiftes ved at genindlæse siden, så alle tekster (også dem, der allerede er lavet) kommer på det nye sprog
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
    $("dNotes").onclick = () => copyText(JSON.stringify({ app: "suguru", kind: "debug-notes", build: APP_BUILD, exported: new Date().toISOString(), games: allNotes() }), tr("Noterne er kopieret"));
  $("dReset").onclick = () =>
    confirmSheet({
      title: tr("Nulstil statistik?"),
      text: tr("Alle {n} gemte spil slettes fra denne enhed. Det kan ikke fortrydes.", { n: games.length }),
      ok: tr("Slet statistik"),
      onOk: () => {
        games = [];
        saveGames(true);
        renderSettings();
        toast(tr("Statistikken er nulstillet"));
      },
    });
}
const kb = (chars) => (chars >= 1024 * 1024 ? dec(chars / 1024 / 1024, 1) + " MB" : Math.max(1, Math.round(chars / 1024)) + " KB");
// Lagerplads: vis hvad der fylder, og ryd den fulde ruteanalyse for ældre spil. Statistikken bevares.
// Browsere giver 2,5-5 MB (tegn) til denne slags data. Vi regner forsigtigt med den laveste værdi (fx Safari på iPhone).
const STORAGE_LIMIT = 2.5 * 1024 * 1024;
// Forsigtigt skøn over, hvor mange spil der er plads til endnu: den ukomprimerede del er højst ca. 300 spil + 40 med fuld
// ruteanalyse; resten ligger i arkivet med den størrelse pr. spil, arkivet har nu (ellers ca. 0,2 KB).
function roomForGames(si) {
  const perArch = ARCH_N >= 20 ? ARCH_LEN / ARCH_N : 200;
  const recentMax = ARCH_MAX * 1300 + 40 * 5300;
  return Math.max(0, Math.floor((STORAGE_LIMIT - (si.total - si.history) - ARCH_LEN - recentMax) / perArch));
}
function storageSheet() {
  const si = storageInfo();
  const cur = settings.keepMoves ?? 40;
  const opts = [40, 20, 10, 1]; // det seneste spil beholdes altid, så analysen efter løsning virker
  const pct = Math.min(100, Math.round((100 * si.total) / STORAGE_LIMIT));
  const row = (label, v, sub) => `<tr><td>${label}${sub ? `<br><small style="color:var(--mute)">${sub}</small>` : ""}</td><td style="text-align:right">${kb(v)}</td></tr>`;
  openSheet(
    `<h2>${tr("Lagerplads")}</h2>` +
      `<p class="sub">${tr("Appen bruger {size}. Browsere giver mindst ca. 2,5 MB (nogle 5 MB), så det er højst {pct} % af pladsen.", { size: kb(si.total), pct })}</p>` +
      `<div class="stbar"><i style="width:${Math.max(1, pct)}%"></i></div>` +
      `<p class="sub"><b>${tr("Plads til ca. {n} spil mere.", { n: roomForGames(si).toLocaleString(LOCALE) })}</b> ${tr("Forsigtigt skøn.")}</p>` +
      `<table class="data">` +
      row(tr("Nyeste spil"), si.history, tr("{n} spil", { n: games.length - ARCH_N })) +
      row(tr("heraf fuld ruteanalyse"), si.moves, tr("alle træk for {n} spil", { n: si.nMoves })) +
      row(tr("Komprimeret arkiv"), ARCH_LEN, ARCH_N ? tr("{n} ældre spil, ca. {s} pr. spil", { n: ARCH_N, s: Math.round(ARCH_LEN / Math.max(1, ARCH_N)) + " B" }) : tr("tomt indtil du har over {n} spil", { n: ARCH_MAX })) +
      row(tr("Igangværende spil og indstillinger"), si.total - si.history - (si.keys.archive || 0)) +
      `</table>` +
      `<p class="caveat">${tr("Ældre spil flyttes automatisk til arkivet, når du har over {a} spil. De komprimeres uden at miste noget, statistikken bruger.", { a: ARCH_MAX })}</p>` +
      `<h3>${tr("Behold fuld ruteanalyse for")}</h3>` +
      `<div class="seg" id="keepSeg">${opts.map((k) => `<button type="button" data-k="${k}" aria-pressed="${k === cur}">${k === 1 ? tr("kun seneste") : tr("{n} spil", { n: k })}</button>`).join("")}</div>` +
      `<p class="sub" id="keepInfo"></p>` +
      `<p class="caveat">${tr("Det, der ryddes, er trækkene bag den fulde ruteanalyse: grafen, pladerne og »det vigtigste fra spillet«. Alle tal i statistikken bevares, også fokusområdet, fremgangen, din tidskurve og koncentrationen. Nye spil gemmes stadig med fuld analyse, og de ældste ryddes løbende.")}</p>` +
      `<div class="actions row2"><button class="secondary" type="button" id="stClose">${tr("Luk")}</button><button class="primary" type="button" id="stTrim">${tr("Gem og ryd op")}</button></div>`,
    (b) => {
      let k = cur;
      const info = () => {
        const freed = si.moves - si.keepCost(k);
        const n = Math.max(0, si.nMoves - k);
        b.querySelector("#keepInfo").textContent = n
          ? tr("Rydder ruteanalysen for {n} ældre spil og frigør ca. {size}.", { n, size: kb(freed) })
          : tr("Intet at rydde lige nu.");
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
        toast(n ? tr("Ruteanalysen er ryddet for {n} spil. Statistikken er bevaret.", { n }) : tr("Gemt"));
        renderSettings();
      };
    },
  );
}
function exportData() {
  const data = JSON.stringify({ app: "suguru", v: 1, exported: new Date().toISOString(), history: games });
  openSheet(
    `<h2>${tr("Eksportér statistik")}</h2><p>${tr("Kopiér teksten, og indsæt den under »Importér« på den anden enhed eller version.")}</p>` +
      `<textarea class="io" id="ioText" readonly></textarea><div class="actions row2"><button class="primary" type="button" id="ioCopy">${tr("Kopiér")}</button>` +
      (FRAMED ? "" : `<button class="secondary" type="button" id="ioFile">${tr("Gem som fil")}</button>`) +
      `</div><div class="actions"><button class="secondary" type="button" id="ioClose">${tr("Luk")}</button></div>`,
    (b) => {
      b.querySelector("#ioText").value = data;
      b.querySelector("#ioCopy").onclick = async () => {
        try {
          await navigator.clipboard.writeText(data);
          toast(tr("Kopieret"));
        } catch (e) {
          b.querySelector("#ioText").select();
          toast(tr("Markér og kopiér teksten"));
        }
      };
      if (b.querySelector("#ioFile"))
        b.querySelector("#ioFile").onclick = () => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
          a.download = "suguru-statistik-" + dayKey(new Date()) + ".json";
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
    `<h2>${tr("Importér statistik")}</h2><p>${tr("Indsæt teksten fra en eksport. Spil, du allerede har, bliver ikke talt dobbelt.")}</p>` +
      `<textarea class="io" id="ioText" placeholder='{"app":"suguru", …}'></textarea>` +
      `<div class="actions"><button class="primary big" type="button" id="ioGo">${tr("Importér")}</button><button class="secondary" type="button" id="ioClose">${tr("Annullér")}</button></div>`,
    (b) => {
      b.querySelector("#ioGo").onclick = () => {
        let d;
        try {
          d = JSON.parse(b.querySelector("#ioText").value);
        } catch (e) {
          toast(tr("Teksten kunne ikke læses"));
          return;
        }
        if (!d || d.app !== "suguru" || !Array.isArray(d.history)) {
          toast(tr("Det er ikke en Suguru-eksport"));
          return;
        }
        const have = new Set(games.map((g) => g.id));
        const add = d.history.filter((g) => g && g.id && !have.has(g.id) && typeof g.ms === "number");
        games = games.concat(add).sort((a, b2) => (a.end < b2.end ? -1 : 1));
        ARCH_N = 0; // rækkefølgen kan være ændret: skriv det hele om
        saveGames(true);
        closeSheet();
        renderSettings();
        toast(add.length ? tr("{n} spil importeret", { n: add.length }) : tr("Ingen nye spil at importere"));
      };
      b.querySelector("#ioClose").onclick = closeSheet;
    },
  );
}
