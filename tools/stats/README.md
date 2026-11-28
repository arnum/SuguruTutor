# The statistics model: Focus, Skill and Performance

The numbers on the solved page's seal and in the statistics come from one model, `web/shared/js/statmodel.js`. This
file documents every number in it. The design and its reasons are in `TODO.md` ("Statistics: Skill, Focus and
Performance").

## In short
Every move is measured against a fixed reference time. The many easy moves (the basics) show how this game compares
with your usual: **Focus**, a %. The hard steps show what you can do: **Skill**, a grade (what you can solve plus how
fast). **Performance**, a grade, is the level one game showed: its time against what your own record predicts. Focus
and Skill come from different moves. Grades can be checked against the labels on the puzzles you play.

Attention can only be measured against your own usual, so Skill is your level at your usual attention: a habit (always
playing with the TV on, the kids around) moves it by its share; one evening barely does.

## The conditions the three numbers meet together
- **C1** Performance centres on Skill.
- **C2** x % faster at the hard steps raises Skill and Performance by log(1 + x) ÷ log `PER_GRADE` grades.
- **C3** Focus uses none of Skill's data and the other way round.
- **C4** One grade of what you can solve equals one grade of speed (`PER_GRADE`, measured).
- **C5** No trend with the puzzle's grade or the board size, in Focus or in Performance − Skill.

They are tested three ways: `sim.js` (simulated players, abstract moves), `realpath.js` (simulated players solving real
generated puzzles, their raw moves and hints going through the app's own route analysis), and `conditions.js` (every
export).

## The record a game leaves (route analysis → `smSteps`)
- Each placement: the technique the board needed (N: the route analysis's `avail`), the one you used (U), its time
  (wrong numbers on the way included) and its own time.
- **A hint is an event in the moves** (`{hint: technique, hc: cell, t}`, written when the hint counts); the route
  analysis marks the placement of that cell `hint`. A step is a miss if a hint, a guess or a check for errors got you
  past it.
- A need is filed under N; a find counts towards the speed of U. A move made with a harder technique than needed is a
  find of N (you got past it yourself) whose time is U's.
- Older games: hints only as techniques (`hintTechs`, methods → units): a miss each, with no time, and that game's finds
  of those techniques left out. The per-move summary (`route.ctx`) knows only U: speed and Focus, no needs.

## The reference time of a move (`STAT_REF`, `fit_reference.py`, Suguru, 243 games, refitted 28 Nov 2026 with the levels corrected)
On the log of seconds: `lv[level]` + places (2; 3 or more; and `pMoreBasic` × log(places ÷ 3) for the basics: with many
moves available each is found sooner) + `fill`, `fill2` (basics: slowest about half way) + size × log(cells ÷ 36) +
`len` × log(1 + length) (chains, what-ifs) + `gradeBasic` / `gradeHard` × (grade − 4). The first move of each game is
left out; after a first fit, moves more than 8 times their prediction (interruptions) are left out and the fit repeated.
Levels with fewer than 12 moves: the nearest fitted level below plus a line in log(rung)'s slope (rungs from the
technique table). The reference is the fitted typical time × `expert` 0.5.
`spread` 0.73 is the robust spread of one move (log); `spreadHard` 1.29 that of a hard step alone (a find takes 3 to 5
times longer or shorter by itself), for the uncertainty of Skill's speed and the expected time's draws. `hardMid` 0.29:
the fitted player's hard steps against the fit, interruptions included, read as Skill reads finds (the middle-half
mean of the logs). `readStart` (`readstart.js`, run by the fit with the new reference): the fitted player's typical
game reading, read by `statmodel.js` itself (median over the exports' games at grade 4; `focus` with the wrong-number
seconds, `time` without, `sd` its robust spread between games), where a player's normal starts.
- **`gradeGame`** 0.067: at the game level, a game's basics take longer per grade beyond the moves (longer searches
  before an easy move in a harder puzzle). Focus's normal is moved to the game's grade by it (C5).
- **`perGrade`** 1.86 (83 games): how much longer the hard steps take per grade at 6×6. One grade of
  speed (a convention, measured; whole games grow less, ×1.32, because the basics barely do).
Sudoku has no exports yet: its `statref.js` is a copy of Suguru's, so Sudoku shows Focus only.

