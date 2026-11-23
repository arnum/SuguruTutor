# Suguru and Sudoku

*Dansk: [README.da.md](README.da.md)*

Two logic puzzles with difficulty measured as effort, guided hints, route analysis and statistics.
They share most of the code but are two separate apps: each has its own name, icon, data and offline storage,
and each is added to the home screen on its own. What has been added over time is in [CHANGELOG.md](CHANGELOG.md); what is planned is in [TODO.md](TODO.md).

- **`web/suguru/`** is Suguru, **`web/sudoku/`** is Sudoku, and **`web/shared/`** is the code they share.
  **`web/index.html`** is the front page with the two games.
- **`java/`** makes Suguru booklets for print (HTML or PDF) with the same puzzles and the same difficulty.

A puzzle code (`SU1-…` for Suguru, `SD1-…` for Sudoku) contains the puzzle itself. Sudoku also accepts an ordinary
puzzle of 81 characters (digits and `.` or `0` for empty cells).

## Structure

```
web/
  index.html, sw.js   the front page with the two games, and the small service worker that cleans up after the move (see below)
  suguru/
    index.html, sw.js, manifest.webmanifest, icons/, guide.html, guide-da.html
    js/app.js        the app's name, version and where the shared code is
    js/game.js       the game's rules for the shared code: houses, neighbours, texts, levels, techniques (GAME, boardModel)
    js/engine.js     regions, solver, technique rater and generator
    js/code.js       puzzle codes
    js/gradew.js     the weights for the difficulty (generated, see below)
    js/worker.js     background work: generation and analysis
  sudoku/            the same files for Sudoku, plus css/sudoku.css (colour and stamp)
  shared/
    css/app.css    the look
    js/lang/da.js  Danish texts (both games)
    js/tutor.js    the easiest next number with an explanation (hints); works for both games via boardModel
    js/grade.js    difficulty: effort per step, peak and load
    js/route.js    route analysis of the player's moves
    js/drillgen.js finding practice positions (runs in the worker); js/drill.js the practice screens;
                   js/games.js the practice games (Cascade, What changed?, Sweep, Count them, Quick call)
    js/…           language, storage, screens, statistics, settings, startup
```

The shared code asks the game only through `APP`, `GAME` and `boardModel(G, region)`. A third game needs a new folder
with the six files in `js/`, an `index.html`, a service worker and a manifest.

**Separate apps.** The two apps store data under their own prefix (`suguru.*` and `sudoku.*`), each has its own service
worker (`suguru-v…` and `sudoku-v…`, which only clean up their own storage) and its own manifest with its own `id`. They
sit in separate folders side by side, so neither contains the other: on Android a link to one game does not open in the
other game's app.

**The move (November 2026).** Until then Suguru lived in the root. A Suguru app added to the home screen back then
still opens the root; the front page sees that it runs as an app and forwards to `suguru/`. Games and statistics come
along, because they are stored at the same address. The root `sw.js` replaces the old Suguru service worker: it deletes
the old offline storage (`suguru-v1` … `suguru-v34`; the new Suguru starts at `suguru-v35`) and stores the front page,
so the old app can open without a network too. Shared links to the old address (`…/#SU1-…`) are forwarded as well.
On an iPhone each app on the home screen has its own storage, so if you install Suguru again from `suguru/`, it starts
empty: move the games with *Settings → Export/Import*, or keep the old icon, which works as before.

There is no build step. Scripts are loaded in the order they appear in `index.html` and share one global namespace.

**Try it locally:** `python3 -m http.server 8000 --directory web` and open `http://localhost:8000` (the front page),
`http://localhost:8000/suguru/` or `http://localhost:8000/sudoku/`.

**Publishing:** `.github/workflows/pages.yml` publishes `web/` to GitHub Pages on every push to `main`.
It needs one setting: *Settings → Pages → Source: GitHub Actions*. If a file an app needs offline changes, the version
in that app's `sw.js` must go up (`CACHE = "suguru-v…"` or `"sudoku-v…"`); changes in `shared/` apply to both.

## Language

Both apps exist in English and Danish. They pick the phone's language (Danish if the phone is set to Danish, otherwise
English), and you can switch under *Settings → Language*.

The texts are written in English in the code, wrapped in `tr()`:

```js
tr("Solved in {time}.", { time: fmt(ms) })
```

