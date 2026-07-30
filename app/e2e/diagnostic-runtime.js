"use strict";

/**
 * Diagnostic E2E runtime (CI) : forward renderer logs + dump __maniE2E au moment des échecs.
 * Les console.log() ici sortent côté Node → visible dans le log archive GitHub Actions.
 *
 * Ne pas appeler test.afterEach() depuis ce module au chargement de playwright.config.js
 * (interdit par Playwright). Brancher via e2e/editra-test.js (fixture auto).
 */

/** @type {import("@playwright/test").Page | null} */
let lastDiagnosticPage = null;

const DIAG_PREFIX = "[e2e-diagnostic]";
const CONSOLE_PREFIX = "[e2e-renderer-console]";
const PAGEERROR_PREFIX = "[e2e-renderer-pageerror]";

/**
 * @param {import("@playwright/test").Page} page
 */
function attachE2eDiagnostics(page) {
  if (!page || page.__editraDiagWired) return page;
  page.__editraDiagWired = true;
  lastDiagnosticPage = page;

  if (process.env.CI) {
    page.on("console", (msg) => {
      const loc = msg.location();
      const where = loc.url ? `${loc.url}:${loc.lineNumber ?? 0}` : "unknown";
      console.log(`${CONSOLE_PREFIX} type=${msg.type()} ${where} ${msg.text()}`);
    });

    page.on("pageerror", (err) => {
      console.log(`${PAGEERROR_PREFIX} ${err?.message || String(err)}`);
      if (err?.stack) {
        console.log(`${PAGEERROR_PREFIX}-stack ${err.stack}`);
      }
    });
  }

  return page;
}

/**
 * @returns {import("@playwright/test").Page | null}
 */
function getLastDiagnosticPage() {
  return lastDiagnosticPage;
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {string} label
 */
async function dumpUiStateToNodeLog(page, label) {
  console.log(`${DIAG_PREFIX} === ${label} ===`);
  if (!page) {
    console.log(`${DIAG_PREFIX} page=null`);
    return;
  }

  try {
    const types = await page.evaluate(() => ({
      maniE2E_typeof: typeof window.__maniE2E,
      getUiState_typeof: typeof window.__maniE2E?.getUiState,
      maniPdfApi_typeof: typeof window.maniPdfApi
    }));
    console.log(`${DIAG_PREFIX} typeof window.__maniE2E=${types.maniE2E_typeof}`);
    console.log(`${DIAG_PREFIX} typeof window.__maniE2E?.getUiState=${types.getUiState_typeof}`);
    console.log(`${DIAG_PREFIX} typeof window.maniPdfApi=${types.maniPdfApi_typeof}`);
  } catch (err) {
    console.log(`${DIAG_PREFIX} typeof probe failed: ${err?.message || String(err)}`);
  }

  try {
    const uiResult = await page.evaluate(() => {
      if (typeof window.__maniE2E?.getUiState !== "function") {
        return { ok: false, reason: "getUiState not a function" };
      }
      try {
        return { ok: true, state: window.__maniE2E.getUiState() };
      } catch (e) {
        return { ok: false, throwMessage: e?.message || String(e) };
      }
    });
    if (uiResult.ok) {
      console.log(`${DIAG_PREFIX} getUiState()=${JSON.stringify(uiResult.state)}`);
    } else if (uiResult.throwMessage) {
      console.log(`${DIAG_PREFIX} getUiState() threw: ${uiResult.throwMessage}`);
    } else {
      console.log(`${DIAG_PREFIX} getUiState unavailable: ${uiResult.reason || "unknown"}`);
    }
  } catch (err) {
    console.log(`${DIAG_PREFIX} page.evaluate failed: ${err?.message || String(err)}`);
  }

  console.log(`${DIAG_PREFIX} === end ${label} ===`);
}

function patchElectronLaunchForDiagnostics() {
  const { _electron } = require("@playwright/test");
  if (!_electron || typeof _electron.launch !== "function" || _electron.__editraLaunchPatched) {
    return;
  }
  _electron.__editraLaunchPatched = true;

  const originalLaunch = _electron.launch.bind(_electron);
  _electron.launch = async function patchedElectronLaunch(options) {
    const app = await originalLaunch(options);
    const originalFirstWindow = app.firstWindow.bind(app);
    app.firstWindow = async function patchedFirstWindow(fwOptions) {
      const page = await originalFirstWindow(fwOptions);
      attachE2eDiagnostics(page);
      return page;
    };
    return app;
  };
}

module.exports = {
  attachE2eDiagnostics,
  dumpUiStateToNodeLog,
  getLastDiagnosticPage,
  patchElectronLaunchForDiagnostics
};
