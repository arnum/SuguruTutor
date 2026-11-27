# TODO

Open work only. When something is built it leaves this file (the changelog has it). If its numbers still need setting
from data, a tuning task is added under "Tuning".

## Tuning
Built, but the numbers are guesses or rest on little data.

### Practice: par and level steps
- **Par per game** (`PAR` in `drill.js`): from 77 logged boards at the lowest levels. Triples has no data, Quick call
  one board, Cascade six. Sudoku's par is the Suguru par scaled by board size and `parScale` 1.8.
- **25 % per level,** and that one step up the board ladder costs as much as one level of speed: check how much longer a
  find takes per step up the ladder, per game.
- **The board-size scaling** (cells/36)^0.45, taken from the time curve.
- **How far the level moves per board** (half at first, a sixth after 20 boards) and the cap of 0.6.
- **Where level 0 lies:** about twice par. Check with a slower player if possible.
- **Data:** the practice log (`practiceLog` in the export) and each drill's own log record par and the level each board
  showed. About 30 boards per game and drill, at several levels, are needed; then set the numbers and remove the
  temporary log.
- **Check afterwards:** at your comfortable level, the level should hover where it is instead of drifting.

### The mixed pair: price and drill par
- Its recognition in the grade (2.6, between the pair 2.2 and the triple 3.0) and its drill's par (7.5 s per find) are
  guesses. The fit could not tell 2.2 from 3.4, because the cheapest way seldom needs it. Set both from its drill and
  campaign step once they have times.

### Campaign: the rating, the bar and practice
- The rating's numbers (campaign.js): the start (1500 ± 350, or 1600 ± 250 after 3 solved games that need the
  technique), the pass mark (rating − uncertainty 1450), the score (1 within your usual time, 0 at 2.5 times it), the
  limit for practising first (2 times), and the uncertainty growing 30 a day without a board. Today: nothing known, two
  quick boards pass; known, one; a slow board and a give-up need about four quick boards after.
- Whether practice games and drills should move the rating, instead of only unlocking a new try.
- How much practice unlocks a new try: 3 puzzles, 15 drill boards, or 5 training boards found without a hint.
- Whether practice should show improvement (your time for the technique falling) rather than only an amount.
- The board size (today the size chosen in New game, never 4×4).

### Timed trial: limit, rating and index
- The time limit (today about 1.2 to 1.3 times your usual time) and the index per grade (1.35).
- The rating's numbers (trial.js): 200 points per grade, the start (grade 3.0 ± 250 points), the floor for the
  uncertainty (70, so the level keeps moving), the board's own uncertainty (100), and 30 a day after a break. Today the
  first board in time moves you about 0.6 grade; after about 20 boards a board moves you less than 0.1.
- Whether a wrong number in hardcore should count as a loss instead of leaving the level.
- Whether the boards should vary in size, and whether Sudoku 9×9 trials need a shorter format (6×6 now exists).

### Price per link by method
- The weights have a price per link for each method (`link` in weights.json), at 0 because the times so far do not
  support one. Calibrate it from exports that carry each move's length (the route summary stores it), especially short
  what-ifs against long chains.

## Changes settled on

### Show, don't tell: what is left
- **Reach:** shading from a number to the cells it rules out. Today the ruled-out cells are only tinted.
- **Step numbers in the corners** where the order matters: `draw.js` can draw them (badges), but no explanation uses
  them yet.
- **The guide** still names cells in its examples.
- **Texts without a board** still use cell names: the route analysis's lists, "Well done" after the game, and the lesson
  heads in the route analysis, where the board is folded away.
- **Long what-ifs in steps.** Today a what-if is one picture: the orange cell, one arrow path through every number the
  assumption places (in solving order, not by cause), and the red clash. Techniques used inside the assumption (a pair
  along the way) are not drawn. Long ones become a tangle, and the arrows can mislead (an arrow from e4 to e5 only
  means e5 came next). Instead, step through it with the hint's Next button:
  1. **Assume:** only the orange cell ("Suppose this cell is 9").
  2. **A few stages,** each showing only what is new:
     - **singles:** at most about three new numbers, with the numbers that force them ringed (as in the hint's answer
       step); no arrows;
     - **a technique inside the assumption:** drawn as its normal hint (blue pair, yellow cells losing options), with
       the assumed orange numbers around it;
     - the numbers from earlier stages stay as orange digits without their markings. Stepping gives the order, so no
       numbering.
  3. **The clash:** the red cell with no options left, or the region with no room.
  4. **Back to the real board:** the orange cell loses the number.
  - **When:** only for what-ifs with more than about 4 numbers or a technique inside; short ones stay one picture.
  - **Both ways:** the same for each branch, one colour per branch.
  - **Scope:** explanations only (`stepShow` and the step-through in `tutor.js`, texts in both languages); grades, Java
    and stored data are untouched. The branch's steps are already recorded in order, including the techniques inside.

### Rework the statistics, the route analysis and the solved page
- **Why:** these are the hardest places to give learning value consistently. Too often they show numbers or long
  explanations rather than something you can act on next game.
