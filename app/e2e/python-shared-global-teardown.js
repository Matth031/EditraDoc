"use strict";

/**
 * Playwright globalTeardown — tue le Python partagé même si des tests ont échoué.
 * No-op si aucun état (hors CI darwin ou setup non exécuté).
 */

const { execSync } = require("node:child_process");
const {
  PYTHON_SHARED_PORT,
  readSharedPythonState,
  clearSharedPythonState,
  isProcessAlive
} = require("./python-shared-state");
const { findListeningPidOnPort, killProcessTree } = require("../src/main/lib/free-local-port");

/**
 * @param {number} pid
 */
function killPid(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
  } catch {
    /* intentional: already exited */
  }
}

module.exports = async function globalTeardown() {
  const state = readSharedPythonState();
  if (!state) {
    // Filet : orphelin éventuel sur le port (setup crash mid-flight).
    const orphan = findListeningPidOnPort(PYTHON_SHARED_PORT);
    if (orphan) {
      console.log("[python-shared] globalTeardown: kill orphan port listener", orphan);
      killProcessTree(orphan);
    }
    return;
  }

  console.log("[python-shared] globalTeardown: kill", JSON.stringify({ pid: state.pid }));
  killPid(state.pid);

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && isProcessAlive(state.pid)) {
    await new Promise((r) => setTimeout(r, 100));
    killPid(state.pid);
  }

  if (isProcessAlive(state.pid)) {
    console.warn("[python-shared] globalTeardown: pid encore vivant après retries", state.pid);
  }

  const stillListening = findListeningPidOnPort(PYTHON_SHARED_PORT);
  if (stillListening) {
    console.log("[python-shared] globalTeardown: free port via listener pid", stillListening);
    killProcessTree(stillListening);
  }

  clearSharedPythonState();
};
