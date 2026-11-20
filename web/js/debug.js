// Debug-noter: en kort kommentar til et spil, fx "ruteanalysen viser en plade, der aldrig har været der" eller
// "føltes meget sværere end graden". Noten gemmes i spillet (felt dbg) og kommer med i den almindelige eksport.
// Et enkelt spil kan også kopieres som en "debug-pakke" (spil, træk, analyse, noter, version), der kan indsættes i en
// fejlrapport. Knapperne er små og grå, så de ikke forstyrrer.
const APP_BUILD = "2026-11-19";
const NOTE_AREAS = () => [
  ["route", tr("Ruteanalyse")],
  ["grade", tr("Bedømmelse")],
  ["play", tr("Spillet")],
  ["other", tr("Andet")],
];
const noteLink = (area) =>
  `<div class="notelinks"><button class="notelink" type="button" data-area="${area}">${tr("Debug-note")}</button>` +
  `<button class="notelink" type="button" data-copy="1">${tr("Kopiér debug-pakke")}</button></div>`;

// Bind de små links i et ark. g = spillet (null = det igangværende), back = åbn arket igen bagefter
function bindNoteLinks(root, g, back) {
  root.querySelectorAll(".notelink").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.copy) return copyText(JSON.stringify(debugPacket(g)), tr("Debug-pakken er kopieret"));
        closeSheet();
        setTimeout(() => noteSheet(g, b.dataset.area, back), 280);
      }),
  );
}

function noteSheet(g, area = "other", back) {
  const list = g ? g.dbg || [] : meta.dbg || [];
  const df = (s) => new Date(s).toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const areaName = Object.fromEntries(NOTE_AREAS());
  openSheet(
    `<h2>${tr("Debug-note")}</h2><p class="sub">${tr("Skriv hvad der virker forkert. Noten gemmes i spillet og kommer med, når du eksporterer eller kopierer debug-pakken.")}</p>` +
      (list.length
        ? `<ul class="notes">${list.map((n) => `<li><small>${df(n.t)} · ${esc(areaName[n.area] || n.area)}${n.move ? " · " + tr("træk {k}", { k: n.move }) : ""}</small>${esc(n.text)}</li>`).join("")}</ul>`
        : "") +
      `<div class="seg" id="noteArea">${NOTE_AREAS()
        .map(([k, nm]) => `<button type="button" data-a="${k}" aria-pressed="${k === area}">${nm}</button>`)
        .join("")}</div>` +
      `<textarea class="io note" id="noteText" rows="4" placeholder="${esc(tr("Fx: Træk 12 viser 4 i c3, men feltet var tomt."))}"></textarea>` +
      `<label class="noteMove">${tr("Træk nr. (valgfrit)")} <input id="noteMove" type="number" inputmode="numeric" min="1" max="200"></label>` +
      `<div class="actions row2"><button class="secondary" type="button" id="noteCancel">${tr("Annuller")}</button><button class="primary" type="button" id="noteSave">${tr("Gem note")}</button></div>`,
    (b) => {
      let a = area;
      b.querySelectorAll("#noteArea button").forEach(
        (x) =>
          (x.onclick = () => {
            a = x.dataset.a;
            b.querySelectorAll("#noteArea button").forEach((y) => y.setAttribute("aria-pressed", y === x));
          }),
      );
      const done = () => {
        closeSheet();
        if (back) setTimeout(back, 280);
      };
      b.querySelector("#noteCancel").onclick = done;
      b.querySelector("#noteSave").onclick = () => {
        const text = b.querySelector("#noteText").value.trim();
        if (!text) return toast(tr("Skriv noten først"));
        const mv = parseInt(b.querySelector("#noteMove").value, 10);
        const note = { t: new Date().toISOString(), area: a, text, build: APP_BUILD, view };
        if (mv > 0) note.move = mv;
        if (g) {
          (g.dbg = g.dbg || []).push(note);
          saveGames();
        } else {
          (meta.dbg = meta.dbg || []).push(note);
          saveCurrent();
        }
        toast(tr("Noten er gemt"));
        done();
      };
      setTimeout(() => b.querySelector("#noteText").focus(), 320);
    },
  );
}

// Alt om ét spil, der er nyttigt til fejlfinding. g = null: det igangværende spil.
function debugPacket(g) {
  const base = {
    app: "suguru",
    kind: "debug",
    build: APP_BUILD,
    exported: new Date().toISOString(),
    lang: LANG,
    ua: navigator.userAgent,
    settings: { liveErrors: settings.liveErrors, anyDigit: settings.anyDigit, confirm: settings.confirm, timer: settings.timer },
  };
  if (g) return Object.assign(base, { game: g });
  return Object.assign(base, {
    current: { code: P.code, grade: P.grade, rating: P.rating, entries, pencil: notes, elapsed: elapsed(), solved, meta },
  });
}
async function copyText(text, ok) {
  try {
    await navigator.clipboard.writeText(text);
    toast(ok || tr("Kopieret"));
  } catch (e) {
    // Reserve: vis teksten, så den kan markeres og kopieres manuelt
    openSheet(
      `<h2>${tr("Kopiér")}</h2><textarea class="io" id="cpText" readonly></textarea><div class="actions"><button class="primary" type="button" id="cpClose">${tr("Luk")}</button></div>`,
      (b) => {
        b.querySelector("#cpText").value = text;
        b.querySelector("#cpText").select();
        b.querySelector("#cpClose").onclick = closeSheet;
      },
    );
  }
}
// Alle noter samlet (til indstillinger): spil-kontekst + noterne
function allNotes() {
  return games
    .filter((g) => g.dbg && g.dbg.length)
    .map((g) => ({ id: g.id, end: g.end, code: g.code, value: g.value, size: g.cols + "x" + g.rows, solved: g.solved, notes: g.dbg }));
}
