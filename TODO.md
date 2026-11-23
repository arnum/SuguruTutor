# TODO

Things that are agreed or suggested, but not started. Done items move to the changelog.

## Later

### One drawing code for the game board and the practice boards
Not now (23 November 2026).

- **Today:** the game board is drawn by `renderGrid` in `board.js`. The practice boards and the boards after the game use
  `miniBoard` in `analysis.js`. Input (fast taps, the cell under the finger, the number pad) has been shared since
  23 November.
- **Goal:** one drawing code that can show both the player's state (entries, notes, errors, selection) and the teaching
  layers (pattern highlights, struck-out options, circled answers, dashed follow-ons). The look, and any fix, would then
  be the same everywhere.
- **Risk:** it rewrites the main game's board. It needs the full browser test suite and screenshots on all device sizes.

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
- **Keep from the earlier games:**
  - Use the technique, don't name it.
  - Make it short enough to be fun. A chain can take long to find.
  - Base the expected time on your curve, which only has times for these levels if you have played them.
  - Check every answer against a checker that is separate from the game's code.

### Rework the statistics, the route analysis and the solved page
- **Why:** these are the hardest places to give learning value consistently. Too often they show numbers or long
  explanations rather than something you can act on next game.
- **Scope:** the statistics tabs, the route analysis sheet, and the solved page with its moments.
- **First step:** go through them screen by screen. For each, decide what you can learn from it, and cut or fold what
  doesn't help, in the spirit of the after-game board (show, don't tell; one thing at a time).

### Optional background colours for the regions
- A setting that gives each region its own soft background colour, so the regions are easier to see. This matters
  most in Suguru, with its irregular regions.
- Needs colours that work in light and dark mode and with colour blindness, and that don't fight with the highlights
  (selection, pattern, errors).

### Easier-to-read claims in Quick call
- Show the claim in big letters, short and close to the board. It is read under time pressure, so every word costs.
- Leave out cell names like "b2" when the board already shows which cell is meant. The highlighted cell plus
  "is 2" or "is easy" is enough; "a pair" over two highlighted cells needs no names at all.
- This is the first case of the general change below.

### More human explanations everywhere
- Cell references like "In the region with d5, d6, e6 and f6, 3 can only go in d5 and d6" are precise but hard to
  read. Where the board can show the cells (a highlight, an arrow, a colour), the text can point to them instead:
  "3 can only go in these two cells".
- Keep references where they are really needed: when no board is shown, when the text names cells that are not
  highlighted, or when two highlighted groups must be told apart.
- Then edit the texts to read like a person explaining: shorter sentences, the conclusion first, fewer nested
  clauses.
- Applies to the hints, the practice texts, the moments after the game, the route analysis and the guide. It
  touches many texts in both languages, so it goes best together with the statistics and solved-page rework above.

## Open questions from earlier
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
- **What changed?:** the explanation afterwards covers only the first new number, not all of them.
- **Sudoku triples drill:** finding a board takes 1.5–4 seconds (the first board of a round shows a spinner), and to
  find any at all it accepts boards where a pair would also do.
