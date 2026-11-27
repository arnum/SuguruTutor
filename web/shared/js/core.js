// Core: constants, storage, game state, navigation between screens, sheets, toast and theme.

const E = engineFactory();
// The game's own lists (GUIDE_IDS, TECH_NAMES_UI, SIZES, LEVEL_INFO, LEVEL_TECH) are in the game's js/game.js.
const BAND = ["", tr("Beginner"), tr("Easy"), tr("Medium"), tr("Hard"), tr("Very hard"), tr("Expert"), tr("Master"), tr("Extreme"), tr("Diabolical")];
const bandOf = (v) => Math.min(9, Math.max(1, Math.floor(+v || 1)));
// Two grades: without pencil (grade.np, the default) and with pencil (grade.value). In the settings you choose which one you see and
// get new puzzles by. For a played game, the grade that matches whether you actually used the pencil is used (see gradeFor).
const noPen = () => settings.pencil !== "med";
// The grade shown for the game in progress: as the setting, but if the game already counts as with pencil (3+ notes), the
// grade with pencil is shown, so the heading always matches what the game will count as. With the setting "with pencil" a
// game counts as with pencil from the start, also before a note is written (decided 25 Nov. 2026).
const gamePen = () =>
  typeof meta !== "undefined" && meta && meta.trial ? false : !noPen() || !!(typeof meta !== "undefined" && meta && (meta.pen || 0) >= PEN_MIN);
