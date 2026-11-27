import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.*;

/**
 * Makes a printable Suguru booklet: many puzzles in one HTML file laid out for A4,
 * with an explanation of the difficulty for each puzzle and the solutions at the back.
 * Open the file in Chrome and choose Print → Save as PDF (or use --pdf).
 *
 * Examples:
 *   java SuguruBook --count 12 --size 6x6 --grade 3-6 --out booklet.html
 *   java SuguruBook --count 8 --size 8x8 --grade 6 --type long --max 6 --per-page 1 --pdf
 *   java SuguruBook --count 6 --size 7x7 --grade 5 --technique 5 --lang da
 *
 * Options:
 *   --count N          number of puzzles (default 12)
 *   --size WxH         width x height, e.g. 6x6 or 8x10 (default 6x6)
 *   --grade X          difficulty: one number (1-9), a range (3-6) or a list (2,4,6). Default 3-6
 *   --technique T      the puzzle must need technique level T (1-12): 2 neighbour elimination, 3 pairs, 4 mixed pair,
 *                      5 triples, 6-8 chains, 9-12 what-if
 *   --type K           all | short (few heavy moves) | long (many heavy moves). Default all
 *   --nuance N         all | mild (.0-.3) | medium (.4-.6) | hard (.7-.9). Default all
 *   --max M            largest region size 4, 5 or 6 (default 5; 4 only up to 7x7)
 *   --per-page P       1, 2 or 4 puzzles per page (default 2)
 *   --seed S           starting seed; the same seed and options give the same booklet
 *   --time T           seconds per puzzle before the nearest is used (default 20)
 *   --title "..."      heading
 *   --out FILE         file name (default suguru-booklet.html, or suguru-haefte.html with --lang da)
 *   --pdf              also try to make a PDF with Chrome/Chromium (headless)
 *   --unsorted         keep the order instead of sorting by difficulty
 *   --codes "A,B,..."  make the booklet from particular puzzles given by their codes (SU1-...)
 *   --codes-file FILE  like --codes, but read the codes from a text file (one per line)
 *   --lang L           en (default) or da: the language of the booklet and the messages
 *
 * The Danish option names from before still work (--antal, --str, --grad, --teknik, --maks, --pr-side, --tid,
 * --titel, --ud, --usorteret, --koder, --koder-fil, --sprog), and so do the Danish values (alle, kort, lang, middel, haard).
 *
 * Each puzzle gets a code (SU1-...) that contains the puzzle itself. The code can be typed into the
 * Suguru game in the browser, so the puzzle can be played with hints, and it works across versions.
 */
public final class SuguruBook {

