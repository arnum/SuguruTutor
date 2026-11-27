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

## Det næste tal efter pris (25. nov. 2026)

Den simulerede løser tager ikke længere den letteste teknik først. Den tager den billigste vej til et tal, prissat med
`whatIfCost` (de samme led som `stepEffort` "som du plejede at spille": genkendelse, længde, teknikker indeni,
hukommelse). Den prøver stadig teknikkerne fra den letteste, men når en vej er fundet, søges der i sværere teknikker, så
længe deres bund (metoden ved sin korteste) er under vejens pris. Trin, der kun fjerner muligheder, bruges helt og søges
videre derfra (som før), og hvor de fører hen, sammenlignes med sværere teknikker, der giver et tal direkte. En vejs pris
er dens dyreste trin. `link` (per teknik) lægger en pris per led ud over det første; den er 0, indtil tiderne støtter
den. Hvis-så-søgningerne får den fundne pris som loft, så slags, der ikke kan komme under den, springes over, og
kørslerne stoppes ved cirka det dobbelte af de led, de har råd til. JS og Java gør det samme, og paritetstesten dækker det.

**Regionsformer:** et felt, der rører alle felter i en region én mindre end dets egen, er en single af sin egen slags
(`shape`, score 0,5, teknik 0). Den bygger ikke på noget på pladen, så den har ingen afhængigheder i hvis-så-kæder.

**Det blandede par (26. nov. 2026):** et nøgent pars mål deles efter, hvordan de ser de to felter. Et mål, der rører
begge eller ligger i region med begge, hører til det almindelige par (teknik 3, niveau 3). Et mål, der ser det ene felt
gennem regionen og det andet kun ved at røre det, hører til det blandede par (teknik 14, niveau 4), som er sværere at få
øje på. I én spillers træk tog et blandet par en median på 69 s mod 16 s for et par, målet rører (9 og 5 træk).
Genkendelsen er sat mellem parret og triplen (2,6); fittet (r 0,744) ændrer sig næsten ikke mellem 2,2 og 3,4, fordi den
billigste vej sjældent kræver det (5 af 7.421 trin i 249 opgaver). Sudoku kan ikke have det: dér deler et felt,
der ser begge felter i et par, altid ét hus med begge. Niveauerne fra tripler og op rykkede ét op (tripler 5, kæder 6-8,
hvis-så 9-12, 13 = kan ikke lade sig gøre); tidskurven bruger et trin per niveau (`calL` i `calib.js`: det blandede par
3,5, resten som før), så de forventede tider for de andre teknikker er uændrede.

## Teknik-tabellen (27. nov. 2026)

`tools/grade/techniques.json` er det eneste sted, der kender teknikkernes rækkefølge. Den har to lister:

- **Enheder**, det en spiller lærer, og det appen viser som et niveau: en `code`, der aldrig ændres (niveaunumrene fra
  26. nov. 2026, frosset), et `id`, en `family` (basic, chain, whatif), et `rung` på tidskurven, flagene `drill`,
  `learn` og `rare`, `games` hvis kun nogle spil har den, og dens `methods`. Rækkefølgen i listen er rækkefølgen fra let
  til svær. Kode 13 (`guess`) betyder "kan ikke lade sig gøre uden at gætte" og kommer efter alle enheder.
- **Metoder**, det løseren finder (teknik-numrene 0-14, der kun bliver tilføjet til): motorens `weight` og flagene
  `pattern` (et mønster på brættet: synligheden tæller), `inner` (må bruges inde i et hvis-så med teknikker), `chain`,
  `byLength` (prissat efter længde) og `within` (for et hvis-så: den enhed, det må bruge indeni).

`gen.py` skriver tabellen og `techs.js` (spørgsmålene, `TT`) ind i begge `gradew.js`, og de samme data som konstanter
ind i `SuguruGrade.java` (med `rank`, `harder`, `max` og resten skrevet i hånden ved siden af). Reglen: **en kode er et
navn, ikke en plads.** Ingen kode sammenligner koder som tal; den spørger tabellen: `TT.rank`, `TT.harder`, `TT.beyond`
(sværere end de enkle tal), `TT.max`, `TT.list("drill")`, `TT.family`, `TT.rung`, og `TT.num` for det tal, spilleren
ser (enhedens plads i spillets rækkefølge, så Sudoku, der ikke har det blandede par, viser tripler som 4). Gemte data
(spil, øvelser, kampagne, træning) beholder koderne, så en ny enhed kræver ingen flytning af data.

**Tilføj en teknik:**
- *En variant af en, spilleren allerede kender:* en ny metode (det næste nummer) i den enheds `methods`, en finder i
  begge tutorer og begge bedømmere (`FIND`/`FINDERS` i JS, `find` i Java), dens række i `weights.json` og dens navn.
- *En ny enhed:* den næste ledige kode (14 og op), sat ind i listen, hvor den hører til, plus dens tekster:
  `LEVEL_TECH`, `LEVEL_INFO`, `TECH_TIP` og guiden i hvert spil. Afprøvet på en kopi: at gøre det skjulte par til sin egen
  enhed efter parrene krævede ingen kodeændring; JS og Java gav de samme sværhedsgrader på alle 249 testopgaver, én 4×4-
  opgave fik en anden sværhedsgrad, og generatoren lavede opgaver til den nye enhed.
- **Stadig i hånden:** teksterne per spil (navne, beskrivelser, tips, guidens ankre), og de to løsere i hvert sprog
  (generatorens bedømmer og tutoren), som ikke altid er enige.

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
