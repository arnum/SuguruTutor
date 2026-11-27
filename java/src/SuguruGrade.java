import java.util.*;

/**
 * Difficulty as effort, not as a ladder of techniques. The same calculation as js/grade.js in the web app.
 *
 * A human solution is simulated (always the easiest next number). Each step gets an effort from
 *  - recognition: how hard the pattern is to spot (the technique, its shape and surroundings)
 *  - memory:      how many things must be kept in mind at once
 *  - length:      the number of links in the reasoning
 *  - overview:    how few places there were to make progress
 * The puzzle's number = peak (the heaviest step) + an addition for load (how many heavy steps there are).
 * The weights are fitted to 17 puzzles with measured solving time and perceived difficulty (Nov. 2026).
 */
public final class SuguruGrade {

    private SuguruGrade() {}

    public static final String[] BAND = {"", "Beginner", "Easy", "Medium", "Hard", "Very hard", "Expert", "Master", "Extreme", "Diabolical"};
    /** Short name of the technique for each technique level 1-11 (12 = guessing). */
    public static final String[] LEVEL_TECH = {"", "singles", "neighbour elimination", "pairs", "mixed pair", "triples", "single-number chain",
        "bivalue chain", "mixed chain", "single-number what-if", "what-if with singles", "both ways", "what-if with techniques", "guessing"};
    // ---- The technique table's questions (as TT in tools/grade/techs.js). A unit is named by its code, which never changes;
    // the table's order (UNIT_ORDER, generated below) is the only order, so codes are never compared as numbers.
    static int rank(int code) {
        if (code == GUESS) return UNIT_ORDER.length;
        for (int i = 0; i < UNIT_ORDER.length; i++) if (UNIT_ORDER[i] == code) return i;
        return -1;
    }
    static boolean known(int code) { return rank(code) >= 0 && code != GUESS; }
    static boolean harder(int a, int b) { return rank(a) > rank(b); }
    static int max(int a, int b) { return rank(b) > rank(a) ? b : a; }
    /** methods: a is harder than b if its unit is, or (in one unit) if it comes later in the unit's list (as TT.harderMethod) */
    static boolean harderMethod(int a, int b) {
        int ua = METHOD_UNIT[a], ub = METHOD_UNIT[b];
        if (ua != ub) return harder(ua, ub);
        int[] ms = methods(ua); int ia = -1, ib = -1;
        for (int i = 0; i < ms.length; i++) { if (ms[i] == a) ia = i; if (ms[i] == b) ib = i; }
        return ia > ib;
    }
    static int[] methods(int code) { int r = rank(code); return r >= 0 && r < UNIT_ORDER.length ? UNIT_METHODS[r] : new int[0]; }
    static int last() { return UNIT_ORDER[UNIT_ORDER.length - 1]; }
    static int below(int code) { if (code == GUESS) return last(); int r = rank(code); return r > 0 ? UNIT_ORDER[r - 1] : code; }
    static int above(int code) { int r = rank(code); return r >= 0 && r < UNIT_ORDER.length - 1 ? UNIT_ORDER[r + 1] : code; }
    static int first(String family) { for (int i = 0; i < UNIT_ORDER.length; i++) if (UNIT_FAMILY[i].equals(family)) return UNIT_ORDER[i]; return -1; }
    static int code(String id) { for (int i = 0; i < UNIT_ORDER.length; i++) if (UNIT_ID[i].equals(id)) return UNIT_ORDER[i]; throw new IllegalArgumentException("no technique unit " + id); }

