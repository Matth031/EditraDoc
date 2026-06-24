const fs = require("fs");
const { expect } = require("@playwright/test");

function countBufferOccurrences(buf, needle) {
  let n = 0;
  let i = 0;
  while (true) {
    const j = buf.indexOf(needle, i);
    if (j === -1) break;
    n += 1;
    i = j + needle.length;
  }
  return n;
}

/** Détecte les XObject image (ReportLab n’embarque pas forcément le chunk binaire « IHDR »). */
function assertPdfHasEmbeddedImageXObjects(pdfPath, minCount = 1) {
  const buf = fs.readFileSync(pdfPath);
  const marker = Buffer.from("/Subtype /Image");
  const n = countBufferOccurrences(buf, marker);
  expect(n, "au moins une ressource /Subtype /Image").toBeGreaterThanOrEqual(minCount);
}

module.exports = {
  countBufferOccurrences,
  assertPdfHasEmbeddedImageXObjects
};