- **Scope:** the statistics tabs, the route analysis sheet, and the solved page with its moments.
- **First step:** go through them screen by screen. For each, decide what you can learn from it, and cut or fold what
  doesn't help, in the spirit of the after-game board (show, don't tell; one thing at a time).
- **Found so far:**
  - **Statistics by grade ignore the board size:** "Solved by difficulty" shows best and average times per grade across
    all sizes, but a grade 3 on 6×6 and on 9×9 are different puzzles. Split by size, or use time per empty cell. The
    personal grade (`personalModel` in `calib.js`) has no size in it either.
  - **The concentration chart cannot be read:** what it shows and what to do about it is not clear. Redesign it or
    replace it with something shown on the board.
  - **Difficulty over time has a "Show as table" button:** tapping a point already gives the details, so the table
    adds little. Remove it, or say what it is for.

### Hints after the game, at any step
- **What:** after a game (solved, given up or timed out), step through your own solution move by move. At any move, get
  the hint you would have got there if you had asked: "at move 17 the hint would have shown this pair".
- **Why:** at a tricky spot you may have used a what-if where a pair was there. To get better at spotting pairs you
  want to see that hint, even if you were too stubborn to ask for it during the game.
- **How it could work:**
  - **Follow your route:** your moves in your order, the board as it was before each one, not the tutor's route.
  - **The hint:** at each move, the hint is the one the game would have given on that board, the cheapest way to the
    next number. It is shown as in the game: first the nudge, then the steps, then the answer.
  - **Where your move differs:** beside the hint, what you did, for example "you placed c3 = 4 with a what-if; the hint
    was a pair that gives b2".
  - **The tricky moves are marked** so you can jump between them: where the hint used a technique, where you were
    slow, where you used a harder technique than the hint, and wrong numbers.
- **Where:** from the solved page and the route analysis (also for campaign, timed trial and training boards), and from
  the statistics for older games that still have their moves.
- **Builds on:** the route analysis already replays your moves and knows, for each one, the easiest technique
  available. The moments after the game already show some of these boards, but only a few chosen ones.

### Relax and Learn adapt, like Challenge
- **Goal:** each mode keeps the effort and the progress constant as you get better, the way Challenge already does. Today
  only Challenge moves after each game (up 0.3 for a clean solve within your estimate, up 0.1 within 1.3 times it, down
  0.2 when slower, down 0.4 for hints or giving up, per board size). Relax is fixed at one grade under your usual, and
  Learn at your usual grade with the technique it picks.
- **Relax:** a target well within your estimate and without hints (for example about 0.8 times it). The grade moves to
  hold that: up when it was too easy, down when it was slow or needed hints. So it stays relaxing as you improve,
  instead of sliding into boredom.
- **Learn:** a target around your estimate, with the technique found without a hint. The grade moves for that
  technique: up when you found it quickly, down when you needed a hint for it or were slow, so the technique stays the
  hard part and not the rest of the board.
- **To decide while building:** the target and step sizes per mode (provisional, then a tuning task), and one grade
  per board size as in Challenge.
- **A mode does not pick the board size:** you choose it (decided 27 November).

### The technique table: what is left
The table is built (27 Nov.: `tools/grade/techniques.json`, see "Adding a technique" in `tools/grade/README.md`). Left:
- **Texts in the table:** each game's labels, descriptions, tips and guide anchors are still lists keyed by the unit's
  code or the method's number (`LEVEL_TECH`, `LEVEL_INFO`, `TECH_TIP`, `TECH_LABELS`, the guide's `LEVELS`). A new unit
  needs an entry in each.
- **One solver ladder:** the generator's rater and the tutor are still two solvers in each language, and they do not
  always agree on a puzzle's hardest technique (21 of 249 puzzles when last counted). Generation and hints should use
  one. Java parity still doubles every solver change unless the Java side is generated from the JS or dropped.
- **The fit per method:** `features.js` should report how well each method's price fits the times, so a variant can be
  priced on its own and the grade tried at a finer or coarser granularity.
- **Time per technique instead of rungs:** the time curve puts each technique on a rung (the table's `rung`) and fits
  time against it. A measured time per technique would drop the made-up rungs, once there are enough moves of each.
- **The route analysis compares by place, not price:** a move counts as "easiest" by the technique's place (the
  what-ifs as one tier), while the hints pick the cheapest way by price. Comparing by price would make the two agree.
- **Teaching order apart from price:** one order serves the campaign, New game and the solver. If the order you learn
  in should differ from the order of cost, the table needs a second order.

### Analyse the export and screenshots for improvements
- Go through the latest export (games, moves, practice log, training log) and the screenshots for things that can be
  improved: where the app misjudges, explains poorly or wastes time.
- The grading data is still from one player only. Use it to check the grade against your times, and keep in mind that
  it may not hold for others.

## Open items and ideas for the future

### Grading on 4×4
- The grade does not rank your 4×4 times (correlation 0.01 over 11 games, grades 4.2–5.7, about a minute each). Find out
  what it gets wrong there, or whether 4×4 needs its own weights.

