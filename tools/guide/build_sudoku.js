#!/usr/bin/env node
// Builds the Sudoku guide (web/sudoku/guide.html in English and guide-da.html in Danish) from real puzzles.
//
//   node tools/guide/build_sudoku.js            (takes up to ten minutes: the rare techniques have to be found)
//
// For each of the 14 techniques, generated puzzles are solved with the app's own tutor, and the cleanest place where the
// technique is the hardest step towards a number becomes the example: the board just before, and the hint's steps as
// frames. The texts are therefore the same as the game's hints show, in English and Danish. The puzzles have fixed seeds,
// so the guide comes out the same every time, as long as the search gets as far (GUIDE_SECONDS, default 600 s). If a
// technique is not found within the time, it is left out (and the page says how many are included).
// The template is the same as the Suguru guide's (template.html); only the texts and the drawing of 9 pencil marks differ.
"use strict";
const fs = require("fs"),
  path = require("path");
const ROOT = path.resolve(__dirname, "..", ".."),
  WEB = path.join(ROOT, "web");

function load(lang) {
  const files = ["sudoku/js/app", "shared/js/lang/da", "shared/js/i18n", "sudoku/js/game", "sudoku/js/engine", "shared/js/tutor", "sudoku/js/gradew", "shared/js/grade", "sudoku/js/code"];
  const src =
    `var localStorage={getItem(){return null},setItem(){},removeItem(){}};var navigator={language:"${lang}"};` +
    files.map((f) => fs.readFileSync(path.join(WEB, f + ".js"), "utf8")).join("\n");
  return new Function(src + "\nreturn {E:engineFactory(),createTutor,TECH_LABELS,GUIDE_IDS:typeof GUIDE_IDS!=='undefined'?GUIDE_IDS:[],encodePuzzle};")();
}

// "Look for" per technique (only the guide uses them)
const LOOK = {
  da: [
    "Felter, hvor rækken, kolonnen og boksen tilsammen allerede har otte forskellige tal.",
    "Et tal, der står i mange af de omkringliggende rækker og kolonner: i en boks er der så ofte kun én plads tilbage.",
    "Bokse, hvor et tal kun mangler i én række eller kolonne, og linjer, hvor et tal kun kan stå inden for én boks.",
    "Felter med kun to blyantstal. Står to af dem i samme hus med de samme to tal, er det et par.",
    "Et hus, hvor to tal begge kun kan stå de samme to steder.",
    "Tre felter i samme hus, hvor blyantstallene tilsammen kun er tre forskellige tal.",
    "Tre tal, der i et hus kun kan stå i de samme tre felter.",
    "Et tal med præcis to pladser i flere rækker, kolonner eller bokse. X-wing er den korteste form: to rækker med pladserne i de samme to kolonner.",
    "Felter med kun to blyantstal, der ser hinanden og deler et tal. XY-wing er tre sådanne felter.",
    "Når hverken ét tal alene eller to-mulighedsfelter alene rækker: skift mellem de to slags led.",
    "Et tal med få pladser: antag det ét sted, og se om et hus mister alle sine pladser til tallet.",
    "Felter med to eller tre muligheder, hvor en antagelse hurtigt sætter flere tal.",
    "Et felt med to muligheder eller et tal med to pladser, hvor begge veje fører til samme konklusion.",
    "Den sidste udvej: antag et tal og brug alle teknikker, indtil der opstår en modstrid.",
  ],
  en: [
    "Cells where the row, column and box together already hold eight different numbers.",
    "A number that appears in many of the surrounding rows and columns: in a box there is then often only one place left.",
    "Boxes where a number is only missing in one row or column, and lines where a number can only go within one box.",
    "Cells with only two pencil marks. If two of them sit in the same house with the same two numbers, that is a pair.",
    "A house where two numbers can both only go in the same two places.",
    "Three cells in the same house whose pencil marks together are only three different numbers.",
    "Three numbers that in a house can only go in the same three cells.",
    "A number with exactly two places in several rows, columns or boxes. X-wing is the shortest form: two rows with the places in the same two columns.",
    "Cells with only two pencil marks that see each other and share a number. An XY-wing is three such cells.",
    "When neither one number alone nor two-option cells alone are enough: alternate between the two kinds of links.",
    "A number with few places: assume it in one place and see whether a house loses all its places for the number.",
    "Cells with two or three options, where an assumption quickly places several numbers.",
    "A cell with two options or a number with two places, where both ways lead to the same conclusion.",
    "The last resort: assume a number and use all techniques until a contradiction appears.",
  ],
};
const LEVEL_OF = [1, 1, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11];
const IDS = ["eneste-kandidat", "eneste-plads", "laaste-kandidater", "noegent-par", "skjult-par", "noegen-trippel", "skjult-trippel", "kaede-et-tal", "kaede-to-muligheder", "kaede", "hvis-saa-et-tal", "hvis-saa-kort", "begge-veje", "hvis-saa-dyb"];

