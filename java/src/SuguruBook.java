import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.*;

/**
 * Laver et printbart Suguru-hæfte: mange opgaver i én HTML-fil sat op til A4,
 * med sværhedsforklaring til hver opgave og løsninger bagerst.
 * Åbn filen i Chrome og vælg Udskriv → Gem som PDF (eller brug --pdf).
 *
 * Eksempler:
 *   java SuguruBook --antal 12 --str 6x6 --grad 3-6 --ud haefte.html
 *   java SuguruBook --antal 8 --str 8x8 --grad 6 --type lang --maks 6 --pr-side 1 --pdf
 *   java SuguruBook --antal 6 --str 7x7 --grad 5 --teknik 5
 *
 * Valg:
 *   --antal N          antal opgaver (standard 12)
 *   --str BxH          bredde x højde, fx 6x6 eller 8x10 (standard 6x6)
 *   --grad X           sværhedsgrad: ét tal (1-9), et interval (3-6) eller en liste (2,4,6). Standard 3-6
 *   --teknik T         opgaven skal kræve teknikniveau T (1-11): 2 nabo-eliminering, 3 par, 4 tripler, 5-7 kæder, 8-11 hvis-så
 *   --type K           alle | kort (få tunge træk) | lang (mange tunge træk). Standard alle
 *   --nuance N         alle | mild (.0-.3) | middel (.4-.6) | haard (.7-.9). Standard alle
 *   --maks M           største regionsstørrelse 4, 5 eller 6 (standard 5; 4 kun op til 7x7)
 *   --pr-side P        1, 2 eller 4 opgaver pr. side (standard 2)
 *   --seed S           startfrø; samme frø og valg giver samme hæfte
 *   --tid T            sekunder pr. opgave før nærmeste bruges (standard 20)
 *   --titel "..."      overskrift
 *   --ud FIL           filnavn (standard suguru-haefte.html)
 *   --pdf              forsøg også at lave PDF med Chrome/Chromium (headless)
 *   --usorteret        behold rækkefølgen i stedet for at sortere efter sværhed
 *   --koder "A,B,..."  lav hæftet af bestemte opgaver ud fra deres koder (SU1-...)
 *   --koder-fil FIL    som --koder, men læs koderne fra en tekstfil (én pr. linje)
 *
 * Hver opgave får en kode (SU1-...), der indeholder selve opgaven. Koden kan skrives ind i
 * Suguru-spillet i browseren, så man kan spille opgaven med hints, og den virker på tværs af versioner.
 */
public final class SuguruBook {

