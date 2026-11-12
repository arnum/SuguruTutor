// Sprog. Teksterne står på dansk i koden; en sprogfil (lang/en.js) oversætter hver dansk tekst til et andet sprog.
//
//   tr("Løst på {tid}.", { tid: "03:22" })   ->  "Løst på 03:22."  eller  "Solved in 03:22."
//
// En tekst, der mangler i sprogfilen, vises på dansk. Et nyt sprog kræver en ny fil i lang/ og en linje i LANGS.

const LANGS = { da: "Dansk", en: "English" };
const DICTS = { en: typeof LANG_EN !== "undefined" ? LANG_EN : {} };

// Valgt sprog: indstillingen, ellers telefonens/browserens sprog (dansk, hvis det er dansk, ellers engelsk)
const LANG = (() => {
  try {
    const s = JSON.parse(localStorage.getItem("suguru.settings") || "{}").lang;
    if (LANGS[s]) return s;
  } catch (e) {}
  const nav = (typeof navigator !== "undefined" && navigator.language) || "da";
  return nav.toLowerCase().startsWith("da") ? "da" : "en";
})();
const LOCALE = LANG === "da" ? "da-DK" : "en-GB";
const I18N_MISSING = new Set(); // tekster uden oversættelse (bruges af testene)

function tr(s, p) {
  let r = s;
  if (LANG !== "da") {
    const d = DICTS[LANG];
    if (d && Object.prototype.hasOwnProperty.call(d, s)) r = d[s];
    else I18N_MISSING.add(s);
  }
  return p ? r.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : r;
}

// Decimaltal med sprogets decimaltegn: 4,2 på dansk, 4.2 på engelsk
function dec(x, d = 1) {
  const s = (+x).toFixed(d);
  return LANG === "da" ? s.replace(".", ",") : s;
}

// Oversæt den faste tekst i siden (index.html): tekstknuder og de attributter, der læses op eller vises
function translateDom(root) {
  if (LANG === "da") return;
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