    public static void main(String[] args) throws Exception {
        SuguruEngine.fixConsoleEncoding();
        Map<String, String> o = parseArgs(args);
        SuguruText.da = o.getOrDefault("lang", "en").toLowerCase().startsWith("da");
        int count = Integer.parseInt(o.getOrDefault("count", "12"));
        String[] wh = o.getOrDefault("size", "6x6").toLowerCase().replace("×", "x").split("x");
        int cols = Integer.parseInt(wh[0].trim()), rows = Integer.parseInt(wh[1].trim());
        List<Integer> levels = parseLevels(o.getOrDefault("grade", o.getOrDefault("level", "3-6")));
        int must = Integer.parseInt(o.getOrDefault("technique", "0"));
        if (must != 0 && !SuguruGrade.known(must)) throw new IllegalArgumentException(SuguruText.t("--technique must be 1-12"));
        String kind = KIND.getOrDefault(o.getOrDefault("type", "all").toLowerCase(), "all");
        int[] band = nuance(o.getOrDefault("nuance", "all"));
        int maxRegion = Integer.parseInt(o.getOrDefault("max", "5"));
        int perPage = Integer.parseInt(o.getOrDefault("per-page", "2"));
        long seed = Long.parseLong(o.getOrDefault("seed", String.valueOf(System.currentTimeMillis() % 1_000_000_000L)));
        long budget = (long) (Double.parseDouble(o.getOrDefault("time", "20")) * 1000);
        String title = o.getOrDefault("title", "Suguru");
        String outName = o.getOrDefault("out", SuguruText.da ? "suguru-haefte.html" : "suguru-booklet.html");

        if (o.containsKey("codes") || o.containsKey("codes-file")) maxRegion = Math.max(4, Math.min(6, maxRegion));
        if (maxRegion < 4 || maxRegion > 6) throw new IllegalArgumentException(SuguruText.t("--max must be 4, 5 or 6"));
        if (maxRegion == 4 && rows * cols > 49 && !o.containsKey("codes") && !o.containsKey("codes-file")) throw new IllegalArgumentException(SuguruText.t("Regions of at most 4 cells can only be made up to 7x7"));
        if (perPage != 1 && perPage != 2 && perPage != 4) throw new IllegalArgumentException(SuguruText.t("--per-page must be 1, 2 or 4"));

        List<SuguruEngine.Puzzle> puzzles = new ArrayList<>();
        List<String> codes = new ArrayList<>();
        if (o.containsKey("codes")) for (String c : o.get("codes").split(",")) if (!c.trim().isEmpty()) codes.add(c.trim());
        if (o.containsKey("codes-file")) for (String c : Files.readAllLines(Paths.get(o.get("codes-file")), StandardCharsets.UTF_8)) if (!c.trim().isEmpty()) codes.add(c.trim());
        if (!codes.isEmpty()) count = 0;
        for (String c : codes) {
            try {
                SuguruEngine.Puzzle p = SuguruCode.toPuzzle(c);
                puzzles.add(p);
                System.out.print(SuguruText.f("Code %d/%d: %s%n", puzzles.size(), codes.size(), label(p)));
            } catch (IllegalArgumentException e) {
                System.out.println(SuguruText.f("Skipping %s: %s", c, e.getMessage()));
            }
        }
        if (!codes.isEmpty() && puzzles.isEmpty()) throw new IllegalArgumentException(SuguruText.t("No valid codes."));
        for (int i = 0; i < count; i++) {
            int level = levels.get((int) ((long) i * levels.size() / count));
            long t0 = System.currentTimeMillis();
            SuguruEngine.Puzzle p = SuguruGrade.generateGraded(rows, cols, level, must, band[0], band[1], kind, seed + i * 7919L, budget, maxRegion);
            puzzles.add(p);
            String miss = p.grade != null && p.grade.band != level ? SuguruText.f("  (wanted grade %d, nearest used)", level) : "";
            System.out.print(SuguruText.f("Puzzle %d/%d: %s · %.1f s%s%n", i + 1, count, label(p), (System.currentTimeMillis() - t0) / 1000.0, miss));
        }
        if (!o.containsKey("unsorted"))
            puzzles.sort(Comparator.comparingDouble(p -> p.grade == null ? p.rating.level : p.grade.value));

        String html = render(puzzles, title, perPage);
        Path out = Paths.get(outName).toAbsolutePath();
        Files.write(out, html.getBytes(StandardCharsets.UTF_8));
        System.out.println(SuguruText.f("Saved: %s", out));
        if (o.containsKey("pdf")) makePdf(out);
        else System.out.println(SuguruText.t("Open the file in Chrome and choose Print → Save as PDF (A4, without headers and footers)."));
    }

