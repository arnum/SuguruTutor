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
    `${sw("confirm", tr("Spørg før et tal overskrives"), tr("Et andet tal skal trykkes to gange."))}</div>` +
    `<h3 class="sec">${tr("Data")}</h3><div class="menu">` +
    menuItem("dExport", '<path d="M12 3v12M8 11l4 4 4-4M5 21h14"/>', tr("Eksportér statistik"), tr("{n} spil", { n: games.length })) +
    menuItem("dImport", '<path d="M12 21V9M8 13l4-4 4 4M5 3h14"/>', tr("Importér statistik")) +
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
          b.setAttribute("aria-checked", settings[b.dataset.key]);
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
  $("dReset").onclick = () =>
    confirmSheet({
      title: tr("Nulstil statistik?"),
      text: tr("Alle {n} gemte spil slettes fra denne enhed. Det kan ikke fortrydes.", { n: games.length }),
      ok: tr("Slet statistik"),
      onOk: () => {
        games = [];
        saveGames();
        renderSettings();
        toast(tr("Statistikken er nulstillet"));
      },
    });
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
        saveGames();
        closeSheet();
        renderSettings();
        toast(add.length ? tr("{n} spil importeret", { n: add.length }) : tr("Ingen nye spil at importere"));
      };
      b.querySelector("#ioClose").onclick = closeSheet;
    },
  );
}
