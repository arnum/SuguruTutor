import java.util.*;

/**
 * Opgavekode "SU1": selve opgaven (regionernes vægge + givne tal) pakket i tegn, der er nemme at skrive af.
 * Uafhængig af generatorens version og identisk med web-versionens format, så en opgave fra et trykt hæfte
 * kan læses ind i spillet (med hints) og omvendt.
 *
 * Format: SU1-<bredde>X<højde>-<data i grupper á 5 tegn>
 * Data (bit for bit): vægge til højre for hvert felt, vægge under hvert felt, for hvert felt 1 bit "givet?"
 * + 3 bit (tal-1) hvis givet, til sidst 10 bit kontrol (FNV-1a). Tegnsæt: Crockford base32.
 */
public final class SuguruCode {

    private SuguruCode() {}

    static final String ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    public static final class Decoded {
        public final int rows, cols; public final int[] region, givens;
        Decoded(int rows, int cols, int[] region, int[] givens) { this.rows = rows; this.cols = cols; this.region = region; this.givens = givens; }
    }

    static int checksum(List<Integer> bits, int rows, int cols) {
        int h = (int) 2166136261L;
        int[] head = {rows, cols};
        for (int x : head) { h ^= x; h *= 16777619; }
        for (int b : bits) { h ^= b; h *= 16777619; }
        return h & 1023;
    }

