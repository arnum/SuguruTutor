# Changelog

Newest first. Each heading is the build: the date of the release and a letter per release that day. The settings show
the build you have. Before 22 November there were no builds, so those headings are dates, worked out from the
timestamps of work files and screenshots. A change may be a day older than shown, and those days list only the main
changes.

## 2026-11-27a

### Added
- **Chains: colour and link options yourself.** A new button in the game, Chains, opens a bar with colour A, colour
  B, a strong link, a weak link, and Clear.
  - **Colours (simple colouring):** choose a number on the pad, then tap cells: that number's option gets colour A (a
    blue disc) or B (an orange square). Tap again to remove it. A cell that sees both colours of a number loses it;
    two cells of one colour that see each other mean that colour is false. The colours are blue and orange, which
    colour-blind players can tell apart, and the shapes differ too.
  - **Links:** tap two cells for a line between them: solid for a strong link (only two places, or only two
    options), dashed for a weak one (they see each other). With a number chosen, the line goes between that number's
    options; choosing another number between the two taps links a cell's two options. The same two ends again remove
    it. Lines are slightly bent, so a link along a row does not run through the numbers between.
  - **While it is on:** the pad chooses the number instead of placing one, the other pencil marks fade, and the cells
    where that number is placed are picked out. Tapping cells does not move the selection.
  - **They are notes:** they count towards the grade with pencil, are hidden while a hint is shown, are kept with the
    game, and are undone with Undo. A placed number removes that number's colours from the cells it sees, as it does
    with pencil marks. A timed trial has no chain tool, as it has no pencil.
- **A new technique: the mixed pair (Suguru, level 4).** Two touching cells with the same two options are those two
  numbers between them. When a cell sees one of them through its region and the other only by touching, that is
  harder to spot than a pair it sees the same way, so it is now a technique of its own between pairs and triples.
  - **Why:** in your 222 puzzles only 5 of the 177 pair steps were the simple pair inside one region, and 93 had a
    target that saw the pair two ways. In your recorded moves those took a median 69 s against 16 s when the target
    touched both (only 9 and 5 moves, so a hint, not proof).
  - **The hint explains it:** "The blue cells touch, so they cannot be the same number: between them they are 2 and 3.
    The yellow cell touches one of them and is in the outlined region with the other", with that region outlined. An
    ordinary pair over two regions now also says why: the two cells touch.
  - **"Easiest then" changes:** a mixed pair costs more than a pair, so the after-game analysis no longer calls it the
    easiest move when a pair or a hidden pair would do. The cheapest way seldom needs a mixed pair: 5 of 7,421 steps in
    249 puzzles.
  - **Its own place everywhere:** the guide (a real 5×5 example), New game's technique list, the campaign (a new step
    4), and a practice drill ("Find a mixed pair"). The "Next time" tip for pairs no longer describes only a pair
    inside one region.
  - **Levels from triples up moved one up:** triples 5, chains 6–8, what-ifs 9–12. Your statistics, practice levels,
    campaign, trials and training are moved along once when the app starts, and older exports when imported. The grades
    are recomputed (the triples drill keeps your level). The time curve places the mixed pair between pairs and
    triples, so the other techniques' expected times are unchanged.
  - **Grades:** most puzzles keep their grade; the fit to your times is the same (r 0.744). Java gives the same grades
    (the parity test on 249 puzzles). Sudoku cannot have a mixed pair (a cell that sees both cells of a pair always
    shares a house with both), so it has no step 4 inside, and it still shows its techniques as 1–11 (triples 4).
  - **Not redone:** the route analysis of games you have already played keeps its verdicts from the old solver; new
    games use the new one.
