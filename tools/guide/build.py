"""Bygger guiden på dansk (web/guide.html) og engelsk (web/guide-en.html) ud fra template.html og data.json.

    python3 tools/guide/build.py

Eksemplerne i data.json er lavet og kontrolleret af værktøjerne i den oprindelige udvikling; her oversættes kun teksterne.
Et nyt sprog: kopiér en.json til fx de.json, oversæt værdierne, og tilføj sproget i LANGS nedenfor.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "..", "..", "web")
LANGS = {"da": None, "en": "en.json"}
GRADING_DA = ("I spillet måles en opgaves sværhed som indsats: det tungeste skridt plus et tillæg for, hvor mange tunge skridt der er. "
              "Niveauet ved hver teknik herunder er teknikkens plads fra let til svær, ikke opgavens sværhedsgrad. "
              "Eksemplerne med mærket \"Fra en rigtig opgave\" er hentet direkte fra generatoren, og alle påstande er kontrolleret mod opgavernes løsninger.")
OLD_GRADING = ("I spillet er en opgaves niveau den sværeste teknik, den ikke kan løses uden. Decimalen bagefter viser, hvor meget man skal holde i hovedet, "
               "og hvor tidligt det svære kommer. Eksemplerne med mærket \"Fra en rigtig opgave\" er hentet direkte fra generatoren, og alle påstande er kontrolleret mod opgavernes løsninger.")
# Guiden følger appens tema og ikon
HEAD = ('<script>try{var t=JSON.parse(localStorage.getItem("suguru.settings")||"{}").theme;'
        'if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>\n')

template = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
data = json.load(open(os.path.join(HERE, "data.json"), encoding="utf-8"))
assert OLD_GRADING in template, "grading-afsnittet er ændret i skabelonen"

for lang, fname in LANGS.items():
    t = template.replace(OLD_GRADING, "__GRADING__")
    d = json.loads(json.dumps(data))
    if fname is None:
        t = t.replace("__GRADING__", GRADING_DA)
    else:
        tr = json.load(open(os.path.join(HERE, fname), encoding="utf-8"))
        for old, new in tr["template"].items():
            if old not in t:
                sys.exit(f"{fname}: findes ikke i skabelonen: {old[:80]}")
            t = t.replace(old, new)
        for ex in d:
            e = tr["examples"][ex["id"]]
            assert len(e["frames"]) == len(ex["frames"]), ex["id"]
            ex["name"], ex["rule"], ex["look"] = e["name"], e["rule"], e["look"]
            for f, text in zip(ex["frames"], e["frames"]):
                f["text"] = text
        t = t.replace('<html lang="da">', f'<html lang="{lang}">')
    t = t.replace("__DATA__", json.dumps(d, ensure_ascii=False, separators=(",", ":")))
    t = t.replace("<style>", HEAD + "<style>", 1)
    t = t.replace("</title>", '</title>\n<link rel="icon" href="icons/icon-192.png" type="image/png">', 1)
    out = os.path.join(WEB, "guide.html" if lang == "da" else f"guide-{lang}.html")
    open(out, "w", encoding="utf-8").write(t)
    print("skrevet", os.path.relpath(out, os.path.join(HERE, "..", "..")))
