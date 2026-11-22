import java.util.*;

/**
 * Finds the easiest next number from a position – like a human solver – and which support steps
 * (invisible facts) it takes. Used for the decimal rating (memory, timing, load).
 *
 * A faithful port of the web version's hint engine (without the explanation texts).
 */
public final class SuguruTutor {

    static final int[] TECH_LEVEL = SuguruEngine.TECH_LEVEL;
    static final int[] TECH_WEIGHT = SuguruEngine.TECH_WEIGHT;

    final int n, cols, nr;
    final int[][] king;
    final int[] region, size;
    final int[][] RC, peers;
    final boolean[] peerM;

    // ------------------------------------------------------------------ data types
    static final class Broken { final int kind, cell, region, v; Broken(int kind, int cell, int region, int v) { this.kind = kind; this.cell = cell; this.region = region; this.v = v; } }
    static final class St {
        int[] cand, val; Broken broken;
        St copy() { St t = new St(); t.cand = cand.clone(); t.val = val.clone(); t.broken = broken; return t; }
    }
    static final int LAST = 0, HIDDEN = 1, NAKED = 2;
    static final class Single { final int kind, cell, v, region; final double score;
        Single(int kind, int cell, int v, int region, double score) { this.kind = kind; this.cell = cell; this.v = v; this.region = region; this.score = score; } }
    static final class Target { final int cell, mask; Target(int cell, int mask) { this.cell = cell; this.mask = mask; } }
    static final class App {
        int tech, region = -1, v, mask, cell = -1, goal = -1, relCount, memPeak;
        /** Bit mask of the techniques used inside a what-if (only steps that carry the contradiction). */
        int innerMask;
        int[] spots, cells, nodes, rootA, rootB;
        List<Target> targets = new ArrayList<>();
        App copy() {
            App a = new App();
            a.tech = tech; a.region = region; a.v = v; a.mask = mask; a.cell = cell; a.goal = goal; a.relCount = relCount; a.memPeak = memPeak; a.innerMask = innerMask;
            a.spots = spots; a.cells = cells; a.nodes = nodes; a.rootA = rootA; a.rootB = rootB; a.targets = new ArrayList<>(targets);
            return a;
        }
    }
    static final class Step { final boolean place; final Single single; final App app;
        Step(Single s) { place = true; single = s; app = null; } Step(App a) { place = false; single = null; app = a; } }

    /** Result: the easiest next number and its support. */
    public static final class Hint {
        public final int cell, v, hardest, hardestLevel, opts, mem, len; public final int[] support;
        /** Techniques inside the hardest what-if (bit mask over technique numbers; 0 = only singles). */
        public int innerMask;
        /** Cells that the hardest step eliminates in and that still have several options afterwards (without pencil they must be remembered). */
        public int multi;
        /** What-if from a cell with 3+ options (0/1): the contradiction eliminates only one number, which must be remembered without pencil. */
        public int trial;
        /** Cells in the hardest pattern whose options build on earlier eliminations (not only on the placed numbers). */
        public int built;
        /** Partial triple (0/1): not all three cells/numbers have all three options. */
        public int partial;
        /** The pattern's identity (technique and cells), to see whether the same pattern is used again. */
        public String sig;
        /** How visible the hardest step is: [number of cells in the pattern, 1 if it bends, share of filled cells around it, empty cells you need to know]. Can be null. */
        public double[] vis;
        Hint(int cell, int v, int hardest, int opts, int[] support, int mem, int len) {
            this.cell = cell; this.v = v; this.hardest = hardest; this.hardestLevel = TECH_LEVEL[hardest]; this.opts = opts; this.support = support;
            this.mem = mem; this.len = len;
        }
    }
    /** Result of a traced what-if: the relevant steps and the working memory. */
    static final class TrialResult { final int relCount, memPeak; int innerMask; TrialResult(int r, int m) { relCount = r; memPeak = m; } }

    /**
     * Working memory: how many facts are "alive" (needed later) at the same time.
     * Like register allocation in a compiler: a fact lives from when it is found until it is last used.
     * The assumption (node 0) must be remembered all the way to the conclusion.
     */
    static int peakLive(List<Set<Integer>> nodes, Set<Integer> rel, Set<Integer> rootDeps) {
        List<Integer> ids = new ArrayList<>(rel);
        Collections.sort(ids);
        final int END = 1_000_000_000;
        Map<Integer, Integer> last = new HashMap<>();
        for (int i : ids) last.put(i, -1);
        for (int j : ids) for (int d : nodes.get(j)) if (last.containsKey(d)) last.put(d, Math.max(last.get(d), j));
        for (int d : rootDeps) if (last.containsKey(d)) last.put(d, END);
        if (last.containsKey(0)) last.put(0, END);
        List<Integer> times = new ArrayList<>(ids);
        times.add(END);
        int peak = 0;
        for (int t : times) {
            int live = 0;
            for (int i : ids) if (i < t && last.get(i) >= t) live++;
            if (live > peak) peak = live;
        }
        return peak;
    }

    public SuguruTutor(SuguruEngine.Geometry G, int[] region) {
        n = G.n; cols = G.cols; this.region = region; king = G.king;
        RC = SuguruEngine.buildRegions(n, region);
        nr = RC.length;
        size = new int[n];
        for (int c = 0; c < n; c++) size[c] = RC[region[c]].length;
        peerM = new boolean[n * n];
        peers = new int[n][];
        for (int a = 0; a < n; a++) {
            List<Integer> p = new ArrayList<>();
            for (int b = 0; b < n; b++) {
                if (a == b) continue;
                boolean t = Math.abs(a / cols - b / cols) <= 1 && Math.abs(a % cols - b % cols) <= 1;
                if (t || region[a] == region[b]) { peerM[a * n + b] = true; p.add(b); }
            }
            peers[a] = SuguruEngine.toArray(p);
        }
    }

    boolean peer(int a, int b) { return peerM[a * n + b]; }
    static int pc(int x) { return Integer.bitCount(x); }
    static int ctz(int x) { return Integer.numberOfTrailingZeros(x); }
    static int[] bitsOf(int m) { int k = 0; int[] t = new int[6]; for (int v = 1; v <= 6; v++) if ((m & (1 << v)) != 0) t[k++] = v; return Arrays.copyOf(t, k); }

