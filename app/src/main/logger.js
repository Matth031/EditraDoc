const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");
const {
  formatLogLine,
  shouldLogLevel,
  isExportAuditEnabled,
  sanitizeExportAuditData,
  createEmptyErrorMetricsState,
  bumpErrorMetric,
  markThresholdEmitted,
  trimErrorMetricsState,
  countThresholdSessionsForScope,
  ERROR_METRIC_THRESHOLD
} = require("../lib/app-log-core");
const { getInstallRoot } = require("./install-path");

let appSettings = null;
function getAppSettings() {
  if (!appSettings) {
    appSettings = require("./app-settings");
  }
  return appSettings;
}

const VERBOSE = process.env.MANI_PDF_LOG_VERBOSE === "1";
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const METRICS_FLUSH_MS = 30 * 1000;
const METRICS_SESSION_ID = `${Date.now()}-${process.pid}`;

let logFilePath = null;
/** @type {ReturnType<typeof createEmptyErrorMetricsState>} */
let errorMetricsState = createEmptyErrorMetricsState();
let errorMetricsDirty = false;
/** @type {ReturnType<typeof setTimeout> | null} */
let errorMetricsFlushTimer = null;
let errorMetricsLoaded = false;

function canWriteToDirectory(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    const probe = path.join(dirPath, `.editradoc-log-probe-${process.pid}`);
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function getUserDataLogFilePath() {
  try {
    return path.join(app.getPath("userData"), "logs.txt");
  } catch {
    return null;
  }
}

function getLogFilePath() {
  if (process.env.EDITRADOC_LOG_PATH) return process.env.EDITRADOC_LOG_PATH;
  if (process.env.MANI_PDF_LOG_PATH) return process.env.MANI_PDF_LOG_PATH;
  try {
    const custom = getAppSettings().getCustomLogFilePath();
    if (custom) return custom;
  } catch {
    /* intentional: settings before app ready best-effort */
  }
  const installLog = path.join(getInstallRoot(), "logs.txt");
  if (canWriteToDirectory(path.dirname(installLog))) return installLog;
  const userDataLog = getUserDataLogFilePath();
  if (userDataLog && canWriteToDirectory(path.dirname(userDataLog))) return userDataLog;
  return userDataLog || installLog;
}

function getErrorMetricsPath() {
  if (process.env.EDITRADOC_ERROR_METRICS_PATH) return process.env.EDITRADOC_ERROR_METRICS_PATH;
  return path.join(path.dirname(getLogFilePath()), "error-metrics.json");
}

function isExportAuditEnabledEffective() {
  return isExportAuditEnabled(process.env);
}

function resetLogFileCache() {
  logFilePath = null;
}

function reloadLogConfiguration() {
  try {
    getAppSettings().loadSettings(true);
  } catch {
    /* intentional: reload log settings best-effort */
  }
  resetLogFileCache();
}

function writeLineToFile(filePath, line) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  rotateIfNeeded(filePath);
  fs.appendFileSync(filePath, `${line}\n`, "utf8");
}

function ensureLogFile() {
  if (!logFilePath) {
    logFilePath = getLogFilePath();
    if (!fs.existsSync(logFilePath)) {
      writeLineToFile(
        logFilePath,
        formatLogLine({
          level: "info",
          scope: "app",
          message: "Journal EditraDoc initialisé",
          data: { path: logFilePath },
          pid: process.pid
        })
      );
    }
  }
  return logFilePath;
}

function rotateIfNeeded(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.size <= MAX_LOG_BYTES) return;
    const rotated = `${filePath}.1`;
    if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
    fs.renameSync(filePath, rotated);
    fs.writeFileSync(
      filePath,
      `${formatLogLine({
        level: "info",
        scope: "app",
        message: "Rotation du journal (fichier précédent archivé en logs.txt.1)",
        pid: process.pid
      })}\n`,
      "utf8"
    );
  } catch {
    /* intentional: log rotation best-effort */
  }
}

function appendLineWithFallback(line) {
  try {
    const filePath = ensureLogFile();
    writeLineToFile(filePath, line);
    return filePath;
  } catch {
    logFilePath = null;
    const fallback = getUserDataLogFilePath();
    if (!fallback) throw new Error("no_log_path");
    logFilePath = fallback;
    writeLineToFile(fallback, line);
    return fallback;
  }
}

function atomicWriteJson(filePath, json) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, json, "utf8");
  fs.renameSync(tmp, filePath);
}

function loadErrorMetricsState() {
  if (errorMetricsLoaded) return;
  errorMetricsLoaded = true;
  try {
    const metricsPath = getErrorMetricsPath();
    if (!fs.existsSync(metricsPath)) {
      errorMetricsState = createEmptyErrorMetricsState();
      return;
    }
    const raw = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
    if (!raw || typeof raw !== "object") {
      errorMetricsState = createEmptyErrorMetricsState();
      return;
    }
    errorMetricsState = {
      version: 1,
      updatedAt: raw.updatedAt || null,
      entries: raw.entries && typeof raw.entries === "object" ? raw.entries : Object.create(null),
      thresholdSessions:
        raw.thresholdSessions && typeof raw.thresholdSessions === "object"
          ? raw.thresholdSessions
          : Object.create(null)
    };
    const trimmed = trimErrorMetricsState(errorMetricsState);
    errorMetricsState = trimmed.state;
  } catch {
    errorMetricsState = createEmptyErrorMetricsState();
  }
}

