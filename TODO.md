# TODO

Things that are agreed or suggested, but not started. Done items move to the changelog.

## Fixes

### Practice expects game speed on boards you have never seen
- **The problem:** every practice board is new, and so is each new board in Quick call. Before you can find anything,
  you have to read the board: the regions, what is placed, where the gaps are. Your curve comes from real games, where
  you have already spent minutes on the board, so it has no time for that first look. The practice expectations are
  therefore too strict, most of all where a board is short: the technique drills (one find per board), What changed?,
  Sweep, Count them and Quick call. In Cascade it mostly hits the first number of each board.
- **Ideas:**
  - Add a "first look" allowance per new board to the expected time.
  - Measure that allowance from your own play rather than guessing it: the first number on a Cascade board against
    the later ones, and the first claim on a new Quick call board against the next claims on the same board.
  - The allowance may grow with board size and with how full the board is, which should be checked.
- **Check afterwards:** at your comfortable level, the level should hover around where it is instead of drifting
  down.
- **Data:** a temporary practice log has been collecting since 23 November: every board, with the time of each tap
  since the board appeared. It is in the export as `practiceLog`. Play some rounds of each game, export, and
  analyse; then remove the log (`plog` in `drill.js`).

### Small fixes
- **What changed?:** the explanation afterwards covers only the first new number, not all of them.
- **Sudoku triples drill:** finding a board takes 1.5–4 seconds (the first board of a round shows a spinner), and to
  find any at all it accepts boards where a pair would also do.

## Changes settled on

### One version, by build
- **Today:** there are three numbers. Each app's offline cache has its own version (`suguru-v50` and `sudoku-v16` in
  the `sw.js` files), and the shared build id `APP_BUILD` sits in `debug.js`. The changelog headings list all three.
  The build only shows up in debug notes, not in the settings.
- **Goal:** a single version for both apps, the build (like `2026-11-23b`), set in one place. The offline caches
  take their names from it, the changelog headings show only the build, and the settings show it in both apps.
- Bump it once per release instead of three numbers by hand. That also removes the risk of a forgotten cache bump
  leaving old files on a phone.

### More human explanations everywhere
- Cell references like "In the region with d5, d6, e6 and f6, 3 can only go in d5 and d6" are precise but hard to
  read. Where the board can show the cells (a highlight, an arrow, a colour), the text can point to them instead:
  "3 can only go in these two cells".
- Keep references where they are really needed: when no board is shown, when the text names cells that are not
  highlighted, or when two highlighted groups must be told apart.
- Then edit the texts to read like a person explaining: shorter sentences, the conclusion first, fewer nested
  clauses.
- Applies to the hints, the practice texts, the moments after the game, the route analysis and the guide. It
  touches many texts in both languages, so it goes best together with the statistics and solved-page rework below.

### Easier-to-read claims in Quick call
- Show the claim in big letters, short and close to the board. It is read under time pressure, so every word costs.
- Leave out cell names like "b2" when the board already shows which cell is meant. The highlighted cell plus
  "is 2" or "is easy" is enough; "a pair" over two highlighted cells needs no names at all.
- This is the first case of the general change above (More human explanations).

### Rework the statistics, the route analysis and the solved page
- **Why:** these are the hardest places to give learning value consistently. Too often they show numbers or long
  explanations rather than something you can act on next game.
- **Scope:** the statistics tabs, the route analysis sheet, and the solved page with its moments.
- **First step:** go through them screen by screen. For each, decide what you can learn from it, and cut or fold what
  doesn't help, in the spirit of the after-game board (show, don't tell; one thing at a time).

### One drawing code for the game board and the practice boards
Not now (23 November 2026).

- **Today:** the game board is drawn by `renderGrid` in `board.js`. The practice boards and the boards after the game use
  `miniBoard` in `analysis.js`. Input (fast taps, the cell under the finger, the number pad) has been shared since
  23 November.
- **Goal:** one drawing code that can show both the player's state (entries, notes, errors, selection) and the teaching
  layers (pattern highlights, struck-out options, circled answers, dashed follow-ons). The look, and any fix, would then
  be the same everywhere.
- **Risk:** it rewrites the main game's board. It needs the full browser test suite and screenshots on all device sizes.

### Analyse the export and screenshots for improvements
- Go through the latest export (games, moves, practice log) and the screenshots for things that can be improved:
  where the app misjudges, explains poorly or wastes time.
- The export now has more grading data (your games graded on the new scale with your times), but still from one
  player only. Use it to check the grade against your times, and keep in mind that it may not hold for others.

## Open items and ideas for the future

### Open questions
- **Grading:** rank chains and what-ifs by their length too, not only by their kind.
- **Pencil setting "with pencil":** should the heading show the without-pencil grade until the pencil is used? Today the
  heading and the solved sheet can show different numbers.