    // ------------------------------------------------------------------ state
    St fresh() { St s = new St(); s.cand = new int[n]; s.val = new int[n]; for (int c = 0; c < n; c++) s.cand[c] = (1 << (size[c] + 1)) - 2; return s; }
    boolean solved(St s) { for (int v : s.val) if (v == 0) return false; return true; }
    void place(St s, int c, int v) {
        int bit = 1 << v;
        if ((s.cand[c] & bit) == 0) { if (s.broken == null) s.broken = new Broken(0, c, -1, 0); return; }
        s.val[c] = v; s.cand[c] = bit;
        for (int p : peers[c]) if ((s.cand[p] & bit) != 0) { s.cand[p] &= ~bit; if (s.cand[p] == 0 && s.broken == null) s.broken = new Broken(0, p, -1, 0); }
    }
    int elim(St s, int c, int m) {
        if (s.val[c] != 0 || (s.cand[c] & m) == 0) return 0;
        int r = s.cand[c] & m;
        s.cand[c] &= ~m;
        if (s.cand[c] == 0 && s.broken == null) s.broken = new Broken(0, c, -1, 0);
        return r;
    }
    St fromKnown(int[] known) { St s = fresh(); for (int c = 0; c < n; c++) if (known[c] != 0) place(s, c, known[c]); return s; }
    void apply(St s, App a) { for (Target t : a.targets) elim(s, t.cell, t.mask); }
    boolean regionHas(St s, int r, int d) { for (int c : RC[r]) if (s.val[c] == d) return true; return false; }
    List<Integer> spotsOf(St s, int r, int mask) { List<Integer> l = new ArrayList<>(); for (int c : RC[r]) if (s.val[c] == 0 && (s.cand[c] & mask) != 0) l.add(c); return l; }

    // ------------------------------------------------------------------ singles
    List<Single> singles(St s) {
        Map<Integer, Single> best = new LinkedHashMap<>();
        for (int r = 0; r < nr; r++) {
            int[] cells = RC[r];
            List<Integer> empty = new ArrayList<>();
            for (int c : cells) if (s.val[c] == 0) empty.add(c);
            if (empty.isEmpty()) continue;
            int placed = 0;
            for (int c : cells) if (s.val[c] != 0) placed |= 1 << s.val[c];
            int[] missing = bitsOf(((1 << (cells.length + 1)) - 2) & ~placed);
            if (empty.size() == 1 && missing.length == 1 && (s.cand[empty.get(0)] & (1 << missing[0])) != 0)
                add(best, new Single(LAST, empty.get(0), missing[0], r, 0));
            for (int v : missing) {
                int cnt = 0, spot = -1;
                for (int c : empty) if ((s.cand[c] & (1 << v)) != 0) { cnt++; spot = c; }
                if (cnt == 1) add(best, new Single(HIDDEN, spot, v, r, 1 + cells.length / 10.0));
            }
        }
        for (int c = 0; c < n; c++)
            if (s.val[c] == 0 && pc(s.cand[c]) == 1) add(best, new Single(NAKED, c, ctz(s.cand[c]), region[c], 1.5 + size[c] / 10.0));
        List<Single> out = new ArrayList<>(best.values());
        out.sort((a, b) -> a.score != b.score ? Double.compare(a.score, b.score) : Integer.compare(a.cell, b.cell));
        return out;
    }
    static void add(Map<Integer, Single> best, Single x) { Single o = best.get(x.cell); if (o == null || x.score < o.score) best.put(x.cell, x); }

    int singleHolds(St s, int cell, int v) {
        if (s.val[cell] != 0) return -1;
        int r = region[cell];
        List<Integer> empty = new ArrayList<>();
        for (int c : RC[r]) if (s.val[c] == 0) empty.add(c);
        if (empty.size() == 1 && empty.get(0) == cell && (s.cand[cell] & (1 << v)) != 0) return LAST;
        List<Integer> spots = new ArrayList<>();
        for (int c : empty) if ((s.cand[c] & (1 << v)) != 0) spots.add(c);
        if (spots.size() == 1 && spots.get(0) == cell && !regionHas(s, r, v)) return HIDDEN;
        if (s.cand[cell] == 1 << v) return NAKED;
        return -1;
    }

    // ------------------------------------------------------------------ techniques
    List<App> neighborApps(St s, boolean first) {
        List<App> out = new ArrayList<>();
        for (int r = 0; r < nr; r++) {
            int[] cells = RC[r];
            for (int v = 1; v <= cells.length; v++) {
                if (regionHas(s, r, v)) continue;
                int bit = 1 << v;
                List<Integer> spots = spotsOf(s, r, bit);
                if (spots.size() < 2) continue;
                App a = new App();
                for (int x : peers[spots.get(0)]) {
                    if (s.val[x] != 0 || (s.cand[x] & bit) == 0 || spots.contains(x)) continue;
                    boolean all = true;
                    for (int sp : spots) if (!peer(x, sp)) { all = false; break; }
                    if (all) a.targets.add(new Target(x, bit));
                }
                if (!a.targets.isEmpty()) {
                    a.tech = 2; a.region = r; a.v = v; a.spots = SuguruEngine.toArray(spots);
                    out.add(a); if (first) return out;
                }
            }
        }
        return out;
    }

    List<App> nakedApps(St s, int k, boolean first) {
        List<App> out = new ArrayList<>();
        List<Integer> l = new ArrayList<>();
        for (int c = 0; c < n; c++) { int b = pc(s.cand[c]); if (s.val[c] == 0 && b >= 2 && b <= k) l.add(c); }
        nakedRec(s, SuguruEngine.toArray(l), k, 0, 0, 0, new int[k], out, first);
        return out;
    }
    boolean nakedRec(St s, int[] cs, int k, int st, int d, int m, int[] ch, List<App> out, boolean first) {
        if (d == k) {
            if (pc(m) != k) return false;
            App a = new App();
            for (int p : peers[ch[0]]) {
                boolean inCh = false;
                for (int q : ch) if (q == p) inCh = true;
                if (s.val[p] != 0 || inCh || (s.cand[p] & m) == 0) continue;
                boolean all = true;
                for (int q : ch) if (!peer(p, q)) { all = false; break; }
                if (all) a.targets.add(new Target(p, s.cand[p] & m));
            }
            if (!a.targets.isEmpty()) { a.tech = k == 2 ? 3 : 5; a.cells = ch.clone(); a.mask = m; out.add(a); return first; }
            return false;
        }
        for (int i = st; i < cs.length; i++) {
            int c = cs[i], m2 = m | s.cand[c];
            if (pc(m2) > k) continue;
            boolean ok = true;
            for (int j = 0; j < d; j++) if (!peer(ch[j], c)) { ok = false; break; }
            if (!ok) continue;
            ch[d] = c;
            if (nakedRec(s, cs, k, i + 1, d + 1, m2, ch, out, first)) return true;
        }
        return false;
    }