const showNoPenTrial = () => typeof meta !== "undefined" && meta && meta.trial; // a timed trial has no pencil
const showNoPen = () => !!showNoPenTrial() || (noPen() && !gamePen());
const shownGrade = (p) => (p.grade ? (showNoPen() && p.grade.np ? p.grade.np.value : p.grade.value) : null);
const pBand = (p) => (p.grade ? bandOf(shownGrade(p)) : bandOf(p.rating.level));
const PEN_MIN = 3; // this many pencil notes before a game counts as played with pencil
// null: the game from before the app stored it. penOn: played with the setting "with pencil", so it counts as with pencil
// whether or not notes were written (the calibration in tools/grade still goes by the notes actually written)
const penUsed = (g) => (g.pen == null ? null : g.pen >= PEN_MIN || !!g.penOn);
// What the pencil will cost in the game in progress, as long as it is not settled. null when there is no
// consequence: the grades are equal, the game is solved, or it already counts as with pencil (3+ notes, or the setting
// "with pencil").
function penStake() {
  if (!P || !P.grade || !P.grade.np || solved || !meta || !noPen()) return null;
  if (dec(P.grade.np.value) === dec(P.grade.value)) return null;
  const used = meta.pen || 0;
  return used >= PEN_MIN ? null : { left: PEN_MIN - used, pen: P.grade.value, nopen: P.grade.np.value };
}
// The grade that matches how the game was played: with pencil (3+ notes), without, or, for games from before pencil use was
// recorded, as you used to play (g.tg: the grade the weights are fitted to, so their numbers are the same as before).
const gradeFor = (g) => {
  const u = penUsed(g);
  if (u === null && g.tg != null) return +g.tg;
  return u !== true && g.np != null ? +g.np : +g.value;
};
const gBand = (g) => bandOf(gradeFor(g));
const KINDS = [
  ["alle", tr("All"), tr("mixed")],
  ["kort", tr("Short and sharp"), tr("few heavy moves")],
  ["lang", tr("Long and tough"), tr("many heavy moves")],
];
// "peak 4.6 · load 7" for a puzzle or a stored game
// Peak and load for the grade that is shown: without pencil for a puzzle when the setting is "without pencil",
// and for a game that was played without pencil.
const plText = (o) => {
  if (!o) return "";
  if (o.np && typeof o.np === "object" && showNoPen()) o = o.np;
  else if (o.tgk != null && penUsed(o) === null) o = { peak: o.tgk, load: o.tgl };
  else if (o.npk != null && penUsed(o) !== true) o = { peak: o.npk, load: o.npl };
  return o.peak != null ? tr("peak {top} · load {load}", { top: dec(o.peak), load: o.load }) : "";
};
// The technique picker's groups: the table's families in its order (a unit the game does not have is left out)
const LEVEL_GROUPS = [
  { family: "basic", name: tr("Basic techniques") },
  { family: "chain", name: tr("Chains") },
  { family: "whatif", name: tr("What-if") },
].map((g) => ({ name: g.name, levels: TT.list().filter((L) => TT.family(L) === g.family) }));
// Daily puzzle: the same for everyone on the same date (Sunday = 0)
// The daily puzzle per weekday (Sunday first): [rows, columns, difficulty band]. The game can have its own (GAME.daily).
const DAILY = GAME.daily || [
  [7, 7, 6],
  [6, 6, 2],
  [6, 6, 3],
  [6, 6, 4],
  [7, 7, 4],
  [7, 7, 5],
  [7, 7, 5],
];
const DOW = [tr("Sun"), tr("Mon"), tr("Tue"), tr("Wed"), tr("Thu"), tr("Fri"), tr("Sat")];
const DOW_LONG = [tr("Sunday"), tr("Monday"), tr("Tuesday"), tr("Wednesday"), tr("Thursday"), tr("Friday"), tr("Saturday")];
const $ = (id) => document.getElementById(id);
const svg = $("grid");
const NS = "http://www.w3.org/2000/svg";
const FRAMED = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();
const STANDALONE = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s); // capital first letter
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- Storage. Everything is wrapped in try/catch: in some views storage is turned off, and then the app only remembers in memory.
// The player's own data (PERSONAL) lives in keys of its own for a guest (guest mode, below); settings are shared.
const PERSONAL = new Set(["history", "archive", "current", "drills", "drillstash", "practicelog", "play", "campaign", "trials", "training", "levelsV"]);
let DATA_NS = "";
const keyOf = (k) => APP.id + "." + (PERSONAL.has(k) ? DATA_NS : "") + k;
const MEM = {};
const store = {
  get(k, d) {
    if (k in MEM) return MEM[k];
    try {
      const v = localStorage.getItem(keyOf(k));
      if (v != null) return (MEM[k] = JSON.parse(v));
    } catch (e) {}
    return d;
  },
  set(k, v) {
    MEM[k] = v;
    try {
      localStorage.setItem(keyOf(k), JSON.stringify(v));
      return true;
    } catch (e) {
      return false; // typically: the storage is full
    }
  },
  del(k) {
    delete MEM[k];
    try {
      localStorage.removeItem(keyOf(k));
    } catch (e) {}
  },
};
// ---------- Guest mode: someone else plays on this device. Their games, curve, practice and game in progress are kept in keys
// of their own (<game>.guest.*) and deleted when guest mode ends, so nothing they do counts as yours: not your statistics,
// curve, progress, practice levels, daily puzzle or days in a row. Your game in progress waits in your own keys. Guest mode
// ends when the band at the bottom is tapped, or by itself when the app is opened after GUEST_AWAY away.
const GUEST_AWAY = 30 * 60000;
function wipeGuest() {
  PERSONAL.forEach((k) => {
    try {
      localStorage.removeItem(APP.id + ".guest." + k);
    } catch (e) {}
  });
}
let GUEST = false,
  GUEST_ENDED = false; // ended by itself at start: say so once
