"use strict";

/**
 * Playwright globalSetup — démarre un service Python partagé sur CI macOS uniquement.
 * No-op partout ailleurs (dev, Windows/Linux E2E) ⇒ zéro changement de comportement.
 */

const crypto = require("node:crypto");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  PYTHON_SHARED_PORT,
  shouldStartSharedPython,
  writeSharedPythonState,
  clearSharedPythonState,
  isProcessAlive
} = require("./python-shared-state");

/**
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
function waitForHealth(timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`python-shared globalSetup: /health timeout après ${timeoutMs}ms`));
        return;
      }
      const req = http.get(
        {
          host: "127.0.0.1",
          port: PYTHON_SHARED_PORT,
          path: "/health",
          timeout: 2000
        },
        (res) => {
          let body = "";
          res.on("data", (c) => {
            body += c;
          });
          res.on("end", () => {
            try {
              const json = JSON.parse(body);
              if (res.statusCode === 200 && json && json.ok === true) {
                resolve();
                return;
              }
            } catch {
              /* intentional: body /health non-JSON pendant le boot — retry */
            }
            setTimeout(attempt, 200);
          });
        }
      );
      req.on("error", () => setTimeout(attempt, 200));
      req.on("timeout", () => {
        req.destroy();
        setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

module.exports = async function globalSetup() {
  if (!shouldStartSharedPython()) {
    console.log("[python-shared] globalSetup: no-op (hors CI darwin)");
    return;
  }

  clearSharedPythonState();

  const token = crypto.randomBytes(32).toString("hex");
  const pyDir = path.join(__dirname, "..", "python");
  const scriptPath = path.join(pyDir, "pdf_service.py");

  const child = spawn("python3", [scriptPath], {
    cwd: pyDir,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      PYTHONPATH: pyDir,
      PYTHONUTF8: "1",
      MANI_PDF_SERVICE_TOKEN: token
    },
    // ignore total : évite un pipe stderr tenu ouvert (fuite FD / flood logs → EMFILE).
    stdio: "ignore",
    detached: true
  });
  child.unref();

  child.on("exit", (code, signal) => {
    console.log("[python-shared] process exit", { code, signal, pid: child.pid });
  });

  if (!child.pid) {
    throw new Error("python-shared globalSetup: spawn sans pid");
  }

  try {
    await waitForHealth(120000);
  } catch (err) {
    try {
      process.kill(child.pid, "SIGKILL");
    } catch {
      /* intentional: process déjà mort après échec health */
    }
    clearSharedPythonState();
    throw err;
  }

  if (!isProcessAlive(child.pid)) {
    clearSharedPythonState();
    throw new Error("python-shared globalSetup: process mort après /health");
  }

  writeSharedPythonState({ pid: child.pid, token, port: PYTHON_SHARED_PORT });

  process.env.MANI_PDF_PYTHON_EXTERNAL = "1";
  process.env.MANI_PDF_SERVICE_TOKEN = token;

  console.log(
    "[python-shared] globalSetup: ready",
    JSON.stringify({ pid: child.pid, port: PYTHON_SHARED_PORT })
  );
};