    List<App> hiddenApps(St s, int k, boolean first) {
        List<App> out = new ArrayList<>();
        for (int r = 0; r < nr; r++) {
            int[] cells = RC[r];
            int placed = 0;
            for (int c : cells) if (s.val[c] != 0) placed |= 1 << s.val[c];
            int open = ((1 << (cells.length + 1)) - 2) & ~placed;
            if (pc(open) <= k) continue;
            for (int m = open; m > 0; m = (m - 1) & open) {
                if (pc(m) != k) continue;
                List<Integer> spots = spotsOf(s, r, m);
                if (spots.size() != k) continue;
                App a = new App();
                for (int c : spots) { int extra = s.cand[c] & ~m; if (extra != 0) a.targets.add(new Target(c, extra)); }
                if (!a.targets.isEmpty()) {
                    a.tech = k == 2 ? 4 : 6; a.region = r; a.mask = m; a.cells = SuguruEngine.toArray(spots);
                    out.add(a); if (first) return out;
                }
            }
        }
        return out;
    }

    // ---- chains: mode 'x' (one number), 'y' (two-option cells), 'a' (mixed)
    Map<Integer, List<Integer>> strongLinks(St s, char mode) {
        Map<Integer, List<Integer>> strong = new LinkedHashMap<>();
        if (mode != 'x') for (int c = 0; c < n; c++) if (s.val[c] == 0 && pc(s.cand[c]) == 2) { int[] b = bitsOf(s.cand[c]); addS(strong, c * 8 + b[0], c * 8 + b[1]); }
        if (mode != 'y') for (int r = 0; r < nr; r++) {
            int[] cells = RC[r];
            for (int d = 1; d <= cells.length; d++) {
                if (regionHas(s, r, d)) continue;
                List<Integer> sp = spotsOf(s, r, 1 << d);
                if (sp.size() == 2) addS(strong, sp.get(0) * 8 + d, sp.get(1) * 8 + d);
            }
        }
        return strong;
    }
    static void addS(Map<Integer, List<Integer>> m, int a, int b) {
        m.computeIfAbsent(a, k -> new ArrayList<>()); m.computeIfAbsent(b, k -> new ArrayList<>());
        m.get(a).add(b); m.get(b).add(a);
    }
    boolean weakLink(int a, int b, char mode) {
        return a != b && ((((a >> 3) == (b >> 3)) && mode != 'x') || ((a & 7) == (b & 7) && peer(a >> 3, b >> 3)));
    }
    List<Integer> weakNbrs(St s, int k, char mode) {
        int c = k >> 3, d = k & 7;
        List<Integer> out = new ArrayList<>();
        if (mode != 'x') for (int e : bitsOf(s.cand[c])) if (e != d) out.add(c * 8 + e);
        for (int p : peers[c]) if (s.val[p] == 0 && (s.cand[p] & (1 << d)) != 0) out.add(p * 8 + d);
        return out;
    }
    static List<Target> groupTargets(List<Integer> keys) {
        Map<Integer, Integer> m = new LinkedHashMap<>();
        for (int z : keys) m.merge(z >> 3, 1 << (z & 7), (x, y) -> x | y);
        List<Target> out = new ArrayList<>();
        for (Map.Entry<Integer, Integer> e : m.entrySet()) out.add(new Target(e.getKey(), e.getValue()));
        return out;
    }

    private final class ChainSearch {
        final St s; final char mode; final boolean first; final int tech; final Map<Integer, List<Integer>> strong;
        final List<App> out = new ArrayList<>(); final Set<String> seen = new HashSet<>();
        int budget, maxK; final List<Integer> path = new ArrayList<>(); final Set<Integer> onPath = new HashSet<>();
        ChainSearch(St s, char mode, boolean first) {
            this.s = s; this.mode = mode; this.first = first;
            this.tech = mode == 'x' ? 7 : mode == 'y' ? 8 : 9;
            this.strong = strongLinks(s, mode);
        }
        List<App> run() {
            if (strong.size() < 4) return out;
            for (maxK = 2; maxK <= 7; maxK++) {
                budget = 20000;
                path.clear(); onPath.clear();
                outer:
                for (Map.Entry<Integer, List<Integer>> e : strong.entrySet()) {
                    int A = e.getKey();
                    for (int B : e.getValue()) {
                        path.clear(); onPath.clear();
                        path.add(A); path.add(B); onPath.add(A); onPath.add(B);
                        if (dfs(A, B, 1)) return out;
                    }
                    if (budget < 0) break outer;
                }
                if (!out.isEmpty()) return out;
            }
            return out;
        }
        boolean dfs(int A, int Y, int k) {
            if (--budget < 0) return false;
            if (k == maxK) {
                List<Integer> zs = new ArrayList<>();
                for (int z : weakNbrs(s, A, mode)) if (!onPath.contains(z) && weakLink(z, Y, mode)) zs.add(z);
                if (!zs.isEmpty()) {
                    List<Target> targets = groupTargets(zs);
                    List<String> parts = new ArrayList<>();
                    for (Target t : targets) parts.add(t.cell + ":" + t.mask);
                    Collections.sort(parts);
                    String sig = String.join("|", parts);
                    if (seen.add(sig)) {
                        App a = new App();
                        a.tech = tech; a.nodes = SuguruEngine.toArray(path); a.targets = targets; a.relCount = k; a.memPeak = 2;
                        LinkedHashSet<Integer> cs = new LinkedHashSet<>();
                        for (int x : path) cs.add(x >> 3);
                        a.cells = SuguruEngine.toArray(new ArrayList<>(cs));
                        out.add(a);
                        if (first) return true;
                    }
                }
                return false;
            }
            for (int W : weakNbrs(s, Y, mode)) {
                if (onPath.contains(W) || !strong.containsKey(W)) continue;
                onPath.add(W); path.add(W);
                for (int Z : strong.get(W)) {
                    if (onPath.contains(Z)) continue;
                    onPath.add(Z); path.add(Z);
                    if (dfs(A, Z, k + 1)) return true;
                    onPath.remove(Z); path.remove(path.size() - 1);
                }
                onPath.remove(W); path.remove(path.size() - 1);
            }
            return false;
        }
    }
    List<App> chainApps(St s, boolean first, char mode) { return new ChainSearch(s, mode, first).run(); }

