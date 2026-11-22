"""Checks the language files in web/shared/js/lang/ against the texts in the code.

    python3 tools/check_lang.py

Reports texts in the code that are missing from a language file, translations that are no longer used,
and translations whose placeholders ({name}) do not match the English text.
The texts are found as tr("...") in web/shared/js, web/suguru/js (Suguru) and web/sudoku/js (Sudoku), and as fixed text in the
two apps' index.html. Both apps share one file per language.
"""
import json, os, re, sys
from html.parser import HTMLParser

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web")
KEY = re.compile(r'\btr\(\s*"((?:[^"\\]|\\.)*)"')
ENTRY = re.compile(r'^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*"),?\s*$')
PH = re.compile(r"\{(\w+)\}")


class Static(HTMLParser):
    """Fixed text and read-aloud attributes in index.html (translated by translateDom in js/i18n.js)."""

    def __init__(self):
        super().__init__()
        self.out, self.skip = set(), 0

    def handle_starttag(self, tag, attrs):
        self.skip += tag in ("script", "style")
        for k, v in attrs:
            if k in ("aria-label", "placeholder", "title") and v and re.search(r"[A-Za-zÆØÅæøå]", v):
                self.out.add(v)

    def handle_endtag(self, tag):
        self.skip -= tag in ("script", "style")

    def handle_data(self, d):
        if not self.skip and re.search(r"[A-Za-zÆØÅæøå]", d.strip()):
            self.out.add(d.strip())


CODE = [os.path.join(ROOT, "shared", "js"), os.path.join(ROOT, "suguru", "js"), os.path.join(ROOT, "sudoku", "js")]
PAGES = [os.path.join(ROOT, "suguru", "index.html"), os.path.join(ROOT, "sudoku", "index.html")]
LANGDIR = os.path.join(ROOT, "shared", "js", "lang")


def used_keys():
    keys = set()
    for d in CODE:
        if not os.path.isdir(d):
            continue
        for f in os.listdir(d):
            if f.endswith(".js") and f != "i18n.js":
                for m in KEY.finditer(open(os.path.join(d, f), encoding="utf-8").read()):
                    keys.add(json.loads('"' + m.group(1) + '"'))
    p = Static()
    for page in PAGES:
        if os.path.exists(page):
            p.feed(open(page, encoding="utf-8").read())
    return keys | p.out


def main():
    keys, bad = used_keys(), 0
    for f in sorted(os.listdir(LANGDIR)):
        d = {}
        for line in open(os.path.join(LANGDIR, f), encoding="utf-8"):
            m = ENTRY.match(line)
            if m:
                d[json.loads(m.group(1))] = json.loads(m.group(2))
        missing = sorted(keys - set(d))
        unused = sorted(set(d) - keys)
        ph = [k for k, v in d.items() if sorted(set(PH.findall(k))) != sorted(set(PH.findall(v)))]
        print(f"{f}: {len(d)} translations, {len(missing)} missing, {len(unused)} unused, {len(ph)} with wrong placeholders")
        for k in missing: print("  missing:", k)
        for k in unused: print("  unused:", k)
        for k in ph: print("  placeholder:", k, "->", d[k])
        bad += len(missing) + len(ph)
    sys.exit(1 if bad else 0)


main()
