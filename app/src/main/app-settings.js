const fs = require("node:fs");
const { normalizeUpdateSettings } = require("../lib/update-manifest");
const path = require("node:path");
const { app } = require("electron");
const { normalizeAndValidateLogFilePath } = require("../lib/log-path-validation");
const { getInstallRoot } = require("./install-path");

let settingsFilePath = null;
/** @type {{ logFilePath: string | null, checkUpdatesOnStartup: boolean, lastUpdateCheckAt: string | null } | null} */
let cached = null;

function getSettingsFilePath() {
  if (!settingsFilePath) {
    settingsFilePath = path.join(app.getPath("userData"), "app-settings.json");
  }
  return settingsFilePath;
}

/**
 * @param {boolean} [force]
 */
function loadSettings(force = false) {
  if (cached && !force) return cached;
  cached = { logFilePath: null, checkUpdatesOnStartup: false, lastUpdateCheckAt: null };
  try {
    const filePath = getSettingsFilePath();
    if (!fs.existsSync(filePath)) return cached;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (parsed && typeof parsed === "object") {
      const custom = typeof parsed.logFilePath === "string" ? parsed.logFilePath.trim() : "";
      const update = normalizeUpdateSettings(parsed);
      cached.logFilePath = custom || null;
      cached.checkUpdatesOnStartup = update.checkUpdatesOnStartup;
      cached.lastUpdateCheckAt = update.lastUpdateCheckAt;
    }
  } catch {
    cached = { logFilePath: null, checkUpdatesOnStartup: false, lastUpdateCheckAt: null };
  }
  return cached;
}

/**
 * @param {{ logFilePath?: string | null }} patch
 */
function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  cached = next;
  const filePath = getSettingsFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), "utf8");
}

function getCustomLogFilePath() {
  return loadSettings().logFilePath;
}

/**
 * @param {string | null} filePath
 */
function setCustomLogFilePath(filePath) {
  if (filePath == null || filePath === "") {
    saveSettings({ logFilePath: null });
    return { ok: true, path: null };
  }
  const validated = normalizeAndValidateLogFilePath(filePath);
  if (!validated.ok) return validated;
  try {
    fs.mkdirSync(path.dirname(validated.path), { recursive: true });
    fs.accessSync(path.dirname(validated.path), fs.constants.W_OK);
  } catch {
    return { ok: false, error: "Le dossier cible n'est pas accessible en écriture." };
  }
  saveSettings({ logFilePath: validated.path });
  return { ok: true, path: validated.path };
}

function getDefaultLogFilePath() {
  return path.join(getInstallRoot(), "logs.txt");
}

function getEnvLogOverride() {
  return process.env.EDITRADOC_LOG_PATH || process.env.MANI_PDF_LOG_PATH || null;
}

function getLogFileSettingsInfo(getEffectiveLogFilePath) {
  loadSettings();
  const envOverride = getEnvLogOverride();
  const defaultPath = getDefaultLogFilePath();
  const customPath = cached?.logFilePath || null;
  const effectivePath =
    typeof getEffectiveLogFilePath === "function" ? getEffectiveLogFilePath() : defaultPath;
  return {
    ok: true,
    effectivePath,
    defaultPath,
    customPath,
    envOverride,
    usesDefault: !envOverride && !customPath
  };
}

function getUpdateSettings() {
  const s = loadSettings();
  return {
    checkUpdatesOnStartup: Boolean(s.checkUpdatesOnStartup),
    lastUpdateCheckAt: s.lastUpdateCheckAt || null
  };
}

/**
 * @param {boolean} enabled
 */
function setCheckUpdatesOnStartup(enabled) {
  saveSettings({ checkUpdatesOnStartup: Boolean(enabled) });
  return { ok: true, checkUpdatesOnStartup: Boolean(enabled) };
}

/**
 * @param {string} iso
 */
function setLastUpdateCheckAt(iso) {
  const value = String(iso || "").trim();
  saveSettings({ lastUpdateCheckAt: value || null });
}

module.exports = {
  loadSettings,
  getCustomLogFilePath,
  setCustomLogFilePath,
  getDefaultLogFilePath,
  getEnvLogOverride,
  getLogFileSettingsInfo,
  getUpdateSettings,
  setCheckUpdatesOnStartup,
  setLastUpdateCheckAt,
  normalizeAndValidateLogFilePath
};