    // ---- single-number what-if (returns the number of relevant steps, or -1 if there is no contradiction)
    TrialResult nishioRun(St s, int c0, int x) {
        boolean[] has = new boolean[n];
        Map<Integer, Integer> placedBy = new HashMap<>(), removedBy = new HashMap<>();
        for (int c = 0; c < n; c++) has[c] = s.val[c] == 0 && (s.cand[c] & (1 << x)) != 0;
        List<Set<Integer>> nodes = new ArrayList<>();
        nodes.add(new HashSet<>());
        int chainLen = 0;
        putN(has, placedBy, removedBy, c0, 0);
        boolean broken = false, changed = true;
        while (changed && !broken) {
            changed = false;
            for (int r = 0; r < nr && !broken; r++) {
                int[] cells = RC[r];
                if (cells.length < x) continue;
                boolean skip = false;
                for (int c : cells) if (s.val[c] == x || placedBy.containsKey(c)) skip = true;
                if (skip) continue;
                List<Integer> spots = new ArrayList<>();
                for (int c : cells) if (has[c]) spots.add(c);
                if (spots.size() > 1) continue;
                Set<Integer> deps = new HashSet<>();
                for (int c : cells) if (s.val[c] == 0 && (s.cand[c] & (1 << x)) != 0 && removedBy.containsKey(c)) deps.add(removedBy.get(c));
                if (spots.isEmpty()) { broken = true; nodes.add(deps); break; }
                int id = nodes.size();
                nodes.add(deps);
                chainLen++;
                putN(has, placedBy, removedBy, spots.get(0), id);
                changed = true;
            }
        }
        if (!broken) return null;
        int brokenId = nodes.size() - 1;
        Set<Integer> rel = closure(nodes, Collections.singleton(brokenId), false);
        int cnt = 0;
        for (int i = 0; i < chainLen; i++) if (rel.contains(i + 1)) cnt++;
        Set<Integer> relN = new HashSet<>(rel);
        relN.remove(brokenId);
        relN.add(0);
        return new TrialResult(cnt, peakLive(nodes, relN, nodes.get(brokenId)));
    }
    void putN(boolean[] has, Map<Integer, Integer> placedBy, Map<Integer, Integer> removedBy, int c, int id) {
        placedBy.put(c, id); has[c] = false;
        for (int p : peers[c]) if (has[p]) { has[p] = false; removedBy.put(p, id); }
    }
    static Set<Integer> closure(List<Set<Integer>> nodes, Collection<Integer> roots, boolean includeZero) {
        Set<Integer> rel = new HashSet<>();
        if (includeZero) rel.add(0);
        Deque<Integer> st = new ArrayDeque<>(roots);
        while (!st.isEmpty()) {
            int k = st.pop();
            if (!rel.add(k)) continue;
            for (int y : nodes.get(k)) st.push(y);
        }
        return rel;
    }
    List<App> nishioApps(St s, boolean first) {
        List<App> out = new ArrayList<>();
        for (int sz = 2; sz <= 6; sz++) for (int c = 0; c < n; c++) {
            if (s.val[c] != 0 || pc(s.cand[c]) != sz) continue;
            for (int x : bitsOf(s.cand[c])) {
                TrialResult rc = nishioRun(s, c, x);
                if (rc != null) {
                    App a = new App(); a.tech = 10; a.cell = c; a.v = x; a.cells = new int[]{c}; a.relCount = rc.relCount; a.memPeak = rc.memPeak;
                    a.targets.add(new Target(c, 1 << x));
                    out.add(a); if (first) return out;
                }
            }
        }
        return out;
    }

    // ---- traced run (what-if and both ways)
    final class Run {
        final St t; final Map<Integer, Integer> removedBy = new HashMap<>(), placedBy = new HashMap<>();
        final List<Set<Integer>> nodes = new ArrayList<>(); int chainLen = 0; final St s0;
        /** Technique for each step (-1 = a placed number or the assumption). */
        final List<Integer> nodeTech = new ArrayList<>();
        Run(St s) { s0 = s; t = s.copy(); nodes.add(new HashSet<>()); nodeTech.add(-1); }
        void record(St b, St after, int node) {
            for (int c = 0; c < n; c++) {
                if (after.val[c] != 0 && b.val[c] == 0) placedBy.put(c, node);
                for (int d : bitsOf(b.cand[c] & ~after.cand[c])) removedBy.putIfAbsent(c * 8 + d, node);
            }
        }
        void depsOfCell(int q, St b, Set<Integer> out) {
            if (placedBy.containsKey(q)) out.add(placedBy.get(q));
            for (int d : bitsOf(s0.cand[q] & ~b.cand[q])) { Integer x = removedBy.get(q * 8 + d); if (x != null) out.add(x); }
        }
        void singleDeps(Single x, St b, Set<Integer> deps) {
            if (x.kind == NAKED) depsOfCell(x.cell, b, deps);
            else for (int o : RC[x.region]) if (o != x.cell && s0.val[o] == 0 && (x.kind == LAST || (s0.cand[o] & (1 << x.v)) != 0)) {
                if (placedBy.containsKey(o)) deps.add(placedBy.get(o));
                else { Integer y = removedBy.get(o * 8 + x.v); if (y != null) deps.add(y); }
            }
        }
        int relevantCount(Set<Integer> rel) { int k = 0; for (int i = 0; i < chainLen; i++) if (rel.contains(i + 1)) k++; return k; }
    }

    /** One step in a what-if chain (simplest first). Returns null if there is no step, or a Step with app==null&&single==null on stop. */
    Step chainStep(St s, int maxLevel) { return chainStep(s, maxLevel, false); }
    Step chainStep(St s, int maxLevel, boolean early) {
        // What-if with techniques: if a neighbour elimination, a pair or a triple gives a contradiction straight away, it is taken first
        // (the same as tutor.js), so the short reasoning is found. Only in the first steps (early).
        if (maxLevel >= 2 && early) {
            List<List<App>> quick = new ArrayList<>();
            quick.add(neighborApps(s, false));
            if (maxLevel >= 3) { quick.add(nakedApps(s, 2, false)); quick.add(hiddenApps(s, 2, false)); }
            if (maxLevel >= 4) { quick.add(nakedApps(s, 3, false)); quick.add(hiddenApps(s, 3, false)); }
            for (List<App> l : quick) for (App a : l) {
                St T = s.copy(); apply(T, a);
                if (T.broken != null) return elimStep(s, a);
            }
        }
        List<Single> sg = singles(s);
        if (!sg.isEmpty()) { Single x = sg.get(0); place(s, x.cell, x.v); return new Step(x); }
        for (int r = 0; r < nr; r++) {
            int[] cells = RC[r];
            for (int v = 1; v <= cells.length; v++) {
                if (regionHas(s, r, v)) continue;
                if (spotsOf(s, r, 1 << v).isEmpty()) { if (s.broken == null) s.broken = new Broken(1, -1, r, v); return new Step((App) null); }
            }
        }
        List<App> a;
        if (maxLevel >= 2 && !(a = neighborApps(s, true)).isEmpty()) return elimStep(s, a.get(0));
        if (maxLevel >= 3 && !(a = nakedApps(s, 2, true)).isEmpty()) return elimStep(s, a.get(0));
        if (maxLevel >= 3 && !(a = hiddenApps(s, 2, true)).isEmpty()) return elimStep(s, a.get(0));
        if (maxLevel >= 4 && !(a = nakedApps(s, 3, true)).isEmpty()) return elimStep(s, a.get(0));
        if (maxLevel >= 4 && !(a = hiddenApps(s, 3, true)).isEmpty()) return elimStep(s, a.get(0));
        if (maxLevel >= 5 && !(a = chainApps(s, true, 'x')).isEmpty()) return elimStep(s, a.get(0));
        if (maxLevel >= 6 && !(a = chainApps(s, true, 'y')).isEmpty()) return elimStep(s, a.get(0));
        if (maxLevel >= 7 && !(a = chainApps(s, true, 'a')).isEmpty()) return elimStep(s, a.get(0));
        if (maxLevel >= 8 && !(a = nishioApps(s, true)).isEmpty()) return elimStep(s, a.get(0));
        return null;
    }
    Step elimStep(St s, App a) { apply(s, a); return new Step(a); }

