# TODO

Things that are agreed or suggested, but not started. Done items move to the changelog.

## Fixes

### Calibrate practice par and level steps
- **Built 25 November (the principles):** practice is measured against a fixed par per game, not your game curve, and
  the level is a rating: each board shows a level (the board's level, plus one per 25 % faster than par), and your level
  moves part of the way towards it. The easiest boards are level 3, so 0–3 is room to get faster on them. See the
  comment "Levels" in `drill.js`.
- **Provisional, to calibrate:**
  - Par per game (`PAR` in `drill.js`): from 77 logged boards at the lowest levels. Triples has no data, Quick call one
    board, Cascade six. Sudoku's par is the Suguru par scaled by board size and `parScale` 1.8, a guess.
  - 25 % per level, and that one step up the board ladder costs as much as one level of speed: check how much longer a
    find takes per step up the ladder, per game.
  - The board-size scaling (cells/36)^0.45, taken from the time curve.
  - How far the level moves per board (half at first, a sixth after 20 boards) and the cap of 0.6.
  - Where level 0 lies: about twice par. Check with a slower player if possible.
- **Data:** the practice log keeps collecting (`practiceLog` in the export), and each drill's own log now also records
  par and the level each board showed. About 30 boards per game and drill, at several levels, are needed; then set the
  numbers and remove the temporary log.
- **Check afterwards:** at your comfortable level, the level should hover where it is instead of drifting.

## Changes settled on

### Show, don't tell in the explanations
Settled 25 November: the explanations point with colours and markers on the board instead of cell names, and say the
conclusion first. The one drawing code they need was built on 25 November (`draw.js`). The plan:

- **1. What the board must be able to show** (new layers in `draw.js`, each optional, the same on every board):
  - **Roles with fixed colours** instead of today's three highlights: the pattern (blue), the numbers that do the work
    (a ring on them), the cells that change (yellow), a contradiction (red), the answer (circled). Each role also has a
    shape (solid tint, outline, ring, cross), so colour is never the only cue, and the colours are checked for colour
    blindness and in both themes.
  - **Single options:** mark one option in a cell (the pair's two numbers in blue in both cells; the removed one struck;
    the one left circled) instead of colouring the whole cell.
  - **Region outlines:** a region drawn with a coloured border, instead of "the region with c3, d3, b4, c4 and d4".
  - **Reach:** the cells a number rules out (its neighbours in Suguru, its row, column and box in Sudoku), lightly
    shaded from the number that does it.
  - **Arrows and order:** arrows between cells for chains and what-ifs (b3 = 3 → d2 = 3 → e4 = 3 → no room), and
    small step numbers in the corners when the order matters.
  - **Focus:** dim the cells that play no part, and an "only this number" view (all the 3s and the places 3 can go).
  - **A legend line** under the board, built from the roles shown ("■ the pair ■ loses an option ○ the answer"), so the
    colours are explained once and never in the sentences.
- **2. What the explanations must hand over** (`tutor.js`): today a step has its text with cell names plus pattern,
  target, options and an assumption. It must also say which placed numbers do the work, which options belong to the
  pattern, which region it is about, and the links of a chain, as data the board draws.
- **3. The texts:** conclusion first, then why in one or two short sentences, pointing at roles ("This cell is 2. The
  orange 3 leaves no room for a 3 in the red region."). Cell names only where no board is shown, for the answer if it
  helps, or to tell two groups apart. Every step keeps a full version with cell names for screen readers (the board's
  label). Both languages.
- **4. Order of work:** the drawing layers first, tested on fixed positions in both themes (the two screenshot cases from
  23 November are the first examples); then the game's hints, where the step-through already is; then the boards after
  the game and in the route analysis; then the practice texts and Quick call's claims (below); the guide last.
- **Done 25 November:** steps 1–3 and in step 4 the hints, the boards after the game and in the route analysis, the
  practice texts and Quick call's claims. Decided while building:
  - the palette (blue pattern, yellow change, purple outline, green ring for the numbers that work, orange arrows;
    checked for colour blindness in both themes); region tints stay on beneath it;
  - cells that play no part are dimmed to about half, and only when the step uses at most 60 % of the board;
  - arrows are slightly curved, so chains that cross stay readable;
  - a setting brings the cell names back (off by default).
- **Still to do:**
  - **Reach:** the shading from a number to the cells it rules out. Today the ruled-out cells are only tinted.
  - **Step numbers in the corners** where the order matters: drawn by `draw.js` (badges), but no explanation uses them yet.
  - **The guide**, which still names cells in its examples.
  - **Texts without a board stay with cell names:** the route analysis's lists, "Well done" after the game, and the
    lesson heads in the route analysis, where the board is folded away.
  - **Long what-ifs with techniques** (eight or more cells) give a tangle of arrows. Numbering the order or showing
    the chain in a few steps may read better.

### Easier-to-read claims in Quick call
- **Done 25 November:** the claims name no cells (unless the setting is on). Still open: the claim in big letters,
  close to the board.
- Show the claim in big letters, short and close to the board. It is read under time pressure, so every word costs.
- Leave out cell names like "b2" when the board already shows which cell is meant. The highlighted cell plus
  "is 2" or "is easy" is enough; "a pair" over two highlighted cells needs no names at all.
- This is the first case of the general change above (Show, don't tell in the explanations).

### Rework the statistics, the route analysis and the solved page
- **Why:** these are the hardest places to give learning value consistently. Too often they show numbers or long
  explanations rather than something you can act on next game.
- **Scope:** the statistics tabs, the route analysis sheet, and the solved page with its moments.
- **First step:** go through them screen by screen. For each, decide what you can learn from it, and cut or fold what
  doesn't help, in the spirit of the after-game board (show, don't tell; one thing at a time).
- **Found so far:**
  - **Statistics by grade ignore the board size:** "Solved by difficulty" shows best and average times per grade across
    all sizes, but a grade 3 on 6×6 and on 9×9 are different puzzles. Split by size, or use time per empty cell. The
    personal grade ("how a puzzle will probably feel to you", `personalModel` in `calib.js`) has no size in it either;
    the time curve, the estimate and the progress index got it on 25 November.
  - **The concentration chart cannot be read:** what it shows and what to do about it is not clear. Redesign it or
    replace it with something shown on the board.
  - **Difficulty over time has a "Show as table" button:** tapping a point already gives the details, so the table
    adds little. Remove it, or say what it is for.

### Analyse the export and screenshots for improvements
- Go through the latest export (games, moves, practice log) and the screenshots for things that can be improved:
  where the app misjudges, explains poorly or wastes time.
- The export now has more grading data (your games graded on the new scale with your times), but still from one
  player only. Use it to check the grade against your times, and keep in mind that it may not hold for others.

## Open items and ideas for the future

### Open questions
- **Grading on 4×4:** the grade does not rank your 4×4 times (correlation 0.01 over 11 games, grades 4.2–5.7, about a
  minute each). Find out what it gets wrong there, or whether 4×4 needs its own weights. 4×4 is a game of its own in
  the statistics since 25 November, with its own curve, so its times no longer bend the others.
- **Price per link by method:** the weights have a price per link for each method (`link` in weights.json), at 0
  because the times so far do not support one (see CHANGELOG, 25 Nov.). Calibrate it from exports that carry each move's
  length (the route summary stores it from 25 Nov.), especially short what-ifs against long chains.

Closed 25 November: the grade with the setting "with pencil" counts from the start; Count them and Quick call keep the
strict rule (only what the numbers on the board already show) and show the follow-ons afterwards; chains and what-ifs
are compared by price.

### Shapes you recognise at a glance
- **Done 25 November:** a cell that touches every cell of a region one smaller than its own region is a single ("Region
  shape"). Only shapes that give a number whatever the numbers on the board count.
- Still open: other shapes of that kind (if any turn up), and training the shapes as shapes in practice.

### How do others grade puzzles?
- Look at how other puzzle apps and solvers grade Sudoku and Suguru (by technique, by number of steps, by solving
  time from many players, and so on), to compare with this app's grading or get ideas.
- Or come up with an alternative approach of our own and compare it with the current one on the same puzzles.
- Today's grading is calibrated on one player's times; a different approach could show where that is a weakness.

### Training for the harder techniques
- **Today:** practice covers levels 1–4 (singles, neighbour elimination or locked candidates, pairs, triples).
- **Missing:**
  - the chains: single-number chain, bivalue chain, mixed chain
  - the what-ifs: single-number what-if, what-if with singles, both ways, what-if with techniques
- **First step:** find out how these can be practised. Look at how other trainers teach chains and forcing (colouring,
  for example), then design.
- **Ideas to test, none decided:**
  - **Follow the chain:** a chain is started for you. Tap where each link leads, until it ends.
  - **Both ways:** a cell with two options. Follow each option, then tap what holds in both.
  - **To the clash:** a what-if is given. Place what it forces until two numbers collide.
  - **Where to start:** a board where a chain is the next step. Find a good starting cell.
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
- **Keep from the earlier games:**
  - Use the technique, don't name it.
  - Make it short enough to be fun. A chain can take long to find.
  - Base the expected time on your curve, which only has times for these levels if you have played them.
  - Check every answer against a checker that is separate from the game's code.

### Campaign mode
- **First version built 25 November** (campaign.js):
  - one step per technique level (11 steps);
  - a fast first board (within your usual time) passes the step, otherwise 3 boards in a row within 1.5 times it;
  - the first 2 boards start where the technique is the next step;
  - a board that does not go well sends you to practice outside the campaign (3 puzzles that need it, or 15 practice
    boards), and then you try again;
  - no hints, kept out of the statistics.
- **To tune once played:**
  - the bars (1.0 and 1.5 times your usual time), the number of boards, and how much practice;
  - whether practice should show improvement (your time for the technique falling) rather than only an amount;
  - the board size (today the size chosen in New game, never 4×4).
- **Not built yet:**
  - **A lesson after a failed board** beyond the moments and the route analysis (which the sheet shows, as after any
    game): for example the step that was missed, explained on the board.
  - **An example board** at the start of a step, shown and not explained in words.
  - **Earlier techniques coming back** now and then.
  - **The harder techniques' practice** (levels 5–11 have no drills yet, so their practice is normal games only; see
    "Training for the harder techniques").
  - **Region shapes** as a step of their own.
- **Purpose (unchanged):** learning and practising, not playing for numbers. Progress is shown plainly: no badges,
  stars or streaks.

### Play modes: Mix, and more to decide
- Relax, Challenge and Learn were built on 25 November. Still open: **Mix**, which varies between them from game to
  game; whether Relax and Learn should also move after each game; and whether a mode should pick the board size too.

### Microgrids (4×4) for Sudoku, and as speed training
- Suguru has 4×4 as a normal board size since 24 November. Still to do:
  - **Sudoku 4×4:** 2×2 boxes and the numbers 1–4. The Sudoku engine only knows 9×9 today.
  - **Speed training:** small boards solved one after another for pure speed (for example five in a row), with an
    expected time from your curve. A small board also means a short first look (see the item on new boards above).

### Timed trials
- **Built 25 November** (trial.js): soft and hardcore, 6×6, no pencil, a staircase on the grade (±0.25), a time limit and
  an index from a fixed point (the time model's starting point; index 100 = grade 3.0), kept apart from the statistics.
- **To tune once played:** the time limit (today the fixed time 1.0×, about 1.2 to 1.3 times your usual time), the step
  sizes, and the index per grade (1.35). Whether the boards should vary in size, and whether Sudoku 9×9 trials need a
  shorter format.
