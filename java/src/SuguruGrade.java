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
        "kæde med to-mulighedsfelter", "blandet kæde", "hvis-så med ét tal", "hvis-så med enkle tal", "begge veje", "hvis-så med teknikker", "gæt"};
    /* Alle tal i graden kommer fra tools/grade/weights.json (samme som web/js/grade.js). Træk (SuguruTutor) ->
       vægte (nedenfor) -> indsats (stepEffort). En kalibrering ændrer kun weights.json; se tools/grade/README.md. */
    // <gen:weights> Skrevet af tools/grade/gen.py ud fra tools/grade/weights.json. Ret dér, ikke her.
    // Blyant-led: [0] med blyant, [1] uden blyant, [2] som du plejede; hver en liste pr. teknik (udledt af base, diff og anchor).
    static final int FIT = 8;
    static final double[] RECOG = {0, 0, 0.6, 2.2, 2.9, 3, 3.7, 1.9, 2.2, 2.5, 2.8, 3.1, 3.5, 3.1};
    static final double[] SPOT = {0.5, 0.5, 0.3, 0.15, 0};
    static final double W_inner = 0.6;
    static final double W_vis = 0.35;
    static final double W_shapeSize = 0.15;
    static final double W_shapeSizeCap = 3;
    static final double W_shapeBent = 0.2;
    static final double W_open = 0.8;
    static final double W_openMid = 0.55;
    static final double W_workPer = 0.12;
    static final double W_workMid = 4;
    static final double W_workLo = -0.25;
    static final double W_workHi = 0.5;
    static final double W_len = 0.35;
    static final double W_loadOver = 1.5;
    static final double W_loadTechRepeat = 0.25;
    static final double W_loadScale = 9;
    static final double W_loadWeight = 1;
    static final double W_loadCountScale = 12;
    static final double W_early = 0.3;
    static final double W_singlesK = 0.9;
    static final double W_singlesOptsW = 0.65;
    static final double W_singlesOptsMid = 4.5;
    static final double W_singlesOptsSpan = 2.5;
    static final double W_singlesNarrowW = 0.35;
    static final double W_singlesNarrowSpan = 0.15;
    static final double[][] P_mem = {{0.3, 0.3, 0.3, 0.1, 0.1, 0.2, 0.2, 0.1, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3}, {0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5}, {0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3}};
    static final double[][] P_tech = {{0, 0, 0, -0.3, -0.5, -0.5, -0.6, -0.4, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0.5, 0.6, 0, 1, 1.2, 0.3, 1.5, 1.5, 1.5}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double[][] P_multi = {{0, 0, 0, -0.25, -0.25, -0.125, -0.125, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0.125, 0.125, 0, 0.25, 0.25, 0, 0, 0.25, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double[][] P_trial = {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.3, 0, 0.3}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double[][] P_built = {{0, 0, 0, -0.4, -0.4, -0.2, -0.2, -0.4, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0.2, 0.2, 0, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double[][] P_repeat = {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double[][] P_partial = {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double P_multiCap = 1;
    // </gen:weights>

    /** Et skridt beskrevet ved sine træk (det sværeste mønster frem til ét tal). */
    public static final class Step {
        final int L, T, mem, len, opts, innerMask, multi; final double progress; final double[] vis;
        /** hvis-så fra felt med 3+ muligheder (0/1), felter bygget på tidligere strygninger, samme mønster før (0/1), delvis tripel (0/1) */
        int trial, built, repeat, partial;
        Step(int L, int T, double[] vis, int mem, int len, int opts, double progress, int innerMask, int multi) {
            this.L = L; this.T = T; this.vis = vis; this.mem = mem; this.len = len; this.opts = opts; this.progress = progress; this.innerMask = innerMask; this.multi = multi;
        }
    }

    /** Indsatsen i ét skridt, delt op i sine led. */
    public static final class Effort {
        public double e, R, base, shapeT, openT, workT, memT, lenT, spot, innerT, nopenT, multiT, trialT, builtT, repeatT, partialT;
    }

    public static final class Grade {
        public double value, peak, avgOpts, narrow, W, loadT, earlyT;
        public int level, band, decimal, tech, total, advCount, mem, len, nHard, load;
        /** Det tungeste skridt. */
        public int hardT, hardL, hardMem, hardLen, hardOpts, hardMulti; public double hardProgress; public double[] hardVis; public Effort hard;
        /** Indsats for hvert skridt (0 = direkte tal). */
        public double[] series;
        /** Graden uden blyant (null på selve uden-blyant-graden). */
        public Grade np;
        public String valueText() { return String.format(Locale.ROOT, "%.1f", value); }
        /** Graden, og graden uden blyant hvis den er en anden. */
        public String bothText() { return np == null || Math.abs(np.value - value) < 0.05 ? valueText() : valueText() + " (uden blyant " + np.valueText() + ")"; }
        public String peakLoadText() { return "top " + String.format(Locale.ROOT, "%.1f", peak).replace('.', ',') + " · mængde " + load; }
    }

    public static List<Step> solveProfile(SuguruTutor tutor, int[] givens) {
        int[] known = givens.clone();
        int empty0 = 0;
        for (int v : known) if (v == 0) empty0++;
        List<Step> steps = new ArrayList<>();
        int placed = 0;
        java.util.Set<String> seen = new java.util.HashSet<>();
        while (true) {
            boolean any = false;
            for (int v : known) if (v == 0) { any = true; break; }
            if (!any) break;
            SuguruTutor.Hint h = tutor.easiest(known);
            if (h == null) return null;
            Step st = new Step(h.hardestLevel, h.hardest, h.vis, h.mem, h.len, h.opts, placed / (double) empty0, h.innerMask, h.multi);
            st.trial = h.trial; st.built = h.built; st.partial = h.partial;
            if (h.sig != null) st.repeat = seen.add(h.sig) ? 0 : 1;
            steps.add(st);
            known[h.cell] = h.v;
            placed++;
        }
        return steps;
    }

    static double clamp(double x) { return Math.max(0, Math.min(1, x)); }
    static double log2(double x) { return Math.log(x) / Math.log(2); }
    static double round1(double x) { return Math.round(x * 10) / 10.0; }

    /** Indsatsen for ét skridt; pen = false giver prisen uden blyant. Leddene lægges sammen i samme rækkefølge som i JS. */
    static Effort stepEffort(Step s, boolean pen) {
        int m = pen ? 0 : 1, T = s.T;
        Effort f = new Effort();
        f.base = 1.0 * RECOG[T];
        double[] v = s.vis;
        if (v != null) {
            if (T >= 2 && T <= 6) f.shapeT = W_vis * (W_shapeSize * Math.min(W_shapeSizeCap, Math.max(0, v[0] - 2)) + W_shapeBent * v[1]);
            f.openT = W_vis * W_open * (W_openMid - v[2]);
            f.workT = W_vis * Math.max(W_workLo, Math.min(W_workHi, W_workPer * (v[3] - W_workMid)));
        }
        f.R = f.base + f.shapeT + f.openT + f.workT;
        f.memT = P_mem[m][T] * log2(1 + s.mem);
        f.lenT = W_len * log2(1 + Math.max(0, Math.max(1, s.len) - 1));
        f.spot = SPOT[Math.max(0, Math.min(4, s.opts))];
        double innerMax = 0; boolean anyInner = false;
        for (int t = 0; t < RECOG.length; t++) if ((s.innerMask & (1 << t)) != 0) { innerMax = anyInner ? Math.max(innerMax, RECOG[t]) : RECOG[t]; anyInner = true; }
        f.innerT = anyInner ? W_inner * innerMax : 0;
        f.nopenT = P_tech[m][T];
        f.multiT = Math.max(-P_multiCap, Math.min(P_multiCap, P_multi[m][T] * s.multi));
        f.trialT = P_trial[m][T] * s.trial;
        f.builtT = P_built[m][T] * log2(1 + s.built);
        f.repeatT = -P_repeat[m][T] * (s.repeat != 0 ? f.R : 0);
        f.partialT = P_partial[m][T] * s.partial;
        f.e = 1 + f.R + f.memT + f.lenT + f.spot + f.innerT + f.nopenT + f.multiT + f.trialT + f.builtT + f.repeatT + f.partialT;
        return f;
    }

    /** Graden med blyant; g.np er graden uden blyant (samme skridt, anden pris). */
    public static Grade gradeFromSteps(List<Step> steps) {
        Grade g = gradeFromSteps(steps, true);
        g.np = gradeFromSteps(steps, false);
        return g;
    }
    public static Grade gradeFromSteps(List<Step> steps, boolean pen) {
        int N = steps.size();
        Effort[] ef = new Effort[N];
        for (int i = 0; i < N; i++) ef[i] = stepEffort(steps.get(i), pen);
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
            if (i != hi) g.W += Math.max(0, ef[i].e - W_loadOver) / (1 + W_loadTechRepeat * (k - 1));
        }
        double value, peak;
        if (g.tech == 1) {
            value = 1 + W_singlesK * (W_singlesOptsW * clamp((W_singlesOptsMid - g.avgOpts) / W_singlesOptsSpan) + W_singlesNarrowW * clamp(g.narrow / W_singlesNarrowSpan));
        } else {
            g.loadT = W_loadWeight * (1 - Math.exp(-g.W / W_loadScale));
            g.earlyT = W_early * (1 - hs.progress);
            value = top.e + g.earlyT + g.loadT;
        }
        value = Math.max(1, Math.min(9.9, round1(value)));
        peak = g.tech == 1 ? value : top.e + g.earlyT;
        g.value = value; g.band = (int) Math.floor(value); g.level = g.band; g.decimal = (int) Math.round((value - g.band) * 10);
        g.peak = round1(Math.min(9.9, peak));
        g.load = g.tech == 1 ? 0 : (int) Math.max(1, Math.min(10, Math.round(10 * (1 - Math.exp(-(g.W + Math.max(0, top.e - W_loadOver)) / W_loadCountScale)))));
        g.hard = top; g.hardT = hs.T; g.hardL = hs.L; g.hardMem = hs.mem; g.hardLen = hs.len; g.hardOpts = hs.opts; g.hardProgress = hs.progress; g.hardVis = hs.vis; g.hardMulti = hs.multi;
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
            if (h.innerT > 0) out.add(new String[]{f1(h.innerT), "Undervejs. Antagelsen kræver sværere teknikker undervejs."});
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