    /*
     * All numbers in the grade come from tools/grade/weights.json (the same as web/shared/js/grade.js). Features (SuguruTutor) ->
     * weights (below) -> effort (stepEffort). A calibration only changes weights.json; see tools/grade/README.md.
     */
    // <gen:weights> Written by tools/grade/gen.py from tools/grade/weights.json. Edit there, not here.
    // Pencil terms: [0] with pencil, [1] without pencil, [2] as you used to play; each a list per technique (derived from base, diff and anchor).
    static final int FIT = 12;
    static final double[] RECOG = {0, 0, 0.6, 2.2, 2.9, 3, 3.7, 1.9, 2.2, 2.5, 2.8, 3.1, 3.5, 3.1, 2.6};
    static final double[] LINK = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    static final double[] SPOT = {0.5, 0.5, 0.3, 0.15, 0};
    static final double W_cap = 14.9;
    static final double W_inner = 0.25;
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
    static final double W_singlesFirst = 0;
    static final double W_singlesNakedW = 0;
    static final double W_singlesNakedSpan = 1;
    static final double[][] P_mem = {{0.3, 0.3, 0.3, 0.1, 0.1, 0.2, 0.2, 0.1, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.1}, {0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.4, 0.3, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.3}, {0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3}};
    static final double[][] P_tech = {{0, 0, 0, -0.3, -0.5, -0.5, -0.6, -0.4, 0, 0, 0, 0, 0, 0, -0.3}, {0, 0, 0, 0, 0, 0.5, 0.6, 0, 1, 1.2, 0.3, 1.5, 1.5, 1.5, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double[][] P_multi = {{0, 0, 0, -0.25, -0.25, -0.125, -0.125, 0, 0, 0, 0, 0, 0, 0, -0.25}, {0, 0, 0, 0, 0, 0.125, 0.125, 0, 0.25, 0.25, 0, 0, 0.25, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double[][] P_trial = {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.3, 0, 0.3, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double[][] P_built = {{0, 0, 0, -0.4, -0.4, -0.2, -0.2, -0.4, 0, 0, 0, 0, 0, 0, -0.4}, {0, 0, 0, 0, 0, 0.2, 0.2, 0, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double[][] P_repeat = {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double[][] P_partial = {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double[][] P_len = {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.2, 0.2, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}};
    static final double P_multiCap = 1;
    // The technique table, from tools/grade/techniques.json: units in teaching order (codes never change; the order
    // is the only order), and per method (technique number) its unit and flags. See rank() below.
    static final int GUESS = 13;
    static final int[] UNIT_ORDER = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12};
    static final int[][] UNIT_METHODS = {{0, 1}, {2}, {3, 4}, {14}, {5, 6}, {7}, {8}, {9}, {10}, {11}, {12}, {13}};
    static final String[] UNIT_ID = {"singles", "neighbour", "pairs", "mixedPair", "triples", "chain1", "chain2", "chainMixed", "whatIf1", "whatIfSingles", "bothWays", "whatIfTech"};
    static final String[] UNIT_FAMILY = {"basic", "basic", "basic", "basic", "basic", "chain", "chain", "chain", "whatif", "whatif", "whatif", "whatif"};
    static final String[] UNIT_GAMES = {"", "", "", "suguru", "", "", "", "", "", "", "", ""};
    static final int[] METHOD_UNIT = {1, 1, 2, 3, 3, 5, 5, 6, 7, 8, 9, 10, 11, 12, 4};
    static final int[] METHOD_WEIGHT = {1, 1, 4, 8, 10, 15, 18, 20, 22, 24, 26, 30, 40, 60, 12};
    static final boolean[] METHOD_PATTERN = {false, false, true, true, true, true, true, false, false, false, false, false, false, false, true};
    static final boolean[] METHOD_INNER = {false, false, true, true, true, true, true, true, true, true, true, false, false, false, true};
    static final boolean[] METHOD_CHAIN = {false, false, false, false, false, false, false, true, true, true, false, false, false, false, false};
    static final boolean[] METHOD_BYLENGTH = {false, false, false, false, false, false, false, true, true, true, true, true, true, true, false};
    static final int[] METHOD_WITHIN = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 9, 0};
    // </gen:weights>
    // (after the generated table, which they are made from)
    static final int SINGLES = METHOD_UNIT[0];
    /** the units the solver tries after the singles, in order */
    static final int[] LADDER = java.util.Arrays.stream(UNIT_ORDER).filter(c -> c != METHOD_UNIT[0]).toArray();

    /** A step described by its features (the hardest pattern on the way to one number). */
    public static final class Step {
        final int L, T, mem, len, opts, innerMask, multi; final double progress; final double[] vis;
        /** what-if from a cell with 3+ options (0/1), cells built on earlier eliminations, the same pattern before (0/1), partial triple (0/1) */
        int trial, built, repeat, partial;
        Step(int L, int T, double[] vis, int mem, int len, int opts, double progress, int innerMask, int multi) {
            this.L = L; this.T = T; this.vis = vis; this.mem = mem; this.len = len; this.opts = opts; this.progress = progress; this.innerMask = innerMask; this.multi = multi;
        }
    }

    /** The effort in one step, split into its terms. */
    public static final class Effort {
        public double e, R, base, shapeT, openT, workT, memT, lenT, spot, innerT, nopenT, multiT, trialT, builtT, repeatT, partialT, lenPT;
    }

    public static final class Grade {
        public double value, peak, avgOpts, narrow, W, loadT, earlyT;
        public int level, band, decimal, tech, total, advCount, mem, len, nHard, load;
        /** The heaviest step. */
        public int hardT, hardL, hardMem, hardLen, hardOpts, hardMulti; public double hardProgress; public double[] hardVis; public Effort hard;
        /** Effort for each step (0 = a direct number). */
        public double[] series;
        /** The grade without pencil (null on the without-pencil grade itself). */
        public Grade np;
        public String valueText() { return String.format(Locale.ROOT, "%.1f", value); }
        /** The grade, and the grade without pencil if it is different. */
        public String bothText() { return np == null || Math.abs(np.value - value) < 0.05 ? valueText() : SuguruText.f("%s (without pencil %s)", valueText(), np.valueText()); }
        public String peakLoadText() { return SuguruText.f("peak %s · load %d", SuguruText.dec(peak), load); }
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

    /** The effort for one step; pen = false gives the price without pencil. The terms are added in the same order as in JS. */
    static Effort stepEffort(Step s, boolean pen) {
        int m = pen ? 0 : 1, T = s.T;
        Effort f = new Effort();
        f.base = 1.0 * RECOG[T];
        double[] v = s.vis;
        if (v != null) {
            if ((T >= 2 && T <= 6) || T == 14) f.shapeT = W_vis * (W_shapeSize * Math.min(W_shapeSizeCap, Math.max(0, v[0] - 2)) + W_shapeBent * v[1]);
            f.openT = W_vis * W_open * (W_openMid - v[2]);
            f.workT = W_vis * Math.max(W_workLo, Math.min(W_workHi, W_workPer * (v[3] - W_workMid)));
        }
        f.R = f.base + f.shapeT + f.openT + f.workT;
        f.memT = P_mem[m][T] * log2(1 + s.mem);
        f.lenT = W_len * log2(1 + Math.max(0, Math.max(1, s.len) - 1)) + LINK[T] * Math.max(0, Math.max(1, s.len) - 1);
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
        f.lenPT = P_len[m][T] * log2(1 + Math.max(0, Math.max(1, s.len) - 1));
        f.e = 1 + f.R + f.memT + f.lenT + f.spot + f.innerT + f.nopenT + f.multiT + f.trialT + f.builtT + f.repeatT + f.partialT + f.lenPT;
        return f;
    }

    /** The grade with pencil; g.np is the grade without pencil (the same steps, a different price). */
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
            optsSum += s.opts; if (s.opts <= 1) narrowCount++; if (harder(s.L, SINGLES)) g.advCount++;
        }
        g.total = N; g.avgOpts = optsSum / N; g.narrow = narrowCount / (double) N;
        // Load: the effort in all non-trivial steps beyond the heaviest; repeats of the same technique count for less
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
        value = Math.max(1, Math.min(W_cap, round1(value)));
        peak = g.tech == 1 ? value : top.e + g.earlyT;
        g.value = value; g.band = (int) Math.min(9, Math.floor(value)); g.level = g.band; g.decimal = (int) Math.min(9, Math.round((value - g.band) * 10));
        g.peak = round1(Math.min(W_cap, peak));
        g.load = g.tech == 1 ? 0 : (int) Math.max(1, Math.min(10, Math.round(10 * (1 - Math.exp(-(g.W + Math.max(0, top.e - W_loadOver)) / W_loadCountScale)))));
        g.hard = top; g.hardT = hs.T; g.hardL = hs.L; g.hardMem = hs.mem; g.hardLen = hs.len; g.hardOpts = hs.opts; g.hardProgress = hs.progress; g.hardVis = hs.vis; g.hardMulti = hs.multi;
        g.series = new double[N];
        for (int i = 0; i < N; i++) g.series[i] = steps.get(i).L < 2 ? 0 : round1(ef[i].e);
        return g;
    }

    /** Calculate and store the difficulty on a puzzle. */
    public static void attach(SuguruEngine.Puzzle p) {
        SuguruTutor tutor = new SuguruTutor(new SuguruEngine.Geometry(p.rows, p.cols), p.region);
        List<Step> st = solveProfile(tutor, p.givens);
        p.grade = st == null ? null : gradeFromSteps(st);
    }

    static final int[] START = {0, 1, 2, 2, 3, 6, 7, 9, 10, 11}; // levels since 26 Nov. 2026 (the mixed pair is 4)

    /**
     * Generate for a difficulty (band 1-9), a decimal range [lo, hi], an optional technique (must, 0 = all)
     * and a type ("short" = few heavy moves, "long" = many, otherwise all). Returns the nearest within the budget.
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
            int key = (must > 0 ? Math.abs(rank(p.rating.level) - rank(must)) * 100 : 0) + Math.abs(b - band) * 10 + (dec < lo ? lo - dec : dec > hi ? dec - hi : 0)
                + (p.grade != null && "short".equals(kind) ? Math.max(0, p.grade.load - 3) : p.grade != null && "long".equals(kind) ? Math.max(0, 6 - p.grade.load) : 0);
            if (key < bestKey) { best = p; bestKey = key; }
            if (key == 0 || System.currentTimeMillis() - t0 > budgetMs) break;
            if (must == 0) tt = b < band ? above(tt) : b > band ? max(band == 1 ? SINGLES : code("neighbour"), below(tt)) : tt;
        }
        return best;
    }

    static String f1(double x) { return (x < -0.04 ? "−" : "+") + SuguruText.dec(Math.abs(x)); }
    static String n1(double x) { return SuguruText.dec(x); }

    /** The sum behind the number as [contribution, text], line by line. */
    public static String[][] profileLines(Grade g) { return profileLines(g, false); }
    /** compact: without the base value and without the breakdown of recognition (for small spaces in the booklet). */
    public static String[][] profileLines(Grade g, boolean compact) {
        List<String[]> out = new ArrayList<>();
        if (g.tech == 1) {
            out.add(new String[]{n1(1.0), SuguruText.t("Only simple moves. Every number can be found directly from the numbers in the grid.")});
            String a = SuguruText.t(g.avgOpts < 2 ? "Narrow path." : g.avgOpts < 3.5 ? "Some options." : "Many options.");
            out.add(new String[]{f1(g.value - 1), SuguruText.f("%s On average %s places to make progress from.", a, n1(g.avgOpts))});
        } else {
            Effort h = g.hard;
            int pct = (int) Math.round(g.hardProgress * 100);
            StringBuilder rec = new StringBuilder(SuguruText.f("Recognition. The heaviest step is %s, %d %% into the puzzle.", SuguruText.t(SuguruEngine.TECH_LABEL[g.hardT]).toLowerCase(), pct));
            if (g.hardVis != null && !compact) {
                double[] v = g.hardVis; int size = (int) v[0], pf = (int) Math.round(v[2] * 100);
                rec.append(SuguruText.f(" The pattern itself %s", f1(h.base)));
                if (g.hardT >= 2 && g.hardT <= 6) rec.append(SuguruText.f(size == 1 ? "; %d cell %s" : v[1] > 0 ? "; %d cells around a corner %s" : "; %d cells in a line %s", size, f1(h.shapeT)));
                rec.append(SuguruText.f(pf >= 60 ? "; crowded area %s" : pf >= 40 ? "; half-open area %s" : "; open area %s", f1(h.openT)));
                rec.append(SuguruText.f("; %d empty cells to know %s.", (int) v[3], f1(h.workT)));
            }
            if (!compact) out.add(new String[]{n1(1.0), SuguruText.t("Base value for a number you can see directly.")});
            out.add(new String[]{compact ? n1(1 + h.R) : f1(h.R), rec.toString()});
            out.add(new String[]{f1(h.memT), g.hardMem == 0 ? SuguruText.t("Memory. Nothing needs to be remembered.") : SuguruText.f("Memory. %d things must be kept in mind at once.", g.hardMem)});
            out.add(new String[]{f1(h.lenT), SuguruText.f("Length. The reasoning has %d links.", g.hardLen)});
            if (h.innerT > 0) out.add(new String[]{f1(h.innerT), SuguruText.t("Along the way. The assumption needs harder techniques along the way.")});
            if (h.spot > 0) out.add(new String[]{f1(h.spot), g.hardOpts <= 1 ? SuguruText.t("Overview. There was only one place to make progress.") : SuguruText.f("Overview. There were only %d places to make progress.", g.hardOpts)});
            if (g.earlyT >= 0.05) out.add(new String[]{f1(g.earlyT), SuguruText.t("Early. The heavy step comes while the board is still open.")});
            out.add(new String[]{n1(g.peak), SuguruText.t("Peak: the heaviest step on its own.")});
            out.add(new String[]{f1(g.loadT), g.nHard == 1 ? SuguruText.f("Load %d of 10. It is the only step that needs more than a direct number.", g.load)
                : SuguruText.f("Load %d of 10. %d steps need more than a direct number.", g.load, g.nHard)});
        }
        out.add(new String[]{n1(g.value), SuguruText.t(BAND[g.band]) + "."});
        return out.toArray(new String[0][]);
    }

    public static String describe(SuguruEngine.Puzzle p) {
        StringBuilder sb = new StringBuilder();
        if (p.grade != null) sb.append(SuguruText.t(BAND[p.grade.band])).append(' ').append(p.grade.valueText()).append(" · ").append(p.grade.peakLoadText()).append(" · ");
        sb.append(SuguruText.t(LEVEL_TECH[p.rating.level])).append(" · ").append(SuguruText.f("%d givens", p.clueCount())).append('\n');
        if (p.grade != null) for (String[] l : profileLines(p.grade)) sb.append(String.format("  %5s  ", l[0])).append(l[1]).append('\n');
        for (int t = 0; t < p.rating.uses.length; t++) if (p.rating.uses[t] > 0)
            sb.append("  ").append(String.format("%-28s", SuguruText.t(SuguruEngine.TECH_LABEL[t]))).append(" x").append(p.rating.uses[t]).append('\n');
        return sb.toString();
    }
}
