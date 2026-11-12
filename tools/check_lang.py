"""Tjekker sprogfilerne i web/js/lang/ mod teksterne i koden.

    python3 tools/check_lang.py

Melder tekster i koden, der mangler i en sprogfil, oversættelser der ikke bruges længere,
og oversættelser hvor pladsholderne ({navn}) ikke svarer til den danske tekst.
Teksterne findes som tr("...") i web/js/*.js og som fast tekst i web/index.html.
"""
import json, os, re, sys
from html.parser import HTMLParser

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web")
KEY = re.compile(r'\btr\(\s*"((?:[^"\\]|\\.)*)"')
ENTRY = re.compile(r'^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*"),?\s*$')
PH = re.compile(r"\{(\w+)\}")


class Static(HTMLParser):
    """Fast tekst og oplæste attributter i index.html (oversættes af translateDom i js/i18n.js)."""

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


def used_keys():
    keys = set()
    for f in os.listdir(os.path.join(ROOT, "js")):
        if f.endswith(".js") and f != "i18n.js":
            for m in KEY.finditer(open(os.path.join(ROOT, "js", f), encoding="utf-8").read()):
                keys.add(json.loads('"' + m.group(1) + '"'))
    p = Static()
    p.feed(open(os.path.join(ROOT, "index.html"), encoding="utf-8").read())
    return keys | p.out


def main():
    keys, bad = used_keys(), 0
    for f in sorted(os.listdir(os.path.join(ROOT, "js", "lang"))):
        d = {}
        for line in open(os.path.join(ROOT, "js", "lang", f), encoding="utf-8"):
            m = ENTRY.match(line)
            if m:
                d[json.loads(m.group(1))] = json.loads(m.group(2))
        missing = sorted(keys - set(d))
        unused = sorted(set(d) - keys)
        ph = [k for k, v in d.items() if sorted(set(PH.findall(k))) != sorted(set(PH.findall(v)))]
        print(f"{f}: {len(d)} oversættelser, {len(missing)} mangler, {len(unused)} ubrugte, {len(ph)} med forkerte pladsholdere")
        for k in missing: print("  mangler:", k)
        for k in unused: print("  ubrugt:", k)
        for k in ph: print("  pladsholder:", k, "->", d[k])
        bad += len(missing) + len(ph)
    sys.exit(1 if bad else 0)


main()
