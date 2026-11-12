# Suguru

Suguru med sværhedsgrad målt som indsats, guidede hints, ruteanalyse og statistik.

- **`web/`** er spillet. Det kører i browseren og kan lægges på hjemmeskærmen som en app, der også virker offline.
- **`java/`** laver hæfter til print (HTML eller PDF) med de samme opgaver og den samme sværhedsgrad.

En opgavekode (`SU1-…`) indeholder selve opgaven og virker begge steder: en opgave fra et printet hæfte kan tastes ind i spillet, så man kan få hints.

## Web-appen

```
web/
  index.html            siden: skærmenes HTML
  guide.html            guiden til de 14 teknikker (dansk)
  guide-en.html         guiden på engelsk
  css/app.css           udseende
  js/lang/en.js         engelske tekster
  js/i18n.js            sprogvalg, tr() til oversættelse, tal og datoer i sprogets format
  js/engine.js          regioner, løser, teknik-rater og generator
  js/tutor.js           det letteste næste tal med forklaring (hints)
  js/grade.js           sværhedsgrad: indsats pr. skridt, top og mængde
  js/code.js            opgavekoder (SU1-…)
  js/route.js           ruteanalyse af spillerens træk
  js/worker.js          kører generering og analyse i baggrunden
  js/core.js            konstanter, lagring, navigation, ark, tema
  js/home.js            forsiden og dagens opgave
  js/newgame.js         valg af ny opgave
  js/store.js           indlæsning og gemning af spil
  js/board.js           tegning af gitter og talknapper
  js/play.js            indtastning, hints, menu, forklaring, løst-ark
  js/stats.js           statistik: faner og nøgletal
  js/analysis.js        rute, tid pr. teknik, koncentration, form, fokusområde
  js/settings.js        indstillinger, eksport og import
  js/main.js            opstart
  sw.js                 service worker (offline)
  manifest.webmanifest  navn, ikon og farver til hjemmeskærmen
  icons/
```

Der er intet byggetrin. Scripts indlæses i den rækkefølge, de står i `index.html`, og deler ét globalt navnerum.

**Prøv lokalt:** `python3 -m http.server 8000 --directory web` og åbn `http://localhost:8000`.

**Udgivelse:** `.github/workflows/pages.yml` udgiver `web/` til GitHub Pages ved hvert push til `main`.
Det kræver én indstilling: *Settings → Pages → Source: GitHub Actions*.

## Sprog

Appen findes på dansk og engelsk. Den vælger telefonens sprog (dansk, hvis telefonen er på dansk, ellers engelsk),
og man kan skifte under *Indstillinger → Sprog*.

Teksterne står på dansk i koden, pakket ind i `tr()`:

```js
tr("Løst på {tid}.", { tid: fmt(ms) })
```

`web/js/lang/en.js` oversætter hver dansk tekst; `{navn}` er pladsholdere, der skal gå igen i oversættelsen.
Mangler en oversættelse, vises den danske tekst. Den faste tekst i `index.html` oversættes automatisk ved opstart.

- **Ny eller ændret tekst:** pak den ind i `tr("…")`, tilføj den engelske linje i `en.js`, og kør `python3 tools/check_lang.py`.
  Den melder tekster uden oversættelse, oversættelser der ikke bruges, og pladsholdere der ikke passer.
- **Nyt sprog:** kopiér `en.js` til fx `de.js` (med `const LANG_DE`), oversæt værdierne, og tilføj sproget i `LANGS` og `DICTS` i `js/i18n.js`
  og en `<script>`-linje i `index.html` og `js/worker.js`.
- **Guiden** bygges fra `tools/guide/` (skabelon, eksempler og `en.json` med de engelske tekster): `python3 tools/guide/build.py`.

Java-programmet og hæfterne er indtil videre kun på dansk.

## Java

Kræver Java 8 eller nyere.

```
cd java
./build.sh            (Windows: build.bat)
java -cp out SuguruBook --antal 12 --str 6x6 --grad 3-6 --ud haefte.html
java -cp out SuguruBook --antal 6 --str 7x7 --grad 5 --teknik 4 --type lang --pr-side 1 --pdf
java -cp out SuguruBook --koder "SU1-6X6-…,SU1-6X6-…"
```

| Fil | Indhold |
|---|---|
| `SuguruEngine.java` | regioner, løser, teknik-rater og generator |
| `SuguruTutor.java` | det letteste næste tal (samme logik som `js/tutor.js`) |
| `SuguruGrade.java` | sværhedsgrad (samme beregning som `js/grade.js`) |
| `SuguruCode.java` | opgavekoder |
| `SuguruBook.java` | hæfte til print; alle valg står øverst i filen |

Kilderne er UTF-8. Byggescriptet oversætter med `-encoding UTF-8`, så æ, ø og å virker på alle systemer.

## Sværhedsgraden

Tallet (1,0–9,9) måler indsats, ikke hvilken teknik der bruges.
En menneskelig løsning simuleres, og hvert skridt får en indsats ud fra genkendelse, hukommelse, længde og overblik.
Opgavens tal er **top** (det tungeste skridt) plus et tillæg på højst 1,0 for **mængde** (hvor mange tunge skridt der er).

Vægtene står øverst i `web/js/grade.js` og `java/src/SuguruGrade.java` og skal være ens i de to filer.
De er tilpasset et lille antal opgaver med målt løsningstid, så de er et skøn, der bør justeres, når der er flere data.

## Data

Spil og statistik gemmes kun i browseren på den enhed, hvor der spilles. *Indstillinger → Eksportér/Importér* flytter dem.