- **Expected times in practice:** What changed?, Sweep and Count them still use first guesses (your easy-number time
  times a factor). Check them against real rounds and adjust, as was done for Quick call and Cascade.
- **Count them:** a count that is off by one counts as a miss. Maybe count it as slow instead.
- **"Easy" one step later:** Count them and Quick call count only what the numbers on the board already show, so d3 = 3
  after c3 = 2 does not count, even though it is obvious. The rule is now on screen and the follow-ons are dashed.
  Decide whether to keep that rule, and keep an eye out for other cases where the game's definition and "obvious"
  differ.

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
- **Purpose:** learning and practising, not playing for numbers. A clear progression through all the techniques in
  order, from singles to the what-ifs, that makes you learn each one before you move on.
- **Progression, not statistics:**
  - The campaign shows where you are on the path and what comes next. That is its only measure.
  - Campaign games and drills stay out of the normal statistics.
  - Progress is shown plainly: no badges, stars or streaks.
- **Semi-adaptive:**
  - A step is passed by finding its technique on your own, several times, within your curve's time.
  - Where you are quick, the step is short. Where you struggle, the step adds practice before you move on, with
    boards that are a little easier at first.
  - Earlier techniques come back now and then, so they are not forgotten.
- **No hints:**
  - The campaign makes you work for it: there are no hints and no "Show me" during a board.
  - If you give up, the board is explained afterwards, as the lesson. The step then adds practice, and you meet the
    technique again before you can move on.
- **Switch between drills and real games:**
  - A step alternates short drills with real games.
  - A real game can start at the point where the technique is needed: you land in a real puzzle, part-solved, just
    before the move, and play it to the end from there. The technique then shows up in its natural setting, not
    only on a drill board.
  - Such a starting point can be found the same way as the drill boards: walk the solution and stop where the
    technique is the next step.
- **Start of a step:** one example board, shown and not explained in words (show, don't tell).
- **Today:** the technique drills already find boards where one technique is the next step, but only for levels 1–4
  and with no path or order.
- It is the natural frame for the training of the harder techniques above, and it needs that work first for levels
  5–11.

### Auto mode for the next game
- **Idea:** in New game, choose what kind of playing you want, and the app picks the next puzzle for you after every
  game. "New puzzle" on the solved page then follows that choice.
- **Choices, for example:**
  - **Relax:** a level you solve comfortably, no stretch.
  - **Challenge:** a little above where you are, so you have to work for it.
  - **Learn:** puzzles that need the technique you are working on (your focus area or the campaign step), using
    the existing option to require a technique.
  - Possibly **Mix**, which varies between them.
- **How it works:**
  - The choice stays until you change it. Manual, as today, is still possible.
  - Before a game starts, one line says what was picked and why, for example "Challenge: Hard 4.6, a little above
    your usual".
- **To decide:**
  - How each choice is worked out from your data: grade, size and technique, from your recent games and your curve.
  - Whether it adapts after each game (one easier after a struggle, one harder after an easy one).

### Guest mode
- **Idea:** when someone else plays on your device, their games must not count as yours.
- **What it does:**
  - A guest's games count in neither your statistics nor your curve, nor in what is built on them: the route analysis
    lessons, the focus area and the practice expectations.
  - Practice done as a guest does not change your practice levels.
  - A guest does not solve your daily puzzle for you or keep your days in a row going.
  - Your game in progress is put aside, not replaced, and comes back when guest mode ends.
- **How it works:**
  - A switch on the home screen or in the settings.
  - While it is on, it is clearly visible on every screen, so it is not left on by mistake.
  - It could turn itself off after the guest's game, or after some time.
- **To decide:** whether guest games are kept at all, for example in a separate history, or simply not saved.

### Microgrids (4×4) for Sudoku, and as speed training
- Suguru has 4×4 as a normal board size since 24 November. Still to do:
  - **Sudoku 4×4:** 2×2 boxes and the numbers 1–4. The Sudoku engine only knows 9×9 today.
  - **Speed training:** small boards solved one after another for pure speed (for example five in a row), with an
    expected time from your curve. A small board also means a short first look (see the item on new boards above).

### Timed trials
- A puzzle with a maximum time per board, where every number you place is final: no undo, no erase, no correction.
  It trains committing to a number only when you are sure, under time pressure.
- **To decide:**
  - What a wrong number does: the board is lost, or it costs time.
  - Whether pencil marks are allowed.
  - How the time limit is set: from your curve and the puzzle's grade, so it is tight but possible.
  - Whether a trial counts in the normal statistics or is kept apart.
  - Whether it is its own mode or a setting for a normal game.

