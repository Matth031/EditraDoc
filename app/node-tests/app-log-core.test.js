const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  sanitizeData,
  shouldLogLevel,
  formatLogLine,
  isExportAuditEnabled,
  redactTextPreviewForLog,
  redactPathForLog,
  sanitizeExportAuditData
} = require("../src/lib/app-log-core");

test("sanitizeData redacte les champs sensibles", () => {
  const out = sanitizeData({ password: "secret", step: "ok" });
  assert.equal(out.password, "[redacted]");
  assert.equal(out.step, "ok");
});

test("isExportAuditEnabled : desactive par defaut (S19 opt-in strict)", () => {
  assert.equal(isExportAuditEnabled({}), false);
  assert.equal(isExportAuditEnabled({ EDITRADOC_EXPORT_AUDIT: "0" }), false);
  assert.equal(isExportAuditEnabled({ EDITRADOC_EXPORT_AUDIT: "1" }), true);
});

test("isExportAuditEnabled : flag absent ou vide = desactive", () => {
  assert.equal(isExportAuditEnabled({ EDITRADOC_EXPORT_AUDIT: undefined }), false);
  assert.equal(isExportAuditEnabled({ EDITRADOC_EXPORT_AUDIT: "" }), false);
});

test("export audit : aucune ecriture Python sans EDITRADOC_EXPORT_AUDIT=1", () => {
  const { spawnSync } = require("node:child_process");
  const pyDir = path.join(__dirname, "..", "python");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-audit-"));
  const logPath = path.join(tmp, "audit-guard.log");
  const script = `
import os, sys
sys.path.insert(0, ${JSON.stringify(pyDir)})
os.environ.pop("EDITRADOC_EXPORT_AUDIT", None)
os.environ["EDITRADOC_LOG_PATH"] = ${JSON.stringify(logPath)}
from pdf_ops import _export_audit_log
_export_audit_log("must_not_write", {"page": 1})
`;
  const py =
    process.platform === "win32"
      ? path.join(__dirname, "..", "bundle-python", "win", "python.exe")
      : "python3";
  const res = spawnSync(py, ["-c", script], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr || res.stdout);
  assert.equal(fs.existsSync(logPath), false);
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

test("shouldLogLevel : export-audit info exige verbose (pas de contournement S19)", () => {
  assert.equal(shouldLogLevel("info", false, "export-audit"), false);
  assert.equal(shouldLogLevel("debug", false, "export-audit"), false);
});

test("shouldLogLevel journalise les scopes operationnels save sans verbose", () => {
  assert.equal(shouldLogLevel("info", false, "save"), true);
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
