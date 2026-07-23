const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");
const {
  formatLogLine,
  shouldLogLevel,
  isExportAuditEnabled,
  sanitizeExportAuditData
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

let logFilePath = null;

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

/**
 * @param {string} level
 * @param {string} scope
 * @param {string} message
 * @param {unknown} [data]
 */
function appendLog(level, scope, message, data) {
  if (!shouldLogLevel(level, VERBOSE, scope)) return;
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
 * Journal diagnostic export (activé par défaut ; désactiver via EDITRADOC_EXPORT_AUDIT=0).
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
    exportAudit: isExportAuditEnabledEffective(),
    platform: process.platform,
    arch: process.arch
  });
}

module.exports = {
  getInstallRoot,
  getLogFilePath,
  isExportAuditEnabledEffective,
  resetLogFileCache,
  reloadLogConfiguration,
  log,
  logError,
  logWarn,
  logInfo,
  logDebug,
  logExportAudit,
  logStartupBanner
};
