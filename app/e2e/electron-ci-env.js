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
 * Ferme l’app Playwright Electron ; sous xvfb/CI, `app.close()` peut ne jamais résoudre
 * (processus bloqué) et déclencher « Worker teardown timeout ».
 * @param {import("@playwright/test").ElectronApplication} app
 * @param {number} [closeMs]
 */
async function closeElectronApp(app, closeMs = 15000) {
  const proc = typeof app.process === "function" ? app.process() : null;
  try {
    await Promise.race([
      app.close(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Electron app.close() timeout")), closeMs);
      })
    ]);
  } catch {
    try {
      if (proc && typeof proc.kill === "function" && !proc.killed) {
        proc.kill(process.platform === "win32" ? undefined : "SIGKILL");
      }
    } catch {
      /* ignore */
    }
    await app.close().catch(() => {});
  }
}

module.exports = {
  electronLaunchArgs,
  electronLaunchTimeoutMs,
  electronFirstWindowTimeoutMs,
  mergeProcessEnv,
  waitForBareI18nTimeoutMs,
  closeElectronApp
};