    public static void main(String[] args) throws Exception {
        SuguruEngine.fixConsoleEncoding();
        Map<String, String> o = parseArgs(args);
        int count = Integer.parseInt(o.getOrDefault("antal", "12"));
        String[] wh = o.getOrDefault("str", "6x6").toLowerCase().replace("×", "x").split("x");
        int cols = Integer.parseInt(wh[0].trim()), rows = Integer.parseInt(wh[1].trim());
        List<Integer> levels = parseLevels(o.getOrDefault("grad", o.getOrDefault("niveau", "3-6")));
        int must = Integer.parseInt(o.getOrDefault("teknik", "0"));
        if (must < 0 || must > SuguruEngine.TOP_LEVEL) throw new IllegalArgumentException("--teknik skal være 1-11");
        String kind = o.getOrDefault("type", "alle").toLowerCase();
        int[] band = nuance(o.getOrDefault("nuance", "alle"));
        int maxRegion = Integer.parseInt(o.getOrDefault("maks", "5"));
        int perPage = Integer.parseInt(o.getOrDefault("pr-side", "2"));
        long seed = Long.parseLong(o.getOrDefault("seed", String.valueOf(System.currentTimeMillis() % 1_000_000_000L)));
        long budget = (long) (Double.parseDouble(o.getOrDefault("tid", "20")) * 1000);
        String title = o.getOrDefault("titel", "Suguru");
        String outName = o.getOrDefault("ud", "suguru-haefte.html");

        if (o.containsKey("koder") || o.containsKey("koder-fil")) maxRegion = Math.max(4, Math.min(6, maxRegion));
        if (maxRegion < 4 || maxRegion > 6) throw new IllegalArgumentException("--maks skal være 4, 5 eller 6");
        if (maxRegion == 4 && rows * cols > 49 && !o.containsKey("koder") && !o.containsKey("koder-fil")) throw new IllegalArgumentException("Regioner på højst 4 felter kan kun laves op til 7x7");
        if (perPage != 1 && perPage != 2 && perPage != 4) throw new IllegalArgumentException("--pr-side skal være 1, 2 eller 4");

        List<SuguruEngine.Puzzle> puzzles = new ArrayList<>();
        List<String> codes = new ArrayList<>();
        if (o.containsKey("koder")) for (String c : o.get("koder").split(",")) if (!c.trim().isEmpty()) codes.add(c.trim());
        if (o.containsKey("koder-fil")) for (String c : Files.readAllLines(Paths.get(o.get("koder-fil")), StandardCharsets.UTF_8)) if (!c.trim().isEmpty()) codes.add(c.trim());
        if (!codes.isEmpty()) count = 0;
        for (String c : codes) {
            try {
                SuguruEngine.Puzzle p = SuguruCode.toPuzzle(c);
                puzzles.add(p);
                System.out.printf("Kode %d/%d: %s%n", puzzles.size(), codes.size(), label(p));
            } catch (IllegalArgumentException e) {
                System.out.println("Springer over " + c + ": " + e.getMessage());
            }
        }
        if (!codes.isEmpty() && puzzles.isEmpty()) throw new IllegalArgumentException("Ingen gyldige koder.");
        for (int i = 0; i < count; i++) {
            int level = levels.get((int) ((long) i * levels.size() / count));
            long t0 = System.currentTimeMillis();
            SuguruEngine.Puzzle p = SuguruGrade.generateGraded(rows, cols, level, must, band[0], band[1], kind, seed + i * 7919L, budget, maxRegion);
            puzzles.add(p);
            String miss = p.grade != null && p.grade.band != level ? "  (ønsket grad " + level + ", nærmeste brugt)" : "";
            System.out.printf("Opgave %d/%d: %s · %.1f s%s%n", i + 1, count, label(p), (System.currentTimeMillis() - t0) / 1000.0, miss);
        }
        if (!o.containsKey("usorteret"))
            puzzles.sort(Comparator.comparingDouble(p -> p.grade == null ? p.rating.level : p.grade.value));

        String html = render(puzzles, title, perPage, o.getOrDefault("nuance", "alle"));
        Path out = Paths.get(outName).toAbsolutePath();
        Files.write(out, html.getBytes(StandardCharsets.UTF_8));
        System.out.println("Gemt: " + out);
        if (o.containsKey("pdf")) makePdf(out);
        else System.out.println("Åbn filen i Chrome og vælg Udskriv → Gem som PDF (A4, uden sidehoved/-fod).");
    }

    // ------------------------------------------------------------------ argumenter
    static Map<String, String> parseArgs(String[] args) {
        Map<String, String> m = new HashMap<>();
        for (int i = 0; i < args.length; i++) {
            if (!args[i].startsWith("--")) throw new IllegalArgumentException("Ukendt argument: " + args[i]);
            String k = args[i].substring(2);
            if (k.equals("pdf") || k.equals("usorteret")) m.put(k, "ja");
            else if (i + 1 < args.length) m.put(k, args[++i]);
            else throw new IllegalArgumentException("Mangler værdi til --" + k);
        }
        return m;
    }
    static List<Integer> parseLevels(String s) {
        List<Integer> l = new ArrayList<>();
        for (String part : s.split(",")) {
            part = part.trim();
            if (part.contains("-")) {
                String[] ab = part.split("-");
                for (int x = Integer.parseInt(ab[0].trim()); x <= Integer.parseInt(ab[1].trim()); x++) l.add(x);
            } else l.add(Integer.parseInt(part));
        }
        for (int x : l) if (x < 1 || x > 9) throw new IllegalArgumentException("Sværhedsgrad skal være 1-9: " + x);
        return l;
    }
    static int[] nuance(String s) {
        switch (s.toLowerCase().replace("å", "aa")) {
            case "mild": return new int[]{0, 3};
            case "middel": return new int[]{4, 6};
            case "haard": case "hard": return new int[]{7, 9};
            default: return new int[]{0, 9};
        }
    }

