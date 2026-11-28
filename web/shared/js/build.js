// The version of both apps: the build, the date of the release and a letter per release that day (2026-11-24c, 2026-11-24d, …).
// Set it here and only here, once per release. Each app's offline storage takes its name from it: the page registers its
// service worker as sw.js?b=<build>, so a new build installs a fresh copy of every file. The settings show it, and it goes
// along in exports and debug notes.
const APP_BUILD = "2026-11-28a";
