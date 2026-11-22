# Sværhedsgraden

*English: [README.md](README.md)*

Graden er bygget i tre lag, så tallene kan kalibreres uden at røre koden.

1. **Træk** (`web/shared/js/tutor.js`, `java/src/SuguruTutor.java`). Den simulerede løser finder det letteste næste tal og
   beskriver det sværeste mønster på vejen dertil: teknik, synlighed (form, hvor fyldt området er), hukommelse,
   længde, antal steder at komme videre, teknikker inde i et hvis-så, og trækkene nedenfor.
   `solveProfile` (`grade.js`) lægger det, der kræver flere placeringer, til: om mønstret er brugt før, og hvor langt
   inde i opgaven skridtet ligger.
2. **Vægte** (`tools/grade/weights.json`). Alle tal, og intet andet. `gen.py` skriver dem ind mellem markørerne
   `<gen:weights>` i `web/suguru/js/gradew.js` og `java/src/SuguruGrade.java`.
3. **Indsats** (`stepEffort` i begge filer). Hvert skridt koster `1 + genkendelse + hukommelse + længde + overblik +
   undervejs + blyant-led`. Opgavens grad er det tungeste skridt plus et tillæg for mængden af tunge skridt og for at
   det tunge kommer tidligt.

## Skalaen

Graden går fra 1 og op til `cap` (14,9, et sikkerhedsloft). Indtil 20. nov. 2026 stoppede den ved 9,9, men så klumpede
de sværeste opgaver uden blyant sig ved loftet. Ufjernet går de 142 testopgaver højst til 10,1 med blyant og 12,6 uden.
Der er stadig 9 navngivne niveauer: niveau 9 (Djævelsk) dækker alt fra 9 og op, og en opgave over 10 tæller som øverst i
niveau 9, når nye opgaver vælges.

## Blyant

Blyant-leddene står i `weights.json` som tre ting pr. led og teknik, og `gen.py` udleder graderne:

- `base`: de tilpassede tal (kun hukommelsen, 0,3, er ikke 0)
- `diff`: hvor meget sværere det er uden blyant (et kvalificeret skøn fra 20. nov. 2026)
- `anchor`: hvor stor en del af de spil, grundtallene er tilpasset, der blev spillet med blyant (0 = uden, 1 = med)

```
med blyant      = base - (1 - anchor) * diff
uden blyant     = base + anchor * diff
som du plejede  = base
```

`anchor` er sat ud fra spillerens egne ord: hvis-så og kæder over to-mulighedsfelter blev løst med blyant (1), tripler
nogle gange, når søgningen blev lang (0,5), og resten uden (0). Grundtallene gælder altså for den blandede måde at spille
på, og de to grader ligger på hver sin side af dem.

Historik: først var graden med blyant ankeret (tillæg uden blyant). 96 rene spil passede dårligere med tillæggene
(R² 0,58 mod 0,60), så ankeret blev flyttet til uden blyant (fradrag med blyant). Det pressede skalaen sammen med blyant
(alt fra par til hvis-så mellem 4 og 6), fordi de sværeste spil faktisk var løst med blyant. Derfor `anchor` pr. teknik.

Et spil gemmes med graden med blyant ved 3 eller flere noter, ellers uden. Spil fra før blyant blev registreret får
graden som du plejede (`g.tg`), så deres tal er de samme som før. Appen viser som standard graden uden blyant.

| Led       | Træk                                                                       | `diff` (uden minus med blyant)  |
|-----------|----------------------------------------------------------------------------|---------------------------------|
| `mem`     | ting holdt i hovedet samtidig, `w * log2(1 + n)`                           | 0,2 fra par og op (base 0,3)     |
| `tech`    | felternes muligheder skal huskes                                          | 0,3 til 1,5 pr. teknik           |
| `multi`   | felter med flere muligheder tilbage efter strygningen, højst 1 i alt      | 0,25 pr. felt                    |
| `trial`   | hvis-så fra et felt med 3+ muligheder: det strøgne tal skal huskes        | 0,3                              |
| `built`   | mønstret bygger på tidligere strygninger, `w * log2(1 + n)`               | 0,4                              |
| `repeat`  | samme mønster som ved en tidligere placering: sparer `w * genkendelsen`   | 0 (forberedt)                    |
| `partial` | delvis tripel ({1,2},{2,3},{1,3}) i stedet for tre ens felter             | 0 (forberedt)                    |
| `len`     | hvis-så: hele ræsonnementets længde, `w * log2(længde)`; de antagne tal skal huskes | 0,2 for hvis-så (skøn, nov. 2026) |

`trial`, `built`, `repeat` og `partial` beregnes for hvert skridt i både JS og Java, også når vægten er 0, og
paritetstesten sammenligner dem skridt for skridt.

## Hvis-så: længden afgør, ikke slagsen

De fire slags hvis-så (med ét tal, med enkle tal, begge veje, med teknikker) sammenlignes på indsats, ikke på slags.
Hints, ruteanalysen og graden vælger det hvis-så med mindst indsats (`whatIfCost` i `tutor.js`, samme regnestykke
som `stepEffort` "som du plejede"): genkendelse + længden af hele ræsonnementet (de skridt, det bygger på, antagelsen
og kædens relevante skridt) + teknikkerne inde i kæden + hukommelse. Et kort hvis-så med et par slår derfor et langt
med enkle tal. Hvis-så med teknikker, der konkurrerer, søges kun med teknikker op til tripler indeni og kun så langt,
at de kan blive kortere end det bedste andet. Et skridt i et hvis-så med teknikker, der giver en modstrid med det
samme, tages først i de første tre skridt, så det korte ræsonnement findes.

`inner` blev samtidig sænket fra 0,6 til 0,25: et par inde i et kort hvis-så må ikke koste mere end mange skridt.
I ruteanalysen er de fire slags ét trin, når et træk sammenlignes med det letteste lige da.

## Sådan kalibreres

1. Eksportér statistikken fra appen (Indstillinger, «Eksportér statistik») og læg filen et sted uden for repoet.
2. `node tools/grade/features.js eksport.json > spil.csv`
   Én linje pr. spil med tid, hjælp, blyantsbrug, begge grader og hvert led i det tungeste skridt med og uden blyant.
   Opsummeringen (stderr) viser, hvor godt graden følger log(tid) for rene spil, delt efter blyantsbrug.
3. Prøv et forslag uden at røre appen: kopiér `weights.json`, ret tallene, og kør
   `node tools/grade/features.js eksport.json --weights forslag.json > /dev/null`. Sammenlign opsummeringerne.
4. Når spil med registreret blyant er kommet til, kan `diff` tilpasses direkte (forskellen mellem spil med og uden
   blyant på samme slags opgaver), og `anchor` kan rettes, hvis den blandede måde at spille på ændrer sig.
5. Når et forslag er bedre: ret `weights.json`, hæv `fit` (så gemte spil og opgaver regrades), og kør
   `python3 tools/grade/gen.py`.
6. Kør paritetstesten, så JS og Java stadig giver samme grad og samme træk for hvert skridt.
   `python3 tools/grade/gen.py --check` fejler, hvis en af filerne ikke svarer til `weights.json`.

Et nyt træk kræver kode: beregn det i `build` i begge tutorer (eller i `solveProfile`, hvis det går på tværs af
placeringer), tilføj et led i `stepEffort` i begge filer, en række i `weights.json` og `gen.py` (`PEN` eller
`SCALARS`), og en forklaring i `penReason` (`web/shared/js/play.js`). Sæt vægten til 0 først og tjek, at ingen grad ændrer
sig; så er trækket rent tilføjet.
