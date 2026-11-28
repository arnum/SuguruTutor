#!/usr/bin/env python3
"""Write the difficulty's numbers into the games' code.

  Suguru: tools/grade/weights.json -> web/suguru/js/gradew.js and java/src/SuguruGrade.java
  Sudoku: tools/grade/sudoku.json  -> web/sudoku/js/gradew.js
  Both:   tools/grade/techniques.json (the technique table) and tools/grade/techs.js (its questions, TT) -> the same files

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
TECHS_SRC = os.path.join(ROOT, "tools", "grade", "techniques.json")
TECHS_JS = os.path.join(ROOT, "tools", "grade", "techs.js")
NTECH = 20
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


def load_techs():
    t = json.load(open(TECHS_SRC, encoding="utf-8"))
    codes = [u["code"] for u in t["units"]]
    assert len(set(codes)) == len(codes) and t["guess"] not in codes, "unit codes must be unique and not the guess code"
    ms = [m for u in t["units"] for m in u["methods"]]
    assert sorted(ms) == list(range(NTECH)), "every method belongs to exactly one unit"
    assert [m["m"] for m in t["methods"]] == list(range(NTECH)), "methods are listed in order 0..NTECH-1"
    for m in t["methods"]:
        if "within" in m:
            assert m["within"] in codes
    return t


def techs_js(t):
    """the table as compact JS data (the _about and _fields notes left out), followed by the questions (techs.js)"""
    units = [{k: v for k, v in u.items()} for u in t["units"]]
    methods = [{k: v for k, v in m.items() if k != "m"} for m in t["methods"]]
    data = json.dumps({"guess": t["guess"], "units": units, "methods": methods}, ensure_ascii=False, separators=(", ", ": "))
    return ["// The technique table, from tools/grade/techniques.json:", "const TECHS = " + data + ";"] + open(TECHS_JS, encoding="utf-8").read().rstrip("\n").split("\n")


def js_block(w, src=SRC):
    arr = lambda a: "[" + ", ".join(num(x) for x in a) + "]"
    L = [f"// <gen:weights> Written by tools/grade/gen.py from tools/grade/{os.path.basename(src)}. Edit there, not here.",
         "// Pencil terms: [with pencil, without pencil, as you used to play], each a list per technique (derived from base, diff and anchor).",
         "const GW = {",
         f"  fit: {w['fit']},",
         f"  recog: {arr(w['recog'])},",
         f"  link: {arr(w.get('link', [0] * NTECH))},",
         f"  spot: {arr(w['spot'])},"]
    for k in SCALARS:
        L.append(f"  {k}: {num(w[k])},")
    L.append("  pencil: {")
    for k in PEN:
        L.append(f"    {k}: [{arr(w['pencil'][k][0])}, {arr(w['pencil'][k][1])}, {arr(w['pencil'][k][2])}],")
    L.append(f"    multiCap: {num(w['pencil']['multiCap'])},")
    L.append("  },")
    L.append("};")
    L += techs_js(load_techs())
    L.append("// </gen:weights>")
    return "\n".join(L)


def java_block(w):
    arr = lambda a: "{" + ", ".join(num(x) for x in a) + "}"
    L = ["    // <gen:weights> Written by tools/grade/gen.py from tools/grade/weights.json. Edit there, not here.",
         "    // Pencil terms: [0] with pencil, [1] without pencil, [2] as you used to play; each a list per technique (derived from base, diff and anchor).",
         f"    static final int FIT = {w['fit']};",
         f"    static final double[] RECOG = {arr(w['recog'])};",
         f"    static final double[] LINK = {arr(w.get('link', [0] * NTECH))};",
         f"    static final double[] SPOT = {arr(w['spot'])};"]
    for k in SCALARS:
        L.append(f"    static final double W_{k} = {num(w[k])};")
    for k in PEN:
        L.append(f"    static final double[][] P_{k} = {{{arr(w['pencil'][k][0])}, {arr(w['pencil'][k][1])}, {arr(w['pencil'][k][2])}}};")
    L.append(f"    static final double P_multiCap = {num(w['pencil']['multiCap'])};")
    t = load_techs()
    ia = lambda a: "{" + ", ".join(str(int(x)) for x in a) + "}"
    ba = lambda a: "{" + ", ".join("true" if x else "false" for x in a) + "}"
    unit_of = [0] * NTECH
    for u in t["units"]:
        for m in u["methods"]:
            unit_of[m] = u["code"]
    M = t["methods"]
    L += ["    // The technique table, from tools/grade/techniques.json: units in teaching order (codes never change; the order",
          "    // is the only order), and per method (technique number) its unit and flags. See rank() below.",
          f"    static final int GUESS = {t['guess']};",
          f"    static final int[] UNIT_ORDER = {ia([u['code'] for u in t['units']])};",
          "    static final int[][] UNIT_METHODS = {" + ", ".join(ia(u["methods"]) for u in t["units"]) + "};",
          "    static final String[] UNIT_ID = {" + ", ".join('"' + u["id"] + '"' for u in t["units"]) + "};",
          "    static final String[] UNIT_FAMILY = {" + ", ".join('"' + u["family"] + '"' for u in t["units"]) + "};",
          "    static final String[] UNIT_GAMES = {" + ", ".join('"' + ",".join(u.get("games", [])) + '"' for u in t["units"]) + "};",
          f"    static final int[] METHOD_UNIT = {ia(unit_of)};",
          f"    static final int[] METHOD_WEIGHT = {ia([m['weight'] for m in M])};",
          f"    static final boolean[] METHOD_PATTERN = {ba([m.get('pattern') for m in M])};",
          f"    static final boolean[] METHOD_INNER = {ba([m.get('inner') for m in M])};",
          f"    static final boolean[] METHOD_CHAIN = {ba([m.get('chain') for m in M])};",
          f"    static final boolean[] METHOD_BYLENGTH = {ba([m.get('byLength') for m in M])};",
          f"    static final int[] METHOD_WITHIN = {ia([m.get('within', 0) for m in M])};"]
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
