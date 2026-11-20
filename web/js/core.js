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
  tr("hvis-så med enkle tal"),
  tr("begge veje"),
  tr("hvis-så med teknikker"),
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
  tr("hvis-så med enkle tal"),
  tr("begge veje"),
  tr("hvis-så med teknikker"),
  tr("gæt"),
];
const BAND = ["", tr("Begynder"), tr("Let"), tr("Middel"), tr("Svær"), tr("Meget svær"), tr("Ekspert"), tr("Mester"), tr("Ekstrem"), tr("Djævelsk")];
const bandOf = (v) => Math.min(9, Math.max(1, Math.floor(+v || 1)));
// To grader: med blyant (standard) og uden blyant (grade.np). Du vælger i indstillingerne, hvilken du ser og får nye
// opgaver efter. For et spillet spil bruges den grad, der passer til, om du faktisk brugte blyant.
const noPen = () => settings.pencil === "uden";
const shownGrade = (p) => (p.grade ? (noPen() && p.grade.np ? p.grade.np.value : p.grade.value) : null);
const pBand = (p) => (p.grade ? bandOf(shownGrade(p)) : bandOf(p.rating.level));
const PEN_MIN = 3; // så mange blyantsnoter, før et spil tæller som spillet med blyant
const penUsed = (g) => (g.pen == null ? null : g.pen >= PEN_MIN); // null: spillet før appen gemte det
// Hvad blyanten vil koste i det igangværende spil, så længe det ikke er afgjort. null, når der ikke er nogen
// konsekvens: graderne er ens, spillet er løst, eller det tæller allerede som med blyant.
// Gælder i begge indstillinger: et spil uden blyant gemmes altid med graden uden blyant.
function penStake() {
  if (!P || !P.grade || !P.grade.np || solved || !meta) return null;
  if (dec(P.grade.np.value) === dec(P.grade.value)) return null;
  const used = meta.pen || 0;
  return used >= PEN_MIN ? null : { left: PEN_MIN - used, pen: P.grade.value, nopen: P.grade.np.value };
}
const gradeFor = (g) => (penUsed(g) === false && g.np != null ? +g.np : +g.value);
const gBand = (g) => bandOf(gradeFor(g));
const KINDS = [
  ["alle", tr("Alle"), tr("blandet")],
  ["kort", tr("Kort og skarp"), tr("få tunge træk")],
  ["lang", tr("Lang og sej"), tr("mange tunge træk")],
];
// "top 4,6 · mængde 7" for en opgave eller et gemt spil
// Top og mængde for den grad, der vises: uden blyant for en opgave, når indstillingen er "uden blyant",
// og for et spil, der blev spillet uden blyant.
const plText = (o) => {
  if (!o) return "";
  if (o.np && typeof o.np === "object" && noPen()) o = o.np;
  else if (o.npk != null && penUsed(o) === false) o = { peak: o.npk, load: o.npl };
  return o.peak != null ? tr("top {top} · mængde {load}", { top: dec(o.peak), load: o.load }) : "";
};
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
      return true;
    } catch (e) {
      return false; // typisk: lageret er fuldt
    }
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
// ---------- Spilhistorik: nyeste spil som almindelig JSON, ældre spil i et komprimeret arkiv
// Arkivet (nøglen suguru.archive) rummer spil ældre end de nyeste ARCH_KEEP. De gemmes uden ruteanalysens træk og
// skridtkoder (lv), som statistikken ikke bruger, og komprimeres ca. 6 gange (lz.js). Alt andet er uændret, så
// statistikken er den samme. Arkivet skrives kun om, når spil flyttes ned i det, eller når ældre spil ændres
// (ny bedømmelse, import, nulstilling).
const ARCH_MAX = 300, // så mange spil i den ukomprimerede del, før de ældste flyttes til arkivet
  ARCH_KEEP = 200; // så mange beholdes ukomprimeret efter en flytning
let ARCH_N = 0, // antal spil i arkivet (de første ARCH_N i games)
  ARCH_LEN = 0; // arkivets størrelse i tegn
function loadGames() {
  let arch = [];
  try {
    const raw = localStorage.getItem("suguru.archive");
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
  arch = arch.filter((g) => !ids.has(g.id)); // et spil, der ligger begge steder (afbrudt flytning), tælles kun én gang
  arch.forEach((g) => (g.arc = 1));
  ARCH_N = arch.length;
  return arch.concat(recent);
}
let games = loadGames();
// Kompakt kopi af et spil til arkivet
function archForm(g) {
  const o = Object.assign({}, g);
  delete o.moves;
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
    if (gen !== archBusy) return; // en nyere skrivning er i gang
    try {
      if (n) localStorage.setItem("suguru.archive", packed);
      else localStorage.removeItem("suguru.archive");
      ARCH_LEN = n ? packed.length : 0;
      // Arkivets spil først (efter id, så et spil, der er kommet til imens, ikke forskyder noget)
      const ids = new Set(list.map((g) => g.id));
      const arch = games.filter((g) => ids.has(g.id)),
        rest = games.filter((g) => !ids.has(g.id));
      arch.forEach((g) => {
        delete g.moves;
        delete g.lv;
        g.arc = 1;
      });
      games = arch.concat(rest);
      ARCH_N = arch.length;
      if (!store.set("history", rest)) toast(tr("Statistikken kunne ikke gemmes: lageret er fuldt."));
    } catch (e) {
      toast(tr("Statistikken kunne ikke gemmes: lageret er fuldt."));
    }
  };
  if (!n) return done("");
  // Komprimér i baggrunden, så appen ikke hakker; uden Web Worker gøres det med det samme
  try {
    const w = new Worker("js/lzworker.js");
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
// all = true: ældre spil er ændret (ny bedømmelse, import, nulstilling), så arkivet skal skrives om
function saveGames(all) {
  if (games.length > 100000) games = games.slice(-100000);
  if (ARCH_N > games.length) ARCH_N = games.length;
  if (all || games.length - ARCH_N > ARCH_MAX) writeArchive(all && games.length <= ARCH_MAX ? 0 : Math.max(ARCH_N, games.length - ARCH_KEEP));
  if (store.set("history", games.slice(ARCH_N))) return;
  // Lageret er fuldt: fjern rute-detaljer for ældre spil (statistikken bevares) og prøv igen
  for (const keep of [20, 10, 1]) {
    if (!trimMoves(keep)) continue;
    if (store.set("history", games.slice(ARCH_N))) {
      settings.keepMoves = Math.min(settings.keepMoves ?? 40, keep);
      saveSettings();
      toast(tr("Lageret var fuldt, så ruteanalysen for ældre spil er fjernet. Statistikken er bevaret."));
      return;
    }
  }
  // Sidste udvej: flyt næsten alt ned i det komprimerede arkiv
  if (games.length - ARCH_N > 20) return writeArchive(games.length - 20);
  toast(tr("Statistikken kunne ikke gemmes: lageret er fuldt."));
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
  return p.grade ? dec(shownGrade(p)) : String(p.rating.level);
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
// iOS lader et stræk på arket "falde igennem" til siden bagved, når arket ikke selv kan rulle i den retning.
// Så længe et ark er åbent, får et stræk kun lov at rulle noget inde i arket, der faktisk kan rulle.
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
          if ((dy > 0 && !atTop) || (dy < 0 && !atEnd)) return; // kan rulle videre i den retning
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
