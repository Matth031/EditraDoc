const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeAndValidateLogFilePath } = require("../src/lib/log-path-validation");
const path = require("node:path");

test("normalizeAndValidateLogFilePath ajoute .txt si extension absente", () => {
  const out = normalizeAndValidateLogFilePath("C:\\logs\\journal");
  assert.equal(out.ok, true);
  assert.equal(out.path, path.resolve("C:\\logs\\journal.txt"));
});

test("normalizeAndValidateLogFilePath rejette extension invalide", () => {
  const out = normalizeAndValidateLogFilePath("C:\\logs\\journal.pdf");
  assert.equal(out.ok, false);
});