(() => {
  const st = store.get("guest", null);
  if (!st || !st.on) return;
  if (Date.now() - (st.last || 0) > GUEST_AWAY) {
    wipeGuest();
    store.del("guest");
    GUEST_ENDED = true;
    return;
  }
  GUEST = true;
  DATA_NS = "guest.";
})();
// the time of the last activity, so "time away" is measured from when the app was last in use
function guestTouch() {
  if (GUEST) store.set("guest", { on: true, last: Date.now() });
}
const settings = Object.assign(
  { theme: "system", timer: true, same: true, peers: true, confirm: true, installHidden: false },
  GAME.settings || {}, // the game's own defaults (Sudoku: the grade with pencil)
  store.get("settings", {}),
);
const ui = Object.assign({ sizeIdx: 1, level: 3, nuance: "alle", maxRegion: 5, must: 0, scale: 2, kind: "alle", mode: "manual" }, GAME.ui || {}, store.get("ui", {}));
// The chosen size is kept by its dimensions (ui.size, "rows x cols") since 27 Nov. 2026, so a size added to a game's list
// cannot change it; ui.sizeIdx is its place in this version's list. Before, only the place was kept.
if (!ui.size) {
  // Suguru got a 4×4 size first in the list (24 November 2026): a choice stored before that moves one along
  if (APP.id === "suguru" && !ui.sizes4) {
    ui.sizeIdx = (ui.sizeIdx == null ? 1 : ui.sizeIdx) + 1;
    ui.sizes4 = 1;
  }
  const s0 = SIZES[ui.sizeIdx] || SIZES[0];
  ui.size = s0.r + "x" + s0.c;
  store.set("ui", ui);
}
ui.sizeIdx = Math.max(0, SIZES.findIndex((s) => s.r + "x" + s.c === ui.size));
if (ui.scale !== 2) {
  ui.scale = 2;
  ui.level = 3;
  ui.must = 0;
}
ui.level = Math.min(9, Math.max(1, ui.level));
// ---------- Game history: the newest games as plain JSON, older games in a compressed archive
// The archive (the key <game>.archive) holds games older than the newest ARCH_KEEP. They are stored without the route analysis's moves and
// step codes (lv), which the statistics do not use, and are compressed about 6 times (lz.js). Everything else is unchanged, so
// the statistics are the same. The archive is only rewritten when games are moved down into it, or when older games change
// (a new rating, import, reset).
// the games whose full route analysis (every move) is kept: 200 since 27 Nov. 2026, to collect data for the grading
// experiments (about 2.3 KB per game); the player can choose fewer in Storage
const KEEP_MOVES = 200;
const ARCH_MAX = 300, // this many games in the uncompressed part before the oldest are moved to the archive
  ARCH_KEEP = 200; // this many are kept uncompressed after a move
let ARCH_N = 0, // number of games in the archive (the first ARCH_N in games)
  ARCH_LEN = 0; // the archive's size in characters
function loadGames() {
  let arch = [];
  try {
    const raw = localStorage.getItem(keyOf("archive"));
    if (raw) {
      const txt = LZ.unpack(raw);
      if (txt) arch = JSON.parse(txt);
      ARCH_LEN = raw.length;
    }
  } catch (e) {
    arch = [];
  }
  const recent = store.get("history", []);
  const ids = new Set(recent.map((g) => g.id));
  arch = arch.filter((g) => !ids.has(g.id)); // a game that is in both places (an interrupted move) is counted only once
  arch.forEach((g) => (g.arc = 1));
  ARCH_N = arch.length;
  return arch.concat(recent);
}
let games = loadGames();
// A compact copy of a game for the archive
// A debug note not copied yet (to Claude): its game keeps its moves until it is
const hasNewNote = (g) => !!(g.dbg && g.dbg.some((n) => !n.sent));
function archForm(g) {
  const o = Object.assign({}, g);
  if (!hasNewNote(g)) delete o.moves;
  delete o.lv;
  delete o.routePending;
  o.arc = 1;
  return o;
}
let archBusy = 0;
function writeArchive(n) {
  const list = games.slice(0, n).map(archForm);
  const json = JSON.stringify(list);
  const gen = ++archBusy;
  const done = (packed) => {
    if (gen !== archBusy) return; // a newer write is in progress
    try {
      if (n) localStorage.setItem(keyOf("archive"), packed);
      else localStorage.removeItem(keyOf("archive"));
      ARCH_LEN = n ? packed.length : 0;
      // The archive's games first (by id, so a game that has arrived meanwhile does not shift anything)
      const ids = new Set(list.map((g) => g.id));
      const arch = games.filter((g) => ids.has(g.id)),
        rest = games.filter((g) => !ids.has(g.id));
      arch.forEach((g) => {
        if (!hasNewNote(g)) delete g.moves;
        delete g.lv;
        g.arc = 1;
      });
      games = arch.concat(rest);
      ARCH_N = arch.length;
      if (!store.set("history", rest)) toast(tr("The statistics could not be saved: storage is full."));
    } catch (e) {
      toast(tr("The statistics could not be saved: storage is full."));
    }
  };
  if (!n) return done("");
  // Compress in the background so the app does not stutter; without a Web Worker it is done at once
  try {
    const w = new Worker(APP.shared + "lzworker.js");
    w.onmessage = (e) => {
      done(e.data);
      w.terminate();
    };
    w.onerror = () => {
      w.terminate();
      done(LZ.pack(json));
    };
    w.postMessage(json);
  } catch (e) {
    done(LZ.pack(json));
  }
}
function saveSettings() {
  store.set("settings", settings);
}
function saveUi() {
  store.set("ui", ui);
}
// all = true: older games have changed (a new rating, import, reset), so the archive must be rewritten
// ---------- 4×4 is a game of its own in the statistics (25 Nov 2026), not in the menus: its times per cell and its grades
// behave differently (a grade there says little about your time), so it gets its own statistics, time curve, progress and
// rating check, which learn from its own games, and it does not mix into the others'. ownGames() is the games of the scope
// in use: the statistics' switch while they are drawn (withScope), otherwise the size of the puzzle on the board.
const isMicro = (g) => g.rows * g.cols <= 16;
let STAT_SCOPE = null,
  SCOPE_ALL = null, // all games while games holds one scope (withScope); saving waits until it is back
  SAVE_LATER = false;
