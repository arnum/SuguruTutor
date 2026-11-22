"""Builds the guide in English (web/suguru/guide.html) and Danish (web/suguru/guide-da.html) from template.html and data.json.

    python3 tools/guide/build.py

The examples in data.json were made and checked by the tools in the original development; here only the texts are translated.
A new language: copy da.json to e.g. de.json, translate the values, and add the language to LANGS below.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "..", "..", "web", "suguru")
LANGS = {"en": None, "da": "da.json"}
# The guide follows the app's theme and icon
HEAD = ('<script>try{var t=JSON.parse(localStorage.getItem("suguru.settings")||"{}").theme;'
        'if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>\n')

template = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
data = json.load(open(os.path.join(HERE, "data.json"), encoding="utf-8"))

for lang, fname in LANGS.items():
    t = template
    d = json.loads(json.dumps(data))
    if fname is not None:
        tr = json.load(open(os.path.join(HERE, fname), encoding="utf-8"))
        for old, new in tr["template"].items():
            if old not in t:
                sys.exit(f"{fname}: not found in the template: {old[:80]}")
            t = t.replace(old, new)
        for ex in d:
            e = tr["examples"][ex["id"]]
            assert len(e["frames"]) == len(ex["frames"]), ex["id"]
            ex["name"], ex["rule"], ex["look"] = e["name"], e["rule"], e["look"]
            for f, text in zip(ex["frames"], e["frames"]):
                f["text"] = text
        t = t.replace('<html lang="en">', f'<html lang="{lang}">')
    t = t.replace("__DATA__", json.dumps(d, ensure_ascii=False, separators=(",", ":")))
    t = t.replace("<style>", HEAD + "<style>", 1)
    t = t.replace("</title>", '</title>\n<link rel="icon" href="icons/icon-192.png" type="image/png">', 1)
    out = os.path.join(WEB, "guide.html" if lang == "en" else f"guide-{lang}.html")
    open(out, "w", encoding="utf-8").write(t)
    print("wrote", os.path.relpath(out, os.path.join(HERE, "..", "..")))
