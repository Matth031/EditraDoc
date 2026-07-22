/**
 * Contrats P1 — pdf:read-bytes : golden + invalid (Node / Ajv).
 * Pas de route Python pour ce canal.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  validatePdfReadBytesRequestContract,
  normalizePdfReadBytesArg
} = require("../src/contracts/dist/validate");
const { PdfReadBytesRequestSchema } = require("../src/contracts/dist/pdf-read-bytes");

const schemaPath = path.join(__dirname, "../src/contracts/schemas/pdf-read-bytes.request.json");

describe("P1 contracts pdf:read-bytes", () => {
  it("golden : string path normalisée et acceptée", () => {
    const r = validatePdfReadBytesRequestContract("C:\\docs\\a.pdf");
    assert.equal(r.ok, true);
    assert.equal(r.value.path, "C:\\docs\\a.pdf");
  });

  it("golden : objet { path } accepté", () => {
    const r = validatePdfReadBytesRequestContract({ path: "/tmp/a.pdf" });
    assert.equal(r.ok, true);
    assert.equal(r.value.path, "/tmp/a.pdf");
  });

  it("invalide : path vide rejeté", () => {
    const r = validatePdfReadBytesRequestContract({ path: "" });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("invalide : path number rejeté", () => {
    const r = validatePdfReadBytesRequestContract({ path: 42 });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("invalide : objet sans path rejeté", () => {
    const r = validatePdfReadBytesRequestContract({ file: "x.pdf" });
    assert.equal(r.ok, false);
  });

  it("invalide : null rejeté", () => {
    const r = validatePdfReadBytesRequestContract(null);
    assert.equal(r.ok, false);
  });

  it("normalize : string → { path }", () => {
    assert.deepEqual(normalizePdfReadBytesArg("a.pdf"), { path: "a.pdf" });
  });

  it("artefact JSON Schema commité aligné sur le module TS", () => {
    assert.ok(fs.existsSync(schemaPath));
    const fromDisk = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    assert.equal(fromDisk.$id, PdfReadBytesRequestSchema.$id);
    assert.deepEqual(fromDisk.required, ["path"]);
  });
});
