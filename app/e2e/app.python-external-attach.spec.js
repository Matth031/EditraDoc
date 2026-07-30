"use strict";

/**
 * Preuve runtime : en mode attach, closeElectronApp (teardown E2E) ne tue PAS
 * le process Python/mock partagé sur :8765.
 *
 * - CI macOS : réutilise le PID du globalSetup.
 * - Ailleurs : démarre mock-python-health-server.js, le tue en finally.
 */

const crypto = require("node:crypto");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test, expect, _electron } = require("./editra-test");
const e2eCi = require("./electron-ci-env");
const {
  PYTHON_SHARED_PORT,
  readSharedPythonState,
  isProcessAlive
} = require("./python-shared-state");
const { freeLocalPort } = require("../src/main/lib/free-local-port");

const MOCK_SERVER_JS = path.join(__dirname, "mock-python-health-server.js");

/**
 * @returns {Promise<{ pid: number, kill: () => void }>}
 */
async function startOwnedMockServer() {
  await freeLocalPort(PYTHON_SHARED_PORT);
  const child = spawn(process.execPath, [MOCK_SERVER_JS], {
    env: { ...process.env, MOCK_PYTHON_PORT: String(PYTHON_SHARED_PORT) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mock-python-health: ready timeout")), 15000);
    let buf = "";
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      if (buf.includes('"ready":true') || buf.includes('"ready": true')) {
        clearTimeout(timer);
        try {
          const line = buf
            .split(/\r?\n/)
            .map((l) => l.trim())
            .find((l) => l.startsWith("{"));
          resolve(JSON.parse(line));
        } catch (err) {
          reject(err);
        }
      }
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`mock-python-health exited early code=${code}`));
    });
  });

  const pid = Number(ready.pid || child.pid);
  return {
    pid,
    kill() {
      try {
        if (process.platform === "win32") {
          const { execSync } = require("node:child_process");
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
        } else {
          process.kill(pid, "SIGKILL");
        }
      } catch {
        /* intentional: mock déjà mort */
      }
    }
  };
}

test.describe("python external attach", () => {
  test("shared python/mock survives Electron closeElectronApp", async () => {
    let owned = null;
    /** @type {number} */
    let sharedPid;
    /** @type {string} */
    let token;

    const existing = readSharedPythonState();
    if (process.env.MANI_PDF_PYTHON_EXTERNAL === "1" && existing && isProcessAlive(existing.pid)) {
      sharedPid = existing.pid;
      token = existing.token;
    } else {
      token = crypto.randomBytes(32).toString("hex");
      owned = await startOwnedMockServer();
      sharedPid = owned.pid;
    }

    expect(isProcessAlive(sharedPid)).toBe(true);

    let app;
    try {
      app = await _electron.launch({
        args: e2eCi.electronLaunchArgs(),
        env: e2eCi.mergeProcessEnv({
          MANI_PDF_E2E: "1",
          MANI_PDF_PYTHON_EXTERNAL: "1",
          MANI_PDF_SERVICE_TOKEN: token
        }),
        timeout: e2eCi.electronLaunchTimeoutMs()
      });
      const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
      await page.waitForFunction(() => Boolean(window.__EDITIFY_I18N), null, {
        timeout: e2eCi.waitForBareI18nTimeoutMs()
      });

      // Teardown nominal d’une spec E2E (handlers will-quit → stopPythonService).
      await e2eCi.closeElectronApp(app);
      app = null;

      // Preuve réelle : le process partagé n’a pas été tué.
      expect(
        isProcessAlive(sharedPid),
        `process partagé pid=${sharedPid} doit rester vivant après closeElectronApp`
      ).toBe(true);
    } finally {
      if (app) {
        try {
          await e2eCi.closeElectronApp(app);
        } catch {
          /* intentional: best-effort cleanup si le test a déjà fermé l'app */
        }
      }
      if (owned) {
        // Ne tuer le mock que s’il nous appartient (pas le Python CI globalSetup).
        owned.kill();
      }
    }
  });
});
