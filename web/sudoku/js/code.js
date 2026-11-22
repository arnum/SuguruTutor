// Puzzle codes for Sudoku: SD1-... (compact, with a check) or an ordinary puzzle of 81 characters (digits and . or 0),
// which most Sudoku sites use. The same character set and check as Suguru's SU1 codes.
//
// SD1 format: SD1-9X9-<data in groups of 5 characters>. For each cell 1 bit "given?" + 4 bits (number-1) if given, and finally
// a 10-bit check. Character set: Crockford base32 (no I, L, O, U). Upper/lower case, spaces and hyphens do not matter.
const CODE_ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function codeChecksum(bits, rows, cols) {
  let h = 2166136261 | 0;
  const feed = (x) => {
    h ^= x;
    h = Math.imul(h, 16777619);
  };
  feed(rows);
  feed(cols);
  for (const b of bits) feed(b);
  return h & 1023;
}
const sudokuBoxes = (rows, cols) => engineFactory().boxes(rows, cols);

function encodePuzzle(p) {
  const { rows, cols, givens } = p,
    bits = [];
  for (let i = 0; i < rows * cols; i++) {
    if (givens[i]) {
      const v = givens[i] - 1;
      bits.push(1, (v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1);
    } else bits.push(0);
  }
  const chk = codeChecksum(bits, rows, cols);
  for (let k = 9; k >= 0; k--) bits.push((chk >> k) & 1);
  while (bits.length % 5) bits.push(0);
  let s = "";
  for (let i = 0; i < bits.length; i += 5) s += CODE_ALPHA[bits[i] * 16 + bits[i + 1] * 8 + bits[i + 2] * 4 + bits[i + 3] * 2 + bits[i + 4]];
  return "SD1-" + cols + "X" + rows + "-" + s.match(/.{1,5}/g).join("-");
}

/** Returns { rows, cols, region, givens } or throws an error with an explanation. */
function decodePuzzle(text) {
  const raw = String(text).trim();
  // ordinary puzzle: 81 characters of digits and . or 0 (spaces, line breaks and | are ignored)
  const plain = raw.replace(/[\s|+-]/g, "");
  if (/^[0-9.]{81}$/.test(plain)) {
    const givens = [...plain].map((ch) => (ch === "." ? 0 : +ch));
    return { rows: 9, cols: 9, region: sudokuBoxes(9, 9), givens };
  }
  const t = raw.toUpperCase().replace(/#/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/×/g, "X");
  const m = t.match(/^SD1-(\d{1,2})X(\d{1,2})-([0-9A-Z-]+)$/) || t.match(/^SD1(\d{1,2})X(\d{1,2})-?([0-9A-Z-]+)$/);
  if (!m) throw new Error(tr("The code should look like SD1-9X9-… or be a puzzle of 81 characters."));
  const cols = +m[1],
    rows = +m[2];
  if (cols !== 9 || rows !== 9) throw new Error(tr("The size in the code does not make sense."));
  const body = m[3].replace(/-/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  const bits = [];
  for (const ch of body) {
    const v = CODE_ALPHA.indexOf(ch);
    if (v < 0) throw new Error(tr("Unknown character in the code: {ch}", { ch }));
    for (let k = 4; k >= 0; k--) bits.push((v >> k) & 1);
  }
  let pos = 0;
  const take = () => {
    if (pos >= bits.length) throw new Error(tr("The code is too short. Is a part missing?"));
    return bits[pos++];
  };
  const givens = new Array(rows * cols).fill(0);
  for (let i = 0; i < rows * cols; i++) if (take()) givens[i] = ((take() << 3) | (take() << 2) | (take() << 1) | take()) + 1;
  const dataEnd = pos;
  let chk = 0;
  for (let k = 0; k < 10; k++) chk = (chk << 1) | take();
  if (bits.length - pos >= 5 || bits.slice(pos).some((b) => b)) throw new Error(tr("The code is too long or has a typo."));
  if (chk !== codeChecksum(bits.slice(0, dataEnd), rows, cols)) throw new Error(tr("The check does not match. There is probably a typo in the code."));
  if (givens.some((v) => v > 9)) throw new Error(tr("The code is too long or has a typo."));
  return { rows, cols, region: sudokuBoxes(rows, cols), givens };
}
