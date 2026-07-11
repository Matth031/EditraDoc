const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const {
  registerOpenPdfPath,
  unregisterOpenPdfPath,
  syncOpenPdfPaths,
  isOpenPdfPath,
  normalizeOpenPdfPath,
  resetOpenPdfPathsForTests
} = require("../src/main/lib/open-pdf-registry");
const {
  hasPdfExtension,
  validatePdfReadBytesRequest,
  MAX_PDF_READ_BYTES,
  ERROR_CODES
} = require("../src/main/lib/pdf-read-bytes-guard");

test("hasPdfExtension : .pdf insensible à la casse", () => {
  assert.equal(hasPdfExtension("/a/doc.pdf"), true);
  assert.equal(hasPdfExtension("/a/doc.PDF"), true);
  assert.equal(hasPdfExtension("/a/doc.txt"), false);
});

test("open-pdf-registry : register + unregister + sync + isOpenPdfPath", () => {
  resetOpenPdfPathsForTests();
  const dir = os.tmpdir();
  const p = path.join(dir, "open.pdf");
  registerOpenPdfPath(p);
  assert.equal(isOpenPdfPath(p), true);
  assert.equal(isOpenPdfPath(path.join(dir, "other.pdf")), false);
  unregisterOpenPdfPath(p);
  assert.equal(isOpenPdfPath(p), false);
  syncOpenPdfPaths([path.join(dir, "b.pdf")]);
  assert.equal(isOpenPdfPath(p), false);
  assert.equal(isOpenPdfPath(path.join(dir, "b.pdf")), true);
  resetOpenPdfPathsForTests();
});

test("normalizeOpenPdfPath : Windows insensible à la casse", () => {
  if (process.platform !== "win32") return;
  const a = normalizeOpenPdfPath("C:\\Temp\\Doc.PDF");
  const b = normalizeOpenPdfPath("c:/temp/doc.pdf");
  assert.equal(a, b);
});

test("validatePdfReadBytesRequest : chemin non ouvert -> refus", () => {
  const result = validatePdfReadBytesRequest("C:\\docs\\secret.pdf", {
    exists: true,
    fileSize: 100,
    isOpenPath: false
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.PDF_READ_NOT_OPEN);
});

test("validatePdfReadBytesRequest : extension invalide -> refus", () => {
  const result = validatePdfReadBytesRequest("C:\\docs\\readme.txt", {
    exists: true,
    fileSize: 100,
    isOpenPath: true
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.PDF_READ_NOT_PDF);
});

test("validatePdfReadBytesRequest : fichier > 200 Mo -> refus", () => {
  const result = validatePdfReadBytesRequest("C:\\docs\\big.pdf", {
    exists: true,
    fileSize: MAX_PDF_READ_BYTES + 1,
    isOpenPath: true
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.PDF_READ_TOO_LARGE);
});

test("validatePdfReadBytesRequest : chemin ouvert et taille OK -> autorisé", () => {
  const result = validatePdfReadBytesRequest("C:\\docs\\ok.pdf", {
    exists: true,
    fileSize: 4096,
    isOpenPath: true
  });
  assert.equal(result.ok, true);
});
