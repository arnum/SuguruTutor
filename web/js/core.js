// Kerne: konstanter, lagring, spiltilstand, navigation mellem skærme, ark, toast og tema.

const E = engineFactory();
const APP_VERSION = "2.0";
const GUIDE_IDS = [
  "eneste-kandidat",
  "eneste-plads",
  "nabo-eliminering",
  "noegent-par",
  "skjult-par",
  "noegen-trippel",
  "skjult-trippel",
  "kaede-et-tal",
  "kaede-to-muligheder",
  "kaede",
  "hvis-saa-et-tal",
  "hvis-saa-kort",
  "begge-veje",
  "hvis-saa-dyb",
];
const TECH_NAMES_UI = [
  tr("eneste kandidat"),
  tr("eneste plads i region"),
  tr("nabo-eliminering"),
  tr("nøgent par"),
  tr("skjult par"),
  tr("nøgen trippel"),
  tr("skjult trippel"),
  tr("kæder med ét tal"),
  tr("kæder med to-mulighedsfelter"),
  tr("blandede kæder"),
  tr("hvis-så med ét tal"),
  tr("hvis-så, kort"),
  tr("begge veje"),
  tr("hvis-så, dyb"),
];
const SIZES = [
  { r: 5, c: 5, t: tr("Hurtig") },
  { r: 6, c: 6, t: tr("Klassisk") },
  { r: 7, c: 7, t: tr("Større") },
  { r: 8, c: 8, t: tr("Stor") },
  { r: 10, c: 8, t: tr("Lang") },
];
const LEVEL_INFO = [
  null,
  tr("Kun eneste kandidat og eneste plads."),
  tr("Et tal blokerer felter uden for regionen."),
  tr("Par: to felter deler de samme to tal."),
  tr("Tripler af felter og tal."),
  tr("Følg ét tal gennem regioner med to pladser."),
  tr("Kæder af felter med to muligheder."),
  tr("Kæder der blander begge slags led."),
  tr("Antag et tal, og følg kun det tal."),
  tr("Antag, og find en modstrid med enkle træk."),
  tr("Prøv begge muligheder: det fælles er sandt."),
  tr("Lange antagelser med de svære teknikker."),
];
const LEVEL_TECH = [
  "",
  tr("eneste kandidat/plads"),
  tr("nabo-eliminering"),
  tr("par"),
  tr("tripler"),
  tr("kæde med ét tal"),
  tr("kæde med to-mulighedsfelter"),
  tr("blandet kæde"),
  tr("hvis-så med ét tal"),
  tr("kort hvis-så"),
  tr("begge veje"),
  tr("dyb hvis-så"),
  tr("gæt"),
];
const BAND = ["", tr("Begynder"), tr("Let"), tr("Middel"), tr("Svær"), tr("Meget svær"), tr("Ekspert"), tr("Mester"), tr("Ekstrem"), tr("Djævelsk")];
const bandOf = (v) => Math.min(9, Math.max(1, Math.floor(+v || 1)));
const pBand = (p) => (p.grade ? p.grade.band : bandOf(p.rating.level));
const gBand = (g) => bandOf(g.value);
const KINDS = [
  ["alle", tr("Alle"), tr("blandet")],
  ["kort", tr("Kort og skarp"), tr("få tunge træk")],
  ["lang", tr("Lang og sej"), tr("mange tunge træk")],
];
// "top 4,6 · mængde 7" for en opgave eller et gemt spil
const plText = (o) => (o && o.peak != null ? tr("top {top} · mængde {load}", { top: dec(o.peak), load: o.load }) : "");
const LEVEL_GROUPS = [
  { name: tr("Grundteknikker"), levels: [1, 2, 3, 4] },
  { name: tr("Kæder"), levels: [5, 6, 7] },
  { name: tr("Hvis-så"), levels: [8, 9, 10, 11] },
];
// Dagens opgave: samme for alle på samme dato (søndag = 0)
const DAILY = [
  [7, 7, 6],
  [6, 6, 2],
  [6, 6, 3],
  [6, 6, 4],
  [7, 7, 4],
  [7, 7, 5],
  [7, 7, 5],
];
const DOW = [tr("søn"), tr("man"), tr("tir"), tr("ons"), tr("tor"), tr("fre"), tr("lør")];
const DOW_LONG = [tr("søndag"), tr("mandag"), tr("tirsdag"), tr("onsdag"), tr("torsdag"), tr("fredag"), tr("lørdag")];
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
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- Lagring. Alt pakkes ind i try/catch: i nogle visninger er lagring slået fra, og så husker appen kun i hukommelsen.
const MEM = {};
const store = {
  get(k, d) {
    if (k in MEM) return MEM[k];
    try {
      const v = localStorage.getItem("suguru." + k);
      if (v != null) return (MEM[k] = JSON.parse(v));
    } catch (e) {}
    return d;
  },
  set(k, v) {
    MEM[k] = v;
    try {
      localStorage.setItem("suguru." + k, JSON.stringify(v));
    } catch (e) {}
  },
  del(k) {
    delete MEM[k];
    try {
      localStorage.removeItem("suguru." + k);
    } catch (e) {}
  },
};
const settings = Object.assign(
  { theme: "system", timer: true, same: true, peers: true, confirm: true, installHidden: false },
  store.get("settings", {}),
);
const ui = Object.assign({ sizeIdx: 1, level: 3, nuance: "alle", maxRegion: 5, must: 0, scale: 2, kind: "alle" }, store.get("ui", {}));
if (ui.scale !== 2) {
  ui.scale = 2;
  ui.level = 3;
  ui.must = 0;
}
ui.level = Math.min(9, Math.max(1, ui.level));
let games = store.get("history", []);
function saveSettings() {
  store.set("settings", settings);
}
function saveUi() {
  store.set("ui", ui);
}
function saveGames() {
  if (games.length > 3000) games = games.slice(-3000);
  store.set("history", games);
}

