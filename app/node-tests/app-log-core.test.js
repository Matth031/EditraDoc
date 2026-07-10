const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeData, shouldLogLevel, formatLogLine, isExportAuditEnabled, redactTextPreviewForLog, redactPathForLog, sanitizeExportAuditData } = require("../src/lib/app-log-core");

test("sanitizeData redacte les champs sensibles", () => {
  const out = sanitizeData({ password: "secret", step: "ok" });
  assert.equal(out.password, "[redacted]");
  assert.equal(out.step, "ok");
});

test("isExportAuditEnabled : active par defaut", () => {
  assert.equal(isExportAuditEnabled({}), true);
  assert.equal(isExportAuditEnabled({ EDITRADOC_EXPORT_AUDIT: "0" }), false);
  assert.equal(isExportAuditEnabled({ EDITRADOC_EXPORT_AUDIT: "1" }), true);
  assert.equal(isExportAuditEnabled({}, { exportAuditEnabled: false }), false);
});

test("redactTextPreviewForLog : metadonnees sans contenu lisible", () => {
  const out = redactTextPreviewForLog("Bonjour monde\nligne deux");
  assert.match(out, /len=24/);
  assert.match(out, /lines=2/);
  assert.doesNotMatch(out, /Bonjour/);
});

test("redactPathForLog : dossier parent + fichier", () => {
  assert.equal(redactPathForLog("C:\\Users\\me\\docs\\secret.pdf"), ".../docs/secret.pdf");
});

test("sanitizeExportAuditData : textPreview et chemins", () => {
  const out = sanitizeExportAuditData({
    textPreview: "contenu confidentiel",
    input_path: "C:/data/rapport.pdf",
    annotationCount: 3
  });
  assert.doesNotMatch(String(out.textPreview), /confidentiel/);
  assert.equal(out.input_path, ".../data/rapport.pdf");
  assert.equal(out.annotationCount, 3);
});

test("shouldLogLevel journalise toujours error et warn", () => {
  assert.equal(shouldLogLevel("error", false), true);
  assert.equal(shouldLogLevel("warn", false), true);
  assert.equal(shouldLogLevel("info", false), false);
  assert.equal(shouldLogLevel("info", true), true);
});

test("shouldLogLevel journalise les scopes operationnels sans verbose", () => {
  assert.equal(shouldLogLevel("info", false, "save"), true);
  assert.equal(shouldLogLevel("info", false, "export-audit"), true);
  assert.equal(shouldLogLevel("info", false, "annotation"), true);
  assert.equal(shouldLogLevel("info", false, "renderer"), false);
});

test("formatLogLine produit une ligne lisible", () => {
  const line = formatLogLine({
    level: "error",
    scope: "test",
    message: "boom",
    data: { code: 1 },
    pid: 42,
    ts: "2026-01-01T00:00:00.000Z"
  });
  assert.match(line, /\[ERROR\]/);
  assert.match(line, /\[test\] boom/);
});
