#!/usr/bin/env python3
"""Write the difficulty's numbers into the games' code.

  Suguru: tools/grade/weights.json -> web/suguru/js/gradew.js and java/src/SuguruGrade.java
  Sudoku: tools/grade/sudoku.json  -> web/sudoku/js/gradew.js

The numbers sit between the markers "<gen:weights>" and "</gen:weights>"; nothing else in the files is touched.
To calibrate: edit weights.json (raise "fit"), run this script, run the parity test (JS and Java must give the same grade).

  python3 tools/grade/gen.py            write both files
  python3 tools/grade/gen.py --check    exit with an error if the files do not match weights.json
  python3 tools/grade/gen.py --zero trial,built   (only for testing) set the difference for the named pencil terms to 0
  python3 tools/grade/gen.py --print-js [--weights file.json]   write only the JS block (used by features.js)
  python3 tools/grade/gen.py --game sudoku   only the one game (default: both)

The pencil terms are in weights.json as base, diff and anchor (per technique) and are derived here into three rows:
  with pencil    = base - (1 - anchor) * diff
  without pencil = base + anchor * diff
  as you used to play = base   (the grade for games from before pencil use was recorded; the one the base values are fitted to)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "tools", "grade", "weights.json")
JS = os.path.join(ROOT, "web", "suguru", "js", "gradew.js")
JAVA = os.path.join(ROOT, "java", "src", "SuguruGrade.java")
# game -> (weight file, JS file, Java file or None)
GAMES = {
    "suguru": (SRC, JS, JAVA),
    "sudoku": (os.path.join(ROOT, "tools", "grade", "sudoku.json"), os.path.join(ROOT, "web", "sudoku", "js", "gradew.js"), None),
}
NTECH = 14
SCALARS = ["cap", "inner", "vis", "shapeSize", "shapeSizeCap", "shapeBent", "open", "openMid", "workPer", "workMid", "workLo", "workHi",
           "len", "loadOver", "loadTechRepeat", "loadScale", "loadWeight", "loadCountScale", "early",
           "singlesK", "singlesOptsW", "singlesOptsMid", "singlesOptsSpan", "singlesNarrowW", "singlesNarrowSpan",
           "singlesFirst", "singlesNakedW", "singlesNakedSpan"]
PEN = ["mem", "tech", "multi", "trial", "built", "repeat", "partial", "len"]


def num(x):
    if isinstance(x, bool):
        raise ValueError("bool")
    if float(x) == int(x) and not isinstance(x, float):
        return str(int(x))
    r = repr(float(x))
    return r[:-2] if r.endswith(".0") else r


def load(zero=(), src=SRC):
    w = json.load(open(src, encoding="utf-8"))
    assert len(w["recog"]) == NTECH and len(w["spot"]) == 5
    P = w["pencil"]
    a = P["anchor"]
    assert len(a) == NTECH and all(0 <= x <= 1 for x in a)
    for k in PEN:
        base = P.get("base", {}).get(k, [0] * NTECH)
        d = [0] * NTECH if k in zero else P["diff"][k]
        assert len(base) == NTECH and len(d) == NTECH, k
        r = lambda x: round(x, 6) + 0.0
        P[k] = [[r(b - (1 - t) * x) for b, t, x in zip(base, a, d)], [r(b + t * x) for b, t, x in zip(base, a, d)], [r(b) for b in base]]
    return w


def js_block(w, src=SRC):
    arr = lambda a: "[" + ", ".join(num(x) for x in a) + "]"
    L = [f"// <gen:weights> Written by tools/grade/gen.py from tools/grade/{os.path.basename(src)}. Edit there, not here.",
         "// Pencil terms: [with pencil, without pencil, as you used to play], each a list per technique (derived from base, diff and anchor).",
         "const GW = {",
         f"  fit: {w['fit']},",
         f"  recog: {arr(w['recog'])},",
         f"  spot: {arr(w['spot'])},"]
    for k in SCALARS:
        L.append(f"  {k}: {num(w[k])},")
    L.append("  pencil: {")
    for k in PEN:
        L.append(f"    {k}: [{arr(w['pencil'][k][0])}, {arr(w['pencil'][k][1])}, {arr(w['pencil'][k][2])}],")
    L.append(f"    multiCap: {num(w['pencil']['multiCap'])},")
    L.append("  },")
    L.append("};")
    L.append("// </gen:weights>")
    return "\n".join(L)


def java_block(w):
    arr = lambda a: "{" + ", ".join(num(x) for x in a) + "}"
    L = ["    // <gen:weights> Written by tools/grade/gen.py from tools/grade/weights.json. Edit there, not here.",
         "    // Pencil terms: [0] with pencil, [1] without pencil, [2] as you used to play; each a list per technique (derived from base, diff and anchor).",
         f"    static final int FIT = {w['fit']};",
         f"    static final double[] RECOG = {arr(w['recog'])};",
         f"    static final double[] SPOT = {arr(w['spot'])};"]
    for k in SCALARS:
        L.append(f"    static final double W_{k} = {num(w[k])};")
    for k in PEN:
        L.append(f"    static final double[][] P_{k} = {{{arr(w['pencil'][k][0])}, {arr(w['pencil'][k][1])}, {arr(w['pencil'][k][2])}}};")
    L.append(f"    static final double P_multiCap = {num(w['pencil']['multiCap'])};")
    L.append("    // </gen:weights>")
    return "\n".join(L)


def splice(path, block, indent):
    s = open(path, encoding="utf-8").read()
    pat = re.compile(r"^" + indent + r"// <gen:weights>.*?// </gen:weights>$", re.S | re.M)
    if not pat.search(s):
        sys.exit(f"markers missing in {path}")
    return s, pat.sub(lambda m: block, s, count=1)


def main():
    zero = ()
    if "--zero" in sys.argv:
        zero = tuple(sys.argv[sys.argv.index("--zero") + 1].split(","))
    if "--print-js" in sys.argv:
        src = sys.argv[sys.argv.index("--weights") + 1] if "--weights" in sys.argv else SRC
        print(js_block(load(zero, src), src))
        return
    only = sys.argv[sys.argv.index("--game") + 1] if "--game" in sys.argv else None
    changed = []
    for game, (src, js, java) in GAMES.items():
        if only and game != only:
            continue
        if not os.path.exists(src):
            continue
        w = load(zero, src)
        targets = [(js, js_block(w, src), "")] + ([(java, java_block(w), "    ")] if java else [])
        for path, block, ind in targets:
            old, new = splice(path, block, ind)
            if old != new:
                changed.append(os.path.relpath(path, ROOT))
                if "--check" not in sys.argv:
                    open(path, "w", encoding="utf-8").write(new)
    if "--check" in sys.argv:
        if changed:
            sys.exit("not up to date: " + ", ".join(changed))
        print("the weight files match the sources")
    else:
        print("written: " + (", ".join(changed) if changed else "nothing changed"))


if __name__ == "__main__":
    main()