    // ------------------------------------------------------------------ arguments
    /** The Danish option names from before, and the English ones they stand for. */
    static final Map<String, String> ALIAS = new HashMap<>();
    /** --type values: Danish ones as well. */
    static final Map<String, String> KIND = new HashMap<>();
    static {
        String[][] a = {{"antal", "count"}, {"str", "size"}, {"grad", "grade"}, {"niveau", "level"}, {"teknik", "technique"},
            {"maks", "max"}, {"pr-side", "per-page"}, {"tid", "time"}, {"titel", "title"}, {"ud", "out"}, {"usorteret", "unsorted"},
            {"koder", "codes"}, {"koder-fil", "codes-file"}, {"sprog", "lang"}};
        for (String[] x : a) ALIAS.put(x[0], x[1]);
        String[][] k = {{"all", "all"}, {"alle", "all"}, {"short", "short"}, {"kort", "short"}, {"long", "long"}, {"lang", "long"}};
        for (String[] x : k) KIND.put(x[0], x[1]);
    }
    static Map<String, String> parseArgs(String[] args) {
        Map<String, String> m = new HashMap<>();
        for (int i = 0; i < args.length; i++) {
            if (!args[i].startsWith("--")) throw new IllegalArgumentException(SuguruText.f("Unknown argument: %s", args[i]));
            String k = args[i].substring(2);
            k = ALIAS.getOrDefault(k, k);
            if (k.equals("pdf") || k.equals("unsorted")) m.put(k, "yes");
            else if (i + 1 < args.length) m.put(k, args[++i]);
            else throw new IllegalArgumentException(SuguruText.f("Missing value for --%s", k));
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
        for (int x : l) if (x < 1 || x > 9) throw new IllegalArgumentException(SuguruText.f("Difficulty must be 1-9: %d", x));
        return l;
    }
    static int[] nuance(String s) {
        switch (s.toLowerCase().replace("å", "aa")) {
            case "mild": return new int[]{0, 3};
            case "medium": case "middel": return new int[]{4, 6};
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
                try (InputStream in = pr.getInputStream()) { byte[] buf = new byte[4096]; while (in.read(buf) != -1) { /* drain the output */ } }
                if (pr.waitFor() == 0 && Files.exists(pdf)) { System.out.println("PDF: " + pdf); return; }
            } catch (Exception ignored) { /* try the next one */ }
        }
        System.out.println(SuguruText.t("Could not find Chrome/Chromium. Set the environment variable CHROME to the program's path, or print the HTML file from Chrome."));
    }

    // ------------------------------------------------------------------ HTML
    static String esc(String s) { return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"); }

    /** The grid as SVG. values: numbers to show (0 = empty); bold = given numbers. */
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
            l.add((t == hardest ? "<b>" : "") + esc(SuguruText.t(SuguruEngine.TECH_LABEL[t])) + " ×" + p.rating.uses[t] + (t == hardest ? "</b>" : ""));
        return String.join(" · ", l);
    }

