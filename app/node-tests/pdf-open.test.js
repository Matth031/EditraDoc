/**
 * Lot A — cas limites evaluatePdfOpen (complétude couverture).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { evaluatePdfOpen } = require("../src/main/lib/pdf-open");

test("evaluatePdfOpen : fichier absent (exists false)", () => {
  const result = evaluatePdfOpen("C:\\docs\\missing.pdf", {
    exists: false,
    fileSize: 100,
    validation: { ok: true }
  });
  assert.deepEqual(result, {
    ok: false,
    error: "Le fichier PDF n'existe pas."
  });
});

test("evaluatePdfOpen : chemin vide / falsy", () => {
  const result = evaluatePdfOpen("", {
    exists: true,
    fileSize: 100,
    validation: { ok: true }
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "Le fichier PDF n'existe pas.");
});

test("evaluatePdfOpen : taille 0 (vide ou corrompu)", () => {
  const result = evaluatePdfOpen("C:\\docs\\empty.pdf", {
    exists: true,
    fileSize: 0,
    validation: { ok: true }
  });
  assert.deepEqual(result, {
    ok: false,
    error: "Le fichier PDF est vide ou corrompu."
  });
});

test("evaluatePdfOpen : validation KO sans détail → fallback message générique", () => {
  const result = evaluatePdfOpen("C:\\docs\\a.pdf", {
    exists: true,
    fileSize: 128,
    validation: { ok: false }
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "Validation PDF échouée.");
  assert.equal(result.errorCode, undefined);
});

test("evaluatePdfOpen : validation KO avec error + errorCode", () => {
  const result = evaluatePdfOpen("C:\\docs\\a.pdf", {
    exists: true,
    fileSize: 128,
    validation: {
      ok: false,
      error: "PDF invalide",
      errorCode: "INVALID_PDF"
    }
  });
  assert.deepEqual(result, {
    ok: false,
    error: "PDF invalide",
    errorCode: "INVALID_PDF"
  });
});
