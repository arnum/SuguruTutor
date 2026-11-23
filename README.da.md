# Suguru og Sudoku

*English: [README.md](README.md)*

To logikspil med sværhedsgrad målt som indsats, guidede hints, ruteanalyse og statistik.
De deler det meste af koden, men er to selvstændige apps: hver sit navn, ikon, data og offline-lager,
og de lægges på hjemmeskærmen hver for sig. Hvad der er kommet til, står i [CHANGELOG.md](CHANGELOG.md), og hvad der er planlagt, i [TODO.md](TODO.md) (begge på engelsk).

- **`web/suguru/`** er Suguru, **`web/sudoku/`** er Sudoku, og **`web/shared/`** er koden, de deler.
  **`web/index.html`** er forsiden med de to spil.
- **`java/`** laver Suguru-hæfter til print (HTML eller PDF) med de samme opgaver og den samme sværhedsgrad.

En opgavekode (`SU1-…` for Suguru, `SD1-…` for Sudoku) indeholder selve opgaven. Sudoku tager også en almindelig
opgave på 81 tegn (tal og `.` eller `0` for tomme felter).

## Opbygning

```
web/
  index.html, sw.js   forsiden med de to spil, og den lille service worker, der rydder op efter flytningen (se nedenfor)
  suguru/
    index.html, sw.js, manifest.webmanifest, icons/, guide.html, guide-da.html
    js/app.js        appens navn, version og hvor den fælles kode ligger
    js/game.js       spillets regler for den fælles kode: huse, naboer, tekster, niveauer, teknikker (GAME, boardModel)
    js/engine.js     regioner, løser, teknik-rater og generator
    js/code.js       opgavekoder
    js/gradew.js     vægtene til sværhedsgraden (genereret, se nedenfor)
    js/worker.js     baggrundsarbejde: generering og analyse
  sudoku/            samme filer for Sudoku, plus css/sudoku.css (farve og stempel)
  shared/
    css/app.css    udseende
    js/lang/da.js  danske tekster (begge spil)
    js/tutor.js    det letteste næste tal med forklaring (hints); virker for begge spil via boardModel
    js/grade.js    sværhedsgrad: indsats pr. skridt, top og mængde
    js/route.js    ruteanalyse af spillerens træk
    js/drillgen.js finder træningspositioner (kører i workeren); js/drill.js træningsskærmene;
                   js/games.js træningsspillene (Kaskade, Hvad ændrede sig?, Ryd op, Tæl dem, Lynsvar)
    js/…           sprog, lagring, skærme, statistik, indstillinger, opstart
```

Den fælles kode spørger kun spillet gennem `APP`, `GAME` og `boardModel(G, region)`. Et tredje spil kræver en ny mappe
med de seks filer i `js/`, en `index.html`, en service worker og et manifest.

**Hver sin app.** De to apps gemmer under hver sit præfiks (`suguru.*` og `sudoku.*`), har hver sin service worker
(`suguru-v…` og `sudoku-v…`, som kun rydder deres egne lagre op) og hvert sit manifest med eget `id`. De ligger i hver
sin mappe ved siden af hinanden, så ingen af dem omfatter den anden: på Android åbner et link til det ene spil ikke i
det andet spils app.

**Flytningen (november 2026).** Indtil da lå Suguru i roden. En Suguru-app, der blev lagt på hjemmeskærmen dengang,
åbner stadig roden; forsiden ser, at den kører som app, og sender videre til `suguru/`. Spil og statistik følger med,
fordi de er gemt på samme adresse. Rodens `sw.js` erstatter den gamle Suguru-service-worker: den sletter det gamle
offline-lager (`suguru-v1` … `suguru-v34`; den nye Suguru starter ved `suguru-v35`) og gemmer forsiden, så den gamle
app også kan åbne uden net. Delte links til den gamle adresse (`…/#SU1-…`) sendes også videre.
På en iPhone har hver app på hjemmeskærmen sit eget lager, så installerer man Suguru igen fra `suguru/`, starter den
tom: flyt spillene med *Indstillinger → Eksportér/Importér*, eller behold det gamle ikon, som virker som før.

Der er intet byggetrin. Scripts indlæses i den rækkefølge, de står i `index.html`, og deler ét globalt navnerum.

**Prøv lokalt:** `python3 -m http.server 8000 --directory web` og åbn `http://localhost:8000` (forsiden),
`http://localhost:8000/suguru/` eller `http://localhost:8000/sudoku/`.

**Udgivelse:** `.github/workflows/pages.yml` udgiver `web/` til GitHub Pages ved hvert push til `main`.
Det kræver én indstilling: *Settings → Pages → Source: GitHub Actions*. Ændres en fil, som en app skal have offline,
skal versionen i den apps `sw.js` op (`CACHE = "suguru-v…"` eller `"sudoku-v…"`); ændringer i `shared/` gælder begge.

## Sprog

Begge apps findes på engelsk og dansk. De vælger telefonens sprog (dansk, hvis telefonen er på dansk, ellers engelsk),
og man kan skifte under *Indstillinger → Sprog*.

Teksterne står på engelsk i koden, pakket ind i `tr()`:

```js
tr("Solved in {time}.", { time: fmt(ms) })
```

