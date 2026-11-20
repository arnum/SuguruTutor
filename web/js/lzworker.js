// Komprimerer statistik-arkivet i baggrunden (se writeArchive i core.js)
importScripts("lz.js");
self.onmessage = (e) => self.postMessage(LZ.pack(e.data));
