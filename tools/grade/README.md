# The difficulty

*Dansk: [README.da.md](README.da.md)*

The grade is built in three layers, so the numbers can be calibrated without touching the code.

1. **Features** (`web/shared/js/tutor.js`, `java/src/SuguruTutor.java`). The simulated solver finds the easiest next number
   and describes the hardest pattern on the way there: technique, visibility (shape, how full the area is), memory,
   length, the number of places to make progress, techniques inside a what-if, and the features below.
   `solveProfile` (`grade.js`) adds what needs several placements: whether the pattern has been used before, and how far
   into the puzzle the step is.
2. **Weights** (`tools/grade/weights.json`). All the numbers, and nothing else. `gen.py` writes them in between the markers
   `<gen:weights>` in `web/suguru/js/gradew.js` and `java/src/SuguruGrade.java`.
3. **Effort** (`stepEffort` in both files). Each step costs `1 + recognition + memory + length + overview +
   along the way + pencil terms`. The puzzle's grade is the heaviest step plus an addition for the amount of heavy steps
   and for the heavy part coming early.

## The scale

The grade goes from 1 up to `cap` (14.9, a safety ceiling). Until 20 Nov. 2026 it stopped at 9.9, but then the hardest
puzzles without pencil bunched up at the ceiling. Uncapped, the 142 test puzzles go up to at most 10.1 with pencil and
12.6 without. There are still 9 named levels: level 9 (Diabolical) covers everything from 9 up, and a puzzle above 10
counts as the top of level 9 when new puzzles are chosen.

## Pencil

The pencil terms are in `weights.json` as three things per term and technique, and `gen.py` derives the grades:

- `base`: the fitted numbers (only memory, 0.3, is not 0)
- `diff`: how much harder it is without pencil (an educated guess from 20 Nov. 2026)
- `anchor`: how large a share of the games the base values are fitted to was played with pencil (0 = without, 1 = with)

```
with pencil          = base - (1 - anchor) * diff
without pencil       = base + anchor * diff
as you used to play  = base
```

`anchor` is set from the player's own words: what-ifs and chains over two-option cells were solved with pencil (1),
triples sometimes, when the search got long (0.5), and the rest without (0). So the base values apply to the mixed way of
playing, and the two grades lie on either side of them.

History: at first the grade with pencil was the anchor (an addition without pencil). 96 clean games fitted worse with the
additions (R² 0.58 against 0.60), so the anchor was moved to without pencil (a deduction with pencil). That squeezed the
scale with pencil (everything from pairs to what-ifs between 4 and 6), because the hardest games were in fact solved with
pencil. Hence `anchor` per technique.

A game is stored with the grade with pencil at 3 or more notes, otherwise without. Games from before pencil use was
recorded get the grade as you used to play (`g.tg`), so their numbers are the same as before. By default the app shows
the grade without pencil.

| Term      | Feature                                                                    | `diff` (without minus with pencil) |
|-----------|----------------------------------------------------------------------------|------------------------------------|
| `mem`     | things kept in mind at once, `w * log2(1 + n)`                             | 0.2 from pairs up (base 0.3)       |
| `tech`    | the cells' options must be remembered                                      | 0.3 to 1.5 per technique           |
| `multi`   | cells with several options left after the elimination, at most 1 in total | 0.25 per cell                      |
| `trial`   | what-if from a cell with 3+ options: the eliminated number must be remembered | 0.3                             |
| `built`   | the pattern builds on earlier eliminations, `w * log2(1 + n)`             | 0.4                                |
| `repeat`  | the same pattern as at an earlier placement: saves `w * recognition`      | 0 (prepared)                       |
| `partial` | partial triple ({1,2},{2,3},{1,3}) instead of three equal cells           | 0 (prepared)                       |
| `len`     | what-if: the length of the whole reasoning, `w * log2(length)`; the assumed numbers must be remembered | 0.2 for what-ifs (a guess, Nov. 2026) |

