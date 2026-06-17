const { test } = require("node:test");
const assert = require("node:assert/strict");
const { toConversionError } = require("../src/main/lib/html-to-pdf.js");

test("toConversionError : timeout chargement", () => {
  const r = toConversionError(new Error("HTML_LOAD_TIMEOUT"));
  assert.equal(r.ok, false);
  assert.match(r.error, /15 s/);
});

test("toConversionError : erreur générique", () => {
  const r = toConversionError(new Error("print failed"));
  assert.equal(r.ok, false);
  assert.equal(r.error, "Échec de la conversion HTML vers PDF.");
});