const microNow = () => (STAT_SCOPE ? STAT_SCOPE === "micro" : !!(P && P.rows * P.cols <= 16));
const ownGames = (micro = microNow()) => games.filter((g) => isMicro(g) === micro);
function withScope(scope, fn) {
  if (SCOPE_ALL) return fn();
  const all = games;
  STAT_SCOPE = scope;
  SCOPE_ALL = all;
  games = all.filter((g) => isMicro(g) === (scope === "micro"));
  try {
    return fn();
  } finally {
    games = all;
    SCOPE_ALL = null;
    STAT_SCOPE = null;
    if (SAVE_LATER) (SAVE_LATER = false), saveGames();
  }
}
function saveGames(all) {
  if (SCOPE_ALL) return void (SAVE_LATER = true); // games holds one scope right now: save the whole list afterwards
  if (games.length > 100000) games = games.slice(-100000);
  if (ARCH_N > games.length) ARCH_N = games.length;
  if (all || games.length - ARCH_N > ARCH_MAX) writeArchive(all && games.length <= ARCH_MAX ? 0 : Math.max(ARCH_N, games.length - ARCH_KEEP));
  if (store.set("history", games.slice(ARCH_N))) return;
  // The storage is full: remove route details for older games (the statistics are kept) and try again
  for (const [keep, opts] of [[20], [10], [10, { notable: false }], [1, { notable: false }], [1, { notable: false, notes: false }]]) {
    if (!trimMoves(keep, opts)) continue;
    if (store.set("history", games.slice(ARCH_N))) {
      settings.keepMoves = Math.min(settings.keepMoves ?? KEEP_MOVES, keep);
      saveSettings();
      toast(tr("Storage was full, so the route analysis for older games was removed. The statistics are kept."));
      return;
    }
  }
  // Last resort: move almost everything down into the compressed archive
  if (games.length - ARCH_N > 20) return writeArchive(games.length - 20);
  toast(tr("The statistics could not be saved: storage is full."));
}

// ---------- Game state
let tutor = null,
  hint = null;
let P = null,
  G = null,
  regionSize = [],
  peerSets = [];
let entries = [],
  notes = [],
  undoStack = [];
let selected = -1,
  noteMode = false,
  reveal = false,
  checked = false,
  hintCell = -1,
  pendingOverwrite = null,
  solved = false;
let meta = null; // { id, daily, hints, hintTechs, checks, revealed, started }
let clockAcc = 0,
  clockSince = null;
