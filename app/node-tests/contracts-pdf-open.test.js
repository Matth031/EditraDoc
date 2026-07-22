/**
 * Contrats P1 — pdf:open (Ajv Node) + alignement schéma /validate.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  validatePdfOpenRequestContract,
  validateValidatePdfRequestContract,
  normalizePathArg
} = require("../src/contracts/dist/validate");
const { PdfOpenRequestSchema } = require("../src/contracts/dist/pdf-open");
const { ValidatePdfRequestSchema } = require("../src/contracts/dist/pdf-validate");

const openSchemaPath = path.join(__dirname, "../src/contracts/schemas/pdf-open.request.json");
const validateSchemaPath = path.join(
  __dirname,
  "../src/contracts/schemas/pdf-validate.request.json"
);

describe("P1 contracts pdf:open", () => {
  it("golden : string path normalisée et acceptée", () => {
    const r = validatePdfOpenRequestContract("C:\\docs\\a.pdf");
    assert.equal(r.ok, true);
    assert.equal(r.value.path, "C:\\docs\\a.pdf");
  });

  it("golden : objet { path } accepté", () => {
    const r = validatePdfOpenRequestContract({ path: "/tmp/a.pdf" });
    assert.equal(r.ok, true);
  });

  it("invalide : path vide rejeté (CONTRACT_INVALID)", () => {
    const r = validatePdfOpenRequestContract({ path: "" });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("invalide : path number rejeté", () => {
    const r = validatePdfOpenRequestContract({ path: 42 });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("invalide : null rejeté", () => {
    const r = validatePdfOpenRequestContract(null);
    assert.equal(r.ok, false);
  });

  it("normalizePathArg : string → { path }", () => {
    assert.deepEqual(normalizePathArg("a.pdf"), { path: "a.pdf" });
  });

  it("artefact JSON Schema open aligné", () => {
    const fromDisk = JSON.parse(fs.readFileSync(openSchemaPath, "utf8"));
    assert.equal(fromDisk.$id, PdfOpenRequestSchema.$id);
  });
});

describe("P1 contracts pdf-validate (schéma partagé Node)", () => {
  it("golden : { path } accepté", () => {
    const r = validateValidatePdfRequestContract({ path: "/tmp/a.pdf" });
    assert.equal(r.ok, true);
  });

  it("invalide : path number rejeté", () => {
    const r = validateValidatePdfRequestContract({ path: 42 });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "CONTRACT_INVALID");
  });

  it("artefact JSON Schema validate aligné", () => {
    const fromDisk = JSON.parse(fs.readFileSync(validateSchemaPath, "utf8"));
    assert.equal(fromDisk.$id, ValidatePdfRequestSchema.$id);
    assert.deepEqual(fromDisk.required, ["path"]);
  });
});
