// Opgavekoder (SU1-...): selve opgaven pakket i tekst, så den kan flyttes mellem app, print og Java.

// Opgavekode "SU1": selve opgaven (regionernes vægge + givne tal) pakket i tegn, der er nemme at skrive af.
// Uafhængig af generatorens version: koden kan læses af både spillet og Java-programmet.
//
// Format: SU1-<bredde>X<højde>-<data i grupper á 5 tegn>
// Data (bit for bit): vægge til højre for hvert felt (højde × (bredde-1)), vægge under hvert felt
// ((højde-1) × bredde), for hvert felt 1 bit "givet?" + 3 bit (tal-1) hvis givet, til sidst 10 bit kontrol.
// Tegnsæt: Crockford base32 (ingen I, L, O, U). Store/små bogstaver, mellemrum og bindestreger er ligegyldige.
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

function encodePuzzle(p) {
  const { rows, cols, region, givens } = p,
    bits = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c + 1 < cols; c++) bits.push(region[r * cols + c] !== region[r * cols + c + 1] ? 1 : 0);
  for (let r = 0; r + 1 < rows; r++) for (let c = 0; c < cols; c++) bits.push(region[r * cols + c] !== region[(r + 1) * cols + c] ? 1 : 0);
  for (let i = 0; i < rows * cols; i++) {
    if (givens[i]) {
      const v = givens[i] - 1;
      bits.push(1, (v >> 2) & 1, (v >> 1) & 1, v & 1);
    } else bits.push(0);
  }
  const chk = codeChecksum(bits, rows, cols);
  for (let k = 9; k >= 0; k--) bits.push((chk >> k) & 1);
  while (bits.length % 5) bits.push(0);
  let s = "";
  for (let i = 0; i < bits.length; i += 5)
    s += CODE_ALPHA[bits[i] * 16 + bits[i + 1] * 8 + bits[i + 2] * 4 + bits[i + 3] * 2 + bits[i + 4]];
  return "SU1-" + cols + "X" + rows + "-" + s.match(/.{1,5}/g).join("-");
}

/** Returnerer { rows, cols, region, givens } eller kaster en fejl med en forklaring på dansk. */
function decodePuzzle(text) {
  const t = String(text).toUpperCase().replace(/#/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/×/g, "X");
  const m = t.match(/^SU1-(\d{1,2})X(\d{1,2})-([0-9A-Z-]+)$/) || t.match(/^SU1(\d{1,2})X(\d{1,2})-?([0-9A-Z-]+)$/);
  if (!m) throw new Error(tr("Koden skal se sådan ud: SU1-6X6-…"));
  const cols = +m[1],
    rows = +m[2];
  if (cols < 2 || rows < 2 || cols > 12 || rows > 12) throw new Error(tr("Størrelsen i koden giver ikke mening."));
  const body = m[3].replace(/-/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  const bits = [];
  for (const ch of body) {
    const v = CODE_ALPHA.indexOf(ch);
    if (v < 0) throw new Error(tr("Ukendt tegn i koden: {ch}", { ch }));
    for (let k = 4; k >= 0; k--) bits.push((v >> k) & 1);
  }
  let pos = 0;
  const take = () => {
    if (pos >= bits.length) throw new Error(tr("Koden er for kort. Mangler der et stykke?"));
    return bits[pos++];
  };
  const right = [],
    down = [];
  for (let i = 0; i < rows * (cols - 1); i++) right.push(take());
  for (let i = 0; i < (rows - 1) * cols; i++) down.push(take());
  const givens = new Array(rows * cols).fill(0);
  for (let i = 0; i < rows * cols; i++) if (take()) givens[i] = ((take() << 2) | (take() << 1) | take()) + 1;
  const dataEnd = pos;
  let chk = 0;
  for (let k = 0; k < 10; k++) chk = (chk << 1) | take();
  if (bits.length - pos >= 5 || bits.slice(pos).some((b) => b)) throw new Error(tr("Koden er for lang eller har en tastefejl."));
  if (chk !== codeChecksum(bits.slice(0, dataEnd), rows, cols))
    throw new Error(tr("Kontrollen passer ikke. Der er sandsynligvis en tastefejl i koden."));
  // regioner: felter forbundet uden væg imellem, nummereret i læserækkefølge
  const region = new Array(rows * cols).fill(-1);
  let next = 0;
  for (let s = 0; s < rows * cols; s++) {
    if (region[s] !== -1) continue;
    const stack = [s];
    region[s] = next;
    while (stack.length) {
      const i = stack.pop(),
        r = Math.floor(i / cols),
        c = i % cols;
      const nb = [];
      if (c + 1 < cols && !right[r * (cols - 1) + c]) nb.push(i + 1);
      if (c > 0 && !right[r * (cols - 1) + c - 1]) nb.push(i - 1);
      if (r + 1 < rows && !down[r * cols + c]) nb.push(i + cols);
      if (r > 0 && !down[(r - 1) * cols + c]) nb.push(i - cols);
      for (const j of nb)
        if (region[j] === -1) {
          region[j] = next;
          stack.push(j);
        }
    }
    next++;
  }
  const size = {};
  region.forEach((r) => (size[r] = (size[r] || 0) + 1));
  if (Object.values(size).some((z) => z > 6)) throw new Error(tr("Koden giver en region med mere end 6 felter."));
  for (let i = 0; i < rows * cols; i++) if (givens[i] > size[region[i]]) throw new Error(tr("Koden har et tal, der er større end sin region."));
  return { rows, cols, region, givens };
}