// ---------- 1. Find examples. They are scored on the Danish texts (score() counts text length), so the choice of
// examples is the same as when Danish was the base language; the same puzzles and positions are then used in both languages.
const DA = load("da");
const G = DA.E.makeGeometry(9, 9),
  region = DA.E.boxes(9, 9);
const nm = (c) => "abcdefghi"[c % 9] + (Math.floor(c / 9) + 1);
const score = (h) => {
  const steps = h.views.filter((v) => !v.nudge && !v.final).length;
  const words = h.views.reduce((a, v) => a + (v.text || "").length + (v.chain ? v.chain.join(" ").length : 0), 0);
  return steps * 3 + words / 120 + (h.hardest >= 7 && h.hardest <= 9 ? (h.len || 0) : 0);
};
const best = new Array(14).fill(null);
const GOOD = [2, 2, 3.5, 4, 4, 5, 5, 6, 6, 8, 8, 9, 10, 12]; // good enough: stop looking for that technique
const t0 = Date.now(),
  LIMIT = +(process.env.GUIDE_SECONDS || 600) * 1000;
// Known, published puzzles that need the rare techniques (AI Escargot by Arto Inkala, 2006: what-if with techniques)
// are searched first; the rest are found in generated puzzles.
const KNOWN = [{ name: "AI Escargot", s: "100007090030020008009600500005300900010080002600004000300000010040000007007000300" }];
const plan = KNOWN.map((k) => ({ known: k }));
for (let round = 0; round < 40; round++) for (const L of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) plan.push({ L, seed: 4242 + round * 977 + L * 31 });
for (const { L, seed, known: kp } of plan) {
  if (Date.now() - t0 > LIMIT) break;
  if (kp) {
    const givens = [...kp.s].map((ch) => +ch),
      tu = DA.createTutor(G, region),
      known = givens.slice();
    while (known.some((v) => !v)) {
      const h = tu.easiest(known);
      if (!h) break;
      const t = h.hardest;
      if (!best[t] || score(h) < score(best[t].h)) best[t] = { h, givens, known: known.slice(), code: DA.encodePuzzle({ rows: 9, cols: 9, region, givens }), source: kp.name };
      known[h.cell] = h.v;
    }
    process.stderr.write(`${kp.name}: found ${best.filter(Boolean).length}/14\n`);
    continue;
  }
  const wanted = best.map((b, t) => !b || score(b.h) > GOOD[t]);
  if (!wanted.some(Boolean)) break;
  // skip levels whose techniques all have a good example already
  const techsAt = [...Array(14).keys()].filter((t) => LEVEL_OF[t] === L || (L === 1 && t <= 1));
  if (L > 1 && !techsAt.some((t) => wanted[t]) && !(L >= 8 && wanted.slice(10).some(Boolean))) continue;
  const p = DA.E.generate(9, 9, L, seed, L >= 8 ? 15000 : 4000);
  const tu = DA.createTutor(G, p.region);
  const known = p.givens.slice();
  while (known.some((v) => !v)) {
    const h = tu.easiest(known);
    if (!h) break;
    const t = h.hardest;
    if (!best[t] || score(h) < score(best[t].h)) best[t] = { h, givens: p.givens.slice(), known: known.slice(), code: DA.encodePuzzle(p) };
    known[h.cell] = h.v;
  }
  process.stderr.write(`level ${L} seed ${seed}: found ${best.filter(Boolean).length}/14 (${Math.round((Date.now() - t0) / 1000)} s)\n`);
}