    /** What-if with tracing. Returns the relevant steps and memory, or null without a contradiction. */
    TrialResult runTrial(St s, int cell, int v, int inner) { return runTrial(s, cell, v, inner, 400); }
    TrialResult runTrial(St s, int cell, int v, int inner, int maxSteps) {
        Run R = new Run(s);
        St b = R.t.copy();
        place(R.t, cell, v);
        R.record(b, R.t, 0);
        int guard = 0;
        while (R.t.broken == null && !solved(R.t) && guard++ < maxSteps) {
            b = R.t.copy();
            Step st = chainStep(R.t, inner, guard <= 3);
            if (st == null) break;
            if (st.single == null && st.app == null) break;
            int id = R.nodes.size();
            Set<Integer> deps = new HashSet<>();
            if (st.place) R.singleDeps(st.single, b, deps);
            else {
                App a = st.app;
                LinkedHashSet<Integer> cells = new LinkedHashSet<>();
                for (int q : (a.tech == 2 ? a.spots : a.cells)) cells.add(q);
                if (a.region >= 0) for (int c : RC[a.region]) cells.add(c);
                for (int q : cells) R.depsOfCell(q, b, deps);
            }
            R.nodes.add(deps);
            R.nodeTech.add(st.place ? -1 : st.app.tech);
            R.chainLen++;
            R.record(b, R.t, id);
        }
        if (R.t.broken == null) return null;
        Broken br = R.t.broken;
        Set<Integer> root = new HashSet<>();
        if (br.kind == 0) R.depsOfCell(br.cell, R.t, root);
        else for (int o : RC[br.region]) R.depsOfCell(o, R.t, root);
        Set<Integer> rel = new HashSet<>(); rel.add(0);
        Deque<Integer> stack = new ArrayDeque<>(root);
        while (!stack.isEmpty()) { int x = stack.pop(); if (!rel.add(x)) continue; for (int y : R.nodes.get(x)) stack.push(y); }
        TrialResult res = new TrialResult(rel.size() - 1, peakLive(R.nodes, rel, root));
        for (int x : rel) { int tq = R.nodeTech.get(x); if (tq >= 0) res.innerMask |= 1 << tq; }
        return res;
    }
    List<App> trialApps(St s, int inner, boolean first) { return trialApps(s, inner, first, 400); }
    List<App> trialApps(St s, int inner, boolean first, int maxSteps) {
        List<App> out = new ArrayList<>();
        for (int sz = 2; sz <= 5; sz++) for (int c = 0; c < n; c++) {
            if (s.val[c] != 0 || pc(s.cand[c]) != sz) continue;
            for (int v : bitsOf(s.cand[c])) {
                TrialResult rc = runTrial(s, c, v, inner, maxSteps);
                if (rc != null) {
                    App a = new App(); a.tech = inner == 1 ? 11 : 13; a.cell = c; a.v = v; a.cells = new int[]{c}; a.relCount = rc.relCount; a.memPeak = rc.memPeak; a.innerMask = rc.innerMask;
                    a.targets.add(new Target(c, 1 << v));
                    out.add(a); if (first) return out;
                }
            }
        }
        return out;
    }

    // ---- both ways
    final class Branch {
        final Run R; Branch(Run R) { this.R = R; }
        int relFor(int g, int m) {
            Set<Integer> root = new HashSet<>();
            if (R.placedBy.containsKey(g)) root.add(R.placedBy.get(g));
            for (int d : bitsOf(m)) { Integer x = R.removedBy.get(g * 8 + d); if (x != null) root.add(x); }
            Set<Integer> rel = new HashSet<>(); rel.add(0);
            Deque<Integer> st = new ArrayDeque<>(root);
            while (!st.isEmpty()) { int k = st.pop(); if (!rel.add(k)) continue; for (int y : R.nodes.get(k)) st.push(y); }
            return R.relevantCount(rel);
        }
        int peakFor(int g, int m) {
            Set<Integer> root = new HashSet<>();
            if (R.placedBy.containsKey(g)) root.add(R.placedBy.get(g));
            for (int d : bitsOf(m)) { Integer x = R.removedBy.get(g * 8 + d); if (x != null) root.add(x); }
            Set<Integer> rel = new HashSet<>(); rel.add(0);
            Deque<Integer> st = new ArrayDeque<>(root);
            while (!st.isEmpty()) { int k = st.pop(); if (!rel.add(k)) continue; for (int y : R.nodes.get(k)) st.push(y); }
            return peakLive(R.nodes, rel, root);
        }
    }
    Branch runBranch(St s, int c0, int v0) {
        Run R = new Run(s);
        St b = R.t.copy();
        place(R.t, c0, v0); R.record(b, R.t, 0);
        int guard = 0;
        while (R.t.broken == null && !solved(R.t) && guard++ < 400) {
            List<Single> sg = singles(R.t);
            if (sg.isEmpty()) break;
            Single x = sg.get(0);
            Set<Integer> deps = new HashSet<>();
            b = R.t.copy();
            R.singleDeps(x, b, deps);
            place(R.t, x.cell, x.v);
            R.nodes.add(deps); R.chainLen++;
            R.record(b, R.t, R.nodes.size() - 1);
        }
        if (R.t.broken != null) return null;
        return new Branch(R);
    }
    List<int[]> bothRoots(St s) {
        List<int[]> roots = new ArrayList<>();
        for (int c = 0; c < n; c++) if (s.val[c] == 0 && pc(s.cand[c]) == 2) { int[] b = bitsOf(s.cand[c]); roots.add(new int[]{c, b[0], c, b[1]}); }
        for (int r = 0; r < nr; r++) {
            int[] cells = RC[r];
            for (int d = 1; d <= cells.length; d++) {
                if (regionHas(s, r, d)) continue;
                List<Integer> sp = spotsOf(s, r, 1 << d);
                if (sp.size() == 2) roots.add(new int[]{sp.get(0), d, sp.get(1), d});
            }
        }
        return roots;
    }
    List<App> bothWaysApps(St s, boolean first) {
        List<App> out = new ArrayList<>();
        for (int[] root : bothRoots(s)) {
            Branch A = runBranch(s, root[0], root[1]); if (A == null) continue;
            Branch B = runBranch(s, root[2], root[3]); if (B == null) continue;
            for (int g = 0; g < n; g++) {
                if (s.val[g] != 0) continue;
                int gone = s.cand[g] & ~A.R.t.cand[g] & ~B.R.t.cand[g];
                if (gone == 0) continue;
                App a = new App(); a.tech = 12; a.goal = g;
                a.rootA = new int[]{root[0], root[1]}; a.rootB = new int[]{root[2], root[3]};
                a.cells = root[0] == root[2] ? new int[]{root[0]} : new int[]{root[0], root[2]};
                a.targets.add(new Target(g, gone));
                a.relCount = A.relFor(g, gone) + B.relFor(g, gone);
                a.memPeak = Math.max(A.peakFor(g, gone), B.peakFor(g, gone) + 1);
                out.add(a);
                if (first) return out;
            }
        }
        return out;
    }

