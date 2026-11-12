import java.util.*;

/**
 * Sværhedsgrad som indsats, ikke som teknik-stige. Samme beregning som js/grade.js i web-appen.
 *
 * En menneskelig løsning simuleres (altid det letteste næste tal). Hvert skridt får en indsats ud fra
 *  - genkendelse: hvor svært mønstret er at få øje på (teknikken, dens form og omgivelser)
 *  - hukommelse:  hvor mange ting der skal holdes i hovedet på samme tid
 *  - længde:      antal led i ræsonnementet
 *  - overblik:    hvor få steder der var at komme videre
 * Opgavens tal = top (det tungeste skridt) + et tillæg for mængde (hvor mange tunge skridt der er).
 * Vægtene er tilpasset 17 opgaver med målt løsningstid og oplevet sværhed (nov. 2026).
 */
public final class SuguruGrade {

    private SuguruGrade() {}

    public static final String[] BAND = {"", "Begynder", "Let", "Middel", "Svær", "Meget svær", "Ekspert", "Mester", "Ekstrem", "Djævelsk"};
    /** Kort navn på teknikken for hvert teknikniveau 1-11 (12 = gæt). */
    public static final String[] LEVEL_TECH = {"", "eneste kandidat/plads", "nabo-eliminering", "par", "tripler", "kæde med ét tal",
        "kæde med to-mulighedsfelter", "blandet kæde", "hvis-så med ét tal", "kort hvis-så", "begge veje", "dyb hvis-så", "gæt"};
    /** Grundpris for at genkende hver af de 14 teknikker. */
    static final double[] RECOG = {0, 0, 0.6, 1.0, 1.7, 1.9, 2.6, 1.9, 2.2, 2.5, 2.8, 3.1, 3.5, 4.4};

    public static final class Step {
        final int L, T, mem, len, opts; final double progress; final double[] vis;
        Step(int L, int T, double[] vis, int mem, int len, int opts, double progress) {
            this.L = L; this.T = T; this.vis = vis; this.mem = mem; this.len = len; this.opts = opts; this.progress = progress;
        }
    }

    /** Indsatsen i ét skridt, delt op i sine led. */
    public static final class Effort {
        public double e, R, base, shapeT, openT, workT, memT, lenT, spot;
    }

    public static final class Grade {
        public double value, peak, avgOpts, narrow, W, loadT, earlyT;
        public int level, band, decimal, tech, total, advCount, mem, len, nHard, load;
        /** Det tungeste skridt. */
        public int hardT, hardL, hardMem, hardLen, hardOpts; public double hardProgress; public double[] hardVis; public Effort hard;
        /** Indsats for hvert skridt (0 = direkte tal). */
        public double[] series;
        public String valueText() { return String.format(Locale.ROOT, "%.1f", value); }
        public String peakLoadText() { return "top " + String.format(Locale.ROOT, "%.1f", peak).replace('.', ',') + " · mængde " + load; }
    }

    public static List<Step> solveProfile(SuguruTutor tutor, int[] givens) {
        int[] known = givens.clone();
        int empty0 = 0;
        for (int v : known) if (v == 0) empty0++;
        List<Step> steps = new ArrayList<>();
        int placed = 0;
        while (true) {
            boolean any = false;
            for (int v : known) if (v == 0) { any = true; break; }
            if (!any) break;
            SuguruTutor.Hint h = tutor.easiest(known);
            if (h == null) return null;
            steps.add(new Step(h.hardestLevel, h.hardest, h.vis, h.mem, h.len, h.opts, placed / (double) empty0));
            known[h.cell] = h.v;
            placed++;
        }
        return steps;
    }

    static double clamp(double x) { return Math.max(0, Math.min(1, x)); }
    static double log2(double x) { return Math.log(x) / Math.log(2); }
    static double round1(double x) { return Math.round(x * 10) / 10.0; }

    static Effort stepEffort(Step s) {
        Effort f = new Effort();
        f.base = 1.0 * RECOG[s.T];
        double[] v = s.vis;
        if (v != null) {
            if (s.T >= 2 && s.T <= 6) f.shapeT = 0.35 * (0.15 * Math.min(3, Math.max(0, v[0] - 2)) + 0.2 * v[1]);
            f.openT = 0.35 * 0.8 * (0.55 - v[2]);
            f.workT = 0.35 * Math.max(-0.25, Math.min(0.5, 0.12 * (v[3] - 4)));
        }
        f.R = f.base + f.shapeT + f.openT + f.workT;
        f.memT = 0.3 * log2(1 + s.mem);
        f.lenT = 0.35 * log2(1 + Math.max(0, Math.max(1, s.len) - 1));
        f.spot = s.opts <= 1 ? 0.5 : s.opts == 2 ? 0.3 : s.opts == 3 ? 0.15 : 0;
        f.e = 1 + f.R + f.memT + f.lenT + f.spot;
        return f;
    }