// ---------- 2. The examples as the guide's data (frames = the hint's steps), in one language
const digits = (m) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => m & (1 << d)).join("");
function examples(M, lang) {
  const out = [];
  best.forEach((b, t) => {
    if (!b) return;
    const tu = M.createTutor(G, region);
    const h = tu.easiest(b.known); // the same position, now with the texts in the language
    const givens = {},
      baseVal = {};
    b.givens.forEach((v, c) => v && (givens[nm(c)] = v));
    b.known.forEach((v, c) => v && !b.givens[c] && (baseVal[nm(c)] = v));
    const frames = [];
    for (const v of h.views) {
      if (v.nudge) continue;
      const cand = {};
      for (const c in v.cand || {}) cand[nm(+c)] = digits(v.cand[c]);
      const val = { ...baseVal };
      const f = { full: { val, cand }, pattern: (v.pattern || []).map(nm), target: (v.target || []).map(nm) };
      const strike = {};
      for (const c in v.strike || {}) strike[nm(+c)] = digits(v.strike[c]);
      if (Object.keys(strike).length) f.strike = strike;
      if (v.hypo) {
        f.hypo = Object.keys(v.hypo).map((c) => nm(+c));
        for (const c in v.hypo) val[nm(+c)] = v.hypo[c];
      }
      if (v.bad && v.bad.length) f.bad = v.bad.map(nm);
      if (v.final) {
        f.set = { [nm(h.cell)]: h.v };
        f.newv = [nm(h.cell)];
      }
      // chains of up to 10 steps are shown whole; longer ones (deep what-ifs) are cut to the first 6 (the hint in the game shows all)
      const CH = v.chain && v.chain.length > 10 ? 6 : 99,
        more = v.chain && v.chain.length > CH ? v.chain.length - CH : 0;
      const chain = v.chain && v.chain.length ? " " + v.chain.slice(0, CH).join(" ") + (more ? " " + (lang === "da" ? `… (og ${more} skridt mere)` : `… (and ${more} more steps)`) : "") : "";
      f.text = (v.title ? v.title + ". " : "") + v.text + chain;
      frames.push(f);
    }
    const ENG = M.E.TECH[t];
    out.push({
      id: IDS[t],
      level: LEVEL_OF[t],
      name: M.TECH_LABELS[t],
      rule: ENG.desc,
      look: LOOK[lang][t],
      R: 9,
      C: 9,
      regions: Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => "ABCDEFGHI"[region[r * 9 + c]]).join("")),
      givens,
      base: { val: baseVal, cand: {} },
      real: true,
      code: b.code,
      source: b.source || null,
      frames,
    });
  });
  return out;
}

// ---------- 3. The page: the Suguru guide's template with Sudoku's texts
const TEMPLATE = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");
// texts the two guides share, from the Suguru guide's Danish translation
const DA_COMMON = JSON.parse(fs.readFileSync(path.join(__dirname, "da.json"), "utf8")).template;
const n = best.filter(Boolean).length;
const MISSING_T = best.map((b, t) => (b ? null : t)).filter((t) => t !== null);
const COUNT_EN = n === 14 ? "The fourteen techniques" : `${n} of the fourteen techniques`,
  COUNT_DA = n === 14 ? "De fjorten teknikker" : `De ${n} af de fjorten teknikker`;
// techniques without an example are named honestly in the introduction
const listOf = (M, ts, and) => {
  const a = ts.map((t) => M.TECH_LABELS[t].toLowerCase());
  return a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " " + and + " " + a[a.length - 1];
};
const missEn = (M) =>
  MISSING_T.length
    ? ` There is no example yet of ${listOf(M, MISSING_T, "and")}: it is so rare in Sudoku that neither the generator nor well-known hard puzzles have shown it. The game's hints explain it if it turns up.`
    : "";
const MISS_DA = MISSING_T.length
  ? ` Der mangler endnu et eksempel på ${listOf(DA, MISSING_T, "og")}: den er så sjælden i Sudoku, at hverken generatoren eller kendte svære opgaver har vist den. Spillets hints forklarer den, hvis den dukker op.`
  : "";
