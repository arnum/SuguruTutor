# Changelog

*Dansk: [CHANGELOG.da.md](CHANGELOG.da.md)*

Newest first. The project has no version history, so the dates up to 20 November are worked out from the timestamps
of work files and screenshots. A change may be a day older than shown, and those days list only the main changes.

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