`trial`, `built`, `repeat` and `partial` are computed for every step in both JS and Java, also when the weight is 0, and
the parity test compares them step by step.

## What-ifs: the length decides, not the kind

The four kinds of what-if (single-number, with singles, both ways, with techniques) are compared on effort, not on kind.
Hints, the route analysis and the grade choose the what-if with the least effort (`whatIfCost` in `tutor.js`, the same
calculation as `stepEffort` "as you used to play"): recognition + the length of the whole reasoning (the steps it builds
on, the assumption and the chain's relevant steps) + the techniques inside the chain + memory. So a short what-if with a
pair beats a long one with singles. Competing what-ifs with techniques are searched only with techniques up to triples
inside and only so far that they can become shorter than the best other one. A step in a what-if with techniques that
gives a contradiction straight away is taken first in the first three steps, so the short reasoning is found.

`inner` was lowered at the same time from 0.6 to 0.25: a pair inside a short what-if must not cost more than many steps.
In the route analysis the four kinds are one tier when a move is compared with the easiest at that moment.

## The next number by price (25 Nov. 2026)

The simulated solver no longer takes the easiest technique first. It takes the cheapest way to a number, priced with
`whatIfCost` (the same terms as `stepEffort` "as you used to play": recognition, length, techniques inside, memory). It
still tries the techniques from the easiest, but once a way is found, harder techniques are searched as long as their
floor (the method at its shortest) is below its price. Steps that only remove options are applied in full and searched on
from there (as before), and where they lead is compared with harder techniques that give a number directly. A way's price
is its dearest step. `link` (per technique) adds a price per link beyond the first; it is 0 until the times support it.
The what-if searches get the price found as a cap, so kinds that cannot get under it are skipped and runs are cut at
about twice the links they can afford. JS and Java do the same, and the parity test covers it.

**Region shapes:** a cell that touches every cell of a region one smaller than its own region is a single of its own kind
(`shape`, score 0.5, technique 0). It builds on nothing on the board, so it has no dependencies inside what-if chains.

**The mixed pair (26 Nov. 2026):** a naked pair's targets are split by how they see the two cells. A target that touches
both, or shares a region with both, belongs to the ordinary pair (technique 3, level 3). A target that sees one cell
through its region and the other only by touching belongs to the mixed pair (technique 14, level 4), which is harder to
spot. In one player's moves a mixed pair took a median 69 s against 16 s for a pair the target touches (9 and 5 moves).
Its recognition is set between the pair and the triple (2.6); the fit (r 0.744) hardly changes between 2.2 and 3.4,
because the cheapest way seldom needs it (5 of 7,421 steps in 249 puzzles). Sudoku cannot have it: there a cell that
sees both cells of a pair always shares one house with both. The levels from triples up moved one up (triples 5, chains
6-8, what-ifs 9-12, 13 = cannot be done); the time curve uses a rung per level (`calL` in `calib.js`: the mixed pair 3.5,
the rest as before), so the expected times of the other techniques did not change.

**The mixed triple (28 Nov. 2026):** the triple split the same way. A target that sees the three cells in different ways
(some through its region, the rest by touching) belongs to the mixed triple (technique 15, unit 14, rung 4.5 between the
triples and the chains). Recognition 3.4, between the triple (3.0) and the chain's longer forms. The solver uses it 6
times in 253 test puzzles; before, those steps counted as ordinary triples. Suguru only, for the same reason as the
mixed pair. Its reference time is the nearest fitted level below plus the slope times the log of the rung ratio
(`fit_reference.py`), until enough games have it.

**The short single-number chain (28 Nov. 2026):** the three-link chain (two regions where a number has two places, one
touch between them) is its own method (16) inside the single-number chain's unit (code 6), not a unit of its own. It
was 75 of the 92 single-number chain steps in one player's games, so the chain's numbers were mostly its numbers. The
solver tries it before longer chains (technique 7 starts at four links in Suguru), weight 19 against 20, priced by
length like the chain. Grades: one of 253 test puzzles moved from 7.3 to 7.2, because finding the shortest chain first
gave an easier route. Sudoku keeps one chain (there the three-link forms are skyscrapers and kites).

**The nook (28 Nov. 2026):** a cell x that touches every cell of a region but one, y, while x's own region is no
bigger, has the same number as y: x's number is one that region holds, and every other place there touches x. Each
keeps only the options the other has. Method 17 in neighbour elimination's unit (code 2), Suguru only; the pairs
follow from the shapes, so both raters and both tutors list them once per board. Counted before it was added: with only
the singles it gives a number at 286 of 930 basic steps in one player's 243 puzzles, and it made a chain or a what-if
unnecessary at 45 of 226 hard steps in the test puzzles (9 of 113 in the player's). Its recognition is neighbour
elimination's (0.6): the fit on the 128 games without pencil was 0.469 at 0.6 and 0.475 at 2.2, so the times cannot
tell, and it is as quick to spot. Grades: 86 of 252 test puzzles changed, 71 down (35 by a whole grade or more), 15 up
by at most 0.4; the mean fell from 5.83 to 5.46. `fit` went to 14. It is left out of neighbour elimination's drill (the
method flag `noDrill`), which asks for the places of one number. The Java grader now takes the pattern flag from the
table (`METHOD_PATTERN`) instead of a list of technique numbers.

**XY-Wing and W-Wing (28 Nov. 2026):** named the way the short chain was, as methods of their chains' units (Suguru
only; Sudoku keeps them inside its chains for now). XY-Wing (18, unit 7) is the two-option chain with three strong links,
three cells; the two-option chain (8) then starts at four in Suguru (with two it is a pair, found earlier). W-Wing (19,
unit 8) is the mixed chain of one shape: x=y in a cell with options x and y, y between its two places in a region, y=x
in a second cell with the same options (`isWing` in tutor.js, `isW` in both raters, which now keep the chain's path).
The mixed chain (9) leaves that shape out in the tutor, so a step is not listed twice. Weights 21 and 23, between the
chains' (20, 22, 24); recognition as their chains. In 253 test puzzles the solver uses XY-Wing 14 times and W-Wing once;
4 grades moved down by 0.2–0.3. Before they were added the counts were: XY-Wing gave a number where the short chain did
not at 4 of 113 hard steps in one player's games (14 of 226 in the test puzzles), W-Wing at 5 (11).

## The technique table (27 Nov. 2026)

`tools/grade/techniques.json` is the only place that knows the techniques' order. It has two lists:

- **Units**, what a player learns and what the app shows as a level: a `code` that never changes (the level numbers of
  26 Nov. 2026, frozen), an `id`, a `family` (basic, chain, whatif), a `rung` on the time curve, the flags `drill`,
  `learn` and `rare`, `games` if only some games have it, and its `methods`. Their order in the list is the order from
  easy to hard. Code 13 (`guess`) means "cannot be done without guessing" and ranks after every unit.
- **Methods**, what the solver finds (the technique numbers 0-19, only ever appended to): the engine's `weight` and the
  flags `pattern` (a shape in the board: visibility counts), `inner` (allowed inside a what-if with techniques), `chain`,
  `byLength` (priced by length), `within` (for a what-if: the unit it may use inside) and `noDrill` (left out of its
  unit's drill).

`gen.py` writes the table and `techs.js` (the questions, `TT`) into both `gradew.js` files, and the same data as
constants into `SuguruGrade.java` (with `rank`, `harder`, `max` and the rest written by hand next to them). The rule:
**a code is a name, not a position.** No code compares codes as numbers; it asks the table: `TT.rank`, `TT.harder`,
`TT.beyond` (harder than the singles), `TT.max`, `TT.list("drill")`, `TT.family`, `TT.rung`, and `TT.num` for the
number shown to the player (the unit's place in that game's order, so Sudoku, which has no mixed pair, shows triples as 4).
Stored data (games, drills, campaign, training) keeps the codes, so a new unit needs no migration.

**Adding a technique:**
- *A variant of one the player already knows:* a new method (the next number) in that unit's `methods`, a finder in both
  tutors and both raters (`FIND`/`FINDERS` in JS, `find` in Java), its row in `weights.json`, and its label.
- *A new unit:* the next free code (15 and up), placed in the list where it belongs, plus its texts: `LEVEL_TECH`,
  `LEVEL_INFO`, `TECH_TIP` and the guide in each game. Tested on a copy: splitting the hidden pair into its own unit
  after the pairs needed no code change; JS and Java gave the same grades on all 249 test puzzles, one 4×4 puzzle got
  another grade, and the generator made puzzles for the new unit.
- **Still by hand:** the texts per game (labels, descriptions, tips, guide anchors), and the two solvers in each
  language (the generator's rater and the tutor), which do not always agree.

## How to calibrate

1. Export the statistics from the app (Settings, "Export statistics") and put the file somewhere outside the repo.
2. `node tools/grade/features.js export.json > games.csv`
   One line per game with time, help, pencil use, both grades and each term in the heaviest step with and without pencil.
   The summary (stderr) shows how well the grade follows log(time) for clean games, split by pencil use.
3. Try a proposal without touching the app: copy `weights.json`, change the numbers, and run
   `node tools/grade/features.js export.json --weights proposal.json > /dev/null`. Compare the summaries.
4. Once games with recorded pencil use have come in, `diff` can be fitted directly (the difference between games with and
   without pencil on the same kind of puzzles), and `anchor` can be corrected if the mixed way of playing changes.
5. When a proposal is better: edit `weights.json`, raise `fit` (so stored games and puzzles are regraded), and run
   `python3 tools/grade/gen.py`.
6. Run the parity test, so JS and Java still give the same grade and the same features for each step.
   `python3 tools/grade/gen.py --check` fails if one of the files does not match `weights.json`.

A new feature needs code: compute it in `build` in both tutors (or in `solveProfile` if it spans placements), add a term
to `stepEffort` in both files, a row in `weights.json` and `gen.py` (`PEN` or `SCALARS`), and an explanation in
`penReason` (`web/shared/js/play.js`). Set the weight to 0 first and check that no grade changes; then the feature is
cleanly added.

## Checked against HoDoKu (Sudoku, 27 Nov. 2026)

108 Sudoku puzzles from the app's generator, 12 per grade band, were graded by HoDoKu 2.2.0 (`/bs`, its level and
score). The scripts are in `hodoku/` (`gen.js` makes the puzzles, `compare.py` runs HoDoKu and compares; the jar is not
in the repo). Neither grader is the truth: this shows where they agree, not which is right.

- **The order agrees overall:** Spearman 0.92 between the app's grade and HoDoKu's score. Band 1 is HoDoKu's Easy,
  bands 2–4 its Medium, band 5 mostly Hard, bands 6–7 Hard to Extreme, bands 8–9 Extreme.
- **Within a band they do not agree:** Spearman between −0.54 and 0.55 per band (about 12 puzzles each, so mostly
  noise). The agreement comes from the technique ladder; the fine order inside a band is where the app's weights
  (fitted to one player's times) and HoDoKu's fixed step scores differ, and only times can say which is better.
- **The techniques line up:** the app's levels 1–5 use the same techniques as HoDoKu (singles, locked candidates,
  naked pairs, naked triples). Where the app needs a single-number chain, HoDoKu mostly uses Skyscraper, X-Wing or
  2-String Kite; a bivalue chain is mostly W-Wing or XY-Wing; where the app needs a what-if, HoDoKu uses long chains
  (AIC, nice loops, XY-chains), and sometimes a fish: one puzzle the app grades 8.2 (single-number what-if) HoDoKu
  solves with a Swordfish and calls Hard (600).
- **So the app's ladder is coarser:** HoDoKu's named patterns (fish, wings, the short single-number chains, uniqueness)
  fall inside the app's chains and what-ifs. That matters for teaching (players know the names) and for the grade of
  puzzles a fish solves.
