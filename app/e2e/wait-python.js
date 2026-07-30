"use strict";

/**
 * Attente service Python avant ouverture PDF en E2E.
 * Scopé CI + darwin uniquement : cold-start Python intermittent observé sur runners macOS.
 * Fail-closed inchangé côté produit ; on attend juste que /health réponde avant open.
 */

/**
 * @returns {boolean}
 */
function shouldWaitForPythonBeforePdfOpen() {
  return Boolean(process.env.CI) && process.platform === "darwin";
}

/**
 * Poll `maniPdfApi.pythonHealth()` jusqu’à ok (ou timeout).
 * No-op hors CI macOS.
 *
 * @param {import("@playwright/test").Page} page
 * @param {{ timeoutMs?: number }} [options]
 */
async function waitForPythonReady(page, options = {}) {
  if (!shouldWaitForPythonBeforePdfOpen()) return;
  if (!page) {
    throw new Error("waitForPythonReady: page manquante");
  }

  const timeoutMs = options.timeoutMs ?? 90000;
  await page.waitForFunction(() => typeof window.maniPdfApi?.pythonHealth === "function", null, {
    timeout: timeoutMs
  });

  const started = Date.now();
  let delayMs = 100;
  const maxDelayMs = 500;
  let last = null;

  while (Date.now() - started < timeoutMs) {
    try {
      last = await page.evaluate(() => window.maniPdfApi.pythonHealth());
      if (last && last.ok === true) {
        console.log(
          "[e2e-python-ready]",
          JSON.stringify({
            ok: true,
            export_ready: Boolean(last.export_ready),
            waitedMs: Date.now() - started
          })
        );
        return;
      }
    } catch (err) {
      last = { ok: false, error: err?.message || String(err) };
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(maxDelayMs, Math.round(delayMs * 1.4));
  }

  throw new Error(
    `waitForPythonReady: pythonHealth non ok après ${timeoutMs}ms` +
      (last ? ` last=${JSON.stringify(last)}` : "")
  );
}

module.exports = {
  shouldWaitForPythonBeforePdfOpen,
  waitForPythonReady
};