let view = "home",
  worker = null;

function dayKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fmt(ms) {
  const s = Math.floor(ms / 1000);
  return (
    (s >= 3600
      ? Math.floor(s / 3600) + ":" + String(Math.floor(s / 60) % 60).padStart(2, "0")
      : String(Math.floor(s / 60)).padStart(2, "0")) +
    ":" +
    String(s % 60).padStart(2, "0")
  );
}
function fmtLong(ms) {
  const m = Math.round(ms / 60000);
  return m < 60 ? tr("{m} min", { m }) : tr("{h} h {m} min", { h: Math.floor(m / 60), m: m % 60 });
}
function levelValue(p) {
  return p.grade ? dec(shownGrade(p)) : String(p.rating.level);
}
function cellName(i) {
  return "abcdefghij"[i % G.cols] + (Math.floor(i / G.cols) + 1);
}

// ---------- Clock: runs only while the game is visible
function elapsed() {
  return clockAcc + (clockSince ? Date.now() - clockSince : 0);
}
function syncClock() {
  const run = view === "game" && P && !solved && document.visibilityState === "visible" && $("busy").hidden;
  if (run && !clockSince) clockSince = Date.now();
  else if (!run && clockSince) {
    clockAcc += Date.now() - clockSince;
    clockSince = null;
  }
}

// ---------- Navigation between screens
const ORDER = { home: 0, new: 1, stats: 1, settings: 1, camp: 1, trial: 1, guide: 2, game: 2, drill: 3 };
let backTo = "home";
function go(v, opts = {}) {
  const prev = view;
  hideTip();
  document.querySelectorAll(".view").forEach((s) => s.classList.remove("active", "fwd", "back"));
  const el = $("v-" + v);
  el.classList.add("active", opts.back || ORDER[v] < ORDER[prev] ? "back" : "fwd");
  if (!opts.back && v !== "home") backTo = prev === v ? backTo : prev;
  view = v;
  window.scrollTo(0, 0);
  if (v === "home") renderHome();
  if (v === "new") renderNew();
  if (v === "stats") renderStats();
  if (v === "settings") renderSettings();
  if (v === "camp") renderCamp();
  if (v === "trial") renderTrial();
  if (v === "game") renderAll();
  syncClock();
  if (prev === "game") saveCurrent();
}
document
  .querySelectorAll("[data-back]")
  .forEach((b) => (b.onclick = () => go(view === "guide" && backTo === "game" ? "game" : "home", { back: true })));

// ---------- Sheets, toast and tooltip
let sheetToken = 0,
  sheetOnClose = null;
function openSheet(html, bind, onClose) {
  sheetToken++;
  $("sheetBody").innerHTML = html;
  // always open at the top (the panel kept the last sheet's scroll position), and stay there while the sheet fills in
  // (the solved page draws its boards a moment later), until you scroll yourself
  const panel = document.querySelector("#sheet .panel"),
    tok = sheetToken;
  panel.scrollTop = 0;
  let touched = false;
  const mine = () => (touched = true);
  panel.addEventListener("touchstart", mine, { once: true, passive: true });
  panel.addEventListener("wheel", mine, { once: true, passive: true });
  panel.addEventListener("keydown", mine, { once: true });
  const keep = (k) => {
    if (tok !== sheetToken || touched) return;
    panel.scrollTop = 0;
    if (k < 30) setTimeout(() => keep(k + 1), 100);
  };
  requestAnimationFrame(() => keep(0));
  $("sheet").hidden = false;
  sheetOnClose = onClose || null;
  document.documentElement.classList.add("sheet-open");
  requestAnimationFrame(() => requestAnimationFrame(() => $("sheet").classList.add("open")));
  if (bind) bind($("sheetBody"));
}
function closeSheet() {
  const t = ++sheetToken,
    s = $("sheet");
  s.classList.remove("open");
  setTimeout(() => {
    if (t === sheetToken) {
      s.hidden = true;
      $("sheetBody").innerHTML = "";
      document.documentElement.classList.remove("sheet-open");
    }
  }, 260);
  const f = sheetOnClose;
  sheetOnClose = null;
  if (f) f();
}
$("sheetBackdrop").onclick = closeSheet;
// iOS lets a swipe on the sheet "fall through" to the page behind when the sheet cannot scroll in that direction itself.
// While a sheet is open, a swipe may only scroll something inside the sheet that can actually scroll.
let touchY0 = 0,
  touchX0 = 0;
