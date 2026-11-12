import java.util.*;

/**
 * Suguru-motor: regionsgenerator, backtracking-løser, menneskelig sværhedsvurdering (14 teknikker,
 * 11 niveauer) og generering mod et målniveau.
 *
 * Tro port af motoren i web-versionen: samme algoritmer og samme tilfældighedsgenerator (mulberry32),
 * så samme seed giver samme opgave i Java og i browseren.
 *
 * Regler: en region med n felter har tallene 1..n; ens tal må ikke røre hinanden (heller ikke diagonalt).
 */
public final class SuguruEngine {

    public static final int MAX_VALUE = 6;

    /** Teknikker i stigende sværhed. Indeks bruges overalt (vurdering, hints, profil). */
    public static final String[] TECH_LABEL = {
        "Eneste kandidat", "Eneste plads i region", "Nabo-eliminering", "Nøgent par", "Skjult par",
        "Nøgen trippel", "Skjult trippel", "Kæde med ét tal", "Kæde med to-mulighedsfelter", "Blandet kæde",
        "Hvis-så med ét tal", "Hvis-så, kort", "Begge veje", "Hvis-så, dyb"
    };
    public static final String[] TECH_DESC = {
        "Cellen har kun ét muligt tal tilbage.",
        "Et tal kan kun stå ét sted i sin region.",
        "Alle mulige pladser for et tal i en region rører samme celle udenfor. Den celle kan ikke have tallet.",
        "To celler, der ser hinanden, har tilsammen kun to mulige tal. Celler, der ser begge, kan ikke have dem.",
        "To tal i en region kan kun stå i de samme to celler. De celler kan ikke have andre tal.",
        "Som nøgent par, men med tre celler og tre tal.",
        "Som skjult par, men med tre tal og tre celler.",
        "Følg ét tal: står det ikke her, må det stå dér, og så kan det ikke stå omkring. Felter der ser begge ender, kan ikke have tallet.",
        "Felter med kun to muligheder i en kæde: er første felt ikke a, tvinges resten, indtil sidste felt bliver a.",
        "En kæde der blander felter med to muligheder og tal med to pladser i en region.",
        "Antag at et felt er x, og følg kun tallet x. Mangler en region plads til x, var antagelsen forkert.",
        "Antag et tal og følg enkle træk med alle tal. Ender det i en modstrid, var antagelsen forkert.",
        "Prøv begge muligheder i et felt (eller begge pladser for et tal). Det begge veje giver, er sandt.",
        "Som kort hvis-så, men modstriden kræver de sværere teknikker undervejs."
    };
    public static final int[] TECH_LEVEL = {1, 1, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11};
    public static final int[] TECH_WEIGHT = {1, 1, 4, 8, 10, 15, 18, 20, 22, 24, 26, 30, 40, 60};
    public static final String[] LEVELS = {"", "Let", "Middel", "Svær", "Meget svær", "Kæde: ét tal",
        "Kæde: to muligheder", "Kæde: blandet", "Hvis-så: ét tal", "Hvis-så: kort", "Begge veje", "Hvis-så: dyb", "Kræver gæt"};
    public static final int TOP_LEVEL = 11;

    private static final int[][] TARGET_SIZES = new int[7][];
    static {
        TARGET_SIZES[4] = new int[]{2, 3, 3, 4, 4, 4, 4};
        TARGET_SIZES[5] = new int[]{2, 3, 3, 4, 4, 4, 5, 5, 5, 5};
        TARGET_SIZES[6] = new int[]{2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6};
    }

    private SuguruEngine() {}

    // =================================================================== hjælpere

    /** mulberry32 – identisk med JavaScript-versionen. */
    public static final class Rand {
        private int a;
        public Rand(long seed) { this.a = (int) seed; }
        public double next() {
            a = a + 0x6D2B79F5;
            int t = (a ^ (a >>> 15)) * (1 | a);
            t = (t + ((t ^ (t >>> 7)) * (61 | t))) ^ t;
            return ((t ^ (t >>> 14)) & 0xFFFFFFFFL) / 4294967296.0;
        }
        public int nextInt(int k) { return (int) Math.floor(next() * k); }
    }

    static int popcount(int x) { return Integer.bitCount(x); }
    static int ctz(int x) { return Integer.numberOfTrailingZeros(x); }