`web/shared/js/lang/da.js` translates each English text into Danish; `{name}` are placeholders that must appear again in
the translation. If a translation is missing, the English text is shown. The fixed text in `index.html` is translated
automatically at startup. When the same English text needs different Danish, the key gets a context after `|`
(`"More"` and `"More|count"`); English shows only the part before `|`.

- **New or changed text:** wrap it in `tr("…")`, add the Danish line in `da.js`, and run `python3 tools/check_lang.py`.
  It reports texts without a translation, translations that are not used, and placeholders that do not match.
- **New language:** copy `da.js` to e.g. `de.js` (with `const LANG_DE`), translate the values, and add the language to
  `LANGS` and `DICTS` in `shared/js/i18n.js` and a `<script>` line in both games' `index.html` and `js/worker.js`. The
  front page (`web/index.html`) has its few texts in itself.

**English as the base language (November 2026).** Until then the texts in the code were Danish and `lang/en.js`
translated them into English. The Danish texts are unchanged in `da.js`. Some internal values are still Danish words:
stored settings (e.g. `pencil: "med"`), tab and band ids, and the guides' anchors (`#eneste-kandidat`). They are part of
stored data and links, so they were left as they are.

## The guides

- **Suguru:** `python3 tools/guide/build.py` (the template, hand-made examples and `da.json` with the Danish texts).
- **Sudoku:** `node tools/guide/build_sudoku.js`. The examples are found by solving real puzzles with the app's own
  tutor, so the texts are the same as the game's hints show. It takes about ten minutes (`GUIDE_SECONDS`, default 600).
  The well-known puzzle AI Escargot (Arto Inkala, 2006) is used for the deepest technique. All 14 techniques have an
  example; "both ways" was found for the first time in November 2026. If a technique is not found within the time, it
  is left out, and hints about it should not link there (`null` in `GUIDE_IDS` in `sudoku/js/game.js`).

`guide.html` is the English guide and `guide-da.html` the Danish one.

## Java

Needs Java 8 or newer. The booklets are in English by default and in Danish with `--lang da`. Only Suguru so far.

```
cd java
./build.sh            (Windows: build.bat)
java -cp out SuguruBook --count 12 --size 6x6 --grade 3-6 --out booklet.html
java -cp out SuguruBook --count 6 --size 7x7 --grade 5 --technique 4 --type long --per-page 1 --pdf
java -cp out SuguruBook --codes "SU1-6X6-…,SU1-6X6-…" --lang da
```

The Danish option names from before (`--antal`, `--str`, `--grad`, `--ud` …) still work.

| File | Contents |
|---|---|
| `SuguruEngine.java` | regions, solver, technique rater and generator |
| `SuguruTutor.java` | the easiest next number (the same logic as `shared/js/tutor.js`) |
| `SuguruGrade.java` | difficulty (the same calculation as `shared/js/grade.js`) |
| `SuguruCode.java` | puzzle codes |
| `SuguruText.java` | the booklet's and the console's texts: English in the code, Danish in a table |
| `SuguruBook.java` | booklet for print; all options are at the top of the file |

The sources are UTF-8. The build script compiles with `-encoding UTF-8`, so æ, ø and å work on every system.

## The difficulty

The number measures effort, not which technique is used. A human solution is simulated, and each step gets an effort
from recognition, memory, length and overview. The puzzle's number is **peak** (the heaviest step) plus an addition for
**load** (how many heavy steps there are). There are three numbers per puzzle: with pencil, without pencil and "as you
used to play" for old games where it is not known. The grade can go above 10; level 9 covers everything from 9 up.

The weights are in `tools/grade/weights.json` (Suguru) and `tools/grade/sudoku.json` (Sudoku).
`python3 tools/grade/gen.py` writes them into `web/suguru/js/gradew.js`, `web/sudoku/js/gradew.js` and
`java/src/SuguruGrade.java`, so JavaScript and Java are always the same. See `tools/grade/README.md`.

The Suguru weights are fitted to measured solving times. The Sudoku weights are an estimate based on the established
Sudoku raters (Sudoku Explainer, HoDoKu) and research into what makes Sudoku hard for people, until there are measured times.

## Data

Games and statistics are stored only in the browser on the device where you play. *Settings → Export/Import* moves them.
The two apps each have their own data.
