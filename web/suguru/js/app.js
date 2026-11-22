// Suguru: the app's identity. Loaded before everything else (also in the background worker), so the shared code knows which game
// it runs, where the shared files are, and which prefix its data are stored under.
const APP = { id: "suguru", name: "Suguru", version: "2.0", shared: "../shared/js/" };
