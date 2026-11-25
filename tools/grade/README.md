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
