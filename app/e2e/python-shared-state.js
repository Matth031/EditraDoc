"use strict";

/**
 * État du service Python partagé (CI macOS E2E uniquement).
 * Fichier lu/écrit par globalSetup / globalTeardown / spec de survie.
 */

const fs = require("node:fs");
const path = require("node:path");

const PYTHON_SHARED_PORT = 8765;
const STATE_PATH = path.join(__dirname, "..", "e2e-output", "python-shared-state.json");

/**
 * @returns {boolean}
 */
function shouldStartSharedPython() {
  return Boolean(process.env.CI) && process.platform === "darwin";
}

/**
 * @returns {{ pid: number, token: string, port: number } | null}
 */
function readSharedPythonState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return null;
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    const pid = Number(parsed?.pid);
    const token = typeof parsed?.token === "string" ? parsed.token : "";
    const port = Number(parsed?.port) || PYTHON_SHARED_PORT;
    if (!Number.isInteger(pid) || pid <= 0 || !token) return null;
    return { pid, token, port };
  } catch {
    /* intentional: état absent ou JSON invalide */
    return null;
  }
}

/**
 * @param {{ pid: number, token: string, port?: number }} state
 */
function writeSharedPythonState(state) {
  const dir = path.dirname(STATE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    STATE_PATH,
    JSON.stringify(
      {
        pid: state.pid,
        token: state.token,
        port: state.port || PYTHON_SHARED_PORT,
        startedAt: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );
}

function clearSharedPythonState() {
  try {
    if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
  } catch {
    /* intentional: best-effort cleanup */
  }
}

/**
 * @param {number} pid
 * @returns {boolean}
 */
function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    /* intentional: ESRCH / EPERM ⇒ process absent */
    return false;
  }
}

module.exports = {
  PYTHON_SHARED_PORT,
  STATE_PATH,
  shouldStartSharedPython,
  readSharedPythonState,
  writeSharedPythonState,
  clearSharedPythonState,
  isProcessAlive
};
