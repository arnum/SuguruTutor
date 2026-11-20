#!/usr/bin/env python3
"""Skriv sværhedsgradens tal fra tools/grade/weights.json ind i web/js/grade.js og java/src/SuguruGrade.java.

Tallene står mellem markørerne "<gen:weights>" og "</gen:weights>" i begge filer; alt andet røres ikke.
Sådan kalibreres: ret weights.json (hæv "fit"), kør dette script, kør paritetstesten (JS og Java skal give samme grad).

  python3 tools/grade/gen.py            skriv begge filer
  python3 tools/grade/gen.py --check    afslut med fejl, hvis filerne ikke svarer til weights.json
  python3 tools/grade/gen.py --zero trial,built   (kun til test) sæt forskellen for de nævnte blyant-led til 0
  python3 tools/grade/gen.py --print-js [--weights fil.json]   skriv kun JS-blokken (bruges af features.js)

Blyant-leddene står i weights.json som base, diff og anchor (pr. teknik) og udledes her til tre rækker:
  med blyant  = base - (1 - anchor) * diff
  uden blyant = base + anchor * diff
  som du plejede = base   (graden for spil fra før blyant blev registreret; den, grundtallene er tilpasset)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "tools", "grade", "weights.json")
JS = os.path.join(ROOT, "web", "js", "grade.js")
JAVA = os.path.join(ROOT, "java", "src", "SuguruGrade.java")
NTECH = 14
SCALARS = ["inner", "vis", "shapeSize", "shapeSizeCap", "shapeBent", "open", "openMid", "workPer", "workMid", "workLo", "workHi",
           "len", "loadOver", "loadTechRepeat", "loadScale", "loadWeight", "loadCountScale", "early",
           "singlesK", "singlesOptsW", "singlesOptsMid", "singlesOptsSpan", "singlesNarrowW", "singlesNarrowSpan"]
PEN = ["mem", "tech", "multi", "trial", "built", "repeat", "partial"]


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


def js_block(w):
    arr = lambda a: "[" + ", ".join(num(x) for x in a) + "]"
    L = ["// <gen:weights> Skrevet af tools/grade/gen.py ud fra tools/grade/weights.json. Ret dér, ikke her.",
         "// Blyant-led: [med blyant, uden blyant, som du plejede], hver en liste pr. teknik (udledt af base, diff og anchor).",
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
    L = ["    // <gen:weights> Skrevet af tools/grade/gen.py ud fra tools/grade/weights.json. Ret dér, ikke her.",
         "    // Blyant-led: [0] med blyant, [1] uden blyant, [2] som du plejede; hver en liste pr. teknik (udledt af base, diff og anchor).",
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
        sys.exit(f"markører mangler i {path}")
    return s, pat.sub(lambda m: block, s, count=1)


def main():
    zero = ()
    if "--zero" in sys.argv:
        zero = tuple(sys.argv[sys.argv.index("--zero") + 1].split(","))
    src = sys.argv[sys.argv.index("--weights") + 1] if "--weights" in sys.argv else SRC
    w = load(zero, src)
    if "--print-js" in sys.argv:
        print(js_block(w))
        return
    changed = []
    for path, block, ind in ((JS, js_block(w), ""), (JAVA, java_block(w), "    ")):
        old, new = splice(path, block, ind)
        if old != new:
            changed.append(os.path.relpath(path, ROOT))
            if "--check" not in sys.argv:
                open(path, "w", encoding="utf-8").write(new)
    if "--check" in sys.argv:
        if changed:
            sys.exit("ikke opdateret: " + ", ".join(changed))
        print("grade.js og SuguruGrade.java svarer til weights.json")
    else:
        print("skrevet: " + (", ".join(changed) if changed else "intet ændret"))


if __name__ == "__main__":
    main()