document.addEventListener(
  "touchstart",
  (e) => {
    touchY0 = e.touches[0].clientY;
    touchX0 = e.touches[0].clientX;
  },
  { passive: true },
);
document.addEventListener(
  "touchmove",
  (e) => {
    if ($("sheet").hidden || e.touches.length > 1) return;
    const dy = e.touches[0].clientY - touchY0,
      dx = e.touches[0].clientX - touchX0,
      vertical = Math.abs(dy) >= Math.abs(dx);
    const panel = $("sheet").querySelector(".panel");
    for (let el = e.target; el && el !== document.body; el = el.parentElement) {
      if (!panel.contains(el)) break;
      const cs = getComputedStyle(el);
      if (vertical) {
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
          const atTop = el.scrollTop <= 0,
            atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          if ((dy > 0 && !atTop) || (dy < 0 && !atEnd)) return; // can scroll further in that direction
        }
      } else if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) return;
      if (el === panel) break;
    }
    e.preventDefault();
  },
  { passive: false },
);
function confirmSheet(o) {
  openSheet(
    `<h2>${esc(o.title)}</h2><p>${o.text}</p><div class="actions"><button class="primary big" id="cOk" type="button">${esc(o.ok)}</button>` +
      `<button class="secondary" id="cNo" type="button">${esc(o.cancel || tr("Cancel"))}</button></div>`,
    (b) => {
      b.querySelector("#cOk").onclick = () => {
        closeSheet();
        o.onOk();
      };
      b.querySelector("#cNo").onclick = () => {
        closeSheet();
        if (o.onCancel) o.onCancel();
      };
    },
  );
}
let toastT = 0;
// New player: guidance on using the game is shown only in the first games (explanations that add nothing once you know it)
const BEGINNER_GAMES = 3;
const beginner = () => games.filter((g) => g.solved).length < BEGINNER_GAMES;
function toast(t) {
  const el = $("toast");
  el.textContent = t;
  el.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("on"), 2600);
}
function showTip(target, text) {
  const tip = $("tip");
  tip.textContent = text;
  tip.hidden = false;
  const r = target.getBoundingClientRect(),
    tw = tip.offsetWidth,
    th = tip.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2,
    y = r.top - th - 8;
  if (y < 8) y = r.bottom + 8;
  x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
  tip.style.left = x + "px";
  tip.style.top = y + "px";
}
function hideTip() {
  $("tip").hidden = true;
}
document.addEventListener(
  "click",
  (e) => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (t) showTip(t, t.getAttribute("data-tip"));
    else hideTip();
  },
  true,
);
document.addEventListener("pointerover", (e) => {
  if (e.pointerType !== "mouse") return;
  const t = e.target.closest && e.target.closest("[data-tip]");
  if (t) showTip(t, t.getAttribute("data-tip"));
});
document.addEventListener("pointerout", (e) => {
  if (e.pointerType === "mouse" && e.target.closest && e.target.closest("[data-tip]")) hideTip();
});
window.addEventListener("scroll", hideTip, { passive: true });

// ---------- Theme
function applyTheme() {
  const r = document.documentElement;
  if (settings.theme === "system") r.removeAttribute("data-theme");
  else r.setAttribute("data-theme", settings.theme);
  requestAnimationFrame(() => $("themeColor").setAttribute("content", getComputedStyle(r).getPropertyValue("--paper").trim() || "#f3f4ef"));
}
if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
// No zooming the page (pinch or double tap): the viewport says so, and iOS Safari, which ignores that, gets the pinch
// gesture blocked here and double tap turned off with touch-action in app.css
document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