## Focus
- **The reading**: log(time on this game's easy moves ÷ their reference). Easy moves: a basic the board needed and you
  used, not hinted; the first move left out; `W_WRONG` = 5 s per wrong number.
- **Your normal**: the median of your last `N_NORMAL` = 15 readings on this board size from before this session (a
  session ends after `SESSION_GAP` = 30 minutes), each moved to this game's grade by `gradeGame`. A size with fewer than 5
  readings borrows the pooled readings, shifted towards its own. Held still during a session.
- **Before any reading:** `readStart`, moved to the game's grade.
- **Focus** = 100 × exp(normal − reading). Its 90 % band is luck: ±1.645 × √(sGame² + sNorm²), where sGame =
  √(exp(σ²) − 1) ÷ √(the effective number of easy moves, (Σ ref)² ÷ Σ ref²: a sum weighs long moves more), σ = your own
  spread (the median of the robust spreads of the easy moves' log times in the games your normal is made of; `spread`
  until there are 5), and sNorm = 1.25 × the robust spread of the normal's readings ÷ √(their number) (`readStart.sd`
  until there are 5): how well your normal is known.

## Skill = the repertoire + your speed (a grade)
- **What feeds it:** games on 5×5 and up (`MIN_CELLS`: a 4×4 has too few moves, and its spotting and speed would carry
  over unadjusted), with their moves (older games' per-move summary doesn't know what the board needed). Errors are
  marked on a copy of the moves (`markErrors`), so a slip's time counts once and a rebuild gives the same seals. In an
  older hinted game (hints known only as techniques), that game's needs and finds of the hinted techniques are left out.
- **Spotting** per hard technique: a Beta posterior over its last `WIN` = 40 needs. Its start (weight `K_SPOT` = 3)
  is layered: the family's rate (all its techniques together) pulled towards `START_SPOT` = 0.3 by how little the
  family has (`K_FAM` = 10), and never above the next easier technique in the family. Rare techniques claim only what
  the evidence supports.