### Named patterns
- The check against HoDoKu (27 Nov., see tools/grade/README.md) found the app's Sudoku ladder coarser than HoDoKu's: the
  short single-number chains (Skyscraper, 2-String Kite, X-Wing), the wings (XY-Wing, W-Wing), the fish (Swordfish) and
  uniqueness patterns fall inside the app's chains and what-ifs. One puzzle the app grades 8.2 (a single-number what-if)
  HoDoKu solves with a Swordfish.
- Add the common ones as named variants (their own name, guide entry, practice and price). Fish need their own search;
  the others are short chains the app already finds.
- **Suguru:** the wings (XY-Wing, W-Wing) work the same way, with "see" meaning touching or the same region, and may
  split like the pair (seen the same way or two ways). Fish need rows and columns, but a general form may exist: a
  number whose places in two regions lie in two 2×2 squares, one in each, so both squares hold it and their other cells
  lose it (with one region and one square it is neighbour elimination). Count with the solver how often it occurs
  before naming it.
- Compare the order within a band against times, not against HoDoKu: the two disagree there, and only times can say
  which is better.

### The shortest single-number chain as its own step (Suguru)
- The three-link single-number chain (only two places in a region, a touch, only two places in another region) is
  the Suguru version of the Sudoku skyscraper and two-string kite. It is 75 of the 92 single-number chain steps in
  your 222 puzzles, so it deserves its own name, guide entry and practice.
- As a new method in the single-number chain's unit: a finder, a weight and its texts, no new level (see "Adding a
  technique" in `tools/grade/README.md`).

### Shapes you recognise at a glance
- Other shapes that give a number whatever the numbers on the board, if any turn up.
- Training the shapes as shapes in practice, and region shapes as a campaign step.

### Grading experiments
Ideas from how others grade, none decided; run them on the exports.
- **First use dearer:** the second pair in a puzzle is cheaper than the first (sudokuoftheday charges X-Wing 2800 the
  first time, 1600 after).
- **Candidate density:** a step on a board crowded with candidates is harder to find (SudokuWiki's 2025 system).
- **A rating with uncertainty (Glicko) for the practice levels,** instead of fixed steps, as the campaign and the timed
  trial now have (27 Nov.). Only the player side applies, since each puzzle is played once.

### Drills for the chains and what-ifs
- Levels 6–12 (the three chains and the four what-ifs) can be practised on training boards, but have no drills. Look at
  how other trainers teach chains and forcing, then design.
- **Ideas to test, none decided:**
  - **Follow the chain:** a chain is started for you. Tap where each link leads, until it ends.
  - **Both ways:** a cell with two options. Follow each option, then tap what holds in both.
  - **To the clash:** a what-if is given. Place what it forces until two numbers collide.
  - **Where to start:** a board where a chain is the next step. Find a good starting cell.
  - **A ladder by chain length:** two links first (skyscraper and kite are short chains), then longer.
  - **What-if mode with colours** (the frame for "both ways" and "to the clash"):
    - You pick a cell and one of its options. Everything you place or cross out after that is drawn in that
      branch's colour. In "both ways" the second option gets a second colour.
    - The drill gives a step budget, for example "find the clash in at most 5 steps".
    - When the branch clashes, one button removes the branch and crosses out the option it started from.
    - In "both ways", one button keeps what both branches agree on.
    - Caution: a branch that runs on without a clash proves nothing unless it fills the whole board, so there is no
      plain "keep this branch" button.
    - It could later be an optional tool in the main game too.
  - **Two-option overlay as training wheels:**
    - A layer that dims the cells with three or more options and draws faint lines between cells with exactly two
      options that see each other: touching or in the same region in Suguru, in the same house in Sudoku.
    - That makes the skeleton of the two-option chains (the bivalue chain) visible.
    - It is on at the low levels of the chain drills, fades at the middle levels and is gone at the top. The level
      then measures whether you see the chains without it.
    - It could also be part of a hint in the main game.
  - **Repetition:** your own missed moments from games come back as drills later, or a fixed set of chain boards is
    repeated in faster cycles (the chess "Woodpecker" method).
  - **Mastery per technique:** for each technique, whether you spotted it yourself or had it shown (new, building,
    solid). That fits the hints after the game.
- **Keep from the earlier games:**
  - Use the technique, don't name it.
  - Make it short enough to be fun. A chain can take long to find.
  - Base the expected time on your curve, which only has times for these levels if you have played them.
  - Check every answer against a checker that is separate from the game's code.

### Campaign: not built yet
- **Earlier techniques coming back** now and then.
- **Grading errors in the ratings:** with one player, results never correct the grades, so a grading error goes
  straight into the campaign's and the timed trial's ratings. The trial allows half a grade for it.
- **Purpose (unchanged):** learning and practising, not playing for numbers. Progress is shown plainly: no badges,
  stars or streaks.

### Speed training on small boards
- Small boards solved one after another for pure speed (for example five 4×4 Sudoku in a row), with an expected time
  from your curve. Sudoku has 4×4 and 6×6 since 27 Nov.; a 4×4 Sudoku only ever needs singles.
