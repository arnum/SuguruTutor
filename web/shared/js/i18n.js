// Language. The texts are written in English in the code; a language file (lang/da.js) translates each English text
// into another language.
//
//   tr("Solved in {time}.", { time: "03:22" })   ->  "Solved in 03:22."  or  "Løst på 03:22."
//
// A text missing from the language file is shown in English. A new language needs a new file in lang/ and a line in LANGS.

const LANGS = { da: "Dansk", en: "English" };
const BASE_LANG = "en";
const DICTS = { da: typeof LANG_DA !== "undefined" ? LANG_DA : {} };

// Chosen language: the setting, otherwise the phone's/browser's language (Danish if it is Danish, otherwise English)
const LANG = (() => {
  try {
    const s = JSON.parse(localStorage.getItem((typeof APP !== "undefined" ? APP.id : "suguru") + ".settings") || "{}").lang;
    if (LANGS[s]) return s;
  } catch (e) {}
  const nav = (typeof navigator !== "undefined" && navigator.language) || "en";
  return nav.toLowerCase().startsWith("da") ? "da" : "en";
})();
const LOCALE = LANG === "da" ? "da-DK" : "en-GB";
const I18N_MISSING = new Set(); // texts without a translation (used by the tests)

// A text can get a context after "|" when the same English text must be translated differently (e.g. "More" and
// "More|count"): in English only the text before "|" is shown; other languages look up the whole key.
function tr(s, p) {
  const bar = s.indexOf("|");
  let r = bar >= 0 ? s.slice(0, bar) : s;
  if (LANG !== BASE_LANG) {
    const d = DICTS[LANG];
    if (d && Object.prototype.hasOwnProperty.call(d, s)) r = d[s];
    else I18N_MISSING.add(s);
  }
  return p ? r.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : r;
}

// Decimal number with the language's decimal separator: 4,2 in Danish, 4.2 in English
function dec(x, d = 1) {
  const s = (+x).toFixed(d);
  return LANG === "da" ? s.replace(".", ",") : s;
}

// Translate the fixed text in the page (index.html): text nodes and the attributes that are read aloud or shown
function translateDom(root) {
  if (LANG === BASE_LANG) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const raw = n.nodeValue, key = raw.trim();
    if (key && /[A-Za-zÆØÅæøå]/.test(key) && n.parentNode.nodeName !== "SCRIPT" && n.parentNode.nodeName !== "STYLE") {
      n.nodeValue = raw.replace(key, tr(key));
    }
  }
  root.querySelectorAll("[aria-label],[placeholder],[title]").forEach((el) => {
    for (const a of ["aria-label", "placeholder", "title"]) if (el.hasAttribute(a)) el.setAttribute(a, tr(el.getAttribute(a)));
  });
  document.documentElement.lang = LANG;
}