    public static final class Geometry {
        public final int rows, cols, n;
        public final int[][] ortho, king;
        public Geometry(int rows, int cols) {
            this.rows = rows; this.cols = cols; this.n = rows * cols;
            ortho = new int[n][]; king = new int[n][];
            for (int r = 0; r < rows; r++) for (int c = 0; c < cols; c++) {
                List<Integer> o = new ArrayList<>(), k = new ArrayList<>();
                for (int dr = -1; dr <= 1; dr++) for (int dc = -1; dc <= 1; dc++) {
                    if (dr == 0 && dc == 0) continue;
                    int rr = r + dr, cc = c + dc;
                    if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
                    k.add(rr * cols + cc);
                    if (dr == 0 || dc == 0) o.add(rr * cols + cc);
                }
                ortho[r * cols + c] = toArray(o);
                king[r * cols + c] = toArray(k);
            }
        }
    }

    static int[] toArray(List<Integer> l) {
        int[] a = new int[l.size()];
        for (int i = 0; i < a.length; i++) a[i] = l.get(i);
        return a;
    }

    static int[][] buildRegions(int n, int[] region) {
        int nr = 0;
        for (int r : region) nr = Math.max(nr, r + 1);
        List<List<Integer>> l = new ArrayList<>();
        for (int i = 0; i < nr; i++) l.add(new ArrayList<>());
        for (int c = 0; c < n; c++) l.get(region[c]).add(c);
        int[][] out = new int[nr][];
        for (int i = 0; i < nr; i++) out[i] = toArray(l.get(i));
        return out;
    }

    // =================================================================== regioner

    static final class RegionMaker {
        final Geometry G; final Rand rand; final int maxRegion; final int[] sizes;
        RegionMaker(Geometry G, Rand rand, int maxRegion) {
            this.G = G; this.rand = rand; this.maxRegion = maxRegion;
            this.sizes = TARGET_SIZES[maxRegion] != null ? TARGET_SIZES[maxRegion] : TARGET_SIZES[5];
        }
        int[] shuffled() {
            int n = G.n;
            int[] a = new int[n];
            for (int i = 0; i < n; i++) a[i] = i;
            for (int i = n - 1; i > 0; i--) { int j = rand.nextInt(i + 1); int t = a[i]; a[i] = a[j]; a[j] = t; }
            return a;
        }
        int grow(int[] reg, int nextId) {
            for (int start : shuffled()) {
                if (reg[start] != -1) continue;
                int target = sizes[rand.nextInt(sizes.length)];
                List<Integer> cells = new ArrayList<>();
                cells.add(start); reg[start] = nextId;
                while (cells.size() < target) {
                    List<Integer> frontier = new ArrayList<>();
                    for (int c : cells) for (int nb : G.ortho[c]) if (reg[nb] == -1) frontier.add(nb);
                    if (frontier.isEmpty()) break;
                    int pick = frontier.get(rand.nextInt(frontier.size()));
                    reg[pick] = nextId; cells.add(pick);
                }
                nextId++;
            }
            return nextId;
        }
        int[] sizesOf(int[] reg, int numIds) { int[] s = new int[numIds]; for (int r : reg) s[r]++; return s; }
        void mergeSingletons(int[] reg, int numIds) {
            boolean changed = true;
            while (changed) {
                changed = false;
                int[] size = sizesOf(reg, numIds);
                for (int c : shuffled()) {
                    if (size[reg[c]] != 1) continue;
                    int best = -1;
                    for (int nb : G.ortho[c]) {
                        int r = reg[nb];
                        if (r != reg[c] && size[r] < maxRegion && (best == -1 || size[r] < size[best])) best = r;
                    }
                    if (best != -1) { size[reg[c]]--; reg[c] = best; size[best]++; changed = true; }
                }
            }
        }
        boolean windowSolvable(int[] reg, int[] size, int r0, int c0, int h, int w) {
            int cols = G.cols;
            int[] cells = new int[h * w];
            for (int i = 0; i < h * w; i++) cells[i] = (r0 + i / w) * cols + c0 + (i % w);
            return windowRec(reg, size, cells, new int[cells.length], 0);
        }
        boolean windowRec(int[] reg, int[] size, int[] cells, int[] vals, int i) {
            if (i == cells.length) return true;
            int cols = G.cols, c = cells[i];
            for (int v = 1; v <= size[reg[c]]; v++) {
                boolean ok = true;
                for (int j = 0; j < i && ok; j++) {
                    if (vals[j] != v) continue;
                    int o = cells[j];
                    boolean touching = Math.abs(o / cols - c / cols) <= 1 && Math.abs(o % cols - c % cols) <= 1;
                    if (touching || reg[o] == reg[c]) ok = false;
                }
                if (ok) { vals[i] = v; if (windowRec(reg, size, cells, vals, i + 1)) return true; }
            }
            vals[i] = 0;
            return false;
        }
        int[] relabel(int[] reg) {
            Map<Integer, Integer> map = new HashMap<>();
            int[] out = new int[G.n];
            for (int c = 0; c < G.n; c++) { if (!map.containsKey(reg[c])) map.put(reg[c], map.size()); out[c] = map.get(reg[c]); }
            return out;
        }
        /** Opdeling med lokal reparation: 2x2-blokke (Hall) og 3x3-vinduer løst isoleret. */
        int[] generate() {
            int rows = G.rows, cols = G.cols, n = G.n;
            int[] reg = new int[n];
            Arrays.fill(reg, -1);
            int nextId = grow(reg, 0);
            for (int iter = 0; iter < 10000; iter++) {
                mergeSingletons(reg, nextId);
                Set<Integer> dissolve = new HashSet<>();
                int[] size = sizesOf(reg, nextId);
                for (int r = 0; r + 1 < rows; r++) for (int c = 0; c + 1 < cols; c++) {
                    int[] cs = {r * cols + c, r * cols + c + 1, (r + 1) * cols + c, (r + 1) * cols + c + 1};
                    int[] s = new int[4];
                    for (int i = 0; i < 4; i++) s[i] = size[reg[cs[i]]];
                    Arrays.sort(s);
                    boolean bad = false;
                    for (int k = 0; k < 4; k++) if (s[k] < k + 1) bad = true;
                    if (bad) for (int x : cs) dissolve.add(reg[x]);
                }
                if (dissolve.isEmpty()) {
                    for (int r = 0; r < rows; r++) for (int c = 0; c < cols; c++) {
                        int h = Math.min(3, rows - r), w = Math.min(3, cols - c);
                        if (h < 2 || w < 2) continue;
                        if (!windowSolvable(reg, size, r, c, h, w))
                            for (int dr = 0; dr < h; dr++) for (int dc = 0; dc < w; dc++) dissolve.add(reg[(r + dr) * cols + c + dc]);
                    }
                }
                if (dissolve.isEmpty()) return relabel(reg);
                for (int c = 0; c < n; c++) if (dissolve.contains(reg[c])) reg[c] = -1;
                nextId = grow(reg, nextId);
            }
            return relabel(reg);
        }
    }

