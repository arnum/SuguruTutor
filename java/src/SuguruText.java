import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Texts for the booklet and the console. They are written in English in the code; DA translates each English text
 * into Danish. Choose Danish with --lang da (SuguruBook). A text missing from DA is shown in English.
 * Format texts (%d, %s) are translated as a whole, so the Danish sentence can put the values where it needs them.
 */
public final class SuguruText {
    /** Danish instead of English. */
    public static boolean da = false;

    public static String t(String en) {
        if (!da) return en;
        String s = DA.get(en);
        return s == null ? en : s;
    }

    public static String f(String en, Object... args) { return String.format(Locale.ROOT, t(en), args); }

    /** One decimal with the language's decimal separator: 4,2 in Danish, 4.2 in English. */
    public static String dec(double x) {
        String s = String.format(Locale.ROOT, "%.1f", x);
        return da ? s.replace('.', ',') : s;
    }

    static final Map<String, String> DA = new HashMap<>();
    private static void da(String en, String da) { DA.put(en, da); }
    static {
        // techniques (SuguruEngine.TECH_LABEL, TECH_DESC)
        da("Naked single", "Eneste kandidat");
        da("Hidden single", "Eneste plads i region");
        da("Neighbour elimination", "Nabo-eliminering");
        da("Naked pair", "Nøgent par");
        da("Hidden pair", "Skjult par");
        da("Naked triple", "Nøgen trippel");
        da("Hidden triple", "Skjult trippel");
        da("Single-number chain", "Kæde med ét tal");
        da("Bivalue chain", "Kæde med to-mulighedsfelter");
        da("Mixed chain", "Blandet kæde");
        da("Mixed pair", "Blandet par");
        da("Mixed triple", "Blandet trippel");
        da("Short single-number chain", "Kort kæde med ét tal");
        da("Nook", "Krog");
        da("A cell with two options sees two cells with two options each, and each shares one of its numbers. The two outer cells share a third number, and one of them holds it: cells that see both cannot.", "Et felt med to muligheder ser to felter med to muligheder hver, og hver deler et af dets tal. De to yderste felter deler et tredje tal, og et af dem har det: felter, der ser dem begge, kan ikke.");
        da("Two cells have the same two options. If one of the numbers has only two places in a region, and each cell sees one of them, then one of the two cells holds the other number: cells that see both cannot.", "To felter har de samme to muligheder. Har det ene tal kun to pladser i en region, og ser hvert felt en af dem, så har et af de to felter det andet tal: felter, der ser dem begge, kan ikke.");
        da("A cell touches every cell of a region but one, and its own region is no bigger. Its number must be in that region, and there only the one cell is left: the two cells are the same number.", "Et felt rører alle felter i en region undtagen ét, og dets egen region er ikke større. Dets tal må stå i den region, og der er kun det ene felt tilbage: de to felter har samme tal.");
        da("A number has two places in each of two regions, and one place in the first touches one in the second. They cannot both be the number, so one of the two far places is. Cells that see both far places cannot hold it.", "Et tal har to pladser i hver af to regioner, og den ene plads i den første rører den ene i den anden. De kan ikke begge være tallet, så en af de to fjerne pladser er det. Felter, der ser begge fjerne pladser, kan ikke have det.");
        da("Three cells that see each other with only three options between them are those three numbers. A cell that sees all three, some through its region and the rest by touching, cannot hold them.", "Tre felter, der ser hinanden og tilsammen kun har tre muligheder, er de tre tal. Et felt, der ser alle tre, nogle gennem sin region og resten ved at røre dem, kan ikke have dem.");
        da("Two touching cells with the same two options are those two numbers. A cell in the same region as one of them that touches the other cannot hold them.", "To felter, der rører hinanden og har de samme to muligheder, er de to tal. Et felt i samme region som det ene, der rører det andet, kan ikke have dem.");
        da("Single-number what-if", "Hvis-så med ét tal");
        da("What-if with singles", "Hvis-så med enkle tal");
        da("Both ways", "Begge veje");
        da("What-if with techniques", "Hvis-så med teknikker");
        da("The cell has only one possible number left.", "Cellen har kun ét muligt tal tilbage.");
        da("A number can only go in one place in its region.", "Et tal kan kun stå ét sted i sin region.");
        da("Every possible place for a number in a region touches the same cell outside it. That cell cannot hold the number.",
            "Alle mulige pladser for et tal i en region rører samme celle udenfor. Den celle kan ikke have tallet.");
        da("Two cells that see each other have only two possible numbers between them. Cells that see both cannot hold them.",
            "To celler, der ser hinanden, har tilsammen kun to mulige tal. Celler, der ser begge, kan ikke have dem.");
        da("Two numbers in a region can only go in the same two cells. Those cells cannot hold any other number.",
            "To tal i en region kan kun stå i de samme to celler. De celler kan ikke have andre tal.");
        da("Like a naked pair, but with three cells and three numbers.", "Som nøgent par, men med tre celler og tre tal.");
        da("Like a hidden pair, but with three numbers and three cells.", "Som skjult par, men med tre tal og tre celler.");
        da("Follow one number: if it is not here, it must be there, and then it cannot be around it. Cells that see both ends cannot hold the number.",
            "Følg ét tal: står det ikke her, må det stå dér, og så kan det ikke stå omkring. Felter der ser begge ender, kan ikke have tallet.");
        da("A chain of cells with only two options: if the first cell is not a, the rest are forced until the last cell becomes a.",
            "Felter med kun to muligheder i en kæde: er første felt ikke a, tvinges resten, indtil sidste felt bliver a.");
        da("A chain that mixes cells with two options and numbers with two places in a region.",
            "En kæde der blander felter med to muligheder og tal med to pladser i en region.");
        da("Assume a cell is x and follow only the number x. If a region has no room left for x, the assumption was wrong.",
            "Antag at et felt er x, og følg kun tallet x. Mangler en region plads til x, var antagelsen forkert.");
        da("Assume a number and follow simple moves with all numbers. If it ends in a contradiction, the assumption was wrong.",
            "Antag et tal og følg enkle træk med alle tal. Ender det i en modstrid, var antagelsen forkert.");
        da("Try both options in a cell (or both places for a number). Whatever both ways give is true.",
            "Prøv begge muligheder i et felt (eller begge pladser for et tal). Det begge veje giver, er sandt.");
        da("Like the what-if with singles, but the path to the contradiction needs harder techniques along the way, such as pairs or chains.",
            "Som hvis-så med enkle tal, men vejen til modstriden kræver sværere teknikker undervejs, fx par eller kæder.");
        // old level names (SuguruEngine.LEVELS)
        da("Easy", "Let");
        da("Medium", "Middel");
        da("Hard", "Svær");
        da("Very hard", "Meget svær");
        da("Pair: mixed", "Par: blandet");
        da("Triple: mixed", "Trippel: blandet");
        da("Chain: one number", "Kæde: ét tal");
        da("Chain: two options", "Kæde: to muligheder");
        da("Chain: mixed", "Kæde: blandet");
        da("What-if: one number", "Hvis-så: ét tal");
        da("What-if: singles", "Hvis-så: enkle tal");
        da("What-if: techniques", "Hvis-så: teknikker");
        da("Needs guessing", "Kræver gæt");
        // grades (SuguruGrade.BAND, LEVEL_TECH)
        da("Beginner", "Begynder");
        da("Expert", "Ekspert");
        da("Master", "Mester");
        da("Extreme", "Ekstrem");
        da("Diabolical", "Djævelsk");
        da("singles", "eneste kandidat/plads");
        da("neighbour elimination", "nabo-eliminering");
        da("pairs", "par");
        da("triples", "tripler");
        da("mixed pair", "blandet par");
        da("mixed triple", "blandet trippel");
        da("single-number chain", "kæde med ét tal");
        da("bivalue chain", "kæde med to-mulighedsfelter");
        da("mixed chain", "blandet kæde");
        da("single-number what-if", "hvis-så med ét tal");
        da("what-if with singles", "hvis-så med enkle tal");
        da("both ways", "begge veje");
        da("what-if with techniques", "hvis-så med teknikker");
        da("guessing", "gæt");
        // the grade explained (SuguruGrade)
        da("%s (without pencil %s)", "%s (uden blyant %s)");
        da("peak %s · load %d", "top %s · mængde %d");
        da("Only simple moves. Every number can be found directly from the numbers in the grid.", "Kun enkle træk. Hvert tal kan findes direkte ud fra tallene i gitteret.");
        da("Narrow path.", "Smal vej.");
        da("Some options.", "Nogle muligheder.");
        da("Many options.", "Mange muligheder.");
        da("%s On average %s places to make progress from.", "%s I gennemsnit %s steder at komme videre fra.");
        da("Recognition. The heaviest step is %s, %d %% into the puzzle.", "Genkendelse. Det tungeste skridt er %s, %d %% inde i opgaven.");
        da(" The pattern itself %s", " Mønstret i sig selv %s");
        da("; %d cell %s", "; %d felt %s");
        da("; %d cells around a corner %s", "; %d felter om et hjørne %s");
        da("; %d cells in a line %s", "; %d felter på linje %s");
        da("; crowded area %s", "; tæt udfyldt område %s");
        da("; half-open area %s", "; halvåbent område %s");
        da("; open area %s", "; åbent område %s");
        da("; %d empty cells to know %s.", "; %d tomme felter at kende %s.");
        da("Base value for a number you can see directly.", "Grundtal for et tal, der ses direkte.");
        da("Memory. Nothing needs to be remembered.", "Hukommelse. Intet skal huskes.");
        da("Memory. %d things must be kept in mind at once.", "Hukommelse. %d ting skal holdes i hovedet på samme tid.");
        da("Length. The reasoning has %d links.", "Længde. Ræsonnementet har %d led.");
        da("Along the way. The assumption needs harder techniques along the way.", "Undervejs. Antagelsen kræver sværere teknikker undervejs.");
        da("Overview. There was only one place to make progress.", "Overblik. Der var kun ét sted at komme videre.");
        da("Overview. There were only %d places to make progress.", "Overblik. Der var kun %d steder at komme videre.");
        da("Early. The heavy step comes while the board is still open.", "Tidligt. Det tunge skridt kommer, mens pladen stadig er åben.");
        da("Peak: the heaviest step on its own.", "Top: det tungeste skridt alene.");
        da("Load %d of 10. It is the only step that needs more than a direct number.", "Mængde %d af 10. Det er det eneste skridt, der kræver mere end et direkte tal.");
        da("Load %d of 10. %d steps need more than a direct number.", "Mængde %d af 10. %d skridt kræver mere end et direkte tal.");
        da("%d givens", "%d givne");
        // puzzle codes (SuguruCode)
        da("The code should look like this: SU1-6X6-...", "Koden skal se sådan ud: SU1-6X6-...");
        da("The size in the code does not make sense.", "Størrelsen i koden giver ikke mening.");
        da("Unknown character in the code: %s", "Ukendt tegn i koden: %s");
        da("The code is too short. Is a part missing?", "Koden er for kort. Mangler der et stykke?");
        da("The code is too long or has a typo.", "Koden er for lang eller har en tastefejl.");
        da("The check does not match. There is probably a typo in the code.", "Kontrollen passer ikke. Der er sandsynligvis en tastefejl i koden.");
        da("The code gives a region with more than 6 cells.", "Koden giver en region med mere end 6 felter.");
        da("The code has a number larger than its region.", "Koden har et tal, der er større end sin region.");
        da("The code gives a puzzle with no solution.", "Koden giver en opgave uden løsning.");
        da("The code gives a puzzle with more than one solution.", "Koden giver en opgave med mere end én løsning.");
        // the booklet (SuguruBook)
        da("--technique must be 1-12 or 14", "--teknik skal være 1-12 eller 14");
        da("--max must be 4, 5 or 6", "--maks skal være 4, 5 eller 6");
        da("Regions of at most 4 cells can only be made up to 7x7", "Regioner på højst 4 felter kan kun laves op til 7x7");
        da("--per-page must be 1, 2 or 4", "--pr-side skal være 1, 2 eller 4");
        da("Code %d/%d: %s%n", "Kode %d/%d: %s%n");
        da("Skipping %s: %s", "Springer over %s: %s");
        da("No valid codes.", "Ingen gyldige koder.");
        da("  (wanted grade %d, nearest used)", "  (ønsket grad %d, nærmeste brugt)");
        da("Puzzle %d/%d: %s · %.1f s%s%n", "Opgave %d/%d: %s · %.1f s%s%n");
        da("Saved: %s", "Gemt: %s");
        da("Open the file in Chrome and choose Print → Save as PDF (A4, without headers and footers).", "Åbn filen i Chrome og vælg Udskriv → Gem som PDF (A4, uden sidehoved/-fod).");
        da("Unknown argument: %s", "Ukendt argument: %s");
        da("Missing value for --%s", "Mangler værdi til --%s");
        da("Difficulty must be 1-9: %d", "Sværhedsgrad skal være 1-9: %d");
        da("Could not find Chrome/Chromium. Set the environment variable CHROME to the program's path, or print the HTML file from Chrome.",
            "Fandt ikke Chrome/Chromium. Sæt miljøvariablen CHROME til programmets sti, eller udskriv HTML-filen fra Chrome.");
        da("Why%s?", "Hvorfor%s?");
        da("Techniques:", "Teknikker:");
        da("%d×%d · regions up to %d · %d givens%s", "%d×%d · regioner op til %d · %d givne%s");
        da("Code for hints:", "Kode til hints:");
        da("%d puzzles · %s · regions up to %d · %s", "%d opgaver · %s · regioner op til %d · %s");
        da("mixed sizes", "blandede størrelser");
        da("<b>Rules.</b> Each region of n cells must contain the numbers 1 to n. Equal numbers may not touch, not even diagonally.",
            "<b>Regler.</b> Hver region med n felter skal have tallene 1 til n. Ens tal må ikke røre hinanden, heller ikke diagonalt.");
        da("<b>Hints.</b> Each puzzle has a code (SU1-…). Type it in the field “Do you have a puzzle code?” in the Suguru game, and you can play the puzzle with step-by-step hints.",
            "<b>Hints.</b> Hver opgave har en kode (SU1-…). Skriv den i feltet »Har du en kode?« i Suguru-spillet, så kan du spille opgaven med trinvise hints.");
        da("No.", "Nr.");
        da("Difficulty", "Sværhed");
        da("Peak, load and technique", "Top, mængde og teknik");
        da("Givens", "Givne");
        da("How to read the difficulty", "Sådan læses sværhedsgraden");
        da("The number measures <b>effort</b>, not which technique is used. "
            + "It is <b>peak</b>, the effort in the puzzle's heaviest step, plus an addition of at most 1.0 for <b>load</b>, how many heavy steps there are (1-10). "
            + "A step's effort is the sum of <b>recognition</b> (how hard the pattern is to spot), <b>memory</b> (how many things must be kept in mind at once), "
            + "<b>length</b> (the number of links in the reasoning) and <b>overview</b> (how few places there were to make progress). Each puzzle shows the sum line by line.",
            "Tallet måler <b>indsats</b>, ikke hvilken teknik der bruges. "
            + "Det er <b>top</b>, indsatsen i opgavens tungeste skridt, plus et tillæg på højst 1,0 for <b>mængde</b>, hvor mange tunge skridt der er (1-10). "
            + "Et skridts indsats er summen af <b>genkendelse</b> (hvor svært mønstret er at få øje på), <b>hukommelse</b> (hvor mange ting der skal holdes i hovedet på samme tid), "
            + "<b>længde</b> (antal led i ræsonnementet) og <b>overblik</b> (hvor få steder der var at komme videre). Ved hver opgave står regnestykket linje for linje.");
        da("Solutions", "Løsninger");
    }

    private SuguruText() {}
}
