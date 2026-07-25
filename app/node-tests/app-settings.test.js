/**
 * L4 — `app-settings.js` via seams (chemin settings / getPath / getInstallRoot).
 * Pas d’appel à electron.app.getPath réel ni à install-path en tests.
 */
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  configureAppSettingsForTests,
  resetAppSettingsForTests,
  loadSettings,
  getUpdateSettings,
  setCheckUpdatesOnStartup,
  setLastUpdateCheckAt,
  getCustomLogFilePath,
  setCustomLogFilePath,
  getDefaultLogFilePath,
  getEnvLogOverride,
  getLogFileSettingsInfo
} = require("../src/main/app-settings");

/**
 * @returns {{ dir: string, settingsPath: string, installRoot: string, cleanup: () => void }}
 */
function makeSettingsFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "editradoc-settings-"));
  const userData = path.join(dir, "userData");
  const installRoot = path.join(dir, "install");
  fs.mkdirSync(userData, { recursive: true });
  fs.mkdirSync(installRoot, { recursive: true });
  const settingsPath = path.join(userData, "app-settings.json");
  return {
    dir,
    settingsPath,
    installRoot,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* intentional: tmp cleanup best-effort */
      }
    }
  };
}

beforeEach(() => {
  resetAppSettingsForTests();
});

afterEach(() => {
  resetAppSettingsForTests();
  delete process.env.EDITRADOC_LOG_PATH;
  delete process.env.MANI_PDF_LOG_PATH;
});

describe("loadSettings / update settings", () => {
  test("fichier absent → défauts opt-in off", () => {
    const fx = makeSettingsFixture();
    try {
      configureAppSettingsForTests({
        settingsFilePath: fx.settingsPath,
        getInstallRoot: () => fx.installRoot
      });
      const s = loadSettings();
      assert.equal(s.logFilePath, null);
      assert.equal(s.checkUpdatesOnStartup, false);
      assert.equal(s.lastUpdateCheckAt, null);
      assert.deepEqual(getUpdateSettings(), {
        checkUpdatesOnStartup: false,
        lastUpdateCheckAt: null
      });
    } finally {
      fx.cleanup();
    }
  });

  test("lit JSON existant + setCheckUpdatesOnStartup / setLastUpdateCheckAt", () => {
    const fx = makeSettingsFixture();
    try {
      fs.writeFileSync(
        fx.settingsPath,
        JSON.stringify({
          checkUpdatesOnStartup: true,
          lastUpdateCheckAt: "2026-06-01T00:00:00.000Z",
          logFilePath: "  "
        }),
        "utf8"
      );
      configureAppSettingsForTests({
        settingsFilePath: fx.settingsPath,
        getInstallRoot: () => fx.installRoot
      });
      assert.equal(getUpdateSettings().checkUpdatesOnStartup, true);
      assert.equal(getUpdateSettings().lastUpdateCheckAt, "2026-06-01T00:00:00.000Z");

      const r = setCheckUpdatesOnStartup(false);
      assert.equal(r.ok, true);
      assert.equal(r.checkUpdatesOnStartup, false);
      setLastUpdateCheckAt("2026-07-25T12:00:00.000Z");
      assert.equal(getUpdateSettings().lastUpdateCheckAt, "2026-07-25T12:00:00.000Z");

      const saved = JSON.parse(fs.readFileSync(fx.settingsPath, "utf8"));
      assert.equal(saved.checkUpdatesOnStartup, false);
      assert.equal(saved.lastUpdateCheckAt, "2026-07-25T12:00:00.000Z");
    } finally {
      fx.cleanup();
    }
  });

  test("JSON corrompu → défauts sans throw", () => {
    const fx = makeSettingsFixture();
    try {
      fs.writeFileSync(fx.settingsPath, "{broken", "utf8");
      configureAppSettingsForTests({ settingsFilePath: fx.settingsPath });
      const s = loadSettings();
      assert.equal(s.checkUpdatesOnStartup, false);
      assert.equal(s.logFilePath, null);
    } finally {
      fx.cleanup();
    }
  });

  test("seam getPath(userData) si settingsFilePath non fourni", () => {
    const fx = makeSettingsFixture();
    try {
      configureAppSettingsForTests({
        getPath: (name) => {
          assert.equal(name, "userData");
          return path.dirname(fx.settingsPath);
        },
        getInstallRoot: () => fx.installRoot
      });
      setCheckUpdatesOnStartup(true);
      assert.equal(fs.existsSync(fx.settingsPath), true);
      assert.equal(getUpdateSettings().checkUpdatesOnStartup, true);
    } finally {
      fx.cleanup();
    }
  });
});

describe("chemins de logs", () => {
  test("getDefaultLogFilePath via getInstallRoot injecté", () => {
    const fx = makeSettingsFixture();
    try {
      configureAppSettingsForTests({
        settingsFilePath: fx.settingsPath,
        getInstallRoot: () => fx.installRoot
      });
      assert.equal(getDefaultLogFilePath(), path.join(fx.installRoot, "logs.txt"));
    } finally {
      fx.cleanup();
    }
  });

  test("setCustomLogFilePath null + chemin valide", () => {
    const fx = makeSettingsFixture();
    try {
      configureAppSettingsForTests({
        settingsFilePath: fx.settingsPath,
        getInstallRoot: () => fx.installRoot
      });
      assert.deepEqual(setCustomLogFilePath(null), { ok: true, path: null });
      assert.equal(getCustomLogFilePath(), null);

      const logPath = path.join(fx.dir, "custom", "app.log");
      const r = setCustomLogFilePath(logPath);
      assert.equal(r.ok, true);
      assert.equal(r.path, path.resolve(logPath));
      assert.equal(getCustomLogFilePath(), path.resolve(logPath));
    } finally {
      fx.cleanup();
    }
  });

  test("getEnvLogOverride + getLogFileSettingsInfo", () => {
    const fx = makeSettingsFixture();
    try {
      configureAppSettingsForTests({
        settingsFilePath: fx.settingsPath,
        getInstallRoot: () => fx.installRoot
      });
      assert.equal(getEnvLogOverride(), null);
      process.env.EDITRADOC_LOG_PATH = "E:\\fake\\env.log";
      assert.equal(getEnvLogOverride(), "E:\\fake\\env.log");

      const info = getLogFileSettingsInfo(() => "E:\\effective.log");
      assert.equal(info.ok, true);
      assert.equal(info.effectivePath, "E:\\effective.log");
      assert.equal(info.defaultPath, path.join(fx.installRoot, "logs.txt"));
      assert.equal(info.envOverride, "E:\\fake\\env.log");
      assert.equal(info.usesDefault, false);
    } finally {
      fx.cleanup();
    }
  });

  test("getLogFileSettingsInfo sans callback → defaultPath", () => {
    const fx = makeSettingsFixture();
    try {
      configureAppSettingsForTests({
        settingsFilePath: fx.settingsPath,
        getInstallRoot: () => fx.installRoot
      });
      const info = getLogFileSettingsInfo();
      assert.equal(info.effectivePath, info.defaultPath);
      assert.equal(info.usesDefault, true);
    } finally {
      fx.cleanup();
    }
  });
});