    // =================================================================== backtracking-løser

    public static final class Solver {
        private static final class Limit extends RuntimeException { Limit() { super(null, null, false, false); } }
        final int n; final int[][] regionCells; final int[] regionSize; final int[][] peers;
        long nodes, nodeLimit; Rand order; int[] first;

        public Solver(Geometry G, int[] region) {
            n = G.n;
            regionCells = buildRegions(n, region);
            regionSize = new int[n];
            peers = new int[n][];
            for (int c = 0; c < n; c++) {
                regionSize[c] = regionCells[region[c]].length;
                LinkedHashSet<Integer> s = new LinkedHashSet<>();
                for (int k : G.king[c]) s.add(k);
                for (int k : regionCells[region[c]]) if (k != c) s.add(k);
                peers[c] = toArray(new ArrayList<>(s));
            }
        }
        boolean place(int[] dom, int[] val, int c, int v) {
            int bit = 1 << v;
            if ((dom[c] & bit) == 0) return false;
            val[c] = v; dom[c] = bit;
            for (int p : peers[c]) if ((dom[p] & bit) != 0) { dom[p] &= ~bit; if (dom[p] == 0) return false; }
            return true;
        }
        boolean propagate(int[] dom, int[] val) {
            boolean changed = true;
            while (changed) {
                changed = false;
                for (int c = 0; c < n; c++) {
                    if (val[c] != 0) continue;
                    int d = dom[c];
                    if (d == 0) return false;
                    if ((d & (d - 1)) == 0) { if (!place(dom, val, c, ctz(d))) return false; changed = true; }
                }
                for (int[] cells : regionCells) {
                    for (int v = 1; v <= cells.length; v++) {
                        int bit = 1 << v, count = 0, where = -1; boolean placed = false;
                        for (int c : cells) {
                            if (val[c] == v) { placed = true; break; }
                            if (val[c] == 0 && (dom[c] & bit) != 0) { count++; where = c; }
                        }
                        if (placed) continue;
                        if (count == 0) return false;
                        if (count == 1) { if (!place(dom, val, where, v)) return false; changed = true; }
                    }
                }
            }
            return true;
        }
        int search(int[] dom, int[] val, int limit) {
            if (++nodes > nodeLimit) throw new Limit();
            if (!propagate(dom, val)) return 0;
            int best = -1, bestCount = 99;
            for (int c = 0; c < n; c++) if (val[c] == 0) { int k = popcount(dom[c]); if (k < bestCount) { best = c; bestCount = k; } }
            if (best == -1) { if (first == null) first = val.clone(); return 1; }
            List<Integer> values = new ArrayList<>();
            for (int v = 1; v <= MAX_VALUE; v++) if ((dom[best] & (1 << v)) != 0) values.add(v);
            if (order != null) for (int i = values.size() - 1; i > 0; i--) {
                int j = (int) Math.floor(order.next() * (i + 1));
                int t = values.get(i); values.set(i, values.get(j)); values.set(j, t);
            }
            int total = 0;
            for (int v : values) {
                int[] d2 = dom.clone(), v2 = val.clone();
                if (place(d2, v2, best, v)) { total += search(d2, v2, limit - total); if (total >= limit) return total; }
            }
            return total;
        }
        /** Antal løsninger (afskåret ved limit); -1 hvis node-grænsen nås. */
        public int count(int[] givens, int limit, long nl, Rand rnd) {
            nodes = 0; nodeLimit = nl; order = rnd; first = null;
            int[] dom = new int[n], val = new int[n];
            for (int c = 0; c < n; c++) dom[c] = (1 << (regionSize[c] + 1)) - 2;
            for (int c = 0; c < n; c++) if (givens[c] != 0 && !place(dom, val, c, givens[c])) return 0;
            try { return search(dom, val, limit); } catch (Limit e) { return -1; }
        }
        public int[] randomSolution(Rand rnd, long limit) {
            return count(new int[n], 1, limit, rnd) == 1 ? first : null;
        }
    }