- **Training: start where the technique is next.** Choose a technique in New game (from neighbour elimination or locked
  candidates up) and switch on "Start where it is next". The board then starts part-solved, at the point where that
  technique is the next step.
  - **Once you have placed a number that needed the technique,** a bar under the board says so ("Single-number chain
    found in 01:12", or "placed with a hint") and offers "Next board". You can also play on to the end.
  - **A number that needs more than the technique** (a harder step, or a guess) does not count, and the board says so.
  - **Not part of the statistics.** Training boards are kept in their own log (in the export), and the time curve,
    grades and play modes never see them.
  - **Practice** has the chains and what-ifs (levels 6–12) as training boards, below the drills. Each row shows how
    many times you found it without a hint.
  - **The campaign** counts them: for the chains and what-ifs, 5 training boards where you find the technique without a hint
    unlock a new try, as do 3 puzzles that need it. Before, those levels had only puzzles as practice.
  - **The generator** now looks for a board whose easiest way really uses the technique when it has to start there.
    The campaign's part-solved boards use the same search. Before, in a sample of 6×6 boards, a third of those for the
    single-number what-if and half of those for the what-if with singles could not start there, because the easiest way
    (by price) used another technique.
- **Campaign: a bar per step, filled by a rating.** Instead of three good boards in a row, each board moves a rating
  for the step (Glicko-style, as chess and Lichess rate players), and a bar shows how far the step has come. A full bar
  passes it.
  - **How a board counts:** within your usual time counts fully, less the slower it was, nothing from 2.5 times it or
    when it was not solved without help. Early boards move the bar a lot; it moves less as it settles. After a long
    break it drops a little, until a board shows you still know the technique.
  - **How many boards:** with nothing known, two quick clean boards pass a step; if you have already solved 3 games
    that need the technique, one can. Slower boards need more. Over twice your usual time, or not solved without help,
    still means practising outside the campaign first.
  - **After a board** the sheet shows the bar with what that board added (lighter) or took away (red), and "one more
    quick board can pass" or "at least 3 more". Boards played before keep counting: they are replayed into the rating.
- **Campaign: an example board at the start of each step.** A real board where the technique is the next step, drawn as
  the hints draw it (the pattern, what it rules out, the legend), with "Step by step" for the whole explanation. It is
  on the campaign page, and on the sheet after the board that passes the step before. Open when the technique is new
  to you; folded away to one line when you already know it (3 solved games that need it, or a board of the step
  played). Found in the background the first time and kept on the device. The rarest Sudoku techniques (both ways,
  what-if with techniques) may not be found in the time; they are then left out until the next time the app starts.
- **Campaign: the first two boards of a step start part-solved, counted over the whole step.** A new try after
  practice starts from the beginning: seeing when the technique is needed is part of the lesson. Before, each try
  started with two part-solved boards.
- **Sudoku: small boards, 4×4 and 6×6.** New game offers 4×4 (2×2 boxes, numbers 1–4) and 6×6 (2×3 boxes, numbers
  1–6) next to 9×9.
  - **4×4 is for speed:** every 4×4 Sudoku is solved with singles alone (checked on all 3.5 million with 4–7 givens),
    so its grade stays under 2. New game says so, asks for no higher grade (no long search for what is not there),
    and Learn requires no technique on it. Pencil marks sit two by two, like the boxes. 4×4 games are a statistics scope
    of their own, as in Suguru; the other one is now called "6×6 and up".
  - **6×6** reaches the chains and sometimes a what-if; grades up to about 6.
  - **Codes:** SD1-6X6-… and SD1-4X4-…, and plain puzzles of 36 or 16 characters, load like the 9×9 ones.
  - **Unchanged:** the daily puzzle, the drills, the guide and the timed trial stay 9×9. A size chosen before is kept:
    the choice is now stored by its size, not its place in the list (in both games).

### Changed
- **Statistics, Concentration: a board instead of a chart.** The bar chart of lapses per 100 moves, with its colours,
  dashed line and notes on how it is measured, is gone. Instead:
  - **One sentence** on your last 20 games ("Fine…", or "In 2 of your last 20 games, easy numbers dragged on while
    others were waiting, or errors crept in") and **what to do** in bold: stop after two games when most lapses came
    in the 3rd game of a session or later, a short pause halfway when most came in the second half of a game,
    otherwise a break when easy numbers start to drag.
  - **The latest lapse on the board:** the number that took long ringed in orange, and the easy numbers that were
    there to take ringed in blue, with the numbers already placed in grey ("00:58 for the orange number, while the blue
    ones were just as easy").
  - The game's own line after a game no longer compares "lapses per 100 moves" with your usual.
- **The timed trial is rated with Glicko too,** instead of a fixed staircase (+0.25 in time, −0.25 otherwise, ±0.5
  for the first 5 boards). Each board is a game against the board: a win when it is solved in time, against the
  board's actual grade. The next board is at your rating, where you solve about half in time.
  - **It moves as much as it is unsure:** the first board in time moves you about 0.6 grade, and after about 20 boards
    a board moves you less than 0.1. After a break it moves more again. A wrong number in hardcore still leaves it.
  - **The trial screen is short:** the index, the number of boards, the chart with the index's likely range as a band,
    and the latest boards. The rules (one line) show only before a flavour's first board; the explanations of how the
    index is found and what 100 means are gone. The sheet after a board only says whether the next is harder or easier.
  - **Boards played before** are replayed into the rating once, so your index starts from your results so far, and
    their history is redrawn with it (one measure on the chart, not the old staircase).
- **Suguru 4×4 with regions of at most 4 cells:** asking for a grade above 4 now gives a 4 at once, instead of searching
  for 20 seconds and saying it could not find one. New game already said 4 is the highest there.
- **The route analysis is kept for your latest 200 games** instead of 40, to collect data for the grading
  experiments (about 2.3 KB per game). A setting of 40 is raised once; a smaller choice is kept, and Storage offers
  200, 40, 20, 10 or the latest only. When storage runs full, the old games' analysis is still removed first.
- **"Practise the technique" in the statistics' focus area** starts a training board for the chains and what-ifs (it
  used to open New game with the technique chosen). Singles to triples still open their drill.
- **A drill's "Show me" outlines the region** its explanation talks about ("the outlined region"), as the hints do.
- **Quick call's claims are a few big words under the board:** "Easy 4", "A pair", "Only places for 2". The board
  shows the rest: the blue cells, and for "only places" the row, column, box or region outlined. Screen readers and
  the list of misses afterwards keep the full sentence. With the setting "Cell names in explanations" the sentence
  with names is shown small under the big words.
- **Your time after a game, at a glance.** Under the heading: your time, a thin bar with a tick at the expected time,
  and the percentage ("04:32 ▬▬▬▬▬|▬ 120 %", with "expected 03:50" under the tick). Before, the estimate was a sentence
  ("Your estimate was 03:50. You took 1.2 times as long.") and the time sat among the facts. The campaign uses the same
  line, and the timed trial shows it against the limit.
- **The home screen is about playing.** At the top: Continue, the daily puzzle and New game. Below them, the other ways
  to play share one list, one line each with a short status: Campaign ("Step 2 of 11"), Timed trial ("Soft · index
  116") and Practice (the drill your last game suggests). Then one row with Statistics, Guide and Settings, without the
  small print. Everything fits on one phone screen.
  - **The daily puzzle** shows only the grade, the size and your days in a row (or "Solved").
  - **Practice** opens a sheet with the suggested drill first and all the others below it (before: a card plus a "More
    practice" link).
  - **Moved off the home screen:**
    - the puzzle code: to the bottom of New game ("Or load a puzzle code"), together with the rules;
    - guest mode: to Settings ("Let someone else play"). The band at the bottom still ends it.

### Changed (behind the scenes)
- **One table of techniques.** The order of the techniques, their families (basic, chains, what-ifs), which have a drill,
  which are rare and where they sit on the time curve now live in one table (`tools/grade/techniques.json`). The code
  asks the table ("is it a what-if?", "has it a drill?", "is it harder?") instead of comparing level numbers (about
  160 lines in 17 files), and the Java booklet generator reads the same table. A level's number is now a name that
  never changes, and the order is looked up.
  - **What it gives:** a new technique is an entry in the table, a finder and its texts, without renumbering or moving
    your stored data. Tried on a copy: making the hidden pair a step of its own after the pairs needed no code change,
    and JavaScript and Java still gave the same grades.
  - **Nothing else changes:** grades, hints, the route analysis and generated puzzles are the same as before (compared
    on 1,415 recorded results, the generator on fixed seeds, and Java on 249 puzzles), apart from the two fixes below.
  - **The numbers shown are the place in the game's order:** Suguru 1–12, Sudoku 1–11, in New game, the statistics and
    the guide.
  - **A typical time for a technique you have no moves for** follows the time curve's rungs again (it had used the new
    level numbers since the mixed pair came in).

### Fixed
- **Two slips from the mixed pair's renumbering (not in any build):**
  - **A what-if with techniques** could use only up to pairs inside its assumption, not triples. With triples back, 3
    of 249 test puzzles grade lower again, as in the last build (7.5 → 7.0, 7.6 → 7.2, 8.2 → 7.9).
  - **The hardest technique in a hint** was the highest technique number, so a hint with a mixed pair and a triple or a
    chain called the mixed pair the hardest. It now follows the table's order. No test puzzle's grade changed.

## 2026-11-25a

### New
- **Play modes in New game:** Manual (as before), Relax, Challenge and Learn. In a mode the app picks the grade from your
  own games, and one line says what and why ("Challenge: Very hard 5.2 · 6×6, a little above your usual 4.7 on this
  size"). The size stays your choice. "New puzzle" after a game and in the menu follows the mode.
  - Relax: a grade under your usual (the median of your latest 20 solved puzzles without hints on that size).
  - Challenge: a little above your usual to start with, then it moves after each game in the mode: +0.3 after a solve
    without hints at or under your estimate, +0.1 when somewhat slower, −0.2 when slow, −0.4 after hints or giving up.
    Kept per board size.
  - Learn: puzzles that need your focus technique (or the one you have met least), around your usual grade.
- **Campaign (first version):** a path through the techniques, one step each, in order, on the home screen.
  - **During a board:** there is no hint button and no check for errors, without any notice about it. "Give up" in the
    menu ends the board.
  - **After a board:** the sheet has the conclusion as its heading ("Singles passed", "Good board: 2 more to pass
    pairs", "Too slow to pass: practise pairs first"). Then come the time against your usual time, and the same
    analysis as after any game: the moments worth a second look, the route analysis and the final board.
  - **Statistics:** campaign boards are kept by the campaign (the latest 20, with their analysis), not in the
    statistics.
  - **Passing a step:** a step you already master is passed on its first board when you solve it within your usual time
    (your estimate for that board). Otherwise it takes 3 boards in a row without help, each within 1.5 times your usual
    time.
  - **Starting where the technique is needed:** the first 2 boards of a step start part-solved, at the point where the
    technique is the next step, and you finish the game.
  - **Practice in between:** when a board does not go well, the step waits until you have practised outside the
    campaign. That means 3 normal puzzles that need the technique, solved without hints, or 15 practice boards of it
    (singles to triples). The campaign offers both, and the practice games count in your statistics as usual.
  - **Step names:** the steps are the 11 technique levels. The numbers are a first guess, to be tuned.
- **Timed trial:** boards against the clock, on the home screen, in two flavours with a level and an index each.
  - **Flavours:** soft lets you erase and correct; in hardcore the first wrong number ends the board.
  - **The board:** always 6×6 (Sudoku 9×9). There is no pencil, no hints and no check, and the time left counts down.
  - **The difficulty follows you:** solved in time, the next board is 0.25 grade harder; time out or give up, it is
    0.25 easier (0.5 during the first 5 boards). A wrong number does not change it.
  - **A fixed point:** the time limit comes from the time model's starting point, which is the same for everybody, not
    from your curve. On your boards it is about 1.2 to 1.3 times your usual time. The index is 100 at grade 3.0 and
    rises about 35 % per grade.
  - **Its own statistics:** a screen with the index, the grade now, a chart of the index after each board and the
    latest boards. Trial boards are not in the normal statistics.
  - **After a board:** the result as the heading ("Solved in time: index 100 → 116"), then the same analysis as after
    any game.
- **Guest mode:** "Let someone else play" on the home screen. A guest's games, curve, practice levels and game in
  progress are kept apart and deleted when guest mode ends, so nothing they do counts in your statistics, curve,
  progress, practice, daily puzzle or days in a row. Your game in progress waits and comes back. A band at the bottom
  of every screen shows guest mode; tapping it ends guest mode, and it also ends by itself when the app is opened after
  30 minutes away. Export, import and reset are not available while it is on.

### Changed
- **One drawing code for every board** (`draw.js`): the game board and the small boards in practice, after the game
  and in the route analysis are drawn by the same code from what is on them (numbers, notes, the selection, rule breaks,
  highlights, options, assumptions, circled numbers). The game board looks exactly as before (checked pixel for pixel
  in both apps); the small boards now look like it (the same numbers, lines and frame). It is the base for showing,
  not telling, in the explanations.
- **Explanations show instead of tell.** Hints, the boards after the game and in the route analysis, and the
  practice texts point at the board instead of naming cells. Each step says its conclusion first ("The yellow cell
  cannot be 3."), then why in a sentence or two, about what the board shows:
  - blue cells for the pattern, with its own options picked out in small blue circles;
  - yellow for the cells that lose options (the lost ones struck out);
  - an outline round the region, row, column or box it is about;
  - a green ring on the placed numbers that do the work;
  - arrows for chains and what-ifs, from a solid orange ring where the assumption starts to dashed rings for what
    follows, and red for the contradiction;
  - cells that play no part dimmed, on bigger boards.

  A legend under the board names the colours shown, once, so the sentences never name colours you have not been shown.
  The colours are checked for colour blindness in both themes, and each role also has its own shape.
- **Setting: "Cell names in explanations"** (Help while playing, off by default). On, the explanations are worded with
  cell names as before (b3, the region with c3 and d3), and the whole chain in words comes back under a chain hint.
  Screen readers always get the version with cell names.
- **After the game, a number is shown as it is marked on the board**: a small ring in the board's colour instead of
  "c1 = 1" ("You searched 08:46 for ①"). The same holds for the boards' captions, the advice for next time ("The region
  had only one empty cell"), and errors ("It touched another 3").
- **Quick call's claims are shorter and name no cells:** "The blue cell is an easy 3.", "The blue cells are a pair.",
  "In their row, 5 can only go in the blue cells." When a claim missed a place, that place is yellow on the board
  afterwards.

### Changed (grading)
- **Region shapes count as singles.** A cell that touches every cell of a region one smaller than its own region cannot
  hold any of that region's numbers, so it is its own region's largest number whatever else is on the board (a cell in
  the bend of a 4-cell L, in a region of 5: 5; a 3-cell block next to a cell in a region of 4: 4). It is now found as a
  single, with its own explanation (the region outlined, "Region shape"). It came up in 111 of your 222 puzzles (148
  cells, never a given); the grader had priced 94 of them as neighbour eliminations. 77 of 249 test puzzles grade lower
  (on average 0.24), and the grade follows your times slightly better (0.736 to 0.742 within board size).
- **The next number is chosen by price, not by the order of the techniques.** Hints, the grade and the solver take the
  cheapest way to a number, priced as in the grade: how hard the method is, the length of the reasoning, techniques
  inside and memory. A short chain can now beat a triple, and a what-if can beat a long chain, while a pair stays cheaper
  than even a simple what-if. Where the steps first only remove options, where they lead is compared with the harder
  techniques. With the fitted prices this changes 7 of 249 test puzzles (mostly a triple replaced by a shorter chain,
  0.4 lower on average). Solving takes 1.2 to 1.4 times as long.
- **The price per link is prepared, but at 0.** The weights now have a price per link for each method, so a link in a
  what-if with techniques can cost more than one in a single-number chain. Your times do not support a price yet: even
  0.1 per link in chains lowered the fit (0.742 to 0.733), and making the one-step what-if in your 4×4 of 24 Nov.
  cheaper than the 6-link chain the grader used took what-ifs 0.9 cheaper and lowered it to 0.712. Your moves agree:
  a what-if took you a median 258 s, a pair 62 s and a single-number chain 84 s. The route analysis now stores the
  length of each move's reasoning, so the price per link can be calibrated from the next exports.
- **The route analysis counts the cheapest way as easy**, also when it uses a harder technique than the easiest one
  available (a short chain where a triple was possible).
- All stored games are regraded once.
- **The setting "with pencil" counts from the start.** A game played with that setting counts as played with pencil
  whether or not notes are written, so the heading and the solved sheet show the same grade. The notice of what the
  pencil will cost is only shown with the setting "without pencil".

### Changed (principles; the numbers are provisional and will be calibrated)
- **Practice is measured against par, not your game curve.** Each practice game has a fixed par per board: a first
  look plus a time per find, scaled by board size. Your curve no longer moves practice expectations, so getting faster
  in games no longer makes practice stricter, and the first look at a new board and knowing what to look for are both
  in par.
- **The practice level is a rating.** Each board shows a level: the level the board is set for, plus one for each
  25 % faster than par (minus one for each 25 % slower). Mistakes add time, and "Show me" counts as 1.5 levels below the
  board. Your level moves part of the way towards it: half at first, a sixth after 20 boards. The boards follow your
  level. The easiest boards are level 3, so levels 0–3 are room to get faster on them: a slow start still rises as soon
  as you get faster. Levels now run from 0 to 10, and your levels moved up by 3 to keep the same boards. The summary
  shows par at your level instead of what your curve expects.
- **4×4 is a game of its own in the statistics** (not in the menus). The statistics have a "5×5 and up / 4×4" switch,
  and 4×4 has its own statistics, progress, rating check and time curve, learnt from its own games. Its times no
  longer mix into the main ones, where a grade on 4×4 says little about the time.
- **"Does the rating fit?" measures properly:** puzzles without hints, time per cell on a log scale, and within each
  board size, with a table per size and one dashed line per size. Your main games: 0.75 (5×5 0.72, 6×6 0.71, 7×7
  0.91). Before, it mixed sizes and games with hints on raw seconds, and fell from 0.70 to 0.55 as you moved to smaller
  boards.

### Changed (storage and debug notes)
- **The games that matter keep their route analysis.** Clearing older route details (the moves behind the boards,
  moments and replays) now keeps, besides the latest 40 games:
  - **Games with debug notes not yet copied:** they keep their moves until the notes are copied, also when they move
    into the archive.
  - **Games worth a second look:** up to half as many as the latest (20 by default). A moment comes first, then a
    record, then help used or not solved, then an unusual time (under 0.4 or over twice your estimate). Newest first
    within each.

  Ordinary games are cleared first. If storage fills up, those worth a second look go next, and the noted ones last.
  Storage shows what is kept ("the latest 40, 2 with new debug notes and 20 worth a second look"). Before, an export
  could have lost the moves of exactly the games you wanted analysed: both screenshot games and three of five noted
  games on 25 November.
- **Debug notes once copied:** Settings → Debug notes shows how many are new.
  - **Copying:** "Copy new notes" copies only the new ones and marks them as copied, and "Copy all notes" is there
    too. Exporting the statistics and copying a game's debug packet also count as copying.
  - **Deleting:** "Delete copied notes" removes the copied ones and keeps new ones.
  - **Moves:** a game whose notes are all copied no longer keeps its moves for the notes' sake.

### Fixed
- **A moment after the game could show no board** (a long search for a triples number with nothing else easy on the
  board: the side shown first said "That was the only one" and had no board). The side now shows the numbers that
  were just as easy at the moment's own level ("Just as easy then"), and a side is never left without a board.
- **A what-if moment could not be followed.** The moment showed only the hardest step, so for b3 = 2 it proved b3 is
  not 3 but never why it is 2, and the board showed the answer in b3 where the text said "Assume b3 = 3 (orange)".
  The boards after the game now step through the whole explanation (‹ Step 1 of 3 ›), each step on its own board,
  with the assumption drawn in its cell and the answer circled on the last step only. The conclusion is no longer
  repeated after a what-if.
- **An equally easy number was called overlooked.** After a long search that ended in one of the easiest moves, the
  lesson named another number just as easy (e2 instead of your c2) and counted it as overlooked. The lesson is now
  the search for your own number, with the others that were just as easy beside it.
- **"Harder than needed" when the technique was needed anyway.** If solving on the easiest way would need a technique
  at least as hard before that cell is filled, the move was only done early. It now counts as one of the easiest
  ("needed anyway, done early"), with its time for its own technique, and is not a concentration lapse. In your
  latest 40 games, 34 of 37 "harder than needed" moves were of this kind.
- **The analysis credited a route in your head that you did not take.** A move that could be reached by easier
  numbers in your head, but took far longer than that usually takes you and is closer to your time for its direct
  technique, now counts as seen directly (a pair is counted as a pair, not as a 35-second single). The easier route
  is still named.
- **What changed?** explains every new easy number afterwards, not only the first.
- **Count them:** a count off by one is a near miss and counts like a wrong tap (slower), not as a miss. In the
  practice log, all 4 misses in 10 boards were off by one.
- **Sudoku triples drill:** a board for the next round is found while you play the last board of a round, so a round
  no longer starts with a wait, and boards where a pair would also do are only used when no exact one turns up.
- **A new build reaches the phone at once:** the offline copy now checks every file with the server instead of
  trusting the browser's own cache, so a new `build.js` is not missed for minutes.

### Changed
- **Board size is in the time model.** A bigger board takes longer to scan for every move (in your 3,900 moves, from
  0.6 of the 6×6 time on 4×4 to 1.3 times on 10×8). Your time curve now has a size term fitted to your moves, and the
  estimate uses the board's size. Before, small boards were overpriced and big ones underpriced.
- **The estimate is your typical puzzle, not the average.** A few long searches pull the average up, so most puzzles
  came in under it (in your latest 60, 0.82 of it). The estimate is now scaled to how your latest 60 puzzles have come
  out against it, so faster than the estimate is as common as slower.
- **The curve keeps your latest moves of each technique** (1,000 easy numbers, 60 of every other technique) instead
  of your latest 60 games, so a spell of easy games no longer makes it forget your pairs and chains.
- **Progress includes board size.** The index is now measured against your usual time for the grade and the board
  size. The rise to 112–127 in the last blocks came from moving to 4×4 and 5×5; with size in, those blocks are 75
  and 81, with wide bands.
- **Short times show tenths under 10 seconds** (3.4 s instead of 0:03), where 2 and 3 seconds are 50 % apart.

## 2026-11-24c

### Changed
- One version for both apps, the build, set in one place (`shared/js/build.js`). Each app's offline storage is named
  after it: a new build installs a fresh copy of every file and deletes the old one. Before, each app had its own
  storage version that had to be raised by hand, and a forgotten raise could leave old files on a phone.
- The settings show the build in both apps (before: "Suguru 2.0" and "Sudoku 1.0", which never changed). Exports
  include it too.
- The changelog headings show only the build.

## 2026-11-24b

### Changed
- Progress is shown, not concluded. The chart has one point per block of 20 puzzles without hints, counted back from
  the newest, so the last point is always your latest 20. A faded band around each point shows how sure it is, from
  the spread inside the block: where two bands do not overlap, the difference is more than chance. The verdict
  sentence, the first-against-latest comparison and its hidden test are gone. Overview shows the same chart.
- The grade slope behind the index is measured within blocks of puzzles played at the same time, so getting faster
  while moving to harder grades cannot hide in it. Index 100 is your usual speed for the grade over all your puzzles.
- Technique speed: one small chart per technique with the same blocks and bands (150 moves per point for singles,
  10–20 for the others), and a line listing the techniques with too few moves so far. Moves are now measured against
  your time curve fitted to all your moves. Before, it was the curve from your latest 60 games, including your own
  deviation per technique, so a technique you got faster at drifted back to 100.

## 2026-11-24a

### Added
- Suguru: 4×4 as a board size ("Micro"). With regions of at most 4 cells the highest grade is 4, and New game says so;
  with bigger regions higher grades are possible but rare.
- Region colours (Settings → Appearance, off by default): each region, or each box in Sudoku, gets a faint colour,
  and neighbouring regions never share one. On the game board and the practice and after-game boards, in light and
  dark mode, under every highlight.

### Fixed
- The page can no longer be zoomed by pinching or double-tapping.
- Sheets, such as the solved page, always open at the top. Before, a sheet could open where the previous one had
  been scrolled to, and the solved page stays at the top while its boards are drawn.

## 2026-11-23c

### Added
- A temporary practice log: every practice board with the time of each tap since the board appeared (and in Cascade
  how many easy numbers there were to choose from, in Quick call whether a claim was the first on a new board). The
  last 600 boards are kept on the device and included in the export. It is there to measure how long the first look
  at a new board takes (see TODO.md) and will be removed afterwards.

## 2026-11-23b

### Changed
- The practice screens now use the game's own input code instead of a copy: the same fast taps, the same way of
  finding the cell under the finger, and the game's number pad (same look and size on phone and tablet).
- Number keys work in the practice games with a pad (Cascade, Count them), like in the game.

### Fixed
- Sudoku: the number keys 7, 8 and 9 did nothing on a keyboard in the main game.

## 2026-11-23a

### Changed
- Practice boards, number pads and the true/false buttons react when the finger lands, like the main game, instead
  of when it lifts. Fast taps are no longer lost when the screen redraws between them.
- Cascade's number pad stays in place (greyed out until you tap a cell), and the heading no longer changes, so nothing
  moves under your finger.
- The tap that places the last number can no longer also press "Next board", which appears in the same spot.

## 2026-11-22m

### Changed
- Cascade measures seeing, not finger speed: the time from tapping a cell to choosing its number (up to a second per
  number) no longer counts. A 14-second board with 8 numbers now counts as about 8 seconds.

## 2026-11-22l

### Changed
- Practice levels are shown from 0 to 6 instead of 1 to 6.9: the start is an empty bar, and each whole number is one
  board level passed. Your levels are kept; they just read one lower.
- After every round: your typical time per board and what your curve expects, so you can see what it takes to move up.

## 2026-11-22k

### Changed
- Quick call expected one right answer per easy-number time on your curve (about 20 in a minute at 3 seconds), so
  even a good run hardly moved the level. It now expects 1.5 times that per claim (about 13), and the summary shows
  the number your curve expects.

## 2026-11-22j

### Added
- **Quick call**, a fifth practice game: claims about a board ("e4 = 3 is an easy number", "b2 and c3 are a pair",
  "in this region 3 can only go in d5 and d6"), true or false, as many as you can in 60 seconds. A wrong answer costs
  5 seconds. The false claims are near misses. Afterwards you can see the ones you got wrong, with the board and why.
  The one place with a clock: the pressure is the game.

### Fixed
- Technique drills: a real pattern that removes nothing on the board counted as a wrong tap, even on its first cell.
  An audit of generated boards found that most real pairs and triples were such patterns. Every real pattern is now
  recognised; one that gives no number says so and costs nothing.
- Sweep: when the pattern was a hidden pair or triple, its own cells are the ones that lose options, but the game
  ignored taps on them, so about a third of the boards could not be finished. Fixed.
- Count them: a number that follows from a circled one (one step later) is now shown dashed and explained, and the
  pencil marks after the answer take the circled numbers into account. The rule says to count only what the numbers
  already on the board show.
- A number one step later (it needs another of the right numbers first) is explained instead of counted as a wrong
  tap, in the singles drill, after finding a pattern, and in What changed?. A cell that was already easy is explained
  there too.
- Sweep explains a tap on a cell that sees the pattern but has nothing left to lose.

## 2026-11-22i

### Added
- Four practice games, each training one part of seeing, with their own level (1.0 to 6.9) like the drills:
  - **Cascade:** place a run of 8 to 12 easy numbers (tap a cell, then its number); each one can open the next.
    Three boards per round. "Show one" places a number for you and costs a little.
  - **What changed?:** one number drops onto the board; find the new easy numbers it made.
  - **Sweep:** a pattern is given (neighbour elimination or locked candidates, a pair or a triple); tap every cell that
    loses an option. The cells strike out what they lose.
  - **Count them:** how many easy numbers are on the board? One answer; a wrong count shows them all.
- Higher levels mean bigger boards, no pencil marks and positions earlier in the puzzle, and per game: longer runs,
  more new numbers, harder patterns or more numbers to count.
- Time is measured against your own curve for easy numbers, so the levels mean the same as in the drills.
- The practice chooser ("More practice" on the home screen) lists techniques and games; the games also appear in
  Statistics → Technique once played.

## 2026-11-22h

### Fixed
- Practice: the text after a find could describe a different elimination than the board showed. When two numbers are
  locked to the same cells (2 and 3 only in d5 and d6, say), the board struck out only one of them while the text
  explained the other. Now everything those cells eliminate is shown, the text explains exactly that, and every number
  it gives counts.

## 2026-11-22g

### Changed
- Statistics: long explanations are folded. Notes on how something is measured sit behind "How it's measured", and a
  long introduction shows its first sentence with "More". Findings, numbers and short texts stay as they are.
- Focus area: the curve's times per technique moved into "How it's measured", next to the explanation of the curve.

## 2026-11-22f

### Changed
- The practice level chart no longer zooms: it always shows the whole range, 1 to 6.9, with every whole level marked.

## 2026-11-22e

### Changed
- Practice levels are decimal numbers (1.0 to 6.9) that move a little after every board: faster than your curve gives
  up to +0.3, slower down to -0.3, "Show me" -0.4. A board a bit faster than the curve still counts a little.
- Within a whole level, the decimals move the boards slightly earlier in the puzzle (more empty cells), so a higher
  level also means slightly harder boards.
- The level chart zooms to the levels it passes through, so a rise of a few tenths shows. The level bars fill partly.

## 2026-11-22d

### Added
- Practice: short rounds of five boards where one technique is the next step (singles, neighbour elimination or
  locked candidates, pairs, triples). Find the pattern, then tap the cell it gives a number. "Show me" reveals it.
- The level adapts quietly per technique (six levels): quick finds move it up, slow ones or "Show me" move it down.
  No clock or level during play; after the round: the result, the level over the last two weeks, and all techniques.
- A practice card on the home screen (the technique from your last game) and practice levels in Statistics → Technique.
  "Practise the technique" in the focus area starts a drill for singles to triples.
- Practice levels are included in export and import.

### Changed
- After the game: up to three moments shown straight away on the board, one per number. On a phone, tap the board or
  the switch to see your own move; on a tablet both boards side by side. A clean game shows the final board.
- The solved sheet is shorter: a small stamp, the facts on one line, then the board. "New puzzle" and
  "Practise {technique}" come right after it. The concentration line appears only when something was off.

### Fixed
- "had only 1 empty cells" now reads "had only one empty cell".

## 2026-11-22c

### Changed
- iPhone and iPad: the board is as large as the screen allows, and the number pad never ends up below the screen.
- iPad: a wider layout with larger buttons; the route analysis shows its two boards side by side.
- Landscape: the board on the left at full height, the controls on the right. The apps are no longer locked to portrait.
- The activity map keeps its phone size on a tablet.

### Fixed
- On a phone in landscape the board ran off the screen and the number pad was out of reach.

## 2026-11-22b

### Changed
- English is the base language in the code, comments, guides and docs; Danish is a translation (`lang/da.js`).
  Danish phones still get Danish.
- The guides are `guide.html` (English) and `guide-da.html` (Danish).
- The English back button and menu item say "Back to home" instead of "Home".
- Java booklet: English by default, Danish with `--lang da`; English option names, the Danish ones still work.
- The Sudoku guide search may take up to 10 minutes (was 4).

### Added
- The Sudoku guide covers all 14 techniques, including the first example of "both ways"; hints link to it.
- `CHANGELOG.md`, and Danish copies of the READMEs.

## 2026-11-22

### Changed
- What-ifs are chosen by total effort (the whole reasoning's length), not by kind, in hints, route analysis and grade.
- Without pencil, long what-ifs cost more (new term `len`); a technique inside a what-if costs less (`inner` 0.6 → 0.25).
  8 of the 135 saved puzzles changed grade.
- Route analysis: one lesson per overlooked easy number, the three most important first, the rest under "More".
- Advice for an overlooked number says where it could be seen, instead of "look for easy numbers".
- Explanations meant for new players are shown only for the first 3 solved games.
- The game heading shows the hardest technique, peak and load instead of the board size.
- The grade in the heading switches to the grade with pencil once the game counts as played with pencil.

### Added
- What-ifs with techniques find a contradiction straight away when a pair, triple or neighbour elimination gives one.
- Debug notes include the game's moves.

### Fixed
- The same overlooked easy number was listed several times when several harder moves were made while it waited.

## 2026-11-21

### Added
- Sudoku: a new app on the shared code, with its own grade, puzzle codes (`SD1-…` or 81 characters) and guide.
- A front page with both games; Suguru moves to `suguru/`. Old home-screen icons and shared links still work.
- A hint opened by mistake can be closed within 3 seconds without counting.
- "Share the game": copy or share the link to the app.

### Changed
- A hint does not count if you had already chosen the cell and type the hinted number yourself.
- Sudoku's time estimate starts at 8 s per easy move (Suguru's start value gave unrealistically short times).
- The size choice is hidden when a game has only one size.

### Fixed
- Pencil numbers 7–9 were not drawn in notes and hints.
- An old home-screen install could keep showing the version from before the move.

## 2026-11-20

### Added
- Three grades per puzzle: with pencil, without pencil, and "as you used to play" for games from before pencil use was recorded.
- A pencil setting: which grade you see and which one new puzzles are chosen by.
- The pencil's price in the game: what the grade drops to if you start using the pencil.
- "Why is the grade without pencil higher?" in the explanation of the grade.
- Final board: the board as the game ended, with where the numbers came from and where errors stood.

### Changed
- The scale goes above 10 (was capped at 9.9).

## 2026-11-19

### Added
- Debug notes on a game, and a debug package to copy.
- Storage: what takes up space, and clearing old route details while keeping the statistics.
- A compressed archive for older games.

### Changed
- Techniques used inside a what-if count in the grade.

## 2026-11-18

### Added
- "Key takeaway from the game" right after solving.
- A setting for when errors are shown.
- Errors in the route analysis as episodes: main error, follow-on errors and slips.
- Statistics split into tabs; tap a day in the activity map to see its games.
- A Progress section, including technique speed measured against your own time curve.

### Changed
- Grade recalibrated on 93 puzzles: pairs and triples weigh more.

## 2026-11-14

### Added
- A personal grade in the game heading: how the puzzle will probably feel for you.
- "Thought ahead" in the route analysis: numbers you found by placing others in your head first.

## 2026-11-13

### Added
- Boards in the route analysis: your move next to the easiest move at that moment.

### Changed
- The grade's weights fitted to 17 puzzles with measured solving times.

## 2026-11-12

### Added
- English translation.
- Dark theme.
- "Why this grade?" sheet in the game.

## 2026-11-07 to 2026-11-11 · first versions

- 7 Nov: Java generator and difficulty rater, later printable booklets.
- 9 Nov: Suguru strategy guide; web version with hints (the easiest next number) and a decimal grade.
- 10–11 Nov: installable offline app with route analysis, statistics, focus area and the daily puzzle.