    public static Grade gradeFromSteps(List<Step> steps) {
        int N = steps.size();
        Effort[] ef = new Effort[N];
        for (int i = 0; i < N; i++) ef[i] = stepEffort(steps.get(i));
        int hi = 0;
        for (int i = 0; i < N; i++) if (ef[i].e > ef[hi].e + 1e-9) hi = i;
        Effort top = ef[hi]; Step hs = steps.get(hi);
        Grade g = new Grade();
        double optsSum = 0; int narrowCount = 0;
        for (Step s : steps) {
            g.tech = Math.max(g.tech, s.L); g.mem = Math.max(g.mem, s.mem); g.len = Math.max(g.len, s.len);
            optsSum += s.opts; if (s.opts <= 1) narrowCount++; if (s.L >= 2) g.advCount++;
        }
        g.total = N; g.avgOpts = optsSum / N; g.narrow = narrowCount / (double) N;
        // Mængde: indsatsen i alle ikke-trivielle skridt ud over det tungeste; gentagelser af samme teknik tæller mindre
        int[] seen = new int[RECOG.length];
        for (int i = 0; i < N; i++) {
            Step s = steps.get(i);
            if (s.L < 2) continue;
            g.nHard++;
            int k = ++seen[s.T];
            if (i != hi) g.W += Math.max(0, ef[i].e - 1.5) / (1 + 0.25 * (k - 1));
        }
        double value, peak;
        if (g.tech == 1) {
            value = 1 + 0.9 * (0.65 * clamp((4.5 - g.avgOpts) / 2.5) + 0.35 * clamp(g.narrow / 0.15));
        } else {
            g.loadT = 1.0 * (1 - Math.exp(-g.W / 9));
            g.earlyT = 0.3 * (1 - hs.progress);
            value = top.e + g.earlyT + g.loadT;
        }
        value = Math.max(1, Math.min(9.9, round1(value)));
        peak = g.tech == 1 ? value : top.e + g.earlyT;
        g.value = value; g.band = (int) Math.floor(value); g.level = g.band; g.decimal = (int) Math.round((value - g.band) * 10);
        g.peak = round1(Math.min(9.9, peak));
        g.load = g.tech == 1 ? 0 : (int) Math.max(1, Math.min(10, Math.round(10 * (1 - Math.exp(-(g.W + Math.max(0, top.e - 1.5)) / 12)))));
        g.hard = top; g.hardT = hs.T; g.hardL = hs.L; g.hardMem = hs.mem; g.hardLen = hs.len; g.hardOpts = hs.opts; g.hardProgress = hs.progress; g.hardVis = hs.vis;
        g.series = new double[N];
        for (int i = 0; i < N; i++) g.series[i] = steps.get(i).L < 2 ? 0 : round1(ef[i].e);
        return g;
    }

    /** Beregn og gem sværhedsgraden på en opgave. */
    public static void attach(SuguruEngine.Puzzle p) {
        SuguruTutor tutor = new SuguruTutor(new SuguruEngine.Geometry(p.rows, p.cols), p.region);
        List<Step> st = solveProfile(tutor, p.givens);
        p.grade = st == null ? null : gradeFromSteps(st);
    }

    static final int[] START = {0, 1, 2, 2, 3, 5, 6, 8, 9, 10};

    /**
     * Generér til en sværhedsgrad (bånd 1-9), et decimal-interval [lo, hi], en valgfri teknik (must, 0 = alle)
     * og en type ("kort" = få tunge træk, "lang" = mange, ellers alle). Returnerer nærmeste inden for budgettet.
     */
    public static SuguruEngine.Puzzle generateGraded(int rows, int cols, int band, int must, int lo, int hi, String kind, long seed, long budgetMs, int maxRegion) {
        long t0 = System.currentTimeMillis();
        SuguruEngine.Puzzle best = null;
        int bestKey = Integer.MAX_VALUE;
        long sd = seed;
        int tt = must > 0 ? must : START[Math.max(1, Math.min(9, band))];
        while (true) {
            long left = budgetMs - (System.currentTimeMillis() - t0);
            SuguruEngine.Puzzle p = SuguruEngine.generate(rows, cols, tt, sd++, Math.max(1200, Math.min(4000, left)), maxRegion);
            attach(p);
            p.target = band;
            int b = p.grade != null ? p.grade.band : p.rating.level, dec = p.grade != null ? p.grade.decimal : 0;
            int key = (must > 0 ? Math.abs(p.rating.level - must) * 100 : 0) + Math.abs(b - band) * 10 + (dec < lo ? lo - dec : dec > hi ? dec - hi : 0)
                + (p.grade != null && "kort".equals(kind) ? Math.max(0, p.grade.load - 3) : p.grade != null && "lang".equals(kind) ? Math.max(0, 6 - p.grade.load) : 0);
            if (key < bestKey) { best = p; bestKey = key; }
            if (key == 0 || System.currentTimeMillis() - t0 > budgetMs) break;
            if (must == 0) tt = b < band ? Math.min(11, tt + 1) : b > band ? Math.max(band == 1 ? 1 : 2, tt - 1) : tt;
        }
        return best;
    }

