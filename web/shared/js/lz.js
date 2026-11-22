// Compression of text for storage (the LZ family, the same method as the widely used lz-string, the UTF-16 variant).
// Used for the archive of older games, so many months of statistics fit in the browser's storage.
// Each character in the result carries 15 bits (+32, so no control characters or invalid UTF-16 characters ever appear).
const LZ = (() => {
  function compress(input, bitsPerChar, toChar) {
    if (input == null) return "";
    const dict = new Map(),
      toCreate = new Set(),
      data = [];
    let w = "",
      enlargeIn = 2,
      dictSize = 3,
      numBits = 2,
      val = 0,
      pos = 0;
    const put = (v, n) => {
      for (let i = 0; i < n; i++) {
        val = (val << 1) | (v & 1);
        if (pos === bitsPerChar - 1) {
          pos = 0;
          data.push(toChar(val));
          val = 0;
        } else pos++;
        v >>= 1;
      }
    };
    const grow = () => {
      if (--enlargeIn === 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
    };
    const emitW = () => {
      if (toCreate.has(w)) {
        const code = w.charCodeAt(0);
        if (code < 256) {
          put(0, numBits);
          put(code, 8);
        } else {
          put(1, numBits);
          put(code, 16);
        }
        grow();
        toCreate.delete(w);
      } else put(dict.get(w), numBits);
      grow();
    };
    for (let k = 0; k < input.length; k++) {
      const c = input.charAt(k);
      if (!dict.has(c)) {
        dict.set(c, dictSize++);
        toCreate.add(c);
      }
      const wc = w + c;
      if (dict.has(wc)) w = wc;
      else {
        emitW();
        dict.set(wc, dictSize++);
        w = c;
      }
    }
    if (w !== "") emitW();
    put(2, numBits); // end
    // push out the last part
    for (;;) {
      val <<= 1;
      if (pos === bitsPerChar - 1) {
        data.push(toChar(val));
        break;
      } else pos++;
    }
    return data.join("");
  }
  function decompress(length, resetValue, getNext) {
    const dict = [0, 1, 2],
      result = [];
    let enlargeIn = 4,
      dictSize = 4,
      numBits = 3,
      w,
      c,
      entry;
    const d = { val: getNext(0), position: resetValue, index: 1 };
    const read = (n) => {
      let bits = 0,
        power = 1;
      const max = Math.pow(2, n);
      while (power !== max) {
        const resb = d.val & d.position;
        d.position >>= 1;
        if (d.position === 0) {
          d.position = resetValue;
          d.val = getNext(d.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      return bits;
    };
    switch (read(2)) {
      case 0:
        c = String.fromCharCode(read(8));
        break;
      case 1:
        c = String.fromCharCode(read(16));
        break;
      default:
        return "";
    }
    dict[3] = c;
    w = c;
    result.push(c);
    for (;;) {
      if (d.index > length) return "";
      let code = read(numBits);
      if (code === 0 || code === 1) {
        dict[dictSize++] = String.fromCharCode(read(code === 0 ? 8 : 16));
        code = dictSize - 1;
        enlargeIn--;
      } else if (code === 2) return result.join("");
      if (enlargeIn === 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
      if (dict[code]) entry = dict[code];
      else if (code === dictSize) entry = w + w.charAt(0);
      else return null; // corrupt data
      result.push(entry);
      dict[dictSize++] = w + entry.charAt(0);
      enlargeIn--;
      w = entry;
      if (enlargeIn === 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
    }
  }
  return {
    pack: (s) => compress(s, 15, (a) => String.fromCharCode(a + 32)) + " ",
    unpack: (s) => (s == null ? "" : s === "" ? null : decompress(s.length, 16384, (i) => s.charCodeAt(i) - 32)),
  };
})();
