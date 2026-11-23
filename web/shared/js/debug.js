// Debug notes: a short comment on a game, e.g. "the route analysis shows a board that never existed" or
// "felt much harder than the grade". The note is stored in the game (field dbg) and comes along in the ordinary export.
// A single game can also be copied as a "debug package" (game, moves, analysis, notes, version) that can be pasted into a
// bug report. The buttons are small and grey, so they do not get in the way.
const APP_BUILD = "2026-11-23c";
const NOTE_AREAS = () => [
  ["route", tr("Route analysis")],
  ["grade", tr("Grading")],
  ["play", tr("Game")],
  ["other", tr("Other")],
];
const noteLink = (area) =>
  `<div class="notelinks"><button class="notelink" type="button" data-area="${area}">${tr("Debug note")}</button>` +
  `<button class="notelink" type="button" data-copy="1">${tr("Copy debug packet")}</button></div>`;

// Bind the small links in a sheet. g = the game (null = the one in progress), back = open the sheet again afterwards
function bindNoteLinks(root, g, back) {
  root.querySelectorAll(".notelink").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.copy) return copyText(JSON.stringify(debugPacket(g)), tr("Debug packet copied"));
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
    `<h2>${tr("Debug note")}</h2><p class="sub">${tr("Write what seems wrong. The note is saved with the game and included when you export or copy the debug packet.")}</p>` +
      (list.length
        ? `<ul class="notes">${list.map((n) => `<li><small>${df(n.t)} · ${esc(areaName[n.area] || n.area)}${n.move ? " · " + tr("move {k}", { k: n.move }) : ""}</small>${esc(n.text)}</li>`).join("")}</ul>`
        : "") +
      `<div class="seg" id="noteArea">${NOTE_AREAS()
        .map(([k, nm]) => `<button type="button" data-a="${k}" aria-pressed="${k === area}">${nm}</button>`)
        .join("")}</div>` +
      `<textarea class="io note" id="noteText" rows="4" placeholder="${esc(tr("E.g.: Move 12 shows 4 in c3, but the cell was empty."))}"></textarea>` +
      `<label class="noteMove">${tr("Move no. (optional)")} <input id="noteMove" type="number" inputmode="numeric" min="1" max="200"></label>` +
      `<div class="actions row2"><button class="secondary" type="button" id="noteCancel">${tr("Cancel")}</button><button class="primary" type="button" id="noteSave">${tr("Save note")}</button></div>`,
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
        if (!text) return toast(tr("Write the note first"));
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
        toast(tr("Note saved"));
        done();
      };
      setTimeout(() => b.querySelector("#noteText").focus(), 320);
    },
  );
}

// Everything about one game that is useful for debugging. g = null: the game in progress.
function debugPacket(g) {
  const base = {
    app: APP.id,
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
    toast(ok || tr("Copied"));
  } catch (e) {
    // Fallback: show the text so it can be selected and copied by hand
    openSheet(
      `<h2>${tr("Copy")}</h2><textarea class="io" id="cpText" readonly></textarea><div class="actions"><button class="primary" type="button" id="cpClose">${tr("Close")}</button></div>`,
      (b) => {
        b.querySelector("#cpText").value = text;
        b.querySelector("#cpText").select();
        b.querySelector("#cpClose").onclick = closeSheet;
      },
    );
  }
}
// All notes together (for the settings): game context + the notes
function allNotes() {
  return games
    .filter((g) => g.dbg && g.dbg.length)
    // the moves ([cell, number, time in ms]) come along, so a note about a move can be recreated exactly without a full export
    .map((g) => ({
      id: g.id,
      end: g.end,
      code: g.code,
      value: g.value,
      size: g.cols + "x" + g.rows,
      solved: g.solved,
      notes: g.dbg,
      moves: g.moves ? g.moves.map((m) => [m.c, m.v, m.t]) : null,
    }));
}
