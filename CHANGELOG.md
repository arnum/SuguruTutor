# Changelog

Newest first. The project has no version history, so the dates up to 20 November are worked out from the timestamps
of work files and screenshots. A change may be a day older than shown, and those days list only the main changes.

## 23 November 2026 (2) · Suguru offline v50, Sudoku v16, build 2026-11-23b

### Changed
- The practice screens now use the game's own input code instead of a copy: the same fast taps, the same way of
  finding the cell under the finger, and the game's number pad (same look and size on phone and tablet).
- Number keys work in the practice games with a pad (Cascade, Count them), like in the game.

### Fixed
- Sudoku: the number keys 7, 8 and 9 did nothing on a keyboard in the main game.

## 23 November 2026 · Suguru offline v49, Sudoku v15, build 2026-11-23a

### Changed
- Practice boards, number pads and the true/false buttons react when the finger lands, like the main game, instead
  of when it lifts. Fast taps are no longer lost when the screen redraws between them.
- Cascade's number pad stays in place (greyed out until you tap a cell), and the heading no longer changes, so nothing
  moves under your finger.
- The tap that places the last number can no longer also press "Next board", which appears in the same spot.

## 22 November 2026 (13) · Suguru offline v48, Sudoku v14, build 2026-11-22m

### Changed
- Cascade measures seeing, not finger speed: the time from tapping a cell to choosing its number (up to a second per
  number) no longer counts. A 14-second board with 8 numbers now counts as about 8 seconds.

## 22 November 2026 (12) · Suguru offline v47, Sudoku v13, build 2026-11-22l

### Changed
- Practice levels are shown from 0 to 6 instead of 1 to 6.9: the start is an empty bar, and each whole number is one
  board level passed. Your levels are kept; they just read one lower.
- After every round: your typical time per board and what your curve expects, so you can see what it takes to move up.

## 22 November 2026 (11) · Suguru offline v46, Sudoku v12, build 2026-11-22k

### Changed
- Quick call expected one right answer per easy-number time on your curve (about 20 in a minute at 3 seconds), so
  even a good run hardly moved the level. It now expects 1.5 times that per claim (about 13), and the summary shows
  the number your curve expects.

## 22 November 2026 (10) · Suguru offline v45, Sudoku v11, build 2026-11-22j

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

## 22 November 2026 (9) · Suguru offline v44, Sudoku v10, build 2026-11-22i

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

## 22 November 2026 (8) · Suguru offline v43, Sudoku v9, build 2026-11-22h

### Fixed
- Practice: the text after a find could describe a different elimination than the board showed. When two numbers are
  locked to the same cells (2 and 3 only in d5 and d6, say), the board struck out only one of them while the text
  explained the other. Now everything those cells eliminate is shown, the text explains exactly that, and every number
  it gives counts.

## 22 November 2026 (7) · Suguru offline v42, Sudoku v8, build 2026-11-22g

### Changed
- Statistics: long explanations are folded. Notes on how something is measured sit behind "How it's measured", and a
  long introduction shows its first sentence with "More". Findings, numbers and short texts stay as they are.
- Focus area: the curve's times per technique moved into "How it's measured", next to the explanation of the curve.

## 22 November 2026 (6) · Suguru offline v41, Sudoku v7, build 2026-11-22f

### Changed
- The practice level chart no longer zooms: it always shows the whole range, 1 to 6.9, with every whole level marked.

## 22 November 2026 (5) · Suguru offline v40, Sudoku v6, build 2026-11-22e

### Changed
- Practice levels are decimal numbers (1.0 to 6.9) that move a little after every board: faster than your curve gives
  up to +0.3, slower down to -0.3, "Show me" -0.4. A board a bit faster than the curve still counts a little.
- Within a whole level, the decimals move the boards slightly earlier in the puzzle (more empty cells), so a higher
  level also means slightly harder boards.
- The level chart zooms to the levels it passes through, so a rise of a few tenths shows. The level bars fill partly.

## 22 November 2026 (4) · Suguru offline v39, Sudoku v5, build 2026-11-22d

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

## 22 November 2026 (3) · Suguru offline v38, Sudoku v4, build 2026-11-22c

### Changed
- iPhone and iPad: the board is as large as the screen allows, and the number pad never ends up below the screen.
- iPad: a wider layout with larger buttons; the route analysis shows its two boards side by side.
- Landscape: the board on the left at full height, the controls on the right. The apps are no longer locked to portrait.
- The activity map keeps its phone size on a tablet.

### Fixed
- On a phone in landscape the board ran off the screen and the number pad was out of reach.

## 22 November 2026 (2) · Suguru offline v37, Sudoku v3, build 2026-11-22b

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

## 22 November 2026 · Suguru offline v36, Sudoku v2, build 2026-11-22

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

## 21 November 2026 · Suguru offline v35, Sudoku v1

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

## 20 November 2026

### Added
- Three grades per puzzle: with pencil, without pencil, and "as you used to play" for games from before pencil use was recorded.
- A pencil setting: which grade you see and which one new puzzles are chosen by.
- The pencil's price in the game: what the grade drops to if you start using the pencil.
- "Why is the grade without pencil higher?" in the explanation of the grade.
- Final board: the board as the game ended, with where the numbers came from and where errors stood.

### Changed
- The scale goes above 10 (was capped at 9.9).

## 19 November 2026

### Added
- Debug notes on a game, and a debug package to copy.
- Storage: what takes up space, and clearing old route details while keeping the statistics.
- A compressed archive for older games.

### Changed
- Techniques used inside a what-if count in the grade.

## 18 November 2026

### Added
- "Key takeaway from the game" right after solving.
- A setting for when errors are shown.
- Errors in the route analysis as episodes: main error, follow-on errors and slips.
- Statistics split into tabs; tap a day in the activity map to see its games.
- A Progress section, including technique speed measured against your own time curve.

### Changed
- Grade recalibrated on 93 puzzles: pairs and triples weigh more.

## 14 November 2026

### Added
- A personal grade in the game heading: how the puzzle will probably feel for you.
- "Thought ahead" in the route analysis: numbers you found by placing others in your head first.

## 13 November 2026

### Added
- Boards in the route analysis: your move next to the easiest move at that moment.

### Changed
- The grade's weights fitted to 17 puzzles with measured solving times.

## 12 November 2026

### Added
- English translation.
- Dark theme.
- "Why this grade?" sheet in the game.

## 7–11 November 2026: first versions

- 7 Nov: Java generator and difficulty rater, later printable booklets.
- 9 Nov: Suguru strategy guide; web version with hints (the easiest next number) and a decimal grade.
- 10–11 Nov: installable offline app with route analysis, statistics, focus area and the daily puzzle.