    // ------------------------------------------------------------------ the what-if family (as in tutor.js)
    // Levels 8-11 are compared on effort (the grade's "as you used to play"), not on kind: a short what-if with a pair is easier
    // than a long one with singles. len = support steps + the assumption + the chain's relevant steps.
    static final int WHATIF_L = 8;
    static double whatIfCost(App a, int len) {
        int T = a.tech;
        double innerR = 0;
        for (int t = 0; t < SuguruGrade.RECOG.length; t++) if ((a.innerMask & (1 << t)) != 0) innerR = Math.max(innerR, SuguruGrade.RECOG[t]);
        double lg = SuguruGrade.log2(Math.max(1, len));
        double c = SuguruGrade.RECOG[T] + SuguruGrade.W_len * lg + SuguruGrade.W_inner * innerR
            + SuguruGrade.P_mem[2][T] * SuguruGrade.log2(1 + a.memPeak) + SuguruGrade.P_len[2][T] * lg;
        return Math.round(c * 1e6) / 1e6;
    }
    static final class WhatIf { final App a; final Single x; final boolean fromS0; final int len; final double key;
        WhatIf(App a, Single x, boolean fromS0, int len, double key) { this.a = a; this.x = x; this.fromS0 = fromS0; this.len = len; this.key = key; } }
    List<App> whatIfBase(St s) {
        List<App> l = nishioApps(s, false);
        l.addAll(trialApps(s, 1, false));
        l.addAll(bothWaysApps(s, false));
        return l;
    }
    static final class Raw { final App a; final Single x; final boolean fromS0; final int rel, ub; final double lb;
        Raw(App a, Single x, boolean fromS0, int rel, double lb, int ub) { this.a = a; this.x = x; this.fromS0 = fromS0; this.rel = rel; this.lb = lb; this.ub = ub; } }
    void whatIfConsider(List<App> steps, St St, App a, boolean fromS0, List<Raw> raw) {
        St T = St.copy(); apply(T, a);
        if (T.broken != null) return;
        List<Single> xs = singles(T);
        if (xs.isEmpty()) return;
        Single x = xs.get(0);
        int rel = a.relCount;
        raw.add(new Raw(a, x, fromS0, rel, whatIfCost(a, 1 + rel) + x.score * 0.1, fromS0 ? 1 + rel : steps.size() + 1 + rel));
    }
    int whatIfSupport(St S0, List<App> steps, Raw r) {
        if (r.fromS0 || steps.isEmpty()) return 0;
        List<App> kept = new ArrayList<>(steps); kept.add(r.a);
        Replay res = replay(S0, kept, r.x.cell, r.x.v);
        if (res != null)
            for (int i = steps.size() - 1; i >= 0; i--) {
                List<App> t = new ArrayList<>(kept.subList(0, i)); t.addAll(kept.subList(i + 1, kept.size()));
                Replay r2 = replay(S0, t, r.x.cell, r.x.v);
                if (r2 != null && !r2.steps.isEmpty() && r2.steps.get(r2.steps.size() - 1).tech == r.a.tech) { kept = t; res = r2; }
            }
        return res != null ? res.steps.size() - 1 : steps.size();
    }
    /** The what-if with the least effort that gives a number: searched in S (after the support steps) and in S0 (without). null if nothing gives a number. */
    WhatIf whatIfBest(St S0, St S, List<App> steps) {
        List<Raw> raw = new ArrayList<>();
        for (App a : whatIfBase(S)) whatIfConsider(steps, S, a, false, raw);
        if (!steps.isEmpty()) for (App a : whatIfBase(S0)) whatIfConsider(steps, S0, a, true, raw);
        if (raw.isEmpty()) return null;
        int lim = Integer.MAX_VALUE;
        for (Raw r : raw) lim = Math.min(lim, r.ub);
        lim -= 1;
        if (lim > 0) {
            St[] states = steps.isEmpty() ? new St[]{S} : new St[]{S0, S};
            boolean[] from = steps.isEmpty() ? new boolean[]{false} : new boolean[]{true, false};
            for (int k = 0; k < states.length; k++)
                for (App a : trialApps(states[k], 4, false, Math.max(2, 2 * lim + 2)))
                    if (a.relCount < lim) whatIfConsider(steps, states[k], a, from[k], raw);
        }
        raw.sort((p, q) -> Double.compare(p.lb, q.lb));
        WhatIf best = null;
        for (Raw r : raw) {
            if (best != null && r.lb >= best.key) break;
            int len = whatIfSupport(S0, steps, r) + 1 + r.rel;
            double key = whatIfCost(r.a, len) + r.x.score * 0.1;
            if (best == null || key < best.key) best = new WhatIf(r.a, r.x, r.fromS0, len, key);
        }
        return best;
    }