    // =================================================================== menneskelig løser / vurdering

    public static final class Rating {
        public final int level, score; public final boolean solved; public final int[] uses;
        Rating(int level, int score, boolean solved, int[] uses) { this.level = level; this.score = score; this.solved = solved; this.uses = uses; }
    }

    public static final class Rater {
        final int n, cols; final int[] region; final int[][] regionCells; final int[] regionSize;
        final boolean[] isPeer; final int[][] peers;
        int lastUses;

        static final class S {
            int[] cand, val; boolean broken;
            S copy() { S t = new S(); t.cand = cand.clone(); t.val = val.clone(); t.broken = broken; return t; }
        }

        public Rater(Geometry G, int[] region) {
            n = G.n; cols = G.cols; this.region = region;
            regionCells = buildRegions(n, region);
            regionSize = new int[n];
            isPeer = new boolean[n * n];
            peers = new int[n][];
            for (int c = 0; c < n; c++) {
                regionSize[c] = regionCells[region[c]].length;
                int r = c / cols, k = c % cols;
                List<Integer> p = new ArrayList<>();
                for (int o = 0; o < n; o++) {
                    if (o == c) continue;
                    boolean touching = Math.abs(o / cols - r) <= 1 && Math.abs(o % cols - k) <= 1;
                    if (touching || region[o] == region[c]) { isPeer[c * n + o] = true; p.add(o); }
                }
                peers[c] = toArray(p);
            }
        }
        boolean P(int a, int b) { return isPeer[a * n + b]; }
        S newState() {
            S s = new S(); s.cand = new int[n]; s.val = new int[n];
            for (int c = 0; c < n; c++) s.cand[c] = (1 << (regionSize[c] + 1)) - 2;
            return s;
        }
        boolean isSolved(S s) { for (int c = 0; c < n; c++) if (s.val[c] == 0) return false; return true; }
        void place(S s, int c, int v) {
            int bit = 1 << v;
            if ((s.cand[c] & bit) == 0) { s.broken = true; return; }
            s.val[c] = v; s.cand[c] = bit;
            for (int p : peers[c]) if ((s.cand[p] & bit) != 0) { s.cand[p] &= ~bit; if (s.cand[p] == 0) s.broken = true; }
        }
        boolean eliminate(S s, int c, int mask) {
            if (s.val[c] != 0 || (s.cand[c] & mask) == 0) return false;
            s.cand[c] &= ~mask;
            if (s.cand[c] == 0) s.broken = true;
            return true;
        }
        int nakedSingles(S s) {
            int count = 0;
            for (int c = 0; c < n && !s.broken; c++)
                if (s.val[c] == 0 && popcount(s.cand[c]) == 1) { place(s, c, ctz(s.cand[c])); count++; }
            return count;
        }
        int hiddenSingles(S s) {
            int count = 0;
            for (int[] cells : regionCells) {
                for (int v = 1; v <= cells.length && !s.broken; v++) {
                    int bit = 1 << v, places = 0, where = -1; boolean placed = false;
                    for (int c : cells) {
                        if (s.val[c] == v) { placed = true; break; }
                        if (s.val[c] == 0 && (s.cand[c] & bit) != 0) { places++; where = c; }
                    }
                    if (placed) continue;
                    if (places == 0) { s.broken = true; return Math.max(count, 1); }
                    if (places == 1) { place(s, where, v); count++; }
                }
            }
            return count;
        }
        boolean neighborElimination(S s) {
            for (int[] cells : regionCells) {
                for (int v = 1; v <= cells.length; v++) {
                    int bit = 1 << v; List<Integer> spots = new ArrayList<>(); boolean placed = false;
                    for (int c : cells) {
                        if (s.val[c] == v) { placed = true; break; }
                        if (s.val[c] == 0 && (s.cand[c] & bit) != 0) spots.add(c);
                    }
                    if (placed || spots.size() < 2) continue;
                    boolean progress = false;
                    for (int x : peers[spots.get(0)]) {
                        if (s.val[x] != 0 || (s.cand[x] & bit) == 0 || spots.contains(x)) continue;
                        boolean all = true;
                        for (int sp : spots) if (!P(x, sp)) { all = false; break; }
                        if (all) progress = eliminate(s, x, bit) || progress;
                    }
                    if (progress) return true;
                }
            }
            return false;
        }
        boolean nakedSubset(S s, int k) {
            List<Integer> l = new ArrayList<>();
            for (int c = 0; c < n; c++) { int b = popcount(s.cand[c]); if (s.val[c] == 0 && b >= 2 && b <= k) l.add(c); }
            return nakedRec(s, toArray(l), k, 0, 0, 0, new int[k]);
        }
        boolean nakedRec(S s, int[] cs, int k, int start, int depth, int mask, int[] chosen) {
            if (depth == k) {
                if (popcount(mask) != k) return false;
                boolean progress = false;
                for (int p : peers[chosen[0]]) {
                    boolean all = true;
                    for (int i = 1; i < k; i++) if (!P(p, chosen[i])) { all = false; break; }
                    if (all) progress = eliminate(s, p, mask) || progress;
                }
                return progress;
            }
            for (int i = start; i < cs.length; i++) {
                int c = cs[i], m2 = mask | s.cand[c];
                if (popcount(m2) > k) continue;
                boolean ok = true;
                for (int j = 0; j < depth; j++) if (!P(chosen[j], c)) { ok = false; break; }
                if (!ok) continue;
                chosen[depth] = c;
                if (nakedRec(s, cs, k, i + 1, depth + 1, m2, chosen)) return true;
            }
            return false;
        }
        boolean hiddenSubset(S s, int k) {
            for (int[] cells : regionCells) {
                int full = (1 << (cells.length + 1)) - 2, placedMask = 0;
                for (int c : cells) if (s.val[c] != 0) placedMask |= 1 << s.val[c];
                int open = full & ~placedMask;
                if (popcount(open) <= k) continue;
                for (int m = open; m > 0; m = (m - 1) & open) {
                    if (popcount(m) != k) continue;
                    int spots = 0;
                    for (int c : cells) if (s.val[c] == 0 && (s.cand[c] & m) != 0) spots++;
                    if (spots < k) { s.broken = true; return true; }
                    if (spots > k) continue;
                    boolean progress = false;
                    for (int c : cells) if (s.val[c] == 0 && (s.cand[c] & m) != 0) progress = eliminate(s, c, ~m) || progress;
                    if (progress) return true;
                }
            }
            return false;
        }

