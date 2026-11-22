// Compresses the statistics archive in the background (see writeArchive in core.js)
importScripts("lz.js");
self.onmessage = (e) => self.postMessage(LZ.pack(e.data));
