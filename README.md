# Suguru

Suguru med ægte sværhedsgrad (niveau 1–11 med decimal), guidede hints, dagens opgave, statistik og analyse af din løsningsrute.
Kører i browseren og kan lægges på hjemmeskærmen som en app, der også virker offline.

## Filer

Alle filer skal ligge sammen i roden af repositoriet:

| Fil | Hvad |
|---|---|
| `index.html` | Selve spillet (motor, hints, statistik) |
| `guide.html` | Guiden til de 14 teknikker |
| `manifest.webmanifest` | Navn, ikon og farver til hjemmeskærmen |
| `sw.js` | Service worker: gør appen tilgængelig offline |
| `icon-*.png`, `apple-touch-icon.png`, `favicon-32.png` | Ikoner |

## Læg den på GitHub Pages

1. Opret et repository, fx `suguru`, og sæt det til **Public**.
2. **Add file → Upload files**, vælg alle filerne, og tryk **Commit changes**.
3. **Settings → Pages**: under *Build and deployment* vælg **Deploy from a branch**, branch **main**, mappe **/ (root)**, og tryk **Save**.
4. Efter et par minutter ligger spillet på `https://<brugernavn>.github.io/suguru/`.
5. Åbn adressen i Safari på iPhone → **Del** → **Føj til hjemmeskærm**.

## Opdatering

Upload de nye filer oven i de gamle (samme navne). Appen henter den nye version, næste gang den åbnes med netforbindelse.

## Data

Spil og statistik gemmes kun i browseren på den enhed, hvor du spiller. Brug **Indstillinger → Eksportér/Importér statistik** for at flytte dem.

Opgavekoder (`SU1-…`) virker på tværs af app, Claude-version og Java-programmet. Et link som `https://<brugernavn>.github.io/suguru/#SU1-6X6-…` åbner opgaven direkte.