`web/shared/js/lang/da.js` oversætter hver engelsk tekst til dansk; `{navn}` er pladsholdere, der skal gå igen i
oversættelsen. Mangler en oversættelse, vises den engelske tekst. Den faste tekst i `index.html` oversættes automatisk
ved opstart. Skal samme engelske tekst have forskellig dansk, får nøglen en kontekst efter `|` (`"More"` og
`"More|count"`); på engelsk vises kun det før `|`.

- **Ny eller ændret tekst:** pak den ind i `tr("…")`, tilføj den danske linje i `da.js`, og kør `python3 tools/check_lang.py`.
  Den melder tekster uden oversættelse, oversættelser der ikke bruges, og pladsholdere der ikke passer.
- **Nyt sprog:** kopiér `da.js` til fx `de.js` (med `const LANG_DE`), oversæt værdierne, og tilføj sproget i `LANGS` og `DICTS`
  i `shared/js/i18n.js` og en `<script>`-linje i begge spils `index.html` og `js/worker.js`. Forsiden (`web/index.html`)
  har sine få tekster i sig selv.

**Engelsk som grundsprog (november 2026).** Indtil da stod teksterne på dansk i koden, og `lang/en.js` oversatte dem til
engelsk. De danske tekster er uændrede i `da.js`. Nogle interne værdier er stadig danske ord: gemte indstillinger (fx
`pencil: "med"`), id'er for faner og bånd, og guidernes ankre (`#eneste-kandidat`). De indgår i gemte data og links og er
derfor ladt, som de er.

## Guiderne

- **Suguru:** `python3 tools/guide/build.py` (skabelon, håndlavede eksempler og `da.json` med de danske tekster).
- **Sudoku:** `node tools/guide/build_sudoku.js`. Eksemplerne findes ved at løse rigtige opgaver med appens egen tutor,
  så teksterne er de samme, som spillets hints viser. Det tager omkring ti minutter (`GUIDE_SECONDS`, standard 600).
  Den kendte opgave AI Escargot (Arto Inkala, 2006) bruges til den dybeste teknik. Alle 14 teknikker har et eksempel;
  "begge veje" blev fundet første gang i november 2026. Findes en teknik ikke inden for tiden, udelades den, og hints om
  den skal så ikke linke dertil (`null` i `GUIDE_IDS` i `sudoku/js/game.js`).

`guide.html` er den engelske guide og `guide-da.html` den danske.

## Java

Kræver Java 8 eller nyere. Hæfterne er på engelsk som standard og på dansk med `--lang da`. Indtil videre kun Suguru.

```
cd java
./build.sh            (Windows: build.bat)
java -cp out SuguruBook --antal 12 --str 6x6 --grad 3-6 --ud haefte.html --lang da
java -cp out SuguruBook --count 6 --size 7x7 --grade 5 --technique 4 --type long --per-page 1 --pdf
java -cp out SuguruBook --koder "SU1-6X6-…,SU1-6X6-…" --sprog da
```

De danske navne på valgene (`--antal`, `--str`, `--grad`, `--ud` …) virker stadig, ligesom de engelske.

| Fil | Indhold |
|---|---|
| `SuguruEngine.java` | regioner, løser, teknik-rater og generator |
| `SuguruTutor.java` | det letteste næste tal (samme logik som `shared/js/tutor.js`) |
| `SuguruGrade.java` | sværhedsgrad (samme beregning som `shared/js/grade.js`) |
| `SuguruCode.java` | opgavekoder |
| `SuguruText.java` | hæftets og konsollens tekster: engelsk i koden, dansk i en tabel |
| `SuguruBook.java` | hæfte til print; alle valg står øverst i filen |

Kilderne er UTF-8. Byggescriptet oversætter med `-encoding UTF-8`, så æ, ø og å virker på alle systemer.

## Sværhedsgraden

Tallet måler indsats, ikke hvilken teknik der bruges. En menneskelig løsning simuleres, og hvert skridt får en indsats
ud fra genkendelse, hukommelse, længde og overblik. Opgavens tal er **top** (det tungeste skridt) plus et tillæg for
**mængde** (hvor mange tunge skridt der er). Der er tre tal pr. opgave: med blyant, uden blyant og "som du plejede"
for gamle spil, hvor det ikke vides. Graden kan gå over 10; niveau 9 dækker alt fra 9 og op.

Vægtene står i `tools/grade/weights.json` (Suguru) og `tools/grade/sudoku.json` (Sudoku).
`python3 tools/grade/gen.py` skriver dem ind i `web/suguru/js/gradew.js`, `web/sudoku/js/gradew.js` og
`java/src/SuguruGrade.java`, så JavaScript og Java altid er ens. Se `tools/grade/README.da.md`.

Suguru-vægtene er tilpasset målte løsningstider. Sudoku-vægtene er et skøn ud fra de etablerede Sudoku-raters
(Sudoku Explainer, HoDoKu) og forskning i, hvad der gør Sudoku svært for mennesker, indtil der er målte tider.

## Data

Spil og statistik gemmes kun i browseren på den enhed, hvor der spilles. *Indstillinger → Eksportér/Importér* flytter dem.
De to apps har hver sine data.