    List<App> levelApps(St s, int L) {
        switch (L) {
            case 2: return neighborApps(s, false);
            case 3: { List<App> l = nakedApps(s, 2, false); l.addAll(hiddenApps(s, 2, false)); return l; }
            case 4: { List<App> l = nakedApps(s, 3, false); l.addAll(hiddenApps(s, 3, false)); return l; }
            case 5: return chainApps(s, false, 'x');
            case 6: return chainApps(s, false, 'y');
            case 7: return chainApps(s, false, 'a');
            case 8: return nishioApps(s, false);
            case 9: return trialApps(s, 1, false);
            case 10: return bothWaysApps(s, false);
            case 11: return trialApps(s, 8, false);
            default: return new ArrayList<>();
        }
    }

    // ------------------------------------------------------------------ replay
    App refresh(St T, App a) {
        if (a.tech == 2) {
            int bit = 1 << a.v;
            if (regionHas(T, a.region, a.v)) return null;
            List<Integer> spots = spotsOf(T, a.region, bit);
            if (spots.size() < 2) return null;
            for (int c : spots) { boolean in = false; for (int x : a.spots) if (x == c) in = true; if (!in) return null; }
            App b = a.copy(); b.spots = SuguruEngine.toArray(spots); b.targets = new ArrayList<>();
            for (Target t : a.targets) {
                if (T.val[t.cell] != 0 || (T.cand[t.cell] & bit) == 0) continue;
                boolean all = true; for (int sp : spots) if (!peer(t.cell, sp)) all = false;
                if (all) b.targets.add(t);
            }
            return b.targets.isEmpty() ? null : b;
        }
        if (a.tech == 3 || a.tech == 5) {
            int u = 0;
            for (int c : a.cells) { if (T.val[c] != 0) return null; u |= T.cand[c]; }
            if ((u & ~a.mask) != 0) return null;
            App b = a.copy(); b.targets = new ArrayList<>();
            for (Target t : a.targets) { int m = T.cand[t.cell] & a.mask; if (T.val[t.cell] == 0 && m != 0) b.targets.add(new Target(t.cell, m)); }
            return b.targets.isEmpty() ? null : b;
        }
        if (a.tech == 4 || a.tech == 6) {
            for (int c : RC[a.region]) if (T.val[c] != 0 && (a.mask & (1 << T.val[c])) != 0) return null;
            List<Integer> spots = spotsOf(T, a.region, a.mask);
            for (int c : spots) { boolean in = false; for (int x : a.cells) if (x == c) in = true; if (!in) return null; }
            if (spots.size() != a.cells.length) return null;
            App b = a.copy(); b.targets = new ArrayList<>();
            for (int c : a.cells) { int m = T.cand[c] & ~a.mask; if (m != 0) b.targets.add(new Target(c, m)); }
            return b.targets.isEmpty() ? null : b;
        }
        if (a.tech == 12) {
            Branch A = runBranch(T, a.rootA[0], a.rootA[1]);
            Branch B = A == null ? null : runBranch(T, a.rootB[0], a.rootB[1]);
            if (A == null || B == null || T.val[a.goal] != 0) return null;
            int gone = T.cand[a.goal] & ~A.R.t.cand[a.goal] & ~B.R.t.cand[a.goal] & a.targets.get(0).mask;
            if (gone == 0) return null;
            App b = a.copy(); b.targets = new ArrayList<>(); b.targets.add(new Target(a.goal, gone));
            b.relCount = A.relFor(a.goal, gone) + B.relFor(a.goal, gone);
            b.memPeak = Math.max(A.peakFor(a.goal, gone), B.peakFor(a.goal, gone) + 1);
            return b;
        }
        if (a.tech >= 7 && a.tech <= 9) {
            for (int k : a.nodes) if (T.val[k >> 3] != 0 || (T.cand[k >> 3] & (1 << (k & 7))) == 0) return null;
            for (int i = 0; i + 1 < a.nodes.length; i += 2) {
                int x = a.nodes[i], y = a.nodes[i + 1];
                if ((x >> 3) == (y >> 3)) { if (pc(T.cand[x >> 3]) != 2) return null; }
                else {
                    int d = x & 7, r = region[x >> 3];
                    if (spotsOf(T, r, 1 << d).size() != 2 || regionHas(T, r, d)) return null;
                }
            }
            App b = a.copy(); b.targets = new ArrayList<>();
            for (Target t : a.targets) { int m = T.cand[t.cell] & t.mask; if (T.val[t.cell] == 0 && m != 0) b.targets.add(new Target(t.cell, m)); }
            return b.targets.isEmpty() ? null : b;
        }
        if (T.val[a.cell] != 0 || (T.cand[a.cell] & (1 << a.v)) == 0) return null;
        TrialResult rc = a.tech == 10 ? nishioRun(T, a.cell, a.v) : runTrial(T, a.cell, a.v, a.tech == 11 ? 1 : 8);
        if (rc == null) return null;
        App b = a.copy(); b.relCount = rc.relCount; b.memPeak = rc.memPeak; b.innerMask = rc.innerMask;
        return b;
    }
    static final class Replay { final List<App> steps; final int kind; Replay(List<App> steps, int kind) { this.steps = steps; this.kind = kind; } }
    Replay replay(St S0, List<App> list, int cell, int v) {
        St T = S0.copy();
        List<App> out = new ArrayList<>();
        for (App a : list) {
            App b = refresh(T, a);
            if (b == null) continue;
            out.add(b);
            apply(T, b);
            if (T.broken != null) return null;
        }
        int kind = singleHolds(T, cell, v);
        return kind >= 0 ? new Replay(out, kind) : null;
    }