// ---------- Spiltilstand
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
  return m < 60 ? tr("{m} min", { m }) : tr("{h} t {m} min", { h: Math.floor(m / 60), m: m % 60 });
}
function levelValue(p) {
  return p.grade ? dec(p.grade.value) : String(p.rating.level);
}
function cellName(i) {
  return "abcdefghij"[i % G.cols] + (Math.floor(i / G.cols) + 1);
}

// ---------- Ur: kører kun når spillet er synligt
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

// ---------- Navigation mellem skærme
const ORDER = { home: 0, new: 1, stats: 1, settings: 1, guide: 2, game: 2 };
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
  if (v === "game") renderAll();
  syncClock();
  if (prev === "game") saveCurrent();
}
document
  .querySelectorAll("[data-back]")
  .forEach((b) => (b.onclick = () => go(view === "guide" && backTo === "game" ? "game" : "home", { back: true })));

// ---------- Ark, toast og tooltip
let sheetToken = 0,
  sheetOnClose = null;
function openSheet(html, bind, onClose) {
  sheetToken++;
  $("sheetBody").innerHTML = html;
  $("sheet").hidden = false;
  sheetOnClose = onClose || null;
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
    }
  }, 260);
  const f = sheetOnClose;
  sheetOnClose = null;
  if (f) f();
}
$("sheetBackdrop").onclick = closeSheet;
function confirmSheet(o) {
  openSheet(
    `<h2>${esc(o.title)}</h2><p>${o.text}</p><div class="actions"><button class="primary big" id="cOk" type="button">${esc(o.ok)}</button>` +
      `<button class="secondary" id="cNo" type="button">${esc(o.cancel || tr("Annullér"))}</button></div>`,
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

// ---------- Tema
function applyTheme() {
  const r = document.documentElement;
  if (settings.theme === "system") r.removeAttribute("data-theme");
  else r.setAttribute("data-theme", settings.theme);
  requestAnimationFrame(() => $("themeColor").setAttribute("content", getComputedStyle(r).getPropertyValue("--paper").trim() || "#f3f4ef"));
}
if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
