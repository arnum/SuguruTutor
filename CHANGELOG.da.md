# Ændringslog

*English: [CHANGELOG.md](CHANGELOG.md)*

Nyeste øverst. Projektet har ingen versionshistorik, så datoerne til og med 20. november er regnet ud fra tidsstemplerne
på arbejdsfiler og skærmbilleder. En ændring kan være en dag ældre end vist, og de dage nævner kun de vigtigste ændringer.

## 22. november 2026 (2) · Suguru offline v37, Sudoku v3, build 2026-11-22b

### Ændret
- Engelsk er grundsproget i kode, kommentarer, guider og dokumentation; dansk er en oversættelse (`lang/da.js`).
  Danske telefoner får stadig dansk.
- Guiderne hedder `guide.html` (engelsk) og `guide-da.html` (dansk).
- Den engelske tilbage-knap og menupunktet hedder "Back to home" i stedet for "Home".
- Java-hæftet: engelsk som standard, dansk med `--lang da`; engelske navne på valgene, de danske virker stadig.
- Søgningen efter eksempler til Sudoku-guiden må tage op til 10 minutter (før 4).

### Tilføjet
- Sudoku-guiden har alle 14 teknikker, også det første eksempel på "begge veje"; hints linker til det.
- `CHANGELOG.md` og danske kopier af README-filerne.

## 22. november 2026 · Suguru offline v36, Sudoku v2, build 2026-11-22

### Ændret
- Hvis-så vælges efter samlet indsats (hele ræsonnementets længde), ikke efter slags, i hints, ruteanalyse og grad.
- Uden blyant koster lange hvis-så mere (nyt led `len`); en teknik inde i et hvis-så koster mindre (`inner` 0,6 → 0,25).
  8 af de 135 gemte opgaver fik en anden grad.
- Ruteanalysen: én lektion pr. overset let tal, de tre vigtigste først, resten under "Mere".
- Rådet ved et overset tal siger, hvor det kunne ses, i stedet for "kig efter lette tal".
- Forklaringer til nye spillere vises kun i de første 3 løste spil.
- Overskriften i spillet viser sværeste teknik, top og mængde i stedet for pladens størrelse.
- Graden i overskriften skifter til graden med blyant, når spillet tæller som spillet med blyant.

### Tilføjet
- Hvis-så med teknikker finder en modstrid med det samme, når et par, en tripel eller en nabo-eliminering giver en.
- Debug-noter har spillets træk med.

### Rettet
- Det samme oversete lette tal stod flere gange, når der blev lavet flere sværere træk, mens det ventede.

## 21. november 2026 · Suguru offline v35, Sudoku v1

### Tilføjet
- Sudoku: en ny app på den fælles kode, med egen grad, opgavekoder (`SD1-…` eller 81 tegn) og guide.
- En forside med begge spil; Suguru flytter til `suguru/`. Gamle ikoner på hjemmeskærmen og delte links virker stadig.
- Et hint, der blev åbnet ved en fejl, kan lukkes inden for 3 sekunder uden at tælle.
- "Del spillet": kopiér eller del linket til appen.

### Ændret
- Et hint tæller ikke, hvis du allerede havde valgt feltet og selv skriver hintets tal.
- Sudokus tidsestimat starter ved 8 sek. pr. let træk (Suguru's startværdi gav urealistisk korte tider).
- Valget af størrelse skjules, når et spil kun har én størrelse.

### Rettet
- Blyantstal 7–9 blev ikke tegnet i noter og hints.
- En gammel installation på hjemmeskærmen kunne blive ved med at vise versionen fra før flytningen.

## 20. november 2026

### Tilføjet
- Tre grader pr. opgave: med blyant, uden blyant og "som du plejede" for spil fra før blyantsbrug blev gemt.
- En blyant-indstilling: hvilken grad du ser, og hvilken nye opgaver vælges efter.
- Blyantens pris i spillet: hvad graden falder til, hvis du begynder at bruge blyanten.
- "Hvorfor er graden uden blyant højere?" i forklaringen af graden.
- Slutbilledet: pladen, som spillet endte, med hvor tallene kom fra, og hvor der stod fejl.

### Ændret
- Skalaen går over 10 (stoppede før ved 9,9).

## 19. november 2026

### Tilføjet
- Debug-noter på et spil og en debug-pakke at kopiere.
- Lagerplads: hvad der fylder, og oprydning af gamle rute-detaljer, mens statistikken bevares.
- Et komprimeret arkiv til ældre spil.

### Ændret
- Teknikker inde i et hvis-så tæller med i graden.

## 18. november 2026

### Tilføjet
- "Det vigtigste fra spillet" lige efter løsningen.
- En indstilling for, hvornår fejl vises.
- Fejl i ruteanalysen som episoder: hovedfejl, følgefejl og fejltryk.
- Statistikken delt i faner; tryk på en dag i aktivitetskortet for at se dens spil.
- Et afsnit om fremgang, med teknikfart målt mod din egen tidskurve.

### Ændret
- Graden kalibreret igen på 93 opgaver: par og tripler vejer mere.

## 14. november 2026

### Tilføjet
- En personlig grad i overskriften: hvordan opgaven sandsynligvis føles for dig.
- "Tænkt frem" i ruteanalysen: tal, du fandt ved først at sætte andre tal i hovedet.

## 13. november 2026

### Tilføjet
- Plader i ruteanalysen: dit træk ved siden af det letteste træk lige da.

### Ændret
- Gradens vægte tilpasset 17 opgaver med målt løsningstid.

## 12. november 2026

### Tilføjet
- Engelsk oversættelse.
- Mørkt tema.
- Arket "Hvorfor denne grad?" i spillet.

## 7.–11. november 2026: de første versioner

- 7. nov.: Java-generator og sværhedsvurdering, senere hæfter til print.
- 9. nov.: Suguru-strategiguide; webversion med hints (det letteste næste tal) og en decimal-grad.
- 10.–11. nov.: app, der kan installeres og virker offline, med ruteanalyse, statistik, fokusområde og dagens opgave.
