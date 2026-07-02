const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");
const { formatLogLine, shouldLogLevel } = require("../lib/app-log-core");
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
function getLogFilePath() {
  if (process.env.EDITRADOC_LOG_PATH) return process.env.EDITRADOC_LOG_PATH;
  if (process.env.MANI_PDF_LOG_PATH) return process.env.MANI_PDF_LOG_PATH;
  try {
    const custom = getAppSettings().getCustomLogFilePath();
    if (custom) return custom;
  } catch {
    /* ignore avant app ready */
  }
  return path.join(getInstallRoot(), "logs.txt");
}

function resetLogFileCache() {
  logFilePath = null;
}

function reloadLogConfiguration() {
  try {
    getAppSettings().loadSettings(true);
  } catch {
    /* ignore */
  }
  resetLogFileCache();
}

function ensureLogFile() {
  if (!logFilePath) {
    logFilePath = getLogFilePath();
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    if (!fs.existsSync(logFilePath)) {
      fs.writeFileSync(
        logFilePath,
        `${formatLogLine({
          level: "info",
          scope: "app",
          message: "Journal EditraDoc initialisé",
          data: { path: logFilePath },
          pid: process.pid
        })}\n`,
        "utf8"
      );
    }
  }
  return logFilePath;
}

function rotateIfNeeded(filePath) {
  try {
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
    /* ignore */
  }
}

/**
 * @param {string} level
 * @param {string} scope
 * @param {string} message
 * @param {unknown} [data]
 */
function appendLog(level, scope, message, data) {
  if (!shouldLogLevel(level, VERBOSE)) return;
  const line = formatLogLine({
    level,
    scope,
    message,
    data,
    pid: process.pid
  });
  try {
    const filePath = ensureLogFile();
    rotateIfNeeded(filePath);
    fs.appendFileSync(filePath, `${line}\n`, "utf8");
  } catch {
    /* ignore */
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
      /* ignore */
    }
  }
  logInfo("app", "Démarrage EditraDoc", {
    version,
    packaged: app.isPackaged,
    installRoot: getInstallRoot(),
    logFile: getLogFilePath(),
    platform: process.platform,
    arch: process.arch
  });
}

module.exports = {
  getInstallRoot,
  getLogFilePath,
  resetLogFileCache,
  reloadLogConfiguration,
  log,
  logError,
  logWarn,
  logInfo,
  logDebug,
  logStartupBanner
};