    static String f1(double x) { return (x < -0.04 ? "−" : "+") + String.format(Locale.ROOT, "%.1f", Math.abs(x)).replace('.', ','); }
    static String n1(double x) { return String.format(Locale.ROOT, "%.1f", x).replace('.', ','); }

    /** Regnestykket bag tallet som [bidrag, tekst], linje for linje. */
    public static String[][] profileLines(Grade g) { return profileLines(g, false); }
    /** compact: uden grundtallet og uden opdelingen af genkendelsen (til små felter i hæftet). */
    public static String[][] profileLines(Grade g, boolean compact) {
        List<String[]> out = new ArrayList<>();
        if (g.tech == 1) {
            out.add(new String[]{"1,0", "Kun enkle træk. Hvert tal kan findes direkte ud fra tallene i gitteret."});
            String a = g.avgOpts < 2 ? "Smal vej." : g.avgOpts < 3.5 ? "Nogle muligheder." : "Mange muligheder.";
            out.add(new String[]{f1(g.value - 1), a + " I gennemsnit " + n1(g.avgOpts) + " steder at komme videre fra."});
        } else {
            Effort h = g.hard;
            int pct = (int) Math.round(g.hardProgress * 100);
            StringBuilder rec = new StringBuilder("Genkendelse. Det tungeste skridt er " + SuguruEngine.TECH_LABEL[g.hardT].toLowerCase() + ", " + pct + " % inde i opgaven.");
            if (g.hardVis != null && !compact) {
                double[] v = g.hardVis; int size = (int) v[0], pf = (int) Math.round(v[2] * 100);
                rec.append(" Mønstret i sig selv ").append(f1(h.base));
                if (g.hardT >= 2 && g.hardT <= 6) rec.append("; ").append(size).append(size == 1 ? " felt " : v[1] > 0 ? " felter om et hjørne " : " felter på linje ").append(f1(h.shapeT));
                rec.append("; ").append(pf >= 60 ? "tæt udfyldt område " : pf >= 40 ? "halvåbent område " : "åbent område ").append(f1(h.openT));
                rec.append("; ").append((int) v[3]).append(" tomme felter at kende ").append(f1(h.workT)).append(".");
            }
            if (!compact) out.add(new String[]{"1,0", "Grundtal for et tal, der ses direkte."});
            out.add(new String[]{compact ? n1(1 + h.R) : f1(h.R), rec.toString()});
            out.add(new String[]{f1(h.memT), "Hukommelse. " + (g.hardMem == 0 ? "Intet skal huskes." : g.hardMem + " ting skal holdes i hovedet på samme tid.")});
            out.add(new String[]{f1(h.lenT), "Længde. Ræsonnementet har " + g.hardLen + " led."});
            if (h.spot > 0) out.add(new String[]{f1(h.spot), "Overblik. Der var kun " + (g.hardOpts <= 1 ? "ét sted" : g.hardOpts + " steder") + " at komme videre."});
            if (g.earlyT >= 0.05) out.add(new String[]{f1(g.earlyT), "Tidligt. Det tunge skridt kommer, mens pladen stadig er åben."});
            out.add(new String[]{n1(g.peak), "Top: det tungeste skridt alene."});
            out.add(new String[]{f1(g.loadT), "Mængde " + g.load + " af 10. " + (g.nHard == 1 ? "Det er det eneste skridt, der kræver mere end et direkte tal."
                : g.nHard + " skridt kræver mere end et direkte tal.")});
        }
        out.add(new String[]{n1(g.value), BAND[g.band] + "."});
        return out.toArray(new String[0][]);
    }

    public static String describe(SuguruEngine.Puzzle p) {
        StringBuilder sb = new StringBuilder();
        if (p.grade != null) sb.append(BAND[p.grade.band]).append(' ').append(p.grade.valueText()).append(" · ").append(p.grade.peakLoadText()).append(" · ");
        sb.append(LEVEL_TECH[Math.min(12, p.rating.level)]).append(" · ").append(p.clueCount()).append(" givne\n");
        if (p.grade != null) for (String[] l : profileLines(p.grade)) sb.append(String.format("  %5s  ", l[0])).append(l[1]).append('\n');
        for (int t = 0; t < p.rating.uses.length; t++) if (p.rating.uses[t] > 0)
            sb.append("  ").append(String.format("%-28s", SuguruEngine.TECH_LABEL[t])).append(" x").append(p.rating.uses[t]).append('\n');
        return sb.toString();
    }
}