    /** "peak 4.1 · load 5 · pairs" */
    static String shortTag(SuguruEngine.Puzzle p) {
        return (p.grade == null ? "" : p.grade.peakLoadText() + " · ") + SuguruText.t(SuguruGrade.LEVEL_TECH[Math.min(13, p.rating.level)]);
    }
    static int band(SuguruEngine.Puzzle p) { return p.grade == null ? Math.min(9, p.rating.level) : p.grade.band; }
    static String bandName(SuguruEngine.Puzzle p) { return SuguruText.t(SuguruGrade.BAND[band(p)]); }
    static String label(SuguruEngine.Puzzle p) { return bandName(p) + (p.grade == null ? "" : " " + p.grade.bothText()) + " · " + shortTag(p); }

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
            sb.append("<h3>").append(esc(SuguruText.f("Why%s?", value))).append("</h3>");
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
            sb.append("<p class=\"tech\"><span>").append(SuguruText.t("Techniques:")).append("</span> ").append(techList(p)).append("</p>");
        }
        sb.append("<p class=\"small\">").append(SuguruText.f("%d×%d · regions up to %d · %d givens%s", p.cols, p.rows, p.maxRegion, p.clueCount(), p.seed >= 0 ? " · #" + p.seed : "")).append("</p>");
        sb.append("<p class=\"code\"><span>").append(SuguruText.t("Code for hints:")).append("</span> ").append(SuguruCode.encode(p)).append("</p>");
        sb.append("</div></div></section>");
        return sb.toString();
    }

    static String solutionBlock(SuguruEngine.Puzzle p, int no, double cell) {
        boolean[] bold = new boolean[p.givens.length];
        for (int i = 0; i < bold.length; i++) bold[i] = p.givens[i] != 0;
        return "<figure class=\"sol\"><figcaption>" + no + "</figcaption>" + svg(p, p.solution, bold, cell, false) + "</figure>";
    }

    static String render(List<SuguruEngine.Puzzle> ps, String title, int perPage) {
        StringBuilder sb = new StringBuilder();
        SuguruEngine.Puzzle first = ps.get(0);
        sb.append("<!DOCTYPE html><html lang=\"").append(SuguruText.da ? "da" : "en").append("\"><head><meta charset=\"utf-8\"><title>").append(esc(title)).append("</title>");
        sb.append("<style>").append(CSS).append("</style></head><body>");

        // cover / contents
        sb.append("<div class=\"page cover\"><div class=\"stamp\">数</div><h1>").append(esc(title)).append("</h1>");
        boolean same = true; int maxR = 0, maxC = 0, maxReg = 0;
        for (SuguruEngine.Puzzle p : ps) { if (p.rows != first.rows || p.cols != first.cols) same = false; maxR = Math.max(maxR, p.rows); maxC = Math.max(maxC, p.cols); maxReg = Math.max(maxReg, p.maxRegion); }
        sb.append("<p class=\"sub\">").append(SuguruText.f("%d puzzles · %s · regions up to %d · %s", ps.size(), same ? first.cols + "×" + first.rows : SuguruText.t("mixed sizes"), maxReg,
            LocalDate.now().toString())).append("</p>");
        sb.append("<p class=\"rules\">").append(SuguruText.t("<b>Rules.</b> Each region of n cells must contain the numbers 1 to n. Equal numbers may not touch, not even diagonally.")).append("</p>");
        sb.append("<p class=\"rules\">").append(SuguruText.t("<b>Hints.</b> Each puzzle has a code (SU1-…). Type it in the field “Do you have a puzzle code?” in the Suguru game, and you can play the puzzle with step-by-step hints.")).append("</p>");
        sb.append("<table class=\"toc\"><thead><tr><th>").append(SuguruText.t("No.")).append("</th><th>").append(SuguruText.t("Difficulty")).append("</th><th></th><th>")
          .append(SuguruText.t("Peak, load and technique")).append("</th><th>").append(SuguruText.t("Givens")).append("</th></tr></thead><tbody>");
        int k = 1;
        for (SuguruEngine.Puzzle p : ps) {
            String mem = shortTag(p);
            sb.append("<tr><td>").append(k++).append("</td><td>").append(esc(bandName(p)))
              .append(p.grade == null ? "" : " <b>" + p.grade.bothText() + "</b>").append("</td><td>").append(dots(band(p)))
              .append("</td><td>").append(esc(mem)).append("</td><td>").append(p.clueCount()).append("</td></tr>");
        }
        sb.append("</tbody></table>");
        sb.append("<div class=\"howto\"><h2>").append(SuguruText.t("How to read the difficulty")).append("</h2><p>")
          .append(SuguruText.t("The number measures <b>effort</b>, not which technique is used. "
            + "It is <b>peak</b>, the effort in the puzzle's heaviest step, plus an addition of at most 1.0 for <b>load</b>, how many heavy steps there are (1-10). "
            + "A step's effort is the sum of <b>recognition</b> (how hard the pattern is to spot), <b>memory</b> (how many things must be kept in mind at once), "
            + "<b>length</b> (the number of links in the reasoning) and <b>overview</b> (how few places there were to make progress). Each puzzle shows the sum line by line."))
          .append("</p><ol class=\"levels\">");
        for (int l = 1; l <= 9; l++)
            sb.append("<li><b>").append(l).append(" ").append(esc(SuguruText.t(SuguruGrade.BAND[l]))).append("</b></li>");
        sb.append("</ol></div></div>");

        // puzzles
        for (int i = 0; i < ps.size(); i += perPage) {
            sb.append("<div class=\"page puzzles pp").append(perPage).append("\">");
            for (int j = i; j < Math.min(ps.size(), i + perPage); j++) sb.append(puzzleBlock(ps.get(j), j + 1, perPage));
            sb.append("</div>");
        }

        // solutions
        int solPerPage = maxR * maxC <= 49 ? 12 : 6;
        double solCell = solPerPage == 12 ? Math.min(52.0 / maxC, 52.0 / maxR) : Math.min(80.0 / maxC, 72.0 / maxR);
        for (int i = 0; i < ps.size(); i += solPerPage) {
            sb.append("<div class=\"page sols n").append(solPerPage).append("\"><h2>").append(SuguruText.t("Solutions")).append("</h2><div class=\"solgrid\">");
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