    // ------------------------------------------------------------------ PDF via Chrome
    static void makePdf(Path html) {
        List<String> candidates = new ArrayList<>();
        if (System.getenv("CHROME") != null) candidates.add(System.getenv("CHROME"));
        candidates.addAll(Arrays.asList("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"));
        Path pdf = Paths.get(html.toString().replaceAll("\\.html?$", "") + ".pdf");
        for (String exe : candidates) {
            try {
                Process pr = new ProcessBuilder(exe, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    "--print-to-pdf=" + pdf, html.toUri().toString()).redirectErrorStream(true).start();
                try (InputStream in = pr.getInputStream()) { byte[] buf = new byte[4096]; while (in.read(buf) != -1) { /* tøm output */ } }
                if (pr.waitFor() == 0 && Files.exists(pdf)) { System.out.println("PDF: " + pdf); return; }
            } catch (Exception ignored) { /* prøv næste */ }
        }
        System.out.println("Fandt ikke Chrome/Chromium. Sæt miljøvariablen CHROME til programmets sti, eller udskriv HTML-filen fra Chrome.");
    }

    // ------------------------------------------------------------------ HTML
    static String esc(String s) { return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"); }

    /** Gitter som SVG. values: tal at vise (0 = tomt); bold = givne tal. */
    static String svg(SuguruEngine.Puzzle p, int[] values, boolean[] bold, double cellMm, boolean labels) {
        int S = 100, M = labels ? 30 : 6;
        StringBuilder sb = new StringBuilder();
        double wMm = (p.cols * S + M + 6) / 100.0 * cellMm, hMm = (p.rows * S + M + 6) / 100.0 * cellMm;
        sb.append(String.format(Locale.ROOT, "<svg class=\"grid\" viewBox=\"%d %d %d %d\" style=\"width:%.1fmm;height:%.1fmm\" xmlns=\"http://www.w3.org/2000/svg\">",
            -M, -M, p.cols * S + M + 6, p.rows * S + M + 6, wMm, hMm));
        sb.append(String.format("<rect x=\"0\" y=\"0\" width=\"%d\" height=\"%d\" fill=\"#fff\"/>", p.cols * S, p.rows * S));
        if (labels) {
            for (int c = 0; c < p.cols; c++) sb.append(String.format("<text x=\"%d\" y=\"-11\" class=\"lab\">%c</text>", c * S + 50, (char) ('a' + c)));
            for (int r = 0; r < p.rows; r++) sb.append(String.format("<text x=\"-15\" y=\"%d\" class=\"lab\">%d</text>", r * S + 58, r + 1));
        }
        StringBuilder thin = new StringBuilder(), thick = new StringBuilder();
        for (int r = 0; r < p.rows; r++) for (int c = 0; c < p.cols; c++) {
            int i = r * p.cols + c;
            if (c + 1 < p.cols) (p.region[i] == p.region[i + 1] ? thin : thick).append(String.format("M%d %dV%d", (c + 1) * S, r * S, (r + 1) * S));
            if (r + 1 < p.rows) (p.region[i] == p.region[i + p.cols] ? thin : thick).append(String.format("M%d %dH%d", c * S, (r + 1) * S, (c + 1) * S));
            int v = values[i];
            if (v != 0) sb.append(String.format("<text x=\"%d\" y=\"%d\" class=\"%s\">%d</text>", c * S + 50, r * S + 52, bold[i] ? "g" : "s", v));
        }
        sb.append("<path d=\"").append(thin).append("\" stroke=\"#9a9a9a\" stroke-width=\"2\" fill=\"none\"/>");
        sb.append("<path d=\"").append(thick).append("\" stroke=\"#111\" stroke-width=\"7\" stroke-linecap=\"square\" fill=\"none\"/>");
        sb.append(String.format("<rect x=\"0\" y=\"0\" width=\"%d\" height=\"%d\" stroke=\"#111\" stroke-width=\"9\" fill=\"none\"/>", p.cols * S, p.rows * S));
        return sb.append("</svg>").toString();
    }

    static String dots(int level) {
        StringBuilder sb = new StringBuilder("<span class=\"dots\">");
        for (int i = 1; i <= 9; i++) sb.append(i <= level ? "<i class=\"on\"></i>" : "<i></i>");
        return sb.append("</span>").toString();
    }

    static String techList(SuguruEngine.Puzzle p) {
        int hardest = -1;
        for (int t = 0; t < p.rating.uses.length; t++) if (p.rating.uses[t] > 0) hardest = t;
        List<String> l = new ArrayList<>();
        for (int t = 0; t < p.rating.uses.length; t++) if (p.rating.uses[t] > 0)
            l.add((t == hardest ? "<b>" : "") + esc(SuguruEngine.TECH_LABEL[t]) + " ×" + p.rating.uses[t] + (t == hardest ? "</b>" : ""));
        return String.join(" · ", l);
    }

    /** "top 4,1 · mængde 5 · par" */
    static String shortTag(SuguruEngine.Puzzle p) {
        return (p.grade == null ? "" : p.grade.peakLoadText() + " · ") + SuguruGrade.LEVEL_TECH[Math.min(12, p.rating.level)];
    }
    static int band(SuguruEngine.Puzzle p) { return p.grade == null ? Math.min(9, p.rating.level) : p.grade.band; }
    static String bandName(SuguruEngine.Puzzle p) { return SuguruGrade.BAND[band(p)]; }
    static String label(SuguruEngine.Puzzle p) { return bandName(p) + (p.grade == null ? "" : " " + p.grade.valueText()) + " · " + shortTag(p); }

    static String puzzleBlock(SuguruEngine.Puzzle p, int no, int perPage) {
        int[] g = p.givens; boolean[] bold = new boolean[g.length];
        for (int i = 0; i < g.length; i++) bold[i] = g[i] != 0;
        double cell = perPage == 1 ? Math.min(165.0 / p.cols, 175.0 / p.rows)
            : perPage == 2 ? Math.min(92.0 / p.cols, 98.0 / p.rows)
            : Math.min(78.0 / p.cols, 74.0 / p.rows);
        String value = p.grade == null ? "" : " " + p.grade.valueText();
        StringBuilder sb = new StringBuilder();
        sb.append("<section class=\"pz pp").append(perPage).append("\">");
        sb.append("<header><span class=\"no\">").append(no).append("</span><div class=\"meta\"><div class=\"lvl\">")
          .append(esc(bandName(p))).append("<span class=\"val\">").append(value).append("</span></div>")
          .append(dots(band(p))).append("</div></header>");
        sb.append("<div class=\"body\"><div class=\"gridwrap\">").append(svg(p, g, bold, cell, perPage != 4)).append("</div>");
        sb.append("<div class=\"why\">");
        if (perPage == 4) {
            sb.append("<p class=\"tag\">").append(esc(shortTag(p))).append("</p>");
        } else {
            sb.append("<h3>Hvorfor").append(esc(value)).append("?</h3>");
            if (p.grade != null) {
                sb.append("<p class=\"tag\">").append(esc(shortTag(p))).append("</p><dl>");
                for (String[] l : SuguruGrade.profileLines(p.grade, perPage != 1)) {
                    int dot = l[1].indexOf(". ");
                    String lead = dot > 0 && dot < 16 ? l[1].substring(0, dot + 1) : "";
                    String rest = lead.isEmpty() ? l[1] : l[1].substring(dot + 2);
                    sb.append("<dt>").append(esc(l[0])).append("</dt><dd>").append(lead.isEmpty() ? "" : "<b>" + esc(lead) + "</b> ").append(esc(rest)).append("</dd>");
                }
                sb.append("</dl>");
            }
            sb.append("<p class=\"tech\"><span>Teknikker:</span> ").append(techList(p)).append("</p>");
        }
        sb.append(String.format("<p class=\"small\">%d×%d · regioner op til %d · %d givne%s</p>", p.cols, p.rows, p.maxRegion, p.clueCount(), p.seed >= 0 ? " · #" + p.seed : ""));
        sb.append("<p class=\"code\"><span>Kode til hints:</span> ").append(SuguruCode.encode(p)).append("</p>");
        sb.append("</div></div></section>");
        return sb.toString();
    }

    static String solutionBlock(SuguruEngine.Puzzle p, int no, double cell) {
        boolean[] bold = new boolean[p.givens.length];
        for (int i = 0; i < bold.length; i++) bold[i] = p.givens[i] != 0;
        return "<figure class=\"sol\"><figcaption>" + no + "</figcaption>" + svg(p, p.solution, bold, cell, false) + "</figure>";
    }

    static String render(List<SuguruEngine.Puzzle> ps, String title, int perPage, String nuance) {
        StringBuilder sb = new StringBuilder();
        SuguruEngine.Puzzle first = ps.get(0);
        sb.append("<!DOCTYPE html><html lang=\"da\"><head><meta charset=\"utf-8\"><title>").append(esc(title)).append("</title>");
        sb.append("<style>").append(CSS).append("</style></head><body>");

        // forside / indhold
        sb.append("<div class=\"page cover\"><div class=\"stamp\">数</div><h1>").append(esc(title)).append("</h1>");
        boolean same = true; int maxR = 0, maxC = 0, maxReg = 0;
        for (SuguruEngine.Puzzle p : ps) { if (p.rows != first.rows || p.cols != first.cols) same = false; maxR = Math.max(maxR, p.rows); maxC = Math.max(maxC, p.cols); maxReg = Math.max(maxReg, p.maxRegion); }
        sb.append(String.format("<p class=\"sub\">%d opgaver · %s · regioner op til %d · %s</p>", ps.size(), same ? first.cols + "×" + first.rows : "blandede størrelser", maxReg,
            LocalDate.now().toString()));
        sb.append("<p class=\"rules\"><b>Regler.</b> Hver region med n felter skal have tallene 1 til n. Ens tal må ikke røre hinanden, heller ikke diagonalt.</p>");
        sb.append("<p class=\"rules\"><b>Hints.</b> Hver opgave har en kode (SU1-…). Skriv den i feltet »Har du en kode?« i Suguru-spillet, så kan du spille opgaven med trinvise hints.</p>");
        sb.append("<table class=\"toc\"><thead><tr><th>Nr.</th><th>Sværhed</th><th></th><th>Top, mængde og teknik</th><th>Givne</th></tr></thead><tbody>");
        int k = 1;
        for (SuguruEngine.Puzzle p : ps) {
            String mem = shortTag(p);
            sb.append("<tr><td>").append(k++).append("</td><td>").append(esc(bandName(p)))
              .append(p.grade == null ? "" : " <b>" + p.grade.valueText() + "</b>").append("</td><td>").append(dots(band(p)))
              .append("</td><td>").append(esc(mem)).append("</td><td>").append(p.clueCount()).append("</td></tr>");
        }
        sb.append("</tbody></table>");
        sb.append("<div class=\"howto\"><h2>Sådan læses sværhedsgraden</h2><p>Tallet måler <b>indsats</b>, ikke hvilken teknik der bruges. ")
          .append("Det er <b>top</b>, indsatsen i opgavens tungeste skridt, plus et tillæg på højst 1,0 for <b>mængde</b>, hvor mange tunge skridt der er (1-10). ")
          .append("Et skridts indsats er summen af <b>genkendelse</b> (hvor svært mønstret er at få øje på), <b>hukommelse</b> (hvor mange ting der skal holdes i hovedet på samme tid), ")
          .append("<b>længde</b> (antal led i ræsonnementet) og <b>overblik</b> (hvor få steder der var at komme videre). Ved hver opgave står regnestykket linje for linje.</p><ol class=\"levels\">");
        for (int l = 1; l <= 9; l++)
            sb.append("<li><b>").append(l).append(" ").append(esc(SuguruGrade.BAND[l])).append("</b></li>");
        sb.append("</ol></div></div>");

        // opgaver
        for (int i = 0; i < ps.size(); i += perPage) {
            sb.append("<div class=\"page puzzles pp").append(perPage).append("\">");
            for (int j = i; j < Math.min(ps.size(), i + perPage); j++) sb.append(puzzleBlock(ps.get(j), j + 1, perPage));
            sb.append("</div>");
        }

        // løsninger
        int solPerPage = maxR * maxC <= 49 ? 12 : 6;
        double solCell = solPerPage == 12 ? Math.min(52.0 / maxC, 52.0 / maxR) : Math.min(80.0 / maxC, 72.0 / maxR);
        for (int i = 0; i < ps.size(); i += solPerPage) {
            sb.append("<div class=\"page sols n").append(solPerPage).append("\"><h2>Løsninger</h2><div class=\"solgrid\">");
            for (int j = i; j < Math.min(ps.size(), i + solPerPage); j++) sb.append(solutionBlock(ps.get(j), j + 1, solCell));
            sb.append("</div></div>");
        }
        return sb.append("</body></html>").toString();
    }

    static final String CSS = String.join("\n",
        "@page { size: A4; margin: 13mm 14mm 14mm; }",
        "* { box-sizing: border-box; }",
        "html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
        "body { margin: 0; font: 10pt/1.45 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #17191e; background: #fff; }",
        "@media screen { body { background: #e9eae4; } .page { width: 210mm; min-height: 297mm; margin: 8mm auto; padding: 13mm 14mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.15); } }",
        ".page { break-after: page; }",
        ".page:last-child { break-after: auto; }",
        "h1, h2, h3, .no, .lvl, .stamp, .toc b { font-family: Georgia, 'Times New Roman', serif; }",
        ".cover h1 { font-size: 34pt; margin: 4mm 0 1mm; letter-spacing: .01em; }",
        ".stamp { width: 16mm; height: 16mm; border: 2.2pt solid #c8402b; color: #c8402b; border-radius: 2mm; display: grid; place-items: center; font-size: 26pt; font-weight: 700; transform: rotate(-4deg); }",
        ".sub { color: #6a6f79; margin: 0 0 5mm; }",
        ".rules { margin: 0 0 6mm; max-width: 150mm; }",
        ".toc { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 7mm; }",
        ".toc th { text-align: left; font-weight: 600; color: #6a6f79; border-bottom: 1pt solid #17191e; padding: 1.2mm 2mm; }",
        ".toc td { border-bottom: .5pt solid #d4d6cf; padding: 1.1mm 2mm; font-variant-numeric: tabular-nums; }",
        ".howto h2 { font-size: 13pt; margin: 0 0 1.5mm; }",
        ".howto p { margin: 0 0 2mm; max-width: 165mm; }",
        ".levels { columns: 2; column-gap: 8mm; margin: 0; padding-left: 5mm; font-size: 9pt; }",
        ".dots { display: inline-flex; gap: .8mm; vertical-align: middle; }",
        ".dots i { width: 1.6mm; height: 1.6mm; border-radius: 50%; background: #d4d6cf; }",
        ".dots i.on { background: #2c47a0; }",
        ".pz { break-inside: avoid; }",
        ".pz header { display: flex; align-items: center; gap: 4mm; margin-bottom: 2mm; }",
        ".no { font-size: 20pt; font-weight: 700; min-width: 9mm; }",
        ".lvl { font-size: 13pt; font-weight: 700; }",
        ".val { color: #2c47a0; }",
        ".grid { display: block; }",
        ".grid .g { font: 700 62px Georgia, 'Times New Roman', serif; text-anchor: middle; dominant-baseline: central; fill: #111; }",
        ".grid .s { font: 400 56px 'Helvetica Neue', Helvetica, Arial, sans-serif; text-anchor: middle; dominant-baseline: central; fill: #2c47a0; }",
        ".grid .lab { font: 24px 'Helvetica Neue', Helvetica, Arial, sans-serif; text-anchor: middle; fill: #8a8f99; }",
        ".pp2 .pz { height: 128mm; padding-bottom: 6mm; border-bottom: .6pt solid #d4d6cf; margin-bottom: 7mm; }",
        ".pp2 .pz:last-child { border-bottom: 0; margin-bottom: 0; }",
        ".pp2 .body { display: grid; grid-template-columns: auto 1fr; gap: 7mm; align-items: start; }",
        ".pp1 .body { display: flex; flex-direction: column; align-items: center; gap: 6mm; }",
        ".pp1 .why { max-width: 165mm; }",
        ".pp4.puzzles { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 132mm; gap: 6mm 8mm; }",
        ".pp4 .pz header { margin-bottom: 1mm; } .pp4 .no { font-size: 15pt; } .pp4 .lvl { font-size: 11pt; }",
        ".why h3 { font-size: 11.5pt; margin: 0 0 1.5mm; }",
        ".why dl { display: grid; grid-template-columns: auto 1fr; gap: 1.4mm 3mm; margin: 0 0 2.5mm; font-size: 9.3pt; }",
        ".why dt { color: #6a6f79; font-weight: 600; font-size: 8.5pt; padding-top: .3mm; }",
        ".why dd { margin: 0; }",
        ".decbar { display: flex; gap: .7mm; margin: 0 0 2.5mm; max-width: 60mm; }",
        ".decbar i { flex: 1; height: 1.4mm; border-radius: 1mm; background: #d4d6cf; } .decbar i.on { background: #2c47a0; }",
        ".tech { font-size: 8.8pt; margin: 0 0 2mm; } .tech span { color: #6a6f79; font-weight: 600; }",
        ".tag { margin: 1.5mm 0 0; font-size: 9pt; }",
        ".small { font-size: 7.8pt; color: #8a8f99; margin: 0; }",
        ".code { font: 8.6pt 'SF Mono', Menlo, Consolas, monospace; margin: 1mm 0 0; overflow-wrap: break-word; letter-spacing: .02em; }",
        ".code span { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #6a6f79; font-size: 7.8pt; }",
        ".sols h2 { font-size: 15pt; margin: 0 0 4mm; }",
        ".solgrid { display: grid; gap: 6mm 6mm; }",
        ".n12 .solgrid { grid-template-columns: repeat(3, 1fr); } .n6 .solgrid { grid-template-columns: repeat(2, 1fr); }",
        ".sol { margin: 0; break-inside: avoid; } .sol figcaption { font: 700 11pt Georgia, serif; margin-bottom: 1mm; }",
        ".sol .grid .s { fill: #444; }"
    );
}