        // ---- kæder (mode: 'x' = ét tal, 'y' = to-mulighedsfelter, 'a' = blandet)
        private Map<Integer, List<Integer>> strong;
        private Set<Integer> onPath;
        private int budget;
        private boolean done;
        private boolean sameCellOK;
        private S cs;

        boolean chainElim(S s, char mode) {
            strong = new LinkedHashMap<>();
            if (mode != 'x') for (int c = 0; c < n; c++) if (s.val[c] == 0 && popcount(s.cand[c]) == 2) {
                int lo = ctz(s.cand[c]), hi = ctz(s.cand[c] & ~(1 << lo));
                addS(c * 8 + lo, c * 8 + hi);
            }
            if (mode != 'y') for (int[] cells : regionCells) for (int d = 1; d <= cells.length; d++) {
                boolean has = false;
                for (int c : cells) if (s.val[c] == d) has = true;
                if (has) continue;
                List<Integer> sp = new ArrayList<>();
                for (int c : cells) if (s.val[c] == 0 && (s.cand[c] & (1 << d)) != 0) sp.add(c);
                if (sp.size() == 2) addS(sp.get(0) * 8 + d, sp.get(1) * 8 + d);
            }
            if (strong.size() < 4) return false;
            sameCellOK = mode != 'x';
            cs = s; onPath = new HashSet<>(); budget = 20000; done = false;
            for (Map.Entry<Integer, List<Integer>> e : strong.entrySet()) {
                int A = e.getKey();
                onPath.add(A);
                for (int B : e.getValue()) { onPath.add(B); dfs(A, B, 1); onPath.remove(B); if (done) return true; }
                onPath.remove(A);
                if (budget < 0) break;
            }
            return done;
        }
        private void addS(int a, int b) {
            strong.computeIfAbsent(a, k -> new ArrayList<>());
            strong.computeIfAbsent(b, k -> new ArrayList<>());
            strong.get(a).add(b); strong.get(b).add(a);
        }
        private boolean weak(int a, int b) {
            if (a == b) return false;
            int ca = a >> 3, cb = b >> 3;
            return ca == cb ? sameCellOK : ((a & 7) == (b & 7) && P(ca, cb));
        }
        private List<Integer> weakNbrs(int k) {
            int c = k >> 3, d = k & 7;
            List<Integer> out = new ArrayList<>();
            if (sameCellOK) for (int e = 1; e <= MAX_VALUE; e++) if (e != d && (cs.cand[c] & (1 << e)) != 0) out.add(c * 8 + e);
            for (int p : peers[c]) if (cs.val[p] == 0 && (cs.cand[p] & (1 << d)) != 0) out.add(p * 8 + d);
            return out;
        }
        private boolean tryEnd(int A, int Y) {
            boolean prog = false;
            for (int z : weakNbrs(A)) if (!onPath.contains(z) && weak(z, Y)) { eliminate(cs, z >> 3, 1 << (z & 7)); prog = true; }
            return prog;
        }
        private void dfs(int A, int Y, int k) {
            if (done || --budget < 0) return;
            if (k >= 2 && tryEnd(A, Y)) { done = true; return; }
            if (k >= 7) return;
            for (int W : weakNbrs(Y)) {
                if (onPath.contains(W) || !strong.containsKey(W)) continue;
                onPath.add(W);
                for (int Z : strong.get(W)) {
                    if (onPath.contains(Z)) continue;
                    onPath.add(Z); dfs(A, Z, k + 1); onPath.remove(Z);
                    if (done) return;
                }
                onPath.remove(W);
            }
        }