    public static String encode(int rows, int cols, int[] region, int[] givens) {
        List<Integer> bits = new ArrayList<>();
        for (int r = 0; r < rows; r++) for (int c = 0; c + 1 < cols; c++) bits.add(region[r * cols + c] != region[r * cols + c + 1] ? 1 : 0);
        for (int r = 0; r + 1 < rows; r++) for (int c = 0; c < cols; c++) bits.add(region[r * cols + c] != region[(r + 1) * cols + c] ? 1 : 0);
        for (int i = 0; i < rows * cols; i++) {
            if (givens[i] != 0) { int v = givens[i] - 1; bits.add(1); bits.add((v >> 2) & 1); bits.add((v >> 1) & 1); bits.add(v & 1); }
            else bits.add(0);
        }
        int chk = checksum(bits, rows, cols);
        for (int k = 9; k >= 0; k--) bits.add((chk >> k) & 1);
        while (bits.size() % 5 != 0) bits.add(0);
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < bits.size(); i += 5)
            s.append(ALPHA.charAt(bits.get(i) * 16 + bits.get(i + 1) * 8 + bits.get(i + 2) * 4 + bits.get(i + 3) * 2 + bits.get(i + 4)));
        StringBuilder g = new StringBuilder("SU1-" + cols + "X" + rows);
        for (int i = 0; i < s.length(); i += 5) g.append('-').append(s, i, Math.min(s.length(), i + 5));
        return g.toString();
    }

    public static String encode(SuguruEngine.Puzzle p) { return encode(p.rows, p.cols, p.region, p.givens); }

    /** Afkod en kode. Kaster IllegalArgumentException med en dansk forklaring ved fejl. */
    public static Decoded decode(String text) {
        String t = text.toUpperCase().replace("#", "").trim().replaceAll("\\s+", "-").replaceAll("-+", "-").replace('×', 'X');
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^SU1-(\\d{1,2})X(\\d{1,2})-([0-9A-Z-]+)$").matcher(t);
        if (!m.matches()) m = java.util.regex.Pattern.compile("^SU1(\\d{1,2})X(\\d{1,2})-?([0-9A-Z-]+)$").matcher(t);
        if (!m.matches()) throw new IllegalArgumentException("Koden skal se sådan ud: SU1-6X6-...");
        int cols = Integer.parseInt(m.group(1)), rows = Integer.parseInt(m.group(2));
        if (cols < 2 || rows < 2 || cols > 12 || rows > 12) throw new IllegalArgumentException("Størrelsen i koden giver ikke mening.");
        String body = m.group(3).replace("-", "").replace('O', '0').replace('I', '1').replace('L', '1');
        List<Integer> bits = new ArrayList<>();
        for (char ch : body.toCharArray()) {
            int v = ALPHA.indexOf(ch);
            if (v < 0) throw new IllegalArgumentException("Ukendt tegn i koden: " + ch);
            for (int k = 4; k >= 0; k--) bits.add((v >> k) & 1);
        }
        int[] pos = {0};
        java.util.function.IntSupplier take = () -> {
            if (pos[0] >= bits.size()) throw new IllegalArgumentException("Koden er for kort. Mangler der et stykke?");
            return bits.get(pos[0]++);
        };
        int[] right = new int[rows * (cols - 1)], down = new int[(rows - 1) * cols];
        for (int i = 0; i < right.length; i++) right[i] = take.getAsInt();
        for (int i = 0; i < down.length; i++) down[i] = take.getAsInt();
        int[] givens = new int[rows * cols];
        for (int i = 0; i < rows * cols; i++) if (take.getAsInt() == 1) givens[i] = (take.getAsInt() << 2 | take.getAsInt() << 1 | take.getAsInt()) + 1;
        int dataEnd = pos[0], chk = 0;
        for (int k = 0; k < 10; k++) chk = (chk << 1) | take.getAsInt();
        boolean trailing = false;
        for (int i = pos[0]; i < bits.size(); i++) if (bits.get(i) != 0) trailing = true;
        if (bits.size() - pos[0] >= 5 || trailing) throw new IllegalArgumentException("Koden er for lang eller har en tastefejl.");
        if (chk != checksum(bits.subList(0, dataEnd), rows, cols)) throw new IllegalArgumentException("Kontrollen passer ikke. Der er sandsynligvis en tastefejl i koden.");
        int[] region = new int[rows * cols];
        Arrays.fill(region, -1);
        int next = 0;
        for (int s0 = 0; s0 < rows * cols; s0++) {
            if (region[s0] != -1) continue;
            Deque<Integer> stack = new ArrayDeque<>();
            stack.push(s0); region[s0] = next;
            while (!stack.isEmpty()) {
                int i = stack.pop(), r = i / cols, c = i % cols;
                List<Integer> nb = new ArrayList<>();
                if (c + 1 < cols && right[r * (cols - 1) + c] == 0) nb.add(i + 1);
                if (c > 0 && right[r * (cols - 1) + c - 1] == 0) nb.add(i - 1);
                if (r + 1 < rows && down[r * cols + c] == 0) nb.add(i + cols);
                if (r > 0 && down[(r - 1) * cols + c] == 0) nb.add(i - cols);
                for (int j : nb) if (region[j] == -1) { region[j] = next; stack.push(j); }
            }
            next++;
        }
        int[] size = new int[next];
        for (int r : region) size[r]++;
        for (int z : size) if (z > 6) throw new IllegalArgumentException("Koden giver en region med mere end 6 felter.");
        for (int i = 0; i < rows * cols; i++) if (givens[i] > size[region[i]]) throw new IllegalArgumentException("Koden har et tal, der er større end sin region.");
        return new Decoded(rows, cols, region, givens);
    }

    /** Byg en fuld opgave (løsning, vurdering, decimal) ud fra en kode. */
    public static SuguruEngine.Puzzle toPuzzle(String code) {
        Decoded d = decode(code);
        SuguruEngine.Geometry G = new SuguruEngine.Geometry(d.rows, d.cols);
        SuguruEngine.Solver solver = new SuguruEngine.Solver(G, d.region);
        int k = solver.count(d.givens, 2, 2_000_000, null);
        if (k == 0) throw new IllegalArgumentException("Koden giver en opgave uden løsning.");
        if (k != 1) throw new IllegalArgumentException("Koden giver en opgave med mere end én løsning.");
        int[] solution = solver.first.clone();
        SuguruEngine.Rating rating = new SuguruEngine.Rater(G, d.region).rate(d.givens);
        int maxRegion = 0;
        int[] size = new int[d.region.length];
        for (int r : d.region) size[r]++;
        for (int z : size) maxRegion = Math.max(maxRegion, z);
        SuguruEngine.Puzzle p = new SuguruEngine.Puzzle(d.rows, d.cols, d.region, solution, d.givens, rating, rating.level, -1, 0, maxRegion);
        SuguruGrade.attach(p);
        return p;
    }
}