- **Completion**: attempts not given up (drills), Beta with start `START_DONE` = 0.95 weighing `K_DONE` = 3.
- **Mastery** = spotting × completion; the basics: their fluency, 1 while your normal pace (the median, over your last
  40 games, of each game's median basic ÷ reference) is at most `FLUENT` = 3, falling in a line to 0 at 10 × 3.
- **The repertoire** = 1 + the area under the clean-solve curve: for each puzzle in the frozen grade profile
  (`STAT_PROFILE`, `tools/grade/profiles.js`: 330 Suguru at 6×6, 200 Sudoku at 9×9) the product of the mastery of the
  techniques its cheapest route used, each once; averaged per 0.25 grade; made to only fall; from grade 1 to the top.
- **Speed**: per hard technique, the middle-half mean of the logs of its last `WIN_FIND` = 80 finds (`smMid`: the
  quickest and slowest quarter left out; ÷ reference; cued finds × `CUE`: drill 1.6, campaign and training 1.3), pulled
  towards your speed on all hard techniques together (`K_TECH` = 5), which is pulled towards the typical player
  (`K_OWN` = 10). A find counts only where the board needed a hard technique. Finds are two-peaked (a quick spot or a
  long search, about one in ten quick), so a median flips between the peaks as finds come and go; the middle-half mean
  moves smoothly and still ignores a lucky or an interrupted find. 80, not 40: a find varies 3 to 5 times by itself.
  Speed 0 is the fitted player's hard steps read the same way (`hardMid`), so a steady room of interruptions is part of
  your normal and costs a small constant (see below). Speed in grades = log(typical player ÷ your time) ÷ log `perGrade`,
  averaged over the techniques weighted by how often the profile's puzzles up to one grade above your repertoire use
  them. A new player starts at speed 0. (A lower quantile was tried for the busy room: it gained nothing once the
  simulation's draws were independent, and it reads luck more.)
- **The band (90 %)**: 200 draws of every technique's spotting, completion and speed (the middle-half mean's
  uncertainty, 1.09 × `spreadHard` ÷ √(finds + `K_TECH`)) from their posteriors. What is shared is drawn once per
  draw, because a player who spots or finds well tends to do so everywhere: the start `START_SPOT` itself (a Beta
  weighing `K_START` = 3 needs) and your speed on all hard techniques (1.09 × `spreadHard` ÷ √(all finds + `K_OWN`),
  entering each technique by its share K_TECH ÷ (finds + K_TECH)). Drawn independently, the techniques' uncertainty
  cancelled in the sum, and a new player's band (after 10 games) did not hold where the same player settles.

## Performance (a grade)
- **The expected time**: the median of 301 draws. The steps the board needed a basic for (and the first move), at their
  basic's reference: at one of your normal's seconds-only readings, which cover every such step whatever you used for
  it (a harder way round is part of how you play; no wrong-number seconds, which only Focus adds). Each step the board
  needed a hard technique for: with weight n ÷ (n + `K_TECH`) one of its n needs (a find at its time; a miss at its time
  plus your median find time), otherwise your typical time (spread `spreadHard`) and spotting for it (a miss:
  `MISS_STRUGGLE` = 2 × the typical time plus the median find time).
- **Performance** = Skill + log(expected ÷ your time) ÷ log `perGrade`, where a hinted step adds your median find time
  for it. Band: the 10 % and 90 % draws. Not shown below 5×5 (`MIN_CELLS` = 25: a 4×4 has too few moves) or for Sudoku
  until it is fitted.
- The seal, Focus's normal and the expected time all use the record from before the game; the game is added after.
  The numbers come out unrounded; the screens round them.

## Reading exports (`exports.js`, `moves.py`)
As the app imports them: an export made before the levels were renumbered (26 Nov 2026, `levelsV` < 2: the mixed
pair came in as level 4, so the old levels 4–12 are now 5–13) has its games moved along first (`levelsGame` in
`main.js`); then per game the version that kept the most (its moves, else its per-move summary), the newest export on
a tie. Until 28 Nov the tools skipped the renumbering, so six of the seven exports read triples as mixed pairs, chains
as triples and so on up: the per-technique references were wrong (the basics, pairs, `perGrade` and the game-level
numbers were not affected). Refitted since.

## In the app (`statui.js`)
- **The record:** built from the games, oldest first, and stored in the personal key `statrec` (a guest has their own)
  with a fingerprint of the model's version and its reference (`statFP`). It is rebuilt in short slices when that
  changes, after an import and after a reset (about 8 s for 250 games in desktop Chrome; the statistics say "Reading
  your games" meanwhile). Each game's seal is stored in the game (`g.seal`), so it survives the archive, which drops the
  moves; on a rebuild, a game whose moves are gone keeps its older seal if the new one would say less.
- **After a game:** the route analysis feeds the game to the record (`statOnGame`); the seal then takes the 解 stamp's
  place and the time gets its bar against the seal's expected time (the after-game praise uses the same number). A tap
  on the seal shows the names and the bands. Focus below its band twice in a row in a session adds one line: time for
  a break (the old concentration line's advice).
- **No explanations on screen:** the numbers, bands and charts are meant to be read without text; what they mean and
  how they are made is here.
- **Before a game:** the expected time from the puzzle's own route (its step codes) with the same model, scaled by the
  median of your time ÷ that estimate over your latest 30 games, because the solver's route sometimes takes a harder
  step than players need (unscaled it ran about 12 % above the after-game expected time).
- **The statistics:** Overview (the three indices, the Skill chart of the latest 30 games, activity); Skill (the chart of
  the latest 60, Skill's two parts, "Practise next": the technique whose mastery or speed would add most to Skill, the
  technique ladder with spotting and speed and their bands, practice, hints, time per technique); Focus (the latest 40
  games with their bands and sessions, what moves your Focus as group medians with bands: the game's number in the
  session, the time of day and the board size, but not the game's length, which is circular: a game is long partly
  because its easy numbers were slow; the latest dip on the board); Games (the latest games with their seals, week by
  week with the median Performance and Focus, difficulty over time, times by grade and board size, the route); Debug
  (the reference, Performance − Skill by grade and by size, expected against actual time, Focus by grade and how often
  its band holds 100, Skill's two parts over time, the model's numbers, and the rating check).
- **Learn mode** practises "Practise next".
- **Focus only** on 4×4 and in Sudoku (its reference isn't fitted yet).
- **Not fed yet:** drills, campaign, training and trial boards (their cue factors are guesses until the practice log
  measures them). Their result pages keep the concentration line and the old estimate, and the campaign's score and
  Challenge's adaptation still use the old estimate (`myCal`).

## Where it stands (28 Nov 2026, after the final review, with the exports' levels corrected)
- Exports (seven files, 243 games after merging): C1 Performance − Skill median −0.05 (after the first 40 games; +0.16
  in the first 40, where Skill still starts low by design); C5 Performance − Skill per grade −0.06 (SE 0.05), Focus per
  grade −4 % (SE 3 %). By size Performance − Skill 5×5 −0.05, 6×6 +0.02, 7×7 −0.30: 22 of the 32 7×7 games are one
  evening (14 Nov), read against a borrowed normal (fewer than 5 7×7 readings then), so this can't yet be told from
  that evening. Your Skill 6.3 (90 % 5.2 to 7.1): repertoire 6.4, speed −0.2 (`replay.js`). Focus's band holds 100 in
  65 % of your games (median band ×2.1 wide); the rest are interruptions, which Focus is meant to show.
- The review's checks on the exports: seals identical whether or not the stored moves were marked (0 of 243 differ);
  a new player's first session (your games replayed as one) reads Focus median 97; your games in 12 shuffled orders
  end at Skill 6.28 ± 0.07 (your real order 6.26), change by a median 0.09 over 50 games (90 %: 0.28).
- `sim.js` (about 25 minutes): 29/29 (28 Nov., after the nook and the wings). Its players' hard techniques and their
  spotting by family come from the technique table: before, a list written before the mixed triple left it out, so a
  player who spots everything never found one (the repertoire check caught it). The board-size check is on the mean of
  three seeds, as one seed wanders ±0.2 grade. Measured, not limits: a TV habit in a third of the games costs Skill
  0.18 grade; a busy room 0.19, steady over time; a player who doesn't change wanders by 0.13 grade (sd of 100-game
  means); hard steps growing more steeply with the board than the reference (+0.3 in the exponent) put 5×5 between 0.06
  and 0.27 grade above 7×7 (one seed each run, so within that wander).
- `realpath.js` (about 15 minutes; `POOL_CACHE` keeps the 252 generated puzzles): 16/16.
- In the app (headless Chrome, your merged history): the first reading of 243 games takes 5 to 9 s (after a build that
  changes the grading, 11 s: 4 s to regrade them first, as the statistics wait for that); a solved game gets
  its seal and is kept in the stored record, which a reload reads back without rebuilding.
- What the checks can't test: the simulated players' times follow the reference's grade and size terms, so C5 is
  tested for real only on exports (`conditions.js`), and C4 is a convention (the arithmetic is checked, the number is
  measured). The finds' shape (one in ten a quick spot; spread 1.26) is taken from your exports.
- The random numbers: `mulberry32` with a scrambled seed, and separate streams for the puzzle, the player and the room.
  The first harness used a linear congruential generator with consecutive seeds, which made the games nearly alike;
  conclusions drawn with it (a lower quantile for the busy room, the triples' spotting failing) did not hold.

## Limits (accepted)
- **Attention is relative to your usual:** Skill is your level at your usual attention, and a change in how
  often you are tired or distracted shifts it by its share: the indices follow your habits. Tired, TV and an
  interruption all lower Focus and can't be told apart.
- **The normal's memory is the boundary:** a change in your basics pace about as fast as that memory (a beginner
  improving quickly, a new habit, a new phone or way of entering numbers) reads as Focus for a while, in either
  direction, and a new habit becomes your normal within about 15 games on that size.
- **Ordinary luck is in every game's Focus:** on your games the 90 % band is about ×2 wide (for example 70 to 140),
  because your own spread and the normal's uncertainty are both in it. A reading inside its band says little; one
  outside it is attention.
- **Hard steps count as they were played:** in a busy room about 40 % of them contain an interruption, so Skill reads
  a steady amount lower than your undisturbed level, and Performance carries
  the interruption. A miss caused by tiredness counts as a miss. (If that ever matters, the app could record where
  play resumes after the clock stopped, and treat that move as a fresh look at the board.)
- **Hard techniques are rare in games:** spotting for chains and what-ifs rests on the family for a long time, and
  until drills, campaign and training feed the record (not yet: their cue factors are unmeasured), so does their speed.
- A move where the route analysis misreads which technique was needed (you used a harder one, or guessed) is credited
  to the wrong technique.
- **Board size:** speed is measured against a frozen size factor. A player whose times grow with board size
  differently from it has a Skill that depends a little on which sizes they play (`sim.js` measures it: +0.3 in the
  size exponent puts 5×5 about 0.06 to 0.27 grade above 7×7).
- Skill doesn't fade over a long break: it shows your level before the break until new attempts replace the old.

## To be set from data (tuning)
`expert`, `FLUENT`, the starts and weights (`START_*`, `K_*`), `CUE`, `N_NORMAL`, `W_WRONG`, `WIN_FIND`,
`MISS_STRUGGLE`: from later exports, especially ones made after hints became events in the moves. Sudoku: its own
reference from Sudoku exports.