        // ---- hvis-så med ét tal
        boolean nishioFails(S s, int c0, int x) {
            boolean[] has = new boolean[n], placed = new boolean[n];
            for (int c = 0; c < n; c++) has[c] = s.val[c] == 0 && (s.cand[c] & (1 << x)) != 0;
            put(has, placed, c0);
            boolean changed = true;
            while (changed) {
                changed = false;
                for (int[] cells : regionCells) {
                    if (cells.length < x) continue;
                    boolean skip = false;
                    for (int c : cells) if (s.val[c] == x || placed[c]) skip = true;
                    if (skip) continue;
                    int spot = -1, cnt = 0;
                    for (int c : cells) if (has[c]) { cnt++; spot = c; }
                    if (cnt == 0) return true;
                    if (cnt == 1) { put(has, placed, spot); changed = true; }
                }
            }
            return false;
        }
        private void put(boolean[] has, boolean[] placed, int c) { placed[c] = true; has[c] = false; for (int p : peers[c]) has[p] = false; }
        boolean nishio(S s) {
            for (int size = 2; size <= MAX_VALUE; size++) for (int c = 0; c < n; c++) {
                if (s.val[c] != 0 || popcount(s.cand[c]) != size) continue;
                for (int x = 1; x <= MAX_VALUE; x++) {
                    if ((s.cand[c] & (1 << x)) == 0) continue;
                    if (nishioFails(s, c, x)) { eliminate(s, c, 1 << x); return true; }
                }
            }
            return false;
        }