function flushErrorMetricsSync() {
  try {
    loadErrorMetricsState();
    const trimmed = trimErrorMetricsState(errorMetricsState);
    errorMetricsState = trimmed.state;
    atomicWriteJson(getErrorMetricsPath(), trimmed.json);
    errorMetricsDirty = false;
  } catch {
    /* intentional: metrics flush must never throw */
  }
}

function scheduleErrorMetricsFlush() {
  if (errorMetricsFlushTimer != null) return;
  errorMetricsFlushTimer = setTimeout(() => {
    errorMetricsFlushTimer = null;
    if (errorMetricsDirty) flushErrorMetricsSync();
  }, METRICS_FLUSH_MS);
  if (typeof errorMetricsFlushTimer.unref === "function") {
    errorMetricsFlushTimer.unref();
  }
}

/**
 * Incrémente les compteurs locaux (E4) — appelé depuis appendLog (pipeline unique).
 * @param {string} level
 * @param {string} scope
 * @param {string} message
 */
function recordErrorMetric(level, scope, message) {
  try {
    loadErrorMetricsState();
    const bumped = bumpErrorMetric(errorMetricsState, {
      level,
      scope,
      message,
      sessionId: METRICS_SESSION_ID
    });
    errorMetricsState = bumped.state;
    errorMetricsDirty = true;
    scheduleErrorMetricsFlush();

    if (bumped.shouldEmitThreshold && bumped.entry) {
      errorMetricsState = markThresholdEmitted(errorMetricsState, {
        scope: bumped.entry.scope,
        level: bumped.entry.level,
        sessionId: METRICS_SESSION_ID
      });
      errorMetricsDirty = true;
      const sessions = countThresholdSessionsForScope(errorMetricsState, bumped.entry.scope);
      // Écriture directe pour éviter la re-entrée métriques (scope monitor:threshold ignoré).
      const line = formatLogLine({
        level: "warn",
        scope: "monitor:threshold",
        message: `Seuil soft atteint (≥${ERROR_METRIC_THRESHOLD} / 15 min) pour scope=${bumped.entry.scope}`,
        data: {
          scope: bumped.entry.scope,
          level: bumped.entry.level,
          count: bumped.scopeCount,
          messageHash: bumped.entry.messageHash,
          thresholdSessions: sessions
        },
        pid: process.pid
      });
      try {
        appendLineWithFallback(line);
      } catch {
        /* intentional: threshold log must never throw */
      }
      console.warn(line);
      flushErrorMetricsSync();
    }
  } catch {
    /* intentional: metrics recording must never throw */
  }
}

/**
 * @param {string} level
 * @param {string} scope
 * @param {string} message
 * @param {unknown} [data]
 */
function appendLog(level, scope, message, data) {
  if (!shouldLogLevel(level, VERBOSE, scope)) return;
  if (level === "error" || level === "warn") {
    recordErrorMetric(level, scope, message);
  }
  const line = formatLogLine({
    level,
    scope,
    message,
    data,
    pid: process.pid
  });
  try {
    appendLineWithFallback(line);
  } catch {
    /* intentional: logger append must never throw */
  }
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (VERBOSE) {
    console.log(line);
  }
}

function logError(scope, message, data) {
  appendLog("error", scope, message, data);
}

function logWarn(scope, message, data) {
  appendLog("warn", scope, message, data);
}

function logInfo(scope, message, data) {
  appendLog("info", scope, message, data);
}

function logDebug(scope, message, data) {
  appendLog("debug", scope, message, data);
}

/**
 * Journal diagnostic export (S19 opt-in strict via EDITRADOC_EXPORT_AUDIT=1).
 * @param {string} scope
 * @param {string} message
 * @param {unknown} [data]
 */
function logExportAudit(scope, message, data) {
  if (!isExportAuditEnabledEffective()) return;
  const safeData = data == null ? null : sanitizeExportAuditData(data);
  const line = formatLogLine({
    level: "debug",
    scope: scope || "export-audit",
    message,
    data: safeData,
    pid: process.pid
  });
  try {
    appendLineWithFallback(line);
  } catch {
    /* intentional: export-audit append must never throw */
  }
  if (VERBOSE) {
    console.log(line);
  }
}

/** Compatibilité historique : niveau info (verbose uniquement sauf erreurs explicites). */
function log(scope, message, data) {
  logInfo(scope, message, data);
}

function logStartupBanner() {
  let version = "unknown";
  try {
    const pkg = require(path.join(getInstallRoot(), "app", "package.json"));
    version = pkg.version || version;
  } catch {
    try {
      version = require(path.join(app.getAppPath(), "package.json")).version || version;
    } catch {
      /* intentional: package.json version fallback best-effort */
    }
  }
  logInfo("app", "Démarrage EditraDoc", {
    version,
    packaged: app.isPackaged,
    installRoot: getInstallRoot(),
    logFile: getLogFilePath(),
    errorMetrics: getErrorMetricsPath(),
    exportAudit: isExportAuditEnabledEffective(),
    platform: process.platform,
    arch: process.arch
  });
}

module.exports = {
  getInstallRoot,
  getLogFilePath,
  getErrorMetricsPath,
  isExportAuditEnabledEffective,
  resetLogFileCache,
  reloadLogConfiguration,
  flushErrorMetricsSync,
  log,
  logError,
  logWarn,
  logInfo,
  logDebug,
  logExportAudit,
  logStartupBanner
};
