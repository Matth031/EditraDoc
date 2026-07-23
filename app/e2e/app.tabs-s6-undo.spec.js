/**
 * S6 — undo toast restaure onglet + pdf:read-bytes OK sur chemin re-validé via pdf:open.
 * Obligatoire avant extraction renderer-tabs.js (Lot 4).
 */
const { test, expect, _electron: electron } = require("@playwright/test");
const electronPath = require("electron");
const e2eCi = require("./electron-ci-env");
const path = require("path");
const fs = require("fs");
const { waitForPdfPagesRendered } = require("./helpers");

function getPdfFixtures() {
  const root = path.resolve(process.cwd(), "..", "tests");
  const primary = path.join(root, "formulaire_test.pdf");
  const secondary = path.join(root, "formulaire_test-compressed.pdf");
  for (const p of [primary, secondary]) {
    if (!fs.existsSync(p)) {
      throw new Error(`Fixture PDF introuvable: ${p}`);
    }
  }
  return { primary, secondary, secondaryBase: path.basename(secondary) };
}

async function launchApp() {
  const { primary } = getPdfFixtures();
  const app = await electron.launch({
    executablePath: electronPath,
    args: e2eCi.electronLaunchArgs(),
    timeout: e2eCi.electronLaunchTimeoutMs(),
    env: e2eCi.mergeProcessEnv({
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      MANI_PDF_E2E: "1",
      MANI_PDF_E2E_PDF_PATH: primary
    })
  });
  const page = await app.firstWindow({ timeout: e2eCi.electronFirstWindowTimeoutMs() });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !!window.maniPdfApi);
  return { app, page };
}

async function clearSessionStorage(page) {
  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {
      /* intentional: clear storage in e2e setup best-effort */
    }
  });
}

async function openPdfFromMenu(app, page, pdfPath) {
  await app.evaluate(({ BrowserWindow }, p) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents?.send?.("pdf:open-from-menu", p);
  }, pdfPath);
}

test("S6 undo toast : restaure onglet fermé et pdf:read-bytes OK", async () => {
  const { app, page } = await launchApp();
  const { primary, secondary, secondaryBase } = getPdfFixtures();

  try {
    await clearSessionStorage(page);

    await openPdfFromMenu(app, page, primary);
    await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 30000 });
    await expect(page.locator("#pagesContainer .pdf-page").first()).toBeVisible({ timeout: 30000 });

    await openPdfFromMenu(app, page, secondary);
    await expect(page.locator("#tabs .tab")).toHaveCount(2, { timeout: 30000 });
    await waitForPdfPagesRendered(page);

    const secondaryTab = page.locator("#tabs .tab", { hasText: secondaryBase });
    await expect(secondaryTab).toHaveCount(1);
    await secondaryTab.locator(".tab-close").click();

    await expect(page.locator("#tabs .tab")).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator(".toast-root .toast")).toHaveCount(1);
    await expect(page.locator(".toast-root .toast")).toContainText("PDF retiré");

    const readBlocked = await page.evaluate(async (closedPath) => {
      const res = await window.maniPdfApi.readPdfBytes(closedPath);
      return { ok: Boolean(res?.ok), errorCode: res?.errorCode || null };
    }, secondary);
    expect(readBlocked.ok).toBe(false);
    expect(readBlocked.errorCode).toBe("PDF_READ_NOT_OPEN");

    await page.locator(".toast-root .toast .toast-action", { hasText: "Annuler" }).click();
    await expect(page.locator("#tabs .tab")).toHaveCount(2, { timeout: 15000 });
    await expect(page.locator("#tabs .tab", { hasText: secondaryBase })).toHaveCount(1);

    const readOk = await page.evaluate(async (restoredPath) => {
      const res = await window.maniPdfApi.readPdfBytes(restoredPath);
      return {
        ok: Boolean(res?.ok),
        base64Len: res?.base64 ? String(res.base64).length : 0,
        errorCode: res?.errorCode || null
      };
    }, secondary);
    expect(readOk.ok).toBe(true);
    expect(readOk.base64Len).toBeGreaterThan(100);
    expect(readOk.errorCode).toBeNull();
  } finally {
    await e2eCi.closeElectronApp(app);
  }
});
