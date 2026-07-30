"use strict";

/**
 * Arguments Electron pour Linux (CI GitHub + xvfb-run) : sans cela, le processus
 * peut rester bloqué au lancement ou au teardown (sandbox / /dev/shm).
 * @param {string[]} [extra] ajoutés après « . » (répertoire app)
 * @returns {string[]}
 */
function electronLaunchArgs(extra = []) {
  const args = [".", ...extra];
  if (process.platform === "linux") {
    for (const flag of ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]) {
      if (!args.includes(flag)) args.push(flag);
    }
  }
  return args;
}

/** Timeout `electron.launch` / `firstWindow` : machines CI souvent plus lentes. */
function electronLaunchTimeoutMs() {
  return process.env.CI ? 180000 : 90000;
}

function electronFirstWindowTimeoutMs() {
  return electronLaunchTimeoutMs();
}

/**
 * @param {Record<string, string | undefined>} [overrides]
 * @returns {Record<string, string | undefined>}
 */
function mergeProcessEnv(overrides = {}) {
  const base = { ...process.env, ...overrides };
  if (process.env.CI && process.platform === "linux") {
    base.ELECTRON_DISABLE_GPU = "1";
    base.LIBGL_ALWAYS_SOFTWARE = "1";
  }
  return base;
}

/** Attente `window.__EDITIFY_I18N` (bundle léger) : CI peut être très lent. */
function waitForBareI18nTimeoutMs() {
  return process.env.CI ? 120000 : 60000;
}

/**
 * @param {import("child_process").ChildProcess | null} proc
 */
function killElectronProcess(proc) {
  if (!proc || typeof proc.kill !== "function" || proc.killed) return;
  try {
    proc.kill(process.platform === "win32" ? undefined : "SIGKILL");
  } catch {
    /* intentional: kill electron child best-effort */
  }
}

/**
 * @param {number | undefined} pid
 * @returns {boolean}
 */
function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    /* intentional: ESRCH / EPERM ⇒ process absent */
    return false;
  }
}

/**
 * Playwright peut résoudre `app.close()` avant que le PID enfant ait émis `exit`
 * (ex. sous-processus Python). `gracefullyCloseAll()` au shutdown du worker attend
 * alors encore ce PID → « Worker teardown timeout ».
 * @param {import("child_process").ChildProcess | null} proc
 * @param {number} maxWaitMs
 */
async function waitChildExitOrKill(proc, maxWaitMs) {
  if (!proc) return;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (proc.exitCode != null || proc.signalCode != null || proc.killed) {
      // Laisser le temps à la mort de se propager avant que gracefullyCloseAll() vérifie
      await new Promise((r) => setTimeout(r, 150));
      return;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  killElectronProcess(proc);
  // Attendre que SIGKILL prenne effet (évite que gracefullyCloseAll() trouve le process encore vivant)
  await new Promise((r) => setTimeout(r, 400));
}

/**
 * Attente réelle disparition du PID (handles OS), au-delà du flag `proc.killed`.
 * @param {number | undefined} pid
 * @param {number} maxWaitMs
 */
async function waitPidFullyGone(pid, maxWaitMs) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      await new Promise((r) => setTimeout(r, 100));
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    /* intentional: déjà mort ou non signalable */
  }
  await new Promise((r) => setTimeout(r, 300));
}

/**
 * Ferme l’app Playwright Electron ; sous xvfb/CI, `app.close()` peut ne jamais résoudre
 * (processus bloqué) ou laisser le PID vivre → « Worker teardown timeout ».
 * Sous CI macOS (partage Python), attend la mort réelle du PID + court settle FD.
 * @param {import("@playwright/test").ElectronApplication} app
 * @param {number} [closeMs]
 */
async function closeElectronApp(app, closeMs) {
  const ms = closeMs ?? (process.env.CI ? 25000 : 12000);
  const proc = typeof app.process === "function" ? app.process() : null;
  const pid = proc?.pid;
  try {
    await Promise.race([
      app.close(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Electron app.close() timeout")), ms);
      })
    ]);
  } catch {
    killElectronProcess(proc);
    try {
      await app.close();
    } catch {
      /* intentional: best-effort second close after kill */
    }
  }
  if (process.env.CI) {
    // Tuer les enfants directs d'Electron (Python, renderer) AVANT d'attendre leur mort
    // — ne pas tuer le groupe de processus : cela peut inclure xvfb et casser les tests suivants
    // Sous MANI_PDF_PYTHON_EXTERNAL, le Python partagé n'est PAS enfant d'Electron.
    if (proc?.pid && process.platform === "linux") {
      const { execSync } = require("child_process");
      try {
        execSync(`pkill -KILL -P ${proc.pid}`, { stdio: "ignore" });
      } catch {
        /* intentional: pkill children already exited */
      }
    }
    await waitChildExitOrKill(proc, 8000);
    // Preuve OS : le PID n'accepte plus kill(0) avant le prochain electron.launch
    await waitPidFullyGone(pid, 5000);
    // macOS : laisser le kernel libérer les FD du process mort (évite EMFILE en suite rapide)
    if (process.platform === "darwin") {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

module.exports = {
  electronLaunchArgs,
  electronLaunchTimeoutMs,
  electronFirstWindowTimeoutMs,
  mergeProcessEnv,
  waitForBareI18nTimeoutMs,
  closeElectronApp,
  isPidAlive,
  waitPidFullyGone
};