const LEDE = "The fourteen techniques the game's difficulty rating uses, from the easiest to the hardest. Tap the drawing or Next to go one step forward.";
const ledeEn = (M) => `${COUNT_EN} the game's difficulty rating uses, from the easiest to the hardest. Tap the drawing or Next to go one step forward.${missEn(M)}`;
const LEDE_DA = `${COUNT_DA}, som spillets sværhedsvurdering bruger, fra de letteste til de sværeste. Tryk på tegningen eller på Næste for at gå et trin frem.${MISS_DA}`;
// [Suguru's text in the template, Sudoku's text in English, in Danish]
const SUDOKU_TEXT = (M) => [
  ['<div class="stamp" aria-hidden="true">数</div>', '<div class="stamp" aria-hidden="true">独</div>', '<div class="stamp" aria-hidden="true">独</div>'],
  ["<title>Suguru strategies</title>", "<title>Sudoku strategies</title>", "<title>Sudoku-strategier</title>"],
  ["<h1>Suguru strategies</h1>", "<h1>Sudoku strategies</h1>", "<h1>Sudoku-strategier</h1>"],
  [LEDE, ledeEn(M), LEDE_DA],
  [
    "Go through the whole grid for naked and hidden singles until nothing more happens.",
    "Scan box by box for hidden singles, then row by row and column by column, until nothing more happens.",
    "Skan boks for boks for eneste plads, og derefter række for række og kolonne for kolonne, til der ikke sker mere.",
  ],
  [
    "Look for regions of two cells and for 2×2 blocks. That is where neighbour eliminations and triples usually hide.",
    "Look for locked candidates: a number that in a box can only go in one row or column, or in a line only within one box.",
    "Kig efter låste kandidater: et tal, der i en boks kun kan stå i én række eller kolonne, eller i en linje kun inden for én boks.",
  ],
  [
    "Pencil in the possible numbers and look for pairs that see each other.",
    "Write the possible numbers in pencil, and look for pairs and triples in every row, column and box.",
    "Skriv mulige tal med blyant, og led efter par og tripler i hver række, kolonne og boks.",
  ],
  [
    "Find cells with two options and numbers with two places in a region, and see whether they can be chained. Start with one number at a time.",
    "Find numbers with two places in a house (X-wing and the like) and cells with two options (XY-wing), and see whether they can be chained. Start with one number at a time.",
    "Find tal med to pladser i et hus (X-wing og lignende) og felter med to muligheder (XY-wing), og se om de kan kædes sammen. Start med ét tal ad gangen.",
  ],
  [
    "In the game, a puzzle's difficulty is measured as effort: the heaviest step plus an addition for how many heavy steps there are. The level shown for each technique below is its place from easy to hard, not the difficulty of a puzzle. Examples marked “From a real puzzle” come straight from the generator, and every claim has been checked against the puzzles' solutions.",
    "In the game, a puzzle's difficulty is measured as effort: the heaviest step plus an addition for how many heavy steps there are. The level shown for each technique below is the technique's place from easy to hard, not the puzzle's difficulty. All examples were found in real puzzles from the game's generator, and the texts are the same as the game's hints show.",
    "I spillet måles en opgaves sværhed som indsats: det tungeste skridt plus et tillæg for, hvor mange tunge skridt der er. Niveauet ved hver teknik herunder er teknikkens plads fra let til svær, ikke opgavens sværhedsgrad. Alle eksempler er fundet i rigtige opgaver fra spillets generator, og teksterne er de samme, som spillets hints viser.",
  ],
  ...[
    ["const NOTE = { 1: [24, 24], 2: [76, 24], 3: [50, 50], 4: [24, 76], 5: [76, 76] };", "const NOTE = { 1: [22, 24], 2: [50, 24], 3: [78, 24], 4: [22, 52], 5: [50, 52], 6: [78, 52], 7: [22, 80], 8: [50, 80], 9: [78, 80] };"],
    ['const COLS = "abcdefgh";', 'const COLS = "abcdefghi";'],
  ].map(([a, b]) => [a, b, b]),
];
const HEAD =
  '<script>try{var t=JSON.parse(localStorage.getItem("sudoku.settings")||"{}").theme;' +
  'if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>\n';
function page(lang, data, M) {
  let t = TEMPLATE;
  for (const [su, en, da] of SUDOKU_TEXT(M)) {
    if (!t.includes(su)) throw new Error("not found in the template: " + su.slice(0, 70));
    t = t.split(su).join(lang === "da" ? da : en);
  }
  if (lang === "da") {
    for (const [a, b] of Object.entries(DA_COMMON)) if (t.includes(a)) t = t.split(a).join(b);
    t = t.replace('<html lang="en">', '<html lang="da">');
  }
  t = t.replace("__DATA__", JSON.stringify(data));
  const realTag = `'<span class="real">${lang === "da" ? "Fra en rigtig opgave" : "From a real puzzle"}</span>'`;
  if (!t.includes(realTag)) throw new Error("the tag is not in the template");
  t = t.split(realTag).join(
    `'<span class="real">' + (ex.source ? ex.source : '${lang === "da" ? "Fra en rigtig opgave" : "From a real puzzle"}') + '</span>'`
  );
  t = t.replace("<style>", HEAD + "<style>");
  t = t.replace("</title>", '</title>\n<link rel="icon" href="icons/icon-192.png" type="image/png">');
  return t;
}
for (const lang of ["en", "da"]) {
  const M = lang === "da" ? DA : load("en");
  const data = examples(M, lang);
  const out = path.join(WEB, "sudoku", lang === "en" ? "guide.html" : "guide-da.html");
  fs.writeFileSync(out, page(lang, data, M));
  console.log("wrote", path.relative(ROOT, out), "·", data.length, "techniques:", data.map((d) => d.id + "(" + d.frames.length + ")").join(" "));
}
const missing = best.map((b, t) => (b ? null : IDS[t])).filter(Boolean);
if (missing.length) console.log("not found within the time:", missing.join(", "));