        // ---- begge veje
        void singlesOnly(S t) {
            while (!t.broken && !isSolved(t)) { if (nakedSingles(t) > 0) continue; if (hiddenSingles(t) > 0) continue; break; }
        }
        boolean bothWays(S s) {
            List<int[]> roots = new ArrayList<>();
            for (int c = 0; c < n; c++) if (s.val[c] == 0 && popcount(s.cand[c]) == 2) {
                int lo = ctz(s.cand[c]), hi = ctz(s.cand[c] & ~(1 << lo));
                roots.add(new int[]{c, lo, c, hi});
            }
            for (int[] cells : regionCells) for (int d = 1; d <= cells.length; d++) {
                boolean has = false;
                for (int c : cells) if (s.val[c] == d) has = true;
                if (has) continue;
                List<Integer> sp = new ArrayList<>();
                for (int c : cells) if (s.val[c] == 0 && (s.cand[c] & (1 << d)) != 0) sp.add(c);
                if (sp.size() == 2) roots.add(new int[]{sp.get(0), d, sp.get(1), d});
            }
            for (int[] r : roots) {
                S A = s.copy(); place(A, r[0], r[1]); singlesOnly(A); if (A.broken) continue;
                S B = s.copy(); place(B, r[2], r[3]); singlesOnly(B); if (B.broken) continue;
                boolean prog = false;
                for (int c = 0; c < n; c++) {
                    if (s.val[c] != 0) continue;
                    int gone = s.cand[c] & ~A.cand[c] & ~B.cand[c];
                    if (gone != 0) { eliminate(s, c, gone); prog = true; }
                }
                if (prog) return true;
            }
            return false;
        }

        // ---- hvis-så (modstrid)
        boolean contradiction(S s, int innerLevel) {
            for (int size = 2; size <= MAX_VALUE; size++) {
                for (int c = 0; c < n; c++) {
                    if (s.val[c] != 0 || popcount(s.cand[c]) != size) continue;
                    for (int v = 1; v <= MAX_VALUE; v++) {
                        if ((s.cand[c] & (1 << v)) == 0) continue;
                        S t = s.copy();
                        place(t, c, v);
                        while (!t.broken && !isSolved(t)) if (step(t, innerLevel) < 0) break;
                        if (t.broken) { eliminate(s, c, 1 << v); return true; }
                    }
                }
            }
            return false;
        }

        int step(S s, int maxLevel) {
            int u;
            if ((u = nakedSingles(s)) > 0) { lastUses = u; return 0; }
            if ((u = hiddenSingles(s)) > 0) { lastUses = u; return 1; }
            if (maxLevel >= 2 && neighborElimination(s)) { lastUses = 1; return 2; }
            if (maxLevel >= 3 && nakedSubset(s, 2)) { lastUses = 1; return 3; }
            if (maxLevel >= 3 && hiddenSubset(s, 2)) { lastUses = 1; return 4; }
            if (maxLevel >= 4 && nakedSubset(s, 3)) { lastUses = 1; return 5; }
            if (maxLevel >= 4 && hiddenSubset(s, 3)) { lastUses = 1; return 6; }
            if (maxLevel >= 5 && chainElim(s, 'x')) { lastUses = 1; return 7; }
            if (maxLevel >= 6 && chainElim(s, 'y')) { lastUses = 1; return 8; }
            if (maxLevel >= 7 && chainElim(s, 'a')) { lastUses = 1; return 9; }
            if (maxLevel >= 8 && nishio(s)) { lastUses = 1; return 10; }
            if (maxLevel >= 9 && contradiction(s, 1)) { lastUses = 1; return 11; }
            if (maxLevel >= 10 && bothWays(s)) { lastUses = 1; return 12; }
            if (maxLevel >= 11 && contradiction(s, 8)) { lastUses = 1; return 13; }
            return -1;
        }

        public Rating rate(int[] givens) { return rate(givens, TOP_LEVEL); }

        /** Løs med teknikker op til maxLevel. solved=false: kunne ikke løses inden for niveauet. */
        public Rating rate(int[] givens, int maxLevel) {
            S s = newState();
            for (int c = 0; c < n; c++) if (givens[c] != 0) place(s, c, givens[c]);
            int[] uses = new int[TECH_LABEL.length];
            int score = 0, hardest = 1;
            while (!s.broken && !isSolved(s)) {
                int t = step(s, maxLevel);
                if (t < 0) break;
                uses[t] += lastUses; score += TECH_WEIGHT[t] * lastUses;
                hardest = Math.max(hardest, TECH_LEVEL[t]);
            }
            boolean solved = !s.broken && isSolved(s);
            return new Rating(solved ? hardest : TOP_LEVEL + 1, score, solved, uses);
        }
    }

    // =================================================================== generering

