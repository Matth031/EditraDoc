/**
 * E3 — session save/load : échecs signalés (plus de .catch(() => {}) silencieux).
 * contextBridge fige maniPdfApi → seam `__editifySessionApiOverride`.
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");
const path = require("path");
const fs = require("fs");

function getRepoPdfFixture() {
  const p = path.resolve(process.cwd(), "..", "tests", "formulaire_test.pdf");
  if (!fs.existsSync(p)) throw new Error(`Fixture PDF introuvable: ${p}`);
  return p;
}

async function launchAppBare() {
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1"
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!window.maniPdfApi && !!window.__editifySession, null, {
    timeout: 90000,
    polling: 250
  });
  return { app, page };
}

test("E3: loadSession ok:false → statut stSessionLoadFailed (pas silencieux)", async () => {
  const { app, page } = await launchAppBare();
  const result = await page.evaluate(async () => {
    globalThis.__editifySessionApiOverride = {
      isE2E: () => false,
      loadSession: async () => ({ ok: false, error: "forced load fail" }),
      saveSession: async () => ({ ok: true }),
      openPdf: async () => ({ ok: false })
    };
    try {
      await window.__editifySession.loadSession();
    } finally {
      delete globalThis.__editifySessionApiOverride;
    }
    const hist = Array.isArray(window.__maniStatusHistory) ? window.__maniStatusHistory.slice(-8) : [];
    return hist.map(String);
  });
  expect(
    result.some((m) => /restaurer|restore|restaurar|sess[aã]o|sesi[oó]n|session/i.test(m)),
    `statut attendu stSessionLoadFailed, got: ${JSON.stringify(result)}`
  ).toBe(true);
  await e2eCi.closeElectronApp(app);
});

test("E3: saveSession rejet IPC → statut plafond 50 Mo (garde main inchangée)", async () => {
  const { app, page } = await launchAppBare();
  const pdfPath = getRepoPdfFixture();
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfPath);
  await expect(page.locator("#tabs .tab").first()).toBeVisible({ timeout: 60000 });

  const result = await page.evaluate(async () => {
    globalThis.__editifySessionApiOverride = {
      isE2E: () => false,
      loadSession: async () => ({ ok: true, data: null }),
      saveSession: async () => ({
        ok: false,
        errorCode: "SESSION_PAYLOAD_TOO_LARGE",
        error: "too large"
      }),
      openPdf: async (p) => ({ ok: true, path: p })
    };
    let saveResult;
    try {
      saveResult = await window.__editifySession.saveSession({ source: "e2e-test" });
    } finally {
      delete globalThis.__editifySessionApiOverride;
    }
    const hist = Array.isArray(window.__maniStatusHistory) ? window.__maniStatusHistory.slice(-8) : [];
    return { saveResult, hist: hist.map(String) };
  });
  expect(result.saveResult?.ok).toBe(false);
  expect(result.saveResult?.errorCode).toBe("SESSION_PAYLOAD_TOO_LARGE");
  expect(
    result.hist.some((m) => /50\s*Mo|50\s*MB|trop d'annotations|too many annotations/i.test(m)),
    `statut plafond 50 Mo attendu, got: ${JSON.stringify(result.hist)}`
  ).toBe(true);
  await e2eCi.closeElectronApp(app);
});

test("E3: saveSession throw → promesse rejetée (appelant peut reportCaughtError)", async () => {
  const { app, page } = await launchAppBare();
  const outcome = await page.evaluate(async () => {
    globalThis.__editifySessionApiOverride = {
      isE2E: () => false,
      loadSession: async () => ({ ok: true, data: null }),
      saveSession: async () => {
        throw new Error("forced save throw");
      },
      openPdf: async () => ({ ok: false })
    };
    let rejected = false;
    let message = "";
    try {
      await window.__editifySession.saveSession({ quietStatus: true, source: "e2e-throw" });
    } catch (error) {
      rejected = true;
      message = String(error?.message || error);
    } finally {
      delete globalThis.__editifySessionApiOverride;
    }
    return { rejected, message };
  });
  expect(outcome.rejected).toBe(true);
  expect(outcome.message).toMatch(/forced save throw/);
  await e2eCi.closeElectronApp(app);
});
