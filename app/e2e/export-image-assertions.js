const fs = require("fs");
const { execFileSync } = require("child_process");
const { expect } = require("@playwright/test");

function runPythonInline(script, scriptArgs = []) {
  const candidates =
    process.platform === "win32"
      ? [
          { cmd: "py", args: ["-3", "-c", script, ...scriptArgs] },
          { cmd: "python", args: ["-c", script, ...scriptArgs] },
          { cmd: "python3", args: ["-c", script, ...scriptArgs] }
        ]
      : [
          { cmd: "python", args: ["-c", script, ...scriptArgs] },
          { cmd: "python3", args: ["-c", script, ...scriptArgs] }
        ];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return execFileSync(candidate.cmd, candidate.args, { encoding: "utf8" });
    } catch (error) {
      lastError = error;
      if (error?.code === "ENOENT" || error?.status === 127) continue;
      throw error;
    }
  }
  throw lastError || new Error("Python introuvable (python / python3 / py -3).");
}

function extractPdfTextFirstPage(pdfPath) {
  const script =
    "import sys; from pypdf import PdfReader; r=PdfReader(sys.argv[1]); print((r.pages[0].extract_text() or '').replace(chr(10),' '))";
  return runPythonInline(script, [pdfPath]).trim();
}

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

function extractPdfTextAllPages(pdfPath) {
  const script =
    "import sys; from pypdf import PdfReader; r=PdfReader(sys.argv[1]); print(' '.join((p.extract_text() or '').replace(chr(10),' ') for p in r.pages))";
  return runPythonInline(script, [pdfPath]).trim();
}

function assertPdfContainsTextAnywhere(pdfPath, text) {
  const needle = String(text || "");
  const buf = fs.readFileSync(pdfPath);
  if (buf.includes(Buffer.from(needle))) return;
  const extracted = extractPdfTextAllPages(pdfPath);
  expect(extracted).toContain(needle);
}

function assertPdfContainsText(pdfPath, text) {
  const needle = String(text || "");
  const buf = fs.readFileSync(pdfPath);
  if (buf.includes(Buffer.from(needle))) return;
  const extracted = extractPdfTextFirstPage(pdfPath);
  expect(extracted).toContain(needle);
}

function assertPdfUsesBaseFont(pdfPath, fontName) {
  const raw = fs.readFileSync(pdfPath).toString("latin1");
  const escaped = String(fontName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(raw).toMatch(new RegExp(`/BaseFont\\s*/${escaped}(?:\\s|$)`));
}

function assertPdfHasFontSizeTf(pdfPath, sizePt) {
  const raw = fs.readFileSync(pdfPath).toString("latin1");
  const n = Number(sizePt);
  expect(raw).toMatch(new RegExp(`\\b${n}(?:\\.\\d+)?\\s+Tf\\b`));
}

module.exports = {
  countBufferOccurrences,
  assertPdfHasEmbeddedImageXObjects,
  assertPdfContainsText,
  assertPdfContainsTextAnywhere,
  assertPdfUsesBaseFont,
  assertPdfHasFontSizeTf,
  extractPdfTextFirstPage
};