    public static final class Puzzle {
        public final int rows, cols, maxRegion; public final long seed;
        public final int[] region, solution, givens;
        public final Rating rating; public int target; public final int tries;
        public SuguruGrade.Grade grade; // sættes af SuguruGrade
        Puzzle(int rows, int cols, int[] region, int[] solution, int[] givens, Rating rating, int target, long seed, int tries, int maxRegion) {
            this.rows = rows; this.cols = cols; this.region = region; this.solution = solution; this.givens = givens;
            this.rating = rating; this.target = target; this.seed = seed; this.tries = tries; this.maxRegion = maxRegion;
        }
        public int clueCount() { int k = 0; for (int g : givens) if (g != 0) k++; return k; }
    }

    /** Generér en opgave på målniveauet (eller den nærmeste inden for tidsbudgettet). */
    public static Puzzle generate(int rows, int cols, int target, long seed, long budgetMs, int maxRegion) {
        long t0 = System.currentTimeMillis();
        Geometry G = new Geometry(rows, cols);
        Rand rand = new Rand(seed);
        RegionMaker maker = new RegionMaker(G, rand, maxRegion);
        Puzzle best = null;
        int bestDist = Integer.MAX_VALUE, tries = 0;
        while (true) {
            int[] region, solution;
            Solver solver;
            do {
                region = maker.generate();
                solver = new Solver(G, region);
                solution = solver.randomSolution(rand, 5000);
            } while (solution == null);
            Rater rater = new Rater(G, region);
            for (int o = 0; o < 4; o++) {
                tries++;
                int[] givens = solution.clone();
                for (int c : maker.shuffled()) {
                    int saved = givens[c]; givens[c] = 0;
                    if (!rater.rate(givens, target).solved) givens[c] = saved;
                }
                Rating rating = rater.rate(givens, TOP_LEVEL);
                int dist = Math.abs(rating.level - target);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = new Puzzle(rows, cols, region, solution, givens, rating, target, seed, tries, maxRegion);
                }
                if (dist == 0 || System.currentTimeMillis() - t0 > budgetMs) return best;
            }
        }
    }

    // =================================================================== konsol

    public static String ascii(Puzzle p, boolean showSolution) {
        int[] v = showSolution ? p.solution : p.givens;
        StringBuilder sb = new StringBuilder();
        for (int r = 0; r < p.rows; r++) {
            for (int c = 0; c < p.cols; c++) {
                boolean wall = r == 0 || p.region[(r - 1) * p.cols + c] != p.region[r * p.cols + c];
                sb.append('+').append(wall ? "---" : "   ");
            }
            sb.append("+\n");
            for (int c = 0; c < p.cols; c++) {
                boolean wall = c == 0 || p.region[r * p.cols + c - 1] != p.region[r * p.cols + c];
                int x = v[r * p.cols + c];
                sb.append(wall ? '|' : ' ').append(' ').append(x == 0 ? '.' : (char) ('0' + x)).append(' ');
            }
            sb.append("|\n");
        }
        for (int c = 0; c < p.cols; c++) sb.append("+---");
        return sb.append("+\n").toString();
    }


    /**
     * Sikrer at æ, ø og å vises rigtigt i terminalen: brug konsollens tegnsæt
     * (på Windows sætter Java-launcheren sun.stdout.encoding, fx cp850).
     */
    static void fixConsoleEncoding() {
        String enc = System.getProperty("stdout.encoding");
        if (enc == null) enc = System.getProperty("sun.stdout.encoding");
        if (enc == null) return;
        try {
            System.setOut(new java.io.PrintStream(new java.io.FileOutputStream(java.io.FileDescriptor.out), true, enc));
        } catch (java.io.UnsupportedEncodingException ignored) { /* behold standard */ }
    }

    /** java SuguruEngine [rækker] [kolonner] [niveau 1-11] [maks regionsstørrelse 4-6] [seed] */
    public static void main(String[] args) {
        fixConsoleEncoding();
        int rows = args.length > 0 ? Integer.parseInt(args[0]) : 6;
        int cols = args.length > 1 ? Integer.parseInt(args[1]) : 6;
        int level = args.length > 2 ? Integer.parseInt(args[2]) : 5;
        int maxRegion = args.length > 3 ? Integer.parseInt(args[3]) : 5;
        long seed = args.length > 4 ? Long.parseLong(args[4]) : (long) (Math.random() * 1e9);
        long t0 = System.currentTimeMillis();
        Puzzle p = generate(rows, cols, level, seed, 20000, maxRegion);
        SuguruGrade.attach(p);
        System.out.printf("Suguru %dx%d · maks %d · seed %d · %d ms%n", cols, rows, maxRegion, seed, System.currentTimeMillis() - t0);
        System.out.println(SuguruGrade.describe(p));
        System.out.println(ascii(p, false));
        System.out.println(ascii(p, true));
    }
}
