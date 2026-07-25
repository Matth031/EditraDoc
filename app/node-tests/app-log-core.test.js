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
  sanitizeExportAuditData,
  createEmptyErrorMetricsState,
  bumpErrorMetric,
  shouldEmitThreshold,
  markThresholdEmitted,
  trimErrorMetricsState,
  normalizeMetricMessage,
  countThresholdSessionsForScope,
  ERROR_METRIC_WINDOW_MS,
  ERROR_METRIC_THRESHOLD,
  ERROR_METRIC_MAX_FILE_BYTES
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
  try {
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
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
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

test("normalizeMetricMessage : chemins masqués, pas de textHtml (S19)", () => {
  const out = normalizeMetricMessage(
    `fail C:\\Users\\me\\secret.pdf textHtml=<img src=x onerror=1> ${"x".repeat(200)}`
  );
  assert.equal(out, "[contenu-refuse]");
  const pathOnly = normalizeMetricMessage("Impossible d'ouvrir C:\\Users\\me\\docs\\a.pdf");
  assert.match(pathOnly, /\[chemin\]/);
  assert.doesNotMatch(pathOnly, /Users\\me/);
  assert.ok(pathOnly.length <= 81);
});

test("bumpErrorMetric : compteur + seuil à 5 (pas à 4)", () => {
  let state = createEmptyErrorMetricsState();
  const t0 = Date.UTC(2026, 6, 23, 12, 0, 0);
  for (let i = 0; i < 4; i += 1) {
    const r = bumpErrorMetric(state, {
      level: "error",
      scope: "text:sync",
      message: "sync failed",
      now: t0 + i * 1000
    });
    state = r.state;
    assert.equal(r.shouldEmitThreshold, false);
    assert.equal(r.scopeCount, i + 1);
  }
  const at5 = bumpErrorMetric(state, {
    level: "error",
    scope: "text:sync",
    message: "sync failed",
    now: t0 + 5000
  });
  assert.equal(at5.scopeCount, 5);
  assert.equal(at5.shouldEmitThreshold, true);
  assert.equal(shouldEmitThreshold(at5.entry, { scopeCount: 5, now: t0 + 5000 }), true);
});

test("shouldEmitThreshold : pas de re-émission dans la même fenêtre", () => {
  const t0 = Date.UTC(2026, 6, 23, 12, 0, 0);
  let state = createEmptyErrorMetricsState();
  for (let i = 0; i < 5; i += 1) {
    state = bumpErrorMetric(state, {
      level: "warn",
      scope: "session:load",
      message: "load ko",
      now: t0 + i * 1000
    }).state;
  }
  const hit = bumpErrorMetric(state, {
    level: "warn",
    scope: "session:load",
    message: "load ko",
    now: t0 + 6000
  });
  assert.equal(hit.shouldEmitThreshold, true);
  state = markThresholdEmitted(hit.state, {
    scope: "session:load",
    level: "warn",
    now: t0 + 6000,
    sessionId: "sess-a"
  });
  const again = bumpErrorMetric(state, {
    level: "warn",
    scope: "session:load",
    message: "load ko",
    now: t0 + 7000
  });
  assert.equal(again.shouldEmitThreshold, false);
  assert.equal(countThresholdSessionsForScope(again.state, "session:load"), 1);
});

test("bumpErrorMetric : fenêtre glissante 15 min ignore les vieux hits", () => {
  let state = createEmptyErrorMetricsState();
  const t0 = Date.UTC(2026, 6, 23, 12, 0, 0);
  for (let i = 0; i < 5; i += 1) {
    state = bumpErrorMetric(state, {
      level: "error",
      scope: "i18n:setLanguage",
      message: "lang",
      now: t0 + i * 1000
    }).state;
  }
  const later = bumpErrorMetric(state, {
    level: "error",
    scope: "i18n:setLanguage",
    message: "lang",
    now: t0 + ERROR_METRIC_WINDOW_MS + 60_000
  });
  assert.equal(later.scopeCount, 1);
  assert.equal(later.shouldEmitThreshold, false);
});

test("bumpErrorMetric : ignore export-audit et monitor:threshold (S19 / anti-récursion)", () => {
  const state = createEmptyErrorMetricsState();
  const a = bumpErrorMetric(state, { level: "error", scope: "export-audit", message: "x" });
  assert.equal(a.entry, null);
  const b = bumpErrorMetric(state, { level: "warn", scope: "monitor:threshold", message: "x" });
  assert.equal(b.entry, null);
});

test("trimErrorMetricsState : fichier borné (pas de croissance illimitée)", () => {
  let state = createEmptyErrorMetricsState();
  const t0 = Date.now();
  for (let i = 0; i < 80; i += 1) {
    state = bumpErrorMetric(state, {
      level: "error",
      scope: `scope-${i}`,
      message: `m-${i}-${"pad".repeat(20)}`,
      now: t0 + i,
      maxKeys: 200
    }).state;
  }
  const trimmed = trimErrorMetricsState(state, {
    maxKeys: 30,
    maxFileBytes: 8 * 1024,
    now: t0 + 1000
  });
  assert.ok(Object.keys(trimmed.state.entries).length <= 30);
  assert.ok(trimmed.bytes <= 8 * 1024);
  assert.ok(trimmed.bytes < ERROR_METRIC_MAX_FILE_BYTES);
  assert.equal(ERROR_METRIC_THRESHOLD, 5);
});

/* ——— Lot F : branches S19 / fallbacks / métriques ——— */

test("redactPathForLog : vide, slash seul, un segment", () => {
  assert.equal(redactPathForLog(null), "");
  assert.equal(redactPathForLog("   "), "");
  assert.equal(redactPathForLog("/"), "");
  assert.equal(redactPathForLog("alone.pdf"), "alone.pdf");
});

test("redactTextPreviewForLog : null et chaine vide", () => {
  assert.match(redactTextPreviewForLog(null), /len=0/);
  assert.match(redactTextPreviewForLog(""), /lines=0/);
  assert.match(redactTextPreviewForLog("   "), /words=0/);
});

test("sanitizeExportAuditData : profondeur, null, array, base64, non-objet", () => {
  assert.equal(sanitizeExportAuditData(null), null);
  assert.equal(sanitizeExportAuditData(undefined), undefined);
  const deep = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
  const deepOut = sanitizeExportAuditData(deep);
  assert.equal(deepOut.a.b.c.d.e.f, "[max depth]");
  const arr = sanitizeExportAuditData(["x", { password: "p" }]);
  assert.equal(arr[1].password, "[redacted]");
  const b64 = sanitizeExportAuditData({ base64: "y".repeat(121) });
  assert.match(String(b64.base64), /base64 121/);
  assert.equal(sanitizeExportAuditData(Symbol("x")), "Symbol(x)");
});

test("sanitizeData : string longue, preview keys, base64, profondeur", () => {
  const long = sanitizeData("z".repeat(4001));
  assert.ok(String(long).endsWith("…[truncated]"));
  assert.equal(String(long).length, 4000 + "…[truncated]".length);
  const nested = sanitizeData({
    plain_preview: "secret text",
    input_path: "C:/a/b.pdf",
    base64: "q".repeat(200),
    ok: true
  });
  assert.doesNotMatch(String(nested.plain_preview), /secret/);
  assert.equal(nested.input_path, ".../a/b.pdf");
  assert.match(String(nested.base64), /base64 200/);
  assert.equal(sanitizeData(null), null);
  assert.equal(sanitizeData(42), 42);
});

test("formatLogLine : defaults ts/pid/level/scope + sans data", () => {
  const line = formatLogLine({ level: "", scope: "", message: "" });
  assert.match(line, /\[INFO\]/);
  assert.match(line, /\[app\]/);
  assert.match(line, /\[pid:0\]/);
  assert.doesNotMatch(line, / \| /);
});

test("shouldLogLevel : niveau inconnu tombe sur info (rank)", () => {
  assert.equal(shouldLogLevel("trace", false), false);
  assert.equal(shouldLogLevel("trace", true), true);
});

test("normalizeMetricMessage : troncature pure + null", () => {
  const { ERROR_METRIC_MESSAGE_MAX } = require("../src/lib/app-log-core");
  const long = normalizeMetricMessage("w".repeat(ERROR_METRIC_MESSAGE_MAX + 40));
  assert.ok(long.endsWith("…"));
  assert.equal(long.length, ERROR_METRIC_MESSAGE_MAX + 1);
  assert.equal(normalizeMetricMessage(null), "");
});

test("bumpErrorMetric : ignore info ; defaults level/scope ; state null", () => {
  const r = bumpErrorMetric(null, { level: "info", scope: "save", message: "x" });
  assert.equal(r.entry, null);
  assert.equal(r.shouldEmitThreshold, false);

  const e = bumpErrorMetric(createEmptyErrorMetricsState(), {
    message: "bare",
    now: Date.UTC(2026, 6, 25, 12, 0, 0)
  });
  assert.equal(e.key, "error|app");
  assert.ok(e.entry);
});

test("bumpErrorMetric : maxKeys purge les plus anciens", () => {
  let state = createEmptyErrorMetricsState();
  const t0 = Date.UTC(2026, 6, 25, 10, 0, 0);
  for (let i = 0; i < 5; i += 1) {
    state = bumpErrorMetric(state, {
      level: "error",
      scope: `k-${i}`,
      message: `m${i}`,
      now: t0 + i * 1000,
      maxKeys: 3
    }).state;
  }
  assert.ok(Object.keys(state.entries).length <= 3);
  assert.equal(state.entries["error|k-0"], undefined);
});

test("bumpErrorMetric : reset thresholdEmittedAt hors fenêtre", () => {
  const t0 = Date.UTC(2026, 6, 25, 8, 0, 0);
  let state = createEmptyErrorMetricsState();
  for (let i = 0; i < 5; i += 1) {
    state = bumpErrorMetric(state, {
      level: "error",
      scope: "reset-win",
      message: "x",
      now: t0 + i * 1000
    }).state;
  }
  state = markThresholdEmitted(state, {
    scope: "reset-win",
    level: "error",
    now: t0 + 5000,
    sessionId: "s1"
  });
  const later = bumpErrorMetric(state, {
    level: "error",
    scope: "reset-win",
    message: "x",
    now: t0 + ERROR_METRIC_WINDOW_MS + 10_000
  });
  assert.equal(later.entry.thresholdEmittedAt, null);
  assert.equal(later.scopeCount, 1);
});

test("markThresholdEmitted : defaults + sessionId vide", () => {
  let state = createEmptyErrorMetricsState();
  state = bumpErrorMetric(state, {
    level: "error",
    scope: "app",
    message: "x",
    now: 1000
  }).state;
  const next = markThresholdEmitted(state, {});
  assert.ok(next.entries["error|app"].thresholdEmittedAt);
  assert.deepEqual(next.thresholdSessions, {});
});

test("shouldEmitThreshold : sans scopeCount utilise timestamps / count", () => {
  const now = Date.UTC(2026, 6, 25, 12, 0, 0);
  assert.equal(
    shouldEmitThreshold(
      { timestamps: [now, now + 1, now + 2, now + 3, now + 4], thresholdEmittedAt: null },
      { now: now + 4 }
    ),
    true
  );
  assert.equal(
    shouldEmitThreshold({ count: 5, timestamps: null }, { now, scopeCount: undefined }),
    true
  );
  assert.equal(shouldEmitThreshold({ count: 2 }, { now }), false);
});

test("trimErrorMetricsState : defaults limits + entry null + prune sessions", () => {
  const now = Date.UTC(2026, 6, 25, 15, 0, 0);
  /** @type {any} */
  const dirty = createEmptyErrorMetricsState();
  dirty.entries.gone = null;
  dirty.entries.stale = {
    level: "error",
    scope: "old",
    lastAt: new Date(now - ERROR_METRIC_WINDOW_MS * 5).toISOString(),
    timestamps: [],
    messageNorm: "x",
    count: 0
  };
  dirty.thresholdSessions = { a: ["1"], b: ["2"] };
  const trimmed = trimErrorMetricsState(dirty, {
    maxFileBytes: 120,
    now
  });
  assert.equal(trimmed.state.entries.gone, undefined);
  assert.equal(trimmed.state.entries.stale, undefined);
  // Forcer la boucle thresholdSessions : state avec sessions volumineuses
  let fat = createEmptyErrorMetricsState();
  fat.thresholdSessions = {
    s1: Array.from({ length: 50 }, (_, i) => `id-${i}`),
    s2: Array.from({ length: 50 }, (_, i) => `id2-${i}`)
  };
  const tiny = trimErrorMetricsState(fat, { maxFileBytes: 80, now, maxKeys: 1 });
  assert.ok(Object.keys(tiny.state.thresholdSessions).length < 2 || tiny.bytes <= 80);
});

test("countThresholdSessionsForScope : liste absente → 0", () => {
  assert.equal(countThresholdSessionsForScope(null, "x"), 0);
  assert.equal(countThresholdSessionsForScope(createEmptyErrorMetricsState(), "missing"), 0);
});
