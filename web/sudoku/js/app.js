// Sudoku: the app's identity. Loaded before everything else (also in the background worker), so the shared code knows which game
// it runs, where the shared files are, and which prefix its data are stored under (separate from Suguru).
const APP = { id: "sudoku", name: "Sudoku", shared: "../shared/js/" };