    // ------------------------------------------------------------------ the easiest next number
    public Hint easiest(int[] known) {
        St S0 = fromKnown(known);
        if (S0.broken != null || solved(S0)) return null;
        List<Single> sg = singles(S0);
        if (!sg.isEmpty()) return build(S0, new ArrayList<>(), sg.get(0).kind, sg.get(0).cell, sg.get(0).v);
        St S = S0.copy();
        List<App> steps = new ArrayList<>();
        for (int guard = 0; guard < 300; guard++) {
            List<Single> ready = singles(S);
            if (!ready.isEmpty()) return finish(S0, S, steps, ready.get(0).cell, ready.get(0).v);
            boolean progressed = false;
            for (int L = 2; L <= 11 && !progressed; L++) {
                if (L == WHATIF_L) {
                    WhatIf w = whatIfBest(S0, S, steps);
                    if (w != null) {
                        if (w.fromS0) { steps.clear(); S = S0.copy(); }
                        steps.add(w.a); apply(S, w.a);
                        return finish(S0, S, steps, w.x.cell, w.x.v);
                    }
                }
                List<App> apps = levelApps(S, L);
                if (apps.isEmpty()) continue;
                App bestApp = null; Single bestSingle = null; double bestKey = 0;
                for (App a : apps) {
                    St T = S.copy(); apply(T, a);
                    if (T.broken != null) continue;
                    List<Single> xs = singles(T);
                    if (xs.isEmpty()) continue;
                    Single x = xs.get(0);
                    double key = TECH_WEIGHT[a.tech] / 100.0 + a.relCount + x.score * 0.1;
                    if (bestSingle == null || key < bestKey) { bestApp = a; bestSingle = x; bestKey = key; }
                }
                if (bestApp != null) { steps.add(bestApp); apply(S, bestApp); return finish(S0, S, steps, bestSingle.cell, bestSingle.v); }
                for (App a : apps) {
                    int[] before = S.cand.clone();
                    apply(S, a);
                    if (!Arrays.equals(before, S.cand)) steps.add(a);
                }
                progressed = true;
            }
            if (!progressed) return null;
        }
        return null;
    }
    Hint finish(St S0, St S, List<App> steps, int cell, int v) {
        List<App> kept = new ArrayList<>(steps);
        Replay res = replay(S0, kept, cell, v);
        for (int i = kept.size() - 1; i >= 0 && res != null; i--) {
            List<App> tryList = new ArrayList<>(kept.subList(0, i));
            tryList.addAll(kept.subList(i + 1, kept.size()));
            Replay r2 = replay(S0, tryList, cell, v);
            if (r2 != null) { kept = tryList; res = r2; }
        }
        if (res == null) { int k = singleHolds(S, cell, v); res = new Replay(steps, k >= 0 ? k : NAKED); }
        return build(S0, res.steps, res.kind, cell, v);
    }
    /**
     * Working memory for the whole way to one number. A step depends directly on an earlier fact if
     * the step's premise no longer holds when exactly that fact is removed (all other facts are kept).
     */
    int outerPeak(St S0, List<App> steps, int cell, int v) {
        int k = steps.size();
        if (k == 0) return 0;
        int[] last = new int[k];
        Arrays.fill(last, -1);
        for (int j = 1; j < k; j++) for (int i = 0; i < j; i++) if (refresh(without(S0, steps, j, i), steps.get(j)) == null) last[i] = Math.max(last[i], j);
        for (int i = 0; i < k; i++) if (singleHolds(without(S0, steps, k, i), cell, v) < 0) last[i] = k;
        int peak = 0;
        for (int j = 0; j <= k; j++) {
            int live = 0;
            for (int i = 0; i < j; i++) if (last[i] >= j) live++;
            peak = Math.max(peak, live + (j < k ? steps.get(j).memPeak : 0));
        }
        return peak;
    }
    St without(St S0, List<App> steps, int upto, int skip) {
        St T = S0.copy();
        for (int i = 0; i < upto; i++) if (i != skip) apply(T, steps.get(i));
        return T;
    }
    Hint build(St S0, List<App> steps, int kind, int cell, int v) {
        int hardest = kind == NAKED ? 0 : 1;
        int[] support = new int[steps.size()];
        int len = 0;
        for (int i = 0; i < steps.size(); i++) { hardest = Math.max(hardest, steps.get(i).tech); support[i] = steps.get(i).relCount; len += 1 + support[i]; }
        Hint h = new Hint(cell, v, hardest, singles(S0).size(), support, outerPeak(S0, steps, cell, v), len);
        for (App a : steps) if (a.tech == hardest) h.innerMask |= a.innerMask;
        {
            St Tm = S0.copy();
            for (App a : steps) {
                apply(Tm, a);
                if (a.tech == hardest) for (Target t : a.targets) if (t.cell != cell && Tm.val[t.cell] == 0 && pc(Tm.cand[t.cell]) >= 2) h.multi++;
            }
        }
        // Features at the first step with the hardest technique, measured just before it (the same as web/shared/js/tutor.js)
        {
            int i = -1;
            for (int j = 0; j < steps.size(); j++) if (steps.get(j).tech == hardest) { i = j; break; }
            if (i >= 0) {
                App a = steps.get(i);
                St Tb = S0.copy();
                for (int j = 0; j < i; j++) apply(Tb, steps.get(j));
                int[] own0 = a.tech == 2 ? a.spots : a.cells != null ? a.cells : new int[]{a.cell};
                List<Integer> own = new ArrayList<>();
                for (int c : own0) if (c >= 0) own.add(c);
                if (a.tech == 4 || a.tech == 6) {
                    for (int c : RC[a.region]) if (S0.val[c] == 0 && ((Tb.cand[c] ^ S0.cand[c]) & a.mask) != 0) h.built++;
                } else for (int c : own) if (Tb.cand[c] != S0.cand[c]) h.built++;
                if ((a.tech == 10 || a.tech == 11 || a.tech == 13) && pc(Tb.cand[a.cell]) >= 3) h.trial = 1;
                if (a.tech == 5 || a.tech == 6) for (int c : a.cells) if (pc(Tb.cand[c] & a.mask) < 3) { h.partial = 1; break; }
                Collections.sort(own);
                StringBuilder sb = new StringBuilder().append(a.tech).append(':');
                for (int k = 0; k < own.size(); k++) sb.append(k > 0 ? "," : "").append(own.get(k));
                sb.append(':');
                if (a.tech >= 3 && a.tech <= 6) sb.append(a.mask);
                else if (a.tech == 2 || a.tech == 10 || a.tech == 11 || a.tech == 13) sb.append(a.v);
                h.sig = sb.toString();
            }
        }
        for (App a : steps) {
            if (a.tech != hardest) continue;
            int[] raw = a.tech == 2 ? a.spots : a.cells != null ? a.cells : new int[]{a.cell};
            List<Integer> pat = new ArrayList<>();
            if (raw != null) for (int c : raw) if (c >= 0) pat.add(c);
            if (pat.isEmpty()) continue;
            Set<Integer> rows = new HashSet<>(), cols = new HashSet<>(), area = new LinkedHashSet<>(), need = new LinkedHashSet<>();
            for (int c : pat) { rows.add(c / this.cols); cols.add(c % this.cols); area.add(c); need.add(c); }
            for (Target t : a.targets) { area.add(t.cell); need.add(t.cell); }
            for (int c : new ArrayList<>(area)) for (int k : king[c]) area.add(k);
            int filled = 0, work = 0;
            for (int c : area) if (S0.val[c] != 0) filled++;
            if (a.region >= 0) for (int c : RC[a.region]) need.add(c);
            for (int c : need) if (S0.val[c] == 0) work++;
            h.vis = new double[]{pat.size(), pat.size() > 1 && rows.size() > 1 && cols.size() > 1 ? 1 : 0, filled / (double) Math.max(1, area.size()), work};
            break;
        }
        return h;
    }
}
